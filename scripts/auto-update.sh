#!/bin/bash
# Noxhime Bot Auto-Update Script
# This script performs an automatic update of Noxhime Bot from the repository
# It handles sending Discord notifications about the update process
# Note: This script assumes the repository was manually cloned and will not attempt to clone it

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

# Check if this is a git repository
if [ ! -d .git ]; then
  echo "[!] Not a git repository. Skipping update from remote repository."
  send_discord_notification "Update Process Note" "Not a git repository. Using local files only." "16776960"
else
  # Warning about GitHub authentication
  echo "[!] WARNING: The following git operations may require GitHub authentication if you haven't set up SSH keys or stored credentials."
  echo "[!] If you're prompted for authentication, you can press Ctrl+C to cancel."
  
  # Fetch latest changes with timeout
  echo "[+] Fetching latest changes from repository (with 30s timeout)..."
  if timeout 30s git fetch origin; then
    # Get the latest commit hash before pulling
    LATEST_REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "unknown")
    
    # Pull the latest changes with timeout
    echo "[+] Pulling latest changes from repository (with 30s timeout)..."
    if timeout 30s git pull origin main; then
      echo "[+] Successfully pulled latest changes."
    else
      echo "[!] Failed to pull latest changes. Continuing with existing repository state."
      send_discord_notification "Update Process Warning" "Failed to pull latest changes. Continuing with existing repository state." "16776960"
      # Set LATEST_REMOTE_COMMIT to current commit to skip the "already up-to-date" check
      LATEST_REMOTE_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    fi
  else
    echo "[!] Failed to fetch from remote repository. Continuing with existing repository state."
    send_discord_notification "Update Process Warning" "Failed to fetch from remote repository. Continuing with existing repository state." "16776960"
    # Set LATEST_REMOTE_COMMIT to current commit to skip the "already up-to-date" check
    LATEST_REMOTE_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  fi
fi

# Check if there were any changes, but only if we have valid commit hashes
if [ -n "$LATEST_REMOTE_COMMIT" ] && [ "$LATEST_REMOTE_COMMIT" != "unknown" ]; then
  if [ "$(git rev-parse HEAD 2>/dev/null || echo "unknown")" == "$LATEST_REMOTE_COMMIT" ]; then
    echo "[+] Already up-to-date!"
    send_discord_notification "No Updates Available" "Noxhime is already on the latest version." "65280"
    exit 0
  fi
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

# Ensure version manager exists
if [ ! -f "$PROJECT_ROOT/scripts/version-manager.sh" ]; then
  echo "[+] Version manager script not found. Creating it..."
  
  # Create the version manager script (simplified for auto-update.sh)
  mkdir -p "$PROJECT_ROOT/scripts"
  
  # Try to copy version manager from main repository with a timeout (this doesn't require auth)
  echo "[+] Attempting to download version manager script (with 10s timeout)..."
  if timeout 10s curl -s "https://raw.githubusercontent.com/NullMeDev/noxhime-bot/main/scripts/version-manager.sh" -o "$PROJECT_ROOT/scripts/version-manager.sh"; then
    echo "[+] Successfully downloaded version manager script."
  else
    echo "[!] Could not download version manager. Creating a minimal version..."
    cat > "$PROJECT_ROOT/scripts/version-manager.sh" << 'EOL'
#!/bin/bash
# Simplified version manager for auto-update
set -euo pipefail

VERSION_FILE="$(dirname "$(dirname "$(readlink -f "$0")")")/VERSION"
PACKAGE_JSON="$(dirname "$(dirname "$(readlink -f "$0")")")/package.json"

# Create VERSION file if it doesn't exist
if [ ! -f "$VERSION_FILE" ]; then
  echo "1.0.0" > "$VERSION_FILE"
fi

