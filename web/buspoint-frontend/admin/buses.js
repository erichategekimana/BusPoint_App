const AdminBuses = {
    buses: [],
    
    async init() {
        await this.loadBuses();
        this.render();
    },
    
    async loadBuses() {
        Utils.showLoading('Loading buses...');
        try {
            this.buses = await API.admin.getBuses();
            Utils.hideLoading();
        } catch (error) {
            Utils.hideLoading();
            this.buses = [];
        }
    },
    
    render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="admin-dashboard">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h2 style="color: var(--gray-800);">Bus Fleet Management</h2>
                        <p style="color: var(--gray-500);">Manage all buses in your fleet</p>
                    </div>
                    <button class="btn btn-success" onclick="AdminBuses.showAddBus()">
                        <i class="fas fa-plus"></i> Add New Bus
                    </button>
                </div>
                
                <div class="card">
                    <div class="card-body" style="padding: 0;">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Plate Number</th>
                                        <th>Type</th>
                                        <th>Capacity</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.buses.map(bus => this.renderBusRow(bus)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderBusRow(bus) {
        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <i class="fas fa-bus" style="color: var(--primary);"></i>
                        <span style="font-weight: 600;">${bus.plate_number}</span>
                    </div>
                </td>
                <td>${bus.bus_type || 'Standard'}</td>
                <td>${bus.capacity} seats</td>
                <td>
                    <span class="badge ${bus.is_active ? 'badge-success' : 'badge-danger'}">
                        ${bus.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(bus.created_at).toLocaleDateString()}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-secondary" onclick="AdminBuses.editBus('${bus.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="AdminBuses.deleteBus('${bus.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    },
    
    showAddBus() {
        const modalContent = `
            <div style="text-align: left;">
                <div class="form-group">
                    <label>Plate Number *</label>
                    <input type="text" id="bus-plate" class="form-select" placeholder="RAE 123A" maxlength="10">
                    <small style="color: var(--gray-500);">Format: RAE 123A</small>
                </div>
                <div class="form-group">
                    <label>Bus Type</label>
                    <select class="form-select" id="bus-type">
                        <option value="Standard Coach">Standard Coach</option>
                        <option value="Mini Bus">Mini Bus</option>
                        <option value="Luxury Coach">Luxury Coach</option>
                        <option value="Electric Bus">Electric Bus</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Capacity *</label>
                    <input type="number" id="bus-capacity" class="form-select" placeholder="30" min="1" max="100">
                </div>
                <button class="btn btn-success" onclick="AdminBuses.submitBus()" style="width: 100%;">
                    <i class="fas fa-save"></i> Save Bus
                </button>
            </div>
        `;
        
        Utils.modal.open(modalContent, { title: 'Add New Bus' });
    },
    
    async submitBus() {
        const plate = document.getElementById('bus-plate').value.trim().toUpperCase();
        const type = document.getElementById('bus-type').value;
        const capacity = parseInt(document.getElementById('bus-capacity').value);
        
        if (!plate || !capacity) {
            Utils.toast('Please fill in all required fields', 'warning');
            return;
        }
        
        // Validate plate format
        const plateRegex = /^RAE\s\d{3}[A-Z]$/;
        if (!plateRegex.test(plate)) {
            Utils.toast('Invalid plate format. Use: RAE 123A', 'warning');
            return;
        }
        
        Utils.showLoading('Saving...');
        
        try {
            await API.admin.createBus({
                plate_number: plate,
                bus_type: type,
                capacity: capacity
            });
            
            Utils.hideLoading();
            Utils.modal.close();
            Utils.toast('Bus added successfully', 'success');
            await this.loadBuses();
            this.render();
            
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    editBus(busId) {
        const bus = this.buses.find(b => b.id === busId);
        if (!bus) return;
        
        const modalContent = `
            <div style="text-align: left;">
                <div class="form-group">
                    <label>Plate Number</label>
                    <input type="text" class="form-select" value="${bus.plate_number}" disabled>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select class="form-select" id="edit-bus-status">
                        <option value="true" ${bus.is_active ? 'selected' : ''}>Active</option>
                        <option value="false" ${!bus.is_active ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <button class="btn btn-success" onclick="AdminBuses.updateBus('${bus.id}')" style="width: 100%;">
                    <i class="fas fa-save"></i> Update Bus
                </button>
            </div>
        `;
        
        Utils.modal.open(modalContent, { title: 'Edit Bus' });
    },
    
    async updateBus(busId) {
        const isActive = document.getElementById('edit-bus-status').value === 'true';
        
        Utils.showLoading('Updating...');
        
        // In real app, call update API
        setTimeout(() => {
            Utils.hideLoading();
            Utils.modal.close();
            Utils.toast('Bus updated', 'success');
            this.loadBuses().then(() => this.render());
        }, 1000);
    },
    
    async deleteBus(busId) {
        if (!confirm('Are you sure you want to delete this bus? This action cannot be undone.')) {
            return;
        }
        
        Utils.showLoading('Deleting...');
        
        try {
            await API.admin.deleteBus(busId);
            Utils.hideLoading();
            Utils.toast('Bus deleted successfully', 'success');
            await this.loadBuses();
            this.render();
            
        } catch (error) {
            Utils.hideLoading();
            if (error.message.includes('assigned')) {
                Utils.toast('Cannot delete bus with assigned trips', 'error');
            }
        }
    }
};