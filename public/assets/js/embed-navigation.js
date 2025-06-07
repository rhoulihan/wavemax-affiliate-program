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

  // Handle messages from parent window
  function handleParentMessage(event) {
    console.log('[Embed Navigation] Message received:', event.data);
    
    // Security: Only handle messages from trusted origins
    const trustedOrigins = [
      'https://www.wavemaxlaundry.com',
      'https://wavemaxlaundry.com',
      'http://localhost',
      'http://127.0.0.1'
    ];
    
    const originAllowed = trustedOrigins.some(origin => 
      event.origin.startsWith(origin)
    );
    
    if (!originAllowed) {
      console.log('[Embed Navigation] Message rejected - untrusted origin:', event.origin);
      return;
    }
    
    if (!event.data || !event.data.type) return;
    
    switch (event.data.type) {
      case 'viewport-info':
        console.log('[Embed Navigation] Viewport info received:', event.data.data);
        // Handle viewport info
        if (event.data.data) {
          const viewportData = event.data.data;
          
          // Store viewport info for later use
          window.viewportInfo = viewportData;
          
          // If language is included, apply it
          if (viewportData.language && window.i18n) {
            console.log('[Embed Navigation] Setting language from viewport info:', viewportData.language);
            window.i18n.setLanguage(viewportData.language);
          }
          
          // Handle mobile/desktop view adjustments
          if (viewportData.isMobile || viewportData.isTablet) {
            document.body.classList.add('is-mobile-view');
            if (viewportData.isTablet) {
              document.body.classList.add('is-tablet-view');
            }
          } else {
            document.body.classList.remove('is-mobile-view', 'is-tablet-view');
          }
        }
        break;
        
      case 'language-change':
        console.log('[Embed Navigation] Language change received:', event.data.data);
        if (event.data.data && event.data.data.language && window.i18n) {
          console.log('[Embed Navigation] Applying language change:', event.data.data.language);
          window.i18n.setLanguage(event.data.data.language);
        }
        break;
        
      case 'chrome-hidden':
        console.log('[Embed Navigation] Chrome hidden status:', event.data.data);
        if (event.data.data && event.data.data.hidden) {
          document.body.classList.add('parent-chrome-hidden');
        } else {
          document.body.classList.remove('parent-chrome-hidden');
        }
        break;
        
      default:
        console.log('[Embed Navigation] Unknown message type:', event.data.type);
    }
  }

  // Initialize when DOM is ready
  function init() {
    console.log('Embed navigation initialized');

    // Set up message listener for parent communication
    window.addEventListener('message', handleParentMessage);

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
      let lastHeight = 0;
      let heightTimeout = null;
      
      function sendHeight() {
        const height = Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );

        // Only send if height has actually changed
        if (Math.abs(height - lastHeight) > 5) { // 5px threshold to avoid minor fluctuations
          lastHeight = height;
          
          // Debounce height messages to prevent flooding
          if (heightTimeout) {
            clearTimeout(heightTimeout);
          }
          
          heightTimeout = setTimeout(() => {
            console.log('Sending height to parent:', height);
            window.parent.postMessage({
              type: 'resize',
              data: { height: height }
            }, '*');
          }, 50); // 50ms debounce
        }
      }

      // Send initial height
      sendHeight();

      // Monitor for changes
      const resizeObserver = new ResizeObserver(() => {
        sendHeight();
      });
      resizeObserver.observe(document.body);

      // Also send height on window resize
      window.addEventListener('resize', sendHeight);

      // Send height after images load
      window.addEventListener('load', sendHeight);
      
      // Clean up on page unload
      window.addEventListener('beforeunload', function() {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (heightTimeout) {
          clearTimeout(heightTimeout);
        }
      });
      
      // Also clean up on custom events
      window.addEventListener('page-cleanup', function() {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (heightTimeout) {
          clearTimeout(heightTimeout);
        }
      });
      
      window.addEventListener('disconnect-observers', function() {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (heightTimeout) {
          clearTimeout(heightTimeout);
        }
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();