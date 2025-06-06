/**
 * Parent-Iframe Communication Bridge - ALERT VERSION
 * This version shows alerts for debugging on mobile without console access
 */

(function() {
    'use strict';

    // Enable alerts for debugging
    const SHOW_ALERTS = true;
    const alerts = [];
    
    function debugAlert(message) {
        if (SHOW_ALERTS) {
            alerts.push(message);
            // Show alerts every 5 messages
            if (alerts.length >= 5) {
                alert('Debug Info:\n\n' + alerts.join('\n'));
                alerts.length = 0;
            }
        }
        console.log('[Parent-Iframe Bridge] ' + message);
    }

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

    debugAlert('Script loaded');
    debugAlert('Width: ' + window.innerWidth);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Also try after window load
    window.addEventListener('load', function() {
        if (!iframe) {
            debugAlert('Retrying after load');
            init();
        }
        // Show any remaining alerts
        if (alerts.length > 0) {
            alert('Final Debug Info:\n\n' + alerts.join('\n'));
            alerts.length = 0;
        }
    });

    function init() {
        debugAlert('Initializing...');
        
        // Find the iframe
        iframe = document.querySelector('iframe[src*="affiliate.wavemax.promo"]') || 
                 document.querySelector('iframe#wavemax-affiliate-iframe') ||
                 document.querySelector('iframe[src*="wavemax.promo"]');
        
        if (!iframe) {
            // Try to find any iframe
            const anyIframe = document.querySelector('iframe');
            if (anyIframe) {
                debugAlert('Found iframe: ' + anyIframe.src.substring(0, 50));
                iframe = anyIframe;
            } else {
                debugAlert('NO IFRAME FOUND!');
                return;
            }
        } else {
            debugAlert('Iframe found');
        }

        // Set up viewport detection
        detectViewport();
        window.addEventListener('resize', debounce(detectViewport, 250));
        window.addEventListener('orientationchange', detectViewport);

        // Set up message listener
        window.addEventListener('message', handleMessage);

        // Send initial viewport info to iframe
        sendViewportInfo();
        
        // Send multiple times
        setTimeout(() => sendViewportInfo(), 500);
        setTimeout(() => sendViewportInfo(), 1000);
        setTimeout(() => sendViewportInfo(), 2000);
        
        debugAlert('Init complete');
    }

    function detectViewport() {
        const width = window.innerWidth;
        const oldMobile = isMobile;
        const oldTablet = isTablet;

        isMobile = width < MOBILE_BREAKPOINT;
        isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;

        if (oldMobile !== isMobile || oldTablet !== isTablet) {
            debugAlert('Viewport changed: Mobile=' + isMobile);
            sendViewportInfo();
            
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

        try {
            iframe.contentWindow.postMessage(info, '*');
            debugAlert('Sent viewport info');
        } catch (e) {
            debugAlert('Error sending: ' + e.message);
        }
    }

    function handleMessage(event) {
        if (!event.data || !event.data.type) return;

        debugAlert('Message: ' + event.data.type);

        switch (event.data.type) {
            case 'hide-chrome':
                if (isMobile || isTablet) {
                    debugAlert('Hide request received');
                    hideChrome();
                }
                break;
                
            case 'show-chrome':
                showChrome();
                break;
                
            case 'resize':
                if (event.data.data && event.data.data.height) {
                    resizeIframe(event.data.data.height);
                }
                break;
                
            case 'scroll-to-top':
                smoothScrollToTop();
                break;
        }
    }

    function hideChrome() {
        if (chromeHidden) return;

        debugAlert('Hiding chrome...');
        
        // WaveMAX specific selectors
        const header = document.querySelector('.navbar');
        const pageHeader = document.querySelector('.page-header');
        const footer = document.querySelector('.footer');
        
        if (header) debugAlert('Header found: .navbar');
        if (pageHeader) debugAlert('Page header found: .page-header');
        if (footer) debugAlert('Footer found: .footer');
        
        if (!header) debugAlert('NO HEADER FOUND');
        if (!footer) debugAlert('NO FOOTER FOUND');
        
        // Hide header
        if (header) {
            header.style.transition = 'transform 0.3s ease-in-out';
            header.style.transform = 'translateY(-100%)';
            header.setAttribute('data-mobile-hidden', 'true');
        }

        // Hide page header
        if (pageHeader) {
            pageHeader.style.display = 'none';
            pageHeader.setAttribute('data-mobile-hidden', 'true');
        }

        // Hide footer
        if (footer) {
            footer.style.transition = 'transform 0.3s ease-in-out';
            footer.style.transform = 'translateY(100%)';
            footer.setAttribute('data-mobile-hidden', 'true');
        }

        // Adjust iframe
        if (iframe) {
            const container = iframe.parentElement;
            if (container) {
                container.style.transition = 'all 0.3s ease-in-out';
                container.style.minHeight = '100vh';
                container.style.paddingTop = '0';
                container.style.paddingBottom = '0';
            }
            iframe.style.minHeight = '100vh';
        }

        chromeHidden = true;
        debugAlert('Chrome hidden');

        // Notify iframe
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

        const header = document.querySelector('[data-mobile-hidden="true"]');
        const footer = document.querySelector('footer[data-mobile-hidden="true"], .footer[data-mobile-hidden="true"]');

        if (header) {
            header.style.transform = 'translateY(0)';
            setTimeout(() => {
                header.removeAttribute('data-mobile-hidden');
            }, 300);
        }

        if (footer) {
            footer.style.transform = 'translateY(0)';
            setTimeout(() => {
                footer.removeAttribute('data-mobile-hidden');
            }, 300);
        }

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
        debugAlert('Chrome shown');
    }

    function resizeIframe(height) {
        if (!iframe) return;
        const newHeight = parseInt(height) + 20;
        iframe.style.height = newHeight + 'px';
        
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