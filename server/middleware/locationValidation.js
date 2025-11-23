const { body, validationResult } = require('express-validator');
const serviceAreaService = require('../services/serviceAreaService');

// Custom validator for zip codes in service area
const zipCodeInServiceArea = (value) => {
  if (!value) return true; // Let required validator handle empty values
  
  if (!serviceAreaService.isValidZipCode(value)) {
    throw new Error('Zip code is not in our service area');
  }
  return true;
};

// Custom validator for cities in service area  
const cityInServiceArea = (value) => {
  if (!value) return true; // Let required validator handle empty values
  
  if (!serviceAreaService.isValidCity(value)) {
    throw new Error('City is not in our service area');
  }
  return true;
};

// Custom validator for state matching service state
const stateMatchesServiceArea = (value) => {
  if (!value) return true; // Let required validator handle empty values
  
  const serviceState = serviceAreaService.getServiceState();
  if (value !== serviceState) {
    throw new Error(`State must be ${serviceState}`);
  }
  return true;
};

// Custom validator for city/zip combination
const cityZipComboValid = (value, { req }) => {
  const city = req.body.city;
  const zipCode = req.body.zipCode;
  
  // Skip if either is missing (let required validators handle)
  if (!city || !zipCode) return true;
  
  if (!serviceAreaService.isValidCityZipCombo(city, zipCode)) {
    throw new Error('City and zip code combination is not valid for our service area');
  }
  return true;
};

// Validation rules for registration address
const registrationAddressValidation = [
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required')
    .isLength({ min: 5, max: 100 }).withMessage('Address must be between 5 and 100 characters'),
    
  body('city')
    .trim()
    .notEmpty().withMessage('City is required')
    .isLength({ min: 2, max: 50 }).withMessage('City must be between 2 and 50 characters')
    .custom(cityInServiceArea),
    
  body('state')
    .trim()
    .notEmpty().withMessage('State is required')
    .isLength({ min: 2, max: 2 }).withMessage('State must be 2 characters')
    .custom(stateMatchesServiceArea),
    
  body('zipCode')
    .trim()
    .notEmpty().withMessage('Zip code is required')
    .matches(/^\d{5}$/).withMessage('Zip code must be 5 digits')
    .custom(zipCodeInServiceArea)
    .custom(cityZipComboValid)
];

// Validation rules for profile update address (optional fields)
const profileAddressValidation = [
  body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 }).withMessage('Address must be between 5 and 100 characters'),
    
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('City must be between 2 and 50 characters')
    .custom(cityInServiceArea),
    
  body('state')
    .optional()
    .trim()
    .isLength({ min: 2, max: 2 }).withMessage('State must be 2 characters')
    .custom(stateMatchesServiceArea),
    
  body('zipCode')
    .optional()
    .trim()
    .matches(/^\d{5}$/).withMessage('Zip code must be 5 digits')
    .custom(zipCodeInServiceArea)
    .custom(cityZipComboValid)
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('[Validation] Validation errors for', req.path, ':', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Export validation middleware
module.exports = {
  registrationAddressValidation,
  profileAddressValidation,
  handleValidationErrors,
  
  // Export individual validators for custom use
  validators: {
    zipCodeInServiceArea,
    cityInServiceArea,
    stateMatchesServiceArea,
    cityZipComboValid
  }
};