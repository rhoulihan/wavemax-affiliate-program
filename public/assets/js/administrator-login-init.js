(function() {
    'use strict';

    // Wait for i18n to be available
    function waitForI18n(callback) {
        if (window.i18n && typeof window.i18n.translatePage === 'function') {
            callback();
        } else {
            setTimeout(() => waitForI18n(callback), 50);
        }
    }

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
        const key = type === 'password' ? 'administrator.login.showPassword' : 'administrator.login.hidePassword';
        this.textContent = window.i18n ? window.i18n.t(key) : (type === 'password' ? 'Show' : 'Hide');
        // Update the data-i18n attribute so it stays translated if language changes
        this.setAttribute('data-i18n', key);
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

    // ALWAYS clear any existing session for admin login page
    // This ensures administrators must always enter credentials
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRefreshToken');
    localStorage.removeItem('adminData');
    localStorage.removeItem('requirePasswordChange');
    
    // The login form is already visible by default
    // No auto-redirect or token checking for administrator login

    // Password strength validation
    function validatePasswordStrength(password, username = '', email = '') {
        const requirements = {
            length: password.length >= 12, // Administrators need stronger passwords
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)
        };

        // Check against common patterns and user data
        const hasSequential = /123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password);
        const hasUsername = username && password.toLowerCase().includes(username.toLowerCase());
        const hasEmail = email && password.toLowerCase().includes(email.split('@')[0].toLowerCase());
        const hasRepeated = /(.)\1{2,}/.test(password);

        requirements.noSequential = !hasSequential;
        requirements.noUsername = !hasUsername;
        requirements.noEmail = !hasEmail;
        requirements.noRepeated = !hasRepeated;

        const score = Object.values(requirements).filter(Boolean).length;
        return { requirements, score, isValid: score >= 5 && requirements.length && requirements.uppercase && requirements.lowercase && requirements.number && requirements.special };
    }

    function updatePasswordRequirements(password, confirmPassword = '', email = '') {
        const validation = validatePasswordStrength(password, '', email);
        const requirements = validation.requirements;
        
        // Add password match requirement
        requirements.match = password !== '' && password === confirmPassword;

        // Update requirement indicators
        const updateReq = (id, met) => {
            const element = document.getElementById(id);
            if (element) {
                const indicator = element.querySelector('.req-indicator');
                if (indicator) {
                    indicator.textContent = met ? '✅' : '⚪';
                    indicator.className = met ? 'req-indicator met' : 'req-indicator unmet';
                }
                // Add visual emphasis to the requirement text
                const textSpan = element.querySelector('span:not(.req-indicator)');
                if (textSpan) {
                    textSpan.style.color = met ? '#22c55e' : '#666';
                    textSpan.style.fontWeight = met ? '500' : 'normal';
                }
            }
        };

        updateReq('req-length', requirements.length);
        updateReq('req-uppercase', requirements.uppercase);
        updateReq('req-lowercase', requirements.lowercase);
        updateReq('req-number', requirements.number);
        updateReq('req-special', requirements.special);
        updateReq('req-match', requirements.match);

        // Update strength indicator
        const strengthElement = document.getElementById('passwordStrength');
        if (strengthElement) {
            if (password.length === 0) {
                strengthElement.innerHTML = '';
            } else if (validation.isValid && requirements.match) {
                const strongText = window.i18n ? window.i18n.t('administrator.login.passwordStrong') : 'Strong password';
                strengthElement.innerHTML = `<span style="color: #22c55e; font-weight: 500;">✅ ${strongText}</span>`;
            } else {
                // Don't show missing items since they're already shown in the requirements list
                strengthElement.innerHTML = '';
            }
        }

        return validation.isValid && requirements.match;
    }

    // Show password change form
    function showPasswordChangeForm() {
        const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
        const adminEmail = adminData.email || '';
        
        const formHtml = `
            <form id="passwordChangeForm" class="password-change-form">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="font-size: 24px; font-weight: 600; color: #333; margin-bottom: 8px;" data-i18n="administrator.login.passwordChangeRequired">Password Change Required</h2>
                    <p style="font-size: 14px; color: #666;" data-i18n="administrator.login.passwordChangeSubtitle">You must change your password before continuing.</p>
                </div>
                
                <div class="form-group">
                    <label for="currentPassword" data-i18n="administrator.login.currentPassword">
                        Current Password
                    </label>
                    <input id="currentPassword" type="password" required>
                </div>

                <div class="form-group">
                    <label for="newPassword" data-i18n="administrator.login.newPassword">
                        New Password
                    </label>
                    <input id="newPassword" type="password" required>
                </div>

                <div class="form-group">
                    <label for="confirmPassword" data-i18n="administrator.login.confirmPassword">
                        Confirm New Password
                    </label>
                    <input id="confirmPassword" type="password" required>
                </div>

                <!-- Password Requirements Display -->
                <div id="passwordRequirements">
                    <div class="req-title" data-i18n="administrator.login.passwordRequirementTitle">Password must contain:</div>
                    <ul>
                        <li id="req-length">
                            <span class="req-indicator unmet">⚪</span>
                            <span data-i18n="administrator.login.passwordLength">At least 12 characters</span>
                        </li>
                        <li id="req-uppercase">
                            <span class="req-indicator unmet">⚪</span>
                            <span data-i18n="administrator.login.passwordUppercase">One uppercase letter</span>
                        </li>
                        <li id="req-lowercase">
                            <span class="req-indicator unmet">⚪</span>
                            <span data-i18n="administrator.login.passwordLowercase">One lowercase letter</span>
                        </li>
                        <li id="req-number">
                            <span class="req-indicator unmet">⚪</span>
                            <span data-i18n="administrator.login.passwordNumber">One number</span>
                        </li>
                        <li id="req-special">
                            <span class="req-indicator unmet">⚪</span>
                            <span data-i18n="administrator.login.passwordSpecial">One special character (!@#$%^&*)</span>
                        </li>
                        <li id="req-match">
                            <span class="req-indicator unmet">⚪</span>
                            <span data-i18n="administrator.login.passwordsMatch">Passwords match</span>
                        </li>
                    </ul>
                    <div id="passwordStrength"></div>
                </div>

                <div style="margin-top: 20px;">
                    <button type="submit" id="changePasswordBtn" class="btn">
                        <span id="changePasswordText" data-i18n="administrator.login.changePassword">Change Password</span>
                    </button>
                </div>
            </form>
        `;
        
        loginForm.style.display = 'none';
        const container = loginForm.parentElement;
        const passwordDiv = document.createElement('div');
        passwordDiv.innerHTML = formHtml;
        container.appendChild(passwordDiv);
        
        // Refresh translations for the new form
        waitForI18n(() => {
            window.i18n.translatePage();
        });
        
        // Add password validation event listeners
        const newPasswordField = document.getElementById('newPassword');
        const confirmPasswordField = document.getElementById('confirmPassword');
        
        // Initialize with empty values to show all requirements
        updatePasswordRequirements('', '', adminEmail);
        
        if (newPasswordField) {
            newPasswordField.addEventListener('input', function() {
                const newValue = this.value;
                const confirmValue = confirmPasswordField ? confirmPasswordField.value : '';
                updatePasswordRequirements(newValue, confirmValue, adminEmail);
            });
            
            // Also listen for keyup to catch all changes
            newPasswordField.addEventListener('keyup', function() {
                const newValue = this.value;
                const confirmValue = confirmPasswordField ? confirmPasswordField.value : '';
                updatePasswordRequirements(newValue, confirmValue, adminEmail);
            });
        }
        
        if (confirmPasswordField) {
            confirmPasswordField.addEventListener('input', function() {
                const newValue = newPasswordField ? newPasswordField.value : '';
                const confirmValue = this.value;
                updatePasswordRequirements(newValue, confirmValue, adminEmail);
            });
            
            // Also listen for keyup to catch all changes
            confirmPasswordField.addEventListener('keyup', function() {
                const newValue = newPasswordField ? newPasswordField.value : '';
                const confirmValue = this.value;
                updatePasswordRequirements(newValue, confirmValue, adminEmail);
            });
        }
        
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
        const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
        const adminEmail = adminData.email || '';
        
        // Validate passwords match
        if (newPassword !== confirmPassword) {
            showError('administrator.login.passwordsDontMatch', true);
            return;
        }
        
        // Validate password strength
        const validation = validatePasswordStrength(newPassword, '', adminEmail);
        if (!validation.isValid) {
            showError('administrator.login.passwordRequirements', true);
            return;
        }
        
        // Check if new password is same as current
        if (currentPassword === newPassword) {
            showError('administrator.login.passwordSameAsCurrent', true);
            return;
        }
        
        const changeBtn = document.getElementById('changePasswordBtn');
        const changeText = document.getElementById('changePasswordText');
        
        changeBtn.disabled = true;
        changeText.innerHTML = '<span class="loading"></span>';
        if (window.i18n) {
            changeText.setAttribute('data-original-text', changeText.textContent);
        }
        
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
                
                showInfo('administrator.login.passwordChangedSuccess', true);
                
                // Clear tokens
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminData');
                
                // Reload page to show login form
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                showError(data.message || window.i18n?.t('administrator.login.passwordChangeFailed') || 'Failed to change password');
            }
        } catch (error) {
            console.error('Password change error:', error);
            showError('administrator.login.networkError', true);
        } finally {
            changeBtn.disabled = false;
            if (window.i18n) {
                changeText.textContent = window.i18n.t('administrator.login.changePassword');
            } else {
                changeText.textContent = 'Change Password';
            }
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