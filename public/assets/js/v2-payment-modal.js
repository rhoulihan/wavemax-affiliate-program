/**
 * V2 Payment Modal for Customer Dashboard
 * Handles credit card payments using Paygistix
 */

// Prevent duplicate loading
if (typeof V2PaymentModal === 'undefined') {

class V2PaymentModal {
  constructor() {
    this.modal = null;
    this.orderId = null;
    this.paymentToken = null;
    this.formConfig = null;
    this.statusCheckInterval = null;
    this.paymentWindow = null;
    this.paymentUrl = null;
  }

  /**
   * Initialize payment for an order
   * @param {string} orderId - The order ID to pay for
   */
  async initiatePayment(orderId) {
    try {
      this.orderId = orderId;
      
      // Show loading state
      this.showLoadingModal();
      
      // Get authentication token
      const authToken = localStorage.getItem('customerToken');
      if (!authToken) {
        throw new Error('No authentication token found. Please login again.');
      }
      
      // Get CSRF token
      const csrfToken = await this.getCsrfToken();
      
      // Initiate payment with backend
      const response = await fetch('/api/v2/customers/initiate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ orderId })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to initiate payment');
      }
      
      // Store payment data
      this.paymentToken = data.token;
      this.formConfig = data.formConfig;
      
      // Show payment form
      this.showPaymentForm(data);
      
      // Don't start polling here - it will be started when payment window opens
      
    } catch (error) {
      console.error('Payment initiation error:', error);
      this.showError(error.message);
    }
  }
  
  /**
   * Show loading modal
   */
  showLoadingModal() {
    const modalHtml = `
      <div id="v2PaymentModal" class="modal fade show modal-backdrop-dark d-block">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Processing Payment</h5>
            </div>
            <div class="modal-body text-center py-5">
              <div id="loadingSpinnerContainer"></div>
              <p class="mt-4">Initializing secure payment form...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    this.closeModal();

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modal = document.getElementById('v2PaymentModal');

    // Add spinner using SwirlSpinner class
    if (window.SwirlSpinner) {
      const spinnerContainer = document.getElementById('loadingSpinnerContainer');
      const spinner = new window.SwirlSpinner({
        size: 'default',
        speed: 'normal',
        container: spinnerContainer
      });
      spinner.show();
    }
  }
  
  /**
   * Show payment form with order summary and Pay button
   */
  showPaymentForm(paymentData) {
    const { token, formConfig, amount, lineItems, paygistixItems } = paymentData;
    
    // Store payment data for later use
    this.paymentToken = token;
    this.formConfig = formConfig;
    
    // Store both sets of line items
    this.displayLineItems = lineItems || []; // For display in modal
    this.lineItems = paygistixItems || lineItems || []; // For Paygistix form submission
    console.log('[V2 Payment] Display lineItems:', this.displayLineItems);
    console.log('[V2 Payment] Paygistix lineItems:', this.lineItems);
    
    // Build line items display
    const lineItemsHtml = lineItems.map(item => `
      <tr>
        <td>${item.description}</td>
        <td class="text-right">$${item.price.toFixed(2)}</td>
        <td class="text-center">x${item.quantity}</td>
        <td class="text-right">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');
    
    const modalHtml = `
      <div id="v2PaymentModal" class="modal fade show modal-backdrop-dark d-block">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Complete Payment</h5>
              <button type="button" class="close" data-action="cancel">
                <span>&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <div id="orderSummaryView">
                <h6>Order Summary</h6>
                <table class="table table-sm">
                  <tbody>
                    ${lineItemsHtml}
                  </tbody>
                  <tfoot>
                    <tr class="font-weight-bold">
                      <td colspan="3">Total</td>
                      <td class="text-right">$${amount.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
                <div class="alert alert-info">
                  <small>
                    <i class="fas fa-lock"></i> Secure payment processing by Paygistix
                  </small>
                </div>
              </div>
              
              <!-- Payment processing view (hidden initially) -->
              <div id="paymentProcessingView" class="d-none text-center">
                <div id="processingSpinnerContainer"></div>
                <h5 class="mt-4">Processing Payment</h5>
                <p class="text-muted">Please complete the payment in the popup window</p>
                <p class="text-sm text-secondary">If the popup window doesn't appear, please check your browser's popup blocker settings.</p>
                <div id="testModeCancelButton" class="d-none mt-3">
                  <button type="button" class="btn btn-warning" onclick="v2Payment.cancelTestPayment()">
                    Cancel Test Payment
                  </button>
                </div>
              </div>
              
              <!-- Payment status (hidden initially) -->
              <div id="paymentStatus" class="d-none">
                <div class="alert" role="alert">
                  <div class="d-flex align-items-center">
                    <span id="statusMessage"></span>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <div id="paymentButtons">
                <button type="button" class="btn btn-secondary" data-action="cancel">
                  Cancel
                </button>
                <button type="button" class="btn btn-primary" data-action="pay">
                  <i class="fas fa-credit-card"></i> Pay with Card
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Remove existing modal
    this.closeModal();
    
    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modal = document.getElementById('v2PaymentModal');
    
    // Add event listeners
    this.attachEventListeners();
  }
  
  /**
   * Attach event listeners to modal buttons
   */
  attachEventListeners() {
    if (!this.modal) return;
    
    // Cancel buttons
    const cancelButtons = this.modal.querySelectorAll('[data-action="cancel"]');
    cancelButtons.forEach(btn => {
      btn.addEventListener('click', () => this.cancelPayment());
    });
    
    // Pay button
    const payButton = this.modal.querySelector('[data-action="pay"]');
    if (payButton) {
      payButton.addEventListener('click', () => this.openPaymentWindow());
    }
  }
  
  /**
   * Open payment window with POST form submission
   */
  openPaymentWindow() {
    // Calculate window position
    const width = 800;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    // Open popup window
    const paymentWindow = window.open(
      'about:blank',
      'paygistixPayment',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    if (!paymentWindow) {
      // Popup blocked
      const statusDiv = document.getElementById('paymentStatus');
      const statusMessage = document.getElementById('statusMessage');
      if (statusDiv && statusMessage) {
        statusDiv.classList.remove('d-none');
        statusDiv.querySelector('.alert').className = 'alert alert-warning';
        statusMessage.innerHTML = `
          <i class="fas fa-exclamation-triangle"></i> 
          Please allow pop-ups for this site to complete payment. 
          Check your browser's address bar for the pop-up blocker icon.
        `;
      }
      return;
    }
    
    // Create and submit form in the popup window
    this.submitPaymentForm(paymentWindow);
    
    // Switch to processing view
    const orderSummary = document.getElementById('orderSummaryView');
    const processingView = document.getElementById('paymentProcessingView');
    const paymentButtons = document.getElementById('paymentButtons');
    const testCancelButton = document.getElementById('testModeCancelButton');

    if (orderSummary) orderSummary.classList.add('d-none');
    if (processingView) processingView.classList.remove('d-none');
    if (paymentButtons) paymentButtons.classList.add('d-none');

    // Add spinner to processing view using SwirlSpinner class
    setTimeout(() => {
      if (window.SwirlSpinner) {
        const processingSpinnerContainer = document.getElementById('processingSpinnerContainer');
        console.log('[V2Payment] Processing spinner container:', processingSpinnerContainer);
        if (processingSpinnerContainer && !processingSpinnerContainer.querySelector('.swirl-spinner')) {
          console.log('[V2Payment] Creating SwirlSpinner for processing view');
          const spinner = new window.SwirlSpinner({
            size: 'default',
            speed: 'normal',
            container: processingSpinnerContainer
          });
          spinner.show();
          console.log('[V2Payment] SwirlSpinner shown');
        } else {
          console.log('[V2Payment] Spinner already exists or container not found');
        }
      } else {
        console.warn('[V2Payment] SwirlSpinner class not available');
      }
    }, 100);

    // Show cancel button if in test mode
    if (this.formConfig?.testModeEnabled && testCancelButton) {
      testCancelButton.classList.remove('d-none');
    }
    
    // Store payment window reference
    this.paymentWindow = paymentWindow;
    
    // Start polling for payment status
    this.startStatusPolling();
    
    // Also check if window is closed
    this.checkWindowClosed();
  }
  
  /**
   * Submit payment form to Paygistix in the popup window
   */
  submitPaymentForm(paymentWindow) {
    try {
      // Log the form configuration for debugging
      console.log('[V2 Payment] Form configuration:', {
        merchantId: this.formConfig.merchantId,
        formId: this.formConfig.formId,
        formHash: this.formConfig.formHash,
        formActionUrl: this.formConfig.formActionUrl,
        callbackUrl: this.formConfig.callbackUrl,
        testModeEnabled: this.formConfig.testModeEnabled
      });
      
      // Check if test mode is enabled
      if (this.formConfig.testModeEnabled) {
        console.log('[V2 Payment] Test mode enabled, using test payment form');
        this.submitTestPaymentForm(paymentWindow);
        return;
      }
      
      // Build the form HTML with all required fields for production
      const formHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Processing Payment...</title>
          <link rel="stylesheet" href="/assets/css/payment-redirect.css">
        </head>
        <body class="payment-redirect">
          <div class="loading">
            <p>Redirecting to payment processor...</p>
          </div>
          <form id="paygistixForm" action="${this.formConfig.formActionUrl}" method="POST">
            <!-- Line items must come first -->
            ${this.buildLineItemFields()}
            
            <!-- Paygistix required fields at the end -->
            <input type="hidden" name="txnType" value="FORM">
            <input type="hidden" name="merchantID" value="${this.formConfig.merchantId || ''}">
            <input type="hidden" name="formID" value="${this.formConfig.formId}">
            <input type="hidden" name="hash" value="${this.formConfig.formHash}">
            <input type="hidden" name="ReturnURL" value="${this.formConfig.callbackUrl}">
          </form>
          <script src="/assets/js/payment-redirect.js"></script>
        </body>
        </html>
      `;
      
      // Write the form HTML to the popup window
      paymentWindow.document.write(formHtml);
      paymentWindow.document.close();
      
    } catch (error) {
      console.error('Error submitting payment form:', error);
      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.close();
      }
      this.showError('Failed to open payment form. Please try again.');
    }
  }
  
  /**
   * Build line item hidden fields for Paygistix form
   * Uses the EXACT structure expected by Paygistix with ALL products
   */
  buildLineItemFields() {
    // Define the complete form structure exactly as Paygistix expects
    const formStructure = [
      { index: 1, code: 'MDF10', description: 'Minimum Delivery Fee', price: 10.00 },
      { index: 2, code: 'MDF15', description: 'Minimum Delivery Fee', price: 15.00 },
      { index: 3, code: 'MDF20', description: 'Minimum Delivery Fee', price: 20.00 },
      { index: 4, code: 'MDF25', description: 'Minimum Delivery Fee', price: 25.00 },
      { index: 5, code: 'MDF30', description: 'Minimum Delivery Fee', price: 30.00 },
      { index: 6, code: 'MDF35', description: 'Minimum Delivery Fee', price: 35.00 },
      { index: 7, code: 'MDF40', description: 'Minimum Delivery Fee', price: 40.00 },
      { index: 8, code: 'MDF45', description: 'Minimum Delivery Fee', price: 45.00 },
      { index: 9, code: 'MDF50', description: 'Minimum Delivery Fee', price: 50.00 },
      { index: 10, code: 'PBF5', description: 'Per Bag Fee', price: 5.00 },
      { index: 11, code: 'PBF10', description: 'Per Bag Fee', price: 10.00 },
      { index: 12, code: 'PBF15', description: 'Per Bag Fee', price: 15.00 },
      { index: 13, code: 'PBF20', description: 'Per Bag Fee', price: 20.00 },
      { index: 14, code: 'PBF25', description: 'Per Bag Fee', price: 25.00 },
      { index: 15, code: 'WDF', description: 'Wash Dry Fold', price: 1.25 },
      { index: 16, code: 'WDF1', description: 'Wash Dry Fold (1 Add-on)', price: 1.35 },
      { index: 17, code: 'WDF2', description: 'Wash Dry Fold (2 Add-on)', price: 1.45 },
      { index: 18, code: 'WDF3', description: 'Wash Dry Fold (3 Add-on)', price: 1.55 }
    ];

    // Create a map of our actual line items
    const itemMap = {};
    
    console.log('[V2 Payment] Line items received:', this.lineItems);
    
    if (this.lineItems && this.lineItems.length > 0) {
      this.lineItems.forEach(item => {
        // Map our items to the exact codes Paygistix expects
        if (item.code) {
          itemMap[item.code] = item.quantity || 0;
          console.log(`[V2 Payment] Mapping ${item.code}: quantity=${item.quantity}, price=${item.price}`);
        }
      });
    }

    // Log what we're sending
    console.log('[V2 Payment] Item map for Paygistix:', itemMap);

    // Build ALL fields with quantities set appropriately
    let fieldsHtml = '';
    formStructure.forEach(product => {
      const quantity = itemMap[product.code] || 0;
      fieldsHtml += `
        <input type="hidden" name="pxCode${product.index}" value="${product.code}">
        <input type="hidden" name="pxDescription${product.index}" value="${product.description}">
        <input type="hidden" name="pxPrice${product.index}" value="${product.price}">
        <input type="hidden" name="pxQty${product.index}" value="${quantity}">
      `;
    });

    return fieldsHtml;
  }
  
  /**
   * Submit test payment form in the popup window
   */
  submitTestPaymentForm(paymentWindow) {
    try {
      console.log('[V2 Payment] Submitting test payment form');
      
      // Calculate total amount from line items
      let totalAmount = 0;
      if (this.lineItems && this.lineItems.length > 0) {
        this.lineItems.forEach(item => {
          totalAmount += (item.price * item.quantity);
        });
      }
      
      // Add message listener for test payment completion
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'test-payment-complete') {
          console.log('[V2 Payment] Received test payment completion:', event.data);
          
          // Remove the listener
          window.removeEventListener('message', messageHandler);
          
          // The test form will redirect to the callback URL which will handle the payment
          // We just need to start polling for the payment status
          this.startStatusPolling();
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Build test form HTML
      const formHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Payment Form</title>
          <link rel="stylesheet" href="/assets/css/payment-redirect.css">
        </head>
        <body class="payment-redirect">
          <div class="loading">
            <p>Redirecting to test payment form...</p>
          </div>
          <form id="testPaymentForm" action="/test-payment" method="GET">
            <!-- Pass necessary data to test form -->
            <input type="hidden" name="paymentToken" value="${this.paymentToken}">
            <input type="hidden" name="amount" value="${totalAmount.toFixed(2)}">
            <input type="hidden" name="callbackUrl" value="${encodeURIComponent(this.formConfig.callbackUrl)}">
            <input type="hidden" name="orderId" value="${this.displayLineItems?.[0]?.orderId || ''}">
            
            <!-- Pass line items as JSON -->
            <input type="hidden" name="items" value="${encodeURIComponent(JSON.stringify(this.lineItems))}">
          </form>
          <script src="/assets/js/payment-redirect.js"></script>
        </body>
        </html>
      `;
      
      // Write the form HTML to the popup window
      paymentWindow.document.write(formHtml);
      paymentWindow.document.close();
      
    } catch (error) {
      console.error('Error submitting test payment form:', error);
      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.close();
      }
      this.showError('Failed to open test payment form. Please try again.');
    }
  }
  
  /**
   * Check if payment window was closed
   */
  checkWindowClosed() {
    let paymentCompleted = false;
    const windowOpenedAt = Date.now();
    const isTestMode = this.formConfig?.testModeEnabled === true;
    
    // For test mode, we need to wait longer and use different detection
    // because the window navigates from about:blank to /test-payment
    const minCheckTime = isTestMode ? 10000 : 5000; // Test mode needs more time
    
    // Mark payment as completed when we handle it
    this.paymentCompletedCallback = () => {
      paymentCompleted = true;
    };
    
    const checkInterval = setInterval(() => {
      // Stop checking if payment was completed
      if (paymentCompleted) {
        clearInterval(checkInterval);
        return;
      }
      
      // Don't check too early - give window time to navigate and process
      const timeElapsed = Date.now() - windowOpenedAt;
      if (timeElapsed < minCheckTime) {
        return;
      }
      
      // Try to check if window is closed
      try {
        // For test mode, the window might appear closed after navigation
        // So we rely more on the payment status polling and user action
        if (isTestMode) {
          // For test form, only consider it closed if we can't access it at all
          // or if enough time has passed and it's truly closed
          if (this.paymentWindow) {
            try {
              // Try to access a property - if window is truly closed, this will throw
              const windowLocation = this.paymentWindow.location.href;
              // If we can access it, window is still open (even if closed property says otherwise)
            } catch (accessError) {
              // Can't access window properties - it's either closed or navigated away
              // For test mode, we'll rely on status polling unless we're sure it's closed
              if (this.paymentWindow.closed === true && timeElapsed > 15000) {
                // Window is definitely closed after 15 seconds
                clearInterval(checkInterval);
                this.handleWindowClosed();
              }
            }
          }
        } else {
          // Production mode - normal check
          if (this.paymentWindow && this.paymentWindow.closed === true) {
            clearInterval(checkInterval);
            this.handleWindowClosed();
          }
        }
      } catch (e) {
        // Can't access window.closed (cross-origin), keep polling for status
        // The payment status polling will handle completion
      }
    }, 1000);
    
    // Store the interval so we can clear it later
    this.windowCheckInterval = checkInterval;
  }
  
  /**
   * Handle when payment window is closed
   */
  handleWindowClosed() {
    // Stop status polling if running
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
    
    // Only hide spinner and show order summary if payment wasn't completed
    const orderSummary = document.getElementById('orderSummaryView');
    const processingView = document.getElementById('paymentProcessingView');
    const paymentButtons = document.getElementById('paymentButtons');
    
    if (orderSummary) orderSummary.classList.remove('d-none');
    if (processingView) processingView.classList.add('d-none');
    if (paymentButtons) paymentButtons.classList.remove('d-none');
    
    console.log('[V2 Payment] Payment window closed by user');
  }
  
  /**
   * Start polling for payment status
   * Uses the V1 payment token status endpoint since both V1 and V2 use the same PaymentToken collection
   */
  startStatusPolling() {
    // Clear any existing interval
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
    
    // Poll every 3 seconds using the V1 endpoint (both V1 and V2 use same PaymentToken collection)
    this.statusCheckInterval = setInterval(async () => {
      try {
        const authToken = localStorage.getItem('customerToken');
        const response = await fetch(`/api/v1/payments/check-status/${this.paymentToken}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        const data = await response.json();
        
        if (data.success && data.status !== 'pending' && data.status !== 'processing') {
          // Payment completed (success, failed, or cancelled)
          clearInterval(this.statusCheckInterval);
          this.handlePaymentComplete(data);
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    }, 3000);
  }
  
  /**
   * Cancel test payment
   */
  cancelTestPayment() {
    console.log('[V2 Payment] Test payment cancelled by user');
    
    // Mark as completed to stop checking
    if (this.paymentCompletedCallback) {
      this.paymentCompletedCallback();
    }
    
    // Clear intervals
    if (this.windowCheckInterval) {
      clearInterval(this.windowCheckInterval);
      this.windowCheckInterval = null;
    }
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
    
    // Close payment window if open
    if (this.paymentWindow && !this.paymentWindow.closed) {
      this.paymentWindow.close();
      this.paymentWindow = null;
    }
    
    // Show order summary again
    const orderSummary = document.getElementById('orderSummaryView');
    const processingView = document.getElementById('paymentProcessingView');
    const paymentButtons = document.getElementById('paymentButtons');
    const testCancelButton = document.getElementById('testModeCancelButton');
    
    if (orderSummary) orderSummary.classList.remove('d-none');
    if (processingView) processingView.classList.add('d-none');
    if (paymentButtons) paymentButtons.classList.remove('d-none');
    if (testCancelButton) testCancelButton.classList.add('d-none');
  }
  
  /**
   * Handle payment completion
   */
  handlePaymentComplete(data) {
    // Mark payment as completed for window check
    if (this.paymentCompletedCallback) {
      this.paymentCompletedCallback();
    }
    
    // Clear window check interval
    if (this.windowCheckInterval) {
      clearInterval(this.windowCheckInterval);
      this.windowCheckInterval = null;
    }
    
    // Close payment window if still open
    if (this.paymentWindow && !this.paymentWindow.closed) {
      this.paymentWindow.close();
    }
    
    const statusDiv = document.getElementById('paymentStatus');
    const statusMessage = document.getElementById('statusMessage');
    const processingView = document.getElementById('paymentProcessingView');
    const testCancelButton = document.getElementById('testModeCancelButton');
    const alert = statusDiv.querySelector('.alert');
    
    if (!statusDiv) return;
    
    // Hide processing view and test cancel button, show status
    if (processingView) processingView.classList.add('d-none');
    if (testCancelButton) testCancelButton.classList.add('d-none');
    statusDiv.classList.remove('d-none');
    
    if (data.status === 'success') {
      alert.className = 'alert alert-success';
      statusMessage.innerHTML = `
        <i class="fas fa-check-circle"></i> Payment successful! 
        Transaction ID: ${data.transactionId || 'N/A'}
      `;
      
      // Reload page after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } else {
      alert.className = 'alert alert-danger';
      statusMessage.innerHTML = `
        <i class="fas fa-exclamation-circle"></i> Payment failed: 
        ${data.errorMessage || 'Transaction was not successful'}
      `;
      
      // Show buttons again so user can retry
      const paymentButtons = document.getElementById('paymentButtons');
      if (paymentButtons) paymentButtons.classList.remove('d-none');
    }
  }
  
  /**
   * Cancel payment
   */
  async cancelPayment() {
    try {
      // Stop status polling
      if (this.statusCheckInterval) {
        clearInterval(this.statusCheckInterval);
      }
      
      // Cancel payment token if exists
      if (this.paymentToken) {
        const authToken = localStorage.getItem('customerToken');
        const csrfToken = await this.getCsrfToken();
        await fetch(`/api/v1/payments/cancel-token/${this.paymentToken}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'x-csrf-token': csrfToken
          }
        });
      }
      
      // Close modal
      this.closeModal();
      
    } catch (error) {
      console.error('Error cancelling payment:', error);
      this.closeModal();
    }
  }
  
  /**
   * Show error message
   */
  showError(message) {
    const modalHtml = `
      <div id="v2PaymentModal" class="modal fade show modal-backdrop-dark d-block">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-danger text-white">
              <h5 class="modal-title">Payment Error</h5>
              <button type="button" class="close text-white" onclick="v2Payment.closeModal()">
                <span>&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i> ${message}
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="v2Payment.closeModal()">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Remove existing modal
    this.closeModal();
    
    // Add error modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modal = document.getElementById('v2PaymentModal');
  }
  
  /**
   * Close modal
   */
  closeModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    
    // Close payment window if open
    if (this.paymentWindow && !this.paymentWindow.closed) {
      this.paymentWindow.close();
      this.paymentWindow = null;
    }
    
    // Stop status polling
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
    
    // Stop window checking
    if (this.windowCheckInterval) {
      clearInterval(this.windowCheckInterval);
      this.windowCheckInterval = null;
    }
  }
  
  /**
   * Get CSRF token
   */
  async getCsrfToken() {
    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      return null;
    }
  }
}

// Create global instance
const v2Payment = new V2PaymentModal();

// Make it available globally
window.v2Payment = v2Payment;

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = V2PaymentModal;
}

} // End of duplicate loading check