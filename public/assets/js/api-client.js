/**
 * API Client Utility
 * Provides centralized AJAX/fetch handling with consistent error management
 * Reduces code duplication across frontend JavaScript files
 */

(function(window) {
  'use strict';

  class ApiClient {
    constructor() {
      this.baseURL = window.location.origin;
      this.defaultHeaders = {
        'Content-Type': 'application/json'
      };
      this.csrfToken = null;
    }

    /**
     * Initialize CSRF token if needed
     */
    async initCSRF() {
      if (this.csrfToken) return this.csrfToken;
      
      try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        this.csrfToken = data.csrfToken;
        return this.csrfToken;
      } catch (error) {
        console.error('Failed to get CSRF token:', error);
        return null;
      }
    }

    /**
     * Build full URL from endpoint
     */
    buildURL(endpoint) {
      if (endpoint.startsWith('http')) {
        return endpoint;
      }
      return `${this.baseURL}${endpoint}`;
    }

    /**
     * Handle response and errors consistently
     */
    async handleResponse(response) {
      // Try to parse JSON response
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle non-2xx responses
      if (!response.ok) {
        const error = new Error(
          data.message || 
          data.error || 
          `Request failed with status ${response.status}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
      }

      // Check for success: false in response
      if (typeof data === 'object' && data.success === false) {
        const error = new Error(data.message || 'Request failed');
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    }

    /**
     * Show error message using available error handler
     */
    showError(message) {
      // Use global ErrorHandler if available
      if (window.ErrorHandler && typeof window.ErrorHandler.showError === 'function') {
        window.ErrorHandler.showError(message);
      } else if (window.showError && typeof window.showError === 'function') {
        window.showError(message);
      } else {
        // Fallback to console and alert
        console.error('API Error:', message);
        alert(message);
      }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
      // Use global ErrorHandler if available (it handles success too)
      if (window.ErrorHandler && typeof window.ErrorHandler.showSuccess === 'function') {
        window.ErrorHandler.showSuccess(message);
      } else if (window.showSuccess && typeof window.showSuccess === 'function') {
        window.showSuccess(message);
      } else {
        console.log('Success:', message);
      }
    }

    /**
     * Show loading spinner
     */
    showLoading(message = 'Loading...') {
      if (window.SwirlSpinner) {
        return new window.SwirlSpinner(message);
      }
      return null;
    }

    /**
     * Hide loading spinner
     */
    hideLoading(spinner) {
      if (spinner && spinner.hide) {
        spinner.hide();
      }
    }

    /**
     * Perform GET request
     */
    async get(endpoint, options = {}) {
      try {
        const response = await fetch(this.buildURL(endpoint), {
          method: 'GET',
          headers: {
            ...this.defaultHeaders,
            ...options.headers
          },
          credentials: options.credentials || 'same-origin'
        });

        return await this.handleResponse(response);
      } catch (error) {
        if (options.showError !== false) {
          this.showError(error.message);
        }
        throw error;
      }
    }

    /**
     * Perform POST request
     */
    async post(endpoint, data = {}, options = {}) {
      const spinner = options.showLoading !== false ? this.showLoading(options.loadingMessage) : null;
      
      try {
        // Get CSRF token if needed
        if (options.csrf !== false) {
          await this.initCSRF();
        }

        const headers = {
          ...this.defaultHeaders,
          ...options.headers
        };

        if (this.csrfToken && options.csrf !== false) {
          headers['x-csrf-token'] = this.csrfToken;
        }

        const response = await fetch(this.buildURL(endpoint), {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
          credentials: options.credentials || 'same-origin'
        });

        const result = await this.handleResponse(response);
        
        if (spinner) this.hideLoading(spinner);
        
        if (options.showSuccess && result.message) {
          this.showSuccess(result.message);
        }

        return result;
      } catch (error) {
        if (spinner) this.hideLoading(spinner);
        
        if (options.showError !== false) {
          this.showError(error.message);
        }
        throw error;
      }
    }

    /**
     * Perform PUT request
     */
    async put(endpoint, data = {}, options = {}) {
      const spinner = options.showLoading !== false ? this.showLoading(options.loadingMessage) : null;
      
      try {
        // Get CSRF token if needed
        if (options.csrf !== false) {
          await this.initCSRF();
        }

        const headers = {
          ...this.defaultHeaders,
          ...options.headers
        };

        if (this.csrfToken && options.csrf !== false) {
          headers['x-csrf-token'] = this.csrfToken;
        }

        const response = await fetch(this.buildURL(endpoint), {
          method: 'PUT',
          headers,
          body: JSON.stringify(data),
          credentials: options.credentials || 'same-origin'
        });

        const result = await this.handleResponse(response);
        
        if (spinner) this.hideLoading(spinner);
        
        if (options.showSuccess && result.message) {
          this.showSuccess(result.message);
        }

        return result;
      } catch (error) {
        if (spinner) this.hideLoading(spinner);
        
        if (options.showError !== false) {
          this.showError(error.message);
        }
        throw error;
      }
    }

    /**
     * Perform DELETE request
     */
    async delete(endpoint, options = {}) {
      const spinner = options.showLoading !== false ? this.showLoading(options.loadingMessage) : null;
      
      try {
        // Get CSRF token if needed
        if (options.csrf !== false) {
          await this.initCSRF();
        }

        const headers = {
          ...this.defaultHeaders,
          ...options.headers
        };

        if (this.csrfToken && options.csrf !== false) {
          headers['x-csrf-token'] = this.csrfToken;
        }

        const response = await fetch(this.buildURL(endpoint), {
          method: 'DELETE',
          headers,
          credentials: options.credentials || 'same-origin'
        });

        const result = await this.handleResponse(response);
        
        if (spinner) this.hideLoading(spinner);
        
        if (options.showSuccess && result.message) {
          this.showSuccess(result.message);
        }

        return result;
      } catch (error) {
        if (spinner) this.hideLoading(spinner);
        
        if (options.showError !== false) {
          this.showError(error.message);
        }
        throw error;
      }
    }

    /**
     * Perform file upload
     */
    async upload(endpoint, file, additionalData = {}, options = {}) {
      const spinner = options.showLoading !== false ? 
        this.showLoading(options.loadingMessage || 'Uploading...') : null;
      
      try {
        // Get CSRF token if needed
        if (options.csrf !== false) {
          await this.initCSRF();
        }

        const formData = new FormData();
        formData.append('file', file);
        
        // Add additional data to form
        Object.keys(additionalData).forEach(key => {
          formData.append(key, additionalData[key]);
        });

        const headers = {
          ...options.headers
        };

        if (this.csrfToken && options.csrf !== false) {
          headers['x-csrf-token'] = this.csrfToken;
        }

        const response = await fetch(this.buildURL(endpoint), {
          method: 'POST',
          headers,
          body: formData,
          credentials: options.credentials || 'same-origin'
        });

        const result = await this.handleResponse(response);
        
        if (spinner) this.hideLoading(spinner);
        
        if (options.showSuccess && result.message) {
          this.showSuccess(result.message);
        }

        return result;
      } catch (error) {
        if (spinner) this.hideLoading(spinner);
        
        if (options.showError !== false) {
          this.showError(error.message);
        }
        throw error;
      }
    }

    /**
     * Submit form data
     */
    async submitForm(endpoint, formElement, options = {}) {
      const formData = new FormData(formElement);
      const data = {};
      
      // Convert FormData to object
      formData.forEach((value, key) => {
        // Handle multiple values with same name (like checkboxes)
        if (data[key]) {
          if (!Array.isArray(data[key])) {
            data[key] = [data[key]];
          }
          data[key].push(value);
        } else {
          data[key] = value;
        }
      });

      return this.post(endpoint, data, options);
    }

    /**
     * Perform paginated request
     */
    async getPaginated(endpoint, page = 1, limit = 10, filters = {}, options = {}) {
      const params = new URLSearchParams({
        page,
        limit,
        ...filters
      });

      const url = `${endpoint}?${params.toString()}`;
      return this.get(url, options);
    }

    /**
     * Poll an endpoint until condition is met
     */
    async poll(endpoint, checkFn, options = {}) {
      const {
        interval = 2000,
        maxAttempts = 30,
        showError = false
      } = options;

      let attempts = 0;

      return new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
          attempts++;

          try {
            const result = await this.get(endpoint, { showError: false });
            
            if (checkFn(result)) {
              clearInterval(pollInterval);
              resolve(result);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              const error = new Error('Polling timeout exceeded');
              if (showError) this.showError(error.message);
              reject(error);
            }
          } catch (error) {
            clearInterval(pollInterval);
            if (showError) this.showError(error.message);
            reject(error);
          }
        }, interval);
      });
    }

    /**
     * Batch multiple requests
     */
    async batch(requests, options = {}) {
      const { 
        showLoading = true, 
        showError = true,
        parallel = true 
      } = options;

      const spinner = showLoading ? this.showLoading('Processing...') : null;

      try {
        let results;
        
        if (parallel) {
          // Execute all requests in parallel
          results = await Promise.all(
            requests.map(req => this[req.method](req.endpoint, req.data, { 
              ...req.options, 
              showError: false, 
              showLoading: false 
            }))
          );
        } else {
          // Execute requests sequentially
          results = [];
          for (const req of requests) {
            const result = await this[req.method](req.endpoint, req.data, { 
              ...req.options, 
              showError: false, 
              showLoading: false 
            });
            results.push(result);
          }
        }

        if (spinner) this.hideLoading(spinner);
        return results;
      } catch (error) {
        if (spinner) this.hideLoading(spinner);
        if (showError) this.showError(error.message);
        throw error;
      }
    }

    /**
     * Retry failed requests
     */
    async retry(fn, options = {}) {
      const {
        maxRetries = 3,
        delay = 1000,
        backoff = 2
      } = options;

      let lastError;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          
          if (attempt < maxRetries - 1) {
            // Wait before retrying (exponential backoff)
            const waitTime = delay * Math.pow(backoff, attempt);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      throw lastError;
    }
  }

  // Create singleton instance
  const apiClient = new ApiClient();

  // Expose to global scope
  window.ApiClient = apiClient;
  
  // Also expose the class for creating new instances if needed
  window.ApiClientClass = ApiClient;

})(window);