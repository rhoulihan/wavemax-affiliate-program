// Initialization function for affiliate registration when dynamically loaded
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

        // API call to the server with proper base URL
        const response = await fetch(`${baseUrl}/api/v1/affiliates/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(affiliateData)
        });

        await window.ErrorHandler.handleFetchError(response);
        const data = await response.json();
        
        console.log('Registration response:', data);

        // Store the affiliate data
        localStorage.setItem('currentAffiliate', JSON.stringify({
          ...affiliateData,
          affiliateId: data.affiliateId
        }));

        // Handle redirect based on whether we're embedded
        if (isEmbedded) {
          // For embed-app, send navigation message
          console.log('Sending navigation message to parent');
          window.parent.postMessage({
            type: 'navigate',
            data: { url: '/affiliate-success' }
          }, '*');
        } else {
          // Otherwise, normal redirect
          window.location.href = `${baseUrl}/affiliate-success.html`;
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
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        window.parent.postMessage({
          type: 'form-height',
          height: entry.target.scrollHeight
        }, '*');
      }
    });
    resizeObserver.observe(document.body);
  }
}

// Initialize immediately when script loads
initializeAffiliateRegistration();