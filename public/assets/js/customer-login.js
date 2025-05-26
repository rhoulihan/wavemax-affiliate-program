document.addEventListener('DOMContentLoaded', function() {
  // Check if already logged in
  const token = localStorage.getItem('customerToken');
  const currentCustomer = JSON.parse(localStorage.getItem('currentCustomer'));

  if (token && currentCustomer) {
    // User is already logged in, redirect to dashboard
    window.location.href = `/customer-dashboard?id=${currentCustomer.customerId}`;
    return;
  }

  // Extract affiliate ID from URL query parameter (if any)
  const urlParams = new URLSearchParams(window.location.search);
  const affiliateId = urlParams.get('affiliate');

  // If affiliate ID is present, update register link
  if (affiliateId) {
    const registerLink = document.getElementById('registerLink');
    registerLink.href = `/customer-register?affiliate=${affiliateId}`;
    registerLink.textContent = 'Register here';
  }

  // Form submission
  const form = document.getElementById('customerLoginForm');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Collect form data
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Disable submit button to prevent multiple submissions
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Signing in...';

    try {
      // API request
      const response = await fetch('/api/v1/auth/customer/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store token in localStorage
      localStorage.setItem('customerToken', data.token);
      localStorage.setItem('currentCustomer', JSON.stringify(data.customer));

      // Check for redirect URL
      const redirectUrl = localStorage.getItem('redirectAfterLogin');

      if (redirectUrl) {
        // Clear the redirect URL
        localStorage.removeItem('redirectAfterLogin');

        // Redirect to the intended destination
        window.location.href = redirectUrl;
      } else {
        // Default redirect to dashboard
        window.location.href = `/customer-dashboard?id=${data.customer.customerId}`;
      }
    } catch (error) {
      console.error('Login error:', error);

      // Show error message
      alert(error.message || 'Invalid username or password');

      // Re-enable submit button
      submitButton.disabled = false;
      submitButton.textContent = 'Sign In';
    }
  });
});