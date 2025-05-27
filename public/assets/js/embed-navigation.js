// Embed Navigation Handler
// This external script handles navigation for embedded pages without inline event handlers

(function() {
  'use strict';

  // Configuration
  const BASE_URL = 'https://wavemax.promo';
  const EMBED_SUFFIX = '';

  // Navigation function for embedded context
  window.navigateToPage = function(route) {
    // If in iframe, use postMessage to navigate
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'navigate',
        data: {
          url: route
        }
      }, '*');
    } else {
      // If not in iframe, navigate directly
      window.location.href = route;
    }
  };

  // Initialize when DOM is ready
  function init() {
    console.log('Embed navigation initialized');

    // Handle all navigation links with data-navigate attribute
    document.addEventListener('click', function(e) {
      const navLink = e.target.closest('[data-navigate]');
      if (navLink) {
        e.preventDefault();
        const route = navLink.getAttribute('data-navigate');
        console.log('Navigation clicked:', route);
        navigateToPage(route);
      }
    });

    // Handle links with href="#" and data-href for navigation
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a[data-href]');
      if (link) {
        e.preventDefault();
        const href = link.getAttribute('data-href');
        if (href.startsWith('/')) {
          const route = href.replace('.html', '').replace('-embed', '');
          navigateToPage(route);
        } else {
          // External link
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    });

    // Update existing links to use data attributes
    const links = document.querySelectorAll('a[href^="/"]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !link.hasAttribute('data-navigate') && !link.hasAttribute('data-href')) {
        // Convert onclick links to data-navigate
        const onclick = link.getAttribute('onclick');
        if (onclick && onclick.includes('navigateToPage')) {
          const match = onclick.match(/navigateToPage\(['"]([^'"]+)['"]\)/);
          if (match) {
            link.setAttribute('data-navigate', match[1]);
            link.removeAttribute('onclick');
          }
        } else {
          // Regular links
          link.setAttribute('data-href', href);
          link.setAttribute('href', '#');
        }
      }
    });

    // Add UTM tracking for affiliate links
    const affiliateLinks = document.querySelectorAll('[data-navigate*="affiliate"], [data-href*="affiliate"]');
    affiliateLinks.forEach(link => {
      link.setAttribute('data-utm-source', 'wavemaxlaundry.com');
      link.setAttribute('data-utm-medium', 'embedded');
      link.setAttribute('data-utm-campaign', 'austin-affiliate');
    });

    // Handle iframe resizing
    if (window.parent !== window) {
      function sendHeight() {
        const height = Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );

        window.parent.postMessage({
          type: 'resize',
          data: { height: height }
        }, '*');
      }

      // Send initial height
      sendHeight();

      // Monitor for changes
      const resizeObserver = new ResizeObserver(sendHeight);
      resizeObserver.observe(document.body);

      // Also send height on window resize
      window.addEventListener('resize', sendHeight);

      // Send height after images load
      window.addEventListener('load', sendHeight);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();