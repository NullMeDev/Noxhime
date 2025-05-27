#!/bin/bash
# Noxhime Bot - Automated Installation Script
# This script performs a complete installation of Noxhime Bot with all dependencies, 
# environment configuration, and setup of aliases

# ============================
# Noxhime Full Installation v1.0
# Phase 0 – Repository Setup
# Phase 1 – Dependencies Installation
# Phase 2 – Database Creation
# Phase 3 – Environment Configuration
# Phase 4 – System Integration
# Phase 5 – Alias Creation
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
    sudo apt-get install -y git curl wget nodejs npm sqlite3 build-essential
  elif command_exists yum; then
    status "RHEL/CentOS system detected"
    status "Installing required tools..."
    sudo yum install -y git curl wget nodejs npm sqlite3
  elif command_exists pacman; then
    status "Arch Linux detected"
    status "Installing required tools..."
    sudo pacman -Sy git curl wget nodejs npm sqlite3 base-devel --noconfirm
  else
    warn "Unsupported package manager. Please manually install: git, curl, nodejs, npm, sqlite3"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      error "Installation aborted"
    fi
  fi
  
  # Install global Node.js packages
  status "Installing TypeScript and PM2..."
  sudo npm install -g typescript ts-node pm2
  
  success "Prerequisites installed successfully"
}

# Function to clone the repository
clone_repository() {
  divider "PHASE 1: Repository Setup"
  
  # Get installation directory
  read -p "Enter installation directory [$DEFAULT_INSTALL_DIR]: " INSTALL_DIR
  INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}
  
  # Check if directory exists
  if [ -d "$INSTALL_DIR" ]; then
    warn "Directory $INSTALL_DIR already exists"
    read -p "Do you want to overwrite? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      read -p "Enter a different installation directory: " INSTALL_DIR
      if [ -z "$INSTALL_DIR" ]; then
        error "No installation directory provided"
      fi
    else
      status "Will overwrite existing files in $INSTALL_DIR"
    fi
  fi
  
  # Create directory if it doesn't exist
  mkdir -p "$INSTALL_DIR"
  
  # Clone the repository
  if [ -d "$INSTALL_DIR/.git" ]; then
    status "Git repository already exists, pulling latest changes..."
    cd "$INSTALL_DIR"
    git pull
  else
    status "Cloning Noxhime repository from $REPO_URL..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
  
  success "Repository setup complete"
}

# Function to install dependencies
install_dependencies() {
  divider "PHASE 2: Installing Dependencies"
  
  cd "$INSTALL_DIR"
  status "Installing Node.js dependencies..."
  npm install
  
  status "Installing system monitoring tools..."
  if command_exists apt-get; then
    sudo apt-get install -y monit fail2ban rclone
  elif command_exists yum; then
    sudo yum install -y monit fail2ban rclone
  elif command_exists pacman; then
    sudo pacman -Sy monit fail2ban rclone --noconfirm
  else
    warn "Please manually install: monit, fail2ban, rclone"
  fi
  
  success "Dependencies installed successfully"
}

# Function to set up the database
setup_database() {
  divider "PHASE 3: Setting Up Database"
  
  cd "$INSTALL_DIR"
  mkdir -p data
  
  status "Creating SQLite database..."
  if [ -f "db/schema.sql" ]; then
    sqlite3 data/noxhime.db < db/schema.sql
    success "Database created successfully"
  else
    error "Database schema file not found"
  fi
}

