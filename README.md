# Noxhime Bot

Autonomous Discord bot with system monitoring and OpenAI integration.

## Features

- Discord integration with command system
- OpenAI-powered chat responses
- BioLock security system for owner-only access
- SQLite database for event logging
- Notification system for bot status changes

## Setup Instructions

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials:
   - Discord Bot Token
   - OpenAI API Key
   - Owner Discord ID
4. Run the bot: `npm start`

## Commands

- `!status` - Check if bot is online
- `!whoami` - Shows your identity/role
- `!cmds` - Lists available commands
- `!ask <question>` - Ask the AI a question

Owner-only commands:
- `!restart` - Restart the bot
- `!lock` - Engage BioLock security system

## BioLock System

The BioLock system provides an additional layer of security. When enabled, the bot will only respond to basic commands until unlocked by the owner using the passphrase defined in the .env file.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
