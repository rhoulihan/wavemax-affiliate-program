// Iframe Bridge V2 - Runs inside the embedded page
// Structured system with global and per-page actions
(function() {
    'use strict';

    console.log('[Iframe Bridge V2] Initializing...');

    // Configuration
    const config = {
        parentOrigin: 'https://www.wavemaxlaundry.com',
        allowedOrigins: ['https://www.wavemaxlaundry.com', 'https://wavemaxlaundry.com'],
        pageIdentifier: null,
        enableTranslation: true,
        enableAutoResize: true
    };

    // Global translation data structure
    const translations = {
        en: {},
        es: {},
        pt: {},
        de: {}
    };

    let currentLanguage = 'en';
    let parentReady = false;
    let seoConfig = null;

    // Global actions - These run for ALL pages
    const globalActions = {
        // Action 1: Hide page header on parent
        hidePageHeader: function() {
            sendToParent({
                type: 'hide-page-header'
            });
        },

        // Action 2: Initialize translation system
        initializeTranslation: function() {
            // Request current language from parent
            sendToParent({
                type: 'request-language'
            });

            // Apply saved language if exists
            const savedLanguage = localStorage.getItem('selectedLanguage') || 'en';
            if (savedLanguage !== 'en') {
                setLanguage(savedLanguage);
            }
        },

        // Action 3: Send SEO data to parent
        sendSEOData: function() {
            if (seoConfig) {
                console.log('[Iframe Bridge V2] Sending SEO data to parent');
                sendToParent({
                    type: 'seo-data',
                    data: seoConfig
                });
            }
        }
    };

    // Page-specific actions registry
    const pageActions = {};

    // Initialize bridge
    function init(pageConfig) {
        if (pageConfig) {
            Object.assign(config, pageConfig);
        }

        console.log('[Iframe Bridge V2] Config:', config);

        // Set up message listener for parent communication
        window.addEventListener('message', handleParentMessage);

        // Notify parent that iframe is ready
        sendToParent({
            type: 'iframe-ready',
            page: config.pageIdentifier,
            timestamp: Date.now()
        });

        // Execute global actions after a short delay to ensure parent is ready
        setTimeout(executeGlobalActions, 100);

        // Set up auto-resize if enabled
        if (config.enableAutoResize) {
            setupAutoResize();
        }
    }

    // Execute all global actions
    function executeGlobalActions() {
        console.log('[Iframe Bridge V2] Executing global actions...');

        Object.keys(globalActions).forEach(actionName => {
            try {
                globalActions[actionName]();
                console.log('[Iframe Bridge V2] Global action executed:', actionName);
            } catch (error) {
                console.error('[Iframe Bridge V2] Error executing global action:', actionName, error);
            }
        });
    }

    // Execute page-specific actions
    function executePageActions() {
        if (!config.pageIdentifier || !pageActions[config.pageIdentifier]) {
            console.log('[Iframe Bridge V2] No page-specific actions for:', config.pageIdentifier);
            return;
        }

        console.log('[Iframe Bridge V2] Executing page-specific actions for:', config.pageIdentifier);

        const actions = pageActions[config.pageIdentifier];
        Object.keys(actions).forEach(actionName => {
            try {
                actions[actionName]();
                console.log('[Iframe Bridge V2] Page action executed:', actionName);
            } catch (error) {
                console.error('[Iframe Bridge V2] Error executing page action:', actionName, error);
            }
        });
    }

    // Handle messages from parent
    function handleParentMessage(event) {
        // Verify origin
        if (!config.allowedOrigins.some(origin => event.origin.includes(origin.replace(/^https?:\/\//, '')))) {
            console.warn('[Iframe Bridge V2] Message from unauthorized origin:', event.origin);
            return;
        }

        const { type, data } = event.data;
        console.log('[Iframe Bridge V2] Received from parent:', type, data);

        switch (type) {
            case 'parent-ready':
                handleParentReady();
                break;

            case 'language-change':
                if (data && data.language) {
                    setLanguage(data.language);
                }
                break;

            case 'current-language':
                if (data && data.language) {
                    setLanguage(data.language);
                }
                break;

            default:
                // Allow page-specific handlers
                if (window.iframeBridgeHandlers && window.iframeBridgeHandlers[type]) {
                    window.iframeBridgeHandlers[type](data);
                }
        }
    }

    // Send message to parent
    function sendToParent(message) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage(message, config.parentOrigin);
        }
    }

    // Handle parent ready
    function handleParentReady() {
        console.log('[Iframe Bridge V2] Parent is ready');
        parentReady = true;

        // Execute page-specific actions now that parent is ready
        executePageActions();

        // Send initial content height
        updateHeight();
    }

    // Translation functions
    function setLanguage(language) {
        if (!translations[language]) {
            console.warn('[Iframe Bridge V2] Unsupported language:', language);
            return;
        }

        currentLanguage = language;
        console.log('[Iframe Bridge V2] Language set to:', language);

        // Save to localStorage
        localStorage.setItem('selectedLanguage', language);

        // Translate the page
        translatePage();

        // Notify listeners
        window.dispatchEvent(new CustomEvent('language-changed', {
            detail: { language }
        }));
    }

    function translatePage() {
        console.log('[Iframe Bridge V2] Translating page to:', currentLanguage);

        // Translate elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = getTranslation(key);

            if (translation) {
                // Check if element has data-i18n-html attribute to preserve HTML
                if (element.hasAttribute('data-i18n-html')) {
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });

        // Translate attributes
        const attrElements = document.querySelectorAll('[data-i18n-attr]');
        attrElements.forEach(element => {
            const attrData = element.getAttribute('data-i18n-attr');
            try {
                const attrs = JSON.parse(attrData);
                Object.keys(attrs).forEach(attr => {
                    const translation = getTranslation(attrs[attr]);
                    if (translation) {
                        element.setAttribute(attr, translation);
                    }
                });
            } catch (e) {
                console.error('[Iframe Bridge V2] Error parsing i18n-attr:', e);
            }
        });

        // Trigger page height update after translation
        setTimeout(updateHeight, 100);
    }

    function getTranslation(key) {
        const keys = key.split('.');
        let value = translations[currentLanguage];

        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                // Fallback to English
                value = translations['en'];
                for (const k of keys) {
                    if (value && value[k]) {
                        value = value[k];
                    } else {
                        return null;
                    }
                }
                break;
            }
        }

        return typeof value === 'string' ? value : null;
    }

    function loadTranslations(translationData) {
        if (translationData) {
            // Deep merge translations
            Object.keys(translationData).forEach(lang => {
                if (!translations[lang]) {
                    translations[lang] = {};
                }
                Object.assign(translations[lang], translationData[lang]);
            });
            console.log('[Iframe Bridge V2] Translations loaded for languages:', Object.keys(translationData));
        }
    }

    function loadSEOConfig(seoData) {
        if (seoData) {
            seoConfig = seoData;
            console.log('[Iframe Bridge V2] SEO config loaded');

            // If parent is already ready, send SEO data immediately
            if (parentReady) {
                globalActions.sendSEOData();
            }
        }
    }

    // Auto-resize functionality
    function setupAutoResize() {
        // Initial height
        updateHeight();

        // Update on content changes
        const observer = new MutationObserver(() => {
            updateHeight();
        });

        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true
        });

        // Update on window resize
        window.addEventListener('resize', updateHeight);

        // Update periodically for dynamic content
        setInterval(updateHeight, 1000);
    }

    function updateHeight() {
        const height = Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
        );

        sendToParent({
            type: 'resize',
            height: height,
            page: config.pageIdentifier
        });
    }

    // Public API
    window.IframeBridge = {
        init: init,
        sendToParent: sendToParent,
        setLanguage: setLanguage,
        getCurrentLanguage: () => currentLanguage,
        translatePage: translatePage,
        updateHeight: updateHeight,
        loadTranslations: loadTranslations,
        loadSEOConfig: loadSEOConfig,

        // Register page-specific action
        registerPageAction: function(pageId, actionName, actionFn) {
            if (!pageActions[pageId]) {
                pageActions[pageId] = {};
            }
            pageActions[pageId][actionName] = actionFn;
            console.log('[Iframe Bridge V2] Registered page action:', pageId, actionName);
        },

        // Execute page actions manually if needed
        executePageActions: executePageActions
    };

    console.log('[Iframe Bridge V2] Ready');
})();
