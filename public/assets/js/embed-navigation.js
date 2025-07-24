// Embed Navigation Handler
// This external script handles navigation for embedded pages without inline event handlers

(function() {
  'use strict';

  // Configuration
  const BASE_URL = 'https://wavemax.promo';
  const EMBED_SUFFIX = '';

  // Navigation function for embedded context
  window.navigateToPage = function(route) {
    // Check if navigateTo function exists (from embed-app-v2.js)
    if (window.navigateTo && typeof window.navigateTo === 'function') {
      console.log('[Embed Navigation] Using navigateTo directly:', route);
      window.navigateTo(route);
    } else if (window.parent !== window) {
      // If in iframe, use postMessage to navigate
      window.parent.postMessage({
        type: 'navigate',
        route: route
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

  // Mobile detection and parent chrome management
  function detectMobileAndManageChrome() {
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
    const isSmallScreen = window.innerWidth <= 1024;
    
    // If we're in an iframe, send message to parent to hide/show chrome
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'manage-chrome',
        data: {
          hideChrome: isSmallScreen,
          isMobile: isMobile,
          isTablet: isTablet,
          width: window.innerWidth,
          height: window.innerHeight
        }
      }, '*');
      
      // Also update local classes
      if (isSmallScreen) {
        document.body.classList.add('parent-chrome-hidden');
      } else {
        document.body.classList.remove('parent-chrome-hidden');
      }
    }
    
    // Update viewport classes
    document.body.classList.toggle('is-mobile-view', isMobile);
    document.body.classList.toggle('is-tablet-view', isTablet);
    document.body.classList.toggle('is-small-screen', isSmallScreen);
  }

  // Initialize when DOM is ready
  function init() {
    console.log('Embed navigation initialized');

    // Set up message listener for parent communication
    window.addEventListener('message', handleParentMessage);
    
    // Initial mobile detection and chrome management
    detectMobileAndManageChrome();
    
    // Watch for window resize to handle orientation changes
    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(detectMobileAndManageChrome, 250);
    });
    
    // Also listen for orientation change
    window.addEventListener('orientationchange', function() {
      setTimeout(detectMobileAndManageChrome, 100);
    });

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
      let lastSentHeight = 0;  // Track the last height we actually sent to parent
      let heightTimeout = null;

      function sendHeight(force = false) {
        // Get all possible height values
        const heights = [
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight,
          document.body.clientHeight
        ];
        
        // For shrinking content, we need the actual content height, not the viewport
        // Remove any artificial minimums to allow proper shrinking
        const height = Math.max(...heights.filter(h => h > 0));

        // Only send if height has changed by more than 5px (increase or decrease)
        // Lower threshold for better responsiveness
        const heightDifference = Math.abs(height - lastSentHeight);

        if (force || heightDifference > 5) {
          // Clear any pending timeout
          if (heightTimeout) {
            clearTimeout(heightTimeout);
          }

          // Shorter debounce for more responsive resizing
          heightTimeout = setTimeout(() => {
            console.log(`[Resize] Height changed from ${lastSentHeight} to ${height} (diff: ${height - lastSentHeight}px)`);
            lastSentHeight = height;  // Update last sent height

            window.parent.postMessage({
              type: 'resize',
              data: { 
                height: height,
                timestamp: Date.now() // Add timestamp for debugging
              }
            }, '*');
          }, 100); // 100ms debounce (reduced from 200ms)
        }
      }

      // Expose sendHeight function globally for manual control
      window.embedNavigation = window.embedNavigation || {};
      window.embedNavigation.sendHeight = sendHeight;

      // Check if auto-resize is disabled
      const autoResizeDisabled = document.body.hasAttribute('data-disable-auto-resize');
      let resizeObserver = null; // Define at function scope
      let mutationObserver = null; // Define at function scope

      if (!autoResizeDisabled) {
        // Send initial height (force to ensure it's sent)
        sendHeight(true);

        // Monitor for changes
        resizeObserver = new ResizeObserver(() => {
          sendHeight();
        });
        resizeObserver.observe(document.body);
        
        // Also observe documentElement for more comprehensive monitoring
        resizeObserver.observe(document.documentElement);

        // Also send height on window resize
        window.addEventListener('resize', () => sendHeight());

        // Send height after images load (force to ensure proper height)
        window.addEventListener('load', () => sendHeight(true));
        
        // Monitor for DOM changes that might affect height
        mutationObserver = new MutationObserver(() => {
          // Check for display changes that affect layout
          sendHeight();
        });
        
        // Watch for style and class changes that might hide/show content
        mutationObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['style', 'class'],
          childList: true,
          subtree: true
        });
        
        // Listen for custom height update events
        window.addEventListener('content-changed', () => sendHeight(true));
        window.addEventListener('section-toggled', () => sendHeight(true));
      } else {
        console.log('[Embed Navigation] Auto-resize disabled, manual resize control enabled');
        // Still send initial height once (force)
        sendHeight(true);
      }

      // Clean up function
      const cleanupObservers = function() {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (mutationObserver) {
          mutationObserver.disconnect();
        }
        if (heightTimeout) {
          clearTimeout(heightTimeout);
        }
      };

      // Clean up on page unload
      window.addEventListener('beforeunload', cleanupObservers);

      // Also clean up on custom events
      window.addEventListener('page-cleanup', cleanupObservers);
      window.addEventListener('disconnect-observers', cleanupObservers);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();