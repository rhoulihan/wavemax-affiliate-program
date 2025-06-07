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

  // OAuth Social Login Functionality for Affiliates
  function handleAffiliateLogin(provider) {
    console.log(`Starting ${provider} social login for affiliate`);

    // For embedded context, use popup window to avoid iframe restrictions
    if (isEmbedded || window.self !== window.top) {
      // Generate unique session ID for database polling
      const sessionId = 'oauth_' + Date.now() + '_' + Math.random().toString(36).substring(2);
      console.log('Generated Affiliate Login OAuth session ID:', sessionId);
      
      const oauthUrl = `${baseUrl}/api/v1/auth/${provider}?popup=true&state=${sessionId}&t=${Date.now()}`;
      console.log('🔗 Opening Affiliate Login OAuth URL:', oauthUrl);
      
      const popup = window.open(
        oauthUrl, 
        'affiliateSocialLogin',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      console.log('Affiliate login popup opened:', {
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
      
      console.log('Starting database polling for Affiliate Login OAuth result...');
      
      const pollForResult = setInterval(async () => {
        pollCount++;
        
        try {
          // Check if popup is closed
          if (popup.closed) {
            console.log('Affiliate login popup closed, continuing to poll for result...');
          }
          
          // Poll the database for result
          const response = await csrfFetch(`${baseUrl}/api/v1/auth/oauth-session/${sessionId}`);
          
          console.log('🔍 Affiliate login polling response:', {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('📊 Affiliate login response data:', data);
            if (data.success && data.result) {
              console.log('📨 Affiliate login OAuth result received from database:', data.result);
              authResultReceived = true;
              clearInterval(pollForResult);
              
              if (popup && !popup.closed) {
                popup.close();
              }
              
              // Handle the result
              try {
                if (data.result.type === 'social-auth-login') {
                  console.log('Processing affiliate social-auth-login from database');
                  console.log('Full result data:', data.result);
                  
                  // Store token and affiliate data
                  localStorage.setItem('affiliateToken', data.result.token);
                  
                  // Check if we have affiliate data and store it
                  if (data.result.affiliate) {
                    localStorage.setItem('currentAffiliate', JSON.stringify(data.result.affiliate));
                    console.log('Stored affiliate data:', data.result.affiliate);
                  }

                  // Navigate to affiliate dashboard - affiliate data should always be present
                  if (!data.result.affiliate || !data.result.affiliate.affiliateId) {
                    console.error('OAuth login successful but affiliate data is missing:', data.result);
                    if (window.ModalSystem) {
                        window.ModalSystem.error('Login successful but affiliate information is missing. Please contact support.', 'Missing Information');
                    } else {
                        alert('Login successful but affiliate information is missing. Please contact support.');
                    }
                    return;
                  }
                  
                  const affiliateId = data.result.affiliate.affiliateId;
                  console.log('Redirecting to affiliate dashboard after social login, affiliateId:', affiliateId);
                  window.location.href = `/embed-app.html?route=/affiliate-dashboard&id=${affiliateId}`;
                  
                } else if (data.result.type === 'social-auth-success') {
                  console.log('Affiliate does not exist, redirecting to registration');
                  // New affiliate - redirect to registration with social token
                  if (window.ModalSystem) {
                      window.ModalSystem.alert('Account not found. You will be redirected to registration to create a new affiliate account.', 'Account Not Found');
                  } else {
                      alert('Account not found. You will be redirected to registration to create a new affiliate account.');
                  }
                  window.location.href = `/embed-app.html?route=/affiliate-register&socialToken=${data.result.socialToken}&provider=${data.result.provider}`;
                  
                } else if (data.result.type === 'social-auth-account-conflict') {
                  console.log('Processing social-auth-account-conflict from database');
                  const accountType = data.result.accountType;
                  const message = data.result.message;
                  
                  if (accountType === 'customer') {
                    const customerName = `${data.result.customerData.firstName} ${data.result.customerData.lastName}`;
                    const confirmMessage = `${message}\n\nCustomer: ${customerName} (${data.result.customerData.email})\n\nClick OK to login as a customer, or Cancel to stay on affiliate login.`;
                    
                    if (confirm(confirmMessage)) {
                      // Redirect to customer login
                      window.location.href = `/embed-app.html?route=/customer-login`;
                    }
                  } else {
                    if (window.ModalSystem) {
                        window.ModalSystem.error(message, 'Login Error');
                    } else {
                        alert(message);
                    }
                  }
                  
                } else if (data.result.type === 'social-auth-error') {
                  console.log('Processing affiliate social-auth-error from database');
                  if (window.ModalSystem) {
                      window.ModalSystem.error(data.result.message || 'Social authentication failed', 'Authentication Failed');
                  } else {
                      alert(data.result.message || 'Social authentication failed');
                  }
                  
                } else {
                  console.log('Unknown affiliate login result type:', data.result.type);
                }
              } catch (resultError) {
                console.error('Error processing Affiliate Login OAuth result:', resultError);
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
            console.log('Affiliate login database polling timeout exceeded');
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
            console.log(`🔄 Polling for Affiliate Login OAuth result... (${pollCount}/${maxPolls})`);
          }
          
        } catch (error) {
          // 404 means no result yet, continue polling
          if (error.message && error.message.includes('404')) {
            return;
          }
          
          console.error('Error polling for Affiliate Login OAuth result:', error);
          
          // Don't stop polling for network errors, just log them
          if (pollCount % 10 === 0) {
            console.log('Network error during Affiliate Login polling, continuing...');
          }
        }
      }, 3000); // Poll every 3 seconds
    } else {
      // For non-embedded context, use direct navigation
      window.location.href = `${baseUrl}/api/v1/auth/${provider}`;
    }
  }

  // Setup OAuth button handlers
  console.log('🔍 Setting up OAuth button handlers...');
  const googleLogin = document.getElementById('googleLogin');
  const facebookLogin = document.getElementById('facebookLogin');
  const linkedinLogin = document.getElementById('linkedinLogin');

  console.log('🔍 Found buttons:', {
    googleLogin: !!googleLogin,
    facebookLogin: !!facebookLogin,
    linkedinLogin: !!linkedinLogin
  });

  if (googleLogin) {
    console.log('✅ Attaching Google login handler');
    googleLogin.addEventListener('click', function() {
      console.log('🔴 Google login button clicked!');
      handleAffiliateLogin('google');
    });
  } else {
    console.error('❌ Google login button not found!');
  }

  if (facebookLogin) {
    facebookLogin.addEventListener('click', function() {
      handleAffiliateLogin('facebook');
    });
  }

  if (linkedinLogin) {
    linkedinLogin.addEventListener('click', function() {
      handleAffiliateLogin('linkedin');
    });
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

          console.log('Login successful, redirecting to dashboard');
          
          // Check for additional URL parameters to preserve (like customer filtering)
          const urlParams = new URLSearchParams(window.location.search);
          const customerParam = urlParams.get('customer');
          
          let redirectUrl = `/embed-app.html?route=/affiliate-dashboard&id=${data.affiliate.affiliateId}`;
          
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