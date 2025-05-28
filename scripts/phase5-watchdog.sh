#!/bin/bash

# Noxhime Sentient Expansion - Phase 5: Watchdog System & Final Sync
# This phase implements comprehensive process monitoring, resource management,
# and final system synchronization for autonomous operation.

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
NOXHIME_DIR="/home/nulladmin/noxhime"
WATCHDOG_DIR="$NOXHIME_DIR/watchdog"
SCRIPTS_DIR="$NOXHIME_DIR/scripts"
CONFIG_DIR="$NOXHIME_DIR/config"
LOGS_DIR="$NOXHIME_DIR/logs"

echo -e "${PURPLE}╔══════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║     NOXHIME SENTIENT EXPANSION       ║${NC}"
echo -e "${PURPLE}║      Phase 5: Watchdog System        ║${NC}"
echo -e "${PURPLE}║         & Final Sync                 ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════╝${NC}"
echo

# Ensure we're running as nulladmin
if [[ "$(whoami)" != "nulladmin" ]]; then
    echo -e "${RED}Error: This script must be run as nulladmin user${NC}"
    exit 1
fi

# Verify prerequisites from previous phases
echo -e "${CYAN}[INFO] Verifying prerequisites...${NC}"
if [[ ! -d "$NOXHIME_DIR" ]]; then
    echo -e "${RED}Error: Noxhime directory not found. Run Phase 1 first.${NC}"
    exit 1
fi

if [[ ! -f "$NOXHIME_DIR/honeypot/ssh-honeypot.js" ]]; then
    echo -e "${RED}Error: Honeypot not found. Run Phase 2 first.${NC}"
    exit 1
fi

if [[ ! -f "$NOXHIME_DIR/discord/bot-manager.js" ]]; then
    echo -e "${RED}Error: Discord bot not found. Run Phase 3 first.${NC}"
    exit 1
fi

if [[ ! -f "$NOXHIME_DIR/heartbeat/monitor.js" ]]; then
    echo -e "${RED}Error: Heartbeat system not found. Run Phase 4 first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites verified${NC}"

# Create watchdog process monitor
echo -e "${CYAN}[INFO] Creating watchdog process monitor...${NC}"
cat > "$WATCHDOG_DIR/process-watchdog.js" << 'EOF'
#!/usr/bin/env node

/**
 * Noxhime Sentient Expansion - Process Watchdog
 * Monitors all Noxhime processes and ensures they remain healthy
 */

