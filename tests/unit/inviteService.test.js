// Mock the email dispatcher BEFORE requiring the service (house rule).
jest.mock('../../server/services/email/dispatcher/onboarding', () => ({
  sendAffiliateInviteEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../server/utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEvents: { INVITE_RESENT: 'INVITE_RESENT' }
}));

const mongoose = require('mongoose');
const onboardingEmail = require('../../server/services/email/dispatcher/onboarding');
const { logAuditEvent } = require('../../server/utils/auditLogger');
const inviteService = require('../../server/modules/onboarding/inviteService');
const { InviteError } = inviteService;
const AffiliateInvite = require('../../server/modules/onboarding/AffiliateInvite');

describe('inviteService', () => {
  const adminId = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    await AffiliateInvite.deleteMany({});
    jest.clearAllMocks();
    onboardingEmail.sendAffiliateInviteEmail.mockResolvedValue(true);
  });

  describe('createInvite', () => {
    test('persists only the hash, returns a 64-hex raw token, emails the invite URL', async () => {
      const { invite, rawToken } = await inviteService.createInvite({
        email: 'New.Affiliate@Example.com',
        prefill: { firstName: 'Nia', lastName: 'Liate' },
        adminId
      });

      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
      expect(invite.email).toBe('new.affiliate@example.com');
      expect(invite.status).toBe('pending');
      expect(invite.tokenHash).toBe(AffiliateInvite.hashToken(rawToken));
      // Raw token must never be persisted anywhere on the document.
      expect(JSON.stringify(invite.toObject())).not.toContain(rawToken);

      // TTL default 72h (invite_token_ttl_hours)
      const ttlMs = invite.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(71 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(72 * 60 * 60 * 1000);

      expect(onboardingEmail.sendAffiliateInviteEmail).toHaveBeenCalledTimes(1);
      const arg = onboardingEmail.sendAffiliateInviteEmail.mock.calls[0][0];
      expect(arg.email).toBe('new.affiliate@example.com');
      expect(arg.inviteUrl).toBe(
        `https://wavemax.promo/embed-app-v2.html?route=/affiliate-register&invite=${rawToken}`
      );
      expect(invite.sentAt).toBeInstanceOf(Date);
    });

    test('rejects a second pending invite for the same email with 409 duplicate_pending', async () => {
      await inviteService.createInvite({ email: 'dup@example.com', adminId });
      await expect(inviteService.createInvite({ email: 'DUP@example.com', adminId }))
        .rejects.toMatchObject({ name: 'InviteError', code: 'duplicate_pending', statusCode: 409 });
    });

    test('email send failure does NOT fail the mint — the row stays resendable', async () => {
      onboardingEmail.sendAffiliateInviteEmail.mockRejectedValueOnce(new Error('smtp down'));
      const { invite } = await inviteService.createInvite({ email: 'flaky@example.com', adminId });
      expect(invite.status).toBe('pending');
      expect(invite.sentAt).toBeUndefined();
      const persisted = await AffiliateInvite.findOne({ email: 'flaky@example.com' });
      expect(persisted).not.toBeNull();
    });
  });

  describe('validateInvite', () => {
    test('returns the invite for a valid pending token', async () => {
      const { rawToken } = await inviteService.createInvite({ email: 'ok@example.com', adminId });
      const invite = await inviteService.validateInvite(rawToken);
      expect(invite.email).toBe('ok@example.com');
    });

    test('unknown token → InviteError invalid 410', async () => {
      await expect(inviteService.validateInvite('ab'.repeat(32)))
        .rejects.toMatchObject({ code: 'invalid', statusCode: 410 });
    });

    test('expired-but-pending token → InviteError expired 410 (lazy expiry)', async () => {
      const { invite, rawToken } = await inviteService.createInvite({ email: 'old@example.com', adminId });
      await AffiliateInvite.updateOne({ _id: invite._id }, { expiresAt: new Date(Date.now() - 1000) });
      await expect(inviteService.validateInvite(rawToken))
        .rejects.toMatchObject({ code: 'expired', statusCode: 410 });
    });

    test('revoked token → InviteError invalid 410 (no oracle)', async () => {
      const { invite, rawToken } = await inviteService.createInvite({ email: 'rev@example.com', adminId });
      await inviteService.revokeInvite({ inviteId: invite.inviteId, adminId });
      await expect(inviteService.validateInvite(rawToken))
        .rejects.toMatchObject({ code: 'invalid', statusCode: 410 });
    });

    test('accepted token → InviteError already_used 409', async () => {
      const { rawToken } = await inviteService.createInvite({ email: 'used@example.com', adminId });
      await inviteService.consumeInvite(rawToken, 'AFF-1');
      await expect(inviteService.validateInvite(rawToken))
        .rejects.toMatchObject({ code: 'already_used', statusCode: 409 });
    });
  });

  describe('consumeInvite', () => {
    test('is single-use: first call wins, second returns null', async () => {
      const { rawToken } = await inviteService.createInvite({ email: 'once@example.com', adminId });
      const first = await inviteService.consumeInvite(rawToken, 'AFF-1');
      expect(first.status).toBe('accepted');
      expect(first.acceptedAffiliateId).toBe('AFF-1');
      expect(await inviteService.consumeInvite(rawToken, 'AFF-2')).toBeNull();
    });
  });

  describe('resendInvite', () => {
    test('re-mints the token: old link dies, new one validates, counters bump', async () => {
      const { invite, rawToken: oldRaw } = await inviteService.createInvite({ email: 're@example.com', adminId });
      const { rawToken: newRaw } = await inviteService.resendInvite({ inviteId: invite.inviteId, adminId });

      expect(newRaw).not.toBe(oldRaw);
      await expect(inviteService.validateInvite(oldRaw))
        .rejects.toMatchObject({ code: 'invalid' });
      const revalidated = await inviteService.validateInvite(newRaw);
      expect(revalidated.resendCount).toBe(1);
      expect(onboardingEmail.sendAffiliateInviteEmail).toHaveBeenCalledTimes(2);
      expect(logAuditEvent).toHaveBeenCalledWith(
        'INVITE_RESENT',
        { inviteId: invite.inviteId, adminId }
      );
    });

    test('resend refreshes the expiry of an expired-but-pending invite', async () => {
      const { invite } = await inviteService.createInvite({ email: 'stale@example.com', adminId });
      await AffiliateInvite.updateOne({ _id: invite._id }, { expiresAt: new Date(Date.now() - 1000) });
      const { rawToken } = await inviteService.resendInvite({ inviteId: invite.inviteId, adminId });
      const revived = await inviteService.validateInvite(rawToken);
      expect(revived.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('resend on a non-pending invite → 409 not_pending', async () => {
      const { invite, rawToken } = await inviteService.createInvite({ email: 'done@example.com', adminId });
      await inviteService.consumeInvite(rawToken, 'AFF-1');
      await expect(inviteService.resendInvite({ inviteId: invite.inviteId, adminId }))
        .rejects.toMatchObject({ code: 'not_pending', statusCode: 409 });
    });
  });

  describe('revokeInvite', () => {
    test('flips pending → revoked with audit fields', async () => {
      const { invite } = await inviteService.createInvite({ email: 'bye@example.com', adminId });
      const revoked = await inviteService.revokeInvite({ inviteId: invite.inviteId, adminId });
      expect(revoked.status).toBe('revoked');
      expect(revoked.revokedAt).toBeInstanceOf(Date);
      expect(String(revoked.revokedBy)).toBe(String(adminId));
    });

    test('revoke on an accepted invite → 409 not_pending', async () => {
      const { invite, rawToken } = await inviteService.createInvite({ email: 'gone@example.com', adminId });
      await inviteService.consumeInvite(rawToken, 'AFF-1');
      await expect(inviteService.revokeInvite({ inviteId: invite.inviteId, adminId }))
        .rejects.toMatchObject({ code: 'not_pending', statusCode: 409 });
    });
  });
});
