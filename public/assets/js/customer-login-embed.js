// Customer login embed functionality
(function() {
  'use strict';

  // Note: Login endpoints currently don't require CSRF tokens
  // But we'll prepare for future implementation

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

  // Navigate to register
  function navigateToRegister() {
    console.log('navigateToRegister called');
    
    // Simply navigate to customer register without any affiliate logic
    navigateParent('customer-register');
  }

  // Setup register link click handler
  function setupRegisterLink() {
    console.log('Setting up register link');
    const registerLink = document.getElementById('registerLink');
    if (registerLink) {
      console.log('Register link found, adding click handler');
      registerLink.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Register link clicked');
        navigateToRegister();
      });
    } else {
      console.log('Register link not found');
    }
  }

  // Setup form submission
  function setupFormSubmission() {
    console.log('Setting up form submission');
    const form = document.getElementById('customerLoginForm');
    console.log('Form element:', form);

    if (form) {
      console.log('Adding submit event listener to form');
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('Form submitted');

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        console.log('Submitting login with username:', username);

        // Send login status to parent
        sendMessageToParent('form-submit', { form: 'customer-login' });

        console.log('Making API request to:', 'https://wavemax.promo/api/v1/auth/customer/login');
        console.log('Request body:', { username, password: '***' });

        // API call with full URL
        const loginFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;
        
        loginFetch('https://wavemax.promo/api/v1/auth/customer/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ username, password })
        })
          .then(response => {
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            return response.json().then(data => {
              if (!response.ok) {
                console.error('API error response:', data);
                throw new Error(data.message || 'Login failed');
              }
              return data;
            });
          })
          .then(data => {
            console.log('Login response data:', data);
            console.log('Customer data details:', JSON.stringify(data.customer, null, 2));
            if (data.success) {
              // Store token
              localStorage.setItem('customerToken', data.token);
              localStorage.setItem('currentCustomer', JSON.stringify(data.customer));

              // Notify parent of successful login
              sendMessageToParent('login-success', {
                userType: 'customer',
                customerId: data.customer.customerId
              });

              console.log('Login successful, navigating to dashboard');

              // Check URL params for pickup flag
              const urlParams = new URLSearchParams(window.location.search);
              const pickupParam = urlParams.get('pickup');
              const pickupFromSession = sessionStorage.getItem('redirectToPickup');

              console.log('Current URL:', window.location.href);
              console.log('URL search params:', window.location.search);
              console.log('Pickup parameter from URL:', pickupParam);
              console.log('Pickup parameter from session:', pickupFromSession);

              const shouldRedirectToPickup = pickupParam === 'true' || pickupFromSession === 'true';

              // Clear the session flag after reading
              if (pickupFromSession) {
                sessionStorage.removeItem('redirectToPickup');
              }

              // Navigate within the embed system
              if (shouldRedirectToPickup) {
                console.log('Redirecting to schedule pickup');
                // Navigate to schedule pickup page
                window.location.href = '/embed-app.html?route=/schedule-pickup';
              } else {
                console.log('Redirecting to customer dashboard');
                // Navigate to customer dashboard
                window.location.href = '/embed-app.html?route=/customer-dashboard';
              }
            } else {
              throw new Error(data.message || 'Login failed');
            }
          })
          .catch(error => {
            console.error('Login error:', error);
            sendMessageToParent('login-error', {
              error: error.message
            });
            alert(error.message || 'Invalid username or password');
          });
      });
    } else {
      console.error('Form not found! Looking for: customerLoginForm');
      // Try again after a short delay
      setTimeout(setupFormSubmission, 500);
    }
  }

  // Initialize everything when DOM is ready
  function init() {
    console.log('Customer login embed initializing');
    console.log('Document ready state:', document.readyState);
    console.log('Current URL:', window.location.href);

    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);

    // Store pickup flag if present
    const pickupFlag = urlParams.get('pickup');
    if (pickupFlag === 'true') {
      sessionStorage.setItem('redirectToPickup', 'true');
      console.log('Stored pickup flag in session');
    }

    // Setup components
    setupRegisterLink();
    setupFormSubmission();

    // Notify parent that iframe is loaded
    sendMessageToParent('iframe-loaded', { page: 'customer-login' });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();