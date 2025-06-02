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
        this.jwtSecret = process.env.JWT_SECRET || crypto_1.default.randomBytes(64).toString('hex');
        this.activeTokens = new Map();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();
    }
    start(retryCount = 3) {
        const tryPort = (attempt) => {
            if (attempt >= retryCount) {
                console.error(`Failed to start API server after ${retryCount} attempts`);
                return;
            }
            const currentPort = this.port + attempt;
            this.server.listen(currentPort)
                .on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.log(`Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
                    tryPort(attempt + 1);
                }
                else {
                    console.error('Error starting API server:', error);
                }
            })
                .on('listening', () => {
                this.port = currentPort;
                console.log(`API server with Socket.IO listening on port ${currentPort}`);
                db.logEvent('API', `API server with Socket.IO started on port ${currentPort}`);
            });
        };
        tryPort(0);
    }
    stop() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
        this.server.close();
        console.log('API server stopped');
    }
    setupMiddleware() {
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.static(path_1.default.join(process.cwd(), 'web', 'public')));
        const whitelistEnabled = process.env.WHITELIST_ENABLED === 'true';
        if (whitelistEnabled) {
            const whitelistConfigPath = process.env.WHITELIST_CONFIG_PATH || './config/whitelist.json';
            const whitelistConfig = (0, whitelist_1.loadWhitelistConfig)(whitelistConfigPath);
            this.app.use((0, whitelist_1.whitelistMiddleware)(whitelistConfig));
            console.log('IP/Port whitelist protection enabled');
        }
        console.log('API authentication disabled - open access enabled');
    }
    setupSocketIO() {
        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication token required'));
            }
            try {
                const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
                socket.discordId = decoded.discordId;
                next();
            }
            catch (error) {
                next(new Error('Invalid authentication token'));
            }
        });
        this.io.on('connection', this.handleSocketConnection.bind(this));
        this.startPeriodicUpdates();
    }
    handleSocketConnection(socket) {
        const discordId = socket.discordId;
        console.log(`Socket connected for user: ${discordId}`);
        socket.join(`user:${discordId}`);
        this.sendSystemStatus(socket);
        this.sendBotStatus(socket);
        this.sendMoodStatus(socket);
        socket.on('disconnect', () => {
            console.log(`Socket disconnected for user: ${discordId}`);
        });
    }
    startPeriodicUpdates() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        this.statsInterval = setInterval(() => {
            this.sendSystemStatus();
            this.sendBotStatus();
            this.sendMoodStatus();
        }, 10000);
    }
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
    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path_1.default.join(process.cwd(), 'web', 'public', 'index.html'));
        });
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'online',
                uptime: process.uptime(),
                port: this.port
            });
        });
    }
}
exports.ApiServer = ApiServer;
let apiInstance = null;
function startApiServer(client, port = 3000, apiKeys = []) {
    if (!apiInstance) {
        apiInstance = new ApiServer(client, port, apiKeys);
        apiInstance.start();
    }
    return apiInstance;
}
