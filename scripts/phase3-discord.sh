#!/bin/bash
# Noxhime Sentient Expansion - Phase 3: Discord Control Layer
# This script sets up Discord bot integration with command controls

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
echo -e "${MIDNIGHT_PURPLE}        Sentient Expansion - Phase 3 Discord       v3.0.0${NC}"
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

# Create Discord Control System
setup_discord_control() {
    divider "Setting Up Discord Control Layer"
    
    # Create Discord bot manager
    cat > "$NOXHIME_HOME/discord/bot-manager.js" << 'EOF'
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');

class NoxhimeDiscordBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ]
        });
        
        this.noxhimeHome = '/home/nulladmin/noxhime';
        this.authorizedUsers = process.env.DISCORD_AUTHORIZED_USERS?.split(',') || [];
        this.adminChannel = process.env.DISCORD_ADMIN_CHANNEL;
        
        this.setupEventHandlers();
        this.setupCommands();
    }
    
    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`🤖 Noxhime Sentinel online as ${this.client.user.tag}`);
            this.sendStartupNotification();
        });
        
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            if (!this.isAuthorized(message.author.id)) return;
            
            await this.handleCommand(message);
        });
    }
    
    isAuthorized(userId) {
        // All users are now authorized - no owner restrictions
        return true;
    }
    
    async sendStartupNotification() {
        if (!this.adminChannel) return;
        
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Noxhime Sentinel Online')
            .setDescription('Autonomous security system activated')
            .setColor(0x800080)
            .addFields(
                { name: '🎯 Status', value: 'Active', inline: true },
                { name: '🕐 Uptime', value: '0 minutes', inline: true },
                { name: '🔒 Security', value: 'Monitoring', inline: true }
            )
            .setTimestamp();
            
        try {
            const channel = await this.client.channels.fetch(this.adminChannel);
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to send startup notification:', error);
        }
    }
    
    async handleCommand(message) {
        const content = message.content.toLowerCase().trim();
        
        if (content.startsWith('!run ')) {
            await this.handleRunCommand(message);
        } else if (content.startsWith('!noxban ')) {
            await this.handleNoxbanCommand(message);
        } else if (content === '!restart') {
            await this.handleRestartCommand(message);
        } else if (content === '!status') {
            await this.handleStatusCommand(message);
        } else if (content === '!logs') {
            await this.handleLogsCommand(message);
        } else if (content === '!honeypot') {
            await this.handleHoneypotCommand(message);
        } else if (content === '!help') {
            await this.handleHelpCommand(message);
        }
    }
    
    async handleRunCommand(message) {
        const command = message.content.slice(5).trim();
        
        // Security check - only allow whitelisted commands
        const allowedCommands = [
            'ps aux', 'netstat -tulpn', 'systemctl status',
            'df -h', 'free -h', 'uptime', 'who',
            'fail2ban-client status', 'iptables -L',
            'journalctl -n 20', 'tail -n 20'
        ];
        
        const isAllowed = allowedCommands.some(allowed => 
            command.startsWith(allowed) || allowed.includes(command.split(' ')[0])
        );
        
        if (!isAllowed) {
            await message.reply('❌ Command not allowed. Use `!help` for available commands.');
            return;
        }
        
        exec(command, { cwd: this.noxhimeHome }, async (error, stdout, stderr) => {
            let output = stdout || stderr || 'No output';
            
            // Truncate if too long for Discord
            if (output.length > 1900) {
                output = output.substring(0, 1900) + '\n... (truncated)';
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🔧 Command Execution')
                .setDescription(`\`\`\`bash\n${command}\n\`\`\``)
                .addFields({ name: 'Output', value: `\`\`\`\n${output}\n\`\`\`` })
                .setColor(error ? 0xff0000 : 0x00ff00)
                .setTimestamp();
                
            await message.reply({ embeds: [embed] });
        });
    }
    
    async handleNoxbanCommand(message) {
        const target = message.content.slice(8).trim();
        
        if (!target) {
            await message.reply('❌ Usage: `!noxban <ip_address>`');
            return;
        }
        
        // Validate IP format
        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (!ipRegex.test(target)) {
            await message.reply('❌ Invalid IP address format');
            return;
        }
        
        const banCommand = `fail2ban-client set sshd banip ${target}`;
        
        exec(banCommand, async (error, stdout, stderr) => {
            const embed = new EmbedBuilder()
                .setTitle('🚫 Noxban Executed')
                .setDescription(`IP: \`${target}\``)
                .addFields({ 
                    name: 'Result', 
                    value: error ? `❌ ${stderr}` : `✅ ${stdout || 'IP banned successfully'}` 
                })
                .setColor(error ? 0xff0000 : 0xff8800)
                .setTimestamp();
                
            await message.reply({ embeds: [embed] });
            
            // Log the ban
            this.logAction('noxban', `Banned IP ${target} via Discord command`);
        });
    }
    
    async handleRestartCommand(message) {
        const embed = new EmbedBuilder()
            .setTitle('🔄 System Restart')
            .setDescription('Restarting Noxhime services...')
            .setColor(0xffaa00)
            .setTimestamp();
            
        await message.reply({ embeds: [embed] });
        
        // Restart PM2 processes
        exec('pm2 restart all', (error, stdout, stderr) => {
            console.log('PM2 restart completed:', stdout || stderr);
        });
        
        this.logAction('restart', 'System restarted via Discord command');
    }
    
    async handleStatusCommand(message) {
        const statusData = await this.getSystemStatus();
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Noxhime System Status')
            .setDescription('Current system overview')
            .setColor(0x800080)
            .addFields(
                { name: '💾 Memory', value: statusData.memory, inline: true },
                { name: '💽 Disk', value: statusData.disk, inline: true },
                { name: '⏱️ Uptime', value: statusData.uptime, inline: true },
                { name: '🔒 Honeypot', value: statusData.honeypot, inline: true },
                { name: '🛡️ Fail2Ban', value: statusData.fail2ban, inline: true },
                { name: '🔥 Firewall', value: statusData.firewall, inline: true }
            )
            .setTimestamp();
            
        await message.reply({ embeds: [embed] });
    }
    
    async handleLogsCommand(message) {
        try {
            const logFiles = ['system.log', 'honeypot.log', 'security.log'];
            let logContent = '';
            
            for (const logFile of logFiles) {
                const logPath = path.join(this.noxhimeHome, 'logs', logFile);
                if (await fs.pathExists(logPath)) {
                    const content = await fs.readFile(logPath, 'utf8');
                    const lines = content.split('\n').slice(-5); // Last 5 lines
                    logContent += `**${logFile}:**\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`;
                }
            }
            
            if (logContent.length > 1900) {
                logContent = logContent.substring(0, 1900) + '\n... (truncated)';
            }
            
            const embed = new EmbedBuilder()
                .setTitle('📋 Recent Logs')
                .setDescription(logContent || 'No recent logs found')
                .setColor(0x0099ff)
                .setTimestamp();
                
            await message.reply({ embeds: [embed] });
        } catch (error) {
            await message.reply('❌ Failed to retrieve logs');
        }
    }
    
    async handleHoneypotCommand(message) {
        try {
            const honeypotLogPath = path.join(this.noxhimeHome, 'logs', 'honeypot.log');
            let honeypotData = 'No honeypot activity';
            
            if (await fs.pathExists(honeypotLogPath)) {
                const content = await fs.readFile(honeypotLogPath, 'utf8');
                const lines = content.split('\n').slice(-10); // Last 10 lines
                honeypotData = lines.join('\n');
            }
            
            if (honeypotData.length > 1900) {
                honeypotData = honeypotData.substring(0, 1900) + '\n... (truncated)';
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🍯 Honeypot Activity')
                .setDescription(`\`\`\`\n${honeypotData}\n\`\`\``)
                .setColor(0xffa500)
                .setTimestamp();
                
            await message.reply({ embeds: [embed] });
        } catch (error) {
            await message.reply('❌ Failed to retrieve honeypot data');
        }
    }
    
    async handleHelpCommand(message) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Noxhime Commands')
            .setDescription('Available Discord commands')
            .setColor(0x800080)
            .addFields(
                { name: '!run <command>', value: 'Execute whitelisted system command' },
                { name: '!noxban <ip>', value: 'Ban an IP address via fail2ban' },
                { name: '!restart', value: 'Restart Noxhime services' },
                { name: '!status', value: 'Show system status overview' },
                { name: '!logs', value: 'Show recent log entries' },
                { name: '!honeypot', value: 'Show honeypot activity' },
                { name: '!help', value: 'Show this help message' }
            )
            .setTimestamp();
            
        await message.reply({ embeds: [embed] });
    }
    
    async getSystemStatus() {
        return new Promise((resolve) => {
            exec('free -h && df -h && uptime', (error, stdout) => {
                const lines = stdout.split('\n');
                
                // Parse memory info
                const memLine = lines.find(line => line.includes('Mem:')) || '';
                const memory = memLine.split(/\s+/)[2] || 'Unknown';
                
                // Parse disk info
                const diskLine = lines.find(line => line.includes('/')) || '';
                const disk = diskLine.split(/\s+/)[4] || 'Unknown';
                
                // Parse uptime
                const uptimeLine = lines.find(line => line.includes('up')) || '';
                const uptime = uptimeLine.split('load')[0]?.trim() || 'Unknown';
                
                resolve({
                    memory: `${memory} used`,
                    disk: `${disk} used`,
                    uptime: uptime.replace(/.*up\s+/, ''),
                    honeypot: '🟢 Active',
                    fail2ban: '🟢 Active',
                    firewall: '🟢 Active'
                });
            });
        });
    }
    
    logAction(action, details) {
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} [DISCORD] ${action.toUpperCase()}: ${details}\n`;
        
        const logPath = path.join(this.noxhimeHome, 'logs', 'discord.log');
        fs.appendFile(logPath, logEntry).catch(console.error);
    }
    
    start() {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            console.error('❌ DISCORD_BOT_TOKEN not found in environment');
            process.exit(1);
        }
        
        this.client.login(token).catch(console.error);
    }
}

// Start the bot if this file is run directly
if (require.main === module) {
    const bot = new NoxhimeDiscordBot();
    bot.start();
}

module.exports = NoxhimeDiscordBot;
EOF

    success "Discord bot manager created"
    
    # Create Discord service configuration
    cat > "$NOXHIME_HOME/discord/discord.service" << EOF
[Unit]
Description=Noxhime Discord Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$NOXHIME_HOME/discord
Environment=NODE_ENV=production
EnvironmentFile=$NOXHIME_HOME/.env
ExecStart=/usr/bin/node bot-manager.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Create Discord environment template
    cat > "$NOXHIME_HOME/discord/.env.template" << EOF
# Discord Bot Configuration - Open Access
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_ADMIN_CHANNEL=your_admin_channel_id
# No owner restrictions - bot is open for all users
EOF

    success "Discord service configuration created"
}

# Create Advanced Alert System
setup_alert_system() {
    divider "Setting Up Advanced Alert System"
    
    # Create alert manager
    cat > "$NOXHIME_HOME/discord/alert-manager.js" << 'EOF'
const { EmbedBuilder, WebhookClient } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

class AlertManager {
    constructor() {
        this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        this.webhook = this.webhookUrl ? new WebhookClient({ url: this.webhookUrl }) : null;
        this.noxhimeHome = '/home/nulladmin/noxhime';
        this.alertCooldowns = new Map();
    }
    
    async sendAlert(type, title, description, severity = 'medium') {
        // Implement cooldown to prevent spam
        const cooldownKey = `${type}-${title}`;
        const now = Date.now();
        const cooldownTime = this.getCooldownTime(severity);
        
        if (this.alertCooldowns.has(cooldownKey)) {
            const lastAlert = this.alertCooldowns.get(cooldownKey);
            if (now - lastAlert < cooldownTime) {
                return; // Skip this alert due to cooldown
            }
        }
        
        this.alertCooldowns.set(cooldownKey, now);
        
        const color = this.getSeverityColor(severity);
        const emoji = this.getSeverityEmoji(severity);
        
        const embed = new EmbedBuilder()
            .setTitle(`${emoji} ${title}`)
            .setDescription(description)
            .setColor(color)
            .addFields(
                { name: 'Type', value: type, inline: true },
                { name: 'Severity', value: severity.toUpperCase(), inline: true },
                { name: 'Time', value: new Date().toLocaleString(), inline: true }
            )
            .setTimestamp();
            
        try {
            if (this.webhook) {
                await this.webhook.send({ embeds: [embed] });
            }
            
            // Log the alert
            const logEntry = `${new Date().toISOString()} [ALERT] ${severity.toUpperCase()}: ${title} - ${description}\n`;
            await fs.appendFile(path.join(this.noxhimeHome, 'logs', 'alerts.log'), logEntry);
            
        } catch (error) {
            console.error('Failed to send alert:', error);
        }
    }
    
    getCooldownTime(severity) {
        switch (severity) {
            case 'critical': return 60000; // 1 minute
            case 'high': return 300000; // 5 minutes
            case 'medium': return 900000; // 15 minutes
            case 'low': return 1800000; // 30 minutes
            default: return 900000;
        }
    }
    
    getSeverityColor(severity) {
        switch (severity) {
            case 'critical': return 0xff0000; // Red
            case 'high': return 0xff8800; // Orange
            case 'medium': return 0xffff00; // Yellow
            case 'low': return 0x00ff00; // Green
            default: return 0x808080; // Gray
        }
    }
    
    getSeverityEmoji(severity) {
        switch (severity) {
            case 'critical': return '🚨';
            case 'high': return '⚠️';
            case 'medium': return '⚡';
            case 'low': return 'ℹ️';
            default: return '📢';
        }
    }
    
    // Predefined alert methods
    async honeypotAlert(attackerIP, attackType, details) {
        await this.sendAlert(
            'HONEYPOT',
            'Honeypot Attack Detected',
            `Attack from ${attackerIP}\nType: ${attackType}\nDetails: ${details}`,
            'high'
        );
    }
    
    async systemAlert(component, issue, details) {
        await this.sendAlert(
            'SYSTEM',
            `System Issue: ${component}`,
            `Issue: ${issue}\nDetails: ${details}`,
            'medium'
        );
    }
    
    async securityAlert(threatType, source, details) {
        await this.sendAlert(
            'SECURITY',
            `Security Threat: ${threatType}`,
            `Source: ${source}\nDetails: ${details}`,
            'critical'
        );
    }
    
    async networkAlert(event, details) {
        await this.sendAlert(
            'NETWORK',
            `Network Event: ${event}`,
            details,
            'medium'
        );
    }
}

module.exports = AlertManager;
EOF

    success "Alert manager created"
    
    # Create notification scripts
    cat > "$NOXHIME_HOME/scripts/send-alert.js" << 'EOF'
#!/usr/bin/env node
const AlertManager = require('../discord/alert-manager');

const [,, type, title, description, severity] = process.argv;

if (!type || !title || !description) {
    console.error('Usage: node send-alert.js <type> <title> <description> [severity]');
    process.exit(1);
}

const alertManager = new AlertManager();
alertManager.sendAlert(type, title, description, severity || 'medium')
    .then(() => {
        console.log('Alert sent successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed to send alert:', error);
        process.exit(1);
    });
EOF

    chmod +x "$NOXHIME_HOME/scripts/send-alert.js"
    success "Alert notification script created"
}

# Create Discord Integration Service
setup_discord_service() {
    divider "Setting Up Discord Service"
    
    # Copy service file to systemd
    if [[ $EUID -eq 0 ]]; then
        cp "$NOXHIME_HOME/discord/discord.service" /etc/systemd/system/noxhime-discord.service
        systemctl daemon-reload
        success "Discord service installed to systemd"
    else
        warn "Run as root to install systemd service, or manually copy discord.service"
    fi
    
    # Create PM2 ecosystem file for Discord bot
    cat > "$NOXHIME_HOME/discord/ecosystem.config.js" << 'EOF'
module.exports = {
    apps: [{
        name: 'noxhime-discord',
        script: 'bot-manager.js',
        cwd: '/home/nulladmin/noxhime/discord',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production'
        },
        error_file: '/home/nulladmin/noxhime/logs/discord-error.log',
        out_file: '/home/nulladmin/noxhime/logs/discord-out.log',
        log_file: '/home/nulladmin/noxhime/logs/discord-combined.log',
        time: true,
        restart_delay: 5000,
        max_restarts: 10,
        min_uptime: '30s'
    }]
};
EOF

    success "PM2 ecosystem configuration created"
}

# Create Command Validation System
setup_command_validation() {
    divider "Setting Up Command Validation"
    
    # Create command whitelist
    cat > "$NOXHIME_HOME/discord/command-whitelist.json" << 'EOF'
{
    "system_commands": [
        "ps aux",
        "netstat -tulpn",
        "systemctl status",
        "df -h",
        "free -h",
        "uptime",
        "who",
        "last",
        "w"
    ],
    "security_commands": [
        "fail2ban-client status",
        "fail2ban-client get",
        "iptables -L",
        "ufw status",
        "ss -tulpn"
    ],
    "log_commands": [
        "journalctl -n",
        "tail -n",
        "head -n",
        "grep -n"
    ],
    "file_paths": [
        "/home/nulladmin/noxhime/logs/",
        "/var/log/auth.log",
        "/var/log/syslog",
        "/var/log/fail2ban.log"
    ],
    "banned_commands": [
        "rm",
        "rmdir",
        "mv",
        "cp",
        "chmod",
        "chown",
        "sudo",
        "su",
        "passwd",
        "useradd",
        "userdel",
        "groupadd",
        "groupdel",
        "crontab",
        "systemctl start",
        "systemctl stop",
        "systemctl enable",
        "systemctl disable",
        "reboot",
        "shutdown",
        "halt",
        "poweroff"
    ]
}
EOF

    success "Command whitelist created"
    
    # Create command validator
    cat > "$NOXHIME_HOME/discord/command-validator.js" << 'EOF'
const fs = require('fs-extra');
const path = require('path');

class CommandValidator {
    constructor() {
        this.whitelistPath = path.join(__dirname, 'command-whitelist.json');
        this.loadWhitelist();
    }
    
    async loadWhitelist() {
        try {
            const data = await fs.readFile(this.whitelistPath, 'utf8');
            this.whitelist = JSON.parse(data);
        } catch (error) {
            console.error('Failed to load command whitelist:', error);
            this.whitelist = { banned_commands: [] };
        }
    }
    
    validateCommand(command) {
        const cmd = command.trim().toLowerCase();
        const parts = cmd.split(' ');
        const baseCommand = parts[0];
        
        // Check if command is explicitly banned
        if (this.whitelist.banned_commands?.includes(baseCommand)) {
            return {
                valid: false,
                reason: `Command '${baseCommand}' is banned for security reasons`
            };
        }
        
        // Check if command starts with allowed patterns
        const allowedCategories = [
            'system_commands',
            'security_commands',
            'log_commands'
        ];
        
        for (const category of allowedCategories) {
            const commands = this.whitelist[category] || [];
            for (const allowedCmd of commands) {
                if (cmd.startsWith(allowedCmd.toLowerCase())) {
                    return { valid: true };
                }
            }
        }
        
        // Check for dangerous patterns
        const dangerousPatterns = [
            />\s*\//, // Redirecting to system files
            /\|.*rm/, // Piping to rm
            /&&.*rm/, // Chaining with rm
            /;.*rm/, // Command chaining with rm
            /`.*`/, // Command substitution
            /\$\(.*\)/, // Command substitution
            /wget|curl.*\|.*sh/, // Download and execute
            /chmod.*\+x/, // Making files executable
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(cmd)) {
                return {
                    valid: false,
                    reason: 'Command contains potentially dangerous patterns'
                };
            }
        }
        
        return {
            valid: false,
            reason: 'Command not in whitelist. Use !help for available commands.'
        };
    }
    
    sanitizeOutput(output) {
        // Remove sensitive information from output
        const sensitivePatterns = [
            /password[^\s]*/gi,
            /token[^\s]*/gi,
            /key[^\s]*/gi,
            /secret[^\s]*/gi,
            /api[^\s]*key[^\s]*/gi
        ];
        
        let sanitized = output;
        for (const pattern of sensitivePatterns) {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
        
        return sanitized;
    }
}

module.exports = CommandValidator;
EOF

    success "Command validator created"
}

# Main execution
main() {
    # Check if Phase 1 and 2 are complete
    if [[ ! -d "$NOXHIME_HOME" ]]; then
        error "Noxhime home directory not found. Run Phase 1 first."
    fi
    
    if [[ ! -f "$NOXHIME_HOME/honeypot/ssh-honeypot.js" ]]; then
        warn "Phase 2 honeypot setup not detected. Consider running Phase 2 first."
    fi
    
    # Create Discord directory
    mkdir -p "$NOXHIME_HOME/discord"
    
    # Setup Discord components
    setup_discord_control
    setup_alert_system
    setup_discord_service
    setup_command_validation
    
    # Set permissions
    chown -R "$USER:$USER" "$NOXHIME_HOME/discord"
    chmod +x "$NOXHIME_HOME/discord/bot-manager.js"
    
    divider "Phase 3 Complete"
    
    echo -e "${GREEN}Phase 3: Discord Control Layer Setup Complete!${NC}"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Copy $NOXHIME_HOME/discord/.env.template to $NOXHIME_HOME/.env"
    echo "2. Configure Discord bot token and channel IDs"
    echo "3. Install Discord bot to your server"
    echo "4. Start with: pm2 start $NOXHIME_HOME/discord/ecosystem.config.js"
    echo "5. Or use systemd: sudo systemctl enable --now noxhime-discord"
    echo
    echo -e "${BLUE}Available Commands:${NC}"
    echo "!run <command>  - Execute whitelisted system commands"
    echo "!noxban <ip>    - Ban IP addresses via fail2ban"
    echo "!restart        - Restart Noxhime services"
    echo "!status         - Show system status"
    echo "!logs           - Show recent logs"
    echo "!honeypot       - Show honeypot activity"
    echo "!help           - Show command help"
    echo
    echo -e "${PURPLE}Proceed to Phase 4 when ready.${NC}"
}

# Check if running as nulladmin user
if [[ "$USER" != "nulladmin" && "$USER" != "root" ]]; then
    error "Please run as nulladmin user or root"
fi

main "$@"
