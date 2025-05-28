#!/bin/bash
# Noxhime Bot - Unified Installation Script
# This script performs a complete installation of Noxhime Bot with customizable options

# ============================
# Noxhime Unified Installation v1.0
# Phase 0 – Prerequisites & Environment Setup
# Phase 1 – Core Installation
# Phase 2 – Database Setup
# Phase 3 – Environment Configuration
# Phase 4 – System Integration & Monitoring
# Phase 5 – Service Startup
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

# Default configuration
DEFAULT_INSTALL_DIR="$HOME/noxhime-bot"
DEFAULT_BOT_USER="$USER"
REPO_URL="https://github.com/NullMeDev/noxhime-bot.git"

# Installation options (will be set by user prompts)
INSTALL_TYPE=""
INSTALL_DIR=""
BOT_USER=""
INSTALL_MONITORING=""
INSTALL_SYSTEMD=""
INSTALL_NGINX=""
USE_EXISTING_ENV=""

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
  if [ "$(id -u)" -eq 0 ]; then
    warn "Running as root. This is recommended for system-wide installations."
  else
    warn "Not running as root. Some features may require sudo privileges."
  fi
}

# Function to display the main menu
show_main_menu() {
  divider "NOXHIME BOT INSTALLATION"
  echo -e "${CYAN}Choose your installation type:${NC}"
  echo
  echo "1. Quick Setup (Basic installation, local user)"
  echo "2. Development Setup (Local development with dependencies)"
  echo "3. Production Setup (Full system integration with monitoring)"
  echo "4. Custom Setup (Choose your own options)"
  echo "5. Exit"
  echo
  read -p "Enter your choice [1-5]: " -n 1 -r INSTALL_CHOICE
  echo
  
  case $INSTALL_CHOICE in
    1)
      INSTALL_TYPE="quick"
      INSTALL_DIR="$DEFAULT_INSTALL_DIR"
      BOT_USER="$DEFAULT_BOT_USER"
      INSTALL_MONITORING="false"
      INSTALL_SYSTEMD="false"
      INSTALL_NGINX="false"
      ;;
    2)
      INSTALL_TYPE="development"
      INSTALL_DIR="$DEFAULT_INSTALL_DIR"
      BOT_USER="$DEFAULT_BOT_USER"
      INSTALL_MONITORING="true"
      INSTALL_SYSTEMD="false"
      INSTALL_NGINX="false"
      ;;
    3)
      INSTALL_TYPE="production"
      INSTALL_DIR="/opt/noxhime-bot"
      BOT_USER="nulladmin"
      INSTALL_MONITORING="true"
      INSTALL_SYSTEMD="true"
      INSTALL_NGINX="true"
      ;;
    4)
      INSTALL_TYPE="custom"
      setup_custom_options
      ;;
    5)
      exit 0
      ;;
    *)
      error "Invalid choice. Please run the script again."
      ;;
  esac
}

# Function to setup custom installation options
setup_custom_options() {
  echo -e "${CYAN}Custom Installation Setup:${NC}"
  echo
  
  # Installation directory
  read -p "Installation directory [$DEFAULT_INSTALL_DIR]: " CUSTOM_INSTALL_DIR
  INSTALL_DIR="${CUSTOM_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
  
  # Bot user
  read -p "Bot user [$DEFAULT_BOT_USER]: " CUSTOM_BOT_USER
  BOT_USER="${CUSTOM_BOT_USER:-$DEFAULT_BOT_USER}"
  
  # Monitoring
  read -p "Install monitoring (Monit, Fail2Ban)? (y/n) [n]: " MONITORING_REPLY
  INSTALL_MONITORING="false"
  [[ $MONITORING_REPLY =~ ^[Yy]$ ]] && INSTALL_MONITORING="true"
  
  # Systemd services
  read -p "Install systemd services? (y/n) [n]: " SYSTEMD_REPLY
  INSTALL_SYSTEMD="false"
  [[ $SYSTEMD_REPLY =~ ^[Yy]$ ]] && INSTALL_SYSTEMD="true"
  
  # Nginx
  read -p "Install and configure Nginx? (y/n) [n]: " NGINX_REPLY
  INSTALL_NGINX="false"
  [[ $NGINX_REPLY =~ ^[Yy]$ ]] && INSTALL_NGINX="true"
}

# Function to confirm installation settings
confirm_installation() {
  divider "INSTALLATION SUMMARY"
  echo -e "${CYAN}Installation Type:${NC} $INSTALL_TYPE"
  echo -e "${CYAN}Installation Directory:${NC} $INSTALL_DIR"
  echo -e "${CYAN}Bot User:${NC} $BOT_USER"
  echo -e "${CYAN}Monitoring:${NC} $INSTALL_MONITORING"
  echo -e "${CYAN}Systemd Services:${NC} $INSTALL_SYSTEMD"
  echo -e "${CYAN}Nginx:${NC} $INSTALL_NGINX"
  echo
  read -p "Continue with this configuration? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Installation cancelled by user."
  fi
}

