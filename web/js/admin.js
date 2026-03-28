// Admin Dashboard Logic
let adminMap = null;
let adminSelfMarker = null;
let adminBusMarkers = {};          // keyed by bus_id → marker (persistent, no flicker)
let adminRouteLinesDrawn = {};     // keyed by trip_id → 'fetching' | 'drawn' | false
let adminStopMarkers = [];         // stop dot markers on admin map
let adminBusLocationInterval = null;
// let gpsWatchId = null;
// let isGPSTracking = false;
let currentGPSLocationId = null;   // id of the BusLocation record we're PATCHing
let currentEditTripId = null;      // null = new, string = editing
let currentEditBusId = null;       // null = new, string = editing
let adminTrips = [];
let adminBusList = [];
let adminRouteList = [];

// ── Dashboard entry ─────────────────────────────────────────────────────────

function showAdminDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.add('active');
    document.getElementById('passenger-dashboard').classList.remove('active');
    document.getElementById('driver-dashboard').classList.remove('active');

    document.getElementById('adminName').textContent = currentUser.full_name;

    loadTodayTrips();
    showAdminSection('trips');
}

function showAdminSection(section) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById(`admin-${section}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`[onclick="showAdminSection('${section}')"]`);
    if (activeNav) activeNav.classList.add('active');

    if (section === 'gps') {
        populateGPSTripSelect();
        initAdminGPSMap();
    } else {
        stopAdminBusPolling();
    }
    if (section === 'buses') {
        loadAdminBuses();
    }
    if (section === 'profile') loadAdminProfile();
}

// ── TODAY'S TRIPS ────────────────────────────────────────────────────────────

function loadTodayTrips() {
    const container = document.getElementById('trips-list');
    container.innerHTML = '<div class="text-center">Loading trips…</div>';

    api.getTrips({ company: currentUser.company })
        .then(trips => {
            adminTrips = trips;
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
                <span class="status-badge status-${trip.status}">${trip.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
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

function loadAdminBuses() {
    const container = document.getElementById('buses-list');
    container.innerHTML = '<div class="text-center">Loading buses…</div>';

    api.getBuses({ is_active: 'true' })
        .then(buses => {
            const myBuses = buses.filter(b => b.company && b.company === currentUser.company);
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
    const modal = document.getElementById('admin-bus-modal');
    const title = document.getElementById('admin-bus-modal-title');
    const form = document.getElementById('admin-bus-form');

    form.reset();
    title.textContent = busId ? 'Edit Bus' : 'Add Bus';

    if (busId) {
        const bus = adminBusList.find(b => b.id === busId);
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
    document.getElementById('admin-bus-modal').classList.remove('active');
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
        company: currentUser.company || null
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
            adminBusList = [];   // clear cache so next load is fresh
            loadAdminBuses();
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

    const btn = document.querySelector(`button[onclick="confirmDeleteBus('${busId}')"]`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    api.deleteBus(busId)
        .then(() => {
            showNotification('Bus deleted.', 'success');
            adminBusList = [];
            loadAdminBuses();
        })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i>'; }
        });
}

// ── TRIP MODAL (Add / Edit) ──────────────────────────────────────────────────

function openTripModal(tripId = null) {
    currentEditTripId = tripId;
    const modal = document.getElementById('admin-trip-modal');
    const title = document.getElementById('admin-trip-modal-title');
    const form = document.getElementById('admin-trip-form');
    const statusGroup = document.getElementById('trip-form-status-group');

    form.reset();
    title.textContent = tripId ? 'Edit Trip' : 'Add Trip';

    // Hide status dropdown when creating (auto-set to 'scheduled')
    // Show it only when editing with valid transitions
    statusGroup.style.display = tripId ? '' : 'none';

    // Load buses, routes, and drivers, then optionally populate form fields
    Promise.all([
        adminBusList.length ? Promise.resolve(adminBusList) : api.getBuses({ is_active: 'true' }),
        adminRouteList.length ? Promise.resolve(adminRouteList) : api.getRoutes({ is_active: 'true' }),
        api.request('/users?role=driver').catch(() => [])
    ]).then(([buses, routes, drivers]) => {
        adminBusList = buses;
        adminRouteList = routes;

        const busSelect = document.getElementById('trip-form-bus');
        const routeSelect = document.getElementById('trip-form-route');
        const driverSelect = document.getElementById('trip-form-driver');

        // Only show buses belonging to the admin's company
        const companyBuses = buses.filter(b => b.company && b.company === currentUser.company);

        if (companyBuses.length === 0) {
            busSelect.innerHTML = '<option value="">No buses available</option>';
        } else {
            busSelect.innerHTML = '<option value="">Select bus</option>' +
                companyBuses.map(b => `<option value="${b.id}">${b.plate_number} (${b.bus_type || 'Bus'}, ${b.capacity} seats)</option>`).join('');
        }

        routeSelect.innerHTML = '<option value="">Select route</option>' +
            routes.map(r => `<option value="${r.id}">${r.route_code} — ${r.name}</option>`).join('');

        // Populate driver select — show drivers from same company
        if (driverSelect) {
            const companyDrivers = drivers.filter(d => d.company && d.company === currentUser.company);
            driverSelect.innerHTML = '<option value="">Assign to self</option>' +
                companyDrivers.map(d => `<option value="${d.id}">${d.full_name} (${d.phone_number})</option>`).join('');
        }

        if (tripId) {
            const trip = adminTrips.find(t => t.id === tripId);
            if (trip) {
                populateTripForm(trip, companyBuses, routes);
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

    // Build status options based on valid transitions from current status
    const statusSelect = document.getElementById('trip-form-status');
    const transitions = {
        scheduled:   ['scheduled', 'in_progress', 'cancelled'],
        in_progress: ['in_progress', 'completed'],
        completed:   ['completed'],
        cancelled:   ['cancelled']
    };
    const labels = {
        scheduled: 'Scheduled',
        in_progress: 'In Progress',
        completed: 'Completed',
        cancelled: 'Cancelled'
    };
    const allowed = transitions[trip.status] || [trip.status];
    statusSelect.innerHTML = allowed
        .map(s => `<option value="${s}"${s === trip.status ? ' selected' : ''}>${labels[s]}</option>`)
        .join('');
}

function toDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    // Format: YYYY-MM-DDTHH:MM
    return d.toISOString().slice(0, 16);
}

function closeTripModal() {
    document.getElementById('admin-trip-modal').classList.remove('active');
    currentEditTripId = null;
}

function saveTripForm(event) {
    event.preventDefault();

    const busId = document.getElementById('trip-form-bus').value;
    const routeId = document.getElementById('trip-form-route').value;
    const departure = document.getElementById('trip-form-departure').value;
    const arrival = document.getElementById('trip-form-arrival').value;
    const capacity = parseInt(document.getElementById('trip-form-capacity').value);

    if (!busId || !routeId || !departure || !capacity) {
        showNotification('Please fill in all required fields.', 'error');
        return;
    }

    const driverId = document.getElementById('trip-form-driver')?.value;

    const data = {
        bus_id: busId,
        route_id: routeId,
        departure_time: new Date(departure).toISOString(),
        arrival_time: arrival ? new Date(arrival).toISOString() : null,
        current_capacity: capacity,
        status: currentEditTripId
            ? document.getElementById('trip-form-status').value
            : 'scheduled'
    };
    if (driverId) {
        data.assigned_to = driverId;
    }

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

    const btn = document.querySelector(`button[onclick="confirmDeleteTrip('${tripId}')"]`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    api.deleteTrip(tripId)
        .then(() => {
            showNotification('Trip deleted.', 'success');
            loadTodayTrips();
        })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i>'; }
        });
}

// ── GPS TRACKING MAP ─────────────────────────────────────────────────────────

function populateGPSTripSelect() {
    const select = document.getElementById('gps-trip-select');
    if (!select) return;

    const current = select.value;
    select.innerHTML = '<option value="">— Select your active trip —</option>' +
        adminTrips
            .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
            .map(t => `<option value="${t.id}" data-bus-plate="${t.bus_plate}">${t.route_name} · ${formatDateTime(t.departure_time)}</option>`)
            .join('');

    if (current) select.value = current;
}

function initAdminGPSMap() {
    if (adminMap) {
        startAdminBusPolling();
        return;
    }

    if (!window.maplibregl) {
        const container = document.getElementById('admin-map');
        if (container) container.innerHTML = '<div class="text-center">Map unavailable (MapLibre not loaded).</div>';
        return;
    }

    const styleUrl = (typeof buildStadiaStyleUrl === 'function')
        ? buildStadiaStyleUrl()
        : (CONFIG.MAP_STYLE_URL || 'https://tiles.stadiamaps.com/styles/alidade_smooth.json');

    adminMap = new maplibregl.Map({
        container: 'admin-map',
        style: styleUrl,
        center: CONFIG.DEFAULT_CENTER,
        zoom: CONFIG.DEFAULT_ZOOM
    });

    adminMap.addControl(new maplibregl.NavigationControl(), 'top-right');

    adminMap.on('load', () => {
        startAdminBusPolling();
    });
}

function startAdminBusPolling() {
    stopAdminBusPolling();
    refreshAdminBusMarkers();
    adminBusLocationInterval = setInterval(refreshAdminBusMarkers, CONFIG.BUS_LOCATION_UPDATE_INTERVAL || 5000);
}

function stopAdminBusPolling() {
    if (adminBusLocationInterval) {
        clearInterval(adminBusLocationInterval);
        adminBusLocationInterval = null;
    }
}

function centerAdminMap() {
    if (!adminMap) return;
    adminMap.flyTo({ center: CONFIG.DEFAULT_CENTER, zoom: CONFIG.DEFAULT_ZOOM, essential: true });
}

function refreshAdminBusMarkers() {
    if (!adminMap) return;

    api.getBusLocations()
        .then(locations => {
            const seen = new Set();

            locations.forEach(loc => {
                if (!loc.latitude || !loc.longitude) return;
                const busId = loc.bus_id;
                seen.add(busId);

                const lngLat = [parseFloat(loc.longitude), parseFloat(loc.latitude)];
                const updatedAt = loc['last_updated '] || loc.last_updated || new Date().toISOString();
                const popupHtml = `
                    <div class="popup-content">
                        <h4><i class="fas fa-bus"></i> Bus</h4>
                        <p>Trip: ${loc.trip_id.slice(0, 8)}…</p>
                        <p>Speed: ${loc.speed != null ? loc.speed + ' km/h' : '—'}</p>
                        <p>Heading: ${loc.heading != null ? loc.heading + '°' : '—'}</p>
                        <small>Updated: ${new Date(updatedAt).toLocaleTimeString()}</small>
                    </div>`;

                if (adminBusMarkers[busId]) {
                    // Update existing marker position (no flicker)
                    adminBusMarkers[busId].setLngLat(lngLat);
                    adminBusMarkers[busId].getPopup().setHTML(popupHtml);
                } else {
                    // Create new marker
                    const el = document.createElement('div');
                    el.className = 'bus-marker';
                    el.innerHTML = '<i class="fas fa-bus"></i>';
                    const marker = new maplibregl.Marker(el)
                        .setLngLat(lngLat)
                        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml))
                        .addTo(adminMap);
                    adminBusMarkers[busId] = marker;
                }

                // Draw route line for this bus's trip
                if (loc.trip_id) {
                    drawAdminRouteForTrip(loc.trip_id);
                }
            });

            // Remove markers for buses no longer reporting
            Object.keys(adminBusMarkers).forEach(busId => {
                if (!seen.has(busId)) {
                    adminBusMarkers[busId].remove();
                    delete adminBusMarkers[busId];
                }
            });

            // Clean up route lines for ended trips
            adminCleanupRouteLines(locations);
        })
        .catch(() => { /* silent — map still works without locations */ });
}

function drawAdminRouteForTrip(tripId) {
    const map = adminMap;
    if (!map) return;

    const sourceId = `admin-route-${tripId}`;

    // Already drawn on the map?
    if (map.getSource(sourceId)) return;

    // Already fetching?
    if (adminRouteLinesDrawn[tripId] === 'fetching') return;
    adminRouteLinesDrawn[tripId] = 'fetching';

    api.getTripGeometry(tripId)
        .then(data => {
            if (!data) return;
            const { coordinates, stops } = data;
            const currentMap = adminMap;
            if (!currentMap) return;

            const coords = (coordinates && coordinates.length >= 2)
                ? coordinates
                : (stops && stops.length >= 2 ? stops.map(s => [s.longitude, s.latitude]) : null);

            if (!coords) { adminRouteLinesDrawn[tripId] = false; return; }

            _addAdminRouteToMap(currentMap, sourceId, tripId, coords, stops || []);
            adminRouteLinesDrawn[tripId] = 'drawn';
        })
        .catch(() => { adminRouteLinesDrawn[tripId] = false; });
}

function _addAdminRouteToMap(map, sourceId, tripId, coordinates, stops) {
    if (!map.isStyleLoaded()) {
        map.once('idle', () => _addAdminRouteToMap(map, sourceId, tripId, coordinates, stops));
        return;
    }
    if (map.getSource(sourceId)) return;

    map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates } }
    });
    map.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#4A90D9', 'line-width': 4, 'line-opacity': 0.8 }
    });

    stops.forEach((s, i) => {
        const el = document.createElement('div');
        el.style.cssText = 'width:14px;height:14px;background:#4A90D9;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.3);cursor:pointer;';
        const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
            <div style="padding:6px;min-width:120px">
                <strong>${s.name}</strong><br>
                <small>Stop ${i + 1} of ${stops.length}</small><br>
                <small>ETA: +${s.estimated_minutes} min</small>
            </div>`);
        const marker = new maplibregl.Marker(el)
            .setLngLat([s.longitude, s.latitude])
            .setPopup(popup)
            .addTo(map);
        adminStopMarkers.push({ marker, tripId });
    });
}

