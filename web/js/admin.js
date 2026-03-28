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
    showAdminSection('overview');
}

function showAdminSection(section) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById(`admin-${section}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`[onclick="showAdminSection('${section}')"]`);
    if (activeNav) activeNav.classList.add('active');

    if (section !== 'routes') {
        const panel = document.getElementById('route-stops-panel');
        if (panel) panel.style.display = 'none';
        activeRouteForStops = null;
    }

    if (section === 'gps') {
        populateGPSTripSelect();
        initAdminGPSMap();
    } else {
        stopAdminBusPolling();
    }
    if (section === 'overview') loadAdminOverview();
    if (section === 'buses') loadAdminBuses();
    if (section === 'routes') loadAdminRoutes();
    if (section === 'stops') loadAdminStops();
    if (section === 'profile') loadAdminProfile();
}

// ── TODAY'S TRIPS ────────────────────────────────────────────────────────────

function loadTodayTrips() {
    const container = document.getElementById('trips-list');
    container.innerHTML = `<div class="text-center">${t('dyn_loading_trips')}</div>`;

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
        container.innerHTML = `<div class="text-center">${t('dyn_no_trips')}</div>`;
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
    container.innerHTML = `<div class="text-center">${t('dyn_loading_buses')}</div>`;

    api.getBuses({ is_active: 'true' })
        .then(buses => {
            const myBuses = buses.filter(b => b.company && b.company === currentUser.company);
            if (!myBuses.length) {
                container.innerHTML = `<div class="text-center">${t('dyn_no_buses')}</div>`;
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
        showNotification(t('notif_fill_all_fields'), 'error');
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
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('dyn_saving')}`;

    const action = currentEditBusId
        ? api.updateBus(currentEditBusId, data)
        : api.createBus(data);

    action
        .then(() => {
            showNotification(currentEditBusId ? t('notif_bus_updated') : t('notif_bus_added'), 'success');
            closeBusModal();
            adminBusList = [];   // clear cache so next load is fresh
            loadAdminBuses();
        })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fas fa-save"></i> ${t('btn_save_bus')}`;
        });
}

function confirmDeleteBus(busId) {
    if (!confirm(t('confirm_delete_bus'))) return;

    const btn = document.querySelector(`button[onclick="confirmDeleteBus('${busId}')"]`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    api.deleteBus(busId)
        .then(() => {
            showNotification(t('notif_bus_deleted'), 'success');
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
        showNotification(t('notif_fill_all_fields'), 'error');
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
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('dyn_saving')}`;

    const action = currentEditTripId
        ? api.updateTrip(currentEditTripId, data)
        : api.createTrip(data);

    action
        .then(() => {
            showNotification(currentEditTripId ? t('notif_trip_updated') : t('notif_trip_created'), 'success');
            closeTripModal();
            loadTodayTrips();
        })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fas fa-save"></i> ${t('btn_save_trip')}`;
        });
}

