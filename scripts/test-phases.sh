#!/bin/bash
# Test script for Noxhime Bot Phases 4 and 5
# This script tests the functionality of the Sentinel Intelligence and Evolving Personality Core

echo "===== Noxhime Bot Phase 4 & 5 Testing Script ====="
echo "Date: $(date)"
echo

# Check if bot is running
if ! pgrep -f "node.*index" > /dev/null; then
  echo "❌ Bot is not running. Please start the bot first."
  exit 1
fi

echo "✅ Bot process is running"

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BLUE='\033[0;34m'

# Check configuration
echo -e "\n${BLUE}=== Checking Configuration ===${NC}"
source .env 2>/dev/null || echo -e "${YELLOW}Warning: Could not source .env file${NC}"

if [ "$SENTINEL_ENABLED" != "true" ]; then
  echo -e "${YELLOW}Warning: Sentinel Intelligence is not enabled in .env${NC}"
else
  echo -e "${GREEN}Sentinel Intelligence is enabled${NC}"
fi

if [ "$PERSONALITY_ENABLED" != "true" ]; then
  echo -e "${YELLOW}Warning: Personality Core is not enabled in .env${NC}"
else
  echo -e "${GREEN}Personality Core is enabled${NC}"
fi

if [ "$RCLONE_BACKUP_ENABLED" != "true" ]; then
  echo -e "${YELLOW}Warning: Rclone backup is not enabled in .env${NC}"
else
  echo -e "${GREEN}Rclone backup is enabled${NC}"
fi

# Check database tables
echo -e "\n${BLUE}=== Checking Database Tables ===${NC}"
DB_PATH=${DATABASE_PATH:-"./data/noxhime.db"}

if [ ! -f "$DB_PATH" ]; then
  echo -e "${RED}Error: Database file not found at $DB_PATH${NC}"
else
  echo -e "${GREEN}Database file exists at $DB_PATH${NC}"
  
  # Use sqlite3 to check tables related to Phase 4 and 5
  if command -v sqlite3 &> /dev/null; then
    echo -e "\n${BLUE}Verifying Phase 4 and 5 tables:${NC}"
    
    # Check sentinel_incidents table
    if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='sentinel_incidents';" | grep -q "sentinel_incidents"; then
      echo -e "${GREEN}✅ sentinel_incidents table exists${NC}"
    else
      echo -e "${RED}❌ sentinel_incidents table is missing${NC}"
    fi
    
    # Check suspicious_ips table
    if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='suspicious_ips';" | grep -q "suspicious_ips"; then
      echo -e "${GREEN}✅ suspicious_ips table exists${NC}"
    else
      echo -e "${RED}❌ suspicious_ips table is missing${NC}"
    fi
    
    # Check service_status table
    if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='service_status';" | grep -q "service_status"; then
      echo -e "${GREEN}✅ service_status table exists${NC}"
    else
      echo -e "${RED}❌ service_status table is missing${NC}"
    fi
    
    # Check backups table
    if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='backups';" | grep -q "backups"; then
      echo -e "${GREEN}✅ backups table exists${NC}"
    else
      echo -e "${RED}❌ backups table is missing${NC}"
    fi
    
    # Check mood_states table
    if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='mood_states';" | grep -q "mood_states"; then
      echo -e "${GREEN}✅ mood_states table exists${NC}"
    else
      echo -e "${RED}❌ mood_states table is missing${NC}"
    fi
  else
    echo -e "${YELLOW}Warning: sqlite3 command not found, skipping database table checks${NC}"
  fi
fi

# Check backup script
echo -e "\n${BLUE}=== Checking Backup System ===${NC}"
BACKUP_SCRIPT="./scripts/backup.sh"

