/**
 * Service Area Autocomplete
 * Provides autocomplete functionality for city and zip code fields
 * with validation against service area restrictions
 */

(function() {
  'use strict';

  // Cache for service area data
  let serviceAreaData = null;
  let serviceConfig = null;
  let awesompleteInstances = {};

  // Initialize service area autocomplete
  async function initServiceAreaAutocomplete() {
    console.log('Initializing service area autocomplete...');
    try {
      // Get base URL from embed config or default
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      console.log('Using base URL:', baseUrl);
      
      // Fetch service area config
      console.log('Fetching service area config...');
      const configResponse = await fetch(`${baseUrl}/api/v1/service-area/config`);
      const configData = await configResponse.json();
      console.log('Config response:', configData);
      
      if (configData.success) {
        serviceConfig = configData.config;
        
        // Set state field to service state and make it read-only
        setupStateField(serviceConfig.state);
      }

      // Fetch autocomplete data
      const response = await fetch(`${baseUrl}/api/v1/service-area/autocomplete`);
      const data = await response.json();
      
      if (data.success) {
        serviceAreaData = data.data;
        
        // Setup autocomplete for city and zip fields
        setupCityAutocomplete();
        setupZipAutocomplete();
        
        // Setup field interaction
        setupFieldInteraction();
      } else {
        console.error('Failed to load service area data');
      }
    } catch (error) {
      console.error('Error initializing service area autocomplete:', error);
    }
  }

  // Setup state field as read-only with service state
  function setupStateField(serviceState) {
    console.log('Setting up state fields with value:', serviceState);
    const stateFields = document.querySelectorAll('input[name="state"], input#state');
    console.log('Found state fields:', stateFields.length);
    
    stateFields.forEach(field => {
      console.log('Setting field:', field.id || field.name, 'to', serviceState);
      field.value = serviceState;
      field.readOnly = true;
      field.style.backgroundColor = '#f3f4f6'; // Light gray background
      field.style.cursor = 'not-allowed';
      
      // Add a title for clarity
      field.title = `Service is limited to ${serviceState}`;
    });
  }

  // Setup city autocomplete
  function setupCityAutocomplete() {
    const cityFields = document.querySelectorAll('input[name="city"], input#city');
    
    cityFields.forEach(field => {
      if (!serviceAreaData || !serviceAreaData.cities) return;
      
      // Create Awesomplete instance
      const awesomplete = new Awesomplete(field, {
        list: serviceAreaData.cities,
        minChars: 1,
        maxItems: 10,
        autoFirst: true,
        sort: function(a, b) {
          // Sort alphabetically
          return a.value.localeCompare(b.value);
        }
      });
      
      // Store instance for later use
      awesompleteInstances[field.id || field.name] = awesomplete;
      
      // Add validation styling
      field.addEventListener('awesomplete-selectcomplete', function() {
        validateCityField(field);
        // Auto-populate zip if only one zip for this city
        autoPopulateZip(field.value);
      });
      
      // Validate on blur
      field.addEventListener('blur', function() {
        validateCityField(field);
      });
    });
  }

  // Setup zip code autocomplete
  function setupZipAutocomplete() {
    const zipFields = document.querySelectorAll('input[name="zipCode"], input#zipCode');
    
    zipFields.forEach(field => {
      if (!serviceAreaData || !serviceAreaData.zipCodes) return;
      
      // Create Awesomplete instance
      const awesomplete = new Awesomplete(field, {
        list: serviceAreaData.zipCodes,
        minChars: 1,
        maxItems: 10,
        autoFirst: true
      });
      
      // Store instance for later use
      awesompleteInstances[field.id || field.name] = awesomplete;
      
      // Add validation styling
      field.addEventListener('awesomplete-selectcomplete', function() {
        validateZipField(field);
        // Auto-populate city for this zip
        autoPopulateCity(field.value);
      });
      
      // Validate on blur
      field.addEventListener('blur', function() {
        validateZipField(field);
      });
      
      // Format zip code as user types
      field.addEventListener('input', function() {
        // Remove non-digits
        this.value = this.value.replace(/\D/g, '');
        // Limit to 5 digits
        if (this.value.length > 5) {
          this.value = this.value.substr(0, 5);
        }
      });
    });
  }

  // Setup interaction between city and zip fields
  function setupFieldInteraction() {
    // When city changes, filter zip codes
    const cityFields = document.querySelectorAll('input[name="city"], input#city');
    cityFields.forEach(field => {
      field.addEventListener('input', function() {
        if (this.value.length >= 2) {
          updateZipAutocompleteForCity(this.value);
        }
      });
    });
  }

  // Validate city field
  function validateCityField(field) {
    const value = field.value.trim();
    
    if (!value) {
      removeValidationStyles(field);
      return;
    }
    
    if (serviceAreaData && serviceAreaData.cities) {
      const isValid = serviceAreaData.cities.some(city => 
        city.toLowerCase() === value.toLowerCase()
      );
      
      if (isValid) {
        showValidField(field);
      } else {
        showInvalidField(field, 'City not in service area');
      }
    }
  }

  // Validate zip field
  function validateZipField(field) {
    const value = field.value.trim();
    
    if (!value) {
      removeValidationStyles(field);
      return;
    }
    
    // Check format
    if (!/^\d{5}$/.test(value)) {
      showInvalidField(field, 'ZIP code must be 5 digits');
      return;
    }
    
    if (serviceAreaData && serviceAreaData.zipCodes) {
      const isValid = serviceAreaData.zipCodes.includes(value);
      
      if (isValid) {
        showValidField(field);
      } else {
        showInvalidField(field, 'ZIP code not in service area');
      }
    }
  }

  // Auto-populate city based on zip code
  async function autoPopulateCity(zipCode) {
    try {
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      const response = await fetch(`${baseUrl}/api/v1/service-area/city/${zipCode}`);
      const data = await response.json();
      
      if (data.success && data.city) {
        const cityFields = document.querySelectorAll('input[name="city"], input#city');
        cityFields.forEach(field => {
          field.value = data.city;
          validateCityField(field);
        });
      }
    } catch (error) {
      console.error('Error fetching city for zip:', error);
    }
  }

  // Auto-populate zip if city has only one zip code
  async function autoPopulateZip(city) {
    try {
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      const response = await fetch(`${baseUrl}/api/v1/service-area/zip-codes/${encodeURIComponent(city)}`);
      const data = await response.json();
      
      if (data.success && data.zipCodes && data.zipCodes.length === 1) {
        const zipFields = document.querySelectorAll('input[name="zipCode"], input#zipCode');
        zipFields.forEach(field => {
          field.value = data.zipCodes[0];
          validateZipField(field);
        });
      } else if (data.success && data.zipCodes) {
        // Update zip autocomplete with filtered list
        updateZipAutocompleteList(data.zipCodes);
      }
    } catch (error) {
      console.error('Error fetching zip codes for city:', error);
    }
  }

  // Update zip autocomplete list based on selected city
  function updateZipAutocompleteForCity(city) {
    // This would require fetching zip codes for the city
    // For now, we'll keep the full list
  }

  // Update zip autocomplete list
  function updateZipAutocompleteList(zipCodes) {
    const zipField = document.querySelector('input#zipCode');
    if (zipField && awesompleteInstances['zipCode']) {
      awesompleteInstances['zipCode'].list = zipCodes;
    }
  }

  // Show field as valid
  function showValidField(field) {
    field.classList.remove('border-red-500');
    field.classList.add('border-green-500');
    removeErrorMessage(field);
  }

  // Show field as invalid
  function showInvalidField(field, message) {
    field.classList.remove('border-green-500');
    field.classList.add('border-red-500');
    showErrorMessage(field, message);
  }

  // Remove validation styles
  function removeValidationStyles(field) {
    field.classList.remove('border-green-500', 'border-red-500');
    removeErrorMessage(field);
  }

  // Show error message
  function showErrorMessage(field, message) {
    removeErrorMessage(field);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-red-600 text-sm mt-1 service-area-error';
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
  }

  // Remove error message
  function removeErrorMessage(field) {
    const existingError = field.parentNode.querySelector('.service-area-error');
    if (existingError) {
      existingError.remove();
    }
  }

  // Export functions for external use
  window.ServiceAreaAutocomplete = {
    init: initServiceAreaAutocomplete,
    validateCity: validateCityField,
    validateZip: validateZipField,
    getServiceConfig: () => serviceConfig,
    getServiceAreaData: () => serviceAreaData
  };

  // Auto-initialize if Awesomplete is loaded
  function tryInit() {
    console.log('ServiceAreaAutocomplete tryInit called, Awesomplete available:', !!window.Awesomplete);
    if (window.Awesomplete) {
      initServiceAreaAutocomplete();
    } else {
      // Wait for Awesomplete to load
      console.log('Waiting for Awesomplete to load...');
      setTimeout(tryInit, 100);
    }
  }
  
  console.log('ServiceAreaAutocomplete script loaded, document ready state:', document.readyState);
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }

})();