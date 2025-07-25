/**
 * WaveMAX Payment Form Component
 * Handles payment form rendering and submission
 * Simplified version - no payment method storage
 */

(function(window) {
  'use strict';

  class PaymentForm {
    constructor(options = {}) {
      this.container = options.container || '#payment-form-container';
      this.onSuccess = options.onSuccess || (() => {});
      this.onError = options.onError || (() => {});
      this.amount = options.amount || 0;
      this.currency = options.currency || 'USD';
      this.customerData = options.customerData || {};
      this.formData = {};
      this.isProcessing = false;

      // Initialize on DOM ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.init());
      } else {
        this.init();
      }
    }

    async init() {
      await this.render();
      this.attachEventListeners();
    }

    async render() {
      const container = document.querySelector(this.container);
      if (!container) {
        console.error('Payment form container not found');
        return;
      }

      container.innerHTML = `
                <div class="payment-form-wrapper">
                    <!-- Payment Form -->
                    <form id="payment-form" class="payment-form">
                        <!-- Billing Information -->
                        <div class="billing-section mb-6">
                            <h3 class="text-lg font-semibold mb-4" data-i18n="payment.form.billingInfo">Billing Information</h3>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="form-group">
                                    <label for="billing-name" class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.form.fullName">
                                        Full Name
                                    </label>
                                    <input type="text" id="billing-name" name="billingName" 
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           required data-i18n-placeholder="payment.form.fullNamePlaceholder">
                                </div>

                                <div class="form-group">
                                    <label for="billing-email" class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.form.email">
                                        Email
                                    </label>
                                    <input type="email" id="billing-email" name="billingEmail" 
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           required data-i18n-placeholder="payment.form.emailPlaceholder">
                                </div>

                                <div class="form-group">
                                    <label for="billing-phone" class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.form.phone">
                                        Phone
                                    </label>
                                    <input type="tel" id="billing-phone" name="billingPhone" 
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           data-i18n-placeholder="payment.form.phonePlaceholder">
                                </div>

                                <div class="form-group">
                                    <label for="billing-zip" class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.form.zipCode">
                                        ZIP Code
                                    </label>
                                    <input type="text" id="billing-zip" name="billingZip" 
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           required data-i18n-placeholder="payment.form.zipCodePlaceholder">
                                </div>
                            </div>
                        </div>

                        <!-- Terms and Conditions -->
                        <div class="terms-section mb-6">
                            <div class="flex items-start">
                                <input type="checkbox" id="terms-checkbox" name="acceptTerms" 
                                       class="mr-2 mt-1" required>
                                <label for="terms-checkbox" class="text-sm text-gray-700">
                                    <span data-i18n="payment.form.termsPrefix">I agree to the</span>
                                    <a href="/terms-and-conditions" target="_blank" class="text-blue-600 hover:underline" data-i18n="payment.form.termsLink">
                                        Terms and Conditions
                                    </a>
                                </label>
                            </div>
                        </div>

                        <!-- Submit Button -->
                        <div class="submit-section">
                            <button type="submit" id="submit-payment-btn" 
                                    class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                <span class="button-text" data-i18n="payment.form.submitButton">
                                    Complete Payment
                                </span>
                                <span class="loading-spinner hidden">
                                    <i class="fas fa-spinner fa-spin mr-2"></i>
                                    <span data-i18n="payment.form.processing">Processing...</span>
                                </span>
                            </button>
                        </div>

                        <!-- Messages -->
                        <div id="payment-messages" class="mt-4">
                            <div class="success-message hidden bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
                                <i class="fas fa-check-circle mr-2"></i>
                                <span data-i18n="payment.form.successMessage">Payment completed successfully!</span>
                            </div>
                            <div class="error-message hidden bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
                                <i class="fas fa-exclamation-circle mr-2"></i>
                                <span class="error-text"></span>
                            </div>
                        </div>
                    </form>
                </div>
            `;

      // Apply translations if i18n is available
      if (window.i18n && window.i18n.applyTranslations) {
        window.i18n.applyTranslations();
      }
    }

    attachEventListeners() {
      const form = document.getElementById('payment-form');
      if (form) {
        form.addEventListener('submit', (e) => this.handleSubmit(e));
      }

      // Terms checkbox validation
      const termsCheckbox = document.getElementById('terms-checkbox');
      const submitBtn = document.getElementById('submit-payment-btn');
      
      if (termsCheckbox && submitBtn) {
        termsCheckbox.addEventListener('change', () => {
          submitBtn.disabled = !termsCheckbox.checked || this.isProcessing;
        });
        // Initial state
        submitBtn.disabled = !termsCheckbox.checked;
      }

      // Pre-fill customer data if available
      this.prefillCustomerData();
    }

    prefillCustomerData() {
      if (this.customerData.name) {
        const nameInput = document.getElementById('billing-name');
        if (nameInput) nameInput.value = this.customerData.name;
      }
      if (this.customerData.email) {
        const emailInput = document.getElementById('billing-email');
        if (emailInput) emailInput.value = this.customerData.email;
      }
      if (this.customerData.phone) {
        const phoneInput = document.getElementById('billing-phone');
        if (phoneInput) phoneInput.value = this.customerData.phone;
      }
      if (this.customerData.zip) {
        const zipInput = document.getElementById('billing-zip');
        if (zipInput) zipInput.value = this.customerData.zip;
      }
    }

    async handleSubmit(e) {
      e.preventDefault();

      if (this.isProcessing) return;

      // Show processing state
      this.setProcessingState(true);

      // Hide previous messages
      this.hideMessages();

      try {
        // Get form data
        const formData = new FormData(e.target);
        this.formData = Object.fromEntries(formData);

        // Validate form
        if (!this.validateForm()) {
          throw new Error('Please fill in all required fields');
        }

        // Prepare payment data
        const paymentData = {
          amount: this.amount,
          currency: this.currency,
          billingInfo: {
            name: this.formData.billingName,
            email: this.formData.billingEmail,
            phone: this.formData.billingPhone,
            zip: this.formData.billingZip
          },
          metadata: {
            customerId: this.customerData.id,
            orderType: this.customerData.orderType || 'order'
          }
        };

        const result = await window.PaymentService.processPayment(paymentData);

        if (result.success) {
          this.showSuccess();
          this.onSuccess(result);
        } else {
          throw new Error(result.error || 'Payment failed');
        }

      } catch (error) {
        console.error('Payment error:', error);
        this.showError(error.message);
        this.onError(error);
      } finally {
        this.setProcessingState(false);
      }
    }

    validateForm() {
      const required = ['billingName', 'billingEmail', 'billingZip'];
      for (const field of required) {
        if (!this.formData[field] || this.formData[field].trim() === '') {
          return false;
        }
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.formData.billingEmail)) {
        return false;
      }

      // Validate terms acceptance
      if (!this.formData.acceptTerms) {
        return false;
      }

      return true;
    }

    setProcessingState(isProcessing) {
      this.isProcessing = isProcessing;
      const submitBtn = document.getElementById('submit-payment-btn');
      const buttonText = submitBtn.querySelector('.button-text');
      const loadingSpinner = submitBtn.querySelector('.loading-spinner');

      if (isProcessing) {
        submitBtn.disabled = true;
        buttonText.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
      } else {
        const termsCheckbox = document.getElementById('terms-checkbox');
        submitBtn.disabled = !termsCheckbox.checked;
        buttonText.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
      }
    }

    showSuccess() {
      const messagesContainer = document.getElementById('payment-messages');
      const successMessage = messagesContainer.querySelector('.success-message');
      successMessage.classList.remove('hidden');
    }

    showError(message) {
      const messagesContainer = document.getElementById('payment-messages');
      const errorMessage = messagesContainer.querySelector('.error-message');
      const errorText = errorMessage.querySelector('.error-text');
      
      errorText.textContent = message;
      errorMessage.classList.remove('hidden');
    }

    hideMessages() {
      const messagesContainer = document.getElementById('payment-messages');
      messagesContainer.querySelectorAll('.success-message, .error-message').forEach(msg => {
        msg.classList.add('hidden');
      });
    }

    // Public methods
    updateAmount(amount) {
      this.amount = amount;
    }

    updateCustomerData(data) {
      this.customerData = { ...this.customerData, ...data };
      this.prefillCustomerData();
    }

    reset() {
      const form = document.getElementById('payment-form');
      if (form) form.reset();
      this.formData = {};
      this.isProcessing = false;
      this.hideMessages();
    }
  }

  // Expose to global scope
  window.PaymentForm = PaymentForm;

})(window);