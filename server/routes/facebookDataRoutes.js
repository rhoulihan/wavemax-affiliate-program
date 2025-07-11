const express = require('express');
const router = express.Router();
const facebookDataController = require('../controllers/facebookDataController');
const { body, param, validationResult } = require('express-validator');

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Facebook data deletion callback
// This endpoint is called by Facebook when a user requests data deletion
router.post('/deletion-callback',
  [
    body('signed_request')
      .notEmpty()
      .withMessage('signed_request is required')
      .isString()
      .withMessage('signed_request must be a string')
  ],
  validateRequest,
  facebookDataController.handleDeletionCallback
);

// Check deletion request status
// This endpoint can be called to check the status of a deletion request
router.get('/deletion-status/:code',
  [
    param('code')
      .notEmpty()
      .withMessage('Confirmation code is required')
      .isAlphanumeric()
      .withMessage('Invalid confirmation code format')
      .isLength({ min: 10, max: 10 })
      .withMessage('Invalid confirmation code length')
  ],
  validateRequest,
  facebookDataController.checkDeletionStatus
);

module.exports = router;