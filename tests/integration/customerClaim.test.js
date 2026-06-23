// Customer claim flow — resolve + register + verification gate (spec §5/§6.3)
//
// Verification model (2026-06-17): PHONE is the required verification (when
// PHONE_VERIFICATION_ENABLED is on); EMAIL is an optional, UNVERIFIED field.
// firebasePhoneService is mocked per-test for the flag-on path; the flag-off
// path needs no Firebase at all.
jest.mock('../../server/utils/emailService', () => ({
  sendCustomerWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateNewCustomerEmail: jest.fn().mockResolvedValue(true)
}));
// Geo gate: mock geocodeAddress (no live Google); distanceMiles stays real.
jest.mock('../../server/services/geocodingService', () => {
  const actual = jest.requireActual('../../server/services/geocodingService');
  return { geocodeAddress: jest.fn(), distanceMiles: actual.distanceMiles, isConfigured: jest.fn(() => true) };
});

const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const Bag = require('../../server/modules/bags/Bag');
const bagService = require('../../server/modules/bags/bagService');
const firebasePhoneService = require('../../server/services/firebasePhoneService');
const emailService = require('../../server/utils/emailService');
const { hashPassword } = require('../../server/utils/encryption');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const geocodingService = require('../../server/services/geocodingService');

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
    await require('../../server/models/Order').deleteMany({});
    emailService.sendCustomerWelcomeEmail.mockClear();
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
        .send(registrationBody());
      expect(res.status).toBe(201);
      expect(res.body.customerId).toMatch(/^CUST-/);
      expect(res.body.customerData.affiliateId).toBe(affiliate.affiliateId);

      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.affiliateId).toBe(affiliate.affiliateId);
      expect(customer.email).toBe('newcustomer@example.com'); // stored, not verified
      expect(customer.phoneVerifiedAt).toBeFalsy(); // flag off
      expect(customer.username).toBeUndefined();
      expect(customer.passwordHash).toBeUndefined();
      const bag = await Bag.findOne({ tokenHash: Bag.hashToken(token) });
      expect(bag.status).toBe('active');
      expect(bag.customerId).toBe(res.body.customerId);
    });

    it('register response carries the affiliate serviceType + pickupInstructions (drives the confirmation page)', async () => {
      affiliate.serviceType = 'full_service';
      affiliate.pickupInstructions = 'Leave your bag by the front door; we text when on the way.';
      await affiliate.save();
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody());
      expect(res.status).toBe(201);
      expect(res.body.affiliateData.serviceType).toBe('full_service');
      expect(res.body.affiliateData.pickupInstructions)
        .toBe('Leave your bag by the front door; we text when on the way.');
    });

    it('400s when email is missing (email is required)', async () => {
      const token = await issuedBag(affiliate);
      const body = registrationBody();
      delete body.email;
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(body);
      expect(res.status).toBe(400);
      expect(await Customer.countDocuments({})).toBe(0);
    });

    it('stores the email UNVERIFIED at registration (gated on phone, not email)', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody());
      expect(res.status).toBe(201);
      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.email).toBe('newcustomer@example.com');
      expect(customer.emailVerified).toBe(false);
      expect(customer.emailVerifyTokenHash).toBeTruthy();
    });

    it('the welcome-email confirm link verifies the email (single-use)', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody());
      expect(res.status).toBe(201);
      // the raw confirm token travels only in the welcome email (mocked)
      const call = emailService.sendCustomerWelcomeEmail.mock.calls.at(-1);
      const rawToken = call[2].emailVerifyToken;
      expect(rawToken).toMatch(/^[a-f0-9]{64}$/);

      const v1 = await request(app).get(`/api/v1/customers/verify-email/${rawToken}`);
      expect(v1.status).toBe(200);
      const verified = await Customer.findOne({ customerId: res.body.customerId });
      expect(verified.emailVerified).toBe(true);
      expect(verified.emailVerifiedAt).toBeTruthy();

      // single-use: a second click no longer verifies
      const v2 = await request(app).get(`/api/v1/customers/verify-email/${rawToken}`);
      expect(v2.status).toBe(410);
    });

    it('an unknown confirm token returns 410', async () => {
      const v = await request(app).get(`/api/v1/customers/verify-email/${'0'.repeat(64)}`);
      expect(v.status).toBe(410);
    });

    it('an EXPIRED confirm token returns 410 and does not verify', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody());
      const rawToken = emailService.sendCustomerWelcomeEmail.mock.calls.at(-1)[2].emailVerifyToken;
      // force the token past expiry
      await Customer.updateOne(
        { customerId: res.body.customerId },
        { $set: { emailVerifyTokenExpires: new Date(Date.now() - 1000) } }
      );
      const v = await request(app).get(`/api/v1/customers/verify-email/${rawToken}`);
      expect(v.status).toBe(410);
      const after = await Customer.findOne({ customerId: res.body.customerId });
      expect(after.emailVerified).toBe(false);
    });

    it('400s when the phone is missing (phone is required)', async () => {
      const token = await issuedBag(affiliate);
      const body = registrationBody();
      delete body.phone;
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(body);
      expect(res.status).toBe(400);
      expect(await Customer.countDocuments({})).toBe(0);
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
        .send(registrationBody()); // same email
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('duplicate_email');
      const bag2 = await Bag.findOne({ tokenHash: Bag.hashToken(token2) });
      expect(bag2.status).toBe('issued');
      expect(await Customer.countDocuments({})).toBe(1);
    });

    it('concurrent double-claim: exactly one 201, one 409, no orphan customer', async () => {
      const token = await issuedBag(affiliate);
      const bodyA = registrationBody({ email: 'racer-a@example.com' });
      const bodyB = registrationBody({ email: 'racer-b@example.com' });
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
      const res = await request(app).get('/customer-register-embed.html');
      expect(res.status).toBe(404);
    });
  });

  describe('Phone verification flag', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      delete process.env.PHONE_VERIFICATION_ENABLED;
    });

    it('flag OFF → registers without a phoneIdToken, phoneVerifiedAt null', async () => {
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody()); // no phoneIdToken
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
        .send(registrationBody({ phone: '512-555-0101', phoneIdToken: 'good-token' }));
      expect(res.status).toBe(201);
      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.phoneVerifiedAt).toBeTruthy();
    });

    it('flag ON + matching phone → 201; email stored unverified (gate is phone, not email)', async () => {
      process.env.PHONE_VERIFICATION_ENABLED = 'true';
      jest.spyOn(firebasePhoneService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(firebasePhoneService, 'verifyPhoneToken').mockResolvedValue('+15125550101');
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody({ phone: '512-555-0101', phoneIdToken: 'good-token' }));
      expect(res.status).toBe(201);
      const customer = await Customer.findOne({ customerId: res.body.customerId });
      expect(customer.email).toBe('newcustomer@example.com');
      expect(customer.emailVerified).toBe(false);
      expect(customer.phoneVerifiedAt).toBeTruthy();
    });

    it('flag ON + phone mismatch → 400 phone_mismatch, no customer', async () => {
      process.env.PHONE_VERIFICATION_ENABLED = 'true';
      jest.spyOn(firebasePhoneService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(firebasePhoneService, 'verifyPhoneToken').mockResolvedValue('+15129999999');
      const token = await issuedBag(affiliate);
      const res = await request(app)
        .post(`/api/v1/customers/claim/${token}/register`)
        .send(registrationBody({ phone: '512-555-0101', phoneIdToken: 'good-token' }));
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
        .send(registrationBody()); // no phoneIdToken
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('phone_not_verified');
      expect(await Customer.countDocuments({})).toBe(0);
    });
  });

  it('claim confirmation returns the partner OWN delivery fee, not the SystemConfig default', async () => {
    affiliate.deliveryFee = 8; // partner's own flat fee
    await affiliate.save();
    const token = await issuedBag(affiliate);
    const res = await request(app).post(`/api/v1/customers/claim/${token}/register`).send(registrationBody());
    expect(res.status).toBe(201);
    expect(res.body.affiliateData.deliveryFee).toBe(8); // not the $10 default
  });

  describe('geo radius gate (partner opt-in)', () => {
    beforeEach(() => {
      geocodingService.geocodeAddress.mockReset();
      jest.spyOn(firebasePhoneService, 'isEnabled').mockReturnValue(false); // phone-verify off for these
    });

    async function enableGeo(radiusMiles) {
      affiliate.geoValidationEnabled = true;
      affiliate.geoRadiusMiles = radiusMiles;
      affiliate.geoLat = 30.2672;        // partner pre-geocoded (fresh) — no re-geocode needed
      affiliate.geoLng = -97.7431;
      affiliate.geocodedAt = new Date();
      await affiliate.save();
    }

    it('allows registration when the customer address is within the radius', async () => {
      await enableGeo(10);
      geocodingService.geocodeAddress.mockResolvedValue({ ok: true, lat: 30.27, lng: -97.74 }); // ~same point
      const token = await issuedBag(affiliate);
      const res = await request(app).post(`/api/v1/customers/claim/${token}/register`).send(registrationBody());
      expect(res.status).toBe(201);
      expect(await Customer.countDocuments({})).toBe(1);
    });

    it('blocks registration when the customer address is outside the radius (422)', async () => {
      await enableGeo(10);
      geocodingService.geocodeAddress.mockResolvedValue({ ok: true, lat: 31.5, lng: -97.7431 }); // ~85 mi north
      const token = await issuedBag(affiliate);
      const res = await request(app).post(`/api/v1/customers/claim/${token}/register`).send(registrationBody());
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('outside_service_area');
      expect(await Customer.countDocuments({})).toBe(0); // nothing created on rejection
    });

    it('bypasses the gate when geo validation is disabled (default)', async () => {
      const token = await issuedBag(affiliate); // affiliate.geoValidationEnabled defaults false
      const res = await request(app).post(`/api/v1/customers/claim/${token}/register`).send(registrationBody());
      expect(res.status).toBe(201);
      expect(geocodingService.geocodeAddress).not.toHaveBeenCalled();
    });

    it('fails OPEN (allows) when customer geocoding errors', async () => {
      await enableGeo(10);
      geocodingService.geocodeAddress.mockResolvedValue({ ok: false, reason: 'request_failed' });
      const token = await issuedBag(affiliate);
      const res = await request(app).post(`/api/v1/customers/claim/${token}/register`).send(registrationBody());
      expect(res.status).toBe(201);
      expect(await Customer.countDocuments({})).toBe(1);
    });
  });

});
