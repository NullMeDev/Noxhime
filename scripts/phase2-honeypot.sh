#!/bin/bash
# Noxhime Sentient Expansion - Phase 2: Honeypot & Sandbox Deployment
# This script sets up fake SSH and HTTP honeypots with sandboxing

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'
MIDNIGHT_PURPLE='\033[38;5;92m'

echo -e "${BOLD}${MIDNIGHT_PURPLE}"
echo "███╗   ██╗ ██████╗ ██╗  ██╗██╗  ██╗██╗███╗   ███╗███████╗"
echo "████╗  ██║██╔═══██╗╚██╗██╔╝██║  ██║██║████╗ ████║██╔════╝"
echo "██╔██╗ ██║██║   ██║ ╚███╔╝ ███████║██║██╔████╔██║█████╗  "
echo "██║╚██╗██║██║   ██║ ██╔██╗ ██╔══██║██║██║╚██╔╝██║██╔══╝  "
echo "██║ ╚████║╚██████╔╝██╔╝ ██╗██║  ██║██║██║ ╚═╝ ██║███████╗"
echo "╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝"
echo -e "${MIDNIGHT_PURPLE}        Sentient Expansion - Phase 2 Honeypot       v3.0.0${NC}"
echo

NOXHIME_HOME="/home/nulladmin/noxhime"
USER="nulladmin"

# Function definitions
status() { echo -e "${BLUE}[*]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
divider() {
    echo -e "${PURPLE}=========================================${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${PURPLE}=========================================${NC}"
}

# Setup SSH Honeypot
setup_ssh_honeypot() {
    divider "Setting Up SSH Honeypot"
    
    # Create honeypot SSH service
    cat > "$NOXHIME_HOME/honeypot/ssh-honeypot.js" << 'EOF'
const net = require('net');
const fs = require('fs');
const path = require('path');

const HONEYPOT_PORT = process.env.HONEYPOT_SSH_PORT || 2222;
const LOG_PATH = process.env.HONEYPOT_LOG_PATH || '/home/nulladmin/noxhime/logs/honeypot';

class SSHHoneypot {
    constructor() {
        this.server = net.createServer(this.handleConnection.bind(this));
        this.sessions = new Map();
    }

    start() {
        this.server.listen(HONEYPOT_PORT, '0.0.0.0', () => {
            console.log(`SSH Honeypot listening on port ${HONEYPOT_PORT}`);
            this.log('system', 'SSH Honeypot started');
        });
    }

    handleConnection(socket) {
        const sessionId = this.generateSessionId();
        const clientInfo = {
            ip: socket.remoteAddress,
            port: socket.remotePort,
            timestamp: new Date().toISOString(),
            sessionId: sessionId
        };

        this.sessions.set(sessionId, clientInfo);
        console.log(`New connection from ${clientInfo.ip}:${clientInfo.port}`);
        
        this.log('connection', `New SSH connection: ${JSON.stringify(clientInfo)}`);

        // Send fake SSH banner
        socket.write('SSH-2.0-OpenSSH_8.2p1 Ubuntu-4ubuntu0.5\r\n');

        let buffer = '';
        socket.on('data', (data) => {
            buffer += data.toString();
            this.handleSSHData(sessionId, buffer, socket);
        });

        socket.on('close', () => {
            this.log('disconnection', `SSH session closed: ${sessionId}`);
            this.sessions.delete(sessionId);
        });

        socket.on('error', (err) => {
            this.log('error', `SSH socket error: ${err.message}`);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            if (!socket.destroyed) {
                socket.destroy();
            }
        }, 30000);
    }

    handleSSHData(sessionId, data, socket) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Log all received data
        this.log('data', `Session ${sessionId}: ${data.replace(/[\r\n]/g, '\\n')}`);

        // Look for credential attempts
        const lines = data.split('\n');
        for (const line of lines) {
            if (line.includes('user') || line.includes('password')) {
                this.log('credential', `Potential credential attempt: ${line}`);
                this.quarantineData(sessionId, 'credential_attempt', line);
            }
        }

        // Send fake responses
        if (data.includes('SSH-2.0')) {
            socket.write('SSH-2.0-OpenSSH_8.2p1 Ubuntu-4ubuntu0.5\r\n');
        } else if (data.length > 0) {
            // Fake authentication failure
            setTimeout(() => {
                socket.write('Permission denied (publickey,password).\r\n');
                socket.end();
            }, 1000);
        }
    }

    quarantineData(sessionId, type, data) {
        const quarantinePath = path.join('/home/nulladmin/noxhime/quarantine', 
            `${sessionId}_${type}_${Date.now()}.txt`);
        
        const metadata = {
            sessionId: sessionId,
            type: type,
            timestamp: new Date().toISOString(),
            source: 'ssh_honeypot',
            data: data
        };

        fs.writeFileSync(quarantinePath, JSON.stringify(metadata, null, 2));
        this.log('quarantine', `Data quarantined: ${quarantinePath}`);
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2, 15);
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
        
        const logFile = path.join(LOG_PATH, 'ssh-honeypot.log');
        fs.appendFileSync(logFile, logEntry);
        
        // Also log to console for debugging
        console.log(logEntry.trim());
    }
}

