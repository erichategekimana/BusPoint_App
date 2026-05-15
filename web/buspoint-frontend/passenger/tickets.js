const PassengerTickets = {
    tickets: [],
    
    async init() {
        await this.loadTickets();
        this.render();
    },
    
    async loadTickets() {
        Utils.showLoading(Utils.t('loading'));
        try {
            this.tickets = await API.passenger.getMyBookings();
            Utils.hideLoading();
        } catch (error) {
            Utils.hideLoading();
            this.tickets = [];
        }
    },
    
    render() {
        const container = document.getElementById('main-content');
        
        if (this.tickets.length === 0) {
            container.innerHTML = `
                <div class="passenger-home">
                    <div class="empty-state">
                        <i class="fas fa-ticket-alt"></i>
                        <h3>${Utils.t('no_tickets_yet')}</h3>
                        <p>${Utils.t('book_trip')}</p>
                        <button class="btn btn-success btn-lg" onclick="App.navigate('search')" style="margin-top: 1rem;">
                            <i class="fas fa-search"></i> ${Utils.t('find_bus')}
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="passenger-home">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-ticket-alt"></i> ${Utils.t('my_tickets')}</h3>
                        <button class="btn btn-success btn-sm" onclick="App.navigate('search')">
                            <i class="fas fa-plus"></i> ${Utils.t('book_new')}
                        </button>
                    </div>
                    <div class="card-body" style="padding: 0;">
                        <div class="tickets-list">
                            ${this.tickets.map(ticket => this.renderTicketCard(ticket)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderTicketCard(ticket) {
        const isUpcoming = ticket.status === 'confirmed' || ticket.status === 'pending';
        const statusClass = {
            'confirmed': 'badge-success',
            'pending': 'badge-warning',
            'cancelled': 'badge-danger',
            'approved': 'badge-info',
            'completed': 'badge-info'
        }[ticket.status] || 'badge-info';
        
        const departure = Utils.formatDateTime(ticket.trip?.departure_time || new Date());
        
        return `
            <div class="ticket-card" data-ticket-id="${ticket.id}">
                <div class="ticket-card-header">
                    <span><i class="fas fa-bus"></i> ${ticket.trip?.route_name || Utils.t('route')}</span>
                    <span class="badge ${statusClass}">${ticket.status.toUpperCase()}</span>
                </div>
                <div class="ticket-card-body">
                    <div class="ticket-route">
                        <div class="from">
                            <h4>${ticket.pickup_stop}</h4>
                            <p>${departure.date}</p>
                        </div>
                        <div class="arrow">
                            <i class="fas fa-arrow-right"></i>
                        </div>
                        <div class="to">
                            <h4>${ticket.dropoff_stop}</h4>
                            <p>${departure.time}</p>
                        </div>
                    </div>
                    <div class="ticket-details">
                        <div class="ticket-detail">
                            <label>${Utils.t('seat')}</label>
                            <span>#${ticket.seat_number}</span>
                        </div>
                        <div class="ticket-detail">
                            <label>${Utils.t('token')}</label>
                            <span style="font-family: monospace;">${ticket.ticket_token}</span>
                        </div>
                        <div class="ticket-detail">
                            <label>${Utils.t('booked')}</label>
                            <span>${Utils.timeAgo(ticket.created_at)}</span>
                        </div>
                    </div>
                </div>
                ${isUpcoming ? `
                    <div class="ticket-actions">
                        <button class="btn btn-success" onclick="PassengerTickets.showQR('${ticket.id}')">
                            <i class="fas fa-qrcode"></i> ${Utils.t('show_qr')}
                        </button>
                        <button class="btn btn-outline" onclick="PassengerTickets.trackBus('${ticket.trip_id}')">
                            <i class="fas fa-map-marker-alt"></i> ${Utils.t('track')}
                        </button>
                        ${ticket.status !== 'cancelled' ? `
                            <button class="btn btn-danger" onclick="PassengerTickets.cancelTicket('${ticket.id}')">
                                <i class="fas fa-times"></i> ${Utils.t('cancel')}
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    showQR(ticketId) {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) return;
        
        const modalContent = `
            <div style="text-align: center; padding: 2rem;">
                <h3 style="margin-bottom: 0.5rem;">${Utils.t('your_ticket_qr')}</h3>
                <p style="color: var(--gray-500); margin-bottom: 2rem;">
                    ${Utils.t('show_to_driver')}
                </p>
                <div id="modal-qr-code" style="display: flex; justify-content: center; margin-bottom: 2rem;"></div>
                <div style="background: var(--gray-100); padding: 1rem; border-radius: var(--radius); margin-bottom: 1.5rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: left;">
                        <div>
                            <small style="color: var(--gray-500);">${Utils.t('route')}</small>
                            <div style="font-weight: 600;">${ticket.trip?.route_name || Utils.t('route')}</div>
                        </div>
                        <div>
                            <small style="color: var(--gray-500);">${Utils.t('seat')}</small>
                            <div style="font-weight: 600;">#${ticket.seat_number}</div>
                        </div>
                        <div>
                            <small style="color: var(--gray-500);">${Utils.t('token')}</small>
                            <div style="font-family: monospace;">${ticket.ticket_token}</div>
                        </div>
                        <div>
                            <small style="color: var(--gray-500);">${Utils.t('status')}</small>
                            <div style="font-weight: 600; color: var(--primary);">${ticket.status}</div>
                        </div>
                    </div>
                </div>
                <button class="btn btn-success" onclick="Utils.modal.close()">
                    <i class="fas fa-check"></i> ${Utils.t('done')}
                </button>
            </div>
        `;
        
        Utils.modal.open(modalContent, { size: '' });
        
        setTimeout(() => {
            QRGenerator.generate(ticket.ticket_token, 'modal-qr-code', 200);
        }, 150);
    },
    
    trackBus(tripId) {
        PassengerTracking.trackTripId = tripId;
        App.navigate('tracking');
    },
    
    async cancelTicket(ticketId) {
        if (!confirm(Utils.t('cancel_confirmation'))) return;
        
        Utils.showLoading(Utils.t('loading'));
        try {
            await API.passenger.cancelBooking(ticketId);
            Utils.hideLoading();
            Utils.toast(Utils.t('ticket_cancelled'), 'success');
            await this.loadTickets();
            this.render();
        } catch (error) {
            Utils.hideLoading();
        }
    }
};