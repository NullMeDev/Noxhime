import * as os from "os";
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { schedule } from 'node-cron';
import crypto from 'crypto';

const execAsync = util.promisify(exec);
const fsPromises = fs.promises;

/**
 * Interface for backup configuration
 */
interface BackupConfig {
    id: string;
    name: string;
    source: string[];
    destination: string;
    schedule: string; // cron format
    retention: number; // number of backups to keep
    encrypt: boolean;
    remoteSync: boolean;
    remotePath?: string;
    validate: boolean;
}

/**
 * Interface for backup result
 */
interface BackupResult {
    id: string;
    timestamp: string;
    success: boolean;
    files: string[];
    size: number; // in bytes
    duration: number; // in seconds
    error?: string;
    validationResult?: ValidationResult;
}

/**
 * Interface for validation result
 */
interface ValidationResult {
    success: boolean;
    testedFiles: number;
    passedFiles: number;
    failedFiles: string[];
    error?: string;
}

/**
 * Interface for restore result
 */
interface RestoreResult {
    id: string;
    timestamp: string;
    success: boolean;
    files: string[];
    duration: number; // in seconds
    error?: string;
}

/**
 * Class for managing disaster recovery operations
 */
export class DisasterRecovery {
    private client: Client;
    private notifyChannelId: string;
    private logEvent: (type: string, description: string) => Promise<boolean>;
    private backupConfigs: Map<string, BackupConfig> = new Map();
    private scheduleJobs: Map<string, any> = new Map();
    private backupDir: string;
    /**
     * Get the backup directory path
     * @returns Backup directory path
     */
    public getBackupDir(): string {
        return this.backupDir;
    }
    private backupScript: string;
    private encryptionKey?: string;

