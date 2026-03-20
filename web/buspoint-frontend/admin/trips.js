const AdminTrips = {
    trips: [],
    buses: [],
    routes: [],
    
    async init() {
        await Promise.all([
            this.loadTrips(),
            this.loadBuses(),
            this.loadRoutes()
        ]);
        this.render();
    },
    
    async loadTrips() {
        try {
            this.trips = await API.admin.getTrips();
        } catch (error) {
            this.trips = [];
        }
    },
    
    async loadBuses() {
        try {
            this.buses = await API.admin.getBuses();
        } catch (error) {
            this.buses = [];
        }
    },
    
    async loadRoutes() {
        try {
            this.routes = await API.admin.getRoutes();
        } catch (error) {
            this.routes = [];
        }
    },
    
    render() {
        const container = document.getElementById('main-content');
        
        // Group trips by date
        const today = new Date().toISOString().split('T')[0];
        const todayTrips = this.trips.filter(t => t.departure_time?.startsWith(today));
        const upcomingTrips = this.trips.filter(t => {
            const tripDate = t.departure_time?.split('T')[0];
            return tripDate > today && t.status === 'scheduled';
        });
        
        container.innerHTML = `
            <div class="admin-dashboard">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h2 style="color: var(--gray-800);">Trip Scheduling</h2>
                        <p style="color: var(--gray-500);">Schedule and manage bus trips</p>
                    </div>
                    <button class="btn btn-success" onclick="AdminTrips.showCreateTrip()">
                        <i class="fas fa-plus"></i> Schedule Trip
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-calendar-day"></i> Today's Trips (${todayTrips.length})</h3>
                        </div>
                        <div class="card-body" style="padding: 0; max-height: 400px; overflow-y: auto;">
                            ${todayTrips.length === 0 ? `
                                <div class="empty-state" style="padding: 2rem;">
                                    <i class="fas fa-calendar-times"></i>
                                    <p>No trips scheduled for today</p>
                                </div>
                            ` : `
                                <div class="trips-list">
                                    ${todayTrips.map(trip => this.renderTripItem(trip)).join('')}
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-calendar-alt"></i> Upcoming Trips (${upcomingTrips.length})</h3>
                        </div>
                        <div class="card-body" style="padding: 0; max-height: 400px; overflow-y: auto;">
                            ${upcomingTrips.length === 0 ? `
                                <div class="empty-state" style="padding: 2rem;">
                                    <i class="fas fa-calendar"></i>
                                    <p>No upcoming trips</p>
                                </div>
                            ` : `
                                <div class="trips-list">
                                    ${upcomingTrips.slice(0, 5).map(trip => this.renderTripItem(trip)).join('')}
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                
                <div class="card" style="margin-top: 2rem;">
                    <div class="card-header">
                        <h3><i class="fas fa-list"></i> All Trips</h3>
                    </div>
                    <div class="card-body" style="padding: 0;">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Route</th>
                                        <th>Bus</th>
                                        <th>Departure</th>
                                        <th>Status</th>
                                        <th>Booked</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.trips.slice(0, 20).map(trip => this.renderTripRow(trip)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderTripItem(trip) {
        const departure = Utils.formatDateTime(trip.departure_time);
        const statusClass = {
            'scheduled': 'badge-success',
            'delayed': 'badge-warning',
            'completed': 'badge-info',
            'cancelled': 'badge-danger'
        }[trip.status] || 'badge-info';
        
        return `
            <div class="trip-card" style="padding: 1rem; border-bottom: 1px solid var(--gray-100);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; color: var(--gray-800);">${trip.route_name}</div>
                        <div style="font-size: 0.85rem; color: var(--gray-500);">
                            ${trip.bus_plate} • ${departure.time}
                        </div>
                    </div>
                    <span class="badge ${statusClass}">${trip.status}</span>
                </div>
            </div>
        `;
    },
    
    renderTripRow(trip) {
        const departure = Utils.formatDateTime(trip.departure_time);
        const statusClass = {
            'scheduled': 'badge-success',
            'delayed': 'badge-warning',
            'completed': 'badge-info',
            'cancelled': 'badge-danger'
        }[trip.status] || 'badge-info';
        
        const booked = trip.capacity - trip.available_seats;
        
        return `
            <tr>
                <td>
                    <div style="font-weight: 600;">${trip.route_name}</div>
                </td>
                <td>${trip.bus_plate}</td>
                <td>${departure.date} ${departure.time}</td>
                <td>
                    <span class="badge ${statusClass}">${trip.status}</span>
                </td>
                <td>${booked} / ${trip.capacity}</td>
                <td>
                    <select class="form-select" style="width: auto; display: inline-block;" 
                            onchange="AdminTrips.updateStatus('${trip.id}', this.value)">
                        <option value="">Change Status...</option>
                        <option value="scheduled" ${trip.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                        <option value="delayed" ${trip.status === 'delayed' ? 'selected' : ''}>Delayed</option>
                        <option value="completed" ${trip.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="cancelled" ${trip.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            </tr>
        `;
    },
    
    showCreateTrip() {
        const modalContent = `
            <div style="text-align: left;">
                <div class="form-group">
                    <label>Select Route *</label>
                    <select class="form-select" id="trip-route">
                        <option value="">Choose a route...</option>
                        ${this.routes.map(r => `<option value="${r.id}">${r.route_code} - ${r.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Select Bus *</label>
                    <select class="form-select" id="trip-bus">
                        <option value="">Choose a bus...</option>
                        ${this.buses.filter(b => b.is_active).map(b => `
                            <option value="${b.id}">${b.plate_number} (${b.capacity} seats)</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Departure Date & Time *</label>
                    <input type="datetime-local" id="trip-datetime" class="form-select">
                </div>
                <div class="form-group">
                    <label>Ticket Price (RWF) *</label>
                    <input type="number" id="trip-price" class="form-select" placeholder="500" min="100">
                </div>
                <button class="btn btn-success" onclick="AdminTrips.submitTrip()" style="width: 100%;">
                    <i class="fas fa-save"></i> Schedule Trip
                </button>
            </div>
        `;
        
        Utils.modal.open(modalContent, { title: 'Schedule New Trip' });
        
        // Set min datetime to now
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('trip-datetime').min = now.toISOString().slice(0, 16);
    },
    
    async submitTrip() {
        const routeId = document.getElementById('trip-route').value;
        const busId = document.getElementById('trip-bus').value;
        const dateTime = document.getElementById('trip-datetime').value;
        const price = parseFloat(document.getElementById('trip-price').value);
        
        if (!routeId || !busId || !dateTime || !price) {
            Utils.toast('Please fill in all fields', 'warning');
            return;
        }
        
        Utils.showLoading('Scheduling trip...');
        
        try {
            await API.admin.createTrip({
                route_id: routeId,
                bus_id: busId,
                departure_time: dateTime,
                price: price
            });
            
            Utils.hideLoading();
            Utils.modal.close();
            Utils.toast('Trip scheduled successfully', 'success');
            await this.loadTrips();
            this.render();
            
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    async updateStatus(tripId, newStatus) {
        if (!newStatus) return;
        
        Utils.showLoading('Updating status...');
        
        try {
            await API.admin.updateTripStatus(tripId, newStatus);
            Utils.hideLoading();
            Utils.toast('Status updated', 'success');
            await this.loadTrips();
            this.render();
            
        } catch (error) {
            Utils.hideLoading();
        }
    }
};