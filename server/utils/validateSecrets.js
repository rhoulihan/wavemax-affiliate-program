// Boot-time secret validation. Pure + env-injectable so it's unit-testable;
// server.js calls it in production and process.exit(1)s on any problem, so a
// missing/short secret surfaces at startup instead of silently falling back to
// a dev default (session/preview HMAC) or blowing up on the first AES encrypt.
/**
 * @param {object} env - environment object (defaults to process.env)
 * @returns {string[]} list of problems; empty = all required secrets valid
 */
function validateRequiredSecrets(env = process.env) {
  const problems = [];
  if (!env.JWT_SECRET) problems.push('JWT_SECRET is required');
  if (!env.SESSION_SECRET) problems.push('SESSION_SECRET is required');
  if (!/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY || '')) {
    problems.push('ENCRYPTION_KEY must be exactly 64 hex characters');
  }
  return problems;
}

module.exports = { validateRequiredSecrets };
