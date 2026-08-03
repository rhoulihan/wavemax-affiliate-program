const express = require('express');
const { body } = require('express-validator');

const affiliateApplicationController = require('../controllers/affiliateApplicationController');
const { contactFormBurstLimiter, contactFormLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

const ALLOWED_AFFILIATIONS = ['ut-student', 'ut-alum', 'other'];
const ALLOWED_TRANSPORT = ['car', 'bike', 'scooter', 'on-foot', 'other'];

const affiliateApplicationValidators = [
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
  body('affiliation')
    .optional({ checkFalsy: true })
    .isString()
    .isIn(ALLOWED_AFFILIATIONS).withMessage('Affiliation must be one of: ' + ALLOWED_AFFILIATIONS.join(', ')),
  body('serviceArea')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 200 }),
  body('transport')
    .optional({ checkFalsy: true })
    .isString()
    .isIn(ALLOWED_TRANSPORT).withMessage('Transport must be one of: ' + ALLOWED_TRANSPORT.join(', ')),
  body('availability')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 200 }),
  body('message')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 2000 }),
  body('source')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 200 })
];

router.post(
  '/affiliate-application',
  contactFormBurstLimiter,
  contactFormLimiter,
  affiliateApplicationValidators,
  affiliateApplicationController.submitAffiliateApplication
);

module.exports = router;
