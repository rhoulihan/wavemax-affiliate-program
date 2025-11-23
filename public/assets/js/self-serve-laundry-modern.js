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

    // Load testimonials from JSON API
    function loadTestimonials() {
        console.log('[Self-Serve] Loading testimonials from JSON API');

        var testimonialsElement = document.querySelector('[data-testimonials-type="local-marketing-testimonials"]');
        if (!testimonialsElement) {
            console.warn('[Self-Serve] Testimonials element not found');
            return;
        }

        var testimonialsUrl = testimonialsElement.getAttribute('data-testimonials-url');
        if (!testimonialsUrl) {
            console.warn('[Self-Serve] Testimonials URL not found');
            showTestimonialsFallback();
            return;
        }

        // Fetch testimonials data
        fetch(testimonialsUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP error ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                if (data && data.issuccess && data.results && data.results.length > 0) {
                    console.log('[Self-Serve] Testimonials loaded:', data.results.length, 'reviews');
                    renderTestimonials(data.results);
                } else {
                    console.warn('[Self-Serve] No testimonials data found');
                    showTestimonialsFallback();
                }
            })
            .catch(function(error) {
                console.error('[Self-Serve] Error loading testimonials:', error);
                showTestimonialsFallback();
            });
    }

    function renderTestimonials(reviews) {
        var testimonialsElement = document.querySelector('[data-testimonials-type="local-marketing-testimonials"]');
        if (!testimonialsElement) return;

        // Filter reviews to only show Austin, TX location
        var austinKeywords = ['austin', 'texas', 'rundberg'];
        var austinReviews = reviews.filter(function(review) {
            var bodyLower = review.reviewBody.toLowerCase();
            // Include if mentions Austin/Texas keywords, or exclude if mentions other cities
            var mentionsAustin = austinKeywords.some(function(keyword) {
                return bodyLower.includes(keyword);
            });
            var mentionsOtherCity = bodyLower.includes('maple heights') ||
                                    bodyLower.includes('cleveland') ||
                                    bodyLower.includes('southgate') ||
                                    bodyLower.includes(', oh') ||
                                    bodyLower.includes('ohio');

            // If it mentions other cities, exclude it
            if (mentionsOtherCity) return false;

            // If it mentions Austin keywords, include it
            if (mentionsAustin) return true;

            // For neutral reviews (no location mentioned), include them
            // They could be from Austin
            return true;
        });

        console.log('[Self-Serve] Filtered to', austinReviews.length, 'Austin reviews from', reviews.length, 'total');

        var html = '<div class="row">';

        // Show first 6 Austin reviews
        var reviewsToShow = austinReviews.slice(0, 6);

        if (reviewsToShow.length === 0) {
            // No Austin reviews found, show fallback
            showTestimonialsFallback();
            return;
        }

        reviewsToShow.forEach(function(review) {
            var truncatedBody = review.reviewBody.length > 150
                ? review.reviewBody.substring(0, 147) + '...'
                : review.reviewBody;

            var authorName = review.author;

            var rating = isNaN(review.ratingValue) ? '' : review.ratingValue + '.0';
            var stars = '';
            if (!isNaN(review.ratingValue)) {
                var ratingNum = parseInt(review.ratingValue);
                stars = '<span class="text-warning">' + '★'.repeat(ratingNum) + '</span>';
            }

            html += '<div class="col-md-4 mb-4">';
            html += '<div class="card h-100 border-0 shadow-sm">';
            html += '<div class="card-body">';
            html += '<p class="card-text">"' + truncatedBody + '"</p>';
            html += '<div class="d-flex justify-content-between align-items-center mt-3">';
            html += '<div><strong>' + authorName + '</strong></div>';
            html += '<div>' + stars + '</div>';
            html += '</div>';
            html += '</div></div></div>';
        });

        html += '</div>';

        // Add "Read All Reviews" button
        html += '<div class="text-center mt-4">';
        html += '<a href="https://www.google.com/search?q=wavemax+austin&oq=wavemax+austin&gs_lcrp=EgZjaHJvbWUqBggAEEUYOzIGCAAQRRg7MgYIARBFGEEyBggCEEUYPDIGCAMQRRg80gEIMzQ1OWowajSoAgCwAgE&sourceid=chrome&ie=UTF-8#lrd=0x8644c99106394b39:0x4a834b8b52f43b4e,1,,,," target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg">';
        html += '<i class="bi bi-google me-2"></i>Read All Our Austin Reviews';
        html += '</a></div>';

        testimonialsElement.innerHTML = html;
    }

    function showTestimonialsFallback() {
        var fallback = document.getElementById('testimonials-fallback');
        if (fallback) {
            fallback.classList.add('show');
        }
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
