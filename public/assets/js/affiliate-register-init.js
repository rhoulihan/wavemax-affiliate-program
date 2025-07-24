// Initialization function for affiliate registration when dynamically loaded
(function() {
  'use strict';

  console.log('[affiliate-register-init] Script loading at:', new Date().toISOString());
  console.log('[affiliate-register-init] SwirlSpinner available?', !!window.SwirlSpinner);
  console.log('[affiliate-register-init] Document readyState:', document.readyState);

  // Global spinner reference to ensure it can be hidden
  let globalSectionSpinner = null;
  
  // Helper function to get translated spinner messages
  function getSpinnerMessage(key, params = {}) {
    // Default messages
    const defaults = {
      'spinner.connectingWith': 'Connecting with {{provider}}...',
      'spinner.validatingAddress': 'Validating your address...',
      'spinner.processingRegistration': 'Processing your registration...',
      'messages.registrationSuccess': 'Registration successful!',
      'messages.redirecting': 'Redirecting...'
    };

    // Try to get translation
    if (window.i18n && window.i18n.t && window.i18n.currentLanguage) {
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

  // Note: Registration endpoints currently don't require CSRF tokens
  // But we'll prepare for future implementation
  const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

  function initializeAffiliateRegistration() {
    console.log('[Init] Starting affiliate registration initialization');
    console.log('[Init] Document readyState:', document.readyState);
    console.log('[Init] Google button exists?', !!document.getElementById('googleRegister'));

    // Initialize form validation first
    if (window.FormValidation) {
      console.log('[Init] Initializing form validation...');
      window.FormValidation.initialize();
    } else {
      console.warn('[Init] FormValidation not available');
    }

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
      <div id="existingAffiliateModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 existing-affiliate-modal-overlay">
        <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl existing-affiliate-modal-content">
          <div class="text-center mb-6">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Account Already Exists</h3>
            <p class="text-sm text-gray-500 mb-4">
              Welcome back, <strong>${affiliateName}</strong>! An affiliate account already exists with the email <strong>${affiliate.email}</strong> (ID: <strong>${affiliate.affiliateId}</strong>).
            </p>
            <p class="text-xs text-gray-400 mt-2">
              To prevent duplicate accounts, each email address can only be associated with one affiliate account.
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

        // Store the token and affiliate data before redirecting
        if (result.token) {
          localStorage.setItem('affiliateToken', result.token);
          console.log('Stored affiliate token');
        }
        
        if (result.affiliate) {
          localStorage.setItem('currentAffiliate', JSON.stringify(result.affiliate));
          console.log('Stored affiliate data:', result.affiliate);
        }

        // Get affiliate ID from result
        const affiliateId = result.affiliate.affiliateId;
        console.log('Redirecting to affiliate dashboard, affiliateId:', affiliateId);

        // Always use direct window.location.href redirect like other successful logins
        window.location.href = `/embed-app-v2.html?route=/affiliate-dashboard&id=${affiliateId}`;

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
    const paypalInfoContainer = document.getElementById('paypalInfoContainer');
    const venmoInfoContainer = document.getElementById('venmoInfoContainer');
    const paypalEmailInput = document.getElementById('paypalEmail');
    const venmoHandleInput = document.getElementById('venmoHandle');

    if (paymentMethodSelect) {
      paymentMethodSelect.addEventListener('change', function() {
      // Reset required fields
        paypalEmailInput.required = false;
        venmoHandleInput.required = false;

        // Hide all containers first
        paypalInfoContainer.classList.add('hidden');
        venmoInfoContainer.classList.add('hidden');

        // Show relevant container based on selection
        if (this.value === 'paypal') {
          paypalInfoContainer.classList.remove('hidden');
          paypalEmailInput.required = true;
        } else if (this.value === 'venmo') {
          venmoInfoContainer.classList.remove('hidden');
          venmoHandleInput.required = true;
        }
        // Check payment method doesn't require additional fields
      });
    }

    // Social registration button handlers
    const googleRegister = document.getElementById('googleRegister');
    const facebookRegister = document.getElementById('facebookRegister');

    // Shared validation function for both OAuth and form submission
    function validateFormFields(isSocialRegistration = false) {
      const requiredFields = [];
      let hasValidationErrors = false;

      // First, run field-specific validation if FormValidation is available
      if (window.FormValidation) {
        console.log('[Form Validation] Running comprehensive field validation...');
        const formValid = window.FormValidation.validateForm();
        if (!formValid) {
          hasValidationErrors = true;
          console.log('[Form Validation] Field validation failed');
        }
      }

      // Personal information always required (OAuth pre-fills these but they can be missing for validation during OAuth button click)
      requiredFields.push(
        { id: 'firstName', name: 'First Name' },
        { id: 'lastName', name: 'Last Name' },
        { id: 'email', name: 'Email' }
      );

      // Check if address has been validated (business info section is hidden)
      const businessInfoSection = document.querySelector('#businessInfoSection');
      const addressValidated = window.addressValidated || (businessInfoSection && businessInfoSection.style.display === 'none');

      // Common required fields for both registration types
      requiredFields.push(
        { id: 'phone', name: 'Phone Number' }
      );

      // Only validate address fields if they haven't been validated yet
      if (!addressValidated) {
        requiredFields.push(
          { id: 'address', name: 'Address' },
          { id: 'city', name: 'City' },
          { id: 'state', name: 'State' },
          { id: 'zipCode', name: 'ZIP Code' }
        );
      }

      // These fields are always required
      requiredFields.push(
        { id: 'minimumDeliveryFee', name: 'Minimum Delivery Fee' },
        { id: 'perBagDeliveryFee', name: 'Per-Bag Delivery Fee' },
        { id: 'paymentMethod', name: 'Payment Method' }
      );
      // Note: Service area fields are checked separately below with component-generated IDs

      // Only require username and password for traditional registration (NOT OAuth)
      // Check if this is OAuth by looking for socialToken or window.isOAuthUser
      const formData = new FormData(document.getElementById('affiliateRegistrationForm'));
      const hasSocialToken = formData.get('socialToken') || window.isOAuthUser;

      if (!isSocialRegistration && !hasSocialToken) {
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

      // Check service area separately (stored in hidden fields with component-generated IDs)
      const serviceLatitude = document.getElementById('registrationServiceAreaComponent-latitude');
      const serviceLongitude = document.getElementById('registrationServiceAreaComponent-longitude');
      if (!serviceLatitude?.value || !serviceLongitude?.value) {
        missingFields.push('Service Area (Please click on the map to set your service location)');
      }

      // Check payment method specific fields
      const paymentMethod = document.getElementById('paymentMethod')?.value;
      if (paymentMethod === 'paypal') {
        const paypalEmail = document.getElementById('paypalEmail');
        if (!paypalEmail?.value.trim()) missingFields.push('PayPal Email');
      } else if (paymentMethod === 'venmo') {
        const venmoHandle = document.getElementById('venmoHandle');
        if (!venmoHandle?.value.trim()) missingFields.push('Venmo Handle');
      }

      // If we have field validation errors, add them to missing fields
      if (hasValidationErrors) {
        if (missingFields.length === 0) {
          missingFields.push('Please correct the highlighted field errors above');
        }
      }

      return missingFields;
    }

    // Track if OAuth is in progress to prevent multiple simultaneous attempts
    let oauthInProgress = false;
    
    function handleSocialAuth(provider) {
    // No validation required before OAuth - the point is to authenticate first and auto-populate the form
      console.log(`🚀 Starting ${provider} OAuth authentication...`);
      
      // Prevent multiple OAuth processes
      if (oauthInProgress) {
        console.log('[OAuth] OAuth already in progress, ignoring duplicate request');
        return;
      }
      oauthInProgress = true;

      // Show large spinner centered on the entire form
      const formContainer = document.getElementById('affiliateRegistrationForm');
      console.log('[OAuth] SwirlSpinner available?', !!window.SwirlSpinner);
      console.log('[OAuth] SwirlSpinnerUtils available?', !!window.SwirlSpinnerUtils);
      console.log('[OAuth] Form container found?', !!formContainer);

      // Define spinner in outer scope so it's accessible in the polling function
      let sectionSpinner = null;
      let originalFormPosition = null;

      // Create function to hide spinner
      const hideSpinner = function() {
        console.log('[OAuth] hideSpinner called, checking spinners...');
        if (sectionSpinner) {
          console.log('[OAuth] Hiding local spinner');
          sectionSpinner.hide();
          sectionSpinner = null;
        }
        if (globalSectionSpinner) {
          console.log('[OAuth] Hiding global spinner');
          globalSectionSpinner.hide();
          globalSectionSpinner = null;
        }
        
        // Fallback: manually remove any spinner overlays from DOM
        const overlays = document.querySelectorAll('.swirl-spinner-overlay');
        console.log('[OAuth] Found', overlays.length, 'spinner overlays in DOM');
        overlays.forEach(overlay => {
          console.log('[OAuth] Manually removing spinner overlay');
          overlay.remove();
        });
        
        // Restore original form position if it was changed
        if (formContainer && originalFormPosition !== null) {
          formContainer.style.position = originalFormPosition;
        }
      };

      if (formContainer) {
        const rect = formContainer.getBoundingClientRect();
        console.log('[OAuth] Form dimensions:', { width: rect.width, height: rect.height });
        console.log('[OAuth] Form position style:', window.getComputedStyle(formContainer).position);

        // Ensure the form container has relative positioning for the overlay to work properly
        originalFormPosition = formContainer.style.position || '';
        if (!originalFormPosition || originalFormPosition === 'static') {
          formContainer.style.position = 'relative';
        }

        // Use SwirlSpinner
        if (window.SwirlSpinner) {
          try {
            console.log('[OAuth] Creating SwirlSpinner with overlay on entire form...');
            // Get translated message
            const connectingMessage = getSpinnerMessage('spinner.connectingWith', {
              provider: provider.charAt(0).toUpperCase() + provider.slice(1)
            });
            console.log('[OAuth] Using message:', connectingMessage);

            sectionSpinner = new window.SwirlSpinner({
              container: formContainer,
              size: 'large',
              overlay: true,
              message: connectingMessage
            }).show();
            globalSectionSpinner = sectionSpinner; // Store global reference
            console.log('[OAuth] SwirlSpinner created successfully and stored globally');
            console.log('[OAuth] Spinner instance:', sectionSpinner);
            console.log('[OAuth] Spinner isVisible:', sectionSpinner && sectionSpinner.isVisible ? sectionSpinner.isVisible() : 'N/A');

            // Check if spinner element was actually added - look in both form and document
            const spinnerElements = document.querySelectorAll('.swirl-spinner-overlay');
            console.log('[OAuth] Spinner overlay elements found in document:', spinnerElements.length);
            spinnerElements.forEach((el, index) => {
              const computed = window.getComputedStyle(el);
              console.log(`[OAuth] Spinner ${index} styles:`, {
                display: computed.display,
                visibility: computed.visibility,
                zIndex: computed.zIndex,
                position: computed.position
              });
            });
          } catch (error) {
            console.error('[OAuth] Error creating SwirlSpinner:', error);
          }
        } else {
          console.error('[OAuth] SwirlSpinner not available! This should not happen.');
        }
      }

      // For embedded context or iframe, always use popup window to avoid iframe restrictions
      // Check if we're in iframe or if embed config says we're embedded
      const inIframe = window.self !== window.top;
      const shouldUsePopup = isEmbedded || inIframe || window.location.pathname.includes('embed');
      
      console.log('[OAuth] Context check:', {
        isEmbedded,
        inIframe,
        pathname: window.location.pathname,
        shouldUsePopup
      });
      
      if (shouldUsePopup) {
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
          // Hide spinner
          hideSpinner();
          oauthInProgress = false;
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
                console.log('[OAuth] Polling interval cleared');

                if (popup && !popup.closed) {
                  console.log('[OAuth] Attempting to close popup window');
                  console.log('[OAuth] Popup state:', {
                    closed: popup.closed,
                    location: typeof popup.location,
                    document: typeof popup.document
                  });
                  try {
                    // Focus on the main window first
                    window.focus();
                    
                    // Try to close the popup
                    popup.close();
                    console.log('[OAuth] Popup close command executed');
                    
                    // Check if it actually closed after a short delay
                    setTimeout(() => {
                      if (popup && !popup.closed) {
                        console.warn('[OAuth] Popup did not close, it may have been closed by the user or browser restrictions apply');
                      } else {
                        console.log('[OAuth] Popup successfully closed');
                      }
                    }, 500);
                  } catch (e) {
                    console.error('[OAuth] Error closing popup:', e);
                  }
                } else {
                  console.log('[OAuth] Popup already closed or null');
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
                    // Hide spinner
                    console.log('[OAuth] About to hide spinner, sectionSpinner exists?', !!sectionSpinner);
                    console.log('[OAuth] globalSectionSpinner exists?', !!globalSectionSpinner);
                    console.log('[OAuth] Spinner elements in DOM:', document.querySelectorAll('.swirl-spinner-overlay').length);
                    hideSpinner();
                    oauthInProgress = false;
                    // Double-check spinner was hidden
                    setTimeout(() => {
                      console.log('[OAuth] After hideSpinner - Spinner elements in DOM:', document.querySelectorAll('.swirl-spinner-overlay').length);
                    }, 100);
                  } else if (data.result.type === 'social-auth-login') {
                    console.log('Processing social-auth-login from database');
                    console.log('User attempted to register but account already exists:', data.result.affiliate);
                    // Show modal dialog asking user what they want to do
                    showExistingAffiliateModal(data.result);
                    // Hide spinner
                    hideSpinner();
                    oauthInProgress = false;
                  } else if (data.result.type === 'social-auth-error') {
                    console.log('Processing social-auth-error from database');
                    window.ErrorHandler.showError(data.result.message || 'Social authentication failed');
                    // Hide spinner
                    hideSpinner();
                    oauthInProgress = false;
                  } else {
                    console.log('Unknown result type:', data.result.type);
                    // Hide spinner
                    hideSpinner();
                    oauthInProgress = false;
                  }
                } catch (resultError) {
                  console.error('Error processing OAuth result:', resultError);
                  window.ErrorHandler.showError('Error processing authentication result');
                  // Hide spinner
                  hideSpinner();
                  oauthInProgress = false;
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
              // Hide spinner
              hideSpinner();
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

    // Attach OAuth handlers immediately - spinner will use fallback if needed
    console.log('[Init] Attaching OAuth handlers (will use fallback spinner if needed)');
    console.log('[Init] Google button element:', googleRegister);

    if (googleRegister) {
      // Check if handler already attached to prevent duplicates
      if (!googleRegister.dataset.initialized) {
        console.log('[Init] Adding click handler to Google button');
        googleRegister.addEventListener('click', function() {
          console.log('[OAuth] Google button clicked!');
          handleSocialAuth('google');
        });
        googleRegister.dataset.initialized = 'true';
      } else {
        console.log('[Init] Google button already has handler, skipping');
      }
    } else {
      console.error('[Init] Google register button not found!')
    }

    if (facebookRegister) {
      if (!facebookRegister.dataset.initialized) {
        facebookRegister.addEventListener('click', function() {
          handleSocialAuth('facebook');
        });
        facebookRegister.dataset.initialized = 'true';
      }
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
        if (window.i18n && window.i18n.updateContent) {
          window.i18n.updateContent();
        }
      }

      // Hide account setup section immediately for OAuth users
      const accountSetupSection = document.getElementById('accountSetupSection');
      if (accountSetupSection) {
        accountSetupSection.classList.add('hidden');
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
      // Check if social token input already exists
        let socialTokenInput = document.getElementById('socialToken');
        if (!socialTokenInput) {
          socialTokenInput = document.createElement('input');
          socialTokenInput.type = 'hidden';
          socialTokenInput.name = 'socialToken';
          socialTokenInput.id = 'socialToken';
          socialTokenInput.value = socialToken;
          form.appendChild(socialTokenInput);
          console.log('✅ Added social token to form');
        } else {
        // Update existing token
          socialTokenInput.value = socialToken;
          console.log('✅ Updated existing social token in form');
        }
      }

      // Auto-populate form fields from social token (decode JWT payload)
      try {
        // Validate social token format
        if (!socialToken || typeof socialToken !== 'string') {
          console.error('❌ Invalid social token:', socialToken);
          return;
        }
        
        const parts = socialToken.split('.');
        if (parts.length !== 3) {
          console.error('❌ Invalid JWT format. Expected 3 parts, got:', parts.length);
          console.log('Token:', socialToken);
          return;
        }
        
        // Try to decode the payload
        let payload;
        try {
          // Ensure proper padding for base64 decode
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
          payload = JSON.parse(atob(padded));
        } catch (decodeError) {
          console.error('❌ Failed to decode token payload:', decodeError);
          console.log('Token part:', parts[1]);
          throw decodeError;
        }
        
        console.log('🔓 Decoded social token payload:', payload);
        console.log('🔍 Available form fields:', {
          firstName: !!document.getElementById('firstName'),
          lastName: !!document.getElementById('lastName'),
          email: !!document.getElementById('email')
        });

        // Auto-fill personal information
        if (payload.firstName || payload.displayName) {
          const firstNameField = document.getElementById('firstName');
          console.log('🔍 First name field:', firstNameField);
          if (firstNameField) {
            // Use firstName if available, otherwise try to extract from displayName
            let firstName = payload.firstName;
            if (!firstName && payload.displayName) {
              firstName = payload.displayName.split(' ')[0];
            }
            
            if (firstName && !firstNameField.value) {
              firstNameField.value = firstName;
              firstNameField.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
              console.log('✅ Pre-filled firstName:', firstName);
            }
          }
        }

        if (payload.lastName || payload.displayName) {
          const lastNameField = document.getElementById('lastName');
          console.log('🔍 Last name field:', lastNameField);
          if (lastNameField) {
            // Use lastName if available, otherwise try to extract from displayName
            let lastName = payload.lastName;
            if (!lastName && payload.displayName) {
              const nameParts = payload.displayName.split(' ');
              if (nameParts.length > 1) {
                lastName = nameParts.slice(1).join(' ');
              }
            }
            
            if (lastName && !lastNameField.value) {
              lastNameField.value = lastName;
              lastNameField.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
              console.log('✅ Pre-filled lastName:', lastName);
            }
          }
        }

        if (payload.email) {
          const emailField = document.getElementById('email');
          console.log('🔍 Email field:', emailField);
          if (emailField && !emailField.value) {
            emailField.value = payload.email;
            emailField.readOnly = true; // Make it read-only since it comes from OAuth
            emailField.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
            console.log('✅ Pre-filled email:', payload.email);
          }
        } else {
          console.warn('⚠️ No email in social token payload');
        }

        // Log any fields that couldn't be populated
        console.log('📊 Form population summary:', {
          firstNamePopulated: !!document.getElementById('firstName')?.value,
          lastNamePopulated: !!document.getElementById('lastName')?.value,
          emailPopulated: !!document.getElementById('email')?.value
        });

      } catch (e) {
        console.error('❌ Error decoding social token for pre-filling:', e);
        console.log('🔍 Social token:', socialToken);
      }

      // Ensure form submit handler is attached after OAuth
      console.log('✅ Attaching form submit handler after OAuth completion');
      attachFormSubmitHandler();
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

    // Function to attach form submit handler
    function attachFormSubmitHandler() {
      const form = document.getElementById('affiliateRegistrationForm');
      console.log('[Form Init] Looking for form...');
      console.log('[Form Init] Form found:', !!form);

      if (!form) {
        console.log('[Form Init] Form not found, cannot attach handler');
        return;
      }

      // Check if handler already attached
      if (form.dataset.handlerAttached === 'true') {
        console.log('[Form Init] Submit handler already attached, checking if it works...');
        // For debugging: let's force re-attach if coming from OAuth
        if (!window.location.search.includes('socialToken')) {
          return;
        }
        console.log('[Form Init] OAuth flow detected, re-attaching handler anyway');
      }

      console.log('[Form Init] Attaching submit handler to form');

      // Check if there are any existing submit handlers
      const existingHandlers = form.onsubmit;
      console.log('[Form Init] Existing onsubmit handler:', existingHandlers);

      // Flag to prevent duplicate submissions
      let isSubmitting = false;
      
      form.addEventListener('submit', async function(e) {
        console.log('[Form Submit] Form submission triggered');
        e.preventDefault();
        e.stopPropagation();
        
        // Prevent duplicate submissions
        if (isSubmitting) {
          console.warn('[Form Submit] Already submitting, ignoring duplicate submission');
          return;
        }
        isSubmitting = true;

        // Show spinner on entire page container
        const processingMessage = getSpinnerMessage('spinner.processingRegistration');
        
        // Get the main embed container to cover everything
        const embedContainer = document.querySelector('.embed-container');
        const spinnerContainer = embedContainer || form.closest('.bg-white') || form;

        const formSpinner = window.SwirlSpinner ? 
          new window.SwirlSpinner({
            container: spinnerContainer,
            size: 'large',
            overlay: true,
            message: processingMessage,
            overlayStyle: {
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              zIndex: '9999'
            }
          }).show() : null;

        try {
        // Determine if this is a social registration first
          const formData = new FormData(form);
          const isSocialRegistration = formData.get('socialToken') || window.isOAuthUser;

          // Validate required fields
          const missingFields = validateFormFields(isSocialRegistration);
          console.log('[Form Submit] Missing fields:', missingFields);
          console.log('[Form Submit] Is OAuth user?', window.isOAuthUser);
          console.log('[Form Submit] Has social token?', !!formData.get('socialToken'));
          console.log('[Form Submit] Address validated?', window.addressValidated);
          console.log('[Form Submit] Business info section display:', document.querySelector('#businessInfoSection')?.style.display);

          if (missingFields.length > 0) {
            window.ErrorHandler.showError(
              `Please fill in the following required fields: ${missingFields.join(', ')}`
            );
            // Hide spinner on validation error
            if (formSpinner) formSpinner.hide();
            isSubmitting = false; // Reset flag
            return;
          }

          // Additional validation for payment method
          const paymentMethodValue = document.getElementById('paymentMethod')?.value;
          console.log('[Form Submit] Payment method value:', paymentMethodValue);
          if (!paymentMethodValue || paymentMethodValue === '') {
            window.ErrorHandler.showError('Please select a payment method');
            // Hide spinner
            if (formSpinner) formSpinner.hide();
            isSubmitting = false; // Reset flag
            return;
          }

          // Check if passwords match (only for traditional registration)
          if (!isSocialRegistration) {
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
              window.ErrorHandler.showError('Passwords do not match!');
              // Hide spinner
              if (formSpinner) formSpinner.hide();
              isSubmitting = false; // Reset flag
              return;
            }
          }

          // Collect form data (reuse the formData from above)
          const affiliateData = {};

          formData.forEach((value, key) => {
            affiliateData[key] = value;
          });

          // Manually collect all form fields to ensure nothing is missed
          // This is necessary because hidden sections may not be included in FormData
          const formFields = [
            'firstName', 'lastName', 'email', 'phone', 'businessName',
            'address', 'city', 'state', 'zipCode',
            'minimumDeliveryFee', 'perBagDeliveryFee',
            'paymentMethod', 'accountNumber', 'routingNumber', 'paypalEmail',
            'languagePreference', 'termsAgreement', 'socialToken'
          ];

          formFields.forEach(fieldName => {
            let element = document.getElementById(fieldName);

            // Special handling for socialToken which might not have an ID
            if (!element && fieldName === 'socialToken') {
              element = form.querySelector('input[name="socialToken"]');
            }

            if (element) {
            // Always include the value, even if empty, so the server knows the field exists
              affiliateData[fieldName] = element.value || '';
            }
          });

          // Handle service area fields with component-generated IDs
          const serviceLatField = document.getElementById('registrationServiceAreaComponent-latitude');
          const serviceLngField = document.getElementById('registrationServiceAreaComponent-longitude');
          const serviceRadiusField = document.getElementById('registrationServiceAreaComponent-radius');

          if (serviceLatField) affiliateData['serviceLatitude'] = serviceLatField.value || '';
          if (serviceLngField) affiliateData['serviceLongitude'] = serviceLngField.value || '';
          if (serviceRadiusField) affiliateData['serviceRadius'] = serviceRadiusField.value || '';

          // If address fields are empty but we have validated address, use those values
          if (window.validatedAddress && window.addressValidated) {
            if (!affiliateData.address && window.validatedAddress.address) {
              affiliateData.address = window.validatedAddress.address;
            }
            if (!affiliateData.city && window.validatedAddress.city) {
              affiliateData.city = window.validatedAddress.city;
            }
            if (!affiliateData.state && window.validatedAddress.state) {
              affiliateData.state = window.validatedAddress.state;
            }
            if (!affiliateData.zipCode && window.validatedAddress.zipCode) {
              affiliateData.zipCode = window.validatedAddress.zipCode;
            }
          }

          // Ensure checkbox values are properly captured
          const termsCheckbox = document.getElementById('termsAgreement');
          if (termsCheckbox) {
            affiliateData.termsAgreement = termsCheckbox.checked;
          }

          // Manually add payment fields if they're missing
          if (!affiliateData.paymentMethod) {
            const paymentMethodEl = document.getElementById('paymentMethod');
            if (paymentMethodEl) {
              affiliateData.paymentMethod = paymentMethodEl.value;
            }
          }

          if (!affiliateData.paypalEmail && affiliateData.paymentMethod === 'paypal') {
            const paypalEmailEl = document.getElementById('paypalEmail');
            if (paypalEmailEl) {
              affiliateData.paypalEmail = paypalEmailEl.value;
            }
          }

          if (affiliateData.paymentMethod === 'paypal') {
            if (!affiliateData.paypalEmail) {
              const paypalEmailEl = document.getElementById('paypalEmail');
              if (paypalEmailEl) {
                affiliateData.paypalEmail = paypalEmailEl.value;
              }
            }
          } else if (affiliateData.paymentMethod === 'venmo') {
            if (!affiliateData.venmoHandle) {
              const venmoHandleEl = document.getElementById('venmoHandle');
              if (venmoHandleEl) {
                affiliateData.venmoHandle = venmoHandleEl.value;
              }
            }
          }

          // Debug logging to verify all fields are present
          console.log('Form submission data:', affiliateData);
          console.log('Has address fields:', {
            address: affiliateData.address,
            city: affiliateData.city,
            state: affiliateData.state,
            zipCode: affiliateData.zipCode
          });
          console.log('Payment info:', {
            paymentMethod: affiliateData.paymentMethod,
            paypalEmail: affiliateData.paypalEmail,
            accountNumber: affiliateData.accountNumber,
            routingNumber: affiliateData.routingNumber
          });
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
          
          // Check if we have a successful response with affiliateId
          if (!data.affiliateId && !data.affiliate?.affiliateId) {
            console.error('No affiliateId in response:', data);
            throw new Error('Registration completed but no affiliate ID received');
          }
          
          const affiliateId = data.affiliateId || data.affiliate?.affiliateId;

          // Store the token if provided (for auto-login after registration)
          if (data.token) {
            localStorage.setItem('affiliateToken', data.token);
            console.log('Stored affiliate token for new registration');
          }
          
          // Store the affiliate data for the success page
          localStorage.setItem('currentAffiliate', JSON.stringify({
            ...affiliateData,
            affiliateId: affiliateId
          }));

          // Keep the spinner visible during redirect
          // Don't hide the formSpinner here - let it stay visible
          console.log('Registration successful, redirecting to success page...');

          // Update spinner message to indicate success
          if (formSpinner && formSpinner.updateMessage) {
            const successPart = getSpinnerMessage('common.messages.registrationSuccess');
            const redirectingPart = getSpinnerMessage('common.messages.redirecting');
            const successMessage = successPart + ' ' + redirectingPart;
            formSpinner.updateMessage(successMessage);
          }

          // Handle redirect immediately
          console.log('=== NAVIGATION DEBUG ===');
          console.log('window.location:', window.location.href);
          console.log('Attempting navigation to affiliate success page');
          
          // Navigate to success page
          // Since we're in a nested iframe (wavemaxlaundry.com > embed-app-v2.html > affiliate-register)
          // We need to navigate within our own frame context
          console.log('Current URL:', window.location.href);
          
          // Check if we're in embed-app-v2.html iframe
          if (window.location.href.includes('embed-app-v2.html')) {
            // We're already in embed-app-v2.html, just change the route parameter
            const url = new URL(window.location.href);
            url.searchParams.set('route', '/affiliate-success');
            console.log('Navigating to:', url.href);
            window.location.href = url.href;
          } else if (window.parent !== window) {
            // We're in an iframe but not embed-app-v2.html
            // Use postMessage to communicate with parent safely
            console.log('Using postMessage for cross-origin navigation');
            try {
              // First try to check if navigateTo exists without accessing it
              // This will throw if cross-origin
              const hasNavigateTo = window.parent.navigateTo !== undefined;
              if (hasNavigateTo && typeof window.parent.navigateTo === 'function') {
                console.log('Using parent navigateTo function');
                window.parent.navigateTo('/affiliate-success');
              } else {
                throw new Error('navigateTo not available');
              }
            } catch (e) {
              // Cross-origin or navigateTo not available, use postMessage
              console.log('Cross-origin detected or navigateTo not available, using postMessage');
              window.parent.postMessage({
                type: 'navigate',
                route: '/affiliate-success'
              }, '*');
              
              // Also do a fallback navigation after a short delay
              setTimeout(() => {
                console.log('Fallback navigation to success page');
                window.location.href = '/embed-app-v2.html?route=/affiliate-success';
              }, 500);
            }
          } else {
            // Not in iframe at all
            console.log('Not in iframe, using direct navigation');
            window.location.href = '/embed-app-v2.html?route=/affiliate-success';
          }
        } catch (error) {
          console.error('Registration error:', error);
          isSubmitting = false; // Reset flag on error
          
          // Show user-friendly error message
          let errorMessage = 'An error occurred during registration. Please try again.';
          
          if (error.message.includes('fetch')) {
            errorMessage = 'Unable to connect to registration server. Please try again later.';
          } else if (error.message.includes('affiliate ID')) {
            errorMessage = 'Registration processing error. Please contact support.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          // Show error using ErrorHandler
          if (window.ErrorHandler) {
            window.ErrorHandler.showError(errorMessage);
          } else {
            alert(errorMessage);
          }

          // If we're embedded and there's a connection error, notify parent
          const inIframe = window.parent !== window;
          if (inIframe && error.message.includes('fetch')) {
            window.parent.postMessage({
              type: 'registration-error',
              message: errorMessage
            }, '*');
          }

          // Hide spinner
          if (formSpinner) formSpinner.hide();
          isSubmitting = false; // Reset flag after hiding spinner
        }
      });

      // Mark form as having handler attached
      form.dataset.handlerAttached = 'true';
      console.log('[Form Init] Form submit handler attached successfully');
    }

    // Call the function to attach handler
    // Only call this on initial load, not after OAuth (OAuth calls it explicitly)
    if (!window.location.search.includes('socialToken')) {
      attachFormSubmitHandler();
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

      // Track last sent height to prevent micro-adjustments
      let lastSentHeight = 0;
      let heightUpdateTimeout = null;

      // Monitor form height changes with throttling to prevent infinite loops
      resizeObserver = new ResizeObserver(entries => {
      // Check if we're still on the registration page
        if (!window.location.href.includes('affiliate-success')) {
          for (let entry of entries) {
            const newHeight = entry.target.scrollHeight;

            // Only send height updates if the change is significant (more than 10px)
            // and not too frequent (throttled)
            if (Math.abs(newHeight - lastSentHeight) > 10) {

              // Clear any pending height update
              if (heightUpdateTimeout) {
                clearTimeout(heightUpdateTimeout);
              }

              // Throttle height updates to prevent rapid-fire changes
              heightUpdateTimeout = setTimeout(() => {
                console.log('Sending height to parent:', newHeight);
                lastSentHeight = newHeight;
                window.parent.postMessage({
                  type: 'form-height',
                  height: newHeight
                }, '*');
              }, 200); // Wait 200ms before sending
            }
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

      // Prevent Enter key from submitting form in delivery fee fields
      const preventEnterSubmit = function(event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
          event.preventDefault();
          event.stopPropagation();

          // Trigger input event to update pricing preview
          this.dispatchEvent(new Event('input', { bubbles: true }));
          this.dispatchEvent(new Event('change', { bubbles: true }));

          // Optional: Move focus to next input field
          if (this.id === 'minimumDeliveryFee') {
            perBagInput.focus();
          }

          return false;
        }
      };

      // Add keydown event listeners to prevent form submission on Enter
      minFeeInput.addEventListener('keydown', preventEnterSubmit);
      perBagInput.addEventListener('keydown', preventEnterSubmit);

      // Initialize the pricing preview component
      if (window.PricingPreviewComponent) {
        window.registrationPricingPreview = window.PricingPreviewComponent.init(
          'registrationPricingPreview',
          'minimumDeliveryFee',
          'perBagDeliveryFee',
          {
            titleText: 'Live Pricing Preview',
            titleI18n: 'affiliate.register.livePricingPreview',
            showNotes: true
          }
        );
        console.log('Pricing preview component initialized for registration form');
      } else {
        console.warn('PricingPreviewComponent not available, falling back to legacy calculator');
        // Fallback to legacy functionality
        minFeeInput.addEventListener('input', updateFeeCalculator);
        perBagInput.addEventListener('input', updateFeeCalculator);
        updateFeeCalculator();
      }

      // Clean up function to remove event listeners
      const cleanupFeeCalculator = function() {
      // Remove keydown event listeners
        minFeeInput.removeEventListener('keydown', preventEnterSubmit);
        perBagInput.removeEventListener('keydown', preventEnterSubmit);

        // Clean up pricing preview component if it exists
        if (window.registrationPricingPreview && window.registrationPricingPreview.destroy) {
          window.registrationPricingPreview.destroy();
        }

        // Disconnect resize observer
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
      };

      // Clean up before navigation
      window.addEventListener('beforeunload', cleanupFeeCalculator);

      // Also clean up on custom events from parent
      window.addEventListener('page-cleanup', cleanupFeeCalculator);

      window.addEventListener('disconnect-observers', cleanupFeeCalculator);
    }

    // Delivery fee calculator update
    function updateFeeCalculator() {
      const minimumFee = parseFloat(document.getElementById('minimumDeliveryFee')?.value) || 25;
      const perBagFee = parseFloat(document.getElementById('perBagDeliveryFee')?.value) || 10;

      // Constants for commission calculation
      const WDF_RATE = 1.25; // $1.25 per pound
      const LBS_PER_BAG = 30; // 30 lbs per bag average
      const COMMISSION_RATE = 0.10; // 10% commission

      // Update all example calculations
      [1, 3, 5, 10].forEach(bags => {
        const calculatedFee = bags * perBagFee;
        const deliveryFee = Math.max(minimumFee, calculatedFee); // Already round trip

        // Calculate WDF commission
        const wdfRevenue = bags * LBS_PER_BAG * WDF_RATE;
        const commission = wdfRevenue * COMMISSION_RATE;

        // Update delivery fee display
        const feeElement = document.getElementById(`calc${bags}bag${bags > 1 ? 's' : ''}`);
        if (feeElement) {
          feeElement.textContent = `$${deliveryFee}`;
          // Add visual indicator if minimum applies
          if (deliveryFee === minimumFee && calculatedFee < minimumFee) {
            feeElement.title = 'Minimum fee applies';
          } else {
            feeElement.title = `${bags} bags × $${perBagFee}/bag = $${calculatedFee}`;
          }
        }

        // Calculate and update total earnings (delivery + commission)
        const totalEarnings = deliveryFee + commission;
        const totalElement = document.getElementById(`total${bags}bag${bags > 1 ? 's' : ''}`);
        if (totalElement) {
          totalElement.textContent = `$${totalEarnings.toFixed(2)}`;
          totalElement.title = `Delivery: $${deliveryFee} + Commission: $${commission.toFixed(2)} = $${totalEarnings.toFixed(2)}`;
        }

        // Update commission display
        const commElement = document.getElementById(`comm${bags}bag${bags > 1 ? 's' : ''}`);
        if (commElement) {
          commElement.textContent = `$${commission.toFixed(2)}`;
          commElement.title = `${bags} bags × ${LBS_PER_BAG} lbs × $${WDF_RATE}/lb × ${COMMISSION_RATE * 100}% = $${commission.toFixed(2)}`;
        }
      });
    }


    // OLD SERVICE AREA MAP IMPLEMENTATION - REPLACED BY SERVICE AREA COMPONENT
    // Keeping for reference but commenting out to prevent conflicts
    /*
  // Initialize service area map
  let serviceAreaMap = window.affiliateServiceAreaMap || null;
  let serviceMarker = window.affiliateServiceMarker || null;
  let serviceCircle = window.affiliateServiceCircle || null;
  let mapInitialized = window.affiliateMapInitialized || false;

  function initializeServiceAreaMap_OLD() {
    // Prevent duplicate initialization
    if (mapInitialized || serviceAreaMap) {
      console.log('Map already initialized, skipping');
      return;
    }

    // Default to WaveMAX store location: 825 E Rundberg Lane, Austin, TX 78753
    const defaultLat = 30.3524;
    const defaultLng = -97.6841;

    try {
      // Initialize map with a zoom level that will show a typical service area
      // Start with zoom 12 which shows about 10-15 mile radius well
      serviceAreaMap = L.map('serviceAreaMap').setView([defaultLat, defaultLng], 12);
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
    // NOTE: serviceRadius field is now created by component with ID: registrationServiceAreaComponent-radius

    // NOTE: Default values are now set by the service area component
    // Old code that set serviceLatitude/serviceLongitude/serviceRadius directly is no longer needed

    // Function to update service area
    function updateServiceArea(lat, lng, radius) {
      // NOTE: Hidden fields are now managed by the service area component
      // The component creates fields with IDs like:
      // - registrationServiceAreaComponent-latitude
      // - registrationServiceAreaComponent-longitude
      // - registrationServiceAreaComponent-radius

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
      const serviceAreaInfo = document.getElementById('serviceAreaInfo');
      if (serviceAreaInfo) {
        serviceAreaInfo.classList.remove('hidden');
      }

      // Display the address
      const centerLocationElement = document.getElementById('centerLocation');
      if (centerLocationElement) {
        if (window.confirmedServiceAddress) {
          centerLocationElement.textContent = window.confirmedServiceAddress;
        } else {
          centerLocationElement.textContent = 'Loading address...';
        }
      }

      // Always display coordinates
      const centerCoordinatesElement = document.getElementById('centerCoordinates');
      if (centerCoordinatesElement) {
        centerCoordinatesElement.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      // Ensure the entire service area is visible on the map
      // Only zoom out if necessary to show the full circle
      const bounds = serviceCircle.getBounds();
      const currentBounds = serviceAreaMap.getBounds();

      // Check if the circle extends beyond current view
      if (!currentBounds.contains(bounds.getNorthEast()) || !currentBounds.contains(bounds.getSouthWest())) {
        // Fit the map to show the entire circle with some padding
        serviceAreaMap.fitBounds(bounds, { padding: [50, 50] });
      }

      const coverageAreaElement = document.getElementById('coverageArea');
      if (coverageAreaElement) {
        coverageAreaElement.textContent = `${radius} mile radius`;
      }

      // Handle marker drag
      serviceMarker.on('dragend', function(event) {
        const position = event.target.getLatLng();
        updateServiceArea(position.lat, position.lng, parseInt(radiusSlider.value));
        // Reverse geocode to get address
        reverseGeocodeForServiceArea(position.lat, position.lng);
      });
    }

    // Make updateServiceArea globally accessible
    window.updateServiceArea = updateServiceArea;

    // Handle map click
    serviceAreaMap.on('click', function(e) {
      updateServiceArea(e.latlng.lat, e.latlng.lng, parseInt(radiusSlider.value));
      // Reverse geocode to get address
      reverseGeocodeForServiceArea(e.latlng.lat, e.latlng.lng);
    });

    // Reverse geocode for service area - updates the display address
    function reverseGeocodeForServiceArea(lat, lng) {
      const centerLocationElement = document.getElementById('centerLocation');
      if (!centerLocationElement) return;

      // Show loading state
      centerLocationElement.textContent = 'Loading address...';

      if (window.parent !== window) {
        // Use bridge method when in iframe
        const requestId = 'service_area_reverse_' + Date.now();
        console.log('[Service Area Map] Using bridge for reverse geocoding');

        // Request from parent
        window.parent.postMessage({
          type: 'geocode-reverse',
          data: {
            lat: lat,
            lng: lng,
            requestId: requestId
          }
        }, '*');

        // Set up one-time handler for this specific request
        const handleResponse = function(event) {
          if (event.data && event.data.type === 'geocode-reverse-response' &&
              event.data.data && event.data.data.requestId === requestId) {
            console.log('[Service Area Map] Received reverse geocoding response:', event.data.data);

            if (event.data.data.address) {
              // Parse and format the address properly
              const parts = event.data.data.address.split(',').map(p => p.trim());
              let displayAddress = '';

              // Extract components we want
              let street = '';
              let city = '';
              let state = '';
              let zipcode = '';

              // Nominatim format often includes: house_number, street, neighborhood, city, county, state, zip, country
              // We want: street (no comma after number), city, state zipcode

              if (parts.length >= 2) {
                // First part might be house number, second is street, or first is full street
                if (parts[0].match(/^\d+$/)) {
                  // First part is just a number, combine with street
                  street = parts[0] + ' ' + parts[1];
                  let startIdx = 2;

                  // Skip neighborhood/suburb names by looking for the city
                  // Cities usually come after neighborhoods but before county
                  for (let i = startIdx; i < parts.length; i++) {
                    const part = parts[i];
                    // Skip if it looks like a neighborhood or county
                    if (part.toLowerCase().includes('county') ||
                        part.toLowerCase().includes('township')) {
                      continue;
                    }
                    // Check if this is a state abbreviation
                    if (part.match(/^[A-Z]{2}$/)) {
                      state = part;
                    } else if (part.match(/\d{5}/)) {
                      // This is a zipcode
                      zipcode = part.match(/\d{5}/)[0];
                    } else if (!city && !state && !part.match(/USA|United States/i)) {
                      // This is likely the city
                      city = part;
                    }
                  }
                } else {
                  // First part is the full street
                  street = parts[0];

                  // Process remaining parts
                  for (let i = 1; i < parts.length; i++) {
                    const part = parts[i];
                    // Skip if it looks like a neighborhood or county
                    if (part.toLowerCase().includes('county') ||
                        part.toLowerCase().includes('township')) {
                      continue;
                    }
                    // Check if this is a state abbreviation
                    if (part.match(/^[A-Z]{2}$/)) {
                      state = part;
                    } else if (part.match(/\d{5}/)) {
                      // This is a zipcode
                      zipcode = part.match(/\d{5}/)[0];
                    } else if (!city && !state && !part.match(/USA|United States/i)) {
                      // This is likely the city
                      city = part;
                    }
                  }
                }
              }

              // Build the formatted address
              displayAddress = street;
              if (city) {
                displayAddress += ', ' + city;
              }
              if (state) {
                displayAddress += ', ' + state;
                if (zipcode) {
                  displayAddress += ' ' + zipcode;
                }
              }

              // Fallback if we couldn't parse properly
              if (!street || !city) {
                displayAddress = parts.slice(0, 3).join(', ');
              }

              centerLocationElement.textContent = displayAddress;
              window.confirmedServiceAddress = displayAddress;
            } else {
              centerLocationElement.textContent = 'Address not found';
            }

            // Remove this handler
            window.removeEventListener('message', handleResponse);
          }
        };

        window.addEventListener('message', handleResponse);
      } else {
        // Direct Nominatim call when not in iframe
        console.log('[Service Area Map] Direct Nominatim call for reverse geocoding');
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`)
          .then(response => response.json())
          .then(data => {
            if (data.display_name) {
              // Parse and format the address properly
              const parts = data.display_name.split(',').map(p => p.trim());
              let displayAddress = '';

              // Extract components we want
              let street = '';
              let city = '';
              let state = '';
              let zipcode = '';

              // Nominatim format often includes: house_number, street, neighborhood, city, county, state, zip, country
              // We want: street (no comma after number), city, state zipcode

              if (parts.length >= 2) {
                // First part might be house number, second is street, or first is full street
                if (parts[0].match(/^\d+$/)) {
                  // First part is just a number, combine with street
                  street = parts[0] + ' ' + parts[1];
                  let startIdx = 2;

                  // Skip neighborhood/suburb names by looking for the city
                  // Cities usually come after neighborhoods but before county
                  for (let i = startIdx; i < parts.length; i++) {
                    const part = parts[i];
                    // Skip if it looks like a neighborhood or county
                    if (part.toLowerCase().includes('county') ||
                        part.toLowerCase().includes('township')) {
                      continue;
                    }
                    // Check if this is a state abbreviation
                    if (part.match(/^[A-Z]{2}$/)) {
                      state = part;
                    } else if (part.match(/\d{5}/)) {
                      // This is a zipcode
                      zipcode = part.match(/\d{5}/)[0];
                    } else if (!city && !state && !part.match(/USA|United States/i)) {
                      // This is likely the city
                      city = part;
                    }
                  }
                } else {
                  // First part is the full street
                  street = parts[0];

                  // Process remaining parts
                  for (let i = 1; i < parts.length; i++) {
                    const part = parts[i];
                    // Skip if it looks like a neighborhood or county
                    if (part.toLowerCase().includes('county') ||
                        part.toLowerCase().includes('township')) {
                      continue;
                    }
                    // Check if this is a state abbreviation
                    if (part.match(/^[A-Z]{2}$/)) {
                      state = part;
                    } else if (part.match(/\d{5}/)) {
                      // This is a zipcode
                      zipcode = part.match(/\d{5}/)[0];
                    } else if (!city && !state && !part.match(/USA|United States/i)) {
                      // This is likely the city
                      city = part;
                    }
                  }
                }
              }

              // Build the formatted address
              displayAddress = street;
              if (city) {
                displayAddress += ', ' + city;
              }
              if (state) {
                displayAddress += ', ' + state;
                if (zipcode) {
                  displayAddress += ' ' + zipcode;
                }
              }

              // Fallback if we couldn't parse properly
              if (!street || !city) {
                displayAddress = parts.slice(0, 3).join(', ');
              }

              centerLocationElement.textContent = displayAddress;
              window.confirmedServiceAddress = displayAddress;
            } else {
              centerLocationElement.textContent = 'Address not found';
            }
          })
          .catch(error => {
            console.error('Reverse geocoding error:', error);
            centerLocationElement.textContent = 'Address lookup failed';
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
      // Don't set a fixed zoom - let updateServiceArea handle it to show the full circle
      // Clear the pending center
      delete window.pendingMapCenter;
    } else {
      // Set initial marker and circle at default location
      updateServiceArea(defaultLat, defaultLng, parseInt(radiusSlider ? radiusSlider.value : 5));
      // Perform reverse geocoding for default location if no address is set
      if (!window.confirmedServiceAddress) {
        reverseGeocodeForServiceArea(defaultLat, defaultLng);
      }
    }
  }

  // Initialize map when container is visible and Leaflet is loaded
  function waitForLeafletAndInitialize_OLD() {
    console.log('[Service Area Map] waitForLeafletAndInitialize called');

    // Remove any remaining event listeners to prevent duplicate calls
    window.removeEventListener('init-service-area-map', waitForLeafletAndInitialize_OLD);
    window.removeEventListener('dom-sections-ready', waitForLeafletAndInitialize_OLD);

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
          // Try to initialize again now that Leaflet is loaded
          waitForLeafletAndInitialize_OLD();
        };
        document.body.appendChild(leafletJS);
        return;
      }
      // Just return, Leaflet will call us back when loaded
      return;
    }

    // Check if container has dimensions
    const rect = mapContainer.getBoundingClientRect();
    console.log('[Service Area Map] Container dimensions:', { width: rect.width, height: rect.height });

    if (rect.width === 0 || rect.height === 0) {
      console.log('[Service Area Map] Map container has no dimensions yet');
      // Check if container is actually visible
      const section = document.getElementById('serviceAreaSection');
      console.log('[Service Area Map] Service area section display:', section ? section.style.display : 'section not found');

      // Try one more time after a render frame
      requestAnimationFrame(() => {
        const rect2 = mapContainer.getBoundingClientRect();
        console.log('[Service Area Map] Container dimensions after frame:', { width: rect2.width, height: rect2.height });
        if (rect2.width > 0 && rect2.height > 0) {
          console.log('[Service Area Map] Container now has dimensions, initializing map');
          initializeServiceAreaMap_OLD();
        } else {
          console.log('[Service Area Map] Container still has no dimensions, giving up');
        }
      });
      return;
    }

    console.log('Leaflet loaded and container ready, initializing map');
    console.log('Leaflet version:', L.version);
    initializeServiceAreaMap_OLD();
  }
  */

    // OLD MAP INITIALIZATION - REPLACED BY SERVICE AREA COMPONENT
    // Commenting out to prevent conflicts with new component
    /*
  // Listen for trigger events to initialize map
  window.addEventListener('init-service-area-map', waitForLeafletAndInitialize, { once: true });
  window.addEventListener('dom-sections-ready', () => {
    console.log('[Service Area Map] DOM sections ready event received');
    // Give browser a chance to complete rendering
    requestAnimationFrame(() => {
      waitForLeafletAndInitialize_OLD();
    });
  }, { once: true });

  // Try initial initialization in case section is already visible
  if (document.getElementById('serviceAreaMap')) {
    const container = document.getElementById('serviceAreaMap').closest('.form-section-hidden');
    if (!container || container.style.display !== 'none') {
      // Section is visible, try to initialize
      waitForLeafletAndInitialize_OLD();
    }
  }
  */

    // Set up address validation button
    function setupAddressValidation() {
      const validateButton = document.getElementById('validateAddress');
      if (validateButton) {
        validateButton.addEventListener('click', function() {
          validateAndSetAddress();
        });
      }

      // Set up back button (this is now used when going back from final sections to service area)
      const backButton = document.getElementById('backButton');
      if (backButton) {
        backButton.addEventListener('click', function() {
          console.log('[Navigation] Final section back button clicked');
          
          // Hide all the final sections
          const sectionsToHide = [
            'serviceInfoSection',
            'paymentInfoSection',
            'termsSection',
            'submitSection'
          ];
          
          sectionsToHide.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
              section.classList.add('form-section-hidden');
              section.classList.remove('form-section-visible');
            }
          });
          
          // Hide this back button
          backButton.classList.add('hidden');
          
          // Show service area section and its navigation again
          const serviceAreaSection = document.getElementById('serviceAreaSection');
          const serviceAreaNav = document.getElementById('serviceAreaNavigation');
          
          if (serviceAreaSection) {
            serviceAreaSection.classList.remove('form-section-hidden');
            serviceAreaSection.classList.add('form-section-visible');
          }
          if (serviceAreaNav) {
            serviceAreaNav.classList.remove('hidden');
          }
          
          // Scroll to service area
          setTimeout(() => {
            if (serviceAreaSection) {
              serviceAreaSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            // Trigger height recalculation
            window.dispatchEvent(new Event('section-toggled'));
          }, 100);
        });
      }

      // Set up service area navigation buttons
      const serviceAreaBackButton = document.getElementById('serviceAreaBackButton');
      if (serviceAreaBackButton) {
        serviceAreaBackButton.addEventListener('click', function() {
          console.log('[Navigation] Service area back button clicked');
          
          // Hide service area section and navigation
          const serviceAreaSection = document.getElementById('serviceAreaSection');
          const serviceAreaNav = document.getElementById('serviceAreaNavigation');
          if (serviceAreaSection) {
            serviceAreaSection.classList.add('form-section-hidden');
            serviceAreaSection.classList.remove('form-section-visible');
          }
          if (serviceAreaNav) {
            serviceAreaNav.classList.add('hidden');
          }
          
          // Show the first sections again (OAuth, personal info, business info)
          const socialAuthSection = document.getElementById('socialAuthSection');
          const personalInfoSection = document.getElementById('personalInfoSection');
          const businessInfoSection = document.getElementById('businessInfoSection');
          
          if (socialAuthSection) {
            socialAuthSection.style.display = '';
          }
          
          if (personalInfoSection) {
            personalInfoSection.style.display = '';
            // Re-add required attributes
            const fields = personalInfoSection.querySelectorAll('input#firstName, input#lastName, input#email, input#phone');
            fields.forEach(field => {
              field.setAttribute('required', 'required');
            });
          }
          
          if (businessInfoSection) {
            businessInfoSection.style.display = '';
            // Re-add required attributes
            const fields = businessInfoSection.querySelectorAll('input#address, input#city, input#state, input#zipCode');
            fields.forEach(field => {
              field.setAttribute('required', 'required');
            });
          }
          
          // Reset address validation state
          window.addressValidated = false;
          
          // Scroll to top
          const form = document.getElementById('affiliateRegistrationForm');
          if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          
          // Trigger height recalculation
          window.dispatchEvent(new Event('section-toggled'));
        });
      }
      
      const serviceAreaNextButton = document.getElementById('serviceAreaNextButton');
      if (serviceAreaNextButton) {
        serviceAreaNextButton.addEventListener('click', function() {
          console.log('[Navigation] Service area next button clicked');
          
          // Validate that service area has been set
          const latField = document.getElementById('registrationServiceAreaComponent-latitude');
          const lngField = document.getElementById('registrationServiceAreaComponent-longitude');
          const radiusField = document.getElementById('registrationServiceAreaComponent-radius');
          
          if (!latField || !latField.value || !lngField || !lngField.value || !radiusField || !radiusField.value) {
            alert('Please set your service area before continuing.');
            return;
          }
          
          // Hide service area section and navigation
          const serviceAreaSection = document.getElementById('serviceAreaSection');
          const serviceAreaNav = document.getElementById('serviceAreaNavigation');
          if (serviceAreaSection) {
            serviceAreaSection.classList.add('form-section-hidden');
            serviceAreaSection.classList.remove('form-section-visible');
          }
          if (serviceAreaNav) {
            serviceAreaNav.classList.add('hidden');
          }
          
          // Show all remaining sections
          const sectionsToShow = [
            'serviceInfoSection',
            'paymentInfoSection', 
            'termsSection',
            'submitSection'
          ];
          
          sectionsToShow.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
              section.classList.remove('form-section-hidden');
              section.style.display = '';
            }
          });
          
          // Show the old back button in the submit section
          const oldBackButton = document.getElementById('backButton');
          if (oldBackButton) {
            oldBackButton.style.display = 'flex';
          }
          
          // Initialize pricing preview if needed
          if (window.PricingPreviewComponent) {
            window.PricingPreviewComponent.init('registrationPricingPreview');
          }
          
          // Scroll to service info section
          setTimeout(() => {
            const serviceInfoSection = document.getElementById('serviceInfoSection');
            if (serviceInfoSection) {
              serviceInfoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            // Trigger height recalculation after scroll
            window.dispatchEvent(new Event('section-toggled'));
          }, 100);
        });
      }

      // Monitor address fields and geocode when complete
      function validateAndSetAddress() {
        console.log('[Service Area Map] Using new address validation component');
        
        // Use the new address validation component
        if (window.affiliateAddressValidator) {
          window.affiliateAddressValidator.validateAddress();
        } else if (window.AddressValidationComponent) {
          // Create validator if it doesn't exist
          const validator = new window.AddressValidationComponent({
            addressField: 'address',
            cityField: 'city',
            stateField: 'state',
            zipField: 'zipCode',
            validateButton: 'validateAddress',
            onSuccess: handleAddressValidationSuccess,
            onError: handleAddressValidationError
          });
          window.affiliateAddressValidator = validator;
          validator.validateAddress();
        } else {
          console.error('[Service Area Map] Address validation component not available');
          alert('Address validation is temporarily unavailable. Please try again.');
        }
      }

      // Handle successful address validation from the new component
      function handleAddressValidationSuccess(data) {
        console.log('[Service Area Map] Address validation successful:', data);
        
        // Update service location fields
        const latField = document.getElementById('serviceLatitude');
        const lonField = document.getElementById('serviceLongitude');
        
        if (latField) latField.value = data.latitude;
        if (lonField) lonField.value = data.longitude;
        
        // Get radius value
        const radiusSlider = document.getElementById('radiusSlider');
        const radiusValue = radiusSlider ? parseInt(radiusSlider.value) : 5;
        
        // Store the validated address components
        const formAddress = document.getElementById('address')?.value?.trim() || '';
        const formCity = document.getElementById('city')?.value?.trim() || '';
        const formState = document.getElementById('state')?.value?.trim() || '';
        const formZip = document.getElementById('zipCode')?.value?.trim() || '';
        
        window.validatedAddress = {
          address: formAddress,
          city: formCity,
          state: formState,
          zipCode: formZip
        };
        
        // Store service area data
        window.selectedServiceAreaData = {
          latitude: data.latitude,
          longitude: data.longitude,
          radius: radiusValue,
          address: data.formattedAddress
        };
        
        window.confirmedServiceAddress = data.formattedAddress;
        window.addressValidated = true;
        
        // Update UI elements
        const centerLocationElement = document.getElementById('centerLocation');
        if (centerLocationElement) {
          centerLocationElement.textContent = data.formattedAddress;
        }
        
        const centerCoordinatesElement = document.getElementById('centerCoordinates');
        if (centerCoordinatesElement) {
          centerCoordinatesElement.textContent = `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
        }
        
        // Show service area info
        const serviceAreaInfo = document.getElementById('serviceAreaInfo');
        if (serviceAreaInfo) {
          serviceAreaInfo.classList.remove('hidden');
        }
        
        // Update coverage area
        const coverageAreaElement = document.getElementById('coverageArea');
        if (coverageAreaElement) {
          coverageAreaElement.textContent = `${radiusValue} mile radius`;
        }
        
        // Hide other sections
        const businessInfoSection = document.querySelector('#businessInfoSection');
        if (businessInfoSection) {
          businessInfoSection.style.display = 'none';
          const requiredFields = businessInfoSection.querySelectorAll('input[required]');
          requiredFields.forEach(field => {
            field.removeAttribute('required');
          });
        }
        
        const socialAuthSection = document.getElementById('socialAuthSection');
        if (socialAuthSection) {
          socialAuthSection.style.display = 'none';
        }
        
        const personalInfoSection = document.getElementById('personalInfoSection');
        if (personalInfoSection) {
          personalInfoSection.style.display = 'none';
          const requiredFields = personalInfoSection.querySelectorAll('input[required]');
          requiredFields.forEach(field => {
            field.removeAttribute('required');
          });
        }
        
        if (window.isOAuthUser) {
          const accountSetup = document.getElementById('accountSetupSection');
          if (accountSetup) {
            accountSetup.style.display = 'none';
          }
        }
        
        const oldBackButton = document.getElementById('backButton');
        if (oldBackButton) {
          oldBackButton.style.display = 'none';
        }
        
        // Show service area section
        const serviceAreaSection = document.getElementById('serviceAreaSection');
        if (serviceAreaSection) {
          serviceAreaSection.classList.remove('form-section-hidden');
          serviceAreaSection.classList.add('form-section-visible');
          
          const serviceAreaNav = document.getElementById('serviceAreaNavigation');
          if (serviceAreaNav) {
            serviceAreaNav.classList.remove('hidden');
          }
          
          // Initialize service area component
          if (window.ServiceAreaComponent && window.selectedServiceAreaData) {
            const data = window.selectedServiceAreaData;
            setTimeout(() => {
              window.registrationServiceArea = window.ServiceAreaComponent.init('registrationServiceAreaComponent', {
                latitude: data.latitude,
                longitude: data.longitude,
                radius: data.radius,
                address: data.address,
                editable: true,
                showMap: true,
                showControls: true,
                showInfo: true,
                registrationAddress: data.address,
                registrationLat: data.latitude,
                registrationLng: data.longitude,
                onUpdate: function(serviceData) {
                  const latField = document.getElementById('registrationServiceAreaComponent-latitude');
                  const lngField = document.getElementById('registrationServiceAreaComponent-longitude');
                  const radiusField = document.getElementById('registrationServiceAreaComponent-radius');
                  if (latField) latField.value = serviceData.latitude;
                  if (lngField) lngField.value = serviceData.longitude;
                  if (radiusField) radiusField.value = serviceData.radius;
                }
              });
              
              // Update hidden fields with initial values
              const latField = document.getElementById('registrationServiceAreaComponent-latitude');
              const lngField = document.getElementById('registrationServiceAreaComponent-longitude');
              const radiusField = document.getElementById('registrationServiceAreaComponent-radius');
              if (latField) latField.value = data.latitude;
              if (lngField) lngField.value = data.longitude;
              if (radiusField) radiusField.value = data.radius;
            }, 100);
          }
          
          // Scroll to service area section
          setTimeout(() => {
            serviceAreaSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.dispatchEvent(new Event('section-toggled'));
            if (window.embedNavigation && window.embedNavigation.sendHeight) {
              window.embedNavigation.sendHeight(true);
            }
          }, 100);
        }
      }
      
      // Handle address validation errors from the new component
      function handleAddressValidationError(message) {
        console.error('[Service Area Map] Address validation error:', message);
        
        // Hide service area section if shown
        const serviceAreaSection = document.getElementById('serviceAreaSection');
        if (serviceAreaSection) {
          serviceAreaSection.classList.add('form-section-hidden');
        }
      }

      // DEPRECATED - Old address confirmation modal has been removed
      // The new address validation component handles all validation with strict requirements

      // Make validation function globally accessible
      window.validateAndSetAddress = validateAndSetAddress;
    }

    // Set up address validation immediately - don't wait for map
    setupAddressValidation();

    // Add click handler directly to submit button as a fallback
    const submitButton = document.getElementById('registerSubmitButton');
    if (submitButton) {
      console.log('[Init] Adding click handler to submit button');
      submitButton.addEventListener('click', function(e) {
        console.log('[Submit Button] Click detected');
        const form = document.getElementById('affiliateRegistrationForm');
        if (form) {
        // Trigger form submit programmatically
          const submitEvent = new Event('submit', {
            bubbles: true,
            cancelable: true
          });
          form.dispatchEvent(submitEvent);
        }
      });
    }
  }

  // Track language preference changes
  function setupLanguagePreferenceTracking() {
  // Listen for language changes from i18n
    if (window.i18n) {
      const originalSetLanguage = window.i18n.setLanguage;
      window.i18n.setLanguage = async function(lang) {
      // Call original function
        const result = await originalSetLanguage.call(this, lang);

        // Update hidden field
        const languagePreferenceField = document.getElementById('languagePreference');
        if (languagePreferenceField) {
          languagePreferenceField.value = lang;
          console.log('Updated language preference field to:', lang);
        }

        return result;
      };
    }

    // Set initial value based on current language
    const languagePreferenceField = document.getElementById('languagePreference');
    if (languagePreferenceField && window.i18n) {
      const currentLang = window.i18n.getLanguage() || 'en';
      languagePreferenceField.value = currentLang;
      console.log('Set initial language preference to:', currentLang);
    }
  }

  // Initialize immediately when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeAffiliateRegistration();
      setupLanguagePreferenceTracking();
    });
  } else {
    // DOM is already loaded
    initializeAffiliateRegistration();
    setupLanguagePreferenceTracking();
    
    // Also try after a delay for dynamically loaded content
    setTimeout(() => {
      console.log('[Init] Re-checking OAuth buttons after delay...');
      const googleBtn = document.getElementById('googleRegister');
      if (googleBtn && !googleBtn.hasAttribute('data-initialized')) {
        console.log('[Init] Re-initializing OAuth handlers...');
        initializeAffiliateRegistration();
        googleBtn.setAttribute('data-initialized', 'true');
      }
    }, 500);
  }

})(); // End IIFE