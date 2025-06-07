/**
 * Simple Test Script - Use this to verify the script is running
 */

// Immediate console log to verify script is loaded
console.log('[WaveMAX Test] Script loaded at:', new Date().toISOString());
console.log('[WaveMAX Test] Current URL:', window.location.href);
console.log('[WaveMAX Test] Viewport width:', window.innerWidth);

// Run immediately and on load
(function() {
    'use strict';
    
    function checkAndHide() {
        console.log('[WaveMAX Test] checkAndHide called');
        
        // Log what we find
        const iframe = document.querySelector('iframe');
        console.log('[WaveMAX Test] Iframe found:', !!iframe);
        if (iframe) {
            console.log('[WaveMAX Test] Iframe src:', iframe.src);
        }
        
        // Check viewport
        const isMobile = window.innerWidth < 768;
        console.log('[WaveMAX Test] Is mobile?', isMobile, '(width:', window.innerWidth, ')');
        
        // If mobile, hide elements
        if (isMobile) {
            console.log('[WaveMAX Test] Mobile detected, hiding elements...');
            
            const elements = {
                '.topbar': document.querySelector('.topbar'),
                '.wrapper': document.querySelector('.wrapper'),
                '.navbar': document.querySelector('.navbar'),
                '.page-header': document.querySelector('.page-header'),
                '.footer': document.querySelector('.footer')
            };
            
            console.log('[WaveMAX Test] Found elements:', {
                topbar: !!elements['.topbar'],
                wrapper: !!elements['.wrapper'],
                navbar: !!elements['.navbar'],
                pageHeader: !!elements['.page-header'],
                footer: !!elements['.footer']
            });
            
            // Hide them
            Object.entries(elements).forEach(([selector, element]) => {
                if (element) {
                    console.log('[WaveMAX Test] Hiding:', selector);
                    element.style.display = 'none';
                }
            });
            
            // Also try to send viewport info if iframe exists
            if (iframe) {
                try {
                    const message = {
                        type: 'viewport-info',
                        data: {
                            width: window.innerWidth,
                            height: window.innerHeight,
                            isMobile: true,
                            isTablet: false,
                            isDesktop: false
                        }
                    };
                    console.log('[WaveMAX Test] Sending to iframe:', message);
                    iframe.contentWindow.postMessage(message, '*');
                } catch (e) {
                    console.error('[WaveMAX Test] Error sending message:', e);
                }
            }
        } else {
            console.log('[WaveMAX Test] Not mobile, skipping hide');
        }
    }
    
    // Run immediately
    checkAndHide();
    
    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndHide);
    }
    
    // Run on window load
    window.addEventListener('load', function() {
        console.log('[WaveMAX Test] Window loaded');
        checkAndHide();
    });
    
    // Listen for messages from iframe
    window.addEventListener('message', function(event) {
        console.log('[WaveMAX Test] Received message:', event.data);
    });
    
})();

console.log('[WaveMAX Test] Script execution complete');