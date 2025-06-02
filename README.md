# Noxhime Discord Bot

A Discord bot with monitoring and alert capabilities.

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your credentials
3. Create the database using `database.schema.sql`
4. Install dependencies: `npm install`
5. Build the project: `npm run build`
6. Start the bot: `npm start`

## Configuration

The bot requires several environment variables to be set. Copy `.env.example` to `.env` and configure:

- Discord Bot credentials (token, client ID)
- Database configuration
- API settings
- Monitoring parameters

## Development

- Run tests: `npm test`
- Start in development mode: `npm run dev`
- Build: `npm run build`

## Directory Structure

```
.
├── src/           # Source code
├── dist/          # Compiled code
├── data/          # Data directory (gitignored)
├── backups/       # Backup directory (gitignored)
└── tests/         # Test files
```

## Testing

Run the test suite:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
