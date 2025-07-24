/**
 * Parent-Iframe Bridge Script
 * Handles communication between parent page and WaveMAX embedded iframe
 * Includes mobile detection and chrome management
 */

(function() {
    'use strict';

    // Configuration
    const ALLOWED_ORIGINS = [
        'https://wavemax.promo',
        'https://www.wavemax.promo',
        'https://affiliate.wavemax.promo',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ];

    // State
    let iframe = null;
    let lastHeight = 0;
    let chromeHidden = false;
    let debugMode = false;

    // Check for debug mode
    const urlParams = new URLSearchParams(window.location.search);
    debugMode = urlParams.get('debug') === 'true';

    function log(message, data) {
        if (debugMode) {
            console.log(`[Parent-Iframe Bridge] ${message}`, data || '');
        }
    }

    // Find WaveMAX iframe
    function findIframe() {
        iframe = document.querySelector('iframe[src*="wavemax.promo"]') || 
                 document.querySelector('iframe#wavemax-affiliate-iframe') ||
                 document.querySelector('iframe#wavemax-iframe');
        
        if (iframe) {
            log('Iframe found:', iframe.id || iframe.src);
        } else {
            log('No WaveMAX iframe found');
        }
        
        return iframe;
    }

    // Get viewport information
    function getViewportInfo() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        return {
            width: width,
            height: height,
            isMobile: width < 768,
            isTablet: width >= 768 && width <= 1024,
            isDesktop: width > 1024,
            orientation: width > height ? 'landscape' : 'portrait',
            userAgent: navigator.userAgent,
            language: document.documentElement.lang || navigator.language || 'en'
        };
    }

    // Send viewport info to iframe
    function sendViewportInfo() {
        if (!iframe || !iframe.contentWindow) return;
        
        const viewportInfo = getViewportInfo();
        log('Sending viewport info:', viewportInfo);
        
        iframe.contentWindow.postMessage({
            type: 'viewport-info',
            data: viewportInfo
        }, '*');
    }

    // Hide parent page chrome elements
    function hideChrome() {
        if (chromeHidden) return;
        
        log('Hiding chrome elements');
        
        // Find common header/footer elements
        const elements = [
            document.querySelector('header'),
            document.querySelector('.header'),
            document.querySelector('#header'),
            document.querySelector('nav'),
            document.querySelector('.navigation'),
            document.querySelector('#navigation'),
            document.querySelector('footer'),
            document.querySelector('.footer'),
            document.querySelector('#footer'),
            document.querySelector('.sidebar'),
            document.querySelector('#sidebar'),
            document.querySelector('.breadcrumb'),
            document.querySelector('.page-title')
        ].filter(Boolean);
        
        elements.forEach(element => {
            element.setAttribute('data-original-display', element.style.display || '');
            element.setAttribute('data-mobile-hidden', 'true');
            element.style.display = 'none';
        });
        
        // Add class to body
        document.body.classList.add('wavemax-mobile-fullscreen');
        
        // Adjust iframe container if needed
        const container = iframe.parentElement;
        if (container) {
            container.style.padding = '0';
            container.style.margin = '0';
            container.style.maxWidth = '100%';
        }
        
        chromeHidden = true;
        
        // Notify iframe
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'chrome-hidden',
                data: { hidden: true }
            }, '*');
        }
    }

    // Show parent page chrome elements
    function showChrome() {
        if (!chromeHidden) return;
        
        log('Showing chrome elements');
        
        // Restore elements
        document.querySelectorAll('[data-mobile-hidden="true"]').forEach(element => {
            const originalDisplay = element.getAttribute('data-original-display');
            element.style.display = originalDisplay || '';
            element.removeAttribute('data-mobile-hidden');
        });
        
        // Remove class from body
        document.body.classList.remove('wavemax-mobile-fullscreen');
        
        chromeHidden = false;
        
        // Notify iframe
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'chrome-hidden',
                data: { hidden: false }
            }, '*');
        }
    }

    // Handle resize message
    function handleResize(data) {
        if (!iframe || !data || !data.height) return;
        
        const newHeight = parseInt(data.height);
        if (newHeight !== lastHeight) {
            log('Resizing iframe:', newHeight + 'px');
            iframe.style.height = newHeight + 'px';
            lastHeight = newHeight;
        }
    }

    // Handle manage chrome message
    function handleManageChrome(data) {
        if (!data) return;
        
        log('Chrome management request:', data);
        
        if (data.hideChrome) {
            hideChrome();
        } else {
            showChrome();
        }
    }

    // Handle messages from iframe
    function handleMessage(event) {
        // Verify origin
        const originAllowed = ALLOWED_ORIGINS.some(origin => 
            event.origin === origin || event.origin.startsWith(origin)
        );
        
        if (!originAllowed) {
            log('Message from untrusted origin:', event.origin);
            return;
        }
        
        if (!event.data || !event.data.type) return;
        
        log('Message received:', event.data.type, event.data.data);
        
        switch (event.data.type) {
            case 'resize':
                handleResize(event.data.data);
                break;
                
            case 'scroll-to-top':
                if (iframe) {
                    iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                break;
                
            case 'manage-chrome':
                handleManageChrome(event.data.data);
                break;
                
            case 'navigate':
                // Optional: Handle navigation requests
                log('Navigation requested:', event.data.route);
                break;
                
            default:
                log('Unknown message type:', event.data.type);
        }
    }

    // Initialize
    function init() {
        log('Initializing Parent-Iframe Bridge');
        
        // Find iframe
        if (!findIframe()) {
            // Try again after DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    findIframe();
                    if (iframe) {
                        sendViewportInfo();
                    }
                });
            }
            return;
        }
        
        // Set up message listener
        window.addEventListener('message', handleMessage);
        
        // Send initial viewport info
        sendViewportInfo();
        
        // Watch for resize events
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(sendViewportInfo, 250);
        });
        
        // Watch for orientation change
        window.addEventListener('orientationchange', function() {
            setTimeout(sendViewportInfo, 100);
        });
        
        // Add styles for smooth transitions
        const style = document.createElement('style');
        style.textContent = `
            /* Parent-Iframe Bridge Styles */
            [data-mobile-hidden="true"] {
                transition: opacity 0.3s ease-in-out;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            body.wavemax-mobile-fullscreen {
                overflow-x: hidden;
            }
            
            body.wavemax-mobile-fullscreen iframe {
                max-width: 100vw !important;
            }
        `;
        document.head.appendChild(style);
        
        log('Parent-Iframe Bridge initialized successfully');
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API for manual control
    window.WaveMaxBridge = {
        hideChrome: hideChrome,
        showChrome: showChrome,
        sendViewportInfo: sendViewportInfo,
        getViewportInfo: getViewportInfo
    };

})();