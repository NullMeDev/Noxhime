#!/bin/bash
# Noxhime Bot - Ubuntu 24.04 Optimized Installation Script
# This script performs a streamlined installation of Noxhime Bot specifically for Ubuntu 24.04
# with Node.js 18.x and efficient package management

# Exit on error, undefined variables, and propagate pipe errors
set -euo pipefail

# ============================
# Noxhime Ubuntu 24.04 Installation
# - Optimized for Ubuntu Noble Numbat (24.04)
# - Uses Node.js 18.x specifically
# - Skips already installed packages
# - Minimizes dependencies
# ============================

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
# Note: This script assumes the repository has already been manually cloned/downloaded
# and is present in the installation directory

# Installation options
INSTALL_DIR=""
START_BOT_AFTER_INSTALL=true
SETUP_SYSTEMD=true
VERBOSE_OUTPUT=false

# Utility functions
log() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

section() {
  echo -e "\n${PURPLE}=========================================${NC}"
  echo -e "${BOLD}$1${NC}"
  echo -e "${PURPLE}=========================================${NC}"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" &>/dev/null
}

# Function to check Ubuntu version
check_ubuntu_version() {
  section "Checking System Compatibility"

  if ! command_exists lsb_release; then
    error "lsb_release command not found. Cannot verify Ubuntu version."
  fi

  UBUNTU_VERSION=$(lsb_release -rs)
  UBUNTU_CODENAME=$(lsb_release -cs)
  log "Detected Ubuntu $UBUNTU_VERSION ($UBUNTU_CODENAME)"

  # Check if this is Ubuntu 24.04 or newer
  if [[ $(echo "$UBUNTU_VERSION >= 24.04" | bc) -eq 1 ]]; then
    success "Ubuntu version $UBUNTU_VERSION is supported."
  else
    warn "This script is optimized for Ubuntu 24.04, but you're running $UBUNTU_VERSION."
    warn "The installation may work, but it's not guaranteed."
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      error "Installation aborted by user."
    fi
  fi
}

