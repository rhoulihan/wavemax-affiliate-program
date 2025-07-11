// Customer Login Page Initialization
(function() {
    'use strict';

    console.log('[CustomerLogin] Initializing customer login page');

    // Configuration
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const isEmbedded = window.EMBED_CONFIG?.isEmbedded || false;

    // CSRF-aware fetch
    const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

    // Track if OAuth is in progress
    let oauthInProgress = false;

    // Initialize page when DOM is ready
    async function initializeCustomerLogin() {
        console.log('[CustomerLogin] DOM ready, initializing components');

        // Initialize i18n first
        if (window.i18n) {
            await window.i18n.init({ debugMode: false });
        }

        // Create language switcher
        if (window.LanguageSwitcher) {
            window.LanguageSwitcher.createSwitcher('language-switcher-container', {
                style: 'dropdown',
                showLabel: false
            });
        }

        // Get form elements
        const form = document.getElementById('customerLoginForm');
        const emailOrUsernameInput = document.getElementById('emailOrUsername');
        const passwordInput = document.getElementById('password');
        const rememberCheckbox = document.getElementById('remember');
        const forgotPasswordLink = document.querySelector('a[data-i18n="common.labels.forgotPassword"]');
        const submitButton = form.querySelector('button[type="submit"]');

        // Social login buttons
        const googleLoginBtn = document.getElementById('googleLogin');
        const facebookLoginBtn = document.getElementById('facebookLogin');

        // Alert container (create if doesn't exist)
        let alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'alertContainer';
            form.insertBefore(alertContainer, form.firstChild);
        }

        // Helper functions
        function showAlert(message, type = 'error') {
            const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
            
            const alertHtml = `
                <div class="alert ${alertClass}">
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

        // Navigation functions
        function navigateToForgotPassword() {
            // We're in embed-app-v2.html context, so use the local navigateTo function
            if (window.navigateTo && typeof window.navigateTo === 'function') {
                window.navigateTo('/forgot-password');
            } else {
                // Fallback
                window.location.href = '/embed-app-v2.html?route=/forgot-password';
            }
        }

        function navigateToDashboard() {
            // Check for redirect parameter
            const urlParams = new URLSearchParams(window.location.search);
            const redirectRoute = urlParams.get('redirect');
            
            // We're in embed-app-v2.html context, so use the local navigateTo function
            if (window.navigateTo && typeof window.navigateTo === 'function') {
                const targetRoute = redirectRoute || '/customer-dashboard';
                window.navigateTo(targetRoute);
            } else {
                // Fallback for embed-app-v2.html
                const targetRoute = redirectRoute || '/customer-dashboard';
                window.location.href = `/embed-app-v2.html?route=${targetRoute}`;
            }
        }

        // Form submission handler
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            console.log('[CustomerLogin] Form submitted');
            clearAlert();

            const emailOrUsername = emailOrUsernameInput.value.trim();
            const password = passwordInput.value;

            if (!emailOrUsername || !password) {
                showAlert(window.i18n?.t('validation.requiredFields') || 'Please fill in all required fields');
                return;
            }

            // Show loading state
            submitButton.disabled = true;
            submitButton.classList.add('loading-button');

            // Show spinner
            const spinner = window.SwirlSpinner ? 
                new window.SwirlSpinner({
                    container: form.closest('.bg-white'),
                    size: 'medium',
                    overlay: true,
                    message: window.i18n?.t('common.messages.signingIn') || 'Signing in...'
                }).show() : null;

            try {
                // Send login request
                const response = await csrfFetch(`${baseUrl}/api/auth/customer/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        emailOrUsername: emailOrUsername,
                        password: password,
                        remember: rememberCheckbox.checked
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    console.log('[CustomerLogin] Login successful');
                    
                    // Store token
                    if (data.token) {
                        localStorage.setItem('customerToken', data.token);
                    }
                    
                    // Store customer data
                    if (data.customer) {
                        localStorage.setItem('currentCustomer', JSON.stringify(data.customer));
                    }

                    // Show success message briefly
                    showAlert(window.i18n?.t('common.messages.loginSuccess') || 'Login successful!', 'success');

                    // Navigate to dashboard
                    setTimeout(() => {
                        navigateToDashboard();
                    }, 500);
                } else {
                    // Show error message
                    const errorMessage = data.message || 'Invalid username or password';
                    showAlert(errorMessage);
                    
                    // Shake the form
                    form.closest('.bg-white').classList.add('shake');
                    setTimeout(() => form.closest('.bg-white').classList.remove('shake'), 600);
                }
            } catch (error) {
                console.error('[CustomerLogin] Error:', error);
                showAlert(
                    window.i18n?.t('errors.networkError') || 
                    'Unable to connect to the server. Please check your connection and try again.'
                );
            } finally {
                // Hide spinner
                if (spinner) spinner.hide();
                
                // Reset button state
                submitButton.disabled = false;
                submitButton.classList.remove('loading-button');
            }
        });

        // Forgot password link handler
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToForgotPassword();
        });

        // Social login handlers
        function handleSocialLogin(provider) {
            if (oauthInProgress) {
                console.log('[OAuth] Already in progress, ignoring');
                return;
            }
            oauthInProgress = true;

            console.log(`[CustomerLogin] Starting ${provider} OAuth`);
            console.log('[OAuth] Button clicked, provider:', provider);
            console.log('[OAuth] Current location:', window.location.href);
            console.log('[OAuth] Base URL:', baseUrl);

            // For embedded context, use popup
            const inIframe = window.self !== window.top;
            const shouldUsePopup = isEmbedded || inIframe;

            if (shouldUsePopup) {
                // Generate unique session ID
                const sessionId = 'oauth_' + Date.now() + '_' + Math.random().toString(36).substring(2);
                const oauthUrl = `${baseUrl}/api/v1/auth/customer/${provider}?popup=true&state=customer_${sessionId}&t=${Date.now()}`;
                
                console.log('[OAuth] Opening popup with URL:', oauthUrl);
                console.log('[OAuth] Full URL breakdown:', {
                    baseUrl: baseUrl,
                    provider: provider,
                    sessionId: sessionId,
                    fullUrl: oauthUrl
                });
                
                const popup = window.open(
                    oauthUrl,
                    'socialAuth',
                    'width=500,height=600,scrollbars=yes,resizable=yes'
                );
                
                console.log('[OAuth] Popup opened:', popup);

                if (!popup || popup.closed) {
                    showAlert('Popup was blocked. Please allow popups for this site and try again.');
                    oauthInProgress = false;
                    return;
                }

                // Show spinner
                const spinner = window.SwirlSpinner ? 
                    new window.SwirlSpinner({
                        container: form.closest('.bg-white'),
                        size: 'medium',
                        overlay: true,
                        message: `Connecting with ${provider}...`
                    }).show() : null;

                // Poll for result
                let pollCount = 0;
                const maxPolls = 120; // 2 minutes
                const pollInterval = setInterval(async () => {
                    pollCount++;

                    try {
                        // Check if popup is closed
                        if (popup.closed) {
                            console.log('[OAuth] Popup closed');
                        }

                        // Poll for result
                        const response = await csrfFetch(`${baseUrl}/api/v1/auth/oauth-session/${sessionId}`);
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (data.success && data.result) {
                                clearInterval(pollInterval);
                                console.log('[OAuth] Result received:', data.result);

                                // Close popup
                                if (popup && !popup.closed) {
                                    popup.close();
                                }

                                // Hide spinner
                                if (spinner) spinner.hide();
                                oauthInProgress = false;

                                // Handle result
                                if (data.result.type === 'social-auth-login') {
                                    // Successful login
                                    if (data.result.token) {
                                        localStorage.setItem('customerToken', data.result.token);
                                    }
                                    if (data.result.customer) {
                                        localStorage.setItem('currentCustomer', JSON.stringify(data.result.customer));
                                    }
                                    showAlert('Login successful!', 'success');
                                    setTimeout(() => {
                                        navigateToDashboard();
                                    }, 500);
                                } else if (data.result.type === 'social-auth-success') {
                                    // New customer needs to complete registration
                                    showAlert('Please complete your registration with an affiliate', 'error');
                                } else if (data.result.type === 'social-auth-account-conflict') {
                                    // Account exists as affiliate
                                    const affiliateName = data.result.affiliateData?.businessName || 
                                                        `${data.result.affiliateData?.firstName} ${data.result.affiliateData?.lastName}`;
                                    showAlert(
                                        `This ${data.result.provider} account is already registered as an affiliate account (${affiliateName}). ` +
                                        'Affiliate accounts cannot be used for customer logins. Please use a different social media account or create a new customer account.',
                                        'error'
                                    );
                                } else if (data.result.type === 'social-auth-error') {
                                    showAlert(data.result.message || 'Social authentication failed');
                                }
                            }
                        }

                        // Check timeout
                        if (pollCount > maxPolls) {
                            clearInterval(pollInterval);
                            if (popup && !popup.closed) popup.close();
                            if (spinner) spinner.hide();
                            oauthInProgress = false;
                            showAlert('Authentication timed out. Please try again.');
                        }
                    } catch (error) {
                        // 404 is expected while waiting
                        if (!error.message?.includes('404')) {
                            console.error('[OAuth] Polling error:', error);
                        }
                    }
                }, 1000);
            } else {
                // Direct navigation
                window.location.href = `${baseUrl}/api/v1/auth/customer/${provider}`;
            }
        }

        // Attach social login handlers
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => handleSocialLogin('google'));
        }
        if (facebookLoginBtn) {
            facebookLoginBtn.addEventListener('click', () => handleSocialLogin('facebook'));
        }

        // Handle enter key in form fields
        [emailOrUsernameInput, passwordInput].forEach(input => {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    form.dispatchEvent(new Event('submit'));
                }
            });
        });

        // Focus on first input
        emailOrUsernameInput.focus();

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
        }

        console.log('[CustomerLogin] Initialization complete');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCustomerLogin);
    } else {
        initializeCustomerLogin();
    }
})();