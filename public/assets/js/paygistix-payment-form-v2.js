// CSP-compliant Paygistix Payment Form
class PaygistixPaymentForm {
    constructor(options) {
        this.container = options.container;
        this.paymentConfig = options.paymentConfig || window.PAYMENT_CONFIG;
        this.onSuccess = options.onSuccess || (() => {});
        this.onError = options.onError || (() => {});
        this.onPaymentSuccess = options.onPaymentSuccess;
        this.onPaymentFailure = options.onPaymentFailure;
        this.payContext = options.payContext || 'PAYMENT';
        this.affiliateId = options.affiliateId;
        this.affiliateSettings = null;
        this.hideRegistrationFormRows = options.hideRegistrationFormRows !== false;
        this.isProcessingPayment = false;
        this.paymentToken = null;
        
        this.init();
    }
    
    async init() {
        try {
            if (!this.container) {
                throw new Error('Container element is required');
            }
            
            // Show loading state
            this.showLoading();
            
            // Load external CSS
            this.loadStyles();
            
            // Load affiliate settings if provided and in ORDER context
            if (this.affiliateId && this.payContext === 'ORDER') {
                await this.loadAffiliateSettings();
            }
            
            // Render the form
            this.render();
            
            // Initialize visibility and event handlers
            this.initializeVisibility();
            this.loadPaygistixScript();
            
            // Setup submit handler for both contexts
            this.setupSubmitHandler();
            
            // Call success callback
            this.onSuccess();
        } catch (error) {
            console.error('Error initializing payment form:', error);
            this.showError(error.message);
            this.onError(error);
        }
    }
    
