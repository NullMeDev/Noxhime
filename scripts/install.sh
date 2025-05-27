#!/bin/bash
# Noxhime Bot Installation Script
# This script performs a complete installation of Noxhime Bot with monitoring

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BOT_USER="nulladmin"
BOT_HOME="/home/$BOT_USER"
BOT_PATH="$BOT_HOME/noxhime-bot"

# ============================
# Noxhime Install Script v3
# Phase 0 – Hardened Setup + Validation
# Phase 1 – Core Resurrection
# Phase 2 – Server Awareness
# ============================

set -euo pipefail

# Validate required environment file
if [ ! -f ".env" ]; then
  echo "[!] Missing .env file. Please create it first."
  exit 1
fi

# Required tools
REQUIRED_CMDS=(node npm sqlite3 ts-node curl git)
for cmd in "${REQUIRED_CMDS[@]}"; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[!] Required command not found: $cmd"
    exit 1
  fi
done

# Install Node.js & build essentials
# Use Node.js 20.x for Ubuntu 24.04 compatibility
apt install -y ca-certificates curl gnupg
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt update
apt install -y nodejs build-essential

# Install TypeScript tools
echo "[+] Installing ts-node + typescript"
npm install -g typescript@latest ts-node@latest --no-fund --no-audit

# Install SQLite libs
echo "[+] Installing sqlite3"
apt install -y sqlite3 libsqlite3-dev

# Install NGINX and Certbot
echo "[+] Installing nginx & certbot"
apt install -y nginx certbot python3-certbot-nginx

# Install PM2
echo "[+] Installing PM2 for process management"
npm install -g pm2@latest --no-fund --no-audit

# Install Monit and Fail2Ban for system monitoring
echo "[+] Installing Monit and Fail2Ban"
apt install -y monit fail2ban

# Git & curl (safety)
apt install -y git curl

# Create user if doesn't exist
if ! id -u "$BOT_USER" &>/dev/null; then
  echo "[+] Creating $BOT_USER user"
  useradd -m -s /bin/bash "$BOT_USER"
fi

# Setup Noxhime project structure
echo "[+] Setting up project directory structure"
mkdir -p "$BOT_PATH"
mkdir -p "$BOT_PATH/data"
mkdir -p "$BOT_PATH/logs"

# Copy project files to installation directory
echo "[+] Copying project files"
cp -r "$PROJECT_ROOT"/* "$BOT_PATH/"
chown -R "$BOT_USER:$BOT_USER" "$BOT_PATH"

# Navigate to installation directory
cd "$BOT_PATH"

# Install project dependencies
echo "[+] Installing Node.js dependencies"
sudo -u "$BOT_USER" npm install --no-fund --legacy-peer-deps

# Create directories for PID file and logs
mkdir -p "$(dirname "$BOT_PATH/noxhime.pid")"
touch "$BOT_PATH/noxhime.pid"
chown "$BOT_USER:$BOT_USER" "$BOT_PATH/noxhime.pid"

# Migrate SQLite DB schema
echo "[+] Setting up SQLite database"
mkdir -p "$BOT_PATH/data"
if [ -f "$BOT_PATH/db/schema.sql" ]; then
  sudo -u "$BOT_USER" sqlite3 "$BOT_PATH/data/noxhime.db" < "$BOT_PATH/db/schema.sql"
else
  echo "[!] No DB schema found. Skipping DB setup."
fi

# Configure environment
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo "[+] Copying environment file"
  cp "$PROJECT_ROOT/.env" "$BOT_PATH/.env"
  chown "$BOT_USER:$BOT_USER" "$BOT_PATH/.env"
  
  # Create backup of working .env
  cp "$BOT_PATH/.env" "$BOT_PATH/data/env.backup"
  chown "$BOT_USER:$BOT_USER" "$BOT_PATH/data/env.backup"
else
  echo "[!] No .env file found. Please create one before starting the bot."
fi

# Setup monitoring
echo "[+] Setting up monitoring system"

# Copy Monit configuration
cp "$BOT_PATH/monitor/noxhime.monit" /etc/monit/conf-enabled/
chmod 644 /etc/monit/conf-enabled/noxhime.monit

# Copy Fail2Ban integration script
chmod +x "$BOT_PATH/scripts/fail2ban-discord.sh"

# Create Fail2Ban action configuration
cat > /etc/fail2ban/action.d/noxhime-discord.conf << EOL
[Definition]
actionstart = 
actionstop = 
actioncheck = 
actionban = $BOT_PATH/scripts/fail2ban-discord.sh <name> <ip>
actionunban = 
EOL

# Update common Fail2Ban jails
JAILS_TO_MONITOR=("sshd" "nginx-http-auth")

for JAIL in "${JAILS_TO_MONITOR[@]}"; do
  if grep -q "\\[$JAIL\\]" /etc/fail2ban/jail.local 2>/dev/null; then
    sed -i "/\\[$JAIL\\]/,/^$/s/action = .*/&\nnoxhime-discord/" /etc/fail2ban/jail.local
  fi
done

# Install systemd service
echo "[+] Installing systemd services"
cp "$BOT_PATH/systemd/noxhime-bot.service" /etc/systemd/system/
cp "$BOT_PATH/systemd/noxhime-update.service" /etc/systemd/system/
cp "$BOT_PATH/systemd/noxhime-update.timer" /etc/systemd/system/
systemctl daemon-reload

# Start services
echo "[+] Starting services"
systemctl enable monit
systemctl enable fail2ban
systemctl enable noxhime-bot
systemctl enable noxhime-update.timer

systemctl restart fail2ban
systemctl restart monit
systemctl restart noxhime-bot
systemctl start noxhime-update.timer

# Tag install point in git
if git rev-parse --git-dir > /dev/null 2>&1; then
  git tag phase2-installed
fi

echo "[✓] Noxhime Bot installation completed with Phase 2 features."
echo "    The bot should now be running with full monitoring capabilities."
echo "    Check status with: systemctl status noxhime-bot"
exit 0
