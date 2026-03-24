const AdminRoutes = {
    routes: [],
    stops: [],
    
    async init() {
        await Promise.all([
            this.loadRoutes(),
            this.loadStops()
        ]);
        this.render();
    },
    
    async loadRoutes() {
        try {
            this.routes = await API.admin.getRoutes();
        } catch (error) {
            this.routes = [];
        }
    },
    
    async loadStops() {
        try {
            this.stops = await API.admin.getStops();
        } catch (error) {
            this.stops = [];
        }
    },
    
    render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="admin-dashboard">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h2 style="color: var(--gray-800);">Route Management</h2>
                        <p style="color: var(--gray-500);">Manage bus routes and stop sequences</p>
                    </div>
                    <div style="display: flex; gap: 0.75rem;">
                        <button class="btn btn-outline" onclick="AdminRoutes.manageStops()">
                            <i class="fas fa-map-marker-alt"></i> Manage Stops
                        </button>
                        <button class="btn btn-success" onclick="AdminRoutes.showAddRoute()">
                            <i class="fas fa-plus"></i> Add Route
                        </button>
                    </div>
                </div>
                
                <div class="routes-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;">
                    ${this.routes.map(route => this.renderRouteCard(route)).join('')}
                </div>
            </div>
        `;
    },
    
    renderRouteCard(route) {
        const stopCount = route.path?.length || 0;
        
        return `
            <div class="card" style="cursor: pointer;" onclick="AdminRoutes.viewRoute('${route.id}')">
                <div class="card-header" style="background: var(--primary-lighter);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary-dark);">
                                ${route.route_code}
                            </div>
                            <div style="font-size: 0.9rem; color: var(--gray-600);">
                                ${route.name}
                            </div>
                        </div>
                        <span class="badge badge-success">
                            ${route.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                <div class="card-body">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <span style="color: var(--gray-500);">
                            <i class="fas fa-map-marker-alt"></i> ${stopCount} stops
                        </span>
                        <span style="font-weight: 600; color: var(--primary);">
                            ${Utils.formatCurrency(route.base_price)}
                        </span>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); AdminRoutes.editRoute('${route.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); AdminRoutes.manageStops('${route.id}')">
                            <i class="fas fa-list"></i> Stops
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    showAddRoute() {
        const modalContent = `
            <div style="text-align: left;">
                <div class="form-group">
                    <label>Route Code *</label>
                    <input type="text" id="route-code" class="form-select" placeholder="KMN-NYB" maxlength="20">
                    <small style="color: var(--gray-500);">Unique code (e.g., KMN-NYB)</small>
                </div>
                <div class="form-group">
                    <label>Route Name *</label>
                    <input type="text" id="route-name" class="form-select" placeholder="Kimironko - Nyabugogo">
                </div>
                <div class="form-group">
                    <label>Base Price (RWF) *</label>
                    <input type="number" id="route-price" class="form-select" placeholder="500" min="100">
                </div>
                <button class="btn btn-success" onclick="AdminRoutes.submitRoute()" style="width: 100%;">
                    <i class="fas fa-save"></i> Create Route
                </button>
            </div>
        `;
        
        Utils.modal.open(modalContent, { title: 'Create New Route' });
    },
    
    async submitRoute() {
        const code = document.getElementById('route-code').value.trim().toUpperCase();
        const name = document.getElementById('route-name').value.trim();
        const price = parseInt(document.getElementById('route-price').value);
        
        if (!code || !name || !price) {
            Utils.toast('Please fill in all required fields', 'warning');
            return;
        }
        
        Utils.showLoading('Creating route...');
        
        try {
            await API.admin.createRoute({
                route_code: code,
                name: name,
                base_price: price
            });
            
            Utils.hideLoading();
            Utils.modal.close();
            Utils.toast('Route created successfully', 'success');
            await this.loadRoutes();
            this.render();
            
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    async viewRoute(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;
        
        // Show route details with stops on map
        const modalContent = `
            <div style="text-align: left;">
                <div id="route-map" style="height: 300px; border-radius: var(--radius); margin-bottom: 1rem;"></div>
                <h4 style="margin-bottom: 1rem;">Stop Sequence</h4>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${route.path?.map((rs, index) => `
                        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--gray-100); border-radius: var(--radius);">
                            <div style="width: 28px; height: 28px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 600;">
                                ${rs.order}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 500;">${rs.stop?.name || 'Unknown'}</div>
                                <div style="font-size: 0.8rem; color: var(--gray-500);">+${rs.estimated_minutes_from_start || 0} min from start</div>
                            </div>
                        </div>
                    `).join('') || '<p style="color: var(--gray-500);">No stops configured</p>'}
                </div>
            </div>
        `;
        
        Utils.modal.open(modalContent, { title: route.name, size: 'large' });
        
        setTimeout(() => {
            const map = BusMap.init('route-map');
            // Add stop markers
        }, 100);
    },
    
    manageStops(routeId = null) {
        const modalContent = `
            <div style="text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4>All Stops</h4>
                    <button class="btn btn-success btn-sm" onclick="AdminRoutes.showAddStop()">
                        <i class="fas fa-plus"></i> Add Stop
                    </button>
                </div>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${this.stops.map(stop => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--gray-100);">
                            <div>
                                <div style="font-weight: 500;">${stop.name}</div>
                                <div style="font-size: 0.8rem; color: var(--gray-500);">
                                    ${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}
                                </div>
                            </div>
                            ${routeId ? `
                                <button class="btn btn-sm btn-success" onclick="AdminRoutes.addStopToRoute('${routeId}', '${stop.id}')">
                                    <i class="fas fa-plus"></i> Add to Route
                                </button>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        Utils.modal.open(modalContent, { title: routeId ? 'Add Stops to Route' : 'Manage Stops' });
    },
    
    showAddStop() {
        const modalContent = `
            <div style="text-align: left;">
                <div class="form-group">
                    <label>Stop Name *</label>
                    <input type="text" id="stop-name" class="form-select" placeholder="e.g., Nyabugogo Bus Park">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Latitude *</label>
                        <input type="number" id="stop-lat" class="form-select" placeholder="-1.9441" step="any">
                    </div>
                    <div class="form-group">
                        <label>Longitude *</label>
                        <input type="number" id="stop-lon" class="form-select" placeholder="30.0619" step="any">
                    </div>
                </div>
                <button class="btn btn-success" onclick="AdminRoutes.submitStop()" style="width: 100%;">
                    <i class="fas fa-save"></i> Create Stop
                </button>
            </div>
        `;
        
        Utils.modal.open(modalContent, { title: 'Add New Stop' });
    },
    
    async submitStop() {
        const name = document.getElementById('stop-name').value.trim();
        const lat = parseFloat(document.getElementById('stop-lat').value);
        const lon = parseFloat(document.getElementById('stop-lon').value);

        if (!name || isNaN(lat) || isNaN(lon)) {
            Utils.toast('Please fill in all fields', 'warning');
            return;
        }
        if (lat < -90 || lat > 90) {
            Utils.toast('Latitude must be between -90 and 90', 'warning');
            return;
        }
        if (lon < -180 || lon > 180) {
            Utils.toast('Longitude must be between -180 and 180', 'warning');
            return;
        }

        Utils.showLoading('Creating stop...');
        try {
            await API.admin.createStop({
                name: name,
                latitude: lat,
                longitude: lon
            });
            Utils.hideLoading();
            Utils.modal.close();
            Utils.toast('Stop created', 'success');
            await this.loadStops();
            this.manageStops(); // reopen with fresh list
        } catch (error) {
            Utils.hideLoading();
            Utils.toast(error.message, 'error');
        }
    },
    
    async addStopToRoute(routeId, stopId) {
        const order = prompt('Enter stop order number (1, 2, 3...):');
        if (!order || isNaN(order)) return;
        
        const minutes = prompt('Minutes from start:', '0');
        
        Utils.showLoading('Adding stop...');
        
        try {
            await API.admin.addStopToRoute(routeId, {
                stop_id: stopId,
                stop_order: parseInt(order),
                estimated_minutes_from_start: parseInt(minutes) || 0
            });
            
            Utils.hideLoading();
            Utils.toast('Stop added to route', 'success');
            await this.loadRoutes();
            // Optionally close the modal
            Utils.modal.close();
            
        } catch (error) {
            Utils.hideLoading();
            // Show the actual error message from the server
            Utils.toast(error.message, 'error');
        }
},

async editRoute(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;

        const modalContent = `
            <div style="text-align: left;">
                <div class="form-group">
                    <label>Route Code</label>
                    <input type="text" id="edit-route-code" class="form-select" value="${route.route_code}">
                </div>
                <div class="form-group">
                    <label>Route Name</label>
                    <input type="text" id="edit-route-name" class="form-select" value="${route.name}">
                </div>
                <div class="form-group">
                    <label>Base Price (RWF)</label>
                    <input type="number" id="edit-route-price" class="form-select" value="${route.base_price || 500}">
                </div>
                <button class="btn btn-success" onclick="AdminRoutes.updateRoute('${routeId}')" style="width: 100%;">
                    <i class="fas fa-save"></i> Update Route
                </button>
            </div>
        `;
        Utils.modal.open(modalContent, { title: 'Edit Route' });
    },

    async updateRoute(routeId) {
        const code = document.getElementById('edit-route-code').value.trim().toUpperCase();
        const name = document.getElementById('edit-route-name').value.trim();
        const price = parseInt(document.getElementById('edit-route-price').value);

        if (!code || !name || isNaN(price)) {
            Utils.toast('Please fill all fields', 'warning');
            return;
        }

        Utils.showLoading('Updating...');
        try {
            // Assuming there's an API endpoint to update a route (we'll need to add one if missing)
            // For now, we can just show a warning.
            Utils.toast('Update endpoint not yet implemented', 'warning');
            // If you have an update route API, call it here.
            // await API.admin.updateRoute(routeId, { route_code: code, name, base_price: price });
            Utils.hideLoading();
            Utils.modal.close();
        } catch (error) {
            Utils.hideLoading();
            Utils.toast(error.message, 'error');
        }
    }
}

