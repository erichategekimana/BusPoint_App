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
                const message = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
                throw new Error(message);
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

    // Stops
    async getStops() {
        return this.request('/stops');
    }

    // Buses
    async getBuses() {
        return this.request('/buses');
    }

    // Route Stops
    async getRouteStops(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/route-stops${queryString ? `?${queryString}` : ''}`);
    }

    // Unsupported endpoints in current backend
    async getTrips() {
        throw new Error('Trips endpoint is not available on the current backend.');
    }

    async getDriverTrips() {
        throw new Error('Driver trips endpoint is not available on the current backend.');
    }

    async updateTripStatus() {
        throw new Error('Trip status update endpoint is not available on the current backend.');
    }

    async createBooking() {
        throw new Error('Booking endpoint is not available on the current backend.');
    }

    async getUserBookings() {
        throw new Error('Bookings endpoint is not available on the current backend.');
    }

    async getTripManifest() {
        throw new Error('Trip manifest endpoint is not available on the current backend.');
    }

    async verifyTicket() {
        throw new Error('Ticket verification endpoint is not available on the current backend.');
    }

    async initiatePayment() {
        throw new Error('Payments endpoint is not available on the current backend.');
    }

    async verifyPayment() {
        throw new Error('Payments endpoint is not available on the current backend.');
    }

    async updateBusLocation() {
        throw new Error('Bus location endpoint is not available on the current backend.');
    }

    async getBusLocation() {
        throw new Error('Bus location endpoint is not available on the current backend.');
    }

    async getUserNotifications() {
        throw new Error('Notifications endpoint is not available on the current backend.');
    }

    async markNotificationRead() {
        throw new Error('Notifications endpoint is not available on the current backend.');
    }
}

// Create global API instance
var api = new APIService();
