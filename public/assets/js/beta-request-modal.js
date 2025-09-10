(function() {
    'use strict';
    
    // Beta Request Modal Component
    class BetaRequestModal {
        constructor() {
            this.modalId = 'betaRequestModal';
            this.formId = 'betaRequestForm';
            this.init();
        }
        
        init() {
            // Create modal HTML if it doesn't exist
            if (!document.getElementById(this.modalId)) {
                this.createModal();
            }
            
            // Set up event listeners
            this.setupEventListeners();
        }
        
        createModal() {
            const modalHtml = `
                <div class="modal fade" id="${this.modalId}" tabindex="-1" aria-labelledby="betaRequestModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-md">
                        <div class="modal-content">
                            <div class="modal-header bg-primary text-white">
                                <h5 class="modal-title" id="betaRequestModalLabel">
                                    <i class="fas fa-rocket me-2"></i>
                                    Join Our Beta Program
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div id="betaRequestSuccess" class="alert alert-success d-none">
                                    <i class="fas fa-check-circle me-2"></i>
                                    Thank you for your interest! We'll review your application and contact you soon.
                                </div>
                                <div id="betaRequestError" class="alert alert-danger d-none">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    <span id="betaRequestErrorMessage">An error occurred. Please try again.</span>
                                </div>
                                <div id="betaRequestSpinner" class="text-center py-5 d-none">
                                    <div class="swirl-spinner mx-auto mb-3"></div>
                                    <p class="text-muted">Submitting your application...</p>
                                </div>
                                <div id="betaRequestFormContent">
                                    <p class="text-muted mb-4">
                                        We're currently accepting a limited number of affiliates for our beta program. 
                                        Please provide your information below and we'll contact you if you're selected.
                                    </p>
                                    <form id="${this.formId}">
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label for="betaFirstName" class="form-label">First Name <span class="text-danger">*</span></label>
                                            <input type="text" class="form-control" id="betaFirstName" name="firstName" required>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label for="betaLastName" class="form-label">Last Name <span class="text-danger">*</span></label>
                                            <input type="text" class="form-control" id="betaLastName" name="lastName" required>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label for="betaEmail" class="form-label">Email Address <span class="text-danger">*</span></label>
                                        <input type="email" class="form-control" id="betaEmail" name="email" required>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label for="betaPhone" class="form-label">Phone Number <span class="text-danger">*</span></label>
                                        <input type="tel" class="form-control" id="betaPhone" name="phone" required>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label for="betaBusinessName" class="form-label">Business Name (if applicable)</label>
                                        <input type="text" class="form-control" id="betaBusinessName" name="businessName">
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label for="betaAddress" class="form-label">Street Address <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="betaAddress" name="address" required>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label for="betaCity" class="form-label">City <span class="text-danger">*</span></label>
                                            <input type="text" class="form-control" id="betaCity" name="city" value="Austin" required>
                                        </div>
                                        <div class="col-md-3 mb-3">
                                            <label for="betaState" class="form-label">State <span class="text-danger">*</span></label>
                                            <input type="text" class="form-control" id="betaState" name="state" value="TX" maxlength="2" required>
                                        </div>
                                        <div class="col-md-3 mb-3">
                                            <label for="betaZip" class="form-label">ZIP <span class="text-danger">*</span></label>
                                            <input type="text" class="form-control" id="betaZip" name="zipCode" pattern="[0-9]{5}" required>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label for="betaMessage" class="form-label">Why are you interested in becoming an affiliate?</label>
                                        <textarea class="form-control" id="betaMessage" name="message" rows="3"></textarea>
                                    </div>
                                    
                                    <div class="d-grid gap-2">
                                        <button type="submit" class="btn btn-primary btn-lg">
                                            Submit Application
                                        </button>
                                    </div>
                                </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        
        setupEventListeners() {
            // Form submission
            const form = document.getElementById(this.formId);
            if (form) {
                form.addEventListener('submit', (e) => this.handleSubmit(e));
            }
            
            // Reset form when modal is closed
            const modal = document.getElementById(this.modalId);
            if (modal) {
                modal.addEventListener('hidden.bs.modal', () => this.resetForm());
            }
        }
        
        async handleSubmit(e) {
            e.preventDefault();
            
            const form = e.target;
            const submitBtn = form.querySelector('button[type="submit"]');
            const successAlert = document.getElementById('betaRequestSuccess');
            const errorAlert = document.getElementById('betaRequestError');
            const spinnerDiv = document.getElementById('betaRequestSpinner');
            const formContent = document.getElementById('betaRequestFormContent');
            
            // Hide form and show spinner
            formContent.classList.add('d-none');
            spinnerDiv.classList.remove('d-none');
            successAlert.classList.add('d-none');
            errorAlert.classList.add('d-none');
            
            // Collect form data
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => {
                data[key] = value;
            });
            
            try {
                // Send beta request to server
                const response = await fetch('/api/v1/affiliates/beta-request', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // Hide spinner and show success message
                    spinnerDiv.classList.add('d-none');
                    successAlert.classList.remove('d-none');
                    form.reset();
                    
                    // Close modal after 3 seconds
                    setTimeout(() => {
                        const modal = bootstrap.Modal.getInstance(document.getElementById(this.modalId));
                        if (modal) {
                            modal.hide();
                        }
                    }, 3000);
                } else {
                    // Hide spinner, show form and error
                    spinnerDiv.classList.add('d-none');
                    formContent.classList.remove('d-none');
                    document.getElementById('betaRequestErrorMessage').textContent = 
                        result.message || 'An error occurred. Please try again.';
                    errorAlert.classList.remove('d-none');
                }
            } catch (error) {
                console.error('Error submitting beta request:', error);
                // Hide spinner, show form and error
                spinnerDiv.classList.add('d-none');
                formContent.classList.remove('d-none');
                document.getElementById('betaRequestErrorMessage').textContent = 
                    'Network error. Please check your connection and try again.';
                errorAlert.classList.remove('d-none');
            } finally {
                // Reset button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                }
            }
        }
        
        resetForm() {
            const form = document.getElementById(this.formId);
            if (form) {
                form.reset();
            }
            
            // Hide alerts and spinner, show form
            document.getElementById('betaRequestSuccess').classList.add('d-none');
            document.getElementById('betaRequestError').classList.add('d-none');
            document.getElementById('betaRequestSpinner').classList.add('d-none');
            const formContent = document.getElementById('betaRequestFormContent');
            if (formContent) {
                formContent.classList.remove('d-none');
            }
        }
        
        show() {
            try {
                const modalElement = document.getElementById(this.modalId);
                if (!modalElement) {
                    console.error('Beta request modal element not found');
                    return;
                }
                
                if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
                    console.error('Bootstrap Modal not available');
                    return;
                }
                
                // Ensure modal has proper z-index and backdrop settings
                modalElement.setAttribute('data-bs-backdrop', 'true');
                modalElement.setAttribute('data-bs-keyboard', 'true');
                modalElement.style.zIndex = '1055';
                
                const modal = new bootstrap.Modal(modalElement, {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                });
                
                // Ensure the modal backdrop doesn't cover the modal
                modalElement.addEventListener('shown.bs.modal', function() {
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) {
                        backdrop.style.zIndex = '1040';
                    }
                    // Ensure modal dialog is properly positioned
                    const dialog = modalElement.querySelector('.modal-dialog');
                    if (dialog) {
                        dialog.style.zIndex = '1060';
                        dialog.style.position = 'relative';
                    }
                });
                
                modal.show();
                console.log('Modal shown');
            } catch (error) {
                console.error('Error showing modal:', error);
            }
        }
    }
    
    // Initialize when DOM is ready
    let modalInstance = null;
    
    function initializeBetaModal() {
        console.log('Initializing Beta Request Modal');
        if (!modalInstance) {
            modalInstance = new BetaRequestModal();
            window.BetaRequestModal = modalInstance;
        }
        
        // Attach event listeners using event delegation on document body
        // This ensures they work even if buttons are added dynamically
        if (!document.body.hasAttribute('data-beta-listeners-attached')) {
            document.body.setAttribute('data-beta-listeners-attached', 'true');
            console.log('Attaching beta modal event listeners');
            
            document.body.addEventListener('click', function(e) {
                // Check if clicked element or its parent has the ID we're looking for
                const target = e.target;
                const joinNowBtn = target.id === 'joinNowBtn' || target.closest('#joinNowBtn');
                const joinBetaBtn = target.id === 'joinBetaBtn' || target.closest('#joinBetaBtn');
                
                if (joinNowBtn || joinBetaBtn) {
                    console.log('Beta button clicked');
                    e.preventDefault();
                    if (modalInstance) {
                        modalInstance.show();
                    }
                }
            });
        }
    }
    
    // Helper function to show modal
    window.showBetaRequestModal = function() {
        if (!modalInstance) {
            initializeBetaModal();
        }
        if (modalInstance) {
            modalInstance.show();
        }
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeBetaModal);
    } else {
        // DOM is already loaded
        initializeBetaModal();
    }
})();