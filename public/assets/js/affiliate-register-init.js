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

  // --- Optional W-9 upload (spec §6.2) ---
  // Mirrors the server's uploadW9 middleware: pdf/jpeg/png only, 10 MB cap
  // (server cap comes from SystemConfig w9_max_upload_mb, default 10).
  const W9_MAX_MB = 10;
  const W9_ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
  const W9_ALLOWED_EXT = /\.(pdf|jpe?g|png)$/i;

  function w9Translate(key, params) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const translated = window.i18n.t(key, params || {});
      if (translated && translated !== key) {
        return translated;
      }
    }
    // English fallback when i18n hasn't loaded
    const defaults = {
      'affiliateRegister.w9.tooLarge': `That file is too large. The maximum size is ${W9_MAX_MB} MB.`,
      'affiliateRegister.w9.wrongType': 'Only PDF, JPG, or PNG files are accepted.'
    };
    return defaults[key] || key;
  }

  function getSelectedW9File() {
    const input = document.getElementById('w9');
    return input && input.files && input.files.length > 0 ? input.files[0] : null;
  }

  // Returns null when the file is acceptable (or absent — the upload is
  // optional); otherwise the translated error message.
  function validateW9File(file) {
    if (!file) {
      return null;
    }
    const typeOk = W9_ALLOWED_MIME.includes(file.type) ||
      (!file.type && W9_ALLOWED_EXT.test(file.name || ''));
    if (!typeOk) {
      return w9Translate('affiliateRegister.w9.wrongType');
    }
    if (file.size > W9_MAX_MB * 1024 * 1024) {
      return w9Translate('affiliateRegister.w9.tooLarge', { max: W9_MAX_MB });
    }
    return null;
  }

  function showW9FieldError(message) {
    const errorEl = document.getElementById('w9FileError');
    if (!errorEl) {
      return;
    }
    if (message) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    } else {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }

  function setupW9Upload() {
    const input = document.getElementById('w9');
    if (!input || input.dataset.w9Initialized === 'true') {
      return;
    }
    input.dataset.w9Initialized = 'true';
    input.addEventListener('change', function() {
      showW9FieldError(validateW9File(getSelectedW9File()));
    });
  }

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
    const baseUrl = window.EMBED_CONFIG?.baseUrl || window.location.origin;
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

      // Hide account setup section and OAuth panel for OAuth users
      const accountSetupSection = document.getElementById('accountSetupSection');
      // socialAuthSection already declared above, no need to redeclare
      
      if (accountSetupSection) {
        accountSetupSection.classList.add('form-section-hidden');
        console.log('✅ Hidden account setup section for OAuth user');
      }
      
      // Hide OAuth panel after successful OAuth
      if (socialAuthSection) {
        socialAuthSection.classList.add('form-section-hidden');
        console.log('✅ Hidden OAuth panel after OAuth success');
      }
      
      // Show personal and business info sections
      const personalInfoSection = document.getElementById('personalInfoSection');
      const businessInfoSection = document.getElementById('businessInfoSection');
      
      if (personalInfoSection) {
        personalInfoSection.classList.remove('form-section-hidden');
        console.log('✅ Showing personal info section for OAuth user');
      }
      
      if (businessInfoSection) {
        businessInfoSection.classList.remove('form-section-hidden');
        console.log('✅ Showing business info section for OAuth user');
      }

      // Note: Account setup section will remain hidden for OAuth users
      window.isOAuthUser = true;
      window.accountSetupCompleted = true;

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

    // Add email validation function
    async function validateEmail() {
      const email = emailField?.value?.trim();
      if (!email) return;

      // Find or create help text element
      let emailHelp = emailField.parentElement.querySelector('.email-validation-message');
      if (!emailHelp) {
        emailHelp = document.createElement('p');
        emailHelp.className = 'email-validation-message text-xs mt-1';
        emailField.parentElement.appendChild(emailHelp);
      }

      // Delegate to the shared FormValidation helper — single source of truth
      // for the email regex. Supports any TLD ≥ 2 chars and catches typos.
      if (!(window.FormValidation && window.FormValidation.isValidEmail(email))) {
        emailField.classList.remove('border-green-500');
        emailField.classList.add('border-red-500');
        emailHelp.textContent = '❌ Invalid email format';
        emailHelp.classList.remove('text-green-600');
        emailHelp.classList.add('text-red-600');
        return;
      }

      // Format is valid — duplicate-email errors surface at submit time.
      emailField.classList.remove('border-red-500');
      emailField.classList.add('border-green-500');
      emailHelp.textContent = '';
      emailHelp.classList.remove('text-red-600', 'text-green-600');
    }

    // Add email validation event listeners
    if (emailField) {
      // Validate on blur (when user leaves the field)
      emailField.addEventListener('blur', validateEmail);
      
      // Clear validation on input change
      emailField.addEventListener('input', function() {
        const emailHelp = this.parentElement.querySelector('.email-validation-message');
        if (emailHelp && emailHelp.textContent.includes('❌')) {
          this.classList.remove('border-red-500', 'border-green-500');
          emailHelp.textContent = '';
          emailHelp.classList.remove('text-red-600', 'text-green-600');
        }
        // Also update password requirements if password field has value
        if (passwordField?.value) {
          updatePasswordRequirements(
            passwordField.value,
            usernameField?.value || '',
            this.value
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
        
        // Check if account setup was completed (unless OAuth user)
        if (!window.isOAuthUser && !window.accountSetupCompleted) {
          window.ErrorHandler.showError('Please complete the account setup first');
          const accountSetupSection = document.getElementById('accountSetupSection');
          if (accountSetupSection) {
            accountSetupSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }
        
        isSubmitting = true;

        // Show spinner on entire page container
        const processingMessage = getSpinnerMessage('spinner.processingRegistration');
        
        // Get the main embed container to cover everything
        const embedContainer = document.querySelector('.embed-container');
        const spinnerContainer = embedContainer || form.closest('.bg-white') || form;

        // let (not const): error paths below null it out after hiding
        let formSpinner = window.SwirlSpinner ?
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

          // Check for email validation errors
          const emailField = document.getElementById('email');
          if (emailField && emailField.classList.contains('border-red-500')) {
            const emailHelp = emailField.parentElement.querySelector('.email-validation-message');
            const errorMessage = emailHelp?.textContent || 'Please fix the email validation error';
            window.ErrorHandler.showError(errorMessage);
            // Hide spinner
            if (formSpinner) formSpinner.hide();
            isSubmitting = false; // Reset flag
            emailField.focus();
            return;
          }

          // Check for username validation errors (only for traditional registration)
          if (!isSocialRegistration) {
            const usernameField = document.getElementById('username');
            if (usernameField && usernameField.classList.contains('border-red-500')) {
              const usernameHelp = usernameField.parentElement.querySelector('.username-validation-message');
              const errorMessage = usernameHelp?.textContent || 'Please fix the username validation error';
              window.ErrorHandler.showError(errorMessage);
              // Hide spinner
              if (formSpinner) formSpinner.hide();
              isSubmitting = false; // Reset flag
              usernameField.focus();
              return;
            }
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

          // Optional W-9 file — traditional registration only; the social
          // endpoint does not accept multipart (upload later via dashboard).
          const w9File = isSocialRegistration ? null : getSelectedW9File();
          const w9ValidationError = validateW9File(w9File);
          if (w9ValidationError) {
            showW9FieldError(w9ValidationError);
            window.ErrorHandler.showError(w9ValidationError);
            if (formSpinner) formSpinner.hide();
            isSubmitting = false; // Reset flag
            return;
          }

          // Collect form data (reuse the formData from above)
          const affiliateData = {};

          formData.forEach((value, key) => {
            // The W-9 File object is sent as a multipart part, never as a
            // scalar field — keep it out of the JSON payload.
            if (key === 'w9') {
              return;
            }
            affiliateData[key] = value;
          });

          // Manually collect all form fields to ensure nothing is missed
          // This is necessary because hidden sections may not be included in FormData
          const formFields = [
            'inviteToken',
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

          // API call to the server with proper base URL.
          // With a W-9 attached the body is multipart FormData (the backend
          // register route accepts both); the browser sets the boundary
          // Content-Type itself. Without a file the JSON path is unchanged.
          let response;
          if (w9File) {
            const multipartBody = new FormData();
            Object.keys(affiliateData).forEach((key) => {
              const value = affiliateData[key];
              if (value === undefined || value === null) {
                return;
              }
              multipartBody.append(key, typeof value === 'string' ? value : String(value));
            });
            multipartBody.append('w9', w9File, w9File.name);
            response = await csrfFetch(endpoint, {
              method: 'POST',
              credentials: 'include',
              body: multipartBody
            });
          } else {
            response = await csrfFetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify(affiliateData)
            });
          }

          if (!response.ok) {
            console.error('Registration failed with status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);

            try {
              const errorData = JSON.parse(errorText);

              // Handle validation errors
              if (errorData.errors && Array.isArray(errorData.errors)) {
                console.error('Validation errors:');
                errorData.errors.forEach(err => {
                  console.error(`- ${err.param || err.path}: ${err.msg}`);
                });

                // Format and show validation errors to user
                const errorMessages = errorData.errors.map(err => {
                  const field = err.param || err.path || 'Unknown field';
                  return `${field}: ${err.msg}`;
                });

                const errorMessage = errorMessages.length === 1
                  ? errorMessages[0]
                  : `Please fix the following errors:\n• ${errorMessages.join('\n• ')}`;

                // Hide spinner
                if (formSpinner) {
                  formSpinner.hide();
                  formSpinner = null;
                }

                // Show errors to user
                if (window.ErrorHandler && window.ErrorHandler.showError) {
                  window.ErrorHandler.showError(errorMessage);
                } else {
                  alert(errorMessage);
                }

                isSubmitting = false;
                return; // Exit early
              }

              // W-9 upload rejections from the server's uploadW9 middleware —
              // surface the translated message inline and via ErrorHandler.
              if (errorData.code === 'W9_FILE_TOO_LARGE' || errorData.code === 'W9_INVALID_FILE_TYPE') {
                const w9Message = errorData.code === 'W9_FILE_TOO_LARGE'
                  ? w9Translate('affiliateRegister.w9.tooLarge', { max: W9_MAX_MB })
                  : w9Translate('affiliateRegister.w9.wrongType');
                showW9FieldError(w9Message);

                if (formSpinner) {
                  formSpinner.hide();
                  formSpinner = null;
                }

                if (window.ErrorHandler && window.ErrorHandler.showError) {
                  window.ErrorHandler.showError(w9Message);
                } else {
                  alert(w9Message);
                }

                isSubmitting = false;
                return;
              }

              // Show generic error message from server if available
              if (errorData.message) {
                if (formSpinner) {
                  formSpinner.hide();
                  formSpinner = null;
                }

                if (window.ErrorHandler && window.ErrorHandler.showError) {
                  window.ErrorHandler.showError(errorData.message);
                } else {
                  alert(errorData.message);
                }

                isSubmitting = false;
                return;
              }
            } catch (e) {
              // Not JSON error - will fall through to handleFetchError below
              console.error('Error parsing error response:', e);
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
      const minimumFee = parseFloat(document.getElementById('minimumDeliveryFee')?.value) || 20;
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



    // Set up account setup next button
    function setupAccountSetupNavigation() {
      const accountSetupNextButton = document.getElementById('accountSetupNextButton');
      const personalInfoBackButton = document.getElementById('personalInfoBackButton');
      
      // Handle back button click
      if (personalInfoBackButton) {
        personalInfoBackButton.addEventListener('click', function() {
          console.log('[Navigation] Back to account setup clicked');
          
          // Show account setup and OAuth panel
          const accountSetupSection = document.getElementById('accountSetupSection');
          const socialAuthSection = document.getElementById('socialAuthSection');
          
          if (accountSetupSection) {
            accountSetupSection.classList.remove('form-section-hidden');
          }
          
          if (socialAuthSection && !window.isOAuthUser) {
            socialAuthSection.classList.remove('form-section-hidden');
          }
          
          // Hide personal and business info sections
          const personalInfoSection = document.getElementById('personalInfoSection');
          const businessInfoSection = document.getElementById('businessInfoSection');
          
          if (personalInfoSection) {
            personalInfoSection.classList.add('form-section-hidden');
          }
          
          if (businessInfoSection) {
            businessInfoSection.classList.add('form-section-hidden');
          }
          
          // Reset the flag
          window.accountSetupCompleted = false;
          
          // Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      
      if (accountSetupNextButton) {
        accountSetupNextButton.addEventListener('click', function() {
          console.log('[Navigation] Account setup next button clicked');
          
          // Validate username and password fields
          const usernameField = document.getElementById('username');
          const passwordField = document.getElementById('password');
          const confirmPasswordField = document.getElementById('confirmPassword');
          
          // Check if username is filled
          if (!usernameField || !usernameField.value.trim()) {
            window.ErrorHandler.showError('Please enter a username');
            usernameField.focus();
            return;
          }
          
          // Check if username has validation errors
          if (usernameField.classList.contains('border-red-500')) {
            const usernameHelp = usernameField.parentElement.querySelector('.username-validation-message');
            const errorMessage = usernameHelp?.textContent || 'Please fix the username validation error';
            window.ErrorHandler.showError(errorMessage);
            usernameField.focus();
            return;
          }
          
          // Check if password is filled
          if (!passwordField || !passwordField.value) {
            window.ErrorHandler.showError('Please enter a password');
            passwordField.focus();
            return;
          }
          
          // Check if passwords match
          if (!confirmPasswordField || passwordField.value !== confirmPasswordField.value) {
            window.ErrorHandler.showError('Passwords do not match');
            confirmPasswordField.focus();
            return;
          }
          
          // Validate password strength
          const passwordValidation = validatePasswordStrength(
            passwordField.value,
            usernameField.value,
            document.getElementById('email')?.value || ''
          );
          
          if (!passwordValidation.isValid) {
            window.ErrorHandler.showError('Please ensure your password meets all requirements');
            passwordField.focus();
            return;
          }
          
          // All validations passed - hide account setup section and OAuth panel
          const accountSetupSection = document.getElementById('accountSetupSection');
          const socialAuthSection = document.getElementById('socialAuthSection');
          
          if (accountSetupSection) {
            accountSetupSection.classList.add('form-section-hidden');
            console.log('✅ Hidden account setup section after completion');
          }
          
          // Hide OAuth panel
          if (socialAuthSection) {
            socialAuthSection.classList.add('form-section-hidden');
            console.log('✅ Hidden OAuth panel after account setup');
          }
          
          // Show personal and business info sections
          const personalInfoSection = document.getElementById('personalInfoSection');
          const businessInfoSection = document.getElementById('businessInfoSection');
          
          if (personalInfoSection) {
            personalInfoSection.classList.remove('form-section-hidden');
            console.log('✅ Showing personal info section');
          }
          
          if (businessInfoSection) {
            businessInfoSection.classList.remove('form-section-hidden');
            console.log('✅ Showing business info section');
          }
          
          // Mark that user has completed account setup
          window.accountSetupCompleted = true;
          
          // Scroll to personal info section
          if (personalInfoSection) {
            setTimeout(() => {
              personalInfoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        });
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

      // Set up back button (goes back from final sections to the address/personal info step)
      const backButton = document.getElementById('backButton');
      if (backButton) {
        backButton.addEventListener('click', function() {
          console.log('[Navigation] Final section back button clicked');

          // Hide all the final sections
          const sectionsToHide = [
            'serviceInfoSection',
            'paymentInfoSection',
            'w9Section',
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
          backButton.style.display = 'none';

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

      // Monitor address fields and geocode when complete
      function validateAndSetAddress() {
        console.log('[Address Validation] Using address validation component');
        
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
          console.error('[Address Validation] Address validation component not available');
          alert('Address validation is temporarily unavailable. Please try again.');
        }
      }

      // Handle successful address validation from the new component
      function handleAddressValidationSuccess(data) {
        console.log('[Address Validation] Address validation successful:', data);

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

        window.addressValidated = true;

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
        
        // Show all remaining sections (service info, payment, terms, submit)
        const sectionsToShow = [
          'serviceInfoSection',
          'paymentInfoSection',
          'w9Section',
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

        // Show the back button in the submit section
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
          if (window.embedNavigation && window.embedNavigation.sendHeight) {
            window.embedNavigation.sendHeight(true);
          }
        }, 100);
      }

      // Handle address validation errors from the new component
      function handleAddressValidationError(message) {
        console.error('[Address Validation] Address validation error:', message);
      }

      // DEPRECATED - Old address confirmation modal has been removed
      // The new address validation component handles all validation with strict requirements

      // Make validation function globally accessible
      window.validateAndSetAddress = validateAndSetAddress;
    }

    // Set up navigation buttons
    setupAccountSetupNavigation();
    setupAddressValidation();
    setupW9Upload();

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