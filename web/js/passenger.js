// Passenger Dashboard Logic

let busMarkers = {};               // keyed by bus_id → maplibregl.Marker
let busLocationInterval = null;
let availableStops = [];
let availableRouteStops = [];
let selectedSeat = null;
let bookingContext = null;         // { tripId, fromStopId, toStopId }
let pendingBooking = null;         // booking object awaiting payment
let selectedPaymentMethod = 'mtn';

// ── DASHBOARD ENTRY ──────────────────────────────────────────────────────────

function showPassengerDashboard() {
    document.getElementById('auth-section')?.classList.add('hidden');
    document.getElementById('passenger-dashboard')?.classList.add('active');
    document.getElementById('driver-dashboard')?.classList.remove('active');

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
                const updatedAt = loc.captured_at || loc.last_updated || new Date().toISOString();
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
            });

            // Remove markers for buses no longer reporting
            Object.keys(busMarkers).forEach(id => {
                if (!seen.has(id)) {
                    busMarkers[id].remove();
                    delete busMarkers[id];
                }
            });
        })
        .catch(() => {}); // silent — no buses live is normal
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
    const opts = ['<option value="">Select stop</option>']
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
                if (t.status === 'cancelled') return false;
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
        const statusClass = trip.status === 'scheduled' ? 'status-scheduled'
            : trip.status === 'in_progress' ? 'status-active' : 'status-cancelled';

        return `
            <div class="trip-card">
                <div class="trip-header">
                    <div>
                        <div class="trip-time">${depStr}</div>
                        <div class="trip-route">${trip.route_info?.name || 'Route'} · ${depDate}</div>
                    </div>
                    <span class="status-badge ${statusClass}">${trip.status}</span>
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
                    <div class="detail-item"><i class="fas fa-info-circle"></i><span>Status: ${trip.status}</span></div>
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

    const isPhone = method === 'mtn' || method === 'airtel';
    document.getElementById('payment-phone-field').style.display = isPhone ? '' : 'none';
    document.getElementById('payment-ref-field').style.display = isPhone ? 'none' : '';
}

function submitPayment() {
    if (!pendingBooking) return;
    const btn = document.getElementById('payment-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';

    const ref = document.getElementById('payment-ref-input')?.value.trim();
    const txRef = ref || `BP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    api.initiatePayment({
        booking_id: pendingBooking.id,
        amount: 500,
        currency: 'RWF',
        payment_method: selectedPaymentMethod,
        transaction_ref: txRef
    })
        .then(() => {
            closePaymentModal();
            showNotification('Payment successful! Your seat is confirmed.', 'success');
            loadUserBookings();
            showPassengerSection('bookings');
        })
        .catch(() => {
            closePaymentModal();
            // Booking exists even if payment fails — inform user
            showNotification('Booking confirmed. Payment will be collected on boarding.', 'info');
            loadUserBookings();
            showPassengerSection('bookings');
        });
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
    const statusClass = booking.status === 'confirmed' ? 'status-scheduled'
        : booking.status === 'cancelled' ? 'status-cancelled' : 'status-active';
    const pickup = getStopName(booking.pickup_stop_id);
    const dropoff = getStopName(booking.dropoff_stop_id);
    const token = (booking.ticket_token || '').slice(0, 12) + '…';
    const canCancel = booking.status === 'pending' || booking.status === 'confirmed';

    return `
        <div class="trip-card">
            <div class="trip-header">
                <div>
                    <div class="trip-time">Seat ${booking.seat_number || '—'}</div>
                    <div class="trip-route">${pickup} → ${dropoff}</div>
                </div>
                <span class="status-badge ${statusClass}">${booking.status}</span>
            </div>
            <div class="trip-details">
                <div class="detail-item"><i class="fas fa-ticket-alt"></i><span>Ref: ${token}</span></div>
                <div class="detail-item"><i class="fas fa-calendar"></i><span>${new Date(booking.created_at).toLocaleDateString()}</span></div>
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
            document.getElementById('ticket-from').textContent = getStopName(booking.pickup_stop_id);
            document.getElementById('ticket-to').textContent = getStopName(booking.dropoff_stop_id);
            document.getElementById('ticket-seat').textContent = booking.seat_number || 'N/A';
            document.getElementById('ticket-departure').textContent = booking.trip?.departure_time
                ? new Date(booking.trip.departure_time).toLocaleString() : 'N/A';
            document.getElementById('ticket-status').textContent = booking.status;
            document.getElementById('ticket-ref').textContent = booking.ticket_token || '';
            generateQRCode(booking.ticket_token || bookingId, 'ticket-qr-canvas');
            document.getElementById('passenger-ticket-modal').classList.add('active');
        })
        .catch(err => showNotification('Could not load ticket: ' + err.message, 'error'));
}

function closeTicketModal() {
    document.getElementById('passenger-ticket-modal').classList.remove('active');
}

function cancelBooking(bookingId) {
    if (!confirm('Cancel this booking? This cannot be undone.')) return;
    api.cancelBooking(bookingId)
        .then(() => {
            showNotification('Booking cancelled.', 'success');
            loadUserBookings();
        })
        .catch(err => showNotification('Cancel failed: ' + err.message, 'error'));
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

function loadNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:24px"><i class="fas fa-spinner fa-spin fa-2x" style="color:#1A8A72"></i></div>';

    api.getUserNotifications()
        .then(notifications => {
            if (notifications.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:40px;color:#888"><i class="fas fa-bell fa-3x" style="opacity:.2;margin-bottom:12px"></i><p>No notifications yet.</p></div>';
                return;
            }
            container.innerHTML = notifications.map(n => `
                <div class="trip-card" id="notif-${n.id}" style="${!n.is_ready ? 'border-left:3px solid #1A8A72' : ''}">
                    <div class="trip-header">
                        <div>
                            <div class="trip-time">${n.title}</div>
                            <div class="trip-route">${n.type || 'notification'}</div>
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

function generateQRCode(text, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 120;
    canvas.width = size;
    canvas.height = size;

    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);

    // Data cells — deterministic from text
    ctx.fillStyle = '#000';
    const cells = 10;
    const cell = size / cells;
    for (let i = 0; i < cells; i++) {
        for (let j = 0; j < cells; j++) {
            const code = text.charCodeAt((i * cells + j) % text.length);
            if ((code + i * 3 + j * 7) % 3 !== 0) {
                ctx.fillRect(i * cell, j * cell, cell, cell);
            }
        }
    }

    // Finder pattern — top-left
    [[0, 0]].forEach(([ox, oy]) => {
        ctx.fillStyle = '#000'; ctx.fillRect(ox, oy, cell * 3, cell * 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(ox + cell * 0.5, oy + cell * 0.5, cell * 2, cell * 2);
        ctx.fillStyle = '#000'; ctx.fillRect(ox + cell, oy + cell, cell, cell);
    });
}
