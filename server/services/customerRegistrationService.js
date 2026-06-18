// Customer registration service
//
// Claim-based registration (spec §6.3): the customer registers by scanning a
// durable bag's QR. The affiliate is derived server-side from the bag —
// never from client input. Order of operations for the claim race: save the
// customer, then claim; on race loss, compensating delete (no Mongo
// transaction — standalone-mongod portable, spec §13 #4).
//
// Verification gate (2026-06-17): PHONE is the required verification — when
// PHONE_VERIFICATION_ENABLED is on, the Firebase phone ID token is re-verified
// and the returned E.164 must match the entered phone. EMAIL is an OPTIONAL,
// UNVERIFIED field (stored as-is when provided; a duplicate is still rejected).
// Phase 1 has no customer login, so no username or password is stored.

const { v4: uuidv4 } = require('uuid');

const Customer = require('../models/Customer');
const bagClaimService = require('./bagClaimService');
const emailService = require('../utils/emailService');
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
    this.code = code;        // 'bag_not_claimable' | 'bag_already_claimed' | 'duplicate_email' | 'phone_not_verified' | 'phone_mismatch'
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

  // --- Email (optional, unverified) ----------------------------------------
  // Normalize when present; reject a duplicate so a provided email stays
  // one-per-customer. Absent email → the field is left unset (sparse index).
  const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
  if (normalizedEmail) {
    const existingEmail = await Customer.findOne({ email: normalizedEmail });
    if (existingEmail) {
      throw new RegistrationError('duplicate_email', 'Email already registered', { field: 'email' });
    }
  }

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
    phone: Formatters.phone(phone, 'us'),
    address,
    city,
    state: state.toUpperCase(),
    zipCode,
    specialInstructions,
    affiliateSpecialInstructions,
    phoneVerifiedAt,
    languagePreference: languagePreference || 'en'
  });
  // Only set email when provided — leaving it undefined keeps the sparse
  // unique index from treating multiple no-email customers as collisions.
  if (normalizedEmail) newCustomer.email = normalizedEmail;

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

  // Emails are best-effort — never fail registration on SMTP hiccup.
  await sendWelcomeEmails(newCustomer, affiliate, bagToken);

  return { customer: newCustomer, affiliate, bag: claimedBag };
}

async function sendWelcomeEmails(customer, affiliate, bagToken) {
  try {
    // bagToken drives the welcome email's "Request a pickup" button (the bag's
    // claim URL = what the QR encodes), so the customer can start an order.
    await emailService.sendCustomerWelcomeEmail(customer, affiliate, { bagToken });
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
