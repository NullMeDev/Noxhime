#!/bin/bash
# Noxhime Bot - Enhanced Installation Script with Whitelisting
# This script performs a complete installation of Noxhime Bot with all dependencies, 
# environment configuration, system integration, and IP/port whitelisting

# ============================
# Noxhime Full Installation v2.0
# Phase 0 – Repository Setup
# Phase 1 – Dependencies Installation
# Phase 2 – Database Creation
# Phase 3 – Environment Configuration
# Phase 4 – System Integration
# Phase 5 – Alias Creation
# Phase 6 – IP/Port Whitelisting
# ============================

set -euo pipefail

# Text colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Default installation paths
DEFAULT_INSTALL_DIR="$HOME/noxhime-bot"
DEFAULT_BOT_USER="$USER"
REPO_URL="https://github.com/NullMeDev/noxhime-bot.git"

# Whitelist configuration
WHITELIST_CONFIG_PATH="./config/whitelist.json"

# Function to print colored status messages
status() {
  echo -e "${BLUE}[*]${NC} $1"
}

success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[!]${NC} $1"
}

error() {
  echo -e "${RED}[✗]${NC} $1"
  exit 1
}

divider() {
  echo -e "${PURPLE}=========================================${NC}"
  echo -e "${BOLD}$1${NC}"
  echo -e "${PURPLE}=========================================${NC}"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" &>/dev/null
}

# Function to check if running as root
check_root() {
  if [ "$(id -u)" -ne 0 ]; then
    warn "This script may need sudo privileges for system-level installations."
    read -p "Do you want to continue without sudo? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      error "Please run the script as root or with sudo."
    fi
  fi
}

# Function to install required tools based on the OS
install_prerequisites() {
  divider "PHASE 0: Installing Prerequisites"
  
  if command_exists apt-get; then
    status "Debian/Ubuntu system detected"
    status "Installing required tools..."
    sudo apt-get update
    
    # For Ubuntu 24.04 and newer, use the NodeSource repository for newer Node.js
    if [ -f /etc/os-release ]; then
      . /etc/os-release
      if [[ "$ID" == "ubuntu" && "${VERSION_ID%%.*}" -ge 24 ]]; then
        status "Ubuntu 24.04 or later detected, using NodeSource repository..."
        sudo apt-get install -y ca-certificates curl gnupg
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
        sudo apt-get update
      fi
    fi
    
    sudo apt-get install -y git curl wget nodejs npm sqlite3 build-essential
  elif command_exists yum; then
    status "RHEL/CentOS system detected"
    status "Installing required tools..."
    sudo yum install -y git curl wget nodejs npm sqlite3
  elif command_exists pacman; then
    status "Arch Linux detected"
    status "Installing required tools..."
    sudo pacman -Sy git curl wget nodejs npm sqlite3 base-devel --noconfirm
  elif command_exists brew; then
    status "macOS detected"
    status "Installing required tools..."
    brew install git curl nodejs npm sqlite3
  else
    warn "Unsupported package manager. Please manually install: git, curl, nodejs, npm, sqlite3"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      error "Installation aborted"
    fi
  fi
  
  # Install global Node.js packages with version controls
  status "Installing TypeScript and PM2..."
  sudo npm install -g typescript@latest ts-node@latest pm2@latest --no-fund --no-audit
  
  success "Prerequisites installed successfully!"
}

# Function to clone the repository
clone_repo() {
  divider "PHASE 0: Cloning Repository"
  
  if [ -d "$INSTALL_DIR" ]; then
    warn "Installation directory already exists: $INSTALL_DIR"
    read -p "Would you like to remove it and start fresh? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      status "Removing existing installation directory..."
      rm -rf "$INSTALL_DIR"
    else
      status "Will use existing directory. Some files may be overwritten."
    fi
  fi
  
  if [ ! -d "$INSTALL_DIR" ]; then
    status "Creating installation directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
  fi
  
  status "Cloning Noxhime Bot repository..."
  git clone "$REPO_URL" "$INSTALL_DIR" || error "Failed to clone repository"
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  success "Repository cloned successfully!"
}

