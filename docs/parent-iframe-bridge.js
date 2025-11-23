/**
 * WaveMAX Parent-Iframe Bridge Script
 *
 * This script handles bidirectional communication between wavemaxlaundry.com
 * pages and embedded content from wavemax.promo
 *
 * Usage: Include this script on any wavemaxlaundry.com page that embeds
 * content via iframe from wavemax.promo
 */

(function() {
    'use strict';

    // Configuration
    const config = {
        // Allowed origins for iframe content
        allowedOrigins: [
            'https://wavemax.promo',
            'https://affiliate.wavemax.promo'
        ],

        // Default iframe height
        defaultHeight: 800,

        // Minimum height to prevent collapsing
        minHeight: 400,

        // Debugging mode
        debug: false
    };

    // Get the iframe element (assumes standard ID)
    let iframe = null;

    // Store current height to prevent unnecessary updates
    let currentHeight = config.defaultHeight;

    /**
     * Initialize the bridge
     */
    function init() {
        // Find iframe on page (support multiple possible IDs)
        iframe = document.getElementById('wavemax-iframe')
                 || document.getElementById('wavemax-content-iframe')
                 || document.querySelector('iframe[src*="wavemax.promo"]');

        if (!iframe) {
            console.error('[WaveMAX Bridge] No iframe found on page');
            return;
        }

        log('Bridge initialized for iframe:', iframe.id || 'unnamed');

        // Set up iframe source with URL parameters
        setupIframeSource();

        // Set initial height
        iframe.style.height = config.defaultHeight + 'px';

        // Listen for messages from iframe
        window.addEventListener('message', handleMessage, false);

        // Send viewport info to iframe when it loads
        iframe.addEventListener('load', function() {
            log('Iframe loaded, sending viewport info');
            sendToIframe('viewport-info', getViewportInfo());
        });

        // Update viewport info on window resize
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                sendToIframe('viewport-info', getViewportInfo());
            }, 250);
        });
    }

    /**
     * Set up iframe source URL with query parameters
     */
    function setupIframeSource() {
        const currentSrc = iframe.getAttribute('src');

        // If source already set, don't override
        if (currentSrc && currentSrc.trim() !== '') {
            return;
        }

        // Get route from iframe data attribute or use default
        const route = iframe.getAttribute('data-route') || '/home';
        const baseUrl = iframe.getAttribute('data-base-url') || 'https://wavemax.promo/embed-app-v2.html';

        // Build iframe URL with route and any URL parameters from parent page
        const urlParams = new URLSearchParams(window.location.search);
        let iframeSrc = baseUrl;

        // Add route parameter
        urlParams.set('route', route);

        if (urlParams.toString()) {
            iframeSrc += '?' + urlParams.toString();
        }

        log('Setting iframe source:', iframeSrc);
        iframe.src = iframeSrc;
    }

    /**
     * Handle messages from iframe
     */
    function handleMessage(event) {
        // Validate origin
        if (!isOriginAllowed(event.origin)) {
            log('Blocked message from unauthorized origin:', event.origin);
            return;
        }

        if (!event.data || !event.data.type) {
            return;
        }

        log('Received message:', event.data.type, event.data.data);

        switch(event.data.type) {
            case 'resize':
                handleResize(event.data.data);
                break;

            case 'navigate':
                handleNavigate(event.data.data);
                break;

            case 'route-changed':
                handleRouteChange(event.data.data);
                break;

            case 'scroll-to-top':
                handleScrollToTop();
                break;

            case 'hide-chrome':
                handleHideChrome(event.data.data);
                break;

            case 'show-chrome':
                handleShowChrome();
                break;

            case 'ready':
                handleIframeReady(event.data.data);
                break;

            default:
                log('Unknown message type:', event.data.type);
        }
    }

    /**
     * Handle resize requests from iframe
     */
    function handleResize(data) {
        if (!data || !data.height) {
            return;
        }

        let newHeight = parseInt(data.height, 10);

        // Apply minimum height
        if (newHeight < config.minHeight) {
            newHeight = config.minHeight;
        }

        // Only update if height changed significantly (prevent jitter)
        if (Math.abs(newHeight - currentHeight) > 5) {
            currentHeight = newHeight;
            iframe.style.height = newHeight + 'px';
            log('Updated iframe height:', newHeight);
        }
    }

    /**
     * Handle navigation requests from iframe
     */
    function handleNavigate(data) {
        if (!data || !data.url) {
            return;
        }

        log('Navigating parent to:', data.url);

        // Navigate parent window
        if (data.newTab) {
            window.open(data.url, '_blank');
        } else {
            window.location.href = data.url;
        }
    }

    /**
     * Handle route change notifications from iframe
     */
    function handleRouteChange(data) {
        if (!data || !data.route) {
            return;
        }

        log('Route changed in iframe:', data.route);

        // Update parent URL without page reload (optional)
        // Uncomment if you want to sync iframe routes to parent URL
        /*
        const url = new URL(window.location);
        url.searchParams.set('route', data.route);
        window.history.pushState({}, '', url);
        */
    }

    /**
     * Handle scroll to top request
     */
    function handleScrollToTop() {
        log('Scrolling to top');
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    /**
     * Handle hide chrome request (hide header/footer)
     */
    function handleHideChrome(data) {
        log('Hiding page chrome');

        // Find header and footer elements (customize selectors as needed)
        const header = document.querySelector('header, .header, .site-header');
        const footer = document.querySelector('footer, .footer, .site-footer');

        if (header) {
            header.style.display = 'none';
        }

        if (footer) {
            footer.style.display = 'none';
        }

        // Store state for showing later
        window._wavemaxChromeHidden = true;
    }

    /**
     * Handle show chrome request (show header/footer)
     */
    function handleShowChrome() {
        log('Showing page chrome');

        const header = document.querySelector('header, .header, .site-header');
        const footer = document.querySelector('footer, .footer, .site-footer');

        if (header) {
            header.style.display = '';
        }

        if (footer) {
            footer.style.display = '';
        }

        window._wavemaxChromeHidden = false;
    }

    /**
     * Handle iframe ready notification
     */
    function handleIframeReady(data) {
        log('Iframe ready');

        // Send any initialization data
        sendToIframe('viewport-info', getViewportInfo());
    }

    /**
     * Send message to iframe
     */
    function sendToIframe(type, data) {
        if (!iframe || !iframe.contentWindow) {
            return;
        }

        const message = {
            type: type,
            data: data || {}
        };

        log('Sending to iframe:', message);

        // Send to all allowed origins
        config.allowedOrigins.forEach(function(origin) {
            iframe.contentWindow.postMessage(message, origin);
        });
    }

    /**
     * Get viewport information
     */
    function getViewportInfo() {
        const width = window.innerWidth;

        let deviceType = 'desktop';
        if (width < 768) {
            deviceType = 'mobile';
        } else if (width < 1024) {
            deviceType = 'tablet';
        }

        return {
            width: width,
            height: window.innerHeight,
            deviceType: deviceType,
            scrollY: window.scrollY
        };
    }

    /**
     * Check if origin is allowed
     */
    function isOriginAllowed(origin) {
        return config.allowedOrigins.some(function(allowed) {
            return origin === allowed || origin.endsWith(allowed.replace('https://', ''));
        });
    }

    /**
     * Debug logging
     */
    function log() {
        if (config.debug) {
            console.log('[WaveMAX Bridge]', ...arguments);
        }
    }

    /**
     * Public API
     */
    window.WaveMAXBridge = {
        // Enable/disable debug mode
        setDebug: function(enabled) {
            config.debug = enabled;
        },

        // Send custom message to iframe
        sendMessage: function(type, data) {
            sendToIframe(type, data);
        },

        // Manually trigger resize
        resize: function(height) {
            handleResize({ height: height });
        },

        // Get current iframe
        getIframe: function() {
            return iframe;
        },

        // Reinitialize if iframe changes
        reinit: function() {
            init();
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
