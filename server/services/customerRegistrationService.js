// Customer registration service
//
// Claim-based registration (spec §6.3): the customer registers by scanning a
// durable bag's QR. The affiliate is derived server-side from the bag —
// never from client input. Order of operations for the claim race: save the
// customer, then claim; on race loss, compensating delete (no Mongo
// transaction — standalone-mongod portable, spec §13 #4).

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const Customer = require('../models/Customer');
const bagClaimService = require('./bagClaimService');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const Formatters = require('../utils/formatters');
const logger = require('../utils/logger');

/**
 * Error type used to communicate expected failures (duplicate email, bag not
 * claimable, etc.) back to the HTTP layer. The controller maps these to JSON
 * error responses; unexpected failures bubble up normally.
 */
class RegistrationError extends Error {
  constructor(code, message, extras = {}) {
    super(message);
    this.code = code;        // 'bag_not_claimable' | 'bag_already_claimed' | 'duplicate_email_and_username' | 'duplicate_email' | 'duplicate_username'
    this.status = extras.status || 400;
    this.extras = extras;
    this.isRegistrationError = true;
  }
}

/**
 * Register a new customer against a scanned bag token.
 * Returns `{ customer, affiliate, bag, token }` on success, or throws a
 * RegistrationError on expected failure cases.
 */
async function registerCustomer(payload) {
  const {
    bagToken,
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
    languagePreference,
    socialToken,
    socialProvider
  } = payload;

  // Server-trust: the affiliate comes from the bag, never the payload.
  const resolved = await bagClaimService.resolveClaimToken(bagToken);
  if (resolved.state !== 'claimable') {
    throw new RegistrationError('bag_not_claimable', 'This bag cannot be claimed', {
      status: 409, state: resolved.state
    });
  }
  const { bag, affiliate } = resolved;

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
    logger.info(`OAuth claim registration for email: ${email}, generated username: ${finalUsername}`);
  } else {
    const { salt, hash } = encryptionUtil.hashPassword(password);
    passwordSalt = salt;
    passwordHash = hash;
  }

  const newCustomer = new Customer({
    customerId: `CUST-${uuidv4()}`,
    affiliateId: affiliate.affiliateId,   // derived from the bag
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
    registrationMethod: socialToken ? (socialProvider || 'social') : 'traditional'
  });

  await newCustomer.save();

  // Save-then-claim with a compensating delete on race loss (spec §13 #4).
  let claimedBag;
  try {
    claimedBag = await bagClaimService.claimForCustomer(bag, newCustomer.customerId);
  } catch (err) {
    await Customer.deleteOne({ _id: newCustomer._id });
    if (err.isClaimError) {
      throw new RegistrationError('bag_already_claimed', 'This bag has already been claimed', { status: 409 });
    }
    throw err;
  }

  const token = jwt.sign(
    { id: newCustomer._id, customerId: newCustomer.customerId, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Emails are best-effort — never fail registration on SMTP hiccup.
  await sendWelcomeEmails(newCustomer, affiliate);

  return { customer: newCustomer, affiliate, bag: claimedBag, token };
}

async function sendWelcomeEmails(customer, affiliate) {
  try {
    await emailService.sendCustomerWelcomeEmail(customer, affiliate, { numberOfBags: 0, totalCredit: 0, bagFee: 0 });
  } catch (emailError) {
    logger.error('Failed to send welcome email:', emailError);
  }
  try {
    await emailService.sendAffiliateNewCustomerEmail(affiliate, customer, { numberOfBags: 0, totalCredit: 0, bagFee: 0 });
  } catch (emailError) {
    logger.error('Failed to send affiliate notification:', emailError);
  }
}

module.exports = {
  registerCustomer,
  RegistrationError
};
