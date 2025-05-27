#!/bin/bash
# Script to install the pre-commit hook

set -euo pipefail

# Text colors and formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the project root
PROJECT_ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"
HOOK_SOURCE="$PROJECT_ROOT/scripts/pre-commit-hook"

# Check if .git directory exists
if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo -e "${RED}[✗]${NC} Not a git repository. Exiting."
  exit 1
fi

# Check if source hook exists
if [ ! -f "$HOOK_SOURCE" ]; then
  echo -e "${RED}[✗]${NC} Pre-commit hook source not found at $HOOK_SOURCE"
  exit 1
fi

# Create hooks directory if it doesn't exist
if [ ! -d "$HOOKS_DIR" ]; then
  mkdir -p "$HOOKS_DIR"
fi

# Check if hook already exists
if [ -f "$PRE_COMMIT_HOOK" ]; then
  echo -e "${RED}[!]${NC} Pre-commit hook already exists at $PRE_COMMIT_HOOK"
  read -p "Do you want to overwrite it? (y/n): " -n 1 -r
  echo
  
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Copy hook
cp "$HOOK_SOURCE" "$PRE_COMMIT_HOOK"
chmod +x "$PRE_COMMIT_HOOK"

echo -e "${GREEN}[✓]${NC} Pre-commit hook installed successfully!"
echo "The hook will automatically increment the patch version number on each commit."
exit 0
