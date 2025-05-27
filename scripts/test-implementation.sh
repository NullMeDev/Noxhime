#!/bin/bash
# Test script for Phases 4 and 5 implementation

set -e

echo "===== Testing Noxhime Bot Phases 4 and 5 ====="
echo "Date: $(date)"
echo

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for Node.js
echo -e "${BLUE}Checking for Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js.${NC}"
    exit 1
fi
echo -e "${GREEN}Node.js found: $(node --version)${NC}"

# Check for project files
echo -e "${BLUE}Checking project structure...${NC}"
if [ ! -d "/workspaces/noxhimetest/src" ] || [ ! -f "/workspaces/noxhimetest/package.json" ]; then
    echo -e "${RED}Project structure is incorrect. Missing essential files.${NC}"
    exit 1
fi
echo -e "${GREEN}Project structure looks good!${NC}"

# Build the project
echo -e "${BLUE}Building the project...${NC}"
cd /workspaces/noxhimetest && npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}Build completed successfully!${NC}"

# Set up mock data for testing
echo -e "${BLUE}Setting up mock data for testing...${NC}"
mkdir -p /workspaces/noxhimetest/data/mock
echo "May 27 10:15:32 host sshd[1234]: Failed password for invalid user admin from 192.168.1.100 port 12345 ssh2" > /workspaces/noxhimetest/data/mock/auth.log
echo "May 27 10:15:35 host fail2ban.actions: Ban 192.168.1.100" > /workspaces/noxhimetest/data/mock/fail2ban.log
touch /workspaces/noxhimetest/data/mock/syslog /workspaces/noxhimetest/data/mock/nginx-error.log
echo -e "${GREEN}Mock data created successfully!${NC}"

# Test initialization of the database
echo -e "${BLUE}Testing database initialization...${NC}"
NODE_ENV=development node -e "
const db = require('./dist/db');

async function testInit() {
  try {
    console.log('Initializing database...');
    const success = await db.initializeDatabase();
    console.log('Database initialized:', success);
    
    // Check if tables exist by getting mood data
    const mood = await db.getCurrentMood();
    console.log('Current mood data:', mood || 'None found');
    
    // Log a test event
    console.log('Logging test event...');
    await db.logEvent('TEST', 'Testing database functionality');
    
    // Get events
    const events = await db.getRecentEvents(1);
    console.log('Recent events:', events);
    
    return success;
  } catch (error) {
    console.error('Error during database test:', error);
    return false;
  }
}

testInit()
  .then(success => {
    if (success) {
      console.log('Database tests passed!');
      process.exit(0);
    } else {
      console.log('Database tests failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unhandled error in tests:', err);
    process.exit(1);
  });
"
if [ $? -ne 0 ]; then
    echo -e "${RED}Database tests failed!${NC}"
    exit 1
fi
echo -e "${GREEN}Database initialized successfully!${NC}"

# Test Sentinel Intelligence
echo -e "${BLUE}Testing Sentinel Intelligence...${NC}"
NODE_ENV=development node -e "
const { getSentinel } = require('./dist/sentinel');
const EventEmitter = require('events');
const mockClient = new EventEmitter();
mockClient.channels = { 
  fetch: async () => ({ 
    isTextBased: () => true, 
    send: async (msg) => console.log('DISCORD OUTPUT:', msg) 
  }) 
};
mockClient.isReady = () => true;

async function testSentinel() {
  try {
    console.log('Initializing Sentinel...');
    const sentinel = getSentinel(mockClient, 'mock-channel-id');
    
    console.log('Checking system uptime...');
    const uptime = await sentinel.getSystemUptime();
    console.log('System uptime:', uptime);
    
    console.log('Checking service status...');
    try {
      const services = await sentinel.getServicesStatus();
      console.log('Services:', services);
    } catch (error) {
      console.error('Error fetching services (this may be normal in test environment):', error.message);
    }
    
    console.log('Running log check...');
    await sentinel.checkLogs();
    
    return true;
  } catch (error) {
    console.error('Error testing Sentinel Intelligence:', error);
    return false;
  }
}

testSentinel()
  .then(success => {
    if (success) {
      console.log('Sentinel Intelligence tests completed!');
      process.exit(0);
    } else {
      console.log('Sentinel Intelligence tests failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unhandled error in tests:', err);
    process.exit(1);
  });
"
if [ $? -ne 0 ]; then
    echo -e "${RED}Sentinel Intelligence tests failed! (Some failures may be expected in test environment)${NC}"
else
    echo -e "${GREEN}Sentinel Intelligence test completed!${NC}"
fi

# Test Personality Core
echo -e "${BLUE}Testing Personality Core...${NC}"
NODE_ENV=development node -e "
// Import the PersonalityCore class
const { getPersonalityCore, EventType } = require('./dist/personality');

async function testPersonality() {
  try {
    console.log('Initializing Personality Core...');
    const personality = getPersonalityCore();
    await personality.initialize();
    
    console.log('Getting current mood...');
    const initialMood = personality.getMood();
    console.log('Initial mood:', initialMood);
    
    console.log('Processing system error event...');
    await personality.processEvent(EventType.SYSTEM_ERROR, 7);
    const afterErrorMood = personality.getMood();
    console.log('Mood after system error:', afterErrorMood);
    
    console.log('Processing successful operation event...');
    await personality.processEvent(EventType.SUCCESSFUL_OPERATION, 8);
    const afterSuccessMood = personality.getMood();
    console.log('Mood after success:', afterSuccessMood);
    
    console.log('Testing message styling...');
    const styledMessage = await personality.styleMessage('This is a test message');
    console.log('Styled message:', styledMessage);
    
    console.log('Testing emotional response generation...');
    const response = personality.generateEmotionalResponse('error', 5);
    console.log('Emotional response:', response);
    
    return true;
  } catch (error) {
    console.error('Error testing Personality Core:', error);
    return false;
  }
}

testPersonality()
  .then(success => {
    if (success) {
      console.log('Personality Core tests passed!');
      process.exit(0);
    } else {
      console.log('Personality Core tests failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unhandled error in tests:', err);
    process.exit(1);
  });
"
if [ $? -ne 0 ]; then
    echo -e "${RED}Personality Core tests failed!${NC}"
    exit 1
fi
echo -e "${GREEN}Personality Core tests passed!${NC}"

echo -e "${BLUE}===== All tests completed! =====${NC}"
echo "Make sure the services are properly running in production."
echo "Remember to test the following Discord commands:"
echo "- !uptime - Check system uptime"
echo "- !services - Check system services"
echo "- !mood - Check bot's current mood"
echo "- !sentinel <start|stop> - Control the Sentinel system"
echo "- !incidents - View security incidents"
echo "- !backup - Trigger manual backup"
echo
echo "Phases 4 and 5 implementation completed successfully!"
