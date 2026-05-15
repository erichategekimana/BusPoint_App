const PassengerTracking = {
    map: null,
    busMarker: null,
    routeLine: null,
    updateInterval: null,
    trackTripId: null,
    currentTrip: null,
    lastNotifiedStopIndex: -1,
    notifiedStops: new Set(),
    
    async init() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="passenger-home">
                <div class="tracking-view">
                    <div class="tracking-map" id="tracking-map"></div>
                    <div class="tracking-sidebar">
                        <div class="tracking-info">
                            <h3><i class="fas fa-bus"></i> ${Utils.t('bus_location')}</h3>
                            <div id="tracking-details">
                                <div class="empty-state" style="padding: 2rem;">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <p>${Utils.t('select_trip')}</p>
                                </div>
                            </div>
                        </div>
                        
                        ${this.trackTripId ? '' : `
                            <div class="card">
                                <div class="card-header">
                                    <h3><i class="fas fa-list"></i> ${Utils.t('active_trips')}</h3>
                                </div>
                                <div class="card-body">
                                    <div id="active-trips-list">
                                        <p style="color: var(--gray-500);">${Utils.t('loading')}</p>
                                    </div>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
        
        this.map = BusMap.init('tracking-map');
        setTimeout(() => this.map.invalidateSize(), 100);
        
        if (this.trackTripId) {
            await this.startTracking(this.trackTripId);
            this.trackTripId = null;
        } else {
            await this.loadActiveTrips();
        }
    },
    
    async loadActiveTrips() {
        const list = document.getElementById('active-trips-list');
        if (!list) return;

        try {
            const trips = await API.passenger.getMyBookedTrips();
            if (!trips || trips.length === 0) {
                list.innerHTML = `<div class="empty-state">${Utils.t('no_upcoming_trips')}</div>`;
                return;
            }

            list.innerHTML = trips.map(trip => `
                <div class="trip-track-item">
                    <div class="info">
                        <div class="route">${trip.route_name}</div>
                        <div class="bus-details">
                            <i class="fas fa-bus"></i> ${trip.bus_plate} 
                            <span class="time">${Utils.formatDateTime(trip.departure_time).time}</span>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-success" onclick="PassengerTracking.startTracking('${trip.id}')">
                        ${Utils.t('track_bus')}
                    </button>
                </div>
            `).join('');
        } catch (error) {
            list.innerHTML = `<div class="error">${Utils.t('error_loading_trips')}</div>`;
        }
    },
    
    async startTracking(tripId) {
        Utils.showLoading(Utils.t('loading'));
        
        try {
            this.currentTrip = await API.passenger.getTripDetails(tripId);
            this.notifiedStops.clear();
            Utils.hideLoading();
            this.map.invalidateSize();
            
            this.renderTrackingDetails();
            this.updateBusLocation();
            
            if (this.updateInterval) clearInterval(this.updateInterval);
            this.updateInterval = setInterval(() => this.updateBusLocation(), 10000);
            
            this.drawRoute();
            
        } catch (error) {
            Utils.hideLoading();
            Utils.toast(Utils.t('tracking_failed'), 'error');
        }
    },
    
    renderTrackingDetails() {
        const container = document.getElementById('tracking-details');
        const trip = this.currentTrip;

        container.innerHTML = `
            <div class="bus-status">
                <div class="status-indicator ${trip.status === 'scheduled' ? 'moving' : 'stopped'}"></div>
                <span style="font-weight: 500; color: var(--gray-700);">
                    ${trip.status === 'scheduled' ? Utils.t('bus_on_route') : Utils.t('bus_stopped')}
                </span>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--gray-500);">${Utils.t('route')}</span>
                    <span style="font-weight: 600;">${trip.route_name}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--gray-500);">${Utils.t('bus')}</span>
                    <span style="font-weight: 600;">${trip.bus_plate}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--gray-500);">${Utils.t('departure')}</span>
                    <span style="font-weight: 600;">${Utils.formatDateTime(trip.departure_time).time}</span>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: var(--gray-500);">${Utils.t('current_speed')}</span>
                <span style="font-weight: 600;" id="bus-speed">-- ${Utils.t('kmh')}</span>
            </div>

            <div class="estimated-arrival">
                <label>${Utils.t('estimated_arrival')}</label>
                <div class="time" id="estimated-time">--:--</div>
            </div>

            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
                <h4 style="margin-bottom: 1rem; color: var(--gray-700);">${Utils.t('stops')}</h4>
                <div id="itinerary-list" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
            </div>
        `;
    },

    notifyApproachingStop(stopName) {
        Utils.toast(Utils.t('bus_approaching') + ' ' + stopName + '!', 'info', 5000);
        if (Notification.permission === 'granted') {
            new Notification(Utils.t('bus_approaching'), { body: `${Utils.t('bus_approaching')} ${stopName}` });
        }
    },

    async updateBusLocation() {
        if (!this.currentTrip) return;
        try {
            const location = await API.passenger.getBusLocation(this.currentTrip.id);
            if (location.latitude && location.longitude) {
                this.updateBusMarker(location.latitude, location.longitude);
                const speedKmh = (location.speed || 0) * 3.6;
                this.updateEtaAndDistances(location.latitude, location.longitude, speedKmh);

                const speedElement = document.getElementById('bus-speed');
                if (speedElement) speedElement.textContent = speedKmh.toFixed(1) + ' ' + Utils.t('kmh');

                this.checkProximityToStops(location.latitude, location.longitude);
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
        if (!this.currentTrip?.itinerary || this.currentTrip.itinerary.length === 0) {
            console.log('No itinerary data available for drawing route');
            return;
        }

        const coordinates = this.currentTrip.itinerary.map(stop => [stop.latitude, stop.longitude]);

        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
        }

        this.routeLine = L.polyline(coordinates, {
            color: '#2E7D32',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10'
        }).addTo(this.map);

        coordinates.forEach((coord, index) => {
            BusMap.addStopMarker(this.map, coord[0], coord[1],
                this.currentTrip.itinerary[index].stop_name, index + 1);
        });

        if (coordinates.length > 0) {
            this.map.fitBounds(this.routeLine.getBounds(), { padding: [50, 50] });
        }
    },

    updateEtaAndDistances(busLat, busLng, speedKmh) {
        const itinerary = this.currentTrip.itinerary;
        const container = document.getElementById('itinerary-list');
        if (!container) return;

        const avgSpeed = speedKmh > 0 ? speedKmh : 30;

        const newHtml = itinerary.map((stop, index) => {
            const distance = Utils.calculateDistance(busLat, busLng, stop.latitude, stop.longitude);
            const etaMinutes = Math.round((distance / avgSpeed) * 60);
            return `
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; background: ${index === 0 ? 'var(--primary)' : 'var(--gray-300)'}; 
                                color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;">
                        ${index + 1}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">${stop.stop_name}</div>
                        <div style="font-size: 0.8rem; color: var(--gray-500);">
                            ${distance.toFixed(1)} ${Utils.t('distance_km')} • ~${etaMinutes} ${Utils.t('minutes')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = newHtml;
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