/**
 * Noxhime Bot - Smoke Test
 * 
 * This script:
 * 1. Starts the server
 * 2. Makes a request to the health endpoint
 * 3. Exits with an appropriate status code
 */

const { spawn } = require('child_process');
const http = require('http');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const API_PORT = process.env.API_PORT || 3000;
const API_HOST = process.env.API_HOST || 'localhost'; // Use 'noxhime' when testing with Docker Compose
const HEALTH_ENDPOINT = '/api/status/public';
const STARTUP_WAIT_MS = 5000; // Time to wait for server to start
const REQUEST_TIMEOUT_MS = 5000; // Request timeout

console.log('🔍 Starting smoke test...');

// Start the server in a child process
console.log('📡 Starting server...');
const server = spawn('node', ['dist/index.js'], {
  detached: true,
  stdio: 'inherit'
});

// Give the server time to start up
setTimeout(() => {
  console.log(`🔌 Testing health endpoint: http://${API_HOST}:${API_PORT}${HEALTH_ENDPOINT}`);
  
  // Make a request to the health endpoint
  const req = http.get(`http://${API_HOST}:${API_PORT}${HEALTH_ENDPOINT}`, {
    timeout: REQUEST_TIMEOUT_MS
  }, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      // Check if we got a valid response
      if (res.statusCode === 200) {
        try {
          const responseObj = JSON.parse(data);
          console.log('✅ Health check successful!');
          console.log('📊 Response:', JSON.stringify(responseObj, null, 2));
          cleanupAndExit(0); // Success
        } catch (error) {
          console.error('❌ Invalid JSON response:', data);
          cleanupAndExit(1); // Failure
        }
      } else {
        console.error(`❌ Health check failed with status code: ${res.statusCode}`);
        console.error('Response:', data);
        cleanupAndExit(1); // Failure
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Error making request:', error.message);
    cleanupAndExit(1); // Failure
  });
  
  req.on('timeout', () => {
    console.error('❌ Request timed out');
    req.destroy();
    cleanupAndExit(1); // Failure
  });
  
}, STARTUP_WAIT_MS);

// Helper function to clean up and exit
function cleanupAndExit(code) {
  console.log(`🧹 Cleaning up and exiting with code ${code}...`);
  // Kill the server process and all its children
  if (server && !server.killed) {
    process.kill(-server.pid);
  }
  process.exit(code);
}

// Handle unexpected termination
process.on('SIGINT', () => cleanupAndExit(130));
process.on('SIGTERM', () => cleanupAndExit(143));

