jest.setTimeout(60000);

jest.mock('../../server/utils/emailService');

const request = require('supertest');
const emailService = require('../../server/utils/emailService');
const logger = require('../../server/utils/logger');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

const SLUG = 'austin-tx';
const ENDPOINT = `/api/v1/contact/${SLUG}`;
const RECIPIENT = 'austin-franchisee@example.com';

const validBody = () => ({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: '(512) 555-1212',
  message: 'Hello, I have a question about pricing for weekly pickup service.'
});

async function postContact(app, body, { skipCsrf = false, slug = SLUG } = {}) {
  const agent = createAgent(app);
  let csrfToken;
  if (!skipCsrf) {
    csrfToken = await getCsrfToken(app, agent);
  }
  const req = agent.post(`/api/v1/contact/${slug}`).set('Accept', 'application/json');
  if (csrfToken) req.set('x-csrf-token', csrfToken);
  return req.send(body);
}

describe('POST /api/v1/contact/:slug', () => {
  let app;
  const originalRecipient = process.env.CONTACT_RECIPIENT_AUSTIN;
  const originalFrom = process.env.EMAIL_FROM;

  beforeAll(() => {
    process.env.CONTACT_RECIPIENT_AUSTIN = RECIPIENT;
    process.env.EMAIL_FROM = 'noreply@wavemax.promo';
    app = require('../../server');
  });

  afterAll(() => {
    if (originalRecipient === undefined) delete process.env.CONTACT_RECIPIENT_AUSTIN;
    else process.env.CONTACT_RECIPIENT_AUSTIN = originalRecipient;
    if (originalFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalFrom;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    emailService.sendEmail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
  });

  it('happy path — valid body returns 200 and sends one email', async () => {
    const res = await postContact(app, validBody());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/sent|in touch/i);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('email payload — recipient, subject, and reply-to wired correctly', async () => {
    await postContact(app, validBody());

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const args = emailService.sendEmail.mock.calls[0];
    // Recipient is first positional arg per emailService.sendEmail signature
    expect(args[0]).toBe(RECIPIENT);
    // Subject contains name + slug
    expect(args[1]).toContain('Jane Doe');
    expect(args[1]).toContain(SLUG);
    // HTML body contains the customer's email so franchisee can reply
    expect(args[2]).toContain('jane.doe@example.com');
  });

  it('400 — missing firstName', async () => {
    const body = validBody();
    delete body.firstName;
    const res = await postContact(app, body);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.some(e => e.field === 'firstName')).toBe(true);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('400 — missing lastName', async () => {
    const body = validBody();
    delete body.lastName;
    const res = await postContact(app, body);

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'lastName')).toBe(true);
  });

  it('400 — missing email', async () => {
    const body = validBody();
    delete body.email;
    const res = await postContact(app, body);

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'email')).toBe(true);
  });

  it('400 — invalid email format', async () => {
    const body = validBody();
    body.email = 'not-an-email';
    const res = await postContact(app, body);

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'email')).toBe(true);
  });

  it('400 — missing message', async () => {
    const body = validBody();
    delete body.message;
    const res = await postContact(app, body);

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'message')).toBe(true);
  });

  it('400 — message too short (< 5 chars)', async () => {
    const body = validBody();
    body.message = 'hi';
    const res = await postContact(app, body);

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'message')).toBe(true);
  });

  it('400 — message too long (> 2000 chars)', async () => {
    const body = validBody();
    body.message = 'x'.repeat(2001);
    const res = await postContact(app, body);

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'message')).toBe(true);
  });

  it('phone is optional — body without phone succeeds', async () => {
    const body = validBody();
    delete body.phone;
    const res = await postContact(app, body);

    expect(res.status).toBe(200);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('404 — unknown slug', async () => {
    const res = await postContact(app, validBody(), { slug: 'nonexistent-tx' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Unknown location/i);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('403 — missing CSRF token', async () => {
    const res = await postContact(app, validBody(), { skipCsrf: true });

    expect(res.status).toBe(403);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('500 — email service failure surfaces user-friendly error', async () => {
    emailService.sendEmail = jest.fn().mockRejectedValue(new Error('SMTP down'));
    const res = await postContact(app, validBody());

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/could not send|try again|call us/i);
  });

  it('XSS — script tags stripped or escaped in email body', async () => {
    const body = validBody();
    body.message = 'Hello <script>alert("xss")</script> world, please contact me';
    const res = await postContact(app, body);

    expect(res.status).toBe(200);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const htmlBody = emailService.sendEmail.mock.calls[0][2];
    expect(htmlBody).not.toMatch(/<script[^>]*>alert/i);
  });

  it('falls back to EMAIL_FROM and logs a warning when CONTACT_RECIPIENT_AUSTIN is unset', async () => {
    delete process.env.CONTACT_RECIPIENT_AUSTIN;
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    try {
      const res = await postContact(app, validBody());

      expect(res.status).toBe(200);
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendEmail.mock.calls[0][0]).toBe(process.env.EMAIL_FROM);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      process.env.CONTACT_RECIPIENT_AUSTIN = RECIPIENT;
    }
  });
});

describe('contactRoutes — wiring', () => {
  it('uses sensitiveOperationLimiter on the POST route', () => {
    const rateLimiting = require('../../server/middleware/rateLimiting');
    const router = require('../../server/routes/contactRoutes');

    const postLayer = router.stack.find(
      (layer) => layer.route && layer.route.path === '/:slug' && layer.route.methods.post
    );
    expect(postLayer).toBeDefined();
    const stack = postLayer.route.stack.map((s) => s.handle);
    expect(stack).toContain(rateLimiting.sensitiveOperationLimiter);
  });
});
