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
            console.log('Making API request to:', url);
            console.log('Request config:', config);
            
            const response = await fetch(url, config);
            
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.log('Non-JSON response:', text);
                throw new Error(`Server returned non-JSON response: ${text}`);
            }

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('API response data:', data);
            return data;
        } catch (error) {
            console.error('API Error:', error);
            
            // Handle network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
            }
            
            // Handle CORS errors
            if (error.message.includes('CORS')) {
                throw new Error('CORS error: Server is not configured to accept requests from this domain.');
            }
            
            throw error;
        }
    }

    // Authentication
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

    // Routes
    async getRoutes() {
        return this.request('/routes');
    }

    async getRoute(id) {
        return this.request(`/routes/${id}`);
    }

    // Trips
    async getTrips(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/trips?${queryString}`);
    }

    async getDriverTrips(driverId, date = 'today') {
        return this.request(`/trips/driver/${driverId}?date=${date}`);
    }

    async updateTripStatus(tripId, status) {
        return this.request(`/trips/${tripId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    }

    // Bookings
    async createBooking(bookingData) {
        return this.request('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
    }

    async getUserBookings(userId) {
        return this.request(`/bookings?user_id=${userId}`);
    }

    async getTripManifest(tripId) {
        return this.request(`/bookings/trip/${tripId}`);
    }

    async verifyTicket(ticketData) {
        return this.request('/bookings/verify-ticket', {
            method: 'POST',
            body: JSON.stringify(ticketData)
        });
    }

    // Payments
    async initiatePayment(paymentData) {
        return this.request('/payments/initiate', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    async verifyPayment(bookingId) {
        return this.request(`/payments/verify/${bookingId}`);
    }

    // Bus Locations
    async updateBusLocation(locationData) {
        return this.request('/bus-locations', {
            method: 'POST',
            body: JSON.stringify(locationData)
        });
    }

    async getBusLocation(busId) {
        return this.request(`/bus-locations/${busId}`);
    }

    // Notifications
    async getUserNotifications(userId) {
        return this.request(`/notifications?user_id=${userId}`);
    }

    async markNotificationRead(notificationId) {
        return this.request(`/notifications/${notificationId}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_read: true })
        });
    }
}

// Create global API instance
const api = new APIService();