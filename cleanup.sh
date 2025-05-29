#!/bin/bash
# Noxhime Bot - Cleanup Script for Ubuntu 24.04
# This script removes unnecessary files and optimizes the bot for production use

# Exit on error, undefined variables, and propagate pipe errors
set -euo pipefail

# Text colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Utility functions
log() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

section() {
  echo -e "\n${PURPLE}=========================================${NC}"
  echo -e "${BOLD}$1${NC}"
  echo -e "${PURPLE}=========================================${NC}"
}

# Check if script is run with correct permissions
check_directory() {
  section "Checking Environment"
  
  # Check if running in the correct directory
  if [ ! -f "package.json" ]; then
    error "This script must be run from the root of the Noxhime bot directory"
  fi
  
  # Check if Node.js is installed
  if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please run install-ubuntu24.sh first."
  fi
  
  # Check Node.js version
  NODE_VERSION=$(node -v)
  if [[ ! $NODE_VERSION == v18.* ]]; then
    warn "You are using Node.js $NODE_VERSION, but this application is optimized for v18.x"
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      error "Please install Node.js 18.x and try again"
    fi
  fi
  
  log "Environment checks passed"
}

# Remove unnecessary installation scripts
remove_installation_scripts() {
  section "Removing Unnecessary Installation Scripts"
  
  SCRIPTS_TO_REMOVE=(
    "get-docker.sh"
    "install-noxhime.sh"
    "noxhime-installer.sh"
    "unified-install.sh"
    "quick-setup.sh"
    "docker-compose.yml"
    "Dockerfile"
    ".dockerignore"
  )
  
  for script in "${SCRIPTS_TO_REMOVE[@]}"; do
    if [ -f "$script" ]; then
      log "Removing $script..."
      rm "$script"
    fi
  done
  
  # Keep only install-ubuntu24.sh
  if [ -f "install-ubuntu24.sh" ]; then
    log "Keeping install-ubuntu24.sh for future reference"
  fi
  
  success "Unnecessary installation scripts removed"
}

# Remove testing files
remove_testing_files() {
  section "Removing Testing Files"
  
  # Remove test files
  log "Removing test-related files..."
  
  # Remove test script from package.json
  if [ -f "package.json" ]; then
    log "Removing test-alert script from package.json..."
    # Use temp file to avoid issues with inline editing
    jq 'del(.scripts."test-alert")' package.json > package.json.tmp
    mv package.json.tmp package.json
  fi
  
  # Remove testing configurations
  FILES_TO_REMOVE=(
    "test-alert.sh"
    "test.js"
    "jest.config.js"
    ".github/workflows/test.yml"
  )
  
  for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
      log "Removing $file..."
      rm "$file"
    fi
  done
  
  success "Testing files removed"
}

# Remove OAuth related code
remove_oauth_code() {
  section "Removing OAuth Related Code"
  
  log "Checking for OAuth related files..."
  
  # No OAuth files found in our analysis, but we'll search just to be sure
  OAUTH_FILES=$(grep -r "oauth" --include="*.ts" --include="*.js" . 2>/dev/null || echo "")
  
  if [ -n "$OAUTH_FILES" ]; then
    warn "Found potential OAuth references:"
    echo "$OAUTH_FILES"
    
    read -p "Do you want to review these files manually? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      log "Please review and remove OAuth code manually"
    fi
  else
    log "No OAuth code found"
  fi
  
  success "OAuth check completed"
}

# Clean up Docker files
cleanup_docker_files() {
  section "Cleaning Up Docker Files"
  
  # No longer ask - automatically remove Docker files
  log "Removing Docker-related files..."
  
  DOCKER_FILES=(
    "docker-compose.yml"
    "Dockerfile"
    ".dockerignore"
  )
  
  for file in "${DOCKER_FILES[@]}"; do
    if [ -f "$file" ]; then
      log "Removing $file..."
      rm "$file"
    fi
  done
  
  success "Docker files removed"
}

# Optimize npm packages
optimize_npm_packages() {
  section "Optimizing npm Packages"
  
  log "Removing development dependencies..."
  
  # Check if this is a production environment
  read -p "Is this a production environment? (y/N): " -n 1 -r
  echo
  
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Installing only production dependencies..."
    
    # Clean npm cache
    npm cache clean --force
    
    # Remove node_modules
    rm -rf node_modules
    
    # Install only production dependencies
    npm ci --only=production --no-fund --no-audit
    
    success "Production dependencies installed"
  else
    log "Keeping development dependencies for future development"
  fi
}

