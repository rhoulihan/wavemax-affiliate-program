jest.mock('axios');
const axios = require('axios');
const { verifyTurnstile } = require('../../server/utils/turnstile');

describe('verifyTurnstile', () => {
  const SAVED_SECRET = process.env.TURNSTILE_SECRET_KEY;
  const SAVED_ENV = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = SAVED_ENV;
    if (SAVED_SECRET === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = SAVED_SECRET;
    jest.clearAllMocks();
  });

  it('returns success when Cloudflare confirms the token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    axios.post.mockResolvedValueOnce({ data: { success: true, hostname: 'crhsent.com' } });
    const r = await verifyTurnstile('good-token', '1.2.3.4');
    expect(r.success).toBe(true);
    expect(r.hostname).toBe('crhsent.com');
    // secret + response + remoteip sent
    const body = axios.post.mock.calls[0][1];
    expect(body).toContain('secret=secret');
    expect(body).toContain('response=good-token');
    expect(body).toContain('remoteip=1.2.3.4');
  });

  it('returns failure with error codes when Cloudflare rejects the token', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    axios.post.mockResolvedValueOnce({ data: { success: false, 'error-codes': ['invalid-input-response'] } });
    const r = await verifyTurnstile('bad-token');
    expect(r.success).toBe(false);
    expect(r.errorCodes).toContain('invalid-input-response');
  });

  it('returns missing_token when no token is supplied', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    const r = await verifyTurnstile('');
    expect(r).toMatchObject({ success: false, error: 'missing_token' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('skips verification (success) in non-production when no secret is set', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = 'test';
    const r = await verifyTurnstile('whatever');
    expect(r).toMatchObject({ success: true, skipped: true });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('fails closed in production when no secret is configured', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = 'production';
    const r = await verifyTurnstile('whatever');
    expect(r).toMatchObject({ success: false, error: 'not_configured' });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('fails closed when the verify request throws', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    axios.post.mockRejectedValueOnce(new Error('network'));
    const r = await verifyTurnstile('token');
    expect(r).toMatchObject({ success: false, error: 'verify_request_failed' });
  });
});
