const Utils = {
    // Storage helpers
    storage: {
        set(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        },
        get(key) {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        },
        remove(key) {
            localStorage.removeItem(key);
        },
        clear() {
            localStorage.clear();
        }
    },

    // Format currency
    formatCurrency(amount, currency = 'RWF') {
        return new Intl.NumberFormat('en-RW', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0
        }).format(amount);
    },

    // Format date/time
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            }),
            time: date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            full: date.toLocaleString('en-US')
        };
    },

    // Format relative time
    timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    },

    // Generate UUID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // Validate phone number (Rwanda format)
    validatePhone(phone) {
        const regex = /^(078|079|072|073)\d{7}$/;
        return regex.test(phone);
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Show toast notification
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas fa-${icons[type]}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Show loading overlay
    showLoading(message = 'Loading...') {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <p>${message}</p>
        `;
        document.body.appendChild(overlay);
    },

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.remove();
    },

    // Modal helpers
    modal: {
        open(content, options = {}) {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content ${options.size || ''}">
                    ${options.title ? `<div class="modal-header"><h3>${options.title}</h3><button onclick="Utils.modal.close()"><i class="fas fa-times"></i></button></div>` : ''}
                    <div class="modal-body">${content}</div>
                </div>
            `;
            modal.onclick = (e) => {
                if (e.target === modal) Utils.modal.close();
            };
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';
        },
        
        close() {
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                modal.remove();
                document.body.style.overflow = '';
            }
        }
    }
};