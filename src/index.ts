import { Client, GatewayIntentBits, ChannelType, TextChannel, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { 
  setupMonitoringServer, 
  collectSystemStats, 
  savePidFile, 
  setupSelfHealing,
  setupCrashHandling
} from './monitor';
import { getSentinel } from './sentinel';
import { getPersonalityCore, EventType } from './personality';
import { handleWhitelistCommands } from './whitelist-commands';
import { getFail2BanMonitor } from './fail2ban';
import { getHealthCheckMonitor } from './health-check';
import { getDisasterRecovery } from "./modules/monitoring/disaster-recovery";

// Use require for modules with export issues
const api = require('./api');
const dbModule = require('./db');
const startApiServer = api.startApiServer;
const dbInitializeDatabase = dbModule.initializeDatabase;
const dbLogEvent = dbModule.logEvent;
const getRecentIncidents = dbModule.getRecentIncidents;

dotenv.config();

// Database initialization
const DB_PATH = process.env.DATABASE_PATH || './data/noxhime.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(DB_PATH);

// Database helper functions
function dbRun(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function dbGet(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbAll(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Initialize database tables
async function initializeDatabase(): Promise<boolean> {
  return await dbInitializeDatabase();
}

// Log an event
async function logEvent(type: string, description: string): Promise<boolean> {
  return await dbLogEvent(type, description);
}

const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID || '';
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || '!';
const MONIT_ENABLED = process.env.MONIT_ENABLED === 'true';
const MONIT_PORT = parseInt(process.env.MONIT_PORT || '5000');
const API_PORT = parseInt(process.env.API_PORT || '3000');
const PID_FILE_PATH = process.env.PID_FILE_PATH || '/home/nulladmin/noxhime-bot/noxhime.pid';
const SELF_HEALING_ENABLED = process.env.SELF_HEALING_ENABLED === 'true';
const SYSTEM_STATS_INTERVAL = parseInt(process.env.SYSTEM_STATS_INTERVAL || '3600000'); // Default: 1 hour

// Phase 4: Sentinel Intelligence Configuration
const SENTINEL_ENABLED = process.env.SENTINEL_ENABLED === 'true';
const SENTINEL_CHECK_INTERVAL = parseInt(process.env.SENTINEL_CHECK_INTERVAL || '60000'); // Default: 1 minute
const RCLONE_BACKUP_ENABLED = process.env.RCLONE_BACKUP_ENABLED === 'true';
const API_ENABLED = process.env.API_ENABLED === 'true' || true; // Force API to be enabled
const API_KEYS = process.env.API_KEYS?.split(',') || [];
const RCLONE_REMOTE = process.env.RCLONE_REMOTE || 'gdrive:NoxhimeBackups';
const RCLONE_SCHEDULE = process.env.RCLONE_SCHEDULE || '0 0 * * *'; // Default: Daily at midnight

// Phase 5: Personality Core Configuration
const PERSONALITY_ENABLED = process.env.PERSONALITY_ENABLED === 'true';
const DEFAULT_MOOD = process.env.DEFAULT_MOOD || 'focused';
  
// Phase 7: Web Dashboard Configuration
const DASHBOARD_URL = process.env.DASHBOARD_URL || `http://localhost:${API_PORT}`;

// New configuration for enhanced security monitoring
const FAIL2BAN_CHECK_INTERVAL = parseInt(process.env.FAIL2BAN_CHECK_INTERVAL || '300000'); // Default: 5 minutes
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '1800000'); // Default: 30 minutes
const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY;
const FULL_SENTINEL_MODE = process.env.FULL_SENTINEL_MODE === 'true' || true; // Force full sentinel mode

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  // Initialize the database
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
  
  // Write PID file for Monit monitoring
  savePidFile(PID_FILE_PATH);
  
  // Set up monitoring server if enabled
  if (MONIT_ENABLED) {
    setupMonitoringServer(client, NOTIFY_CHANNEL_ID, logEvent, MONIT_PORT);
    console.log(`Monitoring server started on port ${MONIT_PORT}`);
    await logEvent('SYSTEM', `Monitoring server started on port ${MONIT_PORT}`);
  }
  
  // Set up crash handling and recovery
  if (SELF_HEALING_ENABLED) {
    setupCrashHandling(client, NOTIFY_CHANNEL_ID, logEvent);
    console.log('Self-healing and crash handling enabled');
    
    // Setup periodic self-healing
    const selfHeal = setupSelfHealing(logEvent);
    setInterval(async () => {
      await selfHeal();
    }, 24 * 60 * 60 * 1000); // Run self-healing once a day
  }
  
  // Set up periodic system stats collection
  if (NOTIFY_CHANNEL_ID && SYSTEM_STATS_INTERVAL > 0) {
    console.log(`System stats reporting configured for every ${SYSTEM_STATS_INTERVAL/60000} minutes`);
    
    setInterval(async () => {
      try {
        const stats = await collectSystemStats();
        await logEvent('SYSTEM_STATS', JSON.stringify(stats));
        
        // Log to console but don't send to Discord to avoid spam
        console.log('System stats collected:', stats);
      } catch (error) {
        console.error('Error collecting system stats:', error);
      }
    }, SYSTEM_STATS_INTERVAL);
  }
  
  // Phase 4: Set up Sentinel Intelligence
  if (SENTINEL_ENABLED) {
    try {
      const sentinel = getSentinel(client, NOTIFY_CHANNEL_ID);
      sentinel.start(SENTINEL_CHECK_INTERVAL);
      console.log(`Sentinel Intelligence started with check interval ${SENTINEL_CHECK_INTERVAL/1000} seconds`);
      await logEvent('SENTINEL', 'Sentinel Intelligence system activated');
      
      // Set up rclone backups if enabled
      if (RCLONE_BACKUP_ENABLED) {
        try {
          await sentinel.setupRclone(
            RCLONE_REMOTE,
            ['./data/noxhime.db', './logs'],
            RCLONE_SCHEDULE
          );
          console.log('Rclone backup system configured');
          await logEvent('SYSTEM', 'Rclone backup system configured');
        } catch (error) {
          console.error('Failed to set up rclone backups:', error);
        }
      }
    } catch (error) {
      console.error('Error starting Sentinel Intelligence:', error);
    }
  }
  
  // Set up Fail2Ban monitoring (new)
  if (FULL_SENTINEL_MODE) {
    try {
      const fail2banMonitor = getFail2BanMonitor(client, NOTIFY_CHANNEL_ID, logEvent);
      fail2banMonitor.start(FAIL2BAN_CHECK_INTERVAL);
      console.log(`Fail2Ban monitoring started with check interval ${FAIL2BAN_CHECK_INTERVAL/1000} seconds`);
      await logEvent('SECURITY', 'Fail2Ban monitoring system activated');
    } catch (error) {
      console.error('Error starting Fail2Ban monitoring:', error);
    }
  }
  
  // Set up Health Check monitoring (new)
  if (FULL_SENTINEL_MODE) {
    try {
      const healthCheckMonitor = getHealthCheckMonitor(client, NOTIFY_CHANNEL_ID, logEvent);
      healthCheckMonitor.start(HEALTH_CHECK_INTERVAL);
      console.log(`Health check monitoring started with interval ${HEALTH_CHECK_INTERVAL/60000} minutes`);
      await logEvent('SYSTEM', 'Health check monitoring system activated');
    } catch (error) {

  // Set up Disaster Recovery module (new)\n  if (FULL_SENTINEL_MODE) {\n    try {\n      const disasterRecovery = getDisasterRecovery(client, NOTIFY_CHANNEL_ID, logEvent, {\n        encryptionKey: BACKUP_ENCRYPTION_KEY\n      });\n      \n      // Register commands with command handler\n      if (typeof commandHandler !== "undefined") {\n        disasterRecovery.registerCommands(commandHandler);\n      }\n      \n      console.log("Disaster Recovery module initialized");\n      await logEvent("SYSTEM", "Disaster Recovery module initialized");\n      \n      // Set up default backup configuration if needed\n      if (RCLONE_BACKUP_ENABLED) {\n        const defaultConfig = {\n          id: "default",\n          name: "Default Backup",\n          source: ["./data/noxhime.db", "./logs", "DATABASE"],\n          destination: path.join(process.cwd(), "backups"),\n          schedule: RCLONE_SCHEDULE,\n          retention: 7,\n          encrypt: BACKUP_ENCRYPTION_KEY ? true : false,\n          remoteSync: true,\n          remotePath: RCLONE_REMOTE,\n          validate: true\n        };\n        \n        await disasterRecovery.addBackupConfig(defaultConfig);\n        console.log("Default backup configuration added");\n      }\n    } catch (error) {\n      console.error("Error initializing Disaster Recovery module:", error);\n    }\n  }
      console.error('Error starting health check monitoring:', error);
    }
  }
  
  // Phase 5: Initialize Personality Core
  if (PERSONALITY_ENABLED) {
    try {
      const personality = getPersonalityCore();
      await personality.initialize();
      console.log('Personality Core initialized');
      await logEvent('SYSTEM', 'Personality Core initialized');
      
      // Process startup event to set mood
      await personality.processEvent(EventType.SUCCESSFUL_OPERATION, 8);
    } catch (error) {
      console.error('Error initializing Personality Core:', error);
    }
  }
  
  // Always initialize API server for web integration (Dashboard auto-start)
  try {
    // Import here to prevent circular dependencies
    const { startApiServer } = require('./api');
    startApiServer(client, API_PORT, API_KEYS);
    console.log(`API server and web dashboard started on port ${API_PORT}`);
    await logEvent('SYSTEM', `API server and web dashboard started on port ${API_PORT}`);
  } catch (error) {
    console.error('Error starting API server:', error);
  }
  
  // Send startup notification
  if (NOTIFY_CHANNEL_ID) {
    try {
      const auditChannel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
      if (auditChannel?.isTextBased()) {
        const textChannel = auditChannel as TextChannel;
        
        // Use personality core for startup message if enabled
        if (PERSONALITY_ENABLED) {
          const personality = getPersonalityCore();
          const mood = personality.getMood();
          const startupEmbed = personality.createStyledEmbed(
            'System Online',
            'Noxhime Bot is now active and operational.'
          );
          
          startupEmbed.addFields(
            { name: 'Version', value: '4.0.0 (Sentinel Protector)', inline: true },
            { name: 'Uptime', value: 'Just started', inline: true },
            { name: 'Dashboard', value: DASHBOARD_URL, inline: true },
            { name: 'Security Mode', value: FULL_SENTINEL_MODE ? 'Full Sentinel Protection' : 'Standard', inline: true }
          );
          
          await textChannel.send({
            content: await personality.styleMessage('I am awake and operational in Full Sentinel Protector Mode.'),
            embeds: [startupEmbed]
          });
        } else {
          // Original startup message with enhanced information
          const startupEmbed = new EmbedBuilder()
            .setTitle('System Online')
            .setDescription('Noxhime Bot is now active and operational in Full Sentinel Protector Mode.')
            .setColor(0x00FF00)
            .addFields(
              { name: 'Version', value: '4.0.0 (Sentinel Protector)', inline: true },
              { name: 'Uptime', value: 'Just started', inline: true },
              { name: 'Dashboard', value: DASHBOARD_URL, inline: true },
              { name: 'Security Mode', value: FULL_SENTINEL_MODE ? 'Full Sentinel Protection' : 'Standard', inline: true }
            )
            .setTimestamp();
            
          await textChannel.send({ embeds: [startupEmbed] });
        }
        
        // Create a recovery message if we can find evidence of a crash
        try {
          const lastEvent = await dbGet(
            'SELECT * FROM events WHERE type IN ("CRITICAL_ERROR", "SYSTEM_ALERT") ORDER BY timestamp DESC LIMIT 1'
          );
          
          if (lastEvent && (Date.now() - new Date(lastEvent.timestamp).getTime()) < 300000) { // Within 5 minutes
            if (PERSONALITY_ENABLED) {
              const personality = getPersonalityCore();
              await personality.changeMood('concerned', 'recovery', 7);
              
              const recoveryMessage = personality.generateEmotionalResponse('error', 6);
              const recoveryEmbed = personality.createStyledEmbed(
                'System Recovery Report',
                `${recoveryMessage} I had to restart after encountering an issue.`
              );
              
              recoveryEmbed.addFields(
                { name: 'Issue Details', value: lastEvent.description },
                { name: 'Recovery Time', value: new Date().toLocaleString() }
              );
              
              await textChannel.send({ embeds: [recoveryEmbed] });
            } else {
              await textChannel.send({
                content: '**Recovery Report**',
                embeds: [
                  new EmbedBuilder()
                    .setTitle('System Recovery')
                    .setDescription(`I've recovered from an issue: ${lastEvent.description}`)
                    .setColor(0x00FF00)
                    .setTimestamp()
                    .setFooter({ text: 'Server Monitoring System' })
                ]
              });
            }
          }
        } catch (recoveryError) {
          console.error('Error creating recovery message:', recoveryError);
        }
        
        await logEvent('STARTUP', 'Bot successfully started and connected to Discord with Full Sentinel Protection');
      } else {
        console.log('Channel is not text-based');
      }
    } catch (error) {
      console.error('Error sending startup message:', error);
    }
  } else {
    console.log('No notify channel ID configured');
  }

  console.log('Bot initialization complete with Full Sentinel Protection, Dashboard Auto-start, and Enhanced Monitoring');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content;
  const lowerContent = content.toLowerCase();
  const isTextChannel = message.channel.type === ChannelType.GuildText;

  // BioLock v2 System - User-level protection for sensitive commands

  // Command handling
  if (content.startsWith(COMMAND_PREFIX) && isTextChannel) {
    const args = content.slice(COMMAND_PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    
    switch (command) {
      case 'status':
        await message.channel.send('Bot is online and operational.');
        break;
        
      case 'whoami':
      case 'who am i?':
      case 'who am i':
        // Everyone is welcome to use this bot
        const reply = `You are ${message.author.username}, welcome to this digital garden.`;
        await message.channel.send(reply);
        break;
        
      case 'cmds':
      case 'commands':
        const commands = [
          `\`${COMMAND_PREFIX}status\` – check if the bot is online`,
          `\`${COMMAND_PREFIX}whoami\` – discover your role`,
          `\`${COMMAND_PREFIX}uptime\` – show system uptime information`,
          `\`${COMMAND_PREFIX}cmds\` – list available commands`,
          `\`${COMMAND_PREFIX}ask <question>\` – ask me a question using AI`,
          `\`${COMMAND_PREFIX}system\` – display system status and stats`,
          `\`${COMMAND_PREFIX}services\` – check status of system services`,
          `\`${COMMAND_PREFIX}mood\` – see my current emotional state`,
          `\`${COMMAND_PREFIX}link\` – get access to web dashboard`,
          `\`${COMMAND_PREFIX}restart\` – restart the bot`,
          `\`${COMMAND_PREFIX}heal\` – trigger self-healing routine`,
          `\`${COMMAND_PREFIX}logs <type> <count>\` – view recent logs`,
          `\`${COMMAND_PREFIX}backup\` – trigger manual backup`,
          `\`${COMMAND_PREFIX}sentinel <start|stop>\` – control sentinel system`,
          `\`${COMMAND_PREFIX}incidents\` – view security incidents`,
          `\`${COMMAND_PREFIX}whitelist <action>\` – manage server whitelisting`
        ];
        
        // Add dashboard command
        commands.push(`\`${COMMAND_PREFIX}link\` – get web dashboard access token`);
        
        // Add Fail2Ban commands (new)
        if (FULL_SENTINEL_MODE) {
          commands.push(`\`${COMMAND_PREFIX}fail2ban\` – show Fail2Ban status`);
          commands.push(`\`${COMMAND_PREFIX}healthcheck\` – trigger manual health check`);
        }
        
        // Use personality system if enabled
        if (PERSONALITY_ENABLED) {
          const personality = getPersonalityCore();
          const embed = personality.createStyledEmbed(
            'Available Commands',
            'Here are the commands you can use:'
          );
          
          embed.addFields(
            { name: 'All Commands (Available to Everyone)', value: commands.join('\n') }
          );
          
          await message.channel.send({ embeds: [embed] });
        } else {
          await message.channel.send({
            content: `**Available Commands (All users can use these):**\n${commands.join('\n')}`,
          });
        }
        break;
      
      case 'ask':
        const question = args.join(' ');
        if (!question) {
          await message.reply("Please ask a question after the command.");
          return;
        }
        
        await message.channel.sendTyping();
        
        if (PERSONALITY_ENABLED && process.env.AI_ENABLED === 'true') {
          try {
            const personality = getPersonalityCore();
            await personality.processEvent(EventType.USER_INTERACTION, 5);
            
            // Get information about the server and channel for context
            const guildName = message.guild?.name || 'Direct Message';
            // Safely get channel name based on channel type
            const channelName = message.channel.type === ChannelType.DM 
              ? 'Direct Message'
              : 'name' in message.channel 
                ? message.channel.name || 'Unknown Channel'
                : 'Unknown Channel';
            const contextInfo = `This conversation is taking place in ${guildName}, in channel: ${channelName}.`;
            
            // Generate AI response using DeepSeek-V3
            const response = await personality.generateAIResponse(
              question,
              message.author.id,
              contextInfo
            );
            
            await message.reply(response);
            await logEvent('COMMAND', `User ${message.author.username} asked: "${question.substring(0, 50)}${question.length > 50 ? '...' : ''}"`);
          } catch (error) {
            console.error('Error processing AI response:', error);
            await message.reply("I encountered an error while processing your question. Please try again later.");
            await logEvent('ERROR', `AI error for user ${message.author.username}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else {
          // Fallback if AI or personality is not enabled
          let response = "AI capabilities are not currently enabled.";
          
          // Apply personality styling if available
          if (PERSONALITY_ENABLED) {
            const personality = getPersonalityCore();
            response = await personality.styleMessage(response);
          }
          
          await message.reply(response);
          await logEvent('COMMAND', `User ${message.author.username} asked a question, but AI is disabled`);
        }
        break;
        
      case 'restart':

        const auditChannel = NOTIFY_CHANNEL_ID
          ? await client.channels.fetch(NOTIFY_CHANNEL_ID)
          : null;

        if (auditChannel?.isTextBased()) {
          await (auditChannel as TextChannel).send('Bot restart requested by user... \U0001F4A4');
        }

        await message.channel.send('Restarting now. Please wait...');
        await logEvent('ADMIN', `User ${message.author.username} initiated restart`);
        process.exit(0);
        break;
        
      // Biolock commands have been removed
        
      case 'link':
        try {
          // Check if API server is enabled
          if (!API_ENABLED) {
            await message.reply("Web dashboard is not enabled on this server.");
            return;
          }
          
          // Authentication no longer required with Biolock removed
          
          // Reply in the channel
          await message.reply("I'm sending you a link token via DM. Please check your private messages.");
          
          try {
            // Generate a one-time token via API
            const apiUrl = `http://localhost:${API_PORT}/api/auth/create-link`;
            const apiKey = API_KEYS[0]; // Use the first API key
            
            const axios = require('axios');
            const response = await axios.post(apiUrl, {
              discordId: message.author.id,
              apiKey: apiKey
            });
            
            if (response.data && response.data.token) {
              // Create DM channel
              const dmChannel = await message.author.createDM();
              
              // Create embed for token
              const embed = new EmbedBuilder()
                .setTitle('\U0001F517 Web Dashboard Access')
                .setDescription('Here is your one-time access token for the web dashboard. This token will expire in 30 minutes.')
                .setColor(0x3498DB)
                .addFields(
                  { name: 'Token', value: `\`${response.data.token}\`` },
                  { name: 'Dashboard URL', value: DASHBOARD_URL },
                  { name: 'Instructions', value: 'Go to the dashboard, paste this token, and click Authenticate.' }
                )
                .setTimestamp()
                .setFooter({ text: 'Noxhime Web Dashboard' });
              
              // Send token via DM
              await dmChannel.send({ embeds: [embed] });
              
              // Log the link generation
              await logEvent('WEB_ACCESS', `User ${message.author.username} requested dashboard access token`);
            } else {
              throw new Error('Invalid API response');
            }
          } catch (dmError) {
            console.error('Error sending DM with token:', dmError);
            await message.reply('Could not send token via DM. Please ensure your DMs are open and try again.');
          }
        } catch (error) {
          console.error('Error generating link token:', error);
          await message.reply('An error occurred while generating your access token. Please try again later.');
        }
        break;
        
      case 'system':
        try {
          const stats = await collectSystemStats();
          
          const embed = new EmbedBuilder()
            .setTitle('System Status')
            .setDescription('Current system health and statistics')
            .setColor(0x3498DB)
            .addFields(
              { name: 'CPU Usage', value: `${stats.cpuUsage.toFixed(1)}%`, inline: true },
              { name: 'Memory Usage', value: `${stats.memoryUsage.toFixed(1)}%`, inline: true },
              { name: 'Disk Usage', value: `${stats.diskUsage.toFixed(1)}%`, inline: true },
              { name: 'Uptime', value: stats.uptime, inline: true },
              { name: 'Bot Status', value: '\U0001F7E2 Online', inline: true },
              { name: 'Dashboard', value: `[Open](${DASHBOARD_URL})`, inline: true },
              { name: 'Monitoring', value: MONIT_ENABLED ? '✅ Active' : '❌ Disabled', inline: true },
              { name: 'Security', value: FULL_SENTINEL_MODE ? '✅ Full Sentinel Protection' : '✅ Standard', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Noxhime Monitoring System' });

          await message.channel.send({ embeds: [embed] });
          await logEvent('COMMAND', `User ${message.author.username} requested system status`);
        } catch (error) {
          console.error('Error fetching system stats:', error);
          await message.reply('Error fetching system statistics. Please try again later.');
        }
        break;
        
      case 'heal':

        if (SELF_HEALING_ENABLED) {
          await message.channel.send('\U0001F504 Initiating self-healing routine...');
          const selfHeal = setupSelfHealing(logEvent);
          await selfHeal();
          await message.channel.send('✅ Self-healing complete. Memory optimized and systems checked.');
          await logEvent('MAINTENANCE', `Manual self-healing triggered by ${message.author.username}`);
        } else {
          await message.reply('Self-healing is not enabled in the configuration.');
        }
        break;
        
      case 'logs':
        const logType = args[0] || 'all';
        const count = parseInt(args[1] || '5');
        
        let query = 'SELECT * FROM events';
        const params: any[] = [];
        
        if (logType !== 'all') {
          query += ' WHERE type = ?';
          params.push(logType.toUpperCase());
        }
        
        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(count);
        
        try {
          const logs = await dbAll(query, params);
          
          if (logs.length === 0) {
            await message.channel.send(`No logs found for type: ${logType}`);
            return;
          }
          
          if (PERSONALITY_ENABLED) {
            const personality = getPersonalityCore();
            const embed = personality.createStyledEmbed(
              `Recent Logs: ${logType.toUpperCase()}`,
              `Last ${logs.length} log entries`
            );
            
            logs.forEach(log => {
              const time = new Date(log.timestamp).toLocaleString();
              embed.addFields({
                name: `[${log.type}] at ${time}`,
                value: log.description || 'No details provided'
              });
            });
            
            await message.channel.send({ embeds: [embed] });
          } else {
            const embed = new EmbedBuilder()
              .setTitle(`Recent Logs: ${logType.toUpperCase()}`)
              .setColor(0x9B59B6)
              .setDescription(`Last ${logs.length} log entries`);
              
            logs.forEach(log => {
              const time = new Date(log.timestamp).toLocaleString();
              embed.addFields({
                name: `[${log.type}] at ${time}`,
                value: log.description || 'No details provided'
              });
            });
            
            await message.channel.send({ embeds: [embed] });
          }
          
          await logEvent('COMMAND', `User ${message.author.username} viewed logs of type ${logType}`);
        } catch (error) {
          console.error('Error fetching logs:', error);
          await message.reply('Error retrieving logs. Please try again later.');
        }
        break;
        
      // Phase 4 Commands
      case 'uptime':
        try {
          if (SENTINEL_ENABLED) {
            const sentinel = getSentinel(client, NOTIFY_CHANNEL_ID);
            const uptime = await sentinel.getSystemUptime();
            
            if (PERSONALITY_ENABLED) {
              const personality = getPersonalityCore();
              const embed = personality.createStyledEmbed(
                'System Uptime',
                `The system has been ${uptime}`
              );
              
              const botUptime = process.uptime();
              const days = Math.floor(botUptime / 86400);
              const hours = Math.floor((botUptime % 86400) / 3600);
              const minutes = Math.floor((botUptime % 3600) / 60);
              const botUptimeStr = `${days}d ${hours}h ${minutes}m`;
              
              embed.addFields(
                { name: 'System Uptime', value: uptime, inline: true },
                { name: 'Bot Uptime', value: botUptimeStr, inline: true }
              );
              
              await message.channel.send({ embeds: [embed] });
            } else {
              await message.reply(`System uptime: ${uptime}`);
            }
            
            await logEvent('COMMAND', `User ${message.author.username} checked system uptime`);
          } else {
            // Fallback if Sentinel is not enabled
            const botUptime = process.uptime();
            const days = Math.floor(botUptime / 86400);
            const hours = Math.floor((botUptime % 86400) / 3600);
            const minutes = Math.floor((botUptime % 3600) / 60);
            const botUptimeStr = `${days}d ${hours}h ${minutes}m`;
            
            await message.reply(`Bot uptime: ${botUptimeStr}`);
          }
        } catch (error) {
          console.error('Error getting uptime:', error);
          await message.reply('Error retrieving uptime information.');
        }
        break;
        
      case 'services':
        try {
          if (SENTINEL_ENABLED) {
            const sentinel = getSentinel(client, NOTIFY_CHANNEL_ID);
            const services = await sentinel.getServicesStatus();
            
            if (PERSONALITY_ENABLED) {
              const personality = getPersonalityCore();
              const embed = personality.createStyledEmbed(
                'System Services Status',
                'Current status of monitored services'
              );
              
              let allRunning = true;
              services.forEach(service => {
                const statusEmoji = service.isRunning ? '\U0001F7E2' : '\U0001F534';
                allRunning = allRunning && service.isRunning;
                
                embed.addFields({
                  name: `${statusEmoji} ${service.name}`,
                  value: service.isRunning 
                    ? `Running${service.memory ? ` | Memory: ${service.memory}` : ''}` 
                    : 'Not running',
                  inline: true
                });
              });
              
              // Update mood based on services status
              if (!allRunning) {
                await personality.processEvent(EventType.SYSTEM_ERROR, 6);
              }
              
              await message.channel.send({ embeds: [embed] });
            } else {
              const statusList = services.map(service => 
                `${service.name}: ${service.isRunning ? '✅ Running' : '❌ Not running'}`
              ).join('\n');
              
              await message.reply(`**Services Status**\n${statusList}`);
            }
            
            await logEvent('COMMAND', `User ${message.author.username} checked services status`);
          } else {
            await message.reply('Services monitoring is not enabled.');
          }
        } catch (error) {
          console.error('Error getting services status:', error);
          await message.reply('Error retrieving services information.');
        }
        break;
      
      // Phase 5 Commands
      case 'mood':
        if (PERSONALITY_ENABLED) {
          const personality = getPersonalityCore();
          const mood = personality.getMood();
          
          const embed = personality.createStyledEmbed(
            'My Current Mood',
            `I'm currently feeling **${mood.mood}** (intensity: ${mood.intensity}/10)`
          );
          
          let moodDescription = '';
          switch(mood.mood) {
            case 'happy':
              moodDescription = 'I\'m feeling great and optimistic!';
              break;
            case 'focused':
              moodDescription = 'I\'m concentrating on my tasks and monitoring responsibilities.';
              break;
            case 'concerned':
              moodDescription = 'I\'m worried about some issues I\'ve detected.';
              break;
            case 'alert':
              moodDescription = 'I\'m on high alert due to detected threats or issues.';
              break;
            case 'playful':
              moodDescription = 'I\'m in a good mood and feeling a bit mischievous!';
              break;
            case 'sarcastic':
              moodDescription = 'I\'m feeling a bit snarky at the moment.';
              break;
            case 'serious':
              moodDescription = 'I\'m in a no-nonsense mood right now.';
              break;
          }
          
          embed.addFields(
            { name: 'How I Feel', value: moodDescription, inline: false },
            { name: 'Made With', value: '\U0001F49C by NullMeDev', inline: false }
          );
          
          await message.channel.send({ embeds: [embed] });
          await logEvent('COMMAND', `User ${message.author.username} checked bot mood`);
        } else {
          await message.reply('Personality system is not enabled.');
        }
        break;
      
      case 'backup':

        if (RCLONE_BACKUP_ENABLED && SENTINEL_ENABLED) {
          await message.channel.send('\U0001F504 Initiating manual backup process...');
          
          try {
            const scriptPath = path.join(process.cwd(), 'scripts', 'backup.sh');
            if (fs.existsSync(scriptPath)) {
              const { exec } = require('child_process');
              exec(scriptPath, async (error: any, stdout: string, stderr: string) => {
                if (error) {
                  console.error(`Backup error: ${error}`);
                  await message.channel.send(`❌ Backup failed: ${error.message}`);
                  return;
                }
                
                if (stderr) {
                  console.error(`Backup stderr: ${stderr}`);
                }
                
                await message.channel.send('✅ Backup completed successfully!');
                await logEvent('BACKUP', `Manual backup triggered by ${message.author.username}`);
              });
            } else {
              await message.channel.send('❌ Backup script not found. Please set up rclone first.');
            }
          } catch (error) {
            console.error('Error running backup:', error);
            await message.channel.send('❌ Error executing backup.');
          }
        } else {
          await message.reply('Backup system is not enabled.');
        }
        break;
      
      case 'sentinel':

        const action = args[0]?.toLowerCase();
        
        if (SENTINEL_ENABLED) {
          const sentinel = getSentinel(client, NOTIFY_CHANNEL_ID);
          
          if (action === 'start') {
            sentinel.start(SENTINEL_CHECK_INTERVAL);
            await message.channel.send('✅ Sentinel monitoring system started.');
            await logEvent('SENTINEL', `Sentinel system started by ${message.author.username}`);
          } else if (action === 'stop') {
            sentinel.stop();
            await message.channel.send('✅ Sentinel monitoring system stopped.');
            await logEvent('SENTINEL', `Sentinel system stopped by ${message.author.username}`);
          } else {
            await message.channel.send('Please specify either "start" or "stop" for the sentinel command.');
          }
        } else {
          await message.reply('Sentinel Intelligence is not enabled.');
        }
        break;
      
      case 'incidents':
        const incidentCount = parseInt(args[0] || '5');
        
        try {
          const incidents = await getRecentIncidents(incidentCount);
          
          if (incidents.length === 0) {
            await message.channel.send('No security incidents found.');
            return;
          }
          
          if (PERSONALITY_ENABLED) {
            const personality = getPersonalityCore();
            const embed = personality.createStyledEmbed(
              'Security Incidents Report',
              `Last ${incidents.length} security incidents detected`
            );
            
            incidents.forEach((incident: any) => {
              const time = new Date(incident.created_at).toLocaleString();
              const status = incident.resolved ? '✅ Resolved' : '⚠️ Active';
              embed.addFields({
                name: `[${incident.severity.toUpperCase()}] ${incident.source} - ${time}`,
                value: `${status}: ${incident.description}\n${incident.details || 'No additional details'}`
              });
            });
            
            await message.channel.send({ embeds: [embed] });
          } else {
            const embed = new EmbedBuilder()
              .setTitle('Security Incidents Report')
              .setColor(0xE74C3C)
              .setDescription(`Last ${incidents.length} security incidents`);
              
            incidents.forEach((incident: any) => {
              const time = new Date(incident.created_at).toLocaleString();
              const status = incident.resolved ? '✅ Resolved' : '⚠️ Active';
              embed.addFields({
                name: `[${incident.severity.toUpperCase()}] ${incident.source} - ${time}`,
                value: `${status}: ${incident.description}\n${incident.details || 'No additional details'}`
              });
            });
            
            await message.channel.send({ embeds: [embed] });
          }
          
          await logEvent('COMMAND', `User ${message.author.username} viewed security incidents`);
        } catch (error) {
          console.error('Error fetching incidents:', error);
          await message.reply('Error retrieving incident information.');
        }
        break;
        
      case 'whitelist':

        // Handle whitelist commands through the dedicated handler
        await handleWhitelistCommands(message, args);
        break;

      // New command for Fail2Ban status (new)
      case 'fail2ban':
        if (FULL_SENTINEL_MODE) {
          try {
            const fail2banMonitor = getFail2BanMonitor(client, NOTIFY_CHANNEL_ID, logEvent);
            const jails = await fail2banMonitor.getJailStatus();
            
            if (jails.length === 0) {
              await message.channel.send('No Fail2Ban jails found on this system.');
              return;
            }
            
            const embed = new EmbedBuilder()
              .setTitle('🛡️ Fail2Ban Status')
              .setDescription('Current status of Fail2Ban security system')
              .setColor(0x3498DB)
              .setTimestamp();
            
            // Add jail status
            jails.forEach(jail => {
              const statusEmoji = jail.status === 'active' ? '🟢' : '🔴';
              embed.addFields({
                name: `${statusEmoji} ${jail.name}`,
                value: `Status: ${jail.status}\nTotal banned: ${jail.totalBanned}\nCurrently banned: ${jail.bannedIPs.length} IPs`,
                inline: true
              });
            });
            
            // Add summary
            const activeJails = jails.filter(j => j.status === 'active').length;
            const totalBanned = jails.reduce((sum, j) => sum + j.totalBanned, 0);
            embed.addFields({
              name: '📊 Summary',
              value: `${activeJails} of ${jails.length} jails active\nTotal banned IPs: ${totalBanned}`
            });
            
            await message.channel.send({ embeds: [embed] });
            await logEvent('COMMAND', `User ${message.author.username} checked Fail2Ban status`);
          } catch (error) {
            console.error('Error fetching Fail2Ban status:', error);
            await message.reply('Error retrieving Fail2Ban information.');
          }
        } else {
          await message.reply('Full Sentinel Protector mode is not enabled.');
        }
        break;
        
      // New command for manual health check (new)
      case 'healthcheck':
        if (FULL_SENTINEL_MODE) {
          try {
            await message.channel.send('🔍 Running system health check...');
            
            const healthCheckMonitor = getHealthCheckMonitor(client, NOTIFY_CHANNEL_ID, logEvent);
            
            // Access the private method using any type to bypass TypeScript protection
            const health = await (healthCheckMonitor as any).checkSystemHealth();
            const issues = (healthCheckMonitor as any).detectIssues(health);
            
            if (issues.length > 0) {
              await (healthCheckMonitor as any).sendHealthAlert(health, issues);
              await message.channel.send(`⚠️ Health check complete. Found ${issues.length} issues. Check the notification channel for details.`);
            } else {
              // Send periodic update instead of full alert
              await (healthCheckMonitor as any).sendPeriodicHealthUpdate(health);
              await message.channel.send('✅ Health check complete. All systems normal.');
            }
            
            await logEvent('COMMAND', `Manual health check triggered by ${message.author.username}`);
          } catch (error) {
            console.error('Error running health check:', error);
            await message.reply('Error performing health check.');
          }
        } else {
          await message.reply('Full Sentinel Protector mode is not enabled.');
        }
        break;
    }
  }
  
  // Respond when mentioned
  if (message.mentions.has(client.user!.id) && isTextChannel) {
    // Extract the actual question by removing the mention
    const questionText = content.replace(new RegExp(`<@!?${client.user!.id}>`), '').trim();
    
    if (questionText) {
      await message.channel.sendTyping();
      
      if (PERSONALITY_ENABLED && process.env.AI_ENABLED === 'true') {
        try {
          const personality = getPersonalityCore();
          await personality.processEvent(EventType.USER_INTERACTION, 6);
          
          // Get information about the server and channel for context
          const guildName = message.guild?.name || 'Direct Message';
          // Safely get channel name based on channel type
          const channelName = message.channel.type === ChannelType.DM 
            ? 'Direct Message'
            : 'name' in message.channel 
              ? message.channel.name || 'Unknown Channel'
              : 'Unknown Channel';
          const contextInfo = `This conversation is taking place in ${guildName}, in channel: ${channelName}. 
          The user has mentioned you directly in their message.`;
          
          // Generate AI response using DeepSeek-V3
          const response = await personality.generateAIResponse(
            questionText,
            message.author.id,
            contextInfo
          );
          
          await message.reply(response);
          await logEvent('MENTION', `User ${message.author.username} mentioned bot and said: ${questionText.substring(0, 50)}${questionText.length > 50 ? '...' : ''}`);
        } catch (error) {
          console.error('Error processing AI response for mention:', error);
          await message.reply("I encountered an error while processing your message. Please try again later.");
          await logEvent('ERROR', `AI error for mention by ${message.author.username}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Fallback if AI or personality is not enabled
        let response = "Hi there! AI capabilities are not currently enabled.";
        
        // Apply personality styling if available
        if (PERSONALITY_ENABLED) {
          const personality = getPersonalityCore();
          await personality.processEvent(EventType.USER_INTERACTION, 6);
          response = await personality.styleMessage(response);
        }
        
        await message.reply(response);
        await logEvent('MENTION', `User ${message.author.username} mentioned bot and said: ${questionText}`);
      }
    }
  }
});

// Set up graceful shutdown
async function gracefulShutdown(reason: string) {
  console.log(`Initiating graceful shutdown: ${reason}`);
  
  try {
    // Log shutdown event
    await logEvent('SHUTDOWN', `Bot shutting down: ${reason}`);
    
    // Send shutdown notification
    if (client.isReady() && NOTIFY_CHANNEL_ID) {
      const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send(`\U0001F6D1 Shutting down: ${reason}`);
      }
    }
    
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
      
      // Exit gracefully
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM signal received'));
process.on('SIGINT', () => gracefulShutdown('SIGINT signal received'));

// Start the bot
client.login(process.env.DISCORD_TOKEN);
