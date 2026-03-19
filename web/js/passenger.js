// Passenger Dashboard Logic
let busMarkers = [];
let availableStops = [];
let availableRouteStops = [];
let availableBuses = [];

function showPassengerDashboard() {
    const authSection = document.getElementById('auth-section');
    const passengerDashboard = document.getElementById('passenger-dashboard');
    const driverDashboard = document.getElementById('driver-dashboard');

    if (authSection) authSection.classList.add('hidden');
    if (passengerDashboard) passengerDashboard.classList.add('active');
    if (driverDashboard) driverDashboard.classList.remove('active');
    
    // Update user info
    const userName = document.getElementById('userName');
    if (userName && currentUser) {
        userName.textContent = currentUser.full_name;
    }
    
    // Initialize map if not already done
    if (!window.passengerMap) {
        initPassengerMap();
    } else {
        refreshBusLocations();
    }

    loadSearchStops();
    
    // Load user bookings (not available in current backend)
    loadUserBookings();
    
    // Load notifications (not available in current backend)
    loadNotifications();
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

    if (section === 'search') {
        loadSearchStops();
    }
}

function initPassengerMap() {
    if (!window.maplibregl) {
        console.warn('MapLibre library not loaded. Skipping map initialization.');
        const container = document.getElementById('passenger-map');
        if (container) {
            container.innerHTML = '<div class="text-center">Map unavailable (MapLibre not loaded).</div>';
        }
        return;
    }

    const styleUrl = buildStadiaStyleUrl();
    window.passengerMap = new maplibregl.Map({
        container: 'passenger-map',
        style: styleUrl,
        center: CONFIG.DEFAULT_CENTER,
        zoom: CONFIG.DEFAULT_ZOOM
    });

    window.passengerMap.addControl(new maplibregl.NavigationControl(), 'top-right');
    
    window.passengerMap.on('load', () => {
        console.log('Passenger map loaded');
        refreshBusLocations();
    });
}

