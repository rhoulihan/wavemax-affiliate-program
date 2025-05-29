/**
 * CSRF Protection Utility Module
 * Provides shared CSRF token management for all client-side applications
 */

(function(window) {
    'use strict';

    // CSRF token storage
    let csrfToken = null;
    let tokenFetchPromise = null;

    /**
     * Get the base URL from configuration or default
     */
    function getBaseUrl() {
        return window.config?.baseUrl || window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    }

    /**
     * Get CSRF token from cookie
     */
    function getCsrfTokenFromCookie() {
        const name = '_csrf=';
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return null;
    }

    /**
     * Fetch CSRF token from server
     * Uses promise caching to prevent multiple simultaneous requests
     */
    async function fetchCsrfToken() {
        // First check if token exists in cookie
        const cookieToken = getCsrfTokenFromCookie();
        if (cookieToken) {
            csrfToken = cookieToken;
            return cookieToken;
        }

        if (tokenFetchPromise) {
            return tokenFetchPromise;
        }

        tokenFetchPromise = fetch(`${getBaseUrl()}/api/csrf-token`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch CSRF token: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            csrfToken = data.csrfToken;
            tokenFetchPromise = null;
            // Also check cookie after fetch
            const cookieToken = getCsrfTokenFromCookie();
            if (cookieToken) {
                csrfToken = cookieToken;
            }
            return csrfToken;
        })
        .catch(error => {
            tokenFetchPromise = null;
            console.error('Error fetching CSRF token:', error);
            throw error;
        });

        return tokenFetchPromise;
    }

    /**
     * Ensure CSRF token is available
     * Fetches token if not already cached
     */
    async function ensureCsrfToken() {
        if (!csrfToken) {
            await fetchCsrfToken();
        }
        return csrfToken;
    }

    /**
     * Clear cached CSRF token
     * Useful when token is rejected or session changes
     */
    function clearCsrfToken() {
        csrfToken = null;
        tokenFetchPromise = null;
    }

    /**
     * Add CSRF token to request headers
     * @param {Object} headers - Existing headers object
     * @param {string} method - HTTP method
     * @returns {Object} Updated headers object
     */
    async function addCsrfHeader(headers = {}, method = 'GET') {
        if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD' && method.toUpperCase() !== 'OPTIONS') {
            await ensureCsrfToken();
            headers['x-csrf-token'] = csrfToken;
        }
        return headers;
    }

    /**
     * Enhanced fetch wrapper with automatic CSRF token handling
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async function csrfFetch(url, options = {}) {
        const method = options.method || 'GET';
        
        // Ensure credentials are included for CSRF cookie
        options.credentials = options.credentials || 'include';
        
        // Add CSRF token to headers for state-changing requests
        if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD' && method.toUpperCase() !== 'OPTIONS') {
            options.headers = await addCsrfHeader(options.headers || {}, method);
        }

        try {
            const response = await fetch(url, options);
            
            // If CSRF token was rejected, clear cache and retry once
            if (response.status === 403) {
                const responseText = await response.text();
                if (responseText.includes('csrf') || responseText.includes('CSRF')) {
                    console.warn('CSRF token rejected, fetching new token...');
                    clearCsrfToken();
                    
                    // Retry with fresh token
                    options.headers = await addCsrfHeader(options.headers || {}, method);
                    return fetch(url, options);
                }
            }
            
            return response;
        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }

    /**
     * Create an authenticated fetch function with both JWT and CSRF tokens
     * @param {Function} getAuthToken - Function that returns the JWT token
     * @returns {Function} Authenticated fetch function
     */
    function createAuthenticatedFetch(getAuthToken) {
        return async function(url, options = {}) {
            const authToken = typeof getAuthToken === 'function' ? getAuthToken() : getAuthToken;
            
            // Set up headers
            options.headers = options.headers || {};
            
            // Add Authorization header if token exists
            if (authToken) {
                options.headers['Authorization'] = `Bearer ${authToken}`;
            }
            
            // Use csrfFetch which handles CSRF tokens
            return csrfFetch(url, options);
        };
    }

    /**
     * Initialize CSRF protection for forms
     * Adds hidden CSRF token input to all forms
     */
    async function initializeFormCsrf() {
        await ensureCsrfToken();
        
        const forms = document.querySelectorAll('form[method="post"], form[method="put"], form[method="delete"]');
        forms.forEach(form => {
            // Skip if CSRF input already exists
            if (form.querySelector('input[name="_csrf"]')) {
                return;
            }
            
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = '_csrf';
            csrfInput.value = csrfToken;
            form.appendChild(csrfInput);
        });
    }

    /**
     * Update CSRF token in all forms
     * Useful after token refresh
     */
    function updateFormCsrfTokens() {
        const csrfInputs = document.querySelectorAll('input[name="_csrf"]');
        csrfInputs.forEach(input => {
            input.value = csrfToken;
        });
    }

    // Expose utilities globally
    window.CsrfUtils = {
        getBaseUrl,
        fetchCsrfToken,
        ensureCsrfToken,
        clearCsrfToken,
        addCsrfHeader,
        csrfFetch,
        createAuthenticatedFetch,
        initializeFormCsrf,
        updateFormCsrfTokens,
        // Expose token getter for debugging/testing
        getToken: () => csrfToken
    };

})(window);