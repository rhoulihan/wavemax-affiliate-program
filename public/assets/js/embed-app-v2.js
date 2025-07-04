// Embed App V2 - CSP Compliant Version
// Single page embedded application
const BASE_URL = window.location.protocol + '//' + window.location.host;

// Mobile and parent communication state
let viewportInfo = null;
let chromeHidden = false;

// Helper function to check if any user is authenticated
function isAnyUserAuthenticated() {
    // First check if SessionManager exists and has the method we need
    if (!window.SessionManager || typeof window.SessionManager.isAuthenticated !== 'function') {
        return false;
    }
    
    // Check all possible user types
    const userTypes = ['administrator', 'affiliate', 'customer', 'operator'];
    return userTypes.some(type => window.SessionManager.isAuthenticated(type));
}

// Helper function to check if a specific user type is authenticated
function isUserAuthenticated(userType) {
    if (!window.SessionManager || typeof window.SessionManager.isAuthenticated !== 'function') {
        return false;
    }
    return window.SessionManager.isAuthenticated(userType);
}

// Helper function to get the currently authenticated user type
function getAuthenticatedUserType() {
    if (!window.SessionManager || typeof window.SessionManager.isAuthenticated !== 'function') {
        return null;
    }
    
    const userTypes = ['administrator', 'affiliate', 'customer', 'operator'];
    return userTypes.find(type => window.SessionManager.isAuthenticated(type)) || null;
}

// Define pages that have been migrated to CSP-compliant version
const EMBED_PAGES = {
    '/': '/embed-landing.html',
    '/landing': '/embed-landing.html',
    '/terms-of-service': '/terms-and-conditions-embed.html',
    '/terms-and-conditions': '/terms-and-conditions-embed.html',
    '/privacy-policy': '/privacy-policy.html',
    '/payment-success': '/payment-success-embed.html',
    '/payment-error': '/payment-error-embed.html',
    '/operator-scan': '/operator-scan-embed.html',
    '/operator-login': '/operator-login-embed.html',
    '/affiliate-login': '/affiliate-login-embed.html',
    '/affiliate-register': '/affiliate-register-embed.html',
    '/affiliate-dashboard': '/affiliate-dashboard-embed.html',
    '/customer-login': '/customer-login-embed.html',
    '/customer-register': '/customer-register-embed.html',
    '/customer-success': '/customer-success-embed.html',
    '/forgot-password': '/forgot-password-embed.html',
    '/reset-password': '/reset-password-embed.html',
    '/administrator-login': '/administrator-login-embed.html',
    '/administrator-dashboard': '/administrator-dashboard-embed.html',
    '/schedule-pickup': '/schedule-pickup-embed.html',
    '/order-confirmation': '/order-confirmation-embed.html',
    '/customer-dashboard': '/customer-dashboard-embed.html',
    '/affiliate-success': '/affiliate-success-embed.html',
    '/affiliate-landing': '/affiliate-landing-embed.html'
    // Add more pages here as they are migrated to CSP compliance
};

let currentRoute = '/';

// Get route from URL parameter
function getRouteFromUrl() {
    const params = new URLSearchParams(window.location.search);
    
    let route = params.get('route');
    
    // Handle legacy login parameter for backward compatibility with emails
    if (!route && params.get('login')) {
        const loginType = params.get('login');
        if (loginType === 'customer') {
            // Check if pickup parameter is also present
            if (params.get('pickup') === 'true') {
                route = '/schedule-pickup';
                console.log('Mapped login=customer&pickup=true to /schedule-pickup');
            } else {
                route = '/customer-login';
            }
        } else if (loginType === 'affiliate') {
            route = '/affiliate-login';
        } else if (loginType === 'administrator') {
            route = '/administrator-login';
        }
        console.log('Mapped login parameter to route:', loginType, '->', route);
    }
    
    // If no route in URL, check localStorage for saved route ONLY if authenticated
    if (!route) {
        // Check if user is authenticated before using saved route
        if (isAnyUserAuthenticated()) {
            route = localStorage.getItem('currentRoute') || '/';
            console.log('No route in URL, authenticated user, using saved route:', route);
        } else {
            // No auth, clear saved route and use default
            localStorage.removeItem('currentRoute');
            route = '/';
            console.log('No route in URL, no auth, using default route');
        }
    }
    
    console.log('Final route:', route);
    return route;
}

