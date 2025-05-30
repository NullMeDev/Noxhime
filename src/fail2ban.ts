import { exec } from 'child_process';
import util from 'util';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';

const execAsync = util.promisify(exec);

/**
 * Interface for Fail2Ban jail status
 */
interface Jail {
    name: string;
    status: 'active' | 'inactive';
    bannedIPs: string[];
    totalBanned: number;
}

/**
 * Class for managing Fail2Ban health checks
 */
export class Fail2BanMonitor {
    private client: Client;
    private notifyChannelId: string;
    private logEvent: (type: string, description: string) => Promise<boolean>;
    private checkInterval: NodeJS.Timeout | null = null;
    private previousJailStatus: Map<string, { status: string, totalBanned: number }> = new Map();

    constructor(
        client: Client,
        notifyChannelId: string,
        logEvent: (type: string, description: string) => Promise<boolean>
    ) {
        this.client = client;
        this.notifyChannelId = notifyChannelId;
        this.logEvent = logEvent;
    }

    /**
     * Start monitoring Fail2Ban jails
     */
    public start(checkIntervalMs: number = 300000): void { // Default: 5 minutes
        console.log(`Starting Fail2Ban monitoring with interval of ${checkIntervalMs/1000} seconds`);
        
        // Set initial status
        this.getJailStatus().then(jails => {
            jails.forEach(jail => {
                this.previousJailStatus.set(jail.name, {
                    status: jail.status,
                    totalBanned: jail.totalBanned
                });
            });
        }).catch(error => {
            console.error('Error initializing Fail2Ban status:', error);
        });
        
        // Start periodic checks
        this.checkInterval = setInterval(() => this.checkFail2Ban(), checkIntervalMs);
        
        // Log the start
        this.logEvent('SECURITY', 'Fail2Ban monitoring system started');
    }

