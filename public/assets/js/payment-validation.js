/**
 * WaveMAX Payment Validation Utilities
 * Client-side validation for payment forms
 * Simplified version - basic form validation only
 */

(function(window) {
  'use strict';

  const PaymentValidation = {
    // Validation rules
    rules: {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\d\s\-\+\(\)]+$/,
      zip: /^\d{5}(-\d{4})?$/
    },

    /**
         * Validate entire payment form
         */
    validatePaymentForm(formData) {
      const errors = [];

      // Validate billing information
      if (!formData.billingName || formData.billingName.trim().length < 2) {
        errors.push('Please enter a valid name');
      }

      if (!this.validateEmail(formData.billingEmail)) {
        errors.push('Please enter a valid email address');
      }

      if (formData.billingPhone && !this.validatePhone(formData.billingPhone)) {
        errors.push('Please enter a valid phone number');
      }

      if (!this.validateZipCode(formData.billingZip)) {
        errors.push('Please enter a valid ZIP code');
      }

      if (formData.billingAddress && formData.billingAddress.trim().length < 5) {
        errors.push('Please enter a valid billing address');
      }

      if (!formData.acceptTerms) {
        errors.push('Please accept the terms and conditions');
      }

      return {
        valid: errors.length === 0,
        errors: errors
      };
    },

    /**
         * Validate email format
         */
    validateEmail(email) {
      return this.rules.email.test(email);
    },

    /**
         * Validate phone number format
         */
    validatePhone(phone) {
      const cleaned = phone.replace(/[\s\-\(\)]/g, '');
      return cleaned.length >= 10 && this.rules.phone.test(phone);
    },

    /**
         * Validate ZIP code
         */
    validateZipCode(zip) {
      return this.rules.zip.test(zip);
    },

    /**
         * Real-time input formatters
         */
    formatters: {
      /**
             * Format phone number input
             */
      phone(input) {
        let value = input.value.replace(/\D/g, '');

        if (value.length > 0) {
          if (value.length <= 3) {
            value = `(${value}`;
          } else if (value.length <= 6) {
            value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
          } else {
            value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
          }
        }

        input.value = value;
      },

      /**
             * Format ZIP code input
             */
      zip(input) {
        let value = input.value.replace(/\D/g, '');

        if (value.length > 5) {
          value = value.slice(0, 5) + '-' + value.slice(5, 9);
        }

        input.value = value;
      }
    },

    /**
         * Attach formatters to input fields
         */
    attachFormatters(container = document) {
      // Phone formatter
      const phoneInputs = container.querySelectorAll('[data-format="phone"]');
      phoneInputs.forEach(input => {
        input.addEventListener('input', () => this.formatters.phone(input));
      });

      // ZIP formatter
      const zipInputs = container.querySelectorAll('[data-format="zip"]');
      zipInputs.forEach(input => {
        input.addEventListener('input', () => this.formatters.zip(input));
      });
    },

    /**
         * Get user-friendly error messages
         */
    getErrorMessage(field, value = '') {
      const messages = {
        email: 'Please enter a valid email address',
        phone: 'Please enter a valid phone number',
        zip: 'Please enter a valid ZIP code',
        required: 'This field is required',
        minLength: `This field must be at least ${value} characters`,
        maxLength: `This field must be no more than ${value} characters`
      };

      return messages[field] || 'Please enter a valid value';
    }
  };

  // Auto-attach formatters when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      PaymentValidation.attachFormatters();
    });
  } else {
    PaymentValidation.attachFormatters();
  }

  // Expose to global scope
  window.PaymentValidation = PaymentValidation;

})(window);