// Clean up function to disconnect all observers
function cleanupCurrentPage() {
    // Dispatch a custom event to notify scripts to clean up
    window.dispatchEvent(new CustomEvent('page-cleanup'));
    
    // Disconnect observers to prevent memory leaks and conflicts
    if (window.currentResizeObserver) {
        window.currentResizeObserver.disconnect();
        window.currentResizeObserver = null;
    }
    
    if (window.currentMutationObserver) {
        window.currentMutationObserver.disconnect();
        window.currentMutationObserver = null;
    }
    
    // Remove all ResizeObservers by triggering cleanup in child scripts
    if (window.ResizeObserver) {
        // This will be caught by scripts that set up observers
        window.dispatchEvent(new CustomEvent('disconnect-observers'));
    }
    
    // Remove route-specific styles from previous page
    document.querySelectorAll('style[data-route]').forEach(style => {
        style.remove();
    });
    
    // Remove dynamically loaded scripts from previous page
    document.querySelectorAll('script[data-page-script]').forEach(script => {
        script.remove();
    });
    
    // Clear any intervals that might have been set by page scripts
    if (window.statsInterval) {
        clearInterval(window.statsInterval);
        window.statsInterval = null;
    }
    
    // Reset height tracking
    heightUpdateCount = 0;
    lastSentHeight = 0;
    isUpdatingHeight = false;
    clearTimeout(heightUpdateTimeout);
}

// Height tracking variables
let lastSentHeight = 0;
let heightUpdateTimeout = null;
let isUpdatingHeight = false;
let heightUpdateCount = 0;
const MAX_HEIGHT_UPDATES = 5; // Prevent infinite loops

// Update iframe height
function updateHeight() {
    if (isUpdatingHeight) return;
    
    // Prevent infinite loops
    heightUpdateCount++;
    if (heightUpdateCount > MAX_HEIGHT_UPDATES) {
        console.warn('Height update limit reached, preventing infinite loop');
        return;
    }
    
    clearTimeout(heightUpdateTimeout);
    heightUpdateTimeout = setTimeout(() => {
        const body = document.body;
        const html = document.documentElement;
        
        const height = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
        );
        
        // Only send if height changed significantly (more than 30px) to prevent minor fluctuations
        if (Math.abs(height - lastSentHeight) > 30) {
            lastSentHeight = height;
            isUpdatingHeight = true;
            
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'resize',
                    data: { height: height + 20 } // Minimal padding to prevent cutoff
                }, '*');
            }
            
            // Reset flag after a delay
            setTimeout(() => {
                isUpdatingHeight = false;
                // Reset counter after successful update
                heightUpdateCount = 0;
            }, 200);
        } else {
            // Reset counter for unchanged heights
            heightUpdateCount = Math.max(0, heightUpdateCount - 1);
        }
    }, 150);
}

