// Connection Status Manager
class ConnectionStatus {
    constructor() {
        this.isOnline = navigator.onLine;
        this.apiConnected = false;
        this.setupEventListeners();
        this.createStatusIndicator();
        this.checkAPIConnection();
    }

    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateStatus();
            this.checkAPIConnection();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.apiConnected = false;
            this.updateStatus();
        });
    }

    createStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'connection-status';
        indicator.className = 'connection-status';
        indicator.innerHTML = `
            <div class="status-content">
                <i class="fas fa-wifi"></i>
                <span class="status-text">Checking connection...</span>
            </div>
        `;
        document.body.appendChild(indicator);

        // Add CSS
        const style = document.createElement('style');
        style.textContent = `
            .connection-status {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #FF3B30;
                color: white;
                padding: 8px 16px;
                text-align: center;
                z-index: 10001;
                transform: translateY(-100%);
                transition: transform 0.3s ease;
                font-size: 14px;
            }
            
            .connection-status.show {
                transform: translateY(0);
            }
            
            .connection-status.online {
                background: #34C759;
            }
            
            .connection-status.offline {
                background: #FF3B30;
            }
            
            .connection-status.api-error {
                background: #F5A623;
            }
            
            .status-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    async checkAPIConnection() {
        if (!this.isOnline) {
            this.apiConnected = false;
            this.updateStatus();
            return;
        }

        try {
            // Try to make a simple API call
            const response = await fetch(CONFIG.API_BASE_URL + '/routes', {
                method: 'GET',
                timeout: 5000
            });
            
            this.apiConnected = response.ok;
        } catch (error) {
            console.log('API connection check failed:', error.message);
            this.apiConnected = false;
        }

        this.updateStatus();
    }

    updateStatus() {
        const indicator = document.getElementById('connection-status');
        const statusText = indicator.querySelector('.status-text');
        const icon = indicator.querySelector('i');

        if (!this.isOnline) {
            indicator.className = 'connection-status offline show';
            icon.className = 'fas fa-wifi-slash';
            statusText.textContent = 'No internet connection';
        } else if (!this.apiConnected) {
            indicator.className = 'connection-status api-error show';
            icon.className = 'fas fa-exclamation-triangle';
            statusText.textContent = 'Using offline mode - Some features may be limited';
        } else {
            indicator.className = 'connection-status online';
            icon.className = 'fas fa-wifi';
            statusText.textContent = 'Connected';
            
            // Hide after 2 seconds if online
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 2000);
        }
    }

    showTemporaryMessage(message, type = 'info', duration = 3000) {
        const indicator = document.getElementById('connection-status');
        const statusText = indicator.querySelector('.status-text');
        const icon = indicator.querySelector('i');

        const originalClass = indicator.className;
        const originalText = statusText.textContent;
        const originalIcon = icon.className;

        indicator.className = `connection-status ${type} show`;
        statusText.textContent = message;
        
        if (type === 'success') {
            icon.className = 'fas fa-check-circle';
        } else if (type === 'error') {
            icon.className = 'fas fa-exclamation-circle';
        }

        setTimeout(() => {
            indicator.className = originalClass;
            statusText.textContent = originalText;
            icon.className = originalIcon;
        }, duration);
    }
}

// Initialize connection status
let connectionStatus;
document.addEventListener('DOMContentLoaded', () => {
    connectionStatus = new ConnectionStatus();
});
