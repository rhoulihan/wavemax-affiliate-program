const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Address FORMAT validation only. The static Austin service-area gate (the
// cityInServiceArea/stateMatchesServiceArea/zipCodeInServiceArea/cityZipComboValid
// custom validators + serviceAreaService) was removed in the 2026-06-23 audit —
// the app is invite-only nationwide, so there is no geographic restriction. These
// arrays + handleValidationErrors are shared by affiliateRoutes + customerRoutes.

// Validation rules for registration address
const registrationAddressValidation = [
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required')
    .isLength({ min: 5, max: 100 }).withMessage('Address must be between 5 and 100 characters'),

  body('city')
    .trim()
    .notEmpty().withMessage('City is required')
    .isLength({ min: 2, max: 50 }).withMessage('City must be between 2 and 50 characters'),

  body('state')
    .trim()
    .notEmpty().withMessage('State is required')
    .isLength({ min: 2, max: 2 }).withMessage('State must be 2 characters'),

  body('zipCode')
    .trim()
    .notEmpty().withMessage('Zip code is required')
    .matches(/^\d{5}$/).withMessage('Zip code must be 5 digits')
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
    .isLength({ min: 2, max: 50 }).withMessage('City must be between 2 and 50 characters'),

  body('state')
    .optional()
    .trim()
    .isLength({ min: 2, max: 2 }).withMessage('State must be 2 characters'),

  body('zipCode')
    .optional()
    .trim()
    .matches(/^\d{5}$/).withMessage('Zip code must be 5 digits')
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.info('[Validation] Validation errors for', req.path, ':', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  registrationAddressValidation,
  profileAddressValidation,
  handleValidationErrors
};