// Start the honeypot
const honeypot = new SSHHoneypot();
honeypot.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down SSH Honeypot...');
    process.exit(0);
});
EOF

    # Create systemd service for SSH honeypot
    sudo cat > /etc/systemd/system/noxhime-ssh-honeypot.service << EOF
[Unit]
Description=Noxhime SSH Honeypot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$NOXHIME_HOME/honeypot
ExecStart=/usr/bin/node ssh-honeypot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=HONEYPOT_SSH_PORT=2222
Environment=HONEYPOT_LOG_PATH=$NOXHIME_HOME/logs/honeypot

[Install]
WantedBy=multi-user.target
EOF

    success "SSH Honeypot configured"
}

# Setup HTTP Honeypot
setup_http_honeypot() {
    divider "Setting Up HTTP Honeypot"
    
    cat > "$NOXHIME_HOME/honeypot/http-honeypot.js" << 'EOF'
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.HONEYPOT_HTTP_PORT || 8080;
const LOG_PATH = process.env.HONEYPOT_LOG_PATH || '/home/nulladmin/noxhime/logs/honeypot';

// Middleware to log all requests
app.use((req, res, next) => {
    const clientInfo = {
        ip: req.ip || req.connection.remoteAddress,
        method: req.method,
        url: req.url,
        headers: req.headers,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    };
    
    log('request', `HTTP ${req.method} ${req.url} from ${clientInfo.ip}`);
    log('headers', JSON.stringify(clientInfo.headers));
    
    next();
});

// Parse JSON and URL-encoded data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Capture POST data
app.use((req, res, next) => {
    if (req.method === 'POST' && Object.keys(req.body).length > 0) {
        log('post_data', JSON.stringify(req.body));
        quarantineData(req.ip, 'post_data', req.body);
    }
    next();
});

// Fake admin panel
app.get('/admin', (req, res) => {
    res.send(`
        <html>
        <head><title>Admin Login</title></head>
        <body>
            <h2>Administrator Login</h2>
            <form method="post" action="/admin/login">
                <p>Username: <input type="text" name="username"></p>
                <p>Password: <input type="password" name="password"></p>
                <p><input type="submit" value="Login"></p>
            </form>
        </body>
        </html>
    `);
});

// Fake admin login
app.post('/admin/login', (req, res) => {
    log('credential', `Admin login attempt: ${JSON.stringify(req.body)}`);
    quarantineData(req.ip, 'admin_credential', req.body);
    
    res.send('<h2>Login Failed - Invalid Credentials</h2>');
});

// Fake API endpoints
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', version: '1.0.0', server: 'nginx/1.18.0' });
});

app.post('/api/upload', (req, res) => {
    log('upload', `File upload attempt from ${req.ip}`);
    quarantineData(req.ip, 'upload_attempt', req.body);
    res.json({ error: 'Upload failed - insufficient permissions' });
});