function buildStadiaStyleUrl() {
    const baseUrl = CONFIG.MAP_STYLE_URL || 'https://tiles.stadiamaps.com/styles/alidade_smooth.json';
    const apiKey = (CONFIG.STADIA_API_KEY || '').trim();
    const hasKey = apiKey.length > 0;
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (!hasKey && !isLocalhost) {
        console.warn('Stadia API key is missing. Map tiles may fail to load outside localhost.');
        return baseUrl;
    }

    if (!hasKey || baseUrl.includes('api_key=')) {
        return baseUrl;
    }

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}api_key=${encodeURIComponent(apiKey)}`;
}

function refreshBusLocations() {
    // Clear existing markers
    busMarkers.forEach(marker => marker.remove());
    busMarkers = [];
}

function addBusMarker(bus) {
    const el = document.createElement('div');
    el.className = 'bus-marker';
    el.innerHTML = '<i class="fas fa-bus"></i>';
    
    const marker = new maplibregl.Marker(el)
        .setLngLat([bus.longitude, bus.latitude])
        .addTo(window.passengerMap);
    
    // Add popup with bus info
    const popup = new maplibregl.Popup({ offset: 25 })
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
    window.passengerMap.flyTo({
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

    if (from === to) {
        showNotification('Departure and destination must be different stops', 'error');
        return;
    }
    
    // Show loading
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div class="text-center">Loading trips...</div>';
    
    Promise.all([
        api.getRoutes(),
        availableRouteStops.length ? Promise.resolve(availableRouteStops) : api.getRouteStops()
    ])
        .then(([routes, routeStops]) => {
            availableRouteStops = routeStops;
            const matchingRoutes = filterRoutesByStops(routes, routeStops, from, to);
            displayRouteResults(matchingRoutes, from, to, date);
        })
        .catch(error => {
            resultsContainer.innerHTML = `<div class="text-center text-error">Error: ${error.message}</div>`;
        });
}

function loadSearchStops() {
    const fromSelect = document.getElementById('fromLocation');
    const toSelect = document.getElementById('toLocation');

    if (!fromSelect || !toSelect) {
        return;
    }

    if (availableStops.length) {
        populateStopOptions(availableStops);
        return;
    }

    fromSelect.innerHTML = '<option value="">Loading departure stops...</option>';
    toSelect.innerHTML = '<option value="">Loading destination stops...</option>';

    api.getStops()
        .then(stops => {
            availableStops = stops.filter(stop => stop.is_active !== false);
            populateStopOptions(availableStops);
        })
        .catch(error => {
            fromSelect.innerHTML = '<option value="">Unable to load stops</option>';
            toSelect.innerHTML = '<option value="">Unable to load stops</option>';
            showNotification(`Unable to load stops: ${error.message}`, 'error');
        });
}

function populateStopOptions(stops) {
    const fromSelect = document.getElementById('fromLocation');
    const toSelect = document.getElementById('toLocation');

    if (!fromSelect || !toSelect) {
        return;
    }

    const currentFrom = fromSelect.value;
    const currentTo = toSelect.value;
    const options = ['<option value="">Select stop</option>']
        .concat(stops.map(stop => `<option value="${stop.id}">${stop.name}</option>`))
        .join('');

    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;

    if (stops.some(stop => stop.id === currentFrom)) {
        fromSelect.value = currentFrom;
    }

    if (stops.some(stop => stop.id === currentTo)) {
        toSelect.value = currentTo;
    }
}

function filterRoutesByStops(routes, routeStops, fromStopId, toStopId) {
    return routes.reduce((matches, route) => {
        const stopsForRoute = routeStops
            .filter(routeStop => routeStop.route_id === route.id)
            .sort((a, b) => a.stop_order - b.stop_order);
        const fromIndex = stopsForRoute.findIndex(routeStop => routeStop.stop_id === fromStopId);
        const toIndex = stopsForRoute.findIndex(routeStop => routeStop.stop_id === toStopId);

        if (fromIndex === -1 || toIndex === -1 || toIndex <= fromIndex) {
            return matches;
        }

        const segment = stopsForRoute.slice(fromIndex, toIndex + 1);
        const startMinutes = segment[0].estimated_minutes_from_start || 0;
        const endMinutes = segment[segment.length - 1].estimated_minutes_from_start || 0;

        matches.push({
            ...route,
            matched_segment: segment,
            estimated_minutes: Math.max(endMinutes - startMinutes, 0)
        });

        return matches;
    }, []);
}

function getStopName(stopId) {
    const stop = availableStops.find(item => item.id === stopId);
    return stop ? stop.name : 'Unknown stop';
}

function displayRouteResults(routes, fromStopId, toStopId, date) {
    const resultsContainer = document.getElementById('search-results');
    const fromStopName = getStopName(fromStopId);
    const toStopName = getStopName(toStopId);
    
    if (routes.length === 0) {
        resultsContainer.innerHTML = `<div class="text-center">No routes found from ${fromStopName} to ${toStopName} for ${date}</div>`;
        return;
    }
    
    let html = '<div class="trips-grid">';
    
    routes.forEach(route => {
        const stopCount = route.matched_segment ? route.matched_segment.length : 0;
        html += `
            <div class="trip-card">
                <div class="trip-header">
                    <div class="trip-time">${route.route_code}</div>
                    <div class="trip-route">${route.name}</div>
                </div>
                <div class="trip-details">
                    <div class="detail-item">
                        <i class="fas fa-route"></i>
                        <span>Route ${route.route_code}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-location-arrow"></i>
                        <span>${fromStopName} to ${toStopName}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-map-signs"></i>
                        <span>${stopCount} stops on this segment</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${route.estimated_minutes} mins for this segment</span>
                    </div>
                </div>
                <div class="trip-actions">
                    <button onclick="showNotification('Booking is not available in the current backend.', 'info')" class="btn-primary">
                        Booking Unavailable
                    </button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    resultsContainer.innerHTML = html;
}

function bookTrip(tripId) {
    showNotification('Booking is not available in the current backend.', 'info');
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
    showNotification('Booking is not available in the current backend.', 'info');
}

function loadUserBookings() {
    const container = document.getElementById('bookings-list');
    container.innerHTML = '<div class="text-center">Bookings are not available in the current backend.</div>';
}

function loadNotifications() {
    const container = document.getElementById('notifications-list');
    container.innerHTML = '<div class="text-center">Notifications are not available in the current backend.</div>';
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
    console.log('Socket features are not available in the current backend.');
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
