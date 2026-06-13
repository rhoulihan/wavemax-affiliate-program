(function() {
  'use strict';

  // Affiliate login functionality for embedded environment
  // Note: Login endpoints currently don't require CSRF tokens
  // But we'll prepare for future implementation
  const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

  function initializeAffiliateLogin() {
    console.log('Initializing affiliate login...');

    // Configuration for embedded environment
    const baseUrl = window.location.protocol + '//' + window.location.host;
    const isEmbedded = true;

    console.log('🔧 Affiliate Login Configuration:', {
      baseUrl: baseUrl,
      isEmbedded: isEmbedded,
      hasCsrfUtils: !!window.CsrfUtils,
      csrfFetch: typeof csrfFetch
    });

    // Helper function to get translated spinner messages
    function getSpinnerMessage(key, params = {}) {
    // Default messages
      const defaults = {
        'spinner.connectingWith': 'Connecting with {{provider}}...',
        'spinner.pleaseWait': 'Please wait...'
      };

      // Try to get translation
      if (window.i18n && window.i18n.t) {
        const translated = window.i18n.t(key, params);
        // Check if we got an actual translation or just the key back
        if (translated && translated !== key && !translated.includes('.')) {
          return translated;
        }
      }

      // Fallback to default message
      let defaultMsg = defaults[key] || key;
      // Replace parameters in default message
      if (params) {
        Object.keys(params).forEach(param => {
          defaultMsg = defaultMsg.replace(`{{${param}}}`, params[param]);
        });
      }
      return defaultMsg;
    }

    // Form submission
    const form = document.getElementById('affiliateLoginForm');

    if (!form) {
      console.error('Login form not found');
      return;
    }

    console.log('Login form found, attaching submit handler');

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('Form submitted');

      // Collect form data
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      console.log('Login request:', { username });

      // API request
      csrfFetch('/api/v1/auth/affiliate/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Login failed');
          }
          return response.json();
        })
        .then(data => {
          console.log('Login response:', data);
          if (data.success) {
          // Store token in localStorage
            localStorage.setItem('affiliateToken', data.token);
            localStorage.setItem('currentAffiliate', JSON.stringify(data.affiliate));

            // Use SessionManager to set auth data
            if (window.SessionManager) {
              window.SessionManager.setAuth('affiliate', {
                token: data.token,
                userData: data.affiliate
              });
            }

            console.log('Login successful, redirecting to dashboard');

            // Check for additional URL parameters to preserve (like customer filtering)
            const urlParams = new URLSearchParams(window.location.search);
            const customerParam = urlParams.get('customer');

            let redirectUrl = `/embed-app-v2.html?route=/affiliate-dashboard&id=${data.affiliate.affiliateId}`;

            // Add customer parameter if it exists
            if (customerParam) {
              redirectUrl += `&customer=${customerParam}`;
              console.log('Preserving customer parameter:', customerParam);
            }

            console.log('Redirecting to:', redirectUrl);
            window.location.href = redirectUrl;
          } else {
            if (window.ModalSystem) {
              window.ModalSystem.error(data.message || 'Login failed. Please check your credentials and try again.', 'Login Failed');
            } else {
              alert(data.message || 'Login failed. Please check your credentials and try again.');
            }
          }
        })
        .catch(error => {
          console.error('Login error:', error);
          if (window.ModalSystem) {
            window.ModalSystem.error('Login failed. Please check your credentials and try again.', 'Login Error');
          } else {
            alert('Login failed. Please check your credentials and try again.');
          }
        });
    });
  }

  // Initialize immediately
  initializeAffiliateLogin();

})(); // End IIFE