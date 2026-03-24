const DriverScanner = {
    html5QrCode: null,
    isScanning: false,
    isInitialized: false,
    scannerContainerId: 'qr-reader',
    
    init() {
        this.render();
        
        // If scanner already exists and is scanning, just reattach to the new DOM
        if (this.isInitialized && this.html5QrCode && this.isScanning) {
            // Scanner is already running, no need to restart
            return;
        }
        
        // Only start scanner if not already initialized
        if (!this.isInitialized) {
            this.startScanner();
        }
    },
    
    render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto; text-align: center;">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-qrcode"></i> Ticket Scanner</h3>
                    </div>
                    <div class="card-body">
                        <div id="scanner-container" style="margin-bottom: 1.5rem;">
                            <div id="${this.scannerContainerId}" style="width: 100%; max-width: 500px; margin: 0 auto;"></div>
                        </div>
                        
                        <div id="manual-entry" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
                            <p style="color: var(--gray-500); margin-bottom: 1rem;">Or enter ticket token manually</p>
                            <div style="display: flex; gap: 0.5rem; max-width: 300px; margin: 0 auto;">
                                <input type="text" id="manual-token" placeholder="XXXXXX" maxlength="16" 
                                       style="flex: 1; padding: 0.75rem; border: 2px solid var(--gray-200); border-radius: var(--radius); text-align: center; font-family: monospace; font-size: 1.1rem; text-transform: uppercase;">
                                <button class="btn btn-success" onclick="DriverScanner.verifyManual()">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div id="scan-result" style="margin-top: 1.5rem;"></div>
                    </div>
                </div>
                
                <div class="stats-grid" style="margin-top: 2rem;">
                    <div class="stat-card">
                        <div class="stat-icon success">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-info">
                            <h4 id="scanned-count">0</h4>
                            <p>Verified Today</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon warning">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-info">
                            <h4 id="invalid-count">0</h4>
                            <p>Invalid Attempts</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Restore stats from localStorage if available
        this.restoreStats();
    },
    
    startScanner() {
        const qrReader = document.getElementById(this.scannerContainerId);
        if (!qrReader) return;
        
        // Clean up existing scanner if any
        if (this.html5QrCode) {
            this.html5QrCode.stop().catch(() => {});
            this.html5QrCode = null;
        }
        
        this.html5QrCode = new Html5Qrcode(this.scannerContainerId);
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };
        
        this.html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                this.onScanSuccess(decodedText);
            },
            (errorMessage) => {
                // Ignore continuous errors
            }
        ).catch(err => {
            console.error('Failed to start scanner:', err);
            qrReader.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <i class="fas fa-camera-slash"></i>
                    <h3>Camera Access Required</h3>
                    <p>Please allow camera access to scan tickets, or use manual entry below.</p>
                </div>
            `;
        });
        
        this.isScanning = true;
        this.isInitialized = true;
        
        // Store permission granted
        localStorage.setItem('camera_permission_granted', 'true');
    },
    
    restoreStats() {
        const scanned = localStorage.getItem('scanned_count') || '0';
        const invalid = localStorage.getItem('invalid_count') || '0';
        const scannedEl = document.getElementById('scanned-count');
        const invalidEl = document.getElementById('invalid-count');
        if (scannedEl) scannedEl.textContent = scanned;
        if (invalidEl) invalidEl.textContent = invalid;
    },
    
    onScanSuccess(token) {
        if (this.isScanning === 'processing') return;
        this.isScanning = 'processing';
        
        if (this.html5QrCode) {
            this.html5QrCode.pause();
        }
        
        this.verifyToken(token);
    },
    
    async verifyToken(token) {
        Utils.showLoading('Verifying ticket...');
        
        try {
            // Simulate verification (replace with real API later)
            await new Promise(r => setTimeout(r, 1000));
            
            const isValid = token.length >= 6;
            const result = {
                valid: isValid,
                ticket: isValid ? {
                    passenger: 'John Doe',
                    seat: 5,
                    route: 'Kimironko - Nyabugogo',
                    departure: '08:00 AM'
                } : null
            };
            
            Utils.hideLoading();
            this.showResult(result);
            
            if (result.valid) {
                this.updateStats('scanned');
            } else {
                this.updateStats('invalid');
            }
            
        } catch (error) {
            Utils.hideLoading();
            this.showResult({ valid: false, error: 'Verification failed' });
        }
    },
    
    verifyManual() {
        const token = document.getElementById('manual-token').value.trim().toUpperCase();
        if (!token) {
            Utils.toast('Please enter a token', 'warning');
            return;
        }
        this.verifyToken(token);
    },
    
    showResult(result) {
        const container = document.getElementById('scan-result');
        
        if (result.valid) {
            container.innerHTML = `
                <div style="background: #E8F5E9; border: 2px solid var(--primary); border-radius: var(--radius-lg); padding: 1.5rem; animation: slideUp 0.3s ease;">
                    <div style="width: 60px; height: 60px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <i class="fas fa-check" style="color: white; font-size: 1.5rem;"></i>
                    </div>
                    <h3 style="color: var(--primary-dark); margin-bottom: 1rem;">Ticket Valid!</h3>
                    <div style="text-align: left; background: white; padding: 1rem; border-radius: var(--radius); margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="color: var(--gray-500);">Passenger</span>
                            <span style="font-weight: 600;">${result.ticket.passenger}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="color: var(--gray-500);">Seat</span>
                            <span style="font-weight: 600;">#${result.ticket.seat}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--gray-500);">Route</span>
                            <span style="font-weight: 600;">${result.ticket.route}</span>
                        </div>
                    </div>
                    <button class="btn btn-success btn-lg" onclick="DriverScanner.resumeScanning()" style="width: 100%;">
                        <i class="fas fa-qrcode"></i> Scan Next
                    </button>
                </div>
            `;
            this.playSound('success');
        } else {
            container.innerHTML = `
                <div style="background: #FFEBEE; border: 2px solid var(--danger); border-radius: var(--radius-lg); padding: 1.5rem; animation: shake 0.5s ease;">
                    <div style="width: 60px; height: 60px; background: var(--danger); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                        <i class="fas fa-times" style="color: white; font-size: 1.5rem;"></i>
                    </div>
                    <h3 style="color: var(--danger); margin-bottom: 0.5rem;">Invalid Ticket</h3>
                    <p style="color: var(--gray-600); margin-bottom: 1.5rem;">${result.error || 'This ticket is not valid or has already been used.'}</p>
                    <button class="btn btn-outline" onclick="DriverScanner.resumeScanning()" style="width: 100%;">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
            this.playSound('error');
        }
    },
    
    resumeScanning() {
        document.getElementById('scan-result').innerHTML = '';
        document.getElementById('manual-token').value = '';
        
        if (this.html5QrCode && this.html5QrCode.isScanning === false) {
            this.html5QrCode.resume();
            this.isScanning = true;
        } else {
            this.isScanning = true;
        }
    },
    
    updateStats(type) {
        const element = document.getElementById(type === 'scanned' ? 'scanned-count' : 'invalid-count');
        if (element) {
            const current = parseInt(element.textContent) || 0;
            const newCount = current + 1;
            element.textContent = newCount;
            localStorage.setItem(`${type}_count`, newCount);
        }
    },
    
    playSound(type) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            if (type === 'success') {
                osc.frequency.value = 880;
                gain.gain.value = 0.1;
                osc.start();
                setTimeout(() => osc.stop(), 200);
            } else {
                osc.frequency.value = 220;
                gain.gain.value = 0.1;
                osc.start();
                setTimeout(() => osc.stop(), 300);
            }
        } catch (e) {
            // Audio not supported
        }
    },
    
    cleanup() {
        // Don't fully cleanup on tab switch - just pause scanning
        if (this.html5QrCode && this.html5QrCode.isScanning) {
            this.html5QrCode.pause();
            this.isScanning = false;
        }
    },
    
    destroy() {
        // Only call this on logout or app shutdown
        if (this.html5QrCode) {
            this.html5QrCode.stop().catch(() => {});
            this.html5QrCode = null;
        }
        this.isScanning = false;
        this.isInitialized = false;
    }
};