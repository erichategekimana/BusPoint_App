const DriverLocation = {
    watchId: null,
    tripId: null,
    lastPosition: null,
    updateInterval: null,
    
    startTracking(tripId) {
        this.tripId = tripId;
        
        if (!navigator.geolocation) {
            Utils.toast('Geolocation is not supported by your browser', 'error');
            return;
        }
        
        // Check permissions
        navigator.permissions.query({ name: 'geolocation' }).then(result => {
            if (result.state === 'denied') {
                Utils.toast('Please enable location permissions in your browser settings', 'error');
                return;
            }
            
            this.beginTracking();
        });
    },
    
    beginTracking() {
        Utils.showLoading('Starting GPS tracking...');
        
        // Get initial position
        navigator.geolocation.getCurrentPosition(
            (position) => this.onPositionUpdate(position),
            (error) => this.onPositionError(error),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        
        // Watch for continuous updates
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.onPositionUpdate(position),
            (error) => this.onPositionError(error),
            { 
                enableHighAccuracy: true, 
                timeout: 10000, 
                maximumAge: 0,
                distanceFilter: 10 // Update every 10 meters
            }
        );
        
        // Backup interval update every 10 seconds
        this.updateInterval = setInterval(() => {
            if (this.lastPosition) {
                this.sendLocationUpdate(this.lastPosition);
            }
        }, 10000);
        
        Utils.hideLoading();
        Utils.toast('Location tracking started', 'success');
        
        // Show tracking UI
        this.renderTrackingUI();
    },
    
    onPositionUpdate(position) {
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        
        this.lastPosition = {
            latitude,
            longitude,
            accuracy,
            speed: speed || 0,
            heading: heading || 0,
            timestamp: position.timestamp
        };
        
        // Update UI if visible
        this.updateTrackingUI(this.lastPosition);
        
        // Send to server (throttled to every 10 seconds via interval)
    },
    
    onPositionError(error) {
        let message = 'Unable to retrieve your location';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location access denied by user';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out';
                break;
        }
        Utils.toast(message, 'error');
    },
    
    async sendLocationUpdate(position) {
        if (!this.tripId) return;
        
        try {
            await API.driver.updateLocation(this.tripId, {
                latitude: position.latitude,
                longitude: position.longitude
            });
            
            console.log('Location updated:', position.latitude, position.longitude);
            
        } catch (error) {
            console.error('Failed to update location:', error);
        }
    },
    
    renderTrackingUI() {
        // Create floating tracking panel
        let panel = document.getElementById('location-tracking-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'location-tracking-panel';
            panel.className = 'location-tracking-panel';
            panel.innerHTML = `
                <div class="tracking-header">
                    <i class="fas fa-satellite-dish"></i>
                    <span>GPS Active</span>
                    <button onclick="DriverLocation.stopTracking()" class="btn-stop">
                        <i class="fas fa-stop"></i>
                    </button>
                </div>
                <div class="tracking-stats">
                    <div class="stat">
                        <i class="fas fa-map-marker-alt"></i>
                        <span id="loc-accuracy">-- m</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-tachometer-alt"></i>
                        <span id="loc-speed">-- km/h</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-satellite"></i>
                        <span id="loc-satellites">--</span>
                    </div>
                </div>
                <div class="tracking-status" id="tracking-status">
                    <span class="pulse"></span>
                    Sending updates...
                </div>
            `;
            document.body.appendChild(panel);
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .location-tracking-panel {
                    position: fixed;
                    bottom: 100px;
                    right: 20px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    padding: 1rem;
                    z-index: 1000;
                    min-width: 200px;
                    border-left: 4px solid var(--primary);
                }
                .tracking-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                    font-weight: 600;
                    color: var(--primary);
                }
                .btn-stop {
                    margin-left: auto;
                    background: var(--danger);
                    color: white;
                    border: none;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .tracking-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                }
                .tracking-stats .stat {
                    text-align: center;
                    font-size: 0.8rem;
                }
                .tracking-stats .stat i {
                    display: block;
                    color: var(--gray-400);
                    margin-bottom: 0.25rem;
                }
                .tracking-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                    color: var(--gray-600);
                }
                .pulse {
                    width: 8px;
                    height: 8px;
                    background: var(--primary);
                    border-radius: 50%;
                    animation: pulse-dot 2s infinite;
                }
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
            `;
            document.head.appendChild(style);
        }
    },
    
    updateTrackingUI(position) {
        const accuracyEl = document.getElementById('loc-accuracy');
        const speedEl = document.getElementById('loc-speed');
        
        if (accuracyEl) accuracyEl.textContent = `±${Math.round(position.accuracy)}m`;
        if (speedEl) speedEl.textContent = `${Math.round(position.speed * 3.6)} km/h`;
    },
    
    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        const panel = document.getElementById('location-tracking-panel');
        if (panel) panel.remove();
        
        this.tripId = null;
        this.lastPosition = null;
        
        Utils.toast('Location tracking stopped', 'info');
    }
};