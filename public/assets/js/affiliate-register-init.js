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

  if (googleRegister) {
    googleRegister.addEventListener('click', function() {
      window.location.href = `${baseUrl}/api/v1/auth/google`;
    });
  }

  if (facebookRegister) {
    facebookRegister.addEventListener('click', function() {
      window.location.href = `${baseUrl}/api/v1/auth/facebook`;
    });
  }

  if (linkedinRegister) {
    linkedinRegister.addEventListener('click', function() {
      window.location.href = `${baseUrl}/api/v1/auth/linkedin`;
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
    // Hide social buttons and show completion message
    const socialSection = document.querySelector('[class*="Quick Registration"]')?.parentElement;
    if (socialSection) {
      socialSection.innerHTML = `
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <span class="text-green-700 font-medium">Connected with ${provider.charAt(0).toUpperCase() + provider.slice(1)}</span>
          </div>
          <p class="text-green-600 text-sm mt-1">Please complete the remaining fields below to finish your registration.</p>
        </div>
      `;
    }

    // Store social token for form submission
    const form = document.getElementById('affiliateRegistrationForm');
    if (form) {
      const socialTokenInput = document.createElement('input');
      socialTokenInput.type = 'hidden';
      socialTokenInput.name = 'socialToken';
      socialTokenInput.value = socialToken;
      form.appendChild(socialTokenInput);
    }
  }

  // Password strength validation
  function validatePasswordStrength(password, username = '', email = '') {
    const requirements = {
      length: password.length >= 12,
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

    // Update strength indicator
    const strengthElement = document.getElementById('passwordStrength');
    if (strengthElement) {
      if (password.length === 0) {
        strengthElement.innerHTML = '';
      } else if (validation.isValid) {
        strengthElement.innerHTML = '<span class="text-green-600 font-medium">✅ Strong password</span>';
      } else {
        const missing = [];
        if (!requirements.length) missing.push('12+ characters');
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

  // Check for social registration callback on page load
  handleSocialRegistrationCallback();

  // Form validation and submission
  const form = document.getElementById('affiliateRegistrationForm');

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      try {
        // Check if passwords match
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
          window.ErrorHandler.showError('Passwords do not match!');
          return;
        }

        // Collect form data
        const formData = new FormData(form);
        const affiliateData = {};

        formData.forEach((value, key) => {
          affiliateData[key] = value;
        });

        // Determine if this is a social registration
        const isSocialRegistration = affiliateData.socialToken;
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
}

// Initialize immediately when script loads
initializeAffiliateRegistration();

})(); // End IIFE