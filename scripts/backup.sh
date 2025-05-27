#!/bin/bash
# Noxhime Automated Backup Script
# Created on May 27, 2025

# Set up error handling
set -e
trap 'echo "Error occurred at line $LINENO"; exit 1' ERR

# Create timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="./backups/$TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Copy files to backup directory
echo "Backing up database"
cp -r "./data/noxhime.db" "$BACKUP_DIR/" || echo "Warning: Could not backup database"

echo "Backing up logs"
mkdir -p "$BACKUP_DIR/logs"
if [ -d "./logs" ]; then
  cp -r "./logs/" "$BACKUP_DIR/logs/" || echo "Warning: Could not backup logs"
fi

# Create system info file
echo "Collecting system information"
{
  echo "# System Information"
  echo "Backup Date: $(date)"
  echo "Hostname: $(hostname)"
  echo "Kernel: $(uname -r)"
  echo "Uptime: $(uptime)"
  echo ""
  echo "# Disk Usage"
  df -h
  echo ""
  echo "# Memory Usage"
  free -m
  echo ""
  echo "# Process List (Top 10 by memory)"
  ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | head -n 11
} > "$BACKUP_DIR/system_info.txt"

# Try to sync to remote storage if rclone is installed
if command -v rclone &> /dev/null; then
  echo "Syncing to remote storage"
  # The remote path should be configured in .env as RCLONE_REMOTE
  # Default is gdrive:NoxhimeBackups
  REMOTE="${RCLONE_REMOTE:-gdrive:NoxhimeBackups}"
  
  rclone sync "$BACKUP_DIR" "$REMOTE/noxhime-backup-$TIMESTAMP" --progress || echo "Warning: Remote sync failed"
else
  echo "Rclone not installed. Skipping remote sync."
fi

# Clean up old local backups (keep last 5)
echo "Cleaning old backups"
if [ -d "./backups" ]; then
  cd ./backups
  ls -1t | tail -n +6 | xargs -I {} rm -rf "./{}"
  cd ..
fi

echo "Backup completed successfully at $(date)"
