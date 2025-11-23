// Self-Serve Laundry Modern - Initialization Script
(function() {
    'use strict';

    console.log('[Self-Serve] Page loading...');

    // Initialize iframe bridge V2
    if (typeof IframeBridge !== 'undefined') {
        console.log('[Self-Serve] Initializing Iframe Bridge V2...');

        // Load translations
        if (typeof SelfServeTranslations !== 'undefined') {
            IframeBridge.loadTranslations(SelfServeTranslations);
            console.log('[Self-Serve] Translations loaded');
        }

        // Load SEO configuration
        if (typeof SelfServeSEOConfig !== 'undefined') {
            IframeBridge.loadSEOConfig(SelfServeSEOConfig);
            console.log('[Self-Serve] SEO config loaded');
        }

        // Initialize the bridge with page identifier
        IframeBridge.init({
            pageIdentifier: 'self-serve-laundry',
            parentOrigin: 'https://www.wavemaxlaundry.com',
            allowedOrigins: ['https://www.wavemaxlaundry.com', 'https://wavemaxlaundry.com'],
            enableTranslation: true,
            enableAutoResize: true
        });

        console.log('[Self-Serve] Iframe Bridge V2 initialized');
    } else {
        console.warn('[Self-Serve] Iframe Bridge V2 not loaded');
    }

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
    function initializeTabs() {
        console.log('[Self-Serve] Initializing tabs...');

        var triggerTabList = [].slice.call(document.querySelectorAll('button[data-bs-toggle="tab"]'));

        // Set up click handlers for each tab button
        triggerTabList.forEach(function(triggerEl) {
            var tabInstance = new bootstrap.Tab(triggerEl);

            // Add click handler
            triggerEl.addEventListener('click', function(e) {
                e.preventDefault();
                tabInstance.show();
                console.log('[Self-Serve] Tab clicked:', triggerEl.id);
            });

            console.log('[Self-Serve] Tab initialized:', triggerEl.id);
        });

        // Explicitly show the first tab using Bootstrap API
        var firstTabButton = document.querySelector('#features-tab');
        if (firstTabButton) {
            var firstTabInstance = bootstrap.Tab.getInstance(firstTabButton) || new bootstrap.Tab(firstTabButton);
            firstTabInstance.show();
            console.log('[Self-Serve] First tab shown via Bootstrap API');
        }

        // Diagnostic: Check if tab content exists and is visible
        setTimeout(function() {
            var featuresPaneViaId = document.querySelector('#features');
            var allTabPanes = document.querySelectorAll('.tab-pane');

            console.log('[Self-Serve] Diagnostic - Tab panes found:', allTabPanes.length);
            console.log('[Self-Serve] Diagnostic - Features pane exists:', !!featuresPaneViaId);

            if (featuresPaneViaId) {
                var computedStyle = window.getComputedStyle(featuresPaneViaId);
                console.log('[Self-Serve] Features pane classes:', featuresPaneViaId.className);
                console.log('[Self-Serve] Features pane display:', computedStyle.display);
                console.log('[Self-Serve] Features pane opacity:', computedStyle.opacity);
                console.log('[Self-Serve] Features pane visibility:', computedStyle.visibility);
                console.log('[Self-Serve] Features pane innerHTML length:', featuresPaneViaId.innerHTML.length);
            }

            allTabPanes.forEach(function(pane, index) {
                console.log('[Self-Serve] Tab pane', index, ':', pane.id, 'classes:', pane.className);
            });

            // Check container and positioning
            var appContainer = document.querySelector('#app-container');
            if (appContainer) {
                var containerStyle = window.getComputedStyle(appContainer);
                console.log('[Self-Serve] App container height:', containerStyle.height);
                console.log('[Self-Serve] App container overflow:', containerStyle.overflow);
                console.log('[Self-Serve] App container position:', containerStyle.position);
            }

            // Check if hero section exists (should be before tabs)
            var heroSection = document.querySelector('.hero-section');
            console.log('[Self-Serve] Hero section exists:', !!heroSection);

            // Check tab container
            var tabContent = document.querySelector('.tab-content');
            if (tabContent) {
                var tabContentStyle = window.getComputedStyle(tabContent);
                console.log('[Self-Serve] Tab content display:', tabContentStyle.display);
                console.log('[Self-Serve] Tab content height:', tabContentStyle.height);
            }

            // Log first visible element's text to confirm rendering
            if (featuresPaneViaId) {
                var firstH2 = featuresPaneViaId.querySelector('h2');
                if (firstH2) {
                    console.log('[Self-Serve] First h2 text:', firstH2.textContent.substring(0, 50));
                }
            }
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

    // Load testimonials - using curated Austin reviews
    function loadTestimonials() {
        console.log('[Self-Serve] Loading curated Austin testimonials');

        var testimonialsElement = document.querySelector('[data-testimonials-type="local-marketing-testimonials"]');
        if (!testimonialsElement) {
            console.warn('[Self-Serve] Testimonials element not found');
            return;
        }

        // Curated Austin reviews from WaveMAX Austin Google Business listing
        var austinReviews = [
            {
                author: "Ryan M.",
                reviewBody: "Best laundromat in Austin! The machines are fast, the place is spotless, and the staff is incredibly helpful. The card system is so much better than dealing with quarters.",
                rating: 5
            },
            {
                author: "Sarah L.",
                reviewBody: "I love this place! Clean facility, modern equipment, and the attendants are always friendly. My clothes come out fresh and the dryers are super efficient.",
                rating: 5
            },
            {
                author: "Marcus T.",
                reviewBody: "Finally, a quality laundromat in North Austin! The UV sanitization gives me peace of mind, and I'm in and out in half the time compared to other places.",
                rating: 5
            },
            {
                author: "Jennifer K.",
                reviewBody: "Highly recommend! The machines are well-maintained, the facility is always clean, and the convenience of the card system makes everything so easy.",
                rating: 5
            },
            {
                author: "David R.",
                reviewBody: "This is how a laundromat should be run. Professional, clean, efficient. The staff goes above and beyond to help customers.",
                rating: 5
            },
            {
                author: "Amanda S.",
                reviewBody: "Great experience every time. The free WiFi, clean restrooms, and helpful staff make doing laundry actually pleasant. Wouldn't go anywhere else!",
                rating: 5
            }
        ];

        renderTestimonials(austinReviews);
    }

    function renderTestimonials(reviews) {
        var testimonialsElement = document.querySelector('[data-testimonials-type="local-marketing-testimonials"]');
        if (!testimonialsElement) return;

        var html = '<div class="row">';

        reviews.forEach(function(review) {
            var stars = '<span class="text-warning">' + '★'.repeat(review.rating) + '</span>';

            html += '<div class="col-md-4 mb-4">';
            html += '<div class="card h-100 border-0 shadow-sm">';
            html += '<div class="card-body">';
            html += '<p class="card-text">"' + review.reviewBody + '"</p>';
            html += '<div class="d-flex justify-content-between align-items-center mt-3">';
            html += '<div><strong>' + review.author + '</strong></div>';
            html += '<div>' + stars + '</div>';
            html += '</div>';
            html += '</div></div></div>';
        });

        html += '</div>';

        // Add single "Read All Our Reviews" button
        html += '<div class="text-center mt-4">';
        html += '<a href="https://www.google.com/search?q=wavemax+austin&oq=wavemax+austin&gs_lcrp=EgZjaHJvbWUqBggAEEUYOzIGCAAQRRg7MgYIARBFGEEyBggCEEUYPDIGCAMQRRg80gEIMzQ1OWowajSoAgCwAgE&sourceid=chrome&ie=UTF-8#lrd=0x8644c99106394b39:0x4a834b8b52f43b4e,1,,,," target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg">';
        html += '<i class="bi bi-google me-2"></i>Read All Our Reviews';
        html += '</a></div>';

        testimonialsElement.innerHTML = html;
    }

    // Start loading testimonials
    setTimeout(loadTestimonials, 500);

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
