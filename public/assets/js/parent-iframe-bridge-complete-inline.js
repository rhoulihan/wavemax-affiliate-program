<script>
/**
 * Parent-Iframe Communication Bridge - Complete Inline Version
 * This is the COMPLETE script that should REPLACE the current script on wavemaxlaundry.com
 * It includes BOTH iframe setup AND mobile hiding functionality
 */

// First, handle the iframe setup (like their current script)
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    let iframeSrc = 'https://wavemax.promo/embed-app.html';
    if (urlParams.toString()) {
        iframeSrc += '?' + urlParams.toString();
    }
    const iframe = document.getElementById('wavemax-iframe');
    if (iframe) {
        iframe.src = iframeSrc;
    }
})();

// Then add the mobile bridge functionality

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
    let lastScrollPosition = 0;
    let iframe = null;
    let lastIframeHeight = 0;

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
        console.log('[Parent-Iframe Bridge] Current URL:', window.location.href);
        console.log('[Parent-Iframe Bridge] Viewport width:', window.innerWidth);
        
        // Find the iframe - updated to match their iframe ID
        iframe = document.getElementById('wavemax-iframe') ||
                 document.querySelector('iframe[src*="wavemax.promo"]') || 
                 document.querySelector('iframe#wavemax-affiliate-iframe');
        
        if (!iframe) {
            console.warn('[Parent-Iframe Bridge] No WaveMAX iframe found');
            console.log('[Parent-Iframe Bridge] Available iframes:', document.querySelectorAll('iframe'));
            return;
        }
        
        console.log('[Parent-Iframe Bridge] Found iframe:', iframe.id, iframe.src);
        
        // Always hide the page header element immediately
        hidePageHeader();
        
        // Remove padding and borders from iframe container for all embedded content
        removeContainerPaddingAndBorders();

        // Set up viewport detection
        detectViewport();
        window.addEventListener('resize', debounce(detectViewport, 250));
        window.addEventListener('orientationchange', detectViewport);
        
        // If mobile is detected on init, hide chrome immediately
        if (isMobile || isTablet) {
            console.log('[Parent-Iframe Bridge] Mobile/tablet detected on init, hiding chrome');
            hideChrome();
        }

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

    function hidePageHeader() {
        // Find and hide the specific page header element
        const pageHeader = document.querySelector('section.page-header.page-header-modern.bg-color-light-scale-1.page-header-sm');
        if (pageHeader) {
            console.log('[Parent-Iframe Bridge] Hiding page header element');
            pageHeader.style.display = 'none';
            pageHeader.setAttribute('data-permanently-hidden', 'true');
        } else {
            console.log('[Parent-Iframe Bridge] Page header element not found');
        }
    }
    
    function removeContainerPaddingAndBorders() {
        console.log('[Parent-Iframe Bridge] Removing container padding and borders for all embedded content');
        
        // Find the iframe's parent containers
        if (iframe) {
            let parent = iframe.parentElement;
            while (parent && parent !== document.body) {
                // Remove padding, borders and set full width with !important
                parent.style.cssText += `
                    padding: 0 !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    padding-top: 0 !important;
                    padding-bottom: 0 !important;
                    margin: 0 !important;
                    margin-left: 0 !important;
                    margin-right: 0 !important;
                    margin-top: 0 !important;
                    margin-bottom: 0 !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    border: none !important;
                    border-width: 0 !important;
                    border-style: none !important;
                    box-shadow: none !important;
                `;
                
                // Log what we're modifying
                console.log('[Parent-Iframe Bridge] Removed padding and borders from:', 
                    parent.id || parent.className || 'unnamed element');
                
                parent = parent.parentElement;
            }
            
            // Note: We're NOT removing padding from body and html anymore
            // as this was too aggressive and affected the host page
        }
        
        // Style the iframe itself
        if (iframe) {
            iframe.style.cssText += `
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                padding: 0 !important;
                border: none !important;
                display: block !important;
            `;
            
            // Special handling for iframe's immediate parent
            const iframeParent = iframe.parentElement;
            if (iframeParent) {
                iframeParent.style.cssText += `
                    padding-top: 0 !important;
                    margin-top: 0 !important;
                    line-height: 0 !important;
                    font-size: 0 !important;
                `;
                
                // Reset after a moment to not affect other content
                setTimeout(() => {
                    iframeParent.style.lineHeight = '';
                    iframeParent.style.fontSize = '';
                }, 100);
            }
        }
        
        // Target only containers that are direct parents of the iframe
        const iframeContainers = [];
        let temp = iframe ? iframe.parentElement : null;
        while (temp && temp !== document.body) {
            iframeContainers.push(temp);
            temp = temp.parentElement;
        }
        
        // Only process containers that are actually parents of the iframe
        const containers = iframeContainers;
        containers.forEach(container => {
            // First remove any inline styles
            container.style.removeProperty('max-width');
            container.style.removeProperty('padding');
            container.style.removeProperty('padding-left');
            container.style.removeProperty('padding-right');
            container.style.removeProperty('padding-top');
            container.style.removeProperty('padding-bottom');
            container.style.removeProperty('margin');
            container.style.removeProperty('margin-left');
            container.style.removeProperty('margin-right');
            container.style.removeProperty('margin-top');
            container.style.removeProperty('margin-bottom');
            container.style.removeProperty('border');
            container.style.removeProperty('border-width');
            container.style.removeProperty('box-shadow');
            
            // Then apply our styles
            container.style.cssText += `
                padding: 0 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                margin: 0 !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                border: none !important;
                border-width: 0 !important;
                border-style: none !important;
                box-shadow: none !important;
            `;
            
            // Force reflow to ensure styles are applied
            container.offsetHeight;
        });
        
        // Also inject a style tag to override any CSS rules
        const styleTag = document.createElement('style');
        styleTag.id = 'wavemax-iframe-overrides';
        styleTag.innerHTML = `
            /* Force full-width and remove borders ONLY for iframe containers */
            #wavemax-iframe {
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                width: 100% !important;
                max-width: 100% !important;
                display: block !important;
            }
            
            /* Target only direct parent containers of the iframe */
            :has(> #wavemax-iframe),
            :has(> :has(> #wavemax-iframe)),
            :has(> :has(> :has(> #wavemax-iframe))) {
                padding: 0 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                margin: 0 !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                border: none !important;
                border-width: 0 !important;
                border-style: none !important;
                border-color: transparent !important;
                box-shadow: none !important;
            }
            
            /* Remove any margin/padding specifically from iframe's immediate parent */
            #wavemax-iframe:first-child {
                margin-top: 0 !important;
            }
            
            /* Only target containers that are ancestors of the iframe */
            .container:has(#wavemax-iframe),
            .container-fluid:has(#wavemax-iframe) {
                padding-left: 0 !important;
                padding-right: 0 !important;
                max-width: 100% !important;
            }
            
            body #wavemax-iframe {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                display: block !important;
                border: none !important;
                border-width: 0 !important;
                box-shadow: none !important;
            }
            
            /* Remove borders from iframe itself */
            #wavemax-iframe {
                border: none !important;
                box-shadow: none !important;
            }
            
            /* Override any max-width on containers */
            @media (min-width: 576px) {
                body .container, body .container-sm { max-width: 100% !important; }
            }
            @media (min-width: 768px) {
                body .container, body .container-sm, body .container-md { max-width: 100% !important; }
            }
            @media (min-width: 992px) {
                body .container, body .container-sm, body .container-md, body .container-lg { max-width: 100% !important; }
            }
            @media (min-width: 1200px) {
                body .container, body .container-sm, body .container-md, body .container-lg, body .container-xl { max-width: 100% !important; }
            }
            @media (min-width: 1400px) {
                body .container, body .container-sm, body .container-md, body .container-lg, body .container-xl, body .container-xxl { max-width: 100% !important; }
            }
        `;
        document.head.appendChild(styleTag);
        console.log('[Parent-Iframe Bridge] Injected override styles');
        
        // Only remove top spacing from iframe's immediate parent after styles are injected
        setTimeout(() => {
            if (iframe && iframe.parentElement) {
                const parent = iframe.parentElement;
                const computed = window.getComputedStyle(parent);
                const paddingTop = computed.paddingTop;
                const marginTop = computed.marginTop;
                
                if (paddingTop !== '0px' || marginTop !== '0px') {
                    console.log('[Parent-Iframe Bridge] Found spacing on iframe parent:', parent, 'padding-top:', paddingTop, 'margin-top:', marginTop);
                    parent.style.setProperty('padding-top', '0', 'important');
                    parent.style.setProperty('margin-top', '0', 'important');
                }
            }
        }, 100);
    }

    function detectViewport() {
        const width = window.innerWidth;
        const oldMobile = isMobile;
        const oldTablet = isTablet;

        isMobile = width < MOBILE_BREAKPOINT;
        isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
        
        console.log('[Parent-Iframe Bridge] Viewport detected:', {
            width: width,
            isMobile: isMobile,
            isTablet: isTablet,
            isDesktop: !isMobile && !isTablet
        });

        // If viewport category changed, update iframe
        if (oldMobile !== isMobile || oldTablet !== isTablet) {
            console.log('[Parent-Iframe Bridge] Viewport category changed, sending update');
            sendViewportInfo();
            
            // Show chrome again if switching from mobile to desktop
            if (oldMobile && !isMobile && chromeHidden) {
                showChrome();
            }
        }
    }

    function sendViewportInfo() {
        if (!iframe) {
            console.log('[Parent-Iframe Bridge] sendViewportInfo: No iframe found');
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
        
        console.log('[Parent-Iframe Bridge] Sending viewport info:', info.data);

        // Try to send to iframe
        try {
            iframe.contentWindow.postMessage(info, '*');
            console.log('[Parent-Iframe Bridge] Viewport info sent successfully');
        } catch (e) {
            console.error('[Parent-Iframe Bridge] Failed to send viewport info:', e);
        }
    }

    function handleMessage(event) {
        console.log('[Parent-Iframe Bridge] Message received from:', event.origin);
        console.log('[Parent-Iframe Bridge] Message data:', event.data);
        
        // Security check
        const originCheck = ALLOWED_ORIGINS.some(origin => event.origin.includes(origin.replace(/^https?:\/\//, '')));
        console.log('[Parent-Iframe Bridge] Origin allowed?', originCheck, 'checking against:', ALLOWED_ORIGINS);
        
        if (!originCheck) {
            console.log('[Parent-Iframe Bridge] Message rejected - origin not allowed');
            return;
        }

        if (!event.data || !event.data.type) {
            console.log('[Parent-Iframe Bridge] Message rejected - no data or type');
            return;
        }

        console.log('[Parent-Iframe Bridge] Processing message type:', event.data.type);

        switch (event.data.type) {
            case 'hide-chrome':
                console.log('[Parent-Iframe Bridge] Hide chrome requested. isMobile:', isMobile, 'isTablet:', isTablet);
                if (isMobile || isTablet) {
                    hideChrome();
                } else {
                    console.log('[Parent-Iframe Bridge] Hide chrome ignored - not mobile/tablet');
                }
                break;
                
            case 'show-chrome':
                console.log('[Parent-Iframe Bridge] Show chrome requested');
                showChrome();
                break;
                
            case 'resize':
                // Existing resize functionality
                if (event.data.data && event.data.data.height) {
                    console.log('[Parent-Iframe Bridge] Resize requested:', event.data.data.height);
                    resizeIframe(event.data.data.height);
                }
                break;
                
            case 'scroll-to-top':
                console.log('[Parent-Iframe Bridge] Scroll to top requested');
                smoothScrollToTop();
                break;
                
            case 'route-changed':
                console.log('[Parent-Iframe Bridge] Route changed. chromeHidden:', chromeHidden, 'isMobile:', isMobile);
                // On mobile, always keep chrome hidden
                if (isMobile && !chromeHidden) {
                    console.log('[Parent-Iframe Bridge] Route changed on mobile, hiding chrome');
                    hideChrome();
                }
                // On desktop, show chrome if it was hidden
                else if (!isMobile && chromeHidden) {
                    console.log('[Parent-Iframe Bridge] Route changed on desktop, showing chrome');
                    showChrome();
                }
                break;
                
            default:
                console.log('[Parent-Iframe Bridge] Unknown message type:', event.data.type);
        }
    }

    function hideChrome() {
        if (chromeHidden) {
            console.log('[Parent-Iframe Bridge] hideChrome: Already hidden, skipping');
            return;
        }

        console.log('[Parent-Iframe Bridge] hideChrome: Starting to hide header/footer');
        
        // Find all elements to hide - WaveMAX CMS specific selectors
        const topbar = document.querySelector('.topbar');
        const wrapper = document.querySelector('.wrapper');
        const header = document.querySelector('.navbar');
        const pageHeader = document.querySelector('.page-header');
        const footer = document.querySelector('.footer');
        
        console.log('[Parent-Iframe Bridge] Elements found:', {
            topbar: !!topbar,
            wrapper: !!wrapper,
            navbar: !!header,
            pageHeader: !!pageHeader,
            footer: !!footer
        });
        
        // Store scroll position
        lastScrollPosition = window.pageYOffset;

        // Hide topbar
        if (topbar) {
            topbar.style.display = 'none';
            topbar.setAttribute('data-mobile-hidden', 'true');
        }

        // Hide wrapper (contains navbar) or navbar directly
        if (wrapper) {
            wrapper.style.display = 'none';
            wrapper.setAttribute('data-mobile-hidden', 'true');
        } else if (header) {
            // Fallback if wrapper not found
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
        
        // Find all hidden elements
        const topbar = document.querySelector('.topbar[data-mobile-hidden="true"]');
        const wrapper = document.querySelector('.wrapper[data-mobile-hidden="true"]');
        const header = document.querySelector('.navbar[data-mobile-hidden="true"]');
        const pageHeader = document.querySelector('.page-header[data-mobile-hidden="true"]:not([data-permanently-hidden="true"])');
        const footer = document.querySelector('.footer[data-mobile-hidden="true"]');

        // Show topbar
        if (topbar) {
            topbar.style.display = '';
            topbar.removeAttribute('data-mobile-hidden');
        }

        // Show wrapper or header
        if (wrapper) {
            wrapper.style.display = '';
            wrapper.removeAttribute('data-mobile-hidden');
        } else if (header) {
            header.style.transform = 'translateY(0)';
            setTimeout(() => {
                header.removeAttribute('data-mobile-hidden');
            }, 300);
        }

        // Show page header
        if (pageHeader) {
            pageHeader.style.display = '';
            pageHeader.removeAttribute('data-mobile-hidden');
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
        
        // Don't add padding here - the iframe already includes padding
        const newHeight = parseInt(height);
        
        // Only update if height actually changed (with 5px tolerance)
        if (Math.abs(newHeight - lastIframeHeight) > 5) {
            console.log('[Parent-Iframe Bridge] Setting iframe height to:', newHeight, '(was:', lastIframeHeight, ')');
            lastIframeHeight = newHeight;
            iframe.style.height = newHeight + 'px';
        } else {
            console.log('[Parent-Iframe Bridge] Ignoring resize - height unchanged');
        }
        
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
</script>