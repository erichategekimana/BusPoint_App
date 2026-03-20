const AdminDashboard = {
    stats: {
        totalUsers: 0,
        activeTrips: 0,
        todayBookings: 0,
        revenue: 0
    },
    
    async init() {
        await this.loadStats();
        this.render();
    },
    
    async loadStats() {
        // In real app, fetch from API
        // For now, use mock data or calculate from existing data
        try {
            const [trips, bookings] = await Promise.all([
                API.admin.getTrips(),
                API.passenger.getMyBookings() // Should be admin endpoint
            ]);
            
            this.stats = {
                totalUsers: 156, // Mock
                activeTrips: trips.filter(t => t.status === 'scheduled').length,
                todayBookings: bookings.length,
                revenue: bookings.length * 500
            };
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },
    
    render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="admin-dashboard">
                <div style="margin-bottom: 2rem;">
                    <h2 style="color: var(--gray-800); margin-bottom: 0.5rem;">Dashboard Overview</h2>
                    <p style="color: var(--gray-500);">Welcome back, ${Auth.currentUser.full_name}</p>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon primary">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-info">
                            <h4>${this.stats.totalUsers}</h4>
                            <p>Total Users</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon success">
                            <i class="fas fa-bus"></i>
                        </div>
                        <div class="stat-info">
                            <h4>${this.stats.activeTrips}</h4>
                            <p>Active Trips</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon warning">
                            <i class="fas fa-ticket-alt"></i>
                        </div>
                        <div class="stat-info">
                            <h4>${this.stats.todayBookings}</h4>
                            <p>Today's Bookings</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon info">
                            <i class="fas fa-money-bill-wave"></i>
                        </div>
                        <div class="stat-info">
                            <h4>${Utils.formatCurrency(this.stats.revenue)}</h4>
                            <p>Revenue Today</p>
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-top: 2rem;">
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-chart-line"></i> Recent Activity</h3>
                            <button class="btn btn-sm btn-outline">View All</button>
                        </div>
                        <div class="card-body">
                            <div class="activity-list">
                                ${this.renderActivityList()}
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-bolt"></i> Quick Actions</h3>
                        </div>
                        <div class="card-body">
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                <button class="btn btn-success" onclick="App.navigate('admin-trips')">
                                    <i class="fas fa-plus"></i> Create New Trip
                                </button>
                                <button class="btn btn-outline" onclick="App.navigate('admin-routes')">
                                    <i class="fas fa-route"></i> Manage Routes
                                </button>
                                <button class="btn btn-outline" onclick="App.navigate('admin-buses')">
                                    <i class="fas fa-bus"></i> Add Bus
                                </button>
                                <button class="btn btn-outline" onclick="AdminDashboard.sendNotification()">
                                    <i class="fas fa-bell"></i> Send Notification
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card" style="margin-top: 2rem;">
                    <div class="card-header">
                        <h3><i class="fas fa-map"></i> Live Bus Locations</h3>
                    </div>
                    <div class="card-body" style="padding: 0;">
                        <div id="admin-map" style="height: 400px;"></div>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            this.initMap();
        }, 100);
    },
    
    renderActivityList() {
        const activities = [
            { type: 'booking', message: 'New booking #1234', time: '2 min ago', icon: 'ticket-alt', color: 'primary' },
            { type: 'trip', message: 'Trip KMN-NYB started', time: '5 min ago', icon: 'bus', color: 'success' },
            { type: 'user', message: 'New user registered', time: '10 min ago', icon: 'user', color: 'info' },
            { type: 'payment', message: 'Payment received RWF 500', time: '15 min ago', icon: 'money-bill', color: 'warning' }
        ];
        
        return activities.map(act => `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--gray-100);">
                <div style="width: 40px; height: 40px; background: var(--${act.color}-lighter, var(--gray-100)); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-${act.icon}" style="color: var(--${act.color}, var(--gray-600));"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: var(--gray-800);">${act.message}</div>
                    <div style="font-size: 0.85rem; color: var(--gray-400);">${act.time}</div>
                </div>
            </div>
        `).join('');
    },
    
    initMap() {
        const map = BusMap.init('admin-map');
        
        // Add mock bus locations
        const busLocations = [
            { lat: -1.9441, lng: 30.0619, plate: 'RAE 123A' },
            { lat: -1.9500, lng: 30.0700, plate: 'RAE 456B' },
            { lat: -1.9350, lng: 30.0550, plate: 'RAE 789C' }
        ];
        
        busLocations.forEach(bus => {
            BusMap.addBusMarker(map, bus.lat, bus.lng, bus.plate);
        });
    },
    
    sendNotification() {
        const modalContent = `
            <div style="text-align: left;">
                <div class="form-group">
                    <label>Target Users</label>
                    <select class="form-select" id="notif-target">
                        <option value="all">All Users</option>
                        <option value="passengers">Passengers Only</option>
                        <option value="drivers">Drivers Only</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" id="notif-title" class="form-select" placeholder="Notification title">
                </div>
                <div class="form-group">
                    <label>Message</label>
                    <textarea id="notif-message" class="form-select" rows="3" placeholder="Enter your message..."></textarea>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select class="form-select" id="notif-type">
                        <option value="info">Info</option>
                        <option value="alert">Alert</option>
                        <option value="success">Success</option>
                    </select>
                </div>
                <button class="btn btn-success" onclick="AdminDashboard.submitNotification()" style="width: 100%;">
                    <i class="fas fa-paper-plane"></i> Send Notification
                </button>
            </div>
        `;
        
        Utils.modal.open(modalContent, { title: 'Send Notification' });
    },
    
    async submitNotification() {
        const target = document.getElementById('notif-target').value;
        const title = document.getElementById('notif-title').value;
        const message = document.getElementById('notif-message').value;
        const type = document.getElementById('notif-type').value;
        
        if (!title || !message) {
            Utils.toast('Please fill in all fields', 'warning');
            return;
        }
        
        Utils.showLoading('Sending...');
        
        try {
            // In real app, send to all target users
            await API.admin.sendNotification({
                user_id: 'all', // or specific user
                title,
                message,
                notification_type: type
            });
            
            Utils.hideLoading();
            Utils.modal.close();
            Utils.toast('Notification sent successfully', 'success');
            
        } catch (error) {
            Utils.hideLoading();
        }
    }
};