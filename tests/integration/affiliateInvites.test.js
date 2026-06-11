jest.setTimeout(90000);

// Mock the invite email dispatcher BEFORE requiring the app.
jest.mock('../../server/services/email/dispatcher/onboarding', () => ({
  sendAffiliateInviteEmail: jest.fn().mockResolvedValue(true)
}));

const mongoose = require('mongoose');
const app = require('../../server');
const Administrator = require('../../server/models/Administrator');
const Affiliate = require('../../server/models/Affiliate');
const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');
const encryptionUtil = require('../../server/utils/encryption');
const { createTestToken } = require('../helpers/authHelper');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');
const onboardingEmail = require('../../server/services/email/dispatcher/onboarding');

describe('Affiliate invites API', () => {
  let agent;
  let csrfToken;
  let admin;
  let adminToken;
  let limitedAdminToken;

  // Direct-DB invite factory (skips the admin API; used by validate/register tests)
  const seedInvite = async (overrides = {}) => {
    const raw = encryptionUtil.generateToken(32);
    const invite = await AffiliateInvite.create({
      tokenHash: AffiliateInvite.hashToken(raw),
      email: 'invitee@example.com',
      prefill: { firstName: 'Ina', lastName: 'Vite' },
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      createdBy: new mongoose.Types.ObjectId(),
      ...overrides
    });
    return { raw, invite };
  };

  beforeEach(async () => {
    await Administrator.deleteMany({});
    await Affiliate.deleteMany({});
    await AffiliateInvite.deleteMany({});
    jest.clearAllMocks();
    onboardingEmail.sendAffiliateInviteEmail.mockResolvedValue(true);

    admin = await Administrator.create({
      firstName: 'Test', lastName: 'Admin', email: 'admin@test.com',
      username: 'testadmin', passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['manage_affiliates']
    });
    adminToken = createTestToken(admin._id, 'administrator');

    const limitedAdmin = await Administrator.create({
      firstName: 'Limited', lastName: 'Admin', email: 'limited@test.com',
      username: 'limitedadmin', passwordSalt: 'salt', passwordHash: 'hash',
      permissions: ['view_analytics']
    });
    limitedAdminToken = createTestToken(limitedAdmin._id, 'administrator');

    agent = createAgent(app);
    csrfToken = await getCsrfToken(app, agent);
  });

  describe('POST /api/v1/administrators/affiliate-invites (mint)', () => {
    const mintBody = {
      email: 'New.Invitee@Example.com',
      prefill: { firstName: 'Nia', lastName: 'Liate', businessName: 'Liate LLC', phone: '555-0100' }
    };

    test('mints a pending invite, emails the link, never returns the raw token', async () => {
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send(mintBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invite).toMatchObject({
        email: 'new.invitee@example.com',
        status: 'pending',
        resendCount: 0
      });
      expect(res.body.invite.inviteId).toMatch(/^INV-/);
      // Anti-leak: no 64-hex raw token anywhere in the response.
      expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{64}/);

      expect(onboardingEmail.sendAffiliateInviteEmail).toHaveBeenCalledTimes(1);
      const arg = onboardingEmail.sendAffiliateInviteEmail.mock.calls[0][0];
      expect(arg.inviteUrl).toMatch(
        /^https:\/\/wavemax\.promo\/embed-app-v2\.html\?route=\/affiliate-register&invite=[0-9a-f]{64}$/
      );
    });

    test('403 without the manage_affiliates permission', async () => {
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .set('x-csrf-token', csrfToken)
        .send(mintBody);
      expect(res.status).toBe(403);
      expect(await AffiliateInvite.countDocuments()).toBe(0);
    });

    test('403 without a CSRF token', async () => {
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mintBody);
      expect(res.status).toBe(403);
    });

    test('400 on a malformed email', async () => {
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    test('409 when a pending invite already exists for the email', async () => {
      await seedInvite({ email: 'new.invitee@example.com' });
      const res = await agent
        .post('/api/v1/administrators/affiliate-invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send(mintBody);
      expect(res.status).toBe(409);
      expect(await AffiliateInvite.countDocuments()).toBe(1);
    });
  });

  describe('GET /api/v1/administrators/affiliate-invites (list)', () => {
    test('lists invites filtered by status, without token hashes', async () => {
      await seedInvite({ email: 'a@example.com' });
      await seedInvite({ email: 'b@example.com', status: 'revoked' });

      const res = await agent
        .get('/api/v1/administrators/affiliate-invites?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invites).toHaveLength(1);
      expect(res.body.invites[0].email).toBe('a@example.com');
      expect(res.body.invites[0].tokenHash).toBeUndefined();
    });
  });

  describe('POST /api/v1/administrators/affiliate-invites/:inviteId/resend', () => {
    test('re-mints the token and bumps resendCount', async () => {
      const { invite } = await seedInvite();
      const oldHash = invite.tokenHash;

      const res = await agent
        .post(`/api/v1/administrators/affiliate-invites/${invite.inviteId}/resend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(res.status).toBe(200);
      const updated = await AffiliateInvite.findOne({ inviteId: invite.inviteId });
      expect(updated.tokenHash).not.toBe(oldHash);
      expect(updated.resendCount).toBe(1);
      expect(updated.sentAt).toBeInstanceOf(Date);
      expect(onboardingEmail.sendAffiliateInviteEmail).toHaveBeenCalledTimes(1);
    });

    test('409 when the invite is not pending', async () => {
      const { invite } = await seedInvite({ status: 'revoked' });
      const res = await agent
        .post(`/api/v1/administrators/affiliate-invites/${invite.inviteId}/resend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/administrators/affiliate-invites/:inviteId/revoke', () => {
    test('revokes a pending invite', async () => {
      const { invite } = await seedInvite();
      const res = await agent
        .post(`/api/v1/administrators/affiliate-invites/${invite.inviteId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(res.status).toBe(200);
      const updated = await AffiliateInvite.findOne({ inviteId: invite.inviteId });
      expect(updated.status).toBe('revoked');
      expect(String(updated.revokedBy)).toBe(String(admin._id));
    });

    test('409 on revoking an accepted invite', async () => {
      const { invite } = await seedInvite({ status: 'accepted' });
      const res = await agent
        .post(`/api/v1/administrators/affiliate-invites/${invite.inviteId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-csrf-token', csrfToken)
        .send({});
      expect(res.status).toBe(409);
    });
  });
});
