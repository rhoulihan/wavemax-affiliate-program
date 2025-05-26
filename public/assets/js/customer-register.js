document.addEventListener('DOMContentLoaded', function() {
  // Extract affiliate ID from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const affiliateId = urlParams.get('affiliate');

  if (affiliateId) {
    // Set the hidden affiliate ID field
    document.getElementById('affiliateId').value = affiliateId;

    // Fetch affiliate info from the server
    fetch(`/api/affiliates/${affiliateId}/public`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.affiliate) {
          const affiliate = data.affiliate;
          const affiliateIntro = document.getElementById('affiliateIntro');
          const name = affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`;
          affiliateIntro.textContent = `Sign up for premium laundry pickup and delivery service with ${name}.`;

          // Set delivery fee based on affiliate's rate
          document.getElementById('deliveryFee').textContent = `$${parseFloat(affiliate.deliveryFee).toFixed(2)}`;
        } else {
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

  // Service frequency selection behavior
  const serviceFrequency = document.getElementById('serviceFrequency');
  const recurringScheduleContainer = document.getElementById('recurringScheduleContainer');
  const preferredDay = document.getElementById('preferredDay');
  const preferredTime = document.getElementById('preferredTime');

  serviceFrequency.addEventListener('change', function() {
    if (this.value === 'onDemand') {
      recurringScheduleContainer.style.display = 'none';
      preferredDay.required = false;
      preferredTime.required = false;
    } else {
      recurringScheduleContainer.style.display = 'block';
      preferredDay.required = true;
      preferredTime.required = true;
    }
  });

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
    fetch('/api/customers/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Store customer data in sessionStorage for success page
          sessionStorage.setItem('registrationData', JSON.stringify({
            customerId: data.customerId,
            bagBarcode: data.bagBarcode,
            firstName: data.customerData.firstName,
            lastName: data.customerData.lastName,
            email: data.customerData.email,
            affiliateId: data.customerData.affiliateId,
            affiliateName: data.customerData.affiliateName,
            deliveryFee: data.customerData.deliveryFee
          }));

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
});