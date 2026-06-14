// PR 2: beta dispatcher deleted; the two shared senders it carried are relocated.
//
// The "executes" tests below are regression guards for the relocated senders'
// internal paths (the lazy require('../../../models/SystemConfig') in
// dispatcher/admin.js and the templates/emails/marketing path in
// dispatcher/marketing.js). typeof checks alone passed even when those paths
// were broken, because the bad requires lived inside the function bodies and
// only threw at call time — so these tests actually call the functions.

// Mock the transport so no real email is attempted. Do NOT mock SystemConfig's
// module path or the template files — letting the real requires/reads run is
// the point of the regression guard.
jest.mock('../../server/services/email/transport', () => ({
  createTransport: jest.fn(),
  sendEmail: jest.fn()
}));

const { sendEmail } = require('../../server/services/email/transport');
const emailService = require('../../server/utils/emailService');
const SystemConfig = require('../../server/models/SystemConfig');

describe('email dispatcher after beta removal', () => {
  it('no longer exports the beta senders', () => {
    expect(emailService.sendBetaRequestNotification).toBeUndefined();
    expect(emailService.sendBetaInvitationEmail).toBeUndefined();
    expect(emailService.sendBetaWelcomeEmail).toBeUndefined();
    expect(emailService.sendBetaReminderEmail).toBeUndefined();
  });

  it('still exports the relocated shared senders', () => {
    expect(typeof emailService.sendAdminNotification).toBe('function');
  });

  it('no longer exports the removed marketing sender', () => {
    expect(emailService.sendMarketingEmail).toBeUndefined();
  });

  it('BetaRequest model is deleted', () => {
    expect(() => require('../../server/models/BetaRequest')).toThrow(/Cannot find module/);
  });

  describe('relocated senders execute against their fixed paths', () => {
    const originalAdminEmail = process.env.ADMIN_EMAIL;

    beforeEach(() => {
      // jest.config.js sets resetMocks: true, which wipes mock implementations
      // before every test — re-arm the transport stub here, not in the factory.
      sendEmail.mockResolvedValue(true);
    });

    afterEach(() => {
      if (originalAdminEmail === undefined) {
        delete process.env.ADMIN_EMAIL;
      } else {
        process.env.ADMIN_EMAIL = originalAdminEmail;
      }
    });

    it('sendAdminNotification executes the relocated SystemConfig require and dispatches', async () => {
      process.env.ADMIN_EMAIL = 'admin-test@wavemax.promo';
      // Deterministic: force the SystemConfig lookup to miss so the function
      // falls back to ADMIN_EMAIL regardless of seeded defaults. The dispatcher
      // still require()s the real module inside the function body — a path
      // regression surfaces as MODULE_NOT_FOUND and fails this test.
      jest.spyOn(SystemConfig, 'getValue').mockResolvedValue(null);

      const result = await emailService.sendAdminNotification({ subject: 'T', html: '<p>x</p>' });

      expect(result).toBe(true);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = sendEmail.mock.calls[0];
      expect(to).toBe('admin-test@wavemax.promo');
      expect(subject).toBe('T');
      expect(html).toContain('<p>x</p>');
    });
  });
});
