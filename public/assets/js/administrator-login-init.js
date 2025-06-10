(function() {
    'use strict';

    // Note: Login endpoints currently don't require CSRF tokens
    // But we'll prepare for future implementation
    const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

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
            const response = await csrfFetch(`${BASE_URL}/api/v1/auth/administrator/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Check if password change is required
                if (data.requirePasswordChange) {
                    // Store limited token
                    localStorage.setItem('adminToken', data.token);
                    localStorage.setItem('adminData', JSON.stringify(data.user));
                    localStorage.setItem('requirePasswordChange', 'true');
                    
                    // Show password change form
                    showPasswordChangeForm();
                } else {
                    // Store tokens
                    localStorage.setItem('adminToken', data.token);
                    localStorage.setItem('adminRefreshToken', data.refreshToken);
                    localStorage.setItem('adminData', JSON.stringify(data.user || data.administrator));

                    // Show success message
                    showInfo('Login successful! Redirecting...');

                    // Notify parent window if embedded
                    if (window.parent !== window) {
                        window.parent.postMessage({
                            type: 'admin-login-success',
                            data: {
                                administrator: data.user || data.administrator,
                                token: data.token
                            }
                        }, '*');
                    }

                    // Redirect to dashboard
                    setTimeout(() => {
                        window.location.href = '/administrator-dashboard-embed.html';
                    }, 1000);
                }
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
            const response = await csrfFetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
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

    // Show password change form
    function showPasswordChangeForm() {
        const formHtml = `
            <form id="passwordChangeForm" class="space-y-6">
                <div>
                    <h2 class="text-xl font-semibold text-gray-900 mb-2">Password Change Required</h2>
                    <p class="text-sm text-gray-600 mb-4">You must change your password before continuing.</p>
                </div>
                
                <div>
                    <label for="currentPassword" class="block text-sm font-medium text-gray-700">
                        Current Password
                    </label>
                    <div class="mt-1">
                        <input id="currentPassword" type="password" required
                               class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    </div>
                </div>

                <div>
                    <label for="newPassword" class="block text-sm font-medium text-gray-700">
                        New Password
                    </label>
                    <div class="mt-1">
                        <input id="newPassword" type="password" required
                               class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    </div>
                    <p class="mt-2 text-sm text-gray-500">
                        Must be at least 12 characters with uppercase, lowercase, numbers and special characters
                    </p>
                </div>

                <div>
                    <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
                        Confirm New Password
                    </label>
                    <div class="mt-1">
                        <input id="confirmPassword" type="password" required
                               class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    </div>
                </div>

                <div>
                    <button type="submit" id="changePasswordBtn"
                            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <span id="changePasswordText">Change Password</span>
                    </button>
                </div>
            </form>
        `;
        
        loginForm.style.display = 'none';
        const container = loginForm.parentElement;
        const passwordDiv = document.createElement('div');
        passwordDiv.innerHTML = formHtml;
        container.appendChild(passwordDiv);
        
        // Handle password change form submission
        const passwordChangeForm = document.getElementById('passwordChangeForm');
        passwordChangeForm.addEventListener('submit', handlePasswordChange);
    }
    
    // Handle password change
    async function handlePasswordChange(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Validate passwords match
        if (newPassword !== confirmPassword) {
            showError('New passwords do not match');
            return;
        }
        
        const changeBtn = document.getElementById('changePasswordBtn');
        const changeText = document.getElementById('changePasswordText');
        
        changeBtn.disabled = true;
        changeText.innerHTML = '<span class="loading"></span>';
        
        try {
            const response = await csrfFetch(`${BASE_URL}/api/v1/administrators/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Clear password change flag
                localStorage.removeItem('requirePasswordChange');
                
                showInfo('Password changed successfully! Please log in again with your new password.');
                
                // Clear tokens
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminData');
                
                // Reload page to show login form
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                showError(data.message || 'Failed to change password');
            }
        } catch (error) {
            console.error('Password change error:', error);
            showError('Network error. Please try again.');
        } finally {
            changeBtn.disabled = false;
            changeText.textContent = 'Change Password';
        }
    }

    // Listen for messages from parent window
    window.addEventListener('message', function(event) {
        if (event.data.type === 'logout') {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminRefreshToken');
            localStorage.removeItem('adminData');
            localStorage.removeItem('requirePasswordChange');
            showInfo('You have been logged out.');
        }
    });

    // Focus on email field
    document.getElementById('email').focus();
})();