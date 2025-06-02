# Noxhime Status Page

A real-time status page for the Noxhime Discord bot, designed to be deployed on Cloudflare Pages.

## Setup

1. Push this directory to your GitHub repository
2. Connect your repository to Cloudflare Pages
3. Configure build settings:
   - Build command: (leave empty as no build required)
   - Build output directory: public
   - Environment variables: None required

## Development

To test locally:
```bash
cd public
python3 -m http.server 8000
```
Then visit http://localhost:8000

## API Integration

The status page expects the following endpoints:
- GET /status - Returns bot status and system stats
- GET /events - Returns recent events
- GET /incidents - Returns incident history

Example API response format:
```json
{
  "status": "online",
  "uptime": "5d 6h 23m",
  "cpuUsage": 45,
  "memoryUsage": 60,
  "events": [
    {
      "description": "System backup completed",
      "timestamp": "2025-06-01T12:00:00Z"
    }
  ],
  "incidents": [
    {
      "title": "High CPU Usage",
      "description": "CPU usage spike detected",
      "timestamp": "2025-06-01T10:30:00Z",
      "resolved": true
    }
  ]
}
```
