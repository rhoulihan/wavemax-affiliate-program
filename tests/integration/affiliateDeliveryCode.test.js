jest.mock('../../server/utils/emailService');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

jest.setTimeout(60000);

async function createAffiliate(overrides = {}) {
  const { salt, hash } = encryptionUtil.hashPassword('TestPassword417!');
  return Affiliate.create({
    firstName: 'Del', lastName: 'Iverer',
    email: `aff${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`,
    phone: '5125551234', businessName: 'Del Iverer LLC',
    address: '2 Main St', city: 'Austin', state: 'TX', zipCode: '78701',
    serviceLatitude: 30.27, serviceLongitude: -97.74, // ignored if PR 2 removed them
    username: `affuser${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    passwordSalt: salt, passwordHash: hash, paymentMethod: 'check',
    ...overrides
  });
}

function affiliateToken(affiliate) {
  return jwt.sign(
    { id: affiliate._id.toString(), affiliateId: affiliate.affiliateId, role: 'affiliate' },
    process.env.JWT_SECRET, { expiresIn: '1h' }
  );
}

describe('Affiliate delivery code', () => {
  test('invited registration provisions the code and returns it once', async () => {
    const rawInvite = encryptionUtil.generateToken(32);
    await AffiliateInvite.create({
      inviteId: `INV-test-${Date.now()}`,
      tokenHash: AffiliateInvite.hashToken(rawInvite),
      email: 'invited.affiliate@example.com',
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      createdBy: new mongoose.Types.ObjectId()
    });

    const res = await request(app)
      .post('/api/v1/affiliates/register')
      .send({
        inviteToken: rawInvite,
        firstName: 'Invited', lastName: 'Affiliate',
        email: 'tampered@example.com', // ignored — invite email wins (PR 5)
        phone: '5125550000', businessName: 'Invited LLC',
        address: '3 Main St', city: 'Austin', state: 'TX', zipCode: '78701',
        serviceLatitude: 30.27, serviceLongitude: -97.74,
        username: `invited${Date.now()}`,
        password: 'StrongPassword417!',
        paymentMethod: 'check',
        languagePreference: 'en'
      });

    expect(res.status).toBe(201);
    expect(res.body.deliveryCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

    const saved = await Affiliate.findOne({ email: 'invited.affiliate@example.com' })
      .select('+affiliateDeliveryCodeHash');
    expect(saved).toBeTruthy();
    expect(roleCodes.verifyCode(res.body.deliveryCode, saved.affiliateDeliveryCodeHash)).toBe(true);
    expect(saved.affiliateDeliveryCodeSetAt).toBeInstanceOf(Date);
  });

  test('GET /delivery-code returns status for self, 403 for another affiliate', async () => {
    const affiliate = await createAffiliate({
      affiliateDeliveryCodeHash: roleCodes.hashCode('CODE99'),
      affiliateDeliveryCodeSetAt: new Date()
    });
    const other = await createAffiliate();

    const ok = await request(app)
      .get(`/api/v1/affiliates/${affiliate.affiliateId}/delivery-code`)
      .set('Authorization', `Bearer ${affiliateToken(affiliate)}`);
    expect(ok.status).toBe(200);
    expect(ok.body.deliveryCodeSet).toBe(true);
    expect(JSON.stringify(ok.body)).not.toContain('CODE99');

    const forbidden = await request(app)
      .get(`/api/v1/affiliates/${affiliate.affiliateId}/delivery-code`)
      .set('Authorization', `Bearer ${affiliateToken(other)}`);
    expect(forbidden.status).toBe(403);
  });

  test('POST /delivery-code/reset regenerates, returns plaintext once, kills the old code', async () => {
    const affiliate = await createAffiliate({
      affiliateDeliveryCodeHash: roleCodes.hashCode('OLDCDE'),
      affiliateDeliveryCodeSetAt: new Date(Date.now() - 1000)
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post(`/api/v1/affiliates/${affiliate.affiliateId}/delivery-code/reset`)
      .set('Authorization', `Bearer ${affiliateToken(affiliate)}`)
      .set('x-csrf-token', csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.deliveryCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

    const reloaded = await Affiliate.findOne({ affiliateId: affiliate.affiliateId })
      .select('+affiliateDeliveryCodeHash');
    expect(roleCodes.verifyCode(res.body.deliveryCode, reloaded.affiliateDeliveryCodeHash)).toBe(true);
    expect(roleCodes.verifyCode('OLDCDE', reloaded.affiliateDeliveryCodeHash)).toBe(false);
  });
});
