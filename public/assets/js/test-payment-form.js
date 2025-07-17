// Test Payment Form JavaScript
(function() {
  'use strict';

  // Add error handler to catch any issues
  window.addEventListener('error', function(event) {
    console.error('Test payment form error:', event.error);
  });

  console.log('Test payment form loaded');

  // Clean up on window unload
  window.addEventListener('beforeunload', () => {
    try {
      window.opener?.postMessage({ type: 'test-payment-closing' }, '*');
    } catch (e) {
      console.log('Failed to send closing message:', e);
    }
  });

  // Display order summary from items data
  function displayOrderSummaryFromItems(items) {
    try {
      let summaryHTML = '<table class="order-summary-table">';
      summaryHTML += '<thead><tr>';
      summaryHTML += '<th class="text-left">Item</th>';
      summaryHTML += '<th class="text-right">Qty</th>';
      summaryHTML += '<th class="text-right">Price</th>';
      summaryHTML += '<th class="text-right">Total</th>';
      summaryHTML += '</tr></thead>';
      summaryHTML += '<tbody>';
      
      let grandTotal = 0;
      let hasDeliveryFee = false;
      
      items.forEach(item => {
        const qty = item.quantity || 0;
        const price = item.price / 100; // Convert from cents
        const lineTotal = qty * price;
        grandTotal += lineTotal;
        
        // Check if this is a delivery fee item
        if (item.code && (item.code.startsWith('MDF') || item.code.startsWith('PBF'))) {
          hasDeliveryFee = true;
        }
        
        summaryHTML += '<tr>';
        summaryHTML += `<td class="item-desc">${item.description}</td>`;
        summaryHTML += `<td class="text-right item-qty">${qty}</td>`;
        summaryHTML += `<td class="text-right item-price">$${price.toFixed(2)}</td>`;
        summaryHTML += `<td class="text-right item-total">$${lineTotal.toFixed(2)}</td>`;
        summaryHTML += '</tr>';
      });
      
      summaryHTML += '</tbody>';
      summaryHTML += '<tfoot>';
      summaryHTML += '<tr>';
      summaryHTML += '<td colspan="3" class="text-right">Total:</td>';
      summaryHTML += `<td class="text-right grand-total">$${grandTotal.toFixed(2)}</td>`;
      summaryHTML += '</tr>';
      summaryHTML += '</tfoot>';
      summaryHTML += '</table>';
      
      document.getElementById('orderSummaryContent').innerHTML = summaryHTML;
      document.getElementById('orderSummaryCard').style.display = 'block';
      
    } catch (e) {
      console.log('Could not display order summary from items:', e);
    }
  }

  // Display order summary from payment form
  function displayOrderSummary() {
    try {
      if (!window.opener || !window.opener.document) return;
      
      const paymentForm = window.opener.document.querySelector('form#paygistixPaymentForm');
      if (!paymentForm) return;
      
      let summaryHTML = '<table class="order-summary-table">';
      summaryHTML += '<thead><tr>';
      summaryHTML += '<th class="text-left">Item</th>';
      summaryHTML += '<th class="text-right">Qty</th>';
      summaryHTML += '<th class="text-right">Price</th>';
      summaryHTML += '<th class="text-right">Total</th>';
      summaryHTML += '</tr></thead>';
      summaryHTML += '<tbody>';
      
      let grandTotal = 0;
      const rows = paymentForm.querySelectorAll('tbody tr');
      
      rows.forEach((row, index) => {
        const qtyInput = row.querySelector('input.pxQty');
        const codeInput = row.querySelector(`input[name="pxCode${index + 1}"]`);
        const descInput = row.querySelector(`input[name="pxDescription${index + 1}"]`);
        const priceInput = row.querySelector(`input[name="pxPrice${index + 1}"]`);
        
        if (qtyInput && codeInput && descInput && priceInput) {
          const qty = parseInt(qtyInput.value) || 0;
          const price = parseFloat(priceInput.value) || 0;
          
          if (qty > 0) {
            const lineTotal = qty * price;
            grandTotal += lineTotal;
            
            summaryHTML += '<tr>';
            summaryHTML += `<td class="item-desc">${descInput.value}</td>`;
            summaryHTML += `<td class="text-right item-qty">${qty}</td>`;
            summaryHTML += `<td class="text-right item-price">$${price.toFixed(2)}</td>`;
            summaryHTML += `<td class="text-right item-total">$${lineTotal.toFixed(2)}</td>`;
            summaryHTML += '</tr>';
          }
        }
      });
      
      summaryHTML += '</tbody>';
      summaryHTML += '<tfoot>';
      summaryHTML += '<tr>';
      summaryHTML += '<td colspan="3" class="text-right">Total:</td>';
      summaryHTML += `<td class="text-right grand-total">$${grandTotal.toFixed(2)}</td>`;
      summaryHTML += '</tr>';
      summaryHTML += '</tfoot>';
      summaryHTML += '</table>';
      
      document.getElementById('orderSummaryContent').innerHTML = summaryHTML;
      document.getElementById('orderSummaryCard').style.display = 'block';
      
    } catch (e) {
      console.log('Could not display order summary:', e);
    }
  }

  // Generate random payment data
  window.generateRandomData = function() {
    // Generate random card last 4
    const last4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    document.getElementById('cardNumber').value = '************' + last4;

    // Generate random expiration (future date)
    const month = Math.floor(Math.random() * 12) + 1;
    const year = new Date().getFullYear() + Math.floor(Math.random() * 5) + 1;
    const expDate = month.toString().padStart(2, '0') + year.toString().slice(-2);
    document.getElementById('expDate').value = expDate;

    // Generate random auth code
    const authCode = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

    // Regenerate and display the URL with new data
    if (document.getElementById('callbackUrl').value || document.getElementById('assignedCallbackUrl')?.textContent) {
      const url = generateCallbackUrl();
      document.getElementById('generatedUrl').classList.remove('hidden');
      document.getElementById('urlDisplay').textContent = url;
    }
  };

  // Generate callback URL
  window.generateCallbackUrl = function() {
    const cardNumber = document.getElementById('cardNumber').value;
    const last4 = cardNumber.slice(-4);
    const cardType = document.getElementById('cardType').value;
    const expDate = document.getElementById('expDate').value;
    const amount = document.getElementById('amount').value;

    // Get callback URL - check if it's hidden in the display div or in the select
    let callbackUrl = document.getElementById('callbackUrl').value;
    if (!callbackUrl) {
      // Try to get from the displayed URL if select is hidden
      const displayedUrl = document.getElementById('assignedCallbackUrl')?.textContent;
      if (displayedUrl) {
        callbackUrl = displayedUrl;
      }
    }
    console.log('Callback URL retrieved:', callbackUrl);

    const paymentToken = document.getElementById('paymentToken').value;
    const result = document.getElementById('result').value;

    // Generate realistic values
    const merchantId = 'wmaxaustWEB';
    const orderId = 'WMAX' + Date.now();
    const pnRef = Math.floor(Math.random() * 100000000).toString();
    const authCode = result === '0' ? Math.floor(Math.random() * 1000000).toString().padStart(6, '0') : '';
    const txnType = 'SALE';

    // Generate hash (in production this would be calculated by Paygistix)
    const hash = btoa(orderId + pnRef + amount).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);

    // Build query parameters
    const params = new URLSearchParams({
      hash: hash,
      MerchantID: merchantId,
      OrderID: orderId,
      Amount: amount,
      PNRef: pnRef,
      Result: result,
      TxnType: txnType,
      Last4: last4,
      ExpDate: expDate,
      CardType: cardType
    });

    // Add auth code if successful
    if (result === '0' && authCode) {
      params.append('AuthCode', authCode);
    }

    // Add payment token to custom1 parameter (as expected by payment callback handler)
    if (paymentToken) {
      params.append('custom1', paymentToken);
      params.append('paymentToken', paymentToken);
    }

    // Parse the callback URL to check if it's already a full URL
    let fullCallbackUrl;
    if (callbackUrl.startsWith('http://') || callbackUrl.startsWith('https://')) {
      // Already a full URL
      fullCallbackUrl = callbackUrl;
    } else {
      // Relative URL, prepend the base URL
      const baseUrl = 'https://wavemax.promo';
      fullCallbackUrl = baseUrl + callbackUrl;
    }
    return `${fullCallbackUrl}?${params.toString()}`;
  };

  // Simulate payment
  window.simulatePayment = async function() {
    const url = generateCallbackUrl();
    document.getElementById('generatedUrl').classList.remove('hidden');
    document.getElementById('urlDisplay').textContent = url;

    // Get payment token
    const paymentToken = document.getElementById('paymentToken').value;
    const result = document.getElementById('result').value;

    // Check if this is a customer registration test
    const customerDataStr = sessionStorage.getItem('testPaymentCustomerData');

    // For ALL test payments (registration or regular), redirect to callback URL
    // This simulates what Paygistix does - it redirects to the callback URL
    // The callback handler will find the pending token and update its status
    
    // Send message to parent window before redirecting
    if (window.opener) {
      try {
        window.opener.postMessage({
          type: 'test-payment-initiated',
          paymentToken: paymentToken,
          result: result,
          url: url
        }, '*');
      } catch (e) {
        console.log('Could not send message to opener:', e);
      }
    }
    
    // Auto-redirect after a short delay
    setTimeout(() => {
      console.log('Redirecting to callback URL:', url);
      window.location.href = url;
    }, 500);
  };

  // Simulate in new window
  window.simulateInNewWindow = function() {
    const url = generateCallbackUrl();
    document.getElementById('generatedUrl').classList.remove('hidden');
    document.getElementById('urlDisplay').textContent = url;

    // For ALL test payments (registration or regular), open callback URL in new window
    // This simulates what Paygistix does - it opens the callback URL in a new window
    const width = 800;
    const height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    window.open(url, 'PaymentSimulator', `width=${width},height=${height},left=${left},top=${top}`);
  };

  // Copy URL to clipboard
  window.copyUrl = function() {
    const url = document.getElementById('urlDisplay').textContent;
    navigator.clipboard.writeText(url).then(() => {
      alert('URL copied to clipboard!');
    });
  };

  // Initialize page
  function initializePage() {
    // Send message to opener that we've loaded
    if (window.opener) {
      try {
        window.opener.postMessage({
          type: 'test-window-loaded',
          url: window.location.href,
          timestamp: Date.now()
        }, '*');
        console.log('Sent load message to opener');
      } catch (e) {
        console.log('Could not send message to opener:', e.message);
      }
    }

    // Check if test form is enabled by checking if we can access this page
    fetch('/api/v1/environment').then(response => response.json()).then(data => {
      // Just log the environment for debugging
      console.log('Environment:', data);
    }).catch(err => {
      console.error('Could not check environment:', err);
    });

    // Check if we have customer data from registration form
    const customerDataStr = sessionStorage.getItem('testPaymentCustomerData');
    if (customerDataStr) {
      try {
        const customerData = JSON.parse(customerDataStr);
        console.log('Customer registration data:', customerData);

        // Update the UI to show customer info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'section-card bg-green-50 border-2 border-green-200';
        infoDiv.innerHTML = `
                    <h3 class="text-lg font-semibold text-green-800 mb-2">💳 Customer Registration Test Payment</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div><span class="font-medium text-gray-600">Customer:</span> ${customerData.firstName} ${customerData.lastName}</div>
                        <div><span class="font-medium text-gray-600">Email:</span> ${customerData.email}</div>
                        <div><span class="font-medium text-gray-600">Bags:</span> ${customerData.numberOfBags}</div>
                        <div><span class="font-medium text-gray-600">Affiliate:</span> ${customerData.affiliateId}</div>
                    </div>
                `;
        document.querySelector('.max-w-5xl').insertBefore(infoDiv, document.querySelector('.section-card:nth-child(2)'));

        // Set amount based on number of bags
        const bagFee = 10.00;
        const totalAmount = parseInt(customerData.numberOfBags) * bagFee;
        document.getElementById('amount').value = totalAmount.toFixed(2);

        // Get payment token from URL or session
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        const tokenFromSession = sessionStorage.getItem('testPaymentToken');
        const paymentToken = tokenFromUrl || tokenFromSession || ('TEST_' + Date.now() + '_' + Math.random().toString(36).substring(2));

        document.getElementById('paymentToken').value = paymentToken;

        // Store the customer data with the payment token for completion
        sessionStorage.setItem('pendingRegistration', JSON.stringify({
          token: paymentToken,
          amount: totalAmount * 100, // Convert to cents
          timestamp: Date.now(),
          customerData: customerData,
          numberOfBags: parseInt(customerData.numberOfBags)
        }));

        // Check if we have a callback URL from the payment token creation
        const callbackUrl = sessionStorage.getItem('testPaymentCallbackUrl');
        if (callbackUrl) {
          // Display the assigned callback URL
          document.getElementById('callbackUrlDisplay').classList.remove('hidden');
          document.getElementById('assignedCallbackUrl').textContent = callbackUrl;
          // Remove line about callbackUrlSelect since it no longer exists

          // IMPORTANT: Set the actual input value so generateCallbackUrl can retrieve it
          // Create a hidden input if the select doesn't have this value
          const selectElement = document.getElementById('callbackUrl');
          if (selectElement) {
            // Check if this option exists in the select
            let optionExists = false;
            for (let option of selectElement.options) {
              if (option.value === callbackUrl) {
                optionExists = true;
                break;
              }
            }

            if (!optionExists) {
              // Add the callback URL as a new option
              const newOption = document.createElement('option');
              newOption.value = callbackUrl;
              newOption.textContent = callbackUrl;
              newOption.selected = true;
              selectElement.appendChild(newOption);
            } else {
              // Set the value
              selectElement.value = callbackUrl;
            }
          }
        }

      } catch (error) {
        console.error('Error parsing customer data:', error);
      }
    }

    // Get parameters from URL (from v2 implementation)
    const urlParams = new URLSearchParams(window.location.search);
    const paymentToken = urlParams.get('paymentToken');
    const amount = urlParams.get('amount');
    const returnUrl = urlParams.get('returnUrl');
    const context = urlParams.get('context');
    const itemsJson = urlParams.get('items');
    
    // Set values from URL parameters
    if (paymentToken) {
      document.getElementById('paymentToken').value = paymentToken;
    }
    
    // Display items if provided
    if (itemsJson) {
      try {
        const items = JSON.parse(decodeURIComponent(itemsJson));
        displayOrderSummaryFromItems(items);
      } catch (e) {
        console.log('Could not parse items:', e);
      }
    }
    
    // Try to get the actual total and line items from the opener's payment form
    let calculatedAmount = amount;
    if (window.opener && window.opener.paymentForm && typeof window.opener.paymentForm.getTotal === 'function') {
      try {
        const formTotal = window.opener.paymentForm.getTotal();
        if (formTotal > 0) {
          calculatedAmount = formTotal.toFixed(2);
          console.log('Using total from payment form:', calculatedAmount);
        }
        
        // Also try to get line items for display if not already displayed
        if (!itemsJson) {
          displayOrderSummary();
        }
      } catch (e) {
        console.log('Could not access opener payment form:', e);
      }
    }
    
    if (calculatedAmount) {
      document.getElementById('amount').value = calculatedAmount;
    }
    
    // Handle callback URL from either old format or new returnUrl
    const callbackUrlParam = urlParams.get('callbackUrl') || returnUrl;
    if (callbackUrlParam && !customerDataStr) {
      // Decode the URL parameter
      const decodedCallbackUrl = decodeURIComponent(callbackUrlParam);

      document.getElementById('callbackUrlDisplay').classList.remove('hidden');
      document.getElementById('assignedCallbackUrl').textContent = decodedCallbackUrl;
      // Remove line about callbackUrlSelect since it no longer exists

      // Set the select value properly
      const selectElement = document.getElementById('callbackUrl');
      if (selectElement) {
        // Add as new option since this is a dynamic URL
        const newOption = document.createElement('option');
        newOption.value = decodedCallbackUrl;
        newOption.textContent = decodedCallbackUrl;
        newOption.selected = true;
        selectElement.appendChild(newOption);
      }
    }

    // Add event listeners to buttons
    // Find buttons in the action section by their class
    const actionButtons = document.querySelectorAll('.card .button-group .button');

    if (actionButtons.length >= 3) {
      // Simulate button (first button - button-primary)
      actionButtons[0].addEventListener('click', simulatePayment);

      // New Window button (second button - button-success)
      actionButtons[1].addEventListener('click', simulateInNewWindow);

      // Random button (third button - button-secondary)
      actionButtons[2].addEventListener('click', generateRandomData);
    }

    // Remove copy button functionality since we don't need it
    // Generate and display the full URL automatically
    if (document.getElementById('callbackUrl').value || document.getElementById('assignedCallbackUrl')?.textContent) {
      const url = generateCallbackUrl();
      document.getElementById('generatedUrl').classList.remove('hidden');
      document.getElementById('urlDisplay').textContent = url;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
  } else {
    initializePage();
  }
})();