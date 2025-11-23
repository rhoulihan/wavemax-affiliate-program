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
