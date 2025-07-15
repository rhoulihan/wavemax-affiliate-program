/**
 * Simple Address Validation Class
 * Provides basic address validation functionality for affiliate registration
 */
class AddressValidator {
  constructor(options = {}) {
    this.isEmbedded = window.parent !== window;
    this.options = options;
  }

  /**
   * Validate that an address exists and get its coordinates
   * @param {Object} addressData - Contains address, city, state, zipCode
   * @returns {Promise<Object>} Validation result with coordinates
   */
  async validateAddressExists(addressData) {
    const { address, city, state, zipCode } = addressData;
    
    console.log('[AddressValidator] Validating address data:', addressData);
    
    try {
      // First, validate the address format
      const addressValidation = this.validateAddressFormat(address);
      if (!addressValidation.valid) {
        return addressValidation;
      }
      
      // Build search query using address and zip code
      const query = `${address}, ${city}, ${state} ${zipCode}, USA`;
      
      console.log('[AddressValidator] Search query:', query);
      
      // Use direct Nominatim API call for now
      const params = new URLSearchParams({
        format: 'json',
        q: query,
        limit: '5',
        countrycodes: 'us',
        addressdetails: '1'
      });

      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      
      console.log('[AddressValidator] Fetching:', url);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WaveMAX Laundry Application'
        }
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }

      const results = await response.json();
      
      console.log('[AddressValidator] Geocoding results:', results);
      
      if (results.length === 0) {
        return {
          valid: false,
          message: 'Address not found. Please check the address and try again.'
        };
      }

      // Use the first result for now
      const bestMatch = results[0];
      
      // Basic validation - check if we have coordinates
      if (!bestMatch.lat || !bestMatch.lon) {
        return {
          valid: false,
          message: 'Unable to determine location for this address.'
        };
      }

      return {
        valid: true,
        lat: parseFloat(bestMatch.lat),
        lon: parseFloat(bestMatch.lon),
        display_name: bestMatch.display_name,
        address: bestMatch.address
      };

    } catch (error) {
      console.error('Address validation error:', error);
      return {
        valid: false,
        message: 'Unable to verify address at this time. Please try again.',
        lat: null,
        lon: null
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
        message: 'Please enter a valid street address.'
      };
    }
    
    // Must start with a valid house number (digits, optionally followed by a single letter)
    const addressPattern = /^(\d+[A-Za-z]?)\s+(.+)$/;
    const match = address.trim().match(addressPattern);
    
    if (!match) {
      return {
        valid: false,
        message: 'Address must start with a valid house number (e.g., 123 Main Street).'
      };
    }
    
    const houseNumber = match[1];
    const streetPart = match[2];
    
    // House number validation - must be reasonable
    const houseNum = parseInt(houseNumber);
    if (houseNum <= 0 || houseNum > 99999) {
      return {
        valid: false,
        message: 'Please enter a valid house number.'
      };
    }
    
    // Street name validation - must have at least 2 characters
    if (streetPart.length < 2) {
      return {
        valid: false,
        message: 'Please enter a valid street name.'
      };
    }
    
    return { valid: true };
  }
}

// Make available globally
window.AddressValidator = AddressValidator;