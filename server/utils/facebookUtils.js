const crypto = require('crypto');
const logger = require('./logger');

/**
 * Parse and verify Facebook signed request
 * @param {string} signedRequest - The signed_request parameter from Facebook
 * @param {string} appSecret - Facebook app secret
 * @returns {Object|null} Parsed payload if valid, null if invalid
 */
function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || !appSecret) {
    logger.error('Missing signed request or app secret');
    return null;
  }

  const parts = signedRequest.split('.');
  if (parts.length !== 2) {
    logger.error('Invalid signed request format');
    return null;
  }

  const [encodedSig, encodedPayload] = parts;

  // Decode payload
  const payload = base64UrlDecode(encodedPayload);

  try {
    // Decode signature as raw bytes
    const sigBuffer = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest();

    // Check if buffers have same length before comparing
    if (sigBuffer.length !== expectedSig.length) {
      logger.error('Invalid signed request signature length');
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedSig)) {
      logger.error('Invalid signed request signature');
      return null;
    }
  } catch (error) {
    logger.error('Error verifying signature:', error);
    return null;
  }

  try {
    // Parse and return payload
    const parsedPayload = JSON.parse(payload);
    logger.info('Successfully parsed Facebook signed request', {
      userId: parsedPayload.user_id,
      algorithm: parsedPayload.algorithm
    });
    return parsedPayload;
  } catch (error) {
    logger.error('Error parsing signed request payload:', error);
    return null;
  }
}

/**
 * Base64 URL decode
 * @param {string} str - Base64 URL encoded string
 * @returns {string} Decoded string
 */
function base64UrlDecode(str) {
  // Add padding if necessary
  const paddingNeeded = (4 - (str.length % 4)) % 4;
  const padded = str + '='.repeat(paddingNeeded);
  
  // Replace URL-safe characters with standard base64 characters
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Generate the status URL for a deletion request
 * @param {string} confirmationCode - The confirmation code
 * @param {string} baseUrl - Base URL of the application
 * @returns {string} Status check URL
 */
function generateStatusUrl(confirmationCode, baseUrl) {
  // Remove trailing slash if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  return `${cleanBaseUrl}/deletion-status?code=${confirmationCode}`;
}

/**
 * Delete Facebook data from user model
 * @param {Object} user - User model instance (Affiliate or Customer)
 * @returns {Array} List of deleted data types
 */
async function deleteFacebookData(user) {
  const deletedData = [];

  if (user.socialAccounts && user.socialAccounts.facebook) {
    // Store what we're deleting for audit
    if (user.socialAccounts.facebook.id) {
      deletedData.push('facebook_id');
    }
    if (user.socialAccounts.facebook.email) {
      deletedData.push('facebook_email');
    }
    if (user.socialAccounts.facebook.name) {
      deletedData.push('facebook_name');
    }
    if (user.socialAccounts.facebook.accessToken) {
      deletedData.push('facebook_access_token');
    }

    // Clear Facebook data
    user.socialAccounts.facebook = {
      id: null,
      email: null,
      name: null,
      accessToken: null,
      linkedAt: null
    };

    // Update registration method if it was Facebook
    if (user.registrationMethod === 'facebook') {
      user.registrationMethod = 'traditional';
      deletedData.push('registration_method');
    }

    // Save the user
    await user.save();
  }

  return deletedData;
}

/**
 * Find users by Facebook ID
 * @param {string} facebookUserId - Facebook user ID
 * @returns {Object} Object containing found affiliate and customer
 */
async function findUsersByFacebookId(facebookUserId) {
  const Affiliate = require('../models/Affiliate');
  const Customer = require('../models/Customer');

  const [affiliate, customer] = await Promise.all([
    Affiliate.findOne({ 'socialAccounts.facebook.id': facebookUserId }),
    Customer.findOne({ 'socialAccounts.facebook.id': facebookUserId })
  ]);

  return { affiliate, customer };
}

/**
 * Anonymize user data instead of deleting account
 * @param {Object} user - User model instance
 * @returns {Array} List of anonymized data types
 */
async function anonymizeUserData(user) {
  const anonymizedData = [];
  const anonymousPrefix = `DELETED_${Date.now()}_`;

  // Anonymize personal data
  if (user.email) {
    user.email = `${anonymousPrefix}@deleted.com`;
    anonymizedData.push('email');
  }

  if (user.name) {
    user.name = `Deleted User ${anonymousPrefix}`;
    anonymizedData.push('name');
  }

  if (user.phone) {
    user.phone = null;
    anonymizedData.push('phone');
  }

  // Clear Facebook data
  if (user.socialAccounts && user.socialAccounts.facebook) {
    user.socialAccounts.facebook = {
      id: null,
      email: null,
      name: null,
      accessToken: null,
      linkedAt: null
    };
    anonymizedData.push('facebook_data');
  }

  // Mark account as inactive
  user.isActive = false;
  user.deletedAt = new Date();

  await user.save();
  return anonymizedData;
}

module.exports = {
  parseSignedRequest,
  base64UrlDecode,
  generateStatusUrl,
  deleteFacebookData,
  findUsersByFacebookId,
  anonymizeUserData
};