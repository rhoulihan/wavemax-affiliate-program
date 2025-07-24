/**
 * WaveMAX Iframe Bridge Script
 * This script should be included in the parent page that embeds the WaveMAX application
 * It handles communication between the parent page and the embedded iframe
 */

(function() {
  'use strict';

  // Configuration
  const TRUSTED_ORIGINS = [
    'https://wavemax.promo',
    'https://www.wavemax.promo',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];

  // State
  let iframe = null;
  let chromeElements = [];
  let originalStyles = new Map();
  let isChromeHidden = false;

  /**
   * Initialize the iframe bridge
   * @param {string} iframeSelector - CSS selector for the iframe element
   * @param {object} options - Configuration options
   */
  window.WaveMaxIframeBridge = {
    init: function(iframeSelector, options = {}) {
      // Find the iframe
      iframe = document.querySelector(iframeSelector);
      if (!iframe) {
        console.error('[WaveMAX Bridge] Iframe not found with selector:', iframeSelector);
        return;
      }

      // Set up chrome elements to hide
      if (options.chromeSelectors) {
        chromeElements = options.chromeSelectors.map(selector => 
          document.querySelectorAll(selector)
        ).flat();
      } else {
        // Default selectors for common WordPress themes
        chromeElements = [
          ...document.querySelectorAll('header, .header, #header'),
          ...document.querySelectorAll('footer, .footer, #footer'),
          ...document.querySelectorAll('nav, .navigation, #navigation'),
          ...document.querySelectorAll('.sidebar, #sidebar'),
          ...document.querySelectorAll('.breadcrumb, .breadcrumbs'),
          ...document.querySelectorAll('.page-title, .entry-title')
        ];
      }

      // Store original styles
      chromeElements.forEach(element => {
        originalStyles.set(element, {
          display: element.style.display,
          visibility: element.style.visibility,
          opacity: element.style.opacity,
          height: element.style.height,
          overflow: element.style.overflow
        });
      });

      // Set up message listener
      window.addEventListener('message', handleMessage);

      // Send initial viewport info to iframe
      sendViewportInfo();

      // Watch for window resize
      window.addEventListener('resize', debounce(sendViewportInfo, 250));
      window.addEventListener('orientationchange', () => {
        setTimeout(sendViewportInfo, 100);
      });

      console.log('[WaveMAX Bridge] Initialized successfully');
    },

    /**
     * Manually hide chrome elements
     */
    hideChrome: function() {
      hideParentChrome();
    },

    /**
     * Manually show chrome elements
     */
    showChrome: function() {
      showParentChrome();
    },

    /**
     * Send a message to the iframe
     */
    sendMessage: function(type, data) {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type, data }, '*');
      }
    }
  };

  /**
   * Handle messages from the iframe
   */
  function handleMessage(event) {
    // Verify origin
    const originAllowed = TRUSTED_ORIGINS.some(origin => 
      event.origin === origin || event.origin.startsWith(origin)
    );

    if (!originAllowed) {
      console.warn('[WaveMAX Bridge] Message from untrusted origin:', event.origin);
      return;
    }

    if (!event.data || !event.data.type) return;

    console.log('[WaveMAX Bridge] Message received:', event.data.type, event.data.data);

    switch (event.data.type) {
      case 'resize':
        handleResize(event.data.data);
        break;

      case 'navigate':
        handleNavigation(event.data.data);
        break;

      case 'manage-chrome':
        handleChromeManagement(event.data.data);
        break;

      case 'scroll-to-top':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      default:
        console.log('[WaveMAX Bridge] Unknown message type:', event.data.type);
    }
  }

  /**
   * Handle iframe resize requests
   */
  function handleResize(data) {
    if (iframe && data && data.height) {
      iframe.style.height = data.height + 'px';
      
      // For very small heights, ensure minimum visibility
      if (data.height < 400) {
        iframe.style.minHeight = '400px';
      } else {
        iframe.style.minHeight = '';
      }
    }
  }

  /**
   * Handle navigation requests (optional - for custom navigation handling)
   */
  function handleNavigation(data) {
    // This can be customized based on parent page needs
    console.log('[WaveMAX Bridge] Navigation requested:', data);
  }

  /**
   * Handle chrome visibility management
   */
  function handleChromeManagement(data) {
    if (data && data.hideChrome) {
      hideParentChrome();
    } else {
      showParentChrome();
    }
  }

  /**
   * Hide parent page chrome elements
   */
  function hideParentChrome() {
    if (isChromeHidden) return;

    chromeElements.forEach(element => {
      if (element) {
        // Use multiple methods to ensure hiding works across different scenarios
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
        element.style.height = '0';
        element.style.overflow = 'hidden';
        element.setAttribute('aria-hidden', 'true');
      }
    });

    // Add class to body for additional styling hooks
    document.body.classList.add('wavemax-chrome-hidden');

    // Adjust iframe container if needed
    if (iframe && iframe.parentElement) {
      iframe.parentElement.style.padding = '0';
      iframe.parentElement.style.margin = '0';
    }

    isChromeHidden = true;

    // Notify iframe that chrome is hidden
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'chrome-hidden',
        data: { hidden: true }
      }, '*');
    }
  }

  /**
   * Show parent page chrome elements
   */
  function showParentChrome() {
    if (!isChromeHidden) return;

    chromeElements.forEach(element => {
      if (element && originalStyles.has(element)) {
        const original = originalStyles.get(element);
        element.style.display = original.display;
        element.style.visibility = original.visibility;
        element.style.opacity = original.opacity;
        element.style.height = original.height;
        element.style.overflow = original.overflow;
        element.removeAttribute('aria-hidden');
      }
    });

    // Remove class from body
    document.body.classList.remove('wavemax-chrome-hidden');

    isChromeHidden = false;

    // Notify iframe that chrome is shown
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'chrome-hidden',
        data: { hidden: false }
      }, '*');
    }
  }

  /**
   * Send viewport information to iframe
   */
  function sendViewportInfo() {
    if (!iframe || !iframe.contentWindow) return;

    const viewportData = {
      width: window.innerWidth,
      height: window.innerHeight,
      isMobile: window.innerWidth <= 768,
      isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
      isDesktop: window.innerWidth > 1024,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
      language: document.documentElement.lang || navigator.language || 'en'
    };

    iframe.contentWindow.postMessage({
      type: 'viewport-info',
      data: viewportData
    }, '*');
  }

  /**
   * Debounce function for resize events
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Auto-initialize if data attribute is present
  document.addEventListener('DOMContentLoaded', function() {
    const autoInitElement = document.querySelector('[data-wavemax-iframe]');
    if (autoInitElement) {
      const options = {
        chromeSelectors: autoInitElement.getAttribute('data-chrome-selectors')?.split(',') || []
      };
      window.WaveMaxIframeBridge.init('[data-wavemax-iframe]', options);
    }
  });

})();