const { spawn, exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ProcessWatchdog {
    constructor() {
        this.noxhimeDir = '/home/nulladmin/noxhime';
        this.processes = new Map();
        this.logFile = path.join(this.noxhimeDir, 'logs', 'watchdog.log');
        this.configFile = path.join(this.noxhimeDir, 'config', 'watchdog.json');
        this.isRunning = false;
        this.checkInterval = 15000; // 15 seconds
        this.maxRestarts = 5;
        this.restartWindow = 300000; // 5 minutes
        
        this.criticalProcesses = [
            {
                name: 'noxhime-core',
                command: 'node',
                args: [path.join(this.noxhimeDir, 'src', 'index.js')],
                cwd: this.noxhimeDir,
                critical: true,
                maxMemory: 512 * 1024 * 1024, // 512MB
                maxCpu: 80 // 80%
            },
            {
                name: 'ssh-honeypot',
                command: 'node',
                args: [path.join(this.noxhimeDir, 'honeypot', 'ssh-honeypot.js')],
                cwd: this.noxhimeDir,
                critical: true,
                maxMemory: 256 * 1024 * 1024, // 256MB
                maxCpu: 50
            },
            {
                name: 'http-honeypot',
                command: 'node',
                args: [path.join(this.noxhimeDir, 'honeypot', 'http-honeypot.js')],
                cwd: this.noxhimeDir,
                critical: true,
                maxMemory: 256 * 1024 * 1024,
                maxCpu: 50
            },
            {
                name: 'discord-bot',
                command: 'node',
                args: [path.join(this.noxhimeDir, 'discord', 'bot-manager.js')],
                cwd: this.noxhimeDir,
                critical: true,
                maxMemory: 256 * 1024 * 1024,
                maxCpu: 30
            },
            {
                name: 'heartbeat-monitor',
                command: 'node',
                args: [path.join(this.noxhimeDir, 'heartbeat', 'monitor.js')],
                cwd: this.noxhimeDir,
                critical: true,
                maxMemory: 128 * 1024 * 1024,
                maxCpu: 20
            }
        ];

        this.initializeWatchdog();
    }

    async initializeWatchdog() {
        try {
            await fs.ensureDir(path.dirname(this.logFile));
            await this.loadConfig();
            this.log('Watchdog initialized successfully');
        } catch (error) {
            console.error('Failed to initialize watchdog:', error);
            process.exit(1);
        }
    }

    async loadConfig() {
        try {
            if (await fs.pathExists(this.configFile)) {
                const config = await fs.readJson(this.configFile);
                this.checkInterval = config.checkInterval || this.checkInterval;
                this.maxRestarts = config.maxRestarts || this.maxRestarts;
                this.restartWindow = config.restartWindow || this.restartWindow;
            }
        } catch (error) {
            this.log(`Warning: Could not load config: ${error.message}`);
        }
    }

    async saveConfig() {
        try {
            const config = {
                checkInterval: this.checkInterval,
                maxRestarts: this.maxRestarts,
                restartWindow: this.restartWindow,
                lastUpdate: new Date().toISOString()
            };
            await fs.writeJson(this.configFile, config, { spaces: 2 });
        } catch (error) {
            this.log(`Warning: Could not save config: ${error.message}`);
        }
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [WATCHDOG] ${message}\n`;
        console.log(logEntry.trim());
        
        fs.appendFile(this.logFile, logEntry).catch(err => {
            console.error('Failed to write to log file:', err);
        });
    }

    async startProcess(processConfig) {
        try {
            const process = spawn(processConfig.command, processConfig.args, {
                cwd: processConfig.cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });

            const processInfo = {
                config: processConfig,
                process: process,
                pid: process.pid,
                startTime: Date.now(),
                restarts: 0,
                lastRestart: 0,
                healthy: true,
                memoryUsage: 0,
                cpuUsage: 0
            };

            this.processes.set(processConfig.name, processInfo);

            process.stdout.on('data', (data) => {
                this.log(`[${processConfig.name}] STDOUT: ${data.toString().trim()}`);
            });

            process.stderr.on('data', (data) => {
                this.log(`[${processConfig.name}] STDERR: ${data.toString().trim()}`);
            });

            process.on('exit', (code, signal) => {
                this.log(`[${processConfig.name}] Process exited with code ${code}, signal ${signal}`);
                this.handleProcessExit(processConfig.name, code, signal);
            });

            process.on('error', (error) => {
                this.log(`[${processConfig.name}] Process error: ${error.message}`);
            });

            this.log(`[${processConfig.name}] Started with PID ${process.pid}`);
            return true;

        } catch (error) {
            this.log(`[${processConfig.name}] Failed to start: ${error.message}`);
            return false;
        }
    }

    async handleProcessExit(processName, code, signal) {
        const processInfo = this.processes.get(processName);
        if (!processInfo) return;

        processInfo.healthy = false;
        
        if (processInfo.config.critical) {
            const now = Date.now();
            const timeSinceLastRestart = now - processInfo.lastRestart;
            
            if (timeSinceLastRestart > this.restartWindow) {
                processInfo.restarts = 0; // Reset restart counter
            }

            if (processInfo.restarts < this.maxRestarts) {
                processInfo.restarts++;
                processInfo.lastRestart = now;
                
                this.log(`[${processName}] Attempting restart (${processInfo.restarts}/${this.maxRestarts})`);
                
                setTimeout(() => {
                    this.startProcess(processInfo.config);
                }, 5000); // Wait 5 seconds before restart
            } else {
                this.log(`[${processName}] Max restarts exceeded. Marking as failed.`);
                await this.notifyFailure(processName);
            }
        }
    }

    async notifyFailure(processName) {
        try {
            // Send alert to Discord if available
            const alertScript = path.join(this.noxhimeDir, 'discord', 'send-alert.js');
            if (await fs.pathExists(alertScript)) {
                const message = `🚨 CRITICAL: Process ${processName} has failed and exceeded max restarts`;
                exec(`node ${alertScript} "${message}"`, (error) => {
                    if (error) {
                        this.log(`Failed to send Discord alert: ${error.message}`);
                    }
                });
            }

            // Log to system journal
            exec(`logger -t noxhime-watchdog "CRITICAL: Process ${processName} failed"`, (error) => {
                if (error) {
                    this.log(`Failed to log to journal: ${error.message}`);
                }
            });

        } catch (error) {
            this.log(`Failed to notify failure: ${error.message}`);
        }
    }

    async checkProcessHealth() {
        for (const [name, processInfo] of this.processes) {
            if (!processInfo.process || processInfo.process.killed) {
                processInfo.healthy = false;
                continue;
            }

            try {
                // Check if process is still running
                process.kill(processInfo.pid, 0); // Send signal 0 to check if process exists
                
                // Check resource usage
                await this.checkResourceUsage(processInfo);
                
            } catch (error) {
                this.log(`[${name}] Process health check failed: ${error.message}`);
                processInfo.healthy = false;
            }
        }
    }

    async checkResourceUsage(processInfo) {
        try {
            const stats = await this.getProcessStats(processInfo.pid);
            processInfo.memoryUsage = stats.memory;
            processInfo.cpuUsage = stats.cpu;

            // Check memory limit
            if (stats.memory > processInfo.config.maxMemory) {
                this.log(`[${processInfo.config.name}] Memory usage exceeded limit: ${this.formatBytes(stats.memory)} > ${this.formatBytes(processInfo.config.maxMemory)}`);
                await this.restartProcess(processInfo.config.name);
            }

            // Check CPU limit (averaged over time)
            if (stats.cpu > processInfo.config.maxCpu) {
                this.log(`[${processInfo.config.name}] CPU usage high: ${stats.cpu.toFixed(1)}% > ${processInfo.config.maxCpu}%`);
                // Don't restart immediately for CPU, but log warning
            }

        } catch (error) {
            this.log(`Failed to check resource usage for ${processInfo.config.name}: ${error.message}`);
        }
    }

    async getProcessStats(pid) {
        return new Promise((resolve, reject) => {
            exec(`ps -p ${pid} -o pid,ppid,%mem,%cpu,vsz,rss,comm --no-headers`, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }

                const parts = stdout.trim().split(/\s+/);
                if (parts.length >= 6) {
                    resolve({
                        pid: parseInt(parts[0]),
                        memory: parseInt(parts[5]) * 1024, // RSS in bytes
                        cpu: parseFloat(parts[3])
                    });
                } else {
                    reject(new Error('Invalid ps output'));
                }
            });
        });
    }

    async restartProcess(processName) {
        const processInfo = this.processes.get(processName);
        if (!processInfo) return false;

        try {
            this.log(`[${processName}] Restarting process due to resource limits`);
            
            // Kill the process gracefully
            if (processInfo.process && !processInfo.process.killed) {
                processInfo.process.kill('SIGTERM');
                
                // Force kill after 10 seconds if still running
                setTimeout(() => {
                    if (!processInfo.process.killed) {
                        processInfo.process.kill('SIGKILL');
                    }
                }, 10000);
            }

            // Start new process after delay
            setTimeout(() => {
                this.startProcess(processInfo.config);
            }, 5000);

            return true;

        } catch (error) {
            this.log(`Failed to restart ${processName}: ${error.message}`);
            return false;
        }
    }

    formatBytes(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async getSystemStats() {
        const stats = {
            uptime: os.uptime(),
            loadavg: os.loadavg(),
            freemem: os.freemem(),
            totalmem: os.totalmem(),
            cpus: os.cpus().length,
            processes: this.processes.size,
            healthyProcesses: Array.from(this.processes.values()).filter(p => p.healthy).length
        };

        return stats;
    }

    async generateStatusReport() {
        const systemStats = await this.getSystemStats();
        const report = {
            timestamp: new Date().toISOString(),
            system: systemStats,
            processes: {}
        };

        for (const [name, processInfo] of this.processes) {
            report.processes[name] = {
                healthy: processInfo.healthy,
                pid: processInfo.pid,
                uptime: Date.now() - processInfo.startTime,
                restarts: processInfo.restarts,
                memoryUsage: this.formatBytes(processInfo.memoryUsage),
                cpuUsage: `${processInfo.cpuUsage.toFixed(1)}%`
            };
        }

        return report;
    }

    async start() {
        if (this.isRunning) {
            this.log('Watchdog is already running');
            return;
        }

        this.isRunning = true;
        this.log('Starting Noxhime Process Watchdog...');

        // Start all critical processes
        for (const processConfig of this.criticalProcesses) {
            await this.startProcess(processConfig);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Stagger starts
        }

        // Start monitoring loop
        this.monitoringLoop();
        
        this.log('Process Watchdog started successfully');
    }

    async monitoringLoop() {
        while (this.isRunning) {
            try {
                await this.checkProcessHealth();
                
                // Generate periodic status report
                if (Date.now() % 300000 < this.checkInterval) { // Every 5 minutes
                    const report = await this.generateStatusReport();
                    this.log(`Status Report: ${report.system.healthyProcesses}/${report.system.processes} processes healthy`);
                }

            } catch (error) {
                this.log(`Monitoring loop error: ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, this.checkInterval));
        }
    }

    async stop() {
        this.log('Stopping Process Watchdog...');
        this.isRunning = false;

        // Stop all managed processes
        for (const [name, processInfo] of this.processes) {
            if (processInfo.process && !processInfo.process.killed) {
                this.log(`Stopping ${name}...`);
                processInfo.process.kill('SIGTERM');
            }
        }

        // Wait for graceful shutdown
        setTimeout(() => {
            for (const [name, processInfo] of this.processes) {
                if (processInfo.process && !processInfo.process.killed) {
                    this.log(`Force killing ${name}...`);
                    processInfo.process.kill('SIGKILL');
                }
            }
        }, 10000);

        await this.saveConfig();
        this.log('Process Watchdog stopped');
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    if (global.watchdog) {
        await global.watchdog.stop();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    if (global.watchdog) {
        await global.watchdog.stop();
    }
    process.exit(0);
});

