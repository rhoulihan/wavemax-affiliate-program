<script>
/**
 * Parent-Iframe Communication Bridge - Complete Inline Version
 * This is the COMPLETE script that should REPLACE the current script on wavemaxlaundry.com
 * It includes BOTH iframe setup AND mobile hiding functionality
 */

// First, handle the iframe setup (like their current script)
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    let iframeSrc = 'https://wavemax.promo/embed-app-v2.html';
    if (urlParams.toString()) {
        iframeSrc += '?' + urlParams.toString();
    }
    const iframe = document.getElementById('wavemax-iframe');
    if (iframe) {
        iframe.src = iframeSrc;
    }
})();

// Then add the mobile bridge functionality

(function() {
    'use strict';

    // Configuration
    const MOBILE_BREAKPOINT = 768;
    const TABLET_BREAKPOINT = 1024;
    const ALLOWED_ORIGINS = [
        'https://affiliate.wavemax.promo',
        'http://affiliate.wavemax.promo',
        'https://wavemax.promo',
        'http://wavemax.promo',
        'http://localhost:3000'
    ];

    // State management
    let isMobile = false;
    let isTablet = false;
    let chromeHidden = false;
    let lastScrollPosition = 0;
    let iframe = null;
    let lastIframeHeight = 0;
    let isEmbedPage = true; // Always treat as embed page

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Also try to initialize after window load (for iframe readiness)
    window.addEventListener('load', function() {
        if (!iframe) {
            console.log('[Parent-Iframe Bridge] Retrying initialization after window load');
            init();
        }
    });

    function init() {
        console.log('[Parent-Iframe Bridge] Initializing...');
        console.log('[Parent-Iframe Bridge] Current URL:', window.location.href);
        console.log('[Parent-Iframe Bridge] Viewport width:', window.innerWidth);
        
        // Find the iframe - updated to match their iframe ID
        iframe = document.getElementById('wavemax-iframe') ||
                 document.querySelector('iframe[src*="wavemax.promo"]') || 
                 document.querySelector('iframe#wavemax-affiliate-iframe');
        
        if (!iframe) {
            console.warn('[Parent-Iframe Bridge] No WaveMAX iframe found');
            console.log('[Parent-Iframe Bridge] Available iframes:', document.querySelectorAll('iframe'));
            return;
        }
        
        console.log('[Parent-Iframe Bridge] Found iframe:', iframe.id, iframe.src);
        
        // Remove padding and borders from iframe container for all embedded content
        removeContainerPaddingAndBorders();

        // Set up viewport detection
        detectViewport();
        window.addEventListener('resize', debounce(detectViewport, 250));
        window.addEventListener('orientationchange', detectViewport);
        
        // Don't hide chrome on init - let the iframe decide when to hide it
        // Chrome will only be hidden when explicitly requested by the iframe
        // after operator authentication
        console.log('[Parent-Iframe Bridge] Initialized, chrome visible by default');

        // Set up message listener
        window.addEventListener('message', handleMessage);

        // Set up language selector and monitoring
        setupLanguageSelector();
        setupLanguageMonitoring();

        // Send initial viewport info to iframe
        sendViewportInfo();
        
        // Send viewport info multiple times to ensure iframe receives it
        setTimeout(() => sendViewportInfo(), 500);
        setTimeout(() => sendViewportInfo(), 1000);
        setTimeout(() => sendViewportInfo(), 2000);
        
        // Removed periodic chrome hiding - let iframe control when to hide chrome
        
        // Set up a global mutation observer to catch any DOM changes
        setupGlobalObserver();
        
        console.log('[Parent-Iframe Bridge] Initialized successfully');
    }
    
    function setupGlobalObserver() {
        console.log('[Parent-Iframe Bridge] Setting up global mutation observer');
        
        const observer = new MutationObserver((mutations) => {
            let needsHiding = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if any chrome elements were added
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && (
                            node.matches && (
                                node.matches('header, nav, footer, .header, .navbar, .page-header') ||
                                node.querySelector('header, nav, footer, .header, .navbar, .page-header')
                            )
                        )) {
                            needsHiding = true;
                        }
                    });
                } else if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    // Check if any hidden element was shown
                    if (mutation.target.hasAttribute('data-permanently-hidden') || 
                        mutation.target.hasAttribute('data-embed-hidden')) {
                        const display = window.getComputedStyle(mutation.target).display;
                        if (display !== 'none') {
                            needsHiding = true;
                        }
                    }
                }
            });
            
            if (needsHiding) {
                console.log('[Parent-Iframe Bridge] Global observer detected changes, but not auto-hiding chrome');
                // Removed automatic chrome hiding - let iframe control when to hide chrome
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    function hidePageHeader() {
        // Find and hide the specific page header element
        const pageHeader = document.querySelector('section.page-header.page-header-modern.bg-color-light-scale-1.page-header-sm');
        if (pageHeader) {
            console.log('[Parent-Iframe Bridge] Hiding page header element');
            pageHeader.style.setProperty('display', 'none', 'important');
            pageHeader.setAttribute('data-permanently-hidden', 'true');
            pageHeader.setAttribute('data-operator-hidden', 'true');
            
            // Set up mutation observer to keep it hidden
            if (!pageHeader.hasAttribute('data-observer-attached')) {
                pageHeader.setAttribute('data-observer-attached', 'true');
                
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            const currentDisplay = pageHeader.style.display;
                            if (currentDisplay !== 'none') {
                                console.log('[Parent-Iframe Bridge] Page header was shown, hiding it again');
                                pageHeader.style.setProperty('display', 'none', 'important');
                            }
                        }
                    });
                });
                
                observer.observe(pageHeader, {
                    attributes: true,
                    attributeFilter: ['style']
                });
            }
        } else {
            console.log('[Parent-Iframe Bridge] Page header element not found');
        }
    }
    
    function hideAllPageChrome() {
        console.log('[Parent-Iframe Bridge] Hiding all page chrome elements');
        
        // List of selectors for all page chrome elements
        const chromeSelectors = [
            'header', 
            'nav', 
            'footer',
            '.header',
            '.navbar',
            '.navigation',
            '.top-bar',
            '.topbar',
            '.middlebar',
            '.footer',
            '.site-footer',
            '.page-header',
            '.breadcrumb',
            '.breadcrumbs',
            'section.page-header'
        ];
        
        chromeSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Skip if element contains the iframe
                if (element.contains(iframe)) return;
                
                element.style.setProperty('display', 'none', 'important');
                element.setAttribute('data-embed-hidden', 'true');
                element.setAttribute('data-permanently-hidden', 'true');
            });
        });
    }
    
    function removeContainerPaddingAndBorders() {
        console.log('[Parent-Iframe Bridge] Removing container padding and borders for all embedded content');
        
        // Style the iframe itself
        if (iframe) {
            iframe.style.cssText += `
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                display: block !important;
            `;
            
            // Walk up the DOM tree from iframe to remove padding, but only within reason
            let currentElement = iframe.parentElement;
            let levelsUp = 0;
            const maxLevels = 5; // Only go up 5 levels max
            
            while (currentElement && levelsUp < maxLevels) {
                // Check if this element has padding or is a container
                const computedStyle = window.getComputedStyle(currentElement);
                const hasHorizontalPadding = parseFloat(computedStyle.paddingLeft) > 0 || parseFloat(computedStyle.paddingRight) > 0;
                const isContainer = currentElement.classList.contains('container') || 
                                  currentElement.classList.contains('container-fluid') ||
                                  currentElement.classList.contains('container-lg') ||
                                  currentElement.classList.contains('container-xl');
                
                // Only modify if it has padding or is a Bootstrap container
                if (hasHorizontalPadding || isContainer) {
                    currentElement.style.cssText += `
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                    `;
                    console.log('[Parent-Iframe Bridge] Removed padding from element:', currentElement.className || currentElement.tagName);
                }
                
                // Stop if we hit the main content area or body
                if (currentElement.tagName === 'BODY' || 
                    currentElement.classList.contains('main') ||
                    currentElement.id === 'main') {
                    break;
                }
                
                currentElement = currentElement.parentElement;
                levelsUp++;
            }
        }
        
        // Inject targeted CSS for common Bootstrap containers and Porto theme elements
        const styleTag = document.createElement('style');
        styleTag.id = 'wavemax-iframe-overrides';
        styleTag.innerHTML = `
            /* Ensure permanently hidden elements stay hidden */
            [data-permanently-hidden="true"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                width: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
            }
            
            /* Hide embed-hidden elements */
            [data-embed-hidden="true"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* Removed automatic hiding of page headers and chrome elements */
            /* Chrome hiding should only happen via explicit hide-chrome message */
            /* Target the iframe */
            #wavemax-iframe {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                display: block !important;
            }
            
            /* Target containers that contain our iframe - more specific selectors */
            #wavemax-iframe,
            *:has(> #wavemax-iframe) {
                max-width: 100% !important;
                width: 100% !important;
            }
            
            /* Remove padding from any parent containers up to 3 levels */
            *:has(> #wavemax-iframe),
            *:has(> *:has(> #wavemax-iframe)),
            *:has(> *:has(> *:has(> #wavemax-iframe))) {
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
            
            /* Target common Bootstrap container classes when they contain our iframe */
            .container:has(#wavemax-iframe),
            .container-fluid:has(#wavemax-iframe),
            .container-lg:has(#wavemax-iframe),
            .container-xl:has(#wavemax-iframe),
            .container-xxl:has(#wavemax-iframe) {
                max-width: 100% !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
            }
            
            /* Porto theme specific - target their content wrapper */
            .page-wrapper:has(#wavemax-iframe) .main,
            .page-wrapper:has(#wavemax-iframe) .main .container,
            .page-wrapper:has(#wavemax-iframe) .main .container-fluid {
                max-width: 100% !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
            
            /* Remove padding from row elements that might contain our iframe */
            .row:has(#wavemax-iframe) {
                margin-left: 0 !important;
                margin-right: 0 !important;
            }
            
            .row:has(#wavemax-iframe) > [class*="col-"] {
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
        `;
        document.head.appendChild(styleTag);
        console.log('[Parent-Iframe Bridge] Injected targeted override styles');
    }

    function detectViewport() {
        const width = window.innerWidth;
        const oldMobile = isMobile;
        const oldTablet = isTablet;

        isMobile = width < MOBILE_BREAKPOINT;
        isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
        
        console.log('[Parent-Iframe Bridge] Viewport detected:', {
            width: width,
            isMobile: isMobile,
            isTablet: isTablet,
            isDesktop: !isMobile && !isTablet
        });

        // If viewport category changed, update iframe
        if (oldMobile !== isMobile || oldTablet !== isTablet) {
            console.log('[Parent-Iframe Bridge] Viewport category changed, sending update');
            sendViewportInfo();
        }
        
        // Don't automatically hide chrome on viewport changes
        // Let the iframe decide if chrome should be hidden based on operator auth status
        console.log('[Parent-Iframe Bridge] Viewport changed, current chrome state:', chromeHidden ? 'hidden' : 'visible');
    }

    function sendViewportInfo() {
        if (!iframe) {
            console.log('[Parent-Iframe Bridge] sendViewportInfo: No iframe found');
            return;
        }

        // Get current language from localStorage or default
        const currentLanguage = localStorage.getItem('wavemax-language') || 'en';

        const info = {
            type: 'viewport-info',
            data: {
                width: window.innerWidth,
                height: window.innerHeight,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: !isMobile && !isTablet,
                hasTouch: 'ontouchstart' in window,
                orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
                language: currentLanguage
            }
        };
        
        console.log('[Parent-Iframe Bridge] Sending viewport info:', info.data);

        // Try to send to iframe
        try {
            iframe.contentWindow.postMessage(info, '*');
            console.log('[Parent-Iframe Bridge] Viewport info sent successfully');
        } catch (e) {
            console.error('[Parent-Iframe Bridge] Failed to send viewport info:', e);
        }
    }

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
                // Hide chrome when explicitly requested by iframe (e.g., after operator login)
                console.log('[Parent-Iframe Bridge] Hiding chrome as requested by iframe');
                hideChrome();
                break;
                
            case 'show-chrome':
                console.log('[Parent-Iframe Bridge] Show chrome requested');
                // Show chrome when explicitly requested by iframe (e.g., after operator logout)
                console.log('[Parent-Iframe Bridge] Showing chrome as requested by iframe');
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
                const route = event.data.data && event.data.data.route ? event.data.data.route : '/';
                console.log('[Parent-Iframe Bridge] Route changed to:', route, 'chromeHidden:', chromeHidden, 'isMobile:', isMobile);
                
                // Store current route for future reference
                window.currentEmbedRoute = route;
                
                // Don't automatically hide chrome on route changes
                // Let the iframe decide if chrome should be hidden based on operator auth status
                console.log('[Parent-Iframe Bridge] Route changed, current chrome state:', chromeHidden ? 'hidden' : 'visible');
                break;
                
            // GEOCODING CASES
            case 'geocode-forward':
                console.log('[Parent-Iframe Bridge] Forward geocoding requested:', event.data.data);
                if (event.data.data && event.data.data.query && iframe) {
                    const { query, requestId } = event.data.data;
                    
                    // Helper function to parse natural address format
                    function parseAddress(input) {
                        const trimmed = input.trim();
                        
                        // Remove any commas the user might have typed
                        const cleaned = trimmed.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
                        
                        // Don't require street pattern - let Nominatim handle various formats
                        // This allows for partial addresses, landmarks, etc.
                        if (cleaned.length < 3) {
                            return null; // Too short to be meaningful
                        }
                        
                        // Return the cleaned query
                        return cleaned;
                    }
                    
                    // Parse the address
                    const searchQuery = parseAddress(query);
                    console.log('[Parent-Iframe Bridge] Parsed query:', query, ' => ', searchQuery);
                    
                    if (!searchQuery) {
                        console.log('[Parent-Iframe Bridge] Query did not pass validation, returning empty results');
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
                    // Use bounded=0 to prefer results within viewbox but allow results outside if needed
                    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&accept-language=en&viewbox=${AUSTIN_BOUNDS.minLon},${AUSTIN_BOUNDS.minLat},${AUSTIN_BOUNDS.maxLon},${AUSTIN_BOUNDS.maxLat}&bounded=0&countrycodes=us`;
                    console.log('[Parent-Iframe Bridge] Geocoding URL:', geocodeUrl);
                    
                    fetch(geocodeUrl)
                        .then(response => response.json())
                        .then(results => {
                            console.log('[Parent-Iframe Bridge] Raw geocoding results:', results);
                            // Helper function to format address in natural format
                            function formatNaturalAddress(displayName) {
                                // Nominatim returns various formats, we need to extract the key parts
                                const parts = displayName.split(',').map(p => p.trim());
                                if (parts.length < 2) return displayName;
                                
                                let street = '';
                                let city = '';
                                let state = '';
                                let zip = '';
                                
                                // Common Austin area cities
                                const austinCities = ['Austin', 'Round Rock', 'Cedar Park', 'Pflugerville', 'Georgetown', 
                                                     'Leander', 'Hutto', 'Manor', 'Buda', 'Kyle', 'Dripping Springs'];
                                
                                // Look through all parts to identify components
                                let streetParts = [];
                                
                                for (let i = 0; i < parts.length; i++) {
                                    const part = parts[i];
                                    
                                    // Check for zip code
                                    if (/^\d{5}$/.test(part)) {
                                        zip = part;
                                    }
                                    // Check for state
                                    else if (part === 'Texas' || part === 'TX') {
                                        state = 'TX';
                                    }
                                    // Check for known cities
                                    else if (austinCities.some(c => part === c || part.includes(c))) {
                                        city = austinCities.find(c => part === c || part.includes(c));
                                    }
                                    // Skip country and county
                                    else if (part === 'United States' || part === 'USA' || 
                                             part.includes('County') || part === 'US') {
                                        continue;
                                    }
                                    // If it's before we found a city and contains numbers or looks like a street
                                    else if (!city && (
                                        /\d/.test(part) || // Contains any number
                                        /^(North|South|East|West|N|S|E|W)\s/i.test(part) || // Directional prefix
                                        /(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Circle|Cir|Court|Ct|Place|Pl|Trail|Trl|Parkway|Pkwy|Way)\b/i.test(part) // Street suffix
                                    )) {
                                        streetParts.push(part);
                                    }
                                }
                                
                                // Combine street parts
                                if (streetParts.length > 0) {
                                    street = streetParts.join(' ');
                                    // Clean up street format
                                    street = street.replace(/\s+/g, ' ').trim();
                                }
                                
                                // If no street found but first part has a number, use first few parts
                                if (!street && /\d/.test(parts[0])) {
                                    // Take parts until we hit a city or state
                                    for (let i = 0; i < Math.min(3, parts.length); i++) {
                                        if (austinCities.some(c => parts[i].includes(c)) || 
                                            parts[i] === 'Texas' || parts[i] === 'TX') {
                                            break;
                                        }
                                        if (!/County|United States|USA/.test(parts[i])) {
                                            street += (street ? ' ' : '') + parts[i];
                                        }
                                    }
                                }
                                
                                // If still no street, check if this is a landmark/business result
                                if (!street && parts[0]) {
                                    // Use the first part as the name if it's not a city
                                    if (!austinCities.some(c => parts[0].includes(c))) {
                                        street = parts[0];
                                    }
                                }
                                
                                // Default city and state if not found
                                if (!city && !street.includes('Austin')) city = 'Austin';
                                if (!state) state = 'TX';
                                
                                // Build natural format
                                let formatted = street || 'Austin area';
                                if (city && street) formatted += ', ' + city;
                                if (state) formatted += ', ' + state;
                                if (zip) formatted += ' ' + zip;
                                
                                return formatted;
                            }
                            
                            // Filter results to ensure they're within bounds
                            const filteredResults = results.filter(item => {
                                const lat = parseFloat(item.lat);
                                const lon = parseFloat(item.lon);
                                const inBounds = lat >= AUSTIN_BOUNDS.minLat && lat <= AUSTIN_BOUNDS.maxLat &&
                                       lon >= AUSTIN_BOUNDS.minLon && lon <= AUSTIN_BOUNDS.maxLon;
                                if (!inBounds) {
                                    console.log('[Parent-Iframe Bridge] Filtered out result outside bounds:', item.display_name, 'lat:', lat, 'lon:', lon);
                                }
                                return inBounds;
                            });
                            console.log('[Parent-Iframe Bridge] Filtered results:', filteredResults);
                            
                            // Send filtered results back to iframe with formatted addresses
                            const formattedResults = filteredResults.map(item => {
                                console.log('[Parent-Iframe Bridge] Original display_name:', item.display_name);
                                const formatted = formatNaturalAddress(item.display_name);
                                console.log('[Parent-Iframe Bridge] Formatted display_name:', formatted);
                                return {
                                    display_name: formatted,
                                    lat: item.lat,
                                    lon: item.lon
                                };
                            });
                            
                            iframe.contentWindow.postMessage({
                                type: 'geocode-forward-response',
                                data: {
                                    requestId: requestId,
                                    results: formattedResults
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

    function hideChrome() {
        if (chromeHidden) {
            console.log('[Parent-Iframe Bridge] hideChrome: Already hidden, skipping');
            return;
        }

        console.log('[Parent-Iframe Bridge] hideChrome: Starting to hide all page elements except iframe');
        
        // Store scroll position
        lastScrollPosition = window.pageYOffset;

        // First, hide specific known elements that might not be direct children
        const elementsToHide = [
            '.navbar', '.topbar', '.middlebar', '.footer', '.page-header',
            'nav', 'header', 'footer', '.wrapper', '.page-wrapper'
        ];
        
        let hiddenCount = 0;
        
        // Hide specific elements first
        elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Skip if this element contains the iframe
                if (element === iframe || element.contains(iframe)) {
                    return;
                }
                
                // Skip if already hidden or permanently hidden
                if (element.style.display === 'none' || 
                    window.getComputedStyle(element).display === 'none' ||
                    element.hasAttribute('data-operator-hidden') ||
                    element.hasAttribute('data-permanently-hidden')) {
                    return;
                }
                
                // Store original display value
                const originalDisplay = window.getComputedStyle(element).display;
                element.setAttribute('data-operator-hidden', 'true');
                element.setAttribute('data-original-display', element.style.display || '');
                element.setAttribute('data-original-computed-display', originalDisplay);
                
                // Force hide with important
                element.style.setProperty('display', 'none', 'important');
                hiddenCount++;
                console.log('[Parent-Iframe Bridge] Hiding specific element:', element.tagName, element.className || element.id || '(no class/id)');
            });
        });
        
        // Then hide ALL direct children of body except the iframe and its container
        const bodyChildren = document.body.children;
        
        for (let i = 0; i < bodyChildren.length; i++) {
            const element = bodyChildren[i];
            
            // Skip if this is the iframe or contains the iframe
            if (element === iframe || element.contains(iframe)) {
                console.log('[Parent-Iframe Bridge] Skipping element that contains iframe:', element.tagName, element.className);
                continue;
            }
            
            // Skip if it's a script or style tag
            if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
                continue;
            }
            
            // Skip if already hidden, marked as hidden, or permanently hidden
            if (element.style.display === 'none' || 
                window.getComputedStyle(element).display === 'none' ||
                element.hasAttribute('data-operator-hidden') ||
                element.hasAttribute('data-permanently-hidden')) {
                continue;
            }
            
            // Store original display value
            const originalDisplay = window.getComputedStyle(element).display;
            element.setAttribute('data-operator-hidden', 'true');
            element.setAttribute('data-original-display', element.style.display || '');
            element.setAttribute('data-original-computed-display', originalDisplay);
            
            // Force hide with important
            element.style.setProperty('display', 'none', 'important');
            hiddenCount++;
            console.log('[Parent-Iframe Bridge] Hiding body child:', element.tagName, element.className || element.id || '(no class/id)');
        }
        
        console.log('[Parent-Iframe Bridge] Hidden', hiddenCount, 'elements');
        
        // Inject a style tag to ensure everything stays hidden
        const hideStyle = document.createElement('style');
        hideStyle.id = 'operator-hide-chrome-styles';
        hideStyle.innerHTML = `
            [data-operator-hidden="true"] {
                display: none !important;
            }
            [data-permanently-hidden="true"] {
                display: none !important;
            }
            body.operator-mode > *:not(script):not(style):not(:has(#wavemax-iframe)) {
                display: none !important;
            }
            body.operator-mode .wrapper,
            body.operator-mode .navbar,
            body.operator-mode .topbar,
            body.operator-mode .middlebar,
            body.operator-mode .footer,
            body.operator-mode .page-header,
            body.operator-mode nav,
            body.operator-mode header,
            body.operator-mode footer {
                display: none !important;
            }
        `;
        document.head.appendChild(hideStyle);
        document.body.classList.add('operator-mode');

        // Adjust iframe container to full viewport
        if (iframe) {
            // Find all parent containers up to body
            let currentElement = iframe;
            while (currentElement && currentElement !== document.body) {
                // Remove any padding/margin from containers
                if (currentElement.style) {
                    currentElement.setAttribute('data-operator-original-padding', JSON.stringify({
                        paddingTop: currentElement.style.paddingTop || '',
                        paddingBottom: currentElement.style.paddingBottom || '',
                        paddingLeft: currentElement.style.paddingLeft || '',
                        paddingRight: currentElement.style.paddingRight || '',
                        marginTop: currentElement.style.marginTop || '',
                        marginBottom: currentElement.style.marginBottom || '',
                        marginLeft: currentElement.style.marginLeft || '',
                        marginRight: currentElement.style.marginRight || '',
                        minHeight: currentElement.style.minHeight || ''
                    }));
                    
                    currentElement.style.padding = '0';
                    currentElement.style.margin = '0';
                    currentElement.style.minHeight = '100vh';
                    currentElement.style.width = '100%';
                    currentElement.style.maxWidth = '100%';
                }
                currentElement = currentElement.parentElement;
            }
            
            // Make iframe full viewport
            iframe.style.minHeight = '100vh';
            iframe.style.width = '100%';
            iframe.style.maxWidth = '100%';
            iframe.style.margin = '0';
            iframe.style.padding = '0';
            iframe.style.border = 'none';
        }
        
        // Also set body to remove any padding/margin
        document.body.setAttribute('data-operator-original-body-style', JSON.stringify({
            paddingTop: document.body.style.paddingTop || '',
            paddingBottom: document.body.style.paddingBottom || '',
            paddingLeft: document.body.style.paddingLeft || '',
            paddingRight: document.body.style.paddingRight || '',
            marginTop: document.body.style.marginTop || '',
            marginBottom: document.body.style.marginBottom || '',
            marginLeft: document.body.style.marginLeft || '',
            marginRight: document.body.style.marginRight || ''
        }));
        
        document.body.style.padding = '0';
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden'; // Prevent scrolling on parent

        chromeHidden = true;

        // Notify iframe that chrome is hidden
        setTimeout(() => {
            if (iframe) {
                iframe.contentWindow.postMessage({
                    type: 'chrome-hidden',
                    data: { hidden: true }
                }, '*');
            }
        }, 350);
    }

    function showChrome() {
        if (!chromeHidden) {
            console.log('[Parent-Iframe Bridge] showChrome: Already shown, skipping');
            return;
        }
        
        console.log('[Parent-Iframe Bridge] showChrome: Restoring page elements');
        
        // Restore all hidden elements EXCEPT permanently hidden ones
        const hiddenElements = document.querySelectorAll('[data-operator-hidden="true"]');
        let restoredCount = 0;
        let skippedCount = 0;
        
        hiddenElements.forEach(element => {
            // Skip permanently hidden elements
            if (element.hasAttribute('data-permanently-hidden')) {
                console.log('[Parent-Iframe Bridge] Skipping permanently hidden element:', element.tagName, element.className || element.id || '(no class/id)');
                skippedCount++;
                return;
            }
            
            const originalDisplay = element.getAttribute('data-original-display') || '';
            const originalComputedDisplay = element.getAttribute('data-original-computed-display') || '';
            
            // Remove the important display none
            element.style.removeProperty('display');
            
            // Restore original inline display if there was one
            if (originalDisplay) {
                element.style.display = originalDisplay;
            }
            
            element.removeAttribute('data-operator-hidden');
            element.removeAttribute('data-original-display');
            element.removeAttribute('data-original-computed-display');
            restoredCount++;
            console.log('[Parent-Iframe Bridge] Restoring element:', element.tagName, element.className || element.id || '(no class/id)');
        });
        
        console.log('[Parent-Iframe Bridge] Restored', restoredCount, 'elements, skipped', skippedCount, 'permanently hidden');
        
        // Remove the operator mode class and style tag
        document.body.classList.remove('operator-mode');
        const hideStyle = document.getElementById('operator-hide-chrome-styles');
        if (hideStyle) {
            hideStyle.remove();
        }
        
        // Restore iframe container styles
        if (iframe) {
            // Restore all parent containers
            let currentElement = iframe;
            while (currentElement && currentElement !== document.body) {
                const originalPadding = currentElement.getAttribute('data-operator-original-padding');
                if (originalPadding) {
                    try {
                        const styles = JSON.parse(originalPadding);
                        currentElement.style.paddingTop = styles.paddingTop;
                        currentElement.style.paddingBottom = styles.paddingBottom;
                        currentElement.style.paddingLeft = styles.paddingLeft;
                        currentElement.style.paddingRight = styles.paddingRight;
                        currentElement.style.marginTop = styles.marginTop;
                        currentElement.style.marginBottom = styles.marginBottom;
                        currentElement.style.marginLeft = styles.marginLeft;
                        currentElement.style.marginRight = styles.marginRight;
                        currentElement.style.minHeight = styles.minHeight;
                        currentElement.removeAttribute('data-operator-original-padding');
                    } catch (e) {
                        console.error('[Parent-Iframe Bridge] Error restoring container styles:', e);
                    }
                }
                currentElement = currentElement.parentElement;
            }
            
            // Reset iframe styles
            iframe.style.minHeight = '';
        }
        
        // Restore body styles
        const originalBodyStyle = document.body.getAttribute('data-operator-original-body-style');
        if (originalBodyStyle) {
            try {
                const styles = JSON.parse(originalBodyStyle);
                document.body.style.paddingTop = styles.paddingTop;
                document.body.style.paddingBottom = styles.paddingBottom;
                document.body.style.paddingLeft = styles.paddingLeft;
                document.body.style.paddingRight = styles.paddingRight;
                document.body.style.marginTop = styles.marginTop;
                document.body.style.marginBottom = styles.marginBottom;
                document.body.style.marginLeft = styles.marginLeft;
                document.body.style.marginRight = styles.marginRight;
                document.body.removeAttribute('data-operator-original-body-style');
            } catch (e) {
                console.error('[Parent-Iframe Bridge] Error restoring body styles:', e);
            }
        }
        
        document.body.style.overflow = ''; // Restore scrolling

        chromeHidden = false;

        // Notify iframe that chrome is visible
        setTimeout(() => {
            if (iframe) {
                iframe.contentWindow.postMessage({
                    type: 'chrome-hidden',
                    data: { hidden: false }
                }, '*');
            }
        }, 350);
    }

    function resizeIframe(height) {
        if (!iframe) return;
        
        // Don't add padding here - the iframe already includes padding
        const newHeight = parseInt(height);
        
        // Only update if height actually changed (with 5px tolerance)
        if (Math.abs(newHeight - lastIframeHeight) > 5) {
            console.log('[Parent-Iframe Bridge] Setting iframe height to:', newHeight, '(was:', lastIframeHeight, ')');
            lastIframeHeight = newHeight;
            iframe.style.height = newHeight + 'px';
        } else {
            console.log('[Parent-Iframe Bridge] Ignoring resize - height unchanged');
        }
        
        // If in mobile mode with hidden chrome, ensure minimum viewport height
        if (chromeHidden && (isMobile || isTablet)) {
            iframe.style.minHeight = '100vh';
        }
    }

    function smoothScrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // Utility function for debouncing
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function setupLanguageSelector() {
        console.log('[Parent-Iframe Bridge] Setting up language selector integration');
        
        // Wait a bit for the page's language selector to be ready
        setTimeout(() => {
            // Find the dropdown list
            const dropdownList = document.querySelector('.dropdown-cs');
            
            if (dropdownList) {
                console.log('[Parent-Iframe Bridge] Found Google Translate dropdown:', dropdownList);
                
                // Fix dropdown positioning and ensure it's not cut off
                dropdownList.style.cssText += `
                    position: absolute !important;
                    z-index: 9999 !important;
                    min-width: 120px !important;
                    overflow: visible !important;
                `;
                
                // Standardize size for all existing flag images
                const existingImages = dropdownList.querySelectorAll('img');
                existingImages.forEach(img => {
                    img.style.width = '24px';
                    img.style.height = 'auto';
                    img.style.display = 'inline-block';
                    img.style.verticalAlign = 'middle';
                });
                
                // Check existing language options
                const existingItems = dropdownList.querySelectorAll('li');
                const hasPortuguese = Array.from(existingItems).some(item => {
                    const onclick = item.querySelector('img')?.getAttribute('onclick') || '';
                    return onclick.includes('|pt');
                });
                const hasGerman = Array.from(existingItems).some(item => {
                    const onclick = item.querySelector('img')?.getAttribute('onclick') || '';
                    return onclick.includes('|de');
                });
                
                // Add Portuguese if not present
                if (!hasPortuguese) {
                    const ptItem = document.createElement('li');
                    const ptImg = document.createElement('img');
                    
                    // Try multiple sources for the Brazil flag
                    const brazilFlagSources = [
                        '/assets/WaveMax/images/brazil.png',
                        'https://flagcdn.com/24x18/br.png',
                        'https://www.countryflags.io/br/flat/32.png',
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14"%3E%3Crect width="20" height="14" fill="%23009b3a"/%3E%3Cpath d="M10 2L2 7l8 5 8-5z" fill="%23fedf00"/%3E%3Ccircle cx="10" cy="7" r="2.5" fill="%23002776"/%3E%3C/svg%3E'
                    ];
                    
                    // Set initial source
                    ptImg.src = brazilFlagSources[0];
                    
                    // Handle image load error by trying alternative sources
                    let sourceIndex = 0;
                    ptImg.onerror = function() {
                        sourceIndex++;
                        if (sourceIndex < brazilFlagSources.length) {
                            this.src = brazilFlagSources[sourceIndex];
                        }
                    };
                    
                    ptImg.alt = 'Portuguese';
                    ptImg.setAttribute('onclick', "doGTranslate('en|pt');FixBodyTop();return false;");
                    ptImg.style.cursor = 'pointer';
                    ptImg.style.width = '24px';
                    ptImg.style.height = 'auto';
                    ptItem.appendChild(ptImg);
                    dropdownList.appendChild(ptItem);
                    console.log('[Parent-Iframe Bridge] Added Portuguese option');
                }
                
                // Add German if not present
                if (!hasGerman) {
                    const deItem = document.createElement('li');
                    const deImg = document.createElement('img');
                    
                    // Try multiple sources for the German flag
                    const germanFlagSources = [
                        '/assets/WaveMax/images/germany.png',
                        'https://flagcdn.com/24x18/de.png',
                        'https://www.countryflags.io/de/flat/32.png',
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14"%3E%3Crect width="20" height="4.67" fill="%23000"/%3E%3Crect y="4.67" width="20" height="4.67" fill="%23d00"/%3E%3Crect y="9.33" width="20" height="4.67" fill="%23ffce00"/%3E%3C/svg%3E'
                    ];
                    
                    // Set initial source
                    deImg.src = germanFlagSources[0];
                    
                    // Handle image load error by trying alternative sources
                    let sourceIndex = 0;
                    deImg.onerror = function() {
                        sourceIndex++;
                        if (sourceIndex < germanFlagSources.length) {
                            this.src = germanFlagSources[sourceIndex];
                        }
                    };
                    
                    deImg.alt = 'German';
                    deImg.setAttribute('onclick', "doGTranslate('en|de');FixBodyTop();return false;");
                    deImg.style.cursor = 'pointer';
                    deImg.style.width = '24px';
                    deImg.style.height = 'auto';
                    deItem.appendChild(deImg);
                    dropdownList.appendChild(deItem);
                    console.log('[Parent-Iframe Bridge] Added German option');
                }
                
                // Hook into the doGTranslate function to capture language changes
                const originalDoGTranslate = window.doGTranslate;
                if (originalDoGTranslate) {
                    window.doGTranslate = function(pair) {
                        // Call the original function
                        originalDoGTranslate(pair);
                        
                        // Extract the target language from the pair (e.g., 'en|es' -> 'es')
                        const targetLang = pair.split('|')[1];
                        if (targetLang) {
                            console.log('[Parent-Iframe Bridge] Google Translate language changed to:', targetLang);
                            
                            // Update the main flag display
                            updateMainFlagDisplay(targetLang);
                            
                            // Save to localStorage
                            localStorage.setItem('wavemax-language', targetLang);
                            
                            // Send language change to iframe
                            sendLanguageChange(targetLang);
                            
                            // Dispatch custom event
                            window.dispatchEvent(new CustomEvent('languageChanged', {
                                detail: { language: targetLang }
                            }));
                        }
                    };
                    console.log('[Parent-Iframe Bridge] Successfully hooked into doGTranslate');
                }
                
                // Function to update the main flag display
                function updateMainFlagDisplay(lang) {
                    // Use a slight delay to ensure it happens after Google Translate updates
                    setTimeout(() => {
                        const mainFlag = document.querySelector('.imgTranslation');
                        if (mainFlag) {
                            let flagSrc;
                            switch(lang) {
                                case 'en':
                                    flagSrc = '/assets/WaveMax/images/country.png';
                                    break;
                                case 'es':
                                    flagSrc = '/assets/WaveMax/images/mexico.png';
                                    break;
                                case 'pt':
                                    // Use CDN directly since local file doesn't exist
                                    flagSrc = 'https://flagcdn.com/24x18/br.png';
                                    break;
                                case 'de':
                                    // Use CDN directly since local file doesn't exist
                                    flagSrc = 'https://flagcdn.com/24x18/de.png';
                                    break;
                                default:
                                    flagSrc = '/assets/WaveMax/images/country.png';
                            }
                            
                            // Add data attribute to track which language is set
                            mainFlag.setAttribute('data-lang', lang);
                            
                            // Update the flag
                            mainFlag.src = flagSrc;
                            
                            console.log('[Parent-Iframe Bridge] Updated main flag display for language:', lang);
                        }
                    }, 100);
                }
                
                // Monitor for flag changes and reapply if needed
                function monitorFlagChanges() {
                    const observer = new MutationObserver((mutations) => {
                        const mainFlag = document.querySelector('.imgTranslation');
                        if (mainFlag) {
                            const currentLang = localStorage.getItem('wavemax-language') || 'en';
                            const flagLang = mainFlag.getAttribute('data-lang');
                            
                            // If the flag doesn't match our saved language, update it
                            if (flagLang !== currentLang) {
                                console.log('[Parent-Iframe Bridge] Flag language mismatch detected, correcting...');
                                updateMainFlagDisplay(currentLang);
                            }
                        }
                    });
                    
                    // Observe changes to the flag element attributes
                    const flagElement = document.querySelector('.imgTranslation');
                    if (flagElement) {
                        observer.observe(flagElement, {
                            attributes: true,
                            attributeFilter: ['data-lang'] // Only watch for language changes, not src
                        });
                    }
                    
                    // Also observe the parent container for any replacements
                    const container = document.querySelector('.dropdown-toggle-cs');
                    if (container) {
                        observer.observe(container, {
                            childList: true,
                            subtree: true
                        });
                    }
                }
                
                // Start monitoring after setup
                setTimeout(monitorFlagChanges, 1000);
                
                // Also add click listeners to the images for extra safety
                dropdownList.querySelectorAll('img').forEach(img => {
                    img.addEventListener('click', function() {
                        const onclick = this.getAttribute('onclick') || '';
                        const match = onclick.match(/doGTranslate\('en\|(\w+)'\)/);
                        if (match && match[1]) {
                            const lang = match[1];
                            console.log('[Parent-Iframe Bridge] Language clicked:', lang);
                            
                            // Update flag once after a small delay
                            setTimeout(() => updateMainFlagDisplay(lang), 200);
                            
                            setTimeout(() => {
                                // Save to localStorage
                                localStorage.setItem('wavemax-language', lang);
                                
                                // Send language change to iframe
                                sendLanguageChange(lang);
                            }, 100); // Small delay to let Google Translate process
                        }
                    });
                });
                
                // Override FixBodyTop if it exists to prevent flag reset
                if (window.FixBodyTop) {
                    const originalFixBodyTop = window.FixBodyTop;
                    window.FixBodyTop = function() {
                        const currentLang = localStorage.getItem('wavemax-language') || 'en';
                        const result = originalFixBodyTop.apply(this, arguments);
                        
                        // Reapply flag after FixBodyTop
                        setTimeout(() => {
                            updateMainFlagDisplay(currentLang);
                        }, 50);
                        
                        return result;
                    };
                    console.log('[Parent-Iframe Bridge] Successfully wrapped FixBodyTop function');
                }
                
                console.log('[Parent-Iframe Bridge] Successfully integrated with Google Translate dropdown');
                
                // Apply saved language to the host page
                const savedLanguage = localStorage.getItem('wavemax-language') || 'en';
                if (savedLanguage !== 'en' && window.doGTranslate) {
                    console.log('[Parent-Iframe Bridge] Applying saved language to host page:', savedLanguage);
                    // Small delay to ensure Google Translate is ready
                    setTimeout(() => {
                        window.doGTranslate(`en|${savedLanguage}`);
                    }, 500);
                }
                
                // Update main flag display for saved language after a delay
                setTimeout(() => {
                    updateMainFlagDisplay(savedLanguage);
                }, 1000);
                
                // Also style the parent container to ensure proper dropdown behavior
                const dropdownContainer = document.querySelector('.country.cs-country');
                if (dropdownContainer) {
                    dropdownContainer.style.position = 'relative';
                    dropdownContainer.style.overflow = 'visible';
                }
                
                // Add visual indicator for current language
                const updateLanguageIndicator = (lang) => {
                    dropdownList.querySelectorAll('li').forEach(item => {
                        const img = item.querySelector('img');
                        if (img) {
                            const onclick = img.getAttribute('onclick') || '';
                            if (onclick.includes(`|${lang}`)) {
                                item.style.backgroundColor = '#e3f2fd';
                                item.style.borderLeft = '3px solid #1976d2';
                            } else {
                                item.style.backgroundColor = '';
                                item.style.borderLeft = '';
                            }
                        }
                    });
                };
                
                // Set initial indicator
                updateLanguageIndicator(savedLanguage);
                
                // Update indicator when language changes
                const originalDoGTranslateWithIndicator = window.doGTranslate;
                window.doGTranslate = function(pair) {
                    originalDoGTranslateWithIndicator.call(this, pair);
                    const targetLang = pair.split('|')[1];
                    if (targetLang) {
                        updateLanguageIndicator(targetLang);
                    }
                };
                
                // Add some styling to make all list items consistent
                const style = document.createElement('style');
                style.textContent = `
                    .dropdown-cs li {
                        padding: 5px 10px !important;
                        cursor: pointer !important;
                        list-style: none !important;
                        transition: all 0.2s ease !important;
                        border-left: 3px solid transparent !important;
                    }
                    .dropdown-cs li:hover {
                        background-color: #f0f0f0 !important;
                    }
                    .dropdown-cs img {
                        width: 24px !important;
                        height: auto !important;
                        display: inline-block !important;
                        vertical-align: middle !important;
                        margin-right: 5px !important;
                    }
                `;
                document.head.appendChild(style);
            } else {
                console.log('[Parent-Iframe Bridge] Google Translate dropdown not found, will try again');
                
                // Try again in case it loads later
                setTimeout(() => {
                    setupLanguageSelector();
                }, 2000);
            }
        }, 500);
    }
    
    function createSimpleLanguageSelector() {
        // Only create if not already exists
        if (document.getElementById('wavemax-simple-language-selector')) {
            return;
        }
        
        console.log('[Parent-Iframe Bridge] Creating simple language selector');
        
        const selector = document.createElement('select');
        selector.id = 'wavemax-simple-language-selector';
        selector.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
        `;
        
        const languages = [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Español' },
            { code: 'pt', name: 'Português' },
            { code: 'de', name: 'Deutsch' }
        ];
        
        const currentLang = localStorage.getItem('wavemax-language') || 'en';
        
        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.textContent = lang.name;
            option.selected = lang.code === currentLang;
            selector.appendChild(option);
        });
        
        selector.addEventListener('change', function(e) {
            const langCode = e.target.value;
            console.log('[Parent-Iframe Bridge] Language changed to:', langCode);
            
            // Save to localStorage
            localStorage.setItem('wavemax-language', langCode);
            
            // Send language change to iframe
            sendLanguageChange(langCode);
            
            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language: langCode }
            }));
        });
        
        document.body.appendChild(selector);
    }
    
    function setupLanguageMonitoring() {
        console.log('[Parent-Iframe Bridge] Setting up language monitoring');
        
        // Monitor localStorage for language changes
        let currentLanguage = localStorage.getItem('wavemax-language') || 'en';
        
        // Check for language changes periodically
        setInterval(() => {
            const newLanguage = localStorage.getItem('wavemax-language') || 'en';
            if (newLanguage !== currentLanguage) {
                currentLanguage = newLanguage;
                console.log('[Parent-Iframe Bridge] Language change detected:', newLanguage);
                sendLanguageChange(newLanguage);
                
                // Update simple selector if it exists
                const simpleSelector = document.getElementById('wavemax-simple-language-selector');
                if (simpleSelector && simpleSelector.value !== newLanguage) {
                    simpleSelector.value = newLanguage;
                }
            }
        }, 500);
        
        // Also listen for storage events (cross-tab changes)
        window.addEventListener('storage', function(e) {
            if (e.key === 'wavemax-language') {
                const newLanguage = e.newValue || 'en';
                console.log('[Parent-Iframe Bridge] Language changed via storage event:', newLanguage);
                sendLanguageChange(newLanguage);
                
                // Update simple selector if it exists
                const simpleSelector = document.getElementById('wavemax-simple-language-selector');
                if (simpleSelector && simpleSelector.value !== newLanguage) {
                    simpleSelector.value = newLanguage;
                }
            }
        });
        
        // Listen for custom language change events
        window.addEventListener('languageChanged', function(e) {
            const language = e.detail?.language || localStorage.getItem('wavemax-language') || 'en';
            console.log('[Parent-Iframe Bridge] Language changed via custom event:', language);
            sendLanguageChange(language);
        });
    }
    
    function sendLanguageChange(language) {
        if (!iframe) {
            console.log('[Parent-Iframe Bridge] sendLanguageChange: No iframe found');
            return;
        }

        const info = {
            type: 'language-change',
            data: {
                language: language
            }
        };

        // Try to send to iframe
        try {
            iframe.contentWindow.postMessage(info, '*');
            console.log('[Parent-Iframe Bridge] Language change sent successfully:', language);
        } catch (e) {
            console.error('[Parent-Iframe Bridge] Failed to send language change:', e);
        }
    }

    // Public API
    window.WaveMaxBridge = {
        hideChrome: hideChrome,
        showChrome: showChrome,
        sendViewportInfo: sendViewportInfo,
        sendLanguageChange: sendLanguageChange,
        getViewportInfo: () => ({
            isMobile: isMobile,
            isTablet: isTablet,
            isDesktop: !isMobile && !isTablet,
            chromeHidden: chromeHidden
        }),
        setLanguage: (language) => {
            localStorage.setItem('wavemax-language', language);
            sendLanguageChange(language);
            // Update existing selector if it exists
            const existingSelector = document.querySelector('select[name="language"]') || 
                                   document.querySelector('select#language') ||
                                   document.querySelector('.language-selector select') ||
                                   document.querySelector('[data-language-selector]') ||
                                   document.querySelector('select[data-switcher-options]');
            if (existingSelector) {
                // Try to find and select the matching option
                const option = Array.from(existingSelector.options).find(opt => 
                    opt.value.toLowerCase().startsWith(language)
                );
                if (option) {
                    existingSelector.value = option.value;
                }
            }
            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language: language }
            }));
        }
    };

})();
</script>