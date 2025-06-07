/**
 * Parent-Iframe Bridge - Debug Version
 * This version has extra logging to help identify issues
 */

console.log('[Parent-Iframe Bridge Debug] Script loaded');

(function() {
    'use strict';
    
    console.log('[Parent-Iframe Bridge Debug] Starting initialization');

    // Configuration
    const MOBILE_BREAKPOINT = 768;
    const TABLET_BREAKPOINT = 1024;

    // State management
    let isMobile = false;
    let isTablet = false;
    let chromeHidden = false;
    let iframe = null;

    // Check current viewport immediately
    console.log('[Parent-Iframe Bridge Debug] Current viewport width:', window.innerWidth);
    console.log('[Parent-Iframe Bridge Debug] Is this mobile?', window.innerWidth < MOBILE_BREAKPOINT);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        console.log('[Parent-Iframe Bridge Debug] DOM not ready, waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', init);
    } else {
        console.log('[Parent-Iframe Bridge Debug] DOM ready, initializing now');
        init();
    }
    
    // Also try after window load
    window.addEventListener('load', function() {
        console.log('[Parent-Iframe Bridge Debug] Window load event fired');
        if (!iframe) {
            console.log('[Parent-Iframe Bridge Debug] No iframe found yet, retrying');
            init();
        }
    });

    function init() {
        console.log('[Parent-Iframe Bridge Debug] Init function called');
        
        // Try different selectors
        const selectors = [
            'iframe[src*="affiliate.wavemax.promo"]',
            'iframe[src*="wavemax.promo"]',
            'iframe#wavemax-affiliate-iframe',
            'iframe'
        ];
        
        for (let selector of selectors) {
            console.log('[Parent-Iframe Bridge Debug] Trying selector:', selector);
            iframe = document.querySelector(selector);
            if (iframe) {
                console.log('[Parent-Iframe Bridge Debug] Found iframe with selector:', selector);
                console.log('[Parent-Iframe Bridge Debug] Iframe src:', iframe.src);
                break;
            }
        }
        
        if (!iframe) {
            console.error('[Parent-Iframe Bridge Debug] NO IFRAME FOUND!');
            console.log('[Parent-Iframe Bridge Debug] All iframes on page:', document.querySelectorAll('iframe'));
            return;
        }

        // Set up viewport detection
        detectViewport();
        
        // Set up message listener
        window.addEventListener('message', handleMessage);
        console.log('[Parent-Iframe Bridge Debug] Message listener added');

        // Send initial viewport info
        console.log('[Parent-Iframe Bridge Debug] Sending initial viewport info');
        sendViewportInfo();
        
        // Send multiple times
        setTimeout(() => {
            console.log('[Parent-Iframe Bridge Debug] Sending viewport info (500ms)');
            sendViewportInfo();
        }, 500);
        
        setTimeout(() => {
            console.log('[Parent-Iframe Bridge Debug] Sending viewport info (1000ms)');
            sendViewportInfo();
        }, 1000);
    }

    function detectViewport() {
        const width = window.innerWidth;
        isMobile = width < MOBILE_BREAKPOINT;
        isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
        
        console.log('[Parent-Iframe Bridge Debug] Viewport detected:', {
            width: width,
            isMobile: isMobile,
            isTablet: isTablet
        });
    }

    function sendViewportInfo() {
        if (!iframe) {
            console.error('[Parent-Iframe Bridge Debug] Cannot send viewport info - no iframe');
            return;
        }

        const info = {
            type: 'viewport-info',
            data: {
                width: window.innerWidth,
                height: window.innerHeight,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: !isMobile && !isTablet
            }
        };

        try {
            console.log('[Parent-Iframe Bridge Debug] Sending viewport info:', info);
            iframe.contentWindow.postMessage(info, '*');
            console.log('[Parent-Iframe Bridge Debug] Viewport info sent successfully');
        } catch (e) {
            console.error('[Parent-Iframe Bridge Debug] Failed to send viewport info:', e);
        }
    }

    function handleMessage(event) {
        console.log('[Parent-Iframe Bridge Debug] Received message:', event.data);
        console.log('[Parent-Iframe Bridge Debug] Message origin:', event.origin);
        
        if (!event.data || !event.data.type) {
            console.log('[Parent-Iframe Bridge Debug] Invalid message format');
            return;
        }

        switch (event.data.type) {
            case 'hide-chrome':
                console.log('[Parent-Iframe Bridge Debug] Hide chrome requested');
                console.log('[Parent-Iframe Bridge Debug] Is mobile/tablet?', isMobile || isTablet);
                if (isMobile || isTablet) {
                    hideChrome();
                } else {
                    console.log('[Parent-Iframe Bridge Debug] Not hiding - desktop mode');
                }
                break;
                
            case 'resize':
                console.log('[Parent-Iframe Bridge Debug] Resize requested:', event.data.data);
                break;
        }
    }

    function hideChrome() {
        console.log('[Parent-Iframe Bridge Debug] hideChrome called');
        
        const elements = {
            topbar: document.querySelector('.topbar'),
            wrapper: document.querySelector('.wrapper'),
            navbar: document.querySelector('.navbar'),
            pageHeader: document.querySelector('.page-header'),
            footer: document.querySelector('.footer')
        };
        
        console.log('[Parent-Iframe Bridge Debug] Found elements:', {
            topbar: !!elements.topbar,
            wrapper: !!elements.wrapper,
            navbar: !!elements.navbar,
            pageHeader: !!elements.pageHeader,
            footer: !!elements.footer
        });
        
        // Hide each element
        Object.entries(elements).forEach(([name, element]) => {
            if (element) {
                console.log(`[Parent-Iframe Bridge Debug] Hiding ${name}`);
                element.style.display = 'none';
                element.setAttribute('data-mobile-hidden', 'true');
            }
        });
        
        chromeHidden = true;
        console.log('[Parent-Iframe Bridge Debug] Chrome hidden complete');
    }

    // Expose for testing
    window.WaveMaxBridgeDebug = {
        getState: () => ({
            iframe: !!iframe,
            iframeSrc: iframe?.src,
            isMobile: isMobile,
            isTablet: isTablet,
            chromeHidden: chromeHidden,
            viewportWidth: window.innerWidth
        }),
        testHideChrome: hideChrome,
        sendViewportInfo: sendViewportInfo
    };
    
    console.log('[Parent-Iframe Bridge Debug] Debug API available at window.WaveMaxBridgeDebug');
})();