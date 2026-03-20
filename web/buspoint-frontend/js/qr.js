const QRCode = {
    generate(text, containerId, size = 150) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        try {
            new QRCodeJS(container, {
                text: text,
                width: size,
                height: size,
                colorDark: '#1B5E20',
                colorLight: '#ffffff',
                correctLevel: QRCodeJS.CorrectLevel.H
            });
        } catch (error) {
            console.error('QR generation failed:', error);
            container.innerHTML = `
                <div style="width: ${size}px; height: ${size}px; background: var(--gray-100); 
                            display: flex; align-items: center; justify-content: center; 
                            border-radius: var(--radius);">
                    <i class="fas fa-qrcode" style="font-size: 3rem; color: var(--gray-400);"></i>
                </div>
            `;
        }
    },
    
    scanFromImage(imageData) {
        // For advanced QR scanning from images
        // Would integrate with html5-qrcode library
        return null;
    }
};