// Wash-Dry-Fold Modern - Initialization Script
(function() {
    'use strict';

    console.log('[Wash-Dry-Fold] Page loading...');

    // Initialize iframe bridge V2
    if (typeof IframeBridge !== 'undefined') {
        console.log('[Wash-Dry-Fold] Initializing Iframe Bridge V2...');

        // Load translations
        if (typeof WashDryFoldTranslations !== 'undefined') {
            IframeBridge.loadTranslations(WashDryFoldTranslations);
            console.log('[Wash-Dry-Fold] Translations loaded');
        }

        // Load SEO configuration
        if (typeof WashDryFoldSEOConfig !== 'undefined') {
            IframeBridge.loadSEOConfig(WashDryFoldSEOConfig);
            console.log('[Wash-Dry-Fold] SEO config loaded');
        }

        // Initialize the bridge with page identifier
        IframeBridge.init({
            pageIdentifier: 'wash-dry-fold',
            parentOrigin: 'https://www.wavemaxlaundry.com',
            allowedOrigins: ['https://www.wavemaxlaundry.com', 'https://wavemaxlaundry.com'],
            enableTranslation: true,
            enableAutoResize: true
        });

        console.log('[Wash-Dry-Fold] Iframe Bridge V2 initialized');
    } else {
        console.warn('[Wash-Dry-Fold] Iframe Bridge V2 not loaded');
    }

    // Initialize AOS
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 600,
            once: true,
            offset: 50
        });
        console.log('[Wash-Dry-Fold] AOS initialized');
    } else {
        console.warn('[Wash-Dry-Fold] AOS not loaded');
    }

    // Initialize Bootstrap tabs explicitly
    function initializeTabs() {
        console.log('[Wash-Dry-Fold] Initializing tabs...');

        var triggerTabList = [].slice.call(document.querySelectorAll('button[data-bs-toggle="tab"]'));

        // Set up click handlers for each tab button
        triggerTabList.forEach(function(triggerEl) {
            var tabInstance = new bootstrap.Tab(triggerEl);

            // Add click handler
            triggerEl.addEventListener('click', function(e) {
                e.preventDefault();
                tabInstance.show();
                console.log('[Wash-Dry-Fold] Tab clicked:', triggerEl.id);
            });

            console.log('[Wash-Dry-Fold] Tab initialized:', triggerEl.id);
        });

        // Explicitly show the first tab using Bootstrap API
        var firstTabButton = document.querySelector('#how-it-works-tab');
        if (firstTabButton) {
            var firstTabInstance = bootstrap.Tab.getInstance(firstTabButton) || new bootstrap.Tab(firstTabButton);
            firstTabInstance.show();
            console.log('[Wash-Dry-Fold] First tab shown via Bootstrap API');
        }

        // Diagnostic: Check if tab content exists and is visible
        setTimeout(function() {
            var firstTabPane = document.querySelector('#how-it-works');
            var allTabPanes = document.querySelectorAll('.tab-pane');

            console.log('[Wash-Dry-Fold] Diagnostic - Tab panes found:', allTabPanes.length);
            console.log('[Wash-Dry-Fold] Diagnostic - How It Works pane exists:', !!firstTabPane);

            if (firstTabPane) {
                var computedStyle = window.getComputedStyle(firstTabPane);
                console.log('[Wash-Dry-Fold] How It Works pane classes:', firstTabPane.className);
                console.log('[Wash-Dry-Fold] How It Works pane display:', computedStyle.display);
                console.log('[Wash-Dry-Fold] How It Works pane opacity:', computedStyle.opacity);
            }

            allTabPanes.forEach(function(pane, index) {
                console.log('[Wash-Dry-Fold] Tab pane', index, ':', pane.id, 'classes:', pane.className);
            });
        }, 200);
    }

    // Try to initialize immediately if Bootstrap is available, otherwise wait
    if (typeof bootstrap !== 'undefined') {
        // Wait a bit for the HTML to be fully inserted
        setTimeout(initializeTabs, 100);
    } else {
        // Bootstrap not loaded yet, wait for DOMContentLoaded
        document.addEventListener('DOMContentLoaded', initializeTabs);
    }

    // Update parent iframe height
    function updateParentHeight() {
        try {
            const height = Math.max(
                document.body.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.clientHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            );

            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'resize',
                    height: height
                }, '*');
            }
        } catch (error) {
            console.error('[Wash-Dry-Fold] Error updating parent height:', error);
        }
    }

    // Update height on load and tab changes
    window.addEventListener('load', function() {
        setTimeout(updateParentHeight, 100);
        setTimeout(updateParentHeight, 500);
        setTimeout(updateParentHeight, 1000);
        setTimeout(updateParentHeight, 3000);
    });

    // Update height when tabs are shown
    document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(function(tab) {
        tab.addEventListener('shown.bs.tab', function() {
            setTimeout(updateParentHeight, 100);
            setTimeout(updateParentHeight, 300);
        });
    });

    // Update height when accordion items are shown
    document.querySelectorAll('.accordion-button').forEach(function(button) {
        button.addEventListener('click', function() {
            setTimeout(updateParentHeight, 350);
        });
    });

    // Observe DOM changes
    const observer = new MutationObserver(function() {
        updateParentHeight();
    });

    observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true
    });

    console.log('[Wash-Dry-Fold] Initialization complete');
})();
