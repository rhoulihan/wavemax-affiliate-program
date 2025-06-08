/**
 * Example addition to parent-iframe-bridge-inline.js to handle geocoding requests
 * Add this code to the handleMessage function in the parent bridge script
 */

// Add these cases to the switch statement in handleMessage function:

case 'geocode-forward':
    console.log('[Parent-Iframe Bridge] Forward geocoding requested:', event.data.data);
    if (event.data.data && event.data.data.query) {
        const { query, requestId } = event.data.data;
        
        // Helper function to parse natural address format
        function parseAddress(input) {
            const trimmed = input.trim();
            
            // Check if we have at least a street number and name
            const streetPattern = /^\d+\s+\w+/;
            if (!streetPattern.test(trimmed)) {
                return null;
            }
            
            // Parse the input
            const parts = trimmed.split(',').map(p => p.trim());
            let streetAddress = parts[0];
            let city = '';
            let stateZip = '';
            
            if (parts.length > 1) {
                const lastPart = parts[parts.length - 1];
                const stateZipPattern = /\s+(TX|Texas)\s*(\d{5})?$/i;
                const stateZipMatch = lastPart.match(stateZipPattern);
                
                if (stateZipMatch) {
                    city = lastPart.replace(stateZipPattern, '').trim();
                    stateZip = stateZipMatch[0].trim();
                } else if (parts.length === 2) {
                    city = lastPart;
                } else if (parts.length === 3) {
                    city = parts[1];
                    stateZip = parts[2];
                }
            }
            
            // Build search query
            let searchQuery = streetAddress;
            if (city) searchQuery += ', ' + city;
            if (stateZip) {
                searchQuery += ', ' + stateZip;
            } else {
                searchQuery += ', TX';
            }
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
                // Filter results to ensure they're within bounds
                const filteredResults = results.filter(item => {
                    const lat = parseFloat(item.lat);
                    const lon = parseFloat(item.lon);
                    return lat >= AUSTIN_BOUNDS.minLat && lat <= AUSTIN_BOUNDS.maxLat &&
                           lon >= AUSTIN_BOUNDS.minLon && lon <= AUSTIN_BOUNDS.maxLon;
                });
                
                // Send filtered results back to iframe
                iframe.contentWindow.postMessage({
                    type: 'geocode-forward-response',
                    data: {
                        requestId: requestId,
                        results: filteredResults.map(item => ({
                            display_name: item.display_name,
                            lat: item.lat,
                            lon: item.lon
                        }))
                    }
                }, '*');
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
    if (event.data.data && event.data.data.lat && event.data.data.lng) {
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