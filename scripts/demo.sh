#!/bin/bash
# Noxhime Bot Phase 4 & 5 Integration Demo
# This script demonstrates the functionality of the Sentinel Intelligence and Evolving Personality Core

echo "===== Noxhime Bot Phase 4 & 5 Integration Demo ====="
echo "Date: $(date)"

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to display section headers
section() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Check bot is built and ready to run
section "Pre-flight Check"
cd /workspaces/noxhime

echo -e "${YELLOW}Checking build status...${NC}"
if [ ! -d "dist" ]; then
  echo -e "${YELLOW}Building project...${NC}"
  npm run build
  if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed! Cannot continue.${NC}"
    exit 1
  fi
  echo -e "${GREEN}Build successful!${NC}"
else
  echo -e "${GREEN}Project already built.${NC}"
fi

# Ensure database is initialized
section "Database Initialization"
echo -e "${YELLOW}Initializing database...${NC}"
NODE_ENV=development node -e "
const db = require('./dist/db');
db.initializeDatabase().then(() => {
  console.log('\x1b[32mDatabase initialized successfully!\x1b[0m');
  process.exit(0);
}).catch(err => {
  console.error('\x1b[31mDatabase initialization failed:\x1b[0m', err);
  process.exit(1);
});
"
if [ $? -ne 0 ]; then
  echo -e "${RED}Database initialization failed! Cannot continue.${NC}"
  exit 1
fi

# Show implemented features
section "Implemented Features"

echo -e "${CYAN}Phase 4: Sentinel Intelligence${NC}"
echo "✅ Log Monitoring System"
echo "✅ Security Incident Detection"
echo "✅ Service Status Monitoring"
echo "✅ System Uptime Tracking"
echo "✅ Suspicious IP Tracking"
echo "✅ Automated Backup System"

echo -e "\n${CYAN}Phase 5: Evolving Personality Core${NC}"
echo "✅ Dynamic Mood System"
echo "✅ Emotional Response Generation"
echo "✅ Context-Aware Responses"
echo "✅ Message Styling based on Mood"
echo "✅ Event-Based Mood Changes"

section "Available Discord Commands"
echo -e "${CYAN}Phase 4 Commands:${NC}"
echo "!uptime - Display system and bot uptime"
echo "!services - Show status of monitored services"
echo "!incidents - View detected security incidents (owner only)"
echo "!sentinel <start|stop> - Control the sentinel system (owner only)"
echo "!backup - Trigger a manual backup (owner only)"

echo -e "\n${CYAN}Phase 5 Commands:${NC}"
echo "!mood - Display the bot's current emotional state"
echo "!ask <question> - Get a response styled based on current mood"

section "Sample Demo Flow"
echo "1. Start the bot: NODE_ENV=development node dist/index.js"
echo "2. Check the bot's current mood with !mood"
echo "3. View system status with !services"
echo "4. Check uptime with !uptime"
echo "5. Generate a security incident by creating suspicious log entries"
echo "6. View incidents with !incidents"
echo "7. Observe how mood changes after security incidents are detected"

section "Mock Data Generation"
echo -e "${YELLOW}Creating mock log data for security incidents...${NC}"

# Create mock data directory if it doesn't exist
mkdir -p data/mock

# Create mock log files with security incidents
cat > data/mock/auth.log << EOF
May 27 08:15:32 host sshd[1234]: Failed password for invalid user root from 192.168.1.100 port 12345 ssh2
May 27 08:15:35 host sshd[1235]: Failed password for invalid user admin from 192.168.1.100 port 12346 ssh2
May 27 08:15:38 host sshd[1236]: Failed password for invalid user admin from 192.168.1.100 port 12347 ssh2
May 27 08:15:41 host sshd[1237]: Failed password for invalid user admin from 192.168.1.100 port 12348 ssh2
May 27 08:15:44 host sshd[1238]: Failed password for invalid user admin from 192.168.1.100 port 12349 ssh2
EOF

cat > data/mock/fail2ban.log << EOF
2025-05-27 08:16:01,123 fail2ban.actions [12345]: WARNING [ssh] Ban 192.168.1.100
2025-05-27 08:16:02,456 fail2ban.actions [12346]: NOTICE [ssh] Ban 203.0.113.42
2025-05-27 08:25:03,789 fail2ban.actions [12347]: NOTICE [ssh] Ban 198.51.100.23
EOF

echo -e "${GREEN}Mock log data created successfully!${NC}"

echo -e "\n${YELLOW}To start the bot with development settings:${NC}"
echo -e "${CYAN}NODE_ENV=development node dist/index.js${NC}"

echo -e "\n${GREEN}===== Setup Complete =====${NC}"
echo "Noxhime Phase 4 & 5 implementation is ready for demonstration."
echo "Date: $(date)"
