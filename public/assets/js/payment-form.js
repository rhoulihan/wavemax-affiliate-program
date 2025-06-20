/**
 * WaveMAX Payment Form Component
 * Handles payment form rendering and validation
 * PCI compliant - no raw card data handling
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
      this.selectedMethod = null;
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
      await this.loadPaymentMethods();
    }

    async render() {
      const container = document.querySelector(this.container);
      if (!container) {
        console.error('Payment form container not found');
        return;
      }

      container.innerHTML = `
                <div class="payment-form-wrapper">
                    <!-- Payment Method Selection -->
                    <div class="payment-methods-section mb-6">
                        <h3 class="text-lg font-semibold mb-4" data-i18n="payment.form.selectMethod">Select Payment Method</h3>
                        <div id="payment-methods-list" class="grid gap-3">
                            <!-- Dynamic payment methods will be loaded here -->
                            <div class="loading-spinner text-center py-4">
                                <i class="fas fa-spinner fa-spin text-2xl text-blue-600"></i>
                                <p class="text-gray-600 mt-2" data-i18n="common.loading">Loading payment methods...</p>
                            </div>
                        </div>
                    </div>

                    <!-- Payment Form -->
                    <form id="payment-form" class="payment-form" style="display: none;">
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

                            <div class="form-group mt-4">
                                <label for="billing-address" class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.form.address">
                                    Billing Address
                                </label>
                                <input type="text" id="billing-address" name="billingAddress" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       required data-i18n-placeholder="payment.form.addressPlaceholder">
                            </div>
                        </div>

                        <!-- Card Element Container (for Stripe/Payment Gateway integration) -->
                        <div class="card-section mb-6" id="card-section" style="display: none;">
                            <h3 class="text-lg font-semibold mb-4" data-i18n="payment.form.cardDetails">Card Details</h3>
                            <div class="card-element-container p-4 border border-gray-300 rounded-md">
                                <div id="card-element">
                                    <!-- Payment gateway card element will be mounted here -->
                                    <p class="text-gray-500 text-sm" data-i18n="payment.form.securePayment">
                                        Secure card input will be loaded here
                                    </p>
                                </div>
                                <div id="card-errors" class="text-red-600 text-sm mt-2" role="alert"></div>
                            </div>
                        </div>

                        <!-- Order Summary -->
                        <div class="order-summary mb-6 p-4 bg-gray-50 rounded-lg">
                            <h3 class="text-lg font-semibold mb-3" data-i18n="payment.form.orderSummary">Order Summary</h3>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-700" data-i18n="payment.form.total">Total Amount</span>
                                <span class="text-xl font-bold text-blue-600" id="total-amount">$0.00</span>
                            </div>
                        </div>

                        <!-- Terms and Conditions -->
                        <div class="terms-section mb-6">
                            <label class="flex items-start cursor-pointer">
                                <input type="checkbox" id="terms-checkbox" name="acceptTerms" 
                                       class="mt-1 mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500" required>
                                <span class="text-sm text-gray-700">
                                    <span data-i18n="payment.form.agreeToTerms">I agree to the</span>
                                    <a href="/terms-of-service.html" target="_blank" class="text-blue-600 hover:underline" data-i18n="payment.form.termsOfService">Terms of Service</a>
                                    <span data-i18n="payment.form.and">and</span>
                                    <a href="/privacy-policy.html" target="_blank" class="text-blue-600 hover:underline" data-i18n="payment.form.privacyPolicy">Privacy Policy</a>
                                </span>
                            </label>
                        </div>

                        <!-- Submit Button -->
                        <div class="submit-section">
                            <button type="submit" id="submit-payment" 
                                    class="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled>
                                <span class="button-text" data-i18n="payment.form.submitPayment">Complete Payment</span>
                                <span class="button-spinner hidden">
                                    <i class="fas fa-spinner fa-spin mr-2"></i>
                                    <span data-i18n="payment.form.processing">Processing...</span>
                                </span>
                            </button>
                        </div>

                        <!-- Security Notice -->
                        <div class="security-notice mt-4 text-center">
                            <p class="text-sm text-gray-600">
                                <i class="fas fa-lock mr-1"></i>
                                <span data-i18n="payment.form.securityNotice">Your payment information is encrypted and secure</span>
                            </p>
                        </div>
                    </form>

                    <!-- Error Messages -->
                    <div id="payment-errors" class="hidden mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p class="text-red-700 font-semibold" data-i18n="payment.form.errorTitle">Payment Error</p>
                        <p id="error-message" class="text-red-600 text-sm mt-1"></p>
                    </div>

                    <!-- Success Message -->
                    <div id="payment-success" class="hidden mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p class="text-green-700 font-semibold" data-i18n="payment.form.successTitle">Payment Successful!</p>
                        <p class="text-green-600 text-sm mt-1" data-i18n="payment.form.successMessage">Your payment has been processed successfully.</p>
                    </div>
                </div>
            `;

      // Update total amount display
      this.updateTotalAmount();

      // Translate the form
      if (window.i18n) {
        window.i18n.translatePage();
      }
    }

    async loadPaymentMethods() {
      try {
        const response = await window.PaymentService.getPaymentMethods();
        const methodsList = document.getElementById('payment-methods-list');

        if (!response.success || !response.methods || response.methods.length === 0) {
          methodsList.innerHTML = `
                        <div class="text-center py-4 text-gray-600">
                            <p data-i18n="payment.form.noMethodsAvailable">No payment methods available</p>
                        </div>
                    `;
          return;
        }

        methodsList.innerHTML = response.methods.map(method => `
                    <div class="payment-method-option border rounded-lg p-4 cursor-pointer hover:border-blue-500 transition duration-200"
                         data-method-id="${method.id}" data-method-type="${method.type}">
                        <div class="flex items-center">
                            <i class="fas ${this.getMethodIcon(method.type)} text-2xl mr-3 text-gray-600"></i>
                            <div class="flex-1">
                                <h4 class="font-semibold">${method.name}</h4>
                                ${method.last4 ? `<p class="text-sm text-gray-600">•••• ${method.last4}</p>` : ''}
                            </div>
                            <div class="radio-indicator w-5 h-5 border-2 border-gray-400 rounded-full"></div>
                        </div>
                    </div>
                `).join('');

        // Add new payment method option
        methodsList.innerHTML += `
                    <div class="payment-method-option border border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition duration-200"
                         data-method-id="new" data-method-type="new">
                        <div class="flex items-center justify-center text-blue-600">
                            <i class="fas fa-plus-circle text-2xl mr-2"></i>
                            <span class="font-semibold" data-i18n="payment.form.addNewMethod">Add New Payment Method</span>
                        </div>
                    </div>
                `;

        // Translate new content
        if (window.i18n) {
          window.i18n.translatePage();
        }

        // Auto-select first method if available
        const firstMethod = methodsList.querySelector('.payment-method-option');
        if (firstMethod) {
          this.selectPaymentMethod(firstMethod);
        }

      } catch (error) {
        console.error('Error loading payment methods:', error);
        document.getElementById('payment-methods-list').innerHTML = `
                    <div class="text-center py-4 text-red-600">
                        <p data-i18n="payment.form.errorLoadingMethods">Error loading payment methods</p>
                    </div>
                `;
      }
    }

    getMethodIcon(type) {
      const icons = {
        'card': 'fa-credit-card',
        'bank': 'fa-university',
        'paypal': 'fa-paypal',
        'apple_pay': 'fa-apple-pay',
        'google_pay': 'fa-google-pay',
        'default': 'fa-wallet'
      };
      return icons[type] || icons.default;
    }

    selectPaymentMethod(methodElement) {
      // Remove previous selection
      document.querySelectorAll('.payment-method-option').forEach(el => {
        el.classList.remove('border-blue-500', 'bg-blue-50');
        const indicator = el.querySelector('.radio-indicator');
        if (indicator) {
          indicator.classList.remove('bg-blue-600');
          indicator.innerHTML = '';
        }
      });

      // Add selection to clicked method
      methodElement.classList.add('border-blue-500', 'bg-blue-50');
      const indicator = methodElement.querySelector('.radio-indicator');
      if (indicator) {
        indicator.classList.add('bg-blue-600');
        indicator.innerHTML = '<div class="w-2 h-2 bg-white rounded-full mx-auto mt-1"></div>';
      }

      // Store selected method
      this.selectedMethod = {
        id: methodElement.dataset.methodId,
        type: methodElement.dataset.methodType
      };

      // Show payment form
      const form = document.getElementById('payment-form');
      form.style.display = 'block';

      // Show/hide card section based on method type
      const cardSection = document.getElementById('card-section');
      if (this.selectedMethod.type === 'new' || this.selectedMethod.type === 'card') {
        cardSection.style.display = 'block';
        this.initializeCardElement();
      } else {
        cardSection.style.display = 'none';
      }

      // Enable submit button if terms are accepted
      this.updateSubmitButton();
    }

    initializeCardElement() {
      // This is where you would initialize Stripe Elements or similar
      // For now, we'll just show a placeholder
      const cardElement = document.getElementById('card-element');
      cardElement.innerHTML = `
                <div class="text-sm text-gray-600">
                    <p data-i18n="payment.form.cardElementPlaceholder">Card payment integration would be initialized here</p>
                    <p class="text-xs mt-2" data-i18n="payment.form.testMode">Test mode: Any valid card number will work</p>
                </div>
            `;
    }

    updateTotalAmount() {
      const totalElement = document.getElementById('total-amount');
      if (totalElement) {
        totalElement.textContent = window.i18n ?
          window.i18n.formatCurrency(this.amount, this.currency) :
          `$${this.amount.toFixed(2)}`;
      }
    }

    updateSubmitButton() {
      const submitBtn = document.getElementById('submit-payment');
      const termsCheckbox = document.getElementById('terms-checkbox');

      if (submitBtn && termsCheckbox) {
        submitBtn.disabled = !termsCheckbox.checked || !this.selectedMethod || this.isProcessing;
      }
    }

    attachEventListeners() {
      // Payment method selection
      document.addEventListener('click', (e) => {
        const methodOption = e.target.closest('.payment-method-option');
        if (methodOption) {
          this.selectPaymentMethod(methodOption);
        }
      });

      // Terms checkbox
      const termsCheckbox = document.getElementById('terms-checkbox');
      if (termsCheckbox) {
        termsCheckbox.addEventListener('change', () => this.updateSubmitButton());
      }

      // Form submission
      const form = document.getElementById('payment-form');
      if (form) {
        form.addEventListener('submit', (e) => this.handleSubmit(e));
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
    }

    async handleSubmit(e) {
      e.preventDefault();

      if (this.isProcessing) return;

      // Show processing state
      this.setProcessingState(true);

      // Hide previous messages
      this.hideMessages();

      try {
        // Collect form data
        const formData = new FormData(e.target);
        this.formData = Object.fromEntries(formData);

        // Validate form
        const validation = window.PaymentValidation.validatePaymentForm(this.formData);
        if (!validation.valid) {
          throw new Error(validation.errors.join(', '));
        }

        // Process payment
        const paymentData = {
          amount: this.amount,
          currency: this.currency,
          paymentMethodId: this.selectedMethod.id,
          billingDetails: {
            name: this.formData.billingName,
            email: this.formData.billingEmail,
            phone: this.formData.billingPhone,
            address: {
              line1: this.formData.billingAddress,
              postal_code: this.formData.billingZip
            }
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

    setProcessingState(processing) {
      this.isProcessing = processing;
      const submitBtn = document.getElementById('submit-payment');

      if (submitBtn) {
        submitBtn.disabled = processing;
        const buttonText = submitBtn.querySelector('.button-text');
        const buttonSpinner = submitBtn.querySelector('.button-spinner');

        if (processing) {
          buttonText.classList.add('hidden');
          buttonSpinner.classList.remove('hidden');
        } else {
          buttonText.classList.remove('hidden');
          buttonSpinner.classList.add('hidden');
        }
      }
    }

    hideMessages() {
      document.getElementById('payment-errors')?.classList.add('hidden');
      document.getElementById('payment-success')?.classList.add('hidden');
    }

    showError(message) {
      const errorContainer = document.getElementById('payment-errors');
      const errorMessage = document.getElementById('error-message');

      if (errorContainer && errorMessage) {
        errorMessage.textContent = message;
        errorContainer.classList.remove('hidden');
        errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    showSuccess() {
      const successContainer = document.getElementById('payment-success');
      if (successContainer) {
        successContainer.classList.remove('hidden');
        successContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Public methods
    updateAmount(amount, currency = 'USD') {
      this.amount = amount;
      this.currency = currency;
      this.updateTotalAmount();
    }

    reset() {
      const form = document.getElementById('payment-form');
      if (form) {
        form.reset();
      }
      this.selectedMethod = null;
      this.formData = {};
      this.hideMessages();
      this.loadPaymentMethods();
    }
  }

  // Expose to global scope
  window.PaymentForm = PaymentForm;

})(window);