-- Noxhime DB Schema (Phase 4 - Sentinel Intelligence)


-- Phase 6: BioLock v2 Tables
CREATE TABLE IF NOT EXISTS biolock_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL UNIQUE,
    passphrase_hash TEXT NOT NULL,
    last_auth_timestamp DATETIME,
    device_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS biolock_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_state TEXT NOT NULL CHECK(session_state IN ('locked', 'pending', 'unlocked', 'override')),
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    session_token TEXT,
    ip_address TEXT,
    device_fingerprint TEXT,
    FOREIGN KEY (user_id) REFERENCES biolock_users(id)
);

CREATE TABLE IF NOT EXISTS biolock_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT 0,
    ip_address TEXT,
    device_info TEXT,
    details TEXT,
    FOREIGN KEY (user_id) REFERENCES biolock_users(id)
);
CREATE TABLE IF NOT EXISTS intrusions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    method TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    description TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    source_ip TEXT,
    success BOOLEAN NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    entry TEXT NOT NULL,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Phase 4: Sentinel Intelligence Tables
CREATE TABLE IF NOT EXISTS sentinel_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    severity TEXT NOT NULL,
    source TEXT NOT NULL,
    description TEXT NOT NULL,
    details TEXT,
    resolved BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

CREATE TABLE IF NOT EXISTS suspicious_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL UNIQUE,
    incident_count INTEGER DEFAULT 1,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS service_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL,
    memory_usage TEXT,
    cpu_usage TEXT,
    uptime TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_path TEXT NOT NULL,
    remote_path TEXT NOT NULL,
    size_bytes INTEGER,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Phase 5: Personality Core Tables
CREATE TABLE IF NOT EXISTS mood_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mood TEXT NOT NULL,
    trigger_event TEXT,
    intensity INTEGER CHECK(intensity BETWEEN 1 AND 10),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
);
