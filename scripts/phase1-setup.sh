#!/bin/bash
# Noxhime Sentient Expansion - Phase 1: Environment Prep & Core Setup
# This script sets up the enhanced directory structure and permissions

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# Midnight Purple for branding
MIDNIGHT_PURPLE='\033[38;5;92m'

echo -e "${BOLD}${MIDNIGHT_PURPLE}"
echo "███╗   ██╗ ██████╗ ██╗  ██╗██╗  ██╗██╗███╗   ███╗███████╗"
echo "████╗  ██║██╔═══██╗╚██╗██╔╝██║  ██║██║████╗ ████║██╔════╝"
echo "██╔██╗ ██║██║   ██║ ╚███╔╝ ███████║██║██╔████╔██║█████╗  "
echo "██║╚██╗██║██║   ██║ ██╔██╗ ██╔══██║██║██║╚██╔╝██║██╔══╝  "
echo "██║ ╚████║╚██████╔╝██╔╝ ██╗██║  ██║██║██║ ╚═╝ ██║███████╗"
echo "╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝"
echo -e "${MIDNIGHT_PURPLE}           Sentient Expansion - Phase 1 Setup       v3.0.0${NC}"
echo

# Installation directory
NOXHIME_HOME="/home/nulladmin/noxhime"
USER="nulladmin"

# Function definitions
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

# Check if running as root for system-level operations
check_permissions() {
    if [ "$(id -u)" -ne 0 ]; then
        warn "Some operations may require sudo privileges"
    fi
}

# Create nulladmin user if it doesn't exist
setup_user() {
    divider "Setting Up Nulladmin User"
    
    if ! id -u "$USER" &>/dev/null; then
        status "Creating $USER user..."
        sudo useradd -m -s /bin/bash "$USER"
        sudo usermod -aG sudo "$USER"
        success "User $USER created successfully"
    else
        success "User $USER already exists"
    fi
}

