import { Client, Message, User, TextChannel, DMChannel, EmbedBuilder } from 'discord.js';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as db from './db';
import crypto from 'crypto';
import { networkInterfaces } from 'os';

// Types
export enum BioLockState {
  LOCKED = 'locked',
  PENDING = 'pending',
  UNLOCKED = 'unlocked',
  OVERRIDE = 'override'
}

// Interfaces
interface BioLockConfig {
  version: string;
  description: string;
  users: BioLockUser[];
  config: {
    enabled: boolean;
    session_timeout_minutes: number;
    max_failed_attempts: number;
    lockout_duration_minutes: number;
    override_enabled: boolean;
    audit_webhook_url: string;
  }
}

interface BioLockUser {
  discord_id: string;
  username: string;
  created_at: string;
  last_login?: string;
  device_info?: string;
}

interface BioLockSession {
  id: number;
  user_id: number;
  session_state: BioLockState;
  start_time: string;
  end_time?: string;
  session_token?: string;
  ip_address?: string;
  device_fingerprint?: string;
}

// List of sensitive commands that require BioLock authentication
const PROTECTED_COMMANDS = [
  'restart', 
  'reboot', 
  'shutdown', 
  'heal', 
  'backup', 
  'sentinel',
  'whitelist',
  'purge',
  'self-destruct'
];

// Implement the BioLock class with all the required functionality
export class BioLock {
  private client: Client;
  private configPath: string;
  private config: BioLockConfig;
  private pendingAuth: Map<string, { timestamp: number, attempts: number, dmChannel: DMChannel | null }>;
  private saltRounds: number = 10;
  private overrideKey: string | null = null;

