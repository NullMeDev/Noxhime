#!/bin/bash
# Noxhime Whitelist Test Script
# Tests the whitelist functionality for the API server

echo "Noxhime Whitelist Test Script"
echo "==========================="
echo

# Default test server port
PORT=3000

# Function to make an API request
make_request() {
  local endpoint="$1"
  local ip="$2"
  local port="$3"
  
  echo -e "\nTesting request to $endpoint"
  echo "IP: $ip, Port: $port"
  
  # Use curl with headers to simulate specific IP and port
  curl -s -X GET \
    -H "X-Forwarded-For: $ip" \
    -H "X-Forwarded-Port: $port" \
    "http://localhost:$PORT$endpoint"
  
  echo
}

# Start the test server
echo "Starting test API server..."
node -e "
const express = require('express');
const fs = require('fs');
const path = require('path');
const { whitelistMiddleware, loadWhitelistConfig } = require('./dist/whitelist');

// Create config directory if it doesn't exist
const configDir = './config';
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Create test whitelist configuration
const config = {
  ipWhitelist: {
    enabled: true,
    addresses: ['127.0.0.1', '192.168.1.100']
  },
  portWhitelist: {
    enabled: true,
    ports: [8080, 9000]
  }
};

// Save test configuration
fs.writeFileSync(path.join(configDir, 'whitelist.json'), JSON.stringify(config, null, 2));

// Create test server
const app = express();
const whitelistConfig = loadWhitelistConfig('./config/whitelist.json');

// Apply whitelist middleware
app.use(whitelistMiddleware(whitelistConfig));

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Access granted' });
});

// Public endpoint (no whitelist check)
app.get('/public', (req, res) => {
  res.json({ success: true, message: 'Public endpoint' });
});

// Start server
const port = $PORT;
app.listen(port, () => {
  console.log('Test server running on port ' + port);
});
" &

# Store server PID
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 2

echo "Running whitelist tests..."

# Test cases
echo -e "\n=== Test Cases ==="

# Test 1: Whitelisted IP and Port
echo -e "\nTest 1: Whitelisted IP and Port (Should succeed)"
make_request "/api/test" "127.0.0.1" "8080"

# Test 2: Whitelisted IP, non-whitelisted Port
echo -e "\nTest 2: Whitelisted IP, non-whitelisted Port (Should fail)"
make_request "/api/test" "127.0.0.1" "5000"

# Test 3: Non-whitelisted IP, whitelisted Port
echo -e "\nTest 3: Non-whitelisted IP, whitelisted Port (Should fail)"
make_request "/api/test" "10.0.0.1" "8080"

# Test 4: Non-whitelisted IP and Port
echo -e "\nTest 4: Non-whitelisted IP and Port (Should fail)"
make_request "/api/test" "10.0.0.1" "5000"

# Test 5: Public endpoint (should bypass whitelist)
echo -e "\nTest 5: Public endpoint (Should succeed)"
make_request "/public" "10.0.0.1" "5000"

# Cleanup
echo -e "\nCleaning up..."
kill $SERVER_PID 2>/dev/null

echo -e "\nTest completed!"
