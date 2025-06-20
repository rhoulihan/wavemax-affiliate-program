/**
 * WaveMAX Payment Service
 * Handles all payment-related API calls with CSRF protection
 */

(function(window) {
  'use strict';

  const PaymentService = {
    // Base configuration
    config: {
      apiBase: '/api',
      endpoints: {
        paymentMethods: '/payment-methods',
        processPayment: '/payments',
        paymentIntent: '/payment-intent',
        paymentHistory: '/payment-history',
        validateCard: '/validate-card'
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
         * Get all payment methods for the current user
         */
    async getPaymentMethods() {
      try {
        const response = await this.authenticatedFetch(
          `${this.config.apiBase}${this.config.endpoints.paymentMethods}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch payment methods');
        }

        return {
          success: true,
          methods: data.methods || []
        };
      } catch (error) {
        console.error('Error fetching payment methods:', error);
        return {
          success: false,
          error: error.message,
          methods: []
        };
      }
    },

    /**
         * Add a new payment method
         */
    async addPaymentMethod(methodData) {
      try {
        // Validate required fields
        if (!methodData.type) {
          throw new Error('Payment method type is required');
        }

        // Prepare the data based on method type
        const paymentMethodData = this.prepareMethodData(methodData);

        const response = await this.authenticatedFetch(
          `${this.config.apiBase}${this.config.endpoints.paymentMethods}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentMethodData)
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add payment method');
        }

        return {
          success: true,
          method: data.method
        };
      } catch (error) {
        console.error('Error adding payment method:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
         * Update a payment method
         */
    async updatePaymentMethod(methodId, updates) {
      try {
        const response = await this.authenticatedFetch(
          `${this.config.apiBase}${this.config.endpoints.paymentMethods}/${methodId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update payment method');
        }

        return {
          success: true,
          method: data.method
        };
      } catch (error) {
        console.error('Error updating payment method:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
         * Delete a payment method
         */
    async deletePaymentMethod(methodId) {
      try {
        const response = await this.authenticatedFetch(
          `${this.config.apiBase}${this.config.endpoints.paymentMethods}/${methodId}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete payment method');
        }

        return {
          success: true,
          message: data.message
        };
      } catch (error) {
        console.error('Error deleting payment method:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
         * Set a payment method as default
         */
    async setDefaultMethod(methodId) {
      try {
        const response = await this.authenticatedFetch(
          `${this.config.apiBase}${this.config.endpoints.paymentMethods}/${methodId}/default`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to set default payment method');
        }

        return {
          success: true,
          message: data.message
        };
      } catch (error) {
        console.error('Error setting default payment method:', error);
        return {
          success: false,
          error: error.message
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
        if (!paymentData.amount || !paymentData.paymentMethodId) {
          throw new Error('Amount and payment method are required');
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
         * Validate card details (for real-time validation)
         */
    async validateCard(cardNumber) {
      try {
        // Only send first 6 and last 4 digits for BIN checking
        const sanitizedNumber = cardNumber.replace(/\s/g, '');
        const validationData = {
          bin: sanitizedNumber.slice(0, 6),
          last4: sanitizedNumber.slice(-4)
        };

        const response = await this.authenticatedFetch(
          `${this.config.apiBase}${this.config.endpoints.validateCard}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(validationData)
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Card validation failed');
        }

        return {
          success: true,
          valid: data.valid,
          cardBrand: data.cardBrand,
          cardType: data.cardType
        };
      } catch (error) {
        console.error('Error validating card:', error);
        return {
          success: false,
          error: error.message,
          valid: false
        };
      }
    },

    /**
         * Prepare method data based on type
         */
    prepareMethodData(methodData) {
      const baseData = {
        type: methodData.type,
        nickname: methodData.nickname || '',
        isDefault: methodData.isDefault || false
      };

      switch (methodData.type) {
      case 'card':
        return {
          ...baseData,
          // In production, you'd tokenize the card details first
          cardToken: methodData.cardToken || 'test_token',
          last4: methodData.last4 || '4242',
          brand: methodData.brand || 'Visa',
          expiryMonth: methodData.expiryMonth,
          expiryYear: methodData.expiryYear
        };

      case 'bank':
        return {
          ...baseData,
          // In production, you'd use Plaid or similar for bank accounts
          accountToken: methodData.accountToken || 'test_bank_token',
          last4: methodData.last4 || '6789',
          bankName: methodData.bankName || 'Test Bank'
        };

      case 'paypal':
        return {
          ...baseData,
          paypalEmail: methodData.email,
          paypalId: methodData.paypalId
        };

      default:
        return baseData;
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