// Read-only token guard for the Order Expediter API (PR D).
//
// The always-on in-store display authenticates with EXPEDITER_TOKEN, supplied
// as ?k=<token> (the display opens one URL) or the x-expediter-token header.
// Read-only: this guards a GET stats endpoint only — it can never scan or mutate.
// Constant-time compare to avoid leaking the token via timing.

const crypto = require('crypto');

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false; // length isn't secret; bail before timingSafeEqual
  return crypto.timingSafeEqual(ab, bb);
}

module.exports = function expediterGuard(req, res, next) {
  const token = process.env.EXPEDITER_TOKEN;
  if (!token) {
    return res.status(503).json({ success: false, message: 'Expediter is not configured' });
  }
  const provided = (req.query && req.query.k) ||
    (req.headers && req.headers['x-expediter-token']) || '';
  if (!safeEqual(String(provided), token)) {
    return res.status(401).json({ success: false, message: 'Expediter authorization required' });
  }
  return next();
};