// Catch-all for other paths
app.use('*', (req, res) => {
    log('unknown_path', `Unknown path accessed: ${req.method} ${req.originalUrl}`);
    res.status(404).send('<h1>404 - Page Not Found</h1>');
});

function quarantineData(ip, type, data) {
    const timestamp = Date.now();
    const filename = `http_${ip}_${type}_${timestamp}.json`;
    const quarantinePath = path.join('/home/nulladmin/noxhime/quarantine', filename);
    
    const metadata = {
        ip: ip,
        type: type,
        timestamp: new Date().toISOString(),
        source: 'http_honeypot',
        data: data
    };

    fs.writeFileSync(quarantinePath, JSON.stringify(metadata, null, 2));
    log('quarantine', `HTTP data quarantined: ${filename}`);
}

function log(level, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    const logFile = path.join(LOG_PATH, 'http-honeypot.log');
    fs.appendFileSync(logFile, logEntry);
    
    console.log(logEntry.trim());
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP Honeypot listening on port ${PORT}`);
    log('system', `HTTP Honeypot started on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down HTTP Honeypot...');
    process.exit(0);
});
EOF

    # Create systemd service for HTTP honeypot
    sudo cat > /etc/systemd/system/noxhime-http-honeypot.service << EOF
[Unit]
Description=Noxhime HTTP Honeypot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$NOXHIME_HOME/honeypot
ExecStart=/usr/bin/node http-honeypot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=HONEYPOT_HTTP_PORT=8080
Environment=HONEYPOT_LOG_PATH=$NOXHIME_HOME/logs/honeypot

[Install]
WantedBy=multi-user.target
EOF

    success "HTTP Honeypot configured"
}

# Setup Sandbox Environment
setup_sandbox() {
    divider "Setting Up Sandbox Environment"
    
    # Create sandbox manager script
    cat > "$NOXHIME_HOME/sandbox/sandbox-manager.sh" << 'EOF'
#!/bin/bash
# Noxhime Sandbox Manager

SANDBOX_DIR="/home/nulladmin/noxhime/sandbox"
QUARANTINE_DIR="/home/nulladmin/noxhime/quarantine"
LOG_FILE="/home/nulladmin/noxhime/logs/sandbox.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

create_sandbox() {
    local session_id="$1"
    local sandbox_path="$SANDBOX_DIR/session_$session_id"
    
    log_message "Creating sandbox for session $session_id"
    
    # Create sandbox directory
    mkdir -p "$sandbox_path"
    
    # Create minimal chroot environment
    mkdir -p "$sandbox_path"/{bin,etc,lib,lib64,tmp,var,proc,dev}
    
    # Copy essential binaries
    cp /bin/bash "$sandbox_path/bin/"
    cp /bin/ls "$sandbox_path/bin/"
    cp /bin/cat "$sandbox_path/bin/"
    
    # Copy essential libraries
    ldd /bin/bash | grep -o '/lib[^ ]*' | xargs -I {} cp {} "$sandbox_path/lib/"
    
    # Set permissions
    chmod 755 "$sandbox_path"
    chmod 1777 "$sandbox_path/tmp"
    
    log_message "Sandbox created: $sandbox_path"
    echo "$sandbox_path"
}

execute_in_sandbox() {
    local sandbox_path="$1"
    local command="$2"
    local timeout="${3:-30}"
    
    log_message "Executing in sandbox: $command"
    
    # Use firejail for additional isolation
    timeout "$timeout" firejail \
        --chroot="$sandbox_path" \
        --read-only=/bin \
        --read-only=/lib \
        --read-only=/lib64 \
        --private-tmp \
        --net=none \
        --no-root \
        bash -c "$command" 2>&1
    
    local exit_code=$?
    log_message "Command execution completed with exit code: $exit_code"
    
    return $exit_code
}

cleanup_sandbox() {
    local session_id="$1"
    local sandbox_path="$SANDBOX_DIR/session_$session_id"
    
    if [ -d "$sandbox_path" ]; then
        log_message "Cleaning up sandbox: $sandbox_path"
        rm -rf "$sandbox_path"
    fi
}

# Main execution
case "$1" in
    create)
        create_sandbox "$2"
        ;;
    execute)
        execute_in_sandbox "$2" "$3" "$4"
        ;;
    cleanup)
        cleanup_sandbox "$2"
        ;;
    *)
        echo "Usage: $0 {create|execute|cleanup} [args...]"
        exit 1
        ;;
