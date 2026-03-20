const Config = {
    // API Configuration
    API_BASE_URL: 'http://localhost:5000/api',
    
    // Map Configuration
    MAP_CENTER: [-1.9441, 30.0619], // Kigali coordinates
    MAP_ZOOM: 13,
    
    // App Settings
    APP_NAME: 'BusPoint',
    VERSION: '1.0.0',
    
    // Roles
    ROLES: {
        PASSENGER: 'passenger',
        DRIVER: 'driver',
        ADMIN: 'admin'
    },
    
    // Booking Steps
    BOOKING_STEPS: {
        SELECT_ROUTE: 1,
        SELECT_TRIP: 2,
        SELECT_SEAT: 3,
        PAYMENT: 4,
        CONFIRMATION: 5
    },
    
    // Trip Status
    TRIP_STATUS: {
        SCHEDULED: 'scheduled',
        DELAYED: 'delayed',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },
    
    // Colors
    COLORS: {
        PRIMARY: '#2E7D32',      // Dim green
        PRIMARY_LIGHT: '#4CAF50',
        PRIMARY_DARK: '#1B5E20',
        SECONDARY: '#FFFFFF',
        ACCENT: '#81C784',
        DANGER: '#E53935',
        WARNING: '#FFB300',
        INFO: '#1E88E5'
    }
};