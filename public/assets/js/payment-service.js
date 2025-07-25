/**
 * WaveMAX Payment Service
 * Handles payment processing API calls with CSRF protection
 */

(function(window) {
  'use strict';

  const PaymentService = {
    // Base configuration
    config: {
      apiBase: '/api',
      endpoints: {
        processPayment: '/payments',
        paymentIntent: '/payment-intent',
        paymentHistory: '/payment-history'
      }
    },

    /**
         * Initialize the payment service
         */
    init() {
      // Set up authenticated fetch if available
      if (window.CsrfUtils && window.CsrfUtils.createAuthenticatedFetch) {
        this.authenticatedFetch = window.CsrfUtils.createAuthenticatedFetch(() => {
          return localStorage.getItem('wavemax-token');
        });
      } else {
        // Fallback to regular fetch with manual auth
        this.authenticatedFetch = async (url, options = {}) => {
          const token = localStorage.getItem('wavemax-token');
          if (token) {
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Bearer ${token}`;
          }
          return window.CsrfUtils ? window.CsrfUtils.csrfFetch(url, options) : fetch(url, options);
        };
      }
    },

    /**
         * Create a payment intent for processing
         */
    async createPaymentIntent(amount, currency = 'USD', metadata = {}) {
      try {
        const response = await this.authenticatedFetch(
          `${this.config.apiBase}${this.config.endpoints.paymentIntent}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount,
              currency,
              metadata
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create payment intent');
        }

        return {
          success: true,
          clientSecret: data.clientSecret,
          paymentIntentId: data.paymentIntentId
        };
      } catch (error) {
        console.error('Error creating payment intent:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
         * Process a payment
         */
    async processPayment(paymentData) {
      try {
        // Validate required fields
        if (!paymentData.amount) {
          throw new Error('Amount is required');
        }

        // Create payment intent first if using a payment gateway
        if (paymentData.requiresIntent !== false) {
          const intentResult = await this.createPaymentIntent(
            paymentData.amount,
            paymentData.currency || 'USD',
            paymentData.metadata || {}
          );

          if (!intentResult.success) {
            throw new Error(intentResult.error);
          }

          paymentData.paymentIntentId = intentResult.paymentIntentId;
          paymentData.clientSecret = intentResult.clientSecret;
        }

        const response = await this.authenticatedFetch(
          `${this.config.apiBase}${this.config.endpoints.processPayment}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Payment processing failed');
        }

        return {
          success: true,
          payment: data.payment,
          orderId: data.orderId,
          confirmationNumber: data.confirmationNumber
        };
      } catch (error) {
        console.error('Error processing payment:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
         * Get payment history
         */
    async getPaymentHistory(options = {}) {
      try {
        const queryParams = new URLSearchParams();
        if (options.limit) queryParams.append('limit', options.limit);
        if (options.offset) queryParams.append('offset', options.offset);
        if (options.startDate) queryParams.append('startDate', options.startDate);
        if (options.endDate) queryParams.append('endDate', options.endDate);
        if (options.status) queryParams.append('status', options.status);

        const url = `${this.config.apiBase}${this.config.endpoints.paymentHistory}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

        const response = await this.authenticatedFetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch payment history');
        }

        return {
          success: true,
          payments: data.payments || [],
          total: data.total || 0,
          hasMore: data.hasMore || false
        };
      } catch (error) {
        console.error('Error fetching payment history:', error);
        return {
          success: false,
          error: error.message,
          payments: []
        };
      }
    },

    /**
         * Handle payment errors with user-friendly messages
         */
    getErrorMessage(error) {
      const errorMessages = {
        'card_declined': 'Your card was declined. Please try another payment method.',
        'insufficient_funds': 'Insufficient funds. Please try another payment method.',
        'invalid_card': 'Invalid card details. Please check and try again.',
        'expired_card': 'Your card has expired. Please use another card.',
        'processing_error': 'Payment processing error. Please try again.',
        'network_error': 'Network error. Please check your connection and try again.',
        'authentication_required': 'Additional authentication required. Please complete the verification.',
        'default': 'Payment failed. Please try again or contact support.'
      };

      return errorMessages[error.code] || errorMessages.default;
    },

    /**
         * Format amount for display
         */
    formatAmount(amount, currency = 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount / 100); // Assuming amount is in cents
    },

    /**
         * Check if payment methods are supported
         */
    async checkPaymentSupport() {
      const support = {
        applePay: false,
        googlePay: false,
        paymentRequest: false
      };

      // Check for Apple Pay
      if (window.ApplePaySession && ApplePaySession.canMakePayments()) {
        support.applePay = true;
      }

      // Check for Payment Request API (for Google Pay and others)
      if (window.PaymentRequest) {
        support.paymentRequest = true;

        // Check specifically for Google Pay
        try {
          const googlePayMethod = [{
            supportedMethods: 'https://google.com/pay',
            data: {
              environment: 'TEST',
              apiVersion: 2,
              apiVersionMinor: 0,
              merchantInfo: {
                merchantName: 'WaveMAX'
              },
              allowedPaymentMethods: [{
                type: 'CARD',
                parameters: {
                  allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                  allowedCardNetworks: ['VISA', 'MASTERCARD']
                }
              }]
            }
          }];

          const request = new PaymentRequest(googlePayMethod, {
            total: { label: 'Test', amount: { currency: 'USD', value: '1.00' } }
          });

          const canMakePayment = await request.canMakePayment();
          support.googlePay = canMakePayment;
        } catch (e) {
          // Google Pay not available
        }
      }

      return support;
    }
  };

  // Initialize the service
  PaymentService.init();

  // Expose to global scope
  window.PaymentService = PaymentService;

})(window);