# Function to install node dependencies
install_dependencies() {
  divider "PHASE 1: Installing Dependencies"
  
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  status "Installing Node.js dependencies..."
  npm install || error "Failed to install dependencies"
  
  success "Dependencies installed successfully!"
}

# Function to create the database
setup_database() {
  divider "PHASE 2: Setting Up Database"
  
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  status "Creating data directory..."
  mkdir -p ./data
  
  status "Setting up SQLite database..."
  if [ -f "./db/schema.sql" ]; then
    sqlite3 "./data/noxhime.db" < "./db/schema.sql" || error "Failed to create database schema"
  else
    error "Database schema file not found"
  fi
  
  success "Database setup completed!"
}

# Function to set up environment configuration
setup_environment() {
  divider "PHASE 3: Setting Up Environment Configuration"
  
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  status "Creating .env file..."
  
  if [ -f ".env" ]; then
    warn "A .env file already exists."
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      status "Keeping existing .env file."
      return
    fi
  fi
  
  # Use template if available, otherwise create from scratch
  if [ -f "./data/env.backup" ]; then
    cp "./data/env.backup" ".env" || error "Failed to create .env file from template"
  else
    cat > .env << EOL
# Discord Configuration
DISCORD_TOKEN=
CLIENT_ID=
OWNER_ID=
NOTIFY_CHANNEL_ID=
COMMAND_PREFIX=!

# OpenAI Configuration
OPENAI_API_KEY=

# Database Configuration
DATABASE_PATH=./data/noxhime.db

# BioLock Security
BIOLOCK_ENABLED=true
BIOLOCK_PASSPHRASE=
BIOLOCK_OVERRIDE_KEY=

# Monitoring Configuration
MONIT_ENABLED=true
MONIT_PORT=5000
PID_FILE_PATH=${INSTALL_DIR}/noxhime.pid
SELF_HEALING_ENABLED=true
SYSTEM_STATS_INTERVAL=3600000

# IP/PORT Whitelisting
WHITELIST_ENABLED=true
WHITELIST_CONFIG_PATH=./config/whitelist.json

# Auto-update Configuration
AUTO_UPDATE_ENABLED=true
AUTO_UPDATE_CHECK_INTERVAL=86400
DISCORD_WEBHOOK_URL=
EOL
  fi
  
  # Prompt for critical configuration values
  read -p "Enter Discord Bot Token: " discord_token
  read -p "Enter Discord Client ID: " client_id
  read -p "Enter Discord Owner ID: " owner_id
  read -p "Enter Discord Notification Channel ID: " notify_channel_id
  read -p "Enter OpenAI API Key: " openai_key
  read -p "Enter BioLock Passphrase: " biolock_passphrase
  
  # Generate a random override key if not provided
  biolock_override_key=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 20)
  
  # Update the .env file with provided values
  sed -i -e "s|DISCORD_TOKEN=.*|DISCORD_TOKEN=$discord_token|g" \
         -e "s|CLIENT_ID=.*|CLIENT_ID=$client_id|g" \
         -e "s|OWNER_ID=.*|OWNER_ID=$owner_id|g" \
         -e "s|NOTIFY_CHANNEL_ID=.*|NOTIFY_CHANNEL_ID=$notify_channel_id|g" \
         -e "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$openai_key|g" \
         -e "s|BIOLOCK_PASSPHRASE=.*|BIOLOCK_PASSPHRASE=\"$biolock_passphrase\"|g" \
         -e "s|BIOLOCK_OVERRIDE_KEY=.*|BIOLOCK_OVERRIDE_KEY=$biolock_override_key|g" .env
  
  success "Environment configuration completed!"
  success "BioLock Override Key: $biolock_override_key"
  status "IMPORTANT: Store this override key in a secure location!"
}

