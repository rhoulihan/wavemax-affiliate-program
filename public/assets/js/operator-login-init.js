(function() {
  'use strict';

  // Only run this script on the operator login page
  if (!document.getElementById('loginForm') || !document.getElementById('clock')) {
    console.log('Not on operator login page, skipping initialization');
    return;
  }

  // Note: Login endpoints currently don't require CSRF tokens
  // But we'll prepare for future implementation
  const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

  // Configuration
  const config = window.EMBED_CONFIG || {
    baseUrl: 'https://wavemax.promo'
  };
  const BASE_URL = config.baseUrl;

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

  // Track clock interval for cleanup (store on window for external cleanup)
  window.operatorClockInterval = null;
  
  // Only start clock if we're on the login page
  if (document.getElementById('clock')) {
    updateClock();
    window.operatorClockInterval = setInterval(updateClock, 1000);
  }

  // Check for auto-login on page load
  async function checkAutoLogin() {
    try {
      console.log('Checking auto-login from:', window.location.href);
      console.log('Base URL:', BASE_URL);
      
      const response = await fetch(`${BASE_URL}/api/v1/auth/operator/login`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const result = await response.json();
      console.log('Auto-login response:', response.status, result);
      
      if (response.ok && result.success) {
        console.log('Auto-login successful!');
        // Store tokens
        localStorage.setItem('operatorToken', result.token);
        localStorage.setItem('operatorRefreshToken', result.refreshToken);
        localStorage.setItem('operatorData', JSON.stringify(result.operator));
        
        // Redirect to operator scan page
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
      } else {
        console.log('Auto-login failed:', result.message);
      }
    } catch (error) {
      console.log('Auto-login error:', error.message);
    }
  }

  // Check for auto-login when page loads
  checkAutoLogin();

  // DOM elements
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');
  const submitBtn = document.getElementById('submitBtn');
  const submitText = document.getElementById('submitText');

  // Show error message
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';

    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 5000);
  }

  // Handle login form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Basic validation
    if (!email || !password) {
      showError('Please enter both email and password');
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
        body: JSON.stringify({ email, password })
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
        errorMessage.style.display = 'none';
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
          if (clockInterval) {
            clearInterval(clockInterval);
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
          showError(data.message || 'Invalid email or password');
        }

        // Clear password on error
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
      }
    } catch (error) {
      console.error('Login error:', error);
      showError('Network error. Please try again.');
    } finally {
      // Re-enable form
      submitBtn.disabled = false;
      submitText.textContent = 'CLOCK IN';
      if (submitBtn.style.background !== '#27ae60') {
        submitBtn.style.background = '#2ecc71';
      }
    }
  });
  }

  // Check if already logged in
  const existingToken = localStorage.getItem('operatorToken');
  if (existingToken) {
    // Verify token is still valid
    fetch(`${BASE_URL}/api/v1/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${existingToken}`
      }
    })
      .then(response => {
        if (response.ok) {
          // Check if within shift hours
          const operatorData = JSON.parse(localStorage.getItem('operatorData') || '{}');
          const now = new Date();
          const currentTime = now.getHours() * 60 + now.getMinutes();

          if (operatorData.shiftStart && operatorData.shiftEnd) {
            const shiftStart = parseInt(operatorData.shiftStart.split(':')[0]) * 60 +
                                     parseInt(operatorData.shiftStart.split(':')[1]);
            const shiftEnd = parseInt(operatorData.shiftEnd.split(':')[0]) * 60 +
                                   parseInt(operatorData.shiftEnd.split(':')[1]);

            const isWithinShift = (shiftEnd > shiftStart)
              ? (currentTime >= shiftStart && currentTime <= shiftEnd)
              : (currentTime >= shiftStart || currentTime <= shiftEnd);

            if (isWithinShift) {
              // Use navigateTo if available (when in embed-app-v2.html)
              if (window.navigateTo) {
                window.navigateTo('/operator-scan');
              } else {
                window.location.href = '/embed-app-v2.html?route=/operator-scan';
              }
            } else {
              // Clear tokens if outside shift
              localStorage.removeItem('operatorToken');
              localStorage.removeItem('operatorRefreshToken');
              localStorage.removeItem('operatorData');
              showError('Your shift has ended. Please login again during your shift hours.');
            }
          }
        } else {
          // Clear invalid token
          localStorage.removeItem('operatorToken');
          localStorage.removeItem('operatorRefreshToken');
          localStorage.removeItem('operatorData');
        }
      })
      .catch(() => {
        // Network error, let user try to login
      });
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

  // Auto-focus on email field
  document.getElementById('email').focus();

  // Initialize i18n
  async function initializeI18n() {
    await window.i18n.init({ debugMode: false });
    window.LanguageSwitcher.createSwitcher('language-switcher-container', {
      style: 'dropdown',
      showLabel: false
    });
  }

  // Initialize i18n when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeI18n);
  } else {
    initializeI18n();
  }
})();