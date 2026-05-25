jest.mock('../../server/services/email/transport', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test' })
}));
const { sendEmail } = require('../../server/services/email/transport');
const { buildUnlockEmailHtml, sendPreviewUnlockEmail } = require('../../server/services/franchisePreviewEmail');

describe('franchisePreviewEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds HTML with the unlock link, password, and business name', () => {
    const html = buildUnlockEmailHtml({
      businessName: 'WaveMAX Austin',
      unlockUrl: 'https://crhsent.com/austin-tx?key=abc123',
      password: 'SWAN-7421'
    });
    expect(html).toContain('https://crhsent.com/austin-tx?key=abc123');
    expect(html).toContain('SWAN-7421');
    expect(html).toContain('WaveMAX Austin');
    expect(html).toMatch(/right to market your own location/i); // the shared REMINDER
    expect(html).toMatch(/CRHS Enterprises, LLC/);              // the AUTHORIZATION
  });

  it('HTML-escapes the business name (no injection)', () => {
    const html = buildUnlockEmailHtml({
      businessName: '<script>x</script>',
      unlockUrl: 'https://crhsent.com/x?key=1',
      password: 'p'
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sends via sendEmail with the right recipient + subject + body', async () => {
    await sendPreviewUnlockEmail({
      email: 'owner@example.com',
      businessName: 'Joe Laundry',
      unlockUrl: 'https://crhsent.com/dallas-tx?key=zzz',
      password: 'PW-123'
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendEmail.mock.calls[0];
    expect(to).toBe('owner@example.com');
    expect(subject).toContain('Joe Laundry');
    expect(html).toContain('https://crhsent.com/dallas-tx?key=zzz');
    expect(html).toContain('PW-123');
  });
});
