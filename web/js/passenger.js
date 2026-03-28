// Passenger Dashboard Logic

let busMarkers = {};               // keyed by bus_id → maplibregl.Marker
let busLocationInterval = null;
let routeLinesDrawn = {};          // keyed by route_id → true (prevents re-fetching)
let stopMarkers = [];              // stop markers on map
let availableStops = [];
let availableRouteStops = [];
let selectedSeat = null;
let bookingContext = null;         // { tripId, fromStopId, toStopId }
let pendingBooking = null;         // booking object awaiting payment
let selectedPaymentMethod = 'mtn';

function formatStatus(status) {
    if (!status) return '';
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── DASHBOARD ENTRY ──────────────────────────────────────────────────────────

function showPassengerDashboard() {
    document.getElementById('auth-section')?.classList.add('hidden');
    document.getElementById('passenger-dashboard')?.classList.add('active');
    document.getElementById('admin-dashboard')?.classList.remove('active');

    const userName = document.getElementById('userName');
    if (userName && currentUser) userName.textContent = currentUser.full_name;

    if (!window.passengerMap) {
        initPassengerMap();
    } else {
        startBusLocationPolling();
    }

    loadSearchStops();
    loadUserBookings();
    loadNotifications();
    updateNotifBadge();
}

function showPassengerSection(section) {
    document.querySelectorAll('#passenger-dashboard .section').forEach(el => el.classList.remove('active'));
    document.getElementById(`passenger-${section}`)?.classList.add('active');

    document.querySelectorAll('#passenger-dashboard .nav-item').forEach(el => el.classList.remove('active'));
    const nav = document.querySelector(`#passenger-dashboard [onclick="showPassengerSection('${section}')"]`);
    if (nav) nav.classList.add('active');

    if (section === 'home') {
        startBusLocationPolling();
    } else {
        stopBusLocationPolling();
    }

    if (section === 'search') loadSearchStops();
    if (section === 'bookings') loadUserBookings();
    if (section === 'notifications') loadNotifications();
    if (section === 'profile') loadProfile();
}

// ── MAP ───────────────────────────────────────────────────────────────────────

function initPassengerMap() {
    if (!window.maplibregl) {
        const c = document.getElementById('passenger-map');
        if (c) c.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Map unavailable (MapLibre not loaded).</div>';
        return;
    }

    window.passengerMap = new maplibregl.Map({
        container: 'passenger-map',
        style: buildStadiaStyleUrl(),
        center: CONFIG.DEFAULT_CENTER,
        zoom: CONFIG.DEFAULT_ZOOM
    });

    window.passengerMap.addControl(new maplibregl.NavigationControl(), 'top-right');
    window.passengerMap.on('load', () => {
        startBusLocationPolling();
    });
}

function buildStadiaStyleUrl() {
    const baseUrl = CONFIG.MAP_STYLE_URL || 'https://tiles.stadiamaps.com/styles/alidade_smooth.json';
    const apiKey = (CONFIG.STADIA_API_KEY || '').trim();
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!apiKey || isLocalhost || baseUrl.includes('api_key=')) return baseUrl;
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}api_key=${encodeURIComponent(apiKey)}`;
}

function startBusLocationPolling() {
    stopBusLocationPolling();
    refreshBusLocations();
    busLocationInterval = setInterval(refreshBusLocations, CONFIG.BUS_LOCATION_UPDATE_INTERVAL || 5000);
}

function stopBusLocationPolling() {
    if (busLocationInterval) {
        clearInterval(busLocationInterval);
        busLocationInterval = null;
    }
}

function refreshBusLocations() {
    if (!window.passengerMap) return;

    api.getBusLocations()
        .then(locations => {
            const seen = new Set();

            locations.forEach(loc => {
                const id = loc.bus_id;
                seen.add(id);
                const lngLat = [parseFloat(loc.longitude), parseFloat(loc.latitude)];
                const updatedAt = loc.last_updated  || loc.last_updated || new Date().toISOString();
                const popupHtml = `
                    <div style="padding:8px;min-width:140px">
                        <strong><i class="fas fa-bus"></i> Live Bus</strong><br>
                        Speed: ${loc.speed || 0} km/h<br>
                        Heading: ${loc.heading || 0}°<br>
                        <small style="color:#999">Updated: ${new Date(updatedAt).toLocaleTimeString()}</small>
                    </div>`;

                if (busMarkers[id]) {
                    busMarkers[id].setLngLat(lngLat);
                    busMarkers[id].getPopup().setHTML(popupHtml);
                } else {
                    const el = document.createElement('div');
                    el.className = 'bus-marker';
                    el.innerHTML = '<i class="fas fa-bus"></i>';
                    const marker = new maplibregl.Marker(el)
                        .setLngLat(lngLat)
                        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml))
                        .addTo(window.passengerMap);
                    busMarkers[id] = marker;
                }

                // Draw route line for this bus's trip (once per route)
                if (loc.trip_id) {
                    drawRouteForTrip(loc.trip_id);
                }
            });

            // Remove markers for buses no longer reporting
            Object.keys(busMarkers).forEach(id => {
                if (!seen.has(id)) {
                    busMarkers[id].remove();
                    delete busMarkers[id];
                }
            });

            // Clean up route lines for trips that are no longer active
            cleanupRouteLines(locations);
        })
        .catch(() => {}); // silent — no buses live is normal
}

function drawRouteForTrip(tripId) {
    const map = window.passengerMap;
    if (!map) return;

    const sourceId = `route-line-${tripId}`;

    // Check if route line is ACTUALLY on the map (survives refresh check)
    // If source exists on map, no need to re-draw
    if (map.getSource(sourceId)) return;

    // If we're already fetching for this trip, skip
    if (routeLinesDrawn[tripId] === 'fetching') return;
    routeLinesDrawn[tripId] = 'fetching';

    // Use the trip geometry endpoint (ORS real roads)
    api.getTripGeometry(tripId)
        .then(data => {
            if (!data) return;
            const { coordinates, stops } = data;
            const currentMap = window.passengerMap;
            if (!currentMap) return;

            // coordinates = [[lng, lat], ...] from ORS (real road geometry)
            // stops = [{name, latitude, longitude, stop_order, estimated_minutes}, ...]
            if (!coordinates || coordinates.length < 2) {
                // Fallback: draw straight lines between stops
                if (!stops || stops.length < 2) { routeLinesDrawn[tripId] = false; return; }
                const fallbackCoords = stops.map(s => [s.longitude, s.latitude]);
                _addRouteToMap(currentMap, sourceId, tripId, fallbackCoords, stops);
            } else {
                _addRouteToMap(currentMap, sourceId, tripId, coordinates, stops);
            }
            routeLinesDrawn[tripId] = 'drawn';
        })
        .catch(() => {
            routeLinesDrawn[tripId] = false; // allow retry
        });
}

function _addRouteToMap(map, sourceId, tripId, coordinates, stops) {
    // Wait for style to be fully loaded before adding sources/layers
    if (!map.isStyleLoaded()) {
        map.once('idle', () => _addRouteToMap(map, sourceId, tripId, coordinates, stops));
        return;
    }

    // Prevent duplicate sources (race condition guard)
    if (map.getSource(sourceId)) return;

    const geojson = {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: coordinates
        }
    };

    map.addSource(sourceId, { type: 'geojson', data: geojson });
    map.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        paint: {
            'line-color': '#4A90D9',
            'line-width': 4,
            'line-opacity': 0.8
        }
    });

    // Add stop markers along the route
    if (stops && stops.length) {
        stops.forEach((s, i) => {
            const el = document.createElement('div');
            el.className = 'stop-marker';
            el.style.cssText = 'width:14px;height:14px;background:#4A90D9;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.3);cursor:pointer;';

            const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
                <div style="padding:6px;min-width:120px">
                    <strong>${s.name}</strong><br>
                    <small>Stop ${i + 1} of ${stops.length}</small><br>
                    <small>ETA: +${s.estimated_minutes} min</small>
                </div>
            `);

            const marker = new maplibregl.Marker(el)
                .setLngLat([s.longitude, s.latitude])
                .setPopup(popup)
                .addTo(map);

            stopMarkers.push({ marker, tripId });
        });
    }
}

