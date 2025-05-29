#!/bin/bash
# Noxhime Sentient Expansion - Phase 4: Heartbeat & Auto-Patch System
# This script sets up autonomous monitoring and self-healing capabilities

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'
MIDNIGHT_PURPLE='\033[38;5;92m'

echo -e "${BOLD}${MIDNIGHT_PURPLE}"
echo "███╗   ██╗ ██████╗ ██╗  ██╗██╗  ██╗██╗███╗   ███╗███████╗"
echo "████╗  ██║██╔═══██╗╚██╗██╔╝██║  ██║██║████╗ ████║██╔════╝"
echo "██╔██╗ ██║██║   ██║ ╚███╔╝ ███████║██║██╔████╔██║█████╗  "
echo "██║╚██╗██║██║   ██║ ██╔██╗ ██╔══██║██║██║╚██╔╝██║██╔══╝  "
echo "██║ ╚████║╚██████╔╝██╔╝ ██╗██║  ██║██║██║ ╚═╝ ██║███████╗"
echo "╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝"
echo -e "${MIDNIGHT_PURPLE}        Sentient Expansion - Phase 4 Heartbeat     v3.0.0${NC}"
echo

NOXHIME_HOME="/home/nulladmin/noxhime"
USER="nulladmin"

# Function definitions
status() { echo -e "${BLUE}[*]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
divider() {
    echo -e "${PURPLE}=========================================${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${PURPLE}=========================================${NC}"
}

# Create Heartbeat System
setup_heartbeat_system() {
    divider "Setting Up Heartbeat System"
    
    # Create heartbeat monitor
    cat > "$NOXHIME_HOME/heartbeat/heartbeat-monitor.js" << 'EOF'
const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

class HeartbeatMonitor {
    constructor() {
        this.noxhimeHome = '/home/nulladmin/noxhime';
        this.heartbeatInterval = 30; // 30 seconds
        this.lastHeartbeat = Date.now();
        this.serviceChecks = [
            'ssh',
            'nginx',
            'fail2ban',
            'ufw'
        ];
        this.criticalProcesses = [
            'sshd',
            'nginx',
            'fail2ban-server'
        ];
        this.startTime = Date.now();
        this.alertThreshold = 3; // Number of failed checks before alert
        this.failureCount = new Map();
        
        this.initializeHeartbeat();
    }
    
    initializeHeartbeat() {
        console.log('🫀 Noxhime Heartbeat Monitor starting...');
        
        // Schedule heartbeat every 30 seconds
        cron.schedule('*/30 * * * * *', () => {
            this.performHeartbeat();
        });
        
        // Schedule detailed health check every 5 minutes
        cron.schedule('*/5 * * * *', () => {
            this.performHealthCheck();
        });
        
        // Schedule self-healing check every 10 minutes
        cron.schedule('*/10 * * * *', () => {
            this.performSelfHealing();
        });
        
        console.log('✅ Heartbeat monitor initialized');
    }
    
    async performHeartbeat() {
        const timestamp = new Date().toISOString();
        this.lastHeartbeat = Date.now();
        
        const heartbeatData = {
            timestamp,
            uptime: this.getUptime(),
            status: 'alive',
            pid: process.pid,
            memory: process.memoryUsage(),
            system: await this.getQuickSystemStatus()
        };
        
        // Write heartbeat to file
        const heartbeatPath = path.join(this.noxhimeHome, 'heartbeat', 'heartbeat.json');
        await fs.writeFile(heartbeatPath, JSON.stringify(heartbeatData, null, 2));
        
        // Log heartbeat
        const logEntry = `${timestamp} [HEARTBEAT] System alive - Uptime: ${this.getUptime()}s\n`;
        await fs.appendFile(path.join(this.noxhimeHome, 'logs', 'heartbeat.log'), logEntry);
        
        console.log(`💓 Heartbeat - ${timestamp}`);
    }
    
    async performHealthCheck() {
        console.log('🔍 Performing health check...');
        
        const healthReport = {
            timestamp: new Date().toISOString(),
            services: {},
            processes: {},
            resources: await this.getResourceUsage(),
            network: await this.getNetworkStatus(),
            security: await this.getSecurityStatus()
        };
        
        // Check services
        for (const service of this.serviceChecks) {
            healthReport.services[service] = await this.checkService(service);
        }
        
        // Check critical processes
        for (const process of this.criticalProcesses) {
            healthReport.processes[process] = await this.checkProcess(process);
        }
        
        // Analyze health and take action if needed
        await this.analyzeHealth(healthReport);
        
        // Save health report
        const reportPath = path.join(this.noxhimeHome, 'heartbeat', 'health-report.json');
        await fs.writeFile(reportPath, JSON.stringify(healthReport, null, 2));
        
        console.log('✅ Health check completed');
    }
    
    async performSelfHealing() {
        console.log('🔧 Performing self-healing check...');
        
        const healingActions = [];
        
        // Check for failed services and restart them
        for (const service of this.serviceChecks) {
            const status = await this.checkService(service);
            if (!status.active) {
                console.log(`⚠️ Service ${service} is down, attempting restart...`);
                const result = await this.restartService(service);
                healingActions.push({
                    action: 'restart_service',
                    target: service,
                    result: result.success,
                    details: result.output
                });
            }
        }
        
        // Check for high resource usage
        const resources = await this.getResourceUsage();
        if (resources.memory > 90) {
            console.log('⚠️ High memory usage detected, clearing caches...');
            const result = await this.clearSystemCaches();
            healingActions.push({
                action: 'clear_caches',
                target: 'system',
                result: result.success,
                details: result.output
            });
        }
        
        if (resources.disk > 85) {
            console.log('⚠️ High disk usage detected, cleaning logs...');
            const result = await this.cleanOldLogs();
            healingActions.push({
                action: 'clean_logs',
                target: 'system',
                result: result.success,
                details: result.output
            });
        }
        
        // Check for stuck processes
        const stuckProcesses = await this.findStuckProcesses();
        for (const process of stuckProcesses) {
            console.log(`⚠️ Stuck process detected: ${process.name} (PID: ${process.pid})`);
            const result = await this.killStuckProcess(process.pid);
            healingActions.push({
                action: 'kill_stuck_process',
                target: `${process.name} (${process.pid})`,
                result: result.success,
                details: result.output
            });
        }
        
        // Log healing actions
        if (healingActions.length > 0) {
            const logEntry = `${new Date().toISOString()} [SELF-HEAL] Actions taken: ${JSON.stringify(healingActions)}\n`;
            await fs.appendFile(path.join(this.noxhimeHome, 'logs', 'self-healing.log'), logEntry);
            
            // Send alert about healing actions
            await this.sendHealingAlert(healingActions);
        }
        
        console.log(`✅ Self-healing completed - ${healingActions.length} actions taken`);
    }
    
    async checkService(serviceName) {
        return new Promise((resolve) => {
            exec(`systemctl is-active ${serviceName}`, (error, stdout) => {
                const active = stdout.trim() === 'active';
                resolve({
                    name: serviceName,
                    active,
                    status: stdout.trim(),
                    checked_at: new Date().toISOString()
                });
            });
        });
    }
    
    async checkProcess(processName) {
        return new Promise((resolve) => {
            exec(`pgrep -f ${processName}`, (error, stdout) => {
                const pids = stdout.trim().split('\n').filter(pid => pid);
                resolve({
                    name: processName,
                    running: pids.length > 0,
                    pid_count: pids.length,
                    pids: pids,
                    checked_at: new Date().toISOString()
                });
            });
        });
    }
    
    async getQuickSystemStatus() {
        return new Promise((resolve) => {
            exec('uptime', (error, stdout) => {
                const uptime = stdout.trim();
                const loadMatch = uptime.match(/load average: ([\d.]+)/);
                const load = loadMatch ? parseFloat(loadMatch[1]) : 0;
                
                resolve({
                    uptime: uptime,
                    load_average: load,
                    high_load: load > 2.0
                });
            });
        });
    }
    
    async getResourceUsage() {
        return new Promise((resolve) => {
            exec('df -h / && free | grep Mem', (error, stdout) => {
                const lines = stdout.split('\n');
                
                // Parse disk usage
                const diskLine = lines.find(line => line.includes('/')) || '';
                const diskParts = diskLine.split(/\s+/);
                const diskUsage = diskParts[4] ? parseInt(diskParts[4].replace('%', '')) : 0;
                
                // Parse memory usage
                const memLine = lines.find(line => line.includes('Mem:')) || '';
                const memParts = memLine.split(/\s+/);
                const memTotal = parseInt(memParts[1]) || 1;
                const memUsed = parseInt(memParts[2]) || 0;
                const memUsage = Math.round((memUsed / memTotal) * 100);
                
                resolve({
                    disk: diskUsage,
                    memory: memUsage,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    
    async getNetworkStatus() {
        return new Promise((resolve) => {
            exec('netstat -i', (error, stdout) => {
                const interfaces = [];
                const lines = stdout.split('\n').slice(2); // Skip headers
                
                for (const line of lines) {
                    if (line.trim()) {
                        const parts = line.split(/\s+/);
                        if (parts[0] && parts[0] !== 'lo') {
                            interfaces.push({
                                name: parts[0],
                                status: parts[0].includes('*') ? 'down' : 'up'
                            });
                        }
                    }
                }
                
                resolve({
                    interfaces,
                    primary_up: interfaces.some(iface => iface.status === 'up'),
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    
    async getSecurityStatus() {
        return new Promise((resolve) => {
            exec('fail2ban-client status && ufw status', (error, stdout) => {
                const fail2banRunning = stdout.includes('Number of jail:');
                const ufwActive = stdout.includes('Status: active');
                
                resolve({
                    fail2ban: fail2banRunning,
                    firewall: ufwActive,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    
    async analyzeHealth(healthReport) {
        const issues = [];
        
        // Check service health
        for (const [service, status] of Object.entries(healthReport.services)) {
            if (!status.active) {
                issues.push(`Service ${service} is not active`);
                this.incrementFailureCount(service);
            } else {
                this.resetFailureCount(service);
            }
        }
        
        // Check resource usage
        if (healthReport.resources.memory > 95) {
            issues.push(`Critical memory usage: ${healthReport.resources.memory}%`);
        }
        
        if (healthReport.resources.disk > 90) {
            issues.push(`Critical disk usage: ${healthReport.resources.disk}%`);
        }
        
        // Check security status
        if (!healthReport.security.fail2ban) {
            issues.push('Fail2ban is not running');
        }
        
        if (!healthReport.security.firewall) {
            issues.push('UFW firewall is not active');
        }
        
        // Send alerts for critical issues
        if (issues.length > 0) {
            await this.sendHealthAlert(issues, healthReport);
        }
    }
    
    incrementFailureCount(service) {
        const current = this.failureCount.get(service) || 0;
        this.failureCount.set(service, current + 1);
    }
    
    resetFailureCount(service) {
        this.failureCount.set(service, 0);
    }
    
    async restartService(serviceName) {
        return new Promise((resolve) => {
            exec(`systemctl restart ${serviceName}`, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    output: error ? stderr : stdout,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    
    async clearSystemCaches() {
        return new Promise((resolve) => {
            exec('sync && echo 3 > /proc/sys/vm/drop_caches', (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    output: error ? stderr : 'Caches cleared successfully',
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    
    async cleanOldLogs() {
        return new Promise((resolve) => {
            const cleanCommands = [
                'journalctl --vacuum-time=7d',
                `find ${this.noxhimeHome}/logs -name "*.log" -type f -mtime +7 -exec truncate -s 1M {} \\;`
            ];
            
            exec(cleanCommands.join(' && '), (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    output: error ? stderr : 'Old logs cleaned',
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    
    async findStuckProcesses() {
        return new Promise((resolve) => {
            // Find processes with high CPU usage that haven't changed in a while
            exec("ps aux --sort=-%cpu | head -20 | awk '$3 > 90 {print $2, $11}'", (error, stdout) => {
                const stuckProcesses = [];
                const lines = stdout.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    const [pid, name] = line.split(' ');
                    if (pid && name) {
                        stuckProcesses.push({ pid: parseInt(pid), name });
                    }
                }
                
                resolve(stuckProcesses);
            });
        });
    }
    
    async killStuckProcess(pid) {
        return new Promise((resolve) => {
            exec(`kill -9 ${pid}`, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    output: error ? stderr : `Process ${pid} terminated`,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    
    async sendHealthAlert(issues, healthReport) {
        try {
            const AlertManager = require('../discord/alert-manager');
            const alertManager = new AlertManager();
            
            const severity = issues.some(issue => 
                issue.includes('Critical') || issue.includes('not running')
            ) ? 'critical' : 'high';
            
            await alertManager.sendAlert(
                'HEALTH',
                'System Health Issues Detected',
                `Issues found:\n${issues.join('\n')}\n\nMemory: ${healthReport.resources.memory}%\nDisk: ${healthReport.resources.disk}%`,
                severity
            );
        } catch (error) {
            console.error('Failed to send health alert:', error);
        }
    }
    
    async sendHealingAlert(actions) {
        try {
            const AlertManager = require('../discord/alert-manager');
            const alertManager = new AlertManager();
            
            const actionSummary = actions.map(action => 
                `${action.action}: ${action.target} - ${action.result ? 'SUCCESS' : 'FAILED'}`
            ).join('\n');
            
            await alertManager.sendAlert(
                'SELF-HEAL',
                'Self-Healing Actions Performed',
                `Autonomous healing actions:\n${actionSummary}`,
                'medium'
            );
        } catch (error) {
            console.error('Failed to send healing alert:', error);
        }
    }
    
    getUptime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
    
    getStatus() {
        return {
            running: true,
            uptime: this.getUptime(),
            last_heartbeat: this.lastHeartbeat,
            failure_counts: Object.fromEntries(this.failureCount)
        };
    }
}

// Start heartbeat monitor if this file is run directly
if (require.main === module) {
    const monitor = new HeartbeatMonitor();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Heartbeat monitor shutting down...');
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Heartbeat monitor terminated');
        process.exit(0);
    });
}

module.exports = HeartbeatMonitor;
EOF

    success "Heartbeat monitor created"
}

# Create Auto-Patch System
setup_autopatch_system() {
    divider "Setting Up Auto-Patch System"
    
    # Create patch manager
    cat > "$NOXHIME_HOME/patches/patch-manager.js" << 'EOF'
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

class PatchManager {
    constructor() {
        this.noxhimeHome = '/home/nulladmin/noxhime';
        // Use a public URL that doesn't require authentication
        this.patchUrl = process.env.PATCH_SERVER_URL || 'https://raw.githubusercontent.com/NullMeDev/noxhime-bot/main';
        this.currentVersion = '3.0.0';
        this.patchHistory = [];
        this.autoApply = process.env.AUTO_APPLY_PATCHES === 'true';
        // Flag to indicate if we should try GitHub API operations
        this.useGitHubAPI = process.env.USE_GITHUB_API === 'true';
        
        this.loadPatchHistory();
    }
    
    async loadPatchHistory() {
        const historyPath = path.join(this.noxhimeHome, 'patches', 'patch-history.json');
        try {
            if (await fs.pathExists(historyPath)) {
                const data = await fs.readFile(historyPath, 'utf8');
                this.patchHistory = JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to load patch history:', error);
            this.patchHistory = [];
        }
    }
    
    async savePatchHistory() {
        const historyPath = path.join(this.noxhimeHome, 'patches', 'patch-history.json');
        try {
            await fs.writeFile(historyPath, JSON.stringify(this.patchHistory, null, 2));
        } catch (error) {
            console.error('Failed to save patch history:', error);
        }
    }
    
    async checkForUpdates() {
        console.log('🔍 Checking for updates...');
        
        try {
            // First try with version.json which doesn't require authentication
            try {
                const response = await axios.get(`${this.patchUrl}/version.json`, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Noxhime-Bot/3.0.0'
                    }
                });
                
                const versionData = response.data;
                if (versionData && versionData.version) {
                    const latestVersion = versionData.version.replace('v', '');
                    
                    if (this.isNewerVersion(latestVersion, this.currentVersion)) {
                        console.log(`📦 New version available: ${latestVersion}`);
                        return {
                            available: true,
                            version: latestVersion,
                            release: {
                                tag_name: `v${latestVersion}`,
                                name: versionData.name || `Version ${latestVersion}`,
                                body: versionData.description || 'New version available'
                            }
                        };
                    } else {
                        console.log('✅ System is up to date');
                        return { available: false };
                    }
                }
            } catch (versionError) {
                console.log('Could not fetch version.json, trying alternate methods...');
            }
            
            // Only try GitHub API if explicitly enabled
            if (this.useGitHubAPI) {
                // This requires a GitHub Personal Access Token for private repos
                // or may have rate limits for public repos
                console.log('Attempting to check GitHub API for updates...');
                const githubApiUrl = 'https://api.github.com/repos/NullMeDev/noxhime-bot/releases/latest';
                
                const response = await axios.get(githubApiUrl, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Noxhime-Bot/3.0.0'
                    }
                });
                
                const latestRelease = response.data;
                const latestVersion = latestRelease.tag_name.replace('v', '');
                
                if (this.isNewerVersion(latestVersion, this.currentVersion)) {
                    console.log(`📦 New version available: ${latestVersion}`);
                    return {
                        available: true,
                        version: latestVersion,
                        release: latestRelease
                    };
                } else {
                    console.log('✅ System is up to date');
                    return { available: false };
                }
            } else {
                console.log('GitHub API checks disabled. Skipping GitHub release check.');
                return { available: false, skipped: true };
            }
            
        } catch (error) {
            console.error('Failed to check for updates:', error);
            return { available: false, error: error.message };
        }
    },
    
    async checkForPatches() {
        console.log('🔍 Checking for patches...');
        
        try {
            // Try direct access to patches/patch-manifest.json first (no auth required)
            try {
                const patchResponse = await axios.get(`${this.patchUrl}/patches/patch-manifest.json`, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Noxhime-Bot/3.0.0'
                    }
                });
                
                let manifest;
                if (typeof patchResponse.data === 'string') {
                    manifest = JSON.parse(patchResponse.data);
                } else {
                    manifest = patchResponse.data;
                }
                
                const availablePatches = manifest.patches.filter(patch => 
                    !this.isPatchApplied(patch.id) && 
                    this.isCompatibleVersion(patch.target_version)
                );
                
                console.log(`📋 Found ${availablePatches.length} available patches`);
                return availablePatches;
            } catch (directError) {
                console.log('Could not fetch patch manifest directly, trying alternate methods...');
            }
            
            // Only try GitHub API if explicitly enabled
            if (this.useGitHubAPI) {
                console.log('Attempting to check GitHub API for patches...');
                const githubApiUrl = 'https://api.github.com/repos/NullMeDev/noxhime-bot/contents/patches/patch-manifest.json';
                
                const patchResponse = await axios.get(githubApiUrl, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Noxhime-Bot/3.0.0'
                    }
                });
                
                const manifestData = Buffer.from(patchResponse.data.content, 'base64').toString('utf8');
                const manifest = JSON.parse(manifestData);
                
                const availablePatches = manifest.patches.filter(patch => 
                    !this.isPatchApplied(patch.id) && 
                    this.isCompatibleVersion(patch.target_version)
                );
                
                console.log(`📋 Found ${availablePatches.length} available patches`);
                return availablePatches;
            } else {
                console.log('GitHub API checks disabled. Skipping GitHub patch check.');
                return [];
            }
            
        } catch (error) {
            console.error('Failed to check for patches:', error);
            return [];
        }
    },
    
    async downloadPatch(patchInfo) {
        console.log(`📥 Downloading patch: ${patchInfo.id}`);
        
        try {
            // Ensure the download URL doesn't require authentication
            let downloadUrl = patchInfo.download_url;
            
            // If it's a GitHub API URL, try to convert it to a raw.githubusercontent.com URL
            if (downloadUrl.includes('api.github.com')) {
                console.log('Converting GitHub API URL to raw content URL...');
                downloadUrl = downloadUrl
                    .replace('https://api.github.com/repos/', 'https://raw.githubusercontent.com/')
                    .replace('/contents/', '/');
            }
            
            console.log(`Downloading from: ${downloadUrl}`);
            const patchResponse = await axios.get(downloadUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Noxhime-Bot/3.0.0'
                }
            });
            
            const patchContent = patchResponse.data;
            
            // Verify patch integrity if checksum provided
            if (patchInfo.checksum) {
                const hash = crypto.createHash('sha256').update(JSON.stringify(patchContent)).digest('hex');
                if (hash !== patchInfo.checksum) {
                    throw new Error('Patch integrity verification failed');
                }
            }
            
            // Save patch to local storage
            const patchPath = path.join(this.noxhimeHome, 'patches', 'downloaded', `${patchInfo.id}.json`);
            await fs.ensureDir(path.dirname(patchPath));
            await fs.writeFile(patchPath, JSON.stringify(patchContent, null, 2));
            
            console.log(`✅ Patch downloaded: ${patchInfo.id}`);
            return { success: true, path: patchPath, content: patchContent };
            
        } catch (error) {
            console.error(`Failed to download patch ${patchInfo.id}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    async applyPatch(patchContent, patchInfo) {
        console.log(`🔧 Applying patch: ${patchInfo.id}`);
        
        try {
            // Create backup before applying patch
            await this.createBackup(patchInfo.id);
            
            // Apply patch operations
            for (const operation of patchContent.operations) {
                await this.executeOperation(operation);
            }
            
            // Record patch application
            const patchRecord = {
                id: patchInfo.id,
                version: patchInfo.version,
                applied_at: new Date().toISOString(),
                description: patchInfo.description,
                operations_count: patchContent.operations.length
            };
            
            this.patchHistory.push(patchRecord);
            await this.savePatchHistory();
            
            console.log(`✅ Patch applied successfully: ${patchInfo.id}`);
            
            // Send notification
            await this.sendPatchNotification(patchInfo, true);
            
            return { success: true };
            
        } catch (error) {
            console.error(`Failed to apply patch ${patchInfo.id}:`, error);
            
            // Attempt rollback
            await this.rollbackPatch(patchInfo.id);
            await this.sendPatchNotification(patchInfo, false, error.message);
            
            return { success: false, error: error.message };
        }
    }
    
    async executeOperation(operation) {
        switch (operation.type) {
            case 'file_update':
                await this.updateFile(operation);
                break;
            case 'file_create':
                await this.createFile(operation);
                break;
            case 'file_delete':
                await this.deleteFile(operation);
                break;
            case 'command_execute':
                await this.executeCommand(operation);
                break;
            case 'service_restart':
                await this.restartService(operation);
                break;
            case 'dependency_install':
                await this.installDependency(operation);
                break;
            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }
    
    async updateFile(operation) {
        const filePath = path.join(this.noxhimeHome, operation.file);
        
        if (operation.backup !== false) {
            const backupPath = `${filePath}.backup.${Date.now()}`;
            if (await fs.pathExists(filePath)) {
                await fs.copy(filePath, backupPath);
            }
        }
        
        if (operation.content) {
            await fs.writeFile(filePath, operation.content);
        } else if (operation.patch) {
            // Apply patch-style updates
            let content = '';
            if (await fs.pathExists(filePath)) {
                content = await fs.readFile(filePath, 'utf8');
            }
            
            for (const change of operation.patch) {
                if (change.search && change.replace) {
                    content = content.replace(new RegExp(change.search, 'g'), change.replace);
                }
            }
            
            await fs.writeFile(filePath, content);
        }
    }
    
    async createFile(operation) {
        const filePath = path.join(this.noxhimeHome, operation.file);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, operation.content);
        
        if (operation.permissions) {
            await this.setFilePermissions(filePath, operation.permissions);
        }
    }
    
    async deleteFile(operation) {
        const filePath = path.join(this.noxhimeHome, operation.file);
        if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
        }
    }
    
    async executeCommand(operation) {
        return new Promise((resolve, reject) => {
            exec(operation.command, { cwd: this.noxhimeHome }, (error, stdout, stderr) => {
                if (error && !operation.ignore_errors) {
                    reject(new Error(`Command failed: ${operation.command}\n${stderr}`));
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }
    
    async restartService(operation) {
        return new Promise((resolve, reject) => {
            exec(`systemctl restart ${operation.service}`, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Failed to restart service ${operation.service}: ${stderr}`));
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }
    
    async installDependency(operation) {
        const command = operation.type === 'npm' 
            ? `npm install ${operation.package}` 
            : `apt-get install -y ${operation.package}`;
            
        return this.executeCommand({ command });
    }
    
    async setFilePermissions(filePath, permissions) {
        return new Promise((resolve, reject) => {
            exec(`chmod ${permissions} "${filePath}"`, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
    
    async createBackup(patchId) {
        const backupDir = path.join(this.noxhimeHome, 'patches', 'backups', patchId);
        await fs.ensureDir(backupDir);
        
        // Backup critical files
        const criticalPaths = [
            'package.json',
            'src/',
            'scripts/',
            'discord/',
            'heartbeat/',
            '.env'
        ];
        
        for (const relativePath of criticalPaths) {
            const sourcePath = path.join(this.noxhimeHome, relativePath);
            const backupPath = path.join(backupDir, relativePath);
            
            if (await fs.pathExists(sourcePath)) {
                await fs.copy(sourcePath, backupPath);
            }
        }
        
        console.log(`📦 Backup created for patch ${patchId}`);
    }
    
    async rollbackPatch(patchId) {
        console.log(`🔄 Rolling back patch: ${patchId}`);
        
        const backupDir = path.join(this.noxhimeHome, 'patches', 'backups', patchId);
        
        if (await fs.pathExists(backupDir)) {
            await fs.copy(backupDir, this.noxhimeHome, { overwrite: true });
            console.log(`✅ Rollback completed for patch ${patchId}`);
        } else {
            console.log(`⚠️ No backup found for patch ${patchId}`);
        }
    }
    
    async sendPatchNotification(patchInfo, success, error = null) {
        try {
            const AlertManager = require('../discord/alert-manager');
            const alertManager = new AlertManager();
            
            const title = success ? 'Patch Applied Successfully' : 'Patch Application Failed';
            const description = success 
                ? `Patch ${patchInfo.id} applied successfully\n${patchInfo.description}`
                : `Failed to apply patch ${patchInfo.id}\nError: ${error}`;
            
            await alertManager.sendAlert(
                'PATCH',
                title,
                description,
                success ? 'medium' : 'high'
            );
        } catch (alertError) {
            console.error('Failed to send patch notification:', alertError);
        }
    }
    
    isPatchApplied(patchId) {
        return this.patchHistory.some(patch => patch.id === patchId);
    }
    
    isCompatibleVersion(targetVersion) {
        // Simple version compatibility check
        return targetVersion === this.currentVersion || targetVersion === 'any';
    }
    
    isNewerVersion(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;
            
            if (v1Part > v2Part) return true;
            if (v1Part < v2Part) return false;
        }
        
        return false;
    }
    
    async performAutoUpdate() {
        console.log('🔄 Starting auto-update process...');
        
        // Check for patches first
        const patches = await this.checkForPatches();
        
        for (const patchInfo of patches) {
            if (patchInfo.auto_apply !== false) {
                const download = await this.downloadPatch(patchInfo);
                if (download.success) {
                    await this.applyPatch(download.content, patchInfo);
                }
            }
        }
        
        // Check for version updates
        const updateCheck = await this.checkForUpdates();
        if (updateCheck.available && this.autoApply) {
            console.log('🚀 Auto-update available but requires manual approval for version updates');
            await this.sendUpdateNotification(updateCheck);
        }
    }
    
    async sendUpdateNotification(updateInfo) {
        try {
            const AlertManager = require('../discord/alert-manager');
            const alertManager = new AlertManager();
            
            await alertManager.sendAlert(
                'UPDATE',
                'System Update Available',
                `New version ${updateInfo.version} is available\nCurrent: ${this.currentVersion}\nPlease review and approve the update.`,
                'medium'
            );
        } catch (error) {
            console.error('Failed to send update notification:', error);
        }
    }
}

module.exports = PatchManager;
EOF

    success "Patch manager created"
    
    # Create patch scheduler
    cat > "$NOXHIME_HOME/patches/patch-scheduler.js" << 'EOF'
const cron = require('node-cron');
const PatchManager = require('./patch-manager');

class PatchScheduler {
    constructor() {
        this.patchManager = new PatchManager();
        this.initializeSchedules();
    }
    
    initializeSchedules() {
        console.log('📅 Initializing patch scheduler...');
        
        // Check for patches every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            console.log('🔍 Scheduled patch check starting...');
            await this.patchManager.performAutoUpdate();
        });
        
        // Check for critical updates every hour
        cron.schedule('0 * * * *', async () => {
            const patches = await this.patchManager.checkForPatches();
            const criticalPatches = patches.filter(patch => patch.priority === 'critical');
            
            if (criticalPatches.length > 0) {
                console.log(`🚨 ${criticalPatches.length} critical patches found`);
                for (const patch of criticalPatches) {
                    const download = await this.patchManager.downloadPatch(patch);
                    if (download.success) {
                        await this.patchManager.applyPatch(download.content, patch);
                    }
                }
            }
        });
        
        console.log('✅ Patch scheduler initialized');
    }
}

// Start scheduler if this file is run directly
if (require.main === module) {
    new PatchScheduler();
    
    // Keep the process running
    process.on('SIGINT', () => {
        console.log('\n🛑 Patch scheduler shutting down...');
        process.exit(0);
    });
}

module.exports = PatchScheduler;
EOF

    success "Patch scheduler created"
}

# Create System Recovery Tools
setup_recovery_tools() {
    divider "Setting Up System Recovery Tools"
    
    # Create recovery manager
    cat > "$NOXHIME_HOME/patches/recovery-manager.js" << 'EOF'
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

class RecoveryManager {
    constructor() {
        this.noxhimeHome = '/home/nulladmin/noxhime';
        this.recoveryPoints = [];
        this.loadRecoveryPoints();
    }
    
    async loadRecoveryPoints() {
        const recoveryPath = path.join(this.noxhimeHome, 'patches', 'recovery-points.json');
        try {
            if (await fs.pathExists(recoveryPath)) {
                const data = await fs.readFile(recoveryPath, 'utf8');
                this.recoveryPoints = JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to load recovery points:', error);
            this.recoveryPoints = [];
        }
    }
    
    async saveRecoveryPoints() {
        const recoveryPath = path.join(this.noxhimeHome, 'patches', 'recovery-points.json');
        try {
            await fs.writeFile(recoveryPath, JSON.stringify(this.recoveryPoints, null, 2));
        } catch (error) {
            console.error('Failed to save recovery points:', error);
        }
    }
    
    async createRecoveryPoint(description) {
        const timestamp = new Date().toISOString();
        const pointId = `recovery-${Date.now()}`;
        
        console.log(`📸 Creating recovery point: ${pointId}`);
        
        const recoveryDir = path.join(this.noxhimeHome, 'patches', 'recovery', pointId);
        await fs.ensureDir(recoveryDir);
        
        // Backup critical system state
        const backupTasks = [
            this.backupConfiguration(recoveryDir),
            this.backupDatabases(recoveryDir),
            this.backupServices(recoveryDir),
            this.captureSystemState(recoveryDir)
        ];
        
        try {
            await Promise.all(backupTasks);
            
            const recoveryPoint = {
                id: pointId,
                description,
                timestamp,
                path: recoveryDir,
                size: await this.calculateDirectorySize(recoveryDir)
            };
            
            this.recoveryPoints.push(recoveryPoint);
            await this.saveRecoveryPoints();
            
            // Cleanup old recovery points (keep last 10)
            await this.cleanupOldRecoveryPoints();
            
            console.log(`✅ Recovery point created: ${pointId}`);
            return recoveryPoint;
            
        } catch (error) {
            console.error(`Failed to create recovery point: ${error}`);
            throw error;
        }
    }
    
    async backupConfiguration(recoveryDir) {
        const configDir = path.join(recoveryDir, 'config');
        await fs.ensureDir(configDir);
        
        const configFiles = [
            '.env',
            'package.json',
            'discord/command-whitelist.json',
            'heartbeat/config.json'
        ];
        
        for (const file of configFiles) {
            const sourcePath = path.join(this.noxhimeHome, file);
            const destPath = path.join(configDir, file);
            
            if (await fs.pathExists(sourcePath)) {
                await fs.ensureDir(path.dirname(destPath));
                await fs.copy(sourcePath, destPath);
            }
        }
    }
    
    async backupDatabases(recoveryDir) {
        const dbDir = path.join(recoveryDir, 'databases');
        await fs.ensureDir(dbDir);
        
        // Backup SQLite databases
        const dbFiles = await this.findFiles(this.noxhimeHome, '*.db');
        for (const dbFile of dbFiles) {
            const fileName = path.basename(dbFile);
            await fs.copy(dbFile, path.join(dbDir, fileName));
        }
    }
    
    async backupServices(recoveryDir) {
        const servicesDir = path.join(recoveryDir, 'services');
        await fs.ensureDir(servicesDir);
        
        // Export service states
        return new Promise((resolve) => {
            exec('systemctl list-units --type=service --state=active', (error, stdout) => {
                const serviceList = stdout || '';
                fs.writeFile(path.join(servicesDir, 'active-services.txt'), serviceList)
                    .then(resolve)
                    .catch(resolve);
            });
        });
    }
    
    async captureSystemState(recoveryDir) {
        const stateDir = path.join(recoveryDir, 'system-state');
        await fs.ensureDir(stateDir);
        
        const commands = [
            { name: 'processes.txt', cmd: 'ps aux' },
            { name: 'network.txt', cmd: 'netstat -tulpn' },
            { name: 'disk-usage.txt', cmd: 'df -h' },
            { name: 'memory.txt', cmd: 'free -h' },
            { name: 'firewall.txt', cmd: 'ufw status verbose' },
            { name: 'fail2ban.txt', cmd: 'fail2ban-client status' }
        ];
        
        const promises = commands.map(({ name, cmd }) => {
            return new Promise((resolve) => {
                exec(cmd, (error, stdout) => {
                    const output = stdout || error?.message || '';
                    fs.writeFile(path.join(stateDir, name), output)
                        .then(resolve)
                        .catch(resolve);
                });
            });
        });
        
        await Promise.all(promises);
    }
    
    async restoreFromPoint(pointId) {
        console.log(`🔄 Restoring from recovery point: ${pointId}`);
        
        const recoveryPoint = this.recoveryPoints.find(point => point.id === pointId);
        if (!recoveryPoint) {
            throw new Error(`Recovery point ${pointId} not found`);
        }
        
        const recoveryDir = recoveryPoint.path;
        if (!await fs.pathExists(recoveryDir)) {
            throw new Error(`Recovery point directory ${recoveryDir} not found`);
        }
        
        try {
            // Create current state backup before restore
            await this.createRecoveryPoint(`Pre-restore backup before ${pointId}`);
            
            // Restore configuration files
            const configDir = path.join(recoveryDir, 'config');
            if (await fs.pathExists(configDir)) {
                await fs.copy(configDir, this.noxhimeHome, { overwrite: true });
            }
            
            // Restore databases
            const dbDir = path.join(recoveryDir, 'databases');
            if (await fs.pathExists(dbDir)) {
                const dbFiles = await fs.readdir(dbDir);
                for (const dbFile of dbFiles) {
                    const sourcePath = path.join(dbDir, dbFile);
                    const destPath = path.join(this.noxhimeHome, dbFile);
                    await fs.copy(sourcePath, destPath, { overwrite: true });
                }
            }
            
            console.log(`✅ System restored from recovery point: ${pointId}`);
            
            // Send notification
            await this.sendRecoveryNotification(pointId, true);
            
            return { success: true };
            
        } catch (error) {
            console.error(`Failed to restore from recovery point: ${error}`);
            await this.sendRecoveryNotification(pointId, false, error.message);
            throw error;
        }
    }
    
    async findFiles(directory, pattern) {
        return new Promise((resolve) => {
            exec(`find "${directory}" -name "${pattern}" -type f`, (error, stdout) => {
                const files = stdout ? stdout.trim().split('\n').filter(f => f) : [];
                resolve(files);
            });
        });
    }
    
    async calculateDirectorySize(directory) {
        return new Promise((resolve) => {
            exec(`du -sh "${directory}"`, (error, stdout) => {
                const size = stdout ? stdout.split('\t')[0] : '0';
                resolve(size);
            });
        });
    }
    
    async cleanupOldRecoveryPoints() {
        // Keep only the last 10 recovery points
        if (this.recoveryPoints.length > 10) {
            const pointsToRemove = this.recoveryPoints
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .slice(0, this.recoveryPoints.length - 10);
            
            for (const point of pointsToRemove) {
                try {
                    await fs.remove(point.path);
                    console.log(`🗑️ Cleaned up old recovery point: ${point.id}`);
                } catch (error) {
                    console.error(`Failed to cleanup recovery point ${point.id}:`, error);
                }
            }
            
            // Update recovery points list
            this.recoveryPoints = this.recoveryPoints
                .filter(point => !pointsToRemove.includes(point));
            await this.saveRecoveryPoints();
        }
    }
    
    async sendRecoveryNotification(pointId, success, error = null) {
        try {
            const AlertManager = require('../discord/alert-manager');
            const alertManager = new AlertManager();
            
            const title = success ? 'System Recovery Completed' : 'System Recovery Failed';
            const description = success 
                ? `System successfully restored from recovery point: ${pointId}`
                : `Failed to restore from recovery point: ${pointId}\nError: ${error}`;
            
            await alertManager.sendAlert(
                'RECOVERY',
                title,
                description,
                success ? 'medium' : 'critical'
            );
        } catch (alertError) {
            console.error('Failed to send recovery notification:', alertError);
        }
    }
    
    getRecoveryPoints() {
        return this.recoveryPoints;
    }
}

module.exports = RecoveryManager;
EOF

    success "Recovery manager created"
}

# Create Integration Service
setup_integration_service() {
    divider "Setting Up Integration Service"
    
    # Create main integration service
    cat > "$NOXHIME_HOME/heartbeat/integration-service.js" << 'EOF'
const HeartbeatMonitor = require('./heartbeat-monitor');
const PatchScheduler = require('../patches/patch-scheduler');
const RecoveryManager = require('../patches/recovery-manager');

class IntegrationService {
    constructor() {
        this.heartbeatMonitor = new HeartbeatMonitor();
        this.patchScheduler = new PatchScheduler();
        this.recoveryManager = new RecoveryManager();
        
        this.initializeIntegration();
    }
    
    initializeIntegration() {
        console.log('🔗 Starting Noxhime Integration Service...');
        
        // Create initial recovery point
        this.createInitialRecoveryPoint();
        
        // Setup graceful shutdown
        process.on('SIGINT', () => this.gracefulShutdown());
        process.on('SIGTERM', () => this.gracefulShutdown());
        
        console.log('✅ Integration service initialized');
    }
    
    async createInitialRecoveryPoint() {
        try {
            await this.recoveryManager.createRecoveryPoint('System startup recovery point');
            console.log('📸 Initial recovery point created');
        } catch (error) {
            console.error('Failed to create initial recovery point:', error);
        }
    }
    
    async gracefulShutdown() {
        console.log('\n🛑 Integration service shutting down...');
        
        try {
            // Create shutdown recovery point
            await this.recoveryManager.createRecoveryPoint('Pre-shutdown recovery point');
            console.log('📸 Shutdown recovery point created');
        } catch (error) {
            console.error('Failed to create shutdown recovery point:', error);
        }
        
        process.exit(0);
    }
    
    getStatus() {
        return {
            heartbeat: this.heartbeatMonitor.getStatus(),
            recovery_points: this.recoveryManager.getRecoveryPoints().length,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }
}

// Start integration service if this file is run directly
if (require.main === module) {
    new IntegrationService();
}

module.exports = IntegrationService;
EOF

    success "Integration service created"
    
    # Create PM2 ecosystem for heartbeat system
    cat > "$NOXHIME_HOME/heartbeat/ecosystem.config.js" << 'EOF'
module.exports = {
    apps: [{
        name: 'noxhime-heartbeat',
        script: 'integration-service.js',
        cwd: '/home/nulladmin/noxhime/heartbeat',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        max_memory_restart: '200M',
        env: {
            NODE_ENV: 'production'
        },
        error_file: '/home/nulladmin/noxhime/logs/heartbeat-error.log',
        out_file: '/home/nulladmin/noxhime/logs/heartbeat-out.log',
        log_file: '/home/nulladmin/noxhime/logs/heartbeat-combined.log',
        time: true,
        restart_delay: 5000,
        max_restarts: 5,
        min_uptime: '30s'
    }]
};
EOF

    success "Heartbeat PM2 ecosystem created"
}

# Main execution
main() {
    # Check if previous phases are complete
    if [[ ! -d "$NOXHIME_HOME" ]]; then
        error "Noxhime home directory not found. Run Phase 1 first."
    fi
    
    if [[ ! -f "$NOXHIME_HOME/discord/bot-manager.js" ]]; then
        warn "Phase 3 Discord setup not detected. Consider running Phase 3 first."
    fi
    
    # Create directories
    mkdir -p "$NOXHIME_HOME/heartbeat"
    mkdir -p "$NOXHIME_HOME/patches/downloaded"
    mkdir -p "$NOXHIME_HOME/patches/backups"
    mkdir -p "$NOXHIME_HOME/patches/recovery"
    
    # Setup components
    setup_heartbeat_system
    setup_autopatch_system
    setup_recovery_tools
    setup_integration_service
    
    # Set permissions
    chown -R "$USER:$USER" "$NOXHIME_HOME/heartbeat" "$NOXHIME_HOME/patches"
    chmod +x "$NOXHIME_HOME/heartbeat/heartbeat-monitor.js"
    chmod +x "$NOXHIME_HOME/heartbeat/integration-service.js"
    chmod +x "$NOXHIME_HOME/patches/patch-manager.js"
    
    divider "Phase 4 Complete"
    
    echo -e "${GREEN}Phase 4: Heartbeat & Auto-Patch System Setup Complete!${NC}"
    echo
    echo -e "${YELLOW}Key Features:${NC}"
    echo "• 🫀 30-second heartbeat monitoring"
    echo "• 🔧 Automatic self-healing capabilities"
    echo "• 📦 Auto-patch system (no GitHub authentication required)"
    echo "• 📸 System recovery points"
    echo "• 🚨 Health alerts and notifications"
    echo
    echo -e "${BLUE}Starting Services:${NC}"
    echo "pm2 start $NOXHIME_HOME/heartbeat/ecosystem.config.js"
    echo
    echo "${YELLOW}Environment Variables Needed:${NC}"
    echo "PATCH_SERVER_URL - URL for patch manifest (optional)"
    echo "AUTO_APPLY_PATCHES - Enable automatic patch application (true/false)"
    echo "USE_GITHUB_API - Enable GitHub API checks (true/false, defaults to false)"
    echo
    echo -e "${PURPLE}Proceed to Phase 5 when ready.${NC}"
}

# Check if running as nulladmin user
if [[ "$USER" != "nulladmin" && "$USER" != "root" ]]; then
    error "Please run as nulladmin user or root"
fi

main "$@"