function adminCleanupRouteLines(activeLocations) {
    const map = adminMap;
    if (!map) return;

    const activeTripIds = new Set(activeLocations.map(l => l.trip_id).filter(Boolean));

    Object.keys(adminRouteLinesDrawn).forEach(tripId => {
        if (!activeTripIds.has(tripId)) {
            const sourceId = `admin-route-${tripId}`;
            try {
                if (map.getLayer(sourceId)) map.removeLayer(sourceId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);
            } catch (e) {}
            delete adminRouteLinesDrawn[tripId];

            adminStopMarkers = adminStopMarkers.filter(sm => {
                if (sm.tripId === tripId) { sm.marker.remove(); return false; }
                return true;
            });
        }
    });
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

            // Move or create admin's own marker on the map
            updateAdminSelfMarker(latitude, longitude);

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

function updateAdminSelfMarker(lat, lng) {
    if (!adminMap) return;

    if (!adminSelfMarker) {
        const el = document.createElement('div');
        el.className = 'bus-marker admin-self-marker';
        el.innerHTML = '<i class="fas fa-user"></i>';
        el.title = 'Your location';

        adminSelfMarker = new maplibregl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(adminMap);
    } else {
        adminSelfMarker.setLngLat([lng, lat]);
    }

    // Pan map to keep admin in view
    adminMap.easeTo({ center: [lng, lat], duration: 500 });
}

function pushLocationToAPI(tripId, lat, lng, speed, heading) {
    const trip = adminTrips.find(t => t.id === tripId);
    if (!trip) return;

    // Find the bus_id by matching the bus plate from the trip
    const bus = adminBusList.find(b => b.plate_number === trip.bus_plate);
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

// ── BROADCAST NOTIFICATIONS ──────────────────────────────────────────────────

// ── PROFILE ─────────────────────────────────────────────────────────────────

function loadAdminProfile() {
    if (!currentUser) return;
    document.getElementById('admin-profile-name').value = currentUser.full_name || '';
    document.getElementById('admin-profile-email').value = currentUser.email || '';
    document.getElementById('admin-profile-phone').value = currentUser.phone_number || '';
    document.getElementById('admin-profile-current-password').value = '';
    document.getElementById('admin-profile-password').value = '';
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const tripForm = document.getElementById('admin-trip-form');
    if (tripForm) tripForm.addEventListener('submit', saveTripForm);

    const busForm = document.getElementById('admin-bus-form');
    if (busForm) busForm.addEventListener('submit', saveBusForm);

    const broadcastForm = document.getElementById('broadcast-notification-form');
    if (broadcastForm) {
        broadcastForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('broadcast-title').value.trim();
            const message = document.getElementById('broadcast-message').value.trim();
            if (!title || !message) return;

            try {
                const result = await api.broadcastNotification({ title, message });
                showNotification(`Notification sent to ${result.count} passenger(s)!`, 'success');
                document.getElementById('broadcast-title').value = '';
                document.getElementById('broadcast-message').value = '';
            } catch (err) {
                showNotification(err.message || 'Failed to send notification.', 'error');
            }
        });
    }

    const profileForm = document.getElementById('admin-profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {};
            const name = document.getElementById('admin-profile-name').value.trim();
            const email = document.getElementById('admin-profile-email').value.trim();
            const phone = document.getElementById('admin-profile-phone').value.trim();
            const currentPwd = document.getElementById('admin-profile-current-password').value;
            const password = document.getElementById('admin-profile-password').value;

            if (name && name !== currentUser.full_name) data.full_name = name;
            if (email && email !== currentUser.email) data.email = email;
            if (phone && phone !== currentUser.phone_number) data.phone_number = phone;
            if (password) {
                if (!currentPwd) {
                    showNotification('Please enter your current password to change it.', 'error');
                    return;
                }
                data.current_password = currentPwd;
                data.password = password;
            }

            if (Object.keys(data).length === 0) {
                showNotification('No changes to save.', 'info');
                return;
            }

            try {
                const updated = await api.updateProfile(data);
                currentUser = { ...currentUser, ...updated };
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(currentUser));
                document.getElementById('adminName').textContent = currentUser.full_name;
                document.getElementById('admin-profile-current-password').value = '';
                document.getElementById('admin-profile-password').value = '';
                showNotification('Profile updated successfully!', 'success');
            } catch (err) {
                showNotification(err.message || 'Failed to update profile.', 'error');
            }
        });
    }
});
