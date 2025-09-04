/**
 * Customer Registration V2 - Migrated to use ApiClient
 * This file demonstrates the migration from fetch() to ApiClient
 */

(function() {
    'use strict';
    
    const baseUrl = window.APP_BASE_URL || '';
    let csrfToken = null;
    let sessionId = null;
    let affiliateData = null;
    let authWindow = null;
    let authResultReceived = false;
    
    // ============================================================
    // EXAMPLE: BEFORE AND AFTER MIGRATION
    // ============================================================
    
    /**
     * BEFORE: Check username availability using fetch
     */
    async function checkUsernameAvailabilityOLD(username) {
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
            
            if (!result.success) {
                showError(result.message);
            }
            return result;
        } catch (error) {
            console.error('Username check error:', error);
            showError('Error checking username availability');
        }
    }
    
    /**
     * AFTER: Check username availability using ApiClient
     */
    async function checkUsernameAvailability(username) {
        try {
            const result = await ApiClient.post('/api/v1/auth/check-username', {
                username: username.value
            }, {
                showError: false,  // Handle error display manually
                showLoading: false  // No loading spinner for real-time validation
            });
            
            return result;
        } catch (error) {
            // ApiClient already logged the error
            return { success: false, available: false };
        }
    }
    
    /**
     * BEFORE: Check email availability using fetch
     */
    async function checkEmailAvailabilityOLD(email) {
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
            
            if (!result.success) {
                showError(result.message);
            }
            return result;
        } catch (error) {
            console.error('Email check error:', error);
            showError('Error checking email availability');
        }
    }
    
    /**
     * AFTER: Check email availability using ApiClient
     */
    async function checkEmailAvailability(email) {
        try {
            const result = await ApiClient.post('/api/v1/auth/check-email', {
                email: email.value
            }, {
                showError: false,
                showLoading: false
            });
            
            return result;
        } catch (error) {
            return { success: false, available: false };
        }
    }
    
    /**
     * BEFORE: Submit registration using fetch with manual CSRF and spinner
     */
    async function submitRegistrationOLD(formData) {
        const spinner = new SwirlSpinner('Creating your account...');
        
        try {
            // Get CSRF token
            if (!csrfToken) {
                const csrfResponse = await fetch('/csrf-token');
                const csrfData = await csrfResponse.json();
                csrfToken = csrfData.csrfToken;
            }
            
            const response = await fetch('/api/customers/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            spinner.hide();
            
            if (result.success) {
                showSuccess('Registration successful!');
                window.location.href = '/customer-success';
            } else {
                showError(result.message || 'Registration failed');
            }
        } catch (error) {
            spinner.hide();
            console.error('Registration error:', error);
            showError('An error occurred during registration');
        }
    }
    
    /**
     * AFTER: Submit registration using ApiClient with automatic features
     */
    async function submitRegistration(formData) {
        try {
            const result = await ApiClient.post('/api/customers/register', formData, {
                showLoading: true,
                loadingMessage: 'Creating your account...',
                showSuccess: true,
                csrf: true  // Automatically handles CSRF
            });
            
            if (result.success) {
                // Store token if returned
                if (result.token) {
                    localStorage.setItem('authToken', result.token);
                }
                
                // Redirect to success page
                window.location.href = '/customer-success';
            }
        } catch (error) {
            // Error already displayed by ApiClient
            console.error('[V2 Registration] Registration failed:', error);
        }
    }
    
    /**
     * BEFORE: Fetch affiliate info using fetch
     */
    async function loadAffiliateInfoOLD(affiliateId) {
        try {
            const response = await fetch(`/api/v1/affiliates/public/${affiliateId}`);
            const data = await response.json();
            
            if (data.success) {
                affiliateData = data;
                updateAffiliateDisplay(data);
            }
        } catch (error) {
            console.error('Error loading affiliate:', error);
        }
    }
    
    /**
     * AFTER: Fetch affiliate info using ApiClient
     */
    async function loadAffiliateInfo(affiliateId) {
        try {
            const data = await ApiClient.get(`/api/v1/affiliates/public/${affiliateId}`, {
                showError: false  // Silently fail if affiliate not found
            });
            
            if (data.success) {
                affiliateData = data;
                updateAffiliateDisplay(data);
            }
        } catch (error) {
            console.log('Could not load affiliate info');
        }
    }
    
    /**
     * BEFORE: Poll for OAuth result using fetch
     */
    async function pollForOAuthResultOLD(sessionId) {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${baseUrl}/api/v1/auth/oauth/result/${sessionId}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.completed) {
                        clearInterval(pollInterval);
                        handleOAuthResult(result);
                    }
                }
            } catch (error) {
                console.error('OAuth polling error:', error);
            }
        }, 2000);
    }
    
    /**
     * AFTER: Poll for OAuth result using ApiClient's poll method
     */
    async function pollForOAuthResult(sessionId) {
        try {
            const result = await ApiClient.poll(
                `/api/v1/auth/oauth/result/${sessionId}`,
                (data) => data.completed,  // Check function
                {
                    interval: 2000,
                    maxAttempts: 30,
                    showError: false
                }
            );
            
            handleOAuthResult(result);
        } catch (error) {
            console.error('[OAuth] Polling timeout or error');
            authWindow?.close();
        }
    }
    
    /**
     * BEFORE: Validate service area using fetch
     */
    async function validateServiceAreaOLD(addressData) {
        try {
            // Get CSRF if needed
            if (!csrfToken) {
                const csrfResponse = await fetch('/csrf-token');
                const csrfData = await csrfResponse.json();
                csrfToken = csrfData.csrfToken;
            }
            
            const response = await fetch(`${baseUrl}/api/v1/service-area/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken || ''
                },
                credentials: 'include',
                body: JSON.stringify(addressData)
            });

            const result = await response.json();
            
            if (!result.inServiceArea) {
                showError('Address is outside our service area');
                return false;
            }
            return true;
        } catch (error) {
            console.error('Service area validation error:', error);
            return false;
        }
    }
    
    /**
     * AFTER: Validate service area using ApiClient
     */
    async function validateServiceArea(addressData) {
        try {
            const result = await ApiClient.post('/api/v1/service-area/validate', addressData, {
                showError: false,
                showLoading: false,
                csrf: true
            });
            
            if (!result.inServiceArea) {
                if (window.ErrorHandler) {
                    window.ErrorHandler.showError('Address is outside our service area');
                }
                return false;
            }
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * AFTER: Complete form submission handler using ApiClient
     */
    async function handleFormSubmit(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Convert FormData to object
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        // Validate service area first
        const isValid = await validateServiceArea({
            address: data.address,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode
        });
        
        if (!isValid) {
            return;
        }
        
        // Add affiliate ID and other metadata
        data.affiliateId = affiliateId;
        data.languagePreference = localStorage.getItem('selectedLanguage') || 'en';
        
        // Submit registration using ApiClient
        try {
            const result = await ApiClient.submitForm('/api/customers/register', form, {
                showLoading: true,
                loadingMessage: 'Creating your account...',
                showSuccess: true,
                csrf: true
            });
            
            if (result.success) {
                // Store customer data
                if (result.customerId) {
                    localStorage.setItem('customerId', result.customerId);
                }
                if (result.token) {
                    localStorage.setItem('authToken', result.token);
                }
                
                // Redirect to success page
                setTimeout(() => {
                    window.location.href = `/customer-success?welcome=true&id=${result.customerId}`;
                }, 1000);
            }
        } catch (error) {
            // ApiClient already displayed the error
            console.error('[Registration] Failed:', error);
        }
    }
    
    /**
     * AFTER: Batch multiple API calls using ApiClient
     */
    async function initializeForm() {
        const affiliateId = getAffiliateId();
        if (!affiliateId) {
            return;
        }
        
        try {
            // Batch multiple requests
            const [affiliateData, serviceAreas, config] = await ApiClient.batch([
                { method: 'get', endpoint: `/api/v1/affiliates/public/${affiliateId}` },
                { method: 'get', endpoint: '/api/v1/service-areas' },
                { method: 'get', endpoint: '/api/v1/config/registration' }
            ], {
                showLoading: true,
                showError: true
            });
            
            // Process results
            if (affiliateData.success) {
                updateAffiliateDisplay(affiliateData);
            }
            
            if (serviceAreas.success) {
                initializeServiceAreaAutocomplete(serviceAreas.areas);
            }
            
            if (config.success) {
                applyConfiguration(config);
            }
        } catch (error) {
            console.error('Initialization failed:', error);
        }
    }
    
    // ============================================================
    // HELPER FUNCTIONS (remain mostly unchanged)
    // ============================================================
    
    function getAffiliateId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('affiliateId') || localStorage.getItem('affiliateId');
    }
    
    function updateAffiliateDisplay(data) {
        const intro = document.getElementById('affiliateIntro');
        if (intro && data.businessName) {
            const affiliateName = data.businessName || `${data.firstName} ${data.lastName}`;
            intro.textContent = `Sign up through ${affiliateName} for premium laundry service!`;
        }
    }
    
    function handleOAuthResult(result) {
        if (result.success) {
            // Populate form with OAuth data
            if (result.user) {
                document.getElementById('firstName').value = result.user.firstName || '';
                document.getElementById('lastName').value = result.user.lastName || '';
                document.getElementById('email').value = result.user.email || '';
            }
            
            authWindow?.close();
        }
    }
    
    // ============================================================
    // INITIALIZATION
    // ============================================================
    
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[Customer Register V2] Initializing with ApiClient');
        
        // Initialize ApiClient CSRF token
        ApiClient.initCSRF();
        
        // Set up form
        const form = document.getElementById('registrationForm');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }
        
        // Initialize form data
        initializeForm();
        
        // Set up real-time validation
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            let debounceTimer;
            usernameInput.addEventListener('input', function() {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    checkUsernameAvailability(this);
                }, 500);
            });
        }
        
        const emailInput = document.getElementById('email');
        if (emailInput) {
            let debounceTimer;
            emailInput.addEventListener('input', function() {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    checkEmailAvailability(this);
                }, 500);
            });
        }
    });
    
})();