// Driver Dashboard Logic
let driverMap = null;
let driverSelfMarker = null;
let driverBusMarkers = [];
// let gpsWatchId = null;
// let isGPSTracking = false;
let currentGPSLocationId = null;   // id of the BusLocation record we're PATCHing
let currentEditTripId = null;      // null = new, string = editing
let currentEditBusId = null;       // null = new, string = editing
let driverTrips = [];
let driverBusList = [];
let driverRouteList = [];

// ── Dashboard entry ─────────────────────────────────────────────────────────

function showDriverDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('driver-dashboard').classList.add('active');
    document.getElementById('passenger-dashboard').classList.remove('active');

    document.getElementById('driverName').textContent = currentUser.full_name;

    loadTodayTrips();
    showDriverSection('trips');
}

function showDriverSection(section) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById(`driver-${section}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`[onclick="showDriverSection('${section}')"]`);
    if (activeNav) activeNav.classList.add('active');

    if (section === 'gps') {
        populateGPSTripSelect();
        initDriverGPSMap();
    }
    if (section === 'buses') {
        loadDriverBuses();
    }
}

// ── TODAY'S TRIPS ────────────────────────────────────────────────────────────

function loadTodayTrips() {
    const container = document.getElementById('trips-list');
    container.innerHTML = '<div class="text-center">Loading trips…</div>';

    api.getTrips({ driver_id: currentUser.id })
        .then(trips => {
            driverTrips = trips;
            renderTripsList(trips);
        })
        .catch(err => {
            container.innerHTML = `<div class="text-center text-error">Failed to load trips: ${err.message}</div>`;
        });
}

function renderTripsList(trips) {
    const container = document.getElementById('trips-list');

    if (!trips.length) {
        container.innerHTML = '<div class="text-center">No trips assigned to you yet.</div>';
        return;
    }

    const html = trips.map(trip => `
        <div class="trip-card" id="trip-card-${trip.id}">
            <div class="trip-header">
                <div>
                    <div class="trip-time">${formatDateTime(trip.departure_time)}</div>
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
                    <span>Arrives ${formatDateTime(trip.arrival_time)}</span>
                </div>` : ''}
            </div>
            <div class="trip-actions">
                <button onclick="openTripModal('${trip.id}')" class="btn-secondary" style="flex:1">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="confirmDeleteTrip('${trip.id}')" class="btn-danger" style="flex:1">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-RW', { dateStyle: 'short', timeStyle: 'short' });
}

// ── MY BUSES ─────────────────────────────────────────────────────────────────

function loadDriverBuses() {
    const container = document.getElementById('buses-list');
    container.innerHTML = '<div class="text-center">Loading buses…</div>';

    api.getBuses({ is_active: 'true' })
        .then(buses => {
            const myBuses = buses.filter(b => b.managed_by === currentUser.id);
            if (!myBuses.length) {
                container.innerHTML = '<div class="text-center">No buses assigned to you yet.</div>';
                return;
            }
            container.innerHTML = myBuses.map(bus => `
                <div class="trip-card" id="bus-card-${bus.id}">
                    <div class="trip-header">
                        <div>
                            <div class="trip-time">${bus.plate_number}</div>
                            <div class="trip-route">${bus.bus_type || 'Bus'}</div>
                        </div>
                        <span class="status-badge status-${bus.is_active ? 'scheduled' : 'cancelled'}">${bus.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div class="trip-details">
                        <div class="detail-item">
                            <i class="fas fa-chair"></i>
                            <span>${bus.capacity} seats</span>
                        </div>
                        ${bus.make_model ? `
                        <div class="detail-item">
                            <i class="fas fa-info-circle"></i>
                            <span>${bus.make_model}</span>
                        </div>` : ''}
                    </div>
                    <div class="trip-actions">
                        <button onclick="openBusModal('${bus.id}')" class="btn-secondary" style="flex:1">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button onclick="confirmDeleteBus('${bus.id}')" class="btn-danger" style="flex:1">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `).join('');
        })
        .catch(err => {
            container.innerHTML = `<div class="text-center text-error">Failed to load buses: ${err.message}</div>`;
        });
}

// ── BUS MODAL (Add / Edit) ───────────────────────────────────────────────────

function openBusModal(busId = null) {
    currentEditBusId = busId;
    const modal = document.getElementById('driver-bus-modal');
    const title = document.getElementById('driver-bus-modal-title');
    const form = document.getElementById('driver-bus-form');

    form.reset();
    title.textContent = busId ? 'Edit Bus' : 'Add Bus';

    if (busId) {
        const bus = driverBusList.find(b => b.id === busId);
        if (bus) {
            document.getElementById('bus-form-plate').value = bus.plate_number || '';
            document.getElementById('bus-form-type').value = bus.bus_type || '';
            document.getElementById('bus-form-capacity').value = bus.capacity || '';
            document.getElementById('bus-form-make-model').value = bus.make_model || '';
            document.getElementById('bus-form-status').value = bus.is_active ? 'true' : 'false';
        }
    }

    modal.classList.add('active');
}

function closeBusModal() {
    document.getElementById('driver-bus-modal').classList.remove('active');
    currentEditBusId = null;
}

function saveBusForm(event) {
    event.preventDefault();

    const plate = document.getElementById('bus-form-plate').value.trim();
    const busType = document.getElementById('bus-form-type').value.trim();
    const capacity = parseInt(document.getElementById('bus-form-capacity').value);
    const makeModel = document.getElementById('bus-form-make-model').value.trim();
    const isActive = document.getElementById('bus-form-status').value === 'true';

    if (!plate || !capacity) {
        showNotification('Plate number and capacity are required.', 'error');
        return;
    }

    const data = {
        plate_number: plate,
        bus_type: busType || null,
        capacity: capacity,
        make_model: makeModel || null,
        is_active: isActive,
        managed_by: currentUser.id
    };

    const saveBtn = document.getElementById('bus-form-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    const action = currentEditBusId
        ? api.updateBus(currentEditBusId, data)
        : api.createBus(data);

    action
        .then(() => {
            showNotification(currentEditBusId ? 'Bus updated.' : 'Bus added.', 'success');
            closeBusModal();
            driverBusList = [];   // clear cache so next load is fresh
            loadDriverBuses();
        })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Bus';
        });
}

function confirmDeleteBus(busId) {
    if (!confirm('Delete this bus? This cannot be undone.')) return;

    api.deleteBus(busId)
        .then(() => {
            showNotification('Bus deleted.', 'success');
            driverBusList = [];   // clear cache
            loadDriverBuses();
        })
        .catch(err => showNotification('Error: ' + err.message, 'error'));
}

// ── TRIP MODAL (Add / Edit) ──────────────────────────────────────────────────

function openTripModal(tripId = null) {
    currentEditTripId = tripId;
    const modal = document.getElementById('driver-trip-modal');
    const title = document.getElementById('driver-trip-modal-title');
    const form = document.getElementById('driver-trip-form');

    form.reset();
    title.textContent = tripId ? 'Edit Trip' : 'Add Trip';

    // Load buses and routes, then optionally populate form fields
    Promise.all([
        driverBusList.length ? Promise.resolve(driverBusList) : api.getBuses({ is_active: 'true' }),
        driverRouteList.length ? Promise.resolve(driverRouteList) : api.getRoutes({ is_active: 'true' })
    ]).then(([buses, routes]) => {
        driverBusList = buses;
        driverRouteList = routes;

        const busSelect = document.getElementById('trip-form-bus');
        const routeSelect = document.getElementById('trip-form-route');

        // Only show buses that have been assigned to an admin (managed_by is set)
        const managedBuses = buses.filter(b => b.managed_by === currentUser.id);

        if (managedBuses.length === 0) {
            busSelect.innerHTML = '<option value="">No buses available</option>';
        } else {
            busSelect.innerHTML = '<option value="">Select bus</option>' +
                managedBuses.map(b => `<option value="${b.id}">${b.plate_number} (${b.bus_type || 'Bus'}, ${b.capacity} seats)</option>`).join('');
        }

        routeSelect.innerHTML = '<option value="">Select route</option>' +
            routes.map(r => `<option value="${r.id}">${r.route_code} — ${r.name}</option>`).join('');

        if (tripId) {
            const trip = driverTrips.find(t => t.id === tripId);
            if (trip) {
                populateTripForm(trip, managedBuses, routes);
            }
        }

        modal.classList.add('active');
    }).catch(err => {
        showNotification('Failed to load form data: ' + err.message, 'error');
    });
}

function populateTripForm(trip, buses, routes) {
    // Match bus by plate_number since to_dict returns plate not id
    const matchedBus = buses.find(b => b.plate_number === trip.bus_plate);
    const matchedRoute = routes.find(r => r.name === trip.route_name);

    if (matchedBus) document.getElementById('trip-form-bus').value = matchedBus.id;
    if (matchedRoute) document.getElementById('trip-form-route').value = matchedRoute.id;

    document.getElementById('trip-form-departure').value = toDatetimeLocal(trip.departure_time);
    document.getElementById('trip-form-arrival').value = trip.arrival_time ? toDatetimeLocal(trip.arrival_time) : '';
    document.getElementById('trip-form-capacity').value = trip.available_seats;
    document.getElementById('trip-form-status').value = trip.status;
}

function toDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    // Format: YYYY-MM-DDTHH:MM
    return d.toISOString().slice(0, 16);
}

function closeTripModal() {
    document.getElementById('driver-trip-modal').classList.remove('active');
    currentEditTripId = null;
}

function saveTripForm(event) {
    event.preventDefault();

    const busId = document.getElementById('trip-form-bus').value;
    const routeId = document.getElementById('trip-form-route').value;
    const departure = document.getElementById('trip-form-departure').value;
    const arrival = document.getElementById('trip-form-arrival').value;
    const capacity = parseInt(document.getElementById('trip-form-capacity').value);
    const status = document.getElementById('trip-form-status').value;

    if (!busId || !routeId || !departure || !capacity) {
        showNotification('Please fill in all required fields.', 'error');
        return;
    }

    const data = {
        bus_id: busId,
        route_id: routeId,
        departure_time: new Date(departure).toISOString(),
        arrival_time: arrival ? new Date(arrival).toISOString() : null,
        current_capacity: capacity,
        status: status
    };

    const saveBtn = document.getElementById('trip-form-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    const action = currentEditTripId
        ? api.updateTrip(currentEditTripId, data)
        : api.createTrip(data);

    action
        .then(() => {
            showNotification(currentEditTripId ? 'Trip updated.' : 'Trip created.', 'success');
            closeTripModal();
            loadTodayTrips();
        })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Trip';
        });
}

function confirmDeleteTrip(tripId) {
    if (!confirm('Delete this trip? This cannot be undone.')) return;

    api.deleteTrip(tripId)
        .then(() => {
            showNotification('Trip deleted.', 'success');
            loadTodayTrips();
        })
        .catch(err => showNotification('Error: ' + err.message, 'error'));
}

// ── GPS TRACKING MAP ─────────────────────────────────────────────────────────

function populateGPSTripSelect() {
    const select = document.getElementById('gps-trip-select');
    if (!select) return;

    const current = select.value;
    select.innerHTML = '<option value="">— Select your active trip —</option>' +
        driverTrips
            .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
            .map(t => `<option value="${t.id}" data-bus-plate="${t.bus_plate}">${t.route_name} · ${formatDateTime(t.departure_time)}</option>`)
            .join('');

    if (current) select.value = current;
}

function initDriverGPSMap() {
    if (driverMap) {
        refreshDriverBusMarkers();
        return;
    }

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

    driverMap.on('load', () => {
        refreshDriverBusMarkers();
    });
}

function centerDriverMap() {
    if (!driverMap) return;
    driverMap.flyTo({ center: CONFIG.DEFAULT_CENTER, zoom: CONFIG.DEFAULT_ZOOM, essential: true });
}

function refreshDriverBusMarkers() {
    if (!driverMap) return;

    driverBusMarkers.forEach(m => m.remove());
    driverBusMarkers = [];

    api.getBusLocations()
        .then(locations => {
            locations.forEach(loc => {
                if (!loc.latitude || !loc.longitude) return;

                const el = document.createElement('div');
                el.className = 'bus-marker';
                el.innerHTML = '<i class="fas fa-bus"></i>';

                const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
                    <div class="popup-content">
                        <h4><i class="fas fa-bus"></i> Bus</h4>
                        <p>Trip: ${loc.trip_id.slice(0, 8)}…</p>
                        <p>Speed: ${loc.speed != null ? loc.speed + ' km/h' : '—'}</p>
                        <p>Heading: ${loc.heading != null ? loc.heading + '°' : '—'}</p>
                        <small>Updated: ${loc.captured_at ? new Date(loc.captured_at).toLocaleTimeString() : '—'}</small>
                    </div>
                `);

                const marker = new maplibregl.Marker(el)
                    .setLngLat([parseFloat(loc.longitude), parseFloat(loc.latitude)])
                    .setPopup(popup)
                    .addTo(driverMap);

                driverBusMarkers.push(marker);
            });
        })
        .catch(() => { /* silent fail — map still works without locations */ });
}