# Build the project to ensure everything works
verify_build() {
  section "Verifying Build"
  
  log "Building the project to verify configuration..."
  
  # Backup package.json in case build script has been modified
  cp package.json package.json.bak
  
  # Ensure build script exists
  if ! grep -q "\"build\":" package.json; then
    warn "No build script found in package.json"
    log "Adding build script..."
    
    # Add build script if missing
    jq '.scripts.build = "tsc && npm run build:web"' package.json > package.json.tmp
    mv package.json.tmp package.json
  fi
  
  # Ensure build:web script exists
  if ! grep -q "\"build:web\":" package.json; then
    warn "No build:web script found in package.json"
    log "Adding build:web script..."
    
    # Add build:web script if missing
    jq '.scripts."build:web" = "npx tailwindcss -i ./web/src/styles.css -o ./web/public/styles.css"' package.json > package.json.tmp
    mv package.json.tmp package.json
  fi
  
  # Run build
  if npm run build; then
    success "Build completed successfully"
  else
    error "Build failed. Please check the errors above."
    # Restore package.json
    mv package.json.bak package.json
  fi
  
  # Remove backup if we got this far
  rm -f package.json.bak
}

# Create basic directories if they don't exist
ensure_directories() {
  section "Ensuring Required Directories"
  
  REQUIRED_DIRS=(
    "data"
    "web/public"
    "web/src"
    "dist"
  )
  
  for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
      log "Creating directory $dir..."
      mkdir -p "$dir"
    fi
  done
  
  # Ensure Tailwind styles exist
  if [ ! -f "web/src/styles.css" ]; then
    log "Creating basic Tailwind CSS file..."
    mkdir -p web/src
    cat > web/src/styles.css << EOL
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
body {
  @apply bg-gray-100 text-gray-800;
}

.dashboard-card {
  @apply bg-white rounded-lg shadow-md p-4 transition-all;
  @apply hover:shadow-lg border border-gray-200;
}

.status-badge {
  @apply px-2 py-1 rounded-full text-xs font-semibold;
}
.status-good {
  @apply bg-green-100 text-green-800;
}
.status-warning {
  @apply bg-yellow-100 text-yellow-800;
}
.status-critical {
  @apply bg-red-100 text-red-800;
}
EOL
    
    success "Created basic Tailwind CSS file"
  fi
  
  success "Required directories verified"
}

# Ensure Node.js version is correct in package.json
ensure_node_version() {
  section "Ensuring Node.js 18.x Compatibility"
  
  log "Checking Node.js version in package.json..."
  
  # Check if engines field exists
  if ! grep -q "\"engines\":" package.json; then
    log "Adding Node.js version requirement to package.json..."
    
    # Use jq to add engines field
    jq '. + {"engines": {"node": "18.x"}}' package.json > package.json.tmp
    mv package.json.tmp package.json
    
    success "Added Node.js 18.x requirement to package.json"
  else
    # Check if node version is specified correctly
    NODE_VERSION_SPEC=$(jq -r '.engines.node // ""' package.json)
    
    if [[ "$NODE_VERSION_SPEC" != "18.x" ]]; then
      log "Updating Node.js version requirement in package.json..."
      
      # Update node version in engines field
      jq '.engines.node = "18.x"' package.json > package.json.tmp
      mv package.json.tmp package.json
      
      success "Updated Node.js version requirement to 18.x"
    else
      log "Node.js 18.x requirement already set in package.json"
    fi
  fi
}

# Ensure proper .env file exists
ensure_env_file() {
  section "Checking Environment Configuration"
  
  if [ ! -f ".env" ]; then
    warn "No .env file found"
    
    if [ -f ".env.example" ]; then
      log "Creating .env from .env.example..."
      cp .env.example .env
      
      # Generate JWT secret if needed
      JWT_SECRET=$(openssl rand -hex 32)
      sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
      
      # Generate BioLock override key if needed
      BIOLOCK_OVERRIDE_KEY=$(openssl rand -hex 16)
      sed -i "s/BIOLOCK_OVERRIDE_KEY=.*/BIOLOCK_OVERRIDE_KEY=$BIOLOCK_OVERRIDE_KEY/" .env
      
      log "Created .env file with secure random keys"
      log "Remember to update the Discord token and other configuration values"
    else
      warn "No .env.example found. Please create a .env file manually."
    fi
  else
    log ".env file already exists"
    
    # Check for important configuration keys
    if ! grep -q "JWT_SECRET=" .env || grep -q "JWT_SECRET=$" .env; then
      log "Generating new JWT_SECRET..."
      JWT_SECRET=$(openssl rand -hex 32)
      
      if grep -q "JWT_SECRET=" .env; then
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
      else
        echo "JWT_SECRET=$JWT_SECRET" >> .env
      fi
    fi
    
    if ! grep -q "BIOLOCK_OVERRIDE_KEY=" .env || grep -q "BIOLOCK_OVERRIDE_KEY=$" .env; then
      log "Generating new BIOLOCK_OVERRIDE_KEY..."
      BIOLOCK_OVERRIDE_KEY=$(openssl rand -hex 16)
      
      if grep -q "BIOLOCK_OVERRIDE_KEY=" .env; then
        sed -i "s/BIOLOCK_OVERRIDE_KEY=.*/BIOLOCK_OVERRIDE_KEY=$BIOLOCK_OVERRIDE_KEY/" .env
      else
        echo "BIOLOCK_OVERRIDE_KEY=$BIOLOCK_OVERRIDE_KEY" >> .env
      fi
    fi
  fi
  
  # Create backup of .env file
  if [ -f ".env" ]; then
    mkdir -p data
    cp .env data/.env.backup
    log "Created backup of .env file in data/.env.backup"
  fi
  
  success "Environment configuration checked"
}