    /**
     * Constructor for DisasterRecovery
     * @param client Discord client
     * @param notifyChannelId Discord channel ID for notifications
     * @param logEvent Function to log events
     */
    constructor(
        client: Client,
        notifyChannelId: string,
        logEvent: (type: string, description: string) => Promise<boolean>,
        options: {
            backupDir?: string;
            backupScript?: string;
            encryptionKey?: string;
        } = {}
    ) {
        this.client = client;
        this.notifyChannelId = notifyChannelId;
        this.logEvent = logEvent;
        this.backupDir = options.backupDir || path.join(process.cwd(), 'backups');
        this.backupScript = options.backupScript || path.join(process.cwd(), 'scripts', 'backup.sh');
        this.encryptionKey = options.encryptionKey;

        // Ensure backup directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    /**
     * Add or update a backup configuration
     * @param config Backup configuration
     * @returns Success status
     */
    public async addBackupConfig(config: BackupConfig): Promise<boolean> {
        try {
            // Validate configuration
            if (!config.id || !config.source || !config.destination) {
                throw new Error('Invalid backup configuration: missing required fields');
            }

            // Remove existing schedule if any
            if (this.scheduleJobs.has(config.id)) {
                this.scheduleJobs.get(config.id).stop();
                this.scheduleJobs.delete(config.id);
            }

            // Add new schedule if provided
            if (config.schedule) {
                const job = schedule(config.schedule, () => {
                    this.runBackup(config.id)
                        .catch(err => this.logEvent('ERROR', `Scheduled backup ${config.id} failed: ${err.message}`));
                });
                this.scheduleJobs.set(config.id, job);
            }

            // Store configuration
            this.backupConfigs.set(config.id, config);
            await this.logEvent('BACKUP_CONFIG', `Backup configuration ${config.id} added or updated`);
            
            // Send notification
            await this.sendNotification(`✅ Backup configuration **${config.name}** (${config.id}) has been ${this.backupConfigs.has(config.id) ? 'updated' : 'added'}.`);
            
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.logEvent('ERROR', `Failed to add backup configuration ${config.id}: ${errorMessage}`);
            await this.sendNotification(`❌ Failed to add backup configuration **${config.name}** (${config.id}): ${errorMessage}`);
            return false;
        }
    }

    /**
     * Remove a backup configuration
     * @param id Configuration ID
     * @returns Success status
     */
    public async removeBackupConfig(id: string): Promise<boolean> {
        try {
            if (!this.backupConfigs.has(id)) {
                throw new Error(`Backup configuration ${id} not found`);
            }

            // Stop scheduled job if any
            if (this.scheduleJobs.has(id)) {
                this.scheduleJobs.get(id).stop();
                this.scheduleJobs.delete(id);
            }

            const config = this.backupConfigs.get(id)!;
            this.backupConfigs.delete(id);

            await this.logEvent('BACKUP_CONFIG', `Backup configuration ${id} removed`);
            await this.sendNotification(`✅ Backup configuration **${config.name}** (${id}) has been removed.`);
            
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.logEvent('ERROR', `Failed to remove backup configuration ${id}: ${errorMessage}`);
            await this.sendNotification(`❌ Failed to remove backup configuration ${id}: ${errorMessage}`);
            return false;
        }
    }

    /**
     * Get all backup configurations
     * @returns Map of backup configurations
     */
    public getBackupConfigs(): Map<string, BackupConfig> {
        return new Map(this.backupConfigs);
    }

    /**
     * Run a backup using configuration
     * @param id Configuration ID
     * @returns Backup result
     */
    public async runBackup(id: string): Promise<BackupResult> {
        const startTime = Date.now();
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        
        try {
            if (!this.backupConfigs.has(id)) {
                throw new Error(`Backup configuration ${id} not found`);
            }

            const config = this.backupConfigs.get(id)!;
            await this.logEvent('BACKUP_START', `Starting backup ${config.name} (${id})`);
            await this.sendNotification(`🔄 Starting backup **${config.name}** (${id})...`);

            // Create backup directory
            const backupPath = path.join(this.backupDir, `${id}_${timestamp}`);
            await fsPromises.mkdir(backupPath, { recursive: true });

            const backedUpFiles: string[] = [];
            let totalSize = 0;

            // Copy source files to backup directory
            for (const source of config.source) {
                // Use custom backup script if it's a special source like 'DATABASE'
                if (source === 'DATABASE' && fs.existsSync(this.backupScript)) {
                    await execAsync(`bash "${this.backupScript}" "${backupPath}"`);
                    // Get the backup script output files
                    const files = await fsPromises.readdir(backupPath);
                    for (const file of files) {
                        const stats = await fsPromises.stat(path.join(backupPath, file));
                        backedUpFiles.push(file);
                        totalSize += stats.size;
                    }
                } else {
                    // Regular file backup
                    const sourcePath = path.resolve(source);
                    const filename = path.basename(sourcePath);
                    const destPath = path.join(backupPath, filename);
                    
                    if (fs.existsSync(sourcePath)) {
                        await execAsync(`cp -r "${sourcePath}" "${destPath}"`);
                        const stats = await fsPromises.stat(destPath);
                        backedUpFiles.push(filename);
                        totalSize += stats.size;
                    } else {
                        await this.logEvent('WARNING', `Source path ${sourcePath} does not exist, skipping`);
                    }
                }
            }

            // Encrypt backup if configured
            if (config.encrypt && this.encryptionKey) {
                await this.encryptBackup(backupPath, this.encryptionKey);
                await this.logEvent('BACKUP_ENCRYPT', `Encrypted backup ${config.name} (${id})`);
            }

            // Sync to remote storage if configured
            if (config.remoteSync && config.remotePath) {
                await this.syncToRemote(backupPath, config.remotePath);
                await this.logEvent('BACKUP_SYNC', `Synced backup ${config.name} (${id}) to remote storage`);
            }

            // Validate backup if configured
            let validationResult: ValidationResult | undefined;
            if (config.validate) {
                validationResult = await this.validateBackup(backupPath);
                await this.logEvent('BACKUP_VALIDATE', 
                    `Validated backup ${config.name} (${id}): ${validationResult.success ? 'PASS' : 'FAIL'}`);
            }

            // Clean up old backups based on retention policy
            await this.cleanupOldBackups(id, config.retention);

            const duration = (Date.now() - startTime) / 1000;
            const result: BackupResult = {
                id,
                timestamp,
                success: true,
                files: backedUpFiles,
                size: totalSize,
                duration,
                validationResult
            };

            await this.logEvent('BACKUP_COMPLETE', 
                `Completed backup ${config.name} (${id}): ${backedUpFiles.length} files, ${this.formatSize(totalSize)}`);
            
            await this.sendNotification(`✅ Backup **${config.name}** completed successfully:\n` +
                `- Files: ${backedUpFiles.length}\n` +
                `- Size: ${this.formatSize(totalSize)}\n` +
                `- Duration: ${duration.toFixed(2)}s\n` +
                (validationResult ? `- Validation: ${validationResult.success ? '✅ Passed' : '❌ Failed'}` : ''));

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const config = this.backupConfigs.get(id);
            const configName = config ? config.name : id;
            
            await this.logEvent('BACKUP_ERROR', `Backup ${configName} (${id}) failed: ${errorMessage}`);
            await this.sendNotification(`❌ Backup **${configName}** failed: ${errorMessage}`);
            
            return {
                id,
                timestamp,
                success: false,
                files: [],
                size: 0,
                duration: (Date.now() - startTime) / 1000,
                error: errorMessage
            };
        }
    }

    /**
     * Restore from a backup
     * @param backupPath Path to backup
     * @param targetPath Path to restore to
     * @returns Restore result
     */
    public async restoreFromBackup(backupPath: string, targetPath: string): Promise<RestoreResult> {
        const startTime = Date.now();
        const timestamp = new Date().toISOString();
        
        try {
            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup path ${backupPath} not found`);
            }

            await this.logEvent('RESTORE_START', `Starting restoration from ${backupPath} to ${targetPath}`);
            await this.sendNotification(`🔄 Starting restoration from backup...`);

            // Create target directory if it doesn't exist
            await fsPromises.mkdir(targetPath, { recursive: true });

            // Check if backup is encrypted
            const isEncrypted = await this.isBackupEncrypted(backupPath);
            if (isEncrypted && this.encryptionKey) {
                await this.decryptBackup(backupPath, this.encryptionKey);
            }

            // Copy files from backup to target
            await execAsync(`cp -r "${backupPath}"/* "${targetPath}"/`);

            // Get list of restored files
            const files = await fsPromises.readdir(backupPath);

            const duration = (Date.now() - startTime) / 1000;
            const result: RestoreResult = {
                id: path.basename(backupPath),
                timestamp,
                success: true,
                files,
                duration
            };

            await this.logEvent('RESTORE_COMPLETE', 
                `Completed restoration from ${backupPath} to ${targetPath}: ${files.length} files`);
            
            await this.sendNotification(`✅ Restoration completed successfully:\n` +
                `- Files: ${files.length}\n` +
                `- Duration: ${duration.toFixed(2)}s`);

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            await this.logEvent('RESTORE_ERROR', `Restoration from ${backupPath} failed: ${errorMessage}`);
            await this.sendNotification(`❌ Restoration failed: ${errorMessage}`);
            
            return {
                id: path.basename(backupPath),
                timestamp,
                success: false,
                files: [],
                duration: (Date.now() - startTime) / 1000,
                error: errorMessage
            };
        }
    }

    /**
     * List available backups
     * @param id Optional configuration ID to filter by
     * @returns List of backup paths
     */
    public async listBackups(id?: string): Promise<string[]> {
        try {
            const files = await fsPromises.readdir(this.backupDir);
            if (id) {
                return files.filter(file => file.startsWith(`${id}_`))
                    .map(file => path.join(this.backupDir, file));
            }
            return files.map(file => path.join(this.backupDir, file));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.logEvent('ERROR', `Failed to list backups: ${errorMessage}`);
            throw new Error(`Failed to list backups: ${errorMessage}`);
        }
    }

    /**
     * Test backup restoration to verify backup integrity
     * @param backupPath Path to backup
     * @returns Test result
     */
    public async testRestore(backupPath: string): Promise<RestoreResult> {
        const tempDir = path.join(os.tmpdir(), `noxhime-restore-test-${Date.now()}`);
        try {
            const result = await this.restoreFromBackup(backupPath, tempDir);
            
            // Additional validation could be done here
            
            // Clean up
            await fsPromises.rm(tempDir, { recursive: true, force: true });
            
            await this.logEvent('RESTORE_TEST', 
                `Test restoration from ${backupPath} ${result.success ? 'passed' : 'failed'}`);
            
            await this.sendNotification(`🧪 Test restoration from ${path.basename(backupPath)} ${result.success ? '✅ passed' : '❌ failed'}`);
            
            return result;
        } catch (error) {
            // Clean up
            if (fs.existsSync(tempDir)) {
                await fsPromises.rm(tempDir, { recursive: true, force: true });
            }
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.logEvent('RESTORE_TEST', `Test restoration from ${backupPath} failed: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Encrypt a backup
     * @param backupPath Path to backup
     * @param key Encryption key
     */
    private async encryptBackup(backupPath: string, key: string): Promise<void> {
        try {
            const files = await fsPromises.readdir(backupPath);
            for (const file of files) {
                const filePath = path.join(backupPath, file);
                const stats = await fsPromises.stat(filePath);
                
                if (stats.isFile()) {
                    const fileData = await fsPromises.readFile(filePath);
                    const iv = crypto.randomBytes(16);
                    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.padEnd(32).slice(0, 32)), iv);
                    
                    let encrypted = cipher.update(fileData);
                    encrypted = Buffer.concat([encrypted, cipher.final()]);
                    
                    // Write encrypted file with IV at the beginning
                    await fsPromises.writeFile(filePath + '.enc', Buffer.concat([iv, encrypted]));
                    await fsPromises.unlink(filePath);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to encrypt backup: ${errorMessage}`);
        }
    }

    /**
     * Decrypt a backup
     * @param backupPath Path to backup
     * @param key Encryption key
     */
    private async decryptBackup(backupPath: string, key: string): Promise<void> {
        try {
            const files = await fsPromises.readdir(backupPath);
            for (const file of files) {
                if (file.endsWith('.enc')) {
                    const filePath = path.join(backupPath, file);
                    const encryptedData = await fsPromises.readFile(filePath);
                    
                    // Extract IV from the beginning of the file
                    const iv = encryptedData.slice(0, 16);
                    const encryptedContent = encryptedData.slice(16);
                    
                    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32).slice(0, 32)), iv);
                    
                    let decrypted = decipher.update(encryptedContent);
                    decrypted = Buffer.concat([decrypted, decipher.final()]);
                    
                    // Write decrypted file
                    const originalPath = filePath.slice(0, -4); // Remove .enc
                    await fsPromises.writeFile(originalPath, decrypted);
                    await fsPromises.unlink(filePath);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to decrypt backup: ${errorMessage}`);
        }
    }

    /**
     * Check if a backup is encrypted
     * @param backupPath Path to backup
     * @returns True if encrypted
     */
    private async isBackupEncrypted(backupPath: string): Promise<boolean> {
        try {
            const files = await fsPromises.readdir(backupPath);
            return files.some(file => file.endsWith('.enc'));
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate a backup
     * @param backupPath Path to backup
     * @returns Validation result
     */
    private async validateBackup(backupPath: string): Promise<ValidationResult> {
        try {
            const files = await fsPromises.readdir(backupPath);
            const result: ValidationResult = {
                success: true,
                testedFiles: files.length,
                passedFiles: files.length,
                failedFiles: []
            };

            for (const file of files) {
                const filePath = path.join(backupPath, file);
                const stats = await fsPromises.stat(filePath);
                
                if (stats.isFile()) {
                    // Basic validation: check if file can be read
                    try {
                        await fsPromises.access(filePath, fs.constants.R_OK);
                    } catch (error) {
                        result.success = false;
                        result.passedFiles--;
                        result.failedFiles.push(file);
                    }
                }
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                testedFiles: 0,
                passedFiles: 0,
                failedFiles: [],
                error: errorMessage
            };
        }
    }

    /**
     * Sync backup to remote storage
     * @param backupPath Path to backup
     * @param remotePath Remote path
     */
    private async syncToRemote(backupPath: string, remotePath: string): Promise<void> {
        try {
            const timestamp = path.basename(backupPath);
            // Using rclone for remote syncing
            await execAsync(`rclone sync "${backupPath}" "${remotePath}/${timestamp}" --progress`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to sync backup to remote storage: ${errorMessage}`);
        }
    }

    /**
     * Clean up old backups based on retention policy
     * @param id Configuration ID
     * @param retention Number of backups to keep
     */
    private async cleanupOldBackups(id: string, retention: number): Promise<void> {
        if (retention <= 0) {
            return; // No cleanup needed
        }

        try {
            const backups = await this.listBackups(id);
            if (backups.length <= retention) {
                return; // No cleanup needed
            }

            // Sort backups by date (newest first)
            backups.sort((a, b) => {
                const aTime = fs.statSync(a).mtime.getTime();
                const bTime = fs.statSync(b).mtime.getTime();
                return bTime - aTime;
            });

            // Delete older backups
            const toDelete = backups.slice(retention);
            for (const backup of toDelete) {
                await fsPromises.rm(backup, { recursive: true, force: true });
                await this.logEvent('BACKUP_CLEANUP', `Deleted old backup ${backup}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.logEvent('ERROR', `Failed to clean up old backups: ${errorMessage}`);
        }
    }

    /**
     * Format file size in human-readable format
     * @param size Size in bytes
     * @returns Formatted size
     */
    private formatSize(size: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let formattedSize = size;
        let unitIndex = 0;
        
        while (formattedSize >= 1024 && unitIndex < units.length - 1) {
            formattedSize /= 1024;
            unitIndex++;
        }
        
        return `${formattedSize.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Send notification to Discord channel
     * @param message Message to send
     */
    private async sendNotification(message: string): Promise<void> {
        try {
            if (this.client.isReady() && this.notifyChannelId) {
                const channel = await this.client.channels.fetch(this.notifyChannelId);
                if (channel?.isTextBased()) {
                    await (channel as TextChannel).send(message);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to send notification: ${errorMessage}`);
        }
    }

    /**
     * Create a Discord embed for backup status
     * @param result Backup result
     * @returns Discord embed
     */
    public createBackupStatusEmbed(result: BackupResult): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setTitle(`Backup ${result.success ? 'Completed' : 'Failed'}: ${result.id}`)
            .setColor(result.success ? '#00FF00' : '#FF0000')
            .setTimestamp(new Date(result.timestamp))
            .addFields(
                { name: 'Status', value: result.success ? '✅ Success' : '❌ Failed', inline: true },
                { name: 'Files', value: result.files.length.toString(), inline: true },
                { name: 'Size', value: this.formatSize(result.size), inline: true },
                { name: 'Duration', value: `${result.duration.toFixed(2)}s`, inline: true }
            );

        if (result.error) {
            embed.addFields({ name: 'Error', value: result.error });
        }

        if (result.validationResult) {
            embed.addFields({
                name: 'Validation',
                value: `${result.validationResult.success ? '✅ Passed' : '❌ Failed'}\n` +
                    `Files Tested: ${result.validationResult.testedFiles}\n` +
                    `Files Passed: ${result.validationResult.passedFiles}`,
                inline: true
            });

            if (result.validationResult.failedFiles.length > 0) {
                embed.addFields({
                    name: 'Failed Files',
                    value: result.validationResult.failedFiles.slice(0, 5).join('\n') +
                        (result.validationResult.failedFiles.length > 5 ? `\n...and ${result.validationResult.failedFiles.length - 5} more` : '')
                });
            }
        }

        return embed;
    }

    /**
     * Register Discord commands for backup management
     * @param commandHandler Discord command handler
     */
    public registerCommands(commandHandler: any): void {
        // Add backup command
        commandHandler.register('backup', async (message: any, args: string[]) => {
            const subcommand = args[0]?.toLowerCase();
            
            switch (subcommand) {
                case 'list':
                    const id = args[1];
                    const backups = await this.listBackups(id);
                    if (backups.length === 0) {
                        return `No backups found${id ? ` for configuration ${id}` : ''}.`;
                    }
                    
                    return `Available backups${id ? ` for configuration ${id}` : ''}:\n` +
                        backups.map(b => `- ${path.basename(b)}`).join('\n');
                    
                case 'run':
                    const runId = args[1];
                    if (!runId) {
                        return 'Please specify a backup configuration ID.';
                    }
                    
                    await message.channel.send(`Starting backup ${runId}...`);
                    const result = await this.runBackup(runId);
                    
                    return { embeds: [this.createBackupStatusEmbed(result)] };
                    
                case 'restore':
                    const backupPath = args[1];
                    const targetPath = args[2] || process.cwd();
                    
                    if (!backupPath) {
                        return 'Please specify a backup path.';
                    }
                    
                    await message.channel.send(`Starting restoration from ${backupPath} to ${targetPath}...`);
                    const restoreResult = await this.restoreFromBackup(
                        path.join(this.backupDir, backupPath),
                        targetPath
                    );
                    
                    return restoreResult.success
                        ? `✅ Restoration completed successfully. Restored ${restoreResult.files.length} files.`
                        : `❌ Restoration failed: ${restoreResult.error}`;
                    
                case 'test':
                    const testBackup = args[1];
                    
                    if (!testBackup) {
                        return 'Please specify a backup path to test.';
                    }
                    
                    await message.channel.send(`Testing backup ${testBackup}...`);
                    const testResult = await this.testRestore(path.join(this.backupDir, testBackup));
                    
                    return testResult.success
                        ? `✅ Test restoration passed. All ${testResult.files.length} files are valid.`
                        : `❌ Test restoration failed: ${testResult.error}`;
                    
                case 'add':
                case 'update':
                    // This would normally parse the arguments and create a backup config
                    // For this example, we'll use a simplified version
                    const configId = args[1];
                    const configName = args[2] || configId;
                    const source = args[3]?.split(',') || ['./data'];
                    const destination = args[4] || this.backupDir;
                    
                    if (!configId) {
                        return 'Please specify a configuration ID.';
                    }
                    
                    const config: BackupConfig = {
                        id: configId,
                        name: configName,
                        source,
                        destination,
                        schedule: args[5] || '0 0 * * *', // Default: daily at midnight
                        retention: parseInt(args[6] || '7'),
                        encrypt: args[7]?.toLowerCase() === 'true',
                        remoteSync: args[8]?.toLowerCase() === 'true',
                        remotePath: args[9],
                        validate: true
                    };
                    
                    const addResult = await this.addBackupConfig(config);
                    return addResult
                        ? `✅ Backup configuration ${configId} added/updated successfully.`
                        : `❌ Failed to add/update backup configuration ${configId}.`;
                    
                case 'remove':
                    const removeId = args[1];
                    
                    if (!removeId) {
                        return 'Please specify a configuration ID to remove.';
                    }
                    
                    const removeResult = await this.removeBackupConfig(removeId);
                    return removeResult
                        ? `✅ Backup configuration ${removeId} removed successfully.`
                        : `❌ Failed to remove backup configuration ${removeId}.`;
                    
                case 'configs':
                    const configs = this.getBackupConfigs();
                    if (configs.size === 0) {
                        return 'No backup configurations found.';
                    }
                    
                    let response = 'Backup configurations:\n';
                    configs.forEach((config, id) => {
                        response += `- **${config.name}** (${id})\n` +
                            `  Sources: ${config.source.join(', ')}\n` +
                            `  Schedule: ${config.schedule}\n` +
                            `  Retention: ${config.retention} backups\n`;
                    });
                    
                    return response;
                    
                default:
                    return `
                    **Backup Management Commands**:
                    - \`backup list [config_id]\`: List available backups
                    - \`backup run <config_id>\`: Run a backup using the specified configuration
                    - \`backup restore <backup_path> [target_path]\`: Restore from a backup
                    - \`backup test <backup_path>\`: Test a backup's integrity
                    - \`backup add <id> <name> <source> [destination] [schedule] [retention] [encrypt] [remoteSync] [remotePath]\`: Add backup configuration
                    - \`backup update <id> <name> <source> [destination] [schedule] [retention] [encrypt] [remoteSync] [remotePath]\`: Update backup configuration
                    - \`backup remove <id>\`: Remove backup configuration
                    - \`backup configs\`: List all backup configurations
                    `;
            }
        });
    }
}

/**
 * Create a disaster recovery instance
 * @param client Discord client
 * @param notifyChannelId Discord channel ID for notifications
 * @param logEvent Function to log events
 * @param options Additional options
 * @returns DisasterRecovery instance
 */
export function getDisasterRecovery(
    client: Client,
    notifyChannelId: string,
    logEvent: (type: string, description: string) => Promise<boolean>,
    options: {
        backupDir?: string;
        backupScript?: string;
        encryptionKey?: string;
    } = {}
): DisasterRecovery {
    return new DisasterRecovery(client, notifyChannelId, logEvent, options);
}