# Function to install prerequisites
install_prerequisites() {
  divider "PHASE 0: Installing Prerequisites"
  
  # Install NVM and Node.js 18 (Ubuntu 24.04 compatible)
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    status "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 18
  nvm use 18
  
  # Install global Node.js packages
  status "Installing global Node.js packages..."
  npm install -g typescript@latest ts-node@latest pm2@latest --no-fund --no-audit
  
  # Install system packages
  if command_exists apt-get; then
    status "Installing system packages (apt)..."
    sudo apt-get update
    sudo apt-get install -y git curl sqlite3 libsqlite3-dev build-essential
    
    if [ "$INSTALL_MONITORING" = "true" ]; then
      sudo apt-get install -y monit fail2ban
    fi
    
    if [ "$INSTALL_NGINX" = "true" ]; then
      sudo apt-get install -y nginx certbot python3-certbot-nginx
    fi
  elif command_exists yum; then
    status "Installing system packages (yum)..."
    sudo yum install -y git curl sqlite3 sqlite-devel
    
    if [ "$INSTALL_MONITORING" = "true" ]; then
      sudo yum install -y epel-release
      sudo yum install -y monit fail2ban
    fi
    
    if [ "$INSTALL_NGINX" = "true" ]; then
      sudo yum install -y nginx certbot python3-certbot-nginx
    fi
  else
    warn "Unsupported package manager. Please install manually: git, curl, sqlite3"
  fi
  
  success "Prerequisites installed successfully!"
}

# Function to clone repository
clone_repository() {
  divider "PHASE 1: Repository Setup"
  
  if [ -d "$INSTALL_DIR" ]; then
    warn "Installation directory already exists: $INSTALL_DIR"
    read -p "Remove existing directory and start fresh? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      status "Removing existing installation directory..."
      rm -rf "$INSTALL_DIR"
    else
      status "Using existing directory. Some files may be overwritten."
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

# Function to install dependencies
install_dependencies() {
  divider "PHASE 1: Installing Dependencies"
  
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  # Ensure NVM is available for npm install
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm use 18
  
  status "Installing Node.js dependencies..."
  npm install --no-fund --no-audit || error "Failed to install dependencies"
  
  success "Dependencies installed successfully!"
}

# Function to setup database
setup_database() {
  divider "PHASE 2: Setting Up Database"
  
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  status "Creating data directory..."
  mkdir -p ./data
  
  status "Setting up SQLite database..."
  if [ -f "./db/schema.sql" ]; then
    sqlite3 "./data/noxhime.db" < "./db/schema.sql" || error "Failed to create database schema"
    success "Database setup completed!"
  else
    warn "Database schema file not found. Skipping database setup."
  fi
}

# Function to setup environment
setup_environment() {
  divider "PHASE 3: Environment Configuration"
  
  cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
  
  # Check if .env already exists
  if [ -f ".env" ]; then
    warn ".env file already exists"
    read -p "Do you want to use the existing .env file? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      USE_EXISTING_ENV="true"
      success "Using existing .env file."
      return
    fi
  fi
  
  echo -e "${CYAN}Choose environment setup method:${NC}"
  echo "1. Use provided test keys (for testing only)"
  echo "2. Enter configuration manually"
  echo "3. Skip environment setup"
  echo
  read -p "Enter your choice [1-3]: " -n 1 -r ENV_CHOICE
  echo
  
  case $ENV_CHOICE in
    1)
      setup_test_environment
      ;;
    2)
      setup_manual_environment
      ;;
    3)
      warn "Skipping environment setup. You'll need to create .env manually."
      ;;
    *)
      error "Invalid choice."
      ;;
  esac
}

# Function to setup test environment
setup_test_environment() {
  status "Creating .env file with test configuration..."
  
  cat > .env << 'EOF'
DISCORD_TOKEN=your_discord_token_here
CLIENT_ID=your_client_id_here
OWNER_ID=your_owner_id_here
NOTIFY_CHANNEL_ID=your_channel_id_here
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_PATH=./data/noxhime.db
COMMAND_PREFIX=!
BIOLOCK_ENABLED=true
BIOLOCK_PASSPHRASE="your_biolock_passphrase_here"
BIOLOCK_OVERRIDE_KEY=your_override_key_here
APPLICATION_ID=your_application_id_here
PUBLIC_KEY=your_public_key_here
EOF
  
  # Create backup
  mkdir -p ./data
  cp .env ./data/env.backup
  
  success "Test environment configuration created!"
}