# Function to install required packages
install_prerequisites() {
  section "Installing Prerequisites"

  log "Updating package lists..."
  if $VERBOSE_OUTPUT; then
    sudo apt-get update
  else
    sudo apt-get update -qq
  fi

  # Check and install required packages
  PACKAGES_TO_INSTALL=()
  REQUIRED_PACKAGES=("git" "curl" "sqlite3" "build-essential" "libsqlite3-dev")

  for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if ! dpkg -l | grep -q "ii  $pkg "; then
      PACKAGES_TO_INSTALL+=("$pkg")
    else
      log "Package $pkg is already installed, skipping."
    fi
  done

  if [ ${#PACKAGES_TO_INSTALL[@]} -gt 0 ]; then
    log "Installing required packages: ${PACKAGES_TO_INSTALL[*]}"
    if $VERBOSE_OUTPUT; then
      sudo apt-get install -y "${PACKAGES_TO_INSTALL[@]}"
    else
      sudo apt-get install -y -qq "${PACKAGES_TO_INSTALL[@]}"
    fi
  else
    success "All required system packages are already installed."
  fi

  success "Prerequisites installed successfully!"
}

# Function to install Node.js 18.x
install_nodejs() {
  section "Setting Up Node.js 18.x"

  # Check if Node.js is already installed
  if command_exists node; then
    NODE_VERSION=$(node -v)
    log "Node.js $NODE_VERSION is already installed."

    # Check if it's v18.x
    if [[ $NODE_VERSION == v18.* ]]; then
      success "Node.js 18.x is already installed."
      return
    else
      warn "You have Node.js $NODE_VERSION installed, but this application requires v18.x."
      read -p "Do you want to install Node.js 18.x? (y/N): " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Node.js 18.x is required but not installed. Installation aborted."
      fi
    fi
  fi

  log "Installing Node.js 18.x..."

  # First, check if NodeSource repository is already configured
  if [ -f /etc/apt/sources.list.d/nodesource.list ]; then
    log "NodeSource repository is already configured, updating it..."
    sudo rm /etc/apt/sources.list.d/nodesource.list
  fi
  
  # Add Node.js 18.x repository
  log "Adding NodeSource repository for Node.js 18.x..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

  # Install Node.js 18.x
  log "Installing Node.js 18.x..."
  if $VERBOSE_OUTPUT; then
    sudo apt-get install -y nodejs
  else
    sudo apt-get install -y -qq nodejs
  fi

  # Verify installation
  NODE_VERSION=$(node -v)
  if [[ $NODE_VERSION == v18.* ]]; then
    success "Node.js $NODE_VERSION installed successfully."
  else
    error "Failed to install Node.js 18.x. Got version $NODE_VERSION instead."
  fi

  # Install required global npm packages
  log "Installing required global npm packages..."
  
  GLOBAL_PACKAGES=("typescript" "ts-node" "pm2")
  for pkg in "${GLOBAL_PACKAGES[@]}"; do
    if ! npm list -g "$pkg" &>/dev/null; then
      log "Installing $pkg globally..."
      npm install -g "$pkg" --no-fund --no-audit
    else
      log "Package $pkg is already installed globally, skipping."
    fi
  done

  success "Node.js 18.x setup completed!"
}

# Function to set up and validate the repository directory
# Note: This function assumes the repository has been manually cloned/downloaded
setup_repository() {
  section "Setting Up Repository"

  # Check if the installation directory exists
  if [ ! -d "$INSTALL_DIR" ]; then
    error "Installation directory $INSTALL_DIR does not exist. Please manually clone or download the repository first."
  fi

  # Change to the installation directory
  cd "$INSTALL_DIR"
  
  # Check if this is a valid repository with required files
  if [ ! -f "package.json" ]; then
    error "The directory $INSTALL_DIR does not appear to contain a valid Noxhime repository. Please ensure you have manually cloned or downloaded the repository correctly."
  fi
  
  log "Repository directory verified."
  
  # Check if this is a git repository and offer to update it
  if [ -d .git ]; then
    read -p "Would you like to update the repository with the latest changes? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
      log "Pulling latest changes from repository..."
      git pull
    else
      log "Skipping repository update."
    fi
  else
    log "Directory is not a git repository. Automated updates will not be available."
    log "For future updates, consider using git to clone the repository."
  fi

  success "Repository setup completed!"
}

# Function to install dependencies
install_dependencies() {
  section "Installing Dependencies"
  
  cd "$INSTALL_DIR"
  
  log "Installing npm dependencies..."
  # Using --no-fund and --no-audit to speed up installation
  npm ci --no-fund --no-audit
  
  success "Dependencies installed successfully!"
}

# Function to set up the database
setup_database() {
  section "Setting Up Database"
  
  cd "$INSTALL_DIR"
  
  log "Creating data directory..."
  mkdir -p ./data
  
  if [ -f "./db/schema.sql" ]; then
    log "Creating SQLite database..."
    if [ -f "./data/noxhime.db" ]; then
      log "Database already exists. Checking for schema updates..."
      
      # Compare schema version
      CURRENT_VERSION=$(sqlite3 ./data/noxhime.db "PRAGMA user_version;" 2>/dev/null || echo "0")
      
      if [ "$CURRENT_VERSION" = "0" ]; then
        log "Setting up database schema..."
        sqlite3 ./data/noxhime.db < ./db/schema.sql
      else
        log "Database schema is already set up. Version: $CURRENT_VERSION"
      fi
    else
      log "Creating new database with schema..."
      sqlite3 ./data/noxhime.db < ./db/schema.sql
    fi
    
    success "Database setup completed!"
  else
    error "Database schema file not found at ./db/schema.sql"
  fi
}

# Function to set up environment configuration
setup_environment() {
  section "Setting Up Environment Configuration"
  
  cd "$INSTALL_DIR"
  
  if [ -f ".env" ]; then
    log ".env file already exists."
    read -p "Do you want to keep the existing configuration? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
      success "Keeping existing .env file."
      return
    fi
  fi
  
  log "Creating new .env file..."
  
  if [ -f ".env.example" ]; then
    cp .env.example .env
    log "Created .env from .env.example template."
  else
    # Create basic .env file
    cat > .env << EOL
# Noxhime Bot Configuration
# Generated on $(date)

# Discord Bot Configuration
DISCORD_TOKEN=
CLIENT_ID=
NOTIFY_CHANNEL_ID=
COMMAND_PREFIX=!

# OpenAI Configuration
OPENAI_API_KEY=

# Database Configuration
DATABASE_PATH=./data/noxhime.db

# Monitoring Configuration
MONIT_ENABLED=true
MONIT_PORT=5000
PID_FILE_PATH=${INSTALL_DIR}/noxhime.pid
SELF_HEALING_ENABLED=true
SYSTEM_STATS_INTERVAL=3600000

# Security Features
BIOLOCK_ENABLED=true
BIOLOCK_OVERRIDE_KEY=
BIOLOCK_SESSION_TIMEOUT=60

# Web Dashboard Configuration
API_ENABLED=true
API_PORT=3000
API_KEYS=
JWT_SECRET=
DASHBOARD_URL=http://localhost:3000
EOL
    log "Created basic .env file."
  fi
  
  log "Please edit the .env file to configure your bot:"
  log "  ${INSTALL_DIR}/.env"
  
  # Generate a random JWT secret if needed
  if grep -q "JWT_SECRET=" .env && ! grep -q "JWT_SECRET=.*[a-zA-Z0-9]" .env; then
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s/JWT_SECRET=/JWT_SECRET=${JWT_SECRET}/" .env
    log "Generated a random JWT secret for web dashboard."
  fi
  
  # Prompt for Discord token
  read -p "Would you like to enter your Discord bot token now? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your Discord bot token: " DISCORD_TOKEN
    sed -i "s/DISCORD_TOKEN=/DISCORD_TOKEN=${DISCORD_TOKEN}/" .env
    
    read -p "Enter your Discord client ID: " CLIENT_ID
    sed -i "s/CLIENT_ID=/CLIENT_ID=${CLIENT_ID}/" .env
    
    read -p "Enter notification channel ID: " NOTIFY_CHANNEL_ID
    sed -i "s/NOTIFY_CHANNEL_ID=/NOTIFY_CHANNEL_ID=${NOTIFY_CHANNEL_ID}/" .env
    
    read -p "Would you like to enter an OpenAI API key? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      read -p "Enter your OpenAI API key: " OPENAI_API_KEY
      sed -i "s/OPENAI_API_KEY=/OPENAI_API_KEY=${OPENAI_API_KEY}/" .env
    fi
    
    # Generate BioLock override key
    BIOLOCK_OVERRIDE_KEY=$(openssl rand -hex 16)
    sed -i "s/BIOLOCK_OVERRIDE_KEY=/BIOLOCK_OVERRIDE_KEY=${BIOLOCK_OVERRIDE_KEY}/" .env
    log "Generated a random BioLock override key. Save this for emergency access!"
    log "BIOLOCK_OVERRIDE_KEY: ${BIOLOCK_OVERRIDE_KEY}"
  fi
  
  # Backup the environment file
  cp .env ./data/.env.backup
  
  success "Environment configuration completed!"
}

# Function to set up systemd service
setup_systemd() {
  section "Setting Up Systemd Service"
  
  if [ "$SETUP_SYSTEMD" != "true" ]; then
    log "Skipping systemd setup as requested."
    return
  fi
  
  cd "$INSTALL_DIR"
  
  log "Creating systemd service file..."
  
  # Create systemd service file
  cat > noxhime-bot.service << EOL
[Unit]
Description=Noxhime Discord Bot
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(which node) ${INSTALL_DIR}/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=noxhime-bot
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL
  
  # Install systemd service
  log "Installing systemd service..."
  sudo mv noxhime-bot.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable noxhime-bot.service
  
  success "Systemd service installed and enabled!"
}

# Function to build the application
build_application() {
  section "Building Application"
  
  cd "$INSTALL_DIR"
  
  log "Building TypeScript files..."
  npm run build
  
  success "Application built successfully!"
}

# Function to start the bot
start_bot() {
  section "Starting Bot"
  
  if [ "$START_BOT_AFTER_INSTALL" != "true" ]; then
    log "Skipping bot startup as requested."
    return
  fi
  
  cd "$INSTALL_DIR"
  
  if [ "$SETUP_SYSTEMD" = "true" ]; then
    log "Starting bot using systemd service..."
    sudo systemctl start noxhime-bot
    
    # Check if service started successfully
    sleep 2
    if systemctl is-active --quiet noxhime-bot; then
      success "Bot started successfully via systemd!"
    else
      warn "Bot service failed to start. Check logs with: sudo journalctl -u noxhime-bot"
    fi
  else
    log "Starting bot using npm..."
    log "Running in the background with pm2..."
    pm2 start npm --name "noxhime" -- start
    success "Bot started successfully with pm2!"
  fi
}

# Function to test the installation
test_installation() {
  section "Testing Installation"
  
  cd "$INSTALL_DIR"
  
  # Check if files exist
  log "Checking file structure..."
  FILES_TO_CHECK=("package.json" "src/index.ts" "dist/index.js" "web/public/index.html")
  
  for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
      log "[+] $file exists"
    else
      warn "[-] $file is missing"
    fi
  done
  
  # Check if database exists
  if [ -f "data/noxhime.db" ]; then
    log "[+] Database exists"
  else
    warn "[-] Database is missing"
  fi
  
  # Check if environment file exists
  if [ -f ".env" ]; then
    log "[+] Environment configuration exists"
  else
    warn "[-] Environment configuration is missing"
  fi
  
  # Check if bot is running
  if [ "$SETUP_SYSTEMD" = "true" ]; then
    if systemctl is-active --quiet noxhime-bot; then
      log "[+] Bot service is running"
    else
      warn "[-] Bot service is not running"
    fi
  else
    if pm2 list | grep -q "noxhime"; then
      log "[+] Bot process is running with pm2"
    else
      warn "[-] Bot process is not running with pm2"
    fi
  fi
  
  success "Installation test completed!"
}

# Function to show completion message
show_completion() {
  section "Installation Complete"
  
  echo -e "${GREEN}Noxhime Bot has been successfully installed!${NC}"
  echo
  echo -e "${CYAN}Installation Details:${NC}"
  echo -e "  Directory: $INSTALL_DIR"
  echo -e "  User: $(whoami)"
  echo
  
  if [ "$SETUP_SYSTEMD" = "true" ]; then
    echo -e "${CYAN}Service Management:${NC}"
    echo -e "  Start:   sudo systemctl start noxhime-bot"
    echo -e "  Stop:    sudo systemctl stop noxhime-bot"
    echo -e "  Status:  sudo systemctl status noxhime-bot"
    echo -e "  Logs:    sudo journalctl -u noxhime-bot -f"
    echo
  else
    echo -e "${CYAN}PM2 Management:${NC}"
    echo -e "  Status:  pm2 status"
    echo -e "  Logs:    pm2 logs noxhime"
    echo -e "  Stop:    pm2 stop noxhime"
    echo -e "  Restart: pm2 restart noxhime"
    echo
  fi
  
  echo -e "${CYAN}Manual Commands:${NC}"
  echo -e "  Start:    cd $INSTALL_DIR && npm start"
  echo -e "  Build:    cd $INSTALL_DIR && npm run build"
  echo
  
  if [ -f "$INSTALL_DIR/.env" ]; then
    echo -e "${YELLOW}BioLock Information:${NC}"
    BIOLOCK_KEY=$(grep "BIOLOCK_OVERRIDE_KEY" "$INSTALL_DIR/.env" | cut -d= -f2)
    if [ -n "$BIOLOCK_KEY" ]; then
      echo -e "  Emergency Override Key: $BIOLOCK_KEY"
      echo -e "  Use this with !override command in emergencies"
    else
      echo -e "  No BioLock override key found. Consider setting one in .env"
    fi
    echo
  fi
  
  echo -e "${CYAN}Web Dashboard:${NC}"
  DASHBOARD_URL=$(grep "DASHBOARD_URL" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "http://localhost:3000")
  echo -e "  URL: ${DASHBOARD_URL:-http://localhost:3000}"
  echo -e "  Use !link command in Discord to get an access token"
  echo
  
  echo -e "${GREEN}Thank you for installing Noxhime Bot!${NC}"
}

# Function to parse command-line arguments
parse_arguments() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dir=*)
        INSTALL_DIR="${1#*=}"
        ;;
      --no-start)
        START_BOT_AFTER_INSTALL=false
        ;;
      --no-systemd)
        SETUP_SYSTEMD=false
        ;;
      --verbose)
        VERBOSE_OUTPUT=true
        ;;
      --help)
        echo "Noxhime Bot - Ubuntu 24.04 Installation Script"
        echo
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  --dir=PATH        Specify installation directory (default: $DEFAULT_INSTALL_DIR)"
        echo "  --no-start        Don't start the bot after installation"
        echo "  --no-systemd      Don't set up systemd service"
        echo "  --verbose         Show detailed output during installation"
        echo "  --help            Show this help message"
        echo
        exit 0
        ;;
      *)
        warn "Unknown option: $1"
        ;;
    esac
    shift
  done
  
  # Set default installation directory if not specified
  if [ -z "$INSTALL_DIR" ]; then
    INSTALL_DIR="$DEFAULT_INSTALL_DIR"
  fi
}

