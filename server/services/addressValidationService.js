/**
 * Address Validation Service
 * Provides unified address validation and geocoding for all registration forms
 * Requires complete street address with zip code for validation
 */

const axios = require('axios');

class AddressValidationService {
  constructor() {
    this.nominatimUrl = 'https://nominatim.openstreetmap.org';
    this.userAgent = 'WaveMAX Laundry Application';
  }

  /**
   * Validate and geocode an address
   * Requires complete street address including house number, street name, and zip code
   * @param {Object} addressData - Contains address, city, state, zipCode
   * @returns {Promise<Object>} Validation result with coordinates
   */
  async validateAddress(addressData) {
    const { address, city, state, zipCode } = addressData;
    
    console.log('[AddressValidationService] Validating address:', addressData);
    
    // Step 1: Validate all required fields are present
    if (!address || !city || !state || !zipCode) {
      return {
        valid: false,
        message: 'All address fields are required (street address, city, state, zip code)'
      };
    }

    // Step 2: Validate address format
    const addressValidation = this.validateAddressFormat(address);
    if (!addressValidation.valid) {
      return addressValidation;
    }

    // Step 3: Validate zip code format
    if (!/^\d{5}$/.test(zipCode)) {
      return {
        valid: false,
        message: 'ZIP code must be exactly 5 digits'
      };
    }

    // Step 4: Geocode the address - try two strategies
    // First try the full address, then try with just street and zip if needed
    let results = [];
    
    try {
      // Strategy 1: Try with full address including city
      const fullQuery = `${address}, ${city}, ${state} ${zipCode}, USA`;
      console.log('[AddressValidationService] Trying full geocoding query:', fullQuery);
      
      let response = await axios.get(`${this.nominatimUrl}/search`, {
        params: {
          format: 'json',
          q: fullQuery,
          limit: 1,
          countrycodes: 'us',
          addressdetails: 1
        },
        headers: {
          'User-Agent': this.userAgent
        }
      });

      results = response.data;
      
      // Strategy 2: If no results, try with just street address and zip code
      // This handles cases where Nominatim has different city boundaries
      if (!results || results.length === 0) {
        const simpleQuery = `${address} ${zipCode}`;
        console.log('[AddressValidationService] Trying simplified query:', simpleQuery);
        
        response = await axios.get(`${this.nominatimUrl}/search`, {
          params: {
            format: 'json',
            q: simpleQuery,
            limit: 1,
            countrycodes: 'us',
            addressdetails: 1
          },
          headers: {
            'User-Agent': this.userAgent
          }
        });
        
        results = response.data;
      }
      
      if (!results || results.length === 0) {
        return {
          valid: false,
          message: 'Unable to verify this address. Please check that the street address and zip code are correct.'
        };
      }

      const result = results[0];
      
      // Verify the result matches the provided zip code
      const resultZip = result.address?.postcode;
      if (resultZip && resultZip !== zipCode) {
        console.log(`[AddressValidationService] ZIP code mismatch: expected ${zipCode}, got ${resultZip}`);
        
        // Check if both ZIP codes are in the same general area (first 3 digits)
        // This handles cases where addresses are on ZIP code boundaries or OpenStreetMap has slightly different data
        const inputZipPrefix = zipCode.substring(0, 3);
        const resultZipPrefix = resultZip.substring(0, 3);
        
        if (inputZipPrefix !== resultZipPrefix) {
          return {
            valid: false,
            message: 'The address does not match the provided zip code. Please verify your address.'
          };
        }
        
        // If ZIP codes are in the same general area, log a warning but allow it
        console.log(`[AddressValidationService] ZIP codes are in same area (${inputZipPrefix}xxx), allowing validation`);
      }
      
      // Also verify the house number matches
      const resultHouseNumber = result.address?.house_number;
      const inputHouseNumber = address.match(/^(\d+[A-Za-z]?)/)?.[1];
      if (resultHouseNumber && inputHouseNumber && resultHouseNumber !== inputHouseNumber) {
        console.log(`[AddressValidationService] House number mismatch: expected ${inputHouseNumber}, got ${resultHouseNumber}`);
        return {
          valid: false,
          message: 'Unable to verify this exact address. Please check the house number.'
        };
      }

      // Success - return the coordinates
      return {
        valid: true,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        formattedAddress: this.formatAddress(addressData)
      };

    } catch (error) {
      console.error('[AddressValidationService] Geocoding error:', error);
      
      // Check if it's a rate limit error
      if (error.response && error.response.status === 429) {
        return {
          valid: false,
          message: 'Too many address validation requests. Please try again in a moment.'
        };
      }
      
      return {
        valid: false,
        message: 'Unable to validate address at this time. Please try again.'
      };
    }
  }

  /**
   * Validate address format before geocoding
   * @param {string} address - The street address to validate
   * @returns {Object} Validation result
   */
  validateAddressFormat(address) {
    // Basic format validation
    if (!address || address.trim().length < 5) {
      return {
        valid: false,
        message: 'Please enter a valid street address'
      };
    }
    
    // Must start with a house number (digits, optionally followed by a single letter)
    const addressPattern = /^(\d+[A-Za-z]?)\s+(.+)$/;
    const match = address.trim().match(addressPattern);
    
    if (!match) {
      return {
        valid: false,
        message: 'Address must start with a house number (e.g., 123 Main Street)'
      };
    }
    
    const houseNumber = match[1];
    const streetPart = match[2];
    
    // House number validation - must be reasonable
    const houseNum = parseInt(houseNumber);
    if (houseNum <= 0 || houseNum > 99999) {
      return {
        valid: false,
        message: 'Please enter a valid house number'
      };
    }
    
    // Street name validation - must have at least 2 characters
    if (streetPart.length < 2) {
      return {
        valid: false,
        message: 'Please enter a valid street name'
      };
    }
    
    // Check for common incomplete patterns
    const incompletePatterns = [
      /^(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|pl|place|blvd|boulevard)$/i,
      /^\d+$/  // Just numbers
    ];
    
    for (const pattern of incompletePatterns) {
      if (pattern.test(streetPart)) {
        return {
          valid: false,
          message: 'Please enter a complete street name'
        };
      }
    }
    
    return { valid: true };
  }

  /**
   * Format address for display
   * @param {Object} addressData - Address components
   * @returns {string} Formatted address
   */
  formatAddress(addressData) {
    const { address, city, state, zipCode } = addressData;
    return `${address}, ${city}, ${state} ${zipCode}`;
  }

  /**
   * Validate coordinates are within a service area
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} serviceArea - Service area definition
   * @returns {boolean} True if within service area
   */
  isWithinServiceArea(lat, lon, serviceArea) {
    const distance = this.calculateDistance(
      lat, lon,
      serviceArea.centerLat, serviceArea.centerLon
    );
    
    return distance <= serviceArea.radiusMiles;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - First latitude
   * @param {number} lon1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lon2 - Second longitude
   * @returns {number} Distance in miles
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI/180);
  }
}

// Export singleton instance
module.exports = new AddressValidationService();