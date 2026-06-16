// Customer claim flow — resolve + register + verification gate (spec §5/§6.3)
//
// The email OTP send is mocked so we can capture the generated 6-digit code.
// firebasePhoneService is mocked per-test for the flag-on path; the flag-off
// path needs no Firebase at all.
jest.mock('../../server/utils/emailService', () => ({
  sendCustomerWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateNewCustomerEmail: jest.fn().mockResolvedValue(true),
  sendCustomerEmailOtp: jest.fn().mockResolvedValue(true)
}));

const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Bag = require('../../server/modules/bags/Bag');
const EmailVerification = require('../../server/models/EmailVerification');
const bagService = require('../../server/modules/bags/bagService');
const firebasePhoneService = require('../../server/services/firebasePhoneService');
const emailService = require('../../server/utils/emailService');
const { hashPassword } = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

// The generated 6-digit code is captured from the mocked OTP send (the factory
// can't safely close over an outer `let`, so we read the call args instead).
function lastSentOtpCode() {
  const calls = emailService.sendCustomerEmailOtp.mock.calls;
  return calls.length ? calls[calls.length - 1][0].code : null;
}

// Run the email-OTP request+verify dance and return the verification token.
async function getEmailVerificationToken(token, email) {
  await request(app).post(`/api/v1/customers/claim/${token}/email-otp/request`).send({ email });
  const verify = await request(app)
    .post(`/api/v1/customers/claim/${token}/email-otp/verify`)
    .send({ email, code: lastSentOtpCode() });
  return verify.body.emailVerificationToken;
}

// Build a register body with a fresh verified email token for the given bag.
async function verifiedBody(token, overrides = {}) {
  const body = registrationBody(overrides);
  body.emailVerificationToken = await getEmailVerificationToken(token, body.email);
  return body;
}

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
    ...overrides
  };
}