function cleanupRouteLines(activeLocations) {
    const map = window.passengerMap;
    if (!map) return;

    const activeTripIds = new Set(activeLocations.map(l => l.trip_id).filter(Boolean));

    Object.keys(routeLinesDrawn).forEach(tripId => {
        if (!activeTripIds.has(tripId)) {
            const sourceId = `route-line-${tripId}`;
            try {
                if (map.getLayer(sourceId)) map.removeLayer(sourceId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);
            } catch (e) { /* map may not be ready */ }
            delete routeLinesDrawn[tripId];

            // Remove stop markers for this trip
            stopMarkers = stopMarkers.filter(sm => {
                if (sm.tripId === tripId) {
                    sm.marker.remove();
                    return false;
                }
                return true;
            });
        }
    });
}

function centerMap() {
    if (!window.passengerMap) return;
    window.passengerMap.flyTo({ center: CONFIG.DEFAULT_CENTER, zoom: CONFIG.DEFAULT_ZOOM, essential: true });
}

function toggleBusInfo() {
    Object.values(busMarkers).forEach(marker => {
        const popup = marker.getPopup();
        if (popup.isOpen()) popup.remove();
        else marker.togglePopup();
    });
}

// ── SEARCH ────────────────────────────────────────────────────────────────────

function loadSearchStops() {
    const fromSel = document.getElementById('fromLocation');
    const toSel = document.getElementById('toLocation');
    if (!fromSel || !toSel) return;
    if (availableStops.length) { populateStopOptions(availableStops); return; }

    fromSel.innerHTML = '<option value="">Loading stops…</option>';
    toSel.innerHTML = '<option value="">Loading stops…</option>';

    api.getStops()
        .then(stops => {
            availableStops = stops.filter(s => s.is_active !== false);
            populateStopOptions(availableStops);
        })
        .catch(err => {
            fromSel.innerHTML = '<option value="">Unable to load stops</option>';
            toSel.innerHTML = '<option value="">Unable to load stops</option>';
            showNotification('Unable to load stops: ' + err.message, 'error');
        });
}

