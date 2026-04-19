// Password reset service
//
// Unified forgot-password / reset-password flow across all four user types.
// Token is generated with the injected cryptoWrapper (so the auth
// controller's test seam keeps working), hashed with SHA-256 before being
// stored, and compared against the stored hash on reset. 1-hour TTL.
//
// Operators don't have passwords (PIN-based) — resetPassword rejects them.
// Administrators use the model's pre-save bcrypt hook; affiliates/customers
// get PBKDF2 via encryptionUtil.

const crypto = require('crypto');
const Affiliate = require('../models/Affiliate');
const Customer = require('../models/Customer');
const Administrator = require('../models/Administrator');
const Operator = require('../models/Operator');
const encryptionUtil = require('../utils/encryption');
const emailService = require('../utils/emailService');

const USER_TYPES = ['affiliate', 'customer', 'administrator', 'operator'];

const MODEL_BY_USER_TYPE = {
  affiliate: Affiliate,
  customer: Customer,
  administrator: Administrator,
  operator: Operator
};

const RESET_EMAIL_SENDERS = {
  affiliate: 'sendAffiliatePasswordResetEmail',
  customer: 'sendCustomerPasswordResetEmail',
  administrator: 'sendAdministratorPasswordResetEmail',
  operator: 'sendOperatorPasswordResetEmail'
};

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

class PasswordResetError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isPasswordResetError = true;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function forgotPassword({ email, userType, cryptoWrapper }) {
  if (!email || !userType) {
    throw new PasswordResetError('missing_fields', 'Email and user type are required');
  }
  if (!USER_TYPES.includes(userType)) {
    throw new PasswordResetError('invalid_user_type', 'Invalid user type');
  }

  const Model = MODEL_BY_USER_TYPE[userType];
  const user = await Model.findOne({ email });
  if (!user) {
    throw new PasswordResetError(
      'not_found',
      'No account found with that email address',
      404
    );
  }

  const resetToken = cryptoWrapper.randomBytes(32).toString('hex');
  user.resetToken = hashToken(resetToken);
  user.resetTokenExpiry = Date.now() + RESET_TOKEN_TTL_MS;
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&type=${userType}`;
  await emailService[RESET_EMAIL_SENDERS[userType]](user, resetUrl);
}

async function resetPassword({ token, userType, password }) {
  if (!token || !userType || !password) {
    throw new PasswordResetError(
      'missing_fields',
      'Token, user type, and new password are required'
    );
  }
  if (!USER_TYPES.includes(userType)) {
    throw new PasswordResetError('invalid_user_type', 'Invalid user type');
  }

  const Model = MODEL_BY_USER_TYPE[userType];
  const hashedToken = hashToken(token);
  const user = await Model.findOne({
    resetToken: hashedToken,
    resetTokenExpiry: { $gt: Date.now() }
  });
  if (!user) {
    throw new PasswordResetError('invalid_token', 'Invalid or expired token');
  }

  if (userType === 'operator') {
    // Operators authenticate by PIN; there's no password to reset here.
    throw new PasswordResetError(
      'operator_uses_pin',
      'Operators cannot reset passwords. Please contact your supervisor to reset your PIN.'
    );
  }

  if (userType === 'administrator') {
    // Administrator model's pre-save hook bcrypts the plain password.
    user.password = password;
  } else {
    // Affiliates + customers use PBKDF2 via encryptionUtil.
    const { salt, hash } = encryptionUtil.hashPassword(password);
    user.passwordSalt = salt;
    user.passwordHash = hash;
  }

  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();
}

module.exports = {
  forgotPassword,
  resetPassword,
  PasswordResetError,
  RESET_TOKEN_TTL_MS
};
