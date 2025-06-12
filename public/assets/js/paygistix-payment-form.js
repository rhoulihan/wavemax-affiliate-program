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
                                <input type="text" class="pxQty" name="pxQty1" id="pxQty1" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty2" id="pxQty2" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty3" id="pxQty3" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty4" id="pxQty4" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty5" id="pxQty5" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty6" id="pxQty6" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty7" id="pxQty7" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty8" id="pxQty8" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty9" id="pxQty9" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty10" id="pxQty10" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty11" id="pxQty11" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty12" id="pxQty12" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty13" id="pxQty13" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty14" id="pxQty14" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty15" id="pxQty15" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                                <input type="text" class="pxQty" name="pxQty16" id="pxQty16" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
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
                <input type="hidden" name="ReturnURL" value="${this.paymentConfig.returnUrl}" />
                </form>
                <!-- END PAYMENT FORM CODE -->
            </div>
        `;
        
        this.container.innerHTML = formHTML;
    }
    
    initializeVisibility() {
        const rows = this.container.querySelectorAll('tbody tr');
        
        if (this.payContext === 'REGISTRATION' && this.hideRegistrationFormRows) {
            // Hide all rows except bag fee in registration context
            rows.forEach(row => {
                const codeInput = row.querySelector('input[name^="pxCode"]');
                if (codeInput && codeInput.value !== 'BF') {
                    row.style.display = 'none';
                }
            });
        } else if (this.payContext === 'ORDER' && this.affiliateSettings) {
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
            input.addEventListener('change', () => {
                // You can add custom logic here if needed
                console.log('Quantity changed:', input.name, input.value);
            });
        });
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
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'payment-processing-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 40px;
            border-radius: 8px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        modalContent.innerHTML = `
            <div class="loading-state">
                <div style="display: inline-block; width: 50px; height: 50px; border: 3px solid #f3f3f3; border-top: 3px solid #1e3a8a; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <h3 style="margin-top: 20px; color: #1e3a8a;">Opening Payment Window</h3>
                <p style="color: #6b7280; margin-top: 10px;">Please complete your payment in the new window...</p>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Add spinner animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        // Open payment window with dynamic form submission
        setTimeout(() => {
            try {
                const loadingState = modalContent.querySelector('.loading-state');
                const self = this;
                
                // Create a form for Paygistix submission
                const paygistixForm = document.createElement('form');
                paygistixForm.method = 'POST';
                paygistixForm.action = this.paymentConfig.formActionUrl;
                paygistixForm.style.display = 'none';
                
                // Get all form inputs from the payment form
                const originalForm = this.container.querySelector('form#paygistixPaymentForm');
                const inputs = originalForm.querySelectorAll('input[type="hidden"], input.pxQty');
                
                // Clone all inputs to the new form
                inputs.forEach(input => {
                    const clone = input.cloneNode(true);
                    paygistixForm.appendChild(clone);
                });
                
                // Add payment token
                const tokenInput = document.createElement('input');
                tokenInput.type = 'hidden';
                tokenInput.name = 'custom1';
                tokenInput.value = paymentToken;
                paygistixForm.appendChild(tokenInput);
                
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
                    
                    // Update modal to show processing state
                    loadingState.innerHTML = `
                        <div style="display: inline-block; width: 50px; height: 50px; border: 3px solid #f3f3f3; border-top: 3px solid #1e3a8a; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <h3 style="margin-top: 20px; color: #1e3a8a;">Processing Payment</h3>
                        <p style="color: #6b7280; margin-top: 10px;">Please complete the payment in the new window</p>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">Do not close this window...</p>
                    `;
                    
                    // Check if payment window is closed
                    let windowCheckInterval = setInterval(() => {
                        if (paymentWindow.closed) {
                            console.log('Payment window was closed by user');
                            clearInterval(windowCheckInterval);
                            clearInterval(pollingInterval);
                            
                            // Cancel the payment token
                            self.cancelPaymentToken(paymentToken).then(() => {
                                console.log('Payment token cancelled');
                            }).catch(err => {
                                console.error('Error cancelling payment token:', err);
                            });
                            
                            // Close the modal
                            modal.style.display = 'none';
                            
                            // Show alert to user
                            if (window.modalAlert) {
                                window.modalAlert('Payment was cancelled. Please try again when you are ready to complete the payment.', 'Payment Cancelled');
                            }
                            
                            // Reset processing flag
                            self.isProcessingPayment = false;
                        }
                    }, 500); // Check every 500ms
                    
                    // Start polling for payment status
                    let pollingInterval = setInterval(() => {
                        self.checkPaymentStatus(paymentToken, (status, error) => {
                            if (status === 'success') {
                                clearInterval(pollingInterval);
                                clearInterval(windowCheckInterval);
                                self.handlePaymentSuccess(modal, paymentWindow);
                            } else if (status === 'failed') {
                                clearInterval(pollingInterval);
                                clearInterval(windowCheckInterval);
                                self.handlePaymentFailure(modal, error, paymentWindow);
                            }
                        });
                    }, 2000); // Check every 2 seconds
                    
                    // Clean up form
                    if (document.body.contains(paygistixForm)) {
                        document.body.removeChild(paygistixForm);
                    }
                } else {
                    throw new Error('Pop-up blocked');
                }
            } catch (error) {
                console.error('Error opening payment window:', error);
                loadingState.innerHTML = `
                    <div style="color: #dc2626; font-size: 48px;">⚠️</div>
                    <h3 style="margin-top: 20px; color: #dc2626;">Unable to Open Payment Window</h3>
                    <p style="color: #6b7280; margin-top: 10px;">Please check your pop-up blocker settings and try again.</p>
                    <button onclick="this.closest('.payment-processing-modal').remove(); window.PaygistixPaymentForm.prototype.isProcessingPayment = false;" style="margin-top: 20px; padding: 10px 20px; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
                `;
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
    
    handlePaymentSuccess(modal, paymentWindow) {
        if (paymentWindow && !paymentWindow.closed) {
            paymentWindow.close();
        }
        
        modal.querySelector('.loading-state').innerHTML = `
            <div style="color: #10b981; font-size: 48px;">✓</div>
            <h3 style="margin-top: 20px; color: #10b981;">Payment Successful!</h3>
            <p style="color: #6b7280; margin-top: 10px;">Your registration is complete.</p>
        `;
        
        setTimeout(() => {
            modal.remove();
            this.isProcessingPayment = false;
            // Redirect to success page
            window.location.href = '/registration-success.html';
        }, 2000);
    }
    
    handlePaymentFailure(modal, error, paymentWindow) {
        if (paymentWindow && !paymentWindow.closed) {
            paymentWindow.close();
        }
        
        modal.querySelector('.loading-state').innerHTML = `
            <div style="color: #dc2626; font-size: 48px;">✗</div>
            <h3 style="margin-top: 20px; color: #dc2626;">Payment Failed</h3>
            <p style="color: #6b7280; margin-top: 10px;">${error || 'Your payment could not be processed. Please try again.'}</p>
            <button onclick="this.closest('.payment-processing-modal').remove(); window.PaygistixPaymentForm.prototype.isProcessingPayment = false;" style="margin-top: 20px; padding: 10px 20px; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
        `;
        
        this.isProcessingPayment = false;
    }
}

// Make the class available globally
window.PaygistixPaymentForm = PaygistixPaymentForm;