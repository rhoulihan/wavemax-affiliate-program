// Customer login embed functionality
(function() {
  'use strict';

  // Note: Login endpoints currently don't require CSRF tokens
  // But we'll prepare for future implementation
  const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

  // Configuration for embedded environment
  const baseUrl = window.EMBED_CONFIG?.baseUrl || (window.location.protocol + '//' + window.location.host);
  const isEmbedded = window.EMBED_CONFIG?.isEmbedded || true;

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
  function navigateParent(page, params = {}) {
    sendMessageToParent('navigate', { page: page, params: params });
  }

  // Register link functionality removed - customers must use affiliate-specific registration links

  // Setup form submission
  let isSubmitting = false; // Prevent duplicate submissions
  
  function setupFormSubmission() {
    console.log('Setting up form submission');
    const form = document.getElementById('customerLoginForm');
    console.log('Form element:', form);

    if (form) {
      console.log('Adding submit event listener to form');
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('Form submitted');
        
        // Prevent duplicate submissions
        if (isSubmitting) {
          console.log('Form submission already in progress, ignoring duplicate submit');
          return;
        }

        const emailOrUsername = document.getElementById('emailOrUsername').value;
        const password = document.getElementById('password').value;
        const submitButton = form.querySelector('button[type="submit"]');

        console.log('Submitting login with email/username:', emailOrUsername);
        
        // Disable the submit button and set submitting flag
        isSubmitting = true;
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Logging in...';
        }

        // Send login status to parent
        sendMessageToParent('form-submit', { form: 'customer-login' });

        console.log('Making API request to:', window.location.origin + '/api/v1/auth/customer/login');
        console.log('Request body:', { emailOrUsername, password: '***' });

        // API call with full URL
        const loginFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

        loginFetch(`${baseUrl}/api/v1/auth/customer/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ emailOrUsername, password })
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

              // Use SessionManager to set auth data
              if (window.SessionManager) {
                window.SessionManager.setAuth('customer', {
                  token: data.token,
                  userData: data.customer
                });
              }

              // Notify parent of successful login
              sendMessageToParent('login-success', {
                userType: 'customer',
                customerId: data.customer.customerId
              });

              console.log('Login successful, navigating to dashboard');

              // Check session for redirect destination
              const redirectFromSession = sessionStorage.getItem('redirectTo');

              console.log('Current URL:', window.location.href);
              console.log('URL search params:', window.location.search);
              console.log('Redirect from session:', redirectFromSession);

              // Determine where to redirect
              let redirectTo = '/customer-dashboard'; // default

              // Clear the session flag after reading
              if (redirectFromSession) {
                sessionStorage.removeItem('redirectTo');
              }

              // Navigate within the embed system
              console.log('Redirecting to:', redirectTo);
              window.location.href = `/embed-app-v2.html?route=${redirectTo}`;
            } else {
              throw new Error(data.message || 'Login failed');
            }
          })
          .catch(error => {
            console.error('Login error:', error);
            
            // Re-enable form submission
            isSubmitting = false;
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = 'Sign In';
            }
            
            sendMessageToParent('login-error', {
              error: error.message
            });
            if (window.ModalSystem) {
              window.ModalSystem.error(error.message || 'Invalid username or password', 'Login Failed');
            } else {
              alert(error.message || 'Invalid username or password');
            }
          });
      });
    } else {
      console.error('Form not found! Looking for: customerLoginForm');
      // Try again after a short delay
      setTimeout(setupFormSubmission, 500);
    }
  }

  // No customer account exists for this sign-in. Open registration was retired
  // (PR 6/PR 11): customers sign up by scanning the QR code on an issued
  // WaveMAX laundry bag. Shown by the ?noAccount=true fallback redirect.
  function showNoAccountNotice() {
    const noAccountMessage = 'No account was found for this sign-in. To create a customer account, scan the QR code on your WaveMAX laundry bag to get started.';
    if (window.ModalSystem) {
      window.ModalSystem.alert(noAccountMessage, 'Account Not Found');
    } else {
      alert(noAccountMessage);
    }
  }

  function init() {
    console.log('Customer login embed initializing');
    console.log('Document ready state:', document.readyState);
    console.log('Current URL:', window.location.href);
    console.log('URL search string:', window.location.search);

    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    console.log('All URL parameters:', Array.from(urlParams.entries()));

    // Fallback redirect: no account exists for the sign-in
    if (urlParams.get('noAccount') === 'true') {
      showNoAccountNotice();
    }

    // Store redirect parameter if present
    const redirectParam = urlParams.get('redirect');
    if (redirectParam) {
      sessionStorage.setItem('redirectTo', redirectParam);
      console.log('Stored redirect parameter in session:', redirectParam);
    }

    // Setup components
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