function populateStopOptions(stops) {
    const fromSel = document.getElementById('fromLocation');
    const toSel = document.getElementById('toLocation');
    if (!fromSel || !toSel) return;

    const prevFrom = fromSel.value;
    const prevTo = toSel.value;
    const opts = ['<option value="">Select start</option>']
        .concat(stops.map(s => `<option value="${s.id}">${s.name}</option>`))
        .join('');

    fromSel.innerHTML = opts;
    toSel.innerHTML = opts;
    if (stops.some(s => s.id === prevFrom)) fromSel.value = prevFrom;
    if (stops.some(s => s.id === prevTo)) toSel.value = prevTo;
}

function searchTrips() {
    const fromStopId = document.getElementById('fromLocation').value;
    const toStopId = document.getElementById('toLocation').value;
    const date = document.getElementById('travelDate').value;

    if (!fromStopId || !toStopId || !date) {
        showNotification('Please fill all search fields', 'error');
        return;
    }
    if (fromStopId === toStopId) {
        showNotification('Departure and destination must be different', 'error');
        return;
    }

    const searchBtn = document.querySelector('#passenger-search button[onclick="searchTrips()"]');
    if (searchBtn) { searchBtn.disabled = true; searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching…'; }

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div style="text-align:center;padding:24px"><i class="fas fa-spinner fa-spin fa-2x" style="color:#1A8A72"></i><p style="margin-top:8px;color:#666">Searching trips…</p></div>';

    // Always fetch fresh data on each search
    availableRouteStops = [];

    Promise.all([
        api.getRoutes({ is_active: true }),
        api.getRouteStops(),
        api.getTrips()
    ])
        .then(([routes, routeStops, trips]) => {
            availableRouteStops = routeStops;
            const matchingRoutes = filterRoutesByStops(routes, routeStops, fromStopId, toStopId);
            const matchingTrips = matchTripsToDate(matchingRoutes, trips, date);
            displayTripResults(matchingTrips, fromStopId, toStopId);
        })
        .catch(err => {
            resultsContainer.innerHTML = `<div style="text-align:center;padding:20px;color:#FF3B30"><i class="fas fa-exclamation-triangle"></i> Error: ${err.message}</div>`;
        })
        .finally(() => {
            if (searchBtn) { searchBtn.disabled = false; searchBtn.innerHTML = '<i class="fas fa-search"></i> Search'; }
        });
}

function filterRoutesByStops(routes, routeStops, fromStopId, toStopId) {
    return routes.reduce((matches, route) => {
        const stopsForRoute = routeStops
            .filter(rs => rs.route_id === route.id)
            .sort((a, b) => a.stop_order - b.stop_order);

        const fromIdx = stopsForRoute.findIndex(rs => rs.stop_id === fromStopId);
        const toIdx = stopsForRoute.findIndex(rs => rs.stop_id === toStopId);
        if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) return matches;

        const segment = stopsForRoute.slice(fromIdx, toIdx + 1);
        const startMin = segment[0].estimated_minutes_from_start || 0;
        const endMin = segment[segment.length - 1].estimated_minutes_from_start || 0;
        matches.push({ ...route, matched_segment: segment, estimated_minutes: Math.max(endMin - startMin, 0) });
        return matches;
    }, []);
}

