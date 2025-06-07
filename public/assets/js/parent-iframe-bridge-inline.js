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

        // Set up language selector and monitoring
        setupLanguageSelector();
        setupLanguageMonitoring();

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
        
        // Style the iframe itself
        if (iframe) {
            iframe.style.cssText += `
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                display: block !important;
            `;
            
            // Walk up the DOM tree from iframe to remove padding, but only within reason
            let currentElement = iframe.parentElement;
            let levelsUp = 0;
            const maxLevels = 5; // Only go up 5 levels max
            
            while (currentElement && levelsUp < maxLevels) {
                // Check if this element has padding or is a container
                const computedStyle = window.getComputedStyle(currentElement);
                const hasHorizontalPadding = parseFloat(computedStyle.paddingLeft) > 0 || parseFloat(computedStyle.paddingRight) > 0;
                const isContainer = currentElement.classList.contains('container') || 
                                  currentElement.classList.contains('container-fluid') ||
                                  currentElement.classList.contains('container-lg') ||
                                  currentElement.classList.contains('container-xl');
                
                // Only modify if it has padding or is a Bootstrap container
                if (hasHorizontalPadding || isContainer) {
                    currentElement.style.cssText += `
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                    `;
                    console.log('[Parent-Iframe Bridge] Removed padding from element:', currentElement.className || currentElement.tagName);
                }
                
                // Stop if we hit the main content area or body
                if (currentElement.tagName === 'BODY' || 
                    currentElement.classList.contains('main') ||
                    currentElement.id === 'main') {
                    break;
                }
                
                currentElement = currentElement.parentElement;
                levelsUp++;
            }
        }
        
        // Inject targeted CSS for common Bootstrap containers and Porto theme elements
        const styleTag = document.createElement('style');
        styleTag.id = 'wavemax-iframe-overrides';
        styleTag.innerHTML = `
            /* Target the iframe */
            #wavemax-iframe {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                display: block !important;
            }
            
            /* Target containers that contain our iframe - more specific selectors */
            #wavemax-iframe,
            *:has(> #wavemax-iframe) {
                max-width: 100% !important;
                width: 100% !important;
            }
            
            /* Remove padding from any parent containers up to 3 levels */
            *:has(> #wavemax-iframe),
            *:has(> *:has(> #wavemax-iframe)),
            *:has(> *:has(> *:has(> #wavemax-iframe))) {
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
            
            /* Target common Bootstrap container classes when they contain our iframe */
            .container:has(#wavemax-iframe),
            .container-fluid:has(#wavemax-iframe),
            .container-lg:has(#wavemax-iframe),
            .container-xl:has(#wavemax-iframe),
            .container-xxl:has(#wavemax-iframe) {
                max-width: 100% !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
            }
            
            /* Porto theme specific - target their content wrapper */
            .page-wrapper:has(#wavemax-iframe) .main,
            .page-wrapper:has(#wavemax-iframe) .main .container,
            .page-wrapper:has(#wavemax-iframe) .main .container-fluid {
                max-width: 100% !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
            
            /* Remove padding from row elements that might contain our iframe */
            .row:has(#wavemax-iframe) {
                margin-left: 0 !important;
                margin-right: 0 !important;
            }
            
            .row:has(#wavemax-iframe) > [class*="col-"] {
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
        `;
        document.head.appendChild(styleTag);
        console.log('[Parent-Iframe Bridge] Injected targeted override styles');
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

        // Get current language from localStorage or default
        const currentLanguage = localStorage.getItem('wavemax-language') || 'en';

        const info = {
            type: 'viewport-info',
            data: {
                width: window.innerWidth,
                height: window.innerHeight,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: !isMobile && !isTablet,
                hasTouch: 'ontouchstart' in window,
                orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
                language: currentLanguage
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

    function setupLanguageSelector() {
        console.log('[Parent-Iframe Bridge] Setting up language selector integration');
        
        // Wait a bit for the page's language selector to be ready
        setTimeout(() => {
            // Find the existing language selector on the page
            // Common selectors for language dropdowns
            const existingSelector = document.querySelector('select[name="language"]') || 
                                   document.querySelector('select#language') ||
                                   document.querySelector('.language-selector select') ||
                                   document.querySelector('[data-language-selector]') ||
                                   document.querySelector('select[data-switcher-options]') ||
                                   document.querySelector('.wpml-ls-legacy-dropdown select') ||
                                   document.querySelector('.qtranxs_language_chooser');
            
            if (existingSelector) {
                console.log('[Parent-Iframe Bridge] Found existing language selector:', existingSelector);
                
                // Check if Portuguese and German options already exist
                const options = Array.from(existingSelector.options);
                const hasPortuguese = options.some(opt => opt.value === 'pt' || opt.value === 'pt-BR' || opt.value === 'pt_BR');
                const hasGerman = options.some(opt => opt.value === 'de' || opt.value === 'de-DE' || opt.value === 'de_DE');
                
                // Add Portuguese if not present
                if (!hasPortuguese) {
                    const ptOption = document.createElement('option');
                    ptOption.value = 'pt';
                    ptOption.textContent = 'Português';
                    existingSelector.appendChild(ptOption);
                    console.log('[Parent-Iframe Bridge] Added Portuguese option');
                }
                
                // Add German if not present
                if (!hasGerman) {
                    const deOption = document.createElement('option');
                    deOption.value = 'de';
                    deOption.textContent = 'Deutsch';
                    existingSelector.appendChild(deOption);
                    console.log('[Parent-Iframe Bridge] Added German option');
                }
                
                // Get current language from localStorage
                const currentLanguage = localStorage.getItem('wavemax-language') || 'en';
                
                // Try to set the current language in the selector
                if (existingSelector.value !== currentLanguage) {
                    // Try different possible values
                    const possibleValues = [currentLanguage, currentLanguage.toUpperCase(), currentLanguage + '-' + currentLanguage.toUpperCase()];
                    for (const val of possibleValues) {
                        const option = Array.from(existingSelector.options).find(opt => opt.value === val);
                        if (option) {
                            existingSelector.value = val;
                            break;
                        }
                    }
                }
                
                // Hook into the existing selector's change event
                existingSelector.addEventListener('change', function(e) {
                    // Normalize the language code (handle variations like en-US, en_US, EN, etc.)
                    let langCode = e.target.value.toLowerCase();
                    langCode = langCode.split('-')[0].split('_')[0]; // Get just the language part
                    
                    console.log('[Parent-Iframe Bridge] Existing selector changed to:', langCode);
                    
                    // Save to localStorage
                    localStorage.setItem('wavemax-language', langCode);
                    
                    // Send language change to iframe
                    sendLanguageChange(langCode);
                    
                    // Dispatch custom event
                    window.dispatchEvent(new CustomEvent('languageChanged', {
                        detail: { language: langCode }
                    }));
                });
                
                console.log('[Parent-Iframe Bridge] Successfully integrated with existing language selector');
            } else {
                console.log('[Parent-Iframe Bridge] No existing language selector found on page');
                
                // Try again in case it loads later
                setTimeout(() => {
                    setupLanguageSelector();
                }, 2000);
            }
        }, 500);
    }
    
    function setupLanguageMonitoring() {
        console.log('[Parent-Iframe Bridge] Setting up language monitoring');
        
        // Monitor localStorage for language changes
        let currentLanguage = localStorage.getItem('wavemax-language') || 'en';
        
        // Check for language changes periodically
        setInterval(() => {
            const newLanguage = localStorage.getItem('wavemax-language') || 'en';
            if (newLanguage !== currentLanguage) {
                currentLanguage = newLanguage;
                console.log('[Parent-Iframe Bridge] Language change detected:', newLanguage);
                sendLanguageChange(newLanguage);
                
                // Update existing selector if it exists
                const existingSelector = document.querySelector('select[name="language"]') || 
                                       document.querySelector('select#language') ||
                                       document.querySelector('.language-selector select') ||
                                       document.querySelector('[data-language-selector]') ||
                                       document.querySelector('select[data-switcher-options]');
                if (existingSelector) {
                    // Try to find and select the matching option
                    const option = Array.from(existingSelector.options).find(opt => 
                        opt.value.toLowerCase().startsWith(newLanguage)
                    );
                    if (option) {
                        existingSelector.value = option.value;
                    }
                }
            }
        }, 500);
        
        // Also listen for storage events (cross-tab changes)
        window.addEventListener('storage', function(e) {
            if (e.key === 'wavemax-language') {
                const newLanguage = e.newValue || 'en';
                console.log('[Parent-Iframe Bridge] Language changed via storage event:', newLanguage);
                sendLanguageChange(newLanguage);
                
                // Update existing selector if it exists
                const existingSelector = document.querySelector('select[name="language"]') || 
                                       document.querySelector('select#language') ||
                                       document.querySelector('.language-selector select') ||
                                       document.querySelector('[data-language-selector]') ||
                                       document.querySelector('select[data-switcher-options]');
                if (existingSelector) {
                    // Try to find and select the matching option
                    const option = Array.from(existingSelector.options).find(opt => 
                        opt.value.toLowerCase().startsWith(newLanguage)
                    );
                    if (option) {
                        existingSelector.value = option.value;
                    }
                }
            }
        });
        
        // Listen for custom language change events
        window.addEventListener('languageChanged', function(e) {
            const language = e.detail?.language || localStorage.getItem('wavemax-language') || 'en';
            console.log('[Parent-Iframe Bridge] Language changed via custom event:', language);
            sendLanguageChange(language);
        });
    }
    
    function sendLanguageChange(language) {
        if (!iframe) {
            console.log('[Parent-Iframe Bridge] sendLanguageChange: No iframe found');
            return;
        }

        const info = {
            type: 'language-change',
            data: {
                language: language
            }
        };

        // Try to send to iframe
        try {
            iframe.contentWindow.postMessage(info, '*');
            console.log('[Parent-Iframe Bridge] Language change sent successfully:', language);
        } catch (e) {
            console.error('[Parent-Iframe Bridge] Failed to send language change:', e);
        }
    }

    // Public API
    window.WaveMaxBridge = {
        hideChrome: hideChrome,
        showChrome: showChrome,
        sendViewportInfo: sendViewportInfo,
        sendLanguageChange: sendLanguageChange,
        getViewportInfo: () => ({
            isMobile: isMobile,
            isTablet: isTablet,
            isDesktop: !isMobile && !isTablet,
            chromeHidden: chromeHidden
        }),
        setLanguage: (language) => {
            localStorage.setItem('wavemax-language', language);
            sendLanguageChange(language);
            // Update existing selector if it exists
            const existingSelector = document.querySelector('select[name="language"]') || 
                                   document.querySelector('select#language') ||
                                   document.querySelector('.language-selector select') ||
                                   document.querySelector('[data-language-selector]') ||
                                   document.querySelector('select[data-switcher-options]');
            if (existingSelector) {
                // Try to find and select the matching option
                const option = Array.from(existingSelector.options).find(opt => 
                    opt.value.toLowerCase().startsWith(language)
                );
                if (option) {
                    existingSelector.value = option.value;
                }
            }
            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language: language }
            }));
        }
    };

})();
</script>