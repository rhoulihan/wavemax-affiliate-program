/**
 * WaveMAX Payment Validation Utilities
 * Client-side validation for payment forms
 * PCI compliant - validates format only, no storage
 */

(function(window) {
    'use strict';

    const PaymentValidation = {
        // Card brand patterns
        cardPatterns: {
            visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
            mastercard: /^5[1-5][0-9]{14}$|^2[2-7][0-9]{14}$/,
            amex: /^3[47][0-9]{13}$/,
            discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
            diners: /^3(?:0[0-5]|[68][0-9])[0-9]{11}$/,
            jcb: /^(?:2131|1800|35\d{3})\d{11}$/
        },

        // Validation rules
        rules: {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            phone: /^[\d\s\-\+\(\)]+$/,
            zip: /^\d{5}(-\d{4})?$/,
            cvv: /^\d{3,4}$/,
            expiry: /^(0[1-9]|1[0-2])\/\d{2}$/,
            routingNumber: /^\d{9}$/,
            accountNumber: /^\d{8,17}$/
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
            
            if (!formData.billingAddress || formData.billingAddress.trim().length < 5) {
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
         * Validate payment method data
         */
        validatePaymentMethod(methodData) {
            const errors = [];
            
            if (!methodData.type) {
                errors.push('Please select a payment method type');
            }
            
            switch (methodData.type) {
                case 'card':
                    // In production, card validation would be handled by payment gateway
                    if (methodData.expiry && !this.validateExpiry(methodData.expiry)) {
                        errors.push('Please enter a valid expiry date (MM/YY)');
                    }
                    
                    if (methodData.cvv && !this.validateCVV(methodData.cvv)) {
                        errors.push('Please enter a valid CVV');
                    }
                    break;
                    
                case 'bank':
                    if (methodData.accountNumber && !this.validateAccountNumber(methodData.accountNumber)) {
                        errors.push('Please enter a valid account number');
                    }
                    
                    if (methodData.routingNumber && !this.validateRoutingNumber(methodData.routingNumber)) {
                        errors.push('Please enter a valid routing number');
                    }
                    break;
                    
                case 'paypal':
                    if (methodData.email && !this.validateEmail(methodData.email)) {
                        errors.push('Please enter a valid PayPal email');
                    }
                    break;
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
         * Validate card number using Luhn algorithm
         * NOTE: In production, this should be done by payment gateway
         */
        validateCardNumber(cardNumber) {
            // Remove spaces and non-digits
            const cleaned = cardNumber.replace(/\D/g, '');
            
            // Check length
            if (cleaned.length < 13 || cleaned.length > 19) {
                return false;
            }
            
            // Luhn algorithm
            let sum = 0;
            let isEven = false;
            
            for (let i = cleaned.length - 1; i >= 0; i--) {
                let digit = parseInt(cleaned.charAt(i), 10);
                
                if (isEven) {
                    digit *= 2;
                    if (digit > 9) {
                        digit -= 9;
                    }
                }
                
                sum += digit;
                isEven = !isEven;
            }
            
            return (sum % 10) === 0;
        },

        /**
         * Detect card brand from number
         */
        detectCardBrand(cardNumber) {
            const cleaned = cardNumber.replace(/\D/g, '');
            
            for (const [brand, pattern] of Object.entries(this.cardPatterns)) {
                if (pattern.test(cleaned)) {
                    return brand;
                }
            }
            
            return 'unknown';
        },

        /**
         * Format card number for display
         */
        formatCardNumber(cardNumber, brand = null) {
            const cleaned = cardNumber.replace(/\D/g, '');
            
            if (!brand) {
                brand = this.detectCardBrand(cleaned);
            }
            
            let formatted = '';
            
            if (brand === 'amex') {
                // Amex: 4-6-5
                formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
                if (formatted.length > 11) {
                    formatted = cleaned.slice(0, 4) + ' ' + cleaned.slice(4, 10) + ' ' + cleaned.slice(10, 15);
                }
            } else {
                // Others: 4-4-4-4
                formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
            }
            
            return formatted.trim();
        },

        /**
         * Validate expiry date
         */
        validateExpiry(expiry) {
            if (!this.rules.expiry.test(expiry)) {
                return false;
            }
            
            const [month, year] = expiry.split('/');
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear() % 100;
            const currentMonth = currentDate.getMonth() + 1;
            
            const expiryYear = parseInt(year, 10);
            const expiryMonth = parseInt(month, 10);
            
            // Check if expired
            if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
                return false;
            }
            
            return true;
        },

        /**
         * Validate CVV
         */
        validateCVV(cvv, cardBrand = null) {
            if (!this.rules.cvv.test(cvv)) {
                return false;
            }
            
            // Amex has 4-digit CVV, others have 3
            if (cardBrand === 'amex') {
                return cvv.length === 4;
            }
            
            return cvv.length === 3;
        },

        /**
         * Validate routing number
         */
        validateRoutingNumber(routingNumber) {
            if (!this.rules.routingNumber.test(routingNumber)) {
                return false;
            }
            
            // Validate checksum (US routing numbers)
            const digits = routingNumber.split('').map(Number);
            const checksum = (3 * (digits[0] + digits[3] + digits[6]) +
                            7 * (digits[1] + digits[4] + digits[7]) +
                            (digits[2] + digits[5] + digits[8])) % 10;
            
            return checksum === 0;
        },

        /**
         * Validate account number
         */
        validateAccountNumber(accountNumber) {
            return this.rules.accountNumber.test(accountNumber);
        },

        /**
         * Mask sensitive data for display
         */
        maskCardNumber(cardNumber) {
            const cleaned = cardNumber.replace(/\D/g, '');
            if (cleaned.length < 8) return cardNumber;
            
            const first4 = cleaned.slice(0, 4);
            const last4 = cleaned.slice(-4);
            const masked = '•'.repeat(cleaned.length - 8);
            
            return this.formatCardNumber(first4 + masked + last4);
        },

        /**
         * Mask account number
         */
        maskAccountNumber(accountNumber) {
            if (accountNumber.length < 4) return accountNumber;
            
            const last4 = accountNumber.slice(-4);
            const masked = '•'.repeat(accountNumber.length - 4);
            
            return masked + last4;
        },

        /**
         * Real-time input formatters
         */
        formatters: {
            /**
             * Format card number input in real-time
             */
            cardNumber(input) {
                let value = input.value.replace(/\s+/g, '');
                let formattedValue = '';
                
                for (let i = 0; i < value.length; i++) {
                    if (i > 0 && i % 4 === 0) {
                        formattedValue += ' ';
                    }
                    formattedValue += value[i];
                }
                
                input.value = formattedValue;
                
                // Detect and return card brand
                return PaymentValidation.detectCardBrand(value);
            },

            /**
             * Format expiry date input
             */
            expiry(input) {
                let value = input.value.replace(/\D/g, '');
                
                if (value.length >= 2) {
                    const month = value.slice(0, 2);
                    const year = value.slice(2, 4);
                    
                    // Ensure month is 01-12
                    if (parseInt(month) > 12) {
                        value = '12' + year;
                    }
                    
                    input.value = month + (year ? '/' + year : '');
                } else {
                    input.value = value;
                }
            },

            /**
             * Format CVV input
             */
            cvv(input, maxLength = 3) {
                input.value = input.value.replace(/\D/g, '').slice(0, maxLength);
            },

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
            // Card number formatter
            const cardInputs = container.querySelectorAll('[data-format="card-number"]');
            cardInputs.forEach(input => {
                input.addEventListener('input', () => {
                    const brand = this.formatters.cardNumber(input);
                    input.setAttribute('data-card-brand', brand);
                });
            });

            // Expiry formatter
            const expiryInputs = container.querySelectorAll('[data-format="expiry"]');
            expiryInputs.forEach(input => {
                input.addEventListener('input', () => this.formatters.expiry(input));
            });

            // CVV formatter
            const cvvInputs = container.querySelectorAll('[data-format="cvv"]');
            cvvInputs.forEach(input => {
                input.addEventListener('input', () => {
                    const cardBrand = input.getAttribute('data-card-brand') || 
                                     input.closest('form')?.querySelector('[data-card-brand]')?.getAttribute('data-card-brand');
                    const maxLength = cardBrand === 'amex' ? 4 : 3;
                    this.formatters.cvv(input, maxLength);
                });
            });

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
                cardNumber: 'Please enter a valid card number',
                expiry: 'Please enter a valid expiry date (MM/YY)',
                cvv: 'Please enter a valid security code',
                email: 'Please enter a valid email address',
                phone: 'Please enter a valid phone number',
                zip: 'Please enter a valid ZIP code',
                routingNumber: 'Please enter a valid routing number',
                accountNumber: 'Please enter a valid account number',
                required: `This field is required`,
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