// Load page content - CSP compliant version
async function loadPage(route) {
    console.log('Loading page for route:', route);
    console.log('Current window.location.search:', window.location.search);
    
    // Check if route needs authentication adjustment
    if (window.SessionManager && window.SessionManager.adjustRouteForAuth) {
        const adjustedRoute = window.SessionManager.adjustRouteForAuth(route);
        if (adjustedRoute !== route) {
            console.log(`SessionManager adjusted route from ${route} to: ${adjustedRoute}`);
            route = adjustedRoute;
            console.log('Final route:', route);
        }
    }
    
    // Clean up current page before loading new one
    cleanupCurrentPage();
    
    // Reset height tracking for new page
    lastSentHeight = 0;
    isUpdatingHeight = false;
    
    // Send a smaller height to trigger resize on new page
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'resize',
            data: { height: 600 } // Reset to minimum height
        }, '*');
    }
    
    const container = document.getElementById('app-container');
    
    // Extract base route without query parameters for page mapping
    const baseRoute = route.split('?')[0];
    const pagePath = EMBED_PAGES[baseRoute] || EMBED_PAGES['/'];
    console.log('Base route:', baseRoute, 'Page path:', pagePath);
    
    try {
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin me-2"></i>Loading...</div>';
        
        // Build URL with current query parameters
        const currentParams = new URLSearchParams(window.location.search);
        console.log('Current params for fetch:', Array.from(currentParams.entries()));
        const fetchUrl = BASE_URL + pagePath + (currentParams.toString() ? '?' + currentParams.toString() : '');
        console.log('Fetching URL:', fetchUrl);
        
        // Add credentials to ensure we get the server-processed version with nonces
        const response = await fetch(fetchUrl, {
            credentials: 'include',
            headers: {
                'Accept': 'text/html'
            }
        });
        if (!response.ok) throw new Error('Failed to load page');
        
        let html = await response.text();
        
        // Extract head and body content
        const headMatch = html.match(/<head[^>]*>([\s\S]*)<\/head>/i);
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        
        if (headMatch && bodyMatch) {
            // Extract styles and links from head
            const headContent = headMatch[1];
            const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/gi;
            const styles = headContent.match(styleRegex) || [];
            const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*>/gi;
            const styleLinks = headContent.match(linkRegex) || [];
            
            // Get body content
            let bodyContent = bodyMatch[1];
            
            // Remove script tags to prevent duplicate execution
            const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
            bodyContent = bodyContent.replace(scriptRegex, '');
            
            // Update relative URLs to absolute
            bodyContent = bodyContent.replace(/src=["'](?!http|\/\/)([^"']+)["']/g, (match, path) => {
                return `src="${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}"`;
            });
            bodyContent = bodyContent.replace(/href=["'](?!http|\/\/|#)([^"']+)["']/g, (match, path) => {
                return `href="${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}"`;
            });
            
            // Add external stylesheets to head if not already present
            styleLinks.forEach(link => {
                // Update relative paths in link tags
                const updatedLink = link.replace(/href=["'](?!http|\/\/)([^"']+)["']/g, (match, path) => {
                    return `href="${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}"`;
                });
                // Check if this stylesheet is already in the document
                const linkHref = updatedLink.match(/href=["']([^"']+)["']/);
                if (linkHref && !document.querySelector(`link[href="${linkHref[1]}"]`)) {
                    const linkElement = document.createElement('link');
                    linkElement.rel = 'stylesheet';
                    linkElement.href = linkHref[1];
                    
                    // Get nonce from existing script tag
                    const currentScript = document.querySelector('script[nonce]');
                    if (currentScript) {
                        const nonce = currentScript.getAttribute('nonce');
                        if (nonce) {
                            linkElement.setAttribute('nonce', nonce);
                        }
                    }
                    
                    document.head.appendChild(linkElement);
                }
            });
            
            // Add styles to document head
            styles.forEach(style => {
                // Skip empty styles
                const styleContent = style.replace(/<style[^>]*>/gi, '').replace(/<\/style>/gi, '').trim();
                if (!styleContent) return;
                
                // Check if this style already has a nonce attribute
                const existingNonceMatch = style.match(/nonce=["']([^"']+)["']/);
                if (existingNonceMatch) {
                    // Use the existing nonce from the fetched content
                    const existingNonce = existingNonceMatch[1];
                    const styleElement = document.createElement('style');
                    styleElement.setAttribute('data-route', route);
                    styleElement.setAttribute('nonce', existingNonce);
                    styleElement.textContent = styleContent;
                    document.head.appendChild(styleElement);
                    return;
                }
                
                const styleElement = document.createElement('style');
                styleElement.setAttribute('data-route', route);
                
                // Get nonce from current document (embed-app-v2.html)
                let nonce = null;
                
                // First try to extract nonce from CSP header in error messages
                // This is a workaround for when the server doesn't properly inject nonce
                const errorElements = document.querySelectorAll('script[src]');
                for (const elem of errorElements) {
                    try {
                        // Force a CSP error to extract the nonce
                        const testElem = document.createElement('script');
                        testElem.textContent = '// test';
                        document.head.appendChild(testElem);
                        document.head.removeChild(testElem);
                    } catch (e) {
                        // Check if error message contains nonce
                        const nonceMatch = e.message?.match(/nonce-([a-zA-Z0-9+/=]+)/);
                        if (nonceMatch) {
                            nonce = nonceMatch[1];
                            console.log('Extracted nonce from CSP error:', nonce);
                            break;
                        }
                    }
                }
                
                // Try from any script element with nonce in current document
                if (!nonce) {
                    const scripts = document.querySelectorAll('script[nonce]');
                    for (const script of scripts) {
                        const scriptNonce = script.getAttribute('nonce');
                        if (scriptNonce) {
                            nonce = scriptNonce;
                            break;
                        }
                    }
                }
                
                // If not found, try from style or link elements
                if (!nonce) {
                    const elementsWithNonce = document.querySelectorAll('[nonce]');
                    for (const element of elementsWithNonce) {
                        const elementNonce = element.getAttribute('nonce');
                        if (elementNonce) {
                            nonce = elementNonce;
                            break;
                        }
                    }
                }
                
                // If still not found, try from window.CSP_NONCE
                if (!nonce && window.CSP_NONCE && window.CSP_NONCE.trim()) {
                    nonce = window.CSP_NONCE;
                }
                
                // Try from current document's meta tag
                if (!nonce) {
                    const currentNonceMeta = document.querySelector('meta[name="csp-nonce"]');
                    if (currentNonceMeta) {
                        const currentNonce = currentNonceMeta.getAttribute('content');
                        if (currentNonce && currentNonce.trim()) {
                            nonce = currentNonce;
                        }
                    }
                }
                
                // As last resort, try to get it from the CSP header in the console error
                if (!nonce) {
                    // Look for the nonce in recent console errors
                    const cspHeader = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
                    if (cspHeader) {
                        const content = cspHeader.getAttribute('content');
                        const nonceMatch = content?.match(/nonce-([a-zA-Z0-9+/=]+)/);
                        if (nonceMatch) {
                            nonce = nonceMatch[1];
                        }
                    }
                }
                
                if (nonce) {
                    styleElement.setAttribute('nonce', nonce);
                    console.log('Setting nonce on style element:', nonce);
                } else {
                    console.warn('No nonce found - CSP might block this style');
                }
                
                // Set content after nonce
                styleElement.textContent = styleContent;
                
                document.head.appendChild(styleElement);
            });
            
            html = bodyContent;
        }
        
        container.innerHTML = html;
        currentRoute = route;
        
        // Store the current route for persistence ONLY if authenticated
        if (isAnyUserAuthenticated()) {
            localStorage.setItem('currentRoute', route);
        } else {
            // Clear any saved route if not authenticated
            localStorage.removeItem('currentRoute');
        }
        
        // Set route data attribute on body
        document.body.setAttribute('data-route', route);
        
        // Initialize scripts for the loaded page
        initializePageScripts(route);
        
        // Update parent about page load and user type
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'page-loaded',
                data: { 
                    route: route,
                    userType: getAuthenticatedUserType()
                }
            }, '*');
            
            // Send current auth state
            window.parent.postMessage({
                type: 'auth-state',
                data: {
                    isAuthenticated: isAnyUserAuthenticated(),
                    userType: getAuthenticatedUserType()
                }
            }, '*');
        }
        
        // Update height after content loads
        setTimeout(updateHeight, 100);
        
        // Set up observer for dynamic content changes
        setupHeightObserver();
        
    } catch (error) {
        console.error('Error loading page:', error);
        container.innerHTML = `
            <div class="error">
                <h3>Failed to load page</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary mt-3" onclick="location.reload()">Try Again</button>
            </div>
        `;
    }
}

