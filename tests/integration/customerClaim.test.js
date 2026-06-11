// Customer claim flow — resolve + register (spec §6.3)
jest.mock('../../server/utils/emailService', () => ({
  sendCustomerWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateNewCustomerEmail: jest.fn().mockResolvedValue(true)
}));

const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Bag = require('../../server/modules/bags/Bag');
const bagService = require('../../server/modules/bags/bagService');
const { hashPassword } = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

async function createAffiliate() {
  const { salt, hash } = hashPassword('TestAffiliatePass123!');
  const affiliate = new Affiliate({
    firstName: 'Claim', lastName: 'Flow',
    email: `claimflow-${Date.now()}@example.com`, username: `claimflow${Date.now()}`,
    passwordHash: hash, passwordSalt: salt,
    phone: '+15125550100', address: '1 Main', city: 'Austin', state: 'TX',
    zipCode: '78701', businessName: 'Claim Flow Wash',
    serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
    serviceRadius: 10, minimumDeliveryFee: 25, perBagDeliveryFee: 5,
    paymentMethod: 'check'
  });
  await affiliate.save();
  return affiliate;
}

async function issuedBag(affiliate) {
  const { batchId, bags } = await bagService.mintBatch({
    affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
  });
  await bagService.issueBatch({ batchId, adminId: affiliate._id });
  return bags[0].token;
}

function registrationBody(overrides = {}) {
  return {
    firstName: 'New', lastName: 'Customer',
    email: 'newcustomer@example.com', phone: '512-555-0101',
    address: '456 Customer St', city: 'Austin', state: 'TX', zipCode: '78702',
    username: 'newclaimcustomer', password: 'SecurePassw0rd!',
    ...overrides
  };
}

describe('Customer claim', () => {
  let affiliate;

  beforeEach(async () => {
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    await Bag.deleteMany({});
    affiliate = await createAffiliate();
  });

  describe('GET /api/v1/customers/claim/:bagToken', () => {
    it("returns 'claimable' + affiliate display data (no PII) for an issued bag", async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app).get(`/api/v1/customers/claim/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('claimable');
      expect(res.body.affiliate.businessName).toBe('Claim Flow Wash');
      expect(JSON.stringify(res.body)).not.toContain(affiliate.email);
    });

    it("returns 'claimed' with a null order slot and NO customer PII", async () => {
      const token = await issuedBag(affiliate);
      await bagService.claim({ token, customerId: 'CUST-existing' });
      const res = await request(app).get(`/api/v1/customers/claim/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('claimed');
      expect(res.body.order).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain('CUST-existing');
    });

    it("returns 'invalid' for unknown and minted tokens with identical bodies", async () => {
      const { bags } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
      });
      const minted = await request(app).get(`/api/v1/customers/claim/${bags[0].token}`);
      const unknown = await request(app).get(`/api/v1/customers/claim/${'f'.repeat(32)}`);
      expect(minted.status).toBe(200);
      expect(minted.body).toEqual(unknown.body);
      expect(minted.body.state).toBe('invalid');
    });
  });

  describe('POST /api/v1/customers/claim/:bagToken/register', () => {
    it('creates the customer, derives the affiliate from the bag, activates the bag', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody());
      expect(res.status).toBe(201);
      expect(res.body.customerId).toMatch(/^CUST-/);
      expect(res.body.customerData.affiliateId).toBe(affiliate.affiliateId);

      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.affiliateId).toBe(affiliate.affiliateId);
      const bag = await Bag.findOne({ tokenHash: Bag.hashToken(token) });
      expect(bag.status).toBe('active');
      expect(bag.customerId).toBe(res.body.customerId);
    });

    it('ignores a client-supplied affiliateId (server-trust)', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody({ affiliateId: 'AFF-attacker' }));
      expect(res.status).toBe(201);
      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.affiliateId).toBe(affiliate.affiliateId);
    });

    it('409s a non-claimable bag (minted) and an unknown token', async () => {
      const { bags } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
      });
      const minted = await request(app)
        .post(`/api/v1/customers/claim/${bags[0].token}/register`)
        .send(registrationBody());
      expect(minted.status).toBe(409);
      const unknown = await request(app)
        .post(`/api/v1/customers/claim/${'f'.repeat(32)}/register`)
        .send(registrationBody());
      expect(unknown.status).toBe(409);
      expect(await Customer.countDocuments({})).toBe(0);
    });

    it('duplicate email fails BEFORE the claim — bag stays issued, no orphan', async () => {
      const token = await issuedBag(affiliate);
      await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody());
      const token2 = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token2}/register`)
        .send(registrationBody({ username: 'differentusername' })); // same email
      expect(res.status).toBe(400);
      const bag2 = await Bag.findOne({ tokenHash: Bag.hashToken(token2) });
      expect(bag2.status).toBe('issued');
      expect(await Customer.countDocuments({})).toBe(1);
    });

    it('concurrent double-claim: exactly one 201, one 409, no orphan customer', async () => {
      const token = await issuedBag(affiliate);
      const [a, b] = await Promise.all([
        request(app).post(`/api/v1/customers/claim/${token}/register`)
          .send(registrationBody({ email: 'racer-a@example.com', username: 'racera' })),
        request(app).post(`/api/v1/customers/claim/${token}/register`)
          .send(registrationBody({ email: 'racer-b@example.com', username: 'racerb' }))
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 409]);
      // compensating delete: the loser's customer must NOT exist
      expect(await Customer.countDocuments({})).toBe(1);
      const bag = await Bag.findOne({ tokenHash: Bag.hashToken(token) });
      const winner = a.status === 201 ? a : b;
      expect(bag.customerId).toBe(winner.body.customerId);
    });

    it('the legacy public registration route is gone', async () => {
      // This task ALSO removes '/api/v1/customers/register' from the CSRF
      // REGISTRATION_ENDPOINTS exemption — a tokenless POST would then 403 on
      // conditionalCsrf's default-enforce branch before routing and never
      // reach the 404 handler. Send a CSRF token so removal genuinely 404s.
      const agent = createAgent(app);
      const csrfToken = await getCsrfToken(app, agent);
      const res = await agent
        .post('/api/v1/customers/register')
        .set('x-csrf-token', csrfToken)
        .send(registrationBody({ affiliateId: affiliate.affiliateId }));
      expect(res.status).toBe(404);
    });
  });
});