describe('Customer claim', () => {
  let affiliate;

  beforeEach(async () => {
    await Affiliate.deleteMany({});
    await Customer.deleteMany({});
    await Bag.deleteMany({});
    await EmailVerification.deleteMany({});
    await require('../../server/models/Order').deleteMany({});
    emailService.sendCustomerEmailOtp.mockClear();
    delete process.env.PHONE_VERIFICATION_ENABLED; // default flag OFF
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

    it("returns 'claimed' with no order context (no open order) and NO customer PII", async () => {
      const token = await issuedBag(affiliate);
      await bagService.claim({ token, customerId: 'CUST-existing' });
      const res = await request(app).get(`/api/v1/customers/claim/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('claimed');
      // PR 9: the order slot carries open-order context; with no open order
      // it is absent (falsy) — full shape pinned in bagResolveContext.test.js.
      expect(res.body.order).toBeFalsy();
      expect(JSON.stringify(res.body)).not.toContain('CUST-existing');
    });

    it("returns 'claimed' with new-vocab order context for a bag with an open order", async () => {
      const Order = require('../../server/models/Order');
      const Bag = require('../../server/modules/bags/Bag');
      const token = await issuedBag(affiliate);
      await bagService.claim({ token, customerId: 'CUST-open' });
      const bag = await Bag.findOne({ tokenHash: Bag.hashToken(token) });
      await Order.create({
        customerId: 'CUST-open', affiliateId: affiliate.affiliateId,
        bagId: bag.bagId, bagToken: token, status: 'pending',
        pickup: { at: new Date(), by: affiliate.affiliateId, role: 'affiliate' }
      });
      const res = await request(app).get(`/api/v1/customers/claim/${token}`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('claimed');
      expect(res.body.order.status).toBe('pending');
      expect(res.body.order.nextAction).toBe('intake');
      expect(JSON.stringify(res.body)).not.toContain('CUST-open');
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
        .send(await verifiedBody(token));
      expect(res.status).toBe(201);
      expect(res.body.customerId).toMatch(/^CUST-/);
      expect(res.body.customerData.affiliateId).toBe(affiliate.affiliateId);

      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.affiliateId).toBe(affiliate.affiliateId);
      expect(customer.emailVerifiedAt).toBeTruthy();
      expect(customer.phoneVerifiedAt).toBeFalsy(); // flag off
      expect(customer.username).toBeUndefined();
      expect(customer.passwordHash).toBeUndefined();
      const bag = await Bag.findOne({ tokenHash: Bag.hashToken(token) });
      expect(bag.status).toBe('active');
      expect(bag.customerId).toBe(res.body.customerId);
      // the single-use OTP record is consumed on success
      expect(await EmailVerification.countDocuments({})).toBe(0);
    });

    it('400s when the emailVerificationToken is missing', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody()); // no emailVerificationToken
      expect(res.status).toBe(400);
      expect(await Customer.countDocuments({})).toBe(0);
    });

    it('400s when the emailVerificationToken is invalid', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody({ emailVerificationToken: 'deadbeef' }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('email_not_verified');
      expect(await Customer.countDocuments({})).toBe(0);
    });

    it('ignores a client-supplied affiliateId (server-trust)', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(await verifiedBody(token, { affiliateId: 'AFF-attacker' }));
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
        .send(await verifiedBody(bags[0].token));
      expect(minted.status).toBe(409);
      const unknown = await request(app)
        .post(`/api/v1/customers/claim/${'f'.repeat(32)}/register`)
        .send(await verifiedBody('f'.repeat(32)));
      expect(unknown.status).toBe(409);
      expect(await Customer.countDocuments({})).toBe(0);
    });

    it('duplicate email fails BEFORE the claim — bag stays issued, no orphan', async () => {
      const token = await issuedBag(affiliate);
      await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(await verifiedBody(token));
      const token2 = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token2}/register`)
        .send(await verifiedBody(token2)); // same email
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('duplicate_email');
      const bag2 = await Bag.findOne({ tokenHash: Bag.hashToken(token2) });
      expect(bag2.status).toBe('issued');
      expect(await Customer.countDocuments({})).toBe(1);
    });

    it('concurrent double-claim: exactly one 201, one 409, no orphan customer', async () => {
      const token = await issuedBag(affiliate);
      const bodyA = await verifiedBody(token, { email: 'racer-a@example.com' });
      const bodyB = await verifiedBody(token, { email: 'racer-b@example.com' });
      const [a, b] = await Promise.all([
        request(app).post(`/api/v1/customers/claim/${token}/register`).send(bodyA),
        request(app).post(`/api/v1/customers/claim/${token}/register`).send(bodyB)
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

    it('the legacy customer-register page is gone (PR 11)', async () => {
      // The page was dead-on-submit once the route above was removed in PR 6;
      // PR 11 retires the HTML + embed route. Stale bookmarks must 404, not
      // serve a form that can never submit.
      const res = await request(app).get('/customer-register-embed.html');
      expect(res.status).toBe(404);
    });
  });

  describe('Email OTP (PR 7)', () => {
    it('request returns generic success and verify mints a token for the right code', async () => {
      const token = await issuedBag(affiliate);
      const reqRes = await request(app)
        .post(`/api/v1/customers/claim/${token}/email-otp/request`)
        .send({ email: 'otp@example.com' });
      expect(reqRes.status).toBe(200);
      expect(reqRes.body.success).toBe(true);

      const verifyRes = await request(app)
        .post(`/api/v1/customers/claim/${token}/email-otp/verify`)
        .send({ email: 'otp@example.com', code: lastSentOtpCode() });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.emailVerificationToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it('verify with the wrong code 400s, then locks out after repeated failures', async () => {
      const token = await issuedBag(affiliate);
      await request(app).post(`/api/v1/customers/claim/${token}/email-otp/request`).send({ email: 'lock@example.com' });

      const bad = await request(app)
        .post(`/api/v1/customers/claim/${token}/email-otp/verify`)
        .send({ email: 'lock@example.com', code: '000000' });
      expect(bad.status).toBe(400);
      expect(bad.body.code).toBe('invalid_code');

      let last;
      for (let i = 0; i < 7; i++) {
        last = await request(app)
          .post(`/api/v1/customers/claim/${token}/email-otp/verify`)
          .send({ email: 'lock@example.com', code: '999999' });
      }
      expect(last.status).toBe(429);
      expect(last.body.code).toBe('locked_out');
    });
  });

  describe('Phone verification flag (PR 7)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      delete process.env.PHONE_VERIFICATION_ENABLED;
    });

    it('flag OFF → email-only, registers without a phoneIdToken, phoneVerifiedAt null', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(await verifiedBody(token)); // no phoneIdToken
      expect(res.status).toBe(201);
      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.phoneVerifiedAt).toBeFalsy();
    });

    it('flag ON + matching E.164 → 201 with phoneVerifiedAt set', async () => {
      process.env.PHONE_VERIFICATION_ENABLED = 'true';
      jest.spyOn(firebasePhoneService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(firebasePhoneService, 'verifyPhoneToken').mockResolvedValue('+15125550101');
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(await verifiedBody(token, { phone: '512-555-0101', phoneIdToken: 'good-token' }));
      expect(res.status).toBe(201);
      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.phoneVerifiedAt).toBeTruthy();
    });

    it('flag ON + phone mismatch → 400 phone_mismatch, no customer', async () => {
      process.env.PHONE_VERIFICATION_ENABLED = 'true';
      jest.spyOn(firebasePhoneService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(firebasePhoneService, 'verifyPhoneToken').mockResolvedValue('+15129999999');
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(await verifiedBody(token, { phone: '512-555-0101', phoneIdToken: 'good-token' }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('phone_mismatch');
      expect(await Customer.countDocuments({})).toBe(0);
    });

    it('flag ON + missing phoneIdToken → 400 phone_not_verified', async () => {
      process.env.PHONE_VERIFICATION_ENABLED = 'true';
      jest.spyOn(firebasePhoneService, 'isEnabled').mockReturnValue(true);
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(await verifiedBody(token)); // no phoneIdToken
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('phone_not_verified');
      expect(await Customer.countDocuments({})).toBe(0);
    });
  });

});
