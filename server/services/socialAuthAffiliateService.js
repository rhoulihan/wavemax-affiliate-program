// Affiliate social-auth service
//
// Business logic for the affiliate OAuth flow. The callback handler
// (handleSocialCallback) stays in authController because it's mostly HTTP
// plumbing — popup HTML, redirect URLs, postMessage. The pieces that do
// real work — validating the 15-minute social token, generating a unique
// username, creating the affiliate, and polling the OAuthSession cache —
// land here.

const jwt = require('jsonwebtoken');
const Affiliate = require('../models/Affiliate');
const OAuthSession = require('../models/OAuthSession');
const emailService = require('../utils/emailService');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const { sanitizeInput } = require('../middleware/sanitization');
const authTokenService = require('./authTokenService');
const logger = require('../utils/logger');

class SocialAuthAffiliateError extends Error {
  constructor(code, message, status = 400, extras = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.extras = extras;
    this.isSocialAuthAffiliateError = true;
  }
}

function verifySocialToken(socialToken) {
  let socialData;
  try {
    socialData = jwt.verify(socialToken, process.env.JWT_SECRET);
    socialData = sanitizeInput(socialData);
    // Sanitization could strip everything if the provider data was junk —
    // require the essentials before we try to build an affiliate.
    if (!socialData.firstName || !socialData.lastName || !socialData.email) {
      throw new SocialAuthAffiliateError('invalid_profile', 'Invalid social profile data');
    }
    return socialData;
  } catch (error) {
    if (error.isSocialAuthAffiliateError) throw error;
    throw new SocialAuthAffiliateError(
      'invalid_token',
      'Invalid or expired social authentication token'
    );
  }
}

async function findAvailableUsername(socialData) {
  const base = (socialData.firstName + socialData.lastName)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  let candidate = base;
  let counter = 1;
  while (await Affiliate.findOne({ username: candidate })) {
    candidate = `${base}${counter}`;
    counter++;
  }
  return candidate;
}

async function completeSocialRegistration({ payload, ip, cryptoWrapper, req }) {
  const { socialToken, ...rest } = payload;
  const socialData = verifySocialToken(socialToken);

  const username = await findAvailableUsername(socialData);
  // Random password that satisfies validation but is never shown to the user —
  // they'll authenticate via OAuth going forward.
  const generatedPassword = cryptoWrapper.randomBytes(32).toString('hex') + 'A1!';

  const existing = await Affiliate.findOne({
    $or: [{ email: socialData.email }, { username }]
  });
  if (existing) {
    throw new SocialAuthAffiliateError(
      'duplicate_account',
      'Email or username already exists',
      409
    );
  }

  const socialAccountKey = `socialAccounts.${socialData.provider}.id`;
  const existingSocial = await Affiliate.findOne({
    [socialAccountKey]: socialData.socialId
  });
  if (existingSocial) {
    throw new SocialAuthAffiliateError(
      'social_already_linked',
      'This social media account is already registered with another affiliate account'
    );
  }

  const affiliate = new Affiliate({
    firstName: socialData.firstName,
    lastName: socialData.lastName,
    email: socialData.email,
    phone: rest.phone,
    businessName: rest.businessName,
    address: rest.address,
    city: rest.city,
    state: rest.state,
    zipCode: rest.zipCode,
    serviceLatitude: rest.serviceLatitude,
    serviceLongitude: rest.serviceLongitude,
    serviceRadius: rest.serviceRadius,
    minimumDeliveryFee: rest.minimumDeliveryFee || 25,
    perBagDeliveryFee: rest.perBagDeliveryFee || 5,
    username,
    password: generatedPassword,
    paymentMethod: rest.paymentMethod,
    accountNumber: rest.accountNumber,
    routingNumber: rest.routingNumber,
    paypalEmail: rest.paypalEmail,
    languagePreference: rest.languagePreference || 'en',
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

  await affiliate.save();

  // Best-effort: never fail registration on a welcome-email hiccup.
  try {
    await emailService.sendAffiliateWelcomeEmail(affiliate);
  } catch (emailError) {
    logger.error('Welcome email error:', emailError);
  }

  const token = authTokenService.generateToken({
    id: affiliate._id,
    affiliateId: affiliate.affiliateId,
    userType: 'affiliate'
  });
  const refreshToken = await authTokenService.generateRefreshToken({
    userId: affiliate._id,
    userType: 'affiliate',
    ip,
    cryptoWrapper
  });

  logAuditEvent(AuditEvents.ACCOUNT_CREATED, {
    action: 'SOCIAL_REGISTRATION',
    userId: affiliate._id,
    userType: 'affiliate',
    details: {
      affiliateId: affiliate.affiliateId,
      provider: socialData.provider,
      registrationMethod: 'social'
    }
  }, req);

  return {
    affiliateId: affiliate.affiliateId,
    affiliate: {
      id: affiliate._id,
      affiliateId: affiliate.affiliateId,
      firstName: affiliate.firstName,
      lastName: affiliate.lastName,
      email: affiliate.email,
      registrationMethod: affiliate.registrationMethod
    },
    token,
    refreshToken,
    expiresIn: '1h'
  };
}

async function pollOAuthSession({ sessionId }) {
  if (!sessionId) {
    throw new SocialAuthAffiliateError('missing_session_id', 'Session ID is required');
  }

  logger.info('[OAuth] pollOAuthSession called for sessionId:', sessionId);
  const result = await OAuthSession.consumeSession(sessionId);

  logger.info('OAuth Session Polling Debug:', {
    sessionId,
    sessionResult: result ? 'found' : 'not found',
    resultData: result
  });

  if (!result) {
    throw new SocialAuthAffiliateError('session_not_found', 'Session not found or expired', 404);
  }

  return result;
}

module.exports = {
  completeSocialRegistration,
  pollOAuthSession,
  verifySocialToken,
  findAvailableUsername,
  SocialAuthAffiliateError
};
