(function() {
  'use strict';

  // Affiliate login functionality for embedded environment
  // Note: Login endpoints currently don't require CSRF tokens
  // But we'll prepare for future implementation
  const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

  function initializeAffiliateLogin() {
  console.log('Initializing affiliate login...');

  // Form submission
  const form = document.getElementById('affiliateLoginForm');

  if (!form) {
    console.error('Login form not found');
    return;
  }

  console.log('Login form found, attaching submit handler');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Form submitted');

    // Collect form data
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log('Login request:', { username });

    // API request
    csrfFetch('/api/v1/auth/affiliate/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Login failed');
        }
        return response.json();
      })
      .then(data => {
        console.log('Login response:', data);
        if (data.success) {
          // Store token in localStorage
          localStorage.setItem('affiliateToken', data.token);
          localStorage.setItem('currentAffiliate', JSON.stringify(data.affiliate));

          console.log('Login successful, redirecting to dashboard');
          // Redirect to dashboard
          window.location.href = `/embed-app.html?route=/affiliate-dashboard&id=${data.affiliate.affiliateId}`;
        } else {
          alert(data.message || 'Login failed. Please check your credentials and try again.');
        }
      })
      .catch(error => {
        console.error('Login error:', error);
        alert('Login failed. Please check your credentials and try again.');
      });
  });
  }

  // Initialize immediately
  initializeAffiliateLogin();

})(); // End IIFE