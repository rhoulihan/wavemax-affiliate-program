document.addEventListener('DOMContentLoaded', function() {
  // Show/hide payment method fields based on selection
  const paymentMethodSelect = document.getElementById('paymentMethod');
  const bankInfoContainer = document.getElementById('bankInfoContainer');
  const paypalInfoContainer = document.getElementById('paypalInfoContainer');
  const accountNumberInput = document.getElementById('accountNumber');
  const routingNumberInput = document.getElementById('routingNumber');
  const paypalEmailInput = document.getElementById('paypalEmail');

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

  // Form validation and submission
  const form = document.getElementById('affiliateRegistrationForm');

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

      // In a real implementation, this would be an API call to the server
      const response = await fetch('/api/v1/affiliates/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(affiliateData)
      });

      await window.ErrorHandler.handleFetchError(response);
      const data = await response.json();

      // Store the affiliate data and redirect
      localStorage.setItem('currentAffiliate', JSON.stringify({
        ...affiliateData,
        affiliateId: data.affiliateId
      }));

      // Redirect to success page
      window.location.href = 'affiliate-success.html';
    } catch (error) {
      console.error('Registration error:', error);
    }
  });
});