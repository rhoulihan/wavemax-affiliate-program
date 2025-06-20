const jwt = require('jsonwebtoken');

// Create a test JWT token
function createTestToken(userId, role = 'affiliate') {
  return jwt.sign(
    {
      id: userId,
      affiliateId: userId,
      role: role
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

module.exports = {
  createTestToken
};