(function() {
  'use strict';

  // Define the steps and their sections
  const steps = [
    {
      name: 'Social and Account',
      sections: ['socialAuthSection', 'accountSetupSection'],
      validate: async function() {
        // Validate account setup if not using OAuth
        if (!document.getElementById('accountSetupSection').style.display ||
                    document.getElementById('accountSetupSection').style.display !== 'none') {
          const username = document.getElementById('username');
          const password = document.getElementById('password');
          const confirmPassword = document.getElementById('confirmPassword');

          if (!username.value || !password.value || !confirmPassword.value) {
            if (window.modalAlert) {
              window.modalAlert('Please fill in all account setup fields.', 'Required Fields');
            } else {
              alert('Please fill in all account setup fields.');
            }
            return false;
          }

          if (password.value !== confirmPassword.value) {
            if (window.modalAlert) {
              window.modalAlert('Passwords do not match.', 'Password Error');
            } else {
              alert('Passwords do not match.');
            }
            return false;
          }

          // Validate password against all requirements
          const passwordValue = password.value;
          const usernameValue = username.value.toLowerCase();
          const passwordErrors = [];

          // Check minimum length
          if (passwordValue.length < 8) {
            passwordErrors.push('Password must be at least 8 characters long');
          }

          // Check for uppercase letters
          if (!/[A-Z]/.test(passwordValue)) {
            passwordErrors.push('Password must contain at least one uppercase letter');
          }

          // Check for lowercase letters
          if (!/[a-z]/.test(passwordValue)) {
            passwordErrors.push('Password must contain at least one lowercase letter');
          }

          // Check for numbers
          if (!/\d/.test(passwordValue)) {
            passwordErrors.push('Password must contain at least one number');
          }

          // Check for special characters
          if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(passwordValue)) {
            passwordErrors.push('Password must contain at least one special character');
          }

          // Check if password contains username
          if (usernameValue && passwordValue.toLowerCase().includes(usernameValue)) {
            passwordErrors.push('Password cannot contain your username');
          }

          // Check for sequential characters
          const hasSequential = (() => {
            const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
            for (const seq of sequences) {
              for (let i = 0; i <= seq.length - 3; i++) {
                if (passwordValue.includes(seq.substring(i, i + 3))) {
                  return true;
                }
              }
            }
            return false;
          })();

          if (hasSequential) {
            passwordErrors.push('Password cannot contain sequential characters (e.g., 123, abc)');
          }

          // Check for repeated characters (more than 2 in a row)
          if (/(.)\1{2,}/.test(passwordValue)) {
            passwordErrors.push('Password cannot have more than 2 consecutive identical characters');
          }

          // If there are any password errors, show them and stop
          if (passwordErrors.length > 0) {
            const errorMessage = passwordErrors.length === 1
              ? passwordErrors[0]
              : 'Please fix the following password issues:\n• ' + passwordErrors.join('\n• ');

            if (window.modalAlert) {
              window.modalAlert(errorMessage, 'Password Requirements Not Met');
            } else {
              alert(errorMessage);
            }
            password.focus();
            return false;
          }

          // Check if username is available (red border means taken)
          if (username.classList.contains('border-red-500')) {
            if (window.modalAlert) {
              window.modalAlert('Username is not available. Please choose a different username.', 'Username Taken');
            } else {
              alert('Username is not available. Please choose a different username.');
            }
            username.focus();
            return false;
          }
        }
        return true;
      }
    },
    {
      name: 'Personal and Address',
      sections: ['personalInfoSection', 'addressInfoSection'],
      validate: async function() {
        const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode'];
        for (let field of requiredFields) {
          const element = document.getElementById(field);
          if (!element || !element.value) {
            if (window.modalAlert) {
              window.modalAlert('Please fill in all personal and address information.', 'Required Fields');
            } else {
              alert('Please fill in all personal and address information.');
            }
            return false;
          }
        }

        // Validate email format
        const email = document.getElementById('email');
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email.value.trim())) {
          if (window.modalAlert) {
            window.modalAlert('Please enter a valid email address.', 'Invalid Email');
          } else {
            alert('Please enter a valid email address.');
          }
          email.focus();
          return false;
        }

        // Check if email is available (red border means taken)
        if (email.classList.contains('border-red-500')) {
          if (window.modalAlert) {
            window.modalAlert('This email address is already in use. Please use a different email.', 'Email In Use');
          } else {
            alert('This email address is already in use. Please use a different email.');
          }
          email.focus();
          return false;
        }

        // Validate service area
        if (window.validateServiceArea && typeof window.validateServiceArea === 'function') {
          const inServiceArea = await window.validateServiceArea();
          if (!inServiceArea) {
            return false; // validateServiceArea shows its own modal
          }
        }

        return true;
      }
    },
    {
      name: 'Bags and Preferences',
      sections: ['laundryBagsSection', 'servicePreferencesSection'],
      validate: function() {
        const numberOfBags = document.getElementById('numberOfBags');
        if (!numberOfBags || !numberOfBags.value || numberOfBags.value === '') {
          if (window.modalAlert) {
            window.modalAlert('Please select the number of bags needed.', 'Required Field');
          } else {
            alert('Please select the number of bags needed.');
          }
          return false;
        }
        return true;
      }
    },
    {
      name: 'Summary and Payment',
      sections: ['serviceSummarySection', 'serviceAgreementSection', 'paymentFormContainer'],
      validate: function() {
        const termsAgreement = document.getElementById('termsAgreement');
        if (!termsAgreement || !termsAgreement.checked) {
          if (window.modalAlert) {
            window.modalAlert('Please accept the Terms of Service and Privacy Policy.', 'Agreement Required');
          } else {
            alert('Please accept the Terms of Service and Privacy Policy.');
          }
          return false;
        }
        return true;
      },
      isLastStep: true,
      onShow: function() {
        // Check if payment should be skipped (free first bag with only 1 bag selected)
        const numberOfBags = parseInt(document.getElementById('numberOfBags')?.value || 0);
        const freeFirstBagEnabled = window.freeFirstBagEnabled || false;
        const shouldSkipPayment = freeFirstBagEnabled && numberOfBags === 1;
        
        console.log('Payment step - bags:', numberOfBags, 'freeFirstBag:', freeFirstBagEnabled, 'skipPayment:', shouldSkipPayment);
        
        // Trigger payment form visibility event
        if (window.PaygistixRegistration && window.PaygistixRegistration.updateBagQuantity) {
          window.PaygistixRegistration.updateBagQuantity();
        }

        // Move submit button to navigation area and hide payment container
        setTimeout(function() {
          const submitBtn = document.querySelector('#paymentFormContainer #pxSubmit');
          const paymentContainer = document.getElementById('paymentFormContainer');
          const navigationSection = document.getElementById('navigationSection');
          const advanceButton = document.getElementById('advanceButton');

          if (paymentContainer && navigationSection) {
            // Hide payment container if payment should be skipped or in normal flow
            if (shouldSkipPayment) {
              paymentContainer.style.display = 'none';
              
              // Show a message that registration is free
              const freeMessage = document.createElement('div');
              freeMessage.className = 'p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 mb-4';
              freeMessage.innerHTML = '<strong>Free Registration!</strong> Your first bag is free. Click "Complete Registration" to finish.';
              
              const summarySection = document.getElementById('serviceSummarySection');
              if (summarySection && !document.querySelector('.free-registration-message')) {
                freeMessage.classList.add('free-registration-message');
                summarySection.appendChild(freeMessage);
              }
            } else if (submitBtn) {
              // Normal payment flow - hide container as before
              paymentContainer.style.display = 'none';
            }

            // Check if payment button already exists in navigation
            let payButton = document.getElementById('completePayButton');
            if (!payButton) {
              // Create a new button (not clone, to avoid event issues)
              payButton = document.createElement('button');
              payButton.id = 'completePayButton';
              payButton.type = 'button';
              payButton.className = 'px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition';
              
              // Change button text based on whether payment is needed
              if (shouldSkipPayment) {
                payButton.innerHTML = '<span data-i18n="customer.register.completeRegistration">Complete Registration</span>';
              } else {
                payButton.innerHTML = '<span data-i18n="customer.register.completeAndPay">Complete and Pay</span>';
              }

              // Add click handler to trigger the original submit button
              payButton.addEventListener('click', async function(e) {
                e.preventDefault();
                console.log('Complete button clicked, shouldSkipPayment:', shouldSkipPayment);

                // Gather customer data from the form
                const customerData = {
                  firstName: document.getElementById('firstName').value,
                  lastName: document.getElementById('lastName').value,
                  email: document.getElementById('email').value,
                  phone: document.getElementById('phone').value,
                  address: document.getElementById('address').value,
                  city: document.getElementById('city').value,
                  state: document.getElementById('state').value,
                  zipCode: document.getElementById('zipCode').value,
                  affiliateId: document.getElementById('affiliateId').value,
                  numberOfBags: document.getElementById('numberOfBags').value,
                  username: document.getElementById('username')?.value || '',
                  password: document.getElementById('password')?.value || '',
                  socialToken: document.querySelector('input[name="socialToken"]')?.value || '',
                  specialInstructions: document.getElementById('specialInstructions')?.value || '',
                  affiliateSpecialInstructions: document.getElementById('affiliateSpecialInstructions')?.value || '',
                  languagePreference: document.getElementById('languagePreference')?.value || 'en'
                };

                // If payment should be skipped (free first bag with 1 bag), register directly
                if (shouldSkipPayment) {
                  console.log('Skipping payment - free first bag registration');
                  
                  // Show loading spinner
                  if (window.SwirlSpinner) {
                    window.SwirlSpinner.show('Processing free registration...');
                  }
                  
                  try {
                    // Register customer without payment
                    const csrfFetch = window.CsrfUtils?.csrfFetch || fetch;
                    const response = await csrfFetch('/api/v1/customers/register', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      credentials: 'include',
                      body: JSON.stringify({
                        ...customerData,
                        paymentConfirmed: false // No payment needed
                      })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                      console.log('Free registration successful');
                      
                      // Store token for auto-login
                      if (data.token) {
                        localStorage.setItem('customerAuthToken', data.token);
                      }
                      
                      // Redirect to success page
                      const successUrl = `/customer-registration-complete.html?customerId=${data.customerId}`;
                      window.location.href = successUrl;
                    } else {
                      console.error('Registration failed:', data);
                      if (window.SwirlSpinner) {
                        window.SwirlSpinner.hide();
                      }
                      if (window.modalAlert) {
                        window.modalAlert(data.message || 'Registration failed. Please try again.', 'Registration Error');
                      }
                    }
                  } catch (error) {
                    console.error('Registration error:', error);
                    if (window.SwirlSpinner) {
                      window.SwirlSpinner.hide();
                    }
                    if (window.modalAlert) {
                      window.modalAlert('An error occurred during registration. Please try again.', 'Error');
                    }
                  }
                  return;
                }

                // Normal payment flow continues below
                // Check if test mode is enabled
                if (window.paymentConfig && window.paymentConfig.testModeEnabled) {
                  console.log('Test mode is enabled, using test payment flow');

                  // Use the payment form's test mode handler
                  if (window.paymentForm && typeof window.paymentForm.processPaymentTestMode === 'function') {

                    // Check rate limit before processing payment
                    console.log('Checking rate limit before payment...');
                    const csrfFetch = window.CsrfUtils?.csrfFetch || fetch;
                    
                    csrfFetch('/api/v1/customers/check-rate-limit', {
                        method: 'GET',
                        credentials: 'include'
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            console.log('Rate limit check passed, proceeding with payment');
                            // Process payment in test mode
                            window.paymentForm.processPaymentTestMode(customerData);
                        } else {
                            console.error('Rate limit exceeded:', data.message);
                            if (window.modalAlert) {
                                window.modalAlert(data.message, 'Registration Limit Exceeded');
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Error checking rate limit:', error);
                        // Proceed with payment anyway if rate limit check fails
                        window.paymentForm.processPaymentTestMode(customerData);
                    });
                  } else {
                    console.error('Payment form not properly initialized for test mode');
                    console.error('window.paymentForm:', window.paymentForm);
                    console.error('processPaymentTestMode exists:', window.paymentForm ? typeof window.paymentForm.processPaymentTestMode : 'no paymentForm');
                    
                    // Check if using v1 instead of v2
                    if (window.PaygistixPaymentForm && !window.PaygistixPaymentForm.prototype.processPaymentTestMode) {
                      console.error('PaygistixPaymentForm v1 detected - processPaymentTestMode not available');
                      console.error('Please ensure paygistix-payment-form-v2.js is loaded');
                    }
                    
                    if (window.modalAlert) {
                      window.modalAlert('Payment system not ready. Please refresh the page and try again.', 'Error');
                    }
                  }
                } else {
                  console.log('Production mode, triggering actual payment form submit');

                  // If using registration mode, click the original button
                  if (window.paymentForm && window.paymentForm.isProcessingPayment !== undefined) {
                    submitBtn.click();
                  } else {
                    // Fallback: submit the form directly
                    const form = document.querySelector('#paymentFormContainer form');
                    if (form) {
                      form.submit();
                    }
                  }
                }
              });

              // Hide the advance button
              if (advanceButton) {
                advanceButton.style.display = 'none';
              }

              // Add the payment button to navigation
              const buttonsContainer = navigationSection.querySelector('.flex.justify-between');
              if (buttonsContainer) {
                buttonsContainer.appendChild(payButton);
              }
            }

            // Update i18n if available
            if (window.i18n && window.i18n.translatePage) {
              window.i18n.translatePage();
            }
          }
        }, 500); // Wait for form to be fully loaded
      }
    }
  ];

  let currentStep = 0;

  function showStep(stepIndex) {
    // Hide all sections except navigation
    const allSections = document.querySelectorAll('#customerRegistrationForm > div[id$="Section"]:not(#navigationSection), #paymentFormContainer');
    allSections.forEach(section => {
      section.style.display = 'none';
    });

    // Show sections for current step
    const currentStepData = steps[stepIndex];
    currentStepData.sections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.style.display = 'block';
      }
    });

    // Execute onShow callback if present
    if (currentStepData.onShow) {
      currentStepData.onShow();
    }

    // Update navigation buttons
    const backButton = document.getElementById('backButton');
    const advanceButton = document.getElementById('advanceButton');
    const advanceButtonText = advanceButton.querySelector('span');

    // Show/hide back button
    backButton.style.display = stepIndex > 0 ? 'block' : 'none';

    // Update advance button text
    if (currentStepData.isLastStep) {
      advanceButton.style.display = 'none'; // Hide advance button on last step
    } else {
      advanceButton.style.display = 'block';
      advanceButtonText.setAttribute('data-i18n', 'customer.register.next');
      advanceButtonText.textContent = 'Next →';
    }

    // Update i18n if available
    if (window.i18n && window.i18n.translatePage) {
      window.i18n.translatePage();
    }

    // Scroll to top of form
    const formContainer = document.querySelector('.embed-container');
    if (formContainer) {
      formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Send resize event after step change is complete
    // Wait for DOM updates and any transitions
    setTimeout(() => {
      sendResizeEvent();
    }, 100);
  }

  // Function to manually send resize event
  function sendResizeEvent() {
    // Use the embed navigation's sendHeight function if available
    if (window.embedNavigation && window.embedNavigation.sendHeight) {
      console.log('Using embedNavigation.sendHeight()');
      window.embedNavigation.sendHeight();
    } else if (window.parent && window.parent !== window) {
      // Fallback to manual implementation
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight
      );

      console.log('Sending manual resize event, height:', height);
      window.parent.postMessage({
        type: 'resize',
        data: { height: height }
      }, '*');
    }
  }

  async function advanceStep() {
    console.log('advanceStep called, currentStep:', currentStep);

    // Validate current step
    if (steps[currentStep].validate) {
      console.log('Validating step', currentStep);
      try {
        const isValid = await steps[currentStep].validate();
        if (!isValid) {
          console.log('Validation failed for step', currentStep);
          return;
        }
      } catch (error) {
        console.error('Validation error:', error);
        return;
      }

      // Debug: Check for any lingering overlays after validation
      const overlays = document.querySelectorAll('.swirl-spinner-overlay, .swirl-spinner-global');
      if (overlays.length > 0) {
        console.warn('Found lingering spinner overlays:', overlays);
        overlays.forEach(overlay => overlay.remove());
      }
    }

    // Move to next step
    if (currentStep < steps.length - 1) {
      currentStep++;
      console.log('Moving to step', currentStep);
      showStep(currentStep);
    } else {
      console.log('Already at last step');
    }
  }

  function goBack() {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  }

  // Initialize navigation
  function init() {
    console.log('Initializing customer registration navigation...');

    // Initialize CSRF token first
    if (window.CsrfUtils && window.CsrfUtils.ensureCsrfToken) {
      console.log('Initializing CSRF token...');
      window.CsrfUtils.ensureCsrfToken().then(() => {
        console.log('CSRF token initialized successfully');
      }).catch(error => {
        console.error('Failed to initialize CSRF token:', error);
      });
    } else {
      console.warn('CsrfUtils not available - CSRF protection may not work properly');
    }

    const advanceButton = document.getElementById('advanceButton');
    const backButton = document.getElementById('backButton');

    if (advanceButton) {
      console.log('Advance button found, attaching handler');
      advanceButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Advance button clicked');
        advanceStep();
      });
    } else {
      console.error('Advance button not found!');
    }

    if (backButton) {
      console.log('Back button found, attaching handler');
      backButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Back button clicked');
        goBack();
      });
    } else {
      console.warn('Back button not found (this is normal on first load)');
    }

    // Show initial step
    showStep(0);

    // Handle OAuth login - skip to step 2 if OAuth is used
    window.addEventListener('oauthSuccess', function() {
      currentStep = 1; // Skip to Personal and Address
      showStep(currentStep);
    });
  }

  // Check if DOM is ready
  if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', init);
  } else {
    console.log('DOM ready, initializing navigation');
    // Add small delay to ensure all other scripts have run
    setTimeout(init, 100);
  }

  // Export navigation functions for external use
  window.CustomerRegistrationNavigation = {
    showStep: showStep,
    advanceStep: advanceStep,
    goBack: goBack,
    getCurrentStep: function() { return currentStep; }
  };

})();