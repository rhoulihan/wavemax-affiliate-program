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
                pageHeader.setAttribute('data-permanently-hidden', 'true');

                // Keep it hidden with mutation observer
                const observer = new MutationObserver(() => {
                    if (pageHeader.style.display !== 'none') {
                        pageHeader.style.setProperty('display', 'none', 'important');
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
    });

})();
