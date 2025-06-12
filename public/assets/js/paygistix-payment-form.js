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
            
            // Call success callback
            this.onSuccess();
        } catch (error) {
            console.error('PaygistixPaymentForm initialization error:', error);
            this.onError(error);
        }
    }
    
    async loadAffiliateSettings() {
        try {
            const affiliateResponse = await fetch(`/api/v1/affiliates/${this.affiliateId}`, {
                headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                }
            });
            
            if (affiliateResponse.ok) {
                const affiliateData = await affiliateResponse.json();
                if (affiliateData.success && affiliateData.affiliate) {
                    this.affiliateSettings = {
                        perBagDeliveryFee: affiliateData.affiliate.perBagDeliveryFee,
                        minimumDeliveryFee: affiliateData.affiliate.minimumDeliveryFee
                    };
                }
            }
        } catch (error) {
            console.error('Error loading affiliate settings:', error);
        }
    }
    
    render() {
        const formHTML = `
            <div class="paygistix-payment-wrapper">
                <form action="https://safepay.paymentlogistics.net/transaction.asp" method="post" id="paygistixPaymentForm">
                <style type="text/css">
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
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .paygistix-payment-wrapper tbody tr {
                        border-bottom: 1px solid #e5e7eb;
                        transition: background-color 0.2s;
                    }
                    .paygistix-payment-wrapper tbody tr:hover {
                        background-color: #f9fafb;
                    }
                    .paygistix-payment-wrapper tbody tr.hidden-row {
                        display: none;
                    }
                    .paygistix-payment-wrapper td {
                        padding: 12px 16px;
                        font-size: 14px;
                    }
                    .paygistix-payment-wrapper .pxCode {
                        font-weight: 600;
                        color: #374151;
                        font-family: monospace;
                    }
                    .paygistix-payment-wrapper .pxDescription {
                        color: #4b5563;
                    }
                    .paygistix-payment-wrapper .pxPrice {
                        text-align: right;
                        font-weight: 600;
                        color: #1f2937;
                        font-family: monospace;
                    }
                    .paygistix-payment-wrapper .pxQty {
                        width: 60px;
                        text-align: right;
                        padding: 6px 10px;
                        border: 2px solid #e5e7eb;
                        border-radius: 6px;
                        font-size: 14px;
                        font-weight: 500;
                        transition: border-color 0.2s;
                    }
                    .paygistix-payment-wrapper .pxQty:focus {
                        outline: none;
                        border-color: #3b82f6;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    }
                    .paygistix-payment-wrapper .pxQty:disabled {
                        background-color: #f3f4f6;
                        cursor: not-allowed;
                    }
                    .paygistix-payment-wrapper tfoot td {
                        padding: 16px;
                        background: #f9fafb;
                        border-top: 2px solid #e5e7eb;
                    }
                    .paygistix-payment-wrapper #pxTotal {
                        font-size: 18px;
                        font-weight: bold;
                        color: #1f2937;
                        margin-right: 20px;
                    }
                    .paygistix-payment-wrapper #pxSubmit {
                        background: #3b82f6;
                        color: white;
                        padding: 10px 24px;
                        border: none;
                        border-radius: 6px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .paygistix-payment-wrapper #pxSubmit:hover {
                        background: #2563eb;
                    }
                    .paygistix-payment-wrapper #pxSubmit:focus {
                        outline: none;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
                    }
                    .paygistix-payment-wrapper #pxSubmit:disabled {
                        background: #9ca3af;
                        cursor: not-allowed;
                    }
                </style>
                <table id="pxForm" name="pxForm">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Item</th>
                            <th>Price</th>
                            <th>Qty</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr id="row-WDF" data-code="WDF">
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
                        <tr id="row-DF5" data-code="DF5" data-delivery-fee="5.00">
                            <td class="pxCode">
                                DF5<input type="hidden" name="pxCode2" value="DF5" />
                            </td>
                            <td class="pxDescription">
                                Per bag delivery fee<input type="hidden" name="pxDescription2" value="Per bag delivery fee" />
                            </td>
                            <td class="pxPrice">
                                $5.00<input type="hidden" name="pxPrice2" id="pxPrice2" value="5.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty2" id="pxQty2" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-DF10" data-code="DF10" data-delivery-fee="10.00">
                            <td class="pxCode">
                                DF10<input type="hidden" name="pxCode3" value="DF10" />
                            </td>
                            <td class="pxDescription">
                                Per bag delivery fee<input type="hidden" name="pxDescription3" value="Per bag delivery fee" />
                            </td>
                            <td class="pxPrice">
                                $10.00<input type="hidden" name="pxPrice3" id="pxPrice3" value="10.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty3" id="pxQty3" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-DF15" data-code="DF15" data-delivery-fee="15.00">
                            <td class="pxCode">
                                DF15<input type="hidden" name="pxCode4" value="DF15" />
                            </td>
                            <td class="pxDescription">
                                Per bag delivery fee<input type="hidden" name="pxDescription4" value="Per bag delivery fee" />
                            </td>
                            <td class="pxPrice">
                                $15.00<input type="hidden" name="pxPrice4" id="pxPrice4" value="15.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty4" id="pxQty4" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-DF20" data-code="DF20" data-delivery-fee="20.00">
                            <td class="pxCode">
                                DF20<input type="hidden" name="pxCode5" value="DF20" />
                            </td>
                            <td class="pxDescription">
                                Per bag delivery fee<input type="hidden" name="pxDescription5" value="Per bag delivery fee" />
                            </td>
                            <td class="pxPrice">
                                $20.00<input type="hidden" name="pxPrice5" id="pxPrice5" value="20.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty5" id="pxQty5" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-MF25" data-code="MF25" data-min-fee="25.00">
                            <td class="pxCode">
                                MF25<input type="hidden" name="pxCode6" value="MF25" />
                            </td>
                            <td class="pxDescription">
                                Minimum delivery fee<input type="hidden" name="pxDescription6" value="Minimum delivery fee" />
                            </td>
                            <td class="pxPrice">
                                $25.00<input type="hidden" name="pxPrice6" id="pxPrice6" value="25.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty6" id="pxQty6" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-MF35" data-code="MF35" data-min-fee="35.00">
                            <td class="pxCode">
                                MF35<input type="hidden" name="pxCode7" value="MF35" />
                            </td>
                            <td class="pxDescription">
                                Minimum delivery fee<input type="hidden" name="pxDescription7" value="Minimum delivery fee" />
                            </td>
                            <td class="pxPrice">
                                $35.00<input type="hidden" name="pxPrice7" id="pxPrice7" value="35.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty7" id="pxQty7" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-MF50" data-code="MF50" data-min-fee="50.00">
                            <td class="pxCode">
                                MF50<input type="hidden" name="pxCode8" value="MF50" />
                            </td>
                            <td class="pxDescription">
                                Minimum delivery fee<input type="hidden" name="pxDescription8" value="Minimum delivery fee" />
                            </td>
                            <td class="pxPrice">
                                $50.00<input type="hidden" name="pxPrice8" id="pxPrice8" value="50.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty8" id="pxQty8" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-MF75" data-code="MF75" data-min-fee="75.00">
                            <td class="pxCode">
                                MF75<input type="hidden" name="pxCode9" value="MF75" />
                            </td>
                            <td class="pxDescription">
                                Minimum delivery fee<input type="hidden" name="pxDescription9" value="Minimum delivery fee" />
                            </td>
                            <td class="pxPrice">
                                $75.00<input type="hidden" name="pxPrice9" id="pxPrice9" value="75.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty9" id="pxQty9" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-BF" data-code="BF">
                            <td class="pxCode">
                                BF<input type="hidden" name="pxCode10" value="BF" />
                            </td>
                            <td class="pxDescription">
                                Bag fee<input type="hidden" name="pxDescription10" value="Bag fee" />
                            </td>
                            <td class="pxPrice">
                                $10.00<input type="hidden" name="pxPrice10" id="pxPrice10" value="10.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty10" id="pxQty10" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" align="right">
                                <span id="pxTotal"><b>Total $0.00</b></span>
                                <input type="submit" id="pxSubmit" value="Pay Now" />
                            </td>
                        </tr>
                    </tfoot>
                </table>
                <input type="hidden" name="txnType" value="FORM" />
                <input type="hidden" name="merchantID" value="wmaxaustWEB" />
                <input type="hidden" name="formID" value="55015141435" />
                <input type="hidden" name="hash" value="9602f2d6b851854f57f40bf82382dff3" />
                <input type="hidden" name="ReturnURL" value="https://wavemax.promo/payment-callback-handler.html" />
                </form>
            </div>
        `;
        
        this.container.innerHTML = formHTML;
    }
    
    initializeVisibility() {
        const rows = this.container.querySelectorAll('tbody tr');
        
        if (this.payContext === 'REGISTRATION') {
            // For registration, hide all rows except BF (Bag Fee)
            rows.forEach(row => {
                if (row.getAttribute('data-code') !== 'BF') {
                    row.classList.add('hidden-row');
                    // Disable the quantity input
                    const qtyInput = row.querySelector('.pxQty');
                    if (qtyInput) {
                        qtyInput.disabled = true;
                        qtyInput.value = '0';
                    }
                }
            });
        } else if (this.payContext === 'ORDER' && this.affiliateSettings) {
            // For orders, show WDF and appropriate delivery/minimum fees
            const perBagFee = this.affiliateSettings.perBagDeliveryFee;
            const minFee = this.affiliateSettings.minimumDeliveryFee;
            
            rows.forEach(row => {
                const code = row.getAttribute('data-code');
                let shouldShow = false;
                
                // Always show WDF for orders
                if (code === 'WDF') {
                    shouldShow = true;
                }
                // Show matching delivery fee
                else if (code.startsWith('DF')) {
                    const fee = parseFloat(row.getAttribute('data-delivery-fee'));
                    shouldShow = (fee === perBagFee);
                }
                // Show matching minimum fee
                else if (code.startsWith('MF')) {
                    const fee = parseFloat(row.getAttribute('data-min-fee'));
                    shouldShow = (fee === minFee);
                }
                // Hide BF for orders
                else if (code === 'BF') {
                    shouldShow = false;
                }
                
                if (!shouldShow) {
                    row.classList.add('hidden-row');
                    const qtyInput = row.querySelector('.pxQty');
                    if (qtyInput) {
                        qtyInput.disabled = true;
                        qtyInput.value = '0';
                    }
                }
            });
        }
    }
    
    initializeHandlers() {
        // Apply pre-filled amounts if any
        if (this.prefilledAmounts) {
            Object.keys(this.prefilledAmounts).forEach(code => {
                const row = this.container.querySelector(`tr[data-code="${code}"]`);
                if (row && !row.classList.contains('hidden-row')) {
                    const qtyInput = row.querySelector('.pxQty');
                    if (qtyInput) {
                        qtyInput.value = this.prefilledAmounts[code];
                        // Trigger the formatQty function
                        if (window.formatQty) {
                            window.formatQty(qtyInput);
                        }
                        // Trigger blur event to update the form
                        qtyInput.dispatchEvent(new Event('blur'));
                        // Also trigger input event for form recalculation
                        qtyInput.dispatchEvent(new Event('input'));
                    }
                }
            });
        }
    }
    
    loadPaygistixScript() {
        // Check if script is already loaded
        if (document.querySelector('script[src*="safepay.paymentlogistics.net/form.js"]')) {
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://safepay.paymentlogistics.net/form.js';
        script.type = 'text/javascript';
        script.async = true;
        document.body.appendChild(script);
    }
    
    setPrefilledAmounts(amounts) {
        this.prefilledAmounts = amounts;
        this.initializeHandlers();
    }
    
    getTotal() {
        const totalElement = this.container.querySelector('#pxTotal');
        if (totalElement) {
            const match = totalElement.textContent.match(/\$([0-9.]+)/);
            return match ? parseFloat(match[1]) : 0;
        }
        return 0;
    }
    
    setOrderDetails(details) {
        // Store order details for reference
        this.orderDetails = details;
    }
    
    getForm() {
        return this.container.querySelector('#paygistixPaymentForm');
    }
}

// Make it available globally
window.PaygistixPaymentForm = PaygistixPaymentForm;