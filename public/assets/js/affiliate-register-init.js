// Initialization function for affiliate registration when dynamically loaded
(function() {
  'use strict';
  
  // Note: Registration endpoints currently don't require CSRF tokens
  // But we'll prepare for future implementation
  const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

function initializeAffiliateRegistration() {
  // Configuration for embedded environment
  const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
  const isEmbedded = window.EMBED_CONFIG?.isEmbedded || false;
  
  // Set language preference based on browser language
  const languagePreferenceField = document.getElementById('languagePreference');
  if (languagePreferenceField) {
    // Get browser language
    let browserLang = navigator.language || navigator.userLanguage || 'en';
    // Extract just the language code (e.g., 'en' from 'en-US')
    browserLang = browserLang.substring(0, 2).toLowerCase();
    
    // Check if it's one of our supported languages
    const supportedLanguages = ['en', 'es', 'pt', 'de'];
    const languagePreference = supportedLanguages.includes(browserLang) ? browserLang : 'en';
    
    // Set the value
    languagePreferenceField.value = languagePreference;
    console.log('Language preference set to:', languagePreference);
  }

  // Function to show modal when existing affiliate tries to register
  function showExistingAffiliateModal(result) {
    const affiliate = result.affiliate;
    const affiliateName = `${affiliate.firstName} ${affiliate.lastName}`;
    
    // Create modal HTML - positioned at top of viewport for iframe visibility
    const modalHTML = `
      <div id="existingAffiliateModal" class="fixed inset-0 bg-black bg-opacity-50 z-50" style="z-index: 9999; position: fixed; top: 0; left: 0; width: 100%; height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding-top: 20px;">
        <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl" style="margin-top: 0; position: relative;">
          <div class="text-center mb-6">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Account Already Exists</h3>
            <p class="text-sm text-gray-500 mb-4">
              Welcome back, <strong>${affiliateName}</strong>! This Google account is already associated with affiliate ID <strong>${affiliate.affiliateId}</strong>.
            </p>
          </div>
          
          <div class="space-y-3">
            <button id="loginToDashboard" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Continue to Dashboard
            </button>
            <button id="chooseAnotherMethod" class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Use Different Login Method
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Scroll to top of the page to ensure modal is visible
    window.scrollTo(0, 0);
    
    // Ensure modal is visible by also scrolling the document body to top
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Add event listeners
    document.getElementById('loginToDashboard').addEventListener('click', function() {
      console.log('User chose to login to dashboard');
      
      // Get affiliate ID from result
      const affiliateId = result.affiliate.affiliateId;
      console.log('Redirecting to affiliate dashboard, affiliateId:', affiliateId);
      
      // Always use direct window.location.href redirect like other successful logins
      window.location.href = `/embed-app.html?route=/affiliate-dashboard&id=${affiliateId}`;
      
      // Close modal
      document.getElementById('existingAffiliateModal').remove();
    });
    
    document.getElementById('chooseAnotherMethod').addEventListener('click', function() {
      console.log('User chose to use different login method');
      // Close modal and let user try another method
      document.getElementById('existingAffiliateModal').remove();
      
      // Optionally show a message about using a different account
      alert('Please try logging in with a different Google account or use the username/password login method.');
    });
    
    // Close modal when clicking outside
    document.getElementById('existingAffiliateModal').addEventListener('click', function(e) {
      if (e.target === this) {
        this.remove();
      }
    });
  }

  // Show/hide payment method fields based on selection
  const paymentMethodSelect = document.getElementById('paymentMethod');
  const bankInfoContainer = document.getElementById('bankInfoContainer');
  const paypalInfoContainer = document.getElementById('paypalInfoContainer');
  const accountNumberInput = document.getElementById('accountNumber');
  const routingNumberInput = document.getElementById('routingNumber');
  const paypalEmailInput = document.getElementById('paypalEmail');

  if (paymentMethodSelect) {
    paymentMethodSelect.addEventListener('change', function() {
      // Reset required fields
      accountNumberInput.required = false;
      routingNumberInput.required = false;
      paypalEmailInput.required = false;

      // Hide all containers first
      bankInfoContainer.style.display = 'none';
      paypalInfoContainer.style.display = 'none';

      // Show relevant container based on selection
      if (this.value === 'directDeposit') {
        bankInfoContainer.style.display = 'block';
        accountNumberInput.required = true;
        routingNumberInput.required = true;
      } else if (this.value === 'paypal') {
        paypalInfoContainer.style.display = 'block';
        paypalEmailInput.required = true;
      }
    });
  }

  // Social registration button handlers
  const googleRegister = document.getElementById('googleRegister');
  const facebookRegister = document.getElementById('facebookRegister');
  const linkedinRegister = document.getElementById('linkedinRegister');

  // Shared validation function for both OAuth and form submission
  function validateFormFields(isSocialRegistration = false) {
    const requiredFields = [];
    
    // Personal information always required (OAuth pre-fills these but they can be missing for validation during OAuth button click)
    requiredFields.push(
      { id: 'firstName', name: 'First Name' },
      { id: 'lastName', name: 'Last Name' },
      { id: 'email', name: 'Email' }
    );
    
    // Common required fields for both registration types
    requiredFields.push(
      { id: 'phone', name: 'Phone Number' },
      { id: 'address', name: 'Address' },
      { id: 'city', name: 'City' },
      { id: 'state', name: 'State' },
      { id: 'zipCode', name: 'ZIP Code' },
      { id: 'minimumDeliveryFee', name: 'Minimum Delivery Fee' },
      { id: 'perBagDeliveryFee', name: 'Per-Bag Delivery Fee' },
      { id: 'paymentMethod', name: 'Payment Method' }
    );

    // Only require username and password for traditional registration (NOT OAuth)
    if (!isSocialRegistration) {
      requiredFields.push(
        { id: 'username', name: 'Username' },
        { id: 'password', name: 'Password' }
      );
    }

    const missingFields = [];
    for (const field of requiredFields) {
      const element = document.getElementById(field.id);
      if (!element || !element.value.trim()) {
        missingFields.push(field.name);
      }
    }
    
    // Check service area separately (stored in hidden fields)
    const serviceLatitude = document.getElementById('serviceLatitude');
    const serviceLongitude = document.getElementById('serviceLongitude');
    if (!serviceLatitude?.value || !serviceLongitude?.value) {
      missingFields.push('Service Area (Please click on the map to set your service location)');
    }

    // Check payment method specific fields
    const paymentMethod = document.getElementById('paymentMethod')?.value;
    if (paymentMethod === 'directDeposit') {
      const accountNumber = document.getElementById('accountNumber');
      const routingNumber = document.getElementById('routingNumber');
      if (!accountNumber?.value.trim()) missingFields.push('Account Number');
      if (!routingNumber?.value.trim()) missingFields.push('Routing Number');
    } else if (paymentMethod === 'paypal') {
      const paypalEmail = document.getElementById('paypalEmail');
      if (!paypalEmail?.value.trim()) missingFields.push('PayPal Email');
    }

    return missingFields;
  }

  function handleSocialAuth(provider) {
    // No validation required before OAuth - the point is to authenticate first and auto-populate the form
    console.log(`🚀 Starting ${provider} OAuth authentication...`);

    // For embedded context, use popup window to avoid iframe restrictions
    if (isEmbedded || window.self !== window.top) {
      // Generate unique session ID for database polling
      const sessionId = 'oauth_' + Date.now() + '_' + Math.random().toString(36).substring(2);
      console.log('Generated OAuth session ID:', sessionId);
      
      const oauthUrl = `${baseUrl}/api/v1/auth/${provider}?popup=true&state=${sessionId}&t=${Date.now()}`;
      console.log('🔗 Opening OAuth URL:', oauthUrl);
      
      const popup = window.open(
        oauthUrl, 
        'socialAuth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      console.log('Popup opened:', {
        'popup exists': !!popup,
        'popup.closed': popup ? popup.closed : 'N/A',
        'popup type': typeof popup,
        'popup URL': `${baseUrl}/api/v1/auth/${provider}?popup=true`
      });
      
      if (!popup || popup.closed) {
        window.ErrorHandler.showError('Popup was blocked. Please allow popups for this site and try again.');
        return;
      }
      
      // Database polling approach (more reliable than postMessage)
      let pollCount = 0;
      const maxPolls = 120; // 6 minutes max (120 * 3 seconds)
      let authResultReceived = false;
      
      console.log('Starting database polling for OAuth result...');
      
      const pollForResult = setInterval(async () => {
        pollCount++;
        
        try {
          // Check if popup is closed
          if (popup.closed) {
            console.log('Popup closed, continuing to poll for result...');
          }
          
          // Poll the database for result
          const response = await csrfFetch(`${baseUrl}/api/v1/auth/oauth-session/${sessionId}`);
          
          // Handle 404 specifically - it's expected while waiting for OAuth completion
          if (response.status === 404) {
            // Session doesn't exist yet, continue polling
            if (pollCount % 10 === 0) {
              console.log('Waiting for OAuth authentication to complete...');
            }
            return;
          }
          
          console.log('🔍 Polling response:', {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('📊 Response data:', data);
            if (data.success && data.result) {
              console.log('📨 OAuth result received from database:', data.result);
              authResultReceived = true;
              clearInterval(pollForResult);
              
              if (popup && !popup.closed) {
                popup.close();
              }
              
              // Handle the result
              try {
                if (data.result.type === 'social-auth-success') {
                  console.log('Processing social-auth-success from database');
                  console.log('Calling showSocialRegistrationCompletion with:', {
                    socialToken: data.result.socialToken,
                    provider: data.result.provider
                  });
                  showSocialRegistrationCompletion(data.result.socialToken, data.result.provider);
                } else if (data.result.type === 'social-auth-login') {
                console.log('Processing social-auth-login from database');
                // Show modal dialog asking user what they want to do
                showExistingAffiliateModal(data.result);
              } else if (data.result.type === 'social-auth-error') {
                console.log('Processing social-auth-error from database');
                window.ErrorHandler.showError(data.result.message || 'Social authentication failed');
              } else {
                console.log('Unknown result type:', data.result.type);
              }
              } catch (resultError) {
                console.error('Error processing OAuth result:', resultError);
                window.ErrorHandler.showError('Error processing authentication result');
              }
              return;
            }
          }
          
          // Check for timeout
          if (pollCount > maxPolls) {
            console.log('Database polling timeout exceeded');
            clearInterval(pollForResult);
            if (popup && !popup.closed) {
              popup.close();
            }
            window.ErrorHandler.showError('Authentication timed out. Please try again.');
            return;
          }
          
          // Log progress every 5 polls (15 seconds)
          if (pollCount % 5 === 0) {
            console.log(`🔄 Polling for OAuth result... (${pollCount}/${maxPolls})`);
          }
          
        } catch (error) {
          // 404 is expected - it means the OAuth session hasn't been created yet
          // This happens while the user is still on Google's auth page
          if (error.message && error.message.includes('404')) {
            // Session not created yet, this is normal - continue polling
            if (pollCount % 10 === 0) {
              console.log('Waiting for user to complete OAuth authentication...');
            }
            return;
          }
          
          console.error('Error polling for OAuth result:', error);
          
          // Don't stop polling for network errors, just log them
          if (pollCount % 10 === 0) {
            console.log('Network error during polling, continuing...');
          }
        }
      }, 3000); // Poll every 3 seconds instead of 1 second
    } else {
      // For non-embedded context, use direct navigation
      window.location.href = `${baseUrl}/api/v1/auth/${provider}`;
    }
  }

  if (googleRegister) {
    googleRegister.addEventListener('click', function() {
      handleSocialAuth('google');
    });
  }

  if (facebookRegister) {
    facebookRegister.addEventListener('click', function() {
      handleSocialAuth('facebook');
    });
  }

  if (linkedinRegister) {
    linkedinRegister.addEventListener('click', function() {
      handleSocialAuth('linkedin');
    });
  }

  // Handle social registration completion
  function handleSocialRegistrationCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const socialToken = urlParams.get('socialToken');
    const provider = urlParams.get('provider');
    const error = urlParams.get('error');

    if (error) {
      let errorMessage = 'Social authentication failed. Please try again.';
      switch(error) {
        case 'social_auth_failed':
          errorMessage = 'Social authentication failed. Please try again or use traditional registration.';
          break;
        case 'social_auth_error':
          errorMessage = 'An error occurred during social authentication. Please try again.';
          break;
      }
      window.ErrorHandler.showError(errorMessage);
      return;
    }

    if (socialToken && provider) {
      // Pre-fill form with social data and show completion section
      showSocialRegistrationCompletion(socialToken, provider);
    }
  }

  function showSocialRegistrationCompletion(socialToken, provider) {
    console.log('🎨 Showing social registration completion for provider:', provider);
    
    // Update the social auth section to show connected status
    const socialAuthSection = document.getElementById('socialAuthSection');
    console.log('🔍 Found social auth section:', socialAuthSection);
    
    if (socialAuthSection) {
      console.log('✅ Updating social auth section with success message');
      socialAuthSection.innerHTML = `
        <h3 class="text-xl font-bold mb-4" data-i18n="affiliate.register.socialAccountConnected">Social Media Account Connected!</h3>
        <div class="bg-green-50 border border-green-200 rounded-lg p-6">
          <div class="flex items-center justify-center">
            <svg class="w-8 h-8 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <div>
              <h4 class="text-green-700 font-semibold text-lg" data-i18n="affiliate.register.successfullyConnectedWith" data-i18n-param-provider="${provider.charAt(0).toUpperCase() + provider.slice(1)}">Successfully Connected with ${provider.charAt(0).toUpperCase() + provider.slice(1)}</h4>
              <p class="text-green-600 text-sm mt-1" data-i18n="affiliate.register.autoFilledMessage">Your information has been automatically filled in below. Complete the remaining fields to finish your registration.</p>
            </div>
          </div>
        </div>
      `;
      
      // Trigger i18n update for the new content
      if (window.i18next && window.i18next.isInitialized) {
        window.i18n.updateContent();
      }
    }

    // Hide account setup section immediately for OAuth users
    const accountSetupSection = document.getElementById('accountSetupSection');
    if (accountSetupSection) {
      accountSetupSection.style.display = 'none';
      console.log('✅ Hidden account setup section for OAuth user');
    }
    
    // Note: Account setup section will remain hidden for OAuth users
    window.isOAuthUser = true;
    
    // Remove required attributes from username/password fields for OAuth users
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    const confirmPasswordField = document.getElementById('confirmPassword');
    
    if (usernameField) usernameField.removeAttribute('required');
    if (passwordField) passwordField.removeAttribute('required');
    if (confirmPasswordField) confirmPasswordField.removeAttribute('required');

    // Store social token for form submission
    const form = document.getElementById('affiliateRegistrationForm');
    console.log('📝 Found form:', form ? 'Yes' : 'No');
    if (form) {
      const socialTokenInput = document.createElement('input');
      socialTokenInput.type = 'hidden';
      socialTokenInput.name = 'socialToken';
      socialTokenInput.value = socialToken;
      form.appendChild(socialTokenInput);
      console.log('✅ Added social token to form');
    }

    // Auto-populate form fields from social token (decode JWT payload)
    try {
      const payload = JSON.parse(atob(socialToken.split('.')[1]));
      console.log('🔓 Decoded social token payload:', payload);
      
      // Auto-fill personal information
      if (payload.firstName) {
        const firstNameField = document.getElementById('firstName');
        if (firstNameField && !firstNameField.value) {
          firstNameField.value = payload.firstName;
          firstNameField.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
          console.log('✅ Pre-filled firstName:', payload.firstName);
        }
      }
      
      if (payload.lastName) {
        const lastNameField = document.getElementById('lastName');
        if (lastNameField && !lastNameField.value) {
          lastNameField.value = payload.lastName;
          lastNameField.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
          console.log('✅ Pre-filled lastName:', payload.lastName);
        }
      }
      
      if (payload.email) {
        const emailField = document.getElementById('email');
        if (emailField && !emailField.value) {
          emailField.value = payload.email;
          emailField.readOnly = true; // Make it read-only since it comes from OAuth
          emailField.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
          console.log('✅ Pre-filled email:', payload.email);
        }
      }
      
    } catch (e) {
      console.log('Could not decode social token for pre-filling:', e);
    }
  }

  // Password strength validation
  function validatePasswordStrength(password, username = '', email = '') {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)
    };

    // Check against common patterns and user data
    const hasSequential = /123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password);
    const hasUsername = username && password.toLowerCase().includes(username.toLowerCase());
    const hasEmail = email && password.toLowerCase().includes(email.split('@')[0].toLowerCase());
    const hasRepeated = /(.)\1{2,}/.test(password);

    requirements.noSequential = !hasSequential;
    requirements.noUsername = !hasUsername;
    requirements.noEmail = !hasEmail;
    requirements.noRepeated = !hasRepeated;

    const score = Object.values(requirements).filter(Boolean).length;
    return { requirements, score, isValid: score >= 5 && requirements.length && requirements.uppercase && requirements.lowercase && requirements.number && requirements.special };
  }

  function updatePasswordRequirements(password, username = '', email = '') {
    const validation = validatePasswordStrength(password, username, email);
    const requirements = validation.requirements;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Add password match requirement
    requirements.match = password !== '' && password === confirmPassword;

    // Update requirement indicators
    const updateReq = (id, met) => {
      const element = document.getElementById(id);
      if (element) {
        const indicator = element.querySelector('span');
        indicator.textContent = met ? '✅' : '⚪';
        element.className = met ? 'flex items-center text-green-600' : 'flex items-center text-gray-600';
      }
    };

    updateReq('req-length', requirements.length);
    updateReq('req-uppercase', requirements.uppercase);
    updateReq('req-lowercase', requirements.lowercase);
    updateReq('req-number', requirements.number);
    updateReq('req-special', requirements.special);
    updateReq('req-match', requirements.match);

    // Update strength indicator
    const strengthElement = document.getElementById('passwordStrength');
    if (strengthElement) {
      if (password.length === 0) {
        strengthElement.innerHTML = '';
      } else if (validation.isValid) {
        strengthElement.innerHTML = '<span class="text-green-600 font-medium">✅ Strong password</span>';
      } else {
        const missing = [];
        if (!requirements.length) missing.push('8+ characters');
        if (!requirements.uppercase) missing.push('uppercase letter');
        if (!requirements.lowercase) missing.push('lowercase letter');
        if (!requirements.number) missing.push('number');
        if (!requirements.special) missing.push('special character');
        
        strengthElement.innerHTML = `<span class="text-red-600">❌ Missing: ${missing.join(', ')}</span>`;
      }
    }

    return validation.isValid;
  }

  // Add password validation event listeners
  const passwordField = document.getElementById('password');
  const confirmPasswordField = document.getElementById('confirmPassword');
  const usernameField = document.getElementById('username');
  const emailField = document.getElementById('email');

  if (passwordField) {
    passwordField.addEventListener('input', function() {
      updatePasswordRequirements(
        this.value, 
        usernameField?.value || '', 
        emailField?.value || ''
      );
    });
  }

  if (usernameField) {
    usernameField.addEventListener('input', function() {
      if (passwordField?.value) {
        updatePasswordRequirements(
          passwordField.value, 
          this.value, 
          emailField?.value || ''
        );
      }
    });
  }

  if (emailField) {
    emailField.addEventListener('input', function() {
      if (passwordField?.value) {
        updatePasswordRequirements(
          passwordField.value, 
          usernameField?.value || '', 
          this.value
        );
      }
    });
  }

  if (confirmPasswordField) {
    confirmPasswordField.addEventListener('input', function() {
      if (passwordField?.value) {
        updatePasswordRequirements(
          passwordField.value, 
          usernameField?.value || '', 
          emailField?.value || ''
        );
      }
    });
  }

  // Check for social registration callback on page load
  handleSocialRegistrationCallback();

  // Form validation and submission
  const form = document.getElementById('affiliateRegistrationForm');

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      try {
        // Determine if this is a social registration first
        const formData = new FormData(form);
        const isSocialRegistration = formData.get('socialToken');

        // Validate required fields
        const missingFields = validateFormFields(isSocialRegistration);
        if (missingFields.length > 0) {
          window.ErrorHandler.showError(
            `Please fill in the following required fields: ${missingFields.join(', ')}`
          );
          return;
        }

        // Check if passwords match (only for traditional registration)
        if (!isSocialRegistration) {
          const password = document.getElementById('password').value;
          const confirmPassword = document.getElementById('confirmPassword').value;

          if (password !== confirmPassword) {
            window.ErrorHandler.showError('Passwords do not match!');
            return;
          }
        }

        // Collect form data (reuse the formData from above)
        const affiliateData = {};

        formData.forEach((value, key) => {
          affiliateData[key] = value;
        });
        
        // Debug logging to verify all fields are present
        console.log('Form submission data:', affiliateData);
        console.log('Has zipCode?', !!affiliateData.zipCode, affiliateData.zipCode);
        console.log('Is social registration?', isSocialRegistration);

        // Determine endpoint based on whether this is a social registration
        const endpoint = isSocialRegistration 
          ? `${baseUrl}/api/v1/auth/social/register`
          : `${baseUrl}/api/v1/affiliates/register`;

        // API call to the server with proper base URL
        const response = await csrfFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(affiliateData)
        });

        if (!response.ok) {
          console.error('Registration failed with status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.errors && Array.isArray(errorData.errors)) {
              console.error('Validation errors:');
              errorData.errors.forEach(err => {
                console.error(`- ${err.param || err.path}: ${err.msg}`);
              });
            }
          } catch (e) {
            // Not JSON error
          }
        }
        
        await window.ErrorHandler.handleFetchError(response);
        const data = await response.json();

        console.log('Registration response:', data);

        // Store the affiliate data for the success page
        localStorage.setItem('currentAffiliate', JSON.stringify({
          ...affiliateData,
          affiliateId: data.affiliateId
        }));

        // Handle redirect based on whether we're embedded
        if (isEmbedded) {
          // For embed-app, send navigation message
          console.log('isEmbedded:', isEmbedded);
          console.log('Sending navigation message to parent');
          console.log('Window parent:', window.parent);
          console.log('Window parent !== window:', window.parent !== window);

          // Try multiple navigation approaches
          try {
            // First try postMessage
            window.parent.postMessage({
              type: 'navigate',
              data: { url: '/affiliate-success' }
            }, '*');
            console.log('Navigation message sent successfully');

            // Also try direct navigation as fallback
            setTimeout(() => {
              console.log('Trying direct navigation as fallback');
              // Check if we're still on the same page
              if (window.location.href.includes('affiliate-register')) {
                window.location.href = '/embed-app.html?route=/affiliate-success';
              }
            }, 1000);
          } catch (msgError) {
            console.error('Error sending message:', msgError);
            // Fallback to direct navigation
            window.location.href = '/embed-app.html?route=/affiliate-success';
          }
        } else {
          // Otherwise, normal redirect
          window.location.href = '/embed-app.html?route=/affiliate-success';
        }
      } catch (error) {
        console.error('Registration error:', error);

        // If we're embedded and there's a connection error, notify parent
        if (isEmbedded && error.message.includes('fetch')) {
          window.parent.postMessage({
            type: 'registration-error',
            message: 'Unable to connect to registration server. Please try again later.'
          }, '*');
        }
      }
    });
  }

  // Listen for messages from parent window if embedded
  if (isEmbedded) {
    // Store ResizeObserver instance for cleanup
    let resizeObserver = null;
    
    window.addEventListener('message', function(event) {
      // Verify origin for security
      if (event.origin !== baseUrl.replace(/\/$/, '')) {
        return;
      }

      // Handle different message types
      switch (event.data.type) {
      case 'prefill-form':
        // Allow parent to prefill form data
        if (event.data.data) {
          Object.keys(event.data.data).forEach(key => {
            const field = document.getElementById(key);
            if (field) {
              field.value = event.data.data[key];
            }
          });
        }
        break;

      case 'get-form-height':
        // Send form height to parent for iframe resizing
        window.parent.postMessage({
          type: 'form-height',
          height: document.body.scrollHeight
        }, event.origin);
        break;
      }
    });

    // Notify parent that form is loaded
    window.parent.postMessage({
      type: 'form-loaded',
      height: document.body.scrollHeight
    }, '*');

    // Monitor form height changes
    resizeObserver = new ResizeObserver(entries => {
      // Check if we're still on the registration page
      if (!window.location.href.includes('affiliate-success')) {
        for (let entry of entries) {
          console.log('Sending height to parent:', entry.target.scrollHeight);
          window.parent.postMessage({
            type: 'form-height',
            height: entry.target.scrollHeight
          }, '*');
        }
      } else {
        // If we've navigated away, disconnect the observer
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
      }
    });
    resizeObserver.observe(document.body);
    
    // Initialize fee calculator
    initializeFeeCalculator();
  }

  // Fee calculator functionality
  function initializeFeeCalculator() {
    const minFeeInput = document.getElementById('minimumDeliveryFee');
    const perBagInput = document.getElementById('perBagDeliveryFee');
    
    if (!minFeeInput || !perBagInput) return;
    
    // Update on input change
    minFeeInput.addEventListener('input', updateFeeCalculator);
    perBagInput.addEventListener('input', updateFeeCalculator);
    
    // Initial calculation
    updateFeeCalculator();
    
    // Clean up observer before navigation
    window.addEventListener('beforeunload', function() {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    });
    
    // Also clean up on custom events from parent
    window.addEventListener('page-cleanup', function() {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    });
    
    window.addEventListener('disconnect-observers', function() {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    });
  }

  // Delivery fee calculator update
  function updateFeeCalculator() {
    const minimumFee = parseFloat(document.getElementById('minimumDeliveryFee')?.value) || 25;
    const perBagFee = parseFloat(document.getElementById('perBagDeliveryFee')?.value) || 10;
    
    // Update all example calculations
    [1, 3, 5, 10].forEach(bags => {
      const calculatedFee = bags * perBagFee;
      const oneWayFee = Math.max(minimumFee, calculatedFee);
      const roundTripFee = oneWayFee * 2; // Pickup + delivery
      
      const element = document.getElementById(`calc${bags}bag${bags > 1 ? 's' : ''}`);
      if (element) {
        element.textContent = `$${roundTripFee}`;
        // Add visual indicator if minimum applies
        if (oneWayFee === minimumFee && calculatedFee < minimumFee) {
          element.classList.add('font-bold');
          element.title = 'Minimum fee applies (x2 for round trip)';
        } else {
          element.classList.remove('font-bold');
          element.title = `${bags} × $${perBagFee} = $${calculatedFee} (x2 for round trip)`;
        }
      }
    });
  }


  // Initialize service area map
  let serviceAreaMap = window.affiliateServiceAreaMap || null;
  let serviceMarker = window.affiliateServiceMarker || null;
  let serviceCircle = window.affiliateServiceCircle || null;
  let mapInitialized = window.affiliateMapInitialized || false;

  function initializeServiceAreaMap() {
    // Prevent duplicate initialization
    if (mapInitialized || serviceAreaMap) {
      console.log('Map already initialized, skipping');
      return;
    }
    
    // Default to WaveMAX store location: 825 E Rundberg Lane, Austin, TX 78753
    const defaultLat = 30.3524;
    const defaultLng = -97.6841;
    
    try {
      // Initialize map
      serviceAreaMap = L.map('serviceAreaMap').setView([defaultLat, defaultLng], 13);
      mapInitialized = true;
      // Store globally to prevent re-initialization
      window.affiliateServiceAreaMap = serviceAreaMap;
      window.affiliateMapInitialized = true;
      console.log('Map initialized successfully');
    } catch (error) {
      console.error('Error initializing map:', error);
      return;
    }
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(serviceAreaMap);
    
    // Get radius slider and value display
    const radiusSlider = document.getElementById('radiusSlider');
    const radiusValue = document.getElementById('radiusValue');
    const serviceRadius = document.getElementById('serviceRadius');
    
    // Set default location values immediately (Austin, TX)
    document.getElementById('serviceLatitude').value = defaultLat.toFixed(6);
    document.getElementById('serviceLongitude').value = defaultLng.toFixed(6);
    document.getElementById('serviceRadius').value = radiusSlider ? radiusSlider.value : 5;
    
    // Function to update service area
    function updateServiceArea(lat, lng, radius) {
      // Update hidden fields
      document.getElementById('serviceLatitude').value = lat.toFixed(6);
      document.getElementById('serviceLongitude').value = lng.toFixed(6);
      serviceRadius.value = radius;
      
      // Remove existing marker and circle
      if (serviceMarker) {
        serviceAreaMap.removeLayer(serviceMarker);
      }
      if (serviceCircle) {
        serviceAreaMap.removeLayer(serviceCircle);
      }
      
      // Add new marker
      serviceMarker = L.marker([lat, lng], {
        title: 'Service Center',
        draggable: true
      }).addTo(serviceAreaMap);
      window.affiliateServiceMarker = serviceMarker;
      
      // Add circle to show service area
      serviceCircle = L.circle([lat, lng], {
        color: '#3b82f6',
        fillColor: '#93c5fd',
        fillOpacity: 0.3,
        radius: radius * 1609.34 // Convert miles to meters
      }).addTo(serviceAreaMap);
      window.affiliateServiceCircle = serviceCircle;
      
      // Update info display
      document.getElementById('serviceAreaInfo').classList.remove('hidden');
      document.getElementById('centerLocation').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      document.getElementById('coverageArea').textContent = `${radius} mile radius`;
      
      // Handle marker drag
      serviceMarker.on('dragend', function(event) {
        const position = event.target.getLatLng();
        updateServiceArea(position.lat, position.lng, parseInt(radiusSlider.value));
        // Update address field with coordinates
        reverseGeocode(position.lat, position.lng);
      });
    }
    
    // Make updateServiceArea globally accessible
    window.updateServiceArea = updateServiceArea;
    
    // Handle map click
    serviceAreaMap.on('click', function(e) {
      updateServiceArea(e.latlng.lat, e.latlng.lng, parseInt(radiusSlider.value));
      // Update address field with coordinates
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
    
    // Geocoding functions - always use bridge method
    function reverseGeocode(lat, lng) {
      const addressField = document.getElementById('serviceAddress');
      if (!addressField) return;
      
      if (window.parent !== window) {
        // Use bridge method when in iframe
        const requestId = 'reverse_' + Date.now();
        console.log('[Affiliate Registration] Using bridge for reverse geocoding');
        
        // Set up one-time handler for this specific request
        window.handleReverseGeocodeResponse = function(data) {
          if (data.requestId === requestId && data.address) {
            addressField.value = data.address;
          }
        };
        
        // Request from parent
        if (window.requestGeocodeReverse) {
          window.requestGeocodeReverse(lat, lng, requestId);
        }
      } else {
        // Direct Nominatim call when not in iframe
        console.log('[Affiliate Registration] Direct Nominatim call for reverse geocoding');
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`)
          .then(response => response.json())
          .then(data => {
            if (data.display_name) {
              addressField.value = data.display_name;
            }
          })
          .catch(error => {
            console.error('Reverse geocoding error:', error);
          });
      }
    }
    
    // Address autocomplete removed - using form fields instead
    
    // Handle radius slider change
    radiusSlider.addEventListener('input', function() {
      const radius = parseInt(this.value);
      radiusValue.textContent = radius;
      
      // Update circle if marker exists
      if (serviceMarker) {
        const position = serviceMarker.getLatLng();
        updateServiceArea(position.lat, position.lng, radius);
      }
    });
    
    // Check if we have pending map center from address validation
    if (window.pendingMapCenter) {
      console.log('[Service Area Map] Using pending map center from address validation');
      updateServiceArea(window.pendingMapCenter.lat, window.pendingMapCenter.lon, window.pendingMapCenter.radius);
      serviceAreaMap.setView([window.pendingMapCenter.lat, window.pendingMapCenter.lon], 14);
      // Clear the pending center
      delete window.pendingMapCenter;
    } else {
      // Set initial marker and circle at default location
      updateServiceArea(defaultLat, defaultLng, parseInt(radiusSlider ? radiusSlider.value : 5));
    }
  }
  
  // Initialize map when container is visible and Leaflet is loaded
  function waitForLeafletAndInitialize() {
    console.log('[Service Area Map] waitForLeafletAndInitialize called');
    
    // Remove any remaining event listeners to prevent duplicate calls
    window.removeEventListener('init-service-area-map', waitForLeafletAndInitialize);
    window.removeEventListener('dom-sections-ready', waitForLeafletAndInitialize);
    
    const mapContainer = document.getElementById('serviceAreaMap');
    
    if (!mapContainer) {
      console.log('[Service Area Map] Map container not found, skipping map initialization');
      return;
    }
    
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      console.log('Leaflet not loaded yet, waiting...');
      // Try to load Leaflet dynamically if not present
      if (!document.querySelector('script[src*="leaflet"]')) {
        console.log('Loading Leaflet dynamically...');
        
        // Add Leaflet CSS
        if (!document.querySelector('link[href*="leaflet"]')) {
          const leafletCSS = document.createElement('link');
          leafletCSS.rel = 'stylesheet';
          leafletCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
          document.head.appendChild(leafletCSS);
        }
        
        // Add Leaflet JS
        const leafletJS = document.createElement('script');
        leafletJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        leafletJS.onload = function() {
          console.log('Leaflet loaded dynamically');
          // Wait for trigger event instead of immediate retry
          window.addEventListener('init-service-area-map', waitForLeafletAndInitialize, { once: true });
        };
        document.body.appendChild(leafletJS);
        return;
      }
      // Wait for trigger event instead of timeout
      window.addEventListener('init-service-area-map', waitForLeafletAndInitialize, { once: true });
      return;
    }
    
    // Check if container has dimensions
    const rect = mapContainer.getBoundingClientRect();
    console.log('[Service Area Map] Container dimensions:', { width: rect.width, height: rect.height });
    
    if (rect.width === 0 || rect.height === 0) {
      console.log('[Service Area Map] Map container has no dimensions yet, waiting for trigger event...');
      // Check if container is actually visible
      const section = document.getElementById('serviceAreaSection');
      console.log('[Service Area Map] Service area section display:', section ? section.style.display : 'section not found');
      
      // Wait for trigger event instead of timeout
      window.addEventListener('init-service-area-map', waitForLeafletAndInitialize, { once: true });
      return;
    }
    
    console.log('Leaflet loaded and container ready, initializing map');
    console.log('Leaflet version:', L.version);
    initializeServiceAreaMap();
  }
  
  // Listen for trigger events to initialize map
  window.addEventListener('init-service-area-map', waitForLeafletAndInitialize, { once: true });
  window.addEventListener('dom-sections-ready', () => {
    console.log('[Service Area Map] DOM sections ready event received');
    // Give browser a chance to complete rendering
    requestAnimationFrame(() => {
      waitForLeafletAndInitialize();
    });
  }, { once: true });
  
  // Try initial initialization in case section is already visible
  if (document.getElementById('serviceAreaMap')) {
    const container = document.getElementById('serviceAreaMap').closest('.form-section-hidden');
    if (!container || container.style.display !== 'none') {
      // Section is visible, try to initialize
      waitForLeafletAndInitialize();
    }
  }
  
  // Set up address validation button
  function setupAddressValidation() {
    const validateButton = document.getElementById('validateAddress');
    if (validateButton) {
      validateButton.addEventListener('click', function() {
        validateAndSetAddress();
      });
    }
    
    // Monitor address fields and geocode when complete
    function validateAndSetAddress() {
      const address = document.getElementById('address')?.value?.trim();
      const city = document.getElementById('city')?.value?.trim();
      const state = document.getElementById('state')?.value?.trim();
      const zipCode = document.getElementById('zipCode')?.value?.trim();
      
      console.log('[Service Area Map] Validating address:', { address, city, state, zipCode });
      
      // Validate required fields
      if (!address || !city || !state) {
        alert('Please fill in all required address fields (Address, City, State) before validating.');
        return;
      }
      
      // Map might not be initialized yet if section is hidden - that's OK
      console.log('[Service Area Map] Map initialized?', !!serviceAreaMap);
      
      // Show loading state on button
      const validateButton = document.getElementById('validateAddress');
      const originalText = validateButton.innerHTML;
      validateButton.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Validating...';
      validateButton.disabled = true;
      
      // Always search for the address
      if (true) {
        // Build search queries from most specific to least specific
        const searchQueries = [];
        
        // Full address with zip
        if (address && zipCode) {
          searchQueries.push({
            query: `${address}, ${city}, ${state} ${zipCode}, USA`,
            description: `${address}, ${city}, ${state} ${zipCode}`
          });
        }
        
        // Full address without zip
        if (address) {
          searchQueries.push({
            query: `${address}, ${city}, ${state}, USA`,
            description: `${address}, ${city}, ${state}`
          });
        }
        
        // Just city and state
        searchQueries.push({
          query: `${city}, ${state}, USA`,
          description: `${city}, ${state} (City Center)`
        });
        
        console.log('[Service Area Map] Will try multiple search queries:', searchQueries);
        
        // Try geocoding with fallback
        geocodeWithFallback(searchQueries, 0, originalText);
        
      }
    }
    
    // Function to try multiple geocoding queries with fallback
    function geocodeWithFallback(searchQueries, queryIndex, originalButtonText) {
      if (queryIndex >= searchQueries.length) {
        console.log('[Service Area Map] All geocoding queries failed');
        // Reset button state
        const validateButton = document.getElementById('validateAddress');
        if (validateButton && originalButtonText) {
          validateButton.innerHTML = originalButtonText;
          validateButton.disabled = false;
        }
        alert('Unable to find the address. Please check your address and try again.');
        return;
      }
      
      const currentQuery = searchQueries[queryIndex];
      console.log(`[Service Area Map] Trying geocoding query ${queryIndex + 1}/${searchQueries.length}:`, currentQuery.query);
      
      // Get radius slider value
      const radiusSlider = document.getElementById('radiusSlider');
      const radiusValue = radiusSlider ? parseInt(radiusSlider.value) : 5;
      
      if (window.parent !== window) {
        // Use bridge method when in iframe
        const requestId = 'form_address_' + Date.now() + '_' + queryIndex;
        
        // Request from parent
        window.parent.postMessage({
          type: 'geocode-forward',
          data: {
            query: currentQuery.query,
            requestId: requestId
          }
        }, '*');
        
        // Set up one-time handler for this specific request
        const handleResponse = function(event) {
          if (event.data && event.data.type === 'geocode-forward-response' && 
              event.data.data && event.data.data.requestId === requestId) {
            console.log('[Service Area Map] Received geocoding response:', event.data.data);
            
            if (event.data.data.results && event.data.data.results.length > 0) {
              // Always show address confirmation modal
              showAddressConfirmationModal(event.data.data.results, radiusValue, originalButtonText);
            } else {
              // No results, try next query
              console.log('[Service Area Map] No results for query, trying next...');
              geocodeWithFallback(searchQueries, queryIndex + 1, originalButtonText);
            }
            
            // Remove this handler
            window.removeEventListener('message', handleResponse);
          }
        };
        
        window.addEventListener('message', handleResponse);
      } else {
        // Direct Nominatim call when not in iframe
        const AUSTIN_BOUNDS = {
          minLat: 29.5451,
          maxLat: 30.9889,
          minLon: -98.6687,
          maxLon: -96.8175
        };
        
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(currentQuery.query)}&limit=5&accept-language=en&viewbox=${AUSTIN_BOUNDS.minLon},${AUSTIN_BOUNDS.minLat},${AUSTIN_BOUNDS.maxLon},${AUSTIN_BOUNDS.maxLat}&bounded=0&countrycodes=us`)
          .then(response => response.json())
          .then(results => {
            console.log('[Service Area Map] Nominatim results:', results);
            if (results.length > 0) {
              // Always show address confirmation modal
              showAddressConfirmationModal(results, radiusValue, originalButtonText);
            } else {
              // No results, try next query
              console.log('[Service Area Map] No results for query, trying next...');
              geocodeWithFallback(searchQueries, queryIndex + 1, originalButtonText);
            }
          })
          .catch(error => {
            console.error('Geocoding error:', error);
            // Try next query on error
            geocodeWithFallback(searchQueries, queryIndex + 1, originalButtonText);
          });
      }
    }
    
    // Function to show address confirmation modal
    function showAddressConfirmationModal(results, radiusValue, originalButtonText) {
      console.log('[Service Area Map] Showing address confirmation modal with results:', results);
      
      // Reset button state
      const validateButton = document.getElementById('validateAddress');
      if (validateButton && originalButtonText) {
        validateButton.innerHTML = originalButtonText;
        validateButton.disabled = false;
      }
      
      // Remove any existing modal
      const existingModal = document.getElementById('addressSelectionModal');
      if (existingModal) {
        existingModal.remove();
      }
      
      // Create modal HTML
      const modalTitle = results.length > 1 ? 'Select Your Service Location' : 'Confirm Your Service Location';
      const modalDesc = results.length > 1 
        ? 'We found multiple possible locations. Please select the correct one:' 
        : 'Please confirm this is the correct address for your service area:';
      
      const modalHTML = `
        <div id="addressSelectionModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); z-index: 9999; overflow-y: auto;">
          <div style="display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 1rem;">
            <div class="bg-white rounded-lg w-full" style="max-width: 32rem; max-height: 90vh; overflow: hidden; margin: auto;">
              <div class="p-6">
                <h3 class="text-lg font-semibold mb-4">${modalTitle}</h3>
                <p class="text-sm text-gray-600 mb-4">${modalDesc}</p>
                <div class="space-y-2 overflow-y-auto" style="max-height: 50vh;">
                  ${results.map((result, index) => {
                    // Get the form address to compare
                    const formAddress = document.getElementById('address')?.value?.trim() || '';
                    const formCity = document.getElementById('city')?.value?.trim() || '';
                    const formState = document.getElementById('state')?.value?.trim() || '';
                    const formZip = document.getElementById('zipCode')?.value?.trim() || '';
                    
                    // Parse the display name
                    const parts = result.display_name.split(',').map(p => p.trim());
                    let displayAddress = '';
                    
                    // Try to extract the street address from the result
                    if (parts.length > 0) {
                      // If the first part looks like a street address (starts with number)
                      if (/^\d+/.test(parts[0])) {
                        displayAddress = parts[0];
                      } else if (formAddress) {
                        // Use the form address if we don't have a street address in results
                        displayAddress = formAddress;
                      } else {
                        // Fall back to first part of result
                        displayAddress = parts[0];
                      }
                    }
                    
                    // Build full address display
                    let fullDisplay = displayAddress;
                    if (formCity || (parts.length > 1 && parts[1])) {
                      fullDisplay += ', ' + (formCity || parts[1]);
                    }
                    if (formState || (parts.length > 2 && parts[2])) {
                      fullDisplay += ', ' + (formState || parts[2]);
                    }
                    if (formZip) {
                      fullDisplay += ' ' + formZip;
                    }
                    
                    return `
                      <button class="address-option w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md" 
                              data-lat="${result.lat}" 
                              data-lon="${result.lon}"
                              data-index="${index}">
                        <div class="font-semibold text-gray-800 text-base">${fullDisplay}</div>
                        <div class="text-xs text-gray-500 mt-2">${result.display_name}</div>
                      </button>
                    `;
                  }).join('')}
                </div>
                <div class="mt-4 flex justify-end space-x-2">
                  <button id="cancelAddressSelection" class="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">Cancel</button>
                  ${results.length === 1 ? `<button class="confirm-single-address px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" data-lat="${results[0].lat}" data-lon="${results[0].lon}">Confirm</button>` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add modal to page
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // Ensure modal is visible by scrolling to top
      const modal = document.getElementById('addressSelectionModal');
      if (modal) {
        modal.scrollTop = 0;
        // Also try to scroll the window to top if in iframe
        try {
          window.scrollTo(0, 0);
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'scroll-to-top' }, '*');
          }
        } catch (e) {
          // Ignore cross-origin errors
        }
      }
      
      // Add event listeners
      const selectAddress = function(lat, lon) {
        console.log('[Service Area Map] Address confirmed:', lat, lon);
        
        // Update map center and marker (map might be initialized later)
        if (window.updateServiceArea) {
          window.updateServiceArea(lat, lon, radiusValue);
        }
        if (serviceAreaMap) {
          serviceAreaMap.setView([lat, lon], 14);
        } else {
          // Store coordinates for when map initializes
          window.pendingMapCenter = { lat, lon, radius: radiusValue };
          console.log('[Service Area Map] Stored pending map center for later initialization');
        }
        
        // Mark address as validated
        window.addressValidated = true;
        
        // Hide business info section and show remaining form sections
        const businessInfoSection = document.querySelector('#businessInfoSection');
        if (businessInfoSection) {
          businessInfoSection.style.display = 'none';
        }
        
        // Show all hidden sections
        const hiddenSections = document.querySelectorAll('.form-section-hidden');
        hiddenSections.forEach(section => {
          section.classList.remove('form-section-hidden');
          section.style.display = '';
        });
        
        // If OAuth user, hide account setup section again
        if (window.isOAuthUser) {
          const accountSetup = document.getElementById('accountSetupSection');
          if (accountSetup) {
            accountSetup.style.display = 'none';
          }
        }
        
        // Force a reflow to ensure DOM has updated
        const serviceAreaSection = document.getElementById('serviceAreaSection');
        if (serviceAreaSection) {
          // Force reflow by accessing offsetHeight
          serviceAreaSection.offsetHeight;
        }
        
        // Now trigger map initialization
        console.log('[Service Area Map] DOM updated, triggering map initialization');
        window.dispatchEvent(new Event('dom-sections-ready'));
        window.dispatchEvent(new Event('init-service-area-map'));
        
        // Scroll to service area section
        setTimeout(() => {
          const serviceAreaSection = document.querySelector('#serviceAreaMap').closest('.md\\:col-span-2');
          if (serviceAreaSection) {
            serviceAreaSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
        
        // Remove modal
        document.getElementById('addressSelectionModal').remove();
      };
      
      // Add click handlers for address options
      document.querySelectorAll('.address-option').forEach(button => {
        button.addEventListener('click', function() {
          const lat = parseFloat(this.dataset.lat);
          const lon = parseFloat(this.dataset.lon);
          selectAddress(lat, lon);
        });
      });
      
      // Add handler for single address confirm button
      const confirmButton = document.querySelector('.confirm-single-address');
      if (confirmButton) {
        confirmButton.addEventListener('click', function() {
          const lat = parseFloat(this.dataset.lat);
          const lon = parseFloat(this.dataset.lon);
          selectAddress(lat, lon);
        });
      }
      
      // Cancel button
      document.getElementById('cancelAddressSelection').addEventListener('click', function() {
        document.getElementById('addressSelectionModal').remove();
      });
      
      // Close on backdrop click
      document.getElementById('addressSelectionModal').addEventListener('click', function(e) {
        if (e.target === this) {
          this.remove();
        }
      });
    }
    
    // Make validation function globally accessible
    window.validateAndSetAddress = validateAndSetAddress;
  }
  
  // Set up address validation immediately - don't wait for map
  setupAddressValidation();
}

// Initialize immediately when script loads
initializeAffiliateRegistration();

})(); // End IIFE