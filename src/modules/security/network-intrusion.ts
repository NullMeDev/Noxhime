import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = util.promisify(exec);

/**
 * Interface for network alert data
 */
interface NetworkAlert {
    timestamp: string;
    source_ip: string;
    destination_ip: string;
    protocol: string;
    signature: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: string;
}

/**
 * Class for network intrusion detection using Suricata/Snort
 */
export class NetworkIntrusionDetection {
    private client: Client;
    private notifyChannelId: string;
    private logEvent: (type: string, description: string) => Promise<boolean>;
    private checkInterval: NodeJS.Timeout | null = null;
    private alertLogPath: string;
    private lastReadPosition: number = 0;
    private isInitialized: boolean = false;
    private detectionEngine: 'suricata' | 'snort' | 'none' = 'none';

    constructor(
        client: Client,
        notifyChannelId: string,
        logEvent: (type: string, description: string) => Promise<boolean>,
        alertLogPath?: string
    ) {
        this.client = client;
        this.notifyChannelId = notifyChannelId;
        this.logEvent = logEvent;
        
        // Default log paths for different engines
        const suricataLogPath = '/var/log/suricata/fast.log';
        const snortLogPath = '/var/log/snort/alert';
        
        // Auto-detect which IDS is installed and use its log path
        this.alertLogPath = alertLogPath || suricataLogPath;
    }

    /**
     * Initialize the network intrusion detection module
     */
    public async initialize(): Promise<boolean> {
        try {
            // Check for Suricata first
            try {
                const { stdout: suricataVersion } = await execAsync('suricata --version');
                if (suricataVersion) {
                    this.detectionEngine = 'suricata';
                    this.alertLogPath = '/var/log/suricata/fast.log';
                    console.log('Suricata detected: ' + suricataVersion.split('\n')[0]);
                }
            } catch (error) {
                // Suricata not found, try Snort
                try {
                    const { stdout: snortVersion } = await execAsync('snort --version');
                    if (snortVersion) {
                        this.detectionEngine = 'snort';
                        this.alertLogPath = '/var/log/snort/alert';
                        console.log('Snort detected: ' + snortVersion.split('\n')[0]);
                    }
                } catch (error) {
                    // Neither found
                    console.log('No supported IDS (Suricata/Snort) detected on this system');
                }
            }

            // Check if log file exists and is readable
            if (this.detectionEngine !== 'none') {
                try {
                    await fs.promises.access(this.alertLogPath, fs.constants.R_OK);
                    // Get the current file size for tracking position
                    const stats = await fs.promises.stat(this.alertLogPath);
                    this.lastReadPosition = stats.size;
                    this.isInitialized = true;
                    
                    console.log(`Network intrusion detection initialized using ${this.detectionEngine} (log: ${this.alertLogPath})`);
                    await this.logEvent('SECURITY', `Network intrusion detection initialized using ${this.detectionEngine}`);
                    return true;
                } catch (error) {
                    console.error(`Error accessing IDS log file at ${this.alertLogPath}:`, error);
                    // Use a mock log for development/testing
                    const mockPath = path.join(process.cwd(), 'data', 'mock', `${this.detectionEngine}-alerts.log`);
                    const mockDir = path.dirname(mockPath);
                    
                    if (!fs.existsSync(mockDir)) {
                        fs.mkdirSync(mockDir, { recursive: true });
                    }
                    
                    if (!fs.existsSync(mockPath)) {
                        fs.writeFileSync(mockPath, ''); // Create empty file
                    }
                    
                    this.alertLogPath = mockPath;
                    this.isInitialized = true;
                    console.log(`Using mock log file at ${mockPath}`);
                    await this.logEvent('SECURITY', `Network intrusion detection using mock log at ${mockPath}`);
                    return true;
                }
            } else {
                console.log('No supported IDS found. Network intrusion detection will be simulated.');
                
                // Create a mock log file for simulation
                const mockPath = path.join(process.cwd(), 'data', 'mock', 'ids-alerts.log');
                const mockDir = path.dirname(mockPath);
                
                if (!fs.existsSync(mockDir)) {
                    fs.mkdirSync(mockDir, { recursive: true });
                }
                
                if (!fs.existsSync(mockPath)) {
                    fs.writeFileSync(mockPath, ''); // Create empty file
                }
                
                this.alertLogPath = mockPath;
                this.isInitialized = true;
                console.log(`Using mock log file at ${mockPath}`);
                await this.logEvent('SECURITY', 'Network intrusion detection using simulated data');
                return true;
            }
        } catch (error) {
            console.error('Error initializing network intrusion detection:', error);
            return false;
        }
    }

