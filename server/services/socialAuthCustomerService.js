// Customer social-auth service
//
// Business logic for the customer OAuth registration flow. The callback
// handler (handleCustomerSocialCallback) stays in authController for the
// same reasons as the affiliate side — it's mostly HTTP plumbing.
// Shares token-verification + username-generation helpers with
// socialAuthAffiliateService since the rules are identical.

const Customer = require('../models/Customer');
const bagClaimService = require('./bagClaimService');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const authTokenService = require('./authTokenService');
const socialAuthAffiliateService = require('./socialAuthAffiliateService');
const logger = require('../utils/logger');

class SocialAuthCustomerError extends Error {
  constructor(code, message, status = 400, extras = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.extras = extras;
    this.isSocialAuthCustomerError = true;
  }
}

async function findAvailableCustomerUsername(socialData) {
  const base = (socialData.firstName + socialData.lastName)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  let candidate = base;
  let counter = 1;
  while (await Customer.findOne({ username: candidate })) {
    candidate = `${base}${counter}`;
    counter++;
  }
  return candidate;
}

async function completeSocialCustomerRegistration({ payload, ip, cryptoWrapper, req }) {
  const { socialToken, bagToken, ...rest } = payload;

  let socialData;
  try {
    socialData = socialAuthAffiliateService.verifySocialToken(socialToken);
  } catch (err) {
    // Re-throw as customer-typed error so controller mapping stays consistent.
    throw new SocialAuthCustomerError(err.code || 'invalid_token', err.message, err.status || 400);
  }

  const username = await findAvailableCustomerUsername(socialData);
  // Random backup password — never shown to the user. OAuth is the real
  // authenticator; hashPassword still runs so the account is valid if a
  // password-based login path is ever added.
  const generatedPassword = cryptoWrapper.randomBytes(32).toString('hex') + 'A1!';

  const existingEmail = await Customer.findOne({ email: socialData.email });
  if (existingEmail) {
    throw new SocialAuthCustomerError('duplicate_email', 'Email already exists', 409);
  }

  const socialAccountKey = `socialAccounts.${socialData.provider}.id`;
  const existingSocial = await Customer.findOne({ [socialAccountKey]: socialData.socialId });
  if (existingSocial) {
    throw new SocialAuthCustomerError(
      'social_already_linked',
      'This social media account is already registered with another customer account'
    );
  }

  // Server-trust: the affiliate comes from the bag, never the payload (spec §6.3).
  const resolved = await bagClaimService.resolveClaimToken(bagToken);
  if (resolved.state !== 'claimable') {
    throw new SocialAuthCustomerError('bag_not_claimable', 'This bag cannot be claimed', 409);
  }
  const { bag, affiliate } = resolved;

  const { salt, hash } = encryptionUtil.hashPassword(generatedPassword);

  const customer = new Customer({
    affiliateId: affiliate.affiliateId,
    firstName: socialData.firstName,
    lastName: socialData.lastName,
    email: socialData.email,
    phone: rest.phone,
    address: rest.address,
    city: rest.city,
    state: rest.state,
    zipCode: rest.zipCode,
    serviceFrequency: rest.serviceFrequency || 'weekly',
    deliveryInstructions: rest.deliveryInstructions,
    specialInstructions: rest.specialInstructions,
    username,
    passwordSalt: salt,
    passwordHash: hash,
    registrationMethod: socialData.provider,
    socialAccounts: {
      [socialData.provider]: {
        id: socialData.socialId,
        email: socialData.email,
        name: `${socialData.firstName} ${socialData.lastName}`,
        accessToken: socialData.accessToken,
        refreshToken: socialData.refreshToken,
        linkedAt: new Date()
      }
    },
    lastLogin: new Date()
  });

  await customer.save();

  // Save-then-claim with a compensating delete on race loss (spec §13 #4).
  try {
    await bagClaimService.claimForCustomer(bag, customer.customerId);
  } catch (claimErr) {
    await Customer.deleteOne({ _id: customer._id });
    if (claimErr.isClaimError) {
      throw new SocialAuthCustomerError('bag_already_claimed', 'This bag has already been claimed', 409);
    }
    throw claimErr;
  }

  try {
    await emailService.sendCustomerWelcomeEmail(customer);
  } catch (emailError) {
    logger.error('Customer welcome email error:', emailError);
  }

  const token = authTokenService.generateToken({
    id: customer._id,
    customerId: customer.customerId,
    userType: 'customer'
  });
  const refreshToken = await authTokenService.generateRefreshToken({
    userId: customer._id,
    userType: 'customer',
    ip,
    cryptoWrapper
  });

  logAuditEvent(AuditEvents.ACCOUNT_CREATED, {
    action: 'SOCIAL_CUSTOMER_REGISTRATION',
    userId: customer._id,
    userType: 'customer',
    details: {
      customerId: customer.customerId,
      affiliateId: customer.affiliateId,
      provider: socialData.provider,
      registrationMethod: 'social'
    }
  }, req);

  return {
    customerId: customer.customerId,
    customer: {
      id: customer._id,
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      affiliateId: customer.affiliateId,
      registrationMethod: customer.registrationMethod
    },
    token,
    refreshToken,
    expiresIn: '1h'
  };
}

module.exports = {
  completeSocialCustomerRegistration,
  findAvailableCustomerUsername,
  SocialAuthCustomerError
};