// Initialize page-specific scripts
function initializePageScripts(route) {
    // Common initialization
    // Handle back button clicks
    const backButtons = document.querySelectorAll('[data-action="back"], [data-action="navigate-back"]');
    backButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            handleNavigation('back');
        });
    });
    
    // Handle navigation links
    const navLinks = document.querySelectorAll('[data-navigate]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetRoute = link.getAttribute('data-navigate');
            navigateTo(targetRoute);
        });
    });
    
    // Re-initialize any forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        // Trigger form initialization event
        form.dispatchEvent(new Event('form-init'));
    });
    
    // Define page-specific scripts
    const pageScripts = {
        '/': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', 'https://wavemax.promo/assets/js/embed-navigation.js', 'https://wavemax.promo/assets/js/revenue-calculator.js', '/assets/js/embed-landing-init.js'],
        '/landing': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', 'https://wavemax.promo/assets/js/embed-navigation.js', 'https://wavemax.promo/assets/js/revenue-calculator.js', '/assets/js/embed-landing-init.js'],
        '/terms-of-service': ['/assets/js/terms-and-conditions.js'],
        '/terms-and-conditions': ['/assets/js/terms-and-conditions.js'],
        '/payment-success': ['/assets/js/payment-success.js'],
        '/payment-error': ['/assets/js/payment-error.js'],
        '/operator-scan': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/modal-utils.js', '/assets/js/errorHandler.js', '/assets/js/csrf-utils.js', '/assets/js/operator-scan-init.js'],
        '/affiliate-login': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/modal-utils.js', '/assets/js/csrf-utils.js', '/assets/js/swirl-spinner.js', '/assets/js/affiliate-login.js'],
        '/affiliate-register': ['/assets/js/embed-config.js', '/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/modal-utils.js', '/assets/js/errorHandler.js', '/assets/js/csrf-utils.js', '/assets/js/swirl-spinner.js', '/assets/js/service-area-component.js', '/assets/js/form-validation.js', '/assets/js/pricing-preview-component.js', '/assets/js/affiliate-register-init.js', '/assets/js/affiliate-register-page-init.js'],
        '/affiliate-dashboard': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', '/assets/js/service-area-component.js', '/assets/js/pricing-preview-component.js', '/assets/js/affiliate-dashboard-init.js', '/assets/js/csrf-utils.js', '/assets/js/affiliate-dashboard-embed.js', '/assets/js/affiliate-dashboard-i18n.js'],
        '/customer-login': ['/assets/js/embed-config.js', '/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/modal-utils.js', '/assets/js/csrf-utils.js', '/assets/js/swirl-spinner.js', '/assets/js/customer-login-init.js'],
        '/customer-register': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/embed-config.js', '/assets/js/modal-utils.js', '/assets/js/errorHandler.js', '/assets/js/csrf-utils.js', '/assets/js/swirl-spinner.js', '/assets/js/paygistix-payment-form-v2.js', '/assets/js/customer-register.js', '/assets/js/customer-register-paygistix.js', '/assets/js/customer-register-navigation.js', '/assets/js/customer-register-debug.js'],
        '/customer-success': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/customer-success-embed.js'],
        '/forgot-password': ['/assets/js/embed-config.js', '/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/modal-utils.js', '/assets/js/csrf-utils.js', '/assets/js/swirl-spinner.js', '/assets/js/forgot-password-init.js'],
        '/reset-password': ['/assets/js/embed-config.js', '/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/modal-utils.js', '/assets/js/csrf-utils.js', '/assets/js/swirl-spinner.js', '/assets/js/reset-password-init.js'],
        '/administrator-login': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/csrf-utils.js', '/assets/js/administrator-login-init.js'],
        '/administrator-dashboard': ['https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', '/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/modal-utils.js', '/assets/js/errorHandler.js', '/assets/js/csrf-utils.js', '/assets/js/password-validator-component.js', '/assets/js/qrcode.min.js', '/assets/js/jspdf.min.js', '/assets/js/administrator-dashboard-init.js', '/assets/js/admin-operator-fix.js', '/assets/js/administrator-dashboard-i18n.js'],
        '/schedule-pickup': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/embed-config.js', '/assets/js/modal-utils.js', '/assets/js/errorHandler.js', '/assets/js/csrf-utils.js', '/assets/js/swirl-spinner.js', '/assets/js/paygistix-payment-form-v2.js', '/assets/js/schedule-pickup.js', '/assets/js/schedule-pickup-navigation.js', '/assets/js/schedule-pickup-embed.js'],
        '/order-confirmation': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/order-confirmation-init.js'],
        '/customer-dashboard': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/modal-utils.js', '/assets/js/csrf-utils.js', '/assets/js/customer-dashboard.js'],
        '/affiliate-success': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/modal-utils.js', '/assets/js/affiliate-success-init.js'],
        '/affiliate-landing': ['/assets/js/i18n.js', '/assets/js/language-switcher.js', '/assets/js/affiliate-landing-init.js']
    };
    
    // Load scripts for the current route (use base route without query params)
    const baseRoute = route.split('?')[0];
    const scripts = pageScripts[baseRoute] || [];
    if (scripts.length > 0) {
        loadPageScripts(scripts);
    }
}

