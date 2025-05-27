"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// filepath: /workspaces/noxhimetest/src/db.ts
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Get database path from env or use default
const DB_PATH = process.env.DATABASE_PATH || './data/noxhime.db';
// Ensure data directory exists
const dataDir = path_1.default.dirname(DB_PATH);
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
// Initialize database
const db = new sqlite3_1.default.Database(DB_PATH);
// Create module exports object
const dbModule = {};
// Database helper functions
dbModule.run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err)
                return reject(err);
            resolve(this);
        });
    });
};
dbModule.get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                return reject(err);
            resolve(row);
        });
    });
};
dbModule.all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                return reject(err);
            resolve(rows);
        });
    });
};
// Initialize database tables
dbModule.initializeDatabase = async () => {
    try {
        // Read schema SQL
        const schemaSQL = fs_1.default.readFileSync(path_1.default.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
        // Execute each SQL statement
        const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
        for (const stmt of statements) {
            if (stmt.trim()) {
                await dbModule.run(stmt);
            }
        }
        console.log('Database initialized successfully');
        return true;
    }
    catch (error) {
        console.error('Error initializing database:', error);
        return false;
    }
};
// Log an event
dbModule.logEvent = async (type, description) => {
    try {
        await dbModule.run('INSERT INTO events (type, description) VALUES (?, ?)', [type, description]);
        return true;
    }
    catch (error) {
        console.error('Error logging event:', error);
        return false;
    }
};
// Log an alert
dbModule.logAlert = async (severity, message) => {
    try {
        await dbModule.run('INSERT INTO alerts (severity, message) VALUES (?, ?)', [severity, message]);
        return true;
    }
    catch (error) {
        console.error('Error logging alert:', error);
        return false;
    }
};
// Log an intrusion attempt
dbModule.logIntrusion = async (ip, method) => {
    try {
        await dbModule.run('INSERT INTO intrusions (ip, method) VALUES (?, ?)', [ip, method]);
        return true;
    }
    catch (error) {
        console.error('Error logging intrusion:', error);
        return false;
    }
};
// Log an authentication attempt
dbModule.logAuthAttempt = async (username, sourceIp, success) => {
    try {
        await dbModule.run('INSERT INTO auth_attempts (username, source_ip, success) VALUES (?, ?, ?)', [username, sourceIp, success ? 1 : 0]);
        return true;
    }
    catch (error) {
        console.error('Error logging auth attempt:', error);
        return false;
    }
};
// Get recent events
dbModule.getRecentEvents = async (limit = 10) => {
    try {
        return await dbModule.all('SELECT * FROM events ORDER BY timestamp DESC LIMIT ?', [limit]);
    }
    catch (error) {
        console.error('Error getting recent events:', error);
        return [];
    }
};
// Get recent alerts
dbModule.getRecentAlerts = async (limit = 10) => {
    try {
        return await dbModule.all('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?', [limit]);
    }
    catch (error) {
        console.error('Error getting recent alerts:', error);
        return [];
    }
};
// Phase 4: Sentinel Intelligence Database Functions
// Log a sentinel incident
dbModule.logSentinelIncident = async (severity, source, description, details) => {
    try {
        await dbModule.run('INSERT INTO sentinel_incidents (severity, source, description, details) VALUES (?, ?, ?, ?)', [severity, source, description, details || '']);
        return true;
    }
    catch (error) {
        console.error('Error logging sentinel incident:', error);
        return false;
    }
};
// Get recent sentinel incidents
dbModule.getRecentIncidents = async (limit = 10) => {
    try {
        return await dbModule.all('SELECT * FROM sentinel_incidents ORDER BY created_at DESC LIMIT ?', [limit]);
    }
    catch (error) {
        console.error('Error getting recent incidents:', error);
        return [];
    }
};
// Track suspicious IP
dbModule.trackSuspiciousIP = async (ip) => {
    try {
        // Check if IP exists
        const existingIP = await dbModule.get('SELECT * FROM suspicious_ips WHERE ip = ?', [ip]);
        if (existingIP) {
            // Update existing IP
            await dbModule.run('UPDATE suspicious_ips SET incident_count = incident_count + 1, last_seen = CURRENT_TIMESTAMP WHERE ip = ?', [ip]);
        }
        else {
            // Insert new IP
            await dbModule.run('INSERT INTO suspicious_ips (ip) VALUES (?)', [ip]);
        }
        return true;
    }
    catch (error) {
        console.error('Error tracking suspicious IP:', error);
        return false;
    }
};
// Save service status
dbModule.saveServiceStatus = async (serviceName, status, memoryUsage, cpuUsage, uptime) => {
    try {
        await dbModule.run('INSERT INTO service_status (service_name, status, memory_usage, cpu_usage, uptime) VALUES (?, ?, ?, ?, ?)', [serviceName, status, memoryUsage || null, cpuUsage || null, uptime || null]);
        return true;
    }
    catch (error) {
        console.error('Error saving service status:', error);
        return false;
    }
};
// Log backup information
dbModule.logBackup = async (backupPath, remotePath, sizeBytes, status) => {
    try {
        await dbModule.run('INSERT INTO backups (backup_path, remote_path, size_bytes, status) VALUES (?, ?, ?, ?)', [backupPath, remotePath, sizeBytes, status]);
        return true;
    }
    catch (error) {
        console.error('Error logging backup:', error);
        return false;
    }
};
// Phase 5: Personality Core Database Functions
// Get current bot mood
dbModule.getCurrentMood = async () => {
    try {
        return await dbModule.get('SELECT * FROM mood_states WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
    }
    catch (error) {
        console.error('Error getting current mood:', error);
        return null;
    }
};
// Set new bot mood
dbModule.setMood = async (mood, triggerEvent, intensity) => {
    try {
        // End current mood if exists
        await dbModule.run('UPDATE mood_states SET ended_at = CURRENT_TIMESTAMP WHERE ended_at IS NULL');
        // Set new mood
        await dbModule.run('INSERT INTO mood_states (mood, trigger_event, intensity) VALUES (?, ?, ?)', [mood, triggerEvent, intensity]);
        return true;
    }
    catch (error) {
        console.error('Error setting mood:', error);
        return false;
    }
};
// Ensure database is closed on process exit
process.on('exit', () => {
    db.close(err => {
        if (err) {
            console.error('Error closing database on exit:', err);
        }
    });
});
// Export the database module
module.exports = dbModule;
