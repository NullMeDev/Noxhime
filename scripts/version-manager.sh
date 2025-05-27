#!/bin/bash
# Version Management Script for Noxhime Bot
# This script handles version updates and ensures consistency between VERSION file and package.json

set -euo pipefail

# Text colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Find the project root
PROJECT_ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")
VERSION_FILE="$PROJECT_ROOT/VERSION"
PACKAGE_JSON="$PROJECT_ROOT/package.json"

# Check if required files exist
if [ ! -f "$VERSION_FILE" ]; then
  echo -e "${YELLOW}[!]${NC} VERSION file not found. Creating with version 0.0.0"
  echo "0.0.0" > "$VERSION_FILE"
fi

if [ ! -f "$PACKAGE_JSON" ]; then
  echo -e "${RED}[✗]${NC} package.json not found!"
  exit 1
fi

# Function to update versions in both files
update_versions() {
  local new_version="$1"
  local update_type="$2"
  
  # Update VERSION file
  echo "$new_version" > "$VERSION_FILE"
  echo -e "${GREEN}[✓]${NC} Updated VERSION file to $new_version"
  
  # Update package.json
  sed -i 's/"version": "[^"]*"/"version": "'"$new_version"'"/' "$PACKAGE_JSON"
  echo -e "${GREEN}[✓]${NC} Updated package.json version to $new_version"
  
  # If we have the changelog update script, add a version entry
  if [ -f "$PROJECT_ROOT/scripts/update-changelog.sh" ]; then
    bash "$PROJECT_ROOT/scripts/update-changelog.sh" --version "$new_version" --add "Version $update_type update"
  fi
}

# Function to get current version from VERSION file
get_current_version() {
  if [ -f "$VERSION_FILE" ]; then
    cat "$VERSION_FILE"
  else
    echo "0.0.0"
  fi
}

# Function to increment version
increment_version() {
  local version="$1"
  local update_type="$2"
  
  # Split version into components
  IFS='.' read -ra VERSION_PARTS <<< "$version"
  local major="${VERSION_PARTS[0]}"
  local minor="${VERSION_PARTS[1]}"
  local patch="${VERSION_PARTS[2]}"
  
  # Increment based on update type
  case "$update_type" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
    *)
      echo -e "${RED}[✗]${NC} Invalid update type: $update_type. Use 'major', 'minor', or 'patch'."
      exit 1
      ;;
  esac
  
  echo "$major.$minor.$patch"
}

# Show usage info
show_usage() {
  echo -e "${YELLOW}Usage:${NC}"
  echo -e "  $0 [options]"
  echo
  echo -e "${YELLOW}Options:${NC}"
  echo -e "  -h, --help        Show this help message"
  echo -e "  -c, --current     Show current version"
  echo -e "  -s, --set VERSION Set specific version (e.g., 1.2.3)"
  echo -e "  --major           Increment major version (X.0.0)"
  echo -e "  --minor           Increment minor version (x.X.0)"
  echo -e "  --patch           Increment patch version (x.x.X)"
  echo
  echo -e "${YELLOW}Examples:${NC}"
  echo -e "  $0 --current"
  echo -e "  $0 --set 2.0.0"
  echo -e "  $0 --minor"
}

# Parse command-line arguments
if [ $# -eq 0 ]; then
  show_usage
  exit 1
fi

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -h|--help)
      show_usage
      exit 0
      ;;
    -c|--current)
      current_version=$(get_current_version)
      echo -e "${BLUE}Current version:${NC} $current_version"
      exit 0
      ;;
    -s|--set)
      if [[ $# -lt 2 ]]; then
        echo -e "${RED}[✗]${NC} Missing version argument for --set"
        exit 1
      fi
      
      new_version="$2"
      # Validate version format
      if [[ ! $new_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "${RED}[✗]${NC} Invalid version format. Use semantic versioning (e.g., 1.2.3)."
        exit 1
      fi
      
      update_versions "$new_version" "set"
      shift
      ;;
    --major)
      current_version=$(get_current_version)
      new_version=$(increment_version "$current_version" "major")
      update_versions "$new_version" "major"
      ;;
    --minor)
      current_version=$(get_current_version)
      new_version=$(increment_version "$current_version" "minor")
      update_versions "$new_version" "minor"
      ;;
    --patch)
      current_version=$(get_current_version)
      new_version=$(increment_version "$current_version" "patch")
      update_versions "$new_version" "patch"
      ;;
    *)
      echo -e "${RED}[✗]${NC} Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
  shift
done

exit 0