// Load scripts sequentially
function loadPageScripts(scripts) {
    let scriptIndex = 0;
    
    function loadNextScript() {
        if (scriptIndex < scripts.length) {
            const scriptPath = scripts[scriptIndex];
            
            // Check if script is already loaded
            const existingScript = document.querySelector(`script[src*="${scriptPath}"]`);
            if (existingScript) {
                scriptIndex++;
                loadNextScript();
                return;
            }
            
            const script = document.createElement('script');
            // Check if it's an external URL
            if (scriptPath.startsWith('http://') || scriptPath.startsWith('https://')) {
                script.src = scriptPath;
            } else {
                script.src = BASE_URL + scriptPath + '?v=' + Date.now();
            }
            
            // Get nonce from meta tag or existing script
            const nonceMeta = document.querySelector('meta[name="csp-nonce"]');
            const existingScriptWithNonce = document.querySelector('script[nonce]');
            const nonce = nonceMeta?.getAttribute('content') || existingScriptWithNonce?.getAttribute('nonce');
            
            if (nonce) {
                script.setAttribute('nonce', nonce);
            }
            
            script.setAttribute('data-page-script', 'true');
            script.onload = function() {
                console.log('Loaded script:', scripts[scriptIndex]);
                scriptIndex++;
                loadNextScript();
            };
            script.onerror = function() {
                console.error('Failed to load script:', scripts[scriptIndex]);
                scriptIndex++;
                loadNextScript();
            };
            document.body.appendChild(script);
        } else {
            // All scripts loaded, trigger translation if available
            setTimeout(() => {
                if (window.i18n && window.i18n.translatePage) {
                    console.log('Triggering i18n translation after scripts loaded');
                    window.i18n.translatePage();
                }
            }, 200);
        }
    }
    
    loadNextScript();
}