  constructor(client: Client, configPath?: string) {
    this.client = client;
    this.configPath = configPath || path.join(process.cwd(), 'biolock.json');
    this.pendingAuth = new Map();
    this.config = this.loadConfig();
    
    // Load override key from environment if available
    this.overrideKey = process.env.BIOLOCK_OVERRIDE_KEY || null;
    
    // Cleanup expired sessions periodically
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000); // Every 5 minutes
  }

  // Configuration methods
  private loadConfig(): BioLockConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configData) as BioLockConfig;
      }
    } catch (error) {
      console.error('Error loading BioLock config:', error);
    }
    
    // Return default config if file doesn't exist or has errors
    return {
      version: '2.0.0',
      description: 'BioLock v2 - User-level authentication system',
      users: [],
      config: {
        enabled: true,
        session_timeout_minutes: 60,
        max_failed_attempts: 5,
        lockout_duration_minutes: 15,
        override_enabled: true,
        audit_webhook_url: ''
      }
    };
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving BioLock config:', error);
    }
  }

  // User management methods
  async registerUser(discordId: string, username: string, passphrase: string, deviceInfo?: string): Promise<boolean> {
    try {
      // Check if user already exists
      const existingUser = await this.getUserByDiscordId(discordId);
      if (existingUser) {
        return false; // User already exists
      }
      
      // Hash passphrase
      const hash = await bcrypt.hash(passphrase, this.saltRounds);
      
      // Create user in database
      const userId = await createBioLockUser(discordId, hash, deviceInfo);
      
      if (userId) {
        // Add to config file without sensitive data
        const newUser: BioLockUser = {
          discord_id: discordId,
          username,
          created_at: new Date().toISOString(),
          device_info: deviceInfo
        };
        
        this.config.users.push(newUser);
        this.saveConfig();
        
        // Log the registration
        await this.logAuditEvent(userId, 'REGISTRATION', true, undefined, deviceInfo, 'User registered with BioLock');
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error registering user:', error);
      return false;
    }
  }

  async getUserByDiscordId(discordId: string): Promise<any> {
    try {
      return await db.get('SELECT * FROM biolock_users WHERE discord_id = ?', [discordId]);
    } catch (error) {
      console.error('Error getting user by Discord ID:', error);
      return null;
    }
  }

  // Authentication methods
  async authenticateUser(discordId: string, passphrase: string, ipAddress?: string): Promise<boolean> {
    try {
      // Get user from database
      const user = await this.getUserByDiscordId(discordId);
      if (!user) {
        return false;
      }
      
      // Compare passphrase hash
      const match = await bcrypt.compare(passphrase, user.passphrase_hash);
      
      // Update last authentication timestamp if successful
      if (match) {
        await updateUserLastAuth(user.id);
        
        // Create unlocked session
        await this.createSession(user.id, BioLockState.UNLOCKED, ipAddress);
        
        // Log successful authentication
        await this.logAuditEvent(user.id, 'AUTHENTICATION', true, ipAddress, 
          await this.getDeviceInfo(), 'User authenticated successfully');
      } else {
        // Log failed authentication
        await this.logAuditEvent(user.id, 'AUTHENTICATION', false, ipAddress, 
          await this.getDeviceInfo(), 'Failed authentication attempt');
      }
      
      return match;
    } catch (error) {
      console.error('Error authenticating user:', error);
      return false;
    }
  }

  async checkUserSession(discordId: string): Promise<BioLockState> {
    try {
      const user = await this.getUserByDiscordId(discordId);
      if (!user) {
        return BioLockState.LOCKED;
      }
      
      // Get active session
      const session = await getActiveSession(user.id);
      
      if (!session) {
        return BioLockState.LOCKED;
      }
      
      // Check if session has expired
      if (session.session_state === BioLockState.UNLOCKED || 
          session.session_state === BioLockState.OVERRIDE) {
        const startTime = new Date(session.start_time).getTime();
        const currentTime = Date.now();
        const sessionTimeout = this.config.config.session_timeout_minutes * 60 * 1000;
        
        if (currentTime - startTime > sessionTimeout) {
          // Session expired, update to locked state
          await this.updateSession(session.id, BioLockState.LOCKED);
          await this.logAuditEvent(user.id, 'SESSION_EXPIRED', true, undefined, undefined, 
            'Session expired due to timeout');
          return BioLockState.LOCKED;
        }
      }
      
      return session.session_state as BioLockState;
    } catch (error) {
      console.error('Error checking user session:', error);
      return BioLockState.LOCKED;
    }
  }

  async createSession(userId: number, state: BioLockState, ipAddress?: string, deviceFingerprint?: string): Promise<number> {
    try {
      // End any active sessions first
      await db.run(
        'UPDATE biolock_sessions SET end_time = CURRENT_TIMESTAMP WHERE user_id = ? AND end_time IS NULL',
        [userId]
      );
      
      // Create new session
      const sessionToken = this.generateSessionToken();
      const result = await db.run(
        'INSERT INTO biolock_sessions (user_id, session_state, session_token, ip_address, device_fingerprint) VALUES (?, ?, ?, ?, ?)',
        [userId, state, sessionToken, ipAddress || null, deviceFingerprint || null]
      );
      
      // Log session creation
      const eventType = state === BioLockState.UNLOCKED ? 'SESSION_UNLOCKED' : 
                         state === BioLockState.OVERRIDE ? 'SESSION_OVERRIDE' : 'SESSION_CREATED';
      
      await this.logAuditEvent(userId, eventType, true, ipAddress, 
        await this.getDeviceInfo(), `New session created with state: ${state}`);
      
      return result.lastID;
    } catch (error) {
      console.error('Error creating session:', error);
      return 0;
    }
  }

  async updateSession(sessionId: number, state: BioLockState): Promise<boolean> {
    try {
      // Get session to identify user for audit log
      const session = await db.get('SELECT user_id FROM biolock_sessions WHERE id = ?', [sessionId]);
      
      await db.run(
        'UPDATE biolock_sessions SET session_state = ? WHERE id = ?',
        [state, sessionId]
      );
      
      // Log session update
      if (session) {
        const eventType = state === BioLockState.LOCKED ? 'SESSION_LOCKED' : 
                          state === BioLockState.UNLOCKED ? 'SESSION_UNLOCKED' : 
                          state === BioLockState.OVERRIDE ? 'SESSION_OVERRIDE' : 'SESSION_UPDATED';
                          
        await this.logAuditEvent(session.user_id, eventType, true, undefined, undefined, 
          `Session updated to state: ${state}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating session:', error);
      return false;
    }
  }

  async endSession(sessionId: number): Promise<boolean> {
    try {
      // Get session to identify user for audit log
      const session = await db.get('SELECT user_id FROM biolock_sessions WHERE id = ?', [sessionId]);
      
      await db.run(
        'UPDATE biolock_sessions SET end_time = CURRENT_TIMESTAMP WHERE id = ?',
        [sessionId]
      );
      
      // Log session end
      if (session) {
        await this.logAuditEvent(session.user_id, 'SESSION_ENDED', true, undefined, undefined, 
          'Session ended');
      }
      
      return true;
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  }

  // Cleanup expired sessions
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const timeout = this.config.config.session_timeout_minutes;
      await db.run(
        `UPDATE biolock_sessions 
         SET end_time = CURRENT_TIMESTAMP, session_state = '${BioLockState.LOCKED}' 
         WHERE end_time IS NULL 
         AND session_state IN ('${BioLockState.UNLOCKED}', '${BioLockState.OVERRIDE}')
         AND datetime(start_time, '+${timeout} minutes') < datetime('now')`,
        []
      );
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }

  // Command protection middleware
  async isCommandAllowed(message: Message, command: string): Promise<boolean> {
    // If BioLock is not enabled, allow all commands
    if (!this.config.config.enabled) {
      return true;
    }
    
    // Check if the command requires protection
    if (!PROTECTED_COMMANDS.includes(command)) {
      return true; // Unprotected command, allow it
    }
    
    // Get user state
    const state = await this.checkUserSession(message.author.id);
    
    // Check if user is authenticated
    switch (state) {
      case BioLockState.UNLOCKED:
      case BioLockState.OVERRIDE:
        return true;
      case BioLockState.PENDING:
        await message.reply('Authentication in progress. Please complete the authentication process in your DMs.');
        return false;
      case BioLockState.LOCKED:
      default:
        await message.reply('🔒 This command requires authentication. Use `!unlock` to authenticate first.');
        return false;
    }
  }

  // Discord command handlers
  async handleLockCommand(message: Message): Promise<void> {
    try {
      const user = await this.getUserByDiscordId(message.author.id);
      
      // Check if user is registered with BioLock
      if (!user) {
        await message.reply('You are not registered with BioLock. Please create a BioLock profile first.');
        return;
      }
      
      // Get active session
      const session = await getActiveSession(user.id);
      
      if (!session) {
        await message.reply('You do not have an active session to lock.');
        return;
      }
      
      // Lock the session
      await this.updateSession(session.id, BioLockState.LOCKED);
      
      await message.reply('🔒 Your session has been locked. Use `!unlock` to authenticate again.');
    } catch (error) {
      console.error('Error handling lock command:', error);
      await message.reply('An error occurred while processing your lock request.');
    }
  }

  async handleUnlockCommand(message: Message): Promise<void> {
    try {
      // Check if the user is already in the pending authentication map
      if (this.pendingAuth.has(message.author.id)) {
        await message.reply('Authentication already in progress. Please check your DMs.');
        return;
      }
      
      const user = await this.getUserByDiscordId(message.author.id);
      
      // Check if user is registered with BioLock
      if (!user) {
        await message.reply('You are not registered with BioLock. Would you like to create a profile? Reply with `yes` to continue.');
        
        // Wait for user's response
        const filter = (m: Message) => m.author.id === message.author.id && ['yes', 'no'].includes(m.content.toLowerCase());
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
          .catch(() => null);
        
        if (collected && collected.first()?.content.toLowerCase() === 'yes') {
          // Start registration process
          await this.startRegistration(message);
        } else {
          await message.reply('Registration cancelled.');
        }
        
        return;
      }
      
      // Get current session state
      const state = await this.checkUserSession(message.author.id);
      
      if (state === BioLockState.UNLOCKED) {
        await message.reply('You are already authenticated.');
        return;
      }
      
      // Send DM to user for authentication
      try {
        // Create DM channel
        const dmChannel = await message.author.createDM();
        
        // Create embed for authentication prompt
        const embed = new EmbedBuilder()
          .setTitle('🔐 BioLock Authentication')
          .setDescription('Please enter your passphrase to unlock your session.\nReply to this message with your passphrase.')
          .setColor(0x3498DB)
          .setTimestamp()
          .setFooter({ text: 'BioLock v2 Security System' });
        
        await dmChannel.send({ embeds: [embed] });
        
        // Add user to pending authentication map
        this.pendingAuth.set(message.author.id, { 
          timestamp: Date.now(), 
          attempts: 0,
          dmChannel
        });
        
        // Update session state to pending
        const session = await getActiveSession(user.id);
        if (session) {
          await this.updateSession(session.id, BioLockState.PENDING);
        } else {
          await this.createSession(user.id, BioLockState.PENDING);
        }
        
        // Notify in original channel
        await message.reply('🔑 Authentication request sent to your DMs. Please check your direct messages.');
        
        // Set up DM collector for the passphrase
        const filter = (m: Message) => m.author.id === message.author.id;
        const collector = dmChannel.createMessageCollector({ filter, time: 60000 });
        
        collector.on('collect', async (m) => {
          const pendingData = this.pendingAuth.get(message.author.id);
          if (!pendingData) return;
          
          pendingData.attempts++;
          
          // Verify passphrase
          const authenticated = await this.authenticateUser(message.author.id, m.content, 
            message.member?.presence?.clientStatus ? JSON.stringify(message.member.presence.clientStatus) : undefined);
          
          if (authenticated) {
            await dmChannel.send('✅ Authentication successful! Your session is now unlocked.');
            this.pendingAuth.delete(message.author.id);
            collector.stop();
          } else {
            if (pendingData.attempts >= this.config.config.max_failed_attempts) {
              await dmChannel.send('❌ Too many failed attempts. Authentication process locked. Please try again later.');
              this.pendingAuth.delete(message.author.id);
              collector.stop();
              
              // Lock session
              const session = await getActiveSession(user.id);
              if (session) {
                await this.updateSession(session.id, BioLockState.LOCKED);
              }
              
              // Log too many failed attempts
              await this.logAuditEvent(user.id, 'AUTH_LOCKOUT', false, undefined, undefined, 
                `User locked out after ${pendingData.attempts} failed attempts`);
            } else {
              await dmChannel.send(`❌ Incorrect passphrase. Please try again. (Attempt ${pendingData.attempts}/${this.config.config.max_failed_attempts})`);
            }
          }
        });
        
        collector.on('end', async (collected, reason) => {
          if (reason === 'time' && this.pendingAuth.has(message.author.id)) {
            await dmChannel.send('⏰ Authentication timed out. Please use `!unlock` in the server to try again.');
            this.pendingAuth.delete(message.author.id);
            
            // Update session back to locked
            const session = await getActiveSession(user.id);
            if (session) {
              await this.updateSession(session.id, BioLockState.LOCKED);
            }
            
            // Log timeout
            await this.logAuditEvent(user.id, 'AUTH_TIMEOUT', false, undefined, undefined, 
              'Authentication timed out');
          }
        });
        
      } catch (dmError) {
        console.error('Error sending DM:', dmError);
        await message.reply('Could not send you a DM. Please ensure your DMs are open and try again.');
      }
    } catch (error) {
      console.error('Error handling unlock command:', error);
      await message.reply('An error occurred while processing your unlock request.');
    }
  }

  async handleOverrideCommand(message: Message, args: string[]): Promise<void> {
    try {
      // Check if override is enabled
      if (!this.config.config.override_enabled) {
        await message.reply('Override functionality is disabled.');
        return;
      }
      
      // Check if override key is configured
      if (!this.overrideKey) {
        await message.reply('No override key is configured. Contact the administrator.');
        return;
      }
      
      // Get the override passphrase from arguments
      const overridePassphrase = args.join(' ');
      
      if (!overridePassphrase) {
        await message.reply('Please provide the override passphrase. Usage: `!override [passphrase]`');
        return;
      }
      
      // Check if the passphrase matches
      const user = await this.getUserByDiscordId(message.author.id);
      
      if (!user) {
        await message.reply('You need to be registered with BioLock to use override.');
        return;
      }
      
      // Check override key
      if (overridePassphrase === this.overrideKey) {
        // Create override session
        await this.createSession(user.id, BioLockState.OVERRIDE, 
          message.member?.presence?.clientStatus ? JSON.stringify(message.member.presence.clientStatus) : undefined);
        
        // Log override
        await this.logAuditEvent(user.id, 'OVERRIDE', true, undefined, await this.getDeviceInfo(), 
          'User used emergency override');
        
        await message.reply('🔓 Emergency override accepted. You now have temporary access to protected commands.');
        
        // Delete the message containing the override key for security
        try {
          await message.delete();
        } catch (deleteError) {
          console.error('Could not delete override message:', deleteError);
        }
      } else {
        // Log failed override attempt
        await this.logAuditEvent(user.id, 'OVERRIDE', false, undefined, await this.getDeviceInfo(), 
          'Failed override attempt');
        
        await message.reply('❌ Invalid override passphrase.');
        
        // Delete the message containing the invalid override key for security
        try {
          await message.delete();
        } catch (deleteError) {
          console.error('Could not delete override message:', deleteError);
        }
      }
    } catch (error) {
      console.error('Error handling override command:', error);
      await message.reply('An error occurred while processing your override request.');
    }
  }

  // Start registration process for a new user
  private async startRegistration(message: Message): Promise<void> {
    try {
      // Create DM channel
      const dmChannel = await message.author.createDM();
      
      // Create embed for registration
      const embed = new EmbedBuilder()
        .setTitle('🔐 BioLock Registration')
        .setDescription('Please create a passphrase to secure your BioLock profile.\n' + 
                        'Reply to this message with your desired passphrase.\n\n' +
                        '**Note**: This passphrase will be used to authenticate you for sensitive commands.')
        .setColor(0x2ECC71)
        .setTimestamp()
        .setFooter({ text: 'BioLock v2 Security System' });
      
      await dmChannel.send({ embeds: [embed] });
      
      // Set up collector for the passphrase
      const filter = (m: Message) => m.author.id === message.author.id;
      const collector = dmChannel.createMessageCollector({ filter, time: 120000 });
      
      collector.on('collect', async (m) => {
        // Validate passphrase (minimum length, etc.)
        if (m.content.length < 8) {
          await dmChannel.send('⚠️ Passphrase must be at least 8 characters long. Please try again.');
          return;
        }
        
        // Confirm passphrase
        await dmChannel.send('Please confirm your passphrase by entering it again:');
        
        // Set up confirmation collector
        const confirmFilter = (m2: Message) => m2.author.id === message.author.id;
        const confirmCollector = dmChannel.createMessageCollector({ filter: confirmFilter, time: 60000, max: 1 });
        
        confirmCollector.on('collect', async (m2) => {
          if (m.content === m2.content) {
            // Register user
            const deviceInfo = await this.getDeviceInfo();
            const success = await this.registerUser(message.author.id, message.author.username, m.content, deviceInfo);
            
            if (success) {
              await dmChannel.send('✅ Registration successful! You can now use `!unlock` to authenticate for sensitive commands.');
              
              // Get newly created user
              const user = await this.getUserByDiscordId(message.author.id);
              
              // Create initial locked session
              if (user) {
                await this.createSession(user.id, BioLockState.LOCKED);
              }
            } else {
              await dmChannel.send('❌ Registration failed. Please try again later or contact an administrator.');
            }
          } else {
            await dmChannel.send('❌ Passphrases do not match. Registration cancelled. Please use `!unlock` to try again.');
          }
          collector.stop();
        });
        
        confirmCollector.on('end', async (collected, reason) => {
          if (reason === 'time') {
            await dmChannel.send('⏰ Confirmation timed out. Registration cancelled. Please use `!unlock` to try again.');
            collector.stop();
          }
        });
      });
      
      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await dmChannel.send('⏰ Registration timed out. Please use `!unlock` in the server to try again.');
        }
      });
      
    } catch (error) {
      console.error('Error starting registration:', error);
      await message.reply('Could not start registration process. Please ensure your DMs are open and try again.');
    }
  }

  // Audit logging
  async logAuditEvent(userId: number, eventType: string, success: boolean, ipAddress?: string, deviceInfo?: string, details?: string): Promise<void> {
    try {
      await logAudit(userId, eventType, success, ipAddress, deviceInfo, details);
      
      // If audit webhook URL is configured, send webhook
      if (this.config.config.audit_webhook_url) {
        try {
          const user = await getUserById(userId);
          const axios = require('axios');
          
          const webhookData = {
            embeds: [{
              title: `BioLock Audit: ${eventType}`,
              description: details || 'No details provided',
              color: success ? 0x2ECC71 : 0xE74C3C,
              fields: [
                {
                  name: 'User',
                  value: user ? `${user.discord_id}` : `ID: ${userId}`,
                  inline: true
                },
                {
                  name: 'Status',
                  value: success ? '✅ Success' : '❌ Failure',
                  inline: true
                },
                {
                  name: 'Timestamp',
                  value: new Date().toISOString(),
                  inline: true
                }
              ],
              footer: {
                text: 'BioLock v2 Security System'
              }
            }]
          };
          
          if (ipAddress) {
            webhookData.embeds[0].fields.push({
              name: 'IP Address',
              value: ipAddress,
              inline: true
            });
          }
          
          if (deviceInfo) {
            webhookData.embeds[0].fields.push({
              name: 'Device Info',
              value: deviceInfo.length > 100 ? `${deviceInfo.substring(0, 100)}...` : deviceInfo,
              inline: false
            });
          }
          
          await axios.post(this.config.config.audit_webhook_url, webhookData);
        } catch (webhookError) {
          console.error('Error sending audit webhook:', webhookError);
        }
      }
      
      // Also log to regular event log
      await db.logEvent('BIOLOCK', `${eventType}: ${success ? 'Success' : 'Failure'} - ${details || 'No details'}`);
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }

  // Utility methods
  private async getDeviceInfo(): Promise<string> {
    try {
      const interfaces = networkInterfaces();
      const hostname = os.hostname();
      const platform = os.platform();
      const release = os.release();
      
      // Build a simple device fingerprint
      return JSON.stringify({
        hostname,
        platform,
        release,
        mac: Object.values(interfaces)
          .flat()
          .filter(iface => iface && !iface.internal && iface.mac !== '00:00:00:00:00:00')
          .map(iface => iface?.mac)
          .filter(Boolean)[0] || 'unknown'
      });
    } catch (error) {
      console.error('Error getting device info:', error);
      return 'unknown';
    }
  }

  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

// Create and export singleton instance
let bioLockInstance: BioLock | null = null;

export function getBioLock(client: Client): BioLock {
  if (!bioLockInstance) {
    bioLockInstance = new BioLock(client);
  }
  return bioLockInstance;
}

// Add DB functions specifically for BioLock
export async function createBioLockUser(discordId: string, passphraseHash: string, deviceInfo?: string): Promise<number> {
  try {
    const result = await db.run(
      'INSERT INTO biolock_users (discord_id, passphrase_hash, device_info) VALUES (?, ?, ?)',
      [discordId, passphraseHash, deviceInfo || null]
    );
    return result.lastID;
  } catch (error) {
    console.error('Error creating BioLock user:', error);
    return 0;
  }
}

export async function getUserById(id: number): Promise<any> {
  try {
    return await db.get('SELECT * FROM biolock_users WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

export async function updateUserLastAuth(id: number): Promise<boolean> {
  try {
    await db.run(
      'UPDATE biolock_users SET last_auth_timestamp = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    return true;
  } catch (error) {
    console.error('Error updating user last auth:', error);
    return false;
  }
}

export async function createSession(userId: number, state: BioLockState, ipAddress?: string, deviceFingerprint?: string): Promise<number> {
  try {
    // End any existing active sessions
    await db.run(
      'UPDATE biolock_sessions SET end_time = CURRENT_TIMESTAMP WHERE user_id = ? AND end_time IS NULL',
      [userId]
    );
    
    // Create new session
    const result = await db.run(
      'INSERT INTO biolock_sessions (user_id, session_state, ip_address, device_fingerprint) VALUES (?, ?, ?, ?)',
      [userId, state, ipAddress || null, deviceFingerprint || null]
    );
    return result.lastID;
  } catch (error) {
    console.error('Error creating session:', error);
    return 0;
  }
}

export async function updateSession(id: number, state: BioLockState): Promise<boolean> {
  try {
    await db.run(
      'UPDATE biolock_sessions SET session_state = ? WHERE id = ?',
      [state, id]
    );
    return true;
  } catch (error) {
    console.error('Error updating session:', error);
    return false;
  }
}

export async function endSession(id: number): Promise<boolean> {
  try {
    await db.run(
      'UPDATE biolock_sessions SET end_time = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    return true;
  } catch (error) {
    console.error('Error ending session:', error);
    return false;
  }
}

export async function getActiveSession(userId: number): Promise<any> {
  try {
    return await db.get(
      'SELECT * FROM biolock_sessions WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1',
      [userId]
    );
  } catch (error) {
    console.error('Error getting active session:', error);
    return null;
  }
}

export async function logAudit(userId: number, eventType: string, success: boolean, ipAddress?: string, deviceInfo?: string, details?: string): Promise<boolean> {
  try {
    await db.run(
      'INSERT INTO biolock_audit (user_id, event_type, success, ip_address, device_info, details) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, eventType, success ? 1 : 0, ipAddress || null, deviceInfo || null, details || null]
    );
    return true;
  } catch (error) {
    console.error('Error logging audit:', error);
    return false;
  }
}

