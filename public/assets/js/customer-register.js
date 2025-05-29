// Debug info
console.log('customer-register.js loaded');
console.log('Current URL:', window.location.href);
console.log('Window parent same as window?', window.parent === window);

// Note: Registration endpoints currently don't require CSRF tokens
// But we'll prepare for future implementation
const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

// Function to initialize the registration form
function initializeRegistrationForm() {
  console.log('Initializing registration form');
  // Extract affiliate ID from URL query parameter
  // When loaded via embed-app.html, we need to check the actual page URL, not the base URL
  let urlParams = new URLSearchParams(window.location.search);
  let affiliateId = urlParams.get('affid') || urlParams.get('affiliate') || sessionStorage.getItem('affiliateId');

  console.log('Window location search:', window.location.search);
  console.log('Initial affiliate ID search:', affiliateId);

  if (!affiliateId && window.parent !== window) {
    try {
      // Try to get parent URL parameters
      const parentUrl = new URL(window.parent.location.href);
      const parentParams = new URLSearchParams(parentUrl.search);
      affiliateId = parentParams.get('affid') || parentParams.get('affiliate');
      console.log('Checking parent URL for affiliate ID:', affiliateId);
    } catch (e) {
      console.log('Cannot access parent URL (cross-origin), checking embed-app URL');
      // If cross-origin, try to parse the referrer or use the embed-app URL pattern
      if (document.referrer) {
        const referrerUrl = new URL(document.referrer);
        const referrerParams = new URLSearchParams(referrerUrl.search);
        affiliateId = referrerParams.get('affid') || referrerParams.get('affiliate');
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

    // Clear from session storage after use
    sessionStorage.removeItem('affiliateId');

    // Fetch affiliate info from the server
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const apiUrl = `${baseUrl}/api/v1/affiliates/${affiliateId}/public`;
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
        if (data.success && data.affiliate) {
          const affiliate = data.affiliate;
          const affiliateIntro = document.getElementById('affiliateIntro');
          if (affiliateIntro) {
            const name = affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`;
            affiliateIntro.textContent = `Sign up for premium laundry pickup and delivery service with ${name}.`;
          }

          // Set delivery fee based on affiliate's rate
          const deliveryFeeElement = document.getElementById('deliveryFee');
          if (deliveryFeeElement) {
            // Ensure deliveryFee exists and is a valid number
            const affiliateFee = affiliate.deliveryFee || 0;
            const fee = parseFloat(affiliateFee).toFixed(2);
            console.log('Affiliate delivery fee:', affiliate.deliveryFee, '-> Formatted:', fee);
            deliveryFeeElement.textContent = `$${fee}`;
          } else {
            console.error('deliveryFee element not found');
          }
        } else {
          console.error('Invalid affiliate data:', data);
          alert('Invalid affiliate ID. Please use a valid registration link.');
          window.location.href = '/embed-app.html';
        }
      })
      .catch(error => {
        console.error('Error fetching affiliate info:', error);
        alert('Unable to load affiliate information. Please try again.');
        window.location.href = '/embed-app.html';
      });
  } else {
    // Redirect if no affiliate ID is provided
    alert('No affiliate ID provided. Please use a valid registration link.');
    window.location.href = '/embed-app.html';
  }


  // Form submission
  const form = document.getElementById('customerRegistrationForm');

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    // Check if passwords match
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    // Collect form data
    const formData = new FormData(form);
    const customerData = {};

    formData.forEach((value, key) => {
      // Don't include CVV in the data object (it should never be stored)
      if (key !== 'cvv') {
        customerData[key] = value;
      }
    });

    // Process card number - remove spaces and send full number
    customerData.cardNumber = formData.get('cardNumber').replace(/\s/g, '');

    // Note: CVV is not included in customerData as it should never be stored
    // The backend will only store the last 4 digits of the card number

    // Submit to server
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    csrfFetch(`${baseUrl}/api/v1/customers/register`, {
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
            deliveryFee: data.customerData.deliveryFee
          };
          console.log('Storing registration data:', registrationData);
          sessionStorage.setItem('registrationData', JSON.stringify(registrationData));

          // Redirect to success page
          window.location.href = '/embed-app.html?route=/customer-success';
        } else {
          alert(data.message || 'Registration failed. Please try again.');
        }
      })
      .catch(error => {
        console.error('Registration error:', error);
        alert('An error occurred during registration. Please try again.');
      });
  });

  // Payment field formatting - basic examples
  const cardNumberInput = document.getElementById('cardNumber');
  cardNumberInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);

    // Format with spaces
    const parts = [];
    for (let i = 0; i < value.length; i += 4) {
      parts.push(value.slice(i, i + 4));
    }
    e.target.value = parts.join(' ');
  });

  const expiryDateInput = document.getElementById('expiryDate');
  expiryDateInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);

    if (value.length > 2) {
      e.target.value = value.slice(0, 2) + '/' + value.slice(2);
    } else {
      e.target.value = value;
    }
  });

  const cvvInput = document.getElementById('cvv');
  cvvInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    e.target.value = value;
  });
}

// Check if DOM is already loaded or wait for it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRegistrationForm);
} else {
  // DOM is already loaded, initialize immediately
  initializeRegistrationForm();
}