    loadStyles() {
        // Check if styles are already loaded
        if (!document.querySelector('link[href*="paygistix-payment-form.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/assets/css/paygistix-payment-form.css';
            document.head.appendChild(link);
        }
    }
    
    showLoading() {
        // Clear container and create loading message
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'payment-loading';
        
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        
        const message = document.createElement('p');
        message.textContent = 'Loading payment form...';
        
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(message);
        this.container.appendChild(loadingDiv);
    }
    
    showError(message) {
        // Clear container and create error message
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'payment-error';
        
        const strong = document.createElement('strong');
        strong.textContent = 'Configuration Error:';
        
        const text = document.createTextNode(' ' + message);
        
        errorDiv.appendChild(strong);
        errorDiv.appendChild(text);
        this.container.appendChild(errorDiv);
    }
    
    async loadAffiliateSettings() {
        try {
            const response = await fetch('/api/v1/affiliates/public/pricing/' + this.affiliateId, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load affiliate settings');
            }
            
            const data = await response.json();
            
            if (data.success && data.affiliate) {
                this.affiliateSettings = data.affiliate;
                console.log('Loaded affiliate settings:', this.affiliateSettings);
            }
        } catch (error) {
            console.error('Error loading affiliate settings:', error);
        }
    }
    
    createFormElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'className') {
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Add children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        });
        
        return element;
    }
    
    createTableRow(code, description, price, qtyIndex, hideByDefault = false) {
        const tr = this.createFormElement('tr', hideByDefault ? { className: 'hidden-row' } : {});
        
        // Code cell
        const codeCell = this.createFormElement('td', { className: 'pxCode' }, [
            code,
            this.createFormElement('input', {
                type: 'hidden',
                name: `pxCode${qtyIndex}`,
                value: code
            })
        ]);
        
        // Description cell
        const descCell = this.createFormElement('td', { className: 'pxDescription' }, [
            description,
            this.createFormElement('input', {
                type: 'hidden',
                name: `pxDescription${qtyIndex}`,
                value: description
            })
        ]);
        
        // Price cell
        const priceCell = this.createFormElement('td', { className: 'pxPrice' }, [
            `$${price}`,
            this.createFormElement('input', {
                type: 'hidden',
                name: `pxPrice${qtyIndex}`,
                id: `pxPrice${qtyIndex}`,
                value: price
            })
        ]);
        
        // Quantity cell
        const qtyInput = this.createFormElement('input', {
            type: 'text',
            className: 'pxQty',
            name: `pxQty${qtyIndex}`,
            id: `pxQty${qtyIndex}`,
            value: '0',
            maxlength: '3'
        });
        const qtyCell = this.createFormElement('td', {}, [qtyInput]);
        
        tr.appendChild(codeCell);
        tr.appendChild(descCell);
        tr.appendChild(priceCell);
        tr.appendChild(qtyCell);
        
        return tr;
    }
    
    render() {
        // Validate configuration
        if (!this.paymentConfig) {
            this.showError('Payment configuration not loaded. Please contact support.');
            return;
        }
        
        const requiredFields = ['merchantId', 'formId', 'formHash', 'formActionUrl', 'returnUrl'];
        const missingFields = requiredFields.filter(field => !this.paymentConfig[field]);
        
        if (missingFields.length > 0) {
            this.showError(`Missing required payment configuration fields: ${missingFields.join(', ')}`);
            return;
        }
        
        // Clear container
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        
        // Create wrapper
        const wrapper = this.createFormElement('div', { className: 'paygistix-payment-wrapper' });
        
        // Create form
        const form = this.createFormElement('form', {
            action: this.paymentConfig.formActionUrl,
            method: 'post',
            id: 'paygistixPaymentForm'
        });
        
        // Create table
        const table = this.createFormElement('table', {
            id: 'pxForm',
            name: 'pxForm'
        });
        
        // Create thead
        const thead = this.createFormElement('thead');
        const headerRow = this.createFormElement('tr', {}, [
            this.createFormElement('th', { textContent: 'Code' }),
            this.createFormElement('th', { textContent: 'Item' }),
            this.createFormElement('th', { textContent: 'Price' }),
            this.createFormElement('th', { textContent: 'Qty' })
        ]);
        thead.appendChild(headerRow);
        
        // Create tbody with all rows
        const tbody = this.createFormElement('tbody');
        
        // Define all payment items
        const paymentItems = [
            { code: 'WDF', description: 'Wash Dry Fold Service', price: '1.25' },
            { code: 'BF', description: 'Bag Fee', price: '10.00' },
            { code: 'PBF5', description: 'Per Bag Delivery Fee', price: '5.00', hide: true },
            { code: 'PBF10', description: 'Per Bag Delivery Fee', price: '10.00', hide: true },
            { code: 'PBF15', description: 'Per Bag Delivery Fee', price: '15.00', hide: true },
            { code: 'PBF20', description: 'Per Bag Delivery Fee', price: '20.00', hide: true },
            { code: 'PBF25', description: 'Per Bag Delivery Fee', price: '25.00', hide: true },
            { code: 'MDF10', description: 'Minimum Delivery Fee', price: '10.00', hide: true },
            { code: 'MDF15', description: 'Minimum Delivery Fee', price: '15.00', hide: true },
            { code: 'MDF20', description: 'Minimum Delivery Fee', price: '20.00', hide: true },
            { code: 'MDF25', description: 'Minimum Delivery Fee', price: '25.00', hide: true },
            { code: 'MDF30', description: 'Minimum Delivery Fee', price: '30.00', hide: true },
            { code: 'MDF35', description: 'Minimum Delivery Fee', price: '35.00', hide: true },
            { code: 'MDF40', description: 'Minimum Delivery Fee', price: '40.00', hide: true },
            { code: 'MDF45', description: 'Minimum Delivery Fee', price: '45.00', hide: true },
            { code: 'MDF50', description: 'Minimum Delivery Fee', price: '50.00', hide: true }
        ];
        
        // Add all rows
        paymentItems.forEach((item, index) => {
            const row = this.createTableRow(
                item.code,
                item.description,
                item.price,
                index + 1,
                item.hide || false
            );
            tbody.appendChild(row);
        });
        
        // Create tfoot
        const tfoot = this.createFormElement('tfoot');
        const footerRow = this.createFormElement('tr');
        const footerCell = this.createFormElement('td', {
            colspan: '4',
            align: 'right'
        });
        
        const totalSpan = this.createFormElement('span', {
            id: 'pxTotal'
        }, [
            this.createFormElement('b', { textContent: 'Total $0.00' })
        ]);
        
        const submitButton = this.createFormElement('input', {
            type: 'submit',
            id: 'pxSubmit',
            value: 'Pay Now'
        });
        
        footerCell.appendChild(totalSpan);
        footerCell.appendChild(submitButton);
        footerRow.appendChild(footerCell);
        tfoot.appendChild(footerRow);
        
        // Assemble table
        table.appendChild(thead);
        table.appendChild(tbody);
        table.appendChild(tfoot);
        
        // Add hidden fields
        const hiddenFields = [
            { name: 'txnType', value: 'FORM' },
            { name: 'merchantID', value: this.paymentConfig.merchantId },
            { name: 'formID', value: this.paymentConfig.formId },
            { name: 'hash', value: this.paymentConfig.formHash },
            { name: 'ReturnURL', value: this.paymentConfig.returnUrl, id: 'returnUrlField' }
        ];
        
        // Add table to form
        form.appendChild(table);
        
        // Add hidden fields to form
        hiddenFields.forEach(field => {
            const input = this.createFormElement('input', {
                type: 'hidden',
                name: field.name,
                value: field.value
            });
            if (field.id) {
                input.id = field.id;
            }
            form.appendChild(input);
        });
        
        // Add form to wrapper
        wrapper.appendChild(form);
        
        // Add wrapper to container
        this.container.appendChild(wrapper);
    }
    
    initializeVisibility() {
        const rows = this.container.querySelectorAll('tbody tr');
        
        console.log('Initializing visibility - Context:', this.payContext, 'Affiliate settings:', !!this.affiliateSettings);
        
        if (this.payContext === 'REGISTRATION' && this.hideRegistrationFormRows) {
            // Hide all rows initially for registration
            rows.forEach(row => {
                row.classList.add('hidden-row');
            });
            
            // Show specific rows based on affiliate settings
            if (this.affiliateSettings) {
                const minFee = this.affiliateSettings.minimumDeliveryFee;
                const perBagFee = this.affiliateSettings.perBagDeliveryFee;
                
                // Always show bag fee row (index 1)
                if (rows[1]) {
                    rows[1].classList.remove('hidden-row');
                }
                
                // Show the appropriate delivery fee rows
                this.showDeliveryFeeRows(rows, minFee, perBagFee);
            }
        } else if (this.payContext === 'PAYMENT') {
            // For payment context, hide WDF and show appropriate fee rows
            if (rows[0]) rows[0].classList.add('hidden-row'); // Hide WDF
            if (rows[1]) rows[1].classList.add('hidden-row'); // Hide Bag Fee
            
            if (this.affiliateSettings) {
                const minFee = this.affiliateSettings.minimumDeliveryFee;
                const perBagFee = this.affiliateSettings.perBagDeliveryFee;
                this.showDeliveryFeeRows(rows, minFee, perBagFee);
            }
        }
    }
    
    showDeliveryFeeRows(rows, minFee, perBagFee) {
        // Map fee amounts to row indices
        const perBagFeeMap = {
            5: 2, 10: 3, 15: 4, 20: 5, 25: 6
        };
        const minFeeMap = {
            10: 7, 15: 8, 20: 9, 25: 10, 30: 11,
            35: 12, 40: 13, 45: 14, 50: 15
        };
        
        // Show per bag fee row
        const perBagIndex = perBagFeeMap[perBagFee];
        if (perBagIndex !== undefined && rows[perBagIndex]) {
            rows[perBagIndex].classList.remove('hidden-row');
        }
        
        // Show minimum fee row
        const minFeeIndex = minFeeMap[minFee];
        if (minFeeIndex !== undefined && rows[minFeeIndex]) {
            rows[minFeeIndex].classList.remove('hidden-row');
        }
    }
    
    loadPaygistixScript() {
        // Use the correct Paygistix script URL (not the jQuery-specific one)
        const scriptUrl = 'https://safepay.paymentlogistics.net/form.js';
        
        // Check if script is already loaded
        if (document.querySelector('script[src*="safepay.paymentlogistics.net/form.js"]')) {
            console.log('Paygistix script already loaded');
            return;
        }
        
        const script = document.createElement('script');
        script.src = scriptUrl;
        
        // Get nonce from meta tag or existing element with nonce
        let nonce = null;
        
        // Try meta tag first
        const nonceMeta = document.querySelector('meta[name="csp-nonce"]');
        if (nonceMeta) {
            nonce = nonceMeta.getAttribute('content');
        }
        
        // If not found, try from any element with nonce
        if (!nonce) {
            const nonceElement = document.querySelector('[nonce]');
            if (nonceElement) {
                nonce = nonceElement.getAttribute('nonce');
            }
        }
        
        if (nonce) {
            script.setAttribute('nonce', nonce);
            console.log('Setting nonce on Paygistix script:', nonce);
        }
        
        script.onload = () => {
            console.log('Paygistix script loaded successfully');
            // Check if jQuery and form functionality is available
            if (typeof jQuery !== 'undefined' && jQuery.fn.paygistixForm) {
                console.log('Paygistix form plugin is available');
            }
        };
        script.onerror = () => {
            console.error('Failed to load Paygistix script from:', scriptUrl);
            console.error('This may be due to:');
            console.error('1. Script does not exist at that URL');
            console.error('2. CORS blocking from Paygistix server');
            console.error('3. CSP restrictions');
            console.error('4. Network connectivity issues');
            
            // Try to continue without the dynamic script - the form should still work for basic submission
            console.warn('Continuing without Paygistix dynamic features - form will still submit but without real-time validation');
        };
        
        document.body.appendChild(script);
    }
    
    setupSubmitHandler() {
        const form = this.container.querySelector('#paygistixPaymentForm');
        if (!form) return;
        
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent default form submission
            console.log('Payment form submitted - opening in popup');
            
            // Update return URL with context information
            const returnUrlField = form.querySelector('#returnUrlField');
            if (returnUrlField && this.payContext) {
                const baseUrl = returnUrlField.value;
                const separator = baseUrl.includes('?') ? '&' : '?';
                returnUrlField.value = `${baseUrl}${separator}context=${this.payContext}`;
                
                // Add customer data if available
                const customerData = this.getCustomerDataFromForm();
                if (customerData) {
                    returnUrlField.value += `&customerData=${encodeURIComponent(JSON.stringify(customerData))}`;
                }
            }
            
            // For production mode, we need to create a payment token first
            if (this.payContext === 'REGISTRATION') {
                // Show spinner while creating payment token
                let paymentSpinner = null;
                if (window.SwirlSpinnerUtils && typeof window.SwirlSpinnerUtils.showGlobal === 'function') {
                    paymentSpinner = window.SwirlSpinnerUtils.showGlobal({
                        message: 'Preparing Payment',
                        submessage: 'Please wait...'
                    });
                }
                
                // Gather customer data
                const customerData = this.getCustomerDataFromForm();
                
                // Get form data for payment
                const items = [];
                let totalAmount = 0;
                
                // Get all quantity inputs
                const qtyInputs = form.querySelectorAll('input.pxQty');
                qtyInputs.forEach((qtyInput, index) => {
                    const qty = parseInt(qtyInput.value) || 0;
                    if (qty > 0) {
                        const priceInput = form.querySelector(`input[name="pxPrice${index + 1}"]`);
                        if (priceInput) {
                            const price = parseFloat(priceInput.value) || 0;
                            totalAmount += qty * price;
                        }
                    }
                });
                
                // Create payment token
                const paymentData = {
                    amount: totalAmount * 100, // Convert to cents
                    formId: this.paymentConfig.formId,
                    merchantId: this.paymentConfig.merchantId
                };
                
                this.createPaymentToken(customerData, paymentData).then(tokenData => {
                    const paymentToken = tokenData.token;
                    this.paymentToken = paymentToken;
                    
                    // Update form with token
                    let tokenInput = form.querySelector('input[name="paymentToken"]');
                    if (!tokenInput) {
                        tokenInput = document.createElement('input');
                        tokenInput.type = 'hidden';
                        tokenInput.name = 'paymentToken';
                        form.appendChild(tokenInput);
                    }
                    tokenInput.value = paymentToken;
                    
                    // Update spinner message
                    if (paymentSpinner && paymentSpinner.updateMessage) {
                        paymentSpinner.updateMessage('Opening Payment Window', 'Please complete your payment in the popup window...');
                    }
                    
                    // Open payment window
                    const width = 800;
                    const height = 600;
                    const left = (window.screen.width - width) / 2;
                    const top = (window.screen.height - height) / 2;
                    
                    const paymentWindow = window.open('about:blank', 'paygistixPayment', 
                        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
                    
                    if (!paymentWindow) {
                        if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                            paymentSpinner.hide();
                        }
                        if (window.modalAlert) {
                            window.modalAlert('Please allow pop-ups for this site to complete payment. Check your browser\'s address bar for the pop-up blocker icon.', 'Pop-up Blocked');
                        }
                        return;
                    }
                    
                    // Set form target and submit
                    form.target = 'paygistixPayment';
                    form.submit();
                    
                    // Start polling for payment status
                    this.startPaymentStatusPolling(paymentToken, paymentWindow, paymentSpinner);
                    
                }).catch(error => {
                    console.error('Error creating payment token:', error);
                    if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                        paymentSpinner.hide();
                    }
                    if (window.modalAlert) {
                        window.modalAlert('Failed to initialize payment. Please try again.', 'Payment Error');
                    }
                });
            } else {
                // For non-registration payments, just open window and submit
                const width = 800;
                const height = 600;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;
                
                const paymentWindow = window.open('about:blank', 'paygistixPayment', 
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
                
                if (!paymentWindow) {
                    if (window.modalAlert) {
                        window.modalAlert('Please allow pop-ups for this site to complete payment. Check your browser\'s address bar for the pop-up blocker icon.', 'Pop-up Blocked');
                    }
                    return;
                }
                
                // Set form target and submit
                form.target = 'paygistixPayment';
                form.submit();
                
                // Show spinner
                let paymentSpinner = null;
                if (window.SwirlSpinnerUtils && typeof window.SwirlSpinnerUtils.showGlobal === 'function') {
                    paymentSpinner = window.SwirlSpinnerUtils.showGlobal({
                        message: 'Processing Payment',
                        submessage: 'Please complete your payment in the popup window...'
                    });
                }
                
                // Monitor window
                this.monitorPaymentWindow(paymentWindow, paymentSpinner);
            }
        });
    }
    
    getCustomerDataFromForm() {
        if (this.payContext !== 'REGISTRATION') return null;
        
        // Get form reference - could be the parent form for registration
        const form = document.getElementById('customerRegistrationForm');
        if (!form) return null;
        
        // Collect customer data
        const formData = new FormData(form);
        const customerData = {};
        
        // Define fields to collect
        const fields = [
            'affiliateId', 'username', 'password', 'firstName', 'lastName',
            'email', 'phone', 'address', 'city', 'state', 'zipCode',
            'numberOfBags', 'specialInstructions', 'affiliateSpecialInstructions',
            'languagePreference'
        ];
        
        fields.forEach(field => {
            const value = formData.get(field);
            if (value) {
                customerData[field] = value;
            }
        });
        
        return customerData;
    }
    
    // Public methods for external interaction
    updateQuantity(itemCode, quantity) {
        const rows = this.container.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const codeInput = row.querySelector('input[name^="pxCode"]');
            if (codeInput && codeInput.value === itemCode) {
                const qtyInput = row.querySelector('input[class="pxQty"]');
                if (qtyInput) {
                    qtyInput.value = quantity;
                    // Trigger change event for Paygistix script
                    const event = new Event('change', { bubbles: true });
                    qtyInput.dispatchEvent(event);
                }
            }
        });
    }
    
    hideAllRows() {
        const rows = this.container.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.classList.add('hidden-row');
        });
    }
    
    showRow(itemCode) {
        const rows = this.container.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const codeInput = row.querySelector('input[name^="pxCode"]');
            if (codeInput && codeInput.value === itemCode) {
                row.classList.remove('hidden-row');
            }
        });
    }
    
    // Test mode payment processing
    async processPaymentTestMode(customerData) {
        console.log('Processing payment in test mode with customer data:', customerData);
        
        if (this.isProcessingPayment) {
            console.log('Payment already in progress');
            return;
        }
        
        this.isProcessingPayment = true;
        
        try {
            // Get the form
            const form = this.container.querySelector('form#paygistixPaymentForm');
            if (!form) {
                throw new Error('Payment form not found');
            }
            
            // Collect all line items from the form
            const items = [];
            let totalAmount = 0;
            
            // Get all quantity inputs
            const qtyInputs = form.querySelectorAll('input.pxQty');
            qtyInputs.forEach((qtyInput, index) => {
                const qty = parseInt(qtyInput.value) || 0;
                if (qty > 0) {
                    const codeInput = form.querySelector(`input[name="pxCode${index + 1}"]`);
                    const descInput = form.querySelector(`input[name="pxDescription${index + 1}"]`);
                    const priceInput = form.querySelector(`input[name="pxPrice${index + 1}"]`);
                    
                    if (codeInput && descInput && priceInput) {
                        const price = parseFloat(priceInput.value) || 0;
                        const lineTotal = qty * price;
                        totalAmount += lineTotal;
                        
                        items.push({
                            code: codeInput.value,
                            description: descInput.value,
                            price: price * 100, // Convert to cents like original
                            quantity: qty,
                            total: lineTotal
                        });
                    }
                }
            });
            
            // If no items found, throw error
            if (items.length === 0) {
                throw new Error('No items selected for payment');
            }
            
            console.log('Test mode - Items collected:', items);
            console.log('Test mode - Total amount:', totalAmount);
            
            // Get bag quantity if it exists (for registration context)
            const bagQtyInput = form.querySelector('input[name="pxQty2"]');
            const bagQuantity = parseInt(bagQtyInput?.value || '0');
            
            // Prepare payment data
            const paymentData = {
                amount: totalAmount * 100, // Convert to cents
                items: items,
                formId: this.paymentConfig.formId,
                merchantId: this.paymentConfig.merchantId
            };
            
            // Create payment token and get form config
            const tokenData = await this.createPaymentToken(customerData, paymentData);
            const paymentToken = tokenData.token;
            const formConfig = tokenData.formConfig;
            
            // Update payment config with assigned form
            this.paymentConfig = {
                ...this.paymentConfig,
                formId: formConfig.formId,
                formHash: formConfig.formHash,
                returnUrl: formConfig.callbackUrl
            };
            
            // Store payment session data that callback can use to identify this payment
            const paymentSession = {
                token: paymentToken,
                amount: totalAmount * 100, // Store in cents
                timestamp: Date.now(),
                customerData: customerData,
                payContext: this.payContext,
                items: items
            };
            
            // Add bag quantity if it exists
            if (bagQuantity > 0) {
                paymentSession.numberOfBags = bagQuantity;
            }
            
            // Store in sessionStorage - use appropriate key based on context
            const sessionKey = this.payContext === 'REGISTRATION' ? 'pendingRegistration' : 'pendingOrderPayment';
            sessionStorage.setItem(sessionKey, JSON.stringify(paymentSession));
            
            // Add token as hidden field
            const tokenInput = document.createElement('input');
            tokenInput.type = 'hidden';
            tokenInput.name = 'paymentToken';
            tokenInput.value = paymentToken;
            form.appendChild(tokenInput);
            
            // Store test payment data for the modal
            this.testPaymentData = {
                totalAmount: totalAmount,
                items: items
            };
            
            // Show payment processing modal
            this.showPaymentProcessingModal(paymentToken);
            
        } catch (error) {
            console.error('Error processing payment:', error);
            this.isProcessingPayment = false;
            
            if (error.message.includes('pop-up') || error.message.includes('blocked')) {
                if (window.modalAlert) {
                    window.modalAlert('Please allow pop-ups for this site to complete payment. Check your browser\'s address bar for the pop-up blocker icon.', 'Pop-up Blocked');
                }
            } else {
                if (window.modalAlert) {
                    window.modalAlert(error.message || 'Failed to process payment. Please try again.', 'Payment Error');
                }
            }
        }
    }
    
    async createPaymentToken(customerData, paymentData) {
        try {
            // Prepare request options
            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    customerData,
                    paymentData
                })
            };
            
            // Add authorization header if token exists
            const authToken = localStorage.getItem('token');
            if (authToken) {
                requestOptions.headers['Authorization'] = 'Bearer ' + authToken;
            }
            
            // Use CSRF-aware fetch if available
            const fetchFunction = window.CsrfUtils?.csrfFetch || fetch;
            
            const response = await fetchFunction('/api/v1/payments/create-token', requestOptions);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Payment token creation failed:', response.status, errorText);
                throw new Error('Failed to create payment token');
            }
            
            const data = await response.json();
            
            if (!data.success || !data.token) {
                throw new Error(data.message || 'Failed to create payment token');
            }
            
            // Return both token and form config
            return {
                token: data.token,
                formConfig: data.formConfig
            };
        } catch (error) {
            console.error('Error creating payment token:', error);
            throw error;
        }
    }
    
    showPaymentProcessingModal(paymentToken) {
        // Show spinner using SwirlSpinner
        let paymentSpinner = null;
        if (window.SwirlSpinnerUtils && typeof window.SwirlSpinnerUtils.showGlobal === 'function') {
            paymentSpinner = window.SwirlSpinnerUtils.showGlobal({
                message: 'Opening Payment Window',
                submessage: 'Please complete your payment in the new window...'
            });
        }
        
        // Open payment window with dynamic form submission
        setTimeout(() => {
            try {
                const self = this;
                
                // Determine form action URL and method based on test mode
                const isTestMode = this.paymentConfig.testModeEnabled;
                const formActionUrl = isTestMode ? 
                    '/test-payment-form.html' : 
                    this.paymentConfig.formActionUrl;
                
                // Create a form for submission
                const paygistixForm = document.createElement('form');
                paygistixForm.method = isTestMode ? 'GET' : 'POST';
                paygistixForm.action = formActionUrl;
                paygistixForm.style.display = 'none';
                
                if (isTestMode) {
                    // For test mode, only add essential fields
                    const testFields = [
                        { name: 'paymentToken', value: paymentToken },
                        { name: 'amount', value: (this.testPaymentData?.totalAmount || 0).toFixed(2) },
                        { name: 'returnUrl', value: this.paymentConfig.returnUrl },
                        { name: 'context', value: this.payContext }
                    ];
                    
                    testFields.forEach(field => {
                        const input = document.createElement('input');
                        input.type = 'hidden';
                        input.name = field.name;
                        input.value = field.value;
                        paygistixForm.appendChild(input);
                    });
                } else {
                    // For production, add all form fields
                    const form = this.container.querySelector('form#paygistixPaymentForm');
                    const inputs = form.querySelectorAll('input[type="hidden"], input.pxQty, input[name^="pxPrice"], input[name^="pxCode"], input[name^="pxDescription"]');
                    
                    inputs.forEach(input => {
                        const clonedInput = input.cloneNode(true);
                        paygistixForm.appendChild(clonedInput);
                    });
                    
                    // Add additional fields for production
                    const additionalFields = [
                        { name: 'txnType', value: 'FORM' },
                        { name: 'merchantID', value: this.paymentConfig.merchantId },
                        { name: 'formID', value: this.paymentConfig.formId },
                        { name: 'hash', value: this.paymentConfig.formHash },
                        { name: 'ReturnURL', value: this.paymentConfig.returnUrl },
                        { name: 'paymentToken', value: paymentToken }
                    ];
                    
                    additionalFields.forEach(field => {
                        const input = document.createElement('input');
                        input.type = 'hidden';
                        input.name = field.name;
                        input.value = field.value;
                        paygistixForm.appendChild(input);
                    });
                }
                
                // Open window
                const width = 800;
                const height = 600;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;
                
                const paymentWindow = window.open('', 'paygistixPayment', 
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
                
                if (!paymentWindow) {
                    throw new Error('Payment window was blocked. Please allow pop-ups and try again.');
                }
                
                // Append form to current document, submit to new window, then remove
                document.body.appendChild(paygistixForm);
                paygistixForm.target = 'paygistixPayment';
                paygistixForm.submit();
                document.body.removeChild(paygistixForm);
                
                // Handle success through callback handler or polling
                console.log('Payment window opened successfully');
                
                // Start polling for payment status
                this.startPaymentStatusPolling(paymentToken, paymentWindow, paymentSpinner);
                
            } catch (error) {
                console.error('Error opening payment window:', error);
                if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                    paymentSpinner.hide();
                }
                throw error;
            }
        }, 100);
    }
    
    startPaymentStatusPolling(paymentToken, paymentWindow, paymentSpinner) {
        const self = this;
        let pollCount = 0;
        const maxPollAttempts = 90; // 3 minutes (90 * 2 seconds)
        let paymentCompleted = false;
        
        console.log('Starting payment status polling for token:', paymentToken);
        
        // Listen for postMessage events from the payment window
        const messageHandler = (event) => {
            console.log('Received postMessage:', event.data);
            
            // Handle different message types
            if (event.data.type === 'test-payment-initiated') {
                console.log('Test payment initiated with token:', event.data.paymentToken);
            } else if (event.data.type === 'paygistix-payment-callback') {
                console.log('Payment callback received:', event.data);
                
                // Process the callback
                paymentCompleted = true;
                clearInterval(self.pollingInterval);
                window.removeEventListener('message', messageHandler);
                
                // Close payment window if still open
                if (paymentWindow && !paymentWindow.closed) {
                    paymentWindow.close();
                }
                
                // Hide spinner
                if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                    paymentSpinner.hide();
                }
                
                self.isProcessingPayment = false;
                
                // Handle success or failure
                if (event.data.success || event.data.result === '0') {
                    // Prepare payment details with consistent format
                    const paymentDetails = {
                        success: true,
                        status: 'success',
                        transactionId: event.data.transactionId || event.data.PNRef,
                        ...event.data
                    };
                    
                    if (self.onPaymentSuccess) {
                        console.log('Calling onPaymentSuccess from postMessage with:', paymentDetails);
                        self.onPaymentSuccess(paymentDetails);
                    } else if (self.onSuccess) {
                        console.log('Calling onSuccess from postMessage with:', paymentDetails);
                        self.onSuccess(paymentDetails);
                    }
                } else {
                    if (self.onPaymentFailure) {
                        self.onPaymentFailure('Payment was declined');
                    }
                }
            }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Monitor window separately
        const windowCheckInterval = setInterval(() => {
            if (paymentWindow && paymentWindow.closed && !paymentCompleted) {
                console.log('Payment window closed by user - stopping immediately');
                paymentCompleted = true; // Mark as completed to prevent further processing
                clearInterval(windowCheckInterval);
                clearInterval(self.pollingInterval);
                window.removeEventListener('message', messageHandler);
                
                if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                    paymentSpinner.hide();
                }
                
                self.isProcessingPayment = false;
                
                // Optional: Cancel the payment token
                if (paymentToken) {
                    // Use CSRF-aware fetch if available
                    const fetchFunction = window.CsrfUtils?.csrfFetch || fetch;
                    fetchFunction(`/api/v1/payments/cancel-token/${paymentToken}`, {
                        method: 'POST',
                        credentials: 'include'
                    }).catch(err => console.log('Failed to cancel token:', err));
                }
                
                console.log('Payment process cancelled due to window closure');
                
                // Show cancellation modal (same as original implementation)
                if (self.onPaymentFailure) {
                    self.onPaymentFailure('Payment cancelled by user');
                } else if (window.modalAlert) {
                    window.modalAlert('Payment cancelled by user', 'Payment Cancelled');
                }
            }
        }, 1000);
        
        // Poll for payment status
        this.pollingInterval = setInterval(() => {
            // Check if payment was completed (including window closure)
            if (paymentCompleted) {
                console.log('Payment marked as completed, stopping polling');
                clearInterval(self.pollingInterval);
                clearInterval(windowCheckInterval);
                window.removeEventListener('message', messageHandler);
                return;
            }
            
            pollCount++;
            console.log(`Polling payment status (attempt ${pollCount})...`);
            
            // Stop polling after max attempts
            if (pollCount >= maxPollAttempts) {
                console.log('Max polling attempts reached, stopping...');
                clearInterval(self.pollingInterval);
                clearInterval(windowCheckInterval);
                window.removeEventListener('message', messageHandler);
                if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                    paymentSpinner.hide();
                }
                self.isProcessingPayment = false;
                
                // Close window if still open
                if (paymentWindow && !paymentWindow.closed) {
                    paymentWindow.close();
                }
                
                if (self.onPaymentFailure) {
                    self.onPaymentFailure('Payment timed out. Please try again.');
                }
                return;
            }
            
            // Check payment status
            self.checkPaymentStatus(paymentToken, (status, error, paymentData) => {
                console.log(`Payment status check result: ${status}`);
                
                if (status === 'success' || status === 'completed') {
                    paymentCompleted = true;
                    clearInterval(self.pollingInterval);
                    clearInterval(windowCheckInterval);
                    window.removeEventListener('message', messageHandler);
                    
                    // Close payment window
                    if (paymentWindow && !paymentWindow.closed) {
                        paymentWindow.close();
                    }
                    
                    // Hide spinner
                    if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                        paymentSpinner.hide();
                    }
                    
                    self.isProcessingPayment = false;
                    
                    // Call success callback with proper payment details
                    const paymentDetails = {
                        success: true,
                        status: 'success',
                        transactionId: paymentData.transactionId,
                        ...paymentData
                    };
                    
                    if (self.onPaymentSuccess) {
                        console.log('Calling onPaymentSuccess with:', paymentDetails);
                        self.onPaymentSuccess(paymentDetails);
                    } else if (self.onSuccess) {
                        console.log('Calling onSuccess with:', paymentDetails);
                        self.onSuccess(paymentDetails);
                    }
                } else if (status === 'failed' || status === 'error') {
                    paymentCompleted = true;
                    clearInterval(self.pollingInterval);
                    clearInterval(windowCheckInterval);
                    window.removeEventListener('message', messageHandler);
                    
                    // Close payment window
                    if (paymentWindow && !paymentWindow.closed) {
                        paymentWindow.close();
                    }
                    
                    // Hide spinner
                    if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                        paymentSpinner.hide();
                    }
                    
                    self.isProcessingPayment = false;
                    
                    // Call failure callback
                    if (self.onPaymentFailure) {
                        self.onPaymentFailure(error || 'Payment failed');
                    }
                }
                // If status is 'pending', continue polling
            });
        }, 2000); // Poll every 2 seconds
    }
    
    monitorPaymentWindow(paymentWindow, paymentSpinner) {
        // Monitor the payment window
        const checkInterval = setInterval(() => {
            if (paymentWindow.closed) {
                console.log('Payment window closed');
                clearInterval(checkInterval);
                
                // Hide spinner
                if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                    paymentSpinner.hide();
                }
                
                // Window closed without completing payment
                console.log('Payment window closed without completion');
            }
        }, 1000);
        
        // Listen for postMessage from payment callback
        const messageHandler = (event) => {
            console.log('Received postMessage:', event.data);
            
            if (event.data.type === 'paygistix-payment-callback') {
                clearInterval(checkInterval);
                window.removeEventListener('message', messageHandler);
                
                // Close payment window if still open
                if (paymentWindow && !paymentWindow.closed) {
                    paymentWindow.close();
                }
                
                // Hide spinner
                if (paymentSpinner && typeof paymentSpinner.hide === 'function') {
                    paymentSpinner.hide();
                }
                
                // Handle success or failure
                if (event.data.success || event.data.result === '0') {
                    // Prepare payment details with consistent format
                    const paymentDetails = {
                        success: true,
                        status: 'success',
                        transactionId: event.data.transactionId || event.data.PNRef,
                        ...event.data
                    };
                    
                    if (this.onPaymentSuccess) {
                        console.log('Calling onPaymentSuccess from postMessage with:', paymentDetails);
                        this.onPaymentSuccess(paymentDetails);
                    }
                } else {
                    if (this.onPaymentFailure) {
                        this.onPaymentFailure('Payment was declined');
                    }
                }
            }
        };
        
        window.addEventListener('message', messageHandler);
    }
    
    checkPaymentStatus(token, callback) {
        fetch(`/api/v1/payments/check-status/${token}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    callback(data.status, data.errorMessage, data);
                } else {
                    callback('error', 'Failed to check payment status');
                }
            })
            .catch(error => {
                console.error('Error checking payment status:', error);
                // Don't pass error.message if it's a TypeError from hide() function
                const errorMessage = error.message.includes('hide is not a function') ? 
                    'Payment processing completed' : error.message;
                callback('error', errorMessage);
            });
    }
}

// Export for use
window.PaygistixPaymentForm = PaygistixPaymentForm;