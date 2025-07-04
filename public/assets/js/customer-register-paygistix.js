(function() {
  'use strict';

  let paymentForm = null;
  let paymentConfig = null;

  // Initialize payment form
  async function initializePaymentForm() {
    try {
      // Load payment configuration first
      console.log('Fetching payment config from /api/v1/payments/config');

      // Use CSRF-aware fetch if available (not needed for GET but good practice)
      const fetchFunction = window.CsrfUtils?.csrfFetch || fetch;
      const configResponse = await fetchFunction('/api/v1/payments/config', {
        credentials: 'include'
      });

      if (!configResponse.ok) {
        console.error('Config response status:', configResponse.status);
        const errorText = await configResponse.text();
        console.error('Config response error:', errorText);
        throw new Error(`Failed to load payment configuration: ${configResponse.status} ${configResponse.statusText}`);
      }

      const configData = await configResponse.json();
      console.log('Payment config data:', configData);

      if (!configData.success) {
        throw new Error(configData.message || 'Failed to load payment configuration');
      }

      paymentConfig = configData.config;

      // Make payment config globally available for navigation script
      window.paymentConfig = paymentConfig;

      // Initialize the Paygistix payment form with config
      paymentForm = new window.PaygistixPaymentForm({
        container: document.getElementById('paymentFormContainer'),
        paymentConfig: paymentConfig,
        payContext: 'REGISTRATION',
        affiliateId: document.getElementById('affiliateId')?.value,
        affiliateSettings: window.affiliateData || null, // Pass affiliate data from customer-register.js
        hideRegistrationFormRows: true, // Hide non-BF form rows in registration
        onSuccess: function() {
          console.log('Payment form initialized with config:', paymentConfig);
        },
        onError: function(error) {
          console.error('Payment form error:', error);
          document.getElementById('paymentFormContainer').innerHTML =
                        '<div class="text-red-600 p-4">Failed to load payment form. Please refresh the page.</div>';
        },
        onPaymentSuccess: async function(paymentDetails) {
          console.log('=== PAYMENT SUCCESS CALLBACK TRIGGERED ===');
          console.log('Payment successful, creating customer account...');
          console.log('Payment details:', paymentDetails);
          await createCustomerAccount(paymentDetails);
        },
        onPaymentFailure: function(error) {
          console.error('Payment failed:', error);
          if (window.modalAlert) {
            window.modalAlert(error || 'Payment failed. Please try again.', 'Payment Error');
          }
        }
      });

      // Make paymentForm globally accessible
      window.paymentForm = paymentForm;

      // Update bag quantity when selection changes
      // Only update if there's already a selection
      setTimeout(() => {
        const numberOfBags = document.getElementById('numberOfBags').value;
        if (numberOfBags && numberOfBags !== '') {
          updateBagQuantity();
        }
      }, 100);

    } catch (error) {
      console.error('Error initializing payment form:', error);
      document.getElementById('paymentFormContainer').innerHTML =
                '<div class="text-red-600 p-4">Failed to load payment form. Please refresh the page.</div>';
    }
  }

  // Update bag quantity in payment form
  function updateBagQuantity() {
    const numberOfBags = document.getElementById('numberOfBags').value;
    console.log('updateBagQuantity called with numberOfBags:', numberOfBags);

    if (paymentForm && numberOfBags) {
      const quantity = parseInt(numberOfBags);
      console.log('Setting BF quantity to:', quantity);
      // Use the updateQuantity method from PaygistixPaymentForm v2
      paymentForm.updateQuantity('BF', quantity);
    } else {
      console.log('PaymentForm not ready or numberOfBags is empty', {
        paymentForm: !!paymentForm,
        numberOfBags: numberOfBags
      });
    }
  }

  // Create customer account after successful payment
  async function createCustomerAccount(paymentDetails) {
    console.log('=== CREATE CUSTOMER ACCOUNT CALLED ===');
    console.log('Payment details received:', paymentDetails);

    // If we have payment details with a payment token but no transaction ID,
    // wait a moment and fetch the updated payment status
    if (paymentDetails && !paymentDetails.transactionId && window.paymentForm && window.paymentForm.paymentToken) {
      console.log('Fetching updated payment status for token:', window.paymentForm.paymentToken);
      try {
        const response = await fetch(`/api/v1/payments/check-status/${window.paymentForm.paymentToken}`);
        const data = await response.json();
        if (data.success && data.transactionId) {
          paymentDetails = { ...paymentDetails, transactionId: data.transactionId };
          console.log('Updated payment details with transaction ID:', paymentDetails);
        }
      } catch (error) {
        console.error('Error fetching payment status:', error);
      }
    }

    let spinner = null;
    try {
      // Show spinner
      spinner = window.SwirlSpinnerUtils ?
        window.SwirlSpinnerUtils.showGlobal({
          message: 'Creating your account...',
          submessage: 'Please wait while we set up your account'
        }) : null;

      // Gather all form data with null safety
      const formData = {
        // Personal Information
        firstName: document.getElementById('firstName')?.value || '',
        lastName: document.getElementById('lastName')?.value || '',
        email: document.getElementById('email')?.value || '',
        phone: document.getElementById('phone')?.value || '',

        // Address
        address: document.getElementById('address')?.value || '',
        city: document.getElementById('city')?.value || '',
        state: document.getElementById('state')?.value || '',
        zipCode: document.getElementById('zipCode')?.value || '',

        // Service Details
        numberOfBags: parseInt(document.getElementById('numberOfBags')?.value || '0'),
        specialInstructions: document.getElementById('specialInstructions')?.value || '',

        // Account Setup
        username: document.getElementById('username')?.value || '',
        password: document.getElementById('password')?.value || '',

        // Affiliate Info - check both possible field names
        affiliateId: document.getElementById('AFFILIATEID')?.value || document.getElementById('affiliateId')?.value || '',

        // Payment confirmation (payment was already processed successfully)
        paymentConfirmed: true
      };

      console.log('Form data collected:', formData);

      // Submit registration
      const response = await fetch('/api/v1/customers/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      console.log('Registration response status:', response.status);
      const result = await response.json();
      console.log('Registration response:', result);

      if (spinner) {
        spinner.hide();
      }

      if (result.success) {
        console.log('=== REGISTRATION SUCCESSFUL ===', result);
        // Store registration data for success page
        const successData = {
          customerId: result.customerId || result.customerData?.customerId,
          bagBarcode: result.bagBarcode || result.customerData?.bagBarcode,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          affiliateId: formData.affiliateId,
          numberOfBags: formData.numberOfBags,
          transactionId: paymentDetails?.transactionId || null,
          // Include affiliate info if available
          affiliateInfo: window.affiliateData ? {
            firstName: window.affiliateData.firstName,
            lastName: window.affiliateData.lastName,
            businessName: window.affiliateData.businessName,
            city: window.affiliateData.city,
            state: window.affiliateData.state,
            minimumDeliveryFee: window.affiliateData.minimumDeliveryFee,
            perBagDeliveryFee: window.affiliateData.perBagDeliveryFee
          } : null
        };

        sessionStorage.setItem('registrationData', JSON.stringify(successData));
        console.log('Success data stored in sessionStorage:', successData);

        // Show success message
        if (window.modalAlert) {
          window.modalAlert('Your account has been created successfully!', 'Registration Complete');
        }

        // Redirect to success page after a short delay
        console.log('Redirecting to customer success page in 1.5 seconds...');
        setTimeout(() => {
          console.log('Redirecting now...');
          // For CSP v2, navigate directly to the success page with proper nonce injection
          const currentParams = new URLSearchParams(window.location.search);
          // Preserve affiliate ID in the URL
          if (formData.affiliateId) {
            currentParams.set('affiliateId', formData.affiliateId);
          }
          window.location.href = '/customer-success-embed.html?' + currentParams.toString();
        }, 1500);
      } else {
        // Registration failed
        console.error('Registration failed:', result);
        let errorMessage = result.message || 'Unable to complete registration. Please contact support.';

        // Check for validation errors
        if (result.errors && Array.isArray(result.errors)) {
          errorMessage = result.errors.map(err => err.msg || err.message).join(', ');
        }

        if (window.modalAlert) {
          window.modalAlert(errorMessage, 'Registration Error');
        }
      }
    } catch (error) {
      console.error('Error creating customer account:', error);

      if (spinner) {
        spinner.hide();
      }

      if (window.modalAlert) {
        window.modalAlert('An error occurred while creating your account. Please contact support.', 'Error');
      }
    }
  }

  // Handle registration submission - Deprecated, now handled by PaygistixPaymentForm
  function handleRegistrationSubmit() {
    console.log('handleRegistrationSubmit called - this function is deprecated');
    // The Paygistix form now handles submission directly
  }

  // Initialize when DOM is ready
  function init() {
    // Initialize i18n first if available
    if (window.i18n && window.i18n.init) {
      window.i18n.init({ debugMode: false }).then(() => {
        if (window.LanguageSwitcher) {
          window.LanguageSwitcher.createSwitcher('language-switcher-container', {
            style: 'dropdown',
            showLabel: false
          });
        }
        // Ensure all elements are translated after initialization
        if (window.i18n && window.i18n.translatePage) {
          window.i18n.translatePage();
        }
      });
    }

    // Initialize payment form
    initializePaymentForm();

    // Listen for bag quantity changes
    const numberOfBagsSelect = document.getElementById('numberOfBags');
    if (numberOfBagsSelect) {
      numberOfBagsSelect.addEventListener('change', function() {
        updateBagQuantity();
        // Update the bag fee display
        const numberOfBags = parseInt(this.value) || 0;
        const bagFee = 10.00; // Default, should match system config
        const total = numberOfBags * bagFee;
        const totalBagFeeElement = document.getElementById('totalBagFee');
        if (totalBagFeeElement) {
          totalBagFeeElement.textContent = `$${total.toFixed(2)}`;
        }
      });
    }

    // Submit button is now handled by Paygistix form directly
  }

  // Check if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM is already loaded
    init();
  }

  // Export functions for global access if needed
  window.PaygistixRegistration = {
    updateBagQuantity: updateBagQuantity,
    handleRegistrationSubmit: handleRegistrationSubmit
  };

})();