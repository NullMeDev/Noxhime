"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMonitoringServer = setupMonitoringServer;
exports.collectSystemStats = collectSystemStats;
exports.savePidFile = savePidFile;
exports.setupSelfHealing = setupSelfHealing;
exports.setupCrashHandling = setupCrashHandling;
const express_1 = __importDefault(require("express"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = __importDefault(require("util"));
const execAsync = util_1.default.promisify(child_process_1.exec);
/**
 * Creates and starts the monitoring server to receive alerts from Monit and other sources
 */
function setupMonitoringServer(client, notifyChannelId, logEvent, port = 5000) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Endpoint for receiving Monit alerts
    app.post('/alert', async (req, res) => {
        try {
            const event = req.body;
            // Log to database
            await logEvent('SYSTEM_ALERT', `${event.title}: ${event.body}`);
            // Send to Discord if connected
            if (client.isReady() && notifyChannelId) {
                const channel = await client.channels.fetch(notifyChannelId);
                if (channel?.isTextBased()) {
                    const severity = event.severity || 'warning';
                    const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';
                    await channel.send({
                        content: `${emoji} **${event.title}**\n${event.body}`,
                    });
                }
            }
            res.status(200).send({ status: 'Alert received' });
        }
        catch (error) {
            console.error('Error processing alert:', error);
            res.status(500).send({ error: 'Failed to process alert' });
        }
    });
    // Endpoint for Fail2Ban alerts
    app.post('/fail2ban', async (req, res) => {
        try {
            const { ip, service, time } = req.body;
            const description = `IP ${ip} blocked on ${service} at ${time || 'now'}`;
            await logEvent('SECURITY_BLOCK', description);
            if (client.isReady() && notifyChannelId) {
                const channel = await client.channels.fetch(notifyChannelId);
                if (channel?.isTextBased()) {
                    await channel.send({
                        content: `🛡️ **Security Alert**\n${description}`,
                    });
                }
            }
            res.status(200).send({ status: 'Fail2Ban alert received' });
        }
        catch (error) {
            console.error('Error processing Fail2Ban alert:', error);
            res.status(500).send({ error: 'Failed to process Fail2Ban alert' });
        }
    });
    // Endpoint for service status updates
    app.post('/service-status', async (req, res) => {
        try {
            const { service, status, message } = req.body;
            const description = `Service ${service} is ${status}: ${message || 'No additional info'}`;
            await logEvent('SERVICE_STATUS', description);
            if (client.isReady() && notifyChannelId) {
                const channel = await client.channels.fetch(notifyChannelId);
                if (channel?.isTextBased()) {
                    const emoji = status === 'up' ? '🟢' : status === 'warning' ? '🟠' : '🔴';
                    await channel.send({
                        content: `${emoji} **Service Status: ${service}**\n${message || status}`,
                    });
                }
            }
            res.status(200).send({ status: 'Service status update received' });
        }
        catch (error) {
            console.error('Error processing service status update:', error);
            res.status(500).send({ error: 'Failed to process service status' });
        }
    });
    // Start the server
    const server = app.listen(port, () => {
        console.log(`Monitoring server started on port ${port}`);
    });
    return server;
}
/**
 * Collect system stats using command-line tools
 */
async function collectSystemStats() {
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
        return {
            cpuUsage,
            memoryUsage,
            diskUsage,
            uptime
        };
    }
    catch (error) {
        console.error('Error collecting system stats:', error);
        return {
            cpuUsage: -1,
            memoryUsage: -1,
            diskUsage: -1,
            uptime: 'unknown'
        };
    }
}
/**
 * Save bot PID to a file for Monit monitoring
 */
function savePidFile(pidPath = '/home/nulladmin/noxhime-bot/noxhime.pid') {
    try {
        // Ensure directory exists
        const dir = path_1.default.dirname(pidPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        // Write PID to file
        fs_1.default.writeFileSync(pidPath, process.pid.toString());
        console.log(`PID ${process.pid} saved to ${pidPath}`);
    }
    catch (error) {
        console.error('Error saving PID file:', error);
    }
}
/**
 * Create a self-healing function that can be used to recover the bot
 */
function setupSelfHealing(logEvent) {
    return async (error) => {
        try {
            if (error) {
                await logEvent('ERROR', `Self-healing triggered due to: ${error.message}`);
            }
            else {
                await logEvent('MAINTENANCE', 'Self-healing routine executed');
            }
            // Clear any potential memory leaks
            global.gc && global.gc();
            // Log healing attempt
            console.log('Self-healing executed at', new Date().toISOString());
        }
        catch (healError) {
            console.error('Error during self-healing:', healError);
        }
    };
}
/**
 * Setup crash handling and recovery
 */
function setupCrashHandling(client, notifyChannelId, logEvent) {
    // Uncaught exception handler
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
        try {
            await logEvent('CRITICAL_ERROR', `Uncaught exception: ${error.message}`);
            // Attempt to notify about the crash before shutting down
            if (client.isReady() && notifyChannelId) {
                const channel = await client.channels.fetch(notifyChannelId);
                if (channel?.isTextBased()) {
                    await channel.send({
                        content: '🚨 **Critical Error**\nI encountered a critical error and need to restart. I\'ll be back shortly.',
                    });
                }
            }
        }
        catch (notifyError) {
            console.error('Failed to notify about crash:', notifyError);
        }
        finally {
            // Exit with error code so that the process manager (PM2/systemd) can restart
            process.exit(1);
        }
    });
    // Unhandled promise rejection handler
    process.on('unhandledRejection', async (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        try {
            await logEvent('WARNING', `Unhandled promise rejection: ${reason}`);
            // Try self-healing before it becomes critical
            await setupSelfHealing(logEvent)();
        }
        catch (error) {
            console.error('Error handling promise rejection:', error);
        }
    });
}
