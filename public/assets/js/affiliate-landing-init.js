(function() {
  'use strict';

  // Function to get URL parameters
  function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // Function to show affiliate not found message
  function showAffiliateNotFoundMessage() {
    // Find the main content area
    const heroSection = document.querySelector('.hero-section .container');
    if (heroSection) {
      heroSection.innerHTML = `
                <div class="row align-items-center text-center">
                    <div class="col-12">
                        <div class="alert-icon mb-4">
                            <i class="bi bi-exclamation-triangle-fill" style="font-size: 4rem; color: #ffc107;"></i>
                        </div>
                        <h1 class="hero-title mb-4">Affiliate Not Found</h1>
                        <p class="hero-subtitle mb-4">
                            We couldn't find the delivery partner associated with this link.
                        </p>
                        <p class="lead mb-4">
                            Please verify the link with your delivery partner or contact them directly for the correct registration link.
                        </p>
                        <div class="mt-4">
                            <a href="https://www.wavemaxlaundry.com" class="btn btn-light btn-lg">
                                <i class="bi bi-house-door me-2"></i>Visit WaveMAX Laundry
                            </a>
                        </div>
                    </div>
                </div>
            `;
    }

    // Hide other sections that depend on affiliate data
    const sectionsToHide = [
      '.py-5', // Services and other info sections
      '.cta-section' // Bottom CTA
    ];

    sectionsToHide.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!el.classList.contains('hero-section')) {
          el.style.display = 'none';
        }
      });
    });
  }

  // Function to initialize the landing page
  function initializeLandingPage() {
    console.log('Initializing affiliate landing page...');

    // Get affiliate code from URL
    const affiliateCode = getUrlParameter('code');
    console.log('Affiliate code from URL:', affiliateCode);

    if (!affiliateCode) {
      console.error('No affiliate code provided');
      return;
    }

    // Fetch affiliate information
    // Use the actual API server URL instead of iframe origin
    const apiUrl = 'https://wavemax.promo';
    const fetchUrl = `${apiUrl}/api/v1/affiliates/public/${affiliateCode}`;
    console.log('Fetching affiliate data from:', fetchUrl);

    fetch(fetchUrl)
      .then(response => {
        console.log('Fetch response status:', response.status);
        if (!response.ok) {
          if (response.status === 404) {
            console.log('Affiliate not found (404)');
            showAffiliateNotFoundMessage();
          }
          throw new Error(`Failed to fetch affiliate information: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Affiliate data received:', data);
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
      'affiliateNameCTA',
      'affiliateBadgeName'  // Add the badge name element
    ];

    affiliateNameElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = affiliateName;
      }
    });

    // Update i18n parameters for dynamic content
    if (window.i18n && window.i18n.updateParams) {
      window.i18n.updateParams({
        affiliateName: affiliateName
      });
    }

    // Update pricing if available
    if (affiliate.minimumDeliveryFee) {
      document.getElementById('minimumFee').textContent = affiliate.minimumDeliveryFee;
    }

    if (affiliate.perBagDeliveryFee) {
      document.getElementById('perBagFee').textContent = affiliate.perBagDeliveryFee;
    }

    // Update year in footer
    const yearElement = document.getElementById('yearFooter');
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear();
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

    // Add affiliate code to internal links for tracking (excluding navigation links)
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      // Skip links that use data-navigate attribute (they're handled by embed-navigation.js)
      if (!link.hasAttribute('data-navigate')) {
        const url = new URL(link.href, window.location.origin);
        if (!url.searchParams.has('affid') && !url.searchParams.has('affiliateCode')) {
          url.searchParams.set('affid', affiliateCode);
          link.href = url.toString();
        }
      }
    });
  }

  // Track if already initialized
  let initialized = false;

  // Initialize when DOM is ready
  function tryInitialize() {
    console.log('tryInitialize called, initialized:', initialized, 'affiliateName element:', document.getElementById('affiliateName'));
    if (!initialized && document.getElementById('affiliateName')) {
      initialized = true;
      initializeLandingPage();
    }
  }

  // Log script loading
  console.log('affiliate-landing-init.js loaded, document.readyState:', document.readyState);

  // For normal page load
  if (document.readyState === 'loading') {
    console.log('Adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', tryInitialize);
  } else {
    console.log('DOM already loaded, trying to initialize');
    tryInitialize();
  }

  // For dynamic loading in embed-app.html
  console.log('Starting interval check for affiliateName element');
  const checkInterval = setInterval(function() {
    if (document.getElementById('affiliateName')) {
      console.log('affiliateName element found via interval check');
      clearInterval(checkInterval);
      tryInitialize();
    }
  }, 100);

  // Clear interval after 5 seconds to prevent infinite checking
  setTimeout(() => {
    console.log('Clearing interval check after 5 seconds');
    clearInterval(checkInterval);
  }, 5000);
})();