    /**
     * Stop monitoring Fail2Ban jails
     */
    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('Fail2Ban monitoring system stopped');
            this.logEvent('SECURITY', 'Fail2Ban monitoring system stopped');
        }
    }

    /**
     * Check Fail2Ban status and detect changes
     */
    private async checkFail2Ban(): Promise<void> {
        try {
            const jails = await this.getJailStatus();
            const changes: {jail: string, type: string, details: string}[] = [];

            // Check for changes in jail status
            jails.forEach(jail => {
                const previous = this.previousJailStatus.get(jail.name);
                
                // If this is a new jail or status changed
                if (!previous || previous.status !== jail.status) {
                    changes.push({
                        jail: jail.name,
                        type: 'status',
                        details: `Status changed to ${jail.status}${previous ? ` (was ${previous.status})` : ''}`
                    });
                }
                
                // If new IPs were banned
                if (previous && jail.totalBanned > previous.totalBanned) {
                    const newBans = jail.totalBanned - previous.totalBanned;
                    changes.push({
                        jail: jail.name,
                        type: 'banned',
                        details: `${newBans} new IP${newBans > 1 ? 's' : ''} banned`
                    });
                }
                
                // Update previous status
                this.previousJailStatus.set(jail.name, {
                    status: jail.status,
                    totalBanned: jail.totalBanned
                });
            });

            // Report changes if any
            if (changes.length > 0) {
                await this.reportChanges(changes, jails);
            }
        } catch (error) {
            console.error('Error checking Fail2Ban status:', error);
        }
    }

    /**
     * Get current status of all Fail2Ban jails
     */
    public async getJailStatus(): Promise<Jail[]> {
        try {
            // Get list of jails
            const { stdout: jailListOutput } = await execAsync('fail2ban-client status');
            const jailListMatch = jailListOutput.match(/Jail list:\s+(.*)/);
            
            if (!jailListMatch || !jailListMatch[1]) {
                return [];
            }
            
            const jailNames = jailListMatch[1].split(', ').filter(Boolean);
            const jails: Jail[] = [];
            
            // Get status for each jail
            for (const jailName of jailNames) {
                try {
                    const { stdout: jailStatus } = await execAsync(`fail2ban-client status ${jailName}`);
                    
                    // Extract status and banned IPs
                    const statusMatch = jailStatus.match(/Status:\s+(.*)/i);
                    const currentlyBannedMatch = jailStatus.match(/Currently banned:\s+(\d+)/i);
                    const totalBannedMatch = jailStatus.match(/Total banned:\s+(\d+)/i);
                    const bannedIPMatch = jailStatus.match(/Banned IP list:\s+(.*)/i);
                    
                    const status = statusMatch && statusMatch[1].trim().toLowerCase() === 'enabled' ? 'active' : 'inactive';
                    const totalBanned = totalBannedMatch ? parseInt(totalBannedMatch[1]) : 0;
                    const bannedIPs = bannedIPMatch && bannedIPMatch[1] ? bannedIPMatch[1].split(' ').filter(Boolean) : [];
                    
                    jails.push({
                        name: jailName,
                        status,
                        bannedIPs,
                        totalBanned
                    });
                } catch (error) {
                    console.error(`Error getting status for jail ${jailName}:`, error);
                }
            }
            
            return jails;
        } catch (error) {
            console.error('Error getting fail2ban jail status:', error);
            return [];
        }
    }

    /**
     * Report changes in Fail2Ban status to Discord
     */
    private async reportChanges(
        changes: {jail: string, type: string, details: string}[],
        jails: Jail[]
    ): Promise<void> {
        try {
            if (!this.client.isReady() || !this.notifyChannelId) return;
            
            const channel = await this.client.channels.fetch(this.notifyChannelId);
            if (!channel?.isTextBased()) return;
            
            // Create a report message with all changes
            const statusChanges = changes.filter(c => c.type === 'status');
            const banChanges = changes.filter(c => c.type === 'banned');
            
            // Only report if we have something to report
            if (statusChanges.length > 0 || banChanges.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ Fail2Ban Status Update')
                    .setDescription('Changes detected in Fail2Ban security system')
                    .setColor(0xFF9900)
                    .setTimestamp();
                
                // Add status changes
                if (statusChanges.length > 0) {
                    const statusChangesText = statusChanges
                        .map(c => `• ${c.jail}: ${c.details}`)
                        .join('\n');
                        
                    embed.addFields({
                        name: '🔄 Status Changes',
                        value: statusChangesText
                    });
                }
                
                // Add ban changes
                if (banChanges.length > 0) {
                    const banChangesText = banChanges
                        .map(c => `• ${c.jail}: ${c.details}`)
                        .join('\n');
                        
                    embed.addFields({
                        name: '🚫 New IP Bans',
                        value: banChangesText
                    });
                    
                    // Get currently banned IPs for jails with new bans
                    const jailsWithNewBans = banChanges.map(c => c.jail);
                    const relevantJails = jails.filter(j => jailsWithNewBans.includes(j.name));
                    
                    relevantJails.forEach(jail => {
                        if (jail.bannedIPs.length > 0) {
                            const ipList = jail.bannedIPs.length <= 10 
                                ? jail.bannedIPs.join(', ')
                                : `${jail.bannedIPs.slice(0, 10).join(', ')} and ${jail.bannedIPs.length - 10} more`;
                                
                            embed.addFields({
                                name: `📋 Currently Banned IPs (${jail.name})`,
                                value: ipList
                            });
                        }
                    });
                }
                
                // Add summary field
                const totalBanned = jails.reduce((sum, jail) => sum + jail.totalBanned, 0);
                const activeSummary = `${jails.filter(j => j.status === 'active').length} of ${jails.length} jails active`;
                embed.addFields({
                    name: '📊 Summary',
                    value: `${activeSummary}\nTotal banned IPs: ${totalBanned}`
                });
                
                // Send to Discord
                await (channel as TextChannel).send({ embeds: [embed] });
                
                // Log the event
                await this.logEvent('SECURITY', 
                    `Fail2Ban status update: ${changes.length} changes detected (${statusChanges.length} status, ${banChanges.length} bans)`);
            }
        } catch (error) {
            console.error('Error reporting Fail2Ban changes:', error);
        }
    }
}

// Export singleton instance
let fail2banMonitorInstance: Fail2BanMonitor | null = null;

export function getFail2BanMonitor(
    client: Client, 
    notifyChannelId: string,
    logEvent: (type: string, description: string) => Promise<boolean>
): Fail2BanMonitor {
    if (!fail2banMonitorInstance) {
        fail2banMonitorInstance = new Fail2BanMonitor(client, notifyChannelId, logEvent);
    }
    return fail2banMonitorInstance;
}
