const API = {
    // Base request function
    async request(endpoint, options = {}) {
        const url = `${Config.API_BASE_URL}${endpoint}`;
        
        // Get token from storage
        const token = Utils.storage.get('token');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };
        
        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            const response = await fetch(url, config);
            const data = await response.json().catch(() => null);
            
            if (!response.ok) {
                if (response.status === 401 && token && !endpoint.includes('/auth/login')) {
                Utils.storage.remove('token');
                window.location.reload();
                return;
                }
                const errorMessage = data?.error || data?.message || `Error: ${response.status}`;
            throw new Error(errorMessage);
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            Utils.toast(error.message, 'error');
            throw error;
        }
    },

    // Auth endpoints
    auth: {
        login(credentials) {
            return API.request('/auth/login', {
                method: 'POST',
                body: credentials
            });
        },
        
        register(userData) {
            return API.request('/auth/register', {
                method: 'POST',
                body: userData
            });
        },
        
        getProfile() {
            return API.request('/auth/me');
        },
        
        updateProfile(data) {
            return API.request('/auth/me', {
                method: 'PUT',
                body: data
            });
        },
        
        changePassword(data) {
            return API.request('/auth/change-password', {
                method: 'POST',
                body: data
            });
        }
    },

    // Passenger endpoints
    passenger: {
        // Search trips
        searchTrips(originId, destId, date) {
            return API.request(`/trips/search?origin_id=${originId}&dest_id=${destId}&travel_date=${date}`);
        },
        
        getTripDetails(tripId) {
            return API.request(`/trips/${tripId}/details`);
        },
        
        getActiveTrips() {
            return API.request('/trips/active');
        },
        // Bookings
        createBooking(bookingData) {
            return API.request('/bookings/', {
                method: 'POST',
                body: bookingData
            });
        },
        
        getMyBookings() {
            return API.request('/bookings/me');
        },
        
        cancelBooking(bookingId) {
            return API.request(`/bookings/${bookingId}/cancel`, {
                method: 'PUT'
            });
        },
        
        // Payments
        initializePayment(paymentData) {
            return API.request('/payments/initialize', {
                method: 'POST',
                body: paymentData
            });
        },
        
        // Tracking
        getBusLocation(tripId) {
            return API.request(`/locations/${tripId}`);
        },
        
        // Notifications
        getNotifications() {
            return API.request('/notifications/');
        },
        
        markNotificationRead(notificationId) {
            return API.request(`/notifications/${notificationId}/read`, {
                method: 'PATCH'
            });
        }
    },

    // Driver endpoints
    driver: {
        updateLocation(tripId, locationData) {
            return API.request(`/locations/${tripId}/update`, {
                method: 'POST',
                body: locationData
            });
        },
        
        getTripPassengers(tripId) {
            // This endpoint might need to be added to backend
            return API.request(`/trips/${tripId}/passengers`);
        }
    },

    // Admin endpoints
    admin: {
        // Buses
        getBuses() {
            return API.request('/buses/');
        },
        
        createBus(busData) {
            return API.request('/buses/', {
                method: 'POST',
                body: busData
            });
        },
        
        deleteBus(busId) {
            return API.request(`/buses/${busId}`, {
                method: 'DELETE'
            });
        },
        
        // Routes
        getRoutes() {
            return API.request('/routes/');
        },
        
        createRoute(routeData) {
            return API.request('/routes/', {
                method: 'POST',
                body: routeData
            });
        },
        
        addStopToRoute(routeId, stopData) {
            return API.request(`/routes/${routeId}/stops`, {
                method: 'POST',
                body: stopData
            });
        },
        
        // Stops
        getStops() {
            return API.request('/stops/');
        },
        
        createStop(stopData) {
            return API.request('/stops/', {
                method: 'POST',
                body: stopData
            });
        },
        
        // Trips
        getTrips() {
            return API.request('/trips/');
        },
        
        createTrip(tripData) {
            return API.request('/trips/', {
                method: 'POST',
                body: tripData
            });
        },
        
        updateTripStatus(tripId, status) {
            return API.request(`/trips/${tripId}/status`, {
                method: 'PATCH',
                body: { status }
            });
        },

        
        getStats() {
            return API.request('/admin/stats');
        },
        getRecentActivity(params = {}) {
            const query = new URLSearchParams(params).toString();
            const endpoint = query ? `/admin/recent-activity?${query}` : '/admin/recent-activity';
            return API.request(endpoint);
        },
        
        // Notifications
        broadcastNotification(data) {
            return API.request('/notifications/admin/broadcast', {
                method: 'POST',
                body: data
            });
        },



        sendNotification(notificationData) {
            return API.request('/notifications/admin/send', {
                method: 'POST',
                body: notificationData
            });
        }
    }
};