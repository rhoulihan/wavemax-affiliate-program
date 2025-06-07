// Modal Utility System for WaveMAX Affiliate Program
// Provides consistent modal dialogs across all pages

(function() {
    'use strict';

    class ModalSystem {
        constructor() {
            this.activeModal = null;
            this.init();
        }

        init() {
            // Create modal container if it doesn't exist
            if (!document.getElementById('modalContainer')) {
                const modalHTML = `
                    <div id="modalContainer">
                        <!-- Generic Modal Template -->
                        <div class="modal" id="genericModal">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h3 class="modal-title" id="genericModalTitle">Alert</h3>
                                    <button class="modal-close" data-modal-close>&times;</button>
                                </div>
                                <div class="modal-body" id="genericModalBody">
                                    <!-- Content will be inserted here -->
                                </div>
                                <div class="modal-footer" id="genericModalFooter">
                                    <button type="button" class="btn btn-primary" data-modal-close>OK</button>
                                </div>
                            </div>
                        </div>

                        <!-- Confirm Modal Template -->
                        <div class="modal" id="confirmModal">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h3 class="modal-title" id="confirmModalTitle">Confirm</h3>
                                    <button class="modal-close" data-modal-close>&times;</button>
                                </div>
                                <div class="modal-body" id="confirmModalBody">
                                    <!-- Content will be inserted here -->
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-modal-cancel>Cancel</button>
                                    <button type="button" class="btn btn-primary" data-modal-confirm>OK</button>
                                </div>
                            </div>
                        </div>

                        <!-- Error Modal Template -->
                        <div class="modal" id="errorModal">
                            <div class="modal-content modal-error">
                                <div class="modal-header">
                                    <div class="flex items-center">
                                        <svg class="h-6 w-6 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                        <h3 class="modal-title text-red-700" id="errorModalTitle">Error</h3>
                                    </div>
                                    <button class="modal-close" data-modal-close>&times;</button>
                                </div>
                                <div class="modal-body" id="errorModalBody">
                                    <!-- Error message will be inserted here -->
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-primary" data-modal-close>OK</button>
                                </div>
                            </div>
                        </div>

                        <!-- Success Modal Template -->
                        <div class="modal" id="successModal">
                            <div class="modal-content modal-success">
                                <div class="modal-header">
                                    <div class="flex items-center">
                                        <svg class="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                        <h3 class="modal-title text-green-700" id="successModalTitle">Success</h3>
                                    </div>
                                    <button class="modal-close" data-modal-close>&times;</button>
                                </div>
                                <div class="modal-body" id="successModalBody">
                                    <!-- Success message will be inserted here -->
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-primary" data-modal-close>OK</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <style>
                        /* Modal Styles */
                        .modal {
                            display: none;
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(0, 0, 0, 0.5);
                            z-index: 10000;
                            align-items: center;
                            justify-content: center;
                            opacity: 0;
                            transition: opacity 0.3s ease;
                        }

                        .modal.active {
                            display: flex;
                            opacity: 1;
                        }

                        .modal-content {
                            background: white;
                            border-radius: 12px;
                            padding: 0;
                            max-width: 500px;
                            width: 90%;
                            max-height: 90vh;
                            overflow: hidden;
                            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                            transform: scale(0.9);
                            transition: transform 0.3s ease;
                        }

                        .modal.active .modal-content {
                            transform: scale(1);
                        }

                        .modal-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 20px;
                            border-bottom: 1px solid #e5e7eb;
                        }

                        .modal-title {
                            font-size: 20px;
                            font-weight: 600;
                            margin: 0;
                            color: #1f2937;
                        }

                        .modal-close {
                            background: none;
                            border: none;
                            font-size: 28px;
                            cursor: pointer;
                            color: #6b7280;
                            padding: 0;
                            line-height: 1;
                            transition: color 0.2s;
                        }

                        .modal-close:hover {
                            color: #374151;
                        }

                        .modal-body {
                            padding: 20px;
                            color: #4b5563;
                            overflow-y: auto;
                            max-height: calc(90vh - 140px);
                        }

                        .modal-footer {
                            padding: 20px;
                            border-top: 1px solid #e5e7eb;
                            display: flex;
                            justify-content: flex-end;
                            gap: 10px;
                        }

                        /* Modal Type Variations */
                        .modal-error .modal-header {
                            background-color: #fef2f2;
                            border-bottom-color: #fecaca;
                        }

                        .modal-error .modal-body {
                            color: #991b1b;
                        }

                        .modal-success .modal-header {
                            background-color: #f0fdf4;
                            border-bottom-color: #bbf7d0;
                        }

                        .modal-success .modal-body {
                            color: #166534;
                        }

                        /* Button Styles */
                        .btn {
                            padding: 8px 16px;
                            border-radius: 6px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s;
                            border: none;
                            font-size: 14px;
                        }

                        .btn-primary {
                            background-color: #3b82f6;
                            color: white;
                        }

                        .btn-primary:hover {
                            background-color: #2563eb;
                        }

                        .btn-secondary {
                            background-color: #e5e7eb;
                            color: #374151;
                        }

                        .btn-secondary:hover {
                            background-color: #d1d5db;
                        }

                        /* Mobile Responsiveness */
                        @media (max-width: 640px) {
                            .modal-content {
                                width: 95%;
                                margin: 10px;
                            }
                            
                            .modal-title {
                                font-size: 18px;
                            }
                            
                            .modal-body {
                                padding: 15px;
                            }
                        }
                    </style>
                `;

                document.body.insertAdjacentHTML('beforeend', modalHTML);
            }

            // Add event listeners
            this.attachEventListeners();
        }

        attachEventListeners() {
            // Close modal on close button click
            document.querySelectorAll('[data-modal-close]').forEach(button => {
                button.addEventListener('click', () => this.closeActiveModal());
            });

            // Close modal on backdrop click
            document.querySelectorAll('.modal').forEach(modal => {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeActiveModal();
                    }
                });
            });

            // Close on ESC key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.activeModal) {
                    this.closeActiveModal();
                }
            });
        }

        showModal(modalId, options = {}) {
            const modal = document.getElementById(modalId);
            if (!modal) return;

            // Close any active modal
            this.closeActiveModal();

            // Set content if provided
            if (options.title) {
                const titleElement = modal.querySelector('.modal-title');
                if (titleElement) titleElement.textContent = options.title;
            }

            if (options.body) {
                const bodyElement = modal.querySelector('.modal-body');
                if (bodyElement) bodyElement.innerHTML = options.body;
            }

            // Show modal
            modal.classList.add('active');
            this.activeModal = modal;

            // Focus on first button in footer for accessibility
            const firstButton = modal.querySelector('.modal-footer button');
            if (firstButton) firstButton.focus();
        }

        closeActiveModal() {
            if (this.activeModal) {
                this.activeModal.classList.remove('active');
                this.activeModal = null;
            }
        }

        // Convenience methods
        alert(message, title = 'Alert') {
            this.showModal('genericModal', {
                title: title,
                body: `<p>${message}</p>`
            });
        }

        error(message, title = 'Error') {
            this.showModal('errorModal', {
                title: title,
                body: `<p>${message}</p>`
            });
        }

        success(message, title = 'Success') {
            this.showModal('successModal', {
                title: title,
                body: `<p>${message}</p>`
            });
        }

        confirm(message, title = 'Confirm') {
            return new Promise((resolve) => {
                this.showModal('confirmModal', {
                    title: title,
                    body: `<p>${message}</p>`
                });

                const confirmModal = document.getElementById('confirmModal');
                const confirmBtn = confirmModal.querySelector('[data-modal-confirm]');
                const cancelBtn = confirmModal.querySelector('[data-modal-cancel]');

                const handleConfirm = () => {
                    cleanup();
                    this.closeActiveModal();
                    resolve(true);
                };

                const handleCancel = () => {
                    cleanup();
                    this.closeActiveModal();
                    resolve(false);
                };

                const cleanup = () => {
                    confirmBtn.removeEventListener('click', handleConfirm);
                    cancelBtn.removeEventListener('click', handleCancel);
                };

                confirmBtn.addEventListener('click', handleConfirm);
                cancelBtn.addEventListener('click', handleCancel);
            });
        }
    }

    // Initialize modal system when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.ModalSystem = new ModalSystem();
        });
    } else {
        window.ModalSystem = new ModalSystem();
    }

    // Replace global alert if desired
    window.modalAlert = function(message, title) {
        if (window.ModalSystem) {
            window.ModalSystem.alert(message, title);
        } else {
            // Fallback to regular alert if modal system not ready
            alert(message);
        }
    };

    // Replace global confirm if desired
    window.modalConfirm = function(message, title) {
        if (window.ModalSystem) {
            return window.ModalSystem.confirm(message, title);
        } else {
            // Fallback to regular confirm if modal system not ready
            return Promise.resolve(confirm(message));
        }
    };

})();