# Main function
main() {
  # Display ASCII art banner
  clear
  echo -e "${PURPLE}"
  cat << "EOF"
 _   _            _     _                 ____        _   
| \ | | _____  __| |__ (_)_ __ ___   ___ | __ )  ___ | |_ 
|  \| |/ _ \ \/ /| '_ \| | '_ ` _ \ / _ \|  _ \ / _ \| __|
| |\  | (_) >  < | | | | | | | | | |  __/| |_) | (_) | |_ 
|_| \_|\___/_/\_\|_| |_|_|_| |_| |_|\___|____/ \___/ \__|
                                                          
EOF
  echo -e "${NC}"
  echo -e "${BOLD}Ubuntu 24.04 Optimized Installation${NC}"
  echo -e "Specifically optimized for Ubuntu 24.04 with Node.js 18.x"
  echo

  # Parse command-line arguments
  parse_arguments "$@"
  
  # Confirm installation
  log "Installation directory: $INSTALL_DIR"
  log "Start bot after install: $START_BOT_AFTER_INSTALL"
  log "Setup systemd service: $SETUP_SYSTEMD"
  echo
  read -p "Press Enter to continue or Ctrl+C to cancel..."
  
  # Display manual repository setup message
  section "Manual Repository Setup Required"
  log "IMPORTANT: This installation script requires that you manually clone or download"
  log "the Noxhime repository to your installation directory before running this script."
  log ""
  log "To manually set up the repository, you can use one of these methods:"
  log "1. Using git: git clone https://github.com/NullMeDev/noxhime-bot.git $INSTALL_DIR"
  log "2. Download and extract the zip file from the GitHub repository"
  log ""
  read -p "Have you already cloned or downloaded the repository to $INSTALL_DIR? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Please clone or download the repository first, then run this script again."
  fi
  
  # Run installation steps
  check_ubuntu_version
  install_prerequisites
  install_nodejs
  setup_repository
  install_dependencies
  setup_database
  setup_environment
  build_application
  
  if [ "$SETUP_SYSTEMD" = "true" ]; then
    setup_systemd
  fi
  
  if [ "$START_BOT_AFTER_INSTALL" = "true" ]; then
    start_bot
  fi
  
  test_installation
  show_completion
}

# Run main function with all arguments
main "$@"

