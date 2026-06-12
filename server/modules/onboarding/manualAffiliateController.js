// manualAffiliateController — admin hand-creates an affiliate account without
// an invite. Primary use: zero-commission 'location' affiliates (WaveMAX-operated
// collection points with a contact where bags are dropped/collected on a
// schedule), but 'standard' is accepted too.
//
// The server provisions BOTH one-time secrets:
//   - a temporary login password (returned once, never logged)
//   - the affiliate delivery code  (returned once, never logged)
// mirroring how invited registration provisions the delivery code (spec §4.6).

const crypto = require('crypto');
const { validationResult } = require('express-validator');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');
const encryptionUtil = require('../../utils/encryption');
const roleCodes = require('../../utils/roleCodes');
const ControllerHelpers = require('../../utils/controllerHelpers');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

// Character sets for the generated temporary password — one draw from each
// guarantees upper/lower/digit/symbol; the rest is uniform over the union.
const PW_SETS = [
  'ABCDEFGHJKMNPQRSTUVWXYZ',
  'abcdefghjkmnpqrstuvwxyz',
  '23456789',
  '!@#$%^*-_+'
];

/**
 * Generate a 16-char temporary password with at least one character from
 * every class (crypto-random, unbiased via crypto.randomInt).
 * @returns {string}
 */
function generateTemporaryPassword() {
  const all = PW_SETS.join('');
  const chars = PW_SETS.map(set => set[crypto.randomInt(set.length)]);
  while (chars.length < 16) {
    chars.push(all[crypto.randomInt(all.length)]);
  }
  // Fisher–Yates so the guaranteed classes aren't always in the lead positions
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * POST /api/v1/administrators/affiliates
 *
 * Create an affiliate manually (no invite). Defaults to affiliateType
 * 'location' (zero-commission collection point) with $0 delivery fees unless
 * fees are provided; accepts 'standard' too.
 *
 * Responds 201 with { affiliateId, temporaryPassword, deliveryCode } — the two
 * secrets are shown exactly once and never logged. 409 on duplicate
 * email/username.
 */
exports.createAffiliateManually = ControllerHelpers.asyncWrapper(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const {
    firstName, lastName, email, phone, businessName,
    address, city, state, zipCode, username, languagePreference,
    affiliateType = 'location',
    minimumDeliveryFee, perBagDeliveryFee
  } = req.body;

  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedUsername = String(username).trim();

  const [existingEmail, existingUsername] = await Promise.all([
    Affiliate.findOne({ email: normalizedEmail }),
    Affiliate.findOne({ username: normalizedUsername })
  ]);
  if (existingEmail || existingUsername) {
    return ControllerHelpers.sendError(
      res,
      existingEmail ? 'Email already registered' : 'Username already taken',
      409,
      [{ code: existingEmail ? 'duplicate_email' : 'duplicate_username' }]
    );
  }

  // One-time secrets — generated server-side, returned once, never logged.
  const temporaryPassword = generateTemporaryPassword();
  const { salt, hash } = encryptionUtil.hashPassword(temporaryPassword);
  const deliveryCodeLength = await SystemConfig.getValue('affiliate_delivery_code_length', 6);
  const deliveryCode = roleCodes.generateCode(deliveryCodeLength);

  // Location affiliates charge no delivery fees unless the admin says otherwise.
  const isLocation = affiliateType === 'location';
  const affiliate = new Affiliate({
    affiliateType,
    firstName, lastName,
    email: normalizedEmail,
    phone, businessName,
    address, city, state, zipCode,
    username: normalizedUsername,
    passwordSalt: salt,
    passwordHash: hash,
    paymentMethod: 'check',
    languagePreference: languagePreference || 'en',
    minimumDeliveryFee: minimumDeliveryFee !== undefined
      ? parseFloat(minimumDeliveryFee)
      : (isLocation ? 0 : undefined),
    perBagDeliveryFee: perBagDeliveryFee !== undefined
      ? parseFloat(perBagDeliveryFee)
      : (isLocation ? 0 : undefined),
    affiliateDeliveryCodeHash: roleCodes.hashCode(deliveryCode),
    affiliateDeliveryCodeSetAt: new Date()
  });

  try {
    await affiliate.save();
  } catch (err) {
    if (err && err.code === 11000) {
      // Unique-index backstop for a create race
      return ControllerHelpers.sendError(res, 'Email or username already in use', 409,
        [{ code: 'duplicate' }]);
    }
    throw err;
  }

  logAuditEvent(AuditEvents.AFFILIATE_CREATED_MANUALLY, {
    adminId: req.user.id,
    affiliateId: affiliate.affiliateId,
    affiliateType,
    email: normalizedEmail
  }, req);
  logger.info('Affiliate created manually by administrator', {
    affiliateId: affiliate.affiliateId, affiliateType
  });

  return res.status(201).json({
    success: true,
    affiliateId: affiliate.affiliateId,
    affiliateType,
    temporaryPassword, // shown exactly once
    deliveryCode,      // shown exactly once
    message: 'Affiliate created successfully'
  });
});
