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
                <form action="${this.paymentConfig?.formActionUrl || 'https://safepay.paymentlogistics.net/transaction.asp'}" method="post" id="paygistixPaymentForm">
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
                        <tr id="row-BF" data-code="BF">
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
                        <tr id="row-PBF5" data-code="PBF5" data-per-bag-fee="5.00">
                            <td class="pxCode">
                                PBF5<input type="hidden" name="pxCode3" value="PBF5" />
                            </td>
                            <td class="pxDescription">
                                Per bag fee<input type="hidden" name="pxDescription3" value="Per bag fee" />
                            </td>
                            <td class="pxPrice">
                                $5.00<input type="hidden" name="pxPrice3" id="pxPrice3" value="5.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty3" id="pxQty3" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-PBF10" data-code="PBF10" data-per-bag-fee="10.00">
                            <td class="pxCode">
                                PBF10<input type="hidden" name="pxCode4" value="PBF10" />
                            </td>
                            <td class="pxDescription">
                                Per bag fee<input type="hidden" name="pxDescription4" value="Per bag fee" />
                            </td>
                            <td class="pxPrice">
                                $10.00<input type="hidden" name="pxPrice4" id="pxPrice4" value="10.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty4" id="pxQty4" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-PBF15" data-code="PBF15" data-per-bag-fee="15.00">
                            <td class="pxCode">
                                PBF15<input type="hidden" name="pxCode5" value="PBF15" />
                            </td>
                            <td class="pxDescription">
                                Per bag fee<input type="hidden" name="pxDescription5" value="Per bag fee" />
                            </td>
                            <td class="pxPrice">
                                $15.00<input type="hidden" name="pxPrice5" id="pxPrice5" value="15.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty5" id="pxQty5" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                        <tr id="row-PBF20" data-code="PBF20" data-per-bag-fee="20.00">
                            <td class="pxCode">
                                PBF20<input type="hidden" name="pxCode6" value="PBF20" />
                            </td>
                            <td class="pxDescription">
                                Per bag fee<input type="hidden" name="pxDescription6" value="Per bag fee" />
                            </td>
                            <td class="pxPrice">
                                $20.00<input type="hidden" name="pxPrice6" id="pxPrice6" value="20.00" />
                            </td>
                            <td>
                                <input type="text" class="pxQty" name="pxQty6" id="pxQty6" value="0" onblur="javascript:formatQty(this);" maxlength="3"/>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" align="right">
                                <span id="pxTotal"><b>Total $0.00</b></span><input type="submit" id="pxSubmit" value="Pay Now" />
                            </td>
                        </tr>
                    </tfoot>
                </table>
                <input type="hidden" name="txnType" value="FORM" />
                <input type="hidden" name="merchantID" value="${this.paymentConfig?.merchantId || 'wmaxaustWEB'}" />
                <input type="hidden" name="formID" value="${this.paymentConfig?.formId || '55015281462'}" />
                <input type="hidden" name="hash" value="${this.paymentConfig?.formHash || '0ccde8f43fd2e92cb3d9cd6c948d7bcc'}" />
                <input type="hidden" name="ReturnURL" value="${this.paymentConfig?.returnUrl || 'https://wavemax.promo/payment-callback-handler.html'}" />
                </form>
            </div>
        `;
        
        this.container.innerHTML = formHTML;
    }
    
    initializeVisibility() {
        const rows = this.container.querySelectorAll('tbody tr');
        
        if (this.payContext === 'REGISTRATION' && this.hideRegistrationFormRows) {
            // For registration, hide all rows except BF (Bag Fee) only if flag is true
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
            // For orders, show WDF and appropriate per bag fee
            const perBagFee = this.affiliateSettings.perBagDeliveryFee;
            
            rows.forEach(row => {
                const code = row.getAttribute('data-code');
                let shouldShow = false;
                
                // Always show WDF for orders
                if (code === 'WDF') {
                    shouldShow = true;
                }
                // Show matching per bag fee
                else if (code.startsWith('PBF')) {
                    const fee = parseFloat(row.getAttribute('data-per-bag-fee'));
                    shouldShow = (fee === perBagFee);
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
        // Note: blur handlers are already set inline with onblur="javascript:formatQty(this);"
        // This ensures they work with the Paygistix script
        
        // Apply registration-specific styling and behavior
        if (this.payContext === 'REGISTRATION') {
            this.setupRegistrationMode();
        }
        
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
    
    setupRegistrationMode() {
        const submitBtn = this.container.querySelector('#pxSubmit');
        const form = this.container.querySelector('#paygistixPaymentForm');
        
        if (submitBtn) {
            // Style the button like the registration form button
            submitBtn.style.width = '100%';
            submitBtn.style.padding = '12px 16px';
            submitBtn.style.fontSize = '16px';
            submitBtn.style.fontWeight = '700';
            submitBtn.style.borderRadius = '8px';
            submitBtn.style.background = '#2563eb';
            submitBtn.style.transition = 'all 0.3s ease';
            submitBtn.value = 'Complete Registration & Pay';
            
            // Add hover effect
            submitBtn.addEventListener('mouseenter', function() {
                this.style.background = '#1d4ed8';
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            });
            
            submitBtn.addEventListener('mouseleave', function() {
                this.style.background = '#2563eb';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
            });
        }
        
        if (form) {
            // Debug form attributes
            console.log('Paygistix form attributes:', {
                action: form.getAttribute('action'),
                method: form.getAttribute('method'),
                target: form.getAttribute('target'),
                id: form.getAttribute('id')
            });
            
            // Intercept form submission to validate customer data first
            form.addEventListener('submit', (e) => {
                console.log('Form submission intercepted');
                e.preventDefault(); // Always prevent default first
                
                // Store the click position for modal positioning
                this.lastClickY = e.clientY || 0;
                
                // Check if customer form is valid
                const customerForm = document.getElementById('customerRegistrationForm');
                
                if (customerForm && !customerForm.checkValidity()) {
                    customerForm.reportValidity();
                    return false;
                }
                
                // Check if bags are selected
                const numberOfBags = document.getElementById('numberOfBags')?.value;
                if (!numberOfBags || numberOfBags === '' || numberOfBags === '0') {
                    if (window.modalAlert) {
                        window.modalAlert('Please select the number of bags needed before proceeding.', 'Bags Required');
                    } else {
                        alert('Please select the number of bags needed before proceeding.');
                    }
                    return false;
                }
                
                // Store customer data for post-payment processing
                if (customerForm) {
                    const formData = new FormData(customerForm);
                    const customerData = {};
                    
                    formData.forEach((value, key) => {
                        customerData[key] = value;
                    });
                    
                    customerData.timestamp = Date.now();
                    customerData.paymentPending = true;
                    
                    // Store in session for callback processing
                    sessionStorage.setItem('pendingRegistration', JSON.stringify(customerData));
                    console.log('Stored customer data for post-payment processing:', customerData);
                }
                
                // Create a new form to submit only Paygistix data
                console.log('Creating clean Paygistix form for submission');
                const paygistixForm = document.createElement('form');
                paygistixForm.method = 'post';
                paygistixForm.action = form.action;
                
                // Copy only Paygistix-specific fields
                const paygistixFields = [
                    'txnType', 'merchantID', 'formID', 'hash', 'ReturnURL',
                    // Product codes (only 6 items in new form)
                    'pxCode1', 'pxDescription1', 'pxPrice1', 'pxQty1',
                    'pxCode2', 'pxDescription2', 'pxPrice2', 'pxQty2',
                    'pxCode3', 'pxDescription3', 'pxPrice3', 'pxQty3',
                    'pxCode4', 'pxDescription4', 'pxPrice4', 'pxQty4',
                    'pxCode5', 'pxDescription5', 'pxPrice5', 'pxQty5',
                    'pxCode6', 'pxDescription6', 'pxPrice6', 'pxQty6'
                ];
                
                // Build payment data object for logging
                const paymentData = {
                    action: paygistixForm.action,
                    method: paygistixForm.method,
                    timestamp: new Date().toISOString(),
                    fields: {}
                };
                
                paygistixFields.forEach(fieldName => {
                    const field = form.elements[fieldName];
                    if (field) {
                        const hiddenField = document.createElement('input');
                        hiddenField.type = 'hidden';
                        hiddenField.name = fieldName;
                        hiddenField.value = field.value;
                        paygistixForm.appendChild(hiddenField);
                        
                        // Add to payment data for logging
                        paymentData.fields[fieldName] = field.value;
                    }
                });
                
                // Log form submission details
                console.log('=== PAYGISTIX PAYMENT SUBMISSION ===');
                console.log('Submitting to:', paymentData.action);
                console.log('Method:', paymentData.method);
                console.log('Timestamp:', paymentData.timestamp);
                console.log('Form Fields:', paymentData.fields);
                console.log('Full Payment Data:', JSON.stringify(paymentData, null, 2));
                console.log('=====================================');
                
                // Also log to server for debugging
                try {
                    fetch('/api/v1/payments/log-submission', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                        },
                        body: JSON.stringify(paymentData)
                    }).catch(err => console.log('Failed to log payment submission to server:', err));
                } catch (err) {
                    console.log('Error logging payment submission:', err);
                }
                
                // Create and show payment processing modal
                this.showPaymentModal(paygistixForm, paymentData);
                
                // Form will navigate away, but clean up just in case
                setTimeout(() => {
                    if (document.body.contains(paygistixForm)) {
                        document.body.removeChild(paygistixForm);
                    }
                }, 100);
            });
        }
    }
    
    showPaymentModal(paygistixForm, paymentData) {
        // Create modal HTML for confirmation
        const modalHTML = `
            <div id="paymentProcessingModal" class="fixed inset-0 z-50" style="display: none;">
                <!-- Background overlay -->
                <div class="fixed inset-0 bg-gray-500 opacity-75"></div>
                
                <!-- Modal panel -->
                <div id="paymentModalPanel" class="absolute bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full" style="left: 50%; transform: translateX(-50%);">
                        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div class="sm:flex sm:items-start">
                                <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                                    <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                    <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        Secure Payment Processing
                                    </h3>
                                    <div class="mt-2">
                                        <!-- Confirmation state -->
                                        <div id="paymentConfirmState">
                                            <p class="text-sm text-gray-500">
                                                You will be redirected to our secure payment processor, Paygistix, to complete your payment. 
                                                The payment page will open in a new window.
                                            </p>
                                            <p class="text-sm text-gray-500 mt-2">
                                                Please ensure pop-up blockers are disabled for this site.
                                            </p>
                                        </div>
                                        
                                        <!-- Loading state (hidden initially) -->
                                        <div id="paymentLoadingState" style="display: none;" class="text-center py-4">
                                            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                            <p class="text-sm text-gray-600">Opening payment window...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button type="button" id="proceedToPaymentBtn" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                                Proceed to Payment
                            </button>
                            <button type="button" id="cancelPaymentBtn" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page if not already present
        if (!document.getElementById('paymentProcessingModal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
        
        const modal = document.getElementById('paymentProcessingModal');
        const proceedBtn = document.getElementById('proceedToPaymentBtn');
        const cancelBtn = document.getElementById('cancelPaymentBtn');
        const confirmState = document.getElementById('paymentConfirmState');
        const loadingState = document.getElementById('paymentLoadingState');
        
        // Show modal
        modal.style.display = 'block';
        
        // Position the modal panel at 70% down from top of viewport
        const modalPanel = document.getElementById('paymentModalPanel');
        if (modalPanel) {
            // Calculate 70% down from top of current viewport
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const viewportHeight = window.innerHeight;
            const modalTop = scrollTop + (viewportHeight * 0.7);
            
            modalPanel.style.top = modalTop + 'px';
            
            // No need to scroll since we're positioning relative to current viewport
        }
        
        // Add CSS for animation if not already present
        if (!document.getElementById('modalAnimationStyles')) {
            const style = document.createElement('style');
            style.id = 'modalAnimationStyles';
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Handle proceed button click
        proceedBtn.onclick = () => {
            // Show loading state
            confirmState.style.display = 'none';
            loadingState.style.display = 'block';
            proceedBtn.disabled = true;
            cancelBtn.disabled = true;
            
            // Append form to the current document body (not parent)
            // The form needs to be in the same document context where it was created
            document.body.appendChild(paygistixForm);
            
            // Submit form to open in new window
            try {
                console.log('Opening Paygistix payment in new window');
                console.log('Form connected to DOM:', document.body.contains(paygistixForm));
                console.log('Form action:', paygistixForm.action);
                
                // Use setTimeout to ensure form is properly attached to DOM
                setTimeout(() => {
                    // Calculate window size for the form
                    const windowWidth = 800;
                    const windowHeight = 600;
                    
                    // Calculate center position relative to current browser window
                    const left = window.screenX + (window.outerWidth - windowWidth) / 2;
                    const top = window.screenY + (window.outerHeight - windowHeight) / 2;
                    
                    // Window features
                    const windowFeatures = [
                        `width=${windowWidth}`,
                        `height=${windowHeight}`,
                        `left=${left}`,
                        `top=${top}`,
                        'resizable=yes',
                        'scrollbars=yes',
                        'toolbar=no',
                        'menubar=no',
                        'location=no',
                        'status=yes'
                    ].join(',');
                    
                    // Open new window
                    const paymentWindow = window.open('', 'PaygistixPayment', windowFeatures);
                    
                    if (paymentWindow) {
                        // Set form target to the new window
                        paygistixForm.target = 'PaygistixPayment';
                        
                        // Submit form to the new window
                        paygistixForm.submit();
                        console.log('Form submitted to new window');
                        
                        // Close modal after a short delay
                        setTimeout(() => {
                            modal.style.display = 'none';
                            console.log('Payment window opened, closing modal');
                            // Clean up form
                            if (document.body.contains(paygistixForm)) {
                                document.body.removeChild(paygistixForm);
                            }
                        }, 1000);
                    } else {
                        throw new Error('Pop-up blocked');
                    }
                }, 100);
            } catch (error) {
                console.error('Error opening payment window:', error);
                // Show error in modal
                loadingState.innerHTML = `
                    <div class="text-center py-4">
                        <svg class="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p class="text-gray-700 font-medium mb-2">Unable to open payment window</p>
                        <p class="text-gray-600 text-sm">Please check your pop-up blocker settings and try again.</p>
                    </div>
                `;
                proceedBtn.disabled = false;
                cancelBtn.disabled = false;
            }
        };
        
        // Handle cancel button
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            console.log('Payment cancelled by user');
            // Clean up form
            if (document.body.contains(paygistixForm)) {
                document.body.removeChild(paygistixForm);
            }
        };
        
        // Handle click outside modal
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                console.log('Payment modal closed by user (clicked outside)');
                // Clean up form
                if (document.body.contains(paygistixForm)) {
                    document.body.removeChild(paygistixForm);
                }
            }
        };
    }
}

// Make it available globally
window.PaygistixPaymentForm = PaygistixPaymentForm;