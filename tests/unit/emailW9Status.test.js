// sendAffiliateW9StatusEmail — received/verified/rejected in 4 languages
// (spec §10 'affiliate-w9-status'). Transport mocked BEFORE require.
jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

const { sendEmail } = require('../../server/services/email/transport');
const onboarding = require('../../server/services/email/dispatcher/onboarding');

const affiliate = (lang) => ({
  firstName: 'Ana', email: 'ana@test.com', affiliateId: 'AFF-test', languagePreference: lang
});

describe('sendAffiliateW9StatusEmail', () => {
  beforeEach(() => sendEmail.mockClear());

  it('sends the received notice to the affiliate address', async () => {
    await onboarding.sendAffiliateW9StatusEmail(affiliate('en'), 'received');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('ana@test.com');
    expect(subject).toMatch(/W-9/);
    expect(html).toContain('Ana');
  });

  it('includes the rejection reason for rejected', async () => {
    await onboarding.sendAffiliateW9StatusEmail(affiliate('en'), 'rejected', { reason: 'Signature missing' });
    const [, , html] = sendEmail.mock.calls[0];
    expect(html).toContain('Signature missing');
  });

  it('HTML-escapes the rejection reason', async () => {
    await onboarding.sendAffiliateW9StatusEmail(affiliate('en'), 'rejected', { reason: '<script>x</script>' });
    const [, , html] = sendEmail.mock.calls[0];
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sends all three statuses in all four languages without throwing', async () => {
    for (const lang of ['en', 'es', 'pt', 'de']) {
      for (const status of ['received', 'verified', 'rejected']) {
        await onboarding.sendAffiliateW9StatusEmail(affiliate(lang), status, { reason: 'x' });
      }
    }
    expect(sendEmail).toHaveBeenCalledTimes(12);
    // Each language must produce its own subject for 'verified' (no en-only copy)
    const verifiedSubjects = sendEmail.mock.calls
      .filter((c, i) => i % 3 === 1)  // received, VERIFIED, rejected per language
      .map((c) => c[1]);
    expect(new Set(verifiedSubjects).size).toBe(4);
  });

  it('exposes the new audit event constants', () => {
    const { AuditEvents } = require('../../server/utils/auditLogger');
    expect(AuditEvents.W9_UPLOADED).toBe('W9_UPLOADED');
    expect(AuditEvents.W9_VERIFIED).toBe('W9_VERIFIED');
    expect(AuditEvents.W9_REJECTED).toBe('W9_REJECTED');
    expect(AuditEvents.W9_DOCUMENT_ACCESSED).toBe('W9_DOCUMENT_ACCESSED');
  });
});
