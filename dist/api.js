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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
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
        this.app = (0, express_1.default)();
        this.port = port;
        this.apiKeys = apiKeys;
        this.client = client;
        this.setupMiddleware();
        this.setupRoutes();
    }
    /**
     * Configure middleware
     */
    setupMiddleware() {
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json());
        // Load and apply whitelist configuration if enabled
        const whitelistEnabled = process.env.WHITELIST_ENABLED === 'true';
        // Apply whitelist middleware before API key authentication
        if (whitelistEnabled) {
            const whitelistConfigPath = process.env.WHITELIST_CONFIG_PATH || './config/whitelist.json';
            const whitelistConfig = (0, whitelist_1.loadWhitelistConfig)(whitelistConfigPath);
            // Apply whitelist middleware before API key authentication
            this.app.use((0, whitelist_1.whitelistMiddleware)(whitelistConfig));
            console.log('IP/Port whitelist protection enabled');
        }
        // API key authentication middleware
        this.app.use('/api', (req, res, next) => {
            const apiKey = req.headers['x-api-key'];
            // Skip auth if no API keys configured or for status endpoint
            if (this.apiKeys.length === 0 || req.path === '/api/status/public') {
                next();
                return;
            }
            if (!apiKey || !this.apiKeys.includes(apiKey)) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            next();
        });
    }
    /**
     * Set up API routes
     */
    setupRoutes() {
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
                res.status(500).json({ error: 'Internal server error' });
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
    start() {
        this.app.listen(this.port, () => {
            console.log(`API server listening on port ${this.port}`);
            db.logEvent('API', `API server started on port ${this.port}`);
        });
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