if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo -e "${RED}❌ Backup script not found at $BACKUP_SCRIPT${NC}"
else
  echo -e "${GREEN}✅ Backup script exists at $BACKUP_SCRIPT${NC}"
  
  # Check if backup script is executable
  if [ -x "$BACKUP_SCRIPT" ]; then
    echo -e "${GREEN}✅ Backup script is executable${NC}"
  else
    echo -e "${YELLOW}⚠️ Backup script is not executable. Fixing...${NC}"
    chmod +x "$BACKUP_SCRIPT"
    echo -e "${GREEN}✅ Fixed backup script permissions${NC}"
  fi
  
  # Check for rclone
  if command -v rclone &> /dev/null; then
    echo -e "${GREEN}✅ Rclone is installed${NC}"
    
    # Check if rclone is configured
    if rclone listremotes | grep -q "."; then
      echo -e "${GREEN}✅ Rclone has configured remotes${NC}"
    else
      echo -e "${YELLOW}⚠️ Rclone is installed but no remotes are configured${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️ Rclone is not installed${NC}"
  fi
  
  # Check backup directory
  BACKUP_DIR="./backups"
  if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}⚠️ Backup directory not found. It will be created when the backup runs.${NC}"
  else
    echo -e "${GREEN}✅ Backup directory exists${NC}"
    
    # Check if there are any backups
    if [ "$(ls -A "$BACKUP_DIR")" ]; then
      echo -e "${GREEN}✅ Backup directory contains backups${NC}"
      ls -lt "$BACKUP_DIR" | head -5
    else
      echo -e "${YELLOW}⚠️ Backup directory is empty${NC}"
    fi
  fi
fi

# Test Sentinel Intelligence log monitoring
echo -e "\n${BLUE}=== Testing Sentinel Intelligence Log Monitoring ===${NC}"
MOCK_LOG_DIR="./data/mock"

if [ ! -d "$MOCK_LOG_DIR" ]; then
  echo -e "${YELLOW}Creating mock log directory for testing...${NC}"
  mkdir -p "$MOCK_LOG_DIR"
fi

# Create test log entries
echo "May 27 10:15:32 host sshd[1234]: Failed password for invalid user admin from 192.168.1.100 port 12345 ssh2" > "$MOCK_LOG_DIR/auth.log"
echo "May 27 10:15:35 host fail2ban.actions: Ban 192.168.1.100" > "$MOCK_LOG_DIR/fail2ban.log"

echo -e "${GREEN}✅ Created mock log files for testing${NC}"
echo -e "${YELLOW}Note: Wait for the Sentinel check interval to see these logs processed${NC}"

# Test for commands
echo -e "\n${BLUE}=== Testing Bot Commands ===${NC}"
echo -e "${YELLOW}The following commands should be manually tested in Discord:${NC}"
echo "• !uptime - Should show system and bot uptime"
echo "• !services - Should show status of system services"
echo "• !mood - Should show bot's current emotional state"
echo "• !backup - Should trigger a manual backup (owner only)"
echo "• !sentinel start/stop - Should control the sentinel system (owner only)"
echo "• !incidents - Should show security incidents (owner only)"

echo -e "\n${BLUE}=== Testing Personality Core ===${NC}"
echo -e "${YELLOW}To test the personality core:${NC}"
echo "1. Use !mood to check current mood"
echo "2. Trigger different events to see mood changes:"
echo "   - User interactions should make the bot more happy or playful"
echo "   - Security alerts should make the bot concerned or alert"
echo "   - System errors should affect the mood negatively"
echo "   - Successful operations should improve the mood"

# Create web interface test
echo -e "\n${BLUE}=== Testing Web Interface Integration ===${NC}"
echo -e "${YELLOW}To test the web interface integration with nullme.lol:${NC}"
echo "1. Ensure the bot is running with API_ENABLED=true"
echo "2. Visit the web dashboard at nullme.lol"
echo "3. Verify that bot status, incidents, and mood are displayed correctly"

echo -e "\n${GREEN}===== Test Script Complete =====${NC}"
echo "Remember to check the Discord channel for any alerts or responses from the bot."
echo "Date: $(date)"