function confirmDeleteTrip(tripId) {
    if (!confirm(t('confirm_delete_trip'))) return;

    const btn = document.querySelector(`button[onclick="confirmDeleteTrip('${tripId}')"]`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    api.deleteTrip(tripId)
        .then(() => {
            showNotification(t('notif_trip_deleted'), 'success');
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
        showNotification(t('dyn_no_trip_selected'), 'error');
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

// ── OVERVIEW ────────────────────────────────────────────────────────────────

function loadAdminOverview() {
    const container = document.getElementById('overview-stats');
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px"><i class="fas fa-spinner fa-spin fa-2x" style="color:#1A8A72"></i></div>';

    Promise.all([
        api.getTrips({ company: currentUser.company }),
        api.getBuses({ is_active: 'true' }),
        api.getBusLocations().catch(() => []),
    ]).then(([trips, buses, locations]) => {
        const myBuses = buses.filter(b => b.company === currentUser.company);
        const today = new Date().toISOString().split('T')[0];

        const active    = trips.filter(t => t.status === 'in_progress').length;
        const scheduled = trips.filter(t => t.status === 'scheduled').length;
        const completedToday = trips.filter(t => {
            if (t.status !== 'completed') return false;
            const d = t.departure_time ? t.departure_time.split('T')[0] : '';
            return d === today;
        }).length;
        const cancelled = trips.filter(t => t.status === 'cancelled').length;
        const onRoute   = locations.length;

        const cards = [
            { icon: 'fa-play-circle',      color: '#1A8A72', label: t('stat_active_trips'),    value: active },
            { icon: 'fa-clock',            color: '#4A90D9', label: t('stat_scheduled'),        value: scheduled },
            { icon: 'fa-check-circle',     color: '#34C759', label: t('stat_completed_today'),  value: completedToday },
            { icon: 'fa-times-circle',     color: '#FF3B30', label: t('stat_cancelled'),        value: cancelled },
            { icon: 'fa-bus',              color: '#FF9500', label: t('stat_total_buses'),       value: myBuses.length },
            { icon: 'fa-map-marker-alt',   color: '#AF52DE', label: t('stat_buses_on_route'),   value: onRoute },
        ];

        container.innerHTML = cards.map(c => `
            <div style="background:#fff;border-radius:14px;padding:18px 14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)">
                <div style="width:48px;height:48px;background:${c.color}18;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px">
                    <i class="fas ${c.icon}" style="color:${c.color};font-size:20px"></i>
                </div>
                <div style="font-size:28px;font-weight:700;color:#0D1B2A;line-height:1">${c.value}</div>
                <div style="font-size:12px;color:#888;margin-top:4px">${c.label}</div>
            </div>`).join('');
    }).catch(err => {
        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#FF3B30;padding:20px">${err.message}</div>`;
    });
}

// ── ROUTES ───────────────────────────────────────────────────────────────────

let adminAllRoutes  = [];
let adminAllStops   = [];
let currentEditRouteId    = null;
let currentEditStopId     = null;
let currentEditRouteStopId = null;
let activeRouteForStops   = null;  // route object whose stops are open in the panel

function loadAdminRoutes() {
    const container = document.getElementById('routes-list');
    container.innerHTML = `<div class="text-center">${t('dyn_loading_routes')}</div>`;

    api.getRoutes()
        .then(routes => {
            adminAllRoutes = routes;
            renderAdminRoutes(routes);
        })
        .catch(err => {
            container.innerHTML = `<div class="text-center text-error">Failed to load routes: ${err.message}</div>`;
        });
}

function renderAdminRoutes(routes) {
    const container = document.getElementById('routes-list');
    if (!routes.length) {
        container.innerHTML = `<div class="text-center">${t('dyn_no_routes')}</div>`;
        return;
    }
    container.innerHTML = routes.map(r => `
        <div class="trip-card" id="route-card-${r.id}">
            <div class="trip-header">
                <div>
                    <div class="trip-time">${r.route_code}</div>
                    <div class="trip-route">${r.name}</div>
                </div>
                <span class="status-badge status-${r.is_active ? 'scheduled' : 'cancelled'}">${r.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div class="trip-actions">
                <button onclick="openRouteStopsPanel('${r.id}')" class="btn-secondary" style="flex:1">
                    <i class="fas fa-map-pin"></i> Stops
                </button>
                <button onclick="openRouteModal('${r.id}')" class="btn-secondary" style="flex:1">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="confirmDeleteRoute('${r.id}')" class="btn-danger" style="flex:1">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`).join('');
}

function openRouteModal(routeId = null) {
    currentEditRouteId = routeId;
    document.getElementById('admin-route-modal-title').textContent = routeId ? 'Edit Route' : 'Add Route';
    document.getElementById('admin-route-form').reset();

    if (routeId) {
        const r = adminAllRoutes.find(x => x.id === routeId);
        if (r) {
            document.getElementById('route-form-code').value   = r.route_code || '';
            document.getElementById('route-form-name').value   = r.name || '';
            document.getElementById('route-form-status').value = r.is_active ? 'true' : 'false';
        }
    }
    document.getElementById('admin-route-modal').classList.add('active');
}

function closeRouteModal() {
    document.getElementById('admin-route-modal').classList.remove('active');
    currentEditRouteId = null;
}

function saveRouteForm(event) {
    event.preventDefault();
    const code     = document.getElementById('route-form-code').value.trim();
    const name     = document.getElementById('route-form-name').value.trim();
    const isActive = document.getElementById('route-form-status').value === 'true';

    if (!code || !name) { showNotification(t('notif_fill_all_fields'), 'error'); return; }

    const data = { route_code: code, name, is_active: isActive };
    const btn  = document.getElementById('route-form-save-btn');
    btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('dyn_saving')}`;

    const action = currentEditRouteId
        ? api.updateRoute(currentEditRouteId, data)
        : api.createRoute(data);

    action.then(() => {
        showNotification(currentEditRouteId ? t('notif_route_updated') : t('notif_route_created'), 'success');
        closeRouteModal();
        adminAllRoutes = [];
        loadAdminRoutes();
    }).catch(err => {
        showNotification('Error: ' + err.message, 'error');
    }).finally(() => {
        btn.disabled = false; btn.innerHTML = `<i class="fas fa-save"></i> ${t('btn_save_route')}`;
    });
}

function confirmDeleteRoute(routeId) {
    if (!confirm(t('confirm_delete_route'))) return;
    const btn = document.querySelector(`button[onclick="confirmDeleteRoute('${routeId}')"]`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    api.deleteRoute(routeId)
        .then(() => { showNotification(t('notif_route_deleted'), 'success'); adminAllRoutes = []; loadAdminRoutes(); })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i>'; }
        });
}

// ── ROUTE-STOPS PANEL ────────────────────────────────────────────────────────

function openRouteStopsPanel(routeId) {
    const route = adminAllRoutes.find(r => r.id === routeId);
    activeRouteForStops = route || { id: routeId };
    document.getElementById('route-stops-panel-title').textContent =
        route ? `Stops for: ${route.route_code} — ${route.name}` : 'Route Stops';
    document.getElementById('route-stops-panel').style.display = '';
    loadRouteStopsForRoute(routeId);
    // Scroll panel into view
    document.getElementById('route-stops-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeRouteStopsPanel() {
    document.getElementById('route-stops-panel').style.display = 'none';
    activeRouteForStops = null;
}

function loadRouteStopsForRoute(routeId) {
    const container = document.getElementById('route-stops-list');
    container.innerHTML = `<div class="text-center">${t('dyn_loading')}</div>`;

    Promise.all([
        api.getRouteStops({ route_id: routeId }),
        adminAllStops.length ? Promise.resolve(adminAllStops) : api.getStops(),
    ]).then(([routeStops, stops]) => {
        adminAllStops = stops;
        if (!routeStops.length) {
            container.innerHTML = `<div class="text-center" style="color:#888;padding:12px">${t('dyn_no_route_stops')}</div>`;
            return;
        }
        const stopMap = Object.fromEntries(stops.map(s => [s.id, s]));
        container.innerHTML = routeStops.map(rs => {
            const s = stopMap[rs.stop_id] || {};
            return `
            <div class="trip-card" style="padding:12px 14px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <strong style="font-size:14px">#${rs.stop_order} — ${s.name || rs.stop_id}</strong>
                        <div style="font-size:12px;color:#888;margin-top:2px">
                            ${rs.estimated_minutes_from_start != null ? `+${rs.estimated_minutes_from_start} min` : ''}
                            ${s.latitude ? ` · ${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)}` : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:6px">
                        <button onclick="openRouteStopModal('${rs.id}')" class="btn-secondary" style="padding:6px 10px;font-size:12px">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="confirmDeleteRouteStop('${rs.id}')" class="btn-danger" style="padding:6px 10px;font-size:12px">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }).catch(err => {
        container.innerHTML = `<div class="text-center text-error">${err.message}</div>`;
    });
}

function openRouteStopModal(routeStopId = null) {
    if (!activeRouteForStops) return;
    currentEditRouteStopId = routeStopId;
    document.getElementById('admin-route-stop-modal-title').textContent = routeStopId ? 'Edit Route Stop' : 'Add Stop to Route';
    document.getElementById('admin-route-stop-form').reset();

    // Populate stop select
    const sel = document.getElementById('route-stop-form-stop');
    sel.innerHTML = '<option value="">Select stop</option>' +
        adminAllStops.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    if (routeStopId) {
        // Find the route stop from currently rendered list — re-fetch if needed
        api.request(`/route-stops/${routeStopId}`).then(rs => {
            sel.value = rs.stop_id;
            document.getElementById('route-stop-form-order').value   = rs.stop_order;
            document.getElementById('route-stop-form-minutes').value = rs.estimated_minutes_from_start ?? '';
        }).catch(() => {});
    }
    document.getElementById('admin-route-stop-modal').classList.add('active');
}

function closeRouteStopModal() {
    document.getElementById('admin-route-stop-modal').classList.remove('active');
    currentEditRouteStopId = null;
}

function saveRouteStopForm(event) {
    event.preventDefault();
    if (!activeRouteForStops) return;

    const stopId  = document.getElementById('route-stop-form-stop').value;
    const order   = parseInt(document.getElementById('route-stop-form-order').value);
    const minutes = document.getElementById('route-stop-form-minutes').value;

    if (!stopId || !order) { showNotification(t('notif_fill_all_fields'), 'error'); return; }

    const data = {
        route_id: activeRouteForStops.id,
        stop_id: stopId,
        stop_order: order,
        estimated_minutes_from_start: minutes !== '' ? parseInt(minutes) : null,
    };

    const btn = document.getElementById('route-stop-form-save-btn');
    btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('dyn_saving')}`;

    const action = currentEditRouteStopId
        ? api.updateRouteStop(currentEditRouteStopId, data)
        : api.createRouteStop(data);

    action.then(() => {
        showNotification(t('notif_saved'), 'success');
        closeRouteStopModal();
        loadRouteStopsForRoute(activeRouteForStops.id);
    }).catch(err => {
        showNotification('Error: ' + err.message, 'error');
    }).finally(() => {
        btn.disabled = false; btn.innerHTML = `<i class="fas fa-save"></i> ${t('notif_saved')}`;
    });
}

function confirmDeleteRouteStop(routeStopId) {
    if (!confirm(t('confirm_remove_route_stop'))) return;
    const btn = document.querySelector(`button[onclick="confirmDeleteRouteStop('${routeStopId}')"]`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    api.deleteRouteStop(routeStopId)
        .then(() => {
            showNotification(t('notif_stop_deleted'), 'success');
            if (activeRouteForStops) loadRouteStopsForRoute(activeRouteForStops.id);
        })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i>'; }
        });
}

// ── STOPS ────────────────────────────────────────────────────────────────────

function loadAdminStops() {
    const container = document.getElementById('stops-list');
    container.innerHTML = `<div class="text-center">${t('dyn_loading_stops')}</div>`;

    api.getStops()
        .then(stops => {
            adminAllStops = stops;
            renderAdminStops(stops);
        })
        .catch(err => {
            container.innerHTML = `<div class="text-center text-error">Failed to load stops: ${err.message}</div>`;
        });
}

function renderAdminStops(stops) {
    const container = document.getElementById('stops-list');
    if (!stops.length) {
        container.innerHTML = `<div class="text-center">${t('dyn_no_stops')}</div>`;
        return;
    }
    container.innerHTML = stops.map(s => `
        <div class="trip-card" id="stop-card-${s.id}">
            <div class="trip-header">
                <div>
                    <div class="trip-time">${s.name}</div>
                    <div class="trip-route" style="font-size:12px;color:#888">${parseFloat(s.latitude).toFixed(5)}, ${parseFloat(s.longitude).toFixed(5)}</div>
                </div>
                <span class="status-badge status-${s.is_active ? 'scheduled' : 'cancelled'}">${s.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div class="trip-actions">
                <button onclick="openStopModal('${s.id}')" class="btn-secondary" style="flex:1">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="confirmDeleteStop('${s.id}')" class="btn-danger" style="flex:1">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>`).join('');
}

function openStopModal(stopId = null) {
    currentEditStopId = stopId;
    document.getElementById('admin-stop-modal-title').textContent = stopId ? 'Edit Stop' : 'Add Stop';
    document.getElementById('admin-stop-form').reset();

    if (stopId) {
        const s = adminAllStops.find(x => x.id === stopId);
        if (s) {
            document.getElementById('stop-form-name').value   = s.name || '';
            document.getElementById('stop-form-lat').value    = s.latitude || '';
            document.getElementById('stop-form-lng').value    = s.longitude || '';
            document.getElementById('stop-form-status').value = s.is_active ? 'true' : 'false';
        }
    }
    document.getElementById('admin-stop-modal').classList.add('active');
}

function closeStopModal() {
    document.getElementById('admin-stop-modal').classList.remove('active');
    currentEditStopId = null;
}

function saveStopForm(event) {
    event.preventDefault();
    const name     = document.getElementById('stop-form-name').value.trim();
    const lat      = parseFloat(document.getElementById('stop-form-lat').value);
    const lng      = parseFloat(document.getElementById('stop-form-lng').value);
    const isActive = document.getElementById('stop-form-status').value === 'true';

    if (!name || isNaN(lat) || isNaN(lng)) { showNotification(t('notif_fill_all_fields'), 'error'); return; }

    const data = { name, latitude: lat, longitude: lng, is_active: isActive };
    const btn  = document.getElementById('stop-form-save-btn');
    btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('dyn_saving')}`;

    const action = currentEditStopId
        ? api.updateStop(currentEditStopId, data)
        : api.createStop(data);

    action.then(() => {
        showNotification(currentEditStopId ? t('notif_stop_updated') : t('notif_stop_created'), 'success');
        closeStopModal();
        adminAllStops = [];
        loadAdminStops();
    }).catch(err => {
        showNotification('Error: ' + err.message, 'error');
    }).finally(() => {
        btn.disabled = false; btn.innerHTML = `<i class="fas fa-save"></i> ${t('btn_save_stop')}`;
    });
}

function confirmDeleteStop(stopId) {
    if (!confirm(t('confirm_delete_stop'))) return;
    const btn = document.querySelector(`button[onclick="confirmDeleteStop('${stopId}')"]`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    api.deleteStop(stopId)
        .then(() => { showNotification(t('notif_stop_deleted'), 'success'); adminAllStops = []; loadAdminStops(); })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i>'; }
        });
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

    const routeForm = document.getElementById('admin-route-form');
    if (routeForm) routeForm.addEventListener('submit', saveRouteForm);

    const stopForm = document.getElementById('admin-stop-form');
    if (stopForm) stopForm.addEventListener('submit', saveStopForm);

    const routeStopForm = document.getElementById('admin-route-stop-form');
    if (routeStopForm) routeStopForm.addEventListener('submit', saveRouteStopForm);

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
                    showNotification(t('notif_current_pwd_required'), 'error');
                    return;
                }
                data.current_password = currentPwd;
                data.password = password;
            }

            if (Object.keys(data).length === 0) {
                showNotification(t('notif_no_changes'), 'info');
                return;
            }

            try {
                const updated = await api.updateProfile(data);
                currentUser = { ...currentUser, ...updated };
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(currentUser));
                document.getElementById('adminName').textContent = currentUser.full_name;
                document.getElementById('admin-profile-current-password').value = '';
                document.getElementById('admin-profile-password').value = '';
                showNotification(t('notif_profile_updated'), 'success');
            } catch (err) {
                showNotification(err.message || 'Failed to update profile.', 'error');
            }
        });
    }
});
