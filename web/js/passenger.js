// Passenger Dashboard Logic
let passengerMap = null;
let busMarkers = [];

function showPassengerDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('passenger-dashboard').classList.add('active');
    document.getElementById('driver-dashboard').classList.remove('active');
    
    // Update user info
    document.getElementById('userName').textContent = currentUser.full_name;
    
    // Initialize map if not already done
    if (!passengerMap) {
        initPassengerMap();
    }
    
    // Load user bookings
    loadUserBookings();
    
    // Load notifications
    loadNotifications();
    
    // Connect to Socket.io for real-time updates
    connectSocket();
}

function showPassengerSection(section) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    
    // Show selected section
    document.getElementById(`passenger-${section}`).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`[onclick="showPassengerSection('${section}')"]`);
    if (activeNav) activeNav.classList.add('active');
    
    // Refresh map if on home section
    if (section === 'home') {
        refreshBusLocations();
    }
}

function initPassengerMap() {
    passengerMap = new mapboxgl.Map({
        container: 'passenger-map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: CONFIG.DEFAULT_CENTER,
        zoom: CONFIG.DEFAULT_ZOOM
    });
    
    passengerMap.on('load', () => {
        console.log('Passenger map loaded');
        refreshBusLocations();
    });
}

function refreshBusLocations() {
    // Clear existing markers
    busMarkers.forEach(marker => marker.remove());
    busMarkers = [];
    
    // Fetch bus locations from API
    api.request('/bus-locations')
        .then(data => {
            data.forEach(bus => {
                addBusMarker(bus);
            });
        })
        .catch(error => {
            console.error('Failed to fetch bus locations:', error);
        });
}

function addBusMarker(bus) {
    const el = document.createElement('div');
    el.className = 'bus-marker';
    el.innerHTML = '<i class="fas fa-bus"></i>';
    
    const marker = new mapboxgl.Marker(el)
        .setLngLat([bus.longitude, bus.latitude])
        .addTo(passengerMap);
    
    // Add popup with bus info
    const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
            <div class="popup-content">
                <h4>Bus #${bus.bus_id}</h4>
                <p>Speed: ${bus.speed || 0} km/h</p>
                <p>Heading: ${bus.heading || 0}°</p>
                <small>Last updated: ${new Date(bus.last_updated).toLocaleTimeString()}</small>
            </div>
        `);
    
    marker.setPopup(popup);
    busMarkers.push(marker);
}

function centerMap() {
    passengerMap.flyTo({
        center: CONFIG.DEFAULT_CENTER,
        zoom: CONFIG.DEFAULT_ZOOM,
        essential: true
    });
}

function toggleBusInfo() {
    // Toggle popup visibility
    busMarkers.forEach(marker => {
        const popup = marker.getPopup();
        if (popup.isOpen()) {
            popup.toggle();
        } else {
            popup.toggle();
        }
    });
}

function searchTrips() {
    const from = document.getElementById('fromLocation').value;
    const to = document.getElementById('toLocation').value;
    const date = document.getElementById('travelDate').value;
    
    if (!from || !to || !date) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    // Show loading
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div class="text-center">Loading trips...</div>';
    
    // Fetch trips
    api.getTrips({ from, to, date })
        .then(trips => {
            displaySearchResults(trips);
        })
        .catch(error => {
            resultsContainer.innerHTML = `<div class="text-center text-error">Error: ${error.message}</div>`;
        });
}

function displaySearchResults(trips) {
    const resultsContainer = document.getElementById('search-results');
    
    if (trips.length === 0) {
        resultsContainer.innerHTML = '<div class="text-center">No trips found</div>';
        return;
    }
    
    let html = '<div class="trips-grid">';
    
    trips.forEach(trip => {
        const availableSeats = trip.capacity - trip.current_capacity;
        const departureTime = new Date(trip.departure_time).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="trip-card">
                <div class="trip-header">
                    <div class="trip-time">${departureTime}</div>
                    <div class="trip-route">${trip.route?.name || 'Unknown Route'}</div>
                </div>
                <div class="trip-details">
                    <div class="detail-item">
                        <i class="fas fa-bus"></i>
                        <span>Bus #${trip.bus_id}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-users"></i>
                        <span>${availableSeats} seats left</span>
                    </div>
                </div>
                <div class="trip-actions">
                    <button onclick="bookTrip(${trip.id})" class="btn-primary">
                        Book Now
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    resultsContainer.innerHTML = html;
}

function bookTrip(tripId) {
    // Open booking modal
    document.getElementById('booking-modal').classList.add('active');
    
    // Load trip details
    api.getTrips({ id: tripId })
        .then(trips => {
            const trip = trips[0];
            const modalBody = document.querySelector('#booking-modal .modal-body');
            
            modalBody.innerHTML = `
                <div class="booking-details">
                    <h3>Book Trip</h3>
                    <p><strong>Route:</strong> ${trip.route?.name}</p>
                    <p><strong>Departure:</strong> ${new Date(trip.departure_time).toLocaleString()}</p>
                    <p><strong>Available Seats:</strong> ${trip.capacity - trip.current_capacity}</p>
                </div>
                <div class="seat-selection">
                    <h4>Select Seats</h4>
                    <div class="seat-grid" id="seatGrid">
                        <!-- Seats will be generated here -->
                    </div>
                </div>
                <div class="booking-summary">
                    <p>Total: RWF ${(trip.capacity - trip.current_capacity) * 5000}</p>
                </div>
                <button onclick="confirmBooking(${tripId})" class="btn-primary">
                    Confirm Booking
                </button>
            `;
            
            // Generate seat grid
            generateSeatGrid(trip.capacity, trip.current_capacity);
        });
}

function generateSeatGrid(capacity, booked) {
    const seatGrid = document.getElementById('seatGrid');
    let html = '';
    
    for (let i = 1; i <= capacity; i++) {
        const isBooked = i <= booked;
        html += `
            <div class="seat ${isBooked ? 'booked' : ''}" 
                 onclick="selectSeat(${i}, this)">
                ${i}
            </div>
        `;
    }
    
    seatGrid.innerHTML = html;
}

function selectSeat(seatNumber, element) {
    if (element.classList.contains('booked')) return;
    
    element.classList.toggle('selected');
}

function confirmBooking(tripId) {
    const selectedSeats = Array.from(document.querySelectorAll('.seat.selected'))
        .map(el => parseInt(el.textContent));
    
    if (selectedSeats.length === 0) {
        showNotification('Please select at least one seat', 'error');
        return;
    }
    
    // Create booking
    api.createBooking({
        user_id: currentUser.id,
        trip_id: tripId,
        seat_numbers: selectedSeats,
        pickup_stop_id: 1,
        dropoff_stop_id: 2
    })
    .then(booking => {
        closeModal('booking-modal');
        showNotification('Booking confirmed!', 'success');
        loadUserBookings();
    })
    .catch(error => {
        showNotification(error.message || 'Booking failed', 'error');
    });
}

function loadUserBookings() {
    api.getUserBookings(currentUser.id)
        .then(bookings => {
            const container = document.getElementById('bookings-list');
            
            if (bookings.length === 0) {
                container.innerHTML = '<div class="text-center">No bookings yet</div>';
                return;
            }
            
            let html = '';
            bookings.forEach(booking => {
                html += `
                    <div class="card">
                        <div class="booking-header">
                            <div>
                                <h4>Booking #${booking.id}</h4>
                                <p>${new Date(booking.created_at).toLocaleDateString()}</p>
                            </div>
                            <div class="status-badge status-${booking.status}">
                                ${booking.status.toUpperCase()}
                            </div>
                        </div>
                        <div class="booking-details">
                            <p><i class="fas fa-ticket-alt"></i> Seat: ${booking.seat_number}</p>
                            <p><i class="fas fa-clock"></i> ${new Date(booking.trip?.departure_time).toLocaleTimeString()}</p>
                        </div>
                        <div class="qr-code">
                            <canvas id="qr-${booking.id}"></canvas>
                            <p>Ticket Token: ${booking.ticket_token}</p>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            
            // Generate QR codes
            bookings.forEach(booking => {
                generateQRCode(booking.ticket_token, `qr-${booking.id}`);
            });
        });
}

