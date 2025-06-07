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
            // Find the dropdown list
            const dropdownList = document.querySelector('.dropdown-cs');
            
            if (dropdownList) {
                console.log('[Parent-Iframe Bridge] Found Google Translate dropdown:', dropdownList);
                
                // Check existing language options
                const existingItems = dropdownList.querySelectorAll('li');
                const hasPortuguese = Array.from(existingItems).some(item => {
                    const onclick = item.querySelector('img')?.getAttribute('onclick') || '';
                    return onclick.includes('|pt');
                });
                const hasGerman = Array.from(existingItems).some(item => {
                    const onclick = item.querySelector('img')?.getAttribute('onclick') || '';
                    return onclick.includes('|de');
                });
                
                // Add Portuguese if not present
                if (!hasPortuguese) {
                    const ptItem = document.createElement('li');
                    const ptImg = document.createElement('img');
                    
                    // Try multiple sources for the Brazil flag
                    const brazilFlagSources = [
                        '/assets/WaveMax/images/brazil.png',
                        'https://flagcdn.com/24x18/br.png',
                        'https://www.countryflags.io/br/flat/32.png',
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14"%3E%3Crect width="20" height="14" fill="%23009b3a"/%3E%3Cpath d="M10 2L2 7l8 5 8-5z" fill="%23fedf00"/%3E%3Ccircle cx="10" cy="7" r="2.5" fill="%23002776"/%3E%3C/svg%3E'
                    ];
                    
                    // Set initial source
                    ptImg.src = brazilFlagSources[0];
                    
                    // Handle image load error by trying alternative sources
                    let sourceIndex = 0;
                    ptImg.onerror = function() {
                        sourceIndex++;
                        if (sourceIndex < brazilFlagSources.length) {
                            this.src = brazilFlagSources[sourceIndex];
                        }
                    };
                    
                    ptImg.alt = 'Portuguese';
                    ptImg.setAttribute('onclick', "doGTranslate('en|pt');FixBodyTop();return false;");
                    ptImg.style.cursor = 'pointer';
                    ptImg.style.width = '24px';
                    ptImg.style.height = 'auto';
                    ptItem.appendChild(ptImg);
                    dropdownList.appendChild(ptItem);
                    console.log('[Parent-Iframe Bridge] Added Portuguese option');
                }
                
                // Add German if not present
                if (!hasGerman) {
                    const deItem = document.createElement('li');
                    const deImg = document.createElement('img');
                    
                    // Try multiple sources for the German flag
                    const germanFlagSources = [
                        '/assets/WaveMax/images/germany.png',
                        'https://flagcdn.com/24x18/de.png',
                        'https://www.countryflags.io/de/flat/32.png',
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14"%3E%3Crect width="20" height="4.67" fill="%23000"/%3E%3Crect y="4.67" width="20" height="4.67" fill="%23d00"/%3E%3Crect y="9.33" width="20" height="4.67" fill="%23ffce00"/%3E%3C/svg%3E'
                    ];
                    
                    // Set initial source
                    deImg.src = germanFlagSources[0];
                    
                    // Handle image load error by trying alternative sources
                    let sourceIndex = 0;
                    deImg.onerror = function() {
                        sourceIndex++;
                        if (sourceIndex < germanFlagSources.length) {
                            this.src = germanFlagSources[sourceIndex];
                        }
                    };
                    
                    deImg.alt = 'German';
                    deImg.setAttribute('onclick', "doGTranslate('en|de');FixBodyTop();return false;");
                    deImg.style.cursor = 'pointer';
                    deImg.style.width = '24px';
                    deImg.style.height = 'auto';
                    deItem.appendChild(deImg);
                    dropdownList.appendChild(deItem);
                    console.log('[Parent-Iframe Bridge] Added German option');
                }
                
                // Hook into the doGTranslate function to capture language changes
                const originalDoGTranslate = window.doGTranslate;
                if (originalDoGTranslate) {
                    window.doGTranslate = function(pair) {
                        // Call the original function
                        originalDoGTranslate(pair);
                        
                        // Extract the target language from the pair (e.g., 'en|es' -> 'es')
                        const targetLang = pair.split('|')[1];
                        if (targetLang) {
                            console.log('[Parent-Iframe Bridge] Google Translate language changed to:', targetLang);
                            
                            // Save to localStorage
                            localStorage.setItem('wavemax-language', targetLang);
                            
                            // Send language change to iframe
                            sendLanguageChange(targetLang);
                            
                            // Dispatch custom event
                            window.dispatchEvent(new CustomEvent('languageChanged', {
                                detail: { language: targetLang }
                            }));
                        }
                    };
                    console.log('[Parent-Iframe Bridge] Successfully hooked into doGTranslate');
                }
                
                // Also add click listeners to the images for extra safety
                dropdownList.querySelectorAll('img').forEach(img => {
                    img.addEventListener('click', function() {
                        const onclick = this.getAttribute('onclick') || '';
                        const match = onclick.match(/doGTranslate\('en\|(\w+)'\)/);
                        if (match && match[1]) {
                            const lang = match[1];
                            console.log('[Parent-Iframe Bridge] Language clicked:', lang);
                            
                            setTimeout(() => {
                                // Save to localStorage
                                localStorage.setItem('wavemax-language', lang);
                                
                                // Send language change to iframe
                                sendLanguageChange(lang);
                            }, 100); // Small delay to let Google Translate process
                        }
                    });
                });
                
                console.log('[Parent-Iframe Bridge] Successfully integrated with Google Translate dropdown');
            } else {
                console.log('[Parent-Iframe Bridge] Google Translate dropdown not found, will try again');
                
                // Try again in case it loads later
                setTimeout(() => {
                    setupLanguageSelector();
                }, 2000);
            }
        }, 500);
    }
    
    function createSimpleLanguageSelector() {
        // Only create if not already exists
        if (document.getElementById('wavemax-simple-language-selector')) {
            return;
        }
        
        console.log('[Parent-Iframe Bridge] Creating simple language selector');
        
        const selector = document.createElement('select');
        selector.id = 'wavemax-simple-language-selector';
        selector.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
        `;
        
        const languages = [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Español' },
            { code: 'pt', name: 'Português' },
            { code: 'de', name: 'Deutsch' }
        ];
        
        const currentLang = localStorage.getItem('wavemax-language') || 'en';
        
        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.textContent = lang.name;
            option.selected = lang.code === currentLang;
            selector.appendChild(option);
        });
        
        selector.addEventListener('change', function(e) {
            const langCode = e.target.value;
            console.log('[Parent-Iframe Bridge] Language changed to:', langCode);
            
            // Save to localStorage
            localStorage.setItem('wavemax-language', langCode);
            
            // Send language change to iframe
            sendLanguageChange(langCode);
            
            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language: langCode }
            }));
        });
        
        document.body.appendChild(selector);
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
                
                // Update simple selector if it exists
                const simpleSelector = document.getElementById('wavemax-simple-language-selector');
                if (simpleSelector && simpleSelector.value !== newLanguage) {
                    simpleSelector.value = newLanguage;
                }
            }
        }, 500);
        
        // Also listen for storage events (cross-tab changes)
        window.addEventListener('storage', function(e) {
            if (e.key === 'wavemax-language') {
                const newLanguage = e.newValue || 'en';
                console.log('[Parent-Iframe Bridge] Language changed via storage event:', newLanguage);
                sendLanguageChange(newLanguage);
                
                // Update simple selector if it exists
                const simpleSelector = document.getElementById('wavemax-simple-language-selector');
                if (simpleSelector && simpleSelector.value !== newLanguage) {
                    simpleSelector.value = newLanguage;
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