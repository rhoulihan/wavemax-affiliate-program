const { validateRequiredSecrets } = require('../../server/utils/validateSecrets');

const GOOD = {
  JWT_SECRET: 'x'.repeat(40),
  SESSION_SECRET: 'y'.repeat(40),
  ENCRYPTION_KEY: 'a'.repeat(64) // 64 hex chars
};

describe('validateRequiredSecrets', () => {
  it('returns no problems when all secrets are present + valid', () => {
    expect(validateRequiredSecrets(GOOD)).toEqual([]);
  });

  it('flags a missing JWT_SECRET', () => {
    const r = validateRequiredSecrets({ ...GOOD, JWT_SECRET: '' });
    expect(r).toContain('JWT_SECRET is required');
  });

  it('flags a missing SESSION_SECRET', () => {
    const r = validateRequiredSecrets({ ...GOOD, SESSION_SECRET: undefined });
    expect(r).toContain('SESSION_SECRET is required');
  });

  it('flags an ENCRYPTION_KEY that is not 64 hex chars (too short)', () => {
    const r = validateRequiredSecrets({ ...GOOD, ENCRYPTION_KEY: 'a'.repeat(32) });
    expect(r.some(p => p.includes('ENCRYPTION_KEY'))).toBe(true);
  });

  it('flags an ENCRYPTION_KEY with non-hex characters', () => {
    const r = validateRequiredSecrets({ ...GOOD, ENCRYPTION_KEY: 'z'.repeat(64) });
    expect(r.some(p => p.includes('ENCRYPTION_KEY'))).toBe(true);
  });

  it('accepts uppercase hex for ENCRYPTION_KEY', () => {
    expect(validateRequiredSecrets({ ...GOOD, ENCRYPTION_KEY: 'ABCDEF0123456789'.repeat(4) })).toEqual([]);
  });

  it('collects multiple problems at once', () => {
    expect(validateRequiredSecrets({}).length).toBe(3);
  });
});
