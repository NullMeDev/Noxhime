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
exports.ApiServer = void 0;
exports.startApiServer = startApiServer;
// @ts-nocheck
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const sentinel_1 = require("./sentinel");
const personality_1 = require("./personality");
const db = __importStar(require("./db"));
const whitelist_1 = require("./whitelist");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * API module for web dashboard integration with nullme.lol
 */
class ApiServer {
    constructor(client, port = 3000, apiKeys = []) {
        this.statsInterval = null;
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.io = new socket_io_1.Server(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        this.port = port;
        this.apiKeys = apiKeys;
        this.client = client;
        // Generate JWT secret or use from environment
        this.jwtSecret = process.env.JWT_SECRET || crypto_1.default.randomBytes(64).toString('hex');
        // Store for active one-time tokens
        this.activeTokens = new Map();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();
    }
    /**
     * Configure middleware
     */
    setupMiddleware() {
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json());
        // Serve static files from web/public directory
        this.app.use(express_1.default.static(path_1.default.join(process.cwd(), 'web', 'public')));
        // Load and apply whitelist configuration if enabled
        const whitelistEnabled = process.env.WHITELIST_ENABLED === 'true';
        // Apply whitelist middleware (IP/Port filtering only)
        if (whitelistEnabled) {
            const whitelistConfigPath = process.env.WHITELIST_CONFIG_PATH || './config/whitelist.json';
            const whitelistConfig = (0, whitelist_1.loadWhitelistConfig)(whitelistConfigPath);
            // Apply whitelist middleware for IP/Port filtering
            this.app.use((0, whitelist_1.whitelistMiddleware)(whitelistConfig));
            console.log('IP/Port whitelist protection enabled');
        }
        // Note: API key authentication removed - API is now open for all users
        console.log('API authentication disabled - open access enabled');
    }
    /**
     * Set up API routes
     */
    /**
     * Set up Socket.IO with authentication and event handlers
     */
    setupSocketIO() {
        // Authentication middleware for Socket.IO
        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication token required'));
            }
            try {
                const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
                // Store discord ID in socket for later use
                socket.discordId = decoded.discordId;
                next();
            }
            catch (error) {
                next(new Error('Invalid authentication token'));
            }
        });
        // Connection handling
        this.io.on('connection', (socket) => {
            const discordId = socket.discordId;
            console.log(`Socket connected for user: ${discordId}`);
            // Join a room specific to this user
            socket.join(`user:${discordId}`);
            // Send initial data
            this.sendSystemStatus(socket);
            this.sendBotStatus(socket);
            this.sendMoodStatus(socket);
            // Handle client events
            socket.on('requestLogs', async (limit) => {
                try {
                    const logs = await db.getRecentEvents(limit || 20);
                    socket.emit('logs', logs);
                }
                catch (error) {
                    console.error('Error sending logs via socket:', error);
                }
            });
            socket.on('requestIncidents', async (limit) => {
                try {
                    const incidents = await db.getRecentIncidents(limit || 10);
                    socket.emit('incidents', incidents);
                }
                catch (error) {
                    console.error('Error sending incidents via socket:', error);
                }
            });
            // Handle command triggers
            socket.on('triggerCommand', async (command) => {
                try {
                    // Authorization is now handled via JWT only (BioLock removed)
                    switch (command) {
                        case 'restart':
                            await db.logEvent('API', `Bot restart triggered by user ${discordId} via web dashboard`);
                            socket.emit('commandResult', { success: true, message: 'Bot restart initiated' });
                            setTimeout(() => process.exit(0), 1000);
                            break;
                        case 'heal':
                            // Implementation depends on self-healing code
                            socket.emit('commandResult', { success: true, message: 'Self-healing process initiated' });
                            await db.logEvent('API', `Self-healing triggered by user ${discordId} via web dashboard`);
                            break;
                        case 'backup':
                            this.triggerBackup(socket);
                            break;
                        case 'sentinel:start':
                            // Implementation depends on sentinel code
                            socket.emit('commandResult', { success: true, message: 'Sentinel monitoring started' });
                            await db.logEvent('API', `Sentinel started by user ${discordId} via web dashboard`);
                            break;
                        case 'sentinel:stop':
                            // Implementation depends on sentinel code
                            socket.emit('commandResult', { success: true, message: 'Sentinel monitoring stopped' });
                            await db.logEvent('API', `Sentinel stopped by user ${discordId} via web dashboard`);
                            break;
                        default:
                            socket.emit('commandResult', { success: false, message: 'Unknown command' });
                    }
                }
                catch (error) {
                    console.error('Error handling command via socket:', error);
                    socket.emit('commandResult', { success: false, message: 'Error processing command' });
                }
            });
            // Disconnect handling
            socket.on('disconnect', () => {
                console.log(`Socket disconnected for user: ${discordId}`);
            });
        });
        // Start sending periodic updates
        this.startPeriodicUpdates();
    }
    /**
     * Send system status to a specific socket or all connected clients
     */
    async sendSystemStatus(socket) {
        try {
            const sentinel = (0, sentinel_1.getSentinel)(this.client, '');
            const stats = await sentinel.getSystemStats();
            const services = await sentinel.getServicesStatus();
            const data = {
                cpuUsage: stats.cpuUsage,
                memoryUsage: stats.memoryUsage,
                diskUsage: stats.diskUsage,
                uptime: stats.uptime,
                services: services
            };
            if (socket) {
                socket.emit('systemStatus', data);
            }
            else {
                this.io.emit('systemStatus', data);
            }
        }
        catch (error) {
            console.error('Error sending system status:', error);
        }
    }
    /**
     * Send bot status to a specific socket or all connected clients
     */
    sendBotStatus(socket) {
        try {
            const status = {
                status: 'online',
                uptime: process.uptime(),
                guilds: this.client.guilds.cache.size,
                lastRestart: new Date(Date.now() - process.uptime() * 1000).toISOString(),
                version: '4.0.0'
            };
            if (socket) {
                socket.emit('botStatus', status);
            }
            else {
                this.io.emit('botStatus', status);
            }
        }
        catch (error) {
            console.error('Error sending bot status:', error);
        }
    }
    /**
     * Send mood status to a specific socket or all connected clients
     */
    async sendMoodStatus(socket) {
        try {
            const personality = (0, personality_1.getPersonalityCore)();
            const mood = personality.getMood();
            const currentMood = await db.getCurrentMood();
            const data = {
                current: mood,
                history: currentMood ? [currentMood] : [],
                since: currentMood ? currentMood.started_at : null
            };
            if (socket) {
                socket.emit('moodStatus', data);
            }
            else {
                this.io.emit('moodStatus', data);
            }
        }
        catch (error) {
            console.error('Error sending mood status:', error);
        }
    }
    /**
     * Start sending periodic updates to all connected clients
     */
    startPeriodicUpdates() {
        // Clear any existing interval
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        // Send updates every 10 seconds
        this.statsInterval = setInterval(() => {
            this.sendSystemStatus();
            this.sendBotStatus();
            this.sendMoodStatus();
        }, 10000);
    }
    /**
     * Trigger a backup operation via socket
     */
    triggerBackup(socket) {
        try {
            const scriptPath = path_1.default.join(process.cwd(), 'scripts', 'backup.sh');
            if (!fs_1.default.existsSync(scriptPath)) {
                socket.emit('commandResult', { success: false, message: 'Backup script not found' });
                return;
            }
            (0, child_process_1.exec)(scriptPath, async (error, stdout, stderr) => {
                if (error) {
                    console.error(`Backup error: ${error}`);
                    socket.emit('commandResult', { success: false, message: `Backup failed: ${error.message}` });
                    return;
                }
                const discordId = socket.discordId;
                await db.logEvent('API', `Manual backup triggered by user ${discordId} via web dashboard`);
                socket.emit('commandResult', { success: true, message: 'Backup completed successfully' });
            });
        }
        catch (error) {
            console.error('Error triggering backup:', error);
            socket.emit('commandResult', { success: false, message: 'Error initiating backup' });
        }
    }
    /**
     * Generate a JWT token for user authentication
     */
    generateToken(discordId, expiresIn = '30m') {
        return jsonwebtoken_1.default.sign({ discordId }, this.jwtSecret, { expiresIn });
    }
    /**
     * Generate a one-time token and store it for authentication
     */
    generateOneTimeToken(discordId) {
        // Create a random token
        const token = crypto_1.default.randomBytes(32).toString('hex');
        // Store with expiration (30 minutes)
        const expires = Date.now() + (30 * 60 * 1000);
        this.activeTokens.set(token, { discordId, expires });
        // Clean up expired tokens periodically
        this.cleanupExpiredTokens();
        return token;
    }
    /**
     * Remove expired one-time tokens
     */
    cleanupExpiredTokens() {
        const now = Date.now();
        for (const [token, data] of this.activeTokens.entries()) {
            if (data.expires < now) {
                this.activeTokens.delete(token);
            }
        }
    }
    /**
     * Set up API routes
     */
    setupRoutes() {
        // Serve the main dashboard page
        this.app.get('/', (req, res) => {
            res.sendFile(path_1.default.join(process.cwd(), 'web', 'public', 'index.html'));
        });
        // Authentication endpoints
        this.app.post('/api/auth/verify-token', (req, res) => {
            try {
                const { token } = req.body;
                if (!token) {
                    return res.status(400).json({ error: 'Token is required' });
                }
                // Check if this is a valid one-time token
                const tokenData = this.activeTokens.get(token);
                if (!tokenData) {
                    return res.status(401).json({ error: 'Invalid or expired token' });
                }
                // Token is valid, remove it (one-time use)
                this.activeTokens.delete(token);
                // Generate a JWT for the session
                const jwt = this.generateToken(tokenData.discordId);
                // Return the JWT
                res.json({ token: jwt, discordId: tokenData.discordId });
            }
            catch (error) {
                console.error('Error verifying token:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        // Discord link command handler (called from Discord bot)
        this.app.post('/api/auth/create-link', (req, res) => {
            try {
                const { discordId, apiKey } = req.body;
                // Validate API key (secret key shared between bot and API)
                if (!this.apiKeys.includes(apiKey)) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
                if (!discordId) {
                    return res.status(400).json({ error: 'Discord ID is required' });
                }
                // Generate a one-time token
                const token = this.generateOneTimeToken(discordId);
                // Return the token to be sent to user via DM
                res.json({ token });
            }
            catch (error) {
                console.error('Error creating link token:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        // Public status endpoint (no auth required)
        this.app.get('/api/status/public', (req, res) => {
            res.json({
                status: 'online',
                name: this.client.user?.username || 'Noxhime',
                version: '4.0.0',
                uptime: process.uptime()
            });
        });
        // Bot status endpoint
        this.app.get('/api/status', (req, res) => {
            try {
                const stats = {
                    status: 'online',
                    uptime: process.uptime(),
                    guilds: this.client.guilds.cache.size,
                    lastRestart: new Date(Date.now() - process.uptime() * 1000).toISOString(),
                    version: '4.0.0'
                };
                res.json(stats);
            }
            catch (error) {
                console.error('API error:', error);
                return res.status(500).json({ error: 'Internal server error' });
            }
        });
        // Sentinel incidents endpoint
        this.app.get('/api/incidents', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit || '10');
                const incidents = await db.getRecentIncidents(limit);
                res.json(incidents);
            }
            catch (error) {
                console.error('API error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        // Service status endpoint
        this.app.get('/api/services', async (req, res) => {
            try {
                const sentinel = (0, sentinel_1.getSentinel)(this.client, '');
                const services = await sentinel.getServicesStatus();
                res.json(services);
            }
            catch (error) {
                console.error('API error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        // Personality/mood endpoint
        this.app.get('/api/mood', async (req, res) => {
            try {
                const personality = (0, personality_1.getPersonalityCore)();
                const mood = personality.getMood();
                const currentMood = await db.getCurrentMood();
                res.json({
                    current: mood,
                    history: currentMood ? [currentMood] : [],
                    since: currentMood ? currentMood.started_at : null
                });
            }
            catch (error) {
                console.error('API error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        // Stats and logs endpoint
        this.app.get('/api/logs', async (req, res) => {
            try {
                const type = req.query.type || 'all';
                const limit = parseInt(req.query.limit || '20');
                let query = 'SELECT * FROM events';
                const params = [];
                if (type !== 'all') {
                    query += ' WHERE type = ?';
                    params.push(type.toUpperCase());
                }
                query += ' ORDER BY timestamp DESC LIMIT ?';
                params.push(limit);
                const logs = await db.getRecentEvents(limit);
                res.json(logs);
            }
            catch (error) {
                console.error('API error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        // Trigger manual backup endpoint
        this.app.post('/api/backup', (req, res) => {
            try {
                const scriptPath = path_1.default.join(process.cwd(), 'scripts', 'backup.sh');
                if (!fs_1.default.existsSync(scriptPath)) {
                    res.status(404).json({ error: 'Backup script not found' });
                    return;
                }
                (0, child_process_1.exec)(scriptPath, async (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Backup error: ${error}`);
                        res.status(500).json({ error: error.message, stderr });
                        return;
                    }
                    await db.logEvent('API', 'Manual backup triggered via API');
                    res.json({ success: true, message: 'Backup initiated' });
                });
            }
            catch (error) {
                console.error('API error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    }
    /**
     * Start the API server
     */
    /**
     * Start the API server with Socket.IO
     */
    start() {
        this.server.listen(this.port, () => {
            console.log(`API server with Socket.IO listening on port ${this.port}`);
            db.logEvent('API', `API server with Socket.IO started on port ${this.port}`);
        });
    }
    /**
     * Stop the API server and cleanup resources
     */
    stop() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
        this.server.close();
        console.log('API server stopped');
    }
}
exports.ApiServer = ApiServer;
// Export singleton factory function
let apiInstance = null;
function startApiServer(client, port = 3000, apiKeys = []) {
    if (!apiInstance) {
        apiInstance = new ApiServer(client, port, apiKeys);
        apiInstance.start();
    }
    return apiInstance;
}
