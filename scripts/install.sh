#!/bin/bash

# ============================
# Noxhime Install Script v2
# Phase 0 – Hardened Setup + Validation
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
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs build-essential

# Install TypeScript tools
echo "[+] Installing ts-node + typescript"
npm install -g typescript ts-node

# Install SQLite libs
echo "[+] Installing sqlite3"
apt install -y sqlite3 libsqlite3-dev

# Install NGINX and Certbot
echo "[+] Installing nginx & certbot"
apt install -y nginx certbot python3-certbot-nginx

# Install PM2
npm install -g pm2

# Git & curl (safety)
apt install -y git curl

# Setup Noxhime project structure
mkdir -p /home/nulladmin/noxhime-bot
cd /home/nulladmin/noxhime-bot

# Install project dependencies
pnpm install || npm install

# Migrate SQLite DB schema if needed
if [ -f ./db/schema.sql ]; then
  echo "[+] Creating initial SQLite DB"
  sqlite3 ./data/noxhime.db < ./db/schema.sql
else
  echo "[!] No DB schema found at ./db/schema.sql. Skipping DB setup."
fi

# Create backup of working .env
cp .env ./data/env.backup

# Tag install point in git
if git rev-parse --git-dir > /dev/null 2>&1; then
  git tag phase0-installed
fi

echo "[✓] Noxhime install script completed."
exit 0
