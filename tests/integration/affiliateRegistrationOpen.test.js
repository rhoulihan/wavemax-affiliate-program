// PR 2: affiliate registration is temporarily OPEN — the BetaRequest gate is
// removed here; PR 5 replaces it with the invite gate (PR 5 Task 6.6b DELETES
// this file — its no-invite-201 purpose inverts when the gate lands).
const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const { getStrongPassword } = require('../helpers/testPasswords');

describe('Affiliate registration without a beta request (gate removed)', () => {
  beforeEach(async () => {
    await Affiliate.deleteMany({});
  });

  it('registers an affiliate whose email has no BetaRequest row', async () => {
    const res = await request(app)
      .post('/api/v1/affiliates/register')
      .send({
        firstName: 'Open',
        lastName: 'Gate',
        email: 'open.gate@example.com',
        phone: '512-555-0100',
        businessName: 'Open Gate Laundry',
        address: '123 Congress Ave',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        username: 'opengate',
        // 'SecurePass123!' fails the sequential-character password rule;
        // use the shared strong-password helper like the other suites.
        password: getStrongPassword('affiliate', 2),
        paymentMethod: 'check',
        languagePreference: 'en'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.affiliateId).toMatch(/^AFF-/);
  });
});