# Function to set up environment variables interactively
setup_environment() {
  divider "PHASE 4: Environment Configuration"
  
  cd "$INSTALL_DIR"
  ENV_FILE="$INSTALL_DIR/.env"
  
  # Check if .env already exists
  if [ -f "$ENV_FILE" ]; then
    warn ".env file already exists"
    read -p "Do you want to reconfigure? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      status "Keeping existing .env file"
      return
    fi
  fi
  
  # Create .env file with user input
  echo "# Noxhime Bot Environment Configuration" > "$ENV_FILE"
  echo "# Generated on $(date)" >> "$ENV_FILE"
  echo "" >> "$ENV_FILE"
  
  echo "# Discord Configuration" >> "$ENV_FILE"
  read -p "Enter Discord Bot Token: " DISCORD_TOKEN
  echo "DISCORD_TOKEN=$DISCORD_TOKEN" >> "$ENV_FILE"
  
  read -p "Enter Discord Channel ID for notifications: " NOTIFY_CHANNEL_ID
  echo "NOTIFY_CHANNEL_ID=$NOTIFY_CHANNEL_ID" >> "$ENV_FILE"
  
  read -p "Enter Your Discord User ID (owner): " OWNER_ID
  echo "OWNER_ID=$OWNER_ID" >> "$ENV_FILE"
  
  read -p "Enter Command Prefix [!]: " COMMAND_PREFIX
  COMMAND_PREFIX=${COMMAND_PREFIX:-!}
  echo "COMMAND_PREFIX=$COMMAND_PREFIX" >> "$ENV_FILE"
  
  echo "" >> "$ENV_FILE"
  echo "# OpenAI Configuration" >> "$ENV_FILE"
  read -p "Enter OpenAI API Key: " OPENAI_API_KEY
  echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> "$ENV_FILE"
  
  echo "" >> "$ENV_FILE"
  echo "# Database Configuration" >> "$ENV_FILE"
  echo "DATABASE_PATH=./data/noxhime.db" >> "$ENV_FILE"
  
  echo "" >> "$ENV_FILE"
  echo "# BioLock Security" >> "$ENV_FILE"
  read -p "Enable BioLock Security? (y/n) [y]: " -n 1 -r BIOLOCK_ENABLE
  echo
  BIOLOCK_ENABLED="true"
  if [[ ! $BIOLOCK_ENABLE =~ ^[Yy]$ ]]; then
    BIOLOCK_ENABLED="false"
  fi
  echo "BIOLOCK_ENABLED=$BIOLOCK_ENABLED" >> "$ENV_FILE"
  
  if [ "$BIOLOCK_ENABLED" = "true" ]; then
    read -p "Enter BioLock Passphrase: " BIOLOCK_PASSPHRASE
    echo "BIOLOCK_PASSPHRASE=$BIOLOCK_PASSPHRASE" >> "$ENV_FILE"
    
    read -p "Enter BioLock Emergency Override Key: " BIOLOCK_OVERRIDE_KEY
    echo "BIOLOCK_OVERRIDE_KEY=$BIOLOCK_OVERRIDE_KEY" >> "$ENV_FILE"
  fi
  
  echo "" >> "$ENV_FILE"
  echo "# Monitoring Configuration" >> "$ENV_FILE"
  read -p "Enable Monitoring? (y/n) [y]: " -n 1 -r MONIT_ENABLE
  echo
  MONIT_ENABLED="true"
  if [[ ! $MONIT_ENABLE =~ ^[Yy]$ ]]; then
    MONIT_ENABLED="false"
  fi
  echo "MONIT_ENABLED=$MONIT_ENABLED" >> "$ENV_FILE"
  echo "MONIT_PORT=5000" >> "$ENV_FILE"
  echo "PID_FILE_PATH=$INSTALL_DIR/noxhime.pid" >> "$ENV_FILE"
  echo "SELF_HEALING_ENABLED=true" >> "$ENV_FILE"
  echo "SYSTEM_STATS_INTERVAL=3600000" >> "$ENV_FILE"
  
  echo "" >> "$ENV_FILE"
  echo "# Sentinel Intelligence" >> "$ENV_FILE"
  read -p "Enable Sentinel Intelligence? (y/n) [y]: " -n 1 -r SENTINEL_ENABLE
  echo
  SENTINEL_ENABLED="true"
  if [[ ! $SENTINEL_ENABLE =~ ^[Yy]$ ]]; then
    SENTINEL_ENABLED="false"
  fi
  echo "SENTINEL_ENABLED=$SENTINEL_ENABLED" >> "$ENV_FILE"
  echo "LOG_WATCH_ENABLED=true" >> "$ENV_FILE"
  echo "AUTH_LOG_PATH=/var/log/auth.log" >> "$ENV_FILE"
  echo "SYSLOG_PATH=/var/log/syslog" >> "$ENV_FILE"
  
  # Make a backup of the env file
  mkdir -p "$INSTALL_DIR/data"
  cp "$ENV_FILE" "$INSTALL_DIR/data/env.backup"
  
  success "Environment configuration completed and backup created"
}

# Function to set up system integration
setup_system_integration() {
  divider "PHASE 5: System Integration"
  
  cd "$INSTALL_DIR"
  
  # Set up systemd service
  status "Setting up systemd service..."
  if [ -f "systemd/noxhime-bot.service" ]; then
    # Replace paths in service file
    cat systemd/noxhime-bot.service | \
    sed "s|WorkingDirectory=.*|WorkingDirectory=$INSTALL_DIR|g" | \
    sed "s|EnvironmentFile=.*|EnvironmentFile=$INSTALL_DIR/.env|g" | \
    sed "s|User=.*|User=$USER|g" > /tmp/noxhime-bot.service
    
    sudo mv /tmp/noxhime-bot.service /etc/systemd/system/noxhime-bot.service
    sudo systemctl daemon-reload
    
    # Set up Monit configuration
    if [ -f "monitor/noxhime.monit" ]; then
      cat monitor/noxhime.monit | \
      sed "s|pidfile.*|pidfile $INSTALL_DIR/noxhime.pid|g" > /tmp/noxhime.monit
      
      sudo mv /tmp/noxhime.monit /etc/monit/conf.d/noxhime.monit
      sudo chmod 644 /etc/monit/conf.d/noxhime.monit
    fi
    
    # Setup Fail2Ban integration
    if [ -f "scripts/fail2ban-discord.sh" ]; then
      sudo chmod +x "$INSTALL_DIR/scripts/fail2ban-discord.sh"
      
      sudo cat > /etc/fail2ban/action.d/noxhime-discord.conf << EOL
[Definition]
actionstart = 
actionstop = 
actioncheck = 
actionban = $INSTALL_DIR/scripts/fail2ban-discord.sh <name> <ip>
actionunban = 
EOL
    fi
    
    success "System integration completed"
  else
    warn "Systemd service file not found. Skipping system integration."
  fi
}

