# Noxhime Bot

Autonomous Discord bot with system monitoring, security intelligence, IP/Port whitelisting, and OpenAI integration with evolving personality.

## Features

- Discord integration with command system
- OpenAI-powered chat responses
- BioLock security system for owner-only access
- **IP/Port Whitelisting** for enhanced API security
  - Restrict API access to specific IP addresses and ports
  - Manage whitelist via Discord commands
  - Configurable through installation or bot commands
- SQLite database for event logging
- Notification system for bot status changes
- Server health monitoring with Monit integration
- Self-healing capabilities with automatic recovery
- System resource tracking and alerts
- Fail2Ban integration for security monitoring
- Sentinel Intelligence with log monitoring and suspicious behavior detection
- Automated backup system with Rclone integration
- Evolving Personality Core with mood-based responses

## Setup Instructions

### Option 1: Enhanced Installer (Recommended)

Use our enhanced installer script for a complete setup with IP/Port whitelisting:

```bash
./install-noxhime.sh
```

This will:
- Clone the repository
- Install all dependencies
- Create the database
- Guide you through configuration with interactive prompts
- Configure IP/Port whitelisting for enhanced security
  - Add specific IP addresses to whitelist
  - Add specific ports to whitelist
  - Enable/disable whitelisting as needed
- Set up system services and monitoring
- Create shell aliases for easy management

### Option 2: Quick Setup

Run the following command to automatically download and install Noxhime Bot with all dependencies:

```bash
curl -sSL https://raw.githubusercontent.com/NullMeDev/noxhime-bot/main/quick-setup.sh | bash
```

### Option 3: Legacy Installer

If you prefer the original installer without whitelist configuration:

```bash
./noxhime-installer.sh
```

### Option 3: Manual Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials:
   - Discord Bot Token
   - OpenAI API Key
   - Owner Discord ID
   - Monitoring settings
   - Sentinel Intelligence settings
   - Personality Core settings
4. Install required system tools:
   ```
   sudo apt update
   sudo apt install -y monit fail2ban rclone
   ```
5. Configure Rclone for remote backups:
   ```
   rclone config
   # Follow the prompts to set up your desired remote (e.g., Google Drive)
   ```
6. Run the monitoring setup script:
   ```
   sudo bash ./scripts/setup-monitoring.sh
   ```
7. Run the bot with PM2 for auto-restart:
   ```
   npm install -g pm2
   pm2 start npm --name "noxhime-bot" -- start
   pm2 save
   pm2 startup
   ```

## Quick Commands

After installation, the following aliases are available:

- `noxhime-start`: Start the bot manually
- `noxhime-monitor`: Launch the monitoring CLI
- `noxhime-logs`: View the bot logs
- `noxhime-status`: Check the bot's status
- `noxhime-restart`: Restart the bot
- `noxhime-config`: Edit the configuration file

## IP/Port Whitelisting

Noxhime Bot includes an advanced IP/Port whitelisting system for enhanced security. This prevents unauthorized access to the bot's API endpoints by restricting access to specific IP addresses and ports.

For detailed documentation on the whitelist feature, see [docs/whitelist.md](docs/whitelist.md).

## Commands

Noxhime Bot provides a comprehensive set of commands for both Discord interaction and server management. 

See the complete [Command Reference](docs/commands.md) for a detailed list of:
- Discord commands for general users
- Owner-only Discord commands
- Server-side management commands
- Whitelist management commands
- API endpoints

Here are some of the most commonly used commands:

- `!status` - Check if the bot is online
- `!ask <question>` - Ask the bot a question using AI
- `!system` - Display system status and statistics
- `!whitelist status` - Show current whitelist configuration

### General Commands
- `!status` - Check if bot is online
- `!whoami` - Shows your identity/role
- `!cmds` - Lists available commands
- `!ask <question>` - Ask the AI a question
- `!system` - Display system status and statistics
- `!uptime` - Shows system and bot uptime
- `!services` - Checks status of system services
- `!mood` - Shows bot's current emotional state

### Owner-only Commands
- `!restart` - Restart the bot
- `!lock` - Engage BioLock security system
- `!heal` - Trigger self-healing maintenance routine
- `!logs <type> <count>` - View recent system logs
- `!backup` - Triggers manual backup
- `!sentinel <start|stop>` - Controls sentinel monitoring
- `!incidents` - Views security incidents

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

## Sentinel Intelligence System (Phase 4) - IMPLEMENTED ✅

The Sentinel Intelligence system provides advanced security monitoring and system protection:

### Log Monitoring
- ✅ Monitors system logs for suspicious patterns
- ✅ Detects potential security threats
- ✅ Alerts on system errors and anomalies
- ✅ Configurable log pattern detection system

### Service Status Tracking
- ✅ Monitors critical services (nginx, fail2ban, ssh, etc.)
- ✅ Provides detailed status information including memory usage
- ✅ Sends alerts when services go down
- ✅ Database integration for historical service status

### Suspicious IP Detection
- ✅ Tracks IP addresses showing suspicious behavior
- ✅ Monitors for brute force attempts and other attacks
- ✅ Integrates with system security tools
- ✅ IP tracking with incident counting

### Automated Backup System
- ✅ Scheduled backups of database and logs
- ✅ Remote storage via Rclone integration
- ✅ Rotation system to manage storage space
- ✅ Manual backup option for immediate safeguarding

## Evolving Personality Core (Phase 5)

The bot features a dynamic personality system that evolves based on interactions and events:

### Mood System
- Multiple mood states: happy, focused, concerned, alert, playful, sarcastic, serious
- Mood intensity tracking
- Automatic mood transitions based on system events

### Emotional Responses
- Context-aware message styling
- Mood-appropriate emoji usage
- Dynamic response formatting

### Visual Styling
- Mood-based embed colors
- Themed message formatting
- Personality-driven user interaction

### Trigger Events
- System errors trigger concern
- Security threats heighten alertness
- Successful operations improve mood
- User interactions influence emotional state
- Resource pressure affects focus and concern levels

## Web Interface Integration

A web dashboard is available at nullme.lol that provides:
- Real-time bot status monitoring
- Security incident visualization
- System performance metrics
- Mood and personality management
- Command history and interaction logs

<p align="center">
Contributions are welcome, either request here, or email me at null@nullme.dev! Please feel free to submit a pull request.
</p>
<p align="center">
Consider donating at https://ko-fi.com/NullMeDev
</p>
<p align="center">
Made With &#x1F49C by NullMeDev.</p>

## Changelog

### v2.0.0 (May 27, 2025)
- **Added**: Version set update
- **Added**: Auto-update feature that checks for updates from GitHub repository
- **Added**: Discord notifications for update process (start, completion with changelog)
- **Added**: Compatibility check script for detecting system issues
- **Fixed**: Installation issues with Node.js on Ubuntu 24.04
- **Fixed**: Package dependency issues (node-agent-base, node-gyp, node-emoji-regex)
- **Updated**: Node.js installation to use Node.js 20.x LTS for Ubuntu 24.04 compatibility
- **Updated**: Package versions in package.json for better compatibility
- **Improved**: Installation script with better error handling and OS detection

### v1.0.0 (Initial Release)
- Discord integration with comprehensive command system
- OpenAI-powered chat responses with personality core
- BioLock security system for owner-only access
- IP/Port Whitelisting for enhanced API security
- SQLite database for event logging and data persistence
- Self-healing capabilities with automatic recovery
- Sentinel Intelligence with log monitoring and suspicious behavior detection
- Automated backup system with remote storage
