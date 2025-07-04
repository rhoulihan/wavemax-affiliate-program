// Reset Password Page Initialization
(function() {
    'use strict';

    console.log('[ResetPassword] Initializing reset password page');

    // Configuration
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const isEmbedded = window.EMBED_CONFIG?.isEmbedded || false;

    // CSRF-aware fetch
    const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

    // Initialize page when DOM is ready
    function initializeResetPassword() {
        console.log('[ResetPassword] DOM ready, initializing components');

        // Get form elements
        const form = document.getElementById('resetPasswordForm');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const resetTokenInput = document.getElementById('resetToken');
        const userTypeInput = document.getElementById('userType');
        const submitButton = document.getElementById('submitButton');
        const alertContainer = document.getElementById('alertContainer');
        const togglePasswordBtn = document.getElementById('togglePassword');
        const toggleConfirmBtn = document.getElementById('toggleConfirmPassword');
        
        const resetContainer = document.getElementById('resetPasswordContainer');
        const invalidTokenMessage = document.getElementById('invalidTokenMessage');
        const successMessage = document.getElementById('successMessage');
        
        const requestNewLinkButton = document.getElementById('requestNewLinkButton');
        const goToLoginButton = document.getElementById('goToLoginButton');

        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const userType = urlParams.get('type');

        // Check if we have required parameters
        if (!token || !userType) {
            console.error('[ResetPassword] Missing token or userType parameters');
            showInvalidToken();
            return;
        }

        // Set hidden field values
        resetTokenInput.value = token;
        userTypeInput.value = userType;

        // Password visibility toggle
        function setupPasswordToggle(button, input) {
            button.addEventListener('click', function() {
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
                
                // Toggle icon
                this.classList.toggle('show-password');
                
                // Update SVG icon
                const svg = this.querySelector('svg');
                if (type === 'text') {
                    // Eye with slash icon
                    svg.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21">
                        </path>
                    `;
                } else {
                    // Regular eye icon
                    svg.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z">
                        </path>
                    `;
                }
            });
        }

        setupPasswordToggle(togglePasswordBtn, passwordInput);
        setupPasswordToggle(toggleConfirmBtn, confirmPasswordInput);

        // Password validation
        function validatePasswordStrength(password) {
            const requirements = {
                length: password.length >= 8,
                uppercase: /[A-Z]/.test(password),
                lowercase: /[a-z]/.test(password),
                number: /\d/.test(password),
                special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)
            };

            const score = Object.values(requirements).filter(Boolean).length;
            return { requirements, score, isValid: score >= 5 };
        }

        function updatePasswordRequirements(password, confirmPassword) {
            const validation = validatePasswordStrength(password);
            const requirements = validation.requirements;
            const match = password !== '' && password === confirmPassword;

            // Update requirement indicators
            const updateReq = (id, met) => {
                const element = document.getElementById(id);
                if (element) {
                    const indicator = element.querySelector('span');
                    indicator.textContent = met ? '✅' : '⚪';
                    element.className = met ? 'flex items-center valid' : 'flex items-center';
                }
            };

            updateReq('req-length', requirements.length);
            updateReq('req-uppercase', requirements.uppercase);
            updateReq('req-lowercase', requirements.lowercase);
            updateReq('req-number', requirements.number);
            updateReq('req-special', requirements.special);
            updateReq('req-match', match);

            return validation.isValid && match;
        }

        // Real-time validation
        passwordInput.addEventListener('input', function() {
            updatePasswordRequirements(this.value, confirmPasswordInput.value);
            if (this.classList.contains('is-invalid') && this.value) {
                showFieldError(this, false);
            }
        });

        confirmPasswordInput.addEventListener('input', function() {
            updatePasswordRequirements(passwordInput.value, this.value);
            if (this.classList.contains('is-invalid') && this.value === passwordInput.value) {
                showFieldError(this, false);
            }
        });

        // Validation helpers
        function showFieldError(field, show = true) {
            const feedbackElement = field.parentElement.parentElement.querySelector('.invalid-feedback');
            if (show) {
                field.classList.add('is-invalid');
                if (feedbackElement) {
                    feedbackElement.classList.remove('hidden');
                }
            } else {
                field.classList.remove('is-invalid');
                if (feedbackElement) {
                    feedbackElement.classList.add('hidden');
                }
            }
        }

        function showAlert(message, type = 'error') {
            const alertClass = type === 'success' ? 'alert-success' : 
                             type === 'info' ? 'alert-info' : 'alert-error';
            
            const alertHtml = `
                <div class="alert ${alertClass} fade-in">
                    ${message}
                </div>
            `;
            
            alertContainer.innerHTML = alertHtml;
            
            // Auto-hide success messages after 5 seconds
            if (type === 'success') {
                setTimeout(() => {
                    alertContainer.innerHTML = '';
                }, 5000);
            }
        }

        function clearAlert() {
            alertContainer.innerHTML = '';
        }

        // Show invalid token message
        function showInvalidToken() {
            resetContainer.classList.add('hidden');
            invalidTokenMessage.classList.remove('hidden');
            invalidTokenMessage.classList.add('fade-in');
        }

        // Form submission
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            console.log('[ResetPassword] Form submitted');
            clearAlert();

            // Validate form
            let isValid = true;
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Validate password
            if (!password) {
                showFieldError(passwordInput, true);
                isValid = false;
            } else {
                const validation = validatePasswordStrength(password);
                if (!validation.isValid) {
                    showFieldError(passwordInput, true);
                    passwordInput.parentElement.querySelector('.invalid-feedback').textContent = 
                        window.i18n?.t('validation.passwordWeak') || 'Password does not meet requirements';
                    isValid = false;
                }
            }

            // Validate password match
            if (password !== confirmPassword) {
                showFieldError(confirmPasswordInput, true);
                isValid = false;
            }

            if (!isValid) {
                // Shake the form
                resetContainer.classList.add('shake');
                setTimeout(() => resetContainer.classList.remove('shake'), 600);
                return;
            }

            // Show loading state
            submitButton.disabled = true;
            submitButton.classList.add('loading-button');

            // Show spinner
            const spinner = window.SwirlSpinner ? 
                new window.SwirlSpinner({
                    container: resetContainer,
                    size: 'medium',
                    overlay: true,
                    message: window.i18n?.t('resetPassword.resetting') || 'Resetting password...'
                }).show() : null;

            try {
                // Send request
                const response = await csrfFetch(`${baseUrl}/api/v1/auth/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        token: token,
                        userType: userType,
                        password: password
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    console.log('[ResetPassword] Password reset successful');
                    
                    // Hide form and show success message
                    resetContainer.classList.add('hidden');
                    successMessage.classList.remove('hidden');
                    successMessage.classList.add('fade-in');
                } else {
                    // Show error message
                    const errorMessage = data.message || 'An error occurred. Please try again.';
                    showAlert(errorMessage, 'error');
                    
                    // If token is invalid, show invalid token message
                    if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('expired')) {
                        setTimeout(() => {
                            showInvalidToken();
                        }, 2000);
                    }
                }
            } catch (error) {
                console.error('[ResetPassword] Error:', error);
                showAlert(
                    window.i18n?.t('errors.networkError') || 
                    'Unable to connect to the server. Please check your connection and try again.',
                    'error'
                );
            } finally {
                // Hide spinner
                if (spinner) spinner.hide();
                
                // Reset button state
                submitButton.disabled = false;
                submitButton.classList.remove('loading-button');
            }
        });

        // Navigation functions
        function navigateToLogin() {
            if (isEmbedded || window.parent !== window) {
                // In iframe - use parent navigation
                if (window.parent.navigateTo && typeof window.parent.navigateTo === 'function') {
                    window.parent.navigateTo(`/${userType}-login`);
                } else {
                    // Fallback for embed-app-v2.html
                    window.location.href = `/embed-app-v2.html?route=/${userType}-login`;
                }
            } else {
                // Direct navigation
                window.location.href = `/${userType}-login-embed.html`;
            }
        }

        function navigateToForgotPassword() {
            if (isEmbedded || window.parent !== window) {
                // In iframe - use parent navigation
                if (window.parent.navigateTo && typeof window.parent.navigateTo === 'function') {
                    window.parent.navigateTo('/forgot-password');
                } else {
                    // Fallback for embed-app-v2.html
                    window.location.href = '/embed-app-v2.html?route=/forgot-password';
                }
            } else {
                // Direct navigation
                window.location.href = '/forgot-password-embed.html';
            }
        }

        // Button handlers
        goToLoginButton.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToLogin();
        });

        requestNewLinkButton.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToForgotPassword();
        });

        // Focus on password field
        passwordInput.focus();

        // Handle escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                navigateToLogin();
            }
        });

        // Handle window resize for responsive design
        if (isEmbedded) {
            function notifyParentOfHeight() {
                const height = document.documentElement.scrollHeight;
                window.parent.postMessage({
                    type: 'resize-frame',
                    height: height
                }, '*');
            }

            // Notify on load and resize
            notifyParentOfHeight();
            window.addEventListener('resize', notifyParentOfHeight);
            
            // Use ResizeObserver for content changes
            if (window.ResizeObserver) {
                const resizeObserver = new ResizeObserver(() => {
                    notifyParentOfHeight();
                });
                resizeObserver.observe(document.body);
            }
        }

        console.log('[ResetPassword] Initialization complete');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeResetPassword);
    } else {
        initializeResetPassword();
    }
})();