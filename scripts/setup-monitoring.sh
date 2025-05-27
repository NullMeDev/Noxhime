#!/bin/bash
# Setup script for Noxhime Bot Monitoring System
# This script configures Fail2Ban alerts and service monitoring

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BOT_USER="nulladmin"
BOT_PATH="/home/$BOT_USER/noxhime-bot"

# Make sure we're running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script as root"
  exit 1
fi

echo "Setting up Noxhime Bot Monitoring System..."

# Setup Fail2Ban integration
echo "Configuring Fail2Ban integration..."

# Create Fail2Ban action configuration
cat > /etc/fail2ban/action.d/noxhime-discord.conf << EOL
[Definition]
actionstart = 
actionstop = 
actioncheck = 
actionban = /home/$BOT_USER/noxhime-bot/scripts/fail2ban-discord.sh <name> <ip>
actionunban = 
EOL

# Update jail.local to use our action
JAILS_TO_MONITOR=("sshd" "nginx-http-auth" "nginx-badbots")

if [ ! -f /etc/fail2ban/jail.local ]; then
  touch /etc/fail2ban/jail.local
fi

for JAIL in "${JAILS_TO_MONITOR[@]}"; do
  if grep -q "\\[$JAIL\\]" /etc/fail2ban/jail.local; then
    # Add action to existing jail
    sed -i "/\\[$JAIL\\]/,/^$/s/action = .*/&\naction = %(action_)s\nnoxhime-discord/" /etc/fail2ban/jail.local
  else
    # Create new jail entry
    cat >> /etc/fail2ban/jail.local << EOL

[$JAIL]
enabled = true
action = %(action_)s
         noxhime-discord
EOL
  fi
done

# Copy Fail2Ban notification script
mkdir -p $BOT_PATH/scripts
cp $PROJECT_ROOT/scripts/fail2ban-discord.sh $BOT_PATH/scripts/
chmod +x $BOT_PATH/scripts/fail2ban-discord.sh
chown $BOT_USER:$BOT_USER $BOT_PATH/scripts/fail2ban-discord.sh

# Setup Monit configuration
echo "Configuring Monit..."

if [ ! -d /etc/monit/conf-enabled ]; then
  mkdir -p /etc/monit/conf-enabled
fi

# Copy Monit configuration
cp $PROJECT_ROOT/monitor/noxhime.monit /etc/monit/conf-enabled/
chmod 644 /etc/monit/conf-enabled/noxhime.monit

# Update Monit configuration for HTTP server
if grep -q "set httpd" /etc/monit/monitrc; then
  # Monit HTTP server already configured
  echo "Monit HTTP server already configured"
else
  # Add HTTP server configuration
  cat >> /etc/monit/monitrc << EOL

# HTTP Server for Noxhime Bot monitoring
set httpd port 2812
    use address localhost
    allow localhost

EOL
fi

# Restart services
echo "Restarting services..."
systemctl restart fail2ban
systemctl restart monit

echo "Configuration complete! Noxhime Bot monitoring system has been set up."
echo "Please verify that the bot is running correctly."
