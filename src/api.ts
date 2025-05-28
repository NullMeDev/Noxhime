import express from 'express';
import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
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
  private port: number;
  private apiKeys: string[];
  private client: any;
  
  constructor(client: any, port: number = 3000, apiKeys: string[] = []) {
    this.app = express();
    this.port = port;
    this.apiKeys = apiKeys;
    this.client = client;
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  /**
   * Configure middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
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
  private setupRoutes(): void {
    // Public status endpoint (no auth required)
    this.app.get('/api/status/public', (req: Request, res: Response) => {
      res.json({
        status: 'online',
        name: this.client.user?.username || 'Noxhime',
        version: '4.0.0',
        uptime: process.uptime()
      });
    });
    
    // Bot status endpoint
    this.app.get('/api/status', (req: Request, res: Response) => {
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
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Sentinel incidents endpoint
    this.app.get('/api/incidents', async (req: Request, res: Response) => {
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
    this.app.get('/api/services', async (req: Request, res: Response) => {
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
    this.app.get('/api/mood', async (req: Request, res: Response) => {
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
    this.app.get('/api/logs', async (req: Request, res: Response) => {
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
    this.app.post('/api/backup', (req: Request, res: Response): void => {
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
  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`API server listening on port ${this.port}`);
      db.logEvent('API', `API server started on port ${this.port}`);
    });
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
