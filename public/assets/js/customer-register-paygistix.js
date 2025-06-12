(function() {
    'use strict';

    let paymentForm = null;
    let paymentConfig = null;
    
    // Initialize payment form
    async function initializePaymentForm() {
        try {
            // Load payment configuration first
            console.log('Fetching payment config from /api/v1/payments/config');
            const configResponse = await fetch('/api/v1/payments/config');
            
            if (!configResponse.ok) {
                console.error('Config response status:', configResponse.status);
                const errorText = await configResponse.text();
                console.error('Config response error:', errorText);
                throw new Error(`Failed to load payment configuration: ${configResponse.status} ${configResponse.statusText}`);
            }
            
            const configData = await configResponse.json();
            console.log('Payment config data:', configData);
            
            if (!configData.success) {
                throw new Error(configData.message || 'Failed to load payment configuration');
            }
            
            paymentConfig = configData.config;
            
            // Initialize the Paygistix payment form
            // Note: The form uses hardcoded values from the Paygistix generator
            paymentForm = new PaygistixPaymentForm('paymentFormContainer', {
                onSuccess: function() {
                    console.log('Payment form initialized');
                },
                onError: function(error) {
                    console.error('Payment form error:', error);
                    document.getElementById('paymentFormContainer').innerHTML = 
                        '<div class="text-red-600 p-4">Failed to load payment form. Please refresh the page.</div>';
                }
            });
            
            // Update bag quantity when selection changes
            updateBagQuantity();
            
        } catch (error) {
            console.error('Error initializing payment form:', error);
            document.getElementById('paymentFormContainer').innerHTML = 
                '<div class="text-red-600 p-4">Failed to load payment form. Please refresh the page.</div>';
        }
    }
    
    // Update bag quantity in payment form
    function updateBagQuantity() {
        const numberOfBags = document.getElementById('numberOfBags').value;
        if (paymentForm && numberOfBags) {
            paymentForm.setPrefilledAmounts({
                BF: parseInt(numberOfBags)
            });
        }
    }
    
    // Handle registration submission
    function handleRegistrationSubmit() {
        const form = document.getElementById('customerRegistrationForm');
        
        // Validate form fields first
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // Check if payment form has valid data
        if (!paymentForm || paymentForm.getTotal() === 0) {
            if (window.modalAlert) {
                window.modalAlert('Please select the number of bags needed before proceeding.', 'Payment Required');
            } else {
                alert('Please select the number of bags needed before proceeding.');
            }
            return;
        }
        
        // Collect form data
        const formData = new FormData(form);
        const customerData = {};
        
        formData.forEach((value, key) => {
            customerData[key] = value;
        });
        
        // Store customer data for post-payment processing
        customerData.timestamp = Date.now();
        customerData.paymentPending = true;
        
        // Add customer ID to payment form
        if (paymentForm) {
            paymentForm.setOrderDetails({
                customerData: customerData,
                registrationType: 'new_customer'
            });
        }
        
        // Store in session for callback processing
        sessionStorage.setItem('pendingRegistration', JSON.stringify(customerData));
        
        // Submit the Paygistix payment form
        const paygistixForm = document.querySelector('#paygistixPaymentForm') || 
                              document.querySelector('form[action*="safepay"]') ||
                              document.querySelector('form[action*="transaction.asp"]');
        if (paygistixForm) {
            console.log('Submitting Paygistix form:', paygistixForm);
            paygistixForm.submit();
        } else {
            console.error('Paygistix form not found');
            if (window.modalAlert) {
                window.modalAlert('Payment form not ready. Please refresh the page and try again.', 'Payment Error');
            } else {
                alert('Payment form not ready. Please refresh the page and try again.');
            }
        }
    }
    
    // Initialize when DOM is ready
    function init() {
        // Initialize i18n first if available
        if (window.i18n && window.i18n.init) {
            window.i18n.init({ debugMode: false }).then(() => {
                if (window.LanguageSwitcher) {
                    window.LanguageSwitcher.createSwitcher('language-switcher-container', {
                        style: 'dropdown',
                        showLabel: false
                    });
                }
                // Ensure all elements are translated after initialization
                if (window.i18n && window.i18n.translatePage) {
                    window.i18n.translatePage();
                }
            });
        }
        
        // Initialize payment form
        initializePaymentForm();
        
        // Listen for bag quantity changes
        const numberOfBagsSelect = document.getElementById('numberOfBags');
        if (numberOfBagsSelect) {
            numberOfBagsSelect.addEventListener('change', function() {
                updateBagQuantity();
                // Update the bag fee display
                const numberOfBags = parseInt(this.value) || 0;
                const bagFee = 10.00; // Default, should match system config
                const total = numberOfBags * bagFee;
                const totalBagFeeElement = document.getElementById('totalBagFee');
                if (totalBagFeeElement) {
                    totalBagFeeElement.textContent = `$${total.toFixed(2)}`;
                }
            });
        }
        
        // Handle submit button click
        const submitButton = document.getElementById('submitRegistration');
        if (submitButton) {
            submitButton.addEventListener('click', handleRegistrationSubmit);
        }
    }
    
    // Check if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM is already loaded
        init();
    }
    
    // Export functions for global access if needed
    window.PaygistixRegistration = {
        updateBagQuantity: updateBagQuantity,
        handleRegistrationSubmit: handleRegistrationSubmit
    };

})();