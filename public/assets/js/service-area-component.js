/**
 * Service Area Component for WaveMAX Affiliate Program
 * Reusable component for displaying and editing service area with map
 */

(function() {
  'use strict';

  // Component state
  let components = {};

  /**
   * Initialize a service area component
   * @param {string} containerId - The ID of the container element
   * @param {Object} options - Configuration options
   * @returns {Object} Component instance
   */
  function initServiceArea(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with ID "${containerId}" not found`);
      return null;
    }

    console.log('[ServiceAreaComponent] Init called with options:', options);

    // Default options
    const config = {
      editable: true,
      showMap: true,
      showControls: true,
      showInfo: true,
      latitude: options.latitude || 30.3524, // Default to Austin
      longitude: options.longitude || -97.6841,
      radius: options.radius || 5,
      address: options.address || '',
      onUpdate: options.onUpdate || null,
      readOnly: options.readOnly || false,
      registrationAddress: options.registrationAddress || null,
      registrationLat: options.registrationLat || null,
      registrationLng: options.registrationLng || null,
      ...options
    };

    console.log('[ServiceAreaComponent] Final config:', config);

    // Create the HTML structure
    const html = `
      <div class="service-area-component">
        ${config.showMap ? `
          <div class="grid md:grid-cols-2 gap-6">
            <!-- Left side: Map -->
            <div class="flex flex-col service-area-container">
              <div id="${containerId}-map" class="rounded-lg border border-gray-300 flex-grow service-area-map"></div>
            </div>
            
            <!-- Right side: Controls and instructions -->
            <div class="space-y-4">
              ${config.editable && !config.readOnly ? `
                <!-- Instructions -->
                <div class="bg-gray-50 p-4 rounded-lg">
                  <h4 class="font-semibold text-gray-800 mb-2" data-i18n="affiliate.register.serviceAreaInstructions">How to Set Your Service Area</h4>
                  <ol class="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li data-i18n="affiliate.register.serviceAreaStep1">Click on the map to set your service center location</li>
                    <li data-i18n="affiliate.register.serviceAreaStep2">Drag the marker to adjust its position if needed</li>
                    <li data-i18n="affiliate.register.serviceAreaStep3">Use the slider below to set your service radius</li>
                  </ol>
                </div>
              ` : ''}
              
              ${config.showControls ? `
                <!-- Radius slider -->
                <div class="bg-white p-4 rounded-lg border border-gray-200">
                  <label for="${containerId}-radiusSlider" class="block text-gray-700 mb-3 font-medium">
                    <span data-i18n="affiliate.register.serviceRadius">Service Radius:</span> 
                    <span id="${containerId}-radiusValue" class="text-xl font-bold text-blue-600">${config.radius}</span> 
                    <span data-i18n="affiliate.register.miles">miles</span>
                  </label>
                  <input type="range" 
                         id="${containerId}-radiusSlider" 
                         min="1" 
                         max="50" 
                         value="${config.radius}" 
                         step="1"
                         ${config.readOnly ? 'disabled' : ''}
                         class="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider">
                  <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 mi</span>
                    <span>25 mi</span>
                    <span>50 mi</span>
                  </div>
                </div>
              ` : ''}
              
              ${config.showInfo ? `
                <!-- Service Area Details -->
                <div id="${containerId}-info" class="service-area-info bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 class="font-semibold text-gray-800 mb-3" data-i18n="affiliate.register.serviceAreaDetails">Service Area Details</h4>
                  <div class="grid md:grid-cols-2 gap-4">
                    <!-- Left column: Details -->
                    <div class="text-sm space-y-2">
                      <div>
                        <span class="text-gray-600" data-i18n="affiliate.register.serviceCenter">Service Center:</span>
                        <div id="${containerId}-centerLocation" class="text-gray-800 font-medium mt-1">${config.address || 'Click on map to set location'}</div>
                      </div>
                      <div>
                        <span class="text-gray-600" data-i18n="affiliate.register.coordinates">Coordinates:</span>
                        <div id="${containerId}-centerCoordinates" class="text-gray-800 font-mono text-xs mt-1">${config.latitude.toFixed(6)}, ${config.longitude.toFixed(6)}</div>
                      </div>
                      <div>
                        <span class="text-gray-600" data-i18n="affiliate.register.coverageArea">Coverage Area:</span>
                        <div id="${containerId}-coverageArea" class="text-gray-800 font-medium mt-1">${config.radius} mile radius</div>
                      </div>
                    </div>
                    <!-- Right column: Use Registration Address button -->
                    <div class="flex items-start justify-end">
                      ${config.registrationAddress ? `
                        <button type="button" 
                                id="${containerId}-useRegistrationBtn"
                                class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                          <span data-i18n="affiliate.register.useRegistrationAddress">Use Registration Address</span>
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : config.showInfo ? `
          <!-- Service Area Info only (no map) -->
          <div id="${containerId}-info" class="service-area-info bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-800 mb-2" data-i18n="affiliate.register.serviceAreaDetails">Service Area Details</h4>
            <div class="text-sm text-gray-700 space-y-2">
              <div>
                <strong data-i18n="affiliate.register.serviceCenter">Service Center:</strong>
                <div id="${containerId}-centerLocation" class="text-gray-600 mt-1">${config.address || 'Not set'}</div>
              </div>
              <div>
                <strong data-i18n="affiliate.register.coordinates">Coordinates:</strong>
                <div id="${containerId}-centerCoordinates" class="text-gray-600 mt-1">${config.latitude.toFixed(6)}, ${config.longitude.toFixed(6)}</div>
              </div>
              <div>
                <strong data-i18n="affiliate.register.coverageArea">Coverage Area:</strong>
                <div id="${containerId}-coverageArea" class="text-gray-600 mt-1">${config.radius} mile radius</div>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Hidden fields for form submission -->
        <input type="hidden" id="${containerId}-latitude" name="serviceLatitude" value="${config.latitude}">
        <input type="hidden" id="${containerId}-longitude" name="serviceLongitude" value="${config.longitude}">
        <input type="hidden" id="${containerId}-radius" name="serviceRadius" value="${config.radius}">
      </div>
    `;

    container.innerHTML = html;

    // Initialize i18n for the new elements if available
    if (window.i18n && window.i18n.translateElement) {
      window.i18n.translateElement(container);
    }

    // Component instance
    const component = {
      container: container,
      config: config,
      map: null,
      marker: null,
      circle: null,
      initialized: false
    };

    // Initialize map if needed
    if (config.showMap) {
      initializeMap(component);
    }

    // Add event handler for "Use Registration Address" button
    const useRegistrationBtn = document.getElementById(`${containerId}-useRegistrationBtn`);
    if (useRegistrationBtn && config.registrationLat && config.registrationLng) {
      useRegistrationBtn.addEventListener('click', function() {
        // Update service area to registration address
        updateServiceArea(component, config.registrationLat, config.registrationLng, component.config.radius);

        // If registration address is provided, update the address display immediately
        if (config.registrationAddress) {
          const locationElement = document.getElementById(`${containerId}-centerLocation`);
          if (locationElement) {
            locationElement.textContent = config.registrationAddress;
            component.config.address = config.registrationAddress;
          }
        }
      });
    }

    // Store component instance
    components[containerId] = component;

    return component;
  }

  /**
   * Initialize the Leaflet map
   * @param {Object} component - The component instance
   */
  function initializeMap(component) {
    const mapContainer = document.getElementById(`${component.container.id}-map`);
    if (!mapContainer) {
      console.error('Map container not found');
      return;
    }

    // Check if Leaflet is available
    if (typeof L === 'undefined') {
      console.log('Leaflet not available, loading it dynamically...');

      // Check if we're already loading Leaflet
      if (window.leafletLoading) {
        console.log('Leaflet is already being loaded, waiting...');
        setTimeout(() => initializeMap(component), 500);
        return;
      }

      // Mark that we're loading Leaflet
      window.leafletLoading = true;

      // Check if Leaflet CSS is loaded
      if (!document.querySelector('link[href*="leaflet"]')) {
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        leafletCSS.crossOrigin = 'anonymous';
        document.head.appendChild(leafletCSS);
        console.log('Added Leaflet CSS');
      }

      // Check if Leaflet JS is being loaded
      if (!document.querySelector('script[src*="leaflet"]')) {
        const leafletJS = document.createElement('script');
        leafletJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        leafletJS.crossOrigin = 'anonymous';
        leafletJS.onload = function() {
          console.log('Leaflet loaded successfully');
          window.leafletLoading = false;
          // Try to initialize map again
          initializeMap(component);
        };
        leafletJS.onerror = function() {
          console.error('Failed to load Leaflet');
          window.leafletLoading = false;
        };
        document.head.appendChild(leafletJS);
        console.log('Loading Leaflet JS...');
      } else {
        // Script tag exists, just wait a bit more
        setTimeout(() => initializeMap(component), 500);
      }
      return;
    }

    try {
      console.log('[ServiceAreaComponent] Initializing map with center:', component.config.latitude, component.config.longitude);

      // Calculate initial zoom level based on radius
      const radiusInKm = component.config.radius * 1.60934;
      let initialZoom = 12;
      if (radiusInKm <= 5) initialZoom = 13;
      else if (radiusInKm <= 10) initialZoom = 12;
      else if (radiusInKm <= 20) initialZoom = 11;
      else if (radiusInKm <= 40) initialZoom = 10;
      else if (radiusInKm <= 80) initialZoom = 9;
      else initialZoom = 8;

      // Initialize map
      component.map = L.map(mapContainer).setView([component.config.latitude, component.config.longitude], initialZoom);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(component.map);

      // Add marker and circle
      updateMapDisplay(component);

      // Handle map click if editable
      if (component.config.editable && !component.config.readOnly) {
        component.map.on('click', function(e) {
          updateServiceArea(component, e.latlng.lat, e.latlng.lng, component.config.radius);
        });
      }

      // Handle radius slider if present
      const radiusSlider = document.getElementById(`${component.container.id}-radiusSlider`);
      if (radiusSlider && !component.config.readOnly) {
        radiusSlider.addEventListener('input', function() {
          const radius = parseInt(this.value);
          document.getElementById(`${component.container.id}-radiusValue`).textContent = radius;

          if (component.marker) {
            const position = component.marker.getLatLng();
            updateServiceArea(component, position.lat, position.lng, radius);
          }
        });
      }

      component.initialized = true;
      console.log('Service area map initialized successfully');
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  /**
   * Update the map display with marker and circle
   * @param {Object} component - The component instance
   */
  function updateMapDisplay(component) {
    if (!component.map) return;

    // Remove existing marker and circle
    if (component.marker) {
      component.map.removeLayer(component.marker);
    }
    if (component.circle) {
      component.map.removeLayer(component.circle);
    }

    // Add new marker
    component.marker = L.marker([component.config.latitude, component.config.longitude], {
      title: 'Service Center',
      draggable: component.config.editable && !component.config.readOnly
    }).addTo(component.map);

    // Add circle to show service area
    component.circle = L.circle([component.config.latitude, component.config.longitude], {
      color: '#3b82f6',
      fillColor: '#93c5fd',
      fillOpacity: 0.3,
      radius: component.config.radius * 1609.34 // Convert miles to meters
    }).addTo(component.map);

    // Handle marker drag if editable
    if (component.config.editable && !component.config.readOnly) {
      component.marker.on('dragend', function(event) {
        const position = event.target.getLatLng();
        updateServiceArea(component, position.lat, position.lng, component.config.radius);
      });
    }

    // Calculate appropriate zoom level based on radius
    // This ensures the service area circle is visible while keeping the center point
    const radiusInKm = component.config.radius * 1.60934;
    let zoomLevel = 12; // Default zoom

    // Adjust zoom based on radius
    if (radiusInKm <= 5) zoomLevel = 13;
    else if (radiusInKm <= 10) zoomLevel = 12;
    else if (radiusInKm <= 20) zoomLevel = 11;
    else if (radiusInKm <= 40) zoomLevel = 10;
    else if (radiusInKm <= 80) zoomLevel = 9;
    else zoomLevel = 8;

    // Set the view to center on the registration address with appropriate zoom
    component.map.setView([component.config.latitude, component.config.longitude], zoomLevel);
  }

  /**
   * Update service area with new coordinates and radius
   * @param {Object} component - The component instance
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radius - Radius in miles
   */
  function updateServiceArea(component, lat, lng, radius) {
    // Check if coordinates have actually changed
    const coordsChanged = (
      Math.abs(component.config.latitude - lat) > 0.000001 ||
      Math.abs(component.config.longitude - lng) > 0.000001
    );

    // Update config
    component.config.latitude = lat;
    component.config.longitude = lng;
    component.config.radius = radius;

    // Update hidden fields
    document.getElementById(`${component.container.id}-latitude`).value = lat.toFixed(6);
    document.getElementById(`${component.container.id}-longitude`).value = lng.toFixed(6);
    document.getElementById(`${component.container.id}-radius`).value = radius;

    // Update display
    if (component.config.showInfo) {
      const coordsElement = document.getElementById(`${component.container.id}-centerCoordinates`);
      if (coordsElement) {
        coordsElement.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      const coverageElement = document.getElementById(`${component.container.id}-coverageArea`);
      if (coverageElement) {
        coverageElement.textContent = `${radius} mile radius`;
      }
    }

    // Update map display
    updateMapDisplay(component);

    // Only reverse geocode if coordinates have changed
    // This prevents address from changing when only radius is adjusted
    if (coordsChanged) {
      reverseGeocodeLocation(component, lat, lng);
    }

    // Call update callback if provided
    if (component.config.onUpdate) {
      component.config.onUpdate({
        latitude: lat,
        longitude: lng,
        radius: radius,
        address: component.config.address
      });
    }
  }

  /**
   * Reverse geocode location to get address
   * @param {Object} component - The component instance
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   */
  function reverseGeocodeLocation(component, lat, lng) {
    const locationElement = document.getElementById(`${component.container.id}-centerLocation`);
    if (!locationElement) return;

    locationElement.textContent = 'Loading address...';

    // Check if we're in an iframe
    if (window.parent !== window) {
      // Use bridge method
      const requestId = 'service_area_' + Date.now();

      window.parent.postMessage({
        type: 'geocode-reverse',
        data: { lat, lng, requestId }
      }, '*');

      // Set up one-time handler
      const handleResponse = function(event) {
        if (event.data && event.data.type === 'geocode-reverse-response' &&
            event.data.data && event.data.data.requestId === requestId) {

          if (event.data.data.address) {
            const formattedAddress = formatAddress(event.data.data.address);
            locationElement.textContent = formattedAddress;
            component.config.address = formattedAddress;
          } else {
            locationElement.textContent = 'Address not found';
          }

          window.removeEventListener('message', handleResponse);
        }
      };

      window.addEventListener('message', handleResponse);
    } else {
      // Direct Nominatim call
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`)
        .then(response => response.json())
        .then(data => {
          if (data.display_name) {
            const formattedAddress = formatAddress(data.display_name);
            locationElement.textContent = formattedAddress;
            component.config.address = formattedAddress;
          } else {
            locationElement.textContent = 'Address not found';
          }
        })
        .catch(error => {
          console.error('Reverse geocoding error:', error);
          locationElement.textContent = 'Address lookup failed';
        });
    }
  }

  /**
   * Format address from Nominatim response
   * @param {string} displayName - The display name from Nominatim
   * @returns {string} Formatted address
   */
  function formatAddress(displayName) {
    const parts = displayName.split(',').map(p => p.trim());
    let street = '', city = '', state = '', zipcode = '';

    // Parse address components
    if (parts.length >= 2) {
      if (parts[0].match(/^\d+$/)) {
        street = parts[0] + ' ' + parts[1];
        for (let i = 2; i < parts.length; i++) {
          const part = parts[i];
          if (part.match(/^[A-Z]{2}$/)) {
            state = part;
          } else if (part.match(/\d{5}/)) {
            zipcode = part.match(/\d{5}/)[0];
          } else if (!city && !state && !part.match(/USA|United States|county|township/i)) {
            city = part;
          }
        }
      } else {
        street = parts[0];
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (part.match(/^[A-Z]{2}$/)) {
            state = part;
          } else if (part.match(/\d{5}/)) {
            zipcode = part.match(/\d{5}/)[0];
          } else if (!city && !state && !part.match(/USA|United States|county|township/i)) {
            city = part;
          }
        }
      }
    }

    // Build formatted address
    let formatted = street;
    if (city) formatted += ', ' + city;
    if (state) {
      formatted += ', ' + state;
      if (zipcode) formatted += ' ' + zipcode;
    }

    return formatted || parts.slice(0, 3).join(', ');
  }

  /**
   * Update component with new data
   * @param {string} containerId - The container ID
   * @param {Object} data - New data for the component
   */
  function updateComponent(containerId, data) {
    const component = components[containerId];
    if (!component) {
      console.error(`Component with ID "${containerId}" not found`);
      return;
    }

    // Update config
    if (data.latitude !== undefined) component.config.latitude = data.latitude;
    if (data.longitude !== undefined) component.config.longitude = data.longitude;
    if (data.radius !== undefined) component.config.radius = data.radius;
    if (data.address !== undefined) component.config.address = data.address;
    if (data.readOnly !== undefined) component.config.readOnly = data.readOnly;
    if (data.showMap !== undefined) component.config.showMap = data.showMap;
    if (data.showControls !== undefined) component.config.showControls = data.showControls;

    // Handle visibility changes
    if (data.showMap !== undefined || data.showControls !== undefined) {
      // Re-render the component with new visibility settings
      const container = component.container;
      component.config = { ...component.config, ...data };

      // Reinitialize the component
      const newComponent = initServiceArea(containerId, component.config);
      if (newComponent) {
        // Copy over the old component state
        components[containerId] = newComponent;
      }
      return;
    }

    // Update display
    if (component.initialized) {
      updateServiceArea(component, component.config.latitude, component.config.longitude, component.config.radius);
    }

    // Update controls
    const radiusSlider = document.getElementById(`${containerId}-radiusSlider`);
    if (radiusSlider) {
      radiusSlider.value = component.config.radius;
      radiusSlider.disabled = component.config.readOnly;
    }

    // Update marker draggability
    if (component.marker) {
      if (component.config.readOnly) {
        component.marker.dragging.disable();
      } else {
        component.marker.dragging.enable();
      }
    }
  }

  /**
   * Get current service area data
   * @param {string} containerId - The container ID
   * @returns {Object} Current service area data
   */
  function getServiceAreaData(containerId) {
    const component = components[containerId];
    if (!component) {
      console.error(`Component with ID "${containerId}" not found`);
      return null;
    }

    return {
      latitude: component.config.latitude,
      longitude: component.config.longitude,
      radius: component.config.radius,
      address: component.config.address
    };
  }

  /**
   * Set read-only mode
   * @param {string} containerId - The container ID
   * @param {boolean} readOnly - Whether to enable read-only mode
   */
  function setReadOnly(containerId, readOnly) {
    updateComponent(containerId, { readOnly });
  }

  // Export to global scope
  window.ServiceAreaComponent = {
    init: initServiceArea,
    update: updateComponent,
    getData: getServiceAreaData,
    setReadOnly: setReadOnly
  };

})();