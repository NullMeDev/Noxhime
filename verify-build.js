/**
 * Noxhime Bot - Build Verification
 * 
 * This script checks if the TypeScript compilation was successful
 * by verifying that the dist directory exists and contains the expected files.
 */

const fs = require('fs');
const path = require('path');

// Define the expected compiled files
const expectedFiles = [
  'index.js',
  'api.js',
  'db.js',
  'monitor.js',
  'personality.js',
  'sentinel.js',
  'whitelist.js',
  'whitelist-commands.js'
];

console.log('🔍 Verifying build output...');

// Check if dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory not found! Build failed.');
  process.exit(1);
}

// Check for expected files
let allFilesFound = true;
for (const file of expectedFiles) {
  const filePath = path.join(distDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Expected file not found: ${file}`);
    allFilesFound = false;
  } else {
    console.log(`✅ Found: ${file}`);
  }
}

if (allFilesFound) {
  console.log('🎉 Build verification successful! All expected files found.');
  process.exit(0);
} else {
  console.error('❌ Build verification failed! Some expected files are missing.');
  process.exit(1);
}

