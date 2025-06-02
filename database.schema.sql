-- Example database schema, replace with your actual schema without data
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cpu_usage FLOAT,
    memory_usage FLOAT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
