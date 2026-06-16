// Customer registration service
//
// Claim-based registration (spec §6.3): the customer registers by scanning a
// durable bag's QR. The affiliate is derived server-side from the bag —
// never from client input. Order of operations for the claim race: save the
// customer, then claim; on race loss, compensating delete (no Mongo
// transaction — standalone-mongod portable, spec §13 #4).
//
// PR 7 — verification gate (spec §5): the email is ALWAYS re-verified
// server-side via a one-time emailVerificationToken minted by the email OTP
// flow. When PHONE_VERIFICATION_ENABLED is on, the Firebase phone ID token is
// re-verified and the returned E.164 must match the entered phone; off → phone
// is collected but not verified. Phase 1 has no customer login, so no username
// or password is stored.

const { v4: uuidv4 } = require('uuid');

const Customer = require('../models/Customer');
const bagClaimService = require('./bagClaimService');
const emailService = require('../utils/emailService');
const emailOtpService = require('./emailOtpService');
const firebasePhoneService = require('./firebasePhoneService');
const Formatters = require('../utils/formatters');
const logger = require('../utils/logger');

/**
 * Error type used to communicate expected failures (duplicate email, bag not
 * claimable, unverified contact, etc.) back to the HTTP layer. The controller
 * maps these to JSON error responses; unexpected failures bubble up normally.
 */
class RegistrationError extends Error {
  constructor(code, message, extras = {}) {
    super(message);
    this.code = code;        // 'bag_not_claimable' | 'bag_already_claimed' | 'duplicate_email' | 'email_not_verified' | 'phone_not_verified' | 'phone_mismatch'
    this.status = extras.status || 400;
    this.extras = extras;
    this.isRegistrationError = true;
  }
}

/**
 * Register a new customer against a scanned bag token.
 * Returns `{ customer, affiliate, bag }` on success, or throws a
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
    emailVerificationToken,
    phoneIdToken,
    languagePreference
  } = payload;

  // Server-trust: the affiliate comes from the bag, never the payload.
  const resolved = await bagClaimService.resolveClaimToken(bagToken);
  if (resolved.state !== 'claimable') {
    throw new RegistrationError('bag_not_claimable', 'This bag cannot be claimed', {
      status: 409, state: resolved.state
    });
  }
  const { bag, affiliate } = resolved;

  const existingEmail = await Customer.findOne({ email: String(email || '').toLowerCase() });
  if (existingEmail) {
    throw new RegistrationError('duplicate_email', 'Email already registered', { field: 'email' });
  }

  // --- Email verification (always required) --------------------------------
  // Re-verify the one-time token server-side; the client cannot self-assert.
  const emailVerified = await emailOtpService.consumeVerification({
    bagToken, email, verificationToken: emailVerificationToken
  });
  if (!emailVerified) {
    throw new RegistrationError('email_not_verified', 'Email not verified', { field: 'email' });
  }
  const emailVerifiedAt = new Date();

  // --- Phone verification (gated by the feature flag) ----------------------
  let phoneVerifiedAt = null;
  if (firebasePhoneService.isEnabled()) {
    if (!phoneIdToken) {
      throw new RegistrationError('phone_not_verified', 'Phone not verified', { field: 'phone' });
    }
    let verifiedPhone;
    try {
      verifiedPhone = await firebasePhoneService.verifyPhoneToken(phoneIdToken);
    } catch (err) {
      logger.warn('Phone token verification failed', { error: err.message });
      throw new RegistrationError('phone_not_verified', 'Phone not verified', { field: 'phone' });
    }
    // The Firebase-verified E.164 must match the entered phone.
    if (Formatters.e164(phone, 'us') !== Formatters.e164(verifiedPhone, 'us')) {
      throw new RegistrationError('phone_mismatch', 'Phone number does not match the verified number', { field: 'phone' });
    }
    phoneVerifiedAt = new Date();
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
    emailVerifiedAt,
    phoneVerifiedAt,
    languagePreference: languagePreference || 'en'
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

  // The single-use email OTP record is no longer needed.
  try {
    await emailOtpService.clearVerification({ bagToken, email });
  } catch (err) {
    logger.warn('Failed to clear email verification record', { error: err.message });
  }

  // Emails are best-effort — never fail registration on SMTP hiccup.
  await sendWelcomeEmails(newCustomer, affiliate);

  return { customer: newCustomer, affiliate, bag: claimedBag };
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
