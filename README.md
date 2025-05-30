# Noxhime Bot

**Free and Open** Discord bot with system monitoring, security intelligence, IP/Port whitelisting, and evolving personality.

## Features

- **Open Access** - Free for everyone to use
- Discord integration with comprehensive command system
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
- **Node.js 18.x** compatible

## Setup Instructions

### Simple Installation

Use our simplified installer script:

```bash
sudo APP_NAME=noxhime-bot bash install.sh
```

This will:
- Install required dependencies
- Install the application to /opt/noxhime-bot
- Build the application
- Run database migrations

After installation, edit the configuration file:
```bash
sudo nano /opt/noxhime-bot/.env
```

### Docker Installation

A Dockerfile is included for containerized deployment:

1. Build the Docker image:
```bash
docker build -t noxhime-bot .
```

2. Run the container:
```bash
docker run -d --name noxhime \
  -e DISCORD_TOKEN=your_token_here \
  -e CLIENT_ID=your_client_id \
  -e NOTIFY_CHANNEL_ID=your_channel_id \
  -v noxhime-data:/app/data \
  noxhime-bot
```

3. For easier development and testing, use Docker Compose:

```bash
# Copy the example .env file if you haven't already
cp .env.example .env

# Edit the .env file with your Discord credentials
nano .env

# Start the application with Docker Compose
docker-compose up -d

# View logs in real-time
docker-compose logs -f

# To stop the application
docker-compose down
```

The included `docker-compose.yml` configures:
- Environment variables from your .env file
- Data persistence with volumes
- Exposed ports for the web dashboard (3000) and monitoring (5000)
- Development-friendly configuration options

### Manual Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials:
   - Discord Bot Token
   - Discord Client ID
   - Discord Channel ID for notifications
   - Monitoring settings
   - Sentinel Intelligence settings
   - Personality Core settings
4. Install required system tools:
   ```
   sudo apt update
   sudo apt install -y monit fail2ban rclone
   ```
5. Configure Rclone for remote backups (optional):
   ```
   rclone config
   # Follow the prompts to set up your desired remote (e.g., Google Drive)
   ```
6. Build the application:
   ```
   npm run build
   ```
7. Run the bot with PM2 for auto-restart:
   ```
   npm install -g pm2
   pm2 start npm --name "noxhime-bot" -- start
   pm2 save
   pm2 startup
   ```

## IP/Port Whitelisting

Noxhime Bot includes an advanced IP/Port whitelisting system for enhanced security. This prevents unauthorized access to the bot's API endpoints by restricting access to specific IP addresses and ports.

For detailed documentation on the whitelist feature, see [docs/whitelist.md](docs/whitelist.md).

## Commands

Noxhime Bot provides a comprehensive set of commands for Discord interaction and server management. All commands are now available to everyone.

See the complete [Command Reference](docs/commands.md) for a detailed list of:
- Discord commands
- Whitelist management commands (requires Discord admin permissions)
- Server-side management commands
- API endpoints (can be restricted via IP/Port whitelisting)

Here are some of the most commonly used commands:

- `!status` - Check if the bot is online
- `!system` - Display system status and statistics
- `!whitelist status` - Show current whitelist configuration (admin only)

### Available Commands

#### Discord Commands
- `!status` - Check if bot is online
- `!whoami` - Shows welcome message for all users
- `!cmds` - Lists available commands
- `!system` - Display system status and statistics
- `!uptime` - Shows system and bot uptime
- `!services` - Checks status of system services
- `!mood` - Shows bot's current emotional state
- `!logs <type> <count>` - View recent system logs
- `!incidents` - Views security incidents
- `!restart` - Restart the bot
- `!heal` - Trigger self-healing maintenance routine
- `!backup` - Triggers manual backup
- `!sentinel <start|stop>` - Controls sentinel monitoring
- `!link` - Get a one-time token for web dashboard access

### Admin-Only Commands (Discord Server Administrators)
- `!whitelist` commands - Manage IP/port whitelisting (requires Discord admin permissions)

### Security Model
- All commands are available to everyone
- Whitelist management requires Discord Administrator permissions in the server
- Web dashboard access is authenticated via one-time tokens and JWTs
- API endpoints can be restricted per installation with IP/Port whitelisting

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

## Sentinel Intelligence System

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

## Web Dashboard

Noxhime Bot includes a web dashboard for easy monitoring and management:

### Features
- ✅ Real-time system status monitoring
- ✅ Service status visualization
- ✅ Activity log viewer with filtering
- ✅ Command trigger interface
- ✅ One-time token authentication
- ✅ Mobile-responsive design with Tailwind CSS

### Security
- JWT authentication with short-lived tokens
- Optional IP/Port whitelisting for enhanced security

## Development and Contribution

Noxhime Bot is open source and welcomes contributions:

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/noxhime-bot.git`
3. Install dependencies: `npm install`
4. Create a `.env` file from `.env.example`
5. Run in development mode: `npm start`

### Pull Request Guidelines
1. Create a feature branch for your changes
2. Follow the existing code style
3. Add appropriate tests for your changes
4. Update documentation if necessary
5. Submit a pull request with a clear description of your changes

## License

Noxhime Bot is licensed under the ISC License.

## Support

For support or to report issues, please use the GitHub issue tracker or join our Discord server.

Happy monitoring!
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
