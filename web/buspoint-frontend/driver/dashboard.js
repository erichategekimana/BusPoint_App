const DriverDashboard = {
    currentTrip: null,
    locationInterval: null,
    
    async init() {
        await this.checkActiveTrip();
        this.render();
    },
    
    async checkActiveTrip() {
        // In real app, fetch driver's assigned trip from API
        // For now, we'll use a mock or let driver select
        this.currentTrip = null;
    },
    
    render() {
        const container = document.getElementById('main-content');
        
        if (!this.currentTrip) {
            container.innerHTML = `
                <div style="max-width: 800px; margin: 0 auto;">
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-tachometer-alt"></i> Driver Dashboard</h3>
                        </div>
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-bus"></i>
                                <h3>No Active Trip</h3>
                                <p>You don't have an assigned trip right now.</p>
                                <button class="btn btn-success btn-lg" onclick="DriverDashboard.selectTrip()" style="margin-top: 1rem;">
                                    <i class="fas fa-list"></i> Select Trip
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-grid" style="margin-top: 2rem;">
                        <div class="stat-card">
                            <div class="stat-icon primary">
                                <i class="fas fa-route"></i>
                            </div>
                            <div class="stat-info">
                                <h4>12</h4>
                                <p>Trips This Week</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon success">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-info">
                                <h4>348</h4>
                                <p>Passengers Carried</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon warning">
                                <i class="fas fa-star"></i>
                            </div>
                            <div class="stat-info">
                                <h4>4.8</h4>
                                <p>Rating</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        // Render active trip dashboard
        container.innerHTML = `
            <div style="max-width: 1000px; margin: 0 auto;">
                <div class="card" style="margin-bottom: 2rem;">
                    <div class="card-header">
                        <h3><i class="fas fa-bus"></i> Current Trip</h3>
                        <span class="badge badge-success">ACTIVE</span>
                    </div>
                    <div class="card-body">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                            <div>
                                <label style="color: var(--gray-500); font-size: 0.85rem;">Route</label>
                                <div style="font-size: 1.25rem; font-weight: 600; color: var(--gray-800);">
                                    ${this.currentTrip.route_name}
                                </div>
                            </div>
                            <div>
                                <label style="color: var(--gray-500); font-size: 0.85rem;">Departure</label>
                                <div style="font-size: 1.25rem; font-weight: 600; color: var(--gray-800);">
                                    ${Utils.formatDateTime(this.currentTrip.departure_time).time}
                                </div>
                            </div>
                            <div>
                                <label style="color: var(--gray-500); font-size: 0.85rem;">Passengers</label>
                                <div style="font-size: 1.25rem; font-weight: 600; color: var(--gray-800);">
                                    ${this.currentTrip.booked_seats || 0} / ${this.currentTrip.capacity}
                                </div>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                            <button class="btn btn-success btn-lg" onclick="DriverLocation.startTracking('${this.currentTrip.id}')">
                                <i class="fas fa-location-arrow"></i> Start Location Tracking
                            </button>
                            <button class="btn btn-outline" onclick="DriverDashboard.viewPassengers()">
                                <i class="fas fa-users"></i> View Passengers
                            </button>
                            <button class="btn btn-primary" onclick="App.navigate('scanner')">
                                <i class="fas fa-qrcode"></i> Scan Tickets
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-map"></i> Route Map</h3>
                    </div>
                    <div class="card-body" style="padding: 0;">
                        <div id="driver-map" style="height: 400px;"></div>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            const map = BusMap.init('driver-map');
            // Add route polyline and stops
        }, 100);
    },
    
    async selectTrip() {
        Utils.showLoading('Loading available trips...');
        
        try {
            const trips = await API.admin.getTrips(); // Should be driver-specific endpoint
            Utils.hideLoading();
            
            const todayTrips = trips.filter(t => t.status === 'scheduled');
            
            const modalContent = `
                <div style="max-height: 400px; overflow-y: auto;">
                    ${todayTrips.length === 0 ? `
                        <div class="empty-state">
                            <i class="fas fa-calendar-times"></i>
                            <p>No trips available for today</p>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${todayTrips.map(trip => `
                                <div class="trip-card" style="cursor: pointer;" onclick="DriverDashboard.assignTrip('${trip.id}')">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <div style="font-weight: 600; color: var(--gray-800);">
                                                ${trip.route_name}
                                            </div>
                                            <div style="font-size: 0.85rem; color: var(--gray-500);">
                                                ${Utils.formatDateTime(trip.departure_time).full}
                                            </div>
                                        </div>
                                        <i class="fas fa-chevron-right" style="color: var(--gray-400);"></i>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            `;
            
            Utils.modal.open(modalContent, { title: 'Select Your Trip' });
            
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    async assignTrip(tripId) {
        Utils.modal.close();
        Utils.showLoading('Assigning trip...');
        
        // In real app, call API to assign trip to driver
        setTimeout(() => {
            Utils.hideLoading();
            this.currentTrip = { id: tripId, route_name: 'Selected Route' }; // Mock
            this.render();
            Utils.toast('Trip assigned successfully', 'success');
        }, 1000);
    },
    
    viewPassengers() {
        if (!this.currentTrip) return;
        
        // Show passengers list modal
        const modalContent = `
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Seat</th>
                            <th>Passenger</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>#5</td>
                            <td>John Doe</td>
                            <td><span class="badge badge-success">Boarded</span></td>
                        </tr>
                        <tr>
                            <td>#12</td>
                            <td>Jane Smith</td>
                            <td><span class="badge badge-warning">Pending</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        
        Utils.modal.open(modalContent, { title: 'Passenger List' });
    }
};