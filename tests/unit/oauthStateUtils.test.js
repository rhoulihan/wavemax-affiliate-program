// Unit tests for the OAuth state HMAC utility (SEC L-5).

const { generateOAuthState, validateOAuthState } = require('../../server/utils/oauthStateUtils');

describe('oauthStateUtils', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.OAUTH_STATE_SECRET = 'test-secret-' + 'a'.repeat(32);
  });

  afterAll(() => { process.env = ORIGINAL_ENV; });

  test('round-trips an empty payload', () => {
    const state = generateOAuthState('');
    const r = validateOAuthState(state);
    expect(r.valid).toBe(true);
    expect(r.clientPayload).toBe('');
  });

  test('round-trips a typical sessionId payload', () => {
    const state = generateOAuthState('oauth_abc123');
    const r = validateOAuthState(state);
    expect(r.valid).toBe(true);
    expect(r.clientPayload).toBe('oauth_abc123');
  });

  test('round-trips a customer-prefixed payload', () => {
    const state = generateOAuthState('customer_oauth_xyz');
    const r = validateOAuthState(state);
    expect(r.valid).toBe(true);
    expect(r.clientPayload).toBe('customer_oauth_xyz');
  });

  test('rejects missing state', () => {
    expect(validateOAuthState(undefined).valid).toBe(false);
    expect(validateOAuthState(null).valid).toBe(false);
    expect(validateOAuthState('').reason).toBe('missing');
  });

  test('rejects malformed state (wrong segment count)', () => {
    expect(validateOAuthState('a.b.c').reason).toBe('malformed');
    expect(validateOAuthState('only-one').reason).toBe('malformed');
  });

  test('rejects tampered signature', () => {
    const state = generateOAuthState('oauth_abc');
    const tampered = state.slice(0, -2) + 'XX';
    const r = validateOAuthState(tampered);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('bad-signature');
  });

  test('rejects state signed with a different secret', () => {
    const state = generateOAuthState('oauth_abc');
    process.env.OAUTH_STATE_SECRET = 'different-secret-' + 'b'.repeat(32);
    const r = validateOAuthState(state);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('bad-signature');
  });

  test('rejects expired state (5-min TTL)', () => {
    const realNow = Date.now;
    const state = generateOAuthState('oauth_abc');
    Date.now = () => realNow() + 6 * 60 * 1000;  // jump 6 minutes forward
    try {
      const r = validateOAuthState(state);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('expired');
    } finally {
      Date.now = realNow;
    }
  });

  test('falls back to SESSION_SECRET when OAUTH_STATE_SECRET is missing', () => {
    delete process.env.OAUTH_STATE_SECRET;
    process.env.SESSION_SECRET = 'session-secret-' + 'c'.repeat(32);
    const state = generateOAuthState('oauth_abc');
    expect(validateOAuthState(state).valid).toBe(true);
  });

  test('throws when no secret is configured at all', () => {
    delete process.env.OAUTH_STATE_SECRET;
    delete process.env.SESSION_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => generateOAuthState('x')).toThrow(/must be configured/);
  });

  test('different state values for same payload (nonce + ts vary)', () => {
    const a = generateOAuthState('oauth_abc');
    const b = generateOAuthState('oauth_abc');
    expect(a).not.toBe(b);
    expect(validateOAuthState(a).clientPayload).toBe('oauth_abc');
    expect(validateOAuthState(b).clientPayload).toBe('oauth_abc');
  });
});