# Create enhanced directory structure
setup_directories() {
    divider "Setting Up Enhanced Directory Structure"
    
    # Main directories
    local dirs=(
        "$NOXHIME_HOME"
        "$NOXHIME_HOME/scripts"
        "$NOXHIME_HOME/quarantine"
        "$NOXHIME_HOME/patches"
        "$NOXHIME_HOME/logs"
        "$NOXHIME_HOME/logs/daily"
        "$NOXHIME_HOME/logs/honeypot"
        "$NOXHIME_HOME/logs/execution"
        "$NOXHIME_HOME/honeypot"
        "$NOXHIME_HOME/honeypot/ssh"
        "$NOXHIME_HOME/honeypot/web"
        "$NOXHIME_HOME/sandbox"
        "$NOXHIME_HOME/watchdog"
        "$NOXHIME_HOME/config"
        "$NOXHIME_HOME/data"
        "$NOXHIME_HOME/backup"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            status "Creating directory: $dir"
            sudo mkdir -p "$dir"
        else
            success "Directory exists: $dir"
        fi
    done
    
    # Set proper ownership
    status "Setting ownership to $USER:$USER"
    sudo chown -R "$USER:$USER" "$NOXHIME_HOME"
    
    # Set proper permissions
    status "Setting directory permissions"
    sudo chmod 755 "$NOXHIME_HOME"
    sudo chmod 750 "$NOXHIME_HOME/quarantine"
    sudo chmod 750 "$NOXHIME_HOME/patches"
    sudo chmod 755 "$NOXHIME_HOME/scripts"
    sudo chmod 644 "$NOXHIME_HOME/logs"
    
    success "Enhanced directory structure created"
}

# Create script allowlist
create_allowlist() {
    divider "Creating Script Security Configuration"
    
    local allowlist="$NOXHIME_HOME/config/script.allowlist"
    
    if [ ! -f "$allowlist" ]; then
        status "Creating script allowlist..."
        sudo -u "$USER" cat > "$allowlist" << 'EOF'
# Noxhime Script Allowlist
# Only scripts listed here can be executed via Discord commands
# Format: script_name.sh|description|author|version

# System Scripts
system-status.sh|Display system status and health|NullMeDev|1.0
service-restart.sh|Restart system services|NullMeDev|1.0
log-analyzer.sh|Analyze system logs|NullMeDev|1.0

# Security Scripts
ban-ip.sh|Add IP to firewall blacklist|NullMeDev|1.0
unban-ip.sh|Remove IP from firewall blacklist|NullMeDev|1.0
quarantine-scan.sh|Scan quarantine directory|NullMeDev|1.0

# Maintenance Scripts
cleanup-logs.sh|Clean old log files|NullMeDev|1.0
update-system.sh|Update system packages|NullMeDev|1.0
backup-data.sh|Backup critical data|NullMeDev|1.0
EOF
        success "Script allowlist created"
    else
        success "Script allowlist already exists"
    fi
}

# Create enhanced environment template
create_env_template() {
    divider "Creating Enhanced Environment Configuration"
    
    local env_template="$NOXHIME_HOME/config/env.template"
    
    if [ ! -f "$env_template" ]; then
        status "Creating environment template..."
        sudo -u "$USER" cat > "$env_template" << 'EOF'
# Noxhime Sentient Expansion v3.0 Environment Configuration

# === Discord Configuration ===
DISCORD_TOKEN=your_discord_token_here
CLIENT_ID=your_client_id_here
NOTIFY_CHANNEL_ID=your_channel_id_here
COMMAND_PREFIX=!

# === OpenAI Configuration ===
OPENAI_API_KEY=your_openai_api_key_here

# === Database Configuration ===
DATABASE_PATH=./data/noxhime.db

# === BioLock Security ===
BIOLOCK_ENABLED=true
BIOLOCK_PASSPHRASE=your_biolock_passphrase_here
BIOLOCK_OVERRIDE_KEY=your_override_key_here

# === Monitoring Configuration ===
MONIT_ENABLED=true
MONIT_PORT=5000
PID_FILE_PATH=/home/nulladmin/noxhime/noxhime.pid
SELF_HEALING_ENABLED=true
SYSTEM_STATS_INTERVAL=3600000

# === Sentient Expansion Features ===
# Honeypot Configuration
HONEYPOT_ENABLED=true
HONEYPOT_SSH_PORT=2222
HONEYPOT_HTTP_PORT=8080
HONEYPOT_LOG_PATH=/home/nulladmin/noxhime/logs/honeypot

# Heartbeat Configuration
HEARTBEAT_ENABLED=true
HEARTBEAT_INTERVAL=30000
HEARTBEAT_WEBHOOK=your_heartbeat_webhook_here
HEARTBEAT_TIMEOUT=60000

# Auto-Patch Configuration
AUTOPATCH_ENABLED=true
AUTOPATCH_URL=https://raw.githubusercontent.com/NullMeDev/noxhime-patches/main/patch.json
AUTOPATCH_CHECK_INTERVAL=86400000

# Watchdog Configuration
WATCHDOG_ENABLED=true
WATCHDOG_SERVICES=pm2,nginx,fail2ban,noxhime-bot
WATCHDOG_CHECK_INTERVAL=30000
WATCHDOG_MAX_RESTARTS=3

# Sandbox Configuration
SANDBOX_ENABLED=true
SANDBOX_TIMEOUT=300000
SANDBOX_MAX_SESSIONS=10

# Security Configuration
SECURITY_MODE=paranoid
AUTO_BAN_ENABLED=true
AUTO_BAN_THRESHOLD=5
QUARANTINE_AUTO_SCAN=true
EOF
        success "Environment template created"
    else
        success "Environment template already exists"
    fi
}

# Install system dependencies
install_dependencies() {
    divider "Installing System Dependencies"
    
    status "Updating package lists..."
    sudo apt update
    
    # Core system packages
    local packages=(
        "curl"
        "git"
        "sqlite3"
        "libsqlite3-dev"
        "fail2ban"
        "iptables"
        "netstat-nat"
        "bubblewrap"
        "firejail"
        "nginx"
        "python3"
        "python3-pip"
        "nodejs"
        "npm"
        "pm2"
        "monit"
        "htop"
        "nmap"
        "tcpdump"
        "jq"
    )
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            status "Installing $package..."
            sudo apt install -y "$package" || warn "Failed to install $package"
        else
            success "$package already installed"
        fi
    done
    
    # Install cowrie for SSH honeypot
    status "Setting up Python environment for cowrie..."
    sudo pip3 install virtualenv
    
    success "System dependencies installed"
}

# Setup NVM and Node.js
setup_nodejs() {
    divider "Setting Up Node.js Environment"
    
    # Install NVM
    export NVM_DIR="$HOME/.nvm"
    if [ ! -d "$NVM_DIR" ]; then
        status "Installing NVM..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    fi
    
    # Load NVM
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # Install Node.js 18 LTS
    status "Installing Node.js 18 LTS..."
    nvm install 18
    nvm use 18
    nvm alias default 18
    
    # Install global packages
    status "Installing global Node.js packages..."
    npm install -g typescript@latest ts-node@latest pm2@latest --no-fund --no-audit
    
    success "Node.js environment configured"
}

# Create initial system scripts
create_system_scripts() {
    divider "Creating Initial System Scripts"
    
    # System status script
    cat > "$NOXHIME_HOME/scripts/system-status.sh" << 'EOF'
#!/bin/bash
# System Status Script for Noxhime

echo "=== Noxhime System Status ==="
echo "Date: $(date)"
echo "Uptime: $(uptime -p)"
echo ""

echo "=== CPU & Memory ==="
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')%"
echo "Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "Disk Usage: $(df -h / | awk 'NR==2{printf "%s", $5}')"
echo ""

echo "=== Services Status ==="
services=("nginx" "fail2ban" "monit" "ssh")
for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        echo "$service: ✓ Active"
    else
        echo "$service: ✗ Inactive"
    fi
done
echo ""

echo "=== Network Connections ==="
echo "Active connections: $(netstat -an | grep ESTABLISHED | wc -l)"
echo "Listening ports: $(netstat -tln | grep LISTEN | wc -l)"
EOF
    chmod +x "$NOXHIME_HOME/scripts/system-status.sh"
    
    # Service restart script
    cat > "$NOXHIME_HOME/scripts/service-restart.sh" << 'EOF'
#!/bin/bash
# Service Restart Script for Noxhime

SERVICE="$1"
if [ -z "$SERVICE" ]; then
    echo "Usage: $0 <service_name>"
    exit 1
fi

echo "Restarting service: $SERVICE"
sudo systemctl restart "$SERVICE"
if [ $? -eq 0 ]; then
    echo "✓ $SERVICE restarted successfully"
else
    echo "✗ Failed to restart $SERVICE"
    exit 1
fi
EOF
    chmod +x "$NOXHIME_HOME/scripts/service-restart.sh"
    
    # IP ban script
    cat > "$NOXHIME_HOME/scripts/ban-ip.sh" << 'EOF'
#!/bin/bash
# IP Ban Script for Noxhime

IP="$1"
REASON="$2"

if [ -z "$IP" ]; then
    echo "Usage: $0 <ip_address> [reason]"
    exit 1
fi

# Validate IP format
if [[ ! $IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "Invalid IP address format: $IP"
    exit 1
fi

# Add to iptables
sudo iptables -I INPUT -s "$IP" -j DROP

# Add to fail2ban if available
if command -v fail2ban-client &> /dev/null; then
    sudo fail2ban-client set sshd banip "$IP"
fi

# Log the ban
echo "$(date): Banned IP $IP - Reason: ${REASON:-Manual ban}" >> /home/nulladmin/noxhime/logs/ip-bans.log

echo "✓ IP $IP has been banned"
EOF
    chmod +x "$NOXHIME_HOME/scripts/ban-ip.sh"
    
    success "Initial system scripts created"
}

# Set up logging infrastructure
setup_logging() {
    divider "Setting Up Logging Infrastructure"
    
    # Create log rotation configuration
    sudo cat > /etc/logrotate.d/noxhime << 'EOF'
/home/nulladmin/noxhime/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    su nulladmin nulladmin
}

/home/nulladmin/noxhime/logs/honeypot/*.log {
    daily
    missingok
    rotate 90
    compress
    delaycompress
    notifempty
    copytruncate
    su nulladmin nulladmin
}
EOF
    
    # Create initial log files
    touch "$NOXHIME_HOME/logs/noxhime.log"
    touch "$NOXHIME_HOME/logs/heartbeat.log"
    touch "$NOXHIME_HOME/logs/watchdog.log"
    touch "$NOXHIME_HOME/logs/ip-bans.log"
    touch "$NOXHIME_HOME/logs/execution.log"
    
    chown "$USER:$USER" "$NOXHIME_HOME/logs"/*.log
    
    success "Logging infrastructure configured"
}

# Main execution
main() {
    divider "Noxhime Sentient Expansion - Phase 1"
    echo "Setting up enhanced environment and core infrastructure..."
    echo
    
    check_permissions
    setup_user
    setup_directories
    create_allowlist
    create_env_template
    install_dependencies
    setup_nodejs
    create_system_scripts
    setup_logging
    
    divider "Phase 1 Complete!"
    success "Enhanced directory structure and core setup completed"
    success "Ready for Phase 2: Honeypot & Sandbox Deployment"
    
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Copy and configure .env from template in $NOXHIME_HOME/config/"
    echo "2. Run Phase 2 setup script"
    echo "3. Configure Discord bot permissions"
    echo
    echo -e "${PURPLE}Directory Structure Created:${NC}"
    echo "├── $NOXHIME_HOME/"
    echo "├── ├── scripts/        (System scripts)"
    echo "├── ├── quarantine/     (Malware isolation)"
    echo "├── ├── patches/        (Auto-patch storage)"
    echo "├── ├── logs/          (All logging)"
    echo "├── ├── honeypot/      (Honeypot data)"
    echo "├── ├── sandbox/       (Sandbox environment)"
    echo "├── ├── watchdog/      (Process monitoring)"
    echo "├── ├── config/        (Configuration files)"
    echo "└── └── backup/        (Backup storage)"
}

# Execute main function
main "$@"
