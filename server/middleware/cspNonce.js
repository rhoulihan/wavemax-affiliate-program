// CSP Nonce Middleware for WaveMAX Laundry Affiliate Program

const crypto = require('crypto');

/**
 * Generate a CSP nonce for inline scripts and styles
 */
const generateNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

/**
 * Middleware to add CSP nonce to res.locals
 */
const cspNonce = (req, res, next) => {
  // Generate nonces for scripts and styles
  res.locals.cspNonce = generateNonce();
  res.locals.styleNonce = generateNonce();
  
  // Make nonces available in response headers for client-side use
  res.setHeader('X-CSP-Nonce', res.locals.cspNonce);
  res.setHeader('X-Style-Nonce', res.locals.styleNonce);
  
  next();
};

module.exports = {
  cspNonce,
  generateNonce
};