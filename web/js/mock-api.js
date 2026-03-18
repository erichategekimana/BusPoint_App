// Mock API for testing without backend
class MockAPIService {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('mock_users') || '[]');
        this.nextUserId = this.users.length + 1;
    }

    async delay(ms = 1000) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async login(credentials) {
        await this.delay(1000);
        
        const user = this.users.find(u => 
            u.email === credentials.email && u.password === credentials.password
        );
        
        if (!user) {
            throw new Error('Invalid email or password');
        }
        
        const token = 'mock_token_' + Date.now();
        
        return {
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone_number: user.phone_number,
                role: user.role
            }
        };
    }

    async register(userData) {
        await this.delay(1000);
        
        // Check if user already exists
        const existingUser = this.users.find(u => u.email === userData.email);
        if (existingUser) {
            throw new Error('User with this email already exists');
        }
        
        // Create new user
        const newUser = {
            id: this.nextUserId++,
            ...userData,
            created_at: new Date().toISOString()
        };
        
        this.users.push(newUser);
        localStorage.setItem('mock_users', JSON.stringify(this.users));
        
        const token = 'mock_token_' + Date.now();
        
        return {
            token,
            user: {
                id: newUser.id,
                full_name: newUser.full_name,
                email: newUser.email,
                phone_number: newUser.phone_number,
                role: newUser.role
            }
        };
    }

    async getRoutes() {
        await this.delay(500);
        return [
            { id: 1, route_code: 'KGL-MSZ', name: 'Kigali to Musanze' },
            { id: 2, route_code: 'KGL-HUY', name: 'Kigali to Huye' },
            { id: 3, route_code: 'MSZ-KGL', name: 'Musanze to Kigali' }
        ];
    }

    async getTrips(params = {}) {
        await this.delay(500);
        return [
            {
                id: 1,
                bus_id: 1,
                route_id: 1,
                departure_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                arrival_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
                status: 'scheduled',
                capacity: 50,
                current_capacity: 25,
                route: { id: 1, name: 'Kigali to Musanze' }
            },
            {
                id: 2,
                bus_id: 2,
                route_id: 1,
                departure_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
                arrival_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
                status: 'scheduled',
                capacity: 45,
                current_capacity: 10,
                route: { id: 1, name: 'Kigali to Musanze' }
            }
        ];
    }

    async getUserBookings(userId) {
        await this.delay(500);
        return [
            {
                id: 1,
                user_id: userId,
                trip_id: 1,
                seat_number: 15,
                status: 'confirmed',
                ticket_token: 'ABC123DEF456',
                created_at: new Date().toISOString(),
                trip: {
                    id: 1,
                    departure_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
                }
            }
        ];
    }

    async getUserNotifications(userId) {
        await this.delay(500);
        return [
            {
                id: 1,
                user_id: userId,
                title: 'Welcome to Bus Point!',
                message: 'Your account has been created successfully.',
                type: 'info',
                is_read: false,
                created_at: new Date().toISOString()
            }
        ];
    }

    // Fallback methods for other endpoints
    async createBooking(bookingData) {
        await this.delay(1000);
        return {
            id: Date.now(),
            ...bookingData,
            status: 'confirmed',
            ticket_token: 'MOCK' + Date.now(),
            created_at: new Date().toISOString()
        };
    }

    async getDriverTrips(driverId) {
        await this.delay(500);
        return [];
    }

    async getTripManifest(tripId) {
        await this.delay(500);
        return [];
    }

    async updateBusLocation(locationData) {
        await this.delay(200);
        return { success: true };
    }

    async verifyTicket(ticketData) {
        await this.delay(500);
        return {
            success: true,
            passenger_name: 'John Doe',
            seat_number: 15
        };
    }

    async initiatePayment(paymentData) {
        await this.delay(1000);
        return {
            transaction_ref: 'MOCK' + Date.now(),
            status: 'pending',
            redirect_url: '#'
        };
    }

    async verifyPayment(bookingId) {
        await this.delay(500);
        return {
            booking_id: bookingId,
            status: 'completed'
        };
    }

    async updateTripStatus(tripId, status) {
        await this.delay(500);
        return { id: tripId, status };
    }

    async markNotificationRead(notificationId) {
        await this.delay(200);
        return { id: notificationId, is_read: true };
    }

    async getBusLocation(busId) {
        await this.delay(200);
        return {
            bus_id: busId,
            latitude: -1.9403 + (Math.random() - 0.5) * 0.01,
            longitude: 30.0619 + (Math.random() - 0.5) * 0.01,
            speed: Math.random() * 60,
            heading: Math.random() * 360,
            last_updated: new Date().toISOString()
        };
    }

    async getRoute(id) {
        await this.delay(200);
        return { id, route_code: 'KGL-MSZ', name: 'Kigali to Musanze' };
    }

    async request(endpoint, options = {}) {
        // Parse the endpoint and call appropriate method
        const [path, query] = endpoint.split('?');
        const segments = path.split('/').filter(s => s);
        
        try {
            if (segments[0] === 'auth') {
                if (segments[1] === 'login' && options.method === 'POST') {
                    return this.login(JSON.parse(options.body));
                }
                if (segments[1] === 'register' && options.method === 'POST') {
                    return this.register(JSON.parse(options.body));
                }
            }
            
            if (segments[0] === 'routes') {
                if (segments.length === 1) return this.getRoutes();
                return this.getRoute(parseInt(segments[1]));
            }
            
            if (segments[0] === 'trips') {
                if (segments[1] === 'driver') {
                    return this.getDriverTrips(parseInt(segments[2]));
                }
                return this.getTrips();
            }
            
            if (segments[0] === 'bookings') {
                if (options.method === 'POST') {
                    return this.createBooking(JSON.parse(options.body));
                }
                if (segments[1] === 'trip') {
                    return this.getTripManifest(parseInt(segments[2]));
                }
                if (query && query.includes('user_id=')) {
                    const userId = parseInt(query.split('user_id=')[1]);
                    return this.getUserBookings(userId);
                }
            }
            
            if (segments[0] === 'notifications' && query && query.includes('user_id=')) {
                const userId = parseInt(query.split('user_id=')[1]);
                return this.getUserNotifications(userId);
            }
            
            // Default empty response
            return [];
        } catch (error) {
            console.error('Mock API error:', error);
            throw error;
        }
    }
}

// Check if we should use mock API
const USE_MOCK_API = CONFIG.USE_MOCK_API === true;

if (USE_MOCK_API) {
    console.log('Using Mock API for testing');
    window.api = new MockAPIService();
}
