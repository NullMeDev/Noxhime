# Noxhime IP/Port Whitelisting

This document describes the IP and port whitelisting functionality implemented for the Noxhime bot.

## Overview

The Noxhime bot includes an IP and port whitelisting system that provides an additional layer of security for API access. This prevents unauthorized access to the bot's API endpoints by restricting access to specific IP addresses and ports.

## Features

- **IP Whitelisting**: Restrict API access to specific IP addresses
- **Port Whitelisting**: Restrict API access to specific ports
- **Discord Commands**: Manage whitelist settings directly via Discord commands
- **Configurable**: Enable/disable whitelisting through environment variables
- **Persistent**: Whitelist settings saved in a JSON configuration file

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```
# IP/Port Whitelisting
WHITELIST_ENABLED=true
WHITELIST_CONFIG_PATH=./config/whitelist.json
```

### Configuration File

The whitelist configuration is stored in a JSON file with the following format:

```json
{
  "ipWhitelist": {
    "enabled": true,
    "addresses": ["127.0.0.1", "192.168.1.100"]
  },
  "portWhitelist": {
    "enabled": true,
    "ports": [3000, 8080]
  }
}
```

## Discord Commands

The bot provides commands for managing the whitelist directly through Discord. Only the bot owner can use these commands.

### Available Commands

- `!whitelist help` - Show help information for whitelist commands
- `!whitelist status` - Show current whitelist status and configuration
- `!whitelist enable ip` - Enable IP whitelisting
- `!whitelist disable ip` - Disable IP whitelisting
- `!whitelist enable port` - Enable port whitelisting
- `!whitelist disable port` - Disable port whitelisting
- `!whitelist add ip <address>` - Add an IP address to the whitelist
- `!whitelist remove ip <address>` - Remove an IP address from the whitelist
- `!whitelist add port <number>` - Add a port to the whitelist
- `!whitelist remove port <number>` - Remove a port from the whitelist
- `!whitelist list` - List all whitelisted IPs and ports

### Example Usage

```
!whitelist status
!whitelist enable ip
!whitelist add ip 192.168.1.50
!whitelist add port 3000
!whitelist list
```

## Installation

During installation using the `install-noxhime.sh` script, you will be prompted to set up IP and port whitelisting:

1. Choose whether to enable IP whitelisting
2. If enabled, enter the IP addresses to whitelist
3. Choose whether to enable port whitelisting
4. If enabled, enter the ports to whitelist

## Testing

You can test the whitelisting functionality using the provided test script:

```bash
bash scripts/test-whitelist.sh
```

This script creates a test server with whitelist protection and tests different IP/port combinations to verify that access is correctly restricted.

## Implementation Details

The whitelist functionality is implemented in the following files:

- `src/whitelist.ts`: Main implementation of whitelist functionality
- `src/whitelist-commands.ts`: Discord commands for managing whitelist settings
- `src/api.ts`: Integration with the API server

The whitelist middleware checks both the IP address and port of incoming requests and blocks requests that don't match the whitelist configuration.
