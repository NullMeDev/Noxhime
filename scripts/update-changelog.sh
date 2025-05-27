#!/bin/bash
# update-changelog.sh - Script to update the changelog in README.md

set -euo pipefail

# Text colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Find the project root (where the README.md file is)
PROJECT_ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")
README_FILE="$PROJECT_ROOT/README.md"

# Check if README.md exists
if [ ! -f "$README_FILE" ]; then
  echo -e "${RED}Error: README.md not found at $README_FILE${NC}"
  exit 1
fi

# Get the version from package.json
VERSION=$(grep '"version"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/.*"version": "\(.*\)",/\1/')
DATE=$(date +%B\ %d,\ %Y)

# Functions to show usage and help
show_usage() {
  echo -e "${YELLOW}Usage:${NC}"
  echo -e "  $0 [options]"
  echo
  echo -e "${YELLOW}Options:${NC}"
  echo -e "  -h, --help        Show this help message"
  echo -e "  -v, --version     Override version (default: from package.json)"
  echo -e "  -d, --date        Override date (default: today)"
  echo -e "  -a, --add         Add a changelog entry"
  echo -e "  -f, --fix         Fix a changelog entry"
  echo -e "  -u, --update      Update a changelog entry"
  echo
  echo -e "${YELLOW}Examples:${NC}"
  echo -e "  $0 --add \"Auto-update feature with Discord notifications\""
  echo -e "  $0 --fix \"Installation issues with Node.js on Ubuntu 24.04\""
  echo -e "  $0 --update \"Package versions for better compatibility\""
}

# Check if no arguments provided
if [ $# -eq 0 ]; then
  show_usage
  exit 1
fi

# Parse arguments
ENTRIES=()
ENTRY_TYPE=""

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -h|--help)
      show_usage
      exit 0
      ;;
    -v|--version)
      VERSION="$2"
      shift
      shift
      ;;
    -d|--date)
      DATE="$2"
      shift
      shift
      ;;
    -a|--add)
      ENTRY_TYPE="Added"
      ENTRIES+=("$2")
      shift
      shift
      ;;
    -f|--fix)
      ENTRY_TYPE="Fixed"
      ENTRIES+=("$2")
      shift
      shift
      ;;
    -u|--update)
      ENTRY_TYPE="Updated"
      ENTRIES+=("$2")
      shift
      shift
      ;;
    -i|--improve)
      ENTRY_TYPE="Improved"
      ENTRIES+=("$2")
      shift
      shift
      ;;
    -r|--remove)
      ENTRY_TYPE="Removed"
      ENTRIES+=("$2")
      shift
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      show_usage
      exit 1
      ;;
  esac
done

if [ -z "$ENTRY_TYPE" ] || [ ${#ENTRIES[@]} -eq 0 ]; then
  echo -e "${RED}Error: No entries provided.${NC}"
  show_usage
  exit 1
fi

# Check if the changelog section exists, if not create it
if ! grep -q "## Changelog" "$README_FILE"; then
  echo -e "${YELLOW}Changelog section not found. Creating it...${NC}"
  cat >> "$README_FILE" << EOF

## Changelog

EOF
fi

# Check if the version already exists in the changelog
if grep -q "### v$VERSION" "$README_FILE"; then
  echo -e "${BLUE}Version v$VERSION already exists in the changelog. Adding entries to existing version...${NC}"
  
  # Get the line number of the version header
  VERSION_LINE=$(grep -n "### v$VERSION" "$README_FILE" | cut -d: -f1)
  
  # Add entries to the existing version section
  for entry in "${ENTRIES[@]}"; do
    # Find the line after the version header to insert the new entry
    INSERT_LINE=$((VERSION_LINE + 1))
    
    # Insert new entry
    sed -i "${INSERT_LINE}i- **${ENTRY_TYPE}**: ${entry}" "$README_FILE"
  done
else
  echo -e "${BLUE}Creating new version v$VERSION in the changelog...${NC}"
  
  # Get the line number after the "## Changelog" line
  CHANGELOG_LINE=$(grep -n "## Changelog" "$README_FILE" | cut -d: -f1)
  INSERT_LINE=$((CHANGELOG_LINE + 1))
  
  # Create new version header
  sed -i "${INSERT_LINE}i\
\
### v$VERSION ($DATE)" "$README_FILE"
  
  # Add entries
  INSERT_LINE=$((INSERT_LINE + 1))
  for entry in "${ENTRIES[@]}"; do
    sed -i "${INSERT_LINE}i- **${ENTRY_TYPE}**: ${entry}" "$README_FILE"
    INSERT_LINE=$((INSERT_LINE + 1))
  done
fi

echo -e "${GREEN}Changelog updated successfully!${NC}"
exit 0
