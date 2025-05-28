import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Get database path from env or use default
const DB_PATH = process.env.DATABASE_PATH || './data/noxhime.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(DB_PATH);

// Create a module exports object
// Database helper functions interface
interface DatabaseModule {
  run: (sql: string, params?: any[]) => Promise<any>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
}

const dbModule: DatabaseModule = {
  run: (sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  },

  get: (sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  all: (sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
};

// Export database functions
export const { run, get, all } = dbModule;

// Initialize database tables
export async function initializeDatabase(): Promise<boolean> {
  try {
    // Read schema SQL
    const schemaSQL = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
    
    // Execute each SQL statement
    const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await run(stmt);
      }
    }
    
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

// Log an event
export async function logEvent(type: string, description: string): Promise<boolean> {
  try {
    await run('INSERT INTO events (type, description) VALUES (?, ?)', [type, description]);
    return true;
  } catch (error) {
    console.error('Error logging event:', error);
    return false;
  }
}

// Log an alert
export async function logAlert(severity: string, message: string): Promise<boolean> {
  try {
    await run('INSERT INTO alerts (severity, message) VALUES (?, ?)', [severity, message]);
    return true;
  } catch (error) {
    console.error('Error logging alert:', error);
    return false;
  }
}

// Log an intrusion attempt
export async function logIntrusion(ip: string, method: string): Promise<boolean> {
  try {
    await run('INSERT INTO intrusions (ip, method) VALUES (?, ?)', [ip, method]);
    return true;
  } catch (error) {
    console.error('Error logging intrusion:', error);
    return false;
  }
}

// Log an authentication attempt
export async function logAuthAttempt(username: string, sourceIp: string, success: boolean): Promise<boolean> {
  try {
    await run('INSERT INTO auth_attempts (username, source_ip, success) VALUES (?, ?, ?)', 
      [username, sourceIp, success ? 1 : 0]);
    return true;
  } catch (error) {
    console.error('Error logging auth attempt:', error);
    return false;
  }
}

// Get recent events
export async function getRecentEvents(limit = 10): Promise<any[]> {
  try {
    return await all('SELECT * FROM events ORDER BY timestamp DESC LIMIT ?', [limit]);
  } catch (error) {
    console.error('Error getting recent events:', error);
    return [];
  }
}

// Get recent alerts
export async function getRecentAlerts(limit = 10): Promise<any[]> {
  try {
    return await all('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?', [limit]);
  } catch (error) {
    console.error('Error getting recent alerts:', error);
    return [];
  }
}

// Phase 4: Sentinel Intelligence Database Functions

// Log a sentinel incident
export async function logSentinelIncident(
  severity: string, 
  source: string, 
  description: string, 
  details?: string
): Promise<boolean> {
  try {
    await run(
      'INSERT INTO sentinel_incidents (severity, source, description, details) VALUES (?, ?, ?, ?)',
      [severity, source, description, details || '']
    );
    return true;
  } catch (error) {
    console.error('Error logging sentinel incident:', error);
    return false;
  }
}

// Get recent sentinel incidents
export async function getRecentIncidents(limit = 10): Promise<any[]> {
  try {
    return await all('SELECT * FROM sentinel_incidents ORDER BY created_at DESC LIMIT ?', [limit]);
  } catch (error) {
    console.error('Error getting recent incidents:', error);
    return [];
  }
}

// Track suspicious IP
export async function trackSuspiciousIP(ip: string): Promise<boolean> {
  try {
    // Check if IP exists
    const existingIP = await get('SELECT * FROM suspicious_ips WHERE ip = ?', [ip]);
    
    if (existingIP) {
      // Update existing IP
      await run(
        'UPDATE suspicious_ips SET incident_count = incident_count + 1, last_seen = CURRENT_TIMESTAMP WHERE ip = ?',
        [ip]
      );
    } else {
      // Insert new IP
      await run('INSERT INTO suspicious_ips (ip) VALUES (?)', [ip]);
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking suspicious IP:', error);
    return false;
  }
}

// Save service status
export async function saveServiceStatus(
  serviceName: string, 
  status: string, 
  memoryUsage?: string, 
  cpuUsage?: string, 
  uptime?: string
): Promise<boolean> {
  try {
    await run(
      'INSERT INTO service_status (service_name, status, memory_usage, cpu_usage, uptime) VALUES (?, ?, ?, ?, ?)',
      [serviceName, status, memoryUsage || null, cpuUsage || null, uptime || null]
    );
    return true;
  } catch (error) {
    console.error('Error saving service status:', error);
    return false;
  }
}

// Log backup information
export async function logBackup(
  backupPath: string, 
  remotePath: string, 
  sizeBytes: number,
  status: string
): Promise<boolean> {
  try {
    await run(
      'INSERT INTO backups (backup_path, remote_path, size_bytes, status) VALUES (?, ?, ?, ?)',
      [backupPath, remotePath, sizeBytes, status]
    );
    return true;
  } catch (error) {
    console.error('Error logging backup:', error);
    return false;
  }
}

// Phase 5: Personality Core Database Functions

// Get current bot mood
export async function getCurrentMood(): Promise<any> {
  try {
    return await get('SELECT * FROM mood_states WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
  } catch (error) {
    console.error('Error getting current mood:', error);
    return null;
  }
}

// Set new bot mood
export async function setMood(mood: string, triggerEvent: string, intensity: number): Promise<boolean> {
  try {
    // End current mood if exists
    await run('UPDATE mood_states SET ended_at = CURRENT_TIMESTAMP WHERE ended_at IS NULL');
    
    // Set new mood
    await run(
      'INSERT INTO mood_states (mood, trigger_event, intensity) VALUES (?, ?, ?)',
      [mood, triggerEvent, intensity]
    );
    
    return true;
  } catch (error) {
    console.error('Error setting mood:', error);
    return false;
  }
}
