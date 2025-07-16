const express = require('express');
const router = express.Router();
const serviceAreaService = require('../services/serviceAreaService');
const addressValidationService = require('../services/addressValidationService');
const { apiLimiter } = require('../middleware/rateLimiting');

/**
 * @route   GET /api/service-area/config
 * @desc    Get service area configuration
 * @access  Public
 */
router.get('/config', (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        state: serviceAreaService.getServiceState(),
        centerCity: process.env.SERVICE_CITY || 'Austin',
        radiusMiles: parseInt(process.env.SERVICE_RADIUS_MILES) || 50
      }
    });
  } catch (error) {
    console.error('Error getting service area config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service area configuration'
    });
  }
});

/**
 * @route   GET /api/service-area/autocomplete
 * @desc    Get autocomplete data for cities and zip codes
 * @access  Public
 */
router.get('/autocomplete', (req, res) => {
  try {
    const autocompleteData = serviceAreaService.getAutocompleteData();
    res.json({
      success: true,
      data: autocompleteData
    });
  } catch (error) {
    console.error('Error getting autocomplete data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get autocomplete data'
    });
  }
});

/**
 * @route   GET /api/service-area/cities
 * @desc    Get list of valid cities
 * @access  Public
 */
router.get('/cities', (req, res) => {
  try {
    const cities = serviceAreaService.getValidCities();
    res.json({
      success: true,
      cities: cities
    });
  } catch (error) {
    console.error('Error getting cities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cities'
    });
  }
});

/**
 * @route   GET /api/service-area/zip-codes
 * @desc    Get list of valid zip codes
 * @access  Public
 */
router.get('/zip-codes', (req, res) => {
  try {
    const zipCodes = serviceAreaService.getValidZipCodes();
    res.json({
      success: true,
      zipCodes: zipCodes
    });
  } catch (error) {
    console.error('Error getting zip codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zip codes'
    });
  }
});

/**
 * @route   GET /api/service-area/city/:zipCode
 * @desc    Get city for a specific zip code
 * @access  Public
 */
router.get('/city/:zipCode', (req, res) => {
  try {
    const { zipCode } = req.params;
    const city = serviceAreaService.getCityForZipCode(zipCode);
    
    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'Zip code not found in service area'
      });
    }
    
    res.json({
      success: true,
      city: city
    });
  } catch (error) {
    console.error('Error getting city for zip code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get city'
    });
  }
});

/**
 * @route   GET /api/service-area/zip-codes/:city
 * @desc    Get zip codes for a specific city
 * @access  Public
 */
router.get('/zip-codes/:city', (req, res) => {
  try {
    const { city } = req.params;
    const zipCodes = serviceAreaService.getZipCodesForCity(city);
    
    if (zipCodes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'City not found in service area'
      });
    }
    
    res.json({
      success: true,
      zipCodes: zipCodes
    });
  } catch (error) {
    console.error('Error getting zip codes for city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zip codes'
    });
  }
});

/**
 * @route   POST /api/service-area/validate
 * @desc    Validate an address with geocoding
 * @access  Public
 */
router.post('/validate', async (req, res) => {
  try {
    const { address, city, state, zipCode } = req.body;
    
    // First validate against service area restrictions
    const serviceAreaValidation = serviceAreaService.validateAddress({
      address,
      city,
      state,
      zipCode
    });
    
    if (!serviceAreaValidation.isValid) {
      return res.json({
        success: false,
        message: serviceAreaValidation.errors.join(', ')
      });
    }
    
    // Then perform geocoding validation
    const geocodeResult = await addressValidationService.validateAddress({
      address,
      city,
      state,
      zipCode
    });
    
    if (!geocodeResult.valid) {
      return res.json({
        success: false,
        message: geocodeResult.message
      });
    }
    
    // Check if coordinates are within general service area
    const serviceState = serviceAreaService.getServiceState();
    const serviceCity = process.env.SERVICE_CITY || 'Austin';
    const radiusMiles = parseInt(process.env.SERVICE_RADIUS_MILES) || 50;
    
    // For now, just return success with coordinates
    // Additional distance checking can be added here if needed
    
    res.json({
      success: true,
      coordinates: {
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude
      },
      formattedAddress: geocodeResult.formattedAddress
    });
  } catch (error) {
    console.error('Error validating address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate address'
    });
  }
});

module.exports = router;