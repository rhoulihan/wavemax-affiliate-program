class PaygistixPaymentForm {
    constructor(containerId, config) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.config = config || {};
        
        // Context detection
        this.payContext = document.getElementById('PAYCONTEXT')?.value || 'ORDER';
        this.affiliateId = document.getElementById('AFFILIATEID')?.value || null;
        
        // Affiliate settings (can be passed in config to avoid API call)
        this.affiliateSettings = config.affiliateSettings || null;
        
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
            // Load affiliate settings if needed (skip if already provided)
            if (this.payContext === 'ORDER' && this.affiliateId && !this.affiliateSettings) {
                await this.loadAffiliateSettings();
            }
            
            // Render the form
            this.render();
            
            // Initialize visibility and handlers
            this.initializeVisibility();
            this.initializeHandlers();
            
            // Load Paygistix script
            this.loadPaygistixScript();
            
            // Setup submit handler for both contexts
            this.setupSubmitHandler();
            
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
    
    // Public method to update WDF quantity
    updateWDFQuantity(quantity) {
        console.log('Updating WDF quantity to:', quantity);
        
        const wdfQtyInput = this.container.querySelector('input[name="pxQty1"]'); // WDF is always the first item
        if (wdfQtyInput) {
            wdfQtyInput.value = Math.max(0, Math.floor(quantity)); // Ensure non-negative integer
            console.log('Set WDF quantity to:', wdfQtyInput.value);
            
            // Trigger change event to update totals
            const event = new Event('change', { bubbles: true });
            wdfQtyInput.dispatchEvent(event);
            
            // Update total if function exists
            if (typeof window.updateTotal === 'function') {
                window.updateTotal();
            }
        } else {
            console.warn('WDF quantity input not found');
        }
    }
    
    // Public method to update delivery fee quantities based on fee breakdown
    updateDeliveryFeeQuantities(feeBreakdown) {
        console.log('Updating delivery fee quantities:', feeBreakdown);
        
        // First, reset all delivery fee quantities to 0
        const allMDFInputs = this.container.querySelectorAll('input[name^="pxCode"][value^="MDF"]');
        const allPBFInputs = this.container.querySelectorAll('input[name^="pxCode"][value^="PBF"]');
        
        // Reset MDF quantities
        allMDFInputs.forEach(input => {
            const row = input.closest('tr');
            const qtyInput = row?.querySelector('.pxQty');
            if (qtyInput) {
                qtyInput.value = 0;
            }
        });
        
        // Reset PBF quantities
        allPBFInputs.forEach(input => {
            const row = input.closest('tr');
            const qtyInput = row?.querySelector('.pxQty');
            if (qtyInput) {
                qtyInput.value = 0;
            }
        });
        
        if (!feeBreakdown) {
            console.log('No fee breakdown provided');
            return;
        }
        
        // If minimum fee applies, set MDF quantity
        if (feeBreakdown.minimumApplied) {
            const mdfCode = `MDF${Math.round(feeBreakdown.minimumFee)}`;
            const mdfInput = this.container.querySelector(`input[value="${mdfCode}"]`);
            if (mdfInput) {
                const row = mdfInput.closest('tr');
                const qtyInput = row?.querySelector('.pxQty');
                if (qtyInput) {
                    qtyInput.value = 1;
                    console.log(`Set ${mdfCode} quantity to 1`);
                }
            } else {
                console.warn(`MDF code ${mdfCode} not found in form`);
            }
        } else {
            // Per bag fee applies, set PBF quantity
            const pbfCode = `PBF${Math.round(feeBreakdown.perBagFee)}`;
            const pbfInput = this.container.querySelector(`input[value="${pbfCode}"]`);
            if (pbfInput) {
                const row = pbfInput.closest('tr');
                const qtyInput = row?.querySelector('.pxQty');
                if (qtyInput) {
                    qtyInput.value = feeBreakdown.numberOfBags;
                    console.log(`Set ${pbfCode} quantity to ${feeBreakdown.numberOfBags}`);
                }
            } else {
                console.warn(`PBF code ${pbfCode} not found in form`);
            }
        }
        
        // Trigger change event to update totals
        if (typeof window.updateTotal === 'function') {
            window.updateTotal();
        }
    }
    
    // Public method to get pre-filled amounts
    getPrefilledAmounts() {
        return this.prefilledAmounts;
    }
    
    // Processing state management
    isProcessingPayment = false;
    
    // Public method to handle payment processing
    async processPayment(customerData) {
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
            
            // Check each possible line item type
            const lineItemConfigs = [
                { qtyName: 'pxQty1', code: 'WDF', description: 'Wash, Dry, Fold', priceId: 'pxPrice1' },
                { qtyName: 'pxQty2', code: 'BF', description: 'Bag Fee', priceId: 'pxPrice2' },
                { qtyName: 'pxQty3', code: 'MDF', description: 'Minimum Delivery Fee', priceId: 'pxPrice3' },
                { qtyName: 'pxQty4', code: 'PBF', description: 'Per-Bag Fee', priceId: 'pxPrice4' }
            ];
            
            lineItemConfigs.forEach(config => {
                const qtyInput = form.querySelector(`input[name="${config.qtyName}"]`);
                const priceInput = form.querySelector(`input[name="${config.priceId}"]`);
                
                if (qtyInput && priceInput) {
                    const quantity = parseInt(qtyInput.value || '0');
                    const price = parseFloat(priceInput.value || '0') * 100; // Convert to cents
                    
                    if (quantity > 0 && price > 0) {
                        items.push({
                            code: config.code,
                            description: config.description,
                            price: price,
                            quantity: quantity
                        });
                        totalAmount += price * quantity;
                    }
                }
            });
            
            // If no items found, throw error
            if (items.length === 0) {
                throw new Error('No items selected for payment');
            }
            
            // Get bag quantity if it exists (for registration context)
            const bagQtyInput = form.querySelector('input[name="pxQty2"]');
            const bagQuantity = parseInt(bagQtyInput?.value || '0');
            
            // Prepare payment data
            const paymentData = {
                amount: totalAmount,
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
                amount: totalAmount,
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
    
    async cancelPaymentToken(token) {
        try {
            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            };
            
            // Add authorization header if token exists
            const authToken = localStorage.getItem('token');
            if (authToken) {
                requestOptions.headers['Authorization'] = 'Bearer ' + authToken;
            }
            
            // Use CSRF-aware fetch if available
            const fetchFunction = window.CsrfUtils?.csrfFetch || fetch;
            
            const response = await fetchFunction(`/api/v1/payments/cancel-token/${token}`, requestOptions);

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
    
    // Shared window monitoring function for both test and production
    setupWindowMonitoring(paymentWindow, paymentToken, paymentSpinner, messageHandler, onWindowClosed, isTestMode = false) {
        const self = this;
        
        // Track window state
        let lastFocusSucceeded = true;
        let consecutiveFailures = 0;
        // For test mode, allow more failures since window needs time to navigate
        const maxFailures = isTestMode ? 3 : 1;
        let checkCount = 0;
        
        // Log initial window state
        console.log('[Window Monitor] === SETUP ===', {
            mode: isTestMode ? 'TEST' : 'PRODUCTION',
            windowType: typeof paymentWindow,
            windowName: paymentWindow?.name,
            hasWindow: !!paymentWindow,
            token: paymentToken,
            maxFailures: maxFailures
        });
        
        // Add a small delay before starting monitoring to allow window to fully load
        // For test mode, add extra delay for navigation
        const startDelay = isTestMode ? 3000 : 2000;
        setTimeout(() => {
            console.log(`[Window Monitor] === STARTING MONITORING === after ${startDelay}ms delay (${isTestMode ? 'TEST' : 'PRODUCTION'} mode)`);
            
            self.windowCheckInterval = setInterval(() => {
                checkCount++;
                console.log(`[Window Monitor] === CHECK #${checkCount} === (${isTestMode ? 'TEST' : 'PRODUCTION'} mode)`);
                
                let currentCheckFailed = false;
                const checkResults = {};
                
                // Method 1: Try postMessage (doesn't require response)
                try {
                    paymentWindow.postMessage({ type: 'ping' }, '*');
                    checkResults.postMessage = 'SUCCESS';
                    console.log('[Window Monitor] 1. PostMessage: ✓ SUCCESS');
                } catch (postError) {
                    checkResults.postMessage = `FAILED: ${postError.message}`;
                    console.log('[Window Monitor] 1. PostMessage: ✗ FAILED -', postError.message);
                    // In test mode, postMessage failure is a strong indicator window is truly closed
                    if (isTestMode) {
                        console.log('[Window Monitor]    TEST MODE: PostMessage failure indicates window is truly closed');
                    }
                    currentCheckFailed = true;
                }
                
                // Method 2: Try to focus (works even cross-origin)
                try {
                    paymentWindow.focus();
                    checkResults.focus = 'SUCCESS';
                    console.log('[Window Monitor] 2. Focus: ✓ SUCCESS');
                    if (!lastFocusSucceeded) {
                        console.log('[Window Monitor]    Focus succeeded again after previous failure');
                        lastFocusSucceeded = true;
                    }
                } catch (focusError) {
                    checkResults.focus = `FAILED: ${focusError.message}`;
                    console.log('[Window Monitor] 2. Focus: ✗ FAILED -', focusError.message);
                    lastFocusSucceeded = false;
                    currentCheckFailed = true;
                }
                
                // Method 3: Check closed property
                try {
                    const isClosed = paymentWindow.closed;
                    checkResults.closed = isClosed;
                    console.log(`[Window Monitor] 3. Window.closed: ${isClosed} (type: ${typeof isClosed})`);
                    if (isClosed === true) {
                        console.log('[Window Monitor]    Window reports as CLOSED');
                        // For test mode, don't trust window.closed if other checks pass
                        if (isTestMode && checkResults.postMessage === 'SUCCESS' && checkResults.focus === 'SUCCESS') {
                            console.log('[Window Monitor]    TEST MODE: Ignoring window.closed=true since postMessage and focus succeeded');
                        } else {
                            currentCheckFailed = true;
                        }
                    }
                } catch (e) {
                    checkResults.closedError = e.message;
                    console.log('[Window Monitor] 3. Window.closed: ✗ ERROR -', e.message);
                    currentCheckFailed = true;
                }
                
                // Log check summary
                console.log(`[Window Monitor] === CHECK #${checkCount} SUMMARY ===`, {
                    overallResult: currentCheckFailed ? '✗ FAILED' : '✓ PASSED',
                    results: checkResults,
                    consecutiveFailures: currentCheckFailed ? consecutiveFailures + 1 : 0,
                    maxFailures: maxFailures
                });
                
                // Update consecutive failures counter
                if (currentCheckFailed) {
                    consecutiveFailures++;
                    console.log(`Check failed - consecutive failures: ${consecutiveFailures}/${maxFailures}`);
                } else {
                    if (consecutiveFailures > 0) {
                        console.log('Check succeeded - resetting failure counter');
                    }
                    consecutiveFailures = 0;
                }
                
                // If we've had multiple consecutive failures, window is likely closed
                if (consecutiveFailures >= maxFailures) {
                    console.log(`Payment window closed after ${consecutiveFailures} consecutive check failures`);
                    
                    // Clear intervals FIRST before any async operations
                    if (self.windowCheckInterval) {
                        clearInterval(self.windowCheckInterval);
                        self.windowCheckInterval = null;
                    }
                    if (self.pollingInterval) {
                        clearInterval(self.pollingInterval);
                        self.pollingInterval = null;
                    }
                    
                    if (messageHandler) {
                        window.removeEventListener('message', messageHandler);
                    }
                    
                    // Call the onWindowClosed callback if provided
                    if (onWindowClosed) {
                        onWindowClosed();
                    } else {
                        // Default behavior
                        self.cancelPaymentToken(paymentToken).then(() => {
                            console.log('Payment token cancelled');
                            self.handlePaymentFailure(paymentSpinner, 'Payment cancelled by user', null);
                        }).catch(err => {
                            console.error('Error cancelling payment token:', err);
                            self.handlePaymentFailure(paymentSpinner, 'Payment cancelled', null);
                        });
                    }
                }
            }, 2000); // Check every 2 seconds
        }, startDelay); // Wait before starting monitoring
    }

    setupSubmitHandler() {
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
                    await this.processPayment(customerData);
                }
            });
        }
    }
    
    gatherCustomerData() {
        // For ORDER context, get data from localStorage
        if (this.payContext === 'ORDER') {
            const customerStr = localStorage.getItem('currentCustomer');
            if (customerStr) {
                try {
                    const customer = JSON.parse(customerStr);
                    return {
                        email: customer.email || '',
                        firstName: customer.firstName || 'Order',
                        lastName: customer.lastName || 'Customer',
                        phone: customer.phone || '',
                        affiliateId: customer.affiliateId || this.affiliateId
                    };
                } catch (error) {
                    console.error('Error parsing customer data from localStorage:', error);
                }
            }
        }
        
        // For REGISTRATION context, get data from form fields
        const email = document.querySelector('[name="email"], #email')?.value;
        const firstName = document.querySelector('[name="firstName"], #firstName')?.value;
        const lastName = document.querySelector('[name="lastName"], #lastName')?.value;
        const phone = document.querySelector('[name="phone"], #phone')?.value;
        const numberOfBags = document.querySelector('[name="numberOfBags"], #numberOfBags')?.value;
        
        if (!email || !firstName || !lastName) {
            console.error('Missing required customer data');
            return null;
        }
        
        return {
            email,
            firstName,
            lastName,
            phone: phone || '',
            numberOfBags: numberOfBags || '',
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
                    
                    // Skip form config fields - we'll add updated ones
                    if (input.name === 'formID' || input.name === 'hash' || input.name === 'ReturnURL') {
                        return;
                    }
                    
                    const clone = input.cloneNode(true);
                    paygistixForm.appendChild(clone);
                    
                    // Log what we're adding
                    if (input.value && input.value !== '0') {
                        console.log(`Adding ${input.name}: ${input.value}`);
                    }
                });
                
                // Add updated form config fields
                const formIdInput = document.createElement('input');
                formIdInput.type = 'hidden';
                formIdInput.name = 'formID';
                formIdInput.value = this.paymentConfig.formId;
                paygistixForm.appendChild(formIdInput);
                
                const hashInput = document.createElement('input');
                hashInput.type = 'hidden';
                hashInput.name = 'hash';
                hashInput.value = this.paymentConfig.formHash;
                paygistixForm.appendChild(hashInput);
                
                const returnUrlInput = document.createElement('input');
                returnUrlInput.type = 'hidden';
                returnUrlInput.name = 'ReturnURL';
                returnUrlInput.value = this.paymentConfig.returnUrl;
                paygistixForm.appendChild(returnUrlInput);
                
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
                    
                    // Inject script to monitor for navigation in payment window
                    try {
                        // Try to inject a beforeunload listener
                        paymentWindow.addEventListener('beforeunload', () => {
                            console.log('Payment window is navigating...');
                            window.postMessage({ type: 'paygistix-callback-starting' }, '*');
                        });
                    } catch (e) {
                        console.log('Could not attach beforeunload listener to payment window (cross-origin)');
                    }
                    
                    // Update spinner to show processing state
                    console.log('Payment window opened, waiting for completion...');
                    
                    // Track if we've received a payment result
                    let paymentCompleted = false;
                    let windowClosed = false;
                    
                    // Store intervals at class level for proper cleanup
                    self.windowCheckInterval = null;
                    self.pollingInterval = null;
                    
                    // Listen for messages from payment window
                    const messageHandler = (event) => {
                        console.log('Received postMessage:', event.data);
                        
                        // Handle final payment result
                        if (event.data && event.data.type === 'paygistix-payment-callback') {
                            // Verify it's our payment by checking the token
                            if (event.data.paymentToken === paymentToken || !event.data.paymentToken) {
                                console.log('Payment callback received via postMessage:', event.data);
                                
                                // Remove the message listener
                                window.removeEventListener('message', messageHandler);
                                
                                // Clear intervals
                                clearInterval(self.windowCheckInterval);
                                clearInterval(self.pollingInterval);
                                paymentCompleted = true;
                                
                                if (event.data.success) {
                                    // Close the payment window immediately
                                    if (paymentWindow && !paymentWindow.closed) {
                                        paymentWindow.close();
                                    }
                                    
                                    // Note: Payment status is already updated by the form pool callback system
                                    // No need to make an additional API call here
                                    console.log('Payment completed successfully via form pool callback');
                                    
                                    // Pass the payment data from the message
                                    const paymentDetails = {
                                        transactionId: event.data.transactionId || event.data.PNRef || event.data.pnRef
                                    };
                                    self.handlePaymentSuccess(paymentSpinner, null, paymentDetails);
                                } else {
                                    self.handlePaymentFailure(paymentSpinner, 'Payment was declined', paymentWindow);
                                }
                            }
                        }
                    };
                    
                    window.addEventListener('message', messageHandler);
                    
                    // Use shared window monitoring function
                    console.log('Starting cross-origin compatible window monitoring');
                    self.setupWindowMonitoring(paymentWindow, paymentToken, paymentSpinner, messageHandler, () => {
                        windowClosed = true;
                        // Clear polling interval properly
                        if (self.pollingInterval) {
                            clearInterval(self.pollingInterval);
                            self.pollingInterval = null;
                        }
                        window.removeEventListener('message', messageHandler);
                        
                        // Cancel the payment token
                        self.cancelPaymentToken(paymentToken).then(() => {
                            console.log('Payment token cancelled');
                            self.handlePaymentFailure(paymentSpinner, 'Payment cancelled by user', null);
                        }).catch(err => {
                            console.error('Error cancelling payment token:', err);
                            self.handlePaymentFailure(paymentSpinner, 'Payment cancelled', null);
                        });
                    });
                    
                    // Start polling for payment status as backup
                    let pollCount = 0;
                    const maxPollAttempts = 90; // 3 minutes (90 * 2 seconds)
                    
                    self.pollingInterval = setInterval(() => {
                        // Check if window was closed or payment completed
                        if (windowClosed || paymentCompleted) {
                            console.log('Stopping polling - window closed or payment completed');
                            clearInterval(self.pollingInterval);
                            return;
                        }
                        
                        pollCount++;
                        console.log(`Polling payment status (attempt ${pollCount})...`);
                        
                        // Stop polling after max attempts
                        if (pollCount >= maxPollAttempts) {
                            console.log('Max polling attempts reached, stopping...');
                            clearInterval(self.pollingInterval);
                            clearInterval(self.windowCheckInterval);
                            window.removeEventListener('message', messageHandler);
                            
                            // If window is still open, close it
                            if (paymentWindow && !paymentWindow.closed) {
                                paymentWindow.close();
                            }
                            
                            self.handlePaymentFailure(paymentSpinner, 'Payment timed out. Please try again.', null);
                            return;
                        }
                        
                        self.checkPaymentStatus(paymentToken, (status, error, paymentData) => {
                            console.log(`Payment status check result: ${status}`);
                            
                            if (status === 'success' || status === 'completed') {
                                console.log('Payment completed via polling!');
                                paymentCompleted = true;
                                clearInterval(self.pollingInterval);
                                clearInterval(self.windowCheckInterval);
                                window.removeEventListener('message', messageHandler);
                                
                                // Close payment window if still open
                                if (paymentWindow && !paymentWindow.closed) {
                                    paymentWindow.close();
                                }
                                
                                self.handlePaymentSuccess(paymentSpinner, null, paymentData);
                            } else if (status === 'failed' || status === 'cancelled') {
                                console.log('Payment failed/cancelled via polling');
                                paymentCompleted = true;
                                clearInterval(self.pollingInterval);
                                clearInterval(self.windowCheckInterval);
                                window.removeEventListener('message', messageHandler);
                                self.handlePaymentFailure(paymentSpinner, error || 'Payment was not completed', paymentWindow);
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
                    callback(data.status, data.errorMessage, data);
                } else {
                    callback('error', 'Failed to check payment status');
                }
            })
            .catch(error => {
                console.error('Error checking payment status:', error);
                callback('error', error.message);
            });
    }
    
    handlePaymentSuccess(spinner, paymentWindow, paymentData) {
        // Clear any remaining intervals to ensure polling stops
        if (this.windowCheckInterval) {
            clearInterval(this.windowCheckInterval);
            this.windowCheckInterval = null;
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.timeoutWarning) {
            clearTimeout(this.timeoutWarning);
            this.timeoutWarning = null;
        }
        
        if (paymentWindow && !paymentWindow.closed) {
            paymentWindow.close();
        }
        
        if (spinner) {
            spinner.hide();
        }
        
        // Payment successful - trigger customer registration completion
        this.isProcessingPayment = false;
        
        // Call the registration completion callback if provided
        if (this.config.onPaymentSuccess) {
            this.config.onPaymentSuccess(paymentData);
        } else {
            // Default behavior - show success message
            if (window.modalAlert) {
                window.modalAlert('Payment successful! Your registration will now be completed.', 'Success');
            }
        }
    }
    
    handlePaymentFailure(spinner, error, paymentWindow) {
        console.log('handlePaymentFailure called with:', { spinner, error, paymentWindow });
        
        // Clear any remaining intervals to ensure polling stops
        if (this.windowCheckInterval) {
            clearInterval(this.windowCheckInterval);
            this.windowCheckInterval = null;
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.timeoutWarning) {
            clearTimeout(this.timeoutWarning);
            this.timeoutWarning = null;
        }
        
        if (paymentWindow && !paymentWindow.closed) {
            console.log('Closing payment window');
            paymentWindow.close();
        }
        
        if (spinner) {
            console.log('Hiding spinner');
            spinner.hide();
        }
        
        // Reset the payment button if it exists
        const continueButton = document.getElementById('continueToPaymentBtn');
        if (continueButton) {
            console.log('Resetting payment button state');
            continueButton.textContent = 'Complete Payment';
            continueButton.disabled = false;
            continueButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        
        this.isProcessingPayment = false;
        
        // Call the registration failure callback if provided
        if (this.config.onPaymentFailure) {
            this.config.onPaymentFailure(error);
        } else {
            // Default behavior - show error message
            console.log('window.modalAlert available:', !!window.modalAlert);
            if (window.modalAlert) {
                console.log('Showing modal alert with message:', error);
                window.modalAlert(error || 'Your payment could not be processed. Please try again.', 'Payment Failed');
            } else {
                console.error('modalAlert not available, falling back to alert');
                alert(error || 'Your payment could not be processed. Please try again.');
            }
        }
    }
    
    // Test mode payment processing
    async processPaymentTestMode(customerData) {
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
            
            // Check each possible line item type
            const lineItemConfigs = [
                { qtyName: 'pxQty1', code: 'WDF', description: 'Wash, Dry, Fold', priceId: 'pxPrice1' },
                { qtyName: 'pxQty2', code: 'BF', description: 'Bag Fee', priceId: 'pxPrice2' },
                { qtyName: 'pxQty3', code: 'MDF', description: 'Minimum Delivery Fee', priceId: 'pxPrice3' },
                { qtyName: 'pxQty4', code: 'PBF', description: 'Per-Bag Fee', priceId: 'pxPrice4' }
            ];
            
            lineItemConfigs.forEach(config => {
                const qtyInput = form.querySelector(`input[name="${config.qtyName}"]`);
                const priceInput = form.querySelector(`input[name="${config.priceId}"]`);
                
                if (qtyInput && priceInput) {
                    const quantity = parseInt(qtyInput.value || '0');
                    const price = parseFloat(priceInput.value || '0') * 100; // Convert to cents
                    
                    if (quantity > 0 && price > 0) {
                        items.push({
                            code: config.code,
                            description: config.description,
                            price: price,
                            quantity: quantity
                        });
                        totalAmount += price * quantity;
                    }
                }
            });
            
            // If no items found, throw error
            if (items.length === 0) {
                throw new Error('No items selected for payment');
            }
            
            // Get bag quantity if it exists (for backward compatibility)
            const bagQtyInput = form.querySelector('input[name="pxQty2"]');
            const bagQuantity = parseInt(bagQtyInput?.value || '0');
            
            // For backward compatibility, if numberOfBags is passed but not in form, use it
            if (!bagQuantity && customerData.numberOfBags) {
                const numberOfBags = parseInt(customerData.numberOfBags);
                if (numberOfBags > 0) {
                    // Add bag fee item
                    const bagPrice = 10.00 * 100; // $10 per bag in cents
                    items.push({
                        code: 'BF',
                        description: 'Bag Fee',
                        price: bagPrice,
                        quantity: numberOfBags
                    });
                    totalAmount += bagPrice * numberOfBags;
                }
            }
            
            // Prepare payment data
            const paymentData = {
                amount: totalAmount,
                items: items,
                formId: this.paymentConfig.formId,
                merchantId: this.paymentConfig.merchantId
            };
            
            // Create payment token
            const tokenData = await this.createPaymentToken(customerData, paymentData);
            const paymentToken = tokenData.token;
            const formConfig = tokenData.formConfig;
            
            // Store payment session data
            const paymentSession = {
                token: paymentToken,
                amount: totalAmount,
                timestamp: Date.now(),
                customerData: customerData,
                payContext: this.payContext,
                items: items
            };
            
            // Add bag quantity if it exists
            if (bagQuantity > 0 || customerData.numberOfBags > 0) {
                paymentSession.numberOfBags = bagQuantity || customerData.numberOfBags;
            }
            
            // Store in sessionStorage - use appropriate key based on context
            const sessionKey = this.payContext === 'REGISTRATION' ? 'pendingRegistration' : 'pendingOrderPayment';
            sessionStorage.setItem(sessionKey, JSON.stringify(paymentSession));
            sessionStorage.setItem('testPaymentCustomerData', JSON.stringify(customerData));
            sessionStorage.setItem('testPaymentToken', paymentToken);
            sessionStorage.setItem('testPaymentCallbackUrl', formConfig.callbackUrl);
            
            // Store token for cancel handler
            this.paymentToken = paymentToken;
            
            // Show payment processing modal with cancel button for test mode
            const self = this;
            const paymentSpinner = window.SwirlSpinnerUtils ? 
                window.SwirlSpinnerUtils.showGlobal({
                    message: 'Opening Test Payment Window',
                    submessage: 'Please complete your payment in the new window...',
                    showCancelButton: true,
                    onCancel: () => {
                        console.log('User clicked cancel button');
                        // Clear intervals
                        if (self.windowCheckInterval) {
                            clearInterval(self.windowCheckInterval);
                            self.windowCheckInterval = null;
                        }
                        if (self.pollingInterval) {
                            clearInterval(self.pollingInterval);
                            self.pollingInterval = null;
                        }
                        // Close payment window if open
                        if (self.testPaymentWindow && !self.testPaymentWindow.closed) {
                            try {
                                self.testPaymentWindow.close();
                            } catch (e) {
                                console.log('Could not close test window:', e);
                            }
                        }
                        
                        // Mark as not processing anymore
                        self.isProcessingPayment = false;
                        
                        // Cancel the payment token
                        self.cancelPaymentToken(self.paymentToken).then(() => {
                            console.log('Payment token cancelled via cancel button');
                            self.handlePaymentFailure(paymentSpinner, 'Payment cancelled by user', null);
                        }).catch(err => {
                            console.error('Error cancelling payment token:', err);
                            self.handlePaymentFailure(paymentSpinner, 'Payment cancelled', null);
                        });
                    }
                }) : null;
            
            // Open test payment window
            const windowWidth = 800;
            const windowHeight = 600;
            const left = (screen.width - windowWidth) / 2;
            const top = (screen.height - windowHeight) / 2;
            const windowFeatures = `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`;
            
            // Use absolute URL to ensure proper resolution when in iframe
            const baseUrl = window.location.protocol + '//' + window.location.host;
            const testPaymentUrl = `${baseUrl}/test-payment?token=${paymentToken}&amount=${totalAmount}&callbackUrl=${encodeURIComponent(formConfig.callbackUrl)}`;
            console.log('Opening test payment window with URL:', testPaymentUrl);
            
            let paymentWindow;
            try {
                // Try opening with empty URL first, like Paygistix does
                paymentWindow = window.open('', 'TestPaymentWindow', windowFeatures);
                if (paymentWindow) {
                    // Navigate to the test payment URL
                    paymentWindow.location.href = testPaymentUrl;
                }
                console.log('window.open returned:', paymentWindow);
                console.log('Type of paymentWindow:', typeof paymentWindow);
                console.log('paymentWindow constructor:', paymentWindow?.constructor?.name);
            } catch (openError) {
                console.error('Error opening window:', openError);
                throw new Error('Failed to open payment window');
            }
            
            if (!paymentWindow) {
                console.error('Payment window is null - popup blocked');
                throw new Error('Pop-up blocked');
            }
            
            // Check if we got a proper Window object
            if (typeof paymentWindow !== 'object' || paymentWindow === window || paymentWindow.constructor?.name !== 'Window') {
                console.error('Invalid window object returned:', paymentWindow);
                throw new Error('Failed to open payment window - invalid window object');
            }
            
            console.log('Test payment window opened:', paymentWindow);
            console.log('Window closed status immediately after open:', paymentWindow.closed);
            
            // Note: In cross-origin scenarios, window.closed might report true even when window is open
            // The shared monitoring function will handle proper detection
            
            
            // Track if we've received a payment result
            let paymentCompleted = false;
            let windowClosed = false;
            
            // Store intervals at class level for proper cleanup
            self.windowCheckInterval = null;
            self.pollingInterval = null;
            
            // For test mode, use a simple interval to check if window was closed
            console.log('Test payment window opened - monitoring for user cancellation');
            
            // Store reference to window for manual close after success
            self.testPaymentWindow = paymentWindow;
            
            // Add initial check to see if window is accessible
            setTimeout(() => {
                try {
                    console.log('Initial test window check after 500ms:');
                    console.log('- window.closed:', paymentWindow.closed);
                    console.log('- can focus:', !!(paymentWindow.focus));
                    console.log('- location accessible:', !!(paymentWindow.location));
                } catch (e) {
                    console.log('Initial test window check error:', e.message);
                }
            }, 500);
            
            // Use shared window monitoring function
            console.log('Test payment window opened - using cross-origin compatible monitoring');
            // Pass true for isTestMode parameter
            self.setupWindowMonitoring(paymentWindow, paymentToken, paymentSpinner, null, () => {
                windowClosed = true;
                // Clear polling interval properly
                if (self.pollingInterval) {
                    clearInterval(self.pollingInterval);
                    self.pollingInterval = null;
                }
                
                // Cancel the payment token
                self.cancelPaymentToken(paymentToken).then(() => {
                    console.log('Payment token cancelled');
                    self.handlePaymentFailure(paymentSpinner, 'Payment cancelled by user', null);
                }).catch(err => {
                    console.error('Error cancelling payment token:', err);
                    self.handlePaymentFailure(paymentSpinner, 'Payment cancelled', null);
                });
            }, true); // Pass true for isTestMode
            
            // Start polling for payment status as backup
            let pollCount = 0;
            const maxPollAttempts = 90; // 3 minutes (90 * 2 seconds)
            
            console.log('Starting payment status polling');
            self.pollingInterval = setInterval(() => {
                // Check if window was closed or payment completed
                if (windowClosed || paymentCompleted) {
                    console.log('Stopping polling - window closed or payment completed');
                    clearInterval(self.pollingInterval);
                    return;
                }
                
                pollCount++;
                console.log(`Polling test payment status (attempt ${pollCount})...`);
                
                // Stop polling after max attempts
                if (pollCount >= maxPollAttempts) {
                    console.log('Max polling attempts reached, stopping...');
                    clearInterval(self.pollingInterval);
                    clearInterval(self.windowCheckInterval);
                    
                    // If window is still open, close it
                    if (paymentWindow && !paymentWindow.closed) {
                        paymentWindow.close();
                    }
                    
                    self.handlePaymentFailure(paymentSpinner, 'Payment timed out. Please try again.', null);
                    return;
                }
                
                self.checkPaymentStatus(paymentToken, (status, error, paymentData) => {
                    console.log(`Payment status check result: ${status}`);
                    
                    if (status === 'success' || status === 'completed') {
                        console.log('Test payment completed via polling!');
                        paymentCompleted = true;
                        clearInterval(self.pollingInterval);
                        
                        // Close test payment window if still open
                        if (self.testPaymentWindow && !self.testPaymentWindow.closed) {
                            try {
                                self.testPaymentWindow.close();
                            } catch (e) {
                                console.log('Could not close test window:', e);
                            }
                        }
                        
                        self.handlePaymentSuccess(paymentSpinner, null, paymentData);
                    } else if (status === 'failed' || status === 'cancelled') {
                        console.log('Test payment failed/cancelled via polling');
                        paymentCompleted = true;
                        clearInterval(self.pollingInterval);
                        
                        // Close test payment window if still open
                        if (self.testPaymentWindow && !self.testPaymentWindow.closed) {
                            try {
                                self.testPaymentWindow.close();
                            } catch (e) {
                                console.log('Could not close test window:', e);
                            }
                        }
                        
                        self.handlePaymentFailure(paymentSpinner, error || 'Payment was not completed', null);
                    }
                });
            }, 2000); // Check every 2 seconds
            
        } catch (error) {
            console.error('Error in test payment processing:', error);
            this.isProcessingPayment = false;
            
            if (window.modalAlert) {
                window.modalAlert(error.message || 'Failed to process payment. Please try again.', 'Payment Error');
            }
        }
    }
}

// Make the class available globally
window.PaygistixPaymentForm = PaygistixPaymentForm;