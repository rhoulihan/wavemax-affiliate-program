/**
 * Parent-Iframe Communication Bridge - Updated for Operator Chrome Hiding
 * This is an updated version that hides chrome for operator routes regardless of device type
 */

// Copy the existing bridge code and modify the message handlers
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
    let currentRoute = '/';
    let iframe = null;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        console.log('[Parent-Iframe Bridge] Initializing with operator support...');
        
        // Find the iframe
        iframe = document.getElementById('wavemax-iframe') ||
                 document.querySelector('iframe[src*="wavemax.promo"]') || 
                 document.querySelector('iframe#wavemax-affiliate-iframe');
        
        if (!iframe) {
            console.warn('[Parent-Iframe Bridge] No WaveMAX iframe found');
            return;
        }

        // Set up viewport detection
        detectViewport();
        window.addEventListener('resize', debounce(detectViewport, 250));
        
        // Set up message listener
        window.addEventListener('message', handleMessage);
    }

    function detectViewport() {
        const width = window.innerWidth;
        isMobile = width <= MOBILE_BREAKPOINT;
        isTablet = width > MOBILE_BREAKPOINT && width <= TABLET_BREAKPOINT;
    }

    function handleMessage(event) {
        // Security check
        const originCheck = ALLOWED_ORIGINS.some(origin => event.origin.includes(origin.replace(/^https?:\/\//, '')));
        if (!originCheck) return;

        if (!event.data || !event.data.type) return;

        switch (event.data.type) {
            case 'hide-chrome':
                console.log('[Parent-Iframe Bridge] Hide chrome requested');
                // Modified: Always hide chrome when requested, not just on mobile
                hideChrome();
                break;
                
            case 'show-chrome':
                console.log('[Parent-Iframe Bridge] Show chrome requested');
                showChrome();
                break;
                
            case 'route-changed':
                const route = event.data.data && event.data.data.route ? event.data.data.route : '/';
                currentRoute = route;
                console.log('[Parent-Iframe Bridge] Route changed to:', route);
                
                // Hide chrome for operator routes OR mobile
                if (route.startsWith('/operator-') || isMobile) {
                    console.log('[Parent-Iframe Bridge] Hiding chrome for:', route.startsWith('/operator-') ? 'operator route' : 'mobile');
                    hideChrome();
                }
                // Show chrome if not on operator route AND not mobile
                else if (!route.startsWith('/operator-') && !isMobile && chromeHidden) {
                    console.log('[Parent-Iframe Bridge] Showing chrome - not operator route or mobile');
                    showChrome();
                }
                break;
        }
    }

    function hideChrome() {
        if (chromeHidden) return;

        console.log('[Parent-Iframe Bridge] Hiding chrome elements');
        
        // Find elements to hide - adjust selectors for your site structure
        const elementsToHide = [
            '.topbar',
            '.navbar',
            '.main-header',
            '.site-header',
            '.footer',
            '.site-footer',
            '#header',
            '#footer',
            'header',
            'footer',
            '.page-header'
        ];

        elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (el && !el.hasAttribute('data-chrome-hidden')) {
                    el.setAttribute('data-chrome-hidden', 'true');
                    el.style.display = 'none';
                }
            });
        });

        chromeHidden = true;

        // Notify iframe
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'chrome-hidden',
                data: { hidden: true }
            }, '*');
        }
    }

    function showChrome() {
        if (!chromeHidden) return;

        console.log('[Parent-Iframe Bridge] Showing chrome elements');
        
        // Restore hidden elements
        const hiddenElements = document.querySelectorAll('[data-chrome-hidden="true"]');
        hiddenElements.forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-chrome-hidden');
        });

        chromeHidden = false;

        // Notify iframe
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'chrome-hidden',
                data: { hidden: false }
            }, '*');
        }
    }

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
})();