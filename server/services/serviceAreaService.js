const fs = require('fs');
const path = require('path');

class ServiceAreaService {
  constructor() {
    this.serviceAreaData = null;
    this.lastLoaded = null;
    this.cacheTime = 3600000; // 1 hour cache
  }

  // Load service area data from file
  loadServiceAreaData() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.serviceAreaData && this.lastLoaded && (now - this.lastLoaded < this.cacheTime)) {
      return this.serviceAreaData;
    }

    try {
      const filePath = path.join(__dirname, '../../data/service-area.json');
      const rawData = fs.readFileSync(filePath, 'utf8');
      this.serviceAreaData = JSON.parse(rawData);
      this.lastLoaded = now;
      
      // Create lookup maps for faster validation
      this.serviceAreaData.zipCodeSet = new Set(this.serviceAreaData.locations.map(loc => loc.zip));
      this.serviceAreaData.citySet = new Set(this.serviceAreaData.locations.map(loc => loc.city.toLowerCase()));
      
      // Create city to zip mapping for validation
      this.serviceAreaData.cityZipMap = new Map();
      this.serviceAreaData.locations.forEach(loc => {
        const cityLower = loc.city.toLowerCase();
        if (!this.serviceAreaData.cityZipMap.has(cityLower)) {
          this.serviceAreaData.cityZipMap.set(cityLower, new Set());
        }
        this.serviceAreaData.cityZipMap.get(cityLower).add(loc.zip);
      });
      
      console.log(`Service area data loaded: ${this.serviceAreaData.locations.length} zip codes in ${this.serviceAreaData.summary.cities.length} cities`);
      return this.serviceAreaData;
    } catch (error) {
      console.error('Error loading service area data:', error);
      throw new Error('Failed to load service area data');
    }
  }

  // Get service state from environment
  getServiceState() {
    return process.env.SERVICE_STATE || 'TX';
  }

  // Validate if a zip code is in the service area
  isValidZipCode(zipCode) {
    if (!zipCode) return false;
    
    const data = this.loadServiceAreaData();
    return data.zipCodeSet.has(zipCode);
  }

  // Validate if a city is in the service area
  isValidCity(city) {
    if (!city) return false;
    
    const data = this.loadServiceAreaData();
    return data.citySet.has(city.toLowerCase());
  }

  // Validate if a city and zip code combination is valid
  isValidCityZipCombo(city, zipCode) {
    if (!city || !zipCode) return false;
    
    const data = this.loadServiceAreaData();
    const cityLower = city.toLowerCase();
    
    // Check if both city and zip are in service area
    if (!data.citySet.has(cityLower) || !data.zipCodeSet.has(zipCode)) {
      return false;
    }
    
    // Check if zip code belongs to the specified city
    const cityZips = data.cityZipMap.get(cityLower);
    return cityZips && cityZips.has(zipCode);
  }

  // Get autocomplete data
  getAutocompleteData() {
    const data = this.loadServiceAreaData();
    return data.autocomplete;
  }

  // Get all valid cities
  getValidCities() {
    const data = this.loadServiceAreaData();
    return data.autocomplete.cities;
  }

  // Get all valid zip codes
  getValidZipCodes() {
    const data = this.loadServiceAreaData();
    return data.autocomplete.zipCodes;
  }

  // Get zip codes for a specific city
  getZipCodesForCity(city) {
    if (!city) return [];
    
    const data = this.loadServiceAreaData();
    const cityLower = city.toLowerCase();
    const cityZips = data.cityZipMap.get(cityLower);
    
    return cityZips ? Array.from(cityZips).sort() : [];
  }

  // Get city for a specific zip code
  getCityForZipCode(zipCode) {
    if (!zipCode) return null;
    
    const data = this.loadServiceAreaData();
    const location = data.locations.find(loc => loc.zip === zipCode);
    
    return location ? location.city : null;
  }

  // Validate complete address
  validateAddress(address) {
    const errors = [];
    
    // Check state
    if (!address.state || address.state !== this.getServiceState()) {
      errors.push(`State must be ${this.getServiceState()}`);
    }
    
    // Check zip code
    if (!address.zipCode) {
      errors.push('Zip code is required');
    } else if (!this.isValidZipCode(address.zipCode)) {
      errors.push('Zip code is not in our service area');
    }
    
    // Check city
    if (!address.city) {
      errors.push('City is required');
    } else if (!this.isValidCity(address.city)) {
      errors.push('City is not in our service area');
    }
    
    // Check city/zip combination if both are provided
    if (address.city && address.zipCode && !this.isValidCityZipCombo(address.city, address.zipCode)) {
      errors.push('City and zip code combination is not valid');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

// Export singleton instance
module.exports = new ServiceAreaService();