# Function to create aliases
create_aliases() {
  divider "PHASE 6: Creating Aliases"
  
  SHELL_RC=""
  if [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
  elif [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
  else
    warn "Could not find .bashrc or .zshrc. Aliases will not be created."
    return
  fi
  
  if [ -n "$SHELL_RC" ]; then
    status "Adding aliases to $SHELL_RC"
    
    # Check if aliases already exist
    if grep -q "# Noxhime Bot Aliases" "$SHELL_RC"; then
      warn "Noxhime aliases already exist in $SHELL_RC"
    else
      cat >> "$SHELL_RC" << EOL

# Noxhime Bot Aliases
alias noxhime-start="cd $INSTALL_DIR && npm start"
alias noxhime-monitor="cd $INSTALL_DIR && npm run monitor"
alias noxhime-logs="journalctl -u noxhime-bot -f"
alias noxhime-status="systemctl status noxhime-bot"
alias noxhime-restart="sudo systemctl restart noxhime-bot"
alias noxhime-config="nano $INSTALL_DIR/.env"
EOL
      success "Aliases created successfully"
      status "Run 'source $SHELL_RC' to load the aliases in your current session"
    fi
  fi
}

# Function to start services
start_services() {
  divider "PHASE 7: Starting Services"
  
  status "Starting monitoring services..."
  sudo systemctl enable monit
  sudo systemctl restart monit
  
  status "Starting Fail2Ban..."
  sudo systemctl enable fail2ban
  sudo systemctl restart fail2ban
  
  status "Starting Noxhime Bot..."
  sudo systemctl enable noxhime-bot
  sudo systemctl restart noxhime-bot
  
  success "All services started successfully"
}

# Main installation function
main() {
  clear
  echo -e "${CYAN}"
  echo "███╗   ██╗ ██████╗ ██╗  ██╗██╗  ██╗██╗███╗   ███╗███████╗"
  echo "████╗  ██║██╔═══██╗╚██╗██╔╝██║  ██║██║████╗ ████║██╔════╝"
  echo "██╔██╗ ██║██║   ██║ ╚███╔╝ ███████║██║██╔████╔██║█████╗  "
  echo "██║╚██╗██║██║   ██║ ██╔██╗ ██╔══██║██║██║╚██╔╝██║██╔══╝  "
  echo "██║ ╚████║╚██████╔╝██╔╝ ██╗██║  ██║██║██║ ╚═╝ ██║███████╗"
  echo "╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝"
  echo -e "${NC}"
  echo -e "${BOLD}Automated Installation Script${NC}"
  echo
  
  divider "Welcome to Noxhime Bot Installation"
  
  echo "This script will perform a complete installation of Noxhime Bot with:"
  echo "  • Repository cloning"
  echo "  • Dependency installation"
  echo "  • Database creation"
  echo "  • Interactive environment configuration"
  echo "  • System service integration"
  echo "  • Shell aliases setup"
  echo
  read -p "Press Enter to continue or Ctrl+C to cancel..."
  
  # Check if running as root
  check_root
  
  # Install prerequisites
  install_prerequisites
  
  # Clone repository
  clone_repository
  
  # Install dependencies
  install_dependencies
  
  # Set up database
  setup_database
  
  # Set up environment variables
  setup_environment
  
  # Set up system integration
  setup_system_integration
  
  # Create aliases
  create_aliases
  
  # Start services
  start_services
  
  divider "Installation Complete!"
  
  echo -e "${GREEN}Noxhime Bot has been successfully installed!${NC}"
  echo
  echo "You can now use the following aliases:"
  echo "  • noxhime-start: Start the bot manually"
  echo "  • noxhime-monitor: Launch the monitoring CLI"
  echo "  • noxhime-logs: View the bot logs"
  echo "  • noxhime-status: Check the bot's status"
  echo "  • noxhime-restart: Restart the bot"
  echo "  • noxhime-config: Edit the configuration file"
  echo
  echo "To reload your shell with the new aliases, run:"
  echo "  source ~/.bashrc"
  echo " (or the appropriate rc file for your shell)"
  echo
  echo -e "${YELLOW}Remember:${NC} You can always reconfigure the bot by running this script again."
  echo
}

# Run the installation
main "$@"
