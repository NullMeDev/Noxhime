# Noxhime Bot

Autonomous Discord bot with system monitoring, security intelligence, and OpenAI integration with evolving personality.

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
- Sentinel Intelligence with log monitoring and suspicious behavior detection
- Automated backup system with Rclone integration
- Evolving Personality Core with mood-based responses

## Setup Instructions

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

## Commands

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

<div style="text-align: center; margin-top: 30px;">
  <p>
    Contributions are welcome, either request here, or email me at 
    <a href="mailto:null@nullme.dev">null@nullme.dev</a>! Please feel free to submit a pull request.
  </p>
  <p>
    Consider donating at <a href="https://ko-fi.com/NullMeDev" target="_blank">https://ko-fi.com/NullMeDev</a>
  </p>
  <p>
    Made With <span style="color: hotpink;">Love</span> by NullMeDev.
  </p>
</div>
