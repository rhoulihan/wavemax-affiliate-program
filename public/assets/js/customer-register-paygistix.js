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
            
            // Initialize the Paygistix payment form with config
            paymentForm = new PaygistixPaymentForm('paymentFormContainer', {
                paymentConfig: paymentConfig,
                hideRegistrationFormRows: true, // Hide non-BF form rows in registration
                onSuccess: function() {
                    console.log('Payment form initialized with config:', paymentConfig);
                },
                onError: function(error) {
                    console.error('Payment form error:', error);
                    document.getElementById('paymentFormContainer').innerHTML = 
                        '<div class="text-red-600 p-4">Failed to load payment form. Please refresh the page.</div>';
                }
            });
            
            // Make paymentForm globally accessible
            window.paymentForm = paymentForm;
            
            // Update bag quantity when selection changes
            // Only update if there's already a selection
            setTimeout(() => {
                const numberOfBags = document.getElementById('numberOfBags').value;
                if (numberOfBags && numberOfBags !== '') {
                    updateBagQuantity();
                }
            }, 100);
            
        } catch (error) {
            console.error('Error initializing payment form:', error);
            document.getElementById('paymentFormContainer').innerHTML = 
                '<div class="text-red-600 p-4">Failed to load payment form. Please refresh the page.</div>';
        }
    }
    
    // Update bag quantity in payment form
    function updateBagQuantity() {
        const numberOfBags = document.getElementById('numberOfBags').value;
        console.log('updateBagQuantity called with numberOfBags:', numberOfBags);
        
        if (paymentForm && numberOfBags) {
            const quantity = parseInt(numberOfBags);
            console.log('Setting BF quantity to:', quantity);
            // Use the updateBagQuantity method from PaygistixPaymentForm
            paymentForm.updateBagQuantity(quantity);
        } else {
            console.log('PaymentForm not ready or numberOfBags is empty', {
                paymentForm: !!paymentForm,
                numberOfBags: numberOfBags
            });
        }
    }
    
    // Handle registration submission - Deprecated, now handled by PaygistixPaymentForm
    function handleRegistrationSubmit() {
        console.log('handleRegistrationSubmit called - this function is deprecated');
        // The Paygistix form now handles submission directly
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
        
        // Submit button is now handled by Paygistix form directly
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