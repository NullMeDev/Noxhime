// @ts-nocheck
import express from 'express';
import { Request, Response } from 'express';
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
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    this.activeTokens = new Map();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  public start(retryCount: number = 3): void {
    const tryPort = (attempt: number) => {
      if (attempt >= retryCount) {
        console.error(`Failed to start API server after ${retryCount} attempts`);
        return;
      }

      const currentPort = this.port + attempt;
      this.server.listen(currentPort)
        .on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.log(`Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
            tryPort(attempt + 1);
          } else {
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

  public stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    this.server.close();
    console.log('API server stopped');
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(process.cwd(), 'web', 'public')));
    
    const whitelistEnabled = process.env.WHITELIST_ENABLED === 'true';
    if (whitelistEnabled) {
      const whitelistConfigPath = process.env.WHITELIST_CONFIG_PATH || './config/whitelist.json';
      const whitelistConfig = loadWhitelistConfig(whitelistConfigPath);
      this.app.use(whitelistMiddleware(whitelistConfig) as express.RequestHandler);
      console.log('IP/Port whitelist protection enabled');
    }
    
    console.log('API authentication disabled - open access enabled');
  }

  private setupSocketIO(): void {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as { discordId: string };
        (socket as any).discordId = decoded.discordId;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    this.io.on('connection', this.handleSocketConnection.bind(this));
    this.startPeriodicUpdates();
  }

  private handleSocketConnection(socket: Socket): void {
    const discordId = (socket as any).discordId;
    console.log(`Socket connected for user: ${discordId}`);
    
    socket.join(`user:${discordId}`);
    
    this.sendSystemStatus(socket);
    this.sendBotStatus(socket);
    this.sendMoodStatus(socket);
    
    socket.on('disconnect', () => {
      console.log(`Socket disconnected for user: ${discordId}`);
    });
  }

  private startPeriodicUpdates(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    this.statsInterval = setInterval(() => {
      this.sendSystemStatus();
      this.sendBotStatus();
      this.sendMoodStatus();
    }, 10000);
  }

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

  private setupRoutes(): void {
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(process.cwd(), 'web', 'public', 'index.html'));
    });

    this.app.get('/api/status', (req: Request, res: Response) => {
      res.json({
        status: 'online',
        uptime: process.uptime(),
        port: this.port
      });
    });
  }
}

let apiInstance: ApiServer | null = null;

export function startApiServer(client: any, port: number = 3000, apiKeys: string[] = []): ApiServer {
  if (!apiInstance) {
    apiInstance = new ApiServer(client, port, apiKeys);
    apiInstance.start();
  }
  return apiInstance;
}
