import { Channel, TextChannel } from 'discord.js';

export function isAllowedChannel(channel: Channel): boolean {
    // Channel ID for Noxhime
    const ALLOWED_CHANNEL_ID = '1376252561648259082';
    // Channel name for Noxhime (Japanese name)
    const ALLOWED_CHANNEL_NAME = 'ノクシメ-nokushime';

    // Check if it's a text channel
    if (channel instanceof TextChannel) {
        // Check both channel ID and name
        return channel.id === ALLOWED_CHANNEL_ID || 
               channel.name.toLowerCase() === ALLOWED_CHANNEL_NAME.toLowerCase();
    }
    return false;
}
