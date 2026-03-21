const PassengerTracking = {
    map: null,
    busMarker: null,
    routeLine: null,
    updateInterval: null,
    trackTripId: null,
    currentTrip: null,
    
    async init() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="passenger-home">
                <div class="tracking-view">
                    <div class="tracking-map" id="tracking-map"></div>
                    <div class="tracking-sidebar">
                        <div class="tracking-info">
                            <h3><i class="fas fa-bus"></i> Bus Location</h3>
                            <div id="tracking-details">
                                <div class="empty-state" style="padding: 2rem;">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <p>Select a trip to track</p>
                                </div>
                            </div>
                        </div>
                        
                        ${this.trackTripId ? '' : `
                            <div class="card">
                                <div class="card-header">
                                    <h3><i class="fas fa-list"></i> Active Trips</h3>
                                </div>
                                <div class="card-body">
                                    <div id="active-trips-list">
                                        <p style="color: var(--gray-500);">Loading...</p>
                                    </div>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
        
        // Initialize map
        this.map = BusMap.init('tracking-map');
        setTimeout(() => this.map.invalidateSize(), 100);
        
        if (this.trackTripId) {
            await this.startTracking(this.trackTripId);
            this.trackTripId = null; // Clear after use
        } else {
            await this.loadActiveTrips();
        }
    },
    
    async loadActiveTrips() {
        try {
            const tickets = await API.passenger.getMyBookings();
            const activeTickets = tickets.filter(t => 
                t.status === 'confirmed' && 
                (t.trip?.status === 'scheduled' || t.trip?.status === 'delayed')
            );
            
            const container = document.getElementById('active-trips-list');
            
            if (activeTickets.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 1rem;">
                        <i class="fas fa-calendar-times"></i>
                        <p>No active trips to track</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = activeTickets.map(ticket => `
                <div class="trip-card" style="cursor: pointer; margin-bottom: 0.75rem;" 
                     onclick="PassengerTracking.startTracking('${ticket.trip_id}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: var(--gray-800);">
                                ${ticket.trip?.route_name || 'Route'}
                            </div>
                            <div style="font-size: 0.85rem; color: var(--gray-500);">
                                Seat #${ticket.seat_number} • ${ticket.pickup_stop}
                            </div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: var(--gray-400);"></i>
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Failed to load active trips:', error);
        }
    },
    
    async startTracking(tripId) {
        Utils.showLoading('Loading trip details...');
        
        try {
            this.currentTrip = await API.passenger.getTripDetails(tripId);
            Utils.hideLoading();
            this.map.invalidateSize();
            
            this.renderTrackingDetails();
            this.updateBusLocation();
            
            // Start real-time updates
            if (this.updateInterval) clearInterval(this.updateInterval);
            this.updateInterval = setInterval(() => this.updateBusLocation(), 10000); // Every 10 seconds
            
            // Draw route on map
            this.drawRoute();
            
        } catch (error) {
            Utils.hideLoading();
            Utils.toast('Failed to start tracking', 'error');
        }
    },
    
    renderTrackingDetails() {
        const container = document.getElementById('tracking-details');
        const trip = this.currentTrip;
        
        container.innerHTML = `
            <div class="bus-status">
                <div class="status-indicator ${trip.status === 'scheduled' ? 'moving' : 'stopped'}"></div>
                <span style="font-weight: 500; color: var(--gray-700);">
                    ${trip.status === 'scheduled' ? 'Bus is on route' : 'Bus is stopped'}
                </span>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--gray-500);">Route</span>
                    <span style="font-weight: 600;">${trip.route_name}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--gray-500);">Bus</span>
                    <span style="font-weight: 600;">${trip.bus_plate}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--gray-500);">Departure</span>
                    <span style="font-weight: 600;">${Utils.formatDateTime(trip.departure_time).time}</span>
                </div>
            </div>
            
            <div class="estimated-arrival">
                <label>Estimated Arrival</label>
                <div class="time" id="estimated-time">--:--</div>
            </div>
            
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
                <h4 style="margin-bottom: 1rem; color: var(--gray-700);">Stops</h4>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${trip.itinerary.map((stop, index) => `
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 24px; height: 24px; border-radius: 50%; background: ${index === 0 ? 'var(--primary)' : 'var(--gray-300)'}; 
                                        color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;">
                                ${index + 1}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 500; color: var(--gray-800);">${stop.stop_name}</div>
                                <div style="font-size: 0.8rem; color: var(--gray-500);">+${stop.minutes_from_start} min</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    async updateBusLocation() {
        if (!this.currentTrip) return;
        
        try {
            const location = await API.passenger.getBusLocation(this.currentTrip.id);
            
            if (location.latitude && location.longitude) {
                this.updateBusMarker(location.latitude, location.longitude);
                
                // Calculate estimated arrival (simplified)
                const now = new Date();
                const estimated = new Date(now.getTime() + 15 * 60000); // +15 min placeholder
                document.getElementById('estimated-time').textContent = 
                    estimated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            }
            
        } catch (error) {
            console.log('Location not available yet');
        }
    },
    
    updateBusMarker(lat, lng) {
        if (this.busMarker) {
            this.busMarker.setLatLng([lat, lng]);
        } else {
            this.busMarker = BusMap.addBusMarker(this.map, lat, lng, this.currentTrip.bus_plate);
            this.map.setView([lat, lng], 15);
        }
    },
    
    drawRoute() {
        if (!this.currentTrip?.itinerary) return;
        
        const coordinates = this.currentTrip.itinerary.map(stop => {
            // In real app, stops would have lat/lng
            // For now, generate approximate coordinates around Kigali
            return [
                Config.MAP_CENTER[0] + (Math.random() - 0.5) * 0.1,
                Config.MAP_CENTER[1] + (Math.random() - 0.5) * 0.1
            ];
        });
        
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
        }
        
        this.routeLine = L.polyline(coordinates, {
            color: '#2E7D32',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10'
        }).addTo(this.map);
        
        // Add stop markers
        coordinates.forEach((coord, index) => {
            BusMap.addStopMarker(this.map, coord[0], coord[1], 
                this.currentTrip.itinerary[index].stop_name, index + 1);
        });
        
        this.map.fitBounds(this.routeLine.getBounds(), { padding: [50, 50] });
    },
    
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.currentTrip = null;
        this.busMarker = null;
        this.routeLine = null;
    }
};