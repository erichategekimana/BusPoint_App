// Configuration
const CONFIG = {
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:5001/api'
        : '/api',
    SOCKET_URL: window.location.origin,
    MAP_STYLE_URL: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
    STADIA_API_KEY: '9d573f8a-efd1-4d63-ab9b-05eacfb8fcd8', // Optional on localhost; required for non-localhost usage
    
    // Default coordinates for Rwanda (Kigali)
    DEFAULT_CENTER: [30.0619, -1.9403],
    DEFAULT_ZOOM: 12,
    
    // Update intervals
    GPS_UPDATE_INTERVAL: 30000, // 30 seconds
    BUS_LOCATION_UPDATE_INTERVAL: 5000, // 5 seconds
    
    // Local storage keys
    STORAGE_KEYS: {
        AUTH_TOKEN: 'buspoint_auth_token',
        USER_DATA: 'buspoint_user_data'
    }
};

// Global variables
let currentUser = null;
let authToken = null;
let socket = null;
window.passengerMap = window.passengerMap || null;
let gpsWatchId = null;
let isGPSTracking = false;
