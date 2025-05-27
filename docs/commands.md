# Noxhime Bot Command Reference

This document provides a comprehensive list of all available commands for the Noxhime Bot, organized by type and access level.

## Discord Commands

### General Commands (Available to All Users)

| Command | Description | Example |
|---------|-------------|---------|
| `!status` | Check if the bot is online | `!status` |
| `!whoami` | Display your role in relation to the bot | `!whoami` |
| `!uptime` | Show system and bot uptime information | `!uptime` |
| `!cmds` or `!commands` | List available commands | `!commands` |
| `!ask <question>` | Ask the bot a question using AI | `!ask What time is it in Tokyo?` |
| `!system` | Display system status and statistics | `!system` |
| `!services` | Check the status of system services | `!services` |
| `!mood` | See the bot's current emotional state | `!mood` |

### Owner-Only Commands

These commands can only be used by the Discord user ID specified in the OWNER_ID environment variable.

#### Security Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!lock` | Engage the BioLock security system | `!lock` |
| `!unlock <passphrase>` | Disengage the BioLock with the specified passphrase | `!unlock your_passphrase_here` |
| `!incidents` | View recent security incidents | `!incidents 10` |

#### System Management Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!restart` | Restart the bot | `!restart` |
| `!heal` | Trigger self-healing routine for memory optimization | `!heal` |
| `!logs <type> <count>` | View recent logs of specified type | `!logs SYSTEM 5` |
| `!backup` | Trigger manual backup | `!backup` |
| `!sentinel <action>` | Control sentinel monitoring system | `!sentinel start` |

#### Whitelist Management Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!whitelist help` | Show help for whitelist commands | `!whitelist help` |
| `!whitelist status` | Show current whitelist status | `!whitelist status` |
| `!whitelist enable ip` | Enable IP whitelisting | `!whitelist enable ip` |
| `!whitelist disable ip` | Disable IP whitelisting | `!whitelist disable ip` |
| `!whitelist enable port` | Enable port whitelisting | `!whitelist enable port` |
| `!whitelist disable port` | Disable port whitelisting | `!whitelist disable port` |
| `!whitelist add ip <address>` | Add an IP address to the whitelist | `!whitelist add ip 192.168.1.100` |
| `!whitelist remove ip <address>` | Remove an IP address from the whitelist | `!whitelist remove ip 192.168.1.100` |
| `!whitelist add port <number>` | Add a port to the whitelist | `!whitelist add port 3000` |
| `!whitelist remove port <number>` | Remove a port from the whitelist | `!whitelist remove port 3000` |
| `!whitelist list` | List all whitelisted IPs and ports | `!whitelist list` |

#### Mood Control Commands

These commands modify the bot's personality:

| Command | Description | Example |
|---------|-------------|---------|
| `!mood set <mood>` | Set the bot's mood | `!mood set happy` |

Available moods: `happy`, `focused`, `concerned`, `alert`, `playful`, `sarcastic`, `serious`

## Server-Side Commands

These are commands that can be executed on the server hosting the Noxhime Bot.

### Shell Aliases

After installation, these shell aliases are available:

| Alias | Description |
|-------|-------------|
| `noxhime-start` | Start the bot manually |
| `noxhime-logs` | View bot logs through PM2 |
| `noxhime-monitor` | Launch the monitoring interface |
| `noxhime-status` | Check the bot's systemd service status |
| `noxhime-restart` | Restart the bot's systemd service |

### Installation and Setup Commands

| Command | Description |
|---------|-------------|
| `./install-noxhime.sh` | Run the enhanced installer with IP/port whitelisting support |
| `./noxhime-installer.sh` | Run the original installer without whitelist configuration |
| `./quick-setup.sh` | Quick installation script |

### Monitoring and Testing Scripts

| Command | Description |
|---------|-------------|
| `./scripts/backup.sh` | Execute a manual backup |
| `./scripts/setup-monitoring.sh` | Set up monitoring with Monit |
| `./scripts/test-alerts.sh` | Test alert notifications |
| `./scripts/fail2ban-discord.sh` | Relay Fail2Ban events to Discord |
| `./scripts/test-whitelist.sh` | Test whitelist functionality |

### Systemd Service Commands

| Command | Description |
|---------|-------------|
| `sudo systemctl start noxhime-bot.service` | Start the bot service |
| `sudo systemctl stop noxhime-bot.service` | Stop the bot service |
| `sudo systemctl restart noxhime-bot.service` | Restart the bot service |
| `sudo systemctl status noxhime-bot.service` | Check the status of the bot service |
| `sudo systemctl enable noxhime-bot.service` | Enable the bot service to start on boot |
| `sudo systemctl disable noxhime-bot.service` | Disable automatic startup |

## API Endpoints

The Noxhime Bot also provides API endpoints for monitoring and integration:

| Endpoint | Description | Authentication |
|----------|-------------|----------------|
| `/api/status/public` | Public status information | None required |
| `/api/status` | Detailed bot status | API key required |
| `/api/incidents` | Recent security incidents | API key required |
