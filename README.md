# Noxhime Bot

**Free and Open** Discord bot with system monitoring, security intelligence, IP/Port whitelisting, and OpenAI integration with evolving personality.

## Features

- **Open Access** - Free for everyone to use with user-level security
- Discord integration with comprehensive command system
- OpenAI-powered chat responses
- **BioLock v2** - User-level authentication for sensitive commands
  - Individual user authentication via Discord DMs
  - Emergency override capabilities
  - Session management and timeouts
  - Audit logging for security events
- **Real-time Web Dashboard** - Monitor and control your bot
  - System status tiles with real-time updates
  - Command trigger panel for remote administration
  - Activity log and service status monitoring
  - Mobile-responsive design with Tailwind CSS
- **IP/Port Whitelisting** for API security (configurable per installation)
  - Restrict API access to specific IP addresses and ports
  - Manage whitelist via Discord admin commands
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
- **Optimized for Ubuntu 24.04** with Node.js 18.x

## Setup Instructions

### Option 1: Ubuntu 24.04 Installer (Recommended)

Use our optimized installer script for Ubuntu 24.04 with Node.js 18.x:

```bash
chmod +x install-ubuntu24.sh
./install-ubuntu24.sh
```

This will:
- Check for Ubuntu 24.04 compatibility
- Install Node.js 18.x (if not already installed)
- Skip already installed packages for faster setup
- Clone the repository
- Install all dependencies
- Create the database
- Guide you through configuration with interactive prompts
- Configure IP/Port whitelisting for enhanced security
- Set up systemd services and monitoring
- Build the web dashboard

The installer supports several options:
```bash
./install-ubuntu24.sh --dir=/path/to/install --no-systemd --no-start --verbose
```

### Option 2: Cleanup After Installation

After installation, run the cleanup script to optimize your installation:

```bash
chmod +x cleanup.sh
./cleanup.sh
```

This will:
- Remove unnecessary files
- Optimize dependencies
- Ensure Node.js 18.x compatibility
- Verify the installation works correctly

### Option 3: Manual Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials:
   - Discord Bot Token
   - OpenAI API Key
   - Discord Channel ID for notifications
   - Monitoring settings
   - Sentinel Intelligence settings
   - Personality Core settings
   - **Note**: No owner ID needed - bot is open access
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

Noxhime Bot provides a comprehensive set of commands for Discord interaction and server management. Regular commands are available to everyone, while sensitive operations require BioLock v2 authentication.

See the complete [Command Reference](docs/commands.md) for a detailed list of:
- Discord commands available to all users
- BioLock-protected commands requiring authentication
- Whitelist management commands (requires Discord admin permissions)
- Server-side management commands
- API endpoints (can be restricted via IP/Port whitelisting)

Here are some of the most commonly used commands:

- `!status` - Check if the bot is online
- `!ask <question>` - Ask the bot a question using AI
- `!system` - Display system status and statistics
- `!whitelist status` - Show current whitelist configuration (admin only)

### Available Commands

#### Regular Commands (No Authentication Required)
- `!status` - Check if bot is online
- `!whoami` - Shows welcome message for all users
- `!cmds` - Lists available commands
- `!ask <question>` - Ask the AI a question
- `!system` - Display system status and statistics
- `!uptime` - Shows system and bot uptime
- `!services` - Checks status of system services
- `!mood` - Shows bot's current emotional state
- `!logs <type> <count>` - View recent system logs
- `!incidents` - Views security incidents

#### BioLock Protected Commands (Require Authentication)
- `!unlock` - Authenticate with BioLock
- `!lock` - Lock your BioLock session
- `!override [passphrase]` - Emergency override for urgent access
- `!restart` - Restart the bot
- `!heal` - Trigger self-healing maintenance routine
- `!backup` - Triggers manual backup
- `!sentinel <start|stop>` - Controls sentinel monitoring
- `!purge` - Purge messages or data

#### Web Dashboard Commands
- `!link` - Get a one-time token for web dashboard access

### Admin-Only Commands (Discord Server Administrators)
- `!whitelist` commands - Manage IP/port whitelisting (requires Discord admin permissions)

## Authentication and Security

**Noxhime Bot uses BioLock v2 for user-level command protection!**

### BioLock v2 Security System

BioLock v2 is a user-level authentication system that protects sensitive commands from unauthorized use. Unlike global authentication systems, BioLock v2 is designed to provide individualized security for each user of the bot.

#### Key Features
- **User-Level Authentication**: Each user has their own BioLock profile
- **Multiple Security States**: Supports locked, pending, unlocked, and emergency override states
- **Discord-Based Authentication**: Authentication happens through secure Discord DMs
- **Audit Logging**: Comprehensive logging of all authentication events
- **Emergency Override**: Secure backup method for urgent access