// Start watchdog if run directly
if (require.main === module) {
    global.watchdog = new ProcessWatchdog();
    global.watchdog.start().catch(error => {
        console.error('Failed to start watchdog:', error);
        process.exit(1);
    });
}

module.exports = ProcessWatchdog;
EOF

chmod +x "$WATCHDOG_DIR/process-watchdog.js"
echo -e "${GREEN}✓ Process watchdog created${NC}"

# Create system resource monitor
echo -e "${CYAN}[INFO] Creating system resource monitor...${NC}"
cat > "$WATCHDOG_DIR/resource-monitor.js" << 'EOF'
#!/usr/bin/env node

/**
 * Noxhime Sentient Expansion - System Resource Monitor
 * Monitors system resources and triggers alerts for critical conditions
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

class ResourceMonitor {
    constructor() {
        this.noxhimeDir = '/home/nulladmin/noxhime';
        this.logFile = path.join(this.noxhimeDir, 'logs', 'resource-monitor.log');
        this.configFile = path.join(this.noxhimeDir, 'config', 'resource-monitor.json');
        this.isRunning = false;
        this.checkInterval = 30000; // 30 seconds
        
        this.thresholds = {
            memory: 85, // 85% memory usage
            cpu: 90,    // 90% CPU usage (5-minute average)
            disk: 90,   // 90% disk usage
            load: os.cpus().length * 0.8, // 80% of CPU cores
            temperature: 75, // 75°C
            networkConnections: 1000
        };

        this.alerts = {
            memory: false,
            cpu: false,
            disk: false,
            load: false,
            temperature: false,
            network: false
        };

        this.initializeMonitor();
    }

    async initializeMonitor() {
        try {
            await fs.ensureDir(path.dirname(this.logFile));
            await this.loadConfig();
            this.log('Resource monitor initialized successfully');
        } catch (error) {
            console.error('Failed to initialize resource monitor:', error);
            process.exit(1);
        }
    }

    async loadConfig() {
        try {
            if (await fs.pathExists(this.configFile)) {
                const config = await fs.readJson(this.configFile);
                this.thresholds = { ...this.thresholds, ...config.thresholds };
                this.checkInterval = config.checkInterval || this.checkInterval;
            }
        } catch (error) {
            this.log(`Warning: Could not load config: ${error.message}`);
        }
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [RESOURCE] ${message}\n`;
        console.log(logEntry.trim());
        
        fs.appendFile(this.logFile, logEntry).catch(err => {
            console.error('Failed to write to log file:', err);
        });
    }

    async getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const percentage = (used / total) * 100;

        return {
            total: total,
            used: used,
            free: free,
            percentage: percentage
        };
    }

    async getCPUUsage() {
        return new Promise((resolve) => {
            const startMeasure = os.cpus();
            setTimeout(() => {
                const endMeasure = os.cpus();
                let totalIdle = 0;
                let totalTick = 0;

                for (let i = 0; i < startMeasure.length; i++) {
                    const startCpu = startMeasure[i];
                    const endCpu = endMeasure[i];
                    
                    const startTotal = Object.values(startCpu.times).reduce((a, b) => a + b);
                    const endTotal = Object.values(endCpu.times).reduce((a, b) => a + b);
                    
                    const startIdle = startCpu.times.idle;
                    const endIdle = endCpu.times.idle;
                    
                    totalIdle += endIdle - startIdle;
                    totalTick += endTotal - startTotal;
                }

                const idle = totalIdle / startMeasure.length;
                const total = totalTick / startMeasure.length;
                const usage = 100 - (100 * idle / total);

                resolve({
                    usage: usage,
                    cores: startMeasure.length,
                    loadavg: os.loadavg()
                });
            }, 1000);
        });
    }

    async getDiskUsage() {
        return new Promise((resolve, reject) => {
            exec("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'", (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                const percentage = parseInt(stdout.trim());
                resolve({
                    percentage: percentage,
                    path: '/'
                });
            });
        });
    }

    async getTemperature() {
        return new Promise((resolve) => {
            exec("sensors 2>/dev/null | grep 'Core\\|temp' | head -1 | grep -o '[0-9]*\\.[0-9]*°C' | head -1", (error, stdout) => {
                if (error || !stdout.trim()) {
                    resolve({ temperature: null, available: false });
                    return;
                }
                
                const temp = parseFloat(stdout.trim().replace('°C', ''));
                resolve({
                    temperature: temp,
                    available: true
                });
            });
        });
    }

    async getNetworkConnections() {
        return new Promise((resolve, reject) => {
            exec("netstat -an | grep ESTABLISHED | wc -l", (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                const connections = parseInt(stdout.trim());
                resolve({
                    established: connections
                });
            });
        });
    }

    async checkThresholds(stats) {
        const alerts = [];

        // Memory threshold
        if (stats.memory.percentage > this.thresholds.memory) {
            if (!this.alerts.memory) {
                alerts.push(`🚨 High memory usage: ${stats.memory.percentage.toFixed(1)}%`);
                this.alerts.memory = true;
            }
        } else {
            this.alerts.memory = false;
        }

        // CPU threshold
        if (stats.cpu.usage > this.thresholds.cpu) {
            if (!this.alerts.cpu) {
                alerts.push(`🚨 High CPU usage: ${stats.cpu.usage.toFixed(1)}%`);
                this.alerts.cpu = true;
            }
        } else {
            this.alerts.cpu = false;
        }

        // Load average threshold
        if (stats.cpu.loadavg[0] > this.thresholds.load) {
            if (!this.alerts.load) {
                alerts.push(`🚨 High system load: ${stats.cpu.loadavg[0].toFixed(2)}`);
                this.alerts.load = true;
            }
        } else {
            this.alerts.load = false;
        }

        // Disk threshold
        if (stats.disk.percentage > this.thresholds.disk) {
            if (!this.alerts.disk) {
                alerts.push(`🚨 High disk usage: ${stats.disk.percentage}%`);
                this.alerts.disk = true;
            }
        } else {
            this.alerts.disk = false;
        }

        // Temperature threshold
        if (stats.temperature.available && stats.temperature.temperature > this.thresholds.temperature) {
            if (!this.alerts.temperature) {
                alerts.push(`🚨 High temperature: ${stats.temperature.temperature}°C`);
                this.alerts.temperature = true;
            }
        } else {
            this.alerts.temperature = false;
        }

        // Network connections threshold
        if (stats.network.established > this.thresholds.networkConnections) {
            if (!this.alerts.network) {
                alerts.push(`🚨 High network connections: ${stats.network.established}`);
                this.alerts.network = true;
            }
        } else {
            this.alerts.network = false;
        }

        return alerts;
    }

    async sendAlert(message) {
        try {
            this.log(`ALERT: ${message}`);

            // Send to Discord if available
            const alertScript = path.join(this.noxhimeDir, 'discord', 'send-alert.js');
            if (await fs.pathExists(alertScript)) {
                exec(`node ${alertScript} "${message}"`, (error) => {
                    if (error) {
                        this.log(`Failed to send Discord alert: ${error.message}`);
                    }
                });
            }

            // Log to system journal
            exec(`logger -t noxhime-resources "${message}"`, (error) => {
                if (error) {
                    this.log(`Failed to log to journal: ${error.message}`);
                }
            });

        } catch (error) {
            this.log(`Failed to send alert: ${error.message}`);
        }
    }

    formatBytes(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async collectStats() {
        try {
            const stats = {
                timestamp: new Date().toISOString(),
                memory: await this.getMemoryUsage(),
                cpu: await this.getCPUUsage(),
                disk: await this.getDiskUsage(),
                temperature: await this.getTemperature(),
                network: await this.getNetworkConnections(),
                uptime: os.uptime()
            };

            return stats;
        } catch (error) {
            this.log(`Failed to collect stats: ${error.message}`);
            return null;
        }
    }

    async generateReport(stats) {
        const report = {
            timestamp: stats.timestamp,
            system: {
                uptime: `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`,
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch()
            },
            memory: {
                usage: `${stats.memory.percentage.toFixed(1)}%`,
                used: this.formatBytes(stats.memory.used),
                total: this.formatBytes(stats.memory.total),
                status: stats.memory.percentage > this.thresholds.memory ? 'WARNING' : 'OK'
            },
            cpu: {
                usage: `${stats.cpu.usage.toFixed(1)}%`,
                cores: stats.cpu.cores,
                loadavg: stats.cpu.loadavg.map(l => l.toFixed(2)),
                status: stats.cpu.usage > this.thresholds.cpu ? 'WARNING' : 'OK'
            },
            disk: {
                usage: `${stats.disk.percentage}%`,
                path: stats.disk.path,
                status: stats.disk.percentage > this.thresholds.disk ? 'WARNING' : 'OK'
            },
            temperature: stats.temperature.available ? {
                value: `${stats.temperature.temperature}°C`,
                status: stats.temperature.temperature > this.thresholds.temperature ? 'WARNING' : 'OK'
            } : { available: false },
            network: {
                connections: stats.network.established,
                status: stats.network.established > this.thresholds.networkConnections ? 'WARNING' : 'OK'
            }
        };

        return report;
    }

    async start() {
        if (this.isRunning) {
            this.log('Resource monitor is already running');
            return;
        }

        this.isRunning = true;
        this.log('Starting Noxhime Resource Monitor...');

        // Start monitoring loop
        this.monitoringLoop();
        
        this.log('Resource Monitor started successfully');
    }

    async monitoringLoop() {
        while (this.isRunning) {
            try {
                const stats = await this.collectStats();
                if (stats) {
                    // Check thresholds and send alerts
                    const alerts = await this.checkThresholds(stats);
                    for (const alert of alerts) {
                        await this.sendAlert(alert);
                    }

                    // Log periodic status (every 10 minutes)
                    if (Date.now() % 600000 < this.checkInterval) {
                        const report = await this.generateReport(stats);
                        this.log(`System Status - Memory: ${report.memory.usage}, CPU: ${report.cpu.usage}, Disk: ${report.disk.usage}`);
                    }
                }

            } catch (error) {
                this.log(`Monitoring loop error: ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, this.checkInterval));
        }
    }

    async stop() {
        this.log('Stopping Resource Monitor...');
        this.isRunning = false;
        this.log('Resource Monitor stopped');
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    if (global.resourceMonitor) {
        await global.resourceMonitor.stop();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    if (global.resourceMonitor) {
        await global.resourceMonitor.stop();
    }
    process.exit(0);
});

// Start monitor if run directly
if (require.main === module) {
    global.resourceMonitor = new ResourceMonitor();
    global.resourceMonitor.start().catch(error => {
        console.error('Failed to start resource monitor:', error);
        process.exit(1);
    });
}

module.exports = ResourceMonitor;
EOF

chmod +x "$WATCHDOG_DIR/resource-monitor.js"
echo -e "${GREEN}✓ Resource monitor created${NC}"

# Create final sync system
echo -e "${CYAN}[INFO] Creating final synchronization system...${NC}"
cat > "$SCRIPTS_DIR/final-sync.js" << 'EOF'
#!/usr/bin/env node

/**
 * Noxhime Sentient Expansion - Final Synchronization
 * Performs final system checks and synchronization for autonomous operation
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class FinalSync {
    constructor() {
        this.noxhimeDir = '/home/nulladmin/noxhime';
        this.logFile = path.join(this.noxhimeDir, 'logs', 'final-sync.log');
        this.statusFile = path.join(this.noxhimeDir, 'data', 'system-status.json');
        
        this.requiredServices = [
            'ssh-honeypot',
            'http-honeypot',
            'discord-bot',
            'heartbeat-monitor',
            'process-watchdog',
            'resource-monitor'
        ];

        this.requiredPorts = [
            { port: 2222, service: 'SSH Honeypot' },
            { port: 8080, service: 'HTTP Honeypot' }
        ];

        this.requiredDirectories = [
            'scripts', 'quarantine', 'patches', 'logs', 
            'honeypot', 'sandbox', 'watchdog', 'config', 
            'data', 'backup', 'discord', 'heartbeat'
        ];
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [SYNC] ${message}\n`;
        console.log(logEntry.trim());
        
        fs.appendFile(this.logFile, logEntry).catch(err => {
            console.error('Failed to write to log file:', err);
        });
    }

    async checkDirectoryStructure() {
        this.log('Checking directory structure...');
        let success = true;

        for (const dir of this.requiredDirectories) {
            const dirPath = path.join(this.noxhimeDir, dir);
            if (!await fs.pathExists(dirPath)) {
                this.log(`ERROR: Required directory missing: ${dir}`);
                success = false;
            } else {
                this.log(`✓ Directory exists: ${dir}`);
            }
        }

        return success;
    }

    async checkServiceFiles() {
        this.log('Checking service files...');
        let success = true;

        const serviceFiles = {
            'ssh-honeypot': 'honeypot/ssh-honeypot.js',
            'http-honeypot': 'honeypot/http-honeypot.js',
            'discord-bot': 'discord/bot-manager.js',
            'heartbeat-monitor': 'heartbeat/monitor.js',
            'process-watchdog': 'watchdog/process-watchdog.js',
            'resource-monitor': 'watchdog/resource-monitor.js'
        };

        for (const [service, file] of Object.entries(serviceFiles)) {
            const filePath = path.join(this.noxhimeDir, file);
            if (!await fs.pathExists(filePath)) {
                this.log(`ERROR: Service file missing: ${file}`);
                success = false;
            } else {
                this.log(`✓ Service file exists: ${service}`);
            }
        }

        return success;
    }

    async checkPortAvailability() {
        this.log('Checking port availability...');
        let success = true;

        for (const { port, service } of this.requiredPorts) {
            try {
                const { stdout } = await execAsync(`netstat -tuln | grep :${port}`);
                if (stdout.trim()) {
                    this.log(`✓ Port ${port} is in use (${service})`);
                } else {
                    this.log(`WARNING: Port ${port} not in use (${service})`);
                }
            } catch (error) {
                this.log(`ERROR: Failed to check port ${port}: ${error.message}`);
                success = false;
            }
        }

        return success;
    }

    async checkSystemServices() {
        this.log('Checking system services...');
        let success = true;

        const systemServices = [
            'fail2ban',
            'ufw'
        ];

        for (const service of systemServices) {
            try {
                const { stdout } = await execAsync(`systemctl is-active ${service}`);
                if (stdout.trim() === 'active') {
                    this.log(`✓ System service active: ${service}`);
                } else {
                    this.log(`WARNING: System service not active: ${service}`);
                }
            } catch (error) {
                this.log(`ERROR: Failed to check service ${service}: ${error.message}`);
            }
        }

        return success;
    }

    async checkFirewallRules() {
        this.log('Checking firewall rules...');
        
        try {
            const { stdout } = await execAsync('ufw status numbered');
            this.log('Current UFW status:');
            this.log(stdout);

            // Check for required rules
            const requiredRules = ['2222', '8080'];
            for (const port of requiredRules) {
                if (stdout.includes(port)) {
                    this.log(`✓ Firewall rule exists for port ${port}`);
                } else {
                    this.log(`WARNING: No firewall rule found for port ${port}`);
                }
            }

        } catch (error) {
            this.log(`ERROR: Failed to check firewall: ${error.message}`);
            return false;
        }

        return true;
    }

    async performSecurityAudit() {
        this.log('Performing security audit...');
        let success = true;

        // Check file permissions
        const criticalFiles = [
            'config/discord.json',
            'config/honeypot.json',
            'scripts/*.sh'
        ];

        for (const pattern of criticalFiles) {
            try {
                const files = await this.globFiles(pattern);
                for (const file of files) {
                    const stats = await fs.stat(file);
                    const mode = (stats.mode & parseInt('777', 8)).toString(8);
                    
                    if (file.includes('config') && mode !== '600') {
                        this.log(`WARNING: Config file has wrong permissions: ${file} (${mode})`);
                    } else if (file.includes('scripts') && mode !== '755') {
                        this.log(`WARNING: Script file has wrong permissions: ${file} (${mode})`);
                    } else {
                        this.log(`✓ File permissions correct: ${path.basename(file)}`);
                    }
                }
            } catch (error) {
                this.log(`ERROR: Failed to check permissions for ${pattern}: ${error.message}`);
                success = false;
            }
        }

        return success;
    }

    async globFiles(pattern) {
        const basePath = this.noxhimeDir;
        const fullPattern = path.join(basePath, pattern);
        
        try {
            const { stdout } = await execAsync(`find ${basePath} -path "${fullPattern}" 2>/dev/null`);
            return stdout.trim().split('\n').filter(line => line.length > 0);
        } catch (error) {
            return [];
        }
    }

    async createSystemStatus() {
        this.log('Creating system status report...');

        const status = {
            timestamp: new Date().toISOString(),
            version: '3.0.0',
            status: 'operational',
            phase: 'Phase 5 - Watchdog System & Final Sync',
            services: {},
            system: {
                uptime: process.uptime(),
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            },
            checks: {
                directories: await this.checkDirectoryStructure(),
                services: await this.checkServiceFiles(),
                ports: await this.checkPortAvailability(),
                firewall: await this.checkFirewallRules(),
                security: await this.performSecurityAudit()
            }
        };

        // Check individual service status
        for (const service of this.requiredServices) {
            try {
                const { stdout } = await execAsync(`pgrep -f ${service}`);
                status.services[service] = {
                    running: stdout.trim().length > 0,
                    pid: stdout.trim().split('\n')[0] || null
                };
            } catch (error) {
                status.services[service] = {
                    running: false,
                    pid: null
                };
            }
        }

        // Determine overall status
        const allChecks = Object.values(status.checks).every(check => check === true);
        const runningServices = Object.values(status.services).filter(s => s.running).length;
        
        if (allChecks && runningServices >= this.requiredServices.length * 0.8) {
            status.status = 'operational';
        } else if (runningServices >= this.requiredServices.length * 0.6) {
            status.status = 'degraded';
        } else {
            status.status = 'critical';
        }

        await fs.writeJson(this.statusFile, status, { spaces: 2 });
        this.log(`System status: ${status.status.toUpperCase()}`);
        
        return status;
    }

    async syncConfiguration() {
        this.log('Synchronizing configuration...');

        // Create master configuration file
        const masterConfig = {
            version: '3.0.0',
            timestamp: new Date().toISOString(),
            services: {
                honeypot: {
                    ssh: { port: 2222, enabled: true },
                    http: { port: 8080, enabled: true }
                },
                discord: {
                    enabled: true,
                    alerts: true,
                    commands: true
                },
                monitoring: {
                    heartbeat: { interval: 30 },
                    watchdog: { enabled: true },
                    resources: { enabled: true }
                }
            },
            security: {
                firewall: true,
                fail2ban: true,
                quarantine: true,
                sandbox: true
            },
            paths: {
                noxhimeDir: this.noxhimeDir,
                logs: path.join(this.noxhimeDir, 'logs'),
                config: path.join(this.noxhimeDir, 'config'),
                data: path.join(this.noxhimeDir, 'data')
            }
        };

        const configPath = path.join(this.noxhimeDir, 'config', 'master.json');
        await fs.writeJson(configPath, masterConfig, { spaces: 2 });
        
        this.log('Configuration synchronized');
        return true;
    }

    async optimizeSystem() {
        this.log('Performing system optimization...');

        try {
            // Clean up old logs (keep last 7 days)
            await execAsync(`find ${this.noxhimeDir}/logs -name "*.log" -mtime +7 -delete`);
            
            // Optimize database if it exists
            const dbPath = path.join(this.noxhimeDir, 'data', 'noxhime.db');
            if (await fs.pathExists(dbPath)) {
                await execAsync(`sqlite3 ${dbPath} "VACUUM;"`);
                this.log('Database optimized');
            }

            // Clean temporary files
            await execAsync(`find ${this.noxhimeDir} -name "*.tmp" -delete`);
            
            // Set proper permissions
            await execAsync(`chown -R nulladmin:nulladmin ${this.noxhimeDir}`);
            await execAsync(`chmod -R 755 ${this.noxhimeDir}/scripts`);
            await execAsync(`chmod -R 600 ${this.noxhimeDir}/config`);

            this.log('System optimization completed');
            return true;

        } catch (error) {
            this.log(`System optimization failed: ${error.message}`);
            return false;
        }
    }

    async performFinalSync() {
        this.log('Starting final synchronization...');

        const results = {
            directoryCheck: await this.checkDirectoryStructure(),
            serviceCheck: await this.checkServiceFiles(),
            portCheck: await this.checkPortAvailability(),
            systemCheck: await this.checkSystemServices(),
            firewallCheck: await this.checkFirewallRules(),
            securityAudit: await this.performSecurityAudit(),
            configSync: await this.syncConfiguration(),
            optimization: await this.optimizeSystem()
        };

        const systemStatus = await this.createSystemStatus();

        // Generate final report
        const report = {
            timestamp: new Date().toISOString(),
            phase: 'Phase 5 - Final Sync',
            results: results,
            systemStatus: systemStatus,
            summary: {
                totalChecks: Object.keys(results).length,
                passedChecks: Object.values(results).filter(r => r === true).length,
                overallStatus: systemStatus.status
            }
        };

        const reportPath = path.join(this.noxhimeDir, 'logs', 'final-sync-report.json');
        await fs.writeJson(reportPath, report, { spaces: 2 });

        this.log(`Final sync completed: ${report.summary.passedChecks}/${report.summary.totalChecks} checks passed`);
        this.log(`Overall system status: ${report.summary.overallStatus.toUpperCase()}`);

        return report;
    }
}

// Main execution
if (require.main === module) {
    const sync = new FinalSync();
    sync.performFinalSync()
        .then(report => {
            console.log('\n' + '='.repeat(50));
            console.log('NOXHIME SENTIENT EXPANSION - PHASE 5 COMPLETE');
            console.log('='.repeat(50));
            console.log(`Status: ${report.summary.overallStatus.toUpperCase()}`);
            console.log(`Checks: ${report.summary.passedChecks}/${report.summary.totalChecks} passed`);
            console.log('='.repeat(50));
            
            if (report.summary.overallStatus === 'operational') {
                process.exit(0);
            } else {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Final sync failed:', error);
            process.exit(1);
        });
}

module.exports = FinalSync;
EOF

chmod +x "$SCRIPTS_DIR/final-sync.js"
echo -e "${GREEN}✓ Final sync system created${NC}"

# Create systemd services for watchdog components
echo -e "${CYAN}[INFO] Creating systemd services...${NC}"
sudo tee /etc/systemd/system/noxhime-watchdog.service > /dev/null << EOF
[Unit]
Description=Noxhime Process Watchdog
After=network.target
Wants=network.target

[Service]
Type=simple
User=nulladmin
Group=nulladmin
WorkingDirectory=$NOXHIME_DIR
ExecStart=/usr/bin/node $WATCHDOG_DIR/process-watchdog.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=noxhime-watchdog

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$NOXHIME_DIR

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/noxhime-resources.service > /dev/null << EOF
[Unit]
Description=Noxhime Resource Monitor
After=network.target
Wants=network.target

[Service]
Type=simple
User=nulladmin
Group=nulladmin
WorkingDirectory=$NOXHIME_DIR
ExecStart=/usr/bin/node $WATCHDOG_DIR/resource-monitor.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=noxhime-resources

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$NOXHIME_DIR

[Install]
WantedBy=multi-user.target
EOF

# Create watchdog configuration files
echo -e "${CYAN}[INFO] Creating watchdog configuration...${NC}"
cat > "$CONFIG_DIR/watchdog.json" << 'EOF'
{
  "processWatchdog": {
    "checkInterval": 15000,
    "maxRestarts": 5,
    "restartWindow": 300000,
    "processes": {
      "noxhime-core": {
        "maxMemory": 536870912,
        "maxCpu": 80,
        "critical": true
      },
      "ssh-honeypot": {
        "maxMemory": 268435456,
        "maxCpu": 50,
        "critical": true
      },
      "http-honeypot": {
        "maxMemory": 268435456,
        "maxCpu": 50,
        "critical": true
      },
      "discord-bot": {
        "maxMemory": 268435456,
        "maxCpu": 30,
        "critical": true
      },
      "heartbeat-monitor": {
        "maxMemory": 134217728,
        "maxCpu": 20,
        "critical": true
      }
    }
  },
  "resourceMonitor": {
    "checkInterval": 30000,
    "thresholds": {
      "memory": 85,
      "cpu": 90,
      "disk": 90,
      "temperature": 75,
      "networkConnections": 1000
    },
    "alerts": {
      "enabled": true,
      "cooldown": 300000
    }
  }
}
EOF

# Enable and start systemd services
echo -e "${CYAN}[INFO] Enabling systemd services...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable noxhime-watchdog.service
sudo systemctl enable noxhime-resources.service

echo -e "${GREEN}✓ Systemd services created and enabled${NC}"

# Create startup script for all components
echo -e "${CYAN}[INFO] Creating startup orchestrator...${NC}"
cat > "$SCRIPTS_DIR/start-all.sh" << 'EOF'
#!/bin/bash

# Noxhime Sentient Expansion - Startup Orchestrator
# Starts all Noxhime components in proper order

set -euo pipefail

NOXHIME_DIR="/home/nulladmin/noxhime"
SCRIPTS_DIR="$NOXHIME_DIR/scripts"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}╔══════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║     NOXHIME SENTIENT EXPANSION       ║${NC}"
echo -e "${PURPLE}║      Starting All Components        ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════╝${NC}"
echo

# Function to check if process is running
is_running() {
    pgrep -f "$1" > /dev/null 2>&1
}

# Function to wait for service to start
wait_for_service() {
    local service=$1
    local timeout=${2:-30}
    local count=0
    
    echo -e "${CYAN}Waiting for $service to start...${NC}"
    while ! is_running "$service" && [ $count -lt $timeout ]; do
        sleep 1
        ((count++))
    done
    
    if is_running "$service"; then
        echo -e "${GREEN}✓ $service started successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ $service failed to start${NC}"
        return 1
    fi
}

# Start services in order
echo -e "${CYAN}[1/6] Starting SSH Honeypot...${NC}"
if ! is_running "ssh-honeypot"; then
    cd "$NOXHIME_DIR/honeypot"
    nohup node ssh-honeypot.js > /dev/null 2>&1 &
    wait_for_service "ssh-honeypot"
else
    echo -e "${YELLOW}SSH Honeypot already running${NC}"
fi

echo -e "${CYAN}[2/6] Starting HTTP Honeypot...${NC}"
if ! is_running "http-honeypot"; then
    cd "$NOXHIME_DIR/honeypot"
    nohup node http-honeypot.js > /dev/null 2>&1 &
    wait_for_service "http-honeypot"
else
    echo -e "${YELLOW}HTTP Honeypot already running${NC}"
fi

echo -e "${CYAN}[3/6] Starting Discord Bot...${NC}"
if ! is_running "bot-manager"; then
    cd "$NOXHIME_DIR/discord"
    nohup node bot-manager.js > /dev/null 2>&1 &
    wait_for_service "bot-manager"
else
    echo -e "${YELLOW}Discord Bot already running${NC}"
fi

echo -e "${CYAN}[4/6] Starting Heartbeat Monitor...${NC}"
if ! is_running "heartbeat.*monitor"; then
    cd "$NOXHIME_DIR/heartbeat"
    nohup node monitor.js > /dev/null 2>&1 &
    wait_for_service "heartbeat.*monitor"
else
    echo -e "${YELLOW}Heartbeat Monitor already running${NC}"
fi

echo -e "${CYAN}[5/6] Starting Process Watchdog...${NC}"
if ! is_running "process-watchdog"; then
    sudo systemctl start noxhime-watchdog.service
    wait_for_service "process-watchdog"
else
    echo -e "${YELLOW}Process Watchdog already running${NC}"
fi

echo -e "${CYAN}[6/6] Starting Resource Monitor...${NC}"
if ! is_running "resource-monitor"; then
    sudo systemctl start noxhime-resources.service
    wait_for_service "resource-monitor"
else
    echo -e "${YELLOW}Resource Monitor already running${NC}"
fi

# Final status check
echo
echo -e "${PURPLE}╔══════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║         STARTUP COMPLETE            ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════╝${NC}"
echo

# Run final sync
echo -e "${CYAN}Running final system synchronization...${NC}"
node "$SCRIPTS_DIR/final-sync.js"

echo
echo -e "${GREEN}🎉 Noxhime Sentient Expansion is now operational!${NC}"
echo -e "${CYAN}Monitor status with: sudo systemctl status noxhime-*${NC}"
echo -e "${CYAN}View logs with: journalctl -u noxhime-* -f${NC}"
EOF

chmod +x "$SCRIPTS_DIR/start-all.sh"

# Create stop script
cat > "$SCRIPTS_DIR/stop-all.sh" << 'EOF'
#!/bin/bash

# Noxhime Sentient Expansion - Stop All Components

set -euo pipefail

NOXHIME_DIR="/home/nullladmin/noxhime"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}Stopping all Noxhime components...${NC}"

# Stop systemd services
echo -e "${CYAN}Stopping systemd services...${NC}"
sudo systemctl stop noxhime-watchdog.service 2>/dev/null || true
sudo systemctl stop noxhime-resources.service 2>/dev/null || true

# Kill Node.js processes
echo -e "${CYAN}Stopping Node.js processes...${NC}"
pkill -f "ssh-honeypot" 2>/dev/null || true
pkill -f "http-honeypot" 2>/dev/null || true
pkill -f "bot-manager" 2>/dev/null || true
pkill -f "heartbeat.*monitor" 2>/dev/null || true
pkill -f "process-watchdog" 2>/dev/null || true
pkill -f "resource-monitor" 2>/dev/null || true

echo -e "${GREEN}✓ All Noxhime components stopped${NC}"
EOF

chmod +x "$SCRIPTS_DIR/stop-all.sh"

echo -e "${GREEN}✓ Startup and stop scripts created${NC}"

# Final setup completion
echo
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   PHASE 5 SETUP COMPLETED           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo
echo -e "${CYAN}Phase 5 Components Created:${NC}"
echo -e "${YELLOW}• Process Watchdog System${NC}"
echo -e "${YELLOW}• Resource Monitor${NC}"
echo -e "${YELLOW}• Final Synchronization System${NC}"
echo -e "${YELLOW}• Systemd Service Integration${NC}"
echo -e "${YELLOW}• Startup/Stop Orchestration${NC}"
echo
echo -e "${CYAN}Next Steps:${NC}"
echo -e "${YELLOW}1. Run Phase 6 for Alpha Launch & Logging${NC}"
echo -e "${YELLOW}2. Test the complete system${NC}"
echo -e "${YELLOW}3. Start all services with: $SCRIPTS_DIR/start-all.sh${NC}"
echo
echo -e "${GREEN}Phase 5: Watchdog System & Final Sync - COMPLETE ✓${NC}"
