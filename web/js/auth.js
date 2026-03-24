// Authentication Logic
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupAuthForms();
});

function checkAuth() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);

    if (token && userData) {
        authToken = token;
        currentUser = JSON.parse(userData);
        
        // Hide loading screen
        document.getElementById('loading-screen').classList.add('hidden');
        
        // Show appropriate dashboard
        if (currentUser.role === 'passenger') {
            showPassengerDashboard();
        } else if (currentUser.role === 'admin') {
            showAdminDashboard();
        }
    } else {
        // Hide loading screen
        document.getElementById('loading-screen').classList.add('hidden');
        // Show auth section
        document.getElementById('auth-section').classList.remove('hidden');
    }
}

function setupAuthForms() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        const btn = e.target.querySelector('.btn-primary');
        const spinner = btn.querySelector('.fa-spin');
        const btnText = btn.querySelector('span');
        
        btn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = 'Signing in...';
        
        try {
            console.log('Attempting login with:', { email });
            const response = await api.login({ email, password });
            console.log('Login response:', response);
            
            // Store auth data
            const token = response.access_token || response.token;
            localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, token);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(response.user));
            
            authToken = token;
            currentUser = response.user;
            
            // Clear form and hide auth section
            e.target.reset();
            document.getElementById('auth-section').classList.add('hidden');

            // Show appropriate dashboard
            if (currentUser.role === 'passenger') {
                showPassengerDashboard();
            } else if (currentUser.role === 'admin') {
                showAdminDashboard();
            }

            // Show success message
            showNotification('Login successful!', 'success');
            
        } catch (error) {
            console.error('Login error:', error);
            showNotification(error.message || 'Login failed', 'error');
        } finally {
            btn.disabled = false;
            spinner.style.display = 'none';
            btnText.textContent = 'Sign In';
        }
    });

    // Register form
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = document.getElementById('registerName').value.trim();
        const phoneNumber = document.getElementById('registerPhone').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const role = document.getElementById('registerRole').value;
        
        // Validation
        if (!fullName || !phoneNumber || !email || !password || !role) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        if (password.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        
        if (!email.includes('@')) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        const userData = {
            full_name: fullName,
            phone_number: phoneNumber,
            email: email,
            password: password,
            role: role
        };
        
        const btn = e.target.querySelector('.btn-primary');
        const spinner = btn.querySelector('.fa-spin');
        const btnText = btn.querySelector('span');
        
        btn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = 'Creating account...';
        
        try {
            console.log('Attempting registration with:', { ...userData, password: '[HIDDEN]' });
            const response = await api.register(userData);
            console.log('Registration response:', response);
            
            // Store auth data
            const token = response.access_token || response.token;
            localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, token);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(response.user));
            
            authToken = token;
            currentUser = response.user;
            
            // Clear form and hide auth section
            e.target.reset();
            document.getElementById('auth-section').classList.add('hidden');

            // Show appropriate dashboard
            if (currentUser.role === 'passenger') {
                showPassengerDashboard();
            } else if (currentUser.role === 'admin') {
                showAdminDashboard();
            }

            showNotification('Registration successful! Welcome to Bus Point!', 'success');
            
        } catch (error) {
            console.error('Registration error:', error);
            showNotification(error.message || 'Registration failed', 'error');
        } finally {
            btn.disabled = false;
            spinner.style.display = 'none';
            btnText.textContent = 'Create Account';
        }
    });
}

function logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
    
    authToken = null;
    currentUser = null;
    
    // Stop GPS tracking if active
    if (typeof stopGPSTracking === 'function') {
        stopGPSTracking();
    }
    
    // Hide dashboards
    document.getElementById('passenger-dashboard').classList.remove('active');
    document.getElementById('admin-dashboard').classList.remove('active');

    // Clear any leftover form data and show login
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    showLogin();

    // Show auth section
    document.getElementById('auth-section').classList.remove('hidden');

    showNotification('Logged out successfully', 'success');
}

function showLogin() {
    document.getElementById('login-form').classList.add('active');
    document.getElementById('register-form').classList.remove('active');
}

function showRegister() {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; margin-left: 10px; cursor: pointer;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// MapLibre does not require a global token; style URL + optional API key are handled when building the map.
