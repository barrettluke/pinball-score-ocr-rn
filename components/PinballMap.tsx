'use dom';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { memo, useEffect, useRef } from 'react';

interface Location {
    id: number;
    name: string;
    lat: string;
    lon: string;
    city: string;
    state: string;
}

interface NearbyLocation {
    location: Location;
    matchingMachines: string[];
}

interface MapProps {
    userLocation: { lat: number; lon: number } | null;
    locations: NearbyLocation[];
    onLocationSelect?: (locationId: number) => void;
    dom?: import('expo/dom').DOMProps;
}

function PinballMap({ userLocation, locations, onLocationSelect }: MapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);

    useEffect(() => {
        if (!mapContainer.current || !userLocation) return;

        // Initialize map
        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '© OpenStreetMap contributors',
                    },
                },
                layers: [
                    {
                        id: 'osm',
                        type: 'raster',
                        source: 'osm',
                    },
                ],
            },
            center: [userLocation.lon, userLocation.lat],
            zoom: 9,
        });

        // Add navigation controls
        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Add user location marker
        const userMarker = document.createElement('div');
        userMarker.style.cssText = `
            width: 16px;
            height: 16px;
            background: #00b4d8;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        `;
        new maplibregl.Marker({ element: userMarker })
            .setLngLat([userLocation.lon, userLocation.lat])
            .setPopup(new maplibregl.Popup().setHTML('<b>You are here</b>'))
            .addTo(map.current);

        // Add location markers
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([userLocation.lon, userLocation.lat]);

        locations.forEach(({ location, matchingMachines }) => {
            const lat = parseFloat(location.lat);
            const lon = parseFloat(location.lon);

            const markerEl = document.createElement('div');
            markerEl.style.cssText = `
                width: 12px;
                height: 12px;
                background: #e63946;
                border: 2px solid white;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;

            const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
                <div style="font-family: system-ui, sans-serif;">
                    <b style="font-size: 14px;">${location.name}</b><br>
                    <span style="color: #666; font-size: 12px;">${location.city}, ${location.state}</span><br>
                    <span style="color: #00b4d8; font-size: 11px;">${matchingMachines.length} favorite${matchingMachines.length > 1 ? 's' : ''}</span><br>
                    <a href="https://pinballmap.com/map?by_location_id=${location.id}" 
                       target="_blank" 
                       style="color: #e63946; font-size: 11px; text-decoration: none;">
                        View on Pinball Map →
                    </a>
                </div>
            `);

            markerEl.addEventListener('click', () => {
                if (onLocationSelect) {
                    onLocationSelect(location.id);
                }
            });

            new maplibregl.Marker({ element: markerEl })
                .setLngLat([lon, lat])
                .setPopup(popup)
                .addTo(map.current!);

            bounds.extend([lon, lat]);
        });

        // Fit map to show all markers
        if (locations.length > 0) {
            map.current.fitBounds(bounds, { padding: 40 });
        }

        return () => {
            map.current?.remove();
        };
    }, [userLocation, locations]);

    return (
        <>
            <style>{`
                html, body, #root { margin: 0; padding: 0; height: 100%; width: 100%; }
            `}</style>
            <div
                ref={mapContainer}
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px',
                    overflow: 'hidden',
                }}
            />
        </>
    );
}

// prevent re-renders if props haven't changed (crucial for typing performance)
export default memo(PinballMap, (prevProps, nextProps) => {
    // Check User Location (value equality)
    const activeLocSame =
        prevProps.userLocation?.lat === nextProps.userLocation?.lat &&
        prevProps.userLocation?.lon === nextProps.userLocation?.lon;

    if (!activeLocSame) return false;

    // Check Locations (value check - deep equality on full array might be slow but 67 items is minimal)
    // First check length
    if (prevProps.locations.length !== nextProps.locations.length) return false;

    // Check first item ID as a heuristic (usually if list changes, first item changes or order changes)
    if (prevProps.locations.length > 0 && prevProps.locations[0].location.id !== nextProps.locations[0].location.id) return false;

    // Full JSON compare to be safe (serializing 60 items is <1ms, acceptable to avoid DOM reload)
    return JSON.stringify(prevProps.locations) === JSON.stringify(nextProps.locations);
});
