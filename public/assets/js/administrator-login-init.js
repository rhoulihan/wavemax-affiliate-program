(function() {
    'use strict';

    // Get config from parent window or use defaults
    const config = window.EMBED_CONFIG || {
        baseUrl: 'https://wavemax.promo',
        theme: 'light'
    };

    const BASE_URL = config.baseUrl;

    // DOM elements
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const infoMessage = document.getElementById('infoMessage');
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    // Password visibility toggle
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.textContent = type === 'password' ? 'Show' : 'Hide';
    });

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        infoMessage.style.display = 'none';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    // Show info message
    function showInfo(message) {
        infoMessage.textContent = message;
        infoMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }

    // Handle login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Basic validation
        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        // Disable form during submission
        submitBtn.disabled = true;
        submitText.innerHTML = '<span class="loading"></span>';

        try {
            const response = await fetch(`${BASE_URL}/api/v1/auth/administrator/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Store tokens
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('adminRefreshToken', data.refreshToken);
                localStorage.setItem('adminData', JSON.stringify(data.administrator));

                // Show success message
                showInfo('Login successful! Redirecting...');

                // Notify parent window if embedded
                if (window.parent !== window) {
                    window.parent.postMessage({
                        type: 'admin-login-success',
                        data: {
                            administrator: data.administrator,
                            token: data.token
                        }
                    }, '*');
                }

                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = '/administrator-dashboard-embed.html';
                }, 1000);
            } else {
                // Handle specific error cases
                if (response.status === 403 && data.message.includes('locked')) {
                    showError('Account is locked. Please contact system administrator.');
                } else if (response.status === 403 && data.message.includes('inactive')) {
                    showError('Account is inactive. Please contact system administrator.');
                } else if (data.warning) {
                    showError(data.message + ' - ' + data.warning);
                } else {
                    showError(data.message || 'Login failed. Please try again.');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please check your connection and try again.');
        } finally {
            // Re-enable form
            submitBtn.disabled = false;
            submitText.textContent = 'Sign In';
        }
    });

    // Handle forgot password
    forgotPasswordLink.addEventListener('click', async function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        
        if (!email) {
            showError('Please enter your email address first');
            return;
        }

        if (!confirm('Send password reset instructions to ' + email + '?')) {
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email, 
                    userType: 'administrator' 
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showInfo('Password reset instructions have been sent to your email.');
            } else {
                showError(data.message || 'Failed to send reset email. Please try again.');
            }
        } catch (error) {
            console.error('Password reset error:', error);
            showError('Network error. Please try again later.');
        }
    });

    // Check if already logged in
    const existingToken = localStorage.getItem('adminToken');
    if (existingToken) {
        // Verify token is still valid
        fetch(`${BASE_URL}/api/v1/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${existingToken}`
            }
        })
        .then(response => {
            if (response.ok) {
                window.location.href = '/administrator-dashboard-embed.html';
            } else {
                // Clear invalid token
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminRefreshToken');
                localStorage.removeItem('adminData');
            }
        })
        .catch(() => {
            // Network error, let user try to login
        });
    }

    // Listen for messages from parent window
    window.addEventListener('message', function(event) {
        if (event.data.type === 'logout') {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminRefreshToken');
            localStorage.removeItem('adminData');
            showInfo('You have been logged out.');
        }
    });

    // Focus on email field
    document.getElementById('email').focus();
})();