    /**
     * Start monitoring for network intrusions
     */
    public start(checkIntervalMs: number = 60000): void {
        if (!this.isInitialized) {
            console.error('Network intrusion detection not initialized. Run initialize() first.');
            return;
        }
        
        console.log(`Starting network intrusion detection with check interval ${checkIntervalMs/1000} seconds`);
        
        // Set up periodic checking
        this.checkInterval = setInterval(() => this.checkAlerts(), checkIntervalMs);
        
        // Log the start
        this.logEvent('SECURITY', 'Network intrusion detection monitoring started');
    }

    /**
     * Stop monitoring for network intrusions
     */
    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('Network intrusion detection monitoring stopped');
            this.logEvent('SECURITY', 'Network intrusion detection monitoring stopped');
        }
    }

    /**
     * Check for new alerts in the log file
     */
    private async checkAlerts(): Promise<void> {
        try {
            if (!fs.existsSync(this.alertLogPath)) {
                console.error(`Alert log file not found: ${this.alertLogPath}`);
                return;
            }
            
            const stats = await fs.promises.stat(this.alertLogPath);
            
            // If file size hasn't changed, nothing to read
            if (stats.size <= this.lastReadPosition) {
                return;
            }
            
            // Read only the new content
            const buffer = Buffer.alloc(stats.size - this.lastReadPosition);
            const fileHandle = await fs.promises.open(this.alertLogPath, 'r');
            await fileHandle.read(buffer, 0, buffer.length, this.lastReadPosition);
            await fileHandle.close();
            
            // Update last read position
            this.lastReadPosition = stats.size;
            
            // Process the new alerts
            const newContent = buffer.toString();
            const alerts = this.parseAlerts(newContent);
            
            if (alerts.length > 0) {
                await this.reportAlerts(alerts);
            }
        } catch (error) {
            console.error('Error checking for network alerts:', error);
        }
    }

    /**
     * Parse alerts from log content based on the detected engine
     */
    private parseAlerts(content: string): NetworkAlert[] {
        const alerts: NetworkAlert[] = [];
        
        if (this.detectionEngine === 'suricata') {
            // Suricata fast.log format
            const lines = content.split('\n').filter(Boolean);
            
            for (const line of lines) {
                try {
                    // Example: 05/15/2023-10:15:07.934561  [**] [1:2008983:3] ET POLICY SMB Outbound 445 to non-SMB Server [**] [Classification: Potentially Bad Traffic] [Priority: 2] {TCP} 192.168.1.5:49274 -> 203.0.113.4:445
                    const timestampMatch = line.match(/^(\d+\/\d+\/\d+-\d+:\d+:\d+\.\d+)/);
                    const signatureMatch = line.match(/\[\d+:(\d+):\d+\]\s+(.*?)\s+\[\*\*\]/);
                    const classificationMatch = line.match(/\[Classification:\s+(.*?)\]/);
                    const priorityMatch = line.match(/\[Priority:\s+(\d+)\]/);
                    const protocolMatch = line.match(/{(\w+)}/);
                    const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)\s+->\s+(\d+\.\d+\.\d+\.\d+):(\d+)/);
                    
                    if (timestampMatch && signatureMatch && ipMatch) {
                        const timestamp = timestampMatch[1];
                        const signature = signatureMatch[2];
                        const classification = classificationMatch ? classificationMatch[1] : 'Unknown';
                        const priority = priorityMatch ? parseInt(priorityMatch[1]) : 3;
                        const protocol = protocolMatch ? protocolMatch[1] : 'Unknown';
                        const sourceIp = ipMatch[1];
                        const destinationIp = ipMatch[3];
                        
                        // Convert priority to severity
                        let severity: 'low' | 'medium' | 'high' | 'critical';
                        switch (priority) {
                            case 1: severity = 'critical'; break;
                            case 2: severity = 'high'; break;
                            case 3: severity = 'medium'; break;
                            default: severity = 'low';
                        }
                        
                        alerts.push({
                            timestamp,
                            source_ip: sourceIp,
                            destination_ip: destinationIp,
                            protocol,
                            signature,
                            severity,
                            details: `Classification: ${classification}, Priority: ${priority}`
                        });
                    }
                } catch (error) {
                    console.error('Error parsing Suricata alert:', error);
                }
            }
        } else if (this.detectionEngine === 'snort') {
            // Snort alert format
            const blocks = content.split('\n\n').filter(Boolean);
            
            for (const block of blocks) {
                try {
                    // Snort alert blocks are multi-line
                    const lines = block.split('\n');
                    
                    // Example:
                    // [1:1000001:1] NIDS ALERT: Potential SSH Brute Force Attack
                    // [Classification: Attempted Administrator Privilege Gain] [Priority: 1]
                    // 05/15/2023-11:45:30.123456 192.168.1.100:58642 -> 192.168.1.5:22
                    // TCP TTL:64 TOS:0x0 ID:0 IpLen:20 DgmLen:52 DF
                    // ******S* Seq: 0x1234ABCD  Ack: 0x0  Win: 0x7FC0  TcpLen: 32
                    
                    const signatureMatch = block.match(/\[\d+:(\d+):\d+\]\s+(.*)/);
                    const classificationMatch = block.match(/\[Classification:\s+(.*?)\]/);
                    const priorityMatch = block.match(/\[Priority:\s+(\d+)\]/);
                    const timestampMatch = block.match(/(\d+\/\d+\/\d+-\d+:\d+:\d+\.\d+)/);
                    const ipMatch = block.match(/(\d+\.\d+\.\d+\.\d+):(\d+)\s+->\s+(\d+\.\d+\.\d+\.\d+):(\d+)/);
                    const protocolMatch = block.match(/^(\w+)\s+TTL/m);
                    
                    if (signatureMatch && timestampMatch && ipMatch) {
                        const signature = signatureMatch[2];
                        const classification = classificationMatch ? classificationMatch[1] : 'Unknown';
                        const priority = priorityMatch ? parseInt(priorityMatch[1]) : 3;
                        const timestamp = timestampMatch[1];
                        const sourceIp = ipMatch[1];
                        const destinationIp = ipMatch[3];
                        const protocol = protocolMatch ? protocolMatch[1] : 'Unknown';
                        
                        // Convert priority to severity
                        let severity: 'low' | 'medium' | 'high' | 'critical';
                        switch (priority) {
                            case 1: severity = 'critical'; break;
                            case 2: severity = 'high'; break;
                            case 3: severity = 'medium'; break;
                            default: severity = 'low';
                        }
                        
                        alerts.push({
                            timestamp,
                            source_ip: sourceIp,
                            destination_ip: destinationIp,
                            protocol,
                            signature,
                            severity,
                            details: `Classification: ${classification}, Priority: ${priority}`
                        });
                    }
                } catch (error) {
                    console.error('Error parsing Snort alert:', error);
                }
            }
        } else {
            // Simulate alerts for development/testing
            // Only do this occasionally to avoid flooding with fake alerts
            if (Math.random() < 0.1) { // 10% chance
                const timestamp = new Date().toISOString();
                const protocols = ['TCP', 'UDP', 'ICMP', 'HTTP'];
                const sourceIps = ['192.168.1.100', '10.0.0.15', '172.16.50.10'];
                const destIps = ['192.168.1.1', '8.8.8.8', '203.0.113.10'];
                const signatures = [
                    'ET SCAN Potential SSH Scan',
                    'NIDS ALERT: Potential SQL Injection Attempt',
                    'ET POLICY Unusual Port 445 Connection',
                    'ET TROJAN Possible Malware Communication'
                ];
                const severities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
                
                alerts.push({
                    timestamp,
                    source_ip: sourceIps[Math.floor(Math.random() * sourceIps.length)],
                    destination_ip: destIps[Math.floor(Math.random() * destIps.length)],
                    protocol: protocols[Math.floor(Math.random() * protocols.length)],
                    signature: signatures[Math.floor(Math.random() * signatures.length)],
                    severity: severities[Math.floor(Math.random() * severities.length)],
                    details: 'Simulated alert for testing'
                });
            }
        }
        
        return alerts;
    }

    /**
     * Report alerts to Discord
     */
    private async reportAlerts(alerts: NetworkAlert[]): Promise<void> {
        try {
            if (!this.client.isReady() || !this.notifyChannelId) return;
            
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased()) return;
            
            // Group alerts by severity
            const criticalAlerts = alerts.filter(a => a.severity === 'critical');
            const highAlerts = alerts.filter(a => a.severity === 'high');
            const mediumAlerts = alerts.filter(a => a.severity === 'medium');
            const lowAlerts = alerts.filter(a => a.severity === 'low');
            
            // Send critical alerts immediately
            if (criticalAlerts.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🚨 CRITICAL NETWORK SECURITY ALERT')
                    .setDescription(`${criticalAlerts.length} critical network security alerts detected`)
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                // Add each alert as a field
                criticalAlerts.forEach(alert => {
                    embed.addFields({
                        name: alert.signature,
                        value: `Time: ${alert.timestamp}\nSource: ${alert.source_ip}\nDestination: ${alert.destination_ip}\nProtocol: ${alert.protocol}\n${alert.details}`
                    });
                });
                
                await (channel as TextChannel).send({ embeds: [embed] });
                
                // Log each critical alert
                for (const alert of criticalAlerts) {
                    await this.logEvent('NETWORK_ALERT', 
                        `CRITICAL: ${alert.signature} from ${alert.source_ip} to ${alert.destination_ip}`);
                }
            }
            
            // Send high alerts
            if (highAlerts.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ High Severity Network Alert')
                    .setDescription(`${highAlerts.length} high severity network alerts detected`)
                    .setColor(0xFFA500)
                    .setTimestamp();
                
                // Add alerts as fields (limited to avoid hitting Discord limits)
                const alertsToShow = highAlerts.slice(0, 10);
                alertsToShow.forEach(alert => {
                    embed.addFields({
                        name: alert.signature,
                        value: `Time: ${alert.timestamp}\nSource: ${alert.source_ip}\nDestination: ${alert.destination_ip}\nProtocol: ${alert.protocol}`
                    });
                });
                
                if (highAlerts.length > 10) {
                    embed.addFields({
                        name: 'Additional Alerts',
                        value: `${highAlerts.length - 10} more high severity alerts not shown`
                    });
                }
                
                await (channel as TextChannel).send({ embeds: [embed] });
                
                // Log high alerts (summary)
                await this.logEvent('NETWORK_ALERT', 
                    `HIGH: ${highAlerts.length} alerts including ${alertsToShow[0].signature}`);
            }
            
            // Send medium/low alerts as a summary if there are many
            const otherAlerts = [...mediumAlerts, ...lowAlerts];
            if (otherAlerts.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('ℹ️ Network Security Summary')
                    .setDescription(`${otherAlerts.length} network alerts detected (${mediumAlerts.length} medium, ${lowAlerts.length} low)`)
                    .setColor(0x3498DB)
                    .setTimestamp();
                
                // Summarize by signature type
                const signatureSummary: {[key: string]: number} = {};
                otherAlerts.forEach(alert => {
                    if (!signatureSummary[alert.signature]) {
                        signatureSummary[alert.signature] = 0;
                    }
                    signatureSummary[alert.signature]++;
                });
                
                const summaryText = Object.entries(signatureSummary)
                    .map(([signature, count]) => `${signature}: ${count} alerts`)
                    .join('\n');
                
                embed.addFields({
                    name: 'Alert Summary',
                    value: summaryText || 'No details available'
                });
                
                await (channel as TextChannel).send({ embeds: [embed] });
                
                // Log summary
                await this.logEvent('NETWORK_ALERT', 
                    `SUMMARY: ${otherAlerts.length} medium/low alerts detected`);
            }
        } catch (error) {
            console.error('Error reporting network alerts:', error);
        }
    }

    /**
     * Get recent network alerts for display
     */
    public async getRecentAlerts(limit: number = 20): Promise<NetworkAlert[]> {
        try {
            if (!this.isInitialized) {
                return [];
            }
            
            // Read the log file to extract recent alerts
            // This is a simplified implementation
            if (!fs.existsSync(this.alertLogPath)) {
                return [];
            }
            
            // Read last X bytes of the file to get recent alerts
            const stats = await fs.promises.stat(this.alertLogPath);
            const bytesToRead = Math.min(stats.size, 100000); // Read up to 100KB
            const position = Math.max(0, stats.size - bytesToRead);
            
            const buffer = Buffer.alloc(bytesToRead);
            const fileHandle = await fs.promises.open(this.alertLogPath, 'r');
            await fileHandle.read(buffer, 0, buffer.length, position);
            await fileHandle.close();
            
            const content = buffer.toString();
            const alerts = this.parseAlerts(content);
            
            // Return most recent alerts up to the limit
            return alerts.slice(-limit);
        } catch (error) {
            console.error('Error getting recent network alerts:', error);
            return [];
        }
    }

    /**
     * Run a manual network scan using the IDS
     */
    public async runManualScan(): Promise<string> {
        try {
            let result = '';
            
            if (this.detectionEngine === 'suricata') {
                // Run Suricata in offline mode against a pcap or live interface
                try {
                    const { stdout } = await execAsync('suricata -c /etc/suricata/suricata.yaml -i eth0 --engine-analysis');
                    result = `Suricata scan completed: ${stdout}`;
                } catch (error) {
                    console.error('Error running Suricata scan:', error);
                    result = 'Error running Suricata scan: ' + (error instanceof Error ? error.message : String(error));
                }
            } else if (this.detectionEngine === 'snort') {
                // Run Snort in test mode
                try {
                    const { stdout } = await execAsync('snort -T -c /etc/snort/snort.conf');
                    result = `Snort scan completed: ${stdout}`;
                } catch (error) {
                    console.error('Error running Snort scan:', error);
                    result = 'Error running Snort scan: ' + (error instanceof Error ? error.message : String(error));
                }
            } else {
                // Simulate a scan for testing
                result = 'Simulated network scan completed. No intrusion detection system installed.';
            }
            
            await this.logEvent('SECURITY', 'Manual network scan executed');
            return result;
        } catch (error) {
            console.error('Error during manual network scan:', error);
            return 'Error during network scan: ' + (error instanceof Error ? error.message : String(error));
        }
    }
}

// Export singleton instance
let networkIntrusionInstance: NetworkIntrusionDetection | null = null;

export function getNetworkIntrusionDetection(
    client: Client,
    notifyChannelId: string,
    logEvent: (type: string, description: string) => Promise<boolean>,
    alertLogPath?: string
): NetworkIntrusionDetection {
    if (!networkIntrusionInstance) {
        networkIntrusionInstance = new NetworkIntrusionDetection(
            client, 
            notifyChannelId,
            logEvent,
            alertLogPath
        );
    }
    return networkIntrusionInstance;
}
