/**
 * Parent-Iframe Communication Bridge
 * Handles communication between parent page and embedded WaveMAX iframe
 * Provides mobile-responsive features including header/footer management
 */

(function() {
    'use strict';

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
        
        // Find the iframe
        iframe = document.querySelector('iframe[src*="affiliate.wavemax.promo"]') || 
                 document.querySelector('iframe#wavemax-affiliate-iframe');
        
        if (!iframe) {
            console.warn('[Parent-Iframe Bridge] No WaveMAX iframe found');
            return;
        }

        // Set up viewport detection
        detectViewport();
        window.addEventListener('resize', debounce(detectViewport, 250));
        window.addEventListener('orientationchange', detectViewport);

        // Set up message listener
        window.addEventListener('message', handleMessage);

        // Send initial viewport info to iframe
        sendViewportInfo();
        
        // Send viewport info multiple times to ensure iframe receives it
        setTimeout(() => sendViewportInfo(), 500);
        setTimeout(() => sendViewportInfo(), 1000);
        setTimeout(() => sendViewportInfo(), 2000);
        
        console.log('[Parent-Iframe Bridge] Initialized successfully');
    }

    function detectViewport() {
        const width = window.innerWidth;
        const oldMobile = isMobile;
        const oldTablet = isTablet;

        isMobile = width < MOBILE_BREAKPOINT;
        isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;

        // If viewport category changed, update iframe
        if (oldMobile !== isMobile || oldTablet !== isTablet) {
            sendViewportInfo();
            
            // Show chrome again if switching from mobile to desktop
            if (oldMobile && !isMobile && chromeHidden) {
                showChrome();
            }
        }
    }

    function sendViewportInfo() {
        if (!iframe) return;

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

        // Try to send to iframe
        try {
            iframe.contentWindow.postMessage(info, '*');
        } catch (e) {
            console.error('[Parent-Iframe Bridge] Failed to send viewport info:', e);
        }
    }

    function handleMessage(event) {
        // Security check
        if (!ALLOWED_ORIGINS.some(origin => event.origin.includes(origin.replace(/^https?:\/\//, '')))) {
            return;
        }

        if (!event.data || !event.data.type) return;

        console.log('[Parent-Iframe Bridge] Received message:', event.data.type);

        switch (event.data.type) {
            case 'hide-chrome':
                if (isMobile || isTablet) {
                    hideChrome();
                }
                break;
                
            case 'show-chrome':
                showChrome();
                break;
                
            case 'resize':
                // Existing resize functionality
                if (event.data.data && event.data.data.height) {
                    resizeIframe(event.data.data.height);
                }
                break;
                
            case 'scroll-to-top':
                smoothScrollToTop();
                break;
                
            case 'route-changed':
                // Reset chrome visibility on route change
                if (chromeHidden && !isMobile) {
                    showChrome();
                }
                break;
        }
    }

    function hideChrome() {
        if (chromeHidden) return;

        console.log('[Parent-Iframe Bridge] Hiding header/footer');
        
        // Find header and footer elements - WaveMAX CMS specific selectors
        const header = document.querySelector('.navbar');
        const footer = document.querySelector('.footer');
        
        // Store scroll position
        lastScrollPosition = window.pageYOffset;

        // Hide header
        if (header) {
            header.style.transition = 'transform 0.3s ease-in-out';
            header.style.transform = 'translateY(-100%)';
            header.setAttribute('data-mobile-hidden', 'true');
        }

        // Hide footer
        if (footer) {
            footer.style.transition = 'transform 0.3s ease-in-out';
            footer.style.transform = 'translateY(100%)';
            footer.setAttribute('data-mobile-hidden', 'true');
        }

        // Adjust iframe container to full viewport
        if (iframe) {
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
        if (!chromeHidden) return;

        console.log('[Parent-Iframe Bridge] Showing header/footer');
        
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
        })
    };

})();