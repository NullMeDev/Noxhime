import express from 'express';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getSentinel } from './sentinel';
import { getPersonalityCore } from './personality';
import * as db from './db';
import { loadWhitelistConfig, whitelistMiddleware } from './whitelist';
import dotenv from 'dotenv';

dotenv.config();

/**
 * API module for web dashboard integration with nullme.lol
 */
export class ApiServer {
  private app: express.Application;
  private server: any;
  private io: Server;
  private port: number;
  private apiKeys: string[];
  private client: any;
  private jwtSecret: string;
  private activeTokens: Map<string, { discordId: string, expires: number }>;
  private statsInterval: NodeJS.Timeout | null = null;
  
  constructor(client: any, port: number = 3000, apiKeys: string[] = []) {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.port = port;
    this.apiKeys = apiKeys;
    this.client = client;
    
    // Generate JWT secret or use from environment
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    
    // Store for active one-time tokens
    this.activeTokens = new Map();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }
  
  /**
   * Configure middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Serve static files from web/public directory
    this.app.use(express.static(path.join(process.cwd(), 'web', 'public')));
    
    // Load and apply whitelist configuration if enabled
    const whitelistEnabled = process.env.WHITELIST_ENABLED === 'true';
    
    // Apply whitelist middleware (IP/Port filtering only)
    if (whitelistEnabled) {
      const whitelistConfigPath = process.env.WHITELIST_CONFIG_PATH || './config/whitelist.json';
      const whitelistConfig = loadWhitelistConfig(whitelistConfigPath);
      
      // Apply whitelist middleware for IP/Port filtering
      this.app.use(whitelistMiddleware(whitelistConfig) as express.RequestHandler);
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
  private setupSocketIO(): void {
    // Authentication middleware for Socket.IO
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as { discordId: string };
        
        // Store discord ID in socket for later use
        (socket as any).discordId = decoded.discordId;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
    
    // Connection handling
    this.io.on('connection', (socket: Socket) => {
      const discordId = (socket as any).discordId;
      console.log(`Socket connected for user: ${discordId}`);
      
      // Join a room specific to this user
      socket.join(`user:${discordId}`);
      
      // Send initial data
      this.sendSystemStatus(socket);
      this.sendBotStatus(socket);
      this.sendMoodStatus(socket);
      
      // Handle client events
      socket.on('requestLogs', async (limit: number) => {
        try {
          const logs = await db.getRecentEvents(limit || 20);
          socket.emit('logs', logs);
        } catch (error) {
          console.error('Error sending logs via socket:', error);
        }
      });
      
      socket.on('requestIncidents', async (limit: number) => {
        try {
          const incidents = await db.getRecentIncidents(limit || 10);
          socket.emit('incidents', incidents);
        } catch (error) {
          console.error('Error sending incidents via socket:', error);
        }
      });
      
      // Handle command triggers
      socket.on('triggerCommand', async (command: string) => {
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
        } catch (error) {
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
  private async sendSystemStatus(socket?: Socket): Promise<void> {
    try {
      const sentinel = getSentinel(this.client, '');
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
      } else {
        this.io.emit('systemStatus', data);
      }
    } catch (error) {
      console.error('Error sending system status:', error);
    }
  }
  
  /**
   * Send bot status to a specific socket or all connected clients
   */
  private sendBotStatus(socket?: Socket): void {
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
      } else {
        this.io.emit('botStatus', status);
      }
    } catch (error) {
      console.error('Error sending bot status:', error);
    }
  }
  
  /**
   * Send mood status to a specific socket or all connected clients
   */
  private async sendMoodStatus(socket?: Socket): Promise<void> {
    try {
      const personality = getPersonalityCore();
      const mood = personality.getMood();
      const currentMood = await db.getCurrentMood();
      
      const data = {
        current: mood,
        history: currentMood ? [currentMood] : [],
        since: currentMood ? currentMood.started_at : null
      };
      
      if (socket) {
        socket.emit('moodStatus', data);
      } else {
        this.io.emit('moodStatus', data);
      }
    } catch (error) {
      console.error('Error sending mood status:', error);
    }
  }
  
  /**
   * Start sending periodic updates to all connected clients
   */
  private startPeriodicUpdates(): void {
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
  private triggerBackup(socket: Socket): void {
    try {
      const scriptPath = path.join(process.cwd(), 'scripts', 'backup.sh');
      
      if (!fs.existsSync(scriptPath)) {
        socket.emit('commandResult', { success: false, message: 'Backup script not found' });
        return;
      }
      
      exec(scriptPath, async (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Backup error: ${error}`);
          socket.emit('commandResult', { success: false, message: `Backup failed: ${error.message}` });
          return;
        }
        
        const discordId = (socket as any).discordId;
        await db.logEvent('API', `Manual backup triggered by user ${discordId} via web dashboard`);
        socket.emit('commandResult', { success: true, message: 'Backup completed successfully' });
      });
    } catch (error) {
      console.error('Error triggering backup:', error);
      socket.emit('commandResult', { success: false, message: 'Error initiating backup' });
    }
  }
  
  /**
   * Generate a JWT token for user authentication
   */
  private generateToken(discordId: string, expiresIn: string = '30m'): string {
    return jwt.sign({ discordId }, this.jwtSecret as jwt.Secret, { expiresIn });
  }
  
  /**
   * Generate a one-time token and store it for authentication
   */
  private generateOneTimeToken(discordId: string): string {
    // Create a random token
    const token = crypto.randomBytes(32).toString('hex');
    
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
  private cleanupExpiredTokens(): void {
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
  private setupRoutes(): void {
    // Serve the main dashboard page
    this.app.get('/', (req: Request, res: Response): void => {
      res.sendFile(path.join(process.cwd(), 'web', 'public', 'index.html'));
    });
    
    // Authentication endpoints
    this.app.post('/api/auth/verify-token', (req: Request, res: Response): Response | void => {
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
      } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Discord link command handler (called from Discord bot)
    this.app.post('/api/auth/create-link', (req: Request, res: Response): Response | void => {
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
      } catch (error) {
        console.error('Error creating link token:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Public status endpoint (no auth required)
    this.app.get('/api/status/public', (req: Request, res: Response): void => {
      res.json({
        status: 'online',
        name: this.client.user?.username || 'Noxhime',
        version: '4.0.0',
        uptime: process.uptime()
      });
    });
    
    // Bot status endpoint
    this.app.get('/api/status', (req: Request, res: Response): Response | void => {
      try {
        const stats = {
          status: 'online',
          uptime: process.uptime(),
          guilds: this.client.guilds.cache.size,
          lastRestart: new Date(Date.now() - process.uptime() * 1000).toISOString(),
          version: '4.0.0'
        };
        
        res.json(stats);
      } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Sentinel incidents endpoint
    this.app.get('/api/incidents', async (req: Request, res: Response): Promise<Response | void> => {
      try {
        const limit = parseInt(req.query.limit as string || '10');
        const incidents = await db.getRecentIncidents(limit);
        
        res.json(incidents);
      } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Service status endpoint
    this.app.get('/api/services', async (req: Request, res: Response): Promise<Response | void> => {
      try {
        const sentinel = getSentinel(this.client, '');
        const services = await sentinel.getServicesStatus();
        
        res.json(services);
      } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Personality/mood endpoint
    this.app.get('/api/mood', async (req: Request, res: Response): Promise<Response | void> => {
      try {
        const personality = getPersonalityCore();
        const mood = personality.getMood();
        const currentMood = await db.getCurrentMood();
        
        res.json({
          current: mood,
          history: currentMood ? [currentMood] : [],
          since: currentMood ? currentMood.started_at : null
        });
      } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Stats and logs endpoint
    this.app.get('/api/logs', async (req: Request, res: Response): Promise<Response | void> => {
      try {
        const type = req.query.type as string || 'all';
        const limit = parseInt(req.query.limit as string || '20');
        
        let query = 'SELECT * FROM events';
        const params: any[] = [];
        
        if (type !== 'all') {
          query += ' WHERE type = ?';
          params.push(type.toUpperCase());
        }
        
        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);
        
        const logs = await db.getRecentEvents(limit);
        
        res.json(logs);
      } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Trigger manual backup endpoint
    this.app.post('/api/backup', (req: Request, res: Response): Response | void => {
      try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'backup.sh');
        if (!fs.existsSync(scriptPath)) {
          res.status(404).json({ error: 'Backup script not found' });
          return;
        }
        
        exec(scriptPath, async (error: any, stdout: string, stderr: string) => {
          if (error) {
            console.error(`Backup error: ${error}`);
            res.status(500).json({ error: error.message, stderr });
            return;
          }
          
          await db.logEvent('API', 'Manual backup triggered via API');
          res.json({ success: true, message: 'Backup initiated' });
        });
      } catch (error) {
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
  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`API server with Socket.IO listening on port ${this.port}`);
      db.logEvent('API', `API server with Socket.IO started on port ${this.port}`);
    });
  }
  
  /**
   * Stop the API server and cleanup resources
   */
  public stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    
    this.server.close();
    console.log('API server stopped');
  }
}

// Export singleton factory function
let apiInstance: ApiServer | null = null;

export function startApiServer(client: any, port: number = 3000, apiKeys: string[] = []): ApiServer {
  if (!apiInstance) {
    apiInstance = new ApiServer(client, port, apiKeys);
    apiInstance.start();
  }
  return apiInstance;
}
