# Auto-Update Feature

Noxhime Bot includes an automatic update feature that checks for updates from the GitHub repository,
installs them, and notifies your Discord server about the update process.

## How It Works

1. The auto-update feature runs on a scheduled basis (once per day by default at 4:00 AM)
2. When an update is available, Noxhime will:
   - Send a message to Discord: "Installing Updates Please Wait"
   - Pull the latest changes from the repository
   - Install any new dependencies
   - Rebuild the application
   - Restart the bot service
   - Send a completion message: "Noxhime is Back from updating, and appreciates your patience"
   - Post a changelog of what was updated

## Configuration

The auto-update feature can be configured in your `.env` file:

```
# Auto-update Configuration
AUTO_UPDATE_ENABLED=true
AUTO_UPDATE_CHECK_INTERVAL=86400
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url-here
```

- `AUTO_UPDATE_ENABLED`: Set to `true` to enable automatic updates, or `false` to disable
- `AUTO_UPDATE_CHECK_INTERVAL`: Time between update checks in seconds (default: 86400 = 1 day)
- `DISCORD_WEBHOOK_URL`: Discord webhook URL for sending update notifications

## Manual Updates

You can also trigger updates manually using the command:

```
noxhime-update
```

This alias is automatically set up during installation.

## Troubleshooting

If you encounter issues with the auto-update feature:

1. Check if the systemd timer is running:
   ```
   systemctl status noxhime-update.timer
   ```

2. View the last update logs:
   ```
   journalctl -u noxhime-update.service
   ```

3. Ensure your bot has proper permissions to pull from the repository:
   ```
   sudo -u nulladmin git -C /home/nulladmin/noxhime-bot pull
   ```

## Changelog Management

The auto-update feature automatically updates the README.md changelog when new updates are pulled from the repository. It extracts commit messages and categorizes them as:

- **Added**: New features or functionality
- **Fixed**: Bug fixes or issue resolutions
- **Updated**: Version updates or dependency changes
- **Improved**: Enhancements or optimizations

### Manual Changelog Management

You can also manually update the changelog using the provided script:

```bash
# Add a new feature to the changelog
./scripts/update-changelog.sh --add "New feature description"

# Add a bug fix to the changelog
./scripts/update-changelog.sh --fix "Bug fix description"

# Add an update to the changelog
./scripts/update-changelog.sh --update "Update description"

# Add an improvement to the changelog
./scripts/update-changelog.sh --improve "Improvement description"
```

For more options, run `./scripts/update-changelog.sh --help`
