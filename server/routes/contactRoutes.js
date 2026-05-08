const express = require('express');
const { body } = require('express-validator');

const contactController = require('../controllers/contactController');
const { contactFormBurstLimiter, contactFormLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

const validators = [
  body('firstName')
    .exists({ checkFalsy: true }).withMessage('First name is required')
    .bail()
    .isString().withMessage('First name must be a string')
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .exists({ checkFalsy: true }).withMessage('Last name is required')
    .bail()
    .isString().withMessage('Last name must be a string')
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters'),
  body('email')
    .exists({ checkFalsy: true }).withMessage('Email is required')
    .bail()
    .isEmail().withMessage('Valid email is required')
    .bail()
    .isLength({ max: 100 }).withMessage('Email must be 100 characters or fewer'),
  body('phone')
    .optional({ checkFalsy: true })
    .isString().withMessage('Phone must be a string')
    .isLength({ max: 30 }).withMessage('Phone must be 30 characters or fewer'),
  body('message')
    .exists({ checkFalsy: true }).withMessage('Message is required')
    .bail()
    .isString().withMessage('Message must be a string')
    .isLength({ min: 5, max: 2000 }).withMessage('Message must be between 5 and 2000 characters'),

  // Anti-spam pair (honeypot + dwell-time gate). The client puts these
  // on every submission. If either trips, validation fails and the form
  // is silently rejected — spammers don't learn which check fired.
  //
  //   _hp — visually-hidden honeypot field. Bots fill it; humans don't.
  //         MUST be empty (or absent / not a string).
  //   _dt — milliseconds the form was open before submit. Real users
  //         take seconds to fill the form; scripted submitters fire in
  //         <100ms. Floor: 3000ms.
  body('_hp')
    .optional()
    .isString().withMessage('Invalid form state')
    .isLength({ max: 0 }).withMessage('Spam check failed'),
  body('_dt')
    .optional()
    .isInt({ min: 3000, max: 86400000 }).withMessage('Form submitted too quickly')
];

router.post(
  '/:slug',
  contactFormBurstLimiter,
  contactFormLimiter,
  validators,
  contactController.submitContact
);

module.exports = router;
