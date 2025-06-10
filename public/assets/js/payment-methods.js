/**
 * WaveMAX Payment Methods Management Component
 * Handles saved payment methods CRUD operations
 */

(function(window) {
    'use strict';

    class PaymentMethods {
        constructor(options = {}) {
            this.container = options.container || '#payment-methods-container';
            this.onMethodAdded = options.onMethodAdded || (() => {});
            this.onMethodDeleted = options.onMethodDeleted || (() => {});
            this.onMethodUpdated = options.onMethodUpdated || (() => {});
            this.methods = [];
            this.isLoading = false;
            
            // Initialize on DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        }

        async init() {
            await this.render();
            this.attachEventListeners();
            await this.loadMethods();
        }

        async render() {
            const container = document.querySelector(this.container);
            if (!container) {
                console.error('Payment methods container not found');
                return;
            }

            container.innerHTML = `
                <div class="payment-methods-wrapper">
                    <!-- Header -->
                    <div class="payment-methods-header mb-6">
                        <div class="flex justify-between items-center">
                            <h2 class="text-2xl font-bold" data-i18n="payment.methods.title">Payment Methods</h2>
                            <button id="add-method-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200">
                                <i class="fas fa-plus mr-2"></i>
                                <span data-i18n="payment.methods.addMethod">Add Payment Method</span>
                            </button>
                        </div>
                        <p class="text-gray-600 mt-2" data-i18n="payment.methods.description">
                            Manage your saved payment methods for faster checkout
                        </p>
                    </div>

                    <!-- Methods List -->
                    <div id="methods-list" class="space-y-4">
                        <div class="loading-state text-center py-8">
                            <i class="fas fa-spinner fa-spin text-3xl text-blue-600"></i>
                            <p class="text-gray-600 mt-3" data-i18n="common.loading">Loading payment methods...</p>
                        </div>
                    </div>

                    <!-- Empty State -->
                    <div id="empty-state" class="hidden text-center py-12">
                        <i class="fas fa-credit-card text-6xl text-gray-300 mb-4"></i>
                        <h3 class="text-xl font-semibold text-gray-700 mb-2" data-i18n="payment.methods.noMethods">
                            No payment methods saved
                        </h3>
                        <p class="text-gray-600 mb-6" data-i18n="payment.methods.noMethodsDescription">
                            Add a payment method to make checkout faster and easier
                        </p>
                        <button class="add-first-method bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200">
                            <i class="fas fa-plus mr-2"></i>
                            <span data-i18n="payment.methods.addFirstMethod">Add Your First Payment Method</span>
                        </button>
                    </div>

                    <!-- Add/Edit Method Modal -->
                    <div id="method-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
                        <div class="flex items-center justify-center min-h-screen p-4">
                            <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                                <div class="modal-header mb-4">
                                    <h3 class="text-xl font-bold" id="modal-title" data-i18n="payment.methods.addNewMethod">
                                        Add New Payment Method
                                    </h3>
                                    <button id="close-modal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                                        <i class="fas fa-times text-xl"></i>
                                    </button>
                                </div>

                                <form id="method-form" class="space-y-4">
                                    <!-- Method Type Selection -->
                                    <div class="form-group">
                                        <label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.methods.methodType">
                                            Payment Method Type
                                        </label>
                                        <select id="method-type" name="type" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                                            <option value="" data-i18n="payment.methods.selectType">Select a type</option>
                                            <option value="card" data-i18n="payment.methods.creditCard">Credit/Debit Card</option>
                                            <option value="bank" data-i18n="payment.methods.bankAccount">Bank Account</option>
                                            <option value="paypal" data-i18n="payment.methods.paypal">PayPal</option>
                                        </select>
                                    </div>

                                    <!-- Card Details (shown when card is selected) -->
                                    <div id="card-details" class="space-y-4 hidden">
                                        <div class="form-group">
                                            <label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.methods.cardNumber">
                                                Card Number
                                            </label>
                                            <div class="card-input-container p-3 border border-gray-300 rounded-md">
                                                <input type="text" id="card-display" class="w-full outline-none" 
                                                       placeholder="•••• •••• •••• ••••" readonly
                                                       data-i18n-placeholder="payment.methods.cardNumberPlaceholder">
                                                <p class="text-xs text-gray-500 mt-1" data-i18n="payment.methods.secureInput">
                                                    Card details are securely processed
                                                </p>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="form-group">
                                                <label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.methods.expiry">
                                                    Expiry Date
                                                </label>
                                                <input type="text" id="card-expiry" name="expiry" 
                                                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                       placeholder="MM/YY" pattern="[0-9]{2}/[0-9]{2}" maxlength="5"
                                                       data-i18n-placeholder="payment.methods.expiryPlaceholder">
                                            </div>
                                            <div class="form-group">
                                                <label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.methods.cvv">
                                                    CVV
                                                </label>
                                                <input type="password" id="card-cvv" name="cvv" 
                                                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                       placeholder="•••" pattern="[0-9]{3,4}" maxlength="4"
                                                       data-i18n-placeholder="payment.methods.cvvPlaceholder">
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Bank Details (shown when bank is selected) -->
                                    <div id="bank-details" class="space-y-4 hidden">
                                        <div class="form-group">
                                            <label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.methods.accountNumber">
                                                Account Number
                                            </label>
                                            <input type="text" id="account-number" name="accountNumber" 
                                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                   data-i18n-placeholder="payment.methods.accountNumberPlaceholder">
                                        </div>
                                        <div class="form-group">
                                            <label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.methods.routingNumber">
                                                Routing Number
                                            </label>
                                            <input type="text" id="routing-number" name="routingNumber" 
                                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                   data-i18n-placeholder="payment.methods.routingNumberPlaceholder">
                                        </div>
                                    </div>

                                    <!-- Nickname -->
                                    <div class="form-group">
                                        <label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="payment.methods.nickname">
                                            Nickname (optional)
                                        </label>
                                        <input type="text" id="method-nickname" name="nickname" 
                                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                               placeholder="e.g., Personal Card"
                                               data-i18n-placeholder="payment.methods.nicknamePlaceholder">
                                    </div>

                                    <!-- Set as Default -->
                                    <div class="form-group">
                                        <label class="flex items-center cursor-pointer">
                                            <input type="checkbox" id="set-default" name="isDefault" 
                                                   class="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                            <span class="text-sm text-gray-700" data-i18n="payment.methods.setAsDefault">
                                                Set as default payment method
                                            </span>
                                        </label>
                                    </div>

                                    <!-- Modal Actions -->
                                    <div class="modal-actions flex justify-end space-x-3 pt-4">
                                        <button type="button" id="cancel-modal" 
                                                class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition duration-200">
                                            <span data-i18n="common.buttons.cancel">Cancel</span>
                                        </button>
                                        <button type="submit" id="save-method" 
                                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                                            <span class="button-text" data-i18n="common.buttons.save">Save</span>
                                            <span class="button-spinner hidden">
                                                <i class="fas fa-spinner fa-spin mr-2"></i>
                                                <span data-i18n="common.saving">Saving...</span>
                                            </span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <!-- Delete Confirmation Modal -->
                    <div id="delete-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
                        <div class="flex items-center justify-center min-h-screen p-4">
                            <div class="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                                <h3 class="text-xl font-bold mb-4" data-i18n="payment.methods.deleteConfirmTitle">
                                    Delete Payment Method?
                                </h3>
                                <p class="text-gray-700 mb-6" data-i18n="payment.methods.deleteConfirmMessage">
                                    Are you sure you want to delete this payment method? This action cannot be undone.
                                </p>
                                <div class="flex justify-end space-x-3">
                                    <button id="cancel-delete" 
                                            class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition duration-200">
                                        <span data-i18n="common.buttons.cancel">Cancel</span>
                                    </button>
                                    <button id="confirm-delete" 
                                            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200">
                                        <i class="fas fa-trash mr-2"></i>
                                        <span data-i18n="common.buttons.delete">Delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Translate content
            if (window.i18n) {
                window.i18n.translatePage();
            }
        }

        async loadMethods() {
            try {
                const response = await window.PaymentService.getPaymentMethods();
                
                if (response.success) {
                    this.methods = response.methods || [];
                    this.renderMethods();
                } else {
                    throw new Error(response.error || 'Failed to load payment methods');
                }
            } catch (error) {
                console.error('Error loading payment methods:', error);
                this.showError('Failed to load payment methods');
            }
        }

        renderMethods() {
            const methodsList = document.getElementById('methods-list');
            const emptyState = document.getElementById('empty-state');
            
            if (!this.methods || this.methods.length === 0) {
                methodsList.classList.add('hidden');
                emptyState.classList.remove('hidden');
                return;
            }

            methodsList.classList.remove('hidden');
            emptyState.classList.add('hidden');

            methodsList.innerHTML = this.methods.map(method => `
                <div class="payment-method-card bg-white border rounded-lg p-4 hover:shadow-md transition duration-200" data-method-id="${method.id}">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center flex-1">
                            <div class="method-icon mr-4">
                                <i class="fas ${this.getMethodIcon(method.type)} text-3xl text-gray-600"></i>
                            </div>
                            <div class="method-info flex-1">
                                <h4 class="font-semibold">
                                    ${method.nickname || this.getMethodDisplayName(method)}
                                    ${method.isDefault ? '<span class="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Default</span>' : ''}
                                </h4>
                                <p class="text-sm text-gray-600">${this.getMethodDescription(method)}</p>
                                ${method.expiryDate ? `<p class="text-xs text-gray-500">Expires ${method.expiryDate}</p>` : ''}
                            </div>
                        </div>
                        <div class="method-actions flex items-center space-x-2">
                            ${!method.isDefault ? `
                                <button class="set-default-btn text-blue-600 hover:text-blue-800 text-sm" 
                                        data-method-id="${method.id}"
                                        data-i18n-title="payment.methods.setAsDefaultTooltip">
                                    <span data-i18n="payment.methods.makeDefault">Make Default</span>
                                </button>
                            ` : ''}
                            <button class="delete-method-btn text-red-600 hover:text-red-800 p-2" 
                                    data-method-id="${method.id}"
                                    data-i18n-title="payment.methods.deleteTooltip">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');

            // Translate new content
            if (window.i18n) {
                window.i18n.translatePage();
            }
        }

        getMethodIcon(type) {
            const icons = {
                'card': 'fa-credit-card',
                'bank': 'fa-university',
                'paypal': 'fa-paypal',
                'apple_pay': 'fa-apple-pay',
                'google_pay': 'fa-google-pay',
                'default': 'fa-wallet'
            };
            return icons[type] || icons.default;
        }

        getMethodDisplayName(method) {
            if (method.type === 'card' && method.brand) {
                return `${method.brand} ••••${method.last4}`;
            } else if (method.type === 'bank') {
                return `Bank Account ••••${method.last4}`;
            } else if (method.type === 'paypal' && method.email) {
                return `PayPal (${method.email})`;
            }
            return method.name || 'Payment Method';
        }

        getMethodDescription(method) {
            const descriptions = {
                'card': 'Credit/Debit Card',
                'bank': 'Bank Account',
                'paypal': 'PayPal Account',
                'apple_pay': 'Apple Pay',
                'google_pay': 'Google Pay'
            };
            return descriptions[method.type] || 'Payment Method';
        }

        attachEventListeners() {
            // Add method button
            document.getElementById('add-method-btn')?.addEventListener('click', () => this.showAddModal());
            document.querySelector('.add-first-method')?.addEventListener('click', () => this.showAddModal());

            // Modal controls
            document.getElementById('close-modal')?.addEventListener('click', () => this.hideModal());
            document.getElementById('cancel-modal')?.addEventListener('click', () => this.hideModal());
            document.getElementById('cancel-delete')?.addEventListener('click', () => this.hideDeleteModal());

            // Method type selection
            document.getElementById('method-type')?.addEventListener('change', (e) => this.handleTypeChange(e));

            // Form submission
            document.getElementById('method-form')?.addEventListener('submit', (e) => this.handleSubmit(e));

            // Expiry date formatting
            document.getElementById('card-expiry')?.addEventListener('input', (e) => this.formatExpiry(e));

            // Method actions (delegation)
            document.addEventListener('click', (e) => {
                if (e.target.closest('.set-default-btn')) {
                    const methodId = e.target.closest('.set-default-btn').dataset.methodId;
                    this.setDefaultMethod(methodId);
                }
                
                if (e.target.closest('.delete-method-btn')) {
                    const methodId = e.target.closest('.delete-method-btn').dataset.methodId;
                    this.showDeleteConfirmation(methodId);
                }
            });

            // Delete confirmation
            document.getElementById('confirm-delete')?.addEventListener('click', () => this.confirmDelete());

            // Close modals on background click
            document.getElementById('method-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'method-modal') this.hideModal();
            });
            
            document.getElementById('delete-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'delete-modal') this.hideDeleteModal();
            });
        }

        showAddModal() {
            const modal = document.getElementById('method-modal');
            if (modal) {
                modal.classList.remove('hidden');
                document.getElementById('method-form')?.reset();
                document.getElementById('modal-title').setAttribute('data-i18n', 'payment.methods.addNewMethod');
                if (window.i18n) {
                    window.i18n.translatePage();
                }
            }
        }

        hideModal() {
            const modal = document.getElementById('method-modal');
            if (modal) {
                modal.classList.add('hidden');
                document.getElementById('method-form')?.reset();
                this.hideAllDetails();
            }
        }

        handleTypeChange(e) {
            const type = e.target.value;
            this.hideAllDetails();
            
            if (type === 'card') {
                document.getElementById('card-details')?.classList.remove('hidden');
            } else if (type === 'bank') {
                document.getElementById('bank-details')?.classList.remove('hidden');
            }
        }

        hideAllDetails() {
            document.getElementById('card-details')?.classList.add('hidden');
            document.getElementById('bank-details')?.classList.add('hidden');
        }

        formatExpiry(e) {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = '';
            
            if (value.length >= 2) {
                formattedValue = value.slice(0, 2) + '/' + value.slice(2, 4);
            } else {
                formattedValue = value;
            }
            
            e.target.value = formattedValue;
        }

        async handleSubmit(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('save-method');
            const buttonText = submitBtn.querySelector('.button-text');
            const buttonSpinner = submitBtn.querySelector('.button-spinner');
            
            try {
                // Show loading state
                submitBtn.disabled = true;
                buttonText.classList.add('hidden');
                buttonSpinner.classList.remove('hidden');
                
                const formData = new FormData(e.target);
                const methodData = Object.fromEntries(formData);
                
                // Validate based on type
                const validation = window.PaymentValidation.validatePaymentMethod(methodData);
                if (!validation.valid) {
                    throw new Error(validation.errors.join(', '));
                }
                
                // Save method
                const result = await window.PaymentService.addPaymentMethod(methodData);
                
                if (result.success) {
                    this.hideModal();
                    await this.loadMethods();
                    this.onMethodAdded(result.method);
                    this.showSuccess('Payment method added successfully');
                } else {
                    throw new Error(result.error || 'Failed to add payment method');
                }
                
            } catch (error) {
                console.error('Error adding payment method:', error);
                this.showError(error.message);
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                buttonText.classList.remove('hidden');
                buttonSpinner.classList.add('hidden');
            }
        }

        async setDefaultMethod(methodId) {
            try {
                const result = await window.PaymentService.setDefaultMethod(methodId);
                
                if (result.success) {
                    await this.loadMethods();
                    this.showSuccess('Default payment method updated');
                } else {
                    throw new Error(result.error || 'Failed to update default method');
                }
            } catch (error) {
                console.error('Error setting default method:', error);
                this.showError(error.message);
            }
        }

        showDeleteConfirmation(methodId) {
            this.deleteMethodId = methodId;
            const modal = document.getElementById('delete-modal');
            if (modal) {
                modal.classList.remove('hidden');
            }
        }

        hideDeleteModal() {
            const modal = document.getElementById('delete-modal');
            if (modal) {
                modal.classList.add('hidden');
            }
            this.deleteMethodId = null;
        }

        async confirmDelete() {
            if (!this.deleteMethodId) return;
            
            try {
                const result = await window.PaymentService.deletePaymentMethod(this.deleteMethodId);
                
                if (result.success) {
                    this.hideDeleteModal();
                    await this.loadMethods();
                    this.onMethodDeleted(this.deleteMethodId);
                    this.showSuccess('Payment method deleted');
                } else {
                    throw new Error(result.error || 'Failed to delete payment method');
                }
            } catch (error) {
                console.error('Error deleting payment method:', error);
                this.showError(error.message);
            }
        }

        showSuccess(message) {
            // You can implement a toast notification here
            console.log('Success:', message);
        }

        showError(message) {
            // You can implement a toast notification here
            console.error('Error:', message);
        }
    }

    // Expose to global scope
    window.PaymentMethods = PaymentMethods;

})(window);