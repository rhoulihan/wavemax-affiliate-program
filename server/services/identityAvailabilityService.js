// Identity availability service
//
// Pre-registration availability checks: "is this username/email free across
// all four user types?" Called by the client-side forms to surface
// real-time feedback before the user submits. Case-insensitive username
// match; normalized-lowercase email match.

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Administrator = require('../models/Administrator');
const Operator = require('../models/Operator');
const { escapeRegex } = require('../utils/securityUtils');
const logger = require('../utils/logger');

class IdentityAvailabilityError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isIdentityAvailabilityError = true;
  }
}

async function isUsernameAvailable({ username }) {
  if (!username || username.trim().length < 3) {
    throw new IdentityAvailabilityError(
      'username_too_short',
      'Username must be at least 3 characters'
    );
  }

  const trimmed = username.trim();
  logger.info('Checking username availability for:', trimmed);

  const pattern = { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' };
  const [affiliate, customer, administrator, operator] = await Promise.all([
    Affiliate.findOne({ username: pattern }),
    Customer.findOne({ username: pattern }),
    Administrator.findOne({ username: pattern }),
    Operator.findOne({ username: pattern })
  ]);

  logger.info('Username check results:', {
    username: trimmed,
    affiliateFound: !!affiliate,
    customerFound: !!customer,
    administratorFound: !!administrator,
    operatorFound: !!operator
  });

  return !affiliate && !customer && !administrator && !operator;
}

async function isEmailAvailable({ email }) {
  if (!email || !email.trim()) {
    throw new IdentityAvailabilityError('email_required', 'Email is required');
  }

  const trimmed = email.trim().toLowerCase();
  logger.info('Checking email availability for:', trimmed);

  const [affiliate, customer, administrator, operator] = await Promise.all([
    Affiliate.findOne({ email: trimmed }),
    Customer.findOne({ email: trimmed }),
    Administrator.findOne({ email: trimmed }),
    Operator.findOne({ email: trimmed })
  ]);

  logger.info('Email check results:', {
    email: trimmed,
    affiliateFound: !!affiliate,
    customerFound: !!customer,
    administratorFound: !!administrator,
    operatorFound: !!operator
  });

  return !affiliate && !customer && !administrator && !operator;
}

module.exports = {
  isUsernameAvailable,
  isEmailAvailable,
  IdentityAvailabilityError
};
