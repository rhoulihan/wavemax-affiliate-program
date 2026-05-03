const express = require('express');
const { body } = require('express-validator');

const contactController = require('../controllers/contactController');
const { sensitiveOperationLimiter } = require('../middleware/rateLimiting');

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
    .isLength({ min: 5, max: 2000 }).withMessage('Message must be between 5 and 2000 characters')
];

router.post('/:slug', sensitiveOperationLimiter, validators, contactController.submitContact);

module.exports = router;
