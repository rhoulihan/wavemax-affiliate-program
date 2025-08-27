// Customer Registration V2 - CSP Compliant
(function() {
    'use strict';

    // Base URL for API calls
    const baseUrl = window.location.origin;
    const isEmbedded = window.self !== window.top;

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
            console.error('Registration form not found');
            return;
        }

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Check if this is an OAuth user
            const socialToken = document.getElementById('socialToken');
            const isOAuthUser = socialToken && socialToken.value;
            
            // Only validate passwords for non-OAuth users
            if (!isOAuthUser) {
                const password = document.getElementById('password').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                
                if (password !== confirmPassword) {
                    if (window.ModalSystem) {
                        window.ModalSystem.error('Passwords do not match', 'Validation Error');
                    } else {
                        alert('Passwords do not match');
                    }
                    return;
                }
            }
            
            // Show loading spinner if available
            const loadingSpinner = document.getElementById('loadingSpinner');
            if (loadingSpinner) {
                loadingSpinner.classList.remove('hidden');
            }
            
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span data-i18n="customer.register.processing">Processing your registration...</span>';
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
                    if (window.ModalSystem) {
                        window.ModalSystem.error(result.message || 'Registration failed. Please try again.', 'Registration Error');
                    } else {
                        alert(result.message || 'Registration failed. Please try again.');
                    }
                    
                    // Re-enable form
                    if (loadingSpinner) {
                        loadingSpinner.classList.add('hidden');
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span data-i18n="customer.register.v2.submitButton">Sign Up for Free - No Payment Required</span>';
                    }
                }
            } catch (error) {
                console.error('Registration error:', error);
                
                if (window.ModalSystem) {
                    window.ModalSystem.error('An error occurred during registration. Please try again.', 'Registration Error');
                } else {
                    alert('An error occurred during registration. Please try again.');
                }
                
                // Re-enable form
                if (loadingSpinner) {
                    loadingSpinner.classList.add('hidden');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span data-i18n="customer.register.v2.submitButton">Sign Up for Free - No Payment Required</span>';
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
                        const intro = document.getElementById('affiliateIntro');
                        if (intro && data.firstName && data.businessName) {
                            // Update the subtitle to mention the affiliate
                            const affiliateName = data.businessName || `${data.firstName} ${data.lastName}`;
                            intro.textContent = `Sign up through ${affiliateName} for premium laundry service - pay after we weigh your laundry!`;
                        }
                    }
                })
                .catch(error => {
                    console.error('Error fetching affiliate info:', error);
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
    
    // Listen for language changes from parent
    function setupLanguageListener() {
        window.addEventListener('message', function(event) {
            if (event.data.type === 'language-change' && event.data.data?.language) {
                const newLanguage = event.data.data.language;
                console.log('[Customer-Register-V2] Language change received:', newLanguage);
                
                // Update language preference field
                const langField = document.getElementById('languagePreference');
                if (langField) {
                    langField.value = newLanguage;
                }
                
                // Store in localStorage
                localStorage.setItem('selectedLanguage', newLanguage);
                
                // Note: The actual language change and translation is handled by embed-app-v2.js
                // which is the parent script that manages i18n for embedded pages
            }
        });
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
        console.log(`[Customer-Register-V2] Starting ${provider} OAuth authentication...`);

        // Generate unique session ID for database polling
        const sessionId = 'oauth_v2_' + Date.now() + '_' + Math.random().toString(36).substring(2);
        console.log('[Customer-Register-V2] Generated OAuth session ID:', sessionId);

        // Include affiliate ID in OAuth URL if present
        const affiliateId = document.getElementById('affiliateId')?.value || '';
        const oauthUrl = `${baseUrl}/api/v1/auth/customer/${provider}?popup=true&state=${sessionId}&affiliateId=${affiliateId}&version=v2&t=${Date.now()}`;
        console.log('[Customer-Register-V2] Opening OAuth URL:', oauthUrl);

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

        console.log('[Customer-Register-V2] Starting database polling for OAuth result...');

        const pollForResult = setInterval(async () => {
            pollCount++;

            // Check if popup is still open
            if (popup && popup.closed && !authResultReceived) {
                console.log('[Customer-Register-V2] Popup was closed by user');
                clearInterval(pollForResult);
                return;
            }

            if (pollCount > maxPolls) {
                console.log('[Customer-Register-V2] OAuth polling timeout');
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
                        console.log('[Customer-Register-V2] OAuth result received:', result);

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
                console.error('[Customer-Register-V2] Error polling for OAuth result:', error);
            }
        }, 3000); // Poll every 3 seconds
    }

    function handleOAuthSuccess(userData, provider) {
        console.log('[Customer-Register-V2] OAuth successful, pre-filling form with user data');

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
                container.style.display = 'none';
            }
            // Remove required attribute for OAuth
            field.removeAttribute('required');
        });

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

        // Scroll to first empty required field
        const firstEmptyField = document.querySelector('input[required]:not([value]):not([type="hidden"])');
        if (firstEmptyField) {
            firstEmptyField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstEmptyField.focus();
        }
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
                console.error('[Customer-Register-V2] Error fetching OAuth user data:', error);
            });
        }
    }

    // Initialize when DOM is ready
    function init() {
        console.log('[Customer-Register-V2] Initializing V2 customer registration form');
        
        // Setup all handlers
        setupBagSelection();
        setupFormSubmission();
        setupOAuthHandlers();  // Add OAuth handling
        loadAffiliateInfo();
        initLanguagePreference();
        setupLanguageListener();
        
        // Note: i18n initialization and translation is handled by embed-app-v2.js
        // We just need to ensure our elements are ready for translation
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();