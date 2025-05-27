import { Client, GatewayIntentBits, ChannelType, TextChannel } from 'discord.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const OWNER_ID = process.env.OWNER_ID!;
const AUDIT_LOG_CHANNEL_ID = process.env.AUDIT_LOG_CHANNEL || '';

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

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  if (AUDIT_LOG_CHANNEL_ID) {
    const auditChannel = await client.channels.fetch(AUDIT_LOG_CHANNEL_ID);
    if (auditChannel?.isTextBased()) {
      await (auditChannel as TextChannel).send('Onii-chan, I’m back up now!');
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const isTextChannel =
    message.channel.type === ChannelType.GuildText ||
    message.channel.type === ChannelType.DM;

  if (content === '!status' && isTextChannel) {
    await (message.channel as TextChannel).send('Bot is online and operational.');
  }

  if (['!whoami', '!who am i?', '!who am i'].includes(content) && isTextChannel) {
    const isOwner = message.author.id === OWNER_ID;
    const reply = isOwner
      ? 'You are my creator. The architect behind my eyes.'
      : `You are ${message.author.username}, a visitor in this digital garden.`;
    await (message.channel as TextChannel).send(reply);
  }

  if (['!cmds', '!commands'].includes(content) && isTextChannel) {
    const commands = [
      '`!status` – check if the bot is online',
      '`!whoami` – discover your role',
      '`!cmds` – list available commands',
    ];
    const ownerOnly = [
      '`!restart` – [OWNER ONLY] restart the bot',
    ];

    await (message.channel as TextChannel).send({
      content: `**Available Commands:**\n${commands.join('\n')}\n\n**Restricted Commands:**\n${ownerOnly.join('\n')}`,
    });
  }

  if (content === '!restart' && message.author.id === OWNER_ID) {
    const auditChannel = AUDIT_LOG_CHANNEL_ID
      ? await client.channels.fetch(AUDIT_LOG_CHANNEL_ID)
      : null;

    if (auditChannel?.isTextBased()) {
      await (auditChannel as TextChannel).send('Onii-chan, I’m sleepy... ????');
    }

    await (message.channel as TextChannel).send('Restarting now. Please wait...');
    process.exit(0);
  }
});

client.login(process.env.BOT_TOKEN);
