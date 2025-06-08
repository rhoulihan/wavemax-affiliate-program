/**
 * Parent-Iframe Communication Bridge WITH Geocoding Support
 * This is an UPDATED version of parent-iframe-bridge-inline.js that includes geocoding handlers
 * 
 * To use: Replace the handleMessage function in your existing parent-iframe-bridge-inline.js
 * with the updated version below that includes the geocoding cases.
 */

// In the handleMessage function, add these new cases before the default case:

function handleMessage(event) {
    console.log('[Parent-Iframe Bridge] Message received from:', event.origin);
    console.log('[Parent-Iframe Bridge] Message data:', event.data);
    
    // Security check
    const originCheck = ALLOWED_ORIGINS.some(origin => event.origin.includes(origin.replace(/^https?:\/\//, '')));
    console.log('[Parent-Iframe Bridge] Origin allowed?', originCheck, 'checking against:', ALLOWED_ORIGINS);
    
    if (!originCheck) {
        console.log('[Parent-Iframe Bridge] Message rejected - origin not allowed');
        return;
    }

    if (!event.data || !event.data.type) {
        console.log('[Parent-Iframe Bridge] Message rejected - no data or type');
        return;
    }

    console.log('[Parent-Iframe Bridge] Processing message type:', event.data.type);

    switch (event.data.type) {
        case 'hide-chrome':
            console.log('[Parent-Iframe Bridge] Hide chrome requested. isMobile:', isMobile, 'isTablet:', isTablet);
            if (isMobile || isTablet) {
                hideChrome();
            } else {
                console.log('[Parent-Iframe Bridge] Hide chrome ignored - not mobile/tablet');
            }
            break;
            
        case 'show-chrome':
            console.log('[Parent-Iframe Bridge] Show chrome requested');
            showChrome();
            break;
            
        case 'resize':
            // Existing resize functionality
            if (event.data.data && event.data.data.height) {
                console.log('[Parent-Iframe Bridge] Resize requested:', event.data.data.height);
                resizeIframe(event.data.data.height);
            }
            break;
            
        case 'scroll-to-top':
            console.log('[Parent-Iframe Bridge] Scroll to top requested');
            smoothScrollToTop();
            break;
            
        case 'route-changed':
            console.log('[Parent-Iframe Bridge] Route changed. chromeHidden:', chromeHidden, 'isMobile:', isMobile);
            // On mobile, always keep chrome hidden
            if (isMobile && !chromeHidden) {
                console.log('[Parent-Iframe Bridge] Route changed on mobile, hiding chrome');
                hideChrome();
            }
            // On desktop, show chrome if it was hidden
            else if (!isMobile && chromeHidden) {
                console.log('[Parent-Iframe Bridge] Route changed on desktop, showing chrome');
                showChrome();
            }
            break;
            
        // NEW GEOCODING CASES
        case 'geocode-forward':
            console.log('[Parent-Iframe Bridge] Forward geocoding requested:', event.data.data);
            if (event.data.data && event.data.data.query && iframe) {
                const { query, requestId } = event.data.data;
                
                // Helper function to parse natural address format
                function parseAddress(input) {
                    const trimmed = input.trim();
                    
                    // Check if we have at least a street number and name
                    const streetPattern = /^\d+\s+\w+/;
                    if (!streetPattern.test(trimmed)) {
                        return null;
                    }
                    
                    // Parse expected format: "streetAddress streetName, city, state zip"
                    const parts = trimmed.split(',').map(p => p.trim());
                    
                    if (parts.length === 1) {
                        // Just street address, no city/state yet
                        return null;
                    }
                    
                    let streetAddress = parts[0];
                    let city = '';
                    let state = '';
                    let zip = '';
                    
                    if (parts.length === 2) {
                        // "street, city" - assume Texas
                        city = parts[1];
                        state = 'TX';
                    } else if (parts.length === 3) {
                        // "street, city, state zip"
                        city = parts[1];
                        
                        // Parse state and zip from last part
                        const stateZipPart = parts[2];
                        const stateZipMatch = stateZipPart.match(/^([A-Z]{2}|\w+)\s+(\d{5})$/i);
                        
                        if (stateZipMatch) {
                            state = stateZipMatch[1].toUpperCase();
                            zip = stateZipMatch[2];
                        } else {
                            // Might be just state or just zip
                            if (/^[A-Z]{2}$/i.test(stateZipPart)) {
                                state = stateZipPart.toUpperCase();
                            } else if (/^\d{5}$/.test(stateZipPart)) {
                                zip = stateZipPart;
                                state = 'TX'; // Assume Texas if only zip
                            } else {
                                state = stateZipPart; // Assume it's a state name
                            }
                        }
                    }
                    
                    // Build search query
                    let searchQuery = streetAddress + ', ' + city;
                    if (state) searchQuery += ', ' + state;
                    if (zip) searchQuery += ' ' + zip;
                    searchQuery += ', USA';
                    
                    return searchQuery;
                }
                
                // Parse the address
                const searchQuery = parseAddress(query);
                if (!searchQuery) {
                    // Not enough info, return empty results
                    iframe.contentWindow.postMessage({
                        type: 'geocode-forward-response',
                        data: {
                            requestId: requestId,
                            results: []
                        }
                    }, '*');
                    return;
                }
                
                // Austin area bounds (50 mile radius)
                const AUSTIN_BOUNDS = {
                    minLat: 29.5451,  // 30.2672 - 0.7217
                    maxLat: 30.9889,  // 30.2672 + 0.7217
                    minLon: -98.6687, // -97.7431 - 0.9256
                    maxLon: -96.8175  // -97.7431 + 0.9256
                };
                
                // Perform forward geocoding using Nominatim with Austin area bounds
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&accept-language=en&viewbox=${AUSTIN_BOUNDS.minLon},${AUSTIN_BOUNDS.minLat},${AUSTIN_BOUNDS.maxLon},${AUSTIN_BOUNDS.maxLat}&bounded=1&countrycodes=us`)
                    .then(response => response.json())
                    .then(results => {
                        // Helper function to format address in natural format
                        function formatNaturalAddress(displayName) {
                            // Nominatim returns format like: "825, East Rundberg Lane, Windsor Hills, Austin, Travis County, Texas, 78753, United States"
                            // We want: "825 East Rundberg Lane, Austin, TX 78753"
                            
                            const parts = displayName.split(',').map(p => p.trim());
                            if (parts.length < 3) return displayName;
                            
                            let streetNumber = '';
                            let streetName = '';
                            let city = '';
                            let state = '';
                            let zip = '';
                            
                            // First part might be street number
                            if (/^\d+$/.test(parts[0])) {
                                streetNumber = parts[0];
                                streetName = parts[1] || '';
                            } else {
                                // Street number and name might be together
                                const streetMatch = parts[0].match(/^(\d+)\s+(.+)$/);
                                if (streetMatch) {
                                    streetNumber = streetMatch[1];
                                    streetName = streetMatch[2];
                                } else {
                                    streetName = parts[0];
                                }
                            }
                            
                            // Find city, state, and zip in remaining parts
                            for (let i = 2; i < parts.length; i++) {
                                const part = parts[i];
                                if (/^\d{5}$/.test(part)) {
                                    zip = part;
                                } else if (part === 'Austin' || part === 'Round Rock' || part === 'Cedar Park' || part === 'Pflugerville') {
                                    city = part;
                                } else if (part === 'Texas') {
                                    state = 'TX';
                                }
                            }
                            
                            // Build natural format
                            let formatted = streetNumber ? streetNumber + ' ' + streetName : streetName;
                            if (city) formatted += ', ' + city;
                            if (state) formatted += ', ' + state;
                            if (zip) formatted += ' ' + zip;
                            
                            return formatted;
                        }
                        
                        // Filter results to ensure they're within bounds
                        const filteredResults = results.filter(item => {
                            const lat = parseFloat(item.lat);
                            const lon = parseFloat(item.lon);
                            return lat >= AUSTIN_BOUNDS.minLat && lat <= AUSTIN_BOUNDS.maxLat &&
                                   lon >= AUSTIN_BOUNDS.minLon && lon <= AUSTIN_BOUNDS.maxLon;
                        });
                        
                        // Send filtered results back to iframe with formatted addresses
                        iframe.contentWindow.postMessage({
                            type: 'geocode-forward-response',
                            data: {
                                requestId: requestId,
                                results: filteredResults.map(item => ({
                                    display_name: formatNaturalAddress(item.display_name),
                                    lat: item.lat,
                                    lon: item.lon
                                }))
                            }
                        }, '*');
                        console.log('[Parent-Iframe Bridge] Sent geocoding results:', filteredResults.length, '(filtered from', results.length + ')');
                    })
                    .catch(error => {
                        console.error('[Parent-Iframe Bridge] Geocoding error:', error);
                        // Send error response
                        iframe.contentWindow.postMessage({
                            type: 'geocode-forward-response',
                            data: {
                                requestId: requestId,
                                error: 'Geocoding failed',
                                results: []
                            }
                        }, '*');
                    });
            }
            break;

        case 'geocode-reverse':
            console.log('[Parent-Iframe Bridge] Reverse geocoding requested:', event.data.data);
            if (event.data.data && event.data.data.lat && event.data.data.lng && iframe) {
                const { lat, lng, requestId } = event.data.data;
                
                // Perform reverse geocoding using Nominatim
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`)
                    .then(response => response.json())
                    .then(data => {
                        // Send result back to iframe
                        iframe.contentWindow.postMessage({
                            type: 'geocode-reverse-response',
                            data: {
                                requestId: requestId,
                                address: data.display_name || 'Unknown location'
                            }
                        }, '*');
                        console.log('[Parent-Iframe Bridge] Sent reverse geocoding result');
                    })
                    .catch(error => {
                        console.error('[Parent-Iframe Bridge] Reverse geocoding error:', error);
                        // Send error response
                        iframe.contentWindow.postMessage({
                            type: 'geocode-reverse-response',
                            data: {
                                requestId: requestId,
                                error: 'Reverse geocoding failed',
                                address: 'Error getting address'
                            }
                        }, '*');
                    });
            }
            break;
            
        default:
            console.log('[Parent-Iframe Bridge] Unknown message type:', event.data.type);
    }
}