// Handle navigation
function handleNavigation(action) {
    console.log('Handling navigation:', action);
    
    if (action === 'back') {
        // Check if we're in an iframe
        if (window.parent !== window) {
            // Send message to parent
            window.parent.postMessage({
                type: 'navigate-back',
                data: {}
            }, '*');
        } else {
            // Not in iframe, use browser history
            window.history.back();
        }
    }
}

// Navigate to a specific route
function navigateTo(route) {
    console.log('Navigating to:', route);
    
    // Update URL without reload
    const params = new URLSearchParams(window.location.search);
    params.set('route', route);
    const newUrl = window.location.pathname + '?' + params.toString() + window.location.hash;
    window.history.pushState({ route }, '', newUrl);
    
    // Load the new page
    loadPage(route);
}

// Set up height observer
function setupHeightObserver() {
    // Observe changes to the app container
    const container = document.getElementById('app-container');
    if (!container) return;
    
    // Debounced update function to prevent excessive calls
    let observerTimeout = null;
    const debouncedUpdate = () => {
        clearTimeout(observerTimeout);
        observerTimeout = setTimeout(updateHeight, 300);
    };
    
    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(debouncedUpdate);
    
    // Start observing
    resizeObserver.observe(container);
    
    // Create a MutationObserver to watch for DOM changes (less aggressive)
    const mutationObserver = new MutationObserver((mutations) => {
        // Only trigger for significant changes
        const hasSignificantChange = mutations.some(mutation => 
            mutation.type === 'childList' && 
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
        );
        
        if (hasSignificantChange) {
            debouncedUpdate();
        }
    });
    
    // Start observing with less aggressive settings
    mutationObserver.observe(container, {
        childList: true,
        subtree: true
        // Removed attributes and characterData to reduce noise
    });
    
    // Store observers for cleanup
    window.currentResizeObserver = resizeObserver;
    window.currentMutationObserver = mutationObserver;
    
    // Listen for cleanup event
    window.addEventListener('disconnect-observers', () => {
        if (window.currentResizeObserver) {
            window.currentResizeObserver.disconnect();
            window.currentResizeObserver = null;
        }
        if (window.currentMutationObserver) {
            window.currentMutationObserver.disconnect();
            window.currentMutationObserver = null;
        }
    }, { once: true });
}

