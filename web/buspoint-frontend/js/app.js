const App = {
    currentPage: null,
    
    init() {
        // Initialize based on user role
        const role = Auth.currentUser?.role;
        
        if (role === Config.ROLES.PASSENGER) {
            this.navigate('search');
        } else if (role === Config.ROLES.DRIVER) {
            this.navigate('driver-dashboard');
        } else if (role === Config.ROLES.ADMIN) {
            this.navigate('admin-dashboard');
        }
        
        // Load notifications
        Notifications.init();
        
        // Setup event listeners
        this.setupEventListeners();
    },
    
    setupEventListeners() {
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            const userDropdown = document.getElementById('user-dropdown');
            const notifPanel = document.getElementById('notifications-panel');
            
            if (!e.target.closest('.user-menu') && userDropdown) {
                userDropdown.classList.add('hidden');
            }
            
            if (!e.target.closest('.notification-bell') && notifPanel) {
                notifPanel.classList.add('hidden');
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // ESC to close modals
            if (e.key === 'Escape') {
                Utils.modal.close();
            }
        });
    },
    
    navigate(page) {
        // Cleanup previous page
        this.cleanupCurrentPage(page);
        
        this.currentPage = page;
        
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        // Route to appropriate module
        switch(page) {
            // Passenger pages
            case 'search':
                PassengerBooking.init();
                break;
            case 'tickets':
                PassengerTickets.init();
                break;
            case 'tracking':
                PassengerTracking.init();
                break;
                
            // Driver pages
            case 'driver-dashboard':
                DriverDashboard.init();
                break;
            case 'scanner':
                DriverScanner.init();
                break;
                
            // Admin pages
            case 'admin-dashboard':
                AdminDashboard.init();
                break;
            case 'admin-buses':
                AdminBuses.init();
                break;
            case 'admin-routes':
                AdminRoutes.init();
                break;
            case 'admin-trips':
                AdminTrips.init();
                break;
                
            // Profile (all roles)
            case 'profile':
                this.renderProfile();
                break;
                
            default:
                // 404 or default
                this.renderNotFound();
        }
    },
    
    cleanupCurrentPage(newPage) {
        const role = Auth.currentUser?.role;
        const oldPage = this.currentPage;

        // only cleanup passenger tracking if user is a passenger
        if (role === Config.ROLES.PASSENGER) {
            PassengerTracking.cleanup();
        }

        // Only cleanup driver dashboard if user is a driver
        if (role === Config.ROLES.DRIVER) {
            const driverPages = ['driver-dashboard', 'scanner'];

            // If going to a page that is not a driver page and not the profile
            if (newPage && !driverPages.includes(newPage) && newPage !== 'profile') {
            DriverLocation.stopTracking();      // stop tracking when leaving driver role
            DriverScanner.destroy();            // fully destroy scanner
        } else {
            // Staying within driver pages: only pause scanner when leaving the scanner page
            if (oldPage === 'scanner' && newPage !== 'scanner') {
                try {
                    DriverScanner.cleanup();        // just pause the scanner
                } catch (error) {
                    console.error('Error occurred while cleaning up scanner:', error);
                }
            }
            // Do NOT stop location tracking
        }
};

    // Destroy any open modals
    Utils.modal.close();
},

    renderProfile() {
        const container = document.getElementById('main-content');
        const user = Auth.currentUser;
        
        container.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto;">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-user"></i> My Profile</h3>
                    </div>
                    <div class="card-body">
                        <div style="text-align: center; margin-bottom: 2rem;">
                            <div style="width: 100px; height: 100px; background: var(--primary-lighter); 
                                        border-radius: 50%; display: flex; align-items: center; justify-content: center; 
                                        margin: 0 auto 1rem;">
                                <i class="fas fa-user" style="font-size: 3rem; color: var(--primary);"></i>
                            </div>
                            <h2 style="color: var(--gray-800);">${user.full_name}</h2>
                            <span class="badge badge-success" style="text-transform: uppercase;">${user.role}</span>
                        </div>
                        
                        <form onsubmit="App.updateProfile(event)">
                            <div class="form-group">
                                <label>Full Name</label>
                                <input type="text" id="profile-name" class="form-select" value="${user.full_name}">
                            </div>
                            <div class="form-group">
                                <label>Phone Number</label>
                                <input type="tel" class="form-select" value="${user.phone_number}" disabled>
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" id="profile-email" class="form-select" value="${user.email || ''}">
                            </div>
                            <button type="submit" class="btn btn-success" style="width: 100%;">
                                <i class="fas fa-save"></i> Save Changes
                            </button>
                        </form>
                        
                        <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--gray-200);">
                            <h4 style="margin-bottom: 1rem; color: var(--gray-700);">Security</h4>
                            <button class="btn btn-outline" onclick="App.showChangePassword()" style="width: 100%;">
                                <i class="fas fa-lock"></i> Change Password
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    async updateProfile(e) {
        e.preventDefault();
        
        const name = document.getElementById('profile-name').value;
        const email = document.getElementById('profile-email').value;
        
        Utils.showLoading('Saving...');
        
        try {
            await API.auth.updateProfile({
                full_name: name,
                email: email
            });
            
            // Update local user data
            Auth.currentUser.full_name = name;
            Auth.currentUser.email = email;
            Utils.storage.set('user', Auth.currentUser);
            
            Utils.hideLoading();
            Utils.toast('Profile updated', 'success');
            Auth.updateUI(); // Update nav display
            
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    showChangePassword() {
        const modalContent = `
            <form onsubmit="App.changePassword(event)">
                <div class="form-group">
                    <label>Current Password</label>
                    <input type="password" id="old-password" class="form-select" required>
                </div>
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" id="new-password" class="form-select" required minlength="6">
                </div>
                <div class="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" id="confirm-password" class="form-select" required>
                </div>
                <button type="submit" class="btn btn-success" style="width: 100%;">
                    <i class="fas fa-lock"></i> Update Password
                </button>
            </form>
        `;
        
        Utils.modal.open(modalContent, { title: 'Change Password' });
    },
    
    async changePassword(e) {
        e.preventDefault();
        
        const oldPass = document.getElementById('old-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirmPass = document.getElementById('confirm-password').value;
        
        if (newPass !== confirmPass) {
            Utils.toast('Passwords do not match', 'error');
            return;
        }
        
        Utils.showLoading('Updating...');
        
        try {
            await API.auth.changePassword({
                old_password: oldPass,
                new_password: newPass
            });
            
            Utils.hideLoading();
            Utils.modal.close();
            Utils.toast('Password changed successfully', 'success');
            
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    renderNotFound() {
        document.getElementById('main-content').innerHTML = `
            <div class="empty-state" style="padding: 4rem;">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Page Not Found</h3>
                <p>The page you're looking for doesn't exist.</p>
                <button class="btn btn-success" onclick="App.navigate('search')" style="margin-top: 1rem;">
                    Go Home
                </button>
            </div>
        `;
    }
};

// Notifications Module
const Notifications = {
    notifications: [],
    
    async init() {
        await this.loadNotifications();
        this.updateBadge();
    },
    
    async loadNotifications() {
        if (!Auth.isAuthenticated()) return;
        
        try {
            this.notifications = await API.passenger.getNotifications();
        } catch (error) {
            this.notifications = [];
        }
    },
    
    updateBadge() {
        const unread = this.notifications.filter(n => !n.is_ready).length;
        const badge = document.getElementById('notif-count');
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'block' : 'none';
        }
    },
    
    toggle() {
        const panel = document.getElementById('notifications-panel');
        panel.classList.toggle('hidden');
        
        if (!panel.classList.contains('hidden')) {
            this.renderList();
        }
    },
    
    renderList() {
        const list = document.getElementById('notifications-list');
        
        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = this.notifications.map(notif => `
            <div class="notification-item ${notif.is_ready ? '' : 'unread'}" 
                 onclick="Notifications.markRead('${notif.id}')">
                <div class="title">${notif.title}</div>
                <div class="message">${notif.message}</div>
                <div class="time">${Utils.timeAgo(notif.created_at)}</div>
            </div>
        `).join('');
    },
    
    async markRead(notificationId) {
        try {
            await API.passenger.markNotificationRead(notificationId);
            
            const notif = this.notifications.find(n => n.id === notificationId);
            if (notif) {
                notif.is_ready = true;
                this.updateBadge();
                this.renderList();
            }
            
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});