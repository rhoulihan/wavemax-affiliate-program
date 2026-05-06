const express = require('express');
const { body } = require('express-validator');

const corporateInquiryController = require('../controllers/corporateInquiryController');
const { contactFormBurstLimiter, contactFormLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

const sharedNameAndContact = [
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
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 30 }),
  body('source')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 200 })
];

const ALLOWED_TOPICS = [
  'franchise', 'customer', 'press', 'vendor', 'general'
];

const ALLOWED_TIMELINES = [
  'asap', '3months', '6months', '12months', 'researching'
];

const ALLOWED_CAPITAL = [
  '<400k', '400k-750k', '750k-1.5m', '>1.5m'
];

const corporateContactValidators = sharedNameAndContact.concat([
  body('topic')
    .exists({ checkFalsy: true }).withMessage('Topic is required')
    .bail()
    .isString()
    .isIn(ALLOWED_TOPICS).withMessage('Topic must be one of: ' + ALLOWED_TOPICS.join(', ')),
  body('message')
    .exists({ checkFalsy: true }).withMessage('Message is required')
    .bail()
    .isString()
    .isLength({ min: 5, max: 2000 }).withMessage('Message must be 5–2000 characters')
]);

const franchiseLeadValidators = sharedNameAndContact.concat([
  body('phone')
    .exists({ checkFalsy: true }).withMessage('Phone is required for franchise inquiries')
    .bail()
    .isString().isLength({ max: 30 }),
  body('market')
    .optional({ checkFalsy: true })
    .isString().isLength({ max: 200 }),
  body('timeline')
    .exists({ checkFalsy: true }).withMessage('Timeline is required')
    .bail()
    .isString()
    .isIn(ALLOWED_TIMELINES).withMessage('Timeline must be one of: ' + ALLOWED_TIMELINES.join(', ')),
  body('capital')
    .exists({ checkFalsy: true }).withMessage('Liquid capital range is required')
    .bail()
    .isString()
    .isIn(ALLOWED_CAPITAL).withMessage('Capital must be one of: ' + ALLOWED_CAPITAL.join(', '))
]);

router.post(
  '/corporate-contact',
  contactFormBurstLimiter,
  contactFormLimiter,
  corporateContactValidators,
  corporateInquiryController.submitCorporateContact
);

router.post(
  '/franchise-lead',
  contactFormBurstLimiter,
  contactFormLimiter,
  franchiseLeadValidators,
  corporateInquiryController.submitFranchiseLead
);

module.exports = router;
