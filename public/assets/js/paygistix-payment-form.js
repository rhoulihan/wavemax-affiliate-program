/**
 * Paygistix Payment Form Component
 * Embedded payment control for WaveMAX forms
 */

class PaygistixPaymentForm {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            orderId: options.orderId || '',
            customerId: options.customerId || '',
            orderDetails: options.orderDetails || {},
            returnURL: options.returnURL || `${window.location.origin}/api/v1/payments/callback`,
            onSuccess: options.onSuccess || function() {},
            onError: options.onError || function() {},
            ...options
        };
        
        this.formId = 'paygistix-payment-form-' + Date.now();
        
        // These values should be passed from the server with environment variables
        this.merchantID = options.merchantId || 'wmaxaustWEB';
        this.formID = options.formId || '55015031208';
        this.hash = options.hash || 'YOUR_HASH_HERE';
        this.formActionUrl = options.formActionUrl || 'https://safepay.paymentlogistics.net/transaction.asp';
        
        // Context and pricing
        this.payContext = this.getPayContext();
        this.affiliateId = this.getAffiliateId();
        this.wdfPrice = 1.25; // Default, will be updated from system config
        this.bagFee = 1.00; // Default, will be updated from system config
        this.affiliateSettings = null;
        
        this.init();
    }
    
    getPayContext() {
        const contextElement = document.getElementById('PAYCONTEXT');
        return contextElement ? contextElement.value || contextElement.textContent : 'ORDER';
    }
    
    getAffiliateId() {
        const affiliateElement = document.getElementById('AFFILIATEID');
        return affiliateElement ? affiliateElement.value || affiliateElement.textContent : null;
    }
    
    async init() {
        if (!this.container) {
            console.error('Payment form container not found');
            return;
        }
        
        // Load pricing configuration based on context
        await this.loadPricingConfig();
        
        this.render();
        this.attachEventListeners();
        this.loadPaygistixScript();
    }
    
    async loadPricingConfig() {
        try {
            // Load system WDF price
            const wdfResponse = await fetch('/api/v1/system/config/wdf_price_per_pound');
            if (wdfResponse.ok) {
                const wdfData = await wdfResponse.json();
                if (wdfData.success && wdfData.value) {
                    this.wdfPrice = parseFloat(wdfData.value);
                }
            }
            
            // Load system bag fee
            const bagFeeResponse = await fetch('/api/v1/system/config/bag_fee');
            if (bagFeeResponse.ok) {
                const bagFeeData = await bagFeeResponse.json();
                if (bagFeeData.success && bagFeeData.value) {
                    this.bagFee = parseFloat(bagFeeData.value);
                }
            }
            
            // Load affiliate settings if in ORDER context
            if (this.payContext === 'ORDER' && this.affiliateId) {
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
            }
        } catch (error) {
            console.error('Error loading pricing config:', error);
        }
    }
    
    render() {
        const formHTML = `
            <div class="paygistix-payment-wrapper">
                <form id="${this.formId}" action="${this.formActionUrl}" method="post">
                    <style type="text/css">
                        .pxPrice {text-align:right;}
                        .pxQty {width:60px;text-align:right;}
                        .paygistix-payment-wrapper {
                            padding: 20px;
                            background: #f8f9fa;
                            border-radius: 8px;
                            margin: 20px 0;
                        }
                        .paygistix-payment-wrapper table {
                            width: 100%;
                            background: white;
                            border-radius: 4px;
                            overflow: hidden;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        .paygistix-payment-wrapper th {
                            background: #3b82f6;
                            color: white;
                            padding: 12px;
                            text-align: left;
                        }
                        .paygistix-payment-wrapper td {
                            padding: 10px;
                            border-bottom: 1px solid #e5e7eb;
                        }
                        .paygistix-payment-wrapper tfoot td {
                            background: #f3f4f6;
                            padding: 15px;
                            font-size: 1.1em;
                            font-weight: bold;
                        }
                        #pxSubmit {
                            background: #3b82f6;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 1em;
                            margin-left: 20px;
                        }
                        #pxSubmit:hover {
                            background: #2563eb;
                        }
                        #pxSubmit:disabled {
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
                            ${this.generateServiceRows()}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" align="right">
                                    <span id="pxTotal"><b>Total $0.00</b></span>
                                    <input type="submit" id="pxSubmit" value="Pay Now" disabled />
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <!-- Hidden fields -->
                    <input type="hidden" name="txnType" value="FORM" />
                    <input type="hidden" name="merchantID" value="${this.merchantID}" />
                    <input type="hidden" name="formID" value="${this.formID}" />
                    <input type="hidden" name="hash" value="${this.hash}" />
                    <input type="hidden" name="ReturnURL" value="${this.options.returnURL}" />
                    
                    <!-- Order metadata -->
                    <input type="hidden" name="orderId" value="${this.options.orderId}" />
                    <input type="hidden" name="customerId" value="${this.options.customerId}" />
                    <input type="hidden" name="metadata" value="${JSON.stringify(this.options.orderDetails)}" />
                </form>
            </div>
        `;
        
        this.container.innerHTML = formHTML;
    }
    
    generateServiceRows() {
        // Get all possible services
        let allServices = this.getAllServices();
        
        // Filter services based on context
        let visibleServices = this.filterServicesByContext(allServices);
        
        // Generate rows for visible services
        return visibleServices.map((service, index) => {
            const num = service.index;
            const display = service.visible ? '' : 'style="display:none;"';
            return `
                <tr ${display} data-service-code="${service.code}">
                    <td class="pxCode">
                        ${service.code}<input type="hidden" name="pxCode${num}" value="${service.code}" />
                    </td>
                    <td class="pxDescription">
                        ${service.description}<input type="hidden" name="pxDescription${num}" value="${service.description}" />
                    </td>
                    <td class="pxPrice">
                        $${service.price.toFixed(2)}<input type="hidden" name="pxPrice${num}" id="pxPrice${num}" value="${service.price.toFixed(2)}" />
                    </td>
                    <td>
                        <input type="text" class="pxQty" name="pxQty${num}" id="pxQty${num}" value="0" maxlength="3"/>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    getAllServices() {
        // Get prices from system config
        const wdfPrice = this.wdfPrice;
        const bagFeePrice = this.bagFee;
        
        // Get affiliate fees or use defaults
        const perBagFee = this.affiliateSettings?.perBagDeliveryFee || 5.00;
        const minimumFee = this.affiliateSettings?.minimumDeliveryFee || 25.00;
        
        // All possible service definitions with dynamic pricing
        return [
            { code: 'BF', description: 'Bag Fee', price: bagFeePrice, index: 1 },
            { code: 'WDF', description: 'Wash Dry Fold Service', price: wdfPrice, unit: 'per lb', index: 2 },
            { code: 'DF5', description: '$5 per bag delivery fee', price: 5.00, index: 3 },
            { code: 'DF10', description: '$10 per bag delivery fee', price: 10.00, index: 4 },
            { code: 'DF15', description: '$15 per bag delivery fee', price: 15.00, index: 5 },
            { code: 'DF20', description: '$20 per bag delivery fee', price: 20.00, index: 6 },
            { code: 'MC25', description: 'Minimum delivery fee', price: 25.00, index: 7 },
            { code: 'MC30', description: 'Minimum delivery fee', price: 30.00, index: 8 },
            { code: 'MC40', description: 'Minimum delivery fee', price: 40.00, index: 9 },
            { code: 'MC50', description: 'Minimum delivery fee', price: 50.00, index: 10 },
            { code: 'MC75', description: 'Minimum delivery fee', price: 75.00, index: 11 }
        ];
    }
    
    filterServicesByContext(allServices) {
        if (this.payContext === 'REGISTRATION') {
            // For registration, only show BF (Bag Fee)
            return allServices.map(service => ({
                ...service,
                visible: service.code === 'BF'
            }));
        } else if (this.payContext === 'ORDER') {
            // For orders, show WDF and appropriate delivery fees based on affiliate settings
            const perBagFee = this.affiliateSettings?.perBagDeliveryFee || 5.00;
            const minimumFee = this.affiliateSettings?.minimumDeliveryFee || 25.00;
            
            return allServices.map(service => {
                let visible = false;
                
                // Always show WDF for orders
                if (service.code === 'WDF') {
                    visible = true;
                }
                // Show matching per bag delivery fee
                else if (service.code.startsWith('DF') && parseFloat(service.price) === perBagFee) {
                    visible = true;
                    // Update description to reflect actual price
                    service.description = `$${perBagFee.toFixed(0)} per bag delivery fee`;
                }
                // Show matching minimum fee
                else if (service.code.startsWith('MC') && parseFloat(service.price) === minimumFee) {
                    visible = true;
                    // Update description to reflect actual price
                    service.description = `$${minimumFee.toFixed(0)} minimum delivery fee`;
                }
                
                return { ...service, visible };
            });
        }
        
        // Default: show all services
        return allServices.map(service => ({ ...service, visible: true }));
    }
    
    attachEventListeners() {
        // Attach blur event to all quantity inputs
        const qtyInputs = this.container.querySelectorAll('.pxQty');
        qtyInputs.forEach(input => {
            input.addEventListener('blur', (e) => this.formatQty(e.target));
            input.addEventListener('input', () => this.updateTotal());
        });
        
        // Handle form submission
        const form = document.getElementById(this.formId);
        form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
    
    formatQty(input) {
        // Ensure valid quantity
        let value = parseInt(input.value) || 0;
        if (value < 0) value = 0;
        if (value > 999) value = 999;
        input.value = value;
        this.updateTotal();
    }
    
    updateTotal() {
        let total = 0;
        let hasItems = false;
        
        // Calculate total for all services (including hidden ones)
        for (let i = 1; i <= 11; i++) {
            const qtyInput = document.getElementById(`pxQty${i}`);
            const priceInput = document.getElementById(`pxPrice${i}`);
            
            if (qtyInput && priceInput) {
                const qty = parseInt(qtyInput.value) || 0;
                const price = parseFloat(priceInput.value) || 0;
                
                // Only count visible items
                const row = qtyInput.closest('tr');
                if (row && row.style.display !== 'none') {
                    total += qty * price;
                    if (qty > 0) hasItems = true;
                }
            }
        }
        
        // Update display
        document.getElementById('pxTotal').innerHTML = `<b>Total $${total.toFixed(2)}</b>`;
        
        // Enable/disable submit button
        const submitBtn = document.getElementById('pxSubmit');
        submitBtn.disabled = !hasItems || total === 0;
    }
    
    handleSubmit(e) {
        // You can add additional validation here
        const total = this.getTotal();
        if (total === 0) {
            e.preventDefault();
            alert('Please select at least one service');
            return false;
        }
        
        // Add loading state
        const submitBtn = document.getElementById('pxSubmit');
        submitBtn.value = 'Processing...';
        submitBtn.disabled = true;
        
        // The form will submit normally to Paygistix
        // The ReturnURL will handle the callback
    }
    
    getTotal() {
        let total = 0;
        for (let i = 1; i <= 11; i++) {
            const qtyInput = document.getElementById(`pxQty${i}`);
            const priceInput = document.getElementById(`pxPrice${i}`);
            
            if (qtyInput && priceInput) {
                const qty = parseInt(qtyInput.value) || 0;
                const price = parseFloat(priceInput.value) || 0;
                
                // Only count visible items
                const row = qtyInput.closest('tr');
                if (row && row.style.display !== 'none') {
                    total += qty * price;
                }
            }
        }
        return total;
    }
    
    loadPaygistixScript() {
        // Load Paygistix form script if not already loaded
        if (!document.querySelector('script[src="https://safepay.paymentlogistics.net/form.js"]')) {
            const script = document.createElement('script');
            script.src = 'https://safepay.paymentlogistics.net/form.js';
            script.type = 'text/javascript';
            document.body.appendChild(script);
        }
    }
    
    // Public methods
    setOrderDetails(orderDetails) {
        this.options.orderDetails = orderDetails;
        const metadataInput = this.container.querySelector('input[name="metadata"]');
        if (metadataInput) {
            metadataInput.value = JSON.stringify(orderDetails);
        }
    }
    
    setPrefilledAmounts(amounts) {
        // Example: { WDF: 50, DF10: 2 }
        Object.keys(amounts).forEach(code => {
            const index = this.getServiceIndex(code);
            if (index) {
                const qtyInput = document.getElementById(`pxQty${index}`);
                if (qtyInput) {
                    qtyInput.value = amounts[code];
                }
            }
        });
        this.updateTotal();
    }
    
    getServiceIndex(code) {
        const services = ['BF', 'WDF', 'DF5', 'DF10', 'DF15', 'DF20', 'MC25', 'MC30', 'MC40', 'MC50', 'MC75'];
        const index = services.indexOf(code);
        return index >= 0 ? index + 1 : null;
    }
    
    // Update context and reload form
    setContext(payContext, affiliateId) {
        this.payContext = payContext;
        this.affiliateId = affiliateId;
        
        // Reload pricing and re-render
        this.loadPricingConfig().then(() => {
            this.render();
            this.attachEventListeners();
        });
    }
    
    reset() {
        const qtyInputs = this.container.querySelectorAll('.pxQty');
        qtyInputs.forEach(input => {
            input.value = '0';
        });
        this.updateTotal();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaygistixPaymentForm;
}