// Listen for messages from parent
window.addEventListener('message', (event) => {
    console.log('Received message:', event.data, 'from origin:', event.origin);
    
    // Handle navigation messages from child iframes
    if (event.data.type === 'navigate' && event.data.route) {
        console.log('Navigation message from child iframe:', event.data.route);
        navigateTo(event.data.route);
        return;
    }
    
    // Handle different message types
    switch(event.data.type) {
        case 'navigate':
            if (event.data.route) {
                navigateTo(event.data.route);
            }
            break;
            
        case 'viewport-info':
            viewportInfo = event.data.data;
            console.log('Received viewport info:', viewportInfo);
            
            // Apply mobile-specific classes if needed
            if (viewportInfo.isMobile) {
                document.body.classList.add('is-mobile');
            }
            break;
            
        case 'hide-chrome':
            chromeHidden = event.data.hidden;
            if (chromeHidden) {
                document.body.classList.add('chrome-hidden');
            } else {
                document.body.classList.remove('chrome-hidden');
            }
            updateHeight();
            break;
            
        case 'auth-check':
            // Respond with current auth state
            event.source.postMessage({
                type: 'auth-state',
                data: {
                    isAuthenticated: isAnyUserAuthenticated(),
                    userType: getAuthenticatedUserType()
                }
            }, event.origin);
            break;
            
        case 'session-update':
            // Session was updated, reload current page
            console.log('Session update received, reloading page');
            loadPage(currentRoute);
            break;
            
        case 'logout':
            // Handle logout
            console.log('Logout message received');
            if (window.SessionManager) {
                window.SessionManager.logout(event.data.userType || 'all');
            }
            // Redirect to landing page
            navigateTo('/');
            break;
    }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.route) {
        loadPage(event.state.route);
    } else {
        loadPage(getRouteFromUrl());
    }
});

// Make navigateTo available globally for embedded scripts
window.navigateTo = navigateTo;

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing embed app v2');
    
    // Get initial route
    const route = getRouteFromUrl();
    
    // Check if this route is supported in V2 (check base route without query params)
    const baseRoute = route.split('?')[0];
    if (!EMBED_PAGES[baseRoute]) {
        // Route not migrated yet, show message
        const container = document.getElementById('app-container');
        container.innerHTML = `
            <div class="error">
                <h3>Page Not Available</h3>
                <p>This page is not yet available in the new version.</p>
                <p>Route: ${route}</p>
                <button class="btn btn-primary mt-3" onclick="window.location.href='/embed-app-v2.html' + window.location.search">Use Legacy Version</button>
            </div>
        `;
        return;
    }
    
    // Load initial page
    loadPage(route);
    
    // Set up periodic height updates
    setInterval(updateHeight, 1000);
    
    // Request viewport info from parent
    if (window.parent !== window) {
        window.parent.postMessage({ type: 'request-viewport-info' }, '*');
    }
});