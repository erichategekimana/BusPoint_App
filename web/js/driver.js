// Driver Dashboard Logic
let driverMap = null;
let driverSelfMarker = null;
let driverBusMarkers = [];
let driverGPSWatchId = null;
let isDriverGPSTracking = false;
let driverGPSLocationId = null;
let driverTrips = [];
let driverBusList = [];

// ── Dashboard entry ─────────────────────────────────────────────────────────

function showDriverDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('driver-dashboard').classList.add('active');
    document.getElementById('passenger-dashboard').classList.remove('active');
    document.getElementById('admin-dashboard').classList.remove('active');

    document.getElementById('driverName').textContent = currentUser.full_name;

    loadDriverTrips();
    showDriverSection('trips');
}

function showDriverSection(section) {
    document.querySelectorAll('#driver-dashboard .section').forEach(el => el.classList.remove('active'));
    document.getElementById(`driver-${section}`).classList.add('active');

    document.querySelectorAll('#driver-dashboard .nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`#driver-dashboard [onclick="showDriverSection('${section}')"]`);
    if (activeNav) activeNav.classList.add('active');

    if (section === 'gps') {
        populateDriverGPSTripSelect();
        initDriverGPSMap();
    }
}

// ── MY TRIPS ────────────────────────────────────────────────────────────────

function loadDriverTrips() {
    const container = document.getElementById('driver-trips-list');
    container.innerHTML = '<div class="text-center">Loading trips…</div>';

    api.getTrips({ assigned_to: currentUser.id })
        .then(trips => {
            driverTrips = trips;
            renderDriverTripsList(trips);
        })
        .catch(err => {
            container.innerHTML = `<div class="text-center text-error">Failed to load trips: ${err.message}</div>`;
        });
}

function renderDriverTripsList(trips) {
    const container = document.getElementById('driver-trips-list');

    if (!trips.length) {
        container.innerHTML = '<div class="text-center">No trips assigned to you yet.</div>';
        return;
    }

    const html = trips.map(trip => {
        const canStart = trip.status === 'scheduled';
        const canStop = trip.status === 'in_progress';
        const isDone = trip.status === 'completed' || trip.status === 'cancelled';

        return `
        <div class="trip-card" id="driver-trip-card-${trip.id}">
            <div class="trip-header">
                <div>
                    <div class="trip-time">${formatDriverDateTime(trip.departure_time)}</div>
                    <div class="trip-route">${trip.route_name}</div>
                </div>
                <span class="status-badge status-${trip.status}">${trip.status}</span>
            </div>
            <div class="trip-details">
                <div class="detail-item">
                    <i class="fas fa-bus"></i>
                    <span>${trip.bus_plate}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-chair"></i>
                    <span>${trip.available_seats} seats</span>
                </div>
                ${trip.arrival_time ? `
                <div class="detail-item">
                    <i class="fas fa-flag-checkered"></i>
                    <span>Arrives ${formatDriverDateTime(trip.arrival_time)}</span>
                </div>` : ''}
            </div>
            <div class="trip-actions">
                ${canStart ? `
                <button onclick="startTrip('${trip.id}')" class="btn-primary" style="flex:1">
                    <i class="fas fa-play"></i> Start Trip
                </button>` : ''}
                ${canStop ? `
                <button onclick="stopTrip('${trip.id}')" class="btn-danger" style="flex:1">
                    <i class="fas fa-stop"></i> Complete Trip
                </button>` : ''}
                ${isDone ? `
                <span style="color:#888;font-size:13px;padding:8px">Trip ${trip.status}</span>` : ''}
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
}

function formatDriverDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-RW', { dateStyle: 'short', timeStyle: 'short' });
}

function startTrip(tripId) {
    if (!confirm('Start this trip? Status will change to In Progress.')) return;

    api.updateTrip(tripId, { status: 'in_progress' })
        .then(() => {
            showNotification('Trip started!', 'success');
            loadDriverTrips();
        })
        .catch(err => showNotification('Error: ' + err.message, 'error'));
}

function stopTrip(tripId) {
    if (!confirm('Complete this trip? Status will change to Completed.')) return;

    api.updateTrip(tripId, { status: 'completed' })
        .then(() => {
            showNotification('Trip completed!', 'success');
            loadDriverTrips();
        })
        .catch(err => showNotification('Error: ' + err.message, 'error'));
}

// ── GPS TRACKING MAP ─────────────────────────────────────────────────────────

function populateDriverGPSTripSelect() {
    const select = document.getElementById('driver-gps-trip-select');
    if (!select) return;

    const current = select.value;
    select.innerHTML = '<option value="">— Select your active trip —</option>' +
        driverTrips
            .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
            .map(t => `<option value="${t.id}" data-bus-plate="${t.bus_plate}">${t.route_name} · ${formatDriverDateTime(t.departure_time)}</option>`)
            .join('');

    if (current) select.value = current;
}

function initDriverGPSMap() {
    if (driverMap) return;

    if (!window.maplibregl) {
        const container = document.getElementById('driver-map');
        if (container) container.innerHTML = '<div class="text-center">Map unavailable (MapLibre not loaded).</div>';
        return;
    }

    const styleUrl = (typeof buildStadiaStyleUrl === 'function')
        ? buildStadiaStyleUrl()
        : (CONFIG.MAP_STYLE_URL || 'https://tiles.stadiamaps.com/styles/alidade_smooth.json');

    driverMap = new maplibregl.Map({
        container: 'driver-map',
        style: styleUrl,
        center: CONFIG.DEFAULT_CENTER,
        zoom: CONFIG.DEFAULT_ZOOM
    });

    driverMap.addControl(new maplibregl.NavigationControl(), 'top-right');
}

function centerDriverMap() {
    if (!driverMap) return;
    driverMap.flyTo({ center: CONFIG.DEFAULT_CENTER, zoom: CONFIG.DEFAULT_ZOOM, essential: true });
}

// ── GPS TRACKING (geolocation → API) ─────────────────────────────────────────

function startDriverGPS() {
    if (isDriverGPSTracking) return;

    const tripId = document.getElementById('driver-gps-trip-select').value;
    if (!tripId) {
        showNotification('Select a trip before starting tracking.', 'error');
        return;
    }

    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser.', 'error');
        return;
    }

    isDriverGPSTracking = true;
    driverGPSLocationId = null;

    const indicator = document.getElementById('driver-gps-status-indicator');
    if (indicator) {
        indicator.className = 'status-indicator active';
        indicator.innerHTML = '<i class="fas fa-circle"></i><span>Active</span>';
    }

    // Load buses for bus_id lookup
    api.getBuses().then(buses => { driverBusList = buses; }).catch(() => {});

    driverGPSWatchId = navigator.geolocation.watchPosition(
        position => {
            const { latitude, longitude, speed, heading } = position.coords;
            const speedKmh = speed != null ? (speed * 3.6).toFixed(1) : null;

            const latEl = document.getElementById('driver-current-lat');
            const lngEl = document.getElementById('driver-current-lng');
            const spdEl = document.getElementById('driver-current-speed');
            const updEl = document.getElementById('driver-last-update');
            if (latEl) latEl.textContent = latitude.toFixed(6);
            if (lngEl) lngEl.textContent = longitude.toFixed(6);
            if (spdEl) spdEl.textContent = speedKmh != null ? `${speedKmh} km/h` : '— km/h';
            if (updEl) updEl.textContent = new Date().toLocaleTimeString();

            updateDriverSelfMarker(latitude, longitude);
            pushDriverLocationToAPI(tripId, latitude, longitude, speedKmh, heading);
        },
        err => {
            showNotification('Location error: ' + err.message, 'error');
            stopDriverGPS();
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

function stopDriverGPS() {
    if (driverGPSWatchId !== null) {
        navigator.geolocation.clearWatch(driverGPSWatchId);
        driverGPSWatchId = null;
    }

    isDriverGPSTracking = false;
    driverGPSLocationId = null;

    const indicator = document.getElementById('driver-gps-status-indicator');
    if (indicator) {
        indicator.className = 'status-indicator inactive';
        indicator.innerHTML = '<i class="fas fa-circle"></i><span>Inactive</span>';
    }

    ['driver-current-lat', 'driver-current-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '--';
    });
    const spdEl = document.getElementById('driver-current-speed');
    if (spdEl) spdEl.textContent = '-- km/h';
    const updEl = document.getElementById('driver-last-update');
    if (updEl) updEl.textContent = '--';
}

function updateDriverSelfMarker(lat, lng) {
    if (!driverMap) return;

    if (!driverSelfMarker) {
        const el = document.createElement('div');
        el.className = 'bus-marker admin-self-marker';
        el.innerHTML = '<i class="fas fa-user"></i>';
        el.title = 'Your location';

        driverSelfMarker = new maplibregl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(driverMap);
    } else {
        driverSelfMarker.setLngLat([lng, lat]);
    }

    driverMap.easeTo({ center: [lng, lat], duration: 500 });
}

function pushDriverLocationToAPI(tripId, lat, lng, speed, heading) {
    const trip = driverTrips.find(t => t.id === tripId);
    if (!trip) return;

    const bus = driverBusList.find(b => b.plate_number === trip.bus_plate);
    if (!bus) return;

    const payload = {
        latitude: lat,
        longitude: lng,
        speed: speed != null ? parseFloat(speed) : null,
        heading: heading != null ? heading : null
    };

    if (driverGPSLocationId) {
        api.updateBusLocation(driverGPSLocationId, payload).catch(() => {
            driverGPSLocationId = null;
        });
    } else {
        api.createBusLocation({
            bus_id: bus.id,
            trip_id: tripId,
            ...payload
        }).then(loc => {
            driverGPSLocationId = loc.id;
        }).catch(() => {});
    }
}
