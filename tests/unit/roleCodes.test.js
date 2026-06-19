const roleCodes = require('../../server/utils/roleCodes');

describe('roleCodes utility', () => {
  test('generateCode returns unambiguous alphanumeric of requested length', () => {
    for (const len of [6, 8, 10]) {
      const code = roleCodes.generateCode(len);
      expect(code).toHaveLength(len);
      // No ambiguous chars: I, L, O, 0, 1
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    }
  });

  test('generateCode is random (no duplicates across 50 draws)', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) seen.add(roleCodes.generateCode(8));
    expect(seen.size).toBe(50);
  });

  test('generateNumericCode returns digits-only of the requested length (the 6-digit partner staff code)', () => {
    for (const len of [4, 6, 8]) {
      const code = roleCodes.generateNumericCode(len);
      expect(code).toHaveLength(len);
      expect(code).toMatch(/^[0-9]+$/);
    }
    // round-trips through hash/verify like any other code
    const c = roleCodes.generateNumericCode(6);
    expect(roleCodes.verifyCode(c, roleCodes.hashCode(c))).toBe(true);
  });

  test('hashCode/verifyCode round-trip, case- and whitespace-insensitive input', () => {
    const code = roleCodes.generateCode(6);
    const stored = roleCodes.hashCode(code);
    expect(stored).not.toContain(code);
    expect(stored).toMatch(/^[a-f0-9]+:[a-f0-9]+$/); // hash:salt
    expect(roleCodes.verifyCode(code, stored)).toBe(true);
    expect(roleCodes.verifyCode(`  ${code.toLowerCase()} `, stored)).toBe(true);
    expect(roleCodes.verifyCode('WRONG9', stored)).toBe(false);
    expect(roleCodes.verifyCode(code, null)).toBe(false);
    expect(roleCodes.verifyCode(code, 'garbage-no-colon')).toBe(false);
  });

  test('hmacCode is deterministic, keyed, and normalizes input', () => {
    const a = roleCodes.hmacCode('ABC234');
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(roleCodes.hmacCode('abc234 ')).toBe(a);
    expect(roleCodes.hmacCode('ABC235')).not.toBe(a);
  });

  test('new audit event constants exist', () => {
    const { AuditEvents } = require('../../server/utils/auditLogger');
    for (const ev of ['OPERATOR_SCAN', 'ORDER_UNDO', 'ORDER_REOPENED', 'DELIVERY_CONFIRMED',
      'DELIVERY_CODE_FAILED', 'OPERATOR_CODE_FAILED', 'DELIVERY_CODE_RESET',
      'OPERATOR_SCAN_CODE_RESET']) {
      expect(AuditEvents[ev]).toBe(ev);
    }
  });
});
