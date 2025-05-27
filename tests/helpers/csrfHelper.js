const request = require('supertest');

/**
 * Helper to get CSRF token from the server
 * @param {Object} app - Express app instance
 * @param {Object} agent - Supertest agent with session
 * @returns {Promise<string>} CSRF token
 */
async function getCsrfToken(app, agent) {
  const response = await agent
    .get('/api/csrf-token')
    .expect(200);

  return response.body.csrfToken;
}

/**
 * Create a supertest agent with session support
 * @param {Object} app - Express app instance
 * @returns {Object} Supertest agent
 */
function createAgent(app) {
  return request.agent(app);
}

module.exports = {
  getCsrfToken,
  createAgent
};