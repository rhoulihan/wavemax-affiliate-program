// emailOtpService — generate / send / verify the 6-digit email OTP (PR 7).
jest.mock('../../server/utils/emailService', () => ({
  sendCustomerEmailOtp: jest.fn().mockResolvedValue(true)
}));

const crypto = require('crypto');
const EmailVerification = require('../../server/models/EmailVerification');
const emailService = require('../../server/utils/emailService');
const { verifyCode } = require('../../server/utils/roleCodes');
const lockout = require('../../server/services/codeAttemptLockout');
const emailOtpService = require('../../server/services/emailOtpService');

const BAG_TOKEN = 'b'.repeat(32);
const bagHash = crypto.createHash('sha256').update(BAG_TOKEN).digest('hex');

describe('emailOtpService', () => {
  beforeEach(async () => {
    await EmailVerification.deleteMany({});
    emailService.sendCustomerEmailOtp.mockClear();
  });

  describe('requestOtp', () => {
    it('generates a 6-digit numeric code, hashes it, upserts the record, sends the email', async () => {
      const res = await emailOtpService.requestOtp({
        bagToken: BAG_TOKEN, email: 'User@Example.com'
      });
      expect(res).toEqual({ success: true });

      const doc = await EmailVerification.findOne({ bagTokenHash: bagHash, email: 'user@example.com' });
      expect(doc).toBeTruthy();
      expect(doc.verified).toBe(false);

      // The plaintext code is never stored — assert the email got a 6-digit code
      // and the stored hash verifies it.
      const sentArgs = emailService.sendCustomerEmailOtp.mock.calls[0];
      const sentCode = sentArgs[0].code;
      expect(sentCode).toMatch(/^\d{6}$/);
      expect(verifyCode(sentCode, doc.codeHash)).toBe(true);
    });

    it('lowercases the email and re-issues (upsert) on repeat requests', async () => {
      await emailOtpService.requestOtp({ bagToken: BAG_TOKEN, email: 'a@b.com' });
      await emailOtpService.requestOtp({ bagToken: BAG_TOKEN, email: 'A@B.COM' });
      const count = await EmailVerification.countDocuments({ bagTokenHash: bagHash, email: 'a@b.com' });
      expect(count).toBe(1);
    });
  });

  describe('verifyOtp', () => {
    async function seed(email = 'v@x.com') {
      let sentCode;
      emailService.sendCustomerEmailOtp.mockImplementationOnce((opts) => {
        sentCode = opts.code; return Promise.resolve(true);
      });
      await emailOtpService.requestOtp({ bagToken: BAG_TOKEN, email });
      return sentCode;
    }

    it('verifies the correct code, marks verified, mints a verificationToken', async () => {
      const code = await seed();
      const res = await emailOtpService.verifyOtp({ bagToken: BAG_TOKEN, email: 'v@x.com', code });
      expect(res.success).toBe(true);
      expect(res.verificationToken).toMatch(/^[a-f0-9]{64}$/);
      const doc = await EmailVerification.findOne({ bagTokenHash: bagHash, email: 'v@x.com' });
      expect(doc.verified).toBe(true);
      expect(doc.verificationToken).toBe(res.verificationToken);
    });

    it('rejects a wrong code and registers a lockout failure', async () => {
      await seed();
      const res = await emailOtpService.verifyOtp({ bagToken: BAG_TOKEN, email: 'v@x.com', code: '000000' });
      expect(res.success).toBe(false);
      const doc = await EmailVerification.findOne({ bagTokenHash: bagHash, email: 'v@x.com' });
      expect(doc.verified).toBe(false);
    });

    it('locks out after repeated wrong codes', async () => {
      await seed();
      const key = lockout.attemptKey({ scope: 'email_otp', bagToken: BAG_TOKEN, req: {} });
      await lockout.clearFailures(key);
      let last;
      for (let i = 0; i < 7; i++) {
        last = await emailOtpService.verifyOtp({
          bagToken: BAG_TOKEN, email: 'v@x.com', code: '111111', req: {}
        });
      }
      expect(last.success).toBe(false);
      expect(last.lockedOut).toBe(true);
      await lockout.clearFailures(key);
    });

    it('returns failure (not throw) when no record exists (anti-enumeration)', async () => {
      const res = await emailOtpService.verifyOtp({
        bagToken: BAG_TOKEN, email: 'nobody@x.com', code: '123456'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('consumeVerification', () => {
    it('confirms a valid verificationToken and reports verified contact', async () => {
      let sentCode;
      emailService.sendCustomerEmailOtp.mockImplementationOnce((opts) => {
        sentCode = opts.code; return Promise.resolve(true);
      });
      await emailOtpService.requestOtp({ bagToken: BAG_TOKEN, email: 'c@x.com' });
      const v = await emailOtpService.verifyOtp({ bagToken: BAG_TOKEN, email: 'c@x.com', code: sentCode });
      const ok = await emailOtpService.consumeVerification({
        bagToken: BAG_TOKEN, email: 'C@X.com', verificationToken: v.verificationToken
      });
      expect(ok).toBe(true);
    });

    it('rejects a missing/invalid verificationToken', async () => {
      const ok = await emailOtpService.consumeVerification({
        bagToken: BAG_TOKEN, email: 'c@x.com', verificationToken: 'deadbeef'
      });
      expect(ok).toBe(false);
    });
  });
});
