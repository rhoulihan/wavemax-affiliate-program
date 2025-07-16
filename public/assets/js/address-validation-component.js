/**
 * Address Validation Component
 * Unified address validation for all registration forms and dashboards
 * Enforces strict validation - requires complete street address with zip code
 */

(function() {
  'use strict';

  class AddressValidationComponent {
    constructor(options = {}) {
      this.options = {
        addressField: options.addressField || 'address',
        cityField: options.cityField || 'city',
        stateField: options.stateField || 'state',
        zipField: options.zipField || 'zipCode',
        validateButton: options.validateButton || 'validateAddress',
        onSuccess: options.onSuccess || null,
        onError: options.onError || null,
        ...options
      };
      
      this.isValidating = false;
      this.init();
    }

    init() {
      this.setupValidationButton();
      this.setupFieldValidation();
    }

    setupValidationButton() {
      const button = document.getElementById(this.options.validateButton);
      if (button) {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          this.validateAddress();
        });
      }
    }

    setupFieldValidation() {
      // Add real-time validation to address field
      const addressField = document.getElementById(this.options.addressField);
      if (addressField) {
        addressField.addEventListener('blur', () => {
          this.validateAddressFormat(addressField.value);
        });
      }

      // Add zip code formatting
      const zipField = document.getElementById(this.options.zipField);
      if (zipField) {
        zipField.addEventListener('input', (e) => {
          // Remove non-digits
          e.target.value = e.target.value.replace(/\D/g, '');
          // Limit to 5 digits
          if (e.target.value.length > 5) {
            e.target.value = e.target.value.substr(0, 5);
          }
        });
      }
    }

    async validateAddress() {
      if (this.isValidating) return;
      
      // Get field values
      const address = document.getElementById(this.options.addressField)?.value?.trim();
      const city = document.getElementById(this.options.cityField)?.value?.trim();
      const state = document.getElementById(this.options.stateField)?.value?.trim();
      const zipCode = document.getElementById(this.options.zipField)?.value?.trim();

      // Validate all fields are filled
      if (!address || !city || !state || !zipCode) {
        this.showError('Please fill in all address fields');
        return;
      }

      // Validate address format
      const formatValidation = this.validateAddressFormat(address);
      if (!formatValidation.valid) {
        this.showError(formatValidation.message);
        return;
      }

      // Validate zip code format
      if (!/^\d{5}$/.test(zipCode)) {
        this.showError('ZIP code must be exactly 5 digits');
        return;
      }

      this.isValidating = true;
      
      // Show loading state
      const button = document.getElementById(this.options.validateButton);
      const originalText = button ? button.innerHTML : '';
      if (button) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating...';
        button.disabled = true;
      }
      
      // Show swirl spinner if available
      let formSpinner = null;
      if (window.SwirlSpinner) {
        const form = button.closest('form');
        if (form) {
          formSpinner = new window.SwirlSpinner({
            container: form,
            size: 'large',
            overlay: true,
            message: 'Validating address...'
          }).show();
        }
      }

      try {
        // Make API call to validate address
        const baseUrl = window.EMBED_CONFIG?.baseUrl || '';
        
        // Get CSRF token
        let csrfToken = window.csrfToken;
        if (!csrfToken) {
          // Try to get from meta tag
          const csrfMeta = document.querySelector('meta[name="csrf-token"]');
          if (csrfMeta) {
            csrfToken = csrfMeta.getAttribute('content');
          }
        }
        
        const response = await fetch(`${baseUrl}/api/v1/service-area/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || ''
          },
          credentials: 'include',
          body: JSON.stringify({ address, city, state, zipCode })
        });

        const result = await response.json();

        // Hide spinner before showing results
        if (formSpinner) {
          formSpinner.hide();
        }
        
        if (result.success && result.coordinates) {
          // Address is valid
          this.handleValidationSuccess({
            latitude: result.coordinates.latitude,
            longitude: result.coordinates.longitude,
            formattedAddress: result.formattedAddress || `${address}, ${city}, ${state} ${zipCode}`
          });
        } else {
          // Address validation failed
          const message = result.message || 'Unable to verify this address. Please check that the street address and zip code are correct.';
          this.showError(message);
        }

      } catch (error) {
        console.error('Address validation error:', error);
        this.showError('Unable to validate address at this time. Please try again.');
      } finally {
        this.isValidating = false;
        
        // Hide spinner
        if (formSpinner) {
          formSpinner.hide();
        }
        
        // Reset button state
        if (button && originalText) {
          button.innerHTML = originalText;
          button.disabled = false;
        }
      }
    }

    validateAddressFormat(address) {
      if (!address || address.trim().length < 5) {
        return {
          valid: false,
          message: 'Please enter a valid street address'
        };
      }
      
      // Must start with a house number
      const addressPattern = /^(\d+[A-Za-z]?)\s+(.+)$/;
      const match = address.trim().match(addressPattern);
      
      if (!match) {
        return {
          valid: false,
          message: 'Address must start with a house number (e.g., 123 Main Street)'
        };
      }
      
      const houseNumber = match[1];
      const streetPart = match[2];
      
      // House number validation
      const houseNum = parseInt(houseNumber);
      if (houseNum <= 0 || houseNum > 99999) {
        return {
          valid: false,
          message: 'Please enter a valid house number'
        };
      }
      
      // Street name validation
      if (streetPart.length < 2) {
        return {
          valid: false,
          message: 'Please enter a valid street name'
        };
      }
      
      // Check for incomplete patterns
      const incompletePatterns = [
        /^(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|pl|place|blvd|boulevard)$/i,
        /^\d+$/
      ];
      
      for (const pattern of incompletePatterns) {
        if (pattern.test(streetPart)) {
          return {
            valid: false,
            message: 'Please enter a complete street name'
          };
        }
      }
      
      return { valid: true };
    }

    handleValidationSuccess(data) {
      // Update hidden lat/lon fields if they exist
      const latField = document.getElementById('serviceLatitude');
      const lonField = document.getElementById('serviceLongitude');
      
      if (latField) latField.value = data.latitude;
      if (lonField) lonField.value = data.longitude;

      // Show success message
      this.showSuccess('Address validated successfully!');

      // Call custom success handler if provided
      if (this.options.onSuccess) {
        this.options.onSuccess(data);
      }

      // Store validated data globally for other components
      window.validatedAddressData = data;
    }

    showError(message) {
      // Remove any existing messages
      this.removeMessages();

      // Create error message element
      const errorDiv = document.createElement('div');
      errorDiv.className = 'mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg address-validation-message';
      errorDiv.innerHTML = `
        <div class="flex items-center">
          <i class="fas fa-exclamation-circle mr-2"></i>
          <span>${message}</span>
        </div>
      `;

      // Insert after validate button
      const button = document.getElementById(this.options.validateButton);
      if (button && button.parentNode) {
        button.parentNode.insertBefore(errorDiv, button.nextSibling);
      }

      // Call custom error handler if provided
      if (this.options.onError) {
        this.options.onError(message);
      }
    }

    showSuccess(message) {
      // Remove any existing messages
      this.removeMessages();

      // Create success message element
      const successDiv = document.createElement('div');
      successDiv.className = 'mt-2 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg address-validation-message';
      successDiv.innerHTML = `
        <div class="flex items-center">
          <i class="fas fa-check-circle mr-2"></i>
          <span>${message}</span>
        </div>
      `;

      // Insert after validate button
      const button = document.getElementById(this.options.validateButton);
      if (button && button.parentNode) {
        button.parentNode.insertBefore(successDiv, button.nextSibling);
      }

      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (successDiv.parentNode) {
          successDiv.remove();
        }
      }, 5000);
    }

    removeMessages() {
      document.querySelectorAll('.address-validation-message').forEach(el => el.remove());
    }

    // Get validated address data
    getValidatedData() {
      return window.validatedAddressData || null;
    }

    // Clear validated data
    clearValidatedData() {
      window.validatedAddressData = null;
      
      // Clear hidden fields
      const latField = document.getElementById('serviceLatitude');
      const lonField = document.getElementById('serviceLongitude');
      
      if (latField) latField.value = '';
      if (lonField) lonField.value = '';
    }
  }

  // Export to global namespace
  window.AddressValidationComponent = AddressValidationComponent;

})();