(function() {
  'use strict';

  // Debug info
  console.log('customer-register.js loaded');
  console.log('Current URL:', window.location.href);
  console.log('Window parent same as window?', window.parent === window);

  // Note: Registration endpoints currently don't require CSRF tokens
  // But we'll prepare for future implementation
  const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

  // Configuration for embedded environment
  const baseUrl = window.EMBED_CONFIG?.baseUrl || (window.location.protocol + '//' + window.location.host);
  const isEmbedded = window.EMBED_CONFIG?.isEmbedded || false;

  // Store affiliate data globally for service area validation
  let affiliateData = null;

  // Function to show account conflict modal for existing affiliate accounts
  function showAccountConflictModal(result) {
    const affiliateData = result.affiliateData;
    const affiliateName = `${affiliateData.firstName} ${affiliateData.lastName}`;

    // Create modal HTML - using CSS classes instead of inline styles
    const modalHTML = `
      <div id="accountConflictModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 account-conflict-modal-overlay">
        <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl account-conflict-modal-content">
          <div class="text-center mb-6">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
              <svg class="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Account Conflict</h3>
            <p class="text-sm text-gray-500 mb-4">
              This Google account is already associated with an affiliate account for <strong>${affiliateName}</strong> (ID: <strong>${affiliateData.affiliateId}</strong>).
            </p>
            <p class="text-sm text-gray-500 mb-6">
              Would you like to login as an affiliate instead, or use a different account for customer registration?
            </p>
          </div>
          
          <div class="flex flex-col space-y-3">
            <button id="loginAsAffiliate" class="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Login as Affiliate
            </button>
            <button id="chooseAnotherAccount" class="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
              Use Different Account
            </button>
          </div>
        </div>
      </div>
    `;

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    document.getElementById('loginAsAffiliate').addEventListener('click', function() {
      console.log('User chose to login as affiliate');
      // Close modal
      document.getElementById('accountConflictModal').remove();

      // Navigate to affiliate login with the account already connected
      if (isEmbedded) {
        window.parent.postMessage({
          type: 'navigate',
          data: { url: '/affiliate-login' }
        }, '*');
      } else {
        window.location.href = '/embed-app-v2.html?route=/affiliate-login';
      }
    });

    document.getElementById('chooseAnotherAccount').addEventListener('click', function() {
      console.log('User chose to use different account');
      // Close modal and let user try another method
      document.getElementById('accountConflictModal').remove();

      // Show a message about using a different account
      modalAlert('Please try logging in with a different Google account or use the email/password registration method.', 'Account Already Exists');
    });

    // Close modal when clicking outside
    document.getElementById('accountConflictModal').addEventListener('click', function(e) {
      if (e.target === this) {
        this.remove();
      }
    });
  }

  // Generic function to show account conflict modal for any provider
  function showAccountConflictModal(conflictData) {
    console.log('Showing account conflict modal:', conflictData);
    
    const accountType = conflictData.accountType || 'affiliate';
    const provider = conflictData.provider || 'social media';
    const accountData = conflictData.affiliateData || conflictData.customerData || {};
    const accountName = accountData.businessName || `${accountData.firstName} ${accountData.lastName}`.trim() || 'Unknown';
    const accountId = accountData.affiliateId || accountData.customerId || '';
    
    // Check if we're in an embedded context
    const isEmbedded = window.parent !== window;
    
    // Create modal HTML
    const modalHTML = `
      <div id="accountConflictModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 account-conflict-modal-overlay">
        <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl account-conflict-modal-content">
          <div class="text-center mb-6">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
              <svg class="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Account Conflict</h3>
            <p class="text-sm text-gray-500 mb-4">
              This ${provider} account is already associated with an ${accountType} account${accountName ? ' for' : ''} <strong>${accountName}</strong>${accountId ? ` (ID: <strong>${accountId}</strong>)` : ''}.
            </p>
            <p class="text-sm text-gray-500 mb-6">
              Would you like to login as an ${accountType} instead, or use a different account for customer registration?
            </p>
          </div>
          
          <div class="flex flex-col space-y-3">
            <button id="loginAsOtherType" class="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Login as ${accountType.charAt(0).toUpperCase() + accountType.slice(1)}
            </button>
            <button id="chooseAnotherAccount" class="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
              Use Different Account
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listeners
    document.getElementById('loginAsOtherType').addEventListener('click', function() {
      console.log(`User chose to login as ${accountType}`);
      // Close modal
      document.getElementById('accountConflictModal').remove();
      
      // Navigate to appropriate login page
      const loginRoute = accountType === 'affiliate' ? '/affiliate-login' : '/customer-login';
      if (isEmbedded) {
        window.parent.postMessage({
          type: 'navigate',
          data: { url: loginRoute }
        }, '*');
      } else {
        window.location.href = `/embed-app-v2.html?route=${loginRoute}`;
      }
    });
    
    document.getElementById('chooseAnotherAccount').addEventListener('click', function() {
      console.log('User chose to use different account');
      // Close modal and let user try another method
      document.getElementById('accountConflictModal').remove();
      
      // Show a message about using a different account
      if (window.modalAlert) {
        window.modalAlert(`Please try logging in with a different ${provider} account or use the email/password registration method.`, 'Account Already Exists');
      }
    });
    
    // Close modal when clicking outside
    document.getElementById('accountConflictModal').addEventListener('click', function(e) {
      if (e.target === this) {
        this.remove();
      }
    });
  }

  // Function to initialize the registration form
  function initializeRegistrationForm() {
    console.log('Initializing registration form');

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

    // Extract affiliate ID from URL query parameter
    // When loaded via embed-app-v2.html, we need to check the actual page URL, not the base URL
    let urlParams = new URLSearchParams(window.location.search);
    let affiliateId = urlParams.get('affiliateId') || urlParams.get('affid') || urlParams.get('affiliate') || sessionStorage.getItem('affiliateId');

    console.log('Window location search:', window.location.search);
    console.log('Initial affiliate ID search:', affiliateId);

    if (!affiliateId && window.parent !== window) {
      try {
      // Try to get parent URL parameters
        const parentUrl = new URL(window.parent.location.href);
        const parentParams = new URLSearchParams(parentUrl.search);
        affiliateId = parentParams.get('affiliateId') || parentParams.get('affid') || parentParams.get('affiliate');
        console.log('Checking parent URL for affiliate ID:', affiliateId);
      } catch (e) {
        console.log('Cannot access parent URL (cross-origin), checking embed-app URL');
        // If cross-origin, try to parse the referrer or use the embed-app URL pattern
        if (document.referrer) {
          const referrerUrl = new URL(document.referrer);
          const referrerParams = new URLSearchParams(referrerUrl.search);
          affiliateId = referrerParams.get('affiliateId') || referrerParams.get('affid') || referrerParams.get('affiliate');
          console.log('Found affiliate ID in referrer:', affiliateId);
        }
      }
    }

    if (affiliateId) {
      console.log('Affiliate ID found:', affiliateId);

      // Set the hidden affiliate ID field
      const affiliateIdField = document.getElementById('affiliateId');
      if (affiliateIdField) {
        affiliateIdField.value = affiliateId;
        console.log('Set affiliate ID field to:', affiliateId);
      } else {
        console.error('affiliateId field not found');
      }

      // Also set the AFFILIATEID field for Paygistix component
      const affiliateIdUpperField = document.getElementById('AFFILIATEID');
      if (affiliateIdUpperField) {
        affiliateIdUpperField.value = affiliateId;
        console.log('Set AFFILIATEID field for Paygistix to:', affiliateId);
      }

      // Clear from session storage after use
      sessionStorage.removeItem('affiliateId');

      // Fetch affiliate info from the server
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      const apiUrl = `${baseUrl}/api/v1/affiliates/public/${affiliateId}`;
      console.log('Fetching affiliate info from:', apiUrl);

      fetch(apiUrl)
        .then(response => {
          console.log('Response status:', response.status);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log('Affiliate data received:', data);
          if (data.success) {
            const affiliate = data;  // The affiliate data is at the top level
            affiliateData = affiliate; // Store for service area validation
            window.affiliateData = affiliate; // Make available globally for payment registration

            const affiliateIntro = document.getElementById('affiliateIntro');
            if (affiliateIntro) {
              const name = affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`;
              affiliateIntro.textContent = `Sign up for premium laundry pickup and delivery service with ${name}.`;
            }

            // Set delivery fee based on affiliate's rate structure
            const deliveryFeeElement = document.getElementById('deliveryFee');
            const deliveryFeeStructureElement = document.getElementById('deliveryFeeStructure');

            if (deliveryFeeElement) {
            // Check if affiliate has new fee structure
              if (affiliate.minimumDeliveryFee !== null && affiliate.perBagDeliveryFee !== null) {
              // Use new fee structure
                const minFee = parseFloat(affiliate.minimumDeliveryFee);
                const perBagFee = parseFloat(affiliate.perBagDeliveryFee);

                // Show minimum fee as the base rate
                if (window.i18next && window.i18next.isInitialized) {
                  deliveryFeeElement.textContent = window.i18next.t('customer.register.pricing.startingAt', { price: minFee.toFixed(2) });
                } else {
                  deliveryFeeElement.textContent = `Starting at $${minFee.toFixed(2)}`;
                }

                if (deliveryFeeStructureElement) {
                  if (window.i18next && window.i18next.isInitialized) {
                    deliveryFeeStructureElement.textContent = window.i18next.t('customer.register.pricing.feeStructure', { 
                      minFee: minFee.toFixed(2), 
                      perBagFee: perBagFee.toFixed(2) 
                    });
                  } else {
                    deliveryFeeStructureElement.textContent = `(Min: $${minFee.toFixed(2)}, then $${perBagFee.toFixed(2)}/bag)`;
                  }
                }

                console.log('Affiliate uses new fee structure:', { minFee, perBagFee });
              } else {
              // No fee structure found - shouldn't happen with updated model
                console.error('No fee structure found for affiliate');
                deliveryFeeElement.textContent = 'Contact for pricing';

                if (deliveryFeeStructureElement) {
                  deliveryFeeStructureElement.textContent = '';
                }
              }
            } else {
              console.error('deliveryFee element not found');
            }
          } else {
            console.error('Invalid affiliate data:', data);
            modalAlert('Invalid affiliate ID. Please use a valid registration link.', 'Invalid Affiliate');
            // Don't redirect - let the user stay on the registration page
          }
        })
        .catch(error => {
          console.error('Error fetching affiliate info:', error);
          modalAlert('Unable to load affiliate information. Please try again.', 'Loading Error');
          // Don't redirect - let the user stay on the registration page
        });

      // Fetch WDF rate from system configuration
      fetch(`${baseUrl}/api/v1/system/config/public`)
        .then(response => response.json())
        .then(configs => {
          const wdfConfig = configs.find(c => c.key === 'wdf_base_rate_per_pound');
          if (wdfConfig && wdfConfig.currentValue) {
            const wdfRateDisplay = document.getElementById('wdfRateDisplay');
            if (wdfRateDisplay) {
              if (window.i18next && window.i18next.isInitialized) {
                wdfRateDisplay.textContent = window.i18next.t('customer.register.pricing.wdfRate', { 
                  rate: wdfConfig.currentValue.toFixed(2) 
                });
              } else {
                wdfRateDisplay.textContent = `$${wdfConfig.currentValue.toFixed(2)}/lb (includes service fees)`;
              }
            }
          }
        })
        .catch(error => {
          console.error('Error fetching WDF rate:', error);
        // Keep the placeholder text if fetch fails
        });
    } else {
    // Redirect if no affiliate ID is provided
      modalAlert('No affiliate ID provided. Please use a valid registration link.', 'Missing Affiliate ID');
      window.location.href = '/embed-app-v2.html?login=customer';
    }


    // Password validation function
    function validatePassword() {
      const passwordField = document.getElementById('password');
      const confirmPasswordField = document.getElementById('confirmPassword');
      const password = passwordField.value;
      const confirmPassword = confirmPasswordField.value;
      const username = document.getElementById('username').value;
      const email = document.getElementById('email').value;

      // Check requirements
      const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
        match: password !== '' && password === confirmPassword
      };

      // Check if password contains username or email
      const containsUsername = username && password.toLowerCase().includes(username.toLowerCase());
      const containsEmailUser = email && password.toLowerCase().includes(email.split('@')[0].toLowerCase());

      // Update requirement indicators
      function updateReq(id, met) {
        const element = document.getElementById(id);
        if (element) {
          const indicator = element.querySelector('span:first-child');
          if (indicator) {
            indicator.textContent = met ? '✅' : '⚪';
          }
          element.classList.toggle('text-green-700', met);
          element.classList.toggle('text-gray-600', !met);
        }
      }

      updateReq('req-length', requirements.length);
      updateReq('req-uppercase', requirements.uppercase);
      updateReq('req-lowercase', requirements.lowercase);
      updateReq('req-number', requirements.number);
      updateReq('req-special', requirements.special);
      updateReq('req-match', requirements.match);

      // Check if all requirements are met
      const allRequirementsMet = requirements.length && requirements.uppercase && requirements.lowercase &&
                               requirements.number && requirements.special && requirements.match &&
                               !containsUsername && !containsEmailUser;

      // Update field borders based on password state
      if (password.length > 0) {
        if (allRequirementsMet) {
        // All requirements met - turn both fields green
          passwordField.classList.remove('border-red-500');
          passwordField.classList.add('border-green-500');
          confirmPasswordField.classList.remove('border-red-500');
          confirmPasswordField.classList.add('border-green-500');
        } else {
        // Requirements not met - turn both fields red
          passwordField.classList.remove('border-green-500');
          passwordField.classList.add('border-red-500');
          confirmPasswordField.classList.remove('border-green-500');
          confirmPasswordField.classList.add('border-red-500');
        }
      } else {
      // No password entered - remove all border colors
        passwordField.classList.remove('border-red-500', 'border-green-500');
        confirmPasswordField.classList.remove('border-red-500', 'border-green-500');
      }

      // Update strength indicator
      const strengthElement = document.getElementById('passwordStrength');
      if (strengthElement) {
        if (password.length === 0) {
          strengthElement.innerHTML = '';
        } else if (allRequirementsMet) {
          strengthElement.innerHTML = '<span class="text-green-600 font-medium">✅ Strong password</span>';
        } else {
          const missing = [];
          if (!requirements.length) missing.push('8+ characters');
          if (!requirements.uppercase) missing.push('uppercase letter');
          if (!requirements.lowercase) missing.push('lowercase letter');
          if (!requirements.number) missing.push('number');
          if (!requirements.special) missing.push('special character');
          if (!requirements.match) missing.push('passwords must match');
          if (containsUsername || containsEmailUser) missing.push('cannot contain username/email');

          strengthElement.innerHTML = `<span class="text-red-600">❌ Missing: ${missing.join(', ')}</span>`;
        }
      }

      // Return true if all password strength requirements are met
      return allRequirementsMet;
    }

    // Email validation function
    async function validateEmail() {
      const emailField = document.getElementById('email');
      const emailHelp = emailField.parentElement.querySelector('.text-xs') ||
                     createEmailHelpText(emailField);

      if (!emailField.value || emailField.value.trim() === '') {
      // Reset to default state if empty
        emailField.classList.remove('border-red-500', 'border-green-500');
        emailHelp.textContent = '';
        emailHelp.classList.remove('text-red-600', 'text-green-600');
        return;
      }

      // Basic email format validation
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(emailField.value.trim())) {
        emailField.classList.add('border-red-500');
        emailField.classList.remove('border-green-500');
        emailHelp.textContent = '❌ Invalid email format';
        emailHelp.classList.add('text-red-600');
        emailHelp.classList.remove('text-green-600', 'text-gray-500');
        return;
      }

      console.log('Checking email availability for:', emailField.value.trim());

      try {
        const response = await fetch(`${baseUrl}/api/v1/auth/check-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email: emailField.value.trim() })
        });

        console.log('Email check response:', response.status, response.statusText);

        const data = await response.json();
        console.log('Email check data:', data);

        if (data.success && data.available) {
        // Email is available
          emailField.classList.remove('border-red-500');
          emailField.classList.add('border-green-500');
          emailHelp.textContent = '✅ Email available';
          emailHelp.classList.remove('text-red-600', 'text-gray-500');
          emailHelp.classList.add('text-green-600');
        } else {
        // Email is taken
          emailField.classList.remove('border-green-500');
          emailField.classList.add('border-red-500');
          emailHelp.textContent = '❌ Email already in use';
          emailHelp.classList.remove('text-gray-500', 'text-green-600');
          emailHelp.classList.add('text-red-600');
        }
      } catch (error) {
        console.error('Error checking email:', error);
        // On error, just validate format
        emailField.classList.remove('border-red-500', 'border-green-500');
        emailHelp.textContent = '';
        emailHelp.classList.remove('text-red-600', 'text-green-600');
      }
    }

    // Helper function to create email help text if it doesn't exist
    function createEmailHelpText(emailField) {
      const helpText = document.createElement('p');
      helpText.className = 'text-xs mt-1';
      emailField.parentElement.appendChild(helpText);
      return helpText;
    }

    // Address validation spinner instance
    let addressValidationSpinner = null;


    // Service area validation function
    async function validateServiceArea() {
      const address = document.getElementById('address').value.trim();
      const city = document.getElementById('city').value.trim();
      const state = document.getElementById('state').value.trim();
      const zipCode = document.getElementById('zipCode').value.trim();

      if (!address || !city || !state || !zipCode) {
        return false; // Not all fields filled
      }

      if (!affiliateData || !affiliateData.serviceLatitude || !affiliateData.serviceLongitude || !affiliateData.serviceRadius) {
        console.error('Missing affiliate service area data');
        return true; // Allow to proceed if we can't validate
      }

      const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
      console.log('Validating service area for address:', fullAddress);

      // Show spinner using SwirlSpinner
      console.log('SwirlSpinner available:', !!window.SwirlSpinner);
      console.log('SwirlSpinnerUtils available:', !!window.SwirlSpinnerUtils);

      if (window.SwirlSpinner || window.SwirlSpinnerUtils) {
      // Find the form to overlay
        const form = document.getElementById('customerRegistrationForm');

        // The swirl spinner will track disabled states internally

        if (form && window.SwirlSpinnerUtils) {
        // Use the utility function to show spinner on form
          addressValidationSpinner = window.SwirlSpinnerUtils.showOnForm(form, {
            message: 'Validating address...',
            submessage: 'Checking if your address is within our service area'
          });
        } else if (form && window.SwirlSpinner) {
        // Create spinner manually on the form
          addressValidationSpinner = new window.SwirlSpinner({
            container: form,
            size: 'large',
            overlay: true,
            message: 'Validating address...'
          });
          addressValidationSpinner.show();

          // Add submessage
          const spinnerWrapper = form.querySelector('.swirl-spinner-wrapper');
          if (spinnerWrapper) {
            const submessage = document.createElement('p');
            submessage.style.cssText = 'color: #6b7280; margin-top: 5px; font-size: 14px;';
            submessage.textContent = 'Checking if your address is within our service area';
            spinnerWrapper.appendChild(submessage);
          }
        }
      } else if (window.SwirlSpinnerUtils) {
        addressValidationSpinner = window.SwirlSpinnerUtils.showGlobal({
          message: 'Validating address...',
          submessage: 'Checking if your address is within our service area'
        });
      } else {
      // Fallback: show a basic loading indicator
        console.warn('SwirlSpinnerUtils not available, using fallback');
        const spinnerHTML = `
        <div id="addressValidationSpinner" class="address-validation-overlay">
          <div class="address-validation-content">
            <div class="address-validation-spinner"></div>
            <h3 class="address-validation-title">Validating Address</h3>
            <p class="address-validation-message">Checking if your address is within our service area...</p>
          </div>
        </div>
      `;
        document.body.insertAdjacentHTML('beforeend', spinnerHTML);
      }

      try {
        // Use the unified address validation service to validate address
        const baseUrl = window.EMBED_CONFIG?.baseUrl || '';
        let csrfToken = window.csrfToken;
        if (!csrfToken) {
          const csrfMeta = document.querySelector('meta[name="csrf-token"]');
          if (csrfMeta) {
            csrfToken = csrfMeta.getAttribute('content');
          }
        }
        
        const response = await fetch(`${baseUrl}/api/v1/service-area/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || ''
          },
          credentials: 'include',
          body: JSON.stringify({ address, city, state, zipCode })
        });

        const result = await response.json();

        if (!result.success || !result.coordinates) {
          console.error('Address validation failed:', result.message);
          // Hide spinner
          if (addressValidationSpinner) {
            addressValidationSpinner.hide();
            addressValidationSpinner = null;
          } else {
            const fallbackSpinner = document.getElementById('addressValidationSpinner');
            if (fallbackSpinner) {
              fallbackSpinner.remove();
            }
          }
          
          // Show error message
          const message = result.message || 'Unable to verify this address. Please check that the street address and zip code are correct.';
          alert(message);
          
          return false;
        }

        const customerLat = result.coordinates.latitude;
        const customerLon = result.coordinates.longitude;

        console.log('Geocoding successful:', {
          lat: customerLat,
          lon: customerLon,
          formattedAddress: result.formattedAddress
        });

        // Calculate distance using Haversine formula
        const distance = calculateDistance(
          affiliateData.serviceLatitude,
          affiliateData.serviceLongitude,
          customerLat,
          customerLon
        );

        console.log('Distance from affiliate:', distance, 'miles');
        console.log('Service radius:', affiliateData.serviceRadius, 'miles');

        if (distance > affiliateData.serviceRadius) {
        // Outside service area
          if (addressValidationSpinner) {
            addressValidationSpinner.hide();
            addressValidationSpinner = null;
          } else {
          // Remove fallback spinner
            const fallbackSpinner = document.getElementById('addressValidationSpinner');
            if (fallbackSpinner) {
              fallbackSpinner.remove();
            }
          }

          // Swirl spinner handles re-enabling

          modalAlert(
            `Unfortunately, this address is outside the service area. The service area extends ${affiliateData.serviceRadius} miles from the affiliate location, and this address is ${distance.toFixed(1)} miles away.`,
            'Outside Service Area'
          );

          // Clear only the street address field - keep city, state, and zip
          // so the user can try a different address in the same area
          document.getElementById('address').value = '';

          return false;
        }

        if (addressValidationSpinner) {
          addressValidationSpinner.hide();
          addressValidationSpinner = null;
        } else {
        // Remove fallback spinner
          const fallbackSpinner = document.getElementById('addressValidationSpinner');
          if (fallbackSpinner) {
            fallbackSpinner.remove();
          }
        }

        // The swirl-spinner.js now handles re-enabling form controls
        // Just add a small delay to ensure spinner cleanup is complete
        setTimeout(() => {
          console.log('Address validation complete');
        }, 100);

        return true; // Within service area

      } catch (error) {
        console.error('Service area validation error:', error);
        if (addressValidationSpinner) {
          addressValidationSpinner.hide();
          addressValidationSpinner = null;
        } else {
        // Remove fallback spinner
          const fallbackSpinner = document.getElementById('addressValidationSpinner');
          if (fallbackSpinner) {
            fallbackSpinner.remove();
          }
        }
        return true; // Allow to proceed if validation fails
      }
    }

    // Calculate distance between two coordinates using Haversine formula
    function calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 3959; // Radius of Earth in miles
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    function toRad(deg) {
      return deg * (Math.PI/180);
    }

    // Make validateServiceArea available globally for navigation
    window.validateServiceArea = validateServiceArea;

    // Debug swirl spinner availability
    console.log('Customer register loaded, SwirlSpinnerUtils:', !!window.SwirlSpinnerUtils);

    // Check again after a delay
    setTimeout(() => {
      console.log('After delay, SwirlSpinnerUtils:', !!window.SwirlSpinnerUtils);
    }, 1000);

    // Username validation function
    async function validateUsername() {
      const usernameField = document.getElementById('username');
      const usernameHelp = usernameField.nextElementSibling; // The help text element

      if (!usernameField.value || usernameField.value.trim() === '') {
      // Reset to default state if empty
        usernameField.classList.remove('border-red-500', 'border-green-500');
        if (usernameHelp) {
          usernameHelp.textContent = 'Your unique login identifier';
          usernameHelp.classList.remove('text-red-600', 'text-green-600');
          usernameHelp.classList.add('text-gray-500');
        }
        return;
      }

      console.log('Checking username availability for:', usernameField.value.trim());

      try {
        const response = await fetch(`${baseUrl}/api/v1/auth/check-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: usernameField.value.trim() })
        });

        console.log('Username check response:', response.status, response.statusText);

        const data = await response.json();
        console.log('Username check data:', data);

        if (data.success && data.available) {
        // Username is available
          usernameField.classList.remove('border-red-500');
          usernameField.classList.add('border-green-500');
          if (usernameHelp) {
            usernameHelp.textContent = '✅ Username available';
            usernameHelp.classList.remove('text-red-600', 'text-gray-500');
            usernameHelp.classList.add('text-green-600');
          }
        } else {
        // Username is taken
          usernameField.classList.remove('border-green-500');
          usernameField.classList.add('border-red-500');
          if (usernameHelp) {
            usernameHelp.textContent = '❌ Username unavailable';
            usernameHelp.classList.remove('text-gray-500', 'text-green-600');
            usernameHelp.classList.add('text-red-600');
          }
        }
      } catch (error) {
        console.error('Error checking username:', error);
        // On error, reset to neutral state
        usernameField.classList.remove('border-red-500', 'border-green-500');
        if (usernameHelp) {
          usernameHelp.textContent = 'Your unique login identifier';
          usernameHelp.classList.remove('text-red-600', 'text-green-600');
          usernameHelp.classList.add('text-gray-500');
        }
      }
    }

    // Add password validation event listeners
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');

    if (passwordInput) {
      passwordInput.addEventListener('input', validatePassword);
      passwordInput.addEventListener('focus', validatePassword);
    }
    if (confirmPasswordInput) {
      confirmPasswordInput.addEventListener('input', validatePassword);
    }
    if (usernameInput) {
      usernameInput.addEventListener('input', validatePassword);
      // Add username validation on blur
      usernameInput.addEventListener('blur', validateUsername);
      // Reset on input change
      usernameInput.addEventListener('input', function() {
        const usernameHelp = this.nextElementSibling;
        this.classList.remove('border-red-500', 'border-green-500');
        if (usernameHelp) {
          usernameHelp.textContent = 'Your unique login identifier';
          usernameHelp.classList.remove('text-red-600', 'text-green-600');
          usernameHelp.classList.add('text-gray-500');
        }
      });
    }
    if (emailInput) {
      emailInput.addEventListener('input', validatePassword);
      // Add email validation on blur
      emailInput.addEventListener('blur', validateEmail);
      // Reset on input change
      emailInput.addEventListener('input', function() {
        const emailHelp = this.parentElement.querySelector('.text-xs');
        if (emailHelp && emailHelp.textContent.includes('❌')) {
          this.classList.remove('border-red-500', 'border-green-500');
          emailHelp.textContent = '';
          emailHelp.classList.remove('text-red-600', 'text-green-600');
        }
      });
    }

    // Form submission is handled by Paygistix payment integration
    // The submit button handler is defined in the inline script in customer-register-embed.html

    // Payment field formatting removed - using Paygistix payment form instead

    // Handle bag selection
    let bagFee = 10.00; // Default bag fee, will be updated from server
    const numberOfBagsSelect = document.getElementById('numberOfBags');
    const totalBagFeeDisplay = document.getElementById('totalBagFee');
    const bagFeeSummary = document.getElementById('bagFeeSummary');
    const bagFeeSummaryAmount = document.getElementById('bagFeeSummaryAmount');

    // Initialize bag fee summary visibility to prevent layout shifts
    if (bagFeeSummary) {
      bagFeeSummary.style.visibility = 'hidden';
      bagFeeSummary.style.height = '0';
      bagFeeSummary.style.transition = 'visibility 0.3s, height 0.3s';
      bagFeeSummary.style.overflow = 'hidden';
    }

    // Fetch bag fee from system configuration
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    fetch(`${baseUrl}/api/v1/system/config/public`)
      .then(response => response.json())
      .then(configs => {
        const bagFeeConfig = configs.find(c => c.key === 'laundry_bag_fee');
        if (bagFeeConfig && bagFeeConfig.currentValue) {
          bagFee = parseFloat(bagFeeConfig.currentValue);
          // Update all bag fee displays
          const bagFeeDisplay = document.getElementById('bagFeeDisplay');
          if (bagFeeDisplay) {
            bagFeeDisplay.textContent = `$${bagFee.toFixed(2)}`;
          }
          // Update select options
          for (let i = 1; i <= 5; i++) {
            const option = numberOfBagsSelect.querySelector(`option[value="${i}"]`);
            if (option) {
              option.textContent = `${i} bag${i > 1 ? 's' : ''} - $${(i * bagFee).toFixed(2)}`;
            }
          }
        }
      })
      .catch(error => {
        console.error('Error fetching bag fee:', error);
      // Keep using default fee
      });

    // Function to sync bag quantity with payment form
    function syncBagQuantityToPaymentForm() {
      const numberOfBags = parseInt(numberOfBagsSelect.value) || 0;
      const bfQtyInput = document.getElementById('pxQty2'); // BF (Bag Fee) is pxQty2, not pxQty10
      if (bfQtyInput) {
        bfQtyInput.value = numberOfBags;
        // Trigger the blur event to update the form's total
        bfQtyInput.dispatchEvent(new Event('blur'));
        // Also trigger any formatQty function if it exists
        if (window.formatQty) {
          window.formatQty(bfQtyInput);
        }
      }
    }

    numberOfBagsSelect.addEventListener('change', function() {
      const numberOfBags = parseInt(this.value) || 0;
      const total = numberOfBags * bagFee;

      totalBagFeeDisplay.textContent = `$${total.toFixed(2)}`;
      bagFeeSummaryAmount.textContent = `$${total.toFixed(2)}`;

      // Use visibility instead of display to prevent layout reflows
      if (numberOfBags > 0) {
        bagFeeSummary.style.visibility = 'visible';
        bagFeeSummary.style.height = 'auto';
      } else {
        bagFeeSummary.style.visibility = 'hidden';
        bagFeeSummary.style.height = '0';
      }

      // Update the Paygistix payment form BF quantity
      syncBagQuantityToPaymentForm();
    });

    // Social registration button handlers
    const googleRegister = document.getElementById('googleRegister');
    const facebookRegister = document.getElementById('facebookRegister');

    // Shared validation function for both OAuth and form submission
    function validateFormFields(isSocialRegistration = false) {
      const requiredFields = [];

      // Personal information always required (OAuth pre-fills these but validation still checks)
      requiredFields.push(
        { id: 'firstName', name: 'First Name' },
        { id: 'lastName', name: 'Last Name' },
        { id: 'email', name: 'Email' }
      );

      // Common required fields for all registrations
      requiredFields.push(
        { id: 'affiliateId', name: 'Affiliate ID' },
        { id: 'phone', name: 'Phone Number' },
        { id: 'address', name: 'Address' },
        { id: 'city', name: 'City' },
        { id: 'state', name: 'State' },
        { id: 'zipCode', name: 'ZIP Code' },
        { id: 'numberOfBags', name: 'Number of Bags' }
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

      return missingFields;
    }

    function handleSocialAuth(provider) {
    // No validation required before OAuth - the point is to authenticate first and auto-populate the form
      console.log(`🚀 Starting ${provider} OAuth authentication...`);

      // For embedded context, use popup window to avoid iframe restrictions
      if (isEmbedded || window.self !== window.top) {
      // Generate unique session ID for database polling
        const sessionId = 'oauth_' + Date.now() + '_' + Math.random().toString(36).substring(2);
        console.log('Generated Customer OAuth session ID:', sessionId);

        const oauthUrl = `${baseUrl}/api/v1/auth/customer/${provider}?popup=true&state=${sessionId}&t=${Date.now()}`;
        console.log('🔗 Opening Customer OAuth URL:', oauthUrl);

        const popup = window.open(
          oauthUrl,
          'customerSocialAuth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        console.log('Customer popup opened:', {
          'popup exists': !!popup,
          'popup.closed': popup ? popup.closed : 'N/A',
          'popup type': typeof popup,
          'popup URL': oauthUrl
        });

        if (!popup || popup.closed) {
          modalAlert('Popup was blocked. Please allow popups for this site and try again.', 'Popup Blocked');
          return;
        }

        // Database polling approach (more reliable than postMessage)
        let pollCount = 0;
        const maxPolls = 120; // 6 minutes max (120 * 3 seconds)
        let authResultReceived = false;

        console.log('Starting database polling for Customer OAuth result...');

        const pollForResult = setInterval(async () => {
          pollCount++;

          try {
          // Check if popup is closed
            if (popup.closed) {
              console.log('Customer popup closed, continuing to poll for result...');
            }

            // Poll the database for result
            const response = await csrfFetch(`${baseUrl}/api/v1/auth/oauth-session/${sessionId}`);

            console.log('🔍 Customer polling response:', {
              ok: response.ok,
              status: response.status,
              statusText: response.statusText
            });

            if (response.ok) {
              const data = await response.json();
              console.log('📊 Customer response data:', data);
              if (data.success && data.result) {
                console.log('📨 Customer OAuth result received from database:', data.result);
                authResultReceived = true;
                clearInterval(pollForResult);

                if (popup && !popup.closed) {
                  popup.close();
                }

                // Handle the result
                try {
                  if (data.result.type === 'social-auth-success') {
                    console.log('Processing customer social-auth-success from database');
                    console.log('Calling showCustomerSocialRegistrationCompletion with:', {
                      socialToken: data.result.socialToken,
                      provider: data.result.provider
                    });
                    showCustomerSocialRegistrationCompletion(data.result.socialToken, data.result.provider);
                  } else if (data.result.type === 'social-auth-login') {
                    console.log('Processing customer social-auth-login from database');
                    // Customer already exists and is now logged in - redirect to dashboard
                    if (isEmbedded) {
                      window.parent.postMessage({
                        type: 'navigate',
                        data: { url: `/customer-dashboard?token=${data.result.token}&refreshToken=${data.result.refreshToken}` }
                      }, '*');
                    } else {
                      window.location.href = `/embed-app-v2.html?route=/customer-dashboard&token=${data.result.token}&refreshToken=${data.result.refreshToken}`;
                    }
                  } else if (data.result.type === 'social-auth-account-conflict') {
                    console.log('Processing customer social-auth-account-conflict from database');
                    showAccountConflictModal(data.result);
                  } else if (data.result.type === 'social-auth-error') {
                    console.log('Processing customer social-auth-error from database');
                    modalAlert(data.result.message || 'Social authentication failed', 'Authentication Failed');
                  } else {
                    console.log('Unknown customer result type:', data.result.type);
                  }
                } catch (resultError) {
                  console.error('Error processing Customer OAuth result:', resultError);
                  modalAlert('Error processing authentication result', 'Processing Error');
                }
                return;
              }
            }

            // Check for timeout
            if (pollCount > maxPolls) {
              console.log('Customer database polling timeout exceeded');
              clearInterval(pollForResult);
              if (popup && !popup.closed) {
                popup.close();
              }
              modalAlert('Authentication timed out. Please try again.', 'Authentication Timeout');
              return;
            }

            // Log progress every 5 polls (15 seconds)
            if (pollCount % 5 === 0) {
              console.log(`🔄 Polling for Customer OAuth result... (${pollCount}/${maxPolls})`);
            }

          } catch (error) {
          // 404 means no result yet, continue polling
            if (error.message && error.message.includes('404')) {
            // Result not ready yet, continue polling
              return;
            }

            console.error('Error polling for Customer OAuth result:', error);

            // Don't stop polling for network errors, just log them
            if (pollCount % 10 === 0) {
              console.log('Network error during Customer polling, continuing...');
            }
          }
        }, 3000); // Poll every 3 seconds
      } else {
      // For non-embedded context, use direct navigation
        window.location.href = `${baseUrl}/api/v1/auth/customer/${provider}`;
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

    // Handle customer social registration completion
    function handleCustomerSocialRegistrationCallback() {
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
        modalAlert(errorMessage, 'Error');
        return;
      }

      if (socialToken && provider) {
      // Pre-fill form with social data and show completion section
        showCustomerSocialRegistrationCompletion(socialToken, provider);
      }
    }

    function showCustomerSocialRegistrationCompletion(socialToken, provider) {
      console.log('🎨 Showing customer social registration completion for provider:', provider);

      // Update the social auth section to show connected status
      const socialAuthSection = document.getElementById('socialAuthSection');
      console.log('🔍 Found customer social auth section:', socialAuthSection);

      if (socialAuthSection) {
        console.log('✅ Updating customer social auth section with success message');
        socialAuthSection.innerHTML = `
        <h3 class="text-xl font-bold mb-4" data-i18n="customer.register.socialAccountConnected">Social Media Account Connected!</h3>
        <div class="bg-green-50 border border-green-200 rounded-lg p-6">
          <div class="flex items-center justify-center">
            <svg class="w-8 h-8 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <div>
              <h4 class="text-green-700 font-semibold text-lg" data-i18n="customer.register.successfullyConnectedWith" data-i18n-options='{"provider": "${provider.charAt(0).toUpperCase() + provider.slice(1)}"}'>Successfully Connected with ${provider.charAt(0).toUpperCase() + provider.slice(1)}</h4>
              <p class="text-green-600 text-sm mt-1" data-i18n="customer.register.autoFilledMessage">Your information has been automatically filled in below. Complete the remaining fields to finish your registration.</p>
            </div>
          </div>
        </div>
      `;

        // Trigger i18n update for the new content
        if (window.i18next && window.i18next.isInitialized) {
          window.i18n.updateContent();
        }
      }

      // Hide the account setup section since OAuth handles authentication
      const accountSetupSection = document.getElementById('accountSetupSection');
      if (accountSetupSection) {
        accountSetupSection.style.display = 'none';
        console.log('✅ Hidden customer account setup section for OAuth user');

        // Remove required attributes from username/password fields since they're hidden
        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');
        const confirmPasswordField = document.getElementById('confirmPassword');

        if (usernameField) usernameField.removeAttribute('required');
        if (passwordField) passwordField.removeAttribute('required');
        if (confirmPasswordField) confirmPasswordField.removeAttribute('required');
      }

      // Store social token for form submission
      const form = document.getElementById('customerRegistrationForm');
      console.log('📝 Found customer form:', form ? 'Yes' : 'No');
      if (form) {
        const socialTokenInput = document.createElement('input');
        socialTokenInput.type = 'hidden';
        socialTokenInput.name = 'socialToken';
        socialTokenInput.value = socialToken;
        form.appendChild(socialTokenInput);
        console.log('✅ Added social token to customer form');
      }

      // Auto-populate form fields from social token (decode JWT payload)
      try {
        const payload = JSON.parse(atob(socialToken.split('.')[1]));
        console.log('🔓 Decoded customer social token payload:', payload);

        // Auto-fill personal information
        if (payload.firstName) {
          const firstNameField = document.getElementById('firstName');
          if (firstNameField && !firstNameField.value) {
            firstNameField.value = payload.firstName;
            firstNameField.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
            console.log('✅ Pre-filled customer firstName:', payload.firstName);
          }
        }

        if (payload.lastName) {
          const lastNameField = document.getElementById('lastName');
          if (lastNameField && !lastNameField.value) {
            lastNameField.value = payload.lastName;
            lastNameField.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
            console.log('✅ Pre-filled customer lastName:', payload.lastName);
          }
        }

        if (payload.email) {
          const emailField = document.getElementById('email');
          if (emailField && !emailField.value) {
            emailField.value = payload.email;
            emailField.readOnly = true; // Make it read-only since it comes from OAuth
            emailField.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
            console.log('✅ Pre-filled customer email:', payload.email);
          }
        }

      } catch (e) {
        console.log('Could not decode customer social token for pre-filling:', e);
      }
    }

    // Check for customer social registration callback on page load
    handleCustomerSocialRegistrationCallback();

    // Sync bag quantity after payment form loads
    // Wait a bit to ensure the Paygistix payment form is rendered
    setTimeout(() => {
      syncBagQuantityToPaymentForm();
    }, 1000);

  }

  // Check if DOM is already loaded or wait for it
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRegistrationForm);
  } else {
    // DOM is already loaded, initialize immediately
    initializeRegistrationForm();
  }

})(); // End IIFE