# Function to configure IP/Port whitelisting
setup_whitelist() {
  divider "PHASE 6: Setting Up IP/Port Whitelisting"
  
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  # Create config directory if it doesn't exist
  mkdir -p ./config
  
  # Ask for whitelist configuration
  echo "IP/Port Whitelisting Setup"
  echo "--------------------------"
  read -p "Enable IP whitelisting? (y/n): " -n 1 -r enable_ip_whitelist
  echo
  
  local ip_whitelist_enabled=false
  local ip_addresses=[]
  if [[ $enable_ip_whitelist =~ ^[Yy]$ ]]; then
    ip_whitelist_enabled=true
    
    echo "Enter IP addresses to whitelist (leave empty to finish):"
    local ip_arr="[]"
    while true; do
      read -p "IP Address (or press Enter to finish): " ip_addr
      if [ -z "$ip_addr" ]; then
        break
      fi
      
      # Add to the JSON array
      if [ "$ip_arr" == "[]" ]; then
        ip_arr="[\"$ip_addr\"]"
      else
        # Remove the closing bracket, add the new IP, and close the bracket again
        ip_arr="${ip_arr%]}, \"$ip_addr\"]"
      fi
    done
    ip_addresses=$ip_arr
  fi
  
  read -p "Enable port whitelisting? (y/n): " -n 1 -r enable_port_whitelist
  echo
  
  local port_whitelist_enabled=false
  local port_list=[]
  if [[ $enable_port_whitelist =~ ^[Yy]$ ]]; then
    port_whitelist_enabled=true
    
    echo "Enter ports to whitelist (leave empty to finish):"
    local port_arr="[]"
    while true; do
      read -p "Port (or press Enter to finish): " port
      if [ -z "$port" ]; then
        break
      fi
      
      # Add to the JSON array
      if [ "$port_arr" == "[]" ]; then
        port_arr="[$port]"
      else
        # Remove the closing bracket, add the new port, and close the bracket again
        port_arr="${port_arr%]}, $port]"
      fi
    done
    port_list=$port_arr
  fi
  
  # Create the whitelist configuration file
  cat > "$WHITELIST_CONFIG_PATH" << EOL
{
  "ipWhitelist": {
    "enabled": $ip_whitelist_enabled,
    "addresses": $ip_addresses
  },
  "portWhitelist": {
    "enabled": $port_whitelist_enabled,
    "ports": $port_list
  }
}
EOL
  
  success "Whitelist configuration completed!"
}

# Function to set up system integration (systemd service)
setup_system_integration() {
  divider "PHASE 4: Setting Up System Integration"
  
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  # Build TypeScript files
  status "Building TypeScript files..."
  npm run build || error "Failed to build TypeScript files"
  
  # Create systemd service
  status "Creating systemd service..."
  
  cat > noxhime-bot.service << EOL
[Unit]
Description=Noxhime Discord Bot
After=network.target

[Service]
Type=simple
User=$BOT_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which node) $INSTALL_DIR/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=noxhime-bot
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL
  
  # Install systemd service if running as root
  if [ "$(id -u)" -eq 0 ]; then
    mv noxhime-bot.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable noxhime-bot.service
    
    success "Systemd service installed and enabled!"
  else
    status "Created systemd service file: $INSTALL_DIR/noxhime-bot.service"
    status "To install, run the following commands as root:"
    echo -e "${CYAN}sudo mv $INSTALL_DIR/noxhime-bot.service /etc/systemd/system/${NC}"
    echo -e "${CYAN}sudo systemctl daemon-reload${NC}"
    echo -e "${CYAN}sudo systemctl enable noxhime-bot.service${NC}"
  fi
}

