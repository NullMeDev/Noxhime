import { TextChannel, EmbedBuilder, Client } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

// Use require instead of import for db to avoid circular dependencies
const db = require('./db');
const { logEvent, logSentinelIncident, trackSuspiciousIP } = db;

const execAsync = util.promisify(exec);

/**
 * Interface for log pattern to monitor
 */
interface LogPattern {
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action?: () => Promise<void>;
}

/**
 * Interface for Service Status
 */
interface ServiceStatus {
  name: string;
  isRunning: boolean;
  uptime?: string;
  memory?: string;
  cpu?: string;
  restarts?: number;
}

/**
 * Interface for System Statistics
 */
interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: string;
}

/**
 * Class for Sentinel Intelligence monitoring
 */
export class SentinelIntelligence {
  private client: Client;
  private notifyChannelId: string;
  private logPatterns: LogPattern[];
  private lastCheckTime: number = Date.now();
  private suspiciousIPs: Map<string, number> = new Map();
  private watchInterval: NodeJS.Timeout | null = null;
  private logFiles: { [key: string]: string } = {
    auth: '/var/log/auth.log',
    system: '/var/log/syslog',
    fail2ban: '/var/log/fail2ban.log',
    nginx: '/var/log/nginx/error.log',
  };
  
  constructor(client: Client, notifyChannelId: string) {
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
        auth: path.join(process.cwd(), 'data', 'mock', 'auth.log'),
        system: path.join(process.cwd(), 'data', 'mock', 'syslog'),
        fail2ban: path.join(process.cwd(), 'data', 'mock', 'fail2ban.log'),
        nginx: path.join(process.cwd(), 'data', 'mock', 'nginx-error.log'),
      };
      
      // Create mock directory if it doesn't exist
      const mockDir = path.join(process.cwd(), 'data', 'mock');
      if (!fs.existsSync(mockDir)) {
        fs.mkdirSync(mockDir, { recursive: true });
      }
      
