// Configuration
const CONFIG = {
    API_BASE_URL: 'https://buspoint-backend.onrender.com/api', // Updated to use your backend
    SOCKET_URL: 'https://buspoint-backend.onrender.com',
    MAPBOX_TOKEN: 'pk.eyJ1IjoiYnVzcG9pbnQiLCJhIjoiY2x3eHl6M3gwMDFoMzJxbzR4cjBkNjN4ZCJ9.example', // Replace with your token
    
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
let passengerMap = null;
let gpsWatchId = null;
let isGPSTracking = false;