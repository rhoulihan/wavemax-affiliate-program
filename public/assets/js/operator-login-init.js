(function() {
  'use strict';

  // Note: Login endpoints currently don't require CSRF tokens
  // But we'll prepare for future implementation
  const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

  // Configuration
  const config = window.EMBED_CONFIG || {
    baseUrl: 'https://wavemax.promo'
  };
  const BASE_URL = config.baseUrl;

  // Track clock interval for cleanup (store on window for external cleanup)
  window.operatorClockInterval = null;

  // Clock display
  function updateClock() {
    const clockElement = document.getElementById('clock');
    if (!clockElement) return; // Guard against missing element
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    clockElement.textContent = timeString;
  }

  // Show error message
  function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (!errorMessage) return;
    
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';

    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 5000);
  }

  // Removed auto-login functionality - PIN is always required on login page

  // Handle login form submission
  async function handleFormSubmit(e) {
    e.preventDefault();
    console.log('Form submit handler called');

    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const pinCode = document.getElementById('pinCode').value.trim();

    // Basic validation
    if (!pinCode) {
      showError('Please enter your PIN code');
      return;
    }

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pinCode)) {
      showError('PIN must be 4-6 digits');
      document.getElementById('pinCode').value = '';
      document.getElementById('pinCode').focus();
      return;
    }

    // Disable form during submission
    submitBtn.disabled = true;
    submitText.innerHTML = '<span class="loading"></span>';

    try {
      const response = await csrfFetch(`${BASE_URL}/api/v1/auth/operator/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ pinCode })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store tokens and operator data
        localStorage.setItem('operatorToken', data.token);
        localStorage.setItem('operatorRefreshToken', data.refreshToken);
        localStorage.setItem('operatorData', JSON.stringify(data.operator));

        // Use SessionManager to set auth data
        if (window.SessionManager) {
          window.SessionManager.setAuth('operator', {
            token: data.token,
            refreshToken: data.refreshToken,
            userData: data.operator
          });
        }

        // Show success message
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
          errorMessage.style.display = 'none';
        }
        submitText.textContent = 'CLOCKED IN!';
        submitBtn.style.background = '#27ae60';

        // Notify parent window if embedded
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'operator-login-success',
            data: {
              operator: data.operator,
              token: data.token
            }
          }, '*');
        }

        // Redirect to scanner interface
        setTimeout(() => {
          // Clear clock interval before navigation
          if (window.operatorClockInterval) {
            clearInterval(window.operatorClockInterval);
            window.operatorClockInterval = null;
          }
          
          // Use navigateTo if available (when in embed-app-v2.html)
          if (window.navigateTo) {
            window.navigateTo('/operator-scan');
          } else {
            window.location.href = '/embed-app-v2.html?route=/operator-scan';
          }
        }, 1000);
      } else {
        // Handle specific error cases
        if (response.status === 403 && data.message.includes('locked')) {
          showError('Account locked. Please try again later.');
        } else if (response.status === 403 && data.message.includes('inactive')) {
          showError('Account inactive. Contact your supervisor.');
        } else if (response.status === 403 && data.message.includes('shift hours')) {
          showError(`Login only allowed during shift hours: ${data.shiftHours}`);
        } else {
          showError(data.message || 'Invalid PIN code');
        }

        // Clear PIN on error
        document.getElementById('pinCode').value = '';
        document.getElementById('pinCode').focus();
      }
    } catch (error) {
      console.error('Login error:', error);
      showError('Network error. Please try again.');
    } finally {
      // Re-enable form
      submitBtn.disabled = false;
      submitText.textContent = 'CLOCK IN';
      if (submitBtn.style.background !== '#27ae60') {
        submitBtn.style.background = '#3b82f6';
      }
    }
  }

  // Initialize operator login
  function initOperatorLogin() {
    console.log('Initializing operator login page...');
    
    // ALWAYS clear operator session when loading the login page
    // This ensures PIN is always required
    console.log('Clearing operator session to force PIN entry');
    localStorage.removeItem('operatorToken');
    localStorage.removeItem('operatorRefreshToken');
    localStorage.removeItem('operatorData');
    sessionStorage.removeItem('operatorToken');
    sessionStorage.removeItem('operatorRefreshToken');
    sessionStorage.removeItem('operatorData');
    
    // Clear any cookies that might exist
    document.cookie = 'operatorToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'operatorRefreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    // Only run this script on the operator login page
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) {
      console.log('Login form not found, skipping operator login initialization');
      return;
    }

    // Attach form submission handler
    console.log('Attaching form submit handler');
    loginForm.addEventListener('submit', handleFormSubmit);

    // Start clock if element exists
    const clockElement = document.getElementById('clock');
    if (clockElement) {
      updateClock();
      window.operatorClockInterval = setInterval(updateClock, 1000);
    }

    // NO AUTO-LOGIN - Always require PIN entry on this page
    // Token validation will happen on the scan page instead

    // Auto-focus on PIN field
    const pinField = document.getElementById('pinCode');
    if (pinField) {
      pinField.focus();
    }

    // Listen for messages from parent window
    window.addEventListener('message', function(event) {
      if (event.data.type === 'logout') {
        localStorage.removeItem('operatorToken');
        localStorage.removeItem('operatorRefreshToken');
        localStorage.removeItem('operatorData');
        showError('You have been logged out.');
      }
    });
  }

  // Initialize i18n
  async function initializeI18n() {
    if (window.i18n && window.i18n.init) {
      await window.i18n.init({ debugMode: false });
    }
    if (window.LanguageSwitcher && window.LanguageSwitcher.createSwitcher) {
      window.LanguageSwitcher.createSwitcher('language-switcher-container', {
        style: 'dropdown',
        showLabel: false
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    console.log('DOM loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', function() {
      console.log('DOM loaded, initializing operator login');
      initOperatorLogin();
      initializeI18n();
    });
  } else {
    console.log('DOM already loaded, initializing operator login');
    initOperatorLogin();
    initializeI18n();
  }

})();