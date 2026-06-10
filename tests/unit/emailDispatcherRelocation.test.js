// PR 2: beta dispatcher deleted; the two shared senders it carried are relocated.
describe('email dispatcher after beta removal', () => {
  it('no longer exports the beta senders', () => {
    const emailService = require('../../server/utils/emailService');
    expect(emailService.sendBetaRequestNotification).toBeUndefined();
    expect(emailService.sendBetaInvitationEmail).toBeUndefined();
    expect(emailService.sendBetaWelcomeEmail).toBeUndefined();
    expect(emailService.sendBetaReminderEmail).toBeUndefined();
  });

  it('still exports the relocated shared senders', () => {
    const emailService = require('../../server/utils/emailService');
    expect(typeof emailService.sendAdminNotification).toBe('function');
    expect(typeof emailService.sendMarketingEmail).toBe('function');
  });

  it('BetaRequest model is deleted', () => {
    expect(() => require('../../server/models/BetaRequest')).toThrow(/Cannot find module/);
  });
});
