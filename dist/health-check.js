"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckMonitor = void 0;
exports.getHealthCheckMonitor = getHealthCheckMonitor;
const discord_js_1 = require("discord.js");
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execAsync = util_1.default.promisify(child_process_1.exec);
/**
 * Class for managing system health checks and notifications
 */
class HealthCheckMonitor {
    constructor(client, notifyChannelId, logEvent) {
        this.checkInterval = null;
        this.lastHealth = null;
        this.consecutiveWarnings = new Map();
        this.warningThresholds = {
            cpu: 85, // CPU usage % threshold
            memory: 90, // Memory usage % threshold
            disk: 90, // Disk usage % threshold
            load: 5 // Load average threshold
        };
        this.client = client;
        this.notifyChannelId = notifyChannelId;
        this.logEvent = logEvent;
    }
    /**
     * Start health check monitoring
     */
    start(checkIntervalMs = 1800000) {
        console.log(`Starting system health check monitoring with interval of ${checkIntervalMs / 60000} minutes`);
        // Perform initial health check
        this.checkSystemHealth().then(health => {
            this.lastHealth = health;
            console.log('Initial health check completed');
        }).catch(error => {
            console.error('Error during initial health check:', error);
        });
        // Start periodic checks
        this.checkInterval = setInterval(() => this.runHealthCheck(), checkIntervalMs);
        // Log the start
        this.logEvent('SYSTEM', 'System health check monitoring started');
    }
    /**
     * Stop health check monitoring
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('System health check monitoring stopped');
            this.logEvent('SYSTEM', 'System health check monitoring stopped');
        }
    }
    /**
     * Run a health check and notify if necessary
     */
    async runHealthCheck() {
        try {
            const health = await this.checkSystemHealth();
            const issues = this.detectIssues(health);
            // If there are issues, send a notification
            if (issues.length > 0) {
                await this.sendHealthAlert(health, issues);
            }
            // If no issues but we had them before, send a recovery notification
            else if (this.hasActiveWarnings()) {
                await this.sendRecoveryNotification(health);
            }
            // Otherwise, just log the health check
            else {
                console.log('Health check completed: System healthy');
                // Only send periodic health updates if configured to do so
                if (Math.random() < 0.1) { // ~10% chance to send a periodic update
                    await this.sendPeriodicHealthUpdate(health);
                }
            }
            // Update last health status
            this.lastHealth = health;
        }
        catch (error) {
            console.error('Error running health check:', error);
        }
    }
    /**
     * Check if we have any active warnings
     */
    hasActiveWarnings() {
        return Array.from(this.consecutiveWarnings.values()).some(count => count > 0);
    }
    /**
     * Check system health and return metrics
     */
    async checkSystemHealth() {
        try {
            // Get CPU usage
            const { stdout: cpuOut } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'");
            const cpuUsage = parseFloat(cpuOut.trim());
            // Get memory usage
            const { stdout: memOut } = await execAsync("free -m | awk 'NR==2{printf \"%.2f\", $3*100/$2}'");
            const memoryUsage = parseFloat(memOut.trim());
            // Get disk usage
            const { stdout: diskOut } = await execAsync("df -h / | awk 'NR==2{print $5}' | sed 's/%//'");
            const diskUsage = parseFloat(diskOut.trim());
            // Get system uptime
            const { stdout: uptimeOut } = await execAsync("uptime -p");
            const uptime = uptimeOut.trim();
            // Get load average
            const loadAverage = os_1.default.loadavg();
            // Try to get CPU temperature (might not work on all systems)
            let temperature = undefined;
            try {
                // Try different temperature sources
                const tempSources = [
                    "cat /sys/class/thermal/thermal_zone0/temp",
                    "sensors | grep 'Package id 0' | awk '{print $4}' | sed 's/+//' | sed 's/°C//'"
                ];
                for (const cmd of tempSources) {
                    try {
                        const { stdout: tempOut } = await execAsync(cmd);
                        const tempValue = parseFloat(tempOut.trim());
                        // Convert from millidegrees if needed
                        temperature = tempValue > 1000 ? tempValue / 1000 : tempValue;
                        break; // Stop if we got a valid reading
                    }
                    catch (error) {
                        // Try next source
                    }
                }
            }
            catch (error) {
                // Temperature monitoring not available
            }
            // Check network connectivity
            const { stdout: pingOut } = await execAsync("ping -c 1 -W 5 8.8.8.8 || echo 'failed'");
            const networkStatus = !pingOut.includes('failed');
            return {
                cpuUsage,
                memoryUsage,
                diskUsage,
                uptime,
                loadAverage,
                temperature,
                networkStatus,
                lastChecked: new Date()
            };
        }
        catch (error) {
            console.error('Error checking system health:', error);
            throw error;
        }
    }
    /**
     * Detect issues with the system health
     */
    detectIssues(health) {
        const issues = [];
        // Check CPU usage
        if (health.cpuUsage >= this.warningThresholds.cpu) {
            const warningCount = (this.consecutiveWarnings.get('cpu') || 0) + 1;
            this.consecutiveWarnings.set('cpu', warningCount);
            issues.push(`High CPU usage: ${health.cpuUsage.toFixed(1)}% (threshold: ${this.warningThresholds.cpu}%)`);
        }
        else {
            this.consecutiveWarnings.set('cpu', 0);
        }
        // Check memory usage
        if (health.memoryUsage >= this.warningThresholds.memory) {
            const warningCount = (this.consecutiveWarnings.get('memory') || 0) + 1;
            this.consecutiveWarnings.set('memory', warningCount);
            issues.push(`High memory usage: ${health.memoryUsage.toFixed(1)}% (threshold: ${this.warningThresholds.memory}%)`);
        }
        else {
            this.consecutiveWarnings.set('memory', 0);
        }
        // Check disk usage
        if (health.diskUsage >= this.warningThresholds.disk) {
            const warningCount = (this.consecutiveWarnings.get('disk') || 0) + 1;
            this.consecutiveWarnings.set('disk', warningCount);
            issues.push(`High disk usage: ${health.diskUsage.toFixed(1)}% (threshold: ${this.warningThresholds.disk}%)`);
        }
        else {
            this.consecutiveWarnings.set('disk', 0);
        }
        // Check load average
        const cpuCount = os_1.default.cpus().length;
        if (health.loadAverage[0] > cpuCount * this.warningThresholds.load) {
            const warningCount = (this.consecutiveWarnings.get('load') || 0) + 1;
            this.consecutiveWarnings.set('load', warningCount);
            issues.push(`High system load: ${health.loadAverage[0].toFixed(2)} (threshold: ${cpuCount * this.warningThresholds.load})`);
        }
        else {
            this.consecutiveWarnings.set('load', 0);
        }
        // Check network status
        if (!health.networkStatus) {
            const warningCount = (this.consecutiveWarnings.get('network') || 0) + 1;
            this.consecutiveWarnings.set('network', warningCount);
            issues.push('Network connectivity issues detected');
        }
        else {
            this.consecutiveWarnings.set('network', 0);
        }
        // Check temperature if available
        if (health.temperature && health.temperature > 80) {
            const warningCount = (this.consecutiveWarnings.get('temperature') || 0) + 1;
            this.consecutiveWarnings.set('temperature', warningCount);
            issues.push(`High CPU temperature: ${health.temperature.toFixed(1)}°C (threshold: 80°C)`);
        }
        else if (health.temperature) {
            this.consecutiveWarnings.set('temperature', 0);
        }
        return issues;
    }
    /**
     * Send a health alert to Discord
     */
    async sendHealthAlert(health, issues) {
        try {
            if (!this.client.isReady() || !this.notifyChannelId)
                return;
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased())
                return;
            // Determine severity based on consecutive warnings
            const maxWarnings = Math.max(...Array.from(this.consecutiveWarnings.values()));
            const severity = maxWarnings >= 3 ? 'critical' : 'warning';
            // Create alert embed
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(severity === 'critical' ?
                '🚨 CRITICAL SYSTEM ALERT' :
                '⚠️ System Health Warning')
                .setDescription(severity === 'critical' ?
                'Critical system issues detected that require immediate attention' :
                'System health issues detected')
                .setColor(severity === 'critical' ? 0xFF0000 : 0xFFAA00)
                .setTimestamp(health.lastChecked);
            // Add issues
            embed.addFields({
                name: 'Detected Issues',
                value: issues.map(issue => `• ${issue}`).join('\n')
            });
            // Add system metrics
            embed.addFields({
                name: 'System Metrics',
                value: `• CPU: ${health.cpuUsage.toFixed(1)}%\n` +
                    `• Memory: ${health.memoryUsage.toFixed(1)}%\n` +
                    `• Disk: ${health.diskUsage.toFixed(1)}%\n` +
                    `• Load: ${health.loadAverage[0].toFixed(2)}, ${health.loadAverage[1].toFixed(2)}, ${health.loadAverage[2].toFixed(2)}\n` +
                    `• Network: ${health.networkStatus ? 'Connected' : 'Issues detected'}\n` +
                    (health.temperature ? `• Temperature: ${health.temperature.toFixed(1)}°C\n` : '') +
                    `• Uptime: ${health.uptime}`
            });
            // Add suggestions for critical issues
            if (severity === 'critical') {
                let suggestions = '';
                if (health.cpuUsage >= this.warningThresholds.cpu) {
                    suggestions += '• Check for runaway processes using `top` or `htop`\n';
                }
                if (health.memoryUsage >= this.warningThresholds.memory) {
                    suggestions += '• Check memory usage with `free -h` and consider restarting memory-intensive services\n';
                }
                if (health.diskUsage >= this.warningThresholds.disk) {
                    suggestions += '• Free up disk space with `du -h --max-depth=1 /` to find large directories\n';
                }
                if (suggestions) {
                    embed.addFields({
                        name: 'Suggested Actions',
                        value: suggestions
                    });
                }
            }
            // Send to Discord
            await channel.send({
                content: severity === 'critical' ? '@here System requires immediate attention!' : undefined,
                embeds: [embed]
            });
            // Log the alert
            await this.logEvent(severity === 'critical' ? 'CRITICAL_ALERT' : 'SYSTEM_WARNING', `System health alert: ${issues.length} issues detected - ${issues.join(', ')}`);
        }
        catch (error) {
            console.error('Error sending health alert:', error);
        }
    }
    /**
     * Send recovery notification to Discord
     */
    async sendRecoveryNotification(health) {
        try {
            if (!this.client.isReady() || !this.notifyChannelId)
                return;
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased())
                return;
            // Create recovery embed
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('✅ System Health Recovered')
                .setDescription('All previously reported system issues have been resolved')
                .setColor(0x00FF00)
                .setTimestamp(health.lastChecked);
            // Add system metrics
            embed.addFields({
                name: 'Current System Metrics',
                value: `• CPU: ${health.cpuUsage.toFixed(1)}%\n` +
                    `• Memory: ${health.memoryUsage.toFixed(1)}%\n` +
                    `• Disk: ${health.diskUsage.toFixed(1)}%\n` +
                    `• Load: ${health.loadAverage[0].toFixed(2)}, ${health.loadAverage[1].toFixed(2)}, ${health.loadAverage[2].toFixed(2)}\n` +
                    `• Network: ${health.networkStatus ? 'Connected' : 'Issues detected'}\n` +
                    (health.temperature ? `• Temperature: ${health.temperature.toFixed(1)}°C\n` : '') +
                    `• Uptime: ${health.uptime}`
            });
            // Send to Discord
            await channel.send({ embeds: [embed] });
            // Reset all warning counters
            this.consecutiveWarnings.clear();
            // Log the recovery
            await this.logEvent('SYSTEM_RECOVERY', 'System health has recovered from previous issues');
        }
        catch (error) {
            console.error('Error sending recovery notification:', error);
        }
    }
    /**
     * Send periodic health update to Discord
     */
    async sendPeriodicHealthUpdate(health) {
        try {
            if (!this.client.isReady() || !this.notifyChannelId)
                return;
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased())
                return;
            // Create status embed
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📊 System Health Report')
                .setDescription('Periodic system health status update')
                .setColor(0x3498DB)
                .setTimestamp(health.lastChecked);
            // Add system metrics
            embed.addFields({
                name: 'System Metrics',
                value: `• CPU: ${health.cpuUsage.toFixed(1)}%\n` +
                    `• Memory: ${health.memoryUsage.toFixed(1)}%\n` +
                    `• Disk: ${health.diskUsage.toFixed(1)}%\n` +
                    `• Load: ${health.loadAverage[0].toFixed(2)}, ${health.loadAverage[1].toFixed(2)}, ${health.loadAverage[2].toFixed(2)}\n` +
                    `• Network: ${health.networkStatus ? 'Connected' : 'Issues detected'}\n` +
                    (health.temperature ? `• Temperature: ${health.temperature.toFixed(1)}°C\n` : '') +
                    `• Uptime: ${health.uptime}`
            });
            // Send to Discord
            await channel.send({ embeds: [embed] });
            // Log the update
            await this.logEvent('SYSTEM_STATUS', 'Periodic system health report sent');
        }
        catch (error) {
            console.error('Error sending periodic health update:', error);
        }
    }
}
exports.HealthCheckMonitor = HealthCheckMonitor;
// Export singleton instance
let healthCheckMonitorInstance = null;
function getHealthCheckMonitor(client, notifyChannelId, logEvent) {
    if (!healthCheckMonitorInstance) {
        healthCheckMonitorInstance = new HealthCheckMonitor(client, notifyChannelId, logEvent);
    }
    return healthCheckMonitorInstance;
}
