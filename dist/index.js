"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const monitor_1 = require("./monitor");
const sentinel_1 = require("./sentinel");
const personality_1 = require("./personality");
const whitelist_commands_1 = require("./whitelist-commands");
// Use require for modules with export issues
const api = require('./api');
const dbModule = require('./db');
const startApiServer = api.startApiServer;
const dbInitializeDatabase = dbModule.initializeDatabase;
const dbLogEvent = dbModule.logEvent;
const getRecentIncidents = dbModule.getRecentIncidents;
dotenv_1.default.config();
// Database initialization
const DB_PATH = process.env.DATABASE_PATH || './data/noxhime.db';
// Ensure data directory exists
const dataDir = path_1.default.dirname(DB_PATH);
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
// Initialize database
const db = new sqlite3_1.default.Database(DB_PATH);
// Database helper functions
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err)
                return reject(err);
            resolve(this);
        });
    });
}
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                return reject(err);
            resolve(row);
        });
    });
}
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                return reject(err);
            resolve(rows);
        });
    });
}
// Initialize database tables
async function initializeDatabase() {
    return await dbInitializeDatabase();
}
// Log an event
async function logEvent(type, description) {
    return await dbLogEvent(type, description);
}
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID || '';
const BIOLOCK_ENABLED = false; // Disabled - bot is now open for all users
const BIOLOCK_PASSPHRASE = process.env.BIOLOCK_PASSPHRASE;
const BIOLOCK_OVERRIDE_KEY = process.env.BIOLOCK_OVERRIDE_KEY;
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || '!';
const MONIT_ENABLED = process.env.MONIT_ENABLED === 'true';
const MONIT_PORT = parseInt(process.env.MONIT_PORT || '5000');
const PID_FILE_PATH = process.env.PID_FILE_PATH || '/home/nulladmin/noxhime-bot/noxhime.pid';
const SELF_HEALING_ENABLED = process.env.SELF_HEALING_ENABLED === 'true';
const SYSTEM_STATS_INTERVAL = parseInt(process.env.SYSTEM_STATS_INTERVAL || '3600000'); // Default: 1 hour
// Phase 4: Sentinel Intelligence Configuration
const SENTINEL_ENABLED = process.env.SENTINEL_ENABLED === 'true';
const SENTINEL_CHECK_INTERVAL = parseInt(process.env.SENTINEL_CHECK_INTERVAL || '60000'); // Default: 1 minute
const RCLONE_BACKUP_ENABLED = process.env.RCLONE_BACKUP_ENABLED === 'true';
const RCLONE_REMOTE = process.env.RCLONE_REMOTE || 'gdrive:NoxhimeBackups';
const RCLONE_SCHEDULE = process.env.RCLONE_SCHEDULE || '0 0 * * *'; // Default: Daily at midnight
// Phase 5: Personality Core Configuration
const PERSONALITY_ENABLED = process.env.PERSONALITY_ENABLED === 'true';
const DEFAULT_MOOD = process.env.DEFAULT_MOOD || 'focused';
let bioLocked = false; // BioLock disabled - bot is now open for all users
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
// Function to use OpenAI for chat responses
async function generateAIResponse(prompt) {
    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are Noxhime, a helpful Discord bot with a friendly but slightly mischievous personality. You help users with information and assistance." },
                { role: "user", content: prompt }
            ],
            model: "gpt-3.5-turbo",
        });
        return completion.choices[0].message.content || "I don't have a response for that.";
    }
    catch (error) {
        console.error('Error generating AI response:', error);
        return "I'm having trouble thinking right now. Please try again later.";
    }
}
client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    // Initialize the database
    try {
        await initializeDatabase();
        console.log('Database initialized successfully');
    }
    catch (error) {
        console.error('Database initialization error:', error);
    }
    // Write PID file for Monit monitoring
    (0, monitor_1.savePidFile)(PID_FILE_PATH);
    // Set up monitoring server if enabled
    if (MONIT_ENABLED) {
        (0, monitor_1.setupMonitoringServer)(client, NOTIFY_CHANNEL_ID, logEvent, MONIT_PORT);
        console.log(`Monitoring server started on port ${MONIT_PORT}`);
        await logEvent('SYSTEM', `Monitoring server started on port ${MONIT_PORT}`);
    }
    // Set up crash handling and recovery
    if (SELF_HEALING_ENABLED) {
        (0, monitor_1.setupCrashHandling)(client, NOTIFY_CHANNEL_ID, logEvent);
        console.log('Self-healing and crash handling enabled');
        // Setup periodic self-healing
        const selfHeal = (0, monitor_1.setupSelfHealing)(logEvent);
        setInterval(async () => {
            await selfHeal();
        }, 24 * 60 * 60 * 1000); // Run self-healing once a day
    }
    // Set up periodic system stats collection
    if (NOTIFY_CHANNEL_ID && SYSTEM_STATS_INTERVAL > 0) {
        console.log(`System stats reporting configured for every ${SYSTEM_STATS_INTERVAL / 60000} minutes`);
        setInterval(async () => {
            try {
                const stats = await (0, monitor_1.collectSystemStats)();
                await logEvent('SYSTEM_STATS', JSON.stringify(stats));
                // Log to console but don't send to Discord to avoid spam
                console.log('System stats collected:', stats);
            }
            catch (error) {
                console.error('Error collecting system stats:', error);
            }
        }, SYSTEM_STATS_INTERVAL);
    }
    // Phase 4: Set up Sentinel Intelligence
    if (SENTINEL_ENABLED) {
        try {
            const sentinel = (0, sentinel_1.getSentinel)(client, NOTIFY_CHANNEL_ID);
            sentinel.start(SENTINEL_CHECK_INTERVAL);
            console.log(`Sentinel Intelligence started with check interval ${SENTINEL_CHECK_INTERVAL / 1000} seconds`);
            await logEvent('SENTINEL', 'Sentinel Intelligence system activated');
            // Set up rclone backups if enabled
            if (RCLONE_BACKUP_ENABLED) {
                try {
                    await sentinel.setupRclone(RCLONE_REMOTE, ['./data/noxhime.db', './logs'], RCLONE_SCHEDULE);
                    console.log('Rclone backup system configured');
                    await logEvent('SYSTEM', 'Rclone backup system configured');
                }
                catch (error) {
                    console.error('Failed to set up rclone backups:', error);
                }
            }
        }
        catch (error) {
            console.error('Error starting Sentinel Intelligence:', error);
        }
    }
    // Phase 5: Initialize Personality Core
    if (PERSONALITY_ENABLED) {
        try {
            const personality = (0, personality_1.getPersonalityCore)();
            await personality.initialize();
            console.log('Personality Core initialized');
            await logEvent('SYSTEM', 'Personality Core initialized');
            // Process startup event to set mood
            await personality.processEvent(personality_1.EventType.SUCCESSFUL_OPERATION, 8);
        }
        catch (error) {
            console.error('Error initializing Personality Core:', error);
        }
    }
    // Initialize API server for web integration if enabled
    const API_ENABLED = process.env.API_ENABLED === 'true';
    const API_PORT = parseInt(process.env.API_PORT || '3000');
    const API_KEYS = process.env.API_KEYS?.split(',') || [];
    if (API_ENABLED) {
        try {
            // Import here to prevent circular dependencies
            const { startApiServer } = require('./api');
            startApiServer(client, API_PORT, API_KEYS);
            console.log(`API server started on port ${API_PORT} for web integration`);
            await logEvent('SYSTEM', `API server started on port ${API_PORT}`);
        }
        catch (error) {
            console.error('Error starting API server:', error);
        }
    }
    // Send startup notification
    if (NOTIFY_CHANNEL_ID) {
        try {
            const auditChannel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
            if (auditChannel?.isTextBased()) {
                const textChannel = auditChannel;
                // Use personality core for startup message if enabled
                if (PERSONALITY_ENABLED) {
                    const personality = (0, personality_1.getPersonalityCore)();
                    const mood = personality.getMood();
                    const startupEmbed = personality.createStyledEmbed('System Online', 'Noxhime Bot is now active and operational.');
                    startupEmbed.addFields({ name: 'Version', value: '4.0.0 (Sentinel Update)', inline: true }, { name: 'Uptime', value: 'Just started', inline: true });
                    await textChannel.send({
                        content: await personality.styleMessage('I am awake and operational.'),
                        embeds: [startupEmbed]
                    });
                }
                else {
                    // Original startup message
                    await textChannel.send('Onii-chan, I\'m back up now!');
                }
                // Create a recovery message if we can find evidence of a crash
                try {
                    const lastEvent = await dbGet('SELECT * FROM events WHERE type IN ("CRITICAL_ERROR", "SYSTEM_ALERT") ORDER BY timestamp DESC LIMIT 1');
                    if (lastEvent && (Date.now() - new Date(lastEvent.timestamp).getTime()) < 300000) { // Within 5 minutes
                        if (PERSONALITY_ENABLED) {
                            const personality = (0, personality_1.getPersonalityCore)();
                            await personality.changeMood('concerned', 'recovery', 7);
                            const recoveryMessage = personality.generateEmotionalResponse('error', 6);
                            const recoveryEmbed = personality.createStyledEmbed('System Recovery Report', `${recoveryMessage} I had to restart after encountering an issue.`);
                            recoveryEmbed.addFields({ name: 'Issue Details', value: lastEvent.description }, { name: 'Recovery Time', value: new Date().toLocaleString() });
                            await textChannel.send({ embeds: [recoveryEmbed] });
                        }
                        else {
                            await textChannel.send({
                                content: '**Recovery Report**',
                                embeds: [
                                    new discord_js_1.EmbedBuilder()
                                        .setTitle('System Recovery')
                                        .setDescription(`I've recovered from an issue: ${lastEvent.description}`)
                                        .setColor(0x00FF00)
                                        .setTimestamp()
                                        .setFooter({ text: 'Server Monitoring System' })
                                ]
                            });
                        }
                    }
                }
                catch (recoveryError) {
                    console.error('Error creating recovery message:', recoveryError);
                }
                await logEvent('STARTUP', 'Bot successfully started and connected to Discord');
            }
            else {
                console.log('Channel is not text-based');
            }
        }
        catch (error) {
            console.error('Error sending startup message:', error);
        }
    }
    else {
        console.log('No notify channel ID configured');
    }
    console.log('Bot initialization complete with Sentinel Intelligence and Personality Core');
});
client.on('messageCreate', async (message) => {
    if (message.author.bot)
        return;
    const content = message.content;
    const lowerContent = content.toLowerCase();
    const isTextChannel = message.channel.type === discord_js_1.ChannelType.GuildText;
    // BioLock System - DISABLED (bot is now open for all users)
    // All commands are now available to everyone
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
                    `\`${COMMAND_PREFIX}restart\` – restart the bot`,
                    `\`${COMMAND_PREFIX}heal\` – trigger self-healing routine`,
                    `\`${COMMAND_PREFIX}logs <type> <count>\` – view recent logs`,
                    `\`${COMMAND_PREFIX}backup\` – trigger manual backup`,
                    `\`${COMMAND_PREFIX}sentinel <start|stop>\` – control sentinel system`,
                    `\`${COMMAND_PREFIX}incidents\` – view security incidents`,
                    `\`${COMMAND_PREFIX}whitelist <action>\` – manage server whitelisting`
                ];
                // Use personality system if enabled
                if (PERSONALITY_ENABLED) {
                    const personality = (0, personality_1.getPersonalityCore)();
                    const embed = personality.createStyledEmbed('Available Commands', 'Here are the commands you can use:');
                    embed.addFields({ name: 'All Commands (Available to Everyone)', value: commands.join('\n') });
                    await message.channel.send({ embeds: [embed] });
                }
                else {
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
                let response = await generateAIResponse(question);
                // Apply personality styling if enabled
                if (PERSONALITY_ENABLED) {
                    const personality = (0, personality_1.getPersonalityCore)();
                    await personality.processEvent(personality_1.EventType.USER_INTERACTION, 5);
                    response = await personality.styleMessage(response);
                }
                await message.reply(response);
                await logEvent('AI_QUERY', `User ${message.author.username} asked: ${question}`);
                break;
            case 'restart':
                const auditChannel = NOTIFY_CHANNEL_ID
                    ? await client.channels.fetch(NOTIFY_CHANNEL_ID)
                    : null;
                if (auditChannel?.isTextBased()) {
                    await auditChannel.send('Bot restart requested by user... 💤');
                }
                await message.channel.send('Restarting now. Please wait...');
                await logEvent('ADMIN', `User ${message.author.username} initiated restart`);
                process.exit(0);
                break;
            case 'lock':
                // Lock functionality removed - bot is now open for all users
                await message.reply("Lock functionality has been removed. This bot is now freely available to all users!");
                break;
            case 'system':
                try {
                    const stats = await (0, monitor_1.collectSystemStats)();
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('System Status')
                        .setDescription('Current system health and statistics')
                        .setColor(0x3498DB)
                        .addFields({ name: 'CPU Usage', value: `${stats.cpuUsage.toFixed(1)}%`, inline: true }, { name: 'Memory Usage', value: `${stats.memoryUsage.toFixed(1)}%`, inline: true }, { name: 'Disk Usage', value: `${stats.diskUsage.toFixed(1)}%`, inline: true }, { name: 'Uptime', value: stats.uptime, inline: true }, { name: 'Bot Status', value: '🟢 Online', inline: true }, { name: 'Monitoring', value: MONIT_ENABLED ? '✅ Active' : '❌ Disabled', inline: true })
                        .setTimestamp()
                        .setFooter({ text: 'Noxhime Monitoring System' });
                    await message.channel.send({ embeds: [embed] });
                    await logEvent('COMMAND', `User ${message.author.username} requested system status`);
                }
                catch (error) {
                    console.error('Error fetching system stats:', error);
                    await message.reply('Error fetching system statistics. Please try again later.');
                }
                break;
            case 'heal':
                if (SELF_HEALING_ENABLED) {
                    await message.channel.send('🔄 Initiating self-healing routine...');
                    const selfHeal = (0, monitor_1.setupSelfHealing)(logEvent);
                    await selfHeal();
                    await message.channel.send('✅ Self-healing complete. Memory optimized and systems checked.');
                    await logEvent('MAINTENANCE', `Manual self-healing triggered by ${message.author.username}`);
                }
                else {
                    await message.reply('Self-healing is not enabled in the configuration.');
                }
                break;
            case 'logs':
                const logType = args[0] || 'all';
                const count = parseInt(args[1] || '5');
                let query = 'SELECT * FROM events';
                const params = [];
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
                        const personality = (0, personality_1.getPersonalityCore)();
                        const embed = personality.createStyledEmbed(`Recent Logs: ${logType.toUpperCase()}`, `Last ${logs.length} log entries`);
                        logs.forEach(log => {
                            const time = new Date(log.timestamp).toLocaleString();
                            embed.addFields({
                                name: `[${log.type}] at ${time}`,
                                value: log.description || 'No details provided'
                            });
                        });
                        await message.channel.send({ embeds: [embed] });
                    }
                    else {
                        const embed = new discord_js_1.EmbedBuilder()
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
                }
                catch (error) {
                    console.error('Error fetching logs:', error);
                    await message.reply('Error retrieving logs. Please try again later.');
                }
                break;
            // Phase 4 Commands
            case 'uptime':
                try {
                    if (SENTINEL_ENABLED) {
                        const sentinel = (0, sentinel_1.getSentinel)(client, NOTIFY_CHANNEL_ID);
                        const uptime = await sentinel.getSystemUptime();
                        if (PERSONALITY_ENABLED) {
                            const personality = (0, personality_1.getPersonalityCore)();
                            const embed = personality.createStyledEmbed('System Uptime', `The system has been ${uptime}`);
                            const botUptime = process.uptime();
                            const days = Math.floor(botUptime / 86400);
                            const hours = Math.floor((botUptime % 86400) / 3600);
                            const minutes = Math.floor((botUptime % 3600) / 60);
                            const botUptimeStr = `${days}d ${hours}h ${minutes}m`;
                            embed.addFields({ name: 'System Uptime', value: uptime, inline: true }, { name: 'Bot Uptime', value: botUptimeStr, inline: true });
                            await message.channel.send({ embeds: [embed] });
                        }
                        else {
                            await message.reply(`System uptime: ${uptime}`);
                        }
                        await logEvent('COMMAND', `User ${message.author.username} checked system uptime`);
                    }
                    else {
                        // Fallback if Sentinel is not enabled
                        const botUptime = process.uptime();
                        const days = Math.floor(botUptime / 86400);
                        const hours = Math.floor((botUptime % 86400) / 3600);
                        const minutes = Math.floor((botUptime % 3600) / 60);
                        const botUptimeStr = `${days}d ${hours}h ${minutes}m`;
                        await message.reply(`Bot uptime: ${botUptimeStr}`);
                    }
                }
                catch (error) {
                    console.error('Error getting uptime:', error);
                    await message.reply('Error retrieving uptime information.');
                }
                break;
            case 'services':
                try {
                    if (SENTINEL_ENABLED) {
                        const sentinel = (0, sentinel_1.getSentinel)(client, NOTIFY_CHANNEL_ID);
                        const services = await sentinel.getServicesStatus();
                        if (PERSONALITY_ENABLED) {
                            const personality = (0, personality_1.getPersonalityCore)();
                            const embed = personality.createStyledEmbed('System Services Status', 'Current status of monitored services');
                            let allRunning = true;
                            services.forEach(service => {
                                const statusEmoji = service.isRunning ? '🟢' : '🔴';
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
                                await personality.processEvent(personality_1.EventType.SYSTEM_ERROR, 6);
                            }
                            await message.channel.send({ embeds: [embed] });
                        }
                        else {
                            const statusList = services.map(service => `${service.name}: ${service.isRunning ? '✅ Running' : '❌ Not running'}`).join('\n');
                            await message.reply(`**Services Status**\n${statusList}`);
                        }
                        await logEvent('COMMAND', `User ${message.author.username} checked services status`);
                    }
                    else {
                        await message.reply('Services monitoring is not enabled.');
                    }
                }
                catch (error) {
                    console.error('Error getting services status:', error);
                    await message.reply('Error retrieving services information.');
                }
                break;
            // Phase 5 Commands
            case 'mood':
                if (PERSONALITY_ENABLED) {
                    const personality = (0, personality_1.getPersonalityCore)();
                    const mood = personality.getMood();
                    const embed = personality.createStyledEmbed('My Current Mood', `I'm currently feeling **${mood.mood}** (intensity: ${mood.intensity}/10)`);
                    let moodDescription = '';
                    switch (mood.mood) {
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
                    embed.addFields({ name: 'How I Feel', value: moodDescription, inline: false }, { name: 'Made With', value: '💜 by NullMeDev', inline: false });
                    await message.channel.send({ embeds: [embed] });
                    await logEvent('COMMAND', `User ${message.author.username} checked bot mood`);
                }
                else {
                    await message.reply('Personality system is not enabled.');
                }
                break;
            case 'backup':
                if (RCLONE_BACKUP_ENABLED && SENTINEL_ENABLED) {
                    await message.channel.send('🔄 Initiating manual backup process...');
                    try {
                        const scriptPath = path_1.default.join(process.cwd(), 'scripts', 'backup.sh');
                        if (fs_1.default.existsSync(scriptPath)) {
                            const { exec } = require('child_process');
                            exec(scriptPath, async (error, stdout, stderr) => {
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
                        }
                        else {
                            await message.channel.send('❌ Backup script not found. Please set up rclone first.');
                        }
                    }
                    catch (error) {
                        console.error('Error running backup:', error);
                        await message.channel.send('❌ Error executing backup.');
                    }
                }
                else {
                    await message.reply('Backup system is not enabled.');
                }
                break;
            case 'sentinel':
                const action = args[0]?.toLowerCase();
                if (SENTINEL_ENABLED) {
                    const sentinel = (0, sentinel_1.getSentinel)(client, NOTIFY_CHANNEL_ID);
                    if (action === 'start') {
                        sentinel.start(SENTINEL_CHECK_INTERVAL);
                        await message.channel.send('✅ Sentinel monitoring system started.');
                        await logEvent('SENTINEL', `Sentinel system started by ${message.author.username}`);
                    }
                    else if (action === 'stop') {
                        sentinel.stop();
                        await message.channel.send('✅ Sentinel monitoring system stopped.');
                        await logEvent('SENTINEL', `Sentinel system stopped by ${message.author.username}`);
                    }
                    else {
                        await message.channel.send('Please specify either "start" or "stop" for the sentinel command.');
                    }
                }
                else {
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
                        const personality = (0, personality_1.getPersonalityCore)();
                        const embed = personality.createStyledEmbed('Security Incidents Report', `Last ${incidents.length} security incidents detected`);
                        incidents.forEach((incident) => {
                            const time = new Date(incident.created_at).toLocaleString();
                            const status = incident.resolved ? '✅ Resolved' : '⚠️ Active';
                            embed.addFields({
                                name: `[${incident.severity.toUpperCase()}] ${incident.source} - ${time}`,
                                value: `${status}: ${incident.description}\n${incident.details || 'No additional details'}`
                            });
                        });
                        await message.channel.send({ embeds: [embed] });
                    }
                    else {
                        const embed = new discord_js_1.EmbedBuilder()
                            .setTitle('Security Incidents Report')
                            .setColor(0xE74C3C)
                            .setDescription(`Last ${incidents.length} security incidents`);
                        incidents.forEach((incident) => {
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
                }
                catch (error) {
                    console.error('Error fetching incidents:', error);
                    await message.reply('Error retrieving incident information.');
                }
                break;
            case 'whitelist':
                // Handle whitelist commands through the dedicated handler
                await (0, whitelist_commands_1.handleWhitelistCommands)(message, args);
                break;
        }
    }
    // AI Chat - respond when mentioned
    if (message.mentions.has(client.user.id) && isTextChannel) {
        // Extract the actual question by removing the mention
        const questionText = content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
        if (questionText) {
            await message.channel.sendTyping();
            let response = await generateAIResponse(questionText);
            // Apply personality styling if enabled
            if (PERSONALITY_ENABLED) {
                const personality = (0, personality_1.getPersonalityCore)();
                await personality.processEvent(personality_1.EventType.USER_INTERACTION, 6);
                response = await personality.styleMessage(response);
            }
            await message.reply(response);
            await logEvent('AI_MENTION', `User ${message.author.username} mentioned bot and said: ${questionText}`);
        }
    }
});
// Set up graceful shutdown
async function gracefulShutdown(reason) {
    console.log(`Initiating graceful shutdown: ${reason}`);
    try {
        // Log shutdown event
        await logEvent('SHUTDOWN', `Bot shutting down: ${reason}`);
        // Send shutdown notification
        if (client.isReady() && NOTIFY_CHANNEL_ID) {
            const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
            if (channel?.isTextBased()) {
                await channel.send(`🛑 Shutting down: ${reason}`);
            }
        }
        // Close database connection
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
            else {
                console.log('Database connection closed');
            }
            // Exit gracefully
            process.exit(0);
        });
    }
    catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}
// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM signal received'));
process.on('SIGINT', () => gracefulShutdown('SIGINT signal received'));
// Start the bot
client.login(process.env.DISCORD_TOKEN);
