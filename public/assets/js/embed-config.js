(function() {
  'use strict';

  // PostMessage communication with parent window
  function sendMessageToParent(type, data) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: type,
        source: 'wavemax-embed',
        data: data
      }, '*');
    }
  }

  // Navigate parent frame
  function navigateParent(page) {
    sendMessageToParent('navigate', { page: page });
  }

  // Get URL parameters
  function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // Configuration for embedded environment
  window.EMBED_CONFIG = {
    baseUrl: 'https://wavemax.promo',
    isEmbedded: true
  };

  // Export utility functions
  window.sendMessageToParent = sendMessageToParent;
  window.navigateParent = navigateParent;
  window.getUrlParameter = getUrlParameter;

  // Notify parent that iframe is loaded
  window.addEventListener('load', function() {
    sendMessageToParent('iframe-loaded', { page: 'customer-register' });
  });

})();