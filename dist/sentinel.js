"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentinelIntelligence = void 0;
exports.getSentinel = getSentinel;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
// Use require instead of import for db to avoid circular dependencies
const db = require('./db');
const { logEvent, logSentinelIncident, trackSuspiciousIP } = db;
const execAsync = util_1.default.promisify(child_process_1.exec);
/**
 * Class for Sentinel Intelligence monitoring
 */
class SentinelIntelligence {
    constructor(client, notifyChannelId) {
        this.lastCheckTime = Date.now();
        this.suspiciousIPs = new Map();
        this.watchInterval = null;
        this.logFiles = {
            auth: '/var/log/auth.log',
            system: '/var/log/syslog',
            fail2ban: '/var/log/fail2ban.log',
            nginx: '/var/log/nginx/error.log',
        };
        this.client = client;
        this.notifyChannelId = notifyChannelId;
        // Define patterns to watch for
        this.logPatterns = [
            {
                pattern: /Failed password for .* from (.*) port/i,
                severity: 'medium',
                description: 'Multiple failed SSH login attempts detected',
            },
            {
                pattern: /Ban (.*)/i,
                severity: 'high',
                description: 'IP banned by Fail2Ban',
            },
            {
                pattern: /segfault|crash|killed|fatal/i,
                severity: 'high',
                description: 'Critical system error detected',
            },
            {
                pattern: /out of memory|oom killer/i,
                severity: 'critical',
                description: 'System out of memory',
            },
            {
                pattern: /unauthorized|permission denied|403 forbidden/i,
                severity: 'medium',
                description: 'Unauthorized access attempt',
            }
        ];
        // Adapt log file paths to environment - use mock paths for development
        if (process.env.NODE_ENV === 'development') {
            this.logFiles = {
                auth: path_1.default.join(process.cwd(), 'data', 'mock', 'auth.log'),
                system: path_1.default.join(process.cwd(), 'data', 'mock', 'syslog'),
                fail2ban: path_1.default.join(process.cwd(), 'data', 'mock', 'fail2ban.log'),
                nginx: path_1.default.join(process.cwd(), 'data', 'mock', 'nginx-error.log'),
            };
            // Create mock directory if it doesn't exist
            const mockDir = path_1.default.join(process.cwd(), 'data', 'mock');
            if (!fs_1.default.existsSync(mockDir)) {
                fs_1.default.mkdirSync(mockDir, { recursive: true });
            }
            // Create empty mock files if they don't exist
            Object.values(this.logFiles).forEach(filePath => {
                if (!fs_1.default.existsSync(filePath)) {
                    fs_1.default.writeFileSync(filePath, '');
                }
            });
        }
    }
    /**
     * Start the sentinel monitoring system
     */
    start(checkIntervalMs = 60000) {
        console.log('Starting Sentinel Intelligence monitoring system...');
        // Set the initial check time
        this.lastCheckTime = Date.now();
        // Start periodic monitoring
        this.watchInterval = setInterval(() => this.checkLogs(), checkIntervalMs);
        // Log the start
        logEvent('SENTINEL', 'Sentinel Intelligence monitoring system started');
    }
    /**
     * Stop the sentinel monitoring system
     */
    stop() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
            console.log('Sentinel Intelligence monitoring system stopped');
            logEvent('SENTINEL', 'Sentinel Intelligence monitoring system stopped');
        }
    }
    /**
     * Check logs for suspicious patterns
     */
    async checkLogs() {
        try {
            const now = Date.now();
            const incidents = [];
            // Check each log file we're monitoring
            for (const [logType, logPath] of Object.entries(this.logFiles)) {
                if (fs_1.default.existsSync(logPath)) {
                    try {
                        // Use tail to get only recent log entries
                        const { stdout } = await execAsync(`tail -n 100 ${logPath}`);
                        const logContent = stdout;
                        // Check each pattern against this log content
                        for (const pattern of this.logPatterns) {
                            const matches = logContent.match(new RegExp(pattern.pattern, 'g'));
                            if (matches && matches.length > 0) {
                                // Extract potential IPs for tracking
                                const ipMatches = logContent.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
                                if (ipMatches) {
                                    this.trackSuspiciousIPs(ipMatches);
                                }
                                incidents.push({
                                    severity: pattern.severity,
                                    description: pattern.description,
                                    details: `Found in ${logType}: ${matches.length} matches`
                                });
                                // Log the incident
                                await logEvent('SENTINEL_ALERT', `${pattern.description}: ${matches.length} matches in ${logType}`);
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Error checking log ${logPath}:`, error);
                    }
                }
            }
            // Report incidents if any were found
            if (incidents.length > 0) {
                await this.reportIncidents(incidents);
            }
            // Update check time
            this.lastCheckTime = now;
        }
        catch (error) {
            console.error('Error in Sentinel log check:', error);
        }
    }
    /**
     * Track suspicious IPs for potential attack patterns
     */
    trackSuspiciousIPs(ips) {
        for (const ip of ips) {
            const count = this.suspiciousIPs.get(ip) || 0;
            this.suspiciousIPs.set(ip, count + 1);
            // If we see this IP too many times, log it
            if (count + 1 >= 5) {
                logEvent('SECURITY', `Suspicious activity from IP ${ip} detected ${count + 1} times`);
                // Reset counter to prevent spam
                if (count + 1 >= 10) {
                    this.suspiciousIPs.set(ip, 0);
                }
            }
        }
    }
    /**
     * Report incidents to Discord
     */
    async reportIncidents(incidents) {
        try {
            if (!this.client.isReady() || !this.notifyChannelId)
                return;
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased())
                return;
            // Group incidents by severity
            const criticalIncidents = incidents.filter(i => i.severity === 'critical');
            const highIncidents = incidents.filter(i => i.severity === 'high');
            const mediumIncidents = incidents.filter(i => i.severity === 'medium');
            const lowIncidents = incidents.filter(i => i.severity === 'low');
            // Create embeds for different severity levels
            if (criticalIncidents.length > 0) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🚨 CRITICAL SECURITY ALERT')
                    .setDescription('Critical security issues detected that require immediate attention')
                    .setColor(0xFF0000)
                    .setTimestamp();
                criticalIncidents.forEach(incident => {
                    embed.addFields({ name: incident.description, value: incident.details });
                });
                await channel.send({ embeds: [embed] });
            }
            if (highIncidents.length > 0) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('⚠️ High Severity Alert')
                    .setDescription('High severity security issues detected')
                    .setColor(0xFF9900)
                    .setTimestamp();
                highIncidents.forEach(incident => {
                    embed.addFields({ name: incident.description, value: incident.details });
                });
                await channel.send({ embeds: [embed] });
            }
            if (mediumIncidents.length > 0 || lowIncidents.length > 0) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('ℹ️ Security Notification')
                    .setDescription('Security events have been detected')
                    .setColor(0x3498DB)
                    .setTimestamp();
                [...mediumIncidents, ...lowIncidents].forEach(incident => {
                    embed.addFields({ name: incident.description, value: incident.details });
                });
                await channel.send({ embeds: [embed] });
            }
        }
        catch (error) {
            console.error('Error reporting sentinel incidents:', error);
        }
    }
    /**
     * Get system uptime in a human-readable format
     */
    async getSystemUptime() {
        try {
            const { stdout } = await execAsync('uptime -p');
            return stdout.trim();
        }
        catch (error) {
            console.error('Error getting system uptime:', error);
            return 'Unknown';
        }
    }
    /**
     * Get service status for multiple services
     */
    async getServicesStatus() {
        const services = ['nginx', 'fail2ban', 'monit', 'ssh'];
        const result = [];
        for (const service of services) {
            try {
                const { stdout } = await execAsync(`systemctl is-active ${service}`);
                const isRunning = stdout.trim() === 'active';
                let uptime = undefined;
                let memory = undefined;
                let cpu = undefined;
                if (isRunning) {
                    try {
                        const { stdout: uptimeOut } = await execAsync(`systemctl show ${service} -p ActiveEnterTimestamp`);
                        uptime = uptimeOut.split('=')[1]?.trim() || 'Unknown';
                        // Try to get memory usage - this might not work on all systems
                        const { stdout: memoryOut } = await execAsync(`ps -o rss= -p $(pidof ${service})`);
                        if (memoryOut) {
                            const memoryMB = parseInt(memoryOut.trim()) / 1024;
                            memory = `${memoryMB.toFixed(1)} MB`;
                        }
                    }
                    catch (error) {
                        // Ignore these errors, they're non-critical
                    }
                }
                result.push({
                    name: service,
                    isRunning,
                    uptime,
                    memory,
                    cpu
                });
            }
            catch (error) {
                result.push({
                    name: service,
                    isRunning: false
                });
            }
        }
        return result;
    }
    /**
     * Setup rclone sync for system backups and audit logs
     */
    async setupRclone(remoteDestination, backupPaths = ['./data/noxhime.db', './logs'], scheduleExpression = '0 0 * * *' // Daily at midnight
    ) {
        try {
            // Check if rclone is installed
            await execAsync('which rclone').catch(() => {
                throw new Error('rclone is not installed. Please install rclone first.');
            });
            // Create backup directory if it doesn't exist
            const backupDir = path_1.default.join(process.cwd(), 'backups');
            if (!fs_1.default.existsSync(backupDir)) {
                fs_1.default.mkdirSync(backupDir, { recursive: true });
            }
            // Create a backup script
            const scriptPath = path_1.default.join(process.cwd(), 'scripts', 'backup.sh');
            let scriptContent = `#!/bin/bash
# Noxhime Automated Backup Script
# Created on ${new Date().toISOString()}

# Set up error handling
set -e
trap 'echo "Error occurred at line $LINENO"; exit 1' ERR

# Create timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="${backupDir}/$TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Copy files to backup directory
`;
            // Add each backup path to the script
            for (const backupPath of backupPaths) {
                scriptContent += `echo "Backing up ${backupPath}"
cp -r "${backupPath}" "$BACKUP_DIR/" || echo "Warning: Could not backup ${backupPath}"
`;
            }
            // Add rclone sync command
            scriptContent += `
# Sync to remote storage
echo "Syncing to ${remoteDestination}"
rclone sync "$BACKUP_DIR" "${remoteDestination}/noxhime-backup-$TIMESTAMP" --progress

# Clean up old local backups (keep last 5)
ls -1t "${backupDir}" | tail -n +6 | xargs -I {} rm -rf "${backupDir}/{}"

echo "Backup completed successfully at $(date)"
`;
            // Write the script file
            fs_1.default.writeFileSync(scriptPath, scriptContent);
            fs_1.default.chmodSync(scriptPath, '755'); // Make executable
            // Set up cron job
            const cronCommand = `(crontab -l 2>/dev/null || echo "") | grep -v "${scriptPath}" | { cat; echo "${scheduleExpression} ${scriptPath}"; } | crontab -`;
            await execAsync(cronCommand);
            console.log('Rclone backup setup completed');
            await logEvent('SENTINEL', 'Rclone backup system configured');
            return;
        }
        catch (error) {
            console.error('Error setting up rclone sync:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logEvent('ERROR', `Failed to setup rclone sync: ${errorMessage}`);
            throw error;
        }
    }
}
exports.SentinelIntelligence = SentinelIntelligence;
// Export singleton instance
let sentinelInstance = null;
function getSentinel(client, notifyChannelId) {
    if (!sentinelInstance) {
        sentinelInstance = new SentinelIntelligence(client, notifyChannelId);
    }
    return sentinelInstance;
}
