const BusMap = {
    maps: {},
    
    init(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        
        // Check if map already initialized
        if (this.maps[containerId]) {
            this.maps[containerId].remove();
        }
        
        const map = L.map(containerId).setView(
            options.center || Config.MAP_CENTER,
            options.zoom || Config.MAP_ZOOM
        );
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
        
        this.maps[containerId] = map;
        return map;
    },
    
    addBusMarker(map, lat, lng, plateNumber) {
        const icon = L.divIcon({
            className: 'bus-marker',
            html: `
                <div style="
                    background: var(--primary);
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(46, 125, 50, 0.4);
                    border: 3px solid white;
                    font-size: 1.2rem;
                ">
                    <i class="fas fa-bus"></i>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindPopup(`
            <div style="text-align: center;">
                <strong>${plateNumber}</strong><br>
                <span style="color: var(--primary);">
                    <i class="fas fa-satellite-dish"></i> Live
                </span>
            </div>
        `);
        
        return marker;
    },
    
    addStopMarker(map, lat, lng, name, order) {
        const icon = L.divIcon({
            className: 'stop-marker',
            html: `
                <div style="
                    background: white;
                    color: var(--primary);
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    border: 2px solid var(--primary);
                    font-weight: 700;
                    font-size: 0.85rem;
                ">
                    ${order}
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindPopup(`<strong>${name}</strong>`);
        
        return marker;
    },
    
    addUserMarker(map, lat, lng) {
        const icon = L.divIcon({
            className: 'user-marker',
            html: `
                <div style="
                    background: var(--info);
                    color: white;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                "></div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        return L.marker([lat, lng], { icon }).addTo(map);
    },
    
    drawRoute(map, coordinates, options = {}) {
        return L.polyline(coordinates, {
            color: options.color || '#2E7D32',
            weight: options.weight || 4,
            opacity: options.opacity || 0.8,
            dashArray: options.dashed ? '10, 10' : null
        }).addTo(map);
    },
    
    fitBounds(map, markersOrLayer) {
        if (Array.isArray(markersOrLayer)) {
            const group = new L.featureGroup(markersOrLayer);
            map.fitBounds(group.getBounds().pad(0.1));
        } else {
            map.fitBounds(markersOrLayer.getBounds().pad(0.1));
        }
    },
    
    destroy(containerId) {
        if (this.maps[containerId]) {
            this.maps[containerId].remove();
            delete this.maps[containerId];
        }
    }
};