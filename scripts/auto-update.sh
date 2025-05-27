#!/bin/bash
# Noxhime Bot Auto-Update Script
# This script performs an automatic update of Noxhime Bot from the GitHub repository
# It handles sending Discord notifications about the update process

set -euo pipefail

# Directory setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
  source "$PROJECT_ROOT/.env"
fi

# Discord notification webhook URL - should be set in .env file
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

# Check if DISCORD_WEBHOOK_URL is set
if [ -z "$DISCORD_WEBHOOK_URL" ]; then
  echo "[!] DISCORD_WEBHOOK_URL is not set in .env file."
  echo "[!] Update notifications won't be sent to Discord."
fi

# Function to send Discord notifications
send_discord_notification() {
  local title="$1"
  local description="$2"
  local color="$3"  # Decimal color code: 16711680 (red), 65280 (green), 16776960 (yellow)
  
  if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    curl -s -H "Content-Type: application/json" \
      -d "{\"embeds\":[{\"title\":\"$title\",\"description\":\"$description\",\"color\":$color}]}" \
      "$DISCORD_WEBHOOK_URL" || echo "[!] Failed to send Discord notification"
  fi
}

# Function to generate changelog
generate_changelog() {
  local previous_tag="$1"
  local latest_commit="$2"
  
  # Get commit messages between previous tag and latest commit
  git log --pretty=format:"- %s" "$previous_tag..$latest_commit" || echo "No changes found"
}

# Start the update process
echo "[+] Starting Noxhime auto-update process..."

# Backup current version tag
PREVIOUS_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "unknown")
echo "[+] Current version: $PREVIOUS_VERSION"

# Send update starting notification to Discord
send_discord_notification "Noxhime Update Process Starting" "Noxhime is updating. Please wait..." "16776960"
sleep 2

# Fetch latest changes
echo "[+] Fetching latest changes from GitHub repository..."
git fetch origin

# Get the latest commit hash before pulling
LATEST_REMOTE_COMMIT=$(git rev-parse origin/main)

# Pull the latest changes
git pull origin main

# Check if there were any changes
if [ "$(git rev-parse HEAD)" == "$LATEST_REMOTE_COMMIT" ]; then
  echo "[+] Already up-to-date!"
  send_discord_notification "No Updates Available" "Noxhime is already on the latest version." "65280"
  exit 0
fi

echo "[+] Updated to latest version successfully."

# Install dependencies
echo "[+] Installing updated dependencies..."
npm install --no-fund --legacy-peer-deps

# Check for database schema updates
if [ -f "$PROJECT_ROOT/db/schema.sql" ]; then
  echo "[+] Checking for database updates..."
  # This is a simplified approach - in production you might want a more sophisticated 
  # migration system to avoid overwriting existing data
  # sqlite3 "$PROJECT_ROOT/data/noxhime.db" < "$PROJECT_ROOT/db/schema.sql"
fi

# Rebuild the project
echo "[+] Rebuilding the project..."
npm run build

# Restart services - as root
echo "[+] Restarting Noxhime Bot..."
if command -v systemctl &>/dev/null && [ -f "/etc/systemd/system/noxhime-bot.service" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    systemctl restart noxhime-bot.service
  else
    sudo systemctl restart noxhime-bot.service
  fi
else
  # Alternative restart method using PM2
  pm2 restart noxhime || echo "[!] Failed to restart with PM2, try manually restarting"
fi

# Generate changelog
echo "[+] Generating changelog..."
CHANGELOG=$(generate_changelog "$PREVIOUS_VERSION" "$LATEST_REMOTE_COMMIT")

# Get the latest tag if available
LATEST_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "latest commit")

# Send completion notification with changelog
send_discord_notification "Noxhime Update Complete ✅" "**Updated to version:** $LATEST_VERSION\n\n**Changelog:**\n$CHANGELOG" "65280"

echo "[✓] Update completed successfully!"
echo "[+] Updated from $PREVIOUS_VERSION to $LATEST_VERSION"

exit 0