esac
EOF
    chmod +x "$NOXHIME_HOME/sandbox/sandbox-manager.sh"
    
    success "Sandbox environment configured"
}

# Configure Firewall Rules
configure_firewall() {
    divider "Configuring Firewall Rules"
    
    # Create iptables rules for honeypots
    cat > "$NOXHIME_HOME/config/honeypot-iptables.sh" << 'EOF'
#!/bin/bash
# Honeypot Firewall Configuration

# Allow honeypot SSH on port 2222
iptables -A INPUT -p tcp --dport 2222 -j ACCEPT

# Allow honeypot HTTP on port 8080
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# Log suspicious activity
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set --name SSH
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 --name SSH -j LOG --log-prefix "SSH_BRUTE_FORCE: "

# Save rules
iptables-save > /etc/iptables/rules.v4
EOF
    chmod +x "$NOXHIME_HOME/config/honeypot-iptables.sh"
    
    success "Firewall rules configured"
}

# Setup Fail2Ban Integration
setup_fail2ban_integration() {
    divider "Setting Up Fail2Ban Integration"
    
    # Create custom jail for honeypot
    sudo cat > /etc/fail2ban/jail.d/noxhime-honeypot.conf << 'EOF'
[noxhime-ssh-honeypot]
enabled = true
port = 2222
filter = sshd
logpath = /home/nulladmin/noxhime/logs/honeypot/ssh-honeypot.log
maxretry = 1
bantime = 3600
findtime = 300
action = iptables[name=SSH-honeypot, port=2222, protocol=tcp]
         noxhime-discord

[noxhime-http-honeypot]
enabled = true
port = 8080
filter = apache-auth
logpath = /home/nulladmin/noxhime/logs/honeypot/http-honeypot.log
maxretry = 3
bantime = 3600
findtime = 300
action = iptables[name=HTTP-honeypot, port=8080, protocol=tcp]
         noxhime-discord
EOF

    success "Fail2Ban integration configured"
}

# Main execution
main() {
    divider "Noxhime Sentient Expansion - Phase 2"
    echo "Setting up honeypot and sandbox infrastructure..."
    echo
    
    # Check if Phase 1 was completed
    if [ ! -d "$NOXHIME_HOME" ]; then
        error "Phase 1 not completed. Please run phase1-setup.sh first."
    fi
    
    setup_ssh_honeypot
    setup_http_honeypot
    setup_sandbox
    configure_firewall
    setup_fail2ban_integration
    
    # Enable and start services
    status "Enabling honeypot services..."
    sudo systemctl daemon-reload
    sudo systemctl enable noxhime-ssh-honeypot
    sudo systemctl enable noxhime-http-honeypot
    
    divider "Phase 2 Complete!"
    success "Honeypot and sandbox infrastructure deployed"
    success "SSH Honeypot: Port 2222"
    success "HTTP Honeypot: Port 8080"
    success "Sandbox: Firejail + chroot isolation"
    
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Start honeypot services: sudo systemctl start noxhime-ssh-honeypot"
    echo "2. Start HTTP honeypot: sudo systemctl start noxhime-http-honeypot"
    echo "3. Run Phase 3 setup for Discord integration"
    echo "4. Monitor logs in $NOXHIME_HOME/logs/honeypot/"
    
    echo
    echo -e "${PURPLE}Security Features:${NC}"
    echo "✓ SSH Honeypot with credential logging"
    echo "✓ HTTP Honeypot with payload capture"
    echo "✓ Automatic quarantine of malicious data"
    echo "✓ Sandbox isolation for payload analysis"
    echo "✓ Fail2Ban integration for auto-banning"
}

main "$@"
