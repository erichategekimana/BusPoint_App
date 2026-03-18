// Driver Dashboard Logic
let driverMap = null;
let driverSocket = null;

function showDriverDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('driver-dashboard').classList.add('active');
    document.getElementById('passenger-dashboard').classList.remove('active');
    
    // Update user info
    document.getElementById('driverName').textContent = currentUser.full_name;
    
    // Load today's trips (not available in current backend)
    loadTodayTrips();
}

function showDriverSection(section) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    
    // Show selected section
    document.getElementById(`driver-${section}`).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`[onclick="showDriverSection('${section}')"]`);
    if (activeNav) activeNav.classList.add('active');
}

function loadTodayTrips() {
    const container = document.getElementById('trips-list');
    container.innerHTML = '<div class="text-center">Driver trips are not available in the current backend.</div>';
}

function getStatusColor(status) {
    const colors = {
        scheduled: '#F5A623',
        departed: '#1A8A72',
        arrived: '#34C759'
    };
    return colors[status] || '#8E8E93';
}

function startTrip(tripId) {
    showNotification('Trip updates are not available in the current backend.', 'info');
}

function loadManifest() {
    const tripId = document.getElementById('tripSelect').value;
    
    if (!tripId) {
        document.getElementById('manifest-list').innerHTML = '<div class="text-center">Select a trip</div>';
        return;
    }
    document.getElementById('manifest-list').innerHTML = '<div class="text-center">Manifest is not available in the current backend.</div>';
}

function startScanner() {
    // Start camera
    const video = document.getElementById('scanner-video');
    
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            showNotification('Scanner started', 'success');
        })
        .catch(error => {
            showNotification('Camera access denied', 'error');
        });
}

function stopScanner() {
    const video = document.getElementById('scanner-video');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

function scanQRCode() {
    // In production, use a QR library like jsQR
    // For demo, simulate scanning
    const result = {
        ticket_token: 'ABC123DEF456',
        passenger_name: 'John Doe',
        seat_number: 1
    };
    
    document.getElementById('scan-result').innerHTML = `
        <div class="scan-success">
            <i class="fas fa-check-circle"></i>
            <h4>${result.passenger_name}</h4>
            <p>Seat: ${result.seat_number}</p>
            <button onclick="markBoarded()" class="btn-primary">Mark Boarded</button>
        </div>
    `;
}

function markBoarded() {
    showNotification('Ticket verification is not available in the current backend.', 'info');
}

function connectDriverSocket() {
    console.log('Socket features are not available in the current backend.');
}

function startGPSTracking() {
    if (isGPSTracking) return;
    
    isGPSTracking = true;
    document.getElementById('gps-status-indicator').className = 'status-indicator active';
    document.getElementById('gps-status-indicator').innerHTML = '<i class="fas fa-circle"></i><span>Active</span>';
    
    // Get location
    if (navigator.geolocation) {
        gpsWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, speed } = position.coords;
                
                // Update UI
                document.getElementById('current-lat').textContent = latitude.toFixed(6);
                document.getElementById('current-lng').textContent = longitude.toFixed(6);
                document.getElementById('current-speed').textContent = `${(speed * 3.6).toFixed(1)} km/h`;
                document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
                
                // Update backend
                showNotification('Bus location updates are not available in the current backend.', 'info');
                
                // Emit via Socket.io
                if (driverSocket) {
                    driverSocket.emit('update_bus_location', {
                        trip_id: 1,
                        latitude,
                        longitude,
                        speed: speed * 3.6,
                        heading: position.coords.heading || 0,
                        timestamp: new Date().toISOString()
                    });
                }
            },
            (error) => {
                showNotification('Location error', 'error');
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );
    } else {
        showNotification('Geolocation not supported', 'error');
    }
}

function stopGPSTracking() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    
    isGPSTracking = false;
    document.getElementById('gps-status-indicator').className = 'status-indicator inactive';
    document.getElementById('gps-status-indicator').innerHTML = '<i class="fas fa-circle"></i><span>Inactive</span>';
    
    document.getElementById('current-lat').textContent = '--';
    document.getElementById('current-lng').textContent = '--';
    document.getElementById('current-speed').textContent = '-- km/h';
    document.getElementById('last-update').textContent = '--';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners for manifest
    document.getElementById('tripSelect').addEventListener('change', loadManifest);
});
