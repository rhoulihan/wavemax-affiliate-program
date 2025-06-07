/**
 * Mobile Hiding Add-on Script
 * Add this AFTER your existing iframe script to enable mobile chrome hiding
 */

(function() {
    'use strict';
    
    // Configuration
    const MOBILE_BREAKPOINT = 768;
    const TABLET_BREAKPOINT = 1024;
    
    // State
    let isMobile = false;
    let isTablet = false;
    let chromeHidden = false;
    
    // Detect viewport
    function detectViewport() {
        const width = window.innerWidth;
        isMobile = width < MOBILE_BREAKPOINT;
        isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
    }
    
    // Send viewport info to iframe
    function sendViewportInfo() {
        const iframe = document.getElementById('wavemax-iframe');
        if (!iframe) return;
        
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
            iframe.contentWindow.postMessage(info, 'https://wavemax.promo');
            console.log('[Mobile Bridge] Sent viewport info:', info.data);
        } catch (e) {
            console.error('[Mobile Bridge] Failed to send viewport info:', e);
        }
    }
    
    // Hide chrome elements
    function hideChrome() {
        if (chromeHidden) return;
        
        console.log('[Mobile Bridge] Hiding chrome elements');
        
        const elements = {
            '.topbar': document.querySelector('.topbar'),
            '.wrapper': document.querySelector('.wrapper'),
            '.navbar': document.querySelector('.navbar'), 
            '.page-header': document.querySelector('.page-header'),
            '.footer': document.querySelector('.footer')
        };
        
        // Hide each element
        Object.entries(elements).forEach(([selector, element]) => {
            if (element) {
                element.style.display = 'none';
                element.setAttribute('data-mobile-hidden', 'true');
            }
        });
        
        // Adjust iframe
        const iframe = document.getElementById('wavemax-iframe');
        if (iframe && iframe.parentElement) {
            iframe.parentElement.style.minHeight = '100vh';
            iframe.style.minHeight = '100vh';
        }
        
        chromeHidden = true;
    }
    
    // Show chrome elements
    function showChrome() {
        if (!chromeHidden) return;
        
        console.log('[Mobile Bridge] Showing chrome elements');
        
        const elements = document.querySelectorAll('[data-mobile-hidden="true"]');
        elements.forEach(element => {
            element.style.display = '';
            element.removeAttribute('data-mobile-hidden');
        });
        
        // Reset iframe
        const iframe = document.getElementById('wavemax-iframe');
        if (iframe && iframe.parentElement) {
            iframe.parentElement.style.minHeight = '';
            iframe.style.minHeight = '';
        }
        
        chromeHidden = false;
    }
    
    // Initialize
    function init() {
        console.log('[Mobile Bridge] Initializing');
        
        detectViewport();
        
        // Send viewport info multiple times to ensure receipt
        sendViewportInfo();
        setTimeout(sendViewportInfo, 500);
        setTimeout(sendViewportInfo, 1000);
        
        // Listen for messages from iframe
        window.addEventListener('message', function(e) {
            if (e.origin !== 'https://wavemax.promo') return;
            
            if (e.data && e.data.type) {
                console.log('[Mobile Bridge] Received:', e.data.type);
                
                switch(e.data.type) {
                    case 'hide-chrome':
                        if (isMobile || isTablet) {
                            hideChrome();
                        }
                        break;
                    case 'show-chrome':
                        showChrome();
                        break;
                }
            }
        });
        
        // Handle viewport changes
        window.addEventListener('resize', function() {
            detectViewport();
            sendViewportInfo();
            
            // Show chrome if no longer mobile
            if (!isMobile && !isTablet && chromeHidden) {
                showChrome();
            }
        });
    }
    
    // Start when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Also init on load
    window.addEventListener('load', init);
    
})();