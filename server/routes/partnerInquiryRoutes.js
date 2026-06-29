const express = require('express');
const { body } = require('express-validator');

const partnerInquiryController = require('../controllers/partnerInquiryController');
const { contactFormBurstLimiter, contactFormLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

const ALLOWED_VOLUMES = ['just-exploring', '<50', '50-200', '200+'];

const partnerInquiryValidators = [
  body('firstName')
    .exists({ checkFalsy: true }).withMessage('First name is required')
    .bail()
    .isString().trim()
    .isLength({ min: 1, max: 50 }).withMessage('First name must be 1–50 characters'),
  body('lastName')
    .exists({ checkFalsy: true }).withMessage('Last name is required')
    .bail()
    .isString().trim()
    .isLength({ min: 1, max: 50 }).withMessage('Last name must be 1–50 characters'),
  body('email')
    .exists({ checkFalsy: true }).withMessage('Email is required')
    .bail()
    .isEmail().withMessage('Valid email is required')
    .bail()
    .isLength({ max: 100 }).withMessage('Email must be 100 characters or fewer'),
  body('phone')
    .exists({ checkFalsy: true }).withMessage('Phone is required')
    .bail()
    .isString().isLength({ max: 30 }),
  body('businessName')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 120 }),
  body('serviceArea')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 200 }),
  body('volume')
    .optional({ checkFalsy: true })
    .isString()
    .isIn(ALLOWED_VOLUMES).withMessage('Volume must be one of: ' + ALLOWED_VOLUMES.join(', ')),
  body('message')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 2000 }),
  body('source')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 200 })
];

router.post(
  '/partner-inquiry',
  contactFormBurstLimiter,
  contactFormLimiter,
  partnerInquiryValidators,
  partnerInquiryController.submitPartnerInquiry
);

module.exports = router;
