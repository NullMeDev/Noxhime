# BioLock v2 Documentation

## Introduction

BioLock v2 is a user-level authentication system for Noxhime Discord bot that protects sensitive commands from unauthorized use. Unlike the previous version which operated at the global/owner level, BioLock v2 is designed to provide individualized security for each user of the bot, allowing for more granular control and enhanced security features.

### Key Features

- **User-Level Authentication**: Each user has their own BioLock profile and authentication sessions
- **Multiple Security States**: Supports locked, pending, unlocked, and emergency override states
- **Discord-Based Authentication**: Authentication happens through secure Discord DMs
- **Audit Logging**: Comprehensive logging of all authentication events and attempts
- **Session Management**: Automatic session timeouts and user-initiated locks
- **Emergency Override**: Secure backup method for urgent access

### How It Works

BioLock v2 operates as a middleware layer in the command processing pipeline. When a user attempts to use a protected command, BioLock checks if the user has an active authenticated session. If not, the command is blocked, and the user is prompted to authenticate. This ensures that sensitive bot operations are only performed by authorized users who have proven their identity.

## Installation and Configuration

### Prerequisites

- Noxhime Discord bot v3.0.0 or higher
- Node.js 16.x or higher
- SQLite3 database

### Database Setup

BioLock v2 requires several database tables which are automatically created when the bot initializes. These tables store user information, session data, and audit logs.

The database migration is included in the standard `schema.sql` file and includes:

- `biolock_users`: Stores user profiles and credentials
- `biolock_sessions`: Tracks authentication sessions and their states
- `biolock_audit`: Logs all BioLock-related events

### Configuration

1. **Environment Variables**

   Add the following variables to your `.env` file:

   ```
   # BioLock v2 Configuration
   BIOLOCK_ENABLED=true
   BIOLOCK_OVERRIDE_KEY=your_secure_emergency_override_key
   BIOLOCK_SESSION_TIMEOUT=60
   ```

   - `BIOLOCK_ENABLED`: Enable or disable the BioLock system
   - `BIOLOCK_OVERRIDE_KEY`: A secure passphrase for emergency access (keep this secret!)
   - `BIOLOCK_SESSION_TIMEOUT`: How long authenticated sessions remain valid (in minutes)

2. **Configuration File**

   BioLock v2 uses a `biolock.json` file in the project root for additional configuration:

   ```json
   {
     "version": "2.0.0",
     "description": "BioLock v2 - User-level authentication system",
     "users": [],
     "config": {
       "enabled": true,
       "session_timeout_minutes": 60,
       "max_failed_attempts": 5,
       "lockout_duration_minutes": 15,
       "override_enabled": true,
       "audit_webhook_url": ""
     }
   }
   ```

   This file is created automatically when the bot starts. You can optionally configure:

   - `max_failed_attempts`: Number of attempts before temporary lockout
   - `lockout_duration_minutes`: Duration of temporary lockout after too many failed attempts
   - `audit_webhook_url`: Discord webhook URL for sending audit events (optional)

## User Guide

### Commands

BioLock v2 adds the following commands to the bot:

- `!unlock` - Initiate authentication to use protected commands
- `!lock` - Manually lock your session when you're done
- `!override [passphrase]` - Emergency override for urgent access

### Protected Commands

The following commands are protected by BioLock v2 and require authentication:

- `!restart` - Restart the bot
- `!heal` - Trigger self-healing routine
- `!backup` - Trigger manual backup
- `!sentinel <start|stop>` - Control the Sentinel monitoring system
- `!whitelist <action>` - Manage server whitelist
- `!purge` - Purge messages or data
- `!self-destruct` - Initiate self-destruct sequence (if implemented)

### First-Time Registration

When a new user attempts to use `!unlock` for the first time, they will be guided through a registration process:

1. User enters `!unlock` in a channel where the bot can see it
2. Bot responds with registration prompt and sends a DM
3. In the DM, user creates and confirms a secure passphrase
4. BioLock creates the user profile and confirms registration
5. User can now authenticate using their passphrase

### Authentication Flow

To authenticate and use protected commands:

