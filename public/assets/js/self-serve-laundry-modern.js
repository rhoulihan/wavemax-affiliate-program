// Self-Serve Laundry Modern - Initialization Script
(function() {
    'use strict';

    console.log('[Self-Serve] Page loading...');

    // Initialize AOS
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 600,
            once: true,
            offset: 50
        });
        console.log('[Self-Serve] AOS initialized');
    } else {
        console.warn('[Self-Serve] AOS not loaded');
    }

    // Initialize Bootstrap tabs explicitly
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[Self-Serve] DOM ready, initializing tabs...');

        var triggerTabList = [].slice.call(document.querySelectorAll('button[data-bs-toggle="tab"]'));
        triggerTabList.forEach(function(triggerEl) {
            new bootstrap.Tab(triggerEl);
            console.log('[Self-Serve] Tab initialized:', triggerEl.id);
        });

        // Ensure first tab content is visible
        var firstTab = document.querySelector('#features');
        if (firstTab) {
            firstTab.classList.add('show', 'active');
            console.log('[Self-Serve] First tab activated');
        }
    });

    // Initialize testimonials widget with multiple attempts
    var testimonialsAttempts = 0;
    var maxAttempts = 5;

    function tryInitTestimonials() {
        testimonialsAttempts++;
        console.log('[Self-Serve] Attempt', testimonialsAttempts, 'to initialize testimonials');

        if (window.LocalMarketingTestimonials && typeof window.LocalMarketingTestimonials.init === 'function') {
            try {
                window.LocalMarketingTestimonials.init();
                console.log('[Self-Serve] Testimonials widget initialized successfully');
                return true;
            } catch (e) {
                console.error('[Self-Serve] Error initializing testimonials:', e);
            }
        } else if (testimonialsAttempts < maxAttempts) {
            // Try again
            setTimeout(tryInitTestimonials, 1000);
        } else {
            console.warn('[Self-Serve] Testimonials widget not available after', maxAttempts, 'attempts');
            // Show fallback content
            var fallback = document.getElementById('testimonials-fallback');
            if (fallback) {
                fallback.style.display = 'block';
            }
        }
        return false;
    }

    // Start trying to load testimonials
    setTimeout(tryInitTestimonials, 500);

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
            console.error('[Self-Serve] Error updating parent height:', error);
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
})();
