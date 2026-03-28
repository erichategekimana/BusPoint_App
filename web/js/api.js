// API Service
class APIService {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add auth token if available
        if (authToken) {
            config.headers.Authorization = `Bearer ${authToken}`;
        }

        try {
            const response = await fetch(url, config);

            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text}`);
            }

            if (response.status === 401 && authToken) {
                // Token expired or invalid — auto-logout
                authToken = null;
                currentUser = null;
                localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
                localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);

                document.getElementById('passenger-dashboard')?.classList.remove('active');
                document.getElementById('driver-dashboard')?.classList.remove('active');
                document.getElementById('admin-dashboard')?.classList.remove('active');
                document.getElementById('loginForm')?.reset();
                document.getElementById('registerForm')?.reset();
                document.getElementById('auth-section')?.classList.remove('hidden');

                showNotification('Session expired. Please sign in again.', 'error');
                throw new Error('Session expired');
            }

            if (!response.ok) {
                const message = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
                throw new Error(message);
            }

            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to server.');
            }
            throw error;
        }
    }

    // ── Authentication ──────────────────────────────────────────────────────

    async login(credentials) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    }

    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateProfile(data) {
        return this.request('/auth/update', {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    // ── Routes ──────────────────────────────────────────────────────────────

    async getRoutes(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/routes${qs ? `?${qs}` : ''}`);
    }

    async getRoute(id) {
        return this.request(`/routes/${id}`);
    }

    async createRoute(data) {
        return this.request('/routes', { method: 'POST', body: JSON.stringify(data) });
    }

    async updateRoute(id, data) {
        return this.request(`/routes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    }

    async deleteRoute(id) {
        return this.request(`/routes/${id}`, { method: 'DELETE' });
    }

    // ── Stops ───────────────────────────────────────────────────────────────

    async getStops(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/stops${qs ? `?${qs}` : ''}`);
    }

    async createStop(data) {
        return this.request('/stops', { method: 'POST', body: JSON.stringify(data) });
    }

    async updateStop(id, data) {
        return this.request(`/stops/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    }

    async deleteStop(id) {
        return this.request(`/stops/${id}`, { method: 'DELETE' });
    }

    async createRouteStop(data) {
        return this.request('/route-stops', { method: 'POST', body: JSON.stringify(data) });
    }

    async updateRouteStop(id, data) {
        return this.request(`/route-stops/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    }

    async deleteRouteStop(id) {
        return this.request(`/route-stops/${id}`, { method: 'DELETE' });
    }

    // ── Buses ───────────────────────────────────────────────────────────────

    async getBuses(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/buses${qs ? `?${qs}` : ''}`);
    }

    // ── Route Stops ─────────────────────────────────────────────────────────

    async getRouteStops(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/route-stops${qs ? `?${qs}` : ''}`);
    }

    // ── Trips ───────────────────────────────────────────────────────────────

    async getTrips(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/trips${qs ? `?${qs}` : ''}`);
    }

    async getTrip(id) {
        return this.request(`/trips/${id}`);
    }

    async createTrip(data) {
        return this.request('/trips', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateTrip(id, data) {
        return this.request(`/trips/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    async deleteTrip(id) {
        return this.request(`/trips/${id}`, { method: 'DELETE' });
    }

    // ── Bookings ─────────────────────────────────────────────────────────────

    async getBookings(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/bookings${qs ? `?${qs}` : ''}`);
    }

    async createBooking(data) {
        return this.request('/bookings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getUserBookings() {
        return this.getBookings();
    }

    async getBooking(id) {
        return this.request(`/bookings/${id}`);
    }

    async cancelBooking(id) {
        return this.request(`/bookings/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'cancelled' })
        });
    }

    // ── Payments ─────────────────────────────────────────────────────────────

    async initiatePayment(data) {
        return this.request('/payments', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async verifyPayment(id) {
        return this.request(`/payments/${id}`);
    }

    async checkPaymentStatus(id) {
        return this.request(`/payments/${id}/status`);
    }

    async createBus(data) {
        return this.request('/buses', { method: 'POST', body: JSON.stringify(data) });
    }

    async updateBus(id, data) {
        return this.request(`/buses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    }

    async deleteBus(id) {
        return this.request(`/buses/${id}`, { method: 'DELETE' });
    }

    // ── Bus Locations ─────────────────────────────────────────────────────────

    async getBusLocations(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/bus-locations${qs ? `?${qs}` : ''}`);
    }

    async createBusLocation(data) {
        return this.request('/bus-locations', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getRouteCoordinates(routeId) {
        return this.request(`/routes/${routeId}/coordinates`);
    }

    async getTripGeometry(tripId) {
        return this.request(`/trips/${tripId}/geometry`);
    }

    async updateBusLocation(id, data) {
        return this.request(`/bus-locations/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    async getUserNotifications() {
        return this.request('/notifications');
    }

    async markNotificationRead(id) {
        return this.request(`/notifications/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_ready: true })
        });
    }

    async broadcastNotification(data) {
        return this.request('/notifications/broadcast', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getUnreadNotificationCount() {
        return this.request('/notifications/unread-count');
    }

    // ── Manifests / legacy stubs ──────────────────────────────────────────────

    async getTripManifest(tripId) {
        return this.getBookings({ trip_id: tripId });
    }

    async verifyTicket(ticketToken) {
        return this.request('/bookings/verify', {
            method: 'POST',
            body: JSON.stringify({ ticket_token: ticketToken })
        });
    }

    async updateTripStatus(tripId, status) {
        return this.updateTrip(tripId, { status });
    }

    async getAdminTrips(adminId) {
        return this.getTrips({ assigned_to: adminId });
    }
}

// Create global API instance
var api = new APIService();
