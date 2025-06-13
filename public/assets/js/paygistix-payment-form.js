class PaygistixPaymentForm {
    constructor(containerId, config) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.config = config || {};
        
        // Context detection
        this.payContext = document.getElementById('PAYCONTEXT')?.value || 'ORDER';
        this.affiliateId = document.getElementById('AFFILIATEID')?.value || null;
        
        // Affiliate settings
        this.affiliateSettings = null;
        
        // Pre-filled amounts
        this.prefilledAmounts = {};
        
        // Callbacks
        this.onSuccess = config.onSuccess || function() {};
        this.onError = config.onError || function() {};
        
        // Form ID for Paygistix script
        this.paygistixFormId = 'pxForm';
        
        // Payment configuration (can include hash if provided)
        this.paymentConfig = config.paymentConfig || null;
        
        // Flag to control whether to hide form rows in REGISTRATION context
        this.hideRegistrationFormRows = config.hideRegistrationFormRows !== undefined ? config.hideRegistrationFormRows : true;
        
        this.init();
    }
    
    async init() {
        try {
            // Load affiliate settings if needed
            if (this.payContext === 'ORDER' && this.affiliateId) {
                await this.loadAffiliateSettings();
            }
            
            // Render the form
            this.render();
            
            // Initialize visibility and handlers
            this.initializeVisibility();
            this.initializeHandlers();
            
            // Load Paygistix script
            this.loadPaygistixScript();
            
            // Setup registration mode if in REGISTRATION context
            if (this.payContext === 'REGISTRATION') {
                this.setupRegistrationMode();
            }
            
            // Call success callback
            this.onSuccess();
        } catch (error) {
            console.error('Error initializing payment form:', error);
            this.onError(error);
        }
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
    
    render() {
        // Validate that payment config is loaded and complete
        if (!this.paymentConfig) {
            this.container.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Configuration Error:</strong> Payment configuration not loaded. Please contact support.
                </div>
            `;
            console.error('PaygistixPaymentForm: Payment configuration is missing');
            return;
        }

        // Validate required config fields
        const requiredFields = ['merchantId', 'formId', 'formHash', 'formActionUrl', 'returnUrl'];
        const missingFields = requiredFields.filter(field => !this.paymentConfig[field]);
        
        if (missingFields.length > 0) {
            this.container.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Configuration Error:</strong> Missing required payment configuration fields: ${missingFields.join(', ')}
                </div>
            `;
            console.error('PaygistixPaymentForm: Missing required fields:', missingFields);
            return;
        }

        // Use the exact HTML structure from Paygistix
        const formHTML = `
            <div class="paygistix-payment-wrapper">
                <!-- BEGIN PAYMENT FORM CODE -->
                <form action="${this.paymentConfig.formActionUrl}" method="post" id="paygistixPaymentForm">
                <style type="text/css">
                    .pxPrice {text-align:right;}
                    .pxQty {width:60px;text-align:right;}
                    /* Additional WaveMAX styling */
                    .paygistix-payment-wrapper {
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 8px;
                        margin: 20px 0;
                    }
                    .paygistix-payment-wrapper table {
                        width: 100%;
                        background: white;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }
                    .paygistix-payment-wrapper thead {
                        background: #1e3a8a;
                        color: white;
                    }
                    .paygistix-payment-wrapper th {
                        padding: 12px 16px;
                        text-align: left;
                        font-weight: 600;
                        font-size: 14px;
                    }
                    .paygistix-payment-wrapper tbody tr {
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .paygistix-payment-wrapper tbody tr:hover {
                        background: #f9fafb;
                    }
                    .paygistix-payment-wrapper td {
                        padding: 12px 16px;
                    }
                    .paygistix-payment-wrapper tfoot {
                        background: #f9fafb;
                        font-weight: 600;
                    }
                    .paygistix-payment-wrapper tfoot td {
                        padding: 16px;
                    }
                    #pxTotal {
                        font-size: 18px;
                        margin-right: 20px;
                        color: #1e3a8a;
                    }
                    #pxSubmit {
                        background: #1e3a8a;
                        color: white;
                        padding: 10px 24px;
                        border: none;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 16px;
                        cursor: pointer;
                        transition: background 0.2s;
                    }
                    #pxSubmit:hover {
                        background: #1e40af;
                    }
                    #pxSubmit:active {
                        transform: translateY(1px);
                    }
                    .pxCode {
                        font-family: 'Courier New', monospace;
                        font-weight: 600;
                        color: #6b7280;
                    }
                    .pxDescription {
                        color: #374151;
                    }
                    /* Hide rows that should not be visible */
                    tr[style*="display: none"] {
                        display: none !important;
                    }
                </style>
                <table id=pxForm name=pxForm>
                    <thead>
                        <th>Code</th><th>Item</th><th>Price</th><th>Qty</th>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="pxCode">
                                WDF<input type="hidden" name="pxCode1" value="WDF" />
                            </td>
                            <td class="pxDescription">
                                Wash Dry Fold Service<input type="hidden" name="pxDescription1" value="Wash Dry Fold Service" />
                            </td>
                            <td class="pxPrice">
                                $1.25<input type="hidden" name="pxPrice1" id="pxPrice1" value="1.25" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty1" id="pxQty1" value="0" maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                BF<input type="hidden" name="pxCode2" value="BF" />
                            </td>
                            <td class="pxDescription">
                                Bag Fee<input type="hidden" name="pxDescription2" value="Bag Fee" />
                            </td>
                            <td class="pxPrice">
                                $10.00<input type="hidden" name="pxPrice2" id="pxPrice2" value="10.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty2" id="pxQty2" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                PBF5<input type="hidden" name="pxCode3" value="PBF5" />
                            </td>
                            <td class="pxDescription">
                                Per Bag Delivery Fee<input type="hidden" name="pxDescription3" value="Per Bag Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $5.00<input type="hidden" name="pxPrice3" id="pxPrice3" value="5.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty3" id="pxQty3" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                PBF10<input type="hidden" name="pxCode4" value="PBF10" />
                            </td>
                            <td class="pxDescription">
                                Per Bag Delivery Fee<input type="hidden" name="pxDescription4" value="Per Bag Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $10.00<input type="hidden" name="pxPrice4" id="pxPrice4" value="10.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty4" id="pxQty4" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                PBF15<input type="hidden" name="pxCode5" value="PBF15" />
                            </td>
                            <td class="pxDescription">
                                Per Bag Delivery Fee<input type="hidden" name="pxDescription5" value="Per Bag Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $15.00<input type="hidden" name="pxPrice5" id="pxPrice5" value="15.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty5" id="pxQty5" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                PBF20<input type="hidden" name="pxCode6" value="PBF20" />
                            </td>
                            <td class="pxDescription">
                                Per Bag Delivery Fee<input type="hidden" name="pxDescription6" value="Per Bag Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $20.00<input type="hidden" name="pxPrice6" id="pxPrice6" value="20.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty6" id="pxQty6" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                PBF25<input type="hidden" name="pxCode7" value="PBF25" />
                            </td>
                            <td class="pxDescription">
                                Per Bag Delivery Fee<input type="hidden" name="pxDescription7" value="Per Bag Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $25.00<input type="hidden" name="pxPrice7" id="pxPrice7" value="25.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty7" id="pxQty7" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                MDF10<input type="hidden" name="pxCode8" value="MDF10" />
                            </td>
                            <td class="pxDescription">
                                Minimum Delivery Fee<input type="hidden" name="pxDescription8" value="Minimum Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $10.00<input type="hidden" name="pxPrice8" id="pxPrice8" value="10.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty8" id="pxQty8" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                MDF15<input type="hidden" name="pxCode9" value="MDF15" />
                            </td>
                            <td class="pxDescription">
                                Minimum Delivery Fee<input type="hidden" name="pxDescription9" value="Minimum Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $15.00<input type="hidden" name="pxPrice9" id="pxPrice9" value="15.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty9" id="pxQty9" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                MDF20<input type="hidden" name="pxCode10" value="MDF20" />
                            </td>
                            <td class="pxDescription">
                                Minimum Delivery Fee<input type="hidden" name="pxDescription10" value="Minimum Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $20.00<input type="hidden" name="pxPrice10" id="pxPrice10" value="20.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty10" id="pxQty10" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                MDF25<input type="hidden" name="pxCode11" value="MDF25" />
                            </td>
                            <td class="pxDescription">
                                Minimum Delivery Fee<input type="hidden" name="pxDescription11" value="Minimum Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $25.00<input type="hidden" name="pxPrice11" id="pxPrice11" value="25.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty11" id="pxQty11" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                MDF30<input type="hidden" name="pxCode12" value="MDF30" />
                            </td>
                            <td class="pxDescription">
                                Minimum Delivery Fee<input type="hidden" name="pxDescription12" value="Minimum Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $30.00<input type="hidden" name="pxPrice12" id="pxPrice12" value="30.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty12" id="pxQty12" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                MDF35<input type="hidden" name="pxCode13" value="MDF35" />
                            </td>
                            <td class="pxDescription">
                                Minimum Delivery Fee<input type="hidden" name="pxDescription13" value="Minimum Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $35.00<input type="hidden" name="pxPrice13" id="pxPrice13" value="35.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty13" id="pxQty13" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                MDF40<input type="hidden" name="pxCode14" value="MDF40" />
                            </td>
                            <td class="pxDescription">
                                Minimum Delivery Fee<input type="hidden" name="pxDescription14" value="Minimum Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $40.00<input type="hidden" name="pxPrice14" id="pxPrice14" value="40.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty14" id="pxQty14" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                MDF45<input type="hidden" name="pxCode15" value="MDF45" />
                            </td>
                            <td class="pxDescription">
                                Minimum Delivery Fee<input type="hidden" name="pxDescription15" value="Minimum Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $45.00<input type="hidden" name="pxPrice15" id="pxPrice15" value="45.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty15" id="pxQty15" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                        <tr>
                            <td class="pxCode">
                                MDF50<input type="hidden" name="pxCode16" value="MDF50" />
                            </td>
                            <td class="pxDescription">
                                Minimum Delivery Fee<input type="hidden" name="pxDescription16" value="Minimum Delivery Fee" />
                            </td>
                            <td class="pxPrice">
                                $50.00<input type="hidden" name="pxPrice16" id="pxPrice16" value="50.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty16" id="pxQty16" value="0"  maxlength="3"/>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan=4 align=right>
                                <span id="pxTotal"><b>Total $0.00</b></span><input type="submit" id="pxSubmit" value="Pay Now" />
                            </td>
                        </tr>
                    </tfoot>
                </table>
                <input type="hidden" name="txnType" value="FORM" />
                <input type="hidden" name="merchantID" value="${this.paymentConfig.merchantId}" />
                <input type="hidden" name="formID" value="${this.paymentConfig.formId}" />
                <input type="hidden" name="hash" value="${this.paymentConfig.formHash}" />
                <input type="hidden" name="ReturnURL" value="${this.paymentConfig.returnUrl}" id="returnUrlField" />
                </form>
                <!-- END PAYMENT FORM CODE -->
            </div>
        `;
        
        this.container.innerHTML = formHTML;
    }
    
    initializeVisibility() {
        const rows = this.container.querySelectorAll('tbody tr');
        
        console.log('Initializing visibility - Context:', this.payContext, 'Affiliate settings:', !!this.affiliateSettings);
        
        if (this.payContext === 'REGISTRATION' && this.hideRegistrationFormRows) {
            // Hide all rows except bag fee in registration context
            rows.forEach(row => {
                const codeInput = row.querySelector('input[name^="pxCode"]');
                if (codeInput && codeInput.value !== 'BF') {
                    row.style.display = 'none';
                    // Also set quantity to 0 for hidden rows
                    const qtyInput = row.querySelector('input[name^="pxQty"]');
                    if (qtyInput) {
                        qtyInput.value = '0';
                    }
                }
            });
            // Important: Don't continue to ORDER logic for REGISTRATION context
            return;
        }
        
        if (this.payContext === 'ORDER' && this.affiliateSettings) {
            // Use affiliate settings to determine which rows to show
            const { minimumDeliveryFee, perBagFee } = this.affiliateSettings;
            
            // Hide all rows initially
            rows.forEach(row => {
                row.style.display = 'none';
            });
            
            // Show WDF (Wash Dry Fold Service)
            const wdfRow = Array.from(rows).find(row => {
                const codeInput = row.querySelector('input[name^="pxCode"]');
                return codeInput && codeInput.value === 'WDF';
            });
            if (wdfRow) wdfRow.style.display = '';
            
            // Show BF (Bag Fee)
            const bfRow = Array.from(rows).find(row => {
                const codeInput = row.querySelector('input[name^="pxCode"]');
                return codeInput && codeInput.value === 'BF';
            });
            if (bfRow) bfRow.style.display = '';
            
            // Show the appropriate MDF row
            const mdfCode = `MDF${minimumDeliveryFee}`;
            const mdfRow = Array.from(rows).find(row => {
                const codeInput = row.querySelector('input[name^="pxCode"]');
                return codeInput && codeInput.value === mdfCode;
            });
            if (mdfRow) {
                mdfRow.style.display = '';
                // Pre-fill with quantity 1
                const qtyInput = mdfRow.querySelector('input[name^="pxQty"]');
                if (qtyInput) {
                    qtyInput.value = '1';
                    this.prefilledAmounts[mdfCode] = 1;
                }
            }
            
            // Show the appropriate PBF row
            const pbfCode = `PBF${perBagFee}`;
            const pbfRow = Array.from(rows).find(row => {
                const codeInput = row.querySelector('input[name^="pxCode"]');
                return codeInput && codeInput.value === pbfCode;
            });
            if (pbfRow) {
                pbfRow.style.display = '';
            }
        }
        
        // Update the total after setting visibility
        if (typeof window.updateTotal === 'function') {
            setTimeout(() => window.updateTotal(), 100);
        }
    }
    
    initializeHandlers() {
        const form = this.container.querySelector('form');
        if (!form) return;
        
        // Prevent default form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            // The Paygistix script will handle the actual submission
        });
        
        // Add custom input handlers if needed
        const qtyInputs = form.querySelectorAll('.pxQty');
        qtyInputs.forEach(input => {
            // Add blur handler to format quantity
            input.addEventListener('blur', (e) => {
                this.formatQty(e.target);
            });
            
            input.addEventListener('change', () => {
                // You can add custom logic here if needed
                console.log('Quantity changed:', input.name, input.value);
            });
        });
    }
    
    // Format quantity input to ensure it's a valid number
    formatQty(input) {
        let value = input.value.trim();
        
        // Remove non-numeric characters
        value = value.replace(/[^0-9]/g, '');
        
        // Convert to integer
        let qty = parseInt(value) || 0;
        
        // Ensure non-negative
        if (qty < 0) qty = 0;
        
        // Update input value
        input.value = qty;
        
        // Trigger update total if the function exists
        if (typeof window.updateTotal === 'function') {
            window.updateTotal();
        }
    }
    
    loadPaygistixScript() {
        // Check if script is already loaded
        if (document.querySelector('script[src*="safepay.paymentlogistics.net/form.js"]')) {
            console.log('Paygistix script already loaded');
            return;
        }
        
        // Create and append the script
        const script = document.createElement('script');
        script.src = 'https://safepay.paymentlogistics.net/form.js';
        script.type = 'text/javascript';
        script.async = true;
        
        script.onload = () => {
            console.log('Paygistix script loaded successfully');
        };
        
        script.onerror = () => {
            console.error('Failed to load Paygistix script');
            this.onError(new Error('Failed to load payment processor script'));
        };
        
        document.body.appendChild(script);
    }
    
    // Public method to update bag quantity
    updateBagQuantity(quantity) {
        const bagFeeRow = this.container.querySelector('input[value="BF"]')?.closest('tr');
        if (bagFeeRow) {
            const qtyInput = bagFeeRow.querySelector('.pxQty');
            if (qtyInput) {
                qtyInput.value = quantity;
                // Trigger change event
                const event = new Event('change', { bubbles: true });
                qtyInput.dispatchEvent(event);
                // Update total if function exists
                if (typeof window.updateTotal === 'function') {
                    window.updateTotal();
                }
            }
        }
    }
    
    // Public method to get pre-filled amounts
    getPrefilledAmounts() {
        return this.prefilledAmounts;
    }
    
    // Processing state management
    isProcessingPayment = false;
    
    // Public method to handle registration payment
    async processRegistrationPayment(customerData) {
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
            
            // Get the bag quantity
            const bagQtyInput = form.querySelector('input[name="pxQty2"]');
            const bagQuantity = parseInt(bagQtyInput?.value || '0');
            
            if (bagQuantity <= 0) {
                throw new Error('Please select the number of bags');
            }
            
            // Calculate total
            const bagPrice = 10.00; // $10 per bag
            const totalAmount = bagQuantity * bagPrice * 100; // Convert to cents
            
            // Prepare payment data
            const paymentData = {
                amount: totalAmount,
                items: [{
                    code: 'BF',
                    description: 'Bag Fee',
                    price: bagPrice * 100,
                    quantity: bagQuantity
                }],
                formId: this.paymentConfig.formId,
                merchantId: this.paymentConfig.merchantId
            };
            
            // Create payment token
            const paymentToken = await this.createPaymentToken(customerData, paymentData);
            
            // Store registration data in sessionStorage for callback handler
            sessionStorage.setItem('pendingRegistration', JSON.stringify({
                ...customerData,
                numberOfBags: bagQuantity,
                paymentToken: paymentToken
            }));
            
            // Add token as hidden field
            const tokenInput = document.createElement('input');
            tokenInput.type = 'hidden';
            tokenInput.name = 'paymentToken';
            tokenInput.value = paymentToken;
            form.appendChild(tokenInput);
            
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
            const response = await fetch('/api/v1/payments/create-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                },
                body: JSON.stringify({
                    customerData,
                    paymentData
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create payment token');
            }
            
            const data = await response.json();
            
            if (!data.success || !data.token) {
                throw new Error(data.message || 'Failed to create payment token');
            }
            
            return data.token;
        } catch (error) {
            console.error('Error creating payment token:', error);
            throw error;
        }
    }
    
    async cancelPaymentToken(token) {
        try {
            const response = await fetch(`/api/v1/payments/cancel-token/${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                }
            });

            if (!response.ok) {
                throw new Error('Failed to cancel payment token');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error cancelling payment token:', error);
            throw error;
        }
    }

    setupRegistrationMode() {
        const submitBtn = this.container.querySelector('#pxSubmit');
        const form = this.container.querySelector('#paygistixPaymentForm');
        
        if (submitBtn && form) {
            // Override the submit button to use our custom handler
            submitBtn.type = 'button';
            submitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                
                // Get customer data from the page
                const customerData = this.gatherCustomerData();
                if (customerData) {
                    await this.processRegistrationPayment(customerData);
                }
            });
        }
    }
    
    gatherCustomerData() {
        // This method should be overridden or the data should be passed in
        // For now, we'll try to gather from common form fields
        const email = document.querySelector('[name="email"], #email')?.value;
        const firstName = document.querySelector('[name="firstName"], #firstName')?.value;
        const lastName = document.querySelector('[name="lastName"], #lastName')?.value;
        const phone = document.querySelector('[name="phone"], #phone')?.value;
        
        if (!email || !firstName || !lastName) {
            console.error('Missing required customer data');
            return null;
        }
        
        return {
            email,
            firstName,
            lastName,
            phone: phone || '',
            affiliateId: this.affiliateId
        };
    }
    
    showPaymentProcessingModal(paymentToken) {
        // Show spinner using SwirlSpinner
        const paymentSpinner = window.SwirlSpinnerUtils ? 
            window.SwirlSpinnerUtils.showGlobal({
                message: 'Opening Payment Window',
                submessage: 'Please complete your payment in the new window...'
            }) : null;
        
        // Open payment window with dynamic form submission
        setTimeout(() => {
            try {
                const self = this;
                
                // Create a form for Paygistix submission
                const paygistixForm = document.createElement('form');
                paygistixForm.method = 'POST';
                paygistixForm.action = this.paymentConfig.formActionUrl;
                paygistixForm.style.display = 'none';
                
                // Get all form inputs from the payment form
                const originalForm = this.container.querySelector('form#paygistixPaymentForm');
                const inputs = originalForm.querySelectorAll('input[type="hidden"], input.pxQty');
                
                // Clone all inputs to the new form, but only if they have meaningful values
                inputs.forEach(input => {
                    // Skip quantity inputs with value of 0
                    if (input.classList.contains('pxQty') && input.value === '0') {
                        console.log(`Skipping ${input.name} with value 0`);
                        return;
                    }
                    
                    const clone = input.cloneNode(true);
                    paygistixForm.appendChild(clone);
                    
                    // Log what we're adding
                    if (input.value && input.value !== '0') {
                        console.log(`Adding ${input.name}: ${input.value}`);
                    }
                });
                
                // Add payment token
                const tokenInput = document.createElement('input');
                tokenInput.type = 'hidden';
                tokenInput.name = 'custom1';
                tokenInput.value = paymentToken;
                paygistixForm.appendChild(tokenInput);
                
                // The payment token will be tracked via postMessage from callback window
                
                // Add customer email
                const customerData = this.gatherCustomerData();
                if (customerData && customerData.email) {
                    const emailInput = document.createElement('input');
                    emailInput.type = 'hidden';
                    emailInput.name = 'email';
                    emailInput.value = customerData.email;
                    paygistixForm.appendChild(emailInput);
                }
                
                // Append form to body
                document.body.appendChild(paygistixForm);
                
                // Log form data for debugging
                const formData = new FormData(paygistixForm);
                const paymentData = {};
                for (let [key, value] of formData.entries()) {
                    paymentData[key] = value;
                }
                console.log('Payment form data:', paymentData);
                
                // Open payment window
                const windowWidth = 800;
                const windowHeight = 600;
                const left = (screen.width - windowWidth) / 2;
                const top = (screen.height - windowHeight) / 2;
                
                const windowFeatures = `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=yes`;
                
                const paymentWindow = window.open('', 'PaygistixPayment', windowFeatures);
                
                if (paymentWindow) {
                    // Set form target to the new window
                    paygistixForm.target = 'PaygistixPayment';
                    
                    // Submit form to the new window
                    paygistixForm.submit();
                    console.log('Form submitted to new window');
                    
                    // Update spinner to show processing state
                    console.log('Payment window opened, waiting for completion...');
                    
                    // Track if we've received a payment result
                    let paymentCompleted = false;
                    let waitingForCallback = true; // Expect redirect to callback page
                    
                    // Listen for message from payment callback window
                    const messageHandler = (event) => {
                        console.log('Received postMessage:', event.data);
                        
                        if (event.data && event.data.type === 'paygistix-payment-callback') {
                            // Verify it's our payment by checking the token
                            if (event.data.paymentToken === paymentToken || !event.data.paymentToken) {
                                console.log('Payment callback received via postMessage:', event.data);
                                
                                // Remove the message listener
                                window.removeEventListener('message', messageHandler);
                                
                                // Clear intervals
                                clearInterval(windowCheckInterval);
                                clearInterval(pollingInterval);
                                paymentCompleted = true;
                                
                                if (event.data.success) {
                                    // Close the payment window immediately
                                    if (paymentWindow && !paymentWindow.closed) {
                                        paymentWindow.close();
                                    }
                                    
                                    // Update payment token status on server
                                    fetch(`/api/v1/payments/callback`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            custom1: paymentToken,
                                            Result: event.data.result,
                                            PNRef: event.data.transactionId,
                                            OrderID: event.data.orderId,
                                            Amount: event.data.amount,
                                            AuthCode: event.data.authCode
                                        })
                                    }).then(() => {
                                        console.log('Payment status updated on server');
                                    }).catch(err => {
                                        console.error('Error updating payment status:', err);
                                    });
                                    
                                    self.handlePaymentSuccess(paymentSpinner, null);
                                } else {
                                    self.handlePaymentFailure(paymentSpinner, 'Payment was declined', paymentWindow);
                                }
                            }
                        }
                    };
                    
                    window.addEventListener('message', messageHandler);
                    
                    // Monitor window status but give time for payment processing
                    let windowClosedCount = 0;
                    let windowCheckInterval = setInterval(() => {
                        if (paymentWindow.closed) {
                            windowClosedCount++;
                            
                            // Only consider it truly closed after 10 seconds (20 checks)
                            // This gives time for redirects and callbacks
                            if (windowClosedCount > 20 && !paymentCompleted) {
                                console.log('Payment window closed for extended period, checking final status...');
                                clearInterval(windowCheckInterval);
                                clearInterval(pollingInterval);
                                
                                // Do one final status check
                                self.checkPaymentStatus(paymentToken, (status, error) => {
                                    if (status === 'completed' || status === 'success') {
                                        console.log('Payment was actually completed!');
                                        paymentCompleted = true;
                                        window.removeEventListener('message', messageHandler);
                                        self.handlePaymentSuccess(paymentSpinner, null);
                                    } else {
                                        console.log('Payment was not completed, showing cancellation message');
                                        window.removeEventListener('message', messageHandler);
                                        
                                        // Cancel the payment token
                                        self.cancelPaymentToken(paymentToken).then(() => {
                                            console.log('Payment token cancelled');
                                        }).catch(err => {
                                            console.error('Error cancelling payment token:', err);
                                        });
                                        
                                        // Hide the spinner
                                        if (paymentSpinner) {
                                            paymentSpinner.hide();
                                        }
                                        
                                        // Show alert to user
                                        if (window.modalAlert) {
                                            window.modalAlert('Payment was cancelled. Please try again when you are ready to complete the payment.', 'Payment Cancelled');
                                        }
                                        
                                        // Reset processing flag
                                        self.isProcessingPayment = false;
                                    }
                                });
                            }
                        } else {
                            // Window is open, reset counter
                            windowClosedCount = 0;
                        }
                    }, 500); // Check every 500ms
                    
                    // Start polling for payment status as backup
                    let pollCount = 0;
                    let pollingInterval = setInterval(() => {
                        pollCount++;
                        console.log(`Polling payment status (attempt ${pollCount})...`);
                        
                        self.checkPaymentStatus(paymentToken, (status, error) => {
                            console.log(`Payment status check result: ${status}`);
                            
                            if (status === 'success' || status === 'completed') {
                                console.log('Payment completed via polling!');
                                paymentCompleted = true;
                                clearInterval(pollingInterval);
                                clearInterval(windowCheckInterval);
                                window.removeEventListener('message', messageHandler);
                                
                                // Close payment window if still open
                                if (paymentWindow && !paymentWindow.closed) {
                                    paymentWindow.close();
                                }
                                
                                self.handlePaymentSuccess(paymentSpinner, null);
                            } else if (status === 'failed') {
                                console.log('Payment failed via polling');
                                paymentCompleted = true;
                                clearInterval(pollingInterval);
                                clearInterval(windowCheckInterval);
                                window.removeEventListener('message', messageHandler);
                                self.handlePaymentFailure(paymentSpinner, error, paymentWindow);
                            }
                        });
                    }, 2000); // Check every 2 seconds
                    
                    // Clean up form
                    if (document.body.contains(paygistixForm)) {
                        document.body.removeChild(paygistixForm);
                    }
                } else {
                    // Only throw error if window truly failed to open
                    throw new Error('Pop-up blocked');
                }
            } catch (error) {
                console.error('Error in payment processing:', error);
                
                // Only show pop-up blocked message if window failed to open
                if (!paymentWindow || paymentWindow.closed) {
                    if (paymentSpinner) {
                        paymentSpinner.hide();
                    }
                    if (window.modalAlert) {
                        window.modalAlert('Unable to open payment window. Please check your pop-up blocker settings and try again.', 'Pop-up Blocked');
                    }
                    this.isProcessingPayment = false;
                }
                // Otherwise, the payment window opened successfully despite the error
            }
        }, 100);
    }
    
    checkPaymentStatus(token, callback) {
        fetch(`/api/v1/payments/check-status/${token}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    callback(data.status, data.errorMessage);
                } else {
                    callback('error', 'Failed to check payment status');
                }
            })
            .catch(error => {
                console.error('Error checking payment status:', error);
                callback('error', error.message);
            });
    }
    
    handlePaymentSuccess(spinner, paymentWindow) {
        if (paymentWindow && !paymentWindow.closed) {
            paymentWindow.close();
        }
        
        if (spinner) {
            spinner.hide();
        }
        
        // Show success message
        if (window.modalAlert) {
            window.modalAlert('Payment successful! Your registration is complete.', 'Success');
        }
        
        setTimeout(() => {
            this.isProcessingPayment = false;
            // Redirect to success page
            window.location.href = '/registration-success.html';
        }, 1000);
    }
    
    handlePaymentFailure(spinner, error, paymentWindow) {
        if (paymentWindow && !paymentWindow.closed) {
            paymentWindow.close();
        }
        
        if (spinner) {
            spinner.hide();
        }
        
        // Show error message
        if (window.modalAlert) {
            window.modalAlert(error || 'Your payment could not be processed. Please try again.', 'Payment Failed');
        }
        
        this.isProcessingPayment = false;
    }
}

// Make the class available globally
window.PaygistixPaymentForm = PaygistixPaymentForm;