#### Protected Commands
The following commands are protected by BioLock v2 and require authentication:
- `!restart` - Restart the bot
- `!heal` - Trigger self-healing routine
- `!backup` - Trigger manual backup
- `!sentinel <start|stop>` - Control the Sentinel monitoring system
- `!whitelist <action>` - Manage server whitelist
- `!purge` - Purge messages or data
- `!self-destruct` - Initiate self-destruct sequence (if implemented)

### Current Access Model
- **Regular commands** are available to everyone
- **Sensitive commands** require BioLock authentication
- **Whitelist management** requires Discord Administrator permissions in the server
- **Web dashboard access** is authenticated via one-time tokens and JWTs
- **API endpoints** can be restricted per installation with IP/Port whitelisting

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

## Web Interface Dashboard (Phase 7)

Noxhime includes a real-time, identity-aware web dashboard that provides:

### Features
- **Real-time System Monitoring**: Live updates of CPU, memory, disk usage, and uptime
- **Bot Status**: Current status, mood, and uptime information
- **Command Trigger Panel**: Execute administrative commands directly from the dashboard
- **Activity Log**: View recent events and system logs in real-time
- **Service Status**: Monitor the health of system services
- **User-Specific Views**: Each user has their own authenticated dashboard
- **Secure Authentication**: Discord-linked JWT authentication with one-time tokens
- **Mobile Responsive**: Works well on phones and low-power devices

### Authentication
To access the dashboard:
1. Use the `!link` command in Discord to receive a one-time token via DM
2. Enter the token on the dashboard login screen
3. Your session will be authenticated and linked to your Discord ID

### Technologies
- Socket.IO for real-time updates
- JWT for secure authentication
- Tailwind CSS for responsive design
- Express.js backend API

### Dashboard URL
Access your dashboard at the URL specified in your .env file (default: http://localhost:3000)

<p align="center">
Contributions are welcome, either request here, or email me at null@nullme.dev! Please feel free to submit a pull request.
</p>
<p align="center">
Consider donating at https://ko-fi.com/NullMeDev
</p>
<p align="center">
Made With &#x1F49C by NullMeDev.</p>

## Changelog

### v3.1.0 (May 29, 2025)
- **Enhanced**: BioLock v2 with additional security features
  - Multiple security states (locked, pending, unlocked, override)
  - Emergency override functionality with secure passphrase
  - Comprehensive audit logging
  - Improved session management with configurable timeouts
- **Added**: Real-time Web Dashboard (Phase 7)
  - System status tiles with real-time updates via Socket.IO
  - Command trigger panel for remote administration
  - Activity log and service status monitoring
  - JWT authentication linked to Discord ID
  - Mobile-responsive design with Tailwind CSS
- **Added**: New install-ubuntu24.sh script optimized for Ubuntu 24.04
  - Specific Node.js 18.x installation
  - Skips already installed packages
  - Improved error handling and verification
- **Added**: cleanup.sh and cleanup.ps1 scripts for removing unnecessary files
- **Removed**: Unnecessary installation scripts and dependencies
- **Optimized**: Package.json to include only required dependencies
- **Fixed**: Node.js compatibility issues with version 18.x
- **Updated**: Documentation to reflect new features and changes

### v3.0.0 (May 28, 2025)
- **MAJOR CHANGE**: Introduced BioLock v2 with user-level authentication
- **Added**: BioLock v2 framework for per-user command protection
- **Added**: User-specific authentication sessions via Discord DMs
- **Added**: Web dashboard foundation with Express API
- **Changed**: Command protection from global/owner-only to granular user-level
- **Changed**: Authentication model from global to per-user security profiles
- **Updated**: Documentation and installation scripts
- **Updated**: Environment configuration for new security model

### v2.1.0 (May 28, 2025)
- **MAJOR CHANGE**: Removed the original BioLock v1 global authentication system
- **Removed**: Original BioLock security system that was owner-only
- **Removed**: Owner ID requirements and global command restrictions
- **Changed**: API endpoints now protected by IP/Port whitelist instead of API keys
- **Changed**: Whitelist management now requires Discord Administrator permissions instead of owner-only
- **Updated**: More commands available to regular users
- **Updated**: Documentation and installation scripts to reflect the new model
- **Updated**: Environment configuration to prepare for user-level authentication

### v2.0.1 (May 28, 2025)
- **Fixed**: ASCII artwork display issues in install scripts
- **Fixed**: Script variable ordering and undefined PROJECT_ROOT error
- **Improved**: Version number positioning in ASCII art output
- **Updated**: Install script flow and variable definitions

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
