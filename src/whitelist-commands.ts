import { Message } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { 
  loadWhitelistConfig, 
  saveWhitelistConfig, 
  addIpToWhitelist, 
  removeIpFromWhitelist, 
  addPortToWhitelist, 
  removePortFromWhitelist 
} from './whitelist';

const OWNER_ID = process.env.OWNER_ID;
const WHITELIST_CONFIG_PATH = process.env.WHITELIST_CONFIG_PATH || './config/whitelist.json';

/**
 * Handler for whitelist-related commands
 * @param message Discord message object
 * @param args Command arguments
 * @returns True if the command was handled, false otherwise
 */
export async function handleWhitelistCommands(message: Message, args: string[]): Promise<boolean> {
  // Check if the user is the bot owner
  if (message.author.id !== OWNER_ID) {
    await message.reply('⚠️ You do not have permission to use whitelist commands.');
    return true;
  }

  if (!args || args.length < 1) {
    await message.reply('⚠️ Invalid whitelist command. Use `!whitelist help` for usage information.');
    return true;
  }

  const subCommand = args[0].toLowerCase();

  try {
    // Load the current whitelist configuration
    const config = loadWhitelistConfig(WHITELIST_CONFIG_PATH);

    switch (subCommand) {
      case 'help':
        await message.reply(`**Whitelist Commands:**
▸ \`!whitelist status\` - Show current whitelist status
▸ \`!whitelist enable ip\` - Enable IP whitelisting
▸ \`!whitelist disable ip\` - Disable IP whitelisting
▸ \`!whitelist enable port\` - Enable port whitelisting
▸ \`!whitelist disable port\` - Disable port whitelisting
▸ \`!whitelist add ip <address>\` - Add an IP address to the whitelist
▸ \`!whitelist remove ip <address>\` - Remove an IP address from the whitelist
▸ \`!whitelist add port <number>\` - Add a port to the whitelist
▸ \`!whitelist remove port <number>\` - Remove a port from the whitelist
▸ \`!whitelist list\` - List all whitelisted IPs and ports`);
        return true;

      case 'status':
        await message.reply(`**Whitelist Status:**
▸ IP Whitelisting: ${config.ipWhitelist.enabled ? '✅ Enabled' : '❌ Disabled'}
▸ Whitelisted IPs: ${config.ipWhitelist.addresses.length > 0 ? config.ipWhitelist.addresses.join(', ') : 'None'}
▸ Port Whitelisting: ${config.portWhitelist.enabled ? '✅ Enabled' : '❌ Disabled'}
▸ Whitelisted Ports: ${config.portWhitelist.ports.length > 0 ? config.portWhitelist.ports.join(', ') : 'None'}`);
        return true;

      case 'enable':
        if (args.length < 2) {
          await message.reply('⚠️ Please specify what to enable: `ip` or `port`');
          return true;
        }

        if (args[1] === 'ip') {
          config.ipWhitelist.enabled = true;
          saveWhitelistConfig(config, WHITELIST_CONFIG_PATH);
          await message.reply('✅ IP whitelisting has been enabled.');
        } else if (args[1] === 'port') {
          config.portWhitelist.enabled = true;
          saveWhitelistConfig(config, WHITELIST_CONFIG_PATH);
          await message.reply('✅ Port whitelisting has been enabled.');
        } else {
          await message.reply('⚠️ Invalid option. Use `ip` or `port`.');
        }
        return true;

      case 'disable':
        if (args.length < 2) {
          await message.reply('⚠️ Please specify what to disable: `ip` or `port`');
          return true;
        }

        if (args[1] === 'ip') {
          config.ipWhitelist.enabled = false;
          saveWhitelistConfig(config, WHITELIST_CONFIG_PATH);
          await message.reply('✅ IP whitelisting has been disabled.');
        } else if (args[1] === 'port') {
          config.portWhitelist.enabled = false;
          saveWhitelistConfig(config, WHITELIST_CONFIG_PATH);
          await message.reply('✅ Port whitelisting has been disabled.');
        } else {
          await message.reply('⚠️ Invalid option. Use `ip` or `port`.');
        }
        return true;

      case 'add':
        if (args.length < 3) {
          await message.reply('⚠️ Please specify what to add and the value: `ip <address>` or `port <number>`');
          return true;
        }

        if (args[1] === 'ip') {
          const ip = args[2];
          addIpToWhitelist(ip, config);
          saveWhitelistConfig(config, WHITELIST_CONFIG_PATH);
          await message.reply(`✅ Added IP \`${ip}\` to the whitelist.`);
        } else if (args[1] === 'port') {
          const port = parseInt(args[2]);
          if (isNaN(port) || port < 1 || port > 65535) {
            await message.reply('⚠️ Invalid port number. Must be between 1 and 65535.');
            return true;
          }
          addPortToWhitelist(port, config);
          saveWhitelistConfig(config, WHITELIST_CONFIG_PATH);
          await message.reply(`✅ Added port \`${port}\` to the whitelist.`);
        } else {
          await message.reply('⚠️ Invalid option. Use `ip` or `port`.');
        }
        return true;

      case 'remove':
        if (args.length < 3) {
          await message.reply('⚠️ Please specify what to remove and the value: `ip <address>` or `port <number>`');
          return true;
        }

        if (args[1] === 'ip') {
          const ip = args[2];
          if (!config.ipWhitelist.addresses.includes(ip)) {
            await message.reply(`⚠️ IP \`${ip}\` is not in the whitelist.`);
            return true;
          }
          removeIpFromWhitelist(ip, config);
          saveWhitelistConfig(config, WHITELIST_CONFIG_PATH);
          await message.reply(`✅ Removed IP \`${ip}\` from the whitelist.`);
        } else if (args[1] === 'port') {
          const port = parseInt(args[2]);
          if (isNaN(port)) {
            await message.reply('⚠️ Invalid port number.');
            return true;
          }
          if (!config.portWhitelist.ports.includes(port)) {
            await message.reply(`⚠️ Port \`${port}\` is not in the whitelist.`);
            return true;
          }
          removePortFromWhitelist(port, config);
          saveWhitelistConfig(config, WHITELIST_CONFIG_PATH);
          await message.reply(`✅ Removed port \`${port}\` from the whitelist.`);
        } else {
          await message.reply('⚠️ Invalid option. Use `ip` or `port`.');
        }
        return true;

      case 'list':
        if (config.ipWhitelist.addresses.length === 0 && config.portWhitelist.ports.length === 0) {
          await message.reply('No IPs or ports are currently whitelisted.');
          return true;
        }

        let replyContent = '**Whitelist Entries:**\n';
        
        if (config.ipWhitelist.addresses.length > 0) {
          replyContent += '**IPs:**\n';
          config.ipWhitelist.addresses.forEach((ip, index) => {
            replyContent += `${index + 1}. \`${ip}\`\n`;
          });
        }

        if (config.portWhitelist.ports.length > 0) {
          replyContent += '**Ports:**\n';
          config.portWhitelist.ports.forEach((port, index) => {
            replyContent += `${index + 1}. \`${port}\`\n`;
          });
        }

        await message.reply(replyContent);
        return true;

      default:
        await message.reply('⚠️ Unknown whitelist command. Use `!whitelist help` for usage information.');
        return true;
    }
  } catch (error) {
    console.error('Error handling whitelist command:', error);
    await message.reply('⚠️ An error occurred while processing the whitelist command.');
    return true;
  }
}