# Function to set up aliases
setup_aliases() {
  divider "PHASE 5: Setting Up Aliases"
  
  local aliases_file="$HOME/.bash_aliases"
  if [ -f "$HOME/.zshrc" ]; then
    aliases_file="$HOME/.zshrc"
  fi
  
  # Check if aliases already exist
  if grep -q "# Noxhime Bot Aliases" "$aliases_file"; then
    warn "Noxhime aliases already exist in $aliases_file"
  else
    status "Adding Noxhime aliases to $aliases_file..."
    
    cat >> "$aliases_file" << EOL

# Noxhime Bot Aliases
alias noxhime-start="cd $INSTALL_DIR && npm start"
alias noxhime-logs="cd $INSTALL_DIR && pm2 logs"
alias noxhime-monitor="cd $INSTALL_DIR && npm run monitor"
alias noxhime-status="systemctl status noxhime-bot"
alias noxhime-restart="systemctl restart noxhime-bot"
alias noxhime-update="cd $INSTALL_DIR && sudo bash ./scripts/auto-update.sh"
EOL
    
    success "Aliases added to $aliases_file!"
    status "You may need to restart your shell or run 'source $aliases_file' to use the aliases."
  fi
}

# Function to start the bot
start_bot() {
  divider "Starting Noxhime Bot"
  
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  if [ "$(id -u)" -eq 0 ]; then
    status "Starting systemd service..."
    systemctl start noxhime-bot.service
    sleep 2
    systemctl status noxhime-bot.service
  else
    status "To start the bot, run: 'sudo systemctl start noxhime-bot.service'"
    read -p "Would you like to start the bot manually now? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      status "Starting the bot..."
      pm2 start npm --name "noxhime" -- start
      success "Bot started with PM2! Use 'pm2 logs' to view logs."
    fi
  fi
}

# Main script execution
clear
echo -e "${BOLD}${CYAN}"
cat << "EOF"
 _   _            _     _                 ____        _   
| \ | | _____  __| |__ (_)_ __ ___   ___ | __ )  ___ | |_ 
|  \| |/ _ \ \/ /| '_ \| | '_ ` _ \ / _ \|  _ \ / _ \| __|
| |\  | (_) >  < | | | | | | | | | |  __/| |_) | (_) | |_ 
|_| \_|\___/_/\_\|_| |_|_|_| |_| |_|\___||____/ \___/ \__|
                                                           
EOF
echo -e "${NC}"
echo -e "${BOLD}Enhanced Installation Script with IP/Port Whitelisting${NC}"
echo

# Get installation options
read -p "Installation directory [$DEFAULT_INSTALL_DIR]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}

read -p "Bot user [$DEFAULT_BOT_USER]: " BOT_USER
BOT_USER=${BOT_USER:-$DEFAULT_BOT_USER}

# Confirm installation
echo
echo -e "${YELLOW}The bot will be installed with the following configuration:${NC}"
echo "Installation Directory: $INSTALL_DIR"
echo "Bot User: $BOT_USER"
echo
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Execute installation phases
install_prerequisites
clone_repo
install_dependencies
setup_database
setup_environment
setup_whitelist
setup_system_integration
setup_aliases
start_bot

divider "Installation Complete!"
success "Noxhime Bot has been successfully installed!"
echo
echo -e "${GREEN}=${NC} Use the following commands to manage the bot:"
echo -e "  ${CYAN}noxhime-start${NC}: Start the bot manually"
echo -e "  ${CYAN}noxhime-logs${NC}: View bot logs"
echo -e "  ${CYAN}noxhime-monitor${NC}: Launch the monitoring interface"
echo -e "  ${CYAN}noxhime-status${NC}: Check the bot's systemd service status"
echo -e "  ${CYAN}noxhime-restart${NC}: Restart the bot's systemd service"
echo
echo -e "${YELLOW}Don't forget your BioLock override key! It's saved in your .env file.${NC}"
echo -e "You can unlock the bot using the command: ${CYAN}!unlock <passphrase>${NC}"
echo

exit 0
