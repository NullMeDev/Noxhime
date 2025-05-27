#!/bin/bash
# Noxhime Quick Installation Script
# This script downloads and runs the full installer

# Colors for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "███╗   ██╗ ██████╗ ██╗  ██╗██╗  ██╗██╗███╗   ███╗███████╗"
echo "████╗  ██║██╔═══██╗╚██╗██╔╝██║  ██║██║████╗ ████║██╔════╝"
echo "██╔██╗ ██║██║   ██║ ╚███╔╝ ███████║██║██╔████╔██║█████╗  "
echo "██║╚██╗██║██║   ██║ ██╔██╗ ██╔══██║██║██║╚██╔╝██║██╔══╝  "
echo "██║ ╚████║╚██████╔╝██╔╝ ██╗██║  ██║██║██║ ╚═╝ ██║███████╗"
echo "╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝"
echo -e "${NC}"
echo -e "${BOLD}Quick Setup Script${NC}"
echo
# Run compatibility check if the script exists locally
if [ -f "./scripts/compatibility-check.sh" ]; then
    echo "Running compatibility check..."
    bash ./scripts/compatibility-check.sh
    CHECK_RESULT=$?
    
    if [ $CHECK_RESULT -eq 1 ]; then
        echo "Compatibility check failed. Please fix the issues before continuing."
        exit 1
    elif [ $CHECK_RESULT -eq 2 ]; then
        echo "Compatibility warning detected. Installation may proceed but with potential issues."
        read -p "Do you want to continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Installation aborted."
            exit 1
        fi
    fi
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Installing git..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y git
    elif command -v yum &> /dev/null; then
        sudo yum install -y git
    elif command -v pacman &> /dev/null; then
        sudo pacman -Sy git --noconfirm
    else
        echo "Could not install git. Please install git manually and try again."
        exit 1
    fi
fi

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory: $TEMP_DIR"

# Clone the repository to the temporary directory
echo "Cloning Noxhime repository..."
git clone https://github.com/NullMeDev/noxhime-bot.git "$TEMP_DIR"

# Run the installer script
if [ -f "$TEMP_DIR/noxhime-installer.sh" ]; then
    echo "Installer found. Running the installation script..."
    chmod +x "$TEMP_DIR/noxhime-installer.sh"
    "$TEMP_DIR/noxhime-installer.sh"
else
    echo "Installer script not found in the repository."
    echo "Downloading installer directly..."
    
    # Try to download the installer script
    if command -v curl &> /dev/null; then
        curl -o "$TEMP_DIR/noxhime-installer.sh" https://raw.githubusercontent.com/NullMeDev/noxhime-bot/main/noxhime-installer.sh
    elif command -v wget &> /dev/null; then
        wget -O "$TEMP_DIR/noxhime-installer.sh" https://raw.githubusercontent.com/NullMeDev/noxhime-bot/main/noxhime-installer.sh
    else
        echo "Neither curl nor wget is installed. Cannot download the installer."
        exit 1
    fi
    
    if [ -f "$TEMP_DIR/noxhime-installer.sh" ]; then
        chmod +x "$TEMP_DIR/noxhime-installer.sh"
        "$TEMP_DIR/noxhime-installer.sh"
    else
        echo "Failed to download installer script."
        exit 1
    fi
fi

# Clean up
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Noxhime setup complete!${NC}"
