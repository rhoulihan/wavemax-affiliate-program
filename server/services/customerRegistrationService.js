// Customer registration service
//
// Orchestrates post-weigh customer registration: uniqueness checks, password
// hashing (or OAuth username generation), saving the document, optional
// encrypted payment-info storage, JWT issuance, and welcome-email delivery.
//
// Extracted from customerController.registerCustomer in Phase 2 so the
// controller only handles HTTP plumbing.

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const SystemConfig = require('../models/SystemConfig');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const Formatters = require('../utils/formatters');
const logger = require('../utils/logger');

/**
 * Error type used to communicate expected failures (duplicate email, invalid
 * affiliate, etc.) back to the HTTP layer. The controller maps these to JSON
 * error responses; unexpected failures bubble up normally.
 */
class RegistrationError extends Error {
  constructor(code, message, extras = {}) {
    super(message);
    this.code = code;        // 'invalid_affiliate' | 'duplicate_email_and_username' | 'duplicate_email' | 'duplicate_username'
    this.status = extras.status || 400;
    this.extras = extras;
    this.isRegistrationError = true;
  }
}

/**
 * Register a new customer against `affiliateId`.
 * Returns `{ customer, affiliate, token }` on success, or throws a
 * RegistrationError on expected failure cases.
 */
async function registerCustomer(payload) {
  const {
    affiliateId,
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    state,
    zipCode,
    specialInstructions,
    affiliateSpecialInstructions,
    username,
    password,
    cardholderName,
    cardNumber,
    expiryDate,
    cvv,
    billingZip,
    savePaymentInfo,
    numberOfBags,
    languagePreference,
    paymentConfirmed,
    socialToken,
    socialProvider
  } = payload;

  if (paymentConfirmed) {
    logger.info(`Post-payment registration for email: ${email}, affiliate: ${affiliateId}`);
  }

  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) {
    throw new RegistrationError('invalid_affiliate', 'Invalid affiliate ID');
  }

  const [existingEmail, existingUsername] = await Promise.all([
    Customer.findOne({ email }),
    Customer.findOne({ username })
  ]);

  if (existingEmail && existingUsername) {
    throw new RegistrationError(
      'duplicate_email_and_username',
      'Both email and username are already in use',
      { errors: { email: 'Email already registered', username: 'Username already taken' } }
    );
  }
  if (existingEmail) {
    throw new RegistrationError('duplicate_email', 'Email already registered', { field: 'email' });
  }
  if (existingUsername) {
    throw new RegistrationError('duplicate_username', 'Username already taken', { field: 'username' });
  }

  // OAuth vs traditional — OAuth skips password, auto-generates a username if absent.
  let finalUsername = username;
  let passwordSalt = null;
  let passwordHash = null;

  if (socialToken) {
    if (!username) {
      finalUsername = email.split('@')[0] + '_' + Date.now().toString(36);
    }
    logger.info(`OAuth registration for email: ${email}, generated username: ${finalUsername}`);
  } else {
    const { salt, hash } = encryptionUtil.hashPassword(password);
    passwordSalt = salt;
    passwordHash = hash;
  }

  // Cap requested bags at the free-initial-bags setting.
  const freeInitialBags = await SystemConfig.getValue('free_initial_bags', 2);
  const initialBagsRequested = Math.min(numberOfBags || 1, freeInitialBags);

  const newCustomer = new Customer({
    customerId: `CUST-${uuidv4()}`,
    affiliateId,
    firstName: Formatters.name(firstName),
    lastName: Formatters.name(lastName),
    email: email.toLowerCase(),
    phone: Formatters.phone(phone, 'us'),
    address,
    city,
    state: state.toUpperCase(),
    zipCode,
    specialInstructions,
    affiliateSpecialInstructions,
    username: finalUsername,
    passwordSalt,
    passwordHash,
    languagePreference: languagePreference || 'en',
    numberOfBags: initialBagsRequested,
    registrationMethod: socialToken ? (socialProvider || 'social') : 'traditional'
  });

  if (savePaymentInfo && cardNumber) {
    newCustomer.encryptedPaymentInfo = encryptionUtil.encrypt({
      cardholderName,
      cardNumber,
      expiryDate,
      cvv,
      billingZip: billingZip || zipCode
    });
  }

  await newCustomer.save();

  const token = jwt.sign(
    { id: newCustomer._id, customerId: newCustomer.customerId, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Post-weigh workflow: no upfront bag purchase, so email bag-info is empty.
  const bagInfo = { numberOfBags: 0, totalCredit: 0, bagFee: 0 };

  // Emails are best-effort — never fail registration on SMTP hiccup.
  await sendWelcomeEmails(newCustomer, affiliate, bagInfo);

  return { customer: newCustomer, affiliate, token };
}

async function sendWelcomeEmails(customer, affiliate, bagInfo) {
  try {
    await emailService.sendCustomerWelcomeEmail(customer, affiliate, bagInfo);
  } catch (emailError) {
    logger.error('Failed to send welcome email:', emailError);
  }
  try {
    await emailService.sendAffiliateNewCustomerEmail(affiliate, customer, bagInfo);
  } catch (emailError) {
    logger.error('Failed to send affiliate notification:', emailError);
  }
}

module.exports = {
  registerCustomer,
  RegistrationError
};
