#!/bin/bash
# Noxhime Bot - Compatibility Check Script
# This script checks if the current Node.js setup is compatible with the system

set -euo pipefail

# Text colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[*]${NC} Checking system compatibility for Noxhime Bot..."

# Check Ubuntu version
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo -e "${BLUE}[*]${NC} Detected OS: $PRETTY_NAME"
  
  # Check for Ubuntu 24.04 or newer
  if [[ "$ID" == "ubuntu" && "${VERSION_ID%%.*}" -ge 24 ]]; then
    echo -e "${YELLOW}[!]${NC} Ubuntu 24.04 or newer detected. Special compatibility mode enabled."
    UBUNTU_24_OR_NEWER=true
  else
    UBUNTU_24_OR_NEWER=false
  fi
else
  echo -e "${YELLOW}[!]${NC} Could not determine OS version. Compatibility checks may be inaccurate."
  UBUNTU_24_OR_NEWER=false
fi

# Check Node.js version
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | cut -d 'v' -f 2)
  echo -e "${BLUE}[*]${NC} Node.js version: $NODE_VERSION"
  
  # Convert version string to comparable number
  IFS='.' read -r -a NODE_SEMVER <<< "$NODE_VERSION"
  NODE_MAJOR="${NODE_SEMVER[0]}"
  
  if [[ $NODE_MAJOR -lt 18 ]]; then
    echo -e "${RED}[✗]${NC} Node.js version is too old. Noxhime requires Node.js 18 or newer."
    echo -e "${BLUE}[*]${NC} Recommended action: Update Node.js using the NodeSource repository."
    exit 1
  elif [[ $NODE_MAJOR -lt 20 && "$UBUNTU_24_OR_NEWER" == true ]]; then
    echo -e "${YELLOW}[!]${NC} Node.js version $NODE_MAJOR may have compatibility issues with Ubuntu 24.04+."
    echo -e "${BLUE}[*]${NC} Recommended action: Update to Node.js 20 or newer."
    exit 2
  else
    echo -e "${GREEN}[✓]${NC} Node.js version is compatible."
  fi
else
  echo -e "${RED}[✗]${NC} Node.js not found. Please install Node.js before running the installer."
  exit 1
fi

# Check npm version
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm -v)
  echo -e "${BLUE}[*]${NC} npm version: $NPM_VERSION"
else
  echo -e "${RED}[✗]${NC} npm not found. Please install npm before running the installer."
  exit 1
fi

# Check for known problematic packages
echo -e "${BLUE}[*]${NC} Checking for known problematic packages..."

# Example check for problematic global packages
PROBLEMATIC_PACKAGES=()
if npm list -g node-agent-base &> /dev/null; then
  PROBLEMATIC_PACKAGES+=("node-agent-base")
fi

if npm list -g node-gyp &> /dev/null; then
  # Check if this version of node-gyp is the problematic one
  NODEGYP_VERSION=$(npm list -g node-gyp | grep node-gyp | cut -d '@' -f 2)
  if [[ "$UBUNTU_24_OR_NEWER" == true && "$NODEGYP_VERSION" == "7."* ]]; then
    PROBLEMATIC_PACKAGES+=("node-gyp@$NODEGYP_VERSION")
  fi
fi

if npm list -g node-emoji-regex &> /dev/null; then
  PROBLEMATIC_PACKAGES+=("node-emoji-regex")
fi

if [ ${#PROBLEMATIC_PACKAGES[@]} -gt 0 ]; then
  echo -e "${YELLOW}[!]${NC} Detected potentially problematic packages:"
  for pkg in "${PROBLEMATIC_PACKAGES[@]}"; do
    echo -e "    - $pkg"
  done
  echo -e "${BLUE}[*]${NC} Recommended action: Update or remove these packages before installation."
else
  echo -e "${GREEN}[✓]${NC} No known problematic packages detected."
fi

echo -e "${GREEN}[✓]${NC} Compatibility check complete."
exit 0
