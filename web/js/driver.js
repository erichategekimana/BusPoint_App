// Driver Dashboard Logic

let driverTrips = [];

// ── Dashboard entry ─────────────────────────────────────────────────────────

function showDriverDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('driver-dashboard').classList.add('active');
    document.getElementById('passenger-dashboard').classList.remove('active');
    document.getElementById('admin-dashboard').classList.remove('active');

    document.getElementById('driverName').textContent = currentUser.full_name;

    // Reset scanner state so a new driver starts fresh
    stopDriverScanner();
    scanValidCount = 0;
    scanInvalidCount = 0;
    scannerProcessing = false;
    const validEl = document.getElementById('scan-valid-count');
    const invalidEl = document.getElementById('scan-invalid-count');
    const resultEl = document.getElementById('driver-scan-result');
    if (validEl) validEl.textContent = '0';
    if (invalidEl) invalidEl.textContent = '0';
    if (resultEl) resultEl.innerHTML = '';

    loadDriverTrips();
    showDriverSection('trips');
}

function showDriverSection(section) {
    document.querySelectorAll('#driver-dashboard .section').forEach(el => el.classList.remove('active'));
    document.getElementById(`driver-${section}`)?.classList.add('active');

    document.querySelectorAll('#driver-dashboard .nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`#driver-dashboard [onclick="showDriverSection('${section}')"]`);
    if (activeNav) activeNav.classList.add('active');

    if (section !== 'scanner') stopDriverScanner();
    if (section === 'profile') loadDriverProfile();
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
        const canStop  = trip.status === 'in_progress';
        const isDone   = trip.status === 'completed' || trip.status === 'cancelled';

        return `
        <div class="trip-card" id="driver-trip-card-${trip.id}">
            <div class="trip-header">
                <div>
                    <div class="trip-time">${formatDriverDateTime(trip.departure_time)}</div>
                    <div class="trip-route">${trip.route_name}</div>
                </div>
                <span class="status-badge status-${trip.status}">${trip.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
            </div>
            <div class="trip-details">
                <div class="detail-item"><i class="fas fa-bus"></i><span>${trip.bus_plate}</span></div>
                <div class="detail-item"><i class="fas fa-chair"></i><span>${trip.available_seats} seats</span></div>
                ${trip.arrival_time ? `
                <div class="detail-item">
                    <i class="fas fa-flag-checkered"></i>
                    <span>Arrives ${formatDriverDateTime(trip.arrival_time)}</span>
                </div>` : ''}
            </div>
            <div class="trip-actions">
                ${canStart ? `
                <button id="btn-start-${trip.id}" onclick="startTrip('${trip.id}')" class="btn-primary" style="flex:1">
                    <i class="fas fa-play"></i> Start Trip
                </button>` : ''}
                ${canStop ? `
                <button id="btn-stop-${trip.id}" onclick="stopTrip('${trip.id}')" class="btn-danger" style="flex:1">
                    <i class="fas fa-stop"></i> Complete Trip
                </button>` : ''}
                ${isDone ? `<span style="color:#888;font-size:13px;padding:8px">Trip ${trip.status.replace(/_/g, ' ')}</span>` : ''}
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
}

function formatDriverDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-RW', { dateStyle: 'short', timeStyle: 'short' });
}

function startTrip(tripId) {
    if (!confirm('Start this trip? Status will change to In Progress.')) return;

    const btn = document.getElementById(`btn-start-${tripId}`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting…'; }

    api.updateTrip(tripId, { status: 'in_progress' })
        .then(() => {
            showNotification('Trip started!', 'success');
            loadDriverTrips();
        })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Start Trip'; }
        });
}

function stopTrip(tripId) {
    if (!confirm('Complete this trip? Status will change to Completed.')) return;

    const btn = document.getElementById(`btn-stop-${tripId}`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completing…'; }

    api.updateTrip(tripId, { status: 'completed' })
        .then(() => {
            showNotification('Trip completed!', 'success');
            loadDriverTrips();
        })
        .catch(err => {
            showNotification('Error: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-stop"></i> Complete Trip'; }
        });
}

// No-op kept so auth.js logout cleanup doesn't throw
function stopDriverGPS() {}

// ── QR SCANNER ──────────────────────────────────────────────────────────────

let html5QrScanner   = null;
let scannerProcessing = false;
let scanValidCount   = 0;
let scanInvalidCount = 0;

function startDriverScanner() {
    const container = document.getElementById('qr-reader');
    if (!container) return;

    if (html5QrScanner) { html5QrScanner.stop().catch(() => {}); html5QrScanner = null; }
    container.innerHTML = '';

    html5QrScanner = new Html5Qrcode('qr-reader');
    html5QrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => onQrScanSuccess(decodedText),
        () => {}
    ).then(() => {
        showNotification('Scanner started — point at a ticket QR code.', 'success');
    }).catch(() => {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#888"><i class="fas fa-camera fa-3x" style="opacity:.2;margin-bottom:12px"></i><p>Camera access denied. Use manual entry below.</p></div>';
    });
}

function stopDriverScanner() {
    if (html5QrScanner) { html5QrScanner.stop().catch(() => {}); html5QrScanner = null; }
    const container = document.getElementById('qr-reader');
    if (container) container.innerHTML = '';
}

function onQrScanSuccess(token) {
    if (scannerProcessing) return;
    scannerProcessing = true;
    if (html5QrScanner) html5QrScanner.pause();
    verifyTicketToken(token);
}

function verifyManualToken() {
    const input = document.getElementById('manual-ticket-token');
    const token = (input?.value || '').trim();
    if (!token) { showNotification('Please enter a ticket token.', 'error'); return; }

    const btn = document.querySelector('#driver-scanner button[onclick="verifyManualToken()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    verifyTicketToken(token).finally(() => {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i>'; }
    });
}

async function verifyTicketToken(token) {
    const resultDiv = document.getElementById('driver-scan-result');
    resultDiv.innerHTML = '<div style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin fa-2x" style="color:#1A8A72"></i><p>Verifying ticket...</p></div>';

    try {
        const result = await api.verifyTicket(token);

        if (result.valid) {
            scanValidCount++;
            document.getElementById('scan-valid-count').textContent = scanValidCount;
            playTicketSound('success');
            const b = result.booking;
            resultDiv.innerHTML = `
                <div style="background:#E8F5E9;border:2px solid #1A8A72;border-radius:12px;padding:20px;text-align:center">
                    <div style="width:60px;height:60px;background:#1A8A72;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
                        <i class="fas fa-check" style="color:white;font-size:24px"></i>
                    </div>
                    <h3 style="color:#1A8A72;margin-bottom:12px">Ticket Valid!</h3>
                    <div style="background:white;border-radius:8px;padding:12px;text-align:left;margin-bottom:12px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                            <span style="color:#888">Passenger</span><strong>${result.passenger_name}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                            <span style="color:#888">Seat</span><strong>#${b.seat_number || 'N/A'}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                            <span style="color:#888">From</span><strong>${b.pickup_stop || 'N/A'}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between">
                            <span style="color:#888">To</span><strong>${b.dropoff_stop || 'N/A'}</strong>
                        </div>
                    </div>
                    <button onclick="resumeScanner()" class="btn-primary" style="width:100%">
                        <i class="fas fa-qrcode"></i> Scan Next Ticket
                    </button>
                </div>`;
        } else {
            scanInvalidCount++;
            document.getElementById('scan-invalid-count').textContent = scanInvalidCount;
            playTicketSound('error');
            resultDiv.innerHTML = `
                <div style="background:#FFEBEE;border:2px solid #FF3B30;border-radius:12px;padding:20px;text-align:center">
                    <div style="width:60px;height:60px;background:#FF3B30;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
                        <i class="fas fa-times" style="color:white;font-size:24px"></i>
                    </div>
                    <h3 style="color:#FF3B30;margin-bottom:8px">Invalid Ticket</h3>
                    <p style="color:#666;margin-bottom:16px">${result.reason}</p>
                    ${result.boarded_at ? `<p style="color:#888;font-size:12px;margin-bottom:16px">Previously scanned at: ${new Date(result.boarded_at).toLocaleString()}</p>` : ''}
                    <button onclick="resumeScanner()" class="btn-secondary" style="width:100%">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>`;
        }
    } catch (err) {
        scanInvalidCount++;
        document.getElementById('scan-invalid-count').textContent = scanInvalidCount;
        resultDiv.innerHTML = `
            <div style="background:#FFEBEE;border:2px solid #FF3B30;border-radius:12px;padding:20px;text-align:center">
                <i class="fas fa-exclamation-triangle" style="color:#FF3B30;font-size:32px;margin-bottom:8px"></i>
                <p style="color:#FF3B30">${err.message || 'Verification failed'}</p>
                <button onclick="resumeScanner()" class="btn-secondary" style="width:100%;margin-top:12px">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>`;
    }

    scannerProcessing = false;
}

function resumeScanner() {
    document.getElementById('driver-scan-result').innerHTML = '';
    const input = document.getElementById('manual-ticket-token');
    if (input) input.value = '';
    if (html5QrScanner) { try { html5QrScanner.resume(); } catch (e) {} }
}

function playTicketSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.value = 0.1;
        osc.frequency.value = type === 'success' ? 880 : 220;
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, type === 'success' ? 200 : 300);
    } catch (e) {}
}

// ── PROFILE ─────────────────────────────────────────────────────────────────

function loadDriverProfile() {
    if (!currentUser) return;
    document.getElementById('driver-profile-name').value  = currentUser.full_name    || '';
    document.getElementById('driver-profile-email').value = currentUser.email        || '';
    document.getElementById('driver-profile-phone').value = currentUser.phone_number || '';
    document.getElementById('driver-profile-current-password').value = '';
    document.getElementById('driver-profile-password').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('driver-profile-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

        const data = {};
        const name       = document.getElementById('driver-profile-name').value.trim();
        const email      = document.getElementById('driver-profile-email').value.trim();
        const phone      = document.getElementById('driver-profile-phone').value.trim();
        const currentPwd = document.getElementById('driver-profile-current-password').value;
        const password   = document.getElementById('driver-profile-password').value;

        if (name  && name  !== currentUser.full_name)     data.full_name    = name;
        if (email && email !== currentUser.email)         data.email        = email;
        if (phone && phone !== currentUser.phone_number)  data.phone_number = phone;
        if (password) {
            if (!currentPwd) {
                showNotification('Please enter your current password to change it.', 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
                return;
            }
            data.current_password = currentPwd;
            data.password = password;
        }

        if (Object.keys(data).length === 0) {
            showNotification('No changes to save.', 'info');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
            return;
        }

        try {
            const updated = await api.updateProfile(data);
            currentUser = { ...currentUser, ...updated };
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(currentUser));
            document.getElementById('driverName').textContent = currentUser.full_name;
            document.getElementById('driver-profile-current-password').value = '';
            document.getElementById('driver-profile-password').value = '';
            showNotification('Profile updated successfully!', 'success');
        } catch (err) {
            showNotification(err.message || 'Failed to update profile.', 'error');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
        }
    });
});