# Final verification and report
final_verification() {
  section "Final Verification"
  
  log "Verifying the installation..."
  
  # Check if essential files exist
  ESSENTIAL_FILES=(
    "package.json"
    "src/index.ts"
    "src/biolock.ts"
    "src/api.ts"
    "web/public/index.html"
    "db/schema.sql"
  )
  
  MISSING_FILES=0
  for file in "${ESSENTIAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
      warn "Essential file missing: $file"
      MISSING_FILES=$((MISSING_FILES + 1))
    fi
  done
  
  if [ $MISSING_FILES -gt 0 ]; then
    warn "$MISSING_FILES essential files are missing. The bot may not function correctly."
  else
    success "All essential files are present"
  fi
  
  # Check Node.js version again
  NODE_VERSION=$(node -v)
  log "Node.js version: $NODE_VERSION"
  
  # Check npm version
  NPM_VERSION=$(npm -v)
  log "npm version: $NPM_VERSION"
  
  # Check dist directory
  if [ -d "dist" ] && [ "$(find dist -type f -name "*.js" | wc -l)" -gt 0 ]; then
    success "Build output files found in dist directory"
  else
    warn "No build output files found. You may need to run 'npm run build'"
  fi
  
  # Check for web files
  if [ -d "web/public" ] && [ -f "web/public/index.html" ]; then
    success "Web dashboard files found"
  else
    warn "Web dashboard files not found or incomplete"
  fi
  
  # Check database
  if [ -f "data/noxhime.db" ]; then
    success "Database file found"
  else
    warn "Database file not found. It will be created when the bot starts."
  fi
  
  section "Cleanup Complete"
  
  echo -e "${GREEN}The Noxhime bot has been optimized for Ubuntu 24.04 with Node.js 18.x.${NC}"
  echo
  echo -e "${YELLOW}Next steps:${NC}"
  echo "1. Update your .env file with your Discord token and other settings"
  echo "2. Start the bot with: npm start"
  echo "3. Or use systemd: sudo systemctl start noxhime-bot"
  echo
  echo -e "${YELLOW}BioLock Information:${NC}"
  if [ -f ".env" ]; then
    BIOLOCK_KEY=$(grep "BIOLOCK_OVERRIDE_KEY" .env | cut -d= -f2)
    if [ -n "$BIOLOCK_KEY" ]; then
      echo "Emergency Override Key: $BIOLOCK_KEY"
      echo "Use this with !override command in emergencies"
    fi
  fi
  echo
  echo -e "${GREEN}Thank you for using Noxhime Bot!${NC}"
}

# Main function
main() {
  echo -e "${PURPLE}"
  cat << "EOF"
 _   _            _     _                 ____        _   
| \ | | _____  __| |__ (_)_ __ ___   ___ | __ )  ___ | |_ 
|  \| |/ _ \ \/ /| '_ \| | '_ ` _ \ / _ \|  _ \ / _ \| __|
| |\  | (_) >  < | | | | | | | | | |  __/| |_) | (_) | |_ 
|_| \_|\___/_/\_\|_| |_|_|_| |_| |_|\___|____/ \___/ \__|
                                                          
EOF
  echo -e "${NC}"
  echo -e "${BOLD}Cleanup and Optimization Script${NC}"
  echo -e "Optimizing Noxhime Bot for Ubuntu 24.04 with Node.js 18.x"
  echo
  
  read -p "This script will remove unnecessary files and optimize the bot. Continue? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Cleanup cancelled"
  fi
  
  # Run all cleanup and optimization steps
  check_directory
  remove_installation_scripts
  remove_testing_files
  remove_oauth_code
  cleanup_docker_files
  ensure_node_version
  ensure_env_file
  ensure_directories
  optimize_npm_packages
  verify_build
  final_verification
}

# Run main function
main "$@"

