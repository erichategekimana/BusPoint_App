const PassengerBooking = {
    currentStep: 1,
    selectedRoute: null,
    selectedTrip: null,
    selectedSeat: null,
    bookingData: {},
    
    init() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="passenger-home">
                <div class="booking-container">
                    <div id="booking-stepper"></div>
                    <div id="step-content" class="card" style="margin-top: 2rem; min-height: 400px;">
                    </div>
                </div>
            </div>
        `;
        this.renderStepper();
        this.showStep(1);
    },
    
    renderStepper() {
        // Step labels – these keys need to exist in your JSON files
        const steps = [
            { id: 1, label: Utils.t('step_route') },
            { id: 2, label: Utils.t('step_trip') },
            { id: 3, label: Utils.t('step_seat') },
            { id: 4, label: Utils.t('step_payment') },
            { id: 5, label: Utils.t('step_confirm') }
        ];
        
        const stepperHTML = `
            <div class="stepper">
                ${steps.map(step => `
                    <div class="step ${step.id === this.currentStep ? 'active' : ''} ${step.id < this.currentStep ? 'completed' : ''}" data-step="${step.id}">
                        <div class="step-number">${step.id < this.currentStep ? '✓' : step.id}</div>
                        <div class="step-label">${step.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        const stepperContainer = document.getElementById('booking-stepper');
        if (stepperContainer) {
            stepperContainer.innerHTML = stepperHTML;
        }
    },
    
    showStep(step) {
        this.currentStep = step;
        this.renderStepper();
        
        const content = document.getElementById('step-content');
        content.innerHTML = '';
        
        switch(step) {
            case 1:
                this.renderRouteSelection(content);
                break;
            case 2:
                this.renderTripSelection(content);
                break;
            case 3:
                this.renderSeatSelection(content);
                break;
            case 4:
                this.renderPayment(content);
                break;
            case 5:
                this.renderConfirmation(content);
                break;
        }
    },
    
    async renderRouteSelection(container) {
        Utils.showLoading(Utils.t('loading')); // key 'loading' already exists
        
        try {
            const stops = await API.admin.getStops();
            Utils.hideLoading();
            
            container.innerHTML = `
                <div class="step-content">
                    <h3 style="margin-bottom: 1.5rem; color: var(--gray-800);">
                        <i class="fas fa-map-marked-alt" style="color: var(--primary); margin-right: 0.5rem;"></i>
                        ${Utils.t('route_selection')}
                    </h3>
                    
                    <div class="route-selection">
                        <div class="location-input">
                            <label>${Utils.t('pickup_location')}</label>
                            <select class="location-select" id="pickup-stop">
                                <option value="">${Utils.t('select_pickup_stop')}</option>
                                ${stops.map(stop => `
                                    <option value="${stop.id}">${stop.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <button class="swap-btn" onclick="PassengerBooking.swapLocations()">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                        
                        <div class="location-input">
                            <label>${Utils.t('dropoff_location')}</label>
                            <select class="location-select" id="dropoff-stop">
                                <option value="">${Utils.t('select_dropoff_stop')}</option>
                                ${stops.map(stop => `
                                    <option value="${stop.id}">${stop.name}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="date-input">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--gray-700);">
                            <i class="fas fa-calendar" style="color: var(--primary); margin-right: 0.5rem;"></i>
                            ${Utils.t('travel_date')}
                        </label>
                        <input type="date" id="travel-date" min="${new Date().toISOString().split('T')[0]}">
                    </div>
                    
                    <div style="margin-top: 2rem; text-align: right;">
                        <button class="btn btn-success btn-lg" onclick="PassengerBooking.searchTrips()">
                            <i class="fas fa-search"></i> ${Utils.t('find_buses')}
                        </button>
                    </div>
                </div>
            `;
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('travel-date').value = tomorrow.toISOString().split('T')[0];
            
        } catch (error) {
            Utils.hideLoading();
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>${Utils.t('failed_to_load_stops')}</h3>
                    <p>${Utils.t('loading')}</p>
                </div>
            `;
        }
    },
    
    swapLocations() {
        const pickup = document.getElementById('pickup-stop');
        const dropoff = document.getElementById('dropoff-stop');
        const temp = pickup.value;
        pickup.value = dropoff.value;
        dropoff.value = temp;
    },
    
    async searchTrips() {
        const pickupId = document.getElementById('pickup-stop').value;
        const dropoffId = document.getElementById('dropoff-stop').value;
        const date = document.getElementById('travel-date').value;
        
        if (!pickupId || !dropoffId || !date) {
            Utils.toast(Utils.t('please_fill_all_fields'), 'warning');
            return;
        }
        
        if (pickupId === dropoffId) {
            Utils.toast(Utils.t('pickup_dropoff_same'), 'warning');
            return;
        }
        
        this.bookingData = { pickupId, dropoffId, date };
        Utils.showLoading(Utils.t('loading'));
        
        try {
            const trips = await API.passenger.searchTrips(pickupId, dropoffId, date);
            Utils.hideLoading();
            
            if (trips.length === 0) {
                Utils.toast(Utils.t('no_trips_found'), 'info');
                return;
            }
            
            this.availableTrips = trips;
            this.showStep(2);
            
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    renderTripSelection(container) {
        container.innerHTML = `
            <div class="step-content">
                <h3 style="margin-bottom: 1.5rem; color: var(--gray-800);">
                    <i class="fas fa-bus" style="color: var(--primary); margin-right: 0.5rem;"></i>
                    ${Utils.t('select_trip_title')}
                </h3>
                
                <div class="trips-list">
                    ${this.availableTrips.map(trip => {
                        const departure = Utils.formatDateTime(trip.departure_time);
                        return `
                            <div class="trip-card" onclick="PassengerBooking.selectTrip('${trip.id}')" data-trip-id="${trip.id}">
                                <div class="trip-time">
                                    <div class="departure">${departure.time}</div>
                                    <div class="duration"><i class="fas fa-clock"></i> 45 ${Utils.t('minutes')}</div>
                                    <div class="arrival">${Utils.t('arrives')} ~${this.calculateArrival(trip.departure_time, 45)}</div>
                                </div>
                                <div class="trip-info">
                                    <div class="route-name">
                                        <i class="fas fa-route"></i> ${trip.route_name}
                                    </div>
                                    <div class="bus-info">
                                        <span><i class="fas fa-bus"></i> ${trip.bus_plate}</span>
                                        <span><i class="fas fa-chair"></i> ${trip.available_seats} ${Utils.t('seats_left')}</span>
                                    </div>
                                </div>
                                <div class="trip-price">
                                    <div class="amount">${Utils.formatCurrency(500)}</div>
                                    <div class="seats">${trip.available_seats} ${Utils.t('available')}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div style="margin-top: 2rem; display: flex; justify-content: space-between;">
                    <button class="btn btn-secondary" onclick="PassengerBooking.showStep(1)">
                        <i class="fas fa-arrow-left"></i> ${Utils.t('back')}
                    </button>
                </div>
            </div>
        `;
    },
    
    calculateArrival(departureTime, durationMinutes) {
        const departure = new Date(departureTime);
        const arrival = new Date(departure.getTime() + durationMinutes * 60000);
        return arrival.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    },
    
    selectTrip(tripId) {
        this.selectedTrip = this.availableTrips.find(t => t.id === tripId);
        
        document.querySelectorAll('.trip-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-trip-id="${tripId}"]`).classList.add('selected');
        
        setTimeout(() => {
            this.showStep(3);
        }, 500);
    },
    
    async renderSeatSelection(container) {
        Utils.showLoading(Utils.t('loading'));
        
        try {
            const [tripDetails, occupiedSeatsData] = await Promise.all([
                API.passenger.getTripDetails(this.selectedTrip.id),
                API.passenger.getOccupiedSeats(this.selectedTrip.id)
            ]);
            Utils.hideLoading();
            
            const totalSeats = tripDetails.bus_details.capacity || 60;
            const occupiedSeats = occupiedSeatsData.seats || [];
            
            let seatsHTML = '';
            for (let i = 1; i <= totalSeats; i++) {
                const isOccupied = occupiedSeats.includes(i);
                seatsHTML += `
                    <div class="seat ${isOccupied ? 'occupied' : ''} ${this.selectedSeat === i ? 'selected' : ''}" 
                        onclick="${isOccupied ? '' : `PassengerBooking.selectSeat(${i})`}">
                        ${i}
                    </div>
                `;
            }
            
            container.innerHTML = `
                <div class="step-content">
                    <h3 style="margin-bottom: 1.5rem; color: var(--gray-800); text-align: center;">
                        <i class="fas fa-chair" style="color: var(--primary); margin-right: 0.5rem;"></i>
                        ${Utils.t('seat_selection')}
                    </h3>
                    
                    <div class="seat-selection">
                        <div class="bus-layout">
                            <div class="bus-front">
                                <i class="fas fa-steering-wheel"></i> ${Utils.t('front')}
                            </div>
                            <div class="seats-grid">
                                ${seatsHTML}
                            </div>
                            <div class="seat-legend">
                                <div class="legend-item">
                                    <div class="legend-box available"></div>
                                    <span>${Utils.t('available')}</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-box selected"></div>
                                    <span>${Utils.t('selected')}</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-box occupied"></div>
                                    <span>${Utils.t('occupied')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 2rem; display: flex; justify-content: space-between;">
                        <button class="btn btn-secondary" onclick="PassengerBooking.showStep(2)">
                            <i class="fas fa-arrow-left"></i> ${Utils.t('back')}
                        </button>
                        <button class="btn btn-success btn-lg" onclick="PassengerBooking.proceedToPayment()" ${!this.selectedSeat ? 'disabled' : ''}>
                            ${Utils.t('continue')} <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
        } catch (error) {
            Utils.hideLoading();
            Utils.toast(Utils.t('failed_load_seat_map'), 'error');
        }
    },
    
    selectSeat(seatNumber) {
        this.selectedSeat = seatNumber;
        
        document.querySelectorAll('.seat').forEach((seat, index) => {
            seat.classList.remove('selected');
            if (index + 1 === seatNumber) {
                seat.classList.add('selected');
            }
        });
        
        const continueBtn = document.querySelector('.btn-success');
        if (continueBtn) continueBtn.disabled = false;
    },
    
    proceedToPayment() {
        if (!this.selectedSeat) {
            Utils.toast(Utils.t('select_seat_warning'), 'warning');
            return;
        }
        this.showStep(4);
    },
    
    renderPayment(container) {
        container.innerHTML = `
            <div class="step-content">
                <h3 style="margin-bottom: 1.5rem; color: var(--gray-800); text-align: center;">
                    <i class="fas fa-credit-card" style="color: var(--primary); margin-right: 0.5rem;"></i>
                    ${Utils.t('payment')}
                </h3>
                
                <div class="payment-section">
                    <div class="payment-summary">
                        <h3>${Utils.t('booking_summary')}</h3>
                        <div class="summary-row">
                            <span>${Utils.t('route')}</span>
                            <span>${this.selectedTrip.route_name}</span>
                        </div>
                        <div class="summary-row">
                            <span>${Utils.t('departure')}</span>
                            <span>${Utils.formatDateTime(this.selectedTrip.departure_time).full}</span>
                        </div>
                        <div class="summary-row">
                            <span>${Utils.t('seat')}</span>
                            <span>#${this.selectedSeat}</span>
                        </div>
                        <div class="summary-row">
                            <span>${Utils.t('total')}</span>
                            <span>${Utils.formatCurrency(500)}</span>
                        </div>
                    </div>
                    
                    <div class="momo-payment">
                        <div class="momo-logo">
                            <i class="fas fa-mobile-alt"></i> MTN MoMo
                        </div>
                        <h4>${Utils.t('pay_with_momo')}</h4>
                        <p>${Utils.t('enter_momo_number')}</p>
                        
                        <div class="phone-input">
                            <input type="tel" id="momo-phone" placeholder="078XXXXXXX" maxlength="10" 
                                   value="${Auth.currentUser.phone_number}">
                        </div>
                        
                        <button class="btn btn-success btn-lg" onclick="PassengerBooking.processPayment()" style="width: 100%;">
                            <i class="fas fa-lock"></i> ${Utils.t('pay')} ${Utils.formatCurrency(500)}
                        </button>
                    </div>
                </div>
                
                <div style="margin-top: 2rem; display: flex; justify-content: space-between;">
                    <button class="btn btn-secondary" onclick="PassengerBooking.showStep(3)">
                        <i class="fas fa-arrow-left"></i> ${Utils.t('back')}
                    </button>
                </div>
            </div>
        `;
    },
    
    async processPayment() {
        const phone = document.getElementById('momo-phone').value;
        
        if (!Utils.validatePhone(phone)) {
            Utils.toast(Utils.t('enter_valid_mtn'), 'warning');
            return;
        }
        
        Utils.showLoading(Utils.t('loading'));
        
        try {
            const booking = await API.passenger.createBooking({
                trip_id: this.selectedTrip.id,
                seat_number: this.selectedSeat,
                pickup_stop_id: this.bookingData.pickupId,
                dropoff_stop_id: this.bookingData.dropoffId
            });
            
            this.createdBooking = booking.booking;
            
            const payment = await API.passenger.initializePayment({
                booking_id: booking.booking.id,
                phone_number: phone
            });
            
            Utils.hideLoading();
            this.showPaymentPending(payment.transaction_ref);
            
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    showPaymentPending(transactionRef) {
        const container = document.getElementById('step-content');
        container.innerHTML = `
            <div class="step-content" style="text-align: center; padding: 3rem;">
                <div style="width: 100px; height: 100px; background: var(--primary-lighter); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem;">
                    <i class="fas fa-mobile-alt" style="font-size: 3rem; color: var(--primary);"></i>
                </div>
                <h3 style="margin-bottom: 1rem; color: var(--gray-800);">${Utils.t('check_phone')}</h3>
                <p style="color: var(--gray-600); margin-bottom: 2rem;">
                    ${Utils.t('payment_pending_message')}
                </p>
                <div style="background: var(--gray-100); padding: 1rem; border-radius: var(--radius); margin-bottom: 2rem;">
                    <small style="color: var(--gray-500);">${Utils.t('transaction_reference')}</small>
                    <div style="font-family: monospace; font-size: 1.1rem; color: var(--gray-700);">${transactionRef}</div>
                </div>
                <button class="btn btn-success" onclick="PassengerBooking.simulatePaymentSuccess('${transactionRef}')">
                    <i class="fas fa-check"></i> ${Utils.t('ive_paid')}
                </button>
            </div>
        `;
    },
    
    async simulatePaymentSuccess(transactionRef) {
        Utils.showLoading(Utils.t('loading'));
        
        try {
            await API.request('/payments/webhook/momo', {
                method: 'POST',
                body: {
                    transaction_ref: transactionRef,
                    status: 'SUCCESSFUL'
                }
            });
            
            Utils.hideLoading();
            this.showStep(5);
            
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    renderConfirmation(container) {
        container.innerHTML = `
            <div class="step-content confirmation">
                <div class="confirmation-icon">
                    <i class="fas fa-check"></i>
                </div>
                <h2>${Utils.t('booking_confirmed')}</h2>
                <p>${Utils.t('booking_success')}</p>
                
                <div class="ticket-preview">
                    <div class="ticket-header">
                        <h3><i class="fas fa-bus"></i> BusPoint</h3>
                        <span class="badge badge-success">${Utils.t('confirmed').toUpperCase()}</span>
                    </div>
                    <div class="ticket-card-body">
                        <div class="ticket-route">
                            <div class="from">
                                <h4>${Utils.t('from')}</h4>
                                <p>${Utils.t('pickup_stop')}</p>
                            </div>
                            <div class="arrow">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                            <div class="to">
                                <h4>${Utils.t('to')}</h4>
                                <p>${Utils.t('dropoff_stop')}</p>
                            </div>
                        </div>
                        <div class="ticket-details">
                            <div class="ticket-detail">
                                <label>${Utils.t('date')}</label>
                                <span>${this.bookingData.date}</span>
                            </div>
                            <div class="ticket-detail">
                                <label>${Utils.t('seat')}</label>
                                <span>#${this.selectedSeat}</span>
                            </div>
                            <div class="ticket-detail">
                                <label>${Utils.t('token')}</label>
                                <span>${this.createdBooking?.ticket_token || 'XXXXXX'}</span>
                            </div>
                        </div>
                    </div>
                    <div id="ticket-qr" style="display: flex; justify-content: center; padding: 1rem; background: white;"></div>
                </div>
                
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-success btn-lg" onclick="App.navigate('tickets')">
                        <i class="fas fa-ticket-alt"></i> ${Utils.t('view_my_tickets')}
                    </button>
                    <button class="btn btn-outline" onclick="App.navigate('search')">
                        <i class="fas fa-search"></i> ${Utils.t('book_another')}
                    </button>
                </div>
            </div>
        `;
        
        if (this.createdBooking?.ticket_token) {
            setTimeout(() => {
                QRGenerator.generate(this.createdBooking.ticket_token, 'ticket-qr');
            }, 100);
        }
    }
};