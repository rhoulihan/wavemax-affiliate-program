// Affiliate Login JavaScript
console.log('🚀 Affiliate login script loaded!');

(function() {
    'use strict';

    console.log('🚀 Affiliate login script starting...');
    
    // Configuration for embedded environment
    const baseUrl = window.location.protocol + '//' + window.location.host;
    const isEmbedded = true;
    
    // Helper function to get csrfFetch
    function getCsrfFetch() {
        return window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;
    }
    
    console.log('🔧 Affiliate Login Configuration:', {
        baseUrl: baseUrl,
        isEmbedded: isEmbedded,
        hasCsrfUtils: !!window.CsrfUtils
    });

    // PostMessage communication with parent window
    function sendMessageToParent(type, data) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: type,
                source: 'wavemax-embed',
                data: data
            }, '*');
        }
    }

    // Navigate parent frame
    function navigateParent(page) {
        console.log('navigateParent called with:', page);
        
        // Convert page names to routes
        const routeMap = {
            'forgot-password': '/forgot-password',
            'affiliate-register': '/affiliate-register',
            'affiliate-dashboard': '/affiliate-dashboard'
        };
        
        const route = routeMap[page] || '/' + page;
        console.log('Mapped route:', route);
        
        // Check if navigateTo function exists (from embed-app-v2.js)
        if (window.navigateTo && typeof window.navigateTo === 'function') {
            console.log('Using navigateTo directly:', route);
            window.navigateTo(route);
        } else if (window.parent && window.parent !== window) {
            // We're in an iframe, send message to parent
            console.log('Sending navigation message to parent:', {
                type: 'navigate',
                route: route
            });
            window.parent.postMessage({
                type: 'navigate',
                route: route
            }, '*');
        } else {
            console.log('Cannot navigate - no navigateTo function and not in iframe');
        }
    }

    // Helper function to get translated spinner messages
    function getSpinnerMessage(key, params = {}) {
        // Default messages
        const defaults = {
            'spinner.connectingWith': 'Connecting with {{provider}}...',
            'spinner.pleaseWait': 'Please wait...'
        };
        
        // Try to get translation
        if (window.i18n && window.i18n.t) {
            const translated = window.i18n.t(key, params);
            // Check if we got an actual translation or just the key back
            if (translated && translated !== key && !translated.includes('.')) {
                return translated;
            }
        }
        
        // Fallback to default message
        let defaultMsg = defaults[key] || key;
        // Replace parameters in default message
        if (params) {
            Object.keys(params).forEach(param => {
                defaultMsg = defaultMsg.replace(`{{${param}}}`, params[param]);
            });
        }
        return defaultMsg;
    }

    // OAuth Social Login Functionality for Affiliates
    function handleAffiliateLogin(provider, event) {
        console.log(`Starting ${provider} social login for affiliate`);
        console.log('Event:', event);
        console.log('Provider:', provider);
        
        // Show spinner on the social login section
        const socialLoginSection = document.getElementById('socialLoginSection');
        let spinner = null;
        
        if (socialLoginSection && window.SwirlSpinner) {
            try {
                console.log('[OAuth] Creating SwirlSpinner with overlay...');
                const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
                const message = getSpinnerMessage('spinner.connectingWith', { provider: providerName });
                
                spinner = new window.SwirlSpinner({
                    container: socialLoginSection,
                    size: 'default',
                    speed: 'normal',
                    overlay: true,
                    message: message
                });
                spinner.show();
                console.log('[OAuth] Spinner shown successfully');
            } catch (error) {
                console.error('[OAuth] Error creating spinner:', error);
            }
        } else {
            console.log('[OAuth] Cannot show spinner:', {
                sectionFound: !!socialLoginSection,
                swirlSpinnerAvailable: !!window.SwirlSpinner
            });
        }

        // For embedded context, use popup window to avoid iframe restrictions
        if (isEmbedded || window.self !== window.top) {
            // Generate unique session ID for database polling
            const sessionId = 'oauth_' + Date.now() + '_' + Math.random().toString(36).substring(2);
            console.log('Generated Affiliate Login OAuth session ID:', sessionId);
            
            const oauthUrl = `${baseUrl}/api/v1/auth/${provider}?popup=true&state=${sessionId}&t=${Date.now()}`;
            console.log('🔗 Opening Affiliate Login OAuth URL:', oauthUrl);
            
            let popup;
            try {
                popup = window.open(
                    oauthUrl, 
                    'affiliateSocialLogin',
                    'width=500,height=600,scrollbars=yes,resizable=yes'
                );
            } catch (error) {
                console.error('Error opening popup:', error);
                if (spinner) {
                    spinner.hide();
                }
                window.modalAlert('Failed to open login popup. Please check your popup blocker settings.', 'Popup Error');
                return;
            }
            
            console.log('Affiliate login popup opened:', {
                'popup exists': !!popup,
                'popup.closed': popup ? popup.closed : 'N/A'
            });
            
            if (!popup || popup.closed) {
                // Hide spinner on error
                if (spinner) {
                    spinner.hide();
                }
                window.modalAlert(window.i18n ? window.i18n.t('common.messages.popupBlocked') : 'Popup was blocked. Please allow popups for this site and try again.', 'Popup Blocked');
                return;
            }
            
            // Database polling approach (more reliable than postMessage)
            let pollCount = 0;
            const maxPolls = 120; // 6 minutes max (120 * 3 seconds)
            let authResultReceived = false;
            
            console.log('Starting database polling for Affiliate Login OAuth result...');
            
            const pollForResult = setInterval(async () => {
                pollCount++;
                
                try {
                    // Check if popup is closed
                    if (popup.closed) {
                        console.log('Affiliate login popup closed, continuing to poll for result...');
                    }
                    
                    // Poll the database for result
                    const csrfFetch = getCsrfFetch();
                    const response = await csrfFetch(`${baseUrl}/api/v1/auth/oauth-session/${sessionId}`);
                    
                    console.log('🔍 Affiliate login polling response:', {
                        ok: response.ok,
                        status: response.status,
                        statusText: response.statusText
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log('📊 Affiliate login response data:', data);
                        if (data.success && data.result) {
                            console.log('📨 Affiliate login OAuth result received from database:', data.result);
                            authResultReceived = true;
                            clearInterval(pollForResult);
                            
                            if (popup && !popup.closed) {
                                popup.close();
                            }
                            
                            // Hide spinner since we got a result
                            if (spinner) {
                                spinner.hide();
                            }
                            
                            // Handle the result
                            try {
                                if (data.result.type === 'social-auth-login') {
                                    console.log('Processing affiliate social-auth-login from database');
                                    
                                    // Store token and affiliate data
                                    localStorage.setItem('affiliateToken', data.result.token);
                                    
                                    // Notify parent of successful login
                                    sendMessageToParent('login-success', {
                                        userType: 'affiliate',
                                        token: data.result.token
                                    });

                                    // Navigate to affiliate dashboard
                                    console.log('Redirecting to affiliate dashboard after social login');
                                    navigateParent('affiliate-dashboard');
                                    
                                } else if (data.result.type === 'social-auth-success') {
                                    console.log('Affiliate does not exist, redirecting to registration');
                                    // New affiliate - redirect to registration with social token
                                    window.modalAlert(window.i18n ? window.i18n.t('common.messages.accountNotFound') : 'Account not found. You will be redirected to registration to create a new affiliate account.', 'Account Not Found');
                                    window.location.href = `/affiliate-register-embed.html?socialToken=${data.result.socialToken}&provider=${data.result.provider}`;
                                    
                                } else if (data.result.type === 'social-auth-error') {
                                    console.log('Processing affiliate social-auth-error from database');
                                    window.modalAlert(data.result.message || (window.i18n ? window.i18n.t('common.messages.authenticationFailed') : 'Social authentication failed'), window.i18n ? window.i18n.t('common.messages.authenticationFailed') : 'Authentication Failed');
                                    
                                } else {
                                    console.log('Unknown affiliate login result type:', data.result.type);
                                }
                            } catch (resultError) {
                                console.error('Error processing Affiliate Login OAuth result:', resultError);
                                window.modalAlert(window.i18n ? window.i18n.t('common.messages.processingError') : 'Error processing authentication result', 'Processing Error');
                            }
                            return;
                        }
                    }
                    
                    // Check for timeout
                    if (pollCount > maxPolls) {
                        console.log('Affiliate login database polling timeout exceeded');
                        clearInterval(pollForResult);
                        if (popup && !popup.closed) {
                            popup.close();
                        }
                        // Hide spinner on timeout
                        if (spinner) {
                            spinner.hide();
                        }
                        window.modalAlert(window.i18n ? window.i18n.t('common.messages.authenticationTimeout') : 'Authentication timed out. Please try again.', window.i18n ? window.i18n.t('common.messages.authenticationTimeout') : 'Authentication Timeout');
                        return;
                    }
                    
                    // Log progress every 5 polls (15 seconds)
                    if (pollCount % 5 === 0) {
                        console.log(`🔄 Polling for Affiliate Login OAuth result... (${pollCount}/${maxPolls})`);
                    }
                    
                } catch (error) {
                    // 404 means no result yet, continue polling
                    if (error.message && error.message.includes('404')) {
                        return;
                    }
                    
                    console.error('Error polling for Affiliate Login OAuth result:', error);
                    
                    // Don't stop polling for network errors, just log them
                    if (pollCount % 10 === 0) {
                        console.log('Network error during Affiliate Login polling, continuing...');
                    }
                }
            }, 3000); // Poll every 3 seconds
        } else {
            // For non-embedded context, use direct navigation
            window.location.href = `${baseUrl}/api/v1/auth/${provider}`;
        }
    }

    // Form submission handler
    function handleFormSubmit(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Send login status to parent
        sendMessageToParent('form-submit', { form: 'affiliate-login' });

        // API call with full URL
        const csrfFetch = getCsrfFetch();
        csrfFetch(`${baseUrl}/api/v1/auth/affiliate/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Login failed');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Store token
                localStorage.setItem('affiliateToken', data.token);
                localStorage.setItem('currentAffiliate', JSON.stringify(data.affiliate));

                // Notify parent of successful login
                sendMessageToParent('login-success', {
                    userType: 'affiliate',
                    affiliateId: data.affiliate.affiliateId
                });

                // Navigate to dashboard
                navigateParent('affiliate-dashboard');
            } else {
                sendMessageToParent('login-error', {
                    message: data.message || 'Login failed'
                });
                window.modalAlert(data.message || (window.i18n ? window.i18n.t('common.messages.loginFailed') : 'Login failed. Please check your credentials and try again.'), window.i18n ? window.i18n.t('common.messages.loginFailed') : 'Login Failed');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            sendMessageToParent('login-error', {
                message: 'Login failed. Please check your credentials and try again.'
            });
            window.modalAlert(window.i18n ? window.i18n.t('common.messages.loginFailed') : 'Login failed. Please check your credentials and try again.', window.i18n ? window.i18n.t('common.messages.error') : 'Login Error');
        });
    }

    // Initialize function
    async function initialize() {
        console.log('🔧 Initializing affiliate login...');
        // Initialize CSRF token
        if (window.CsrfUtils && window.CsrfUtils.fetchCsrfToken) {
            try {
                await window.CsrfUtils.fetchCsrfToken();
                console.log('CSRF token initialized');
            } catch (error) {
                console.error('Failed to initialize CSRF token:', error);
            }
        }
        
        // Initialize i18n
        await window.i18n.init({ debugMode: false });
        window.LanguageSwitcher.createSwitcher('language-switcher-container', {
            style: 'dropdown',
            showLabel: false
        });

        // Setup OAuth button handlers
        console.log('🔍 Setting up OAuth button handlers...');
        const googleLogin = document.getElementById('googleLogin');
        const facebookLogin = document.getElementById('facebookLogin');
        const linkedinLogin = document.getElementById('linkedinLogin');

        console.log('🔍 Found buttons:', {
            googleLogin: !!googleLogin,
            facebookLogin: !!facebookLogin,
            linkedinLogin: !!linkedinLogin
        });

        if (googleLogin) {
            console.log('✅ Attaching Google login handler');
            googleLogin.addEventListener('click', function(e) {
                console.log('🔴 Google login button clicked!');
                handleAffiliateLogin('google', e);
            });
        } else {
            console.error('❌ Google login button not found!');
        }

        if (facebookLogin) {
            facebookLogin.addEventListener('click', function(e) {
                handleAffiliateLogin('facebook', e);
            });
        }

        if (linkedinLogin) {
            linkedinLogin.addEventListener('click', function(e) {
                handleAffiliateLogin('linkedin', e);
            });
        }

        // Form submission
        const loginForm = document.getElementById('affiliateLoginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleFormSubmit);
        }

        // Navigation link handlers
        console.log('Setting up navigation link handlers...');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        console.log('Forgot password link found:', !!forgotPasswordLink);
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Forgot password clicked!');
                navigateParent('forgot-password');
            });
        }

        const registerLink = document.getElementById('registerLink');
        console.log('Register link found:', !!registerLink);
        if (registerLink) {
            registerLink.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Register link clicked!');
                navigateParent('affiliate-register');
            });
        }
    }
    
    // Check if DOM is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOM is already loaded, initialize immediately
        initialize();
    }

    // Notify parent that iframe is loaded
    window.addEventListener('load', function() {
        sendMessageToParent('iframe-loaded', { page: 'affiliate-login' });
    });

    // Export functions to global scope if needed
    window.navigateParent = navigateParent;
})();