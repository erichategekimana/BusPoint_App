// Main Application Logic
document.addEventListener('DOMContentLoaded', () => {
    // Initialize loading screen
    const loadingScreen = document.getElementById('loading-screen');
    
    // Simulate loading
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 1000);
    
    // Check for existing session
    checkAuth();
});

// Global utility functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideIn 0.3s ease;
    }
    
    .notification.success {
        background: #34C759;
        color: white;
    }
    
    .notification.error {
        background: #FF3B30;
        color: white;
    }
    
    .notification.info {
        background: #0D1B2A;
        color: white;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(notificationStyles);

// Add CSS for bus markers
const markerStyles = document.createElement('style');
markerStyles.textContent = `
    .bus-marker {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #1A8A72;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        border: 3px solid white;
    }
    
    .bus-marker i {
        color: white;
        font-size: 20px;
    }
    
    .popup-content {
        padding: 12px;
    }
    
    .popup-content h4 {
        margin: 0 0 8px 0;
        color: #0D1B2A;
    }
    
    .popup-content p {
        margin: 4px 0;
        font-size: 14px;
    }
    
    .popup-content small {
        color: #8E8E93;
    }
    
    .trips-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
    }
    
    .trip-card {
        background: white;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .trip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    
    .trip-time {
        font-size: 24px;
        font-weight: bold;
        color: #0D1B2A;
    }
    
    .trip-route {
        color: #8E8E93;
        font-size: 14px;
    }
    
    .trip-details {
        display: flex;
        gap: 24px;
        margin-bottom: 16px;
    }
    
    .detail-item {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #1A8A72;
    }
    
    .trip-actions {
        text-align: center;
    }
    
    .booking-details {
        margin-bottom: 24px;
    }
    
    .booking-details h3 {
        color: #0D1B2A;
        margin-bottom: 16px;
    }
    
    .booking-details p {
        margin: 8px 0;
    }
    
    .seat-selection {
        margin-bottom: 24px;
    }
    
    .seat-selection h4 {
        color: #0D1B2A;
        margin-bottom: 16px;
    }
    
    .seat-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
    }
    
    .seat {
        width: 40px;
        height: 40px;
        border: 2px solid #1A8A72;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .seat:hover {
        background: #1A8A72;
        color: white;
    }
    
    .seat.selected {
        background: #1A8A72;
        color: white;
    }
    
    .seat.booked {
        background: #FF3B30;
        color: white;
        cursor: not-allowed;
        opacity: 0.5;
    }
    
    .booking-summary {
        text-align: center;
        margin-bottom: 24px;
        padding: 16px;
        background: #F5F5F5;
        border-radius: 12px;
    }
    
    .booking-summary p {
        font-size: 18px;
        font-weight: bold;
        color: #1A8A72;
    }
    
    .qr-code {
        text-align: center;
        margin-top: 16px;
    }
    
    .qr-code canvas {
        margin: 0 auto;
    }
    
    .qr-code p {
        font-family: monospace;
        font-size: 12px;
        margin-top: 8px;
    }
    
    .notification-item {
        display: flex;
        align-items: flex-start;
        gap: 16px;
    }
    
    .notification-icon {
        width: 48px;
        height: 48px;
        border-radius: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: white;
    }
    
    .notification-icon.booking { background: #1A8A72; }
    .notification-icon.payment { background: #F5A623; }
    .notification-icon.trip { background: #0D1B2A; }
    .notification-icon.alert { background: #FF3B30; }
    
    .notification-content h4 {
        color: #0D1B2A;
        margin-bottom: 8px;
    }
    
    .notification-content p {
        color: #3A3A3C;
        margin-bottom: 4px;
    }
    
    .notification-content small {
        color: #8E8E93;
    }
    
    .status-badge {
        padding: 8px 16px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 12px;
    }
    
    .status-scheduled { background: #F5A623; }
    .status-in_progress { background: #1A8A72; }
    .status-departed { background: #1A8A72; }
    .status-completed { background: #34C759; }
    .status-arrived { background: #34C759; }
    .status-confirmed { background: #34C759; }
    .status-cancelled { background: #FF3B30; }
    
    .passenger-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
    }
    
    .passenger-avatar {
        width: 48px;
        height: 48px;
        border-radius: 24px;
        background: #1A8A72;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
    }
    
    .passenger-info h4 {
        color: #0D1B2A;
        margin: 0;
    }
    
    .passenger-info p {
        color: #8E8E93;
        margin: 4px 0 0 0;
    }
    
    .seat-badge {
        background: #F5A623;
        color: #0D1B2A;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 600;
    }
    
    .passenger-details {
        margin-bottom: 16px;
    }
    
    .passenger-details p {
        margin: 4px 0;
        color: #3A3A3C;
    }
    
    .trip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    
    .trip-details {
        display: flex;
        gap: 24px;
        margin-bottom: 16px;
        padding-top: 16px;
        border-top: 1px solid #F5F5F5;
    }
    
    .trip-actions {
        display: flex;
        gap: 8px;
    }
    
    .manifest-controls {
        margin-bottom: 24px;
    }
    
    .manifest-controls select {
        width: 100%;
        padding: 12px;
        border: 2px solid #F5F5F5;
        border-radius: 12px;
        font-size: 16px;
    }
    
    .scanner-container {
        text-align: center;
    }
    
    .scanner-area {
        position: relative;
        width: 100%;
        max-width: 400px;
        height: 300px;
        margin: 0 auto 24px;
        background: black;
        border-radius: 16px;
        overflow: hidden;
    }
    
    .scanner-area video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .scanner-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }
    
    .scanner-frame {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 200px;
        height: 200px;
        border: 3px solid #1A8A72;
        border-radius: 16px;
    }
    
    .scanner-controls {
        display: flex;
        gap: 16px;
        justify-content: center;
        margin-bottom: 24px;
    }
    
    .scan-result {
        min-height: 100px;
    }
    
    .scan-success {
        background: #34C759;
        color: white;
        padding: 24px;
        border-radius: 16px;
    }
    
    .scan-success h4 {
        margin: 16px 0 8px;
    }
    
    .gps-container {
        max-width: 600px;
        margin: 0 auto;
    }
    
    .status-card {
        background: white;
        padding: 24px;
        border-radius: 16px;
        margin-bottom: 24px;
        text-align: center;
    }
    
    .status-card h3 {
        color: #0D1B2A;
        margin-bottom: 16px;
    }
    
    .location-info {
        background: white;
        padding: 24px;
        border-radius: 16px;
        margin-bottom: 24px;
    }
    
    .info-item {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #F5F5F5;
    }
    
    .info-item:last-child {
        border-bottom: none;
    }
    
    .info-item label {
        color: #8E8E93;
    }
    
    .info-item span {
        font-weight: 600;
        color: #0D1B2A;
    }
    
    .gps-controls {
        display: flex;
        gap: 16px;
        justify-content: center;
    }
    
    .booking-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    
    .booking-header h4 {
        color: #0D1B2A;
        margin: 0;
    }
    
    .booking-header p {
        color: #8E8E93;
        margin: 4px 0 0 0;
    }
    
    .booking-details p {
        margin: 8px 0;
        color: #3A3A3C;
    }
    
    .booking-details i {
        color: #1A8A72;
        margin-right: 8px;
    }

    .profile-container {
        max-width: 500px;
        margin: 0 auto;
    }

    .profile-card {
        background: white;
        border-radius: 16px;
        padding: 32px 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .profile-avatar {
        text-align: center;
        margin-bottom: 24px;
    }

    .profile-avatar i {
        font-size: 72px;
        color: #1A8A72;
    }

    .profile-card .form-group {
        margin-bottom: 16px;
    }

    .profile-card .form-group label {
        display: block;
        font-size: 13px;
        color: #8E8E93;
        margin-bottom: 6px;
        font-weight: 600;
    }

    .profile-card .form-group input {
        width: 100%;
        padding: 12px;
        border: 2px solid #F5F5F5;
        border-radius: 12px;
        font-size: 16px;
        transition: border-color 0.3s;
        box-sizing: border-box;
    }

    .profile-card .form-group input:focus {
        border-color: #1A8A72;
        outline: none;
    }
`;
document.head.appendChild(markerStyles);