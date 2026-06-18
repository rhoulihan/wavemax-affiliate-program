// Customer self-service: GET/PATCH /api/v1/customers/me (Edit my info) + the
// phone-change → operator Cents-sync warning surfaced/cleared via the scan flow.
jest.mock('../../server/utils/emailService', () => ({
  sendCustomerWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateNewCustomerEmail: jest.fn().mockResolvedValue(true),
  sendCustomerEmailConfirmation: jest.fn().mockResolvedValue(true),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(true),
  sendCustomerDeliveredEmail: jest.fn().mockResolvedValue(true),
  sendOrderCancellationEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateNewOrderEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateOrderReadyEmail: jest.fn().mockResolvedValue(true)
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Bag = require('../../server/modules/bags/Bag');
const bagService = require('../../server/modules/bags/bagService');
const firebasePhoneService = require('../../server/services/firebasePhoneService');
const emailService = require('../../server/utils/emailService');
const { hashPassword } = require('../../server/utils/encryption');
const { createTestToken } = require('../helpers/authHelper');

function custSession(customerId) {
  return jwt.sign({ scope: 'scan-session', actorType: 'customer', actorId: customerId },
    process.env.JWT_SECRET, { expiresIn: '15m' });
}

async function setup() {
  const { salt, hash } = hashPassword('Pass123!Pass');
  const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const affiliate = await Affiliate.create({
    firstName: 'Self', lastName: 'Svc', email: `selfsvc-${uniq}@example.com`, username: `selfsvc${uniq}`,
    passwordHash: hash, passwordSalt: salt, phone: '+15125550100', address: '1 Main', city: 'Austin',
    state: 'TX', zipCode: '78701', businessName: 'Self Svc Wash', paymentMethod: 'check',
    serviceType: 'pickup_location', pickupInstructions: 'Drop at the desk.'
  });
  const { batchId, bags } = await bagService.mintBatch({ affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id });
  await bagService.issueBatch({ batchId, adminId: affiliate._id });
  const token = bags[0].token;
  const customer = await Customer.create({
    customerId: `CUST-${uniq}`, affiliateId: affiliate.affiliateId, firstName: 'Dana', lastName: 'Doe',
    email: `dana-${uniq}@example.com`, emailVerified: true, phone: '512-555-0101',
    address: '2 Cust St', city: 'Austin', state: 'TX', zipCode: '78702'
  });
  await bagService.claim({ token, customerId: customer.customerId });
  return { affiliate, customer, token };
}

describe('Customer self-service (/customers/me)', () => {
  beforeEach(async () => {
    await Promise.all([Affiliate.deleteMany({}), Customer.deleteMany({}), Bag.deleteMany({}),
      require('../../server/models/Order').deleteMany({})]);
    jest.clearAllMocks();
    delete process.env.PHONE_VERIFICATION_ENABLED;
  });
  afterEach(() => { jest.restoreAllMocks(); delete process.env.PHONE_VERIFICATION_ENABLED; });

  describe('GET /me', () => {
    it('returns the customer contact info for a valid customer session', async () => {
      const { customer } = await setup();
      const res = await request(app).get('/api/v1/customers/me')
        .set('x-scan-session', custSession(customer.customerId));
      expect(res.status).toBe(200);
      expect(res.body.customer.firstName).toBe('Dana');
      expect(res.body.customer.phone).toBeTruthy();
    });

    it('401 without a session', async () => {
      const res = await request(app).get('/api/v1/customers/me');
      expect(res.status).toBe(401);
    });

    it('403 for an operator session (not a customer)', async () => {
      const { customer } = await setup();
      const opToken = createTestToken('507f1f77bcf86cd799439011', 'operator');
      const res = await request(app).get('/api/v1/customers/me').set('Authorization', `Bearer ${opToken}`);
      expect(res.status).toBe(403);
      expect(customer).toBeTruthy();
    });
  });

  describe('PATCH /me', () => {
    it('updates name + address', async () => {
      const { customer } = await setup();
      const res = await request(app).patch('/api/v1/customers/me')
        .set('x-scan-session', custSession(customer.customerId))
        .send({ firstName: 'Daniela', address: '99 New St' });
      expect(res.status).toBe(200);
      const after = await Customer.findOne({ customerId: customer.customerId });
      expect(after.firstName).toBe('Daniela');
      expect(after.address).toBe('99 New St');
    });

    it('email change → unverified + fresh confirm link emailed', async () => {
      const { customer } = await setup();
      const res = await request(app).patch('/api/v1/customers/me')
        .set('x-scan-session', custSession(customer.customerId))
        .send({ email: 'newaddr@example.com' });
      expect(res.status).toBe(200);
      const after = await Customer.findOne({ customerId: customer.customerId });
      expect(after.email).toBe('newaddr@example.com');
      expect(after.emailVerified).toBe(false);
      expect(after.emailVerifyTokenHash).toBeTruthy();
      expect(emailService.sendCustomerEmailConfirmation).toHaveBeenCalledTimes(1);
    });

    it('duplicate email → 400, unchanged', async () => {
      const { customer, affiliate } = await setup();
      await Customer.create({ customerId: 'CUST-other', affiliateId: affiliate.affiliateId,
        firstName: 'O', lastName: 'T', email: 'taken@example.com', phone: '5125559999',
        address: 'a', city: 'Austin', state: 'TX', zipCode: '78701' });
      const res = await request(app).patch('/api/v1/customers/me')
        .set('x-scan-session', custSession(customer.customerId))
        .send({ email: 'taken@example.com' });
      expect(res.status).toBe(400);
    });

    it('phone change (flag OFF) → phone updated + centsSyncNeeded set', async () => {
      const { customer } = await setup();
      const res = await request(app).patch('/api/v1/customers/me')
        .set('x-scan-session', custSession(customer.customerId))
        .send({ phone: '512-555-7777' });
      expect(res.status).toBe(200);
      const after = await Customer.findOne({ customerId: customer.customerId });
      expect(after.phone).toContain('7777');
      expect(after.centsSyncNeeded).toBe(true);
    });

    it('phone change (flag ON) requires a matching phoneIdToken', async () => {
      process.env.PHONE_VERIFICATION_ENABLED = 'true';
      jest.spyOn(firebasePhoneService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(firebasePhoneService, 'verifyPhoneToken').mockResolvedValue('+15125557777');
      const { customer } = await setup();
      // missing token → 400
      const bad = await request(app).patch('/api/v1/customers/me')
        .set('x-scan-session', custSession(customer.customerId))
        .send({ phone: '512-555-7777' });
      expect(bad.status).toBe(400);
      // matching token → 200 + flag
      const ok = await request(app).patch('/api/v1/customers/me')
        .set('x-scan-session', custSession(customer.customerId))
        .send({ phone: '512-555-7777', phoneIdToken: 'good' });
      expect(ok.status).toBe(200);
      const after = await Customer.findOne({ customerId: customer.customerId });
      expect(after.centsSyncNeeded).toBe(true);
      expect(after.phoneVerifiedAt).toBeTruthy();
    });
  });

  describe('operator Cents-sync warning (scan flow)', () => {
    it('after a customer phone change, the operator scan-resolve warns; an operator apply clears it', async () => {
      const { customer, token } = await setup();
      // customer changes their phone (flag off path)
      await request(app).patch('/api/v1/customers/me')
        .set('x-scan-session', custSession(customer.customerId))
        .send({ phone: '512-555-8888' });

      const opToken = createTestToken('507f1f77bcf86cd799439011', 'operator');
      const r1 = await request(app).post('/api/v1/scan/resolve')
        .set('Authorization', `Bearer ${opToken}`).send({ bagToken: token });
      expect(r1.status).toBe(200);
      expect(r1.body.centsSyncNeeded).toBe(true);
      expect(r1.body.customerPhone).toContain('8888');

      // operator applies the resolved action (create-pending) → clears the flag
      await request(app).post('/api/v1/scan/apply')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ bagToken: token, expectedAction: r1.body.proposedAction });
      const after = await Customer.findOne({ customerId: customer.customerId });
      expect(after.centsSyncNeeded).toBe(false);
    });

    it('a CUSTOMER apply (start-only) does NOT clear the warning — only staff do', async () => {
      const { customer, token } = await setup();
      await request(app).patch('/api/v1/customers/me')
        .set('x-scan-session', custSession(customer.customerId))
        .send({ phone: '512-555-8888' });
      // customer self-starts (mint customer session, then apply create-pending)
      const mint = await request(app).post('/api/v1/scan/session')
        .send({ bagToken: token, code: '5125558888' });
      expect(mint.status).toBe(200);
      const sess = mint.body.sessionToken || mint.body.token;
      const resolved = await request(app).post('/api/v1/scan/resolve')
        .set('x-scan-session', sess).send({ bagToken: token });
      await request(app).post('/api/v1/scan/apply')
        .set('x-scan-session', sess)
        .send({ bagToken: token, expectedAction: resolved.body.proposedAction });
      const after = await Customer.findOne({ customerId: customer.customerId });
      expect(after.centsSyncNeeded).toBe(true); // still flagged — operator hasn't handled it
    });
  });
});
