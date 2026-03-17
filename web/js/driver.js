// Driver Dashboard Logic
let driverMap = null;
let driverSocket = null;

function showDriverDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('driver-dashboard').classList.add('active');
    document.getElementById('passenger-dashboard').classList.remove('active');
    
    // Update user info
    document.getElementById('driverName').textContent = currentUser.full_name;
    
    // Load today's trips
    loadTodayTrips();
    
    // Connect to Socket.io
    connectDriverSocket();
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
    api.getDriverTrips(currentUser.id)
        .then(trips => {
            const container = document.getElementById('trips-list');
            
            if (trips.length === 0) {
                container.innerHTML = '<div class="text-center">No trips today</div>';
                return;
            }
            
            let html = '';
            trips.forEach(trip => {
                const statusColor = getStatusColor(trip.status);
                html += `
                    <div class="card">
                        <div class="trip-header">
                            <div>
                                <h4>${new Date(trip.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</h4>
                                <p>${trip.route?.name || 'Unknown Route'}</p>
                            </div>
                            <div class="status-badge" style="background: ${statusColor}">
                                ${trip.status.toUpperCase()}
                            </div>
                        </div>
                        <div class="trip-details">
                            <div class="detail-item">
                                <i class="fas fa-users"></i>
                                <span>${trip.current_capacity}/${trip.capacity} passengers</span>
                            </div>
                            <div class="detail-item">
                                <i class="fas fa-bus"></i>
                                <span>Bus #${trip.bus_id}</span>
                            </div>
                        </div>
                        <div class="trip-actions">
                            <button onclick="showDriverSection('manifest')" class="btn-secondary">
                                <i class="fas fa-users"></i> Manifest
                            </button>
                            <button onclick="showDriverSection('scanner')" class="btn-secondary">
                                <i class="fas fa-qrcode"></i> Scan QR
                            </button>
                            ${trip.status === 'scheduled' ? `<button onclick="startTrip(${trip.id})" class="btn-primary">
                                Start Trip
                            </button>` : ''}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        });
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
    api.updateTripStatus(tripId, 'departed')
        .then(() => {
            showNotification('Trip started!', 'success');
            loadTodayTrips();
        })
        .catch(error => {
            showNotification(error.message || 'Failed to start trip', 'error');
        });
}

function loadManifest() {
    const tripId = document.getElementById('tripSelect').value;
    
    if (!tripId) {
        document.getElementById('manifest-list').innerHTML = '<div class="text-center">Select a trip</div>';
        return;
    }
    
    api.getTripManifest(tripId)
        .then(bookings => {
            const container = document.getElementById('manifest-list');
            
            if (bookings.length === 0) {
                container.innerHTML = '<div class="text-center">No passengers</div>';
                return;
            }
            
            let html = '';
            bookings.forEach(booking => {
                html += `
                    <div class="card">
                        <div class="passenger-header">
                            <div class="passenger-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="passenger-info">
                                <h4>${booking.user?.full_name}</h4>
                                <p>${booking.user?.phone_number}</p>
                            </div>
                            <div class="seat-badge">
                                Seat ${booking.seat_number}
                            </div>
                        </div>
                        <div class="passenger-details">
                            <p><i class="fas fa-map-marker-alt"></i> Pickup: Stop ${booking.pickup_stop_id}</p>
                            <p><i class="fas fa-flag"></i> Dropoff: Stop ${booking.dropoff_stop_id}</p>
                        </div>
                        <div class="status-badge status-${booking.status}">
                            ${booking.status.toUpperCase()}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        });
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
    // Mark booking as boarded
    api.verifyTicket({
        ticket_token: 'ABC123DEF456',
        trip_id: 1
    })
    .then(() => {
        showNotification('Passenger marked as boarded', 'success');
        document.getElementById('scan-result').innerHTML = '';
    })
    .catch(error => {
        showNotification(error.message || 'Failed to mark boarded', 'error');
    });
}

function connectDriverSocket() {
    driverSocket = io(CONFIG.SOCKET_URL, {
        auth: { token: authToken }
    });
    
    driverSocket.on('connect', () => {
        console.log('Driver socket connected');
    });
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
                api.updateBusLocation({
                    trip_id: 1,
                    latitude,
                    longitude,
                    speed: speed * 3.6,
                    heading: position.coords.heading || 0
                });
                
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