function loadNotifications() {
    api.getUserNotifications(currentUser.id)
        .then(notifications => {
            const container = document.getElementById('notifications-list');
            
            if (notifications.length === 0) {
                container.innerHTML = '<div class="text-center">No notifications</div>';
                return;
            }
            
            let html = '';
            notifications.forEach(notification => {
                html += `
                    <div class="card notification-item">
                        <div class="notification-icon ${notification.type}">
                            <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
                        </div>
                        <div class="notification-content">
                            <h4>${notification.title}</h4>
                            <p>${notification.message}</p>
                            <small>${new Date(notification.created_at).toLocaleString()}</small>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        });
}

function getNotificationIcon(type) {
    const icons = {
        booking: 'ticket',
        payment: 'credit-card',
        trip: 'bus',
        alert: 'exclamation-circle'
    };
    return icons[type] || 'bell';
}

function connectSocket() {
    socket = io(CONFIG.SOCKET_URL, {
        auth: { token: authToken }
    });
    
    socket.on('connect', () => {
        console.log('Socket connected');
    });
    
    socket.on('bus_location_update', (data) => {
        // Update bus marker
        const existingMarker = busMarkers.find(m => m.getLngLat().lng === data.longitude && m.getLngLat().lat === data.latitude);
        if (!existingMarker) {
            addBusMarker(data);
        }
    });
    
    socket.on('notification', (data) => {
        showNotification(data.title, 'info');
    });
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function generateQRCode(text, canvasId) {
    // Simple QR code generation using canvas
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    
    canvas.width = 100;
    canvas.height = 100;
    
    // Simple QR code pattern (in production, use a QR library)
    ctx.fillStyle = '#000';
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
            if (Math.random() > 0.5) {
                ctx.fillRect(i * 10, j * 10, 10, 10);
            }
        }
    }
}