// ── GPS TRACKING (geolocation → API) ─────────────────────────────────────────

function startGPSTracking() {
    if (isGPSTracking) return;

    const tripId = document.getElementById('gps-trip-select').value;
    if (!tripId) {
        showNotification('Select a trip before starting tracking.', 'error');
        return;
    }

    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser.', 'error');
        return;
    }

    isGPSTracking = true;
    currentGPSLocationId = null;

    const indicator = document.getElementById('gps-status-indicator');
    if (indicator) {
        indicator.className = 'status-indicator active';
        indicator.innerHTML = '<i class="fas fa-circle"></i><span>Active</span>';
    }

    gpsWatchId = navigator.geolocation.watchPosition(
        position => {
            const { latitude, longitude, speed, heading } = position.coords;
            const speedKmh = speed != null ? (speed * 3.6).toFixed(1) : null;

            // Update UI coordinates
            const latEl = document.getElementById('current-lat');
            const lngEl = document.getElementById('current-lng');
            const spdEl = document.getElementById('current-speed');
            const updEl = document.getElementById('last-update');
            if (latEl) latEl.textContent = latitude.toFixed(6);
            if (lngEl) lngEl.textContent = longitude.toFixed(6);
            if (spdEl) spdEl.textContent = speedKmh != null ? `${speedKmh} km/h` : '— km/h';
            if (updEl) updEl.textContent = new Date().toLocaleTimeString();

            // Move or create driver's own marker on the map
            updateDriverSelfMarker(latitude, longitude);

            // Push location to the API
            pushLocationToAPI(tripId, latitude, longitude, speedKmh, heading);
        },
        err => {
            showNotification('Location error: ' + err.message, 'error');
            stopGPSTracking();
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

function stopGPSTracking() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    isGPSTracking = false;
    currentGPSLocationId = null;

    const indicator = document.getElementById('gps-status-indicator');
    if (indicator) {
        indicator.className = 'status-indicator inactive';
        indicator.innerHTML = '<i class="fas fa-circle"></i><span>Inactive</span>';
    }

    const latEl = document.getElementById('current-lat');
    const lngEl = document.getElementById('current-lng');
    const spdEl = document.getElementById('current-speed');
    const updEl = document.getElementById('last-update');
    if (latEl) latEl.textContent = '--';
    if (lngEl) lngEl.textContent = '--';
    if (spdEl) spdEl.textContent = '-- km/h';
    if (updEl) updEl.textContent = '--';
}

function updateDriverSelfMarker(lat, lng) {
    if (!driverMap) return;

    if (!driverSelfMarker) {
        const el = document.createElement('div');
        el.className = 'bus-marker driver-self-marker';
        el.innerHTML = '<i class="fas fa-user"></i>';
        el.title = 'Your location';

        driverSelfMarker = new maplibregl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(driverMap);
    } else {
        driverSelfMarker.setLngLat([lng, lat]);
    }

    // Pan map to keep driver in view
    driverMap.easeTo({ center: [lng, lat], duration: 500 });
}

function pushLocationToAPI(tripId, lat, lng, speed, heading) {
    const trip = driverTrips.find(t => t.id === tripId);
    if (!trip) return;

    // Find the bus_id by matching the bus plate from the trip
    const bus = driverBusList.find(b => b.plate_number === trip.bus_plate);
    if (!bus) return;

    const payload = {
        latitude: lat,
        longitude: lng,
        speed: speed != null ? parseFloat(speed) : null,
        heading: heading != null ? heading : null
    };

    if (currentGPSLocationId) {
        // Update existing record
        api.updateBusLocation(currentGPSLocationId, payload).catch(() => {
            // If update fails, reset so next tick tries to create again
            currentGPSLocationId = null;
        });
    } else {
        // Create a new location record for this trip
        api.createBusLocation({
            bus_id: bus.id,
            trip_id: tripId,
            ...payload
        }).then(loc => {
            currentGPSLocationId = loc.id;
        }).catch(() => { /* silent — will retry next tick */ });
    }
}

// ── Manifest (legacy, kept for QR scanner section) ───────────────────────────

function loadManifest() {
    const tripId = document.getElementById('tripSelect').value;
    const container = document.getElementById('manifest-list');

    if (!tripId) {
        container.innerHTML = '<div class="text-center">Select a trip above.</div>';
        return;
    }

    container.innerHTML = '<div class="text-center">Loading passengers…</div>';

    api.getTripManifest(tripId)
        .then(bookings => {
            if (!bookings.length) {
                container.innerHTML = '<div class="text-center">No passengers booked for this trip.</div>';
                return;
            }
            container.innerHTML = bookings.map(b => `
                <div class="trip-card">
                    <div class="passenger-header">
                        <div class="passenger-avatar"><i class="fas fa-user"></i></div>
                        <div class="passenger-info">
                            <h4>Booking #${b.id.slice(0, 8)}</h4>
                            <p>${b.status}</p>
                        </div>
                        ${b.seat_number ? `<span class="seat-badge">Seat ${b.seat_number}</span>` : ''}
                    </div>
                    <div class="passenger-details">
                        <p><i class="fas fa-map-marker-alt"></i> ${b.pickup_stop || '—'} → ${b.dropoff_stop || '—'}</p>
                        <p><i class="fas fa-clock"></i> Boarded: ${b.boarded_at ? new Date(b.boarded_at).toLocaleTimeString() : 'Not yet'}</p>
                    </div>
                </div>
            `).join('');
        })
        .catch(err => {
            container.innerHTML = `<div class="text-center text-error">Error: ${err.message}</div>`;
        });
}

function startScanner() {
    const video = document.getElementById('scanner-video');
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            showNotification('Scanner started.', 'success');
        })
        .catch(() => showNotification('Camera access denied.', 'error'));
}

function stopScanner() {
    const video = document.getElementById('scanner-video');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

function scanQRCode() {
    document.getElementById('scan-result').innerHTML = `
        <div class="scan-success">
            <i class="fas fa-check-circle"></i>
            <h4>Scan result</h4>
            <p>Ticket verification requires a QR library integration.</p>
        </div>
    `;
}

function markBoarded() {
    showNotification('Ticket verification is not yet implemented.', 'info');
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const tripForm = document.getElementById('driver-trip-form');
    if (tripForm) tripForm.addEventListener('submit', saveTripForm);

    const busForm = document.getElementById('driver-bus-form');
    if (busForm) busForm.addEventListener('submit', saveBusForm);
});
