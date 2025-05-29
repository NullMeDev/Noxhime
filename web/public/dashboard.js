// Noxhime Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const authScreen = document.getElementById('auth-screen');
    const dashboardContent = document.getElementById('dashboard-content');
    const authForm = document.getElementById('auth-form');
    const authLoading = document.getElementById('auth-loading');
    const authError = document.getElementById('auth-error');
    const tokenInput = document.getElementById('token');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplay = document.getElementById('user-display');
    const footerUser = document.getElementById('footer-user');
    const connectionStatus = document.getElementById('connection-status');
    const refreshLogsBtn = document.getElementById('refresh-logs');
    const commandBtns = document.querySelectorAll('.command-btn');
    const commandResult = document.getElementById('command-result');

    // Socket.io instance
    let socket = null;
    
    // User info
    let currentUser = {
        discordId: null,
        token: null
    };

    // Check for saved token in localStorage
    initializeAuth();

    // Event Listeners
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    refreshLogsBtn.addEventListener('click', () => {
        if (socket) {
            socket.emit('requestLogs', 20);
        }
    });

    // Add event listeners to command buttons
    commandBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const command = btn.getAttribute('data-command');
            if (socket && command) {
                // Show loading state
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner mr-1"></span> Processing...';
                
                // Send command to server
                socket.emit('triggerCommand', command);
            }
        });
    });

    // Authentication Functions
    function initializeAuth() {
        const savedToken = localStorage.getItem('noxhime_token');
        const savedUser = localStorage.getItem('noxhime_user');
        
        if (savedToken && savedUser) {
            currentUser = {
                discordId: savedUser,
                token: savedToken
            };
            
            // Try to connect with saved token
            connectSocket(savedToken);
        }
    }

    function handleLogin() {
        const token = tokenInput.value.trim();
        
        if (!token) {
            showAuthError('Please enter a token');
            return;
        }
        
        // Show loading state
        authForm.classList.add('hidden');
        authLoading.classList.remove('hidden');
        authError.classList.add('hidden');
        
        // Verify token with server
        fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Invalid or expired token');
            }
            return response.json();
        })
        .then(data => {
            // Save token and user info
            currentUser = {
                discordId: data.discordId,
                token: data.token
            };
            
            localStorage.setItem('noxhime_token', data.token);
            localStorage.setItem('noxhime_user', data.discordId);
            
            // Connect socket
            connectSocket(data.token);
        })
        .catch(error => {
            console.error('Authentication error:', error);
            authForm.classList.remove('hidden');
            authLoading.classList.add('hidden');
            showAuthError(error.message || 'Authentication failed');
        });
    }

    function handleLogout() {
        // Disconnect socket
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        
        // Clear user data
        currentUser = {
            discordId: null,
            token: null
        };
        
        // Remove from localStorage
        localStorage.removeItem('noxhime_token');
        localStorage.removeItem('noxhime_user');
        
        // Show auth screen
        authScreen.classList.remove('hidden');
        dashboardContent.classList.add('hidden');
        
        // Reset form
        tokenInput.value = '';
        authForm.classList.remove('hidden');
        authLoading.classList.add('hidden');
        authError.classList.add('hidden');
    }

    function showAuthError(message) {
        authError.textContent = message;
        authError.classList.remove('hidden');
    }

    // Socket Connection
    function connectSocket(token) {
        // Initialize socket with authentication
        socket = io({
            auth: {
                token: token
            }
        });
        
        // Socket event listeners
        socket.on('connect', () => {
            console.log('Socket connected');
            connectionStatus.textContent = 'Connected';
            connectionStatus.classList.remove('status-warning', 'status-critical');
            connectionStatus.classList.add('status-good');
            
            // Show dashboard
            authScreen.classList.add('hidden');
            dashboardContent.classList.remove('hidden');
            
            // Update user display
            updateUserDisplay();
            
            // Initial data requests
            socket.emit('requestLogs', 20);
        });
        
        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            connectionStatus.textContent = 'Authentication Failed';
            connectionStatus.classList.remove('status-good', 'status-warning');
            connectionStatus.classList.add('status-critical');
            
            // If it's an authentication error, logout
            if (err.message === 'Authentication token required' || err.message === 'Invalid authentication token') {
                handleLogout();
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Socket disconnected');
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.classList.remove('status-good', 'status-critical');
            connectionStatus.classList.add('status-warning');
        });
        
        // Handle real-time updates
        socket.on('systemStatus', updateSystemStatus);
        socket.on('botStatus', updateBotStatus);
        socket.on('moodStatus', updateMoodStatus);
        socket.on('logs', updateLogs);
        socket.on('incidents', updateIncidents);
        
        // Handle command results
        socket.on('commandResult', (result) => {
            // Reset all command buttons
            commandBtns.forEach(btn => {
                btn.disabled = false;
                btn.innerHTML = 'Trigger';
                
                // For sentinel buttons, use appropriate text
                if (btn.getAttribute('data-command') === 'sentinel:start') {
                    btn.innerHTML = 'Start';
                } else if (btn.getAttribute('data-command') === 'sentinel:stop') {
                    btn.innerHTML = 'Stop';
                }
            });
            
            // Show result message
            commandResult.textContent = result.message;
            commandResult.classList.remove('hidden');
            commandResult.classList.add(result.success ? 'bg-green-100' : 'bg-red-100');
            
            // Hide result after 5 seconds
            setTimeout(() => {
                commandResult.classList.add('hidden');
            }, 5000);
        });
    }

    // Update functions for real-time data
    function updateSystemStatus(data) {
        // Update CPU usage
        const cpuUsage = document.getElementById('cpu-usage');
        const cpuProgress = document.getElementById('cpu-progress');
        cpuUsage.textContent = data.cpuUsage.toFixed(1);
        cpuProgress.style.width = `${data.cpuUsage}%`;
        
        // CPU color based on usage
        if (data.cpuUsage > 90) {
            cpuProgress.classList.replace('bg-primary-600', 'bg-red-600');
        } else if (data.cpuUsage > 70) {
            cpuProgress.classList.replace('bg-primary-600', 'bg-yellow-500');
        } else {
            cpuProgress.classList.replace('bg-red-600', 'bg-primary-600');
            cpuProgress.classList.replace('bg-yellow-500', 'bg-primary-600');
        }
        
        // Update Memory usage
        const memoryUsage = document.getElementById('memory-usage');
        const memoryProgress = document.getElementById('memory-progress');
        memoryUsage.textContent = data.memoryUsage.toFixed(1);
        memoryProgress.style.width = `${data.memoryUsage}%`;
        
        // Memory color based on usage
        if (data.memoryUsage > 90) {
            memoryProgress.classList.replace('bg-secondary-600', 'bg-red-600');
        } else if (data.memoryUsage > 70) {
            memoryProgress.classList.replace('bg-secondary-600', 'bg-yellow-500');
        } else {
            memoryProgress.classList.replace('bg-red-600', 'bg-secondary-600');
            memoryProgress.classList.replace('bg-yellow-500', 'bg-secondary-600');
        }
        
        // Update Disk usage
        const diskUsage = document.getElementById('disk-usage');
        const diskProgress = document.getElementById('disk-progress');
        diskUsage.textContent = data.diskUsage.toFixed(1);
        diskProgress.style.width = `${data.diskUsage}%`;
        
        // Disk color based on usage
        if (data.diskUsage > 90) {
            diskProgress.classList.replace('bg-yellow-500', 'bg-red-600');
        } else if (data.diskUsage > 70) {
            diskProgress.classList.replace('bg-red-600', 'bg-yellow-500');
        } else {
            diskProgress.classList.replace('bg-red-600', 'bg-yellow-500');
        }
        
        // Update Uptime
        const uptime = document.getElementById('uptime');
        uptime.textContent = data.uptime || '--:--:--';
        
        // Update Services
        if (data.services && data.services.length > 0) {
            updateServices(data.services);
        }
    }

    function updateBotStatus(data) {
        // Update Last Restart time
        const lastRestart = document.getElementById('last-restart');
        if (data.lastRestart) {
            const date = new Date(data.lastRestart);
            lastRestart.textContent = formatDate(date);
        } else {
            lastRestart.textContent = 'Unknown';
        }
    }

    function updateMoodStatus(data) {
        if (!data || !data.current) return;
        
        const currentMood = document.getElementById('current-mood');
        const moodIntensity = document.getElementById('mood-intensity');
        const moodSince = document.getElementById('mood-since');
        const moodIndicator = document.getElementById('mood-indicator').querySelector('div');
        
        // Update mood text and intensity
        currentMood.textContent = capitalizeFirstLetter(data.current.mood);
        moodIntensity.textContent = data.current.intensity;
        
        // Update time
        if (data.since) {
            moodSince.textContent = formatDate(new Date(data.since));
        } else {
            moodSince.textContent = 'Bot startup';
        }
        
        // Update mood indicator color based on mood
        let moodColor = 'bg-green-500';
        switch (data.current.mood) {
            case 'happy':
            case 'playful':
                moodColor = 'bg-green-500';
                break;
            case 'focused':
            case 'serious':
                moodColor = 'bg-blue-500';
                break;
            case 'concerned':
            case 'alert':
                moodColor = 'bg-yellow-500';
                break;
            case 'sarcastic':
                moodColor = 'bg-purple-500';
                break;
            default:
                moodColor = 'bg-blue-500';
        }
        
        // Remove all bg classes and add the new one
        moodIndicator.className = moodIndicator.className.replace(/bg-\w+-\d+/g, '');
        moodIndicator.classList.add(moodColor);
    }

    function updateServices(services) {
        const servicesContainer = document.getElementById('services-container');
        servicesContainer.innerHTML = '';
        
        services.forEach(service => {
            const isRunning = service.isRunning;
            const statusColor = isRunning ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            const statusText = isRunning ? 'Running' : 'Stopped';
            
            const serviceHTML = `
                <div class="p-3 ${statusColor} rounded">
                    <div class="font-medium">${service.name}</div>
                    <div class="text-sm">${statusText}</div>
                    ${service.memory ? `<div class="text-xs mt-1">Memory: ${service.memory}</div>` : ''}
                </div>
            `;
            
            servicesContainer.innerHTML += serviceHTML;
        });
    }

    function updateLogs(logs) {
        const logsContainer = document.getElementById('logs-container');
        logsContainer.innerHTML = '';
        
        if (!logs || logs.length === 0) {
            logsContainer.innerHTML = `
                <tr>
                    <td colspan="3" class="px-4 py-4 text-center text-sm text-gray-500">No logs found</td>
                </tr>
            `;
            return;
        }
        
        logs.forEach(log => {
            const timestamp = formatDate(new Date(log.timestamp));
            const logHTML = `
                <tr>
                    <td class="px-4 py-2 text-sm text-gray-500">${timestamp}</td>
                    <td class="px-4 py-2 text-sm font-medium">${log.type}</td>
                    <td class="px-4 py-2 text-sm text-gray-800">${log.description}</td>
                </tr>
            `;
            
            logsContainer.innerHTML += logHTML;
        });
    }

    function updateIncidents(incidents) {
        // Not implemented in this version
        console.log('Incidents update received:', incidents);
    }

    // Helper Functions
    function updateUserDisplay() {
        if (currentUser && currentUser.discordId) {
            userDisplay.textContent = `User: ${currentUser.discordId}`;
            footerUser.textContent = currentUser.discordId;
            userDisplay.classList.remove('hidden');
        } else {
            userDisplay.textContent = 'Not logged in';
            footerUser.textContent = 'Not logged in';
        }
    }

    function formatDate(date) {
        if (!date) return 'Unknown';
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(date);
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
});