function matchTripsToDate(matchingRoutes, trips, date) {
    const results = [];
    matchingRoutes.forEach(route => {
        trips
            .filter(t => {
                if (t.route_id !== route.id) return false;
                if (t.status === 'cancelled' || t.status === 'completed') return false;
                if (!t.departure_time) return false;
                // Compare using local date to handle UTC offset
                const tripDate = new Date(t.departure_time);
                const tripLocalDate = tripDate.getFullYear() + '-'
                    + String(tripDate.getMonth() + 1).padStart(2, '0') + '-'
                    + String(tripDate.getDate()).padStart(2, '0');
                // Also check the raw UTC date as fallback
                const tripUtcDate = t.departure_time.split('T')[0];
                return tripLocalDate === date || tripUtcDate === date;
            })
            .forEach(trip => results.push({ ...trip, route_info: route }));
    });
    return results;
}

function getStopName(stopId) {
    const stop = availableStops.find(s => s.id === stopId);
    return stop ? stop.name : stopId || 'Unknown';
}

function displayTripResults(trips, fromStopId, toStopId) {
    const container = document.getElementById('search-results');
    const fromName = getStopName(fromStopId);
    const toName = getStopName(toStopId);

    if (trips.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:32px;color:#888">
                <i class="fas fa-bus fa-2x" style="margin-bottom:12px;opacity:.3"></i>
                <p>No scheduled trips found from <strong>${fromName}</strong> to <strong>${toName}</strong> on that date.</p>
            </div>`;
        return;
    }

    container.innerHTML = '<div class="trips-grid">' + trips.map(trip => {
        const dep = new Date(trip.departure_time);
        const depStr = dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const depDate = dep.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        const stops = trip.route_info?.matched_segment?.length || '?';
        const mins = trip.route_info?.estimated_minutes || '?';
        const occupied = trip.current_capacity || 0;
        return `
            <div class="trip-card">
                <div class="trip-header">
                    <div>
                        <div class="trip-time">${depStr}</div>
                        <div class="trip-route">${trip.route_info?.name || 'Route'} · ${depDate}</div>
                    </div>
                    <span class="status-badge status-${trip.status}">${formatStatus(trip.status)}</span>
                </div>
                <div class="trip-details">
                    <div class="detail-item">
                        <i class="fas fa-location-arrow"></i>
                        <span>${fromName} → ${toName}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-map-signs"></i>
                        <span>${stops} stops · ${mins} min</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-chair"></i>
                        <span>${occupied} seats occupied</span>
                    </div>
                </div>
                <div class="trip-actions">
                    <button onclick="openBookingModal('${trip.id}','${fromStopId}','${toStopId}')"
                        class="btn-primary" style="width:100%">
                        <i class="fas fa-ticket-alt"></i> Book Seat
                    </button>
                </div>
            </div>`;
    }).join('') + '</div>';
}

// ── BOOKING MODAL ─────────────────────────────────────────────────────────────

function openBookingModal(tripId, fromStopId, toStopId) {
    selectedSeat = null;
    bookingContext = { tripId, fromStopId, toStopId };

    const modal = document.getElementById('passenger-booking-modal');
    const info = document.getElementById('booking-trip-info');
    const grid = document.getElementById('booking-seat-grid');
    const btn = document.getElementById('booking-confirm-btn');

    info.innerHTML = '<div style="text-align:center;padding:12px"><i class="fas fa-spinner fa-spin" style="color:#1A8A72"></i> Loading trip…</div>';
    grid.innerHTML = '';
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-check"></i> Confirm Booking';
    modal.classList.add('active');

    Promise.all([
        api.getTrip(tripId),
        api.getBuses(),
        api.getBookings({ trip_id: tripId }).catch(() => [])
    ])
        .then(([trip, buses, bookings]) => {
            const dep = new Date(trip.departure_time).toLocaleString();
            info.innerHTML = `
                <div class="trip-details">
                    <div class="detail-item"><i class="fas fa-location-arrow"></i>
                        <span><strong>${getStopName(fromStopId)}</strong> → <strong>${getStopName(toStopId)}</strong></span>
                    </div>
                    <div class="detail-item"><i class="fas fa-calendar"></i><span>${dep}</span></div>
                    <div class="detail-item"><i class="fas fa-info-circle"></i><span>Status: ${formatStatus(trip.status)}</span></div>
                    <div class="detail-item"><i class="fas fa-tag"></i><span>Fare: 500 RWF</span></div>
                </div>`;

            const bus = buses.find(b => b.id === trip.bus_id);
            const capacity = bus ? bus.capacity : 30;
            const takenSeats = new Set(
                bookings
                    .filter(b => b.status !== 'cancelled')
                    .map(b => b.seat_number)
                    .filter(Boolean)
            );
            renderSeatGrid(capacity, takenSeats);
        })
        .catch(err => {
            info.innerHTML = `<div style="color:#FF3B30;padding:12px"><i class="fas fa-exclamation-triangle"></i> ${err.message}</div>`;
        });
}

function renderSeatGrid(capacity, takenSeats) {
    const grid = document.getElementById('booking-seat-grid');
    const cols = 4;
    let html = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:4px">`;
    for (let i = 1; i <= capacity; i++) {
        const taken = takenSeats.has(i);
        html += `<div
            onclick="selectSeat(${i}, this, ${taken})"
            style="
                padding:8px 4px;text-align:center;border-radius:6px;cursor:${taken ? 'not-allowed' : 'pointer'};
                font-size:13px;font-weight:600;border:1px solid ${taken ? '#FF3B30' : '#ddd'};
                background:${taken ? '#ffe5e5' : '#f9f9f9'};color:${taken ? '#FF3B30' : '#333'};
                user-select:none;transition:all .15s"
            title="Seat ${i} — ${taken ? 'Taken' : 'Available'}">${i}</div>`;
    }
    html += '</div>';
    grid.innerHTML = html;
}

function selectSeat(num, el, taken) {
    if (taken) { showNotification('That seat is already taken', 'error'); return; }
    document.querySelectorAll('#booking-seat-grid div[onclick]').forEach(s => {
        s.style.background = '#f9f9f9';
        s.style.borderColor = '#ddd';
        s.style.color = '#333';
    });
    el.style.background = '#1A8A72';
    el.style.borderColor = '#1A8A72';
    el.style.color = '#fff';
    selectedSeat = num;
    document.getElementById('booking-confirm-btn').disabled = false;
}

function closeBookingModal() {
    document.getElementById('passenger-booking-modal').classList.remove('active');
    bookingContext = null;
    selectedSeat = null;
}

function confirmBooking() {
    if (!bookingContext || !selectedSeat) return;
    const btn = document.getElementById('booking-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking…';

    api.createBooking({
        trip_id: bookingContext.tripId,
        pickup_stop_id: bookingContext.fromStopId,
        dropoff_stop_id: bookingContext.toStopId,
        seat_number: selectedSeat
    })
        .then(booking => {
            closeBookingModal();
            openPaymentModal(booking);
        })
        .catch(err => {
            showNotification('Booking failed: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Confirm Booking';
        });
}

// ── PAYMENT MODAL ─────────────────────────────────────────────────────────────

function openPaymentModal(booking) {
    pendingBooking = booking;
    selectedPaymentMethod = 'mtn';

    // Reset payment method buttons
    document.querySelectorAll('.payment-method-btn').forEach(b => {
        b.style.borderColor = '#ddd';
        b.style.background = '#fff';
    });
    const mtnBtn = document.querySelector('.payment-method-btn[data-method="mtn"]');
    if (mtnBtn) { mtnBtn.style.borderColor = '#1A8A72'; mtnBtn.style.background = '#e8f5f2'; }

    document.getElementById('payment-phone-field').style.display = '';
    document.getElementById('payment-ref-field').style.display = 'none';
    document.getElementById('payment-phone-input').value = currentUser?.phone_number || '';
    document.getElementById('payment-booking-ref').textContent = (booking.ticket_token || '').slice(0, 16) + '…';

    const btn = document.getElementById('payment-submit-btn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-money-bill"></i> Pay Now';

    document.getElementById('passenger-payment-modal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('passenger-payment-modal').classList.remove('active');
    pendingBooking = null;
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.payment-method-btn').forEach(b => {
        b.style.borderColor = '#ddd';
        b.style.background = '#fff';
    });
    const active = document.querySelector(`.payment-method-btn[data-method="${method}"]`);
    if (active) { active.style.borderColor = '#1A8A72'; active.style.background = '#e8f5f2'; }

    const isPhone = method === 'mtn';
    document.getElementById('payment-phone-field').style.display = isPhone ? '' : 'none';
    document.getElementById('payment-ref-field').style.display = isPhone ? 'none' : '';
}

function submitPayment() {
    if (!pendingBooking) return;
    const btn = document.getElementById('payment-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';

    const phone = document.getElementById('payment-phone-input')?.value.trim();
    const ref = document.getElementById('payment-ref-input')?.value.trim();
    const txRef = ref || `BP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const paymentData = {
        booking_id: pendingBooking.id,
        amount: 500,
        currency: 'EUR',  // MoMo sandbox only supports EUR
        payment_method: selectedPaymentMethod,
        transaction_ref: selectedPaymentMethod === 'mtn' ? undefined : txRef,
    };

    // Include phone number for MoMo payments
    if (selectedPaymentMethod === 'mtn' && phone) {
        paymentData.phone_number = phone;
    }

    api.initiatePayment(paymentData)
        .then(payment => {
            if (selectedPaymentMethod === 'mtn' && payment.status === 'pending') {
                // MoMo: show waiting state and poll for confirmation
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Waiting for MoMo confirmation…';
                pollMomoStatus(payment.id, 0);
            } else {
                closePaymentModal();
                showNotification('Payment successful! Your seat is confirmed.', 'success');
                loadUserBookings();
                showPassengerSection('bookings');
            }
        })
        .catch(err => {
            closePaymentModal();
            showNotification(err.message || 'Payment failed. Booking saved — pay on boarding.', 'error');
            loadUserBookings();
            showPassengerSection('bookings');
        });
}

function pollMomoStatus(paymentId, attempt) {
    const MAX_ATTEMPTS = 12;  // ~60 seconds (12 × 5s)
    const POLL_INTERVAL = 5000;

    if (attempt >= MAX_ATTEMPTS) {
        closePaymentModal();
        showNotification('Payment is still processing. Check your bookings for updates.', 'info');
        loadUserBookings();
        showPassengerSection('bookings');
        return;
    }

    setTimeout(() => {
        api.checkPaymentStatus(paymentId)
            .then(payment => {
                if (payment.status === 'completed') {
                    closePaymentModal();
                    showNotification('MoMo payment successful! Your seat is confirmed.', 'success');
                    loadUserBookings();
                    showPassengerSection('bookings');
                } else if (payment.status === 'failed') {
                    closePaymentModal();
                    showNotification('MoMo payment was declined. Please try again.', 'error');
                    loadUserBookings();
                    showPassengerSection('bookings');
                } else {
                    // Still pending — keep polling
                    pollMomoStatus(paymentId, attempt + 1);
                }
            })
            .catch(() => {
                // Network error — try again
                pollMomoStatus(paymentId, attempt + 1);
            });
    }, POLL_INTERVAL);
}

// ── BOOKINGS ──────────────────────────────────────────────────────────────────

function loadUserBookings() {
    const container = document.getElementById('bookings-list');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:24px"><i class="fas fa-spinner fa-spin fa-2x" style="color:#1A8A72"></i></div>';

    api.getUserBookings()
        .then(bookings => {
            if (bookings.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center;padding:40px;color:#888">
                        <i class="fas fa-ticket-alt fa-3x" style="opacity:.2;margin-bottom:12px"></i>
                        <p>No bookings yet.</p>
                        <button onclick="showPassengerSection('search')" class="btn-primary" style="margin-top:12px">
                            Search for a trip
                        </button>
                    </div>`;
                return;
            }
            container.innerHTML = '<div class="trips-grid">' + bookings.map(renderBookingCard).join('') + '</div>';
        })
        .catch(err => {
            container.innerHTML = `<div style="text-align:center;padding:20px;color:#FF3B30"><i class="fas fa-exclamation-triangle"></i> ${err.message}</div>`;
        });
}

function renderBookingCard(booking) {
    const statusClass = booking.status === 'confirmed' ? 'status-confirmed'
        : booking.status === 'cancelled' ? 'status-cancelled' : `status-${booking.status}`;
    const token = (booking.ticket_token || '').slice(0, 12) + '…';
    const canCancel = booking.status === 'pending' || booking.status === 'confirmed';

    return `
        <div class="trip-card">
            <div class="trip-header">
                <div>
                    <div class="trip-time">Seat ${booking.seat_number || '—'}</div>
                    <div class="trip-route">${booking.pickup_stop} → ${booking.dropoff_stop}</div>
                </div>
                <span class="status-badge ${statusClass}">${formatStatus(booking.status)}</span>
            </div>
            <div class="trip-details">
                <div class="detail-item"><i class="fas fa-ticket-alt"></i><span>Ref: ${token}</span></div>
                <div class="detail-item"><i class="fas fa-calendar"></i><span>${booking.departure_time}</span></div>
            </div>
            <div class="trip-actions">
                <button onclick="viewTicket('${booking.id}')" class="btn-secondary" style="flex:1">
                    <i class="fas fa-qrcode"></i> Ticket
                </button>
                ${canCancel ? `
                <button onclick="cancelBooking('${booking.id}')" class="btn-danger" style="flex:1">
                    <i class="fas fa-times"></i> Cancel
                </button>` : ''}
            </div>
        </div>`;
}

function viewTicket(bookingId) {
    api.getBooking(bookingId)
        .then(booking => {
            document.getElementById('ticket-from').textContent = booking.pickup_stop;
            document.getElementById('ticket-to').textContent = booking.dropoff_stop;
            document.getElementById('ticket-seat').textContent = booking.seat_number || 'N/A';
            document.getElementById('ticket-departure').textContent = booking.departure_time;
            document.getElementById('ticket-status').textContent = formatStatus(booking.status);
            document.getElementById('ticket-ref').textContent = booking.ticket_token || '';
            generateQRCode(booking.ticket_token || bookingId);
            document.getElementById('passenger-ticket-modal').classList.add('active');
        })
        .catch(err => showNotification('Could not load ticket: ' + err.message, 'error'));
}

function closeTicketModal() {
    document.getElementById('passenger-ticket-modal').classList.remove('active');
}

function cancelBooking(bookingId) {
    if (!confirm('Cancel this booking? This cannot be undone.')) return;

    const btn = document.querySelector(`button[onclick="cancelBooking('${bookingId}')"]`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    api.cancelBooking(bookingId)
        .then(() => {
            showNotification('Booking cancelled.', 'success');
            loadUserBookings();
        })
        .catch(err => {
            showNotification('Cancel failed: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-times"></i> Cancel'; }
        });
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

function updateNotifBadge() {
    api.getUnreadNotificationCount()
        .then(data => {
            const badge = document.getElementById('notif-badge');
            if (!badge) return;
            if (data.count > 0) {
                badge.textContent = data.count > 99 ? '99+' : data.count;
                badge.style.display = '';
            } else {
                badge.style.display = 'none';
            }
        })
        .catch(() => {});
}

function loadNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:24px"><i class="fas fa-spinner fa-spin fa-2x" style="color:#1A8A72"></i></div>';

    api.getUserNotifications()
        .then(notifications => {
            updateNotifBadge();
            if (notifications.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:40px;color:#888"><i class="fas fa-bell fa-3x" style="opacity:.2;margin-bottom:12px"></i><p>No notifications yet.</p></div>';
                return;
            }
            container.innerHTML = notifications.map(n => `
                <div class="trip-card" id="notif-${n.id}" style="${!n.is_ready ? 'border-left:3px solid #1A8A72' : ''}">
                    <div class="trip-header">
                        <div>
                            <div class="trip-time">${n.title}</div>
                            <div class="trip-route">${formatStatus(n.type || 'notification')}</div>
                        </div>
                        ${!n.is_ready
                            ? `<button onclick="markNotificationRead('${n.id}')" class="btn-secondary" style="padding:4px 10px;font-size:12px">Mark read</button>`
                            : '<span class="status-badge status-scheduled">Read</span>'}
                    </div>
                    <p style="padding:6px 0;color:#555;font-size:14px">${n.message}</p>
                    <small style="color:#aaa">${new Date(n.created_at).toLocaleString()}</small>
                </div>`).join('');
        })
        .catch(err => {
            container.innerHTML = `<div style="text-align:center;padding:20px;color:#FF3B30"><i class="fas fa-exclamation-triangle"></i> ${err.message}</div>`;
        });
}

function markNotificationRead(id) {
    api.markNotificationRead(id)
        .then(() => loadNotifications())
        .catch(err => showNotification('Error: ' + err.message, 'error'));
}

// ── MISC ──────────────────────────────────────────────────────────────────────

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

function generateQRCode(text) {
    const container = document.getElementById('ticket-qr-container');
    if (!container) return;
    container.innerHTML = '';
    new QRCode(container, {
        text: text,
        width: 180,
        height: 180,
        colorDark: '#0D1B2A',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H,
    });
}

// ── PROFILE ──────────────────────────────────────────────────────────────────

function loadProfile() {
    if (!currentUser) return;
    document.getElementById('profile-name').value = currentUser.full_name || '';
    document.getElementById('profile-email').value = currentUser.email || '';
    document.getElementById('profile-phone').value = currentUser.phone_number || '';
    document.getElementById('profile-password').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {};
            const name = document.getElementById('profile-name').value.trim();
            const email = document.getElementById('profile-email').value.trim();
            const phone = document.getElementById('profile-phone').value.trim();
            const currentPwd = document.getElementById('profile-current-password').value;
            const password = document.getElementById('profile-password').value;

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
                // Update local state
                currentUser = { ...currentUser, ...updated };
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(currentUser));
                document.getElementById('userName').textContent = currentUser.full_name;
                document.getElementById('profile-current-password').value = '';
                document.getElementById('profile-password').value = '';
                showNotification('Profile updated successfully!', 'success');
            } catch (err) {
                showNotification(err.message || 'Failed to update profile.', 'error');
            }
        });
    }
});
