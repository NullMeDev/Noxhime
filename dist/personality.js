"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalityCore = exports.EventType = void 0;
exports.getPersonalityCore = getPersonalityCore;
const discord_js_1 = require("discord.js");
// Use require instead of import for db to avoid circular dependencies
const db = require('./db');
const { getCurrentMood, setMood } = db;
// Event types that can trigger mood changes
var EventType;
(function (EventType) {
    EventType["SYSTEM_ERROR"] = "system_error";
    EventType["SECURITY_THREAT"] = "security_threat";
    EventType["SUCCESSFUL_OPERATION"] = "successful_operation";
    EventType["USER_INTERACTION"] = "user_interaction";
    EventType["IDLE_TIME"] = "idle_time";
    EventType["RESOURCE_PRESSURE"] = "resource_pressure";
})(EventType || (exports.EventType = EventType = {}));
/**
 * Class for managing the bot's evolving personality
 */
class PersonalityCore {
    constructor() {
        this.settings = {
            defaultMood: 'focused',
            responsiveness: 7,
            verbosity: 5,
            useSarcasm: true,
            useEmojis: true,
        };
        this.currentMood = this.settings.defaultMood;
        this.moodIntensity = 5;
        this.lastInteraction = Date.now();
    }
    /**
     * Initialize the personality core and load current mood
     */
    async initialize() {
        try {
            // Load current mood from DB if exists
            const moodData = await getCurrentMood();
            if (moodData) {
                this.currentMood = moodData.mood;
                this.moodIntensity = moodData.intensity;
            }
            else {
                // Set default mood
                await this.changeMood(this.settings.defaultMood, 'initialization', 5);
            }
        }
        catch (error) {
            console.error('Error initializing personality core:', error);
        }
    }
    /**
     * Change the bot's mood based on an event
     */
    async changeMood(mood, triggerEvent, intensity) {
        try {
            this.currentMood = mood;
            this.moodIntensity = intensity;
            // Save to database
            await setMood(mood, triggerEvent, intensity);
            return true;
        }
        catch (error) {
            console.error('Error changing mood:', error);
            return false;
        }
    }
    /**
     * Process an event that might affect the bot's mood
     */
    async processEvent(eventType, intensity) {
        switch (eventType) {
            case EventType.SYSTEM_ERROR:
                if (intensity > 7) {
                    await this.changeMood('concerned', eventType, intensity);
                }
                else if (intensity > 4) {
                    await this.changeMood('focused', eventType, intensity);
                }
                break;
            case EventType.SECURITY_THREAT:
                if (intensity > 8) {
                    await this.changeMood('alert', eventType, intensity);
                }
                else {
                    await this.changeMood('concerned', eventType, intensity);
                }
                break;
            case EventType.SUCCESSFUL_OPERATION:
                await this.changeMood('happy', eventType, intensity);
                break;
            case EventType.USER_INTERACTION:
                this.lastInteraction = Date.now();
                if (this.currentMood === 'alert' || this.currentMood === 'concerned') {
                    // Don't change mood during concerning situations
                    return;
                }
                if (Math.random() > 0.7) {
                    await this.changeMood('playful', eventType, Math.floor(Math.random() * 5) + 5);
                }
                else {
                    await this.changeMood('happy', eventType, Math.floor(Math.random() * 3) + 6);
                }
                break;
            case EventType.IDLE_TIME:
                const hoursSinceInteraction = (Date.now() - this.lastInteraction) / (1000 * 60 * 60);
                if (hoursSinceInteraction > 12) {
                    await this.changeMood('playful', eventType, 8); // Getting bored and playful
                }
                break;
            case EventType.RESOURCE_PRESSURE:
                if (intensity > 7) {
                    await this.changeMood('concerned', eventType, intensity);
                }
                else if (intensity > 4) {
                    await this.changeMood('focused', eventType, intensity);
                }
                break;
        }
    }
    /**
     * Style message based on current mood
     */
    async styleMessage(message) {
        let styledMessage = message;
        switch (this.currentMood) {
            case 'happy':
                styledMessage = this.settings.useEmojis ? `${message} 😊` : message;
                break;
            case 'playful':
                styledMessage = this.settings.useEmojis ? `${message} 😏` : message;
                if (this.settings.useSarcasm && Math.random() > 0.7) {
                    styledMessage = this.addPlayfulTone(styledMessage);
                }
                break;
            case 'concerned':
                styledMessage = this.settings.useEmojis ? `${message} 😟` : message;
                break;
            case 'alert':
                styledMessage = this.settings.useEmojis ? `⚠️ ${message}` : message;
                break;
            case 'sarcastic':
                styledMessage = this.addSarcasm(styledMessage);
                break;
            case 'serious':
                styledMessage = this.settings.useEmojis ? `${message} 🧐` : message;
                break;
        }
        return styledMessage;
    }
    /**
     * Create embed styled according to current mood
     */
    createStyledEmbed(title, description) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(this.getMoodColor())
            .setTimestamp();
        // Add mood-specific footer
        embed.setFooter({
            text: `Noxhime is feeling ${this.currentMood} • Made with 💜 by NullMeDev`
        });
        return embed;
    }
    /**
     * Get embed color based on current mood
     */
    getMoodColor() {
        switch (this.currentMood) {
            case 'happy':
                return 0x47D14F; // Green
            case 'focused':
                return 0x3498DB; // Blue
            case 'concerned':
                return 0xF39C12; // Orange
            case 'alert':
                return 0xE74C3C; // Red
            case 'playful':
                return 0x9B59B6; // Purple
            case 'sarcastic':
                return 0xF1C40F; // Yellow
            case 'serious':
                return 0x34495E; // Dark Blue
            default:
                return 0x7289DA; // Discord Blurple
        }
    }
    /**
     * Add playful tone to message
     */
    addPlayfulTone(message) {
        const playfulPhrases = [
            "Psst... ",
            "Guess what? ",
            "Hey, guess what I found? ",
            "Well, well, well... ",
            "*whispers* "
        ];
        const randomIndex = Math.floor(Math.random() * playfulPhrases.length);
        return playfulPhrases[randomIndex] + message;
    }
    /**
     * Add sarcasm to message
     */
    addSarcasm(message) {
        const sarcasticPhrases = [
            "Oh great, ",
            "Wow, really? ",
            "Amazing. ",
            "Oh joy, ",
            "Suuuure, "
        ];
        const randomIndex = Math.floor(Math.random() * sarcasticPhrases.length);
        return sarcasticPhrases[randomIndex] + message;
    }
    /**
     * Generate an emotional response based on event
     */
    generateEmotionalResponse(eventType, severity) {
        const responses = {
            error: [
                "I sense something is wrong...",
                "This doesn't look right to me.",
                "We might have a problem here.",
                "I'm concerned about what I'm seeing.",
                "Something's definitely off here."
            ],
            security: [
                "My defenses have been triggered!",
                "I've detected a potential security threat.",
                "Someone's trying to access what they shouldn't.",
                "I'm detecting suspicious activity.",
                "Security alert - something unusual is happening."
            ],
            success: [
                "Everything is running smoothly!",
                "All systems operational and happy.",
                "I'm feeling great about this outcome!",
                "Success! Just as planned.",
                "Mission accomplished!"
            ],
            neutral: [
                "Just checking in.",
                "Everything seems normal.",
                "Status update: all good.",
                "Nothing unusual to report.",
                "Systems nominal."
            ]
        };
        let category;
        if (eventType.includes('error') || eventType.includes('fail')) {
            category = 'error';
        }
        else if (eventType.includes('security') || eventType.includes('intrusion')) {
            category = 'security';
        }
        else if (eventType.includes('success') || eventType.includes('complete')) {
            category = 'success';
        }
        else {
            category = 'neutral';
        }
        const options = responses[category];
        const index = Math.min(Math.floor(severity / 2), options.length - 1);
        return options[index];
    }
    /**
     * Get the current personality settings
     */
    getSettings() {
        return { ...this.settings };
    }
    /**
     * Update personality settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }
    /**
     * Get current mood
     */
    getMood() {
        return {
            mood: this.currentMood,
            intensity: this.moodIntensity
        };
    }
}
exports.PersonalityCore = PersonalityCore;
// Export singleton instance
let personalityInstance = null;
function getPersonalityCore() {
    if (!personalityInstance) {
        personalityInstance = new PersonalityCore();
    }
    return personalityInstance;
}
