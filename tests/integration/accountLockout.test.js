// Per-account login lockout for Affiliate + Customer.
//
// Mirrors the existing Administrator lockout pattern (5 failed attempts in
// the window → 2h lock; success resets the counter). Closes finding H-5
// from docs/security/prod-lockdown-2026-05-20.md — credential-stuffing
// from a rotating IP pool previously had no per-account ceiling.

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const encryptionUtil = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const { getStrongPassword } = require('../helpers/testPasswords');

jest.setTimeout(90000);

describe('Per-account login lockout (H-5)', () => {
  let agent, csrfToken;

  beforeEach(async () => {
    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
  });

  describe('Affiliate', () => {
    const username = 'lockout-test-aff';
    const goodPassword = getStrongPassword('affiliate-lockout', 1);

    async function createAffiliate() {
      const { hash, salt } = encryptionUtil.hashPassword(goodPassword);
      await Affiliate.create({
        affiliateId: 'AFF-LOCKOUT-1',
        firstName: 'Lock', lastName: 'Test',
        email: 'lockout-aff@example.com',
        phone: '512-555-0001',
        username,
        passwordSalt: salt,
        passwordHash: hash,
        businessName: 'Test', address: '1 Test', city: 'Austin',
        state: 'TX', zipCode: '78753',
        minimumDeliveryFee: 25, perBagDeliveryFee: 5,
        paymentMethod: 'check',
        registrationMethod: 'traditional',
        languagePreference: 'en',
        isActive: true
      });
    }

    async function attemptLogin(password) {
      return agent.post('/api/v1/auth/affiliate/login')
        .set('x-csrf-token', csrfToken)
        .send({ username, password });
    }

    it('locks the account after 5 failed attempts', async () => {
      await createAffiliate();

      // 5 failures
      for (let i = 1; i <= 5; i++) {
        const r = await attemptLogin('wrong-password');
        expect(r.status).toBe(401);
      }

      // 6th attempt — even with the CORRECT password — should be rejected
      // with 403 "Account is locked".
      const r = await attemptLogin(goodPassword);
      expect(r.status).toBe(403);
      expect(r.body.message).toMatch(/locked/i);

      // Model state: lockUntil should be in the future
      const fresh = await Affiliate.findOne({ username });
      expect(fresh.lockUntil).toBeInstanceOf(Date);
      expect(fresh.lockUntil.getTime()).toBeGreaterThan(Date.now());
      expect(fresh.loginAttempts).toBeGreaterThanOrEqual(5);
    });

    it('does not lock when correct password is given before the threshold', async () => {
      await createAffiliate();

      // 4 failures then success — should NOT lock
      for (let i = 1; i <= 4; i++) await attemptLogin('wrong');
      const good = await attemptLogin(goodPassword);
      expect(good.status).toBe(200);

      const fresh = await Affiliate.findOne({ username });
      expect(fresh.lockUntil).toBeFalsy();
      expect(fresh.loginAttempts).toBe(0); // reset on success
    });

    it('resetLoginAttempts() clears both fields', async () => {
      await createAffiliate();
      const aff = await Affiliate.findOne({ username });
      await aff.incLoginAttempts();
      await aff.incLoginAttempts();
      await aff.incLoginAttempts();

      const after3 = await Affiliate.findOne({ username });
      expect(after3.loginAttempts).toBe(3);

      await after3.resetLoginAttempts();
      const final = await Affiliate.findOne({ username });
      expect(final.loginAttempts).toBe(0);
      expect(final.lockUntil).toBeFalsy();
    });
  });

  describe('Customer', () => {
    const username = 'lockout-test-cust';
    const goodPassword = getStrongPassword('customer-lockout', 1);

    async function createCustomer() {
      const { hash, salt } = encryptionUtil.hashPassword(goodPassword);
      await Customer.create({
        customerId: 'CUST-LOCKOUT-1',
        affiliateId: 'AFF-LOCKOUT-1',
        firstName: 'Lock', lastName: 'Cust',
        email: 'lockout-cust@example.com',
        phone: '512-555-0002',
        username,
        passwordSalt: salt,
        passwordHash: hash,
        address: '1 Test', city: 'Austin',
        state: 'TX', zipCode: '78753',
        serviceFrequency: 'weekly',
        registrationMethod: 'traditional',
        languagePreference: 'en',
        isActive: true
      });
    }

    async function attemptLogin(password) {
      return agent.post('/api/v1/auth/customer/login')
        .set('x-csrf-token', csrfToken)
        .send({ username, password });
    }

    it('locks the customer account after 5 failed attempts', async () => {
      await createCustomer();

      for (let i = 1; i <= 5; i++) {
        const r = await attemptLogin('wrong');
        expect(r.status).toBe(401);
      }

      const r = await attemptLogin(goodPassword);
      expect(r.status).toBe(403);
      expect(r.body.message).toMatch(/locked/i);

      const fresh = await Customer.findOne({ username });
      expect(fresh.lockUntil).toBeInstanceOf(Date);
      expect(fresh.loginAttempts).toBeGreaterThanOrEqual(5);
    });

    it('does not lock when correct password is given before the threshold', async () => {
      await createCustomer();
      for (let i = 1; i <= 4; i++) await attemptLogin('wrong');
      const good = await attemptLogin(goodPassword);
      expect(good.status).toBe(200);

      const fresh = await Customer.findOne({ username });
      expect(fresh.lockUntil).toBeFalsy();
      expect(fresh.loginAttempts).toBe(0);
    });
  });
});
