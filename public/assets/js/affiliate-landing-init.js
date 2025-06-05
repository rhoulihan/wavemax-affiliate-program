(function() {
    'use strict';

    // Function to get URL parameters
    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // Function to initialize the landing page
    function initializeLandingPage() {
        console.log('Initializing affiliate landing page...');

        // Get affiliate code from URL
        const affiliateCode = getUrlParameter('code');
        
        if (!affiliateCode) {
            console.error('No affiliate code provided');
            return;
        }

        // Fetch affiliate information
        fetch(`/api/v1/affiliates/public/${affiliateCode}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch affiliate information');
                }
                return response.json();
            })
            .then(data => {
                // Update page with affiliate information
                updatePageContent(data, affiliateCode);
            })
            .catch(error => {
                console.error('Error fetching affiliate data:', error);
                // Still update links with affiliate code even if fetch fails
                updateLinks(affiliateCode, null);
            });
    }

    // Function to update page content with affiliate data
    function updatePageContent(affiliate, affiliateCode) {
        // Update affiliate name - prioritize business name if available
        const affiliateName = affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`;
        
        // Update all affiliate name references
        const affiliateNameElements = [
            'affiliateName',
            'affiliateNameFooter',
            'affiliateNameService1',
            'affiliateNameStep2',  // Removed Step1 since it's now app-based
            'affiliateNameStep4',
            'affiliateNameFeature',
            'affiliateNameCTA'
        ];
        
        affiliateNameElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = affiliateName;
            }
        });

        // Update pricing if available
        if (affiliate.minimumDeliveryFee) {
            document.getElementById('minimumFee').textContent = affiliate.minimumDeliveryFee;
        }
        
        if (affiliate.perBagDeliveryFee) {
            document.getElementById('perBagFee').textContent = affiliate.perBagDeliveryFee;
        }

        // Update links
        updateLinks(affiliateCode, affiliate);
    }

    // Function to update registration and login links
    function updateLinks(affiliateCode, affiliate) {
        const baseUrl = window.location.origin;
        
        // Update registration links
        const registerLinks = [
            document.getElementById('registerLink'),
            document.getElementById('registerLinkBottom')
        ];
        
        registerLinks.forEach(link => {
            if (link) {
                link.href = `${baseUrl}/embed-app.html?route=/customer-register&affid=${affiliateCode}`;
            }
        });

        // Update login link
        const loginLink = document.getElementById('loginLink');
        if (loginLink) {
            loginLink.href = `${baseUrl}/embed-app.html?route=/customer-login&affid=${affiliateCode}`;
        }

        // Add affiliate code to all internal links for tracking
        document.querySelectorAll('a[href^="/"]').forEach(link => {
            const url = new URL(link.href, window.location.origin);
            if (!url.searchParams.has('affiliateCode')) {
                url.searchParams.set('affiliateCode', affiliateCode);
                link.href = url.toString();
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeLandingPage);
    } else {
        initializeLandingPage();
    }

    // Also check periodically in case of dynamic loading
    const checkInterval = setInterval(function() {
        if (document.getElementById('affiliateName')) {
            clearInterval(checkInterval);
            if (!document.getElementById('affiliateName').getAttribute('data-initialized')) {
                document.getElementById('affiliateName').setAttribute('data-initialized', 'true');
                initializeLandingPage();
            }
        }
    }, 100);

    // Clear interval after 5 seconds to prevent infinite checking
    setTimeout(() => clearInterval(checkInterval), 5000);
})();