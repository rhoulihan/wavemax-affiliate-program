/**
 * Parent-Iframe Communication Bridge - DEBUG VERSION
 * This version includes extensive console logging to diagnose issues
 */

(function() {
    'use strict';

    console.log('[WaveMAX Bridge] Script starting...');

    // Configuration
    const MOBILE_BREAKPOINT = 768;
    const TABLET_BREAKPOINT = 1024;
    const ALLOWED_ORIGINS = [
        'https://affiliate.wavemax.promo',
        'http://affiliate.wavemax.promo',
        'http://localhost:3000'
    ];

    // State management
    let isMobile = false;
    let isTablet = false;
    let chromeHidden = false;
    let lastScrollPosition = 0;
    let iframe = null;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        console.log('[WaveMAX Bridge] Waiting for DOM to load...');
        document.addEventListener('DOMContentLoaded', init);
    } else {
        console.log('[WaveMAX Bridge] DOM already loaded, initializing...');
        init();
    }

    function init() {
        console.log('[WaveMAX Bridge] Initializing...');
        
        // Debug: Log all iframes on the page
        const allIframes = document.querySelectorAll('iframe');
        console.log('[WaveMAX Bridge] Found', allIframes.length, 'iframes on page:');
        allIframes.forEach((frame, index) => {
            console.log(`  [${index}] src:`, frame.src);
            console.log(`  [${index}] id:`, frame.id);
        });
        
        // Find the iframe
        iframe = document.querySelector('iframe[src*="affiliate.wavemax.promo"]') || 
                 document.querySelector('iframe#wavemax-affiliate-iframe') ||
                 document.querySelector('iframe[src*="wavemax.promo"]');
        
        if (!iframe) {
            console.error('[WaveMAX Bridge] ❌ No WaveMAX iframe found!');
            console.log('[WaveMAX Bridge] Looked for:');
            console.log('  - iframe[src*="affiliate.wavemax.promo"]');
            console.log('  - iframe#wavemax-affiliate-iframe');
            console.log('  - iframe[src*="wavemax.promo"]');
            return;
        }

        console.log('[WaveMAX Bridge] ✅ Found iframe:', iframe.src);

        // Set up viewport detection
        detectViewport();
        window.addEventListener('resize', debounce(detectViewport, 250));
        window.addEventListener('orientationchange', detectViewport);

        // Set up message listener
        window.addEventListener('message', handleMessage);
        console.log('[WaveMAX Bridge] Message listener added');

        // Send initial viewport info to iframe
        // Wait a bit for iframe to load
        setTimeout(() => {
            console.log('[WaveMAX Bridge] Sending initial viewport info...');
            sendViewportInfo();
        }, 1000);
        
        console.log('[WaveMAX Bridge] ✅ Initialized successfully');
        
        // Log current state
        console.log('[WaveMAX Bridge] Current state:');
        console.log('  - Window width:', window.innerWidth);
        console.log('  - Is mobile:', isMobile);
        console.log('  - Is tablet:', isTablet);
        console.log('  - Has touch:', 'ontouchstart' in window);
    }

    function detectViewport() {
        const width = window.innerWidth;
        const oldMobile = isMobile;
        const oldTablet = isTablet;

        isMobile = width < MOBILE_BREAKPOINT;
        isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;

        console.log('[WaveMAX Bridge] Viewport detected:');
        console.log('  - Width:', width);
        console.log('  - Is mobile:', isMobile);
        console.log('  - Is tablet:', isTablet);

        // If viewport category changed, update iframe
        if (oldMobile !== isMobile || oldTablet !== isTablet) {
            console.log('[WaveMAX Bridge] Viewport category changed, updating iframe...');
            sendViewportInfo();
            
            // Show chrome again if switching from mobile to desktop
            if (oldMobile && !isMobile && chromeHidden) {
                console.log('[WaveMAX Bridge] Switching to desktop, showing chrome...');
                showChrome();
            }
        }
    }

    function sendViewportInfo() {
        if (!iframe) {
            console.error('[WaveMAX Bridge] Cannot send viewport info - no iframe');
            return;
        }

        const info = {
            type: 'viewport-info',
            data: {
                width: window.innerWidth,
                height: window.innerHeight,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: !isMobile && !isTablet,
                hasTouch: 'ontouchstart' in window,
                orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
            }
        };

        console.log('[WaveMAX Bridge] Sending viewport info:', info);

        // Try to send to iframe
        try {
            iframe.contentWindow.postMessage(info, '*');
            console.log('[WaveMAX Bridge] ✅ Viewport info sent successfully');
        } catch (e) {
            console.error('[WaveMAX Bridge] ❌ Failed to send viewport info:', e);
        }
    }

    function handleMessage(event) {
        console.log('[WaveMAX Bridge] Received message from:', event.origin);
        console.log('[WaveMAX Bridge] Message data:', event.data);
        
        // Security check
        const isAllowedOrigin = ALLOWED_ORIGINS.some(origin => event.origin.includes(origin.replace(/^https?:\/\//, '')));
        
        if (!isAllowedOrigin) {
            console.warn('[WaveMAX Bridge] ⚠️ Message from untrusted origin:', event.origin);
            return;
        }

        if (!event.data || !event.data.type) {
            console.log('[WaveMAX Bridge] Invalid message format');
            return;
        }

        console.log('[WaveMAX Bridge] Processing message type:', event.data.type);

        switch (event.data.type) {
            case 'hide-chrome':
                console.log('[WaveMAX Bridge] Hide chrome requested');
                if (isMobile || isTablet) {
                    hideChrome();
                } else {
                    console.log('[WaveMAX Bridge] Not hiding chrome - not on mobile/tablet');
                }
                break;
                
            case 'show-chrome':
                console.log('[WaveMAX Bridge] Show chrome requested');
                showChrome();
                break;
                
            case 'resize':
                // Existing resize functionality
                if (event.data.data && event.data.data.height) {
                    console.log('[WaveMAX Bridge] Resize requested:', event.data.data.height);
                    resizeIframe(event.data.data.height);
                }
                break;
                
            case 'scroll-to-top':
                console.log('[WaveMAX Bridge] Scroll to top requested');
                smoothScrollToTop();
                break;
                
            case 'route-changed':
                console.log('[WaveMAX Bridge] Route changed:', event.data.data);
                // Reset chrome visibility on route change
                if (chromeHidden && !isMobile) {
                    showChrome();
                }
                break;
        }
    }

    function hideChrome() {
        if (chromeHidden) {
            console.log('[WaveMAX Bridge] Chrome already hidden');
            return;
        }

        console.log('[WaveMAX Bridge] Hiding header/footer...');
        
        // Find header and footer elements
        const headerSelectors = ['header', '.header', '#header', '.navbar'];
        const footerSelectors = ['footer', '.footer', '#footer'];
        
        let header = null;
        let footer = null;
        
        // Try each selector
        for (const selector of headerSelectors) {
            header = document.querySelector(selector);
            if (header) {
                console.log('[WaveMAX Bridge] Found header with selector:', selector);
                break;
            }
        }
        
        for (const selector of footerSelectors) {
            footer = document.querySelector(selector);
            if (footer) {
                console.log('[WaveMAX Bridge] Found footer with selector:', selector);
                break;
            }
        }
        
        if (!header) {
            console.error('[WaveMAX Bridge] ❌ No header element found!');
            console.log('[WaveMAX Bridge] Tried selectors:', headerSelectors);
        }
        
        if (!footer) {
            console.error('[WaveMAX Bridge] ❌ No footer element found!');
            console.log('[WaveMAX Bridge] Tried selectors:', footerSelectors);
        }
        
        // Store scroll position
        lastScrollPosition = window.pageYOffset;

        // Hide header
        if (header) {
            console.log('[WaveMAX Bridge] Hiding header...');
            header.style.transition = 'transform 0.3s ease-in-out';
            header.style.transform = 'translateY(-100%)';
            header.setAttribute('data-mobile-hidden', 'true');
        }

        // Hide footer
        if (footer) {
            console.log('[WaveMAX Bridge] Hiding footer...');
            footer.style.transition = 'transform 0.3s ease-in-out';
            footer.style.transform = 'translateY(100%)';
            footer.setAttribute('data-mobile-hidden', 'true');
        }

        // Adjust iframe container to full viewport
        if (iframe) {
            console.log('[WaveMAX Bridge] Adjusting iframe container...');
            const container = iframe.parentElement;
            if (container) {
                container.style.transition = 'all 0.3s ease-in-out';
                container.style.minHeight = '100vh';
                container.style.paddingTop = '0';
                container.style.paddingBottom = '0';
            }
            
            // Make iframe full height
            iframe.style.minHeight = '100vh';
        }

        chromeHidden = true;
        console.log('[WaveMAX Bridge] ✅ Chrome hidden');

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
            console.log('[WaveMAX Bridge] Chrome already visible');
            return;
        }

        console.log('[WaveMAX Bridge] Showing header/footer...');
        
        // Find header and footer elements
        const header = document.querySelector('[data-mobile-hidden="true"]');
        const footer = document.querySelector('footer[data-mobile-hidden="true"], .footer[data-mobile-hidden="true"]');

        // Show header
        if (header) {
            header.style.transform = 'translateY(0)';
            setTimeout(() => {
                header.removeAttribute('data-mobile-hidden');
            }, 300);
        }

        // Show footer  
        if (footer) {
            footer.style.transform = 'translateY(0)';
            setTimeout(() => {
                footer.removeAttribute('data-mobile-hidden');
            }, 300);
        }

        // Reset iframe container
        if (iframe) {
            const container = iframe.parentElement;
            if (container) {
                container.style.minHeight = '';
                container.style.paddingTop = '';
                container.style.paddingBottom = '';
            }
            
            iframe.style.minHeight = '';
        }

        chromeHidden = false;
        console.log('[WaveMAX Bridge] ✅ Chrome shown');

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
        
        // Add some padding to prevent cutoff
        const newHeight = parseInt(height) + 20;
        iframe.style.height = newHeight + 'px';
        console.log('[WaveMAX Bridge] Iframe resized to:', newHeight);
        
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

    // Public API
    window.WaveMaxBridge = {
        hideChrome: hideChrome,
        showChrome: showChrome,
        sendViewportInfo: sendViewportInfo,
        getViewportInfo: () => ({
            isMobile: isMobile,
            isTablet: isTablet,
            isDesktop: !isMobile && !isTablet,
            chromeHidden: chromeHidden
        }),
        debug: () => {
            console.log('[WaveMAX Bridge] Debug info:');
            console.log('  - Iframe:', iframe);
            console.log('  - Is mobile:', isMobile);
            console.log('  - Is tablet:', isTablet);
            console.log('  - Chrome hidden:', chromeHidden);
            console.log('  - Window width:', window.innerWidth);
            
            // Try to find header/footer
            const testSelectors = ['header', '.header', '#header', '.navbar', 'footer', '.footer', '#footer'];
            console.log('  - Testing selectors:');
            testSelectors.forEach(sel => {
                const el = document.querySelector(sel);
                console.log(`    - ${sel}:`, el ? 'Found' : 'Not found');
            });
        }
    };

    console.log('[WaveMAX Bridge] Script loaded. Use window.WaveMaxBridge.debug() for debugging info.');

})();