# Function to setup manual environment
setup_manual_environment() {
  status "Creating .env file with manual configuration..."
  
  # Create .env file with user input
  echo "# Noxhime Bot Environment Configuration" > .env
  echo "# Generated on $(date)" >> .env
  echo "" >> .env
  
  echo "# Discord Configuration" >> .env
  read -p "Enter Discord Bot Token: " DISCORD_TOKEN
  echo "DISCORD_TOKEN=$DISCORD_TOKEN" >> .env
  
  read -p "Enter Discord Client ID: " CLIENT_ID
  echo "CLIENT_ID=$CLIENT_ID" >> .env
  
  read -p "Enter Discord Application ID: " APPLICATION_ID
  echo "APPLICATION_ID=$APPLICATION_ID" >> .env
  
  read -p "Enter Discord Public Key: " PUBLIC_KEY
  echo "PUBLIC_KEY=$PUBLIC_KEY" >> .env
  
  read -p "Enter Discord Channel ID for notifications: " NOTIFY_CHANNEL_ID
  echo "NOTIFY_CHANNEL_ID=$NOTIFY_CHANNEL_ID" >> .env
  
  read -p "Enter Your Discord User ID (owner): " OWNER_ID
  echo "OWNER_ID=$OWNER_ID" >> .env
  
  read -p "Enter Command Prefix [!]: " COMMAND_PREFIX
  COMMAND_PREFIX=${COMMAND_PREFIX:-!}
  echo "COMMAND_PREFIX=$COMMAND_PREFIX" >> .env
  
  echo "" >> .env
  echo "# OpenAI Configuration" >> .env
  read -p "Enter OpenAI API Key: " OPENAI_API_KEY
  echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> .env
  
  echo "" >> .env
  echo "# Database Configuration" >> .env
  echo "DATABASE_PATH=./data/noxhime.db" >> .env
  
  echo "" >> .env
  echo "# BioLock Security" >> .env
  read -p "Enable BioLock Security? (y/n) [y]: " -n 1 -r BIOLOCK_ENABLE
  echo
  BIOLOCK_ENABLED="true"
  if [[ ! $BIOLOCK_ENABLE =~ ^[Yy]$ ]]; then
    BIOLOCK_ENABLED="false"
  fi
  echo "BIOLOCK_ENABLED=$BIOLOCK_ENABLED" >> .env
  
  if [ "$BIOLOCK_ENABLED" = "true" ]; then
    read -p "Enter BioLock Passphrase: " BIOLOCK_PASSPHRASE
    echo "BIOLOCK_PASSPHRASE=\"$BIOLOCK_PASSPHRASE\"" >> .env
    
    read -p "Enter BioLock Emergency Override Key: " BIOLOCK_OVERRIDE_KEY
    echo "BIOLOCK_OVERRIDE_KEY=$BIOLOCK_OVERRIDE_KEY" >> .env
  fi
  
  # Create backup
  mkdir -p ./data
  cp .env ./data/env.backup
  
  success "Manual environment configuration completed and backup created!"
}

# Function to create user if needed
create_user() {
  if [ "$BOT_USER" != "$USER" ] && [ "$INSTALL_TYPE" = "production" ]; then
    if ! id -u "$BOT_USER" &>/dev/null; then
      status "Creating bot user: $BOT_USER"
      sudo useradd -m -s /bin/bash "$BOT_USER"
      success "Bot user created successfully!"
    else
      status "Bot user $BOT_USER already exists."
    fi
  fi
}

