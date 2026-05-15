const Auth = {
    currentUser: null,
    
    init() {
        // Check if user is logged in
        const token = Utils.storage.get('token');
        const user = Utils.storage.get('user');
        
        if (token && user) {
            this.currentUser = user;
            this.showApp();
        } else {
            this.showAuth();
        }
        
        // Remove loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 1000);
    },
    
    showAuth() {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    },
    
    async showApp() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        await Utils.initLang();
        this.updateUI();
        App.init();
    },
    
    showLogin() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    },
    
    showRegister() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    },
    
    async login() {
        const phone = document.getElementById('login-phone').value;
        const password = document.getElementById('login-password').value;
        
        if (!phone || !password) {
            Utils.toast('Please fill in all fields', 'warning');
            return;
        }
        
        Utils.showLoading('Signing in...');
        
        try {
            const response = await API.auth.login({ phone_number: phone, password });
            this.handleAuthSuccess(response);
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    async register() {
        const name = document.getElementById('reg-name').value;
        const phone = document.getElementById('reg-phone').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        
        if (!name || !phone || !password) {
            Utils.toast('Please fill in required fields', 'warning');
            return;
        }
        
        if (!Utils.validatePhone(phone)) {
            Utils.toast('Please enter a valid Rwandan phone number', 'warning');
            return;
        }
        
        if (password.length < 6) {
            Utils.toast('Password must be at least 6 characters', 'warning');
            return;
        }
        
        Utils.showLoading('Creating account...');
        
        try {
            const response = await API.auth.register({
                fullname: name,
                phone_number: phone,
                email: email || null,
                password: password
            });
            this.handleAuthSuccess(response);
        } catch (error) {
            Utils.hideLoading();
        }
    },
    
    handleAuthSuccess(response) {
        Utils.storage.set('token', response.access_token);
        Utils.storage.set('user', response.user);
        this.currentUser = response.user;
        Utils.hideLoading();
        Utils.toast('Welcome to BusPoint!', 'success');
        this.showApp();
    },
    
    logout() {
        Utils.storage.clear();
        this.currentUser = null;
        window.location.reload();
    },
    
    updateUI() {
        // Update user name
        document.getElementById('user-name').textContent = this.currentUser.full_name;
        // update dropdown info
        const dropdown = document.querySelectorAll('#user-dropdown .dropdown-item');
        if (dropdown.length >= 2) {
            dropdown[0].innerHTML = `<i class="fas fa-user"></i> ${Utils.t('my_profile')}`;
            dropdown[1].innerHTML = `<i class="fas fa-sign-out-alt"></i> ${Utils.t('logout')}`;
        }
        // Build navigation based on role
        this.buildNavigation();
    },
    
    buildNavigation() {
        const navMenu = document.getElementById('nav-menu');
        const role = this.currentUser.role;
        
        let navItems = [];
        
        if (role === Config.ROLES.PASSENGER) {
        navItems = [
            { id: 'search', icon: 'search', label: Utils.t('tab_find_bus') },
            { id: 'tickets', icon: 'ticket-alt', label: Utils.t('tab_my_tickets') },
            { id: 'tracking', icon: 'map-marker-alt', label: Utils.t('tab_track_bus') }
        ];
        } else if (role === Config.ROLES.DRIVER) {
            navItems = [
                { id: 'driver-dashboard', icon: 'tachometer-alt', label: 'Dashboard' },
                { id: 'scanner', icon: 'qrcode', label: 'Scan Tickets' }
            ];
        } else if (role === Config.ROLES.ADMIN) {
            navItems = [
                { id: 'admin-dashboard', icon: 'tachometer-alt', label: 'Dashboard' },
                { id: 'admin-routes', icon: 'route', label: 'Routes' },
                { id: 'admin-buses', icon: 'bus', label: 'Buses' },
                { id: 'admin-trips', icon: 'calendar-alt', label: 'Trips' }
            ];
        }
        
        navMenu.innerHTML = navItems.map(item => `
            <button class="nav-item" onclick="App.navigate('${item.id}')" data-page="${item.id}">
                <i class="fas fa-${item.icon}"></i>
                <span>${item.label}</span>
            </button>
        `).join('');
    },
    
    toggleUserMenu() {
        const dropdown = document.getElementById('user-dropdown');
        dropdown.classList.toggle('hidden');
    },
    
    showProfile() {
        document.getElementById('user-dropdown').classList.add('hidden');
        App.navigate('profile');
    },
    
    isAuthenticated() {
        return !!this.currentUser;
    },
    
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }
};