      // Create empty mock files if they don't exist
      Object.values(this.logFiles).forEach(filePath => {
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, '');
        }
      });
    }
  }
  
  /**
   * Start the sentinel monitoring system
   */
  public start(checkIntervalMs: number = 60000): void {
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
  public stop(): void {
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
  private async checkLogs(): Promise<void> {
    try {
      const now = Date.now();
      const incidents: { severity: string; description: string; details: string }[] = [];
      
      // Check each log file we're monitoring
      for (const [logType, logPath] of Object.entries(this.logFiles)) {
        if (fs.existsSync(logPath)) {
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
                await logEvent('SENTINEL_ALERT', 
                  `${pattern.description}: ${matches.length} matches in ${logType}`);
              }
            }
          } catch (error) {
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
    } catch (error) {
      console.error('Error in Sentinel log check:', error);
    }
  }
  
  /**
   * Track suspicious IPs for potential attack patterns
   */
  private trackSuspiciousIPs(ips: string[]): void {
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
  private async reportIncidents(incidents: { severity: string; description: string; details: string }[]): Promise<void> {
    try {
      if (!this.client.isReady() || !this.notifyChannelId) return;
      
      const channel = await this.client.channels.fetch(this.notifyChannelId);
      if (!channel?.isTextBased()) return;
      
      // Group incidents by severity
      const criticalIncidents = incidents.filter(i => i.severity === 'critical');
      const highIncidents = incidents.filter(i => i.severity === 'high');
      const mediumIncidents = incidents.filter(i => i.severity === 'medium');
      const lowIncidents = incidents.filter(i => i.severity === 'low');
      
      // Create embeds for different severity levels
      if (criticalIncidents.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle('🚨 CRITICAL SECURITY ALERT')
          .setDescription('Critical security issues detected that require immediate attention')
          .setColor(0xFF0000)
          .setTimestamp();
        
        criticalIncidents.forEach(incident => {
          embed.addFields({ name: incident.description, value: incident.details });
        });
        
        await (channel as TextChannel).send({ embeds: [embed] });
      }
      
      if (highIncidents.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle('⚠️ High Severity Alert')
          .setDescription('High severity security issues detected')
          .setColor(0xFF9900)
          .setTimestamp();
        
        highIncidents.forEach(incident => {
          embed.addFields({ name: incident.description, value: incident.details });
        });
        
        await (channel as TextChannel).send({ embeds: [embed] });
      }
      
      if (mediumIncidents.length > 0 || lowIncidents.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle('ℹ️ Security Notification')
          .setDescription('Security events have been detected')
          .setColor(0x3498DB)
          .setTimestamp();
        
        [...mediumIncidents, ...lowIncidents].forEach(incident => {
          embed.addFields({ name: incident.description, value: incident.details });
        });
        
        await (channel as TextChannel).send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error reporting sentinel incidents:', error);
    }
  }
  
  /**
   * Get system uptime in a human-readable format
   */
  public async getSystemUptime(): Promise<string> {
    try {
      const { stdout } = await execAsync('uptime -p');
      return stdout.trim();
    } catch (error) {
      console.error('Error getting system uptime:', error);
      return 'Unknown';
    }
  }
  
  /**
   * Get service status for multiple services
   */
  public async getServicesStatus(): Promise<ServiceStatus[]> {
    const services = ['nginx', 'fail2ban', 'monit', 'ssh'];
    const result: ServiceStatus[] = [];
    
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
          } catch (error) {
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
      } catch (error) {
        result.push({
          name: service,
          isRunning: false
        });
      }
    }
    
    return result;
  }
  
  /**
   * Get system statistics including CPU, memory, disk usage and uptime
   */
  public async getSystemStats(): Promise<SystemStats> {
    try {
      // Get CPU usage
      const { stdout: cpuOut } = await execAsync("top -b -n1 | grep 'Cpu(s)' | awk '{print $2 + $4}'");
      const cpuUsage = parseFloat(cpuOut.trim());
      
      // Get memory usage
      const { stdout: memOut } = await execAsync("free | grep Mem | awk '{print $3/$2 * 100.0}'");
      const memoryUsage = parseFloat(memOut.trim());
      
      // Get disk usage
      const { stdout: diskOut } = await execAsync("df -h / | grep / | awk '{print $5}' | sed 's/%//'");
      const diskUsage = parseFloat(diskOut.trim());
      
      // Get uptime
      const uptime = await this.getSystemUptime();
      
      return {
        cpuUsage,
        memoryUsage,
        diskUsage,
        uptime
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      // Return fallback values if we can't get actual stats
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        uptime: 'Unknown'
      };
    }
  }
  
  /**
   * Setup rclone sync for system backups and audit logs
   */
  public async setupRclone(
    remoteDestination: string,
    backupPaths: string[] = ['./data/noxhime.db', './logs'],
    scheduleExpression: string = '0 0 * * *' // Daily at midnight
  ): Promise<void> {
    try {
      // Check if rclone is installed
      await execAsync('which rclone').catch(() => {
        throw new Error('rclone is not installed. Please install rclone first.');
      });
      
      // Create backup directory if it doesn't exist
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Create a backup script
      const scriptPath = path.join(process.cwd(), 'scripts', 'backup.sh');
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
      fs.writeFileSync(scriptPath, scriptContent);
      fs.chmodSync(scriptPath, '755'); // Make executable
      
      // Set up cron job
      const cronCommand = `(crontab -l 2>/dev/null || echo "") | grep -v "${scriptPath}" | { cat; echo "${scheduleExpression} ${scriptPath}"; } | crontab -`;
      await execAsync(cronCommand);
      
      console.log('Rclone backup setup completed');
      await logEvent('SENTINEL', 'Rclone backup system configured');
      
      return;
    } catch (error) {
      console.error('Error setting up rclone sync:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logEvent('ERROR', `Failed to setup rclone sync: ${errorMessage}`);
      throw error;
    }
  }
}

// Export singleton instance
let sentinelInstance: SentinelIntelligence | null = null;

export function getSentinel(client: Client, notifyChannelId: string): SentinelIntelligence {
  if (!sentinelInstance) {
    sentinelInstance = new SentinelIntelligence(client, notifyChannelId);
  }
  return sentinelInstance;
}
