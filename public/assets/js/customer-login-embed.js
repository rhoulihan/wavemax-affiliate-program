// Customer login embed functionality
(function() {
    'use strict';

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
        sendMessageToParent('navigate', { page: page });
    }
    
    // Navigate to register with affiliate ID if present
    function navigateToRegister() {
        console.log('navigateToRegister called');
        
        // Check for affiliate ID in URL or session storage
        const urlParams = new URLSearchParams(window.location.search);
        const affiliateId = urlParams.get('affid') || urlParams.get('affiliate') || sessionStorage.getItem('affiliateId');
        
        console.log('Affiliate ID found:', affiliateId);
        console.log('Current window location:', window.location.href);
        console.log('Parent window exists:', window.parent !== window);
        
        if (affiliateId) {
            // Try multiple approaches to ensure message reaches the right window
            const navigationMessage = {
                type: 'navigate',
                source: 'wavemax-embed',
                data: { 
                    page: 'customer-register',
                    params: { affid: affiliateId }
                }
            };
            
            // Log what we're sending
            console.log('Sending navigation message:', navigationMessage);
            
            // Check if we're inside embed-app.html by looking at parent's URL
            if (window.parent && window.parent !== window) {
                try {
                    // Try to access parent URL (might fail due to cross-origin)
                    const parentUrl = window.parent.location.href;
                    console.log('Parent URL:', parentUrl);
                } catch (e) {
                    console.log('Cannot access parent URL (cross-origin)');
                }
                
                // Send message to parent
                console.log('Posting to parent window');
                window.parent.postMessage(navigationMessage, '*');
                
                // Also try direct URL navigation as a fallback
                // This should work if we're in embed-app.html
                const currentUrl = new URL(window.location.href);
                if (currentUrl.pathname.includes('embed-app.html')) {
                    console.log('We are in embed-app.html, trying direct URL update');
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('route', '/customer-register');
                    newUrl.searchParams.set('affid', affiliateId);
                    window.location.href = newUrl.toString();
                } else {
                    console.log('Not in embed-app.html, relying on postMessage');
                }
            } else {
                // Fallback to direct navigation
                console.log('No parent window, using direct navigation');
                window.location.href = `/customer-register?affid=${affiliateId}`;
            }
        } else {
            console.log('No affiliate ID, navigating without it');
            navigateParent('customer-register');
        }
    }

    // Setup register link click handler
    function setupRegisterLink() {
        console.log('Setting up register link');
        const registerLink = document.getElementById('registerLink');
        if (registerLink) {
            console.log('Register link found, adding click handler');
            registerLink.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Register link clicked');
                navigateToRegister();
            });
        } else {
            console.log('Register link not found');
        }
    }

    // Setup form submission
    function setupFormSubmission() {
        const form = document.getElementById('customerLoginForm');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();

                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;

                // Send login status to parent
                sendMessageToParent('form-submit', { form: 'customer-login' });

                // API call with full URL
                fetch('https://wavemax.promo/api/v1/auth/customer/login', {
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
                        localStorage.setItem('customerToken', data.token);
                        localStorage.setItem('currentCustomer', JSON.stringify(data.customer));

                        // Notify parent of successful login
                        sendMessageToParent('login-success', {
                            userType: 'customer',
                            customerId: data.customer.customerId
                        });

                        // Navigate to dashboard
                        if (window.parent && window.parent !== window) {
                            window.parent.postMessage({
                                type: 'navigate',
                                data: { url: `/customer-dashboard?id=${data.customer.customerId}` }
                            }, '*');
                        } else {
                            window.location.href = `/customer-dashboard?id=${data.customer.customerId}`;
                        }
                    } else {
                        throw new Error(data.message || 'Login failed');
                    }
                })
                .catch(error => {
                    console.error('Login error:', error);
                    sendMessageToParent('login-error', { 
                        error: error.message 
                    });
                    alert(error.message || 'Invalid username or password');
                });
            });
        }
    }

    // Initialize everything when DOM is ready
    function init() {
        console.log('Customer login embed initializing');
        
        // Store affiliate ID if present in URL
        const urlParams = new URLSearchParams(window.location.search);
        const affiliateId = urlParams.get('affid') || urlParams.get('affiliate');
        if (affiliateId) {
            sessionStorage.setItem('affiliateId', affiliateId);
        }
        
        // Setup components
        setupRegisterLink();
        setupFormSubmission();
        
        // Notify parent that iframe is loaded
        sendMessageToParent('iframe-loaded', { page: 'customer-login' });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();