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
            <div class="modal-body text-center">
              <div class="spinner-border text-primary" role="status">
                <span class="sr-only">Loading...</span>
              </div>
              <p class="mt-3">Initializing secure payment form...</p>
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
                <div class="swirl-spinner-container">
                  <div class="swirl-spinner">
                    <div class="swirl-spinner-circle"></div>
                    <div class="swirl-spinner-circle swirl-spinner-circle-2"></div>
                    <div class="swirl-spinner-circle swirl-spinner-circle-3"></div>
                  </div>
                </div>
                <h5 class="mt-4">Processing Payment</h5>
                <p class="text-muted">Please complete the payment in the popup window</p>
                <p class="text-sm text-secondary">If the popup window doesn't appear, please check your browser's popup blocker settings.</p>
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
    
    if (orderSummary) orderSummary.classList.add('d-none');
    if (processingView) processingView.classList.remove('d-none');
    if (paymentButtons) paymentButtons.classList.add('d-none');
    
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
        callbackUrl: this.formConfig.callbackUrl
      });
      
      // Build the form HTML with all required fields
      const formHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Processing Payment...</title>
          <link rel="stylesheet" href="/assets/css/payment-redirect.css">
        </head>
        <body class="payment-redirect">
          <div class="loading">
            <div class="spinner"></div>
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
   * Check if payment window was closed
   */
  checkWindowClosed() {
    const checkInterval = setInterval(() => {
      if (this.paymentWindow && this.paymentWindow.closed) {
        clearInterval(checkInterval);
        
        // If no payment was completed, show the order summary again
        const orderSummary = document.getElementById('orderSummaryView');
        const processingView = document.getElementById('paymentProcessingView');
        const paymentButtons = document.getElementById('paymentButtons');
        
        if (orderSummary) orderSummary.classList.remove('d-none');
        if (processingView) processingView.classList.add('d-none');
        if (paymentButtons) paymentButtons.classList.remove('d-none');
      }
    }, 1000);
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
   * Handle payment completion
   */
  handlePaymentComplete(data) {
    // Close payment window if still open
    if (this.paymentWindow && !this.paymentWindow.closed) {
      this.paymentWindow.close();
    }
    
    const statusDiv = document.getElementById('paymentStatus');
    const statusMessage = document.getElementById('statusMessage');
    const processingView = document.getElementById('paymentProcessingView');
    const alert = statusDiv.querySelector('.alert');
    
    if (!statusDiv) return;
    
    // Hide processing view, show status
    if (processingView) processingView.classList.add('d-none');
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