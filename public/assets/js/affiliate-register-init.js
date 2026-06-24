// Initialization function for affiliate registration when dynamically loaded
(function() {
  'use strict';

  console.log('[affiliate-register-init] Script loading at:', new Date().toISOString());
  console.log('[affiliate-register-init] SwirlSpinner available?', !!window.SwirlSpinner);
  console.log('[affiliate-register-init] Document readyState:', document.readyState);

  // Helper function to get translated spinner messages
  function getSpinnerMessage(key, params = {}) {
    // Default messages
    const defaults = {
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

    // Shared validation function for form submission
    function validateFormFields() {
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

      // Personal information always required
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
        { id: 'deliveryFee', name: 'Delivery Fee' },
        { id: 'paymentMethod', name: 'Payment Method' }
      );
      // Note: Service area fields are checked separately below with component-generated IDs

      // Username and password are always required
      requiredFields.push(
        { id: 'username', name: 'Username' },
        { id: 'password', name: 'Password' }
      );

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
        console.log('[Form Init] Submit handler already attached, skipping');
        return;
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
        
        // Check if account setup was completed
        if (!window.accountSetupCompleted) {
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
          const formData = new FormData(form);

          // Validate required fields
          const missingFields = validateFormFields();
          console.log('[Form Submit] Missing fields:', missingFields);
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

          // Check for username validation errors
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

          // Check if passwords match
          const password = document.getElementById('password').value;
          const confirmPassword = document.getElementById('confirmPassword').value;

          if (password !== confirmPassword) {
            window.ErrorHandler.showError('Passwords do not match!');
            // Hide spinner
            if (formSpinner) formSpinner.hide();
            isSubmitting = false; // Reset flag
            return;
          }

          // Collect form data (reuse the formData from above)
          const affiliateData = {};

          formData.forEach((value, key) => {
            affiliateData[key] = value;
          });

          // Manually collect all form fields to ensure nothing is missed
          // This is necessary because hidden sections may not be included in FormData
          const formFields = [
            'inviteToken',
            'firstName', 'lastName', 'email', 'phone', 'businessName',
            'address', 'city', 'state', 'zipCode',
            'deliveryFee',
            'paymentMethod', 'accountNumber', 'routingNumber', 'paypalEmail',
            'languagePreference', 'termsAgreement'
          ];

          formFields.forEach(fieldName => {
            const element = document.getElementById(fieldName);

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
          const endpoint = `${baseUrl}/api/v1/affiliates/register`;

          // API call to the server with proper base URL.
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
    attachFormSubmitHandler();

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

    // Fee calculator functionality — single flat delivery-fee input.
    function initializeFeeCalculator() {
      const deliveryFeeInput = document.getElementById('deliveryFee');
      if (!deliveryFeeInput) return;

      // Prevent Enter key from submitting the form in the fee field
      const preventEnterSubmit = function(event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
          event.preventDefault();
          event.stopPropagation();
          // Trigger input event to update pricing preview
          this.dispatchEvent(new Event('input', { bubbles: true }));
          this.dispatchEvent(new Event('change', { bubbles: true }));
          return false;
        }
      };
      deliveryFeeInput.addEventListener('keydown', preventEnterSubmit);

      // Initialize the pricing preview component (flat-fee model)
      if (window.PricingPreviewComponent) {
        window.registrationPricingPreview = window.PricingPreviewComponent.init(
          'registrationPricingPreview',
          'deliveryFee',
          {
            titleText: 'Live Pricing Preview',
            titleI18n: 'affiliate.register.livePricingPreview',
            showNotes: true
          }
        );
      } else {
        console.warn('PricingPreviewComponent not available; pricing preview will not render');
      }

      // Clean up function to remove event listeners
      const cleanupFeeCalculator = function() {
        deliveryFeeInput.removeEventListener('keydown', preventEnterSubmit);
        if (window.registrationPricingPreview && window.registrationPricingPreview.destroy) {
          window.registrationPricingPreview.destroy();
        }
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
      };

      window.addEventListener('beforeunload', cleanupFeeCalculator);
      window.addEventListener('page-cleanup', cleanupFeeCalculator);
      window.addEventListener('disconnect-observers', cleanupFeeCalculator);
    }



    // Set up account setup next button
    function setupAccountSetupNavigation() {
      const accountSetupNextButton = document.getElementById('accountSetupNextButton');
      const personalInfoBackButton = document.getElementById('personalInfoBackButton');
      
      // Handle back button click
      if (personalInfoBackButton) {
        personalInfoBackButton.addEventListener('click', function() {
          console.log('[Navigation] Back to account setup clicked');
          
          // Show account setup section
          const accountSetupSection = document.getElementById('accountSetupSection');

          if (accountSetupSection) {
            accountSetupSection.classList.remove('form-section-hidden');
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
          
          // All validations passed - hide account setup section
          const accountSetupSection = document.getElementById('accountSetupSection');

          if (accountSetupSection) {
            accountSetupSection.classList.add('form-section-hidden');
            console.log('✅ Hidden account setup section after completion');
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

          // Show the first sections again (personal info, business info)
          const personalInfoSection = document.getElementById('personalInfoSection');
          const businessInfoSection = document.getElementById('businessInfoSection');

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
        
        const personalInfoSection = document.getElementById('personalInfoSection');
        if (personalInfoSection) {
          personalInfoSection.style.display = 'none';
          const requiredFields = personalInfoSection.querySelectorAll('input[required]');
          requiredFields.forEach(field => {
            field.removeAttribute('required');
          });
        }

        // Show all remaining sections (service info, payment, terms, submit)
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

    // NOTE: the submit button is type="submit" inside the form, so a click
    // already fires the form's native 'submit' event. A second synthetic
    // dispatch here caused every click to fire the handler twice (the
    // "Already submitting" warning). Native submit is the single canonical path.
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
  }

})(); // End IIFE