# Function to increment patch version
if [ "$1" == "--patch" ]; then
  version=$(cat "$VERSION_FILE")
  IFS='.' read -ra VERSION_PARTS <<< "$version"
  major="${VERSION_PARTS[0]}"
  minor="${VERSION_PARTS[1]}"
  patch="${VERSION_PARTS[2]}"
  patch=$((patch + 1))
  new_version="$major.$minor.$patch"
  echo "$new_version" > "$VERSION_FILE"
  
  # Update package.json if it exists
  if [ -f "$PACKAGE_JSON" ]; then
    sed -i 's/"version": "[^"]*"/"version": "'"$new_version"'"/' "$PACKAGE_JSON"
  fi
  
  echo "[✓] Updated version to $new_version"
fi
EOL
    chmod +x "$PROJECT_ROOT/scripts/version-manager.sh"
  }
fi

# Update version number with a patch increment
echo "[+] Incrementing patch version number..."
bash "$PROJECT_ROOT/scripts/version-manager.sh" --patch
CURRENT_VERSION=$(cat "$PROJECT_ROOT/VERSION" 2>/dev/null || echo "unknown")
echo "[+] Current version is now: $CURRENT_VERSION"

# Update README changelog if script exists and we have an actual version tag
if [ -f "$PROJECT_ROOT/scripts/update-changelog.sh" ] && [ "$LATEST_VERSION" != "latest commit" ]; then
  echo "[+] Updating README changelog..."
  
  # Extract version number without 'v' prefix
  VERSION_NUMBER=${LATEST_VERSION#v}
  
  # Parse commit messages to categorize changelog entries
  ADDED_ENTRIES=$(git log --pretty=format:"%s" "$PREVIOUS_VERSION..$LATEST_REMOTE_COMMIT" | grep -i "add\|feature\|new" | sed 's/^Add: //i; s/^Added: //i; s/^Feature: //i; s/^New: //i')
  FIXED_ENTRIES=$(git log --pretty=format:"%s" "$PREVIOUS_VERSION..$LATEST_REMOTE_COMMIT" | grep -i "fix\|bug\|issue" | sed 's/^Fix: //i; s/^Fixed: //i; s/^Bug: //i')
  UPDATED_ENTRIES=$(git log --pretty=format:"%s" "$PREVIOUS_VERSION..$LATEST_REMOTE_COMMIT" | grep -i "update\|upgrade\|bump" | sed 's/^Update: //i; s/^Updated: //i; s/^Upgrade: //i')
  IMPROVED_ENTRIES=$(git log --pretty=format:"%s" "$PREVIOUS_VERSION..$LATEST_REMOTE_COMMIT" | grep -i "improve\|enhance\|refactor" | sed 's/^Improve: //i; s/^Improved: //i; s/^Enhancement: //i')
  
  # Update changelog with categorized entries
  for entry in $ADDED_ENTRIES; do
    bash "$PROJECT_ROOT/scripts/update-changelog.sh" --version "$VERSION_NUMBER" --add "$entry" || echo "[!] Failed to add changelog entry"
  done
  
  for entry in $FIXED_ENTRIES; do
    bash "$PROJECT_ROOT/scripts/update-changelog.sh" --version "$VERSION_NUMBER" --fix "$entry" || echo "[!] Failed to add changelog entry"
  done
  
  for entry in $UPDATED_ENTRIES; do
    bash "$PROJECT_ROOT/scripts/update-changelog.sh" --version "$VERSION_NUMBER" --update "$entry" || echo "[!] Failed to add changelog entry"
  done
  
  for entry in $IMPROVED_ENTRIES; do
    bash "$PROJECT_ROOT/scripts/update-changelog.sh" --version "$VERSION_NUMBER" --improve "$entry" || echo "[!] Failed to add changelog entry"
  done
fi

# Send completion notification with changelog
send_discord_notification "Noxhime Update Complete ✅" "**Updated to version:** $LATEST_VERSION\n\n**Changelog:**\n$CHANGELOG" "65280"

echo "[✓] Update completed successfully!"
echo "[+] Updated from $PREVIOUS_VERSION to $LATEST_VERSION"

exit 0
