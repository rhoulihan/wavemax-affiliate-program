// Parent-Iframe Bridge V2 - Runs on wavemaxlaundry.com
// Structured system for communicating with embedded iframes
(function() {
    'use strict';

    console.log('[Parent Bridge V2] Initializing...');

    // Configuration
    const ALLOWED_ORIGINS = [
        'https://wavemax.promo',
        'https://affiliate.wavemax.promo',
        'http://localhost:3000'
    ];

    let iframe = null;
    let lastIframeHeight = 0;

    // Initialize
    function init() {
        console.log('[Parent Bridge V2] Starting initialization');

        // Find the iframe
        iframe = document.getElementById('wavemax-iframe') ||
                 document.querySelector('iframe[src*="wavemax.promo"]');

        if (!iframe) {
            console.warn('[Parent Bridge V2] No WaveMAX iframe found');
            return;
        }

        console.log('[Parent Bridge V2] Found iframe:', iframe.id, iframe.src);

        // Execute global actions
        executeGlobalActions();

        // Set up message listener
        window.addEventListener('message', handleMessage);

        // Set up language monitoring
        setupLanguageMonitoring();

        // Notify iframe that parent is ready
        setTimeout(() => {
            sendToIframe({
                type: 'parent-ready'
            });
        }, 500);

        console.log('[Parent Bridge V2] Initialized successfully');
    }

    // Global actions - These run for ALL embedded pages
    const globalActions = {
        // Action 1: Hide the page header
        hidePageHeader: function() {
            const pageHeader = document.querySelector('section.page-header.page-header-modern.bg-color-light-scale-1.page-header-sm');
            if (pageHeader) {
                console.log('[Parent Bridge V2] Hiding page header');
                pageHeader.style.setProperty('display', 'none', 'important');
                pageHeader.style.setProperty('visibility', 'hidden', 'important');
                pageHeader.style.setProperty('height', '0', 'important');
                pageHeader.style.setProperty('margin', '0', 'important');
                pageHeader.style.setProperty('padding', '0', 'important');
                pageHeader.style.setProperty('overflow', 'hidden', 'important');
                pageHeader.setAttribute('data-permanently-hidden', 'true');

                // Keep it hidden with mutation observer
                const observer = new MutationObserver(() => {
                    if (pageHeader.style.display !== 'none') {
                        pageHeader.style.setProperty('display', 'none', 'important');
                        pageHeader.style.setProperty('visibility', 'hidden', 'important');
                        pageHeader.style.setProperty('height', '0', 'important');
                        pageHeader.style.setProperty('margin', '0', 'important');
                        pageHeader.style.setProperty('padding', '0', 'important');
                        pageHeader.style.setProperty('overflow', 'hidden', 'important');
                    }
                });

                observer.observe(pageHeader, {
                    attributes: true,
                    attributeFilter: ['style']
                });
            }
        },

        // Action 2: Remove container padding
        removeContainerPadding: function() {
            if (!iframe) return;

            iframe.style.cssText += `
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                display: block !important;
            `;

            // Inject CSS for container padding removal
            const styleTag = document.createElement('style');
            styleTag.id = 'wavemax-iframe-overrides-v2';
            styleTag.innerHTML = `
                /* Hide permanently hidden elements */
                [data-permanently-hidden="true"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                }

                /* Page header hiding */
                section.page-header.page-header-modern.bg-color-light-scale-1.page-header-sm {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                }

                /* Iframe styling */
                #wavemax-iframe {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    display: block !important;
                }

                /* Remove padding from containers */
                *:has(> #wavemax-iframe),
                *:has(> *:has(> #wavemax-iframe)),
                *:has(> *:has(> *:has(> #wavemax-iframe))) {
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                }

                .container:has(#wavemax-iframe),
                .container-fluid:has(#wavemax-iframe) {
                    max-width: 100% !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                }
            `;
            document.head.appendChild(styleTag);
        }
    };

    // Execute all global actions
    function executeGlobalActions() {
        console.log('[Parent Bridge V2] Executing global actions...');

        Object.keys(globalActions).forEach(actionName => {
            try {
                globalActions[actionName]();
                console.log('[Parent Bridge V2] Global action executed:', actionName);
            } catch (error) {
                console.error('[Parent Bridge V2] Error executing global action:', actionName, error);
            }
        });
    }

    // Handle messages from iframe
    function handleMessage(event) {
        // Security check
        if (!ALLOWED_ORIGINS.some(origin => event.origin.includes(origin.replace(/^https?:\/\//, '')))) {
            return;
        }

        if (!event.data || !event.data.type) {
            return;
        }

        const { type, data } = event.data;
        console.log('[Parent Bridge V2] Received from iframe:', type);

        switch (type) {
            case 'iframe-ready':
                handleIframeReady(data);
                break;

            case 'hide-page-header':
                globalActions.hidePageHeader();
                break;

            case 'request-language':
                sendCurrentLanguage();
                break;

            case 'resize':
                if (data && data.height) {
                    resizeIframe(data.height);
                }
                break;

            default:
                console.log('[Parent Bridge V2] Unknown message type:', type);
        }
    }

    // Send message to iframe
    function sendToIframe(message) {
        if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.postMessage(message, '*');
            } catch (e) {
                console.error('[Parent Bridge V2] Failed to send message:', e);
            }
        }
    }

    // Handle iframe ready
    function handleIframeReady(data) {
        console.log('[Parent Bridge V2] Iframe ready:', data);

        // Send current language
        sendCurrentLanguage();
    }

    // Language monitoring
    function setupLanguageMonitoring() {
        // Get initial language
        const currentLanguage = localStorage.getItem('wavemax-language') || 'en';

        // Monitor for changes
        let lastLanguage = currentLanguage;
        setInterval(() => {
            const newLanguage = localStorage.getItem('wavemax-language') || 'en';
            if (newLanguage !== lastLanguage) {
                lastLanguage = newLanguage;
                console.log('[Parent Bridge V2] Language changed to:', newLanguage);
                sendLanguageChange(newLanguage);
            }
        }, 500);

        // Listen for storage events
        window.addEventListener('storage', (e) => {
            if (e.key === 'wavemax-language') {
                const newLanguage = e.newValue || 'en';
                sendLanguageChange(newLanguage);
            }
        });

        // Listen for custom language change events
        window.addEventListener('languageChanged', (e) => {
            const language = e.detail?.language || 'en';
            sendLanguageChange(language);
        });
    }

    function sendCurrentLanguage() {
        const language = localStorage.getItem('wavemax-language') || 'en';
        sendToIframe({
            type: 'current-language',
            data: { language }
        });
    }

    function sendLanguageChange(language) {
        sendToIframe({
            type: 'language-change',
            data: { language }
        });
    }

    // Resize iframe
    function resizeIframe(height) {
        if (!iframe) return;

        const newHeight = parseInt(height);

        if (Math.abs(newHeight - lastIframeHeight) > 5) {
            lastIframeHeight = newHeight;
            iframe.style.height = newHeight + 'px';
        }
    }

    // Public API
    window.WaveMaxBridgeV2 = {
        sendToIframe: sendToIframe,
        resizeIframe: resizeIframe,
        getCurrentLanguage: () => localStorage.getItem('wavemax-language') || 'en',
        setLanguage: (language) => {
            localStorage.setItem('wavemax-language', language);
            sendLanguageChange(language);
        }
    };

    // Setup language selector integration with existing dropdown
    function setupLanguageSelector() {
        console.log('[Parent Bridge V2] Setting up language selector integration');

        // Wait for the page's language selector to be ready
        setTimeout(() => {
            // Find the dropdown list
            const dropdownList = document.querySelector('.dropdown-cs');

            if (dropdownList) {
                console.log('[Parent Bridge V2] Found Google Translate dropdown:', dropdownList);

                // Fix dropdown positioning and ensure it's not cut off
                dropdownList.style.cssText += `
                    position: absolute !important;
                    z-index: 9999 !important;
                    min-width: 120px !important;
                    overflow: visible !important;
                `;

                // Standardize size for all existing flag images
                const existingImages = dropdownList.querySelectorAll('img');
                existingImages.forEach(img => {
                    img.style.width = '24px';
                    img.style.height = 'auto';
                    img.style.display = 'inline-block';
                    img.style.verticalAlign = 'middle';
                });

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

                    const brazilFlagSources = [
                        '/assets/WaveMax/images/brazil.png',
                        'https://flagcdn.com/24x18/br.png',
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14"%3E%3Crect width="20" height="14" fill="%23009b3a"/%3E%3Cpath d="M10 2L2 7l8 5 8-5z" fill="%23fedf00"/%3E%3Ccircle cx="10" cy="7" r="2.5" fill="%23002776"/%3E%3C/svg%3E'
                    ];

                    ptImg.src = brazilFlagSources[0];

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
                    console.log('[Parent Bridge V2] Added Portuguese option');
                }

                // Add German if not present
                if (!hasGerman) {
                    const deItem = document.createElement('li');
                    const deImg = document.createElement('img');

                    const germanFlagSources = [
                        '/assets/WaveMax/images/germany.png',
                        'https://flagcdn.com/24x18/de.png',
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14"%3E%3Crect width="20" height="4.67" fill="%23000"/%3E%3Crect y="4.67" width="20" height="4.67" fill="%23d00"/%3E%3Crect y="9.33" width="20" height="4.67" fill="%23ffce00"/%3E%3C/svg%3E'
                    ];

                    deImg.src = germanFlagSources[0];

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
                    console.log('[Parent Bridge V2] Added German option');
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
                            console.log('[Parent Bridge V2] Google Translate language changed to:', targetLang);

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
                    console.log('[Parent Bridge V2] Successfully hooked into doGTranslate');
                }
            } else {
                console.log('[Parent Bridge V2] Google Translate dropdown not found, will try again');

                // Try again in case it loads later
                setTimeout(() => {
                    setupLanguageSelector();
                }, 2000);
            }
        }, 500);
    }

    // Public API
    window.WaveMaxBridgeV2 = {
        sendToIframe: sendToIframe,
        resizeIframe: resizeIframe,
        getCurrentLanguage: () => localStorage.getItem('wavemax-language') || 'en',
        setLanguage: (language) => {
            localStorage.setItem('wavemax-language', language);
            sendLanguageChange(language);
        },
        setupLanguageSelector: setupLanguageSelector
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also initialize after window load
    window.addEventListener('load', () => {
        if (!iframe) {
            init();
        }
        // Setup language selector integration after page loads
        setupLanguageSelector();
    });

})();
