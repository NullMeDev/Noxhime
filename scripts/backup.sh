#!/bin/bash
# Noxhime Automated Backup Script
# Created on 2025-05-30T23:24:25.273Z

# Set up error handling
set -e
trap 'echo "Error occurred at line $LINENO"; exit 1' ERR

# Create timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="/home/nulladmin/noxhime/backups/$TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Copy files to backup directory
echo "Backing up ./data/noxhime.db"
cp -r "./data/noxhime.db" "$BACKUP_DIR/" || echo "Warning: Could not backup ./data/noxhime.db"
echo "Backing up ./logs"
cp -r "./logs" "$BACKUP_DIR/" || echo "Warning: Could not backup ./logs"

# Sync to remote storage
echo "Syncing to gdrive:NoxhimeBackups"
rclone sync "$BACKUP_DIR" "gdrive:NoxhimeBackups/noxhime-backup-$TIMESTAMP" --progress

# Clean up old local backups (keep last 5)
ls -1t "/home/nulladmin/noxhime/backups" | tail -n +6 | xargs -I {} rm -rf "/home/nulladmin/noxhime/backups/{}"

echo "Backup completed successfully at $(date)"
