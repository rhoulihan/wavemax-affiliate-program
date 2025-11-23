(function() {
    'use strict';

    // Get the page slug from URL parameter
    function getPageSlug() {
        const urlParams = new URLSearchParams(window.location.search);
        let route = urlParams.get('route') || 'home';

        // Remove leading slash if present
        if (route.startsWith('/')) {
            route = route.substring(1);
        }

        // Map routes to page slugs
        const routeMap = {
            'home': 'home',
            '': 'home',
            'self-serve-laundry': 'self-serve-laundry',
            'wash-dry-fold': 'wash-dry-fold',
            'about-us': 'about-us',
            'commercial': 'home', // For now, map to home
            'testimonials': 'home', // For now, map to home
            'affiliate-program': 'home' // Will redirect to actual affiliate page
        };

        return routeMap[route] || 'home';
    }

    // Load page content from JSON
    async function loadPageContent() {
        try {
            const pageSlug = getPageSlug();
            console.log('[Site Page Loader] Loading content for:', pageSlug);

            const response = await fetch('/content/site-pages.json');
            const allPages = await response.json();
            const pageData = allPages[pageSlug];

            if (!pageData) {
                console.error('[Site Page Loader] Page data not found for:', pageSlug);
                showError();
                return;
            }

            renderPage(pageData, pageSlug);
        } catch (error) {
            console.error('[Site Page Loader] Error loading page content:', error);
            showError();
        }
    }

    // Render page content
    function renderPage(pageData, pageSlug) {
        console.log('[Site Page Loader] Rendering page:', pageData.title);

        // Update document title
        document.title = pageData.title;

        // Render main content based on page type
        const contentArea = document.getElementById('page-content');
        if (!contentArea) {
            console.error('[Site Page Loader] Content area not found!');
            return;
        }
        contentArea.innerHTML = '';

        // Render based on page slug
        if (pageSlug === 'self-serve-laundry') {
            renderSelfServeLaundry(pageData, contentArea);
        } else {
            // Other page rendering logic here
            contentArea.innerHTML = '<div class="container py-5"><h1>' + pageData.title + '</h1><p>Content coming soon...</p></div>';
        }

        // Update height for parent iframe
        setTimeout(() => updateParentHeight(), 500);
    }

    // Render Self-Serve Laundry page with exact parent structure
    function renderSelfServeLaundry(pageData, container) {
        const html = `
<section class="wrapper bg-light over-hidden">
    <div class="self-serve bg-grey pb-10">
        <div class="container">
            <div class="row">
                <div class="col-md-7">
                    <div class="s-content">
                        <img src="https://www.wavemaxlaundry.com/Upload/UploadedImages/WaveMAX/rect.png" class="rect img-responsive img-fluid" alt="icon" />
                        <h2 data-aos="fade-left">${pageData.mainContent.heading}</h2>
                        ${pageData.mainContent.intro}
                    </div>
                </div>
                <div class="col-md-5" data-aos="fade-right">
                    <div class="f-img">
                        <div class="owl-carousel owl-carousel1 owl-theme">
                            ${pageData.images.map(img => `<div class="item"><img src="${img}" alt="self-serve laundry" class="img-responsive img-fluid" /></div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="container">
                    <div class="row pt-5">
                        <div class="col-12 pt-5">
                            <h2 class="text-center text-12 font-weight-bold">${pageData.sanitization.heading}</h2>
                        </div>
                    </div>
                    <div class="row align-items-center">
                        <div class="col-md-4">
                            <div class="drop aos-init aos-animate" data-aos="fade-down">
                                <h2>${pageData.sanitization.tagline}</h2>
                            </div>
                        </div>
                        <div class="col-md-4 col-md-3 col-sm-6">
                            <figure data-aos="fade-right" class="aos-init aos-animate">
                                <img src="${pageData.sanitization.logos[0].src}" class="img-responsive img-fluid" alt="${pageData.sanitization.logos[0].alt}" />
                            </figure>
                        </div>
                        <div class="col-md-3 col-sm-6">
                            <figure data-aos="fade-left" class="aos-init aos-animate">
                                <img src="${pageData.sanitization.logos[1].src}" class="img-responsive img-fluid" alt="${pageData.sanitization.logos[1].alt}" />
                            </figure>
                        </div>
                    </div>
                </div>
                <div class="aminities benifits-lux bg-grey pt-10">
                    <div class="container aos-init" data-aos="fade-up">
                        <div class="row">
                            <div class="col-md-12">
                                <h2>${pageData.sanitization.benefits.title}</h2>
                            </div>
                            <div class="col-md-12">
                                <ul>
                                    ${pageData.sanitization.benefits.items.map(item => `<li>${item}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Reviews Widget -->
<div data-testimonials-type="local-marketing-testimonials" data-testimonials-url="${pageData.testimonials.widgetHtml.match(/data-testimonials-url="([^"]+)"/)[1]}"></div>

<!-- Amenities/Highlights -->
<div class="aminities" data-aos="fade-right">
    <div class="container">
        <div class="row">
            <div class="col-md-8">
                <h2 class="text-white">${pageData.highlights[0].heading}</h2>
                <h4 class="text-white">${pageData.highlights[0].subheading}</h4>
                ${pageData.highlights[0].content}
                <ul>
                    ${pageData.amenities.items.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- Employment Section -->
<div class="faq">
    <div class="faq-section text-center">
        <img src="https://www.wavemaxlaundry.com/Upload/UploadedImages/WaveMAX/rect.png" alt="icon" class="rect img-responsive img-fluid" />
        <h2>${pageData.employment.heading}</h2>
        <p>${pageData.employment.content}</p>
        <h5>${pageData.employment.subheading}</h5>
        <a href="${pageData.employment.ctaLink}" class="loc-btn active w-190" title="Employment">${pageData.employment.ctaText}</a>
    </div>
</div>

<!-- FAQs -->
<div class="container pt-5">
    <div class="row pt-5 aos-animate" data-aos="fade-up">
        <div class="col-12">
            <h2 class="text-center text-12 font-weight-bold">Frequently Asked Questions</h2>
        </div>
    </div>
    <div class="row">
        <div class="col-12 mt-5 mb-5">
            <div class="accordion accordion-modern-status accordion-modern-status-primary" id="accordionMain">
                ${pageData.faqs.map((faq, index) => `
                    <div class="card card-default">
                        <div class="card-header" id="heading${index}">
                            <h4 class="card-title m-0">
                                <a class="accordion-toggle text-color-dark font-weight-bold collapsed" data-bs-toggle="collapse" data-bs-target="#collapse${index}" aria-expanded="false" aria-controls="collapse${index}">
                                    ${faq.question}
                                </a>
                            </h4>
                        </div>
                        <div id="collapse${index}" class="collapse" aria-labelledby="heading${index}" data-bs-parent="#accordionMain">
                            <div class="card-body">
                                <p class="mb-0">${faq.answer}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
</div>
`;

        container.innerHTML = html;

        // Initialize Owl Carousel after DOM is ready
        setTimeout(() => {
            if (window.jQuery && window.jQuery.fn.owlCarousel) {
                window.jQuery('.owl-carousel1').owlCarousel({
                    loop: true,
                    margin: 10,
                    nav: true,
                    autoplay: true,
                    autoplayTimeout: 3000,
                    responsive: {
                        0: { items: 1 },
                        600: { items: 1 },
                        1000: { items: 1 }
                    }
                });
                console.log('[Site Page Loader] Owl Carousel initialized');
            } else {
                console.warn('[Site Page Loader] jQuery or Owl Carousel not loaded yet');
            }
        }, 500);

        // Initialize testimonials widget - try multiple methods
        setTimeout(() => {
            console.log('[Site Page Loader] Attempting to initialize testimonials widget');

            const widgetDiv = document.querySelector('[data-testimonials-type]');
            if (!widgetDiv) {
                console.warn('[Site Page Loader] Testimonials widget div not found');
                return;
            }

            // Method 1: Check for LocalMarketingTestimonials global
            if (window.LocalMarketingTestimonials && typeof window.LocalMarketingTestimonials.init === 'function') {
                console.log('[Site Page Loader] LocalMarketingTestimonials found, calling init()');
                try {
                    window.LocalMarketingTestimonials.init();
                } catch (e) {
                    console.error('[Site Page Loader] Error calling LocalMarketingTestimonials.init():', e);
                }
                return;
            }

            // Method 2: Check for window.initTestimonials
            if (window.initTestimonials && typeof window.initTestimonials === 'function') {
                console.log('[Site Page Loader] initTestimonials found, calling...');
                try {
                    window.initTestimonials();
                } catch (e) {
                    console.error('[Site Page Loader] Error calling initTestimonials():', e);
                }
                return;
            }

            // Method 3: Re-inject the script to force re-scan
            console.log('[Site Page Loader] No init function found, re-injecting widget script');
            const script = document.createElement('script');
            script.src = 'https://www.local-marketing-reports.com/assets/external/reviews/widgets.js';
            script.onload = () => {
                console.log('[Site Page Loader] Widget script re-loaded');
                // Try again after script loads
                if (window.LocalMarketingTestimonials && typeof window.LocalMarketingTestimonials.init === 'function') {
                    window.LocalMarketingTestimonials.init();
                }
            };
            document.body.appendChild(script);
        }, 1500);

        // Update height after content loaded (increased delay for widgets)
        setTimeout(() => updateParentHeight(), 2000);

        // Additional height update after widgets should be loaded
        setTimeout(() => updateParentHeight(), 5000);
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
                console.log('[Site Page Loader] Sent height update to parent:', height);
            }
        } catch (error) {
            console.error('[Site Page Loader] Error updating parent height:', error);
        }
    }

    // Show error message
    function showError() {
        const contentArea = document.getElementById('page-content');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="error-message">
                    <h2>Error Loading Content</h2>
                    <p>We're sorry, but we couldn't load the page content. Please try again later.</p>
                </div>
            `;
        }
    }

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadPageContent);
    } else {
        loadPageContent();
    }
})();
