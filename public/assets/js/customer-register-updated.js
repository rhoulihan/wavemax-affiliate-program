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

  // Check if Paygistix payment form is available
  const isPaygistixEnabled = typeof PaygistixPaymentForm !== 'undefined';

  // Form submission handler that works with Paygistix payment
  function handleFormSubmission(form) {
    const formData = new FormData(form);
    const isSocialRegistration = formData.get('socialToken');

    // For Paygistix-enabled forms, we need to ensure payment is included
    if (isPaygistixEnabled) {
      // Check if payment form has valid data
      const paymentTotal = window.paymentForm ? window.paymentForm.getTotal() : 0;
      if (paymentTotal === 0) {
        modalAlert('Please select the number of bags needed before proceeding.', 'Payment Required');
        return false;
      }
    }

    // Check if passwords match and validate strength (only for non-social registration)
    if (!isSocialRegistration) {
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (password !== confirmPassword) {
        modalAlert('Passwords do not match!', 'Password Mismatch');
        return false;
      }

      // Validate password strength
      if (!validatePassword()) {
        modalAlert('Please ensure your password meets all the security requirements listed below the password field.', 'Password Requirements');
        document.getElementById('password').focus();
        return false;
      }
    }

    // Validate required fields
    const missingFields = validateFormFields(isSocialRegistration);
    if (missingFields.length > 0) {
      modalAlert(`Please fill in the following required fields: ${missingFields.join(', ')}`, 'Missing Required Fields');
      return false;
    }

    // If using Paygistix, let the payment form handle submission
    if (isPaygistixEnabled && window.paymentForm) {
      // Store registration data for after payment
      const customerData = {};
      formData.forEach((value, key) => {
        // Don't include payment fields
        if (!['cardNumber', 'cvv', 'expiryDate', 'cardholderName', 'billingZip'].includes(key)) {
          customerData[key] = value;
        }
      });

      // Store customer data for post-payment processing
      sessionStorage.setItem('pendingRegistration', JSON.stringify({
        customerData,
        isSocialRegistration,
        timestamp: Date.now()
      }));

      // Submit the Paygistix form
      const paygistixForm = document.querySelector('#' + window.paymentForm.formId);
      if (paygistixForm) {
        // The form will submit to Paygistix and redirect to our callback
        return true; // Allow form submission
      }
    }

    // Original flow for non-Paygistix registrations
    return handleTraditionalRegistration(form, formData, isSocialRegistration);
  }

  // Original registration logic (without Paygistix)
  function handleTraditionalRegistration(form, formData, isSocialRegistration) {
    // Collect form data
    const customerData = {};

    formData.forEach((value, key) => {
      // Don't include CVV in the data object (it should never be stored)
      if (key !== 'cvv') {
        customerData[key] = value;
      }
    });

    // Process card number - remove spaces and send full number (only for traditional registration)
    if (!isSocialRegistration && formData.get('cardNumber')) {
      customerData.cardNumber = formData.get('cardNumber').replace(/\s/g, '');
    }

    // Determine endpoint based on whether this is a social registration
    const endpoint = isSocialRegistration
      ? `${baseUrl}/api/v1/auth/customer/social/register`
      : `${baseUrl}/api/v1/customers/register`;

    // Submit to server
    csrfFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(customerData)
    })
      .then(response => response.json())
      .then(data => {
        console.log('Registration response:', data);
        if (data.success) {
          // Store customer data in sessionStorage for success page
          const registrationData = {
            customerId: data.customerId,
            bagBarcode: data.bagBarcode,
            firstName: data.customerData.firstName,
            lastName: data.customerData.lastName,
            email: data.customerData.email,
            affiliateId: data.customerData.affiliateId,
            affiliateName: data.customerData.affiliateName,
            numberOfBags: data.customerData.numberOfBags,
            laundryBagFee: data.customerData.laundryBagFee,
            socialProvider: data.socialProvider || null
          };
          sessionStorage.setItem('registrationData', JSON.stringify(registrationData));

          // Navigate to success page
          if (isEmbedded) {
            sendMessageToParent('registration-success', registrationData);
          } else {
            window.location.href = '/embed-app.html?route=/customer-success';
          }
        } else {
          modalAlert(data.message || 'Registration failed. Please try again.', 'Registration Error');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        modalAlert('Registration failed. Please try again.', 'Registration Error');
      });

    return false; // Prevent default form submission
  }

  // Export functions for use in the main initialization
  window.CustomerRegistration = {
    handleFormSubmission,
    handleTraditionalRegistration
  };

})();