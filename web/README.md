# Noxhime Web Dashboard

A real-time, identity-aware dashboard for monitoring and controlling your Noxhime Discord bot.

![Noxhime Dashboard](https://github.com/NullMeDev/noxhime-bot/raw/main/docs/dashboard-preview.png)

## Features

- **Real-time System Monitoring**: View CPU, memory, disk usage, and uptime
- **Bot Status**: See your bot's current status, mood, and uptime
- **Command Trigger Panel**: Execute admin commands directly from the dashboard
- **Activity Log**: View recent events and system logs
- **Service Status**: Monitor the health of system services
- **User-Specific Views**: Each user has their own dashboard view
- **Secure Authentication**: Discord-linked JWT authentication
- **Mobile Responsive**: Works well on phones and low-power devices

## Installation

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- Noxhime Discord bot v3.0.0 or higher

### Setup

1. **Install Dependencies**

   The dashboard is included in the main Noxhime bot package. Make sure all dependencies are installed:

   ```bash
   npm install
   ```

2. **Build the Web Interface**

   Build the Tailwind CSS for the dashboard:

   ```bash
   npm run build:web
   ```

   This will compile the CSS from `web/src/styles.css` to `web/public/styles.css`.

3. **Configure Environment Variables**

   In your `.env` file, make sure you have the following variables set:

   ```
   # Web Dashboard Configuration
   API_ENABLED=true
   API_PORT=3000
   API_KEYS=your_secret_key_here
   JWT_SECRET=generate_a_secure_random_string_here
   DASHBOARD_URL=http://your-server-ip:3000
   ```

   Generate a secure random string for `JWT_SECRET` using a tool like:

   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

4. **Start the Bot**

   When you start the Noxhime bot, the web dashboard will automatically start:

   ```bash
   npm start
   ```

   You should see a message indicating that the API server with Socket.IO started successfully.

## Usage

### Accessing the Dashboard

1. **Get a Token**

   In Discord, use the `!link` command to request an access token. The bot will send you a one-time token via DM.

2. **Login to Dashboard**

   - Visit `http://your-server-ip:3000` (or the URL specified in `DASHBOARD_URL`)
   - Enter the token you received via Discord
   - Click "Authenticate"

3. **Session Duration**

   Your session will be active for 30 minutes. After that, you'll need to request a new token using `!link`.

### Dashboard Sections

#### System Status

Real-time monitoring of:
- CPU usage
- Memory usage
- Disk usage
- System uptime
- Last restart time

#### Command Panel

Execute administrative commands:
- Restart Bot: Restarts the Discord bot
- Run Self-Healing: Triggers memory optimization and self-repair
- Manual Backup: Initiates a backup of the bot's data
- Sentinel Controls: Start or stop the Sentinel monitoring system

#### Mood Panel

View the bot's current emotional state:
- Current mood
- Intensity level
- Duration of current mood

#### Service Status

Monitor the status of system services:
- Running/stopped status
- Memory usage (when available)
- Service name

#### Activity Log

View recent system events:
- Event type
- Timestamp
- Details

## Security Considerations

### Authentication

- Tokens are one-time use only and expire after 30 minutes
- JWT authentication ensures secure sessions
- All sensitive operations require BioLock authentication in Discord first

### Best Practices

1. **Host Securely**: Ideally, host the dashboard behind a reverse proxy with HTTPS
2. **Firewall Rules**: Limit access to the dashboard port to trusted IPs
3. **Regular Token Rotation**: Request a new token for each session
4. **Keep API Keys Secret**: Never share your API keys or JWT secret

### IP Whitelisting

To restrict access to specific IP addresses, configure the whitelist in your `.env` file:

```
WHITELIST_ENABLED=true
WHITELIST_CONFIG_PATH=./config/whitelist.json
```

And create a whitelist.json file:

```json
{
  "allowedIPs": ["192.168.1.100", "10.0.0.5"],
  "allowedRanges": ["192.168.1.0/24"]
}
```

## Troubleshooting

### Common Issues

1. **Dashboard Not Loading**
   - Check that the API server is running (`API_ENABLED=true` in .env)
   - Verify the correct port is being used and is not blocked by a firewall

2. **Authentication Failed**
   - Tokens are one-time use only - request a new one with `!link`
   - Tokens expire after 30 minutes
   - Make sure your clock is in sync (JWT validation is time-sensitive)

3. **Real-Time Updates Not Working**
   - Check that Socket.IO is not blocked by any proxy or firewall
   - Try refreshing the page to re-establish the connection

4. **Command Execution Failing**
   - Verify you have proper BioLock permissions in Discord
   - Check the bot's console for error messages

## Extending the Dashboard

The dashboard is built with:
- Express.js for the backend API
- Socket.IO for real-time communication
- Tailwind CSS for styling
- Vanilla JavaScript for the frontend

To add new features, modify the following files:
- `src/api.ts`: Backend API endpoints and Socket.IO events
- `web/public/index.html`: Dashboard layout and structure
- `web/public/dashboard.js`: Frontend JavaScript for interactivity
- `web/src/styles.css`: Tailwind CSS styles

## License

Same as the main Noxhime bot - see the root LICENSE file for details.

