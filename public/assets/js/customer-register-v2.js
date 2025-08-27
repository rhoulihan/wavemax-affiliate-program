// Customer Registration V2 - CSP Compliant with Multi-Step Navigation
(function() {
    'use strict';

    // Base URL for API calls
    const baseUrl = window.location.origin;
    const isEmbedded = window.self !== window.top;
    let affiliateData = null; // Store affiliate data for service area validation

    // Password validation function
    function validatePassword() {
        const passwordField = document.getElementById('password');
        const confirmPasswordField = document.getElementById('confirmPassword');
        const password = passwordField?.value || '';
        const confirmPassword = confirmPasswordField?.value || '';
        const username = document.getElementById('username')?.value || '';
        const email = document.getElementById('email')?.value || '';

        // Check requirements
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
            match: password !== '' && password === confirmPassword
        };

        // Check if password contains username or email
        const containsUsername = username && password.toLowerCase().includes(username.toLowerCase());
        const containsEmailUser = email && password.toLowerCase().includes(email.split('@')[0].toLowerCase());

        // Update requirement indicators
        function updateReq(id, met) {
            const element = document.getElementById(id);
            if (!element) return;
            
            const indicator = element.querySelector('span:first-child');
            if (indicator) {
                indicator.textContent = met ? '✅' : '⚪';
            }
            
            if (met) {
                element.classList.add('text-green-600');
                element.classList.remove('text-red-600', 'text-gray-600');
            } else if (password.length > 0) {
                element.classList.add('text-red-600');
                element.classList.remove('text-green-600', 'text-gray-600');
            } else {
                element.classList.add('text-gray-600');
                element.classList.remove('text-green-600', 'text-red-600');
            }
        }

        updateReq('req-length', requirements.length);
        updateReq('req-uppercase', requirements.uppercase);
        updateReq('req-lowercase', requirements.lowercase);
        updateReq('req-number', requirements.number);
        updateReq('req-special', requirements.special);
        updateReq('req-match', requirements.match);

        // Check if all requirements are met
        const allRequirementsMet = requirements.length && requirements.uppercase && requirements.lowercase &&
                                 requirements.number && requirements.special && requirements.match &&
                                 !containsUsername && !containsEmailUser;

        // Update field borders based on password state
        if (passwordField && confirmPasswordField) {
            if (password.length > 0) {
                if (allRequirementsMet) {
                    passwordField.classList.remove('border-red-500');
                    passwordField.classList.add('border-green-500');
                    confirmPasswordField.classList.remove('border-red-500');
                    confirmPasswordField.classList.add('border-green-500');
                } else {
                    passwordField.classList.remove('border-green-500');
                    passwordField.classList.add('border-red-500');
                    confirmPasswordField.classList.remove('border-green-500');
                    confirmPasswordField.classList.add('border-red-500');
                }
            } else {
                passwordField.classList.remove('border-green-500', 'border-red-500');
                confirmPasswordField.classList.remove('border-green-500', 'border-red-500');
            }
        }

        // Update strength indicator
        const strengthElement = document.getElementById('passwordStrength');
        if (strengthElement) {
            if (password.length === 0) {
                strengthElement.innerHTML = '';
            } else if (allRequirementsMet) {
                strengthElement.innerHTML = '<span class="text-green-600 font-medium">✅ Strong password</span>';
            } else {
                const missing = [];
                if (!requirements.length) missing.push('8+ characters');
                if (!requirements.uppercase) missing.push('uppercase letter');
                if (!requirements.lowercase) missing.push('lowercase letter');
                if (!requirements.number) missing.push('number');
                if (!requirements.special) missing.push('special character');
                if (!requirements.match) missing.push('passwords must match');
                if (containsUsername || containsEmailUser) missing.push('cannot contain username/email');

                strengthElement.innerHTML = `<span class="text-red-600">❌ Missing: ${missing.join(', ')}</span>`;
            }
        }

        return allRequirementsMet;
    }

    // Validate username availability
    async function validateUsername() {
        const username = document.getElementById('username');
        if (!username || !username.value) return;

        const usernameHelp = username.nextElementSibling;
        
        try {
            const response = await fetch(`${baseUrl}/api/v1/auth/check-username`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: username.value }),
                credentials: 'include'
            });

            const result = await response.json();

            if (result.available) {
                username.classList.remove('border-red-500');
                username.classList.add('border-green-500');
                if (usernameHelp) {
                    usernameHelp.textContent = '✅ Username is available';
                    usernameHelp.classList.remove('text-gray-500', 'text-red-600');
                    usernameHelp.classList.add('text-green-600');
                }
            } else {
                username.classList.remove('border-green-500');
                username.classList.add('border-red-500');
                if (usernameHelp) {
                    usernameHelp.textContent = '❌ Username is already taken';
                    usernameHelp.classList.remove('text-gray-500', 'text-green-600');
                    usernameHelp.classList.add('text-red-600');
                }
            }
        } catch (error) {
            console.error('[V2 Registration] Error checking username:', error);
        }
    }

    // Validate email availability
    async function validateEmail() {
        const email = document.getElementById('email');
        if (!email || !email.value) return;

        try {
            const response = await fetch(`${baseUrl}/api/v1/auth/check-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: email.value }),
                credentials: 'include'
            });

            const result = await response.json();

            if (result.available) {
                email.classList.remove('border-red-500');
                email.classList.add('border-green-500');
            } else {
                email.classList.remove('border-green-500');
                email.classList.add('border-red-500');
                // Create or update help text
                let emailHelp = email.parentElement.querySelector('.text-xs.text-red-600');
                if (!emailHelp) {
                    emailHelp = document.createElement('p');
                    emailHelp.className = 'text-xs text-red-600 mt-1';
                    email.parentElement.appendChild(emailHelp);
                }
                emailHelp.textContent = '❌ This email is already registered';
            }
        } catch (error) {
            console.error('[V2 Registration] Error checking email:', error);
        }
    }

    // Bag selection function
    function selectBags(num) {
        document.querySelectorAll('.bag-option').forEach(option => {
            option.classList.remove('selected');
        });
        const selectedOption = document.querySelector(`[data-bags="${num}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
        const numberOfBagsField = document.getElementById('numberOfBags');
        if (numberOfBagsField) {
            numberOfBagsField.value = num;
        }
    }

    // Setup bag selection handlers
    function setupBagSelection() {
        const bagOptions = document.querySelectorAll('.bag-option');
        bagOptions.forEach(option => {
            option.addEventListener('click', function() {
                const bags = this.getAttribute('data-bags');
                selectBags(bags);
            });
        });
    }

    // Form submission handler
    function setupFormSubmission() {
        const form = document.getElementById('customerRegistrationForm');
        if (!form) {
            console.error('[V2 Registration] Registration form not found');
            return;
        }

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Check if this is an OAuth user
            const socialToken = document.getElementById('socialToken');
            const isOAuthUser = socialToken && socialToken.value;
            
            // Show loading spinner if available
            let registrationSpinner = null;
            if (window.SwirlSpinnerUtils) {
                registrationSpinner = window.SwirlSpinnerUtils.showOnForm(this, {
                    message: 'Processing your registration...',
                    submessage: 'Please wait while we create your account'
                });
            } else if (window.SwirlSpinner) {
                registrationSpinner = new window.SwirlSpinner({
                    container: this,
                    size: 'large',
                    overlay: true,
                    message: 'Processing your registration...'
                });
                registrationSpinner.show();
            }
            
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
            }
            
            // Collect form data
            const formData = new FormData(this);
            const data = {};
            formData.forEach((value, key) => {
                data[key] = value;
            });
            
            // Add V2 specific fields
            data.registrationVersion = 'v2';
            data.paymentVersion = 'v2';
            data.initialBagsRequested = parseInt(data.numberOfBags || '2');
            
            // Get CSRF token
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
            
            try {
                const response = await fetch('/api/v1/customers/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    credentials: 'include',
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Store customer data
                    if (result.token) {
                        localStorage.setItem('customerToken', result.token);
                    }
                    if (result.customer) {
                        localStorage.setItem('currentCustomer', JSON.stringify(result.customer));
                    }
                    
                    // Redirect to success page or schedule pickup
                    const redirectUrl = '/embed-app-v2.html?route=/schedule-pickup';
                    if (result.token) {
                        window.location.href = redirectUrl + '&token=' + result.token;
                    } else {
                        window.location.href = redirectUrl;
                    }
                } else {
                    // Show error
                    if (registrationSpinner) {
                        registrationSpinner.hide();
                    }
                    if (window.ModalSystem) {
                        window.ModalSystem.error(result.message || 'Registration failed. Please try again.', 'Registration Error');
                    } else {
                        alert(result.message || 'Registration failed. Please try again.');
                    }
                    
                    // Re-enable form
                    if (submitBtn) {
                        submitBtn.disabled = false;
                    }
                }
            } catch (error) {
                console.error('[V2 Registration] Registration error:', error);
                
                if (registrationSpinner) {
                    registrationSpinner.hide();
                }
                if (window.ModalSystem) {
                    window.ModalSystem.error('An error occurred during registration. Please try again.', 'Registration Error');
                } else {
                    alert('An error occurred during registration. Please try again.');
                }
                
                // Re-enable form
                if (submitBtn) {
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // Get affiliate info and populate form
    function loadAffiliateInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        const affiliateId = urlParams.get('affid') || urlParams.get('affiliate') || urlParams.get('affiliateId');
        
        if (affiliateId) {
            const affiliateIdField = document.getElementById('affiliateId');
            if (affiliateIdField) {
                affiliateIdField.value = affiliateId;
            }
            
            // Fetch affiliate info to show their name
            fetch(`/api/v1/affiliates/public/${affiliateId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Store affiliate data for service area validation
                        affiliateData = data;
                        
                        const intro = document.getElementById('affiliateIntro');
                        if (intro && data.firstName && data.businessName) {
                            const affiliateName = data.businessName || `${data.firstName} ${data.lastName}`;
                            intro.textContent = `Sign up through ${affiliateName} for premium laundry service - pay after we weigh your laundry!`;
                        }
                    }
                })
                .catch(error => {
                    console.error('[V2 Registration] Error fetching affiliate info:', error);
                });
        }
    }

    // Initialize language preference
    function initLanguagePreference() {
        const savedLang = localStorage.getItem('selectedLanguage') || 'en';
        const langField = document.getElementById('languagePreference');
        if (langField) {
            langField.value = savedLang;
        }
    }

    // OAuth Social Auth Handling
    function setupOAuthHandlers() {
        const googleRegister = document.getElementById('googleRegister');
        const facebookRegister = document.getElementById('facebookRegister');

        if (googleRegister) {
            googleRegister.addEventListener('click', function() {
                handleSocialAuth('google');
            });
        }

        if (facebookRegister) {
            facebookRegister.addEventListener('click', function() {
                handleSocialAuth('facebook');
            });
        }

        // Check if we're returning from OAuth
        checkOAuthCallback();
    }

    function handleSocialAuth(provider) {
        console.log(`[V2 Registration] Starting ${provider} OAuth authentication...`);

        // Generate unique session ID for database polling
        const sessionId = 'oauth_v2_' + Date.now() + '_' + Math.random().toString(36).substring(2);
        console.log('[V2 Registration] Generated OAuth session ID:', sessionId);

        // Include affiliate ID in OAuth URL if present
        const affiliateId = document.getElementById('affiliateId')?.value || '';
        const oauthUrl = `${baseUrl}/api/v1/auth/customer/${provider}?popup=true&state=${sessionId}&affiliateId=${affiliateId}&version=v2&t=${Date.now()}`;
        console.log('[V2 Registration] Opening OAuth URL:', oauthUrl);

        const popup = window.open(
            oauthUrl,
            'customerSocialAuthV2',
            'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        if (!popup || popup.closed) {
            if (window.ModalSystem) {
                window.ModalSystem.error('Popup was blocked. Please allow popups for this site and try again.', 'Popup Blocked');
            } else {
                alert('Popup was blocked. Please allow popups for this site and try again.');
            }
            return;
        }

        // Database polling approach for OAuth result
        let pollCount = 0;
        const maxPolls = 120; // 6 minutes max (120 * 3 seconds)
        let authResultReceived = false;

        console.log('[V2 Registration] Starting database polling for OAuth result...');

        const pollForResult = setInterval(async () => {
            pollCount++;

            // Check if popup is still open
            if (popup && popup.closed && !authResultReceived) {
                console.log('[V2 Registration] Popup was closed by user');
                clearInterval(pollForResult);
                return;
            }

            if (pollCount > maxPolls) {
                console.log('[V2 Registration] OAuth polling timeout');
                clearInterval(pollForResult);
                if (window.ModalSystem) {
                    window.ModalSystem.error('Authentication timeout. Please try again.', 'Timeout');
                } else {
                    alert('Authentication timeout. Please try again.');
                }
                if (popup && !popup.closed) {
                    popup.close();
                }
                return;
            }

            try {
                const response = await fetch(`${baseUrl}/api/v1/auth/oauth/result/${sessionId}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.completed) {
                        authResultReceived = true;
                        clearInterval(pollForResult);
                        console.log('[V2 Registration] OAuth result received:', result);

                        if (popup && !popup.closed) {
                            popup.close();
                        }

                        if (result.success) {
                            handleOAuthSuccess(result.data, provider);
                        } else {
                            const errorMessage = result.message || 'Authentication failed. Please try again.';
                            if (window.ModalSystem) {
                                window.ModalSystem.error(errorMessage, 'Authentication Failed');
                            } else {
                                alert(errorMessage);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('[V2 Registration] Error polling for OAuth result:', error);
            }
        }, 3000); // Poll every 3 seconds
    }

    function handleOAuthSuccess(userData, provider) {
        console.log('[V2 Registration] OAuth successful, pre-filling form with user data');

        // Update social auth section to show connected status
        const socialAuthSection = document.getElementById('socialAuthSection');
        if (socialAuthSection) {
            socialAuthSection.innerHTML = `
                <div class="bg-green-50 p-6 rounded-lg border border-green-300">
                    <h3 class="text-xl font-bold mb-2 text-green-800">
                        <span data-i18n="customer.register.socialConnected">Connected with ${provider.charAt(0).toUpperCase() + provider.slice(1)}</span>
                    </h3>
                    <p class="text-green-700" data-i18n="customer.register.v2.socialConnectedMessage">
                        Great! We've connected your ${provider} account. Just complete the form below to finish registration - no payment required!
                    </p>
                </div>
            `;
        }

        // Pre-fill form fields with OAuth data
        if (userData.email) {
            const emailField = document.getElementById('email');
            if (emailField) {
                emailField.value = userData.email;
                emailField.readOnly = true;
            }
        }

        if (userData.firstName) {
            const firstNameField = document.getElementById('firstName');
            if (firstNameField) {
                firstNameField.value = userData.firstName;
            }
        }

        if (userData.lastName) {
            const lastNameField = document.getElementById('lastName');
            if (lastNameField) {
                lastNameField.value = userData.lastName;
            }
        }

        // Generate username from email if not provided
        if (userData.email && !document.getElementById('username').value) {
            const username = userData.email.split('@')[0] + '_' + Date.now().toString(36);
            document.getElementById('username').value = username;
        }

        // Hide password fields for OAuth users
        const passwordFields = document.querySelectorAll('#password, #confirmPassword');
        passwordFields.forEach(field => {
            const container = field.closest('div');
            if (container) {
                container.classList.add('hidden');
            }
            // Remove required attribute for OAuth
            field.removeAttribute('required');
        });

        // Hide account setup section
        const accountSetup = document.getElementById('accountSetupSection');
        if (accountSetup) {
            accountSetup.classList.remove('active');
            accountSetup.classList.add('hidden');
        }

        // Store OAuth token for registration
        if (userData.socialToken) {
            const tokenField = document.createElement('input');
            tokenField.type = 'hidden';
            tokenField.id = 'socialToken';
            tokenField.name = 'socialToken';
            tokenField.value = userData.socialToken;
            document.getElementById('customerRegistrationForm').appendChild(tokenField);

            const providerField = document.createElement('input');
            providerField.type = 'hidden';
            providerField.id = 'socialProvider';
            providerField.name = 'socialProvider';
            providerField.value = provider;
            document.getElementById('customerRegistrationForm').appendChild(providerField);
        }

        // Show success message
        if (window.ModalSystem) {
            window.ModalSystem.success(`Successfully connected with ${provider}! Please complete the remaining fields.`, 'Connected');
        }

        // Dispatch OAuth success event for navigation
        window.dispatchEvent(new CustomEvent('oauthSuccess'));
    }

    function checkOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const socialToken = urlParams.get('socialToken');
        const provider = urlParams.get('provider');
        const error = urlParams.get('error');

        if (error) {
            let errorMessage = 'Social authentication failed. Please try again.';
            if (window.ModalSystem) {
                window.ModalSystem.error(errorMessage, 'Authentication Error');
            } else {
                alert(errorMessage);
            }
            return;
        }

        if (socialToken && provider) {
            // Fetch user data with the social token
            fetch(`${baseUrl}/api/v1/auth/social/userdata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ socialToken, provider }),
                credentials: 'include'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    handleOAuthSuccess(data.userData, provider);
                }
            })
            .catch(error => {
                console.error('[V2 Registration] Error fetching OAuth user data:', error);
            });
        }
    }

    // Setup password validation handlers
    function setupPasswordValidation() {
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');

        if (passwordInput) {
            passwordInput.addEventListener('input', validatePassword);
            passwordInput.addEventListener('focus', validatePassword);
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', validatePassword);
        }
        if (usernameInput) {
            usernameInput.addEventListener('input', validatePassword);
            usernameInput.addEventListener('blur', validateUsername);
            // Reset on input change
            usernameInput.addEventListener('input', function() {
                const usernameHelp = this.nextElementSibling;
                this.classList.remove('border-red-500', 'border-green-500');
                if (usernameHelp) {
                    usernameHelp.textContent = 'Your unique login identifier';
                    usernameHelp.classList.remove('text-red-600', 'text-green-600');
                    usernameHelp.classList.add('text-gray-500');
                }
            });
        }
        if (emailInput) {
            emailInput.addEventListener('input', validatePassword);
            emailInput.addEventListener('blur', validateEmail);
            // Reset on input change
            emailInput.addEventListener('input', function() {
                const emailHelp = this.parentElement.querySelector('.text-xs.text-red-600');
                if (emailHelp && emailHelp.textContent.includes('❌')) {
                    this.classList.remove('border-red-500', 'border-green-500');
                    emailHelp.remove();
                }
            });
        }
    }

    // Service area validation function
    async function validateServiceArea() {
        const address = document.getElementById('address')?.value?.trim();
        const city = document.getElementById('city')?.value?.trim();
        const state = document.getElementById('state')?.value?.trim();
        const zipCode = document.getElementById('zipCode')?.value?.trim();

        if (!address || !city || !state || !zipCode) {
            return false; // Not all fields filled
        }

        if (!affiliateData || !affiliateData.serviceLatitude || !affiliateData.serviceLongitude || !affiliateData.serviceRadius) {
            console.error('[V2 Registration] Missing affiliate service area data');
            return true; // Allow to proceed if we can't validate
        }

        const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
        console.log('[V2 Registration] Validating service area for address:', fullAddress);

        // Show spinner
        let spinner = null;
        if (window.SwirlSpinnerUtils) {
            const form = document.getElementById('customerRegistrationForm');
            spinner = window.SwirlSpinnerUtils.showOnForm(form, {
                message: 'Validating address...',
                submessage: 'Checking if your address is within our service area'
            });
        }

        try {
            // Get CSRF token
            let csrfToken = window.csrfToken;
            if (!csrfToken) {
                const csrfMeta = document.querySelector('meta[name="csrf-token"]');
                if (csrfMeta) {
                    csrfToken = csrfMeta.getAttribute('content');
                }
            }
            
            const response = await fetch(`${baseUrl}/api/v1/service-area/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken || ''
                },
                credentials: 'include',
                body: JSON.stringify({ address, city, state, zipCode })
            });

            const result = await response.json();

            if (!result.success || !result.coordinates) {
                console.error('[V2 Registration] Address validation failed:', result.message);
                if (spinner) spinner.hide();
                
                // Show error message
                const message = result.message || 'Unable to verify this address. Please check that the street address and zip code are correct.';
                if (window.modalAlert) {
                    window.modalAlert(message, 'Address Validation Error');
                } else {
                    alert(message);
                }
                return false;
            }

            const customerLat = result.coordinates.latitude;
            const customerLon = result.coordinates.longitude;

            console.log('[V2 Registration] Geocoding successful:', {
                lat: customerLat,
                lon: customerLon,
                formattedAddress: result.formattedAddress
            });

            // Calculate distance using Haversine formula
            const distance = calculateDistance(
                affiliateData.serviceLatitude,
                affiliateData.serviceLongitude,
                customerLat,
                customerLon
            );

            console.log('[V2 Registration] Distance from affiliate:', distance, 'miles');
            console.log('[V2 Registration] Service radius:', affiliateData.serviceRadius, 'miles');

            if (spinner) spinner.hide();

            if (distance > affiliateData.serviceRadius) {
                // Outside service area
                if (window.modalAlert) {
                    window.modalAlert(
                        `Unfortunately, this address is outside the service area. The service area extends ${affiliateData.serviceRadius} miles from the affiliate location, and this address is ${distance.toFixed(1)} miles away.`,
                        'Outside Service Area'
                    );
                } else {
                    alert(`Unfortunately, this address is outside the service area. The service area extends ${affiliateData.serviceRadius} miles from the affiliate location, and this address is ${distance.toFixed(1)} miles away.`);
                }

                // Clear only the street address field
                document.getElementById('address').value = '';
                return false;
            }

            return true; // Address is valid and within service area

        } catch (error) {
            console.error('[V2 Registration] Error validating service area:', error);
            if (spinner) spinner.hide();
            
            // Allow to proceed on error
            return true;
        }
    }

    // Calculate distance between two coordinates in miles
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Radius of Earth in miles
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    function toRad(deg) {
        return deg * (Math.PI/180);
    }

    // Initialize when DOM is ready
    function init() {
        console.log('[V2 Registration] Initializing V2 customer registration form');
        
        // Setup all handlers
        setupBagSelection();
        setupFormSubmission();
        setupOAuthHandlers();
        setupPasswordValidation();
        loadAffiliateInfo();
        initLanguagePreference();
        
        // Make validateServiceArea available globally for navigation
        window.validateServiceArea = validateServiceArea;
        
        // Note: Navigation is handled by customer-register-v2-navigation.js
        // i18n initialization and translation is handled by embed-app-v2.js
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();