# Function to setup system integration
setup_system_integration() {
  if [ "$INSTALL_SYSTEMD" = "true" ] || [ "$INSTALL_MONITORING" = "true" ]; then
    divider "PHASE 4: System Integration"
    
    cd "$INSTALL_DIR" || error "Failed to navigate to installation directory"
    
    # Set up systemd services
    if [ "$INSTALL_SYSTEMD" = "true" ]; then
      status "Setting up systemd services..."
      if [ -f "systemd/noxhime-bot.service" ]; then
        sudo cp systemd/noxhime-bot.service /etc/systemd/system/
        sudo cp systemd/noxhime-update.service /etc/systemd/system/
        sudo cp systemd/noxhime-update.timer /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable noxhime-bot
        sudo systemctl enable noxhime-update.timer
        success "Systemd services configured!"
      else
        warn "Systemd service files not found. Skipping systemd setup."
      fi
    fi
    
    # Set up monitoring
    if [ "$INSTALL_MONITORING" = "true" ]; then
      status "Setting up monitoring system..."
      
      # Monit configuration
      if [ -f "monitor/noxhime.monit" ]; then
        sudo cp monitor/noxhime.monit /etc/monit/conf-enabled/
        sudo chmod 644 /etc/monit/conf-enabled/noxhime.monit
      fi
      
      # Fail2Ban integration
      if [ -f "scripts/fail2ban-discord.sh" ]; then
        sudo chmod +x scripts/fail2ban-discord.sh
        
        # Create Fail2Ban action configuration
        sudo tee /etc/fail2ban/action.d/noxhime-discord.conf > /dev/null << EOL
[Definition]
actionstart = 
actionstop = 
actioncheck = 
actionban = $INSTALL_DIR/scripts/fail2ban-discord.sh <name> <ip>
actionunban = 
EOL
      fi
      
      success "Monitoring system configured!"
    fi
    
    # Set proper ownership for production installs
    if [ "$INSTALL_TYPE" = "production" ] && [ "$BOT_USER" != "$USER" ]; then
      status "Setting proper file ownership..."
      sudo chown -R "$BOT_USER:$BOT_USER" "$INSTALL_DIR"
    fi
  fi
}

# Function to start services
start_services() {
  divider "PHASE 5: Starting Services"
  
  if [ "$INSTALL_MONITORING" = "true" ]; then
    status "Starting monitoring services..."
    sudo systemctl enable monit fail2ban
    sudo systemctl restart monit fail2ban
  fi
  
  if [ "$INSTALL_SYSTEMD" = "true" ]; then
    status "Starting Noxhime Bot service..."
    sudo systemctl start noxhime-bot
    sudo systemctl start noxhime-update.timer
    
    # Show service status
    echo
    status "Service status:"
    sudo systemctl status noxhime-bot --no-pager || true
  else
    status "Services not configured for systemd. You can start the bot manually with:"
    echo "  cd $INSTALL_DIR"
    echo "  npm start"
  fi
  
  success "Services started successfully!"
}

# Function to show completion message
show_completion() {
  divider "INSTALLATION COMPLETE"
  
  echo -e "${GREEN}Noxhime Bot has been successfully installed!${NC}"
  echo
  echo -e "${CYAN}Installation Details:${NC}"
  echo -e "  Type: $INSTALL_TYPE"
  echo -e "  Directory: $INSTALL_DIR"
  echo -e "  User: $BOT_USER"
  echo
  
  if [ "$INSTALL_SYSTEMD" = "true" ]; then
    echo -e "${CYAN}Service Management:${NC}"
    echo -e "  Start:   sudo systemctl start noxhime-bot"
    echo -e "  Stop:    sudo systemctl stop noxhime-bot"
    echo -e "  Status:  sudo systemctl status noxhime-bot"
    echo -e "  Logs:    sudo journalctl -u noxhime-bot -f"
    echo
  fi
  
  echo -e "${CYAN}Manual Start:${NC}"
  echo -e "  cd $INSTALL_DIR"
  echo -e "  npm start"
  echo
  
  if [ "$USE_EXISTING_ENV" != "true" ]; then
    echo -e "${YELLOW}Important:${NC}"
    echo -e "  Make sure to verify your .env configuration before starting the bot."
    echo -e "  The .env file is located at: $INSTALL_DIR/.env"
    echo
  fi
  
  echo -e "${GREEN}Happy botting! 🤖${NC}"
}

# Midnight Purple color for ASCII art
MIDNIGHT_PURPLE='\033[38;5;92m'

# Main installation function
main() {
  # Display ASCII art and welcome message
  clear
  echo -e "${BOLD}${MIDNIGHT_PURPLE}"
  cat << "EOF"
 _   _            _     _                 ____        _   
| \ | | _____  __| |__ (_)_ __ ___   ___ | __ )  ___ | |_ 
|  \| |/ _ \ \/ /| '_ \| | '_ ` _ \ / _ \|  _ \ / _ \| __|
| |\  | (_) >  < | | | | | | | | | |  __/| |_) | (_) | |_ 
|_| \_|\___/_/\_\|_| |_|_|_| |_| |_|\___||____/ \___/ \__|
                                                           
EOF
  echo -e "${MIDNIGHT_PURPLE}                                      Made with 💜 by NullMeDev${NC}"
  echo
  echo -e "${BOLD}Unified Installation Script${NC}"
  echo
  
  # Check root permissions
  check_root
  
  # Show menu and get user choices
  show_main_menu
  
  # Confirm installation
  confirm_installation
  
  # Run installation phases
  install_prerequisites
  clone_repository
  install_dependencies
  setup_database
  setup_environment
  create_user
  setup_system_integration
  start_services
  show_completion
}

# Run main function
main "$@"
