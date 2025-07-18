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

        console.log('Making API request to:', 'https://wavemax.promo/api/v1/auth/customer/login');
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

              // Check URL params for redirect destination
              const urlParams = new URLSearchParams(window.location.search);
              const redirectParam = urlParams.get('redirect');
              const pickupParam = urlParams.get('pickup');
              const pickupFromSession = sessionStorage.getItem('redirectToPickup');
              const redirectFromSession = sessionStorage.getItem('redirectTo');

              console.log('Current URL:', window.location.href);
              console.log('URL search params:', window.location.search);
              console.log('Redirect parameter from URL:', redirectParam);
              console.log('Pickup parameter from URL:', pickupParam);
              console.log('Redirect from session:', redirectFromSession);

              // Determine where to redirect
              let redirectTo = '/customer-dashboard'; // default
              
              if (redirectParam === 'schedule-pickup' || pickupParam === 'true' || 
                  pickupFromSession === 'true' || redirectFromSession === 'schedule-pickup') {
                redirectTo = '/schedule-pickup';
              }

              // Clear the session flags after reading
              if (pickupFromSession) {
                sessionStorage.removeItem('redirectToPickup');
              }
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

  // OAuth Social Login Functionality
  function handleSocialLogin(provider) {
    console.log(`Starting ${provider} social login for customer`);

    // For embedded context, use popup window to avoid iframe restrictions
    if (isEmbedded || window.self !== window.top) {
      // Generate unique session ID for database polling
      const sessionId = 'oauth_' + Date.now() + '_' + Math.random().toString(36).substring(2);
      console.log('Generated Customer Login OAuth session ID:', sessionId);

      const oauthUrl = `${baseUrl}/api/v1/auth/customer/${provider}?popup=true&state=${sessionId}&t=${Date.now()}`;
      console.log('🔗 Opening Customer Login OAuth URL:', oauthUrl);

      const popup = window.open(
        oauthUrl,
        'customerSocialLogin',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      console.log('Customer login popup opened:', {
        'popup exists': !!popup,
        'popup.closed': popup ? popup.closed : 'N/A'
      });

      if (!popup || popup.closed) {
        if (window.ModalSystem) {
          window.ModalSystem.error('Popup was blocked. Please allow popups for this site and try again.', 'Popup Blocked');
        } else {
          alert('Popup was blocked. Please allow popups for this site and try again.');
        }
        return;
      }

      // Database polling approach (more reliable than postMessage)
      let pollCount = 0;
      const maxPolls = 120; // 6 minutes max (120 * 3 seconds)
      let authResultReceived = false;

      console.log('Starting database polling for Customer Login OAuth result...');

      const pollForResult = setInterval(async () => {
        pollCount++;

        try {
          // Check if popup is closed
          if (popup.closed) {
            console.log('Customer login popup closed, continuing to poll for result...');
          }

          // Poll the database for result
          const response = await csrfFetch(`${baseUrl}/api/v1/auth/oauth-session/${sessionId}`);

          console.log('🔍 Customer login polling response:', {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText
          });

          if (response.ok) {
            const data = await response.json();
            console.log('📊 Customer login response data:', data);
            if (data.success && data.result) {
              console.log('📨 Customer login OAuth result received from database:', data.result);
              authResultReceived = true;
              clearInterval(pollForResult);

              if (popup && !popup.closed) {
                popup.close();
              }

              // Handle the result
              try {
                if (data.result.type === 'social-auth-login') {
                  console.log('Processing customer social-auth-login from database');
                  console.log('Full customer result data:', data.result);

                  // Store token and customer data
                  localStorage.setItem('customerToken', data.result.token);

                  // Store customer data if available
                  if (!data.result.customer || !data.result.customer.customerId) {
                    console.error('OAuth login successful but customer data is missing:', data.result);
                    if (window.ModalSystem) {
                      window.ModalSystem.error('Login successful but customer information is missing. Please contact support.', 'Missing Information');
                    } else {
                      alert('Login successful but customer information is missing. Please contact support.');
                    }
                    return;
                  }

                  localStorage.setItem('currentCustomer', JSON.stringify(data.result.customer));
                  console.log('Stored customer data:', data.result.customer);

                  // Use SessionManager to set auth data
                  if (window.SessionManager) {
                    window.SessionManager.setAuth('customer', {
                      token: data.result.token,
                      userData: data.result.customer
                    });
                  }

                  // Notify parent of successful login
                  sendMessageToParent('login-success', {
                    userType: 'customer',
                    customerId: data.result.customer.customerId,
                    token: data.result.token
                  });

                  // Check for redirect destination
                  const urlParams = new URLSearchParams(window.location.search);
                  const redirectParam = urlParams.get('redirect');
                  const pickupParam = urlParams.get('pickup');
                  const pickupFromSession = sessionStorage.getItem('redirectToPickup');
                  const redirectFromSession = sessionStorage.getItem('redirectTo');

                  console.log('OAuth redirect parameters:', {
                    redirectParam,
                    pickupParam,
                    pickupFromSession,
                    redirectFromSession
                  });

                  // Determine where to redirect
                  let redirectTo = '/customer-dashboard'; // default
                  
                  if (redirectParam === 'schedule-pickup' || pickupParam === 'true' || 
                      pickupFromSession === 'true' || redirectFromSession === 'schedule-pickup') {
                    redirectTo = '/schedule-pickup';
                  }

                  // Clear the session flags after reading
                  if (pickupFromSession) {
                    sessionStorage.removeItem('redirectToPickup');
                  }
                  if (redirectFromSession) {
                    sessionStorage.removeItem('redirectTo');
                  }

                  // Navigate within the embed system
                  console.log('Redirecting to:', redirectTo);
                  window.location.href = `/embed-app-v2.html?route=${redirectTo}`;

                } else if (data.result.type === 'social-auth-success') {
                  console.log('Customer does not exist, redirecting to registration');
                  // New customer - redirect to registration with social token
                  if (window.ModalSystem) {
                    window.ModalSystem.alert('Account not found. You will be redirected to registration to create a new customer account.', 'Account Not Found');
                  } else {
                    alert('Account not found. You will be redirected to registration to create a new customer account.');
                  }
                  window.location.href = `/customer-register-embed.html?socialToken=${data.result.socialToken}&provider=${data.result.provider}`;

                } else if (data.result.type === 'social-auth-account-conflict') {
                  console.log('Processing social-auth-account-conflict from database');
                  const accountType = data.result.accountType;
                  const message = data.result.message;

                  if (accountType === 'affiliate') {
                    const affiliateName = `${data.result.affiliateData.firstName} ${data.result.affiliateData.lastName}`;
                    const businessInfo = data.result.affiliateData.businessName ? ` (${data.result.affiliateData.businessName})` : '';
                    const confirmMessage = `${message}\n\nAffiliate: ${affiliateName}${businessInfo}\nEmail: ${data.result.affiliateData.email}\n\nClick OK to login as an affiliate, or Cancel to stay on customer login.`;

                    if (confirm(confirmMessage)) {
                      // Redirect to affiliate login
                      window.location.href = '/embed-app-v2.html?route=/affiliate-login';
                    }
                  } else {
                    if (window.ModalSystem) {
                      window.ModalSystem.error(message, 'Login Error');
                    } else {
                      alert(message);
                    }
                  }

                } else if (data.result.type === 'social-auth-error') {
                  console.log('Processing customer social-auth-error from database');
                  if (window.ModalSystem) {
                    window.ModalSystem.error(data.result.message || 'Social authentication failed', 'Authentication Failed');
                  } else {
                    alert(data.result.message || 'Social authentication failed');
                  }

                } else {
                  console.log('Unknown customer login result type:', data.result.type);
                }
              } catch (resultError) {
                console.error('Error processing Customer Login OAuth result:', resultError);
                if (window.ModalSystem) {
                  window.ModalSystem.error('Error processing authentication result', 'Processing Error');
                } else {
                  alert('Error processing authentication result');
                }
              }
              return;
            }
          }

          // Check for timeout
          if (pollCount > maxPolls) {
            console.log('Customer login database polling timeout exceeded');
            clearInterval(pollForResult);
            if (popup && !popup.closed) {
              popup.close();
            }
            if (window.ModalSystem) {
              window.ModalSystem.error('Authentication timed out. Please try again.', 'Authentication Timeout');
            } else {
              alert('Authentication timed out. Please try again.');
            }
            return;
          }

          // Log progress every 5 polls (15 seconds)
          if (pollCount % 5 === 0) {
            console.log(`🔄 Polling for Customer Login OAuth result... (${pollCount}/${maxPolls})`);
          }

        } catch (error) {
          // 404 means no result yet, continue polling
          if (error.message && error.message.includes('404')) {
            return;
          }

          console.error('Error polling for Customer Login OAuth result:', error);

          // Don't stop polling for network errors, just log them
          if (pollCount % 10 === 0) {
            console.log('Network error during Customer Login polling, continuing...');
          }
        }
      }, 3000); // Poll every 3 seconds
    } else {
      // For non-embedded context, use direct navigation
      window.location.href = `${baseUrl}/api/v1/auth/customer/${provider}`;
    }
  }

  // Setup OAuth button handlers
  function setupOAuthButtons() {
    const googleLogin = document.getElementById('googleLogin');
    const facebookLogin = document.getElementById('facebookLogin');
    const linkedinLogin = document.getElementById('linkedinLogin');

    if (googleLogin) {
      googleLogin.addEventListener('click', function() {
        handleSocialLogin('google');
      });
    }

    if (facebookLogin) {
      facebookLogin.addEventListener('click', function() {
        handleSocialLogin('facebook');
      });
    }

    if (linkedinLogin) {
      linkedinLogin.addEventListener('click', function() {
        handleSocialLogin('linkedin');
      });
    }
  }

  // Initialize everything when DOM is ready
  function init() {
    console.log('Customer login embed initializing');
    console.log('Document ready state:', document.readyState);
    console.log('Current URL:', window.location.href);
    console.log('URL search string:', window.location.search);

    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    console.log('All URL parameters:', Array.from(urlParams.entries()));

    // Store redirect parameter if present
    const redirectParam = urlParams.get('redirect');
    if (redirectParam) {
      sessionStorage.setItem('redirectTo', redirectParam);
      console.log('Stored redirect parameter in session:', redirectParam);
    }
    
    // Store pickup flag if present (legacy support)
    const pickupFlag = urlParams.get('pickup');
    if (pickupFlag === 'true') {
      sessionStorage.setItem('redirectToPickup', 'true');
      console.log('Stored pickup flag in session');
    }

    // Setup components
    setupFormSubmission();
    setupOAuthButtons();

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