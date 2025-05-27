# Noxhime Bot

Autonomous Discord bot with system monitoring and OpenAI integration.

## Features

- Discord integration with command system
- OpenAI-powered chat responses
- BioLock security system for owner-only access
- SQLite database for event logging
- Notification system for bot status changes
- Server health monitoring with Monit integration
- Self-healing capabilities with automatic recovery
- System resource tracking and alerts
- Fail2Ban integration for security monitoring

## Setup Instructions

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials:
   - Discord Bot Token
   - OpenAI API Key
   - Owner Discord ID
   - Monitoring settings
4. Install Monit and Fail2Ban:
   ```
   sudo apt update
   sudo apt install -y monit fail2ban
   ```
5. Run the monitoring setup script:
   ```
   sudo bash ./scripts/setup-monitoring.sh
   ```
6. Run the bot with PM2 for auto-restart:
   ```
   npm install -g pm2
   pm2 start npm --name "noxhime-bot" -- start
   pm2 save
   pm2 startup
   ```

## Commands

- `!status` - Check if bot is online
- `!whoami` - Shows your identity/role
- `!cmds` - Lists available commands
- `!ask <question>` - Ask the AI a question
- `!system` - Display system status and statistics

Owner-only commands:
- `!restart` - Restart the bot
- `!lock` - Engage BioLock security system
- `!heal` - Trigger self-healing maintenance routine
- `!logs <type> <count>` - View recent system logs

## BioLock System

The BioLock system provides an additional layer of security. When enabled, the bot will only respond to basic commands until unlocked by the owner using the passphrase defined in the .env file.

## Server Monitoring System

The bot includes a comprehensive server monitoring system:

### Monit Integration
Monitors the bot process, system resources, and network connectivity. Automatic alerts are sent to Discord when issues are detected.

### Self-Healing
The bot implements self-healing mechanisms to recover from common issues:
- Automatic memory optimization and garbage collection
- Recovery messaging after restart
- Crash detection and notification

### System Alerts
Get notified about important system events:
- High CPU/memory usage
- Low disk space
- Network connectivity issues
- Fail2Ban security blocks

### Express Server
The bot runs an Express server to receive alerts from:
- Monit service monitoring
- Fail2Ban security events
- Custom system events

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
