import { Client, GatewayIntentBits, ChannelType, TextChannel } from 'discord.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

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
  try {
    // Read schema SQL
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error('Schema file not found at:', schemaPath);
      return false;
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute each SQL statement
    const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await dbRun(stmt);
      }
    }
    
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

// Log an event
async function logEvent(type: string, description: string): Promise<boolean> {
  try {
    await dbRun('INSERT INTO events (type, description) VALUES (?, ?)', [type, description]);
    console.log(`Event logged: [${type}] ${description}`);
    return true;
  } catch (error) {
    console.error('Error logging event:', error);
    return false;
  }
}

const OWNER_ID = process.env.OWNER_ID!;
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID || '';
const BIOLOCK_ENABLED = process.env.BIOLOCK_ENABLED === 'true';
const BIOLOCK_PASSPHRASE = process.env.BIOLOCK_PASSPHRASE;
const BIOLOCK_OVERRIDE_KEY = process.env.BIOLOCK_OVERRIDE_KEY;
const COMMAND_PREFIX = process.env.COMMAND_PREFIX || '!';

let bioLocked = BIOLOCK_ENABLED; // Bot starts in locked state if BIOLOCK is enabled

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to use OpenAI for chat responses
async function generateAIResponse(prompt: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are Noxhime, a helpful Discord bot with a friendly but slightly mischievous personality. You help users with information and assistance." },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
    });
    
    return completion.choices[0].message.content || "I don't have a response for that.";
  } catch (error) {
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
    
    // Basic API server with express could be added here in the future
    // Currently not implemented due to TypeScript configuration issues
  } catch (error) {
    console.error('Database initialization error:', error);
  }

  if (NOTIFY_CHANNEL_ID) {
    try {
      const auditChannel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
      if (auditChannel?.isTextBased()) {
        await (auditChannel as TextChannel).send('Onii-chan, I\'m back up now!');
        await logEvent('STARTUP', 'Bot successfully started and connected to Discord');
      } else {
        console.log('Channel is not text-based');
      }
    } catch (error) {
      console.error('Error sending startup message:', error);
    }
  } else {
    console.log('No notify channel ID configured');
  }

  console.log('Bot initialization complete');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content;
  const lowerContent = content.toLowerCase();
  const isTextChannel = message.channel.type === ChannelType.GuildText;

  // BioLock System
  if (BIOLOCK_ENABLED && bioLocked) {
    if (message.author.id === OWNER_ID) {
      if (content === BIOLOCK_PASSPHRASE || content === BIOLOCK_OVERRIDE_KEY) {
        bioLocked = false;
        await message.reply("BioLock disengaged. All systems online.");
        await logEvent('SECURITY', 'BioLock disengaged by owner');
        return;
      }
    }
    
    // If locked, only process biolock-related commands
    if (!content.startsWith(COMMAND_PREFIX)) return;
    
    const command = content.slice(COMMAND_PREFIX.length).split(' ')[0];
    if (command === 'status' && isTextChannel) {
      await message.channel.send('Bot is online but in BioLock mode. Only owner can unlock.');
    }
    return;
  }

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
        const isOwner = message.author.id === OWNER_ID;
        const reply = isOwner
          ? 'You are my creator. The architect behind my eyes.'
          : `You are ${message.author.username}, a visitor in this digital garden.`;
        await message.channel.send(reply);
        break;
        
      case 'cmds':
      case 'commands':
        const commands = [
          `\`${COMMAND_PREFIX}status\` – check if the bot is online`,
          `\`${COMMAND_PREFIX}whoami\` – discover your role`,
          `\`${COMMAND_PREFIX}cmds\` – list available commands`,
          `\`${COMMAND_PREFIX}ask <question>\` – ask me a question using AI`
        ];
        const ownerOnly = [
          `\`${COMMAND_PREFIX}restart\` – [OWNER ONLY] restart the bot`,
          `\`${COMMAND_PREFIX}lock\` – [OWNER ONLY] engage BioLock`
        ];

        await message.channel.send({
          content: `**Available Commands:**\n${commands.join('\n')}\n\n**Restricted Commands:**\n${ownerOnly.join('\n')}`,
        });
        break;
      
      case 'ask':
        const question = args.join(' ');
        if (!question) {
          await message.reply("Please ask a question after the command.");
          return;
        }
        
        await message.channel.sendTyping();
        const response = await generateAIResponse(question);
        await message.reply(response);
        await logEvent('AI_QUERY', `User ${message.author.username} asked: ${question}`);
        break;
        
      case 'restart':
        if (message.author.id === OWNER_ID) {
          const auditChannel = NOTIFY_CHANNEL_ID
            ? await client.channels.fetch(NOTIFY_CHANNEL_ID)
            : null;

          if (auditChannel?.isTextBased()) {
            await (auditChannel as TextChannel).send('Onii-chan, I\'m sleepy... 💤');
          }

          await message.channel.send('Restarting now. Please wait...');
          await logEvent('ADMIN', 'Owner initiated restart');
          process.exit(0);
        } else {
          await message.reply("You don't have permission to restart me.");
        }
        break;
        
      case 'lock':
        if (message.author.id === OWNER_ID && BIOLOCK_ENABLED) {
          bioLocked = true;
          await message.reply("BioLock engaged. Systems locked.");
          await logEvent('SECURITY', 'BioLock engaged by owner');
        } else if (!BIOLOCK_ENABLED) {
          await message.reply("BioLock system is not enabled.");
        } else {
          await message.reply("You don't have permission to use this command.");
        }
        break;
    }
  }
  
  // AI Chat - respond when mentioned
  if (message.mentions.has(client.user!.id) && isTextChannel) {
    // Extract the actual question by removing the mention
    const questionText = content.replace(new RegExp(`<@!?${client.user!.id}>`), '').trim();
    
    if (questionText) {
      await message.channel.sendTyping();
      const response = await generateAIResponse(questionText);
      await message.reply(response);
      await logEvent('AI_MENTION', `User ${message.author.username} mentioned bot and said: ${questionText}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
