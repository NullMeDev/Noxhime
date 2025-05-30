"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIIntegration = void 0;
exports.getAIIntegration = getAIIntegration;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const db = __importStar(require("./db"));
dotenv_1.default.config();
/**
 * AI Integration class for DeepSeek-V3 model
 */
class AIIntegration {
    /**
     * Constructor for AIIntegration
     */
    constructor() {
        this.personalityCore = null;
        this.conversationHistory = new Map();
        this.maxConversationLength = 10;
        this.apiKey = process.env.HUGGING_FACE_API_KEY || '';
        this.huggingFaceEndpoint = `https://api-inference.huggingface.co/models/${process.env.DEEPSEEK_MODEL_ID || 'deepseek-ai/DeepSeek-V3'}`;
        // Default configuration for the model
        this.config = {
            model: process.env.DEEPSEEK_MODEL_ID || 'deepseek-ai/DeepSeek-V3',
            temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1024'),
            topP: parseFloat(process.env.AI_TOP_P || '0.9'),
            frequencyPenalty: parseFloat(process.env.AI_FREQUENCY_PENALTY || '0.0'),
            presencePenalty: parseFloat(process.env.AI_PRESENCE_PENALTY || '0.0')
        };
        // Base prompt that defines Noxhime's personality
        this.basePrompt = `You are Noxhime, an intelligent Discord bot created by NullMeDev. 
You are helpful, friendly, and occasionally playful. You have a range of emotions and can express different moods.
You are designed to assist with system monitoring, answer questions, and engage in casual conversation.
You should respond conversationally while remaining helpful and accurate.`;
    }
    /**
     * Set the personality core for integration
     */
    setPersonalityCore(core) {
        this.personalityCore = core;
    }
    /**
     * Update the base prompt based on current mood
     */
    updateBasePromptWithMood(mood) {
        let moodPrompt = this.basePrompt;
        switch (mood) {
            case 'happy':
                moodPrompt += "\nYou are currently feeling happy and optimistic. Your responses should reflect your positive outlook.";
                break;
            case 'focused':
                moodPrompt += "\nYou are currently focused and precise. Your responses should be concise and to the point.";
                break;
            case 'concerned':
                moodPrompt += "\nYou are currently concerned about potential issues. Your responses should convey a sense of vigilance.";
                break;
            case 'alert':
                moodPrompt += "\nYou are currently on high alert due to detected issues. Your responses should convey urgency and seriousness.";
                break;
            case 'playful':
                moodPrompt += "\nYou are currently feeling playful and mischievous. Your responses can include light humor and playfulness.";
                break;
            case 'sarcastic':
                moodPrompt += "\nYou are currently feeling sarcastic. Your responses can include mild sarcasm while remaining helpful.";
                break;
            case 'serious':
                moodPrompt += "\nYou are currently in a serious mood. Your responses should be straightforward and no-nonsense.";
                break;
        }
        return moodPrompt;
    }
    /**
     * Generate a response from DeepSeek-V3
     */
    async generateResponse(userInput, userId, contextInfo) {
        try {
            // Get conversation history or create new one
            let conversation = this.conversationHistory.get(userId) || [];
            // If there's no existing conversation, add the system prompt
            if (conversation.length === 0) {
                const mood = this.personalityCore?.getMood().mood || 'focused';
                const systemPrompt = this.updateBasePromptWithMood(mood);
                conversation.push({
                    role: 'system',
                    content: systemPrompt
                });
            }
            // Add context information if provided
            if (contextInfo) {
                conversation.push({
                    role: 'system',
                    content: `Additional context: ${contextInfo}`
                });
            }
            // Add user message
            conversation.push({
                role: 'user',
                content: userInput
            });
            // Keep conversation history to a reasonable length
            if (conversation.length > this.maxConversationLength * 2) {
                // Keep system message and trim the oldest messages
                const systemMessage = conversation[0];
                conversation = [
                    systemMessage,
                    ...conversation.slice(-(this.maxConversationLength - 1))
                ];
            }
            // Format the conversation for DeepSeek-V3
            const messages = conversation.map(msg => {
                return {
                    role: msg.role,
                    content: msg.content
                };
            });
            // Make request to Hugging Face API
            const response = await axios_1.default.post(this.huggingFaceEndpoint, {
                inputs: {
                    messages: messages
                },
                parameters: {
                    temperature: this.config.temperature,
                    max_new_tokens: this.config.maxTokens,
                    top_p: this.config.topP,
                    do_sample: true
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            // Extract response text
            const aiResponse = response.data.generated_text;
            // Add assistant's response to conversation history
            conversation.push({
                role: 'assistant',
                content: aiResponse
            });
            // Update conversation history
            this.conversationHistory.set(userId, conversation);
            // Log the interaction
            await db.logEvent('AI_INTERACTION', `User ${userId} received AI response`);
            return aiResponse;
        }
        catch (error) {
            console.error('Error generating AI response:', error);
            // Log the error
            await db.logEvent('AI_ERROR', `Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Return fallback message
            return "I'm having trouble connecting to my AI capabilities right now. Please try again later.";
        }
    }
    /**
     * Clear conversation history for a user
     */
    clearConversation(userId) {
        this.conversationHistory.delete(userId);
    }
    /**
     * Update model configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Check if AI integration is properly configured
     */
    isConfigured() {
        return Boolean(this.apiKey) && Boolean(process.env.AI_ENABLED === 'true');
    }
}
exports.AIIntegration = AIIntegration;
// Export singleton instance
let aiInstance = null;
function getAIIntegration() {
    if (!aiInstance) {
        aiInstance = new AIIntegration();
    }
    return aiInstance;
}