1. User enters `!unlock` in a channel
2. Bot sends a DM requesting the passphrase
3. User enters their passphrase in the DM
4. If correct, the session is unlocked and the user can use protected commands
5. The session remains active for the configured timeout period (default: 60 minutes)
6. User can manually lock the session with `!lock` when finished

### Emergency Override

If a user needs urgent access and cannot authenticate normally:

1. User enters `!override [passphrase]` with the emergency override key
2. If correct, the session enters override mode, granting temporary access
3. Override sessions are also subject to timeout for security

## Administration

### Managing Users

BioLock v2 is designed to be self-service for users. There are no explicit admin commands to manage users, as each user manages their own profile. However, you can:

1. Access the database directly to view or modify user records if needed
2. Edit the `biolock.json` file to remove users (though this only removes display information, not database records)

### Configuration Options

The main configuration options can be adjusted in the `biolock.json` file:

```json
{
  "config": {
    "enabled": true,                  // Master enable/disable switch
    "session_timeout_minutes": 60,    // How long sessions remain valid
    "max_failed_attempts": 5,         // Attempts before temporary lockout
    "lockout_duration_minutes": 15,   // How long lockouts last
    "override_enabled": true,         // Enable/disable override function
    "audit_webhook_url": ""           // Discord webhook for audit logs
  }
}
```

### Audit Logging

BioLock v2 logs all authentication events, both successful and failed, to the `biolock_audit` table. This provides a comprehensive security trail for later review. Events include:

- Registration attempts
- Authentication attempts (success/failure)
- Session creation and updates
- Override attempts
- Lockouts due to too many failed attempts

If you configure the `audit_webhook_url`, these events will also be sent to a Discord channel for real-time monitoring.

## Security Considerations

### Best Practices

1. **Strong Passphrases**: Encourage users to create strong, unique passphrases that are at least 12 characters long
2. **Secure Override Key**: Set a complex, random override key and store it securely
3. **Regular Session Locks**: Encourage users to use `!lock` when they're done using protected commands
4. **Audit Reviews**: Regularly review the audit logs for suspicious activity
5. **Private Authentication**: Ensure users authenticate via DM, not in public channels

### Security Limitations

Be aware of the following limitations:

1. **DM Security**: BioLock relies on Discord's DM security. If a user's Discord account is compromised, their BioLock protection is also compromised.
2. **Local Storage**: Credentials are stored locally in the database. Ensure proper server security to protect this data.
3. **Override Risk**: The emergency override key, if leaked, allows anyone to bypass authentication. Keep it secure and change it if compromised.

## Troubleshooting

### Common Issues

1. **Authentication DMs Not Received**
   - Ensure the user has DMs enabled for the server
   - Check if the bot has permission to send DMs
   - Verify the bot is not blocked by the user

2. **Session Expires Too Quickly**
   - Check the `session_timeout_minutes` setting in both `.env` and `biolock.json`
   - Ensure the server's clock is accurate

3. **Registration Fails**
   - Check database permissions
   - Ensure the passphrase meets minimum requirements (8+ characters)
   - Verify both passphrase entries match during confirmation

4. **Override Not Working**
   - Confirm `override_enabled` is set to `true`
   - Verify the correct override key is being used (case-sensitive)
   - Check that the `BIOLOCK_OVERRIDE_KEY` environment variable is properly set

### Database Recovery

If user accounts become corrupted or users forget their passphrases:

1. Access the SQLite database directly:
   ```bash
   sqlite3 ./data/noxhime.db
   ```

2. View users:
   ```sql
   SELECT * FROM biolock_users;
   ```

3. Remove a user to allow re-registration:
   ```sql
   DELETE FROM biolock_users WHERE discord_id = 'user_discord_id';
   DELETE FROM biolock_sessions WHERE user_id = user_id_number;
   ```

## Conclusion

BioLock v2 provides a robust, user-friendly authentication system for protecting sensitive bot commands. By implementing proper authentication and session management, it helps ensure that only authorized users can perform critical operations, enhancing the overall security of your Noxhime bot installation.

For any issues not covered in this documentation, please refer to the main Noxhime documentation or open an issue on our GitHub repository.

