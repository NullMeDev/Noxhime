import { Message, Client, TextChannel } from 'discord.js';
import path from 'path';
import { getDisasterRecovery } from './disaster-recovery';

/**
 * Handle backup commands directly from Discord messages
 */
export async function handleBackupCommand(
    client: Client,
    message: Message, 
    args: string[], 
    notifyChannelId: string,
    logEvent: (type: string, description: string) => Promise<boolean>,
    options: {
        commandPrefix: string,
        encryptionKey?: string,
        backupScript?: string,
        backupDir?: string
    }
): Promise<void> {
    const { commandPrefix, encryptionKey, backupScript, backupDir } = options;
    
    try {
        // Get a reference to the disaster recovery module
        const disasterRecovery = getDisasterRecovery(client, notifyChannelId, logEvent, {
            encryptionKey,
            backupScript,
            backupDir
        });
        
        if (args.length === 0) {
            // No subcommand - run the default backup
            await (message.channel as TextChannel).send('🔄 Initiating manual backup process...');
            
            const result = await disasterRecovery.runBackup('default');
            await (message.channel as TextChannel).send({ embeds: [disasterRecovery.createBackupStatusEmbed(result)] });
            return;
        }
        
        const subcommand = args[0].toLowerCase();
        
        // Handle the subcommand
        switch (subcommand) {
            case 'list':
                const id = args[1];
                const backups = await disasterRecovery.listBackups(id);
                if (backups.length === 0) {
                    await (message.channel as TextChannel).send(`No backups found${id ? ` for configuration ${id}` : ''}.`);
                } else {
                    await (message.channel as TextChannel).send(`Available backups${id ? ` for configuration ${id}` : ''}:\n${backups.map(b => `- ${path.basename(b)}`).join('\n')}`);
                }
                break;
                
            case 'run':
                const runId = args[1] || 'default';
                await (message.channel as TextChannel).send(`Starting backup ${runId}...`);
                const result = await disasterRecovery.runBackup(runId);
                await (message.channel as TextChannel).send({ embeds: [disasterRecovery.createBackupStatusEmbed(result)] });
                break;
                
            case 'restore':
                const backupPath = args[1];
                const targetPath = args[2] || process.cwd();
                
                if (!backupPath) {
                    await (message.channel as TextChannel).send('Please specify a backup path.');
                    break;
                }
                
                await (message.channel as TextChannel).send(`Starting restoration from ${backupPath} to ${targetPath}...`);
                const restoreResult = await disasterRecovery.restoreFromBackup(
                    path.join(disasterRecovery.getBackupDir(), backupPath),
                    targetPath
                );
                
                await (message.channel as TextChannel).send(restoreResult.success
                    ? `✅ Restoration completed successfully. Restored ${restoreResult.files.length} files.`
                    : `❌ Restoration failed: ${restoreResult.error}`);
                break;
            case "configs":
                const configs = disasterRecovery.getBackupConfigs();
                if (configs.size === 0) {
                    await (message.channel as TextChannel).send("No backup configurations found.");
                } else {
                    let response = "Backup configurations:\n";
                    configs.forEach((config, id) => {
                        response += `- **${config.name}** (${id})\n` +
                            `  Sources: ${config.source.join(", ")}\n` +
                            `  Schedule: ${config.schedule}\n` +
                            `  Retention: ${config.retention} backups\n`;
                    });
                    
                    await (message.channel as TextChannel).send(response);
                }
                break;
                
            case "add":
            case "update":
                // This would normally parse the arguments and create a backup config
                const configId = args[1];
                const configName = args[2] || configId;
                const source = args[3]?.split(",") || ["./data"];
                const destination = args[4] || disasterRecovery.getBackupDir();
                
                if (!configId) {
                    await (message.channel as TextChannel).send("Please specify a configuration ID.");
                    break;
                }
                
                const config = {
                    id: configId,
                    name: configName,
                    source,
                    destination,
                    schedule: args[5] || "0 0 * * *", // Default: daily at midnight
                    retention: parseInt(args[6] || "7"),
                    encrypt: args[7]?.toLowerCase() === "true",
                    remoteSync: args[8]?.toLowerCase() === "true",
                    remotePath: args[9],
                    validate: true
                };
                
                const addResult = await disasterRecovery.addBackupConfig(config);
                await (message.channel as TextChannel).send(addResult
                    ? `✅ Backup configuration ${configId} added/updated successfully.`
                    : `❌ Failed to add/update backup configuration ${configId}.`);
                break;
                
            case "remove":
                const removeId = args[1];
                
                if (!removeId) {
                    await (message.channel as TextChannel).send("Please specify a configuration ID to remove.");
                    break;
                }
                
                const removeResult = await disasterRecovery.removeBackupConfig(removeId);
                await (message.channel as TextChannel).send(removeResult
                    ? `✅ Backup configuration ${removeId} removed successfully.`
                    : `❌ Failed to remove backup configuration ${removeId}.`);
                break;
                
            case 'test':
                const testBackup = args[1];
                
                if (!testBackup) {
                    await (message.channel as TextChannel).send('Please specify a backup path to test.');
                    break;
                }
                
                await (message.channel as TextChannel).send(`Testing backup ${testBackup}...`);
                
                try {
                    const testResult = await disasterRecovery.testRestore(
                        path.join(disasterRecovery.getBackupDir(), testBackup)
                    );
                    
                    await (message.channel as TextChannel).send(testResult.success
                        ? `✅ Test restoration passed. All ${testResult.files.length} files are valid.`
                        : `❌ Test restoration failed: ${testResult.error}`);
                } catch (error) {
                    await (message.channel as TextChannel).send(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
                }
                break;
                
            // More cases will be added in the next step
            default:
                // Show help
                await (message.channel as TextChannel).send(`
**Backup Management Commands**:
- \`${commandPrefix}backup list [config_id]\`: List available backups
- \`${commandPrefix}backup run [config_id]\`: Run a backup using the specified configuration
- \`${commandPrefix}backup restore <backup_path> [target_path]\`: Restore from a backup
- \`${commandPrefix}backup test <backup_path>\`: Test a backup's integrity
- \`${commandPrefix}backup configs\`: List all backup configurations
`);
        }
    } catch (error) {
        console.error('Error handling backup command:', error);
        await (message.channel as TextChannel).send(`❌ Error executing backup command: ${error instanceof Error ? error.message : String(error)}`);
    }
}
