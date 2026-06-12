// encryptBuffer/decryptBuffer — binary AES-256-GCM helpers (spec §4.3).
// ENCRYPTION_KEY (64-hex) is set by tests/setup.js.
const crypto = require('crypto');
const encryptionUtil = require('../../server/utils/encryption');

describe('encryptBuffer / decryptBuffer (AES-256-GCM, binary)', () => {
  it('round-trips arbitrary binary bytes exactly', () => {
    const plaintext = crypto.randomBytes(1024);
    const { iv, authTag, data } = encryptionUtil.encryptBuffer(plaintext);
    expect(Buffer.isBuffer(iv)).toBe(true);
    expect(iv.length).toBe(16);
    expect(Buffer.isBuffer(authTag)).toBe(true);
    expect(authTag.length).toBe(16);
    expect(Buffer.isBuffer(data)).toBe(true);
    expect(data.equals(plaintext)).toBe(false); // ciphertext != plaintext
    const decrypted = encryptionUtil.decryptBuffer({ iv, authTag, data });
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('uses a fresh random IV per call (same input -> different ciphertext)', () => {
    const plaintext = Buffer.from('same input bytes');
    const a = encryptionUtil.encryptBuffer(plaintext);
    const b = encryptionUtil.encryptBuffer(plaintext);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.data.equals(b.data)).toBe(false);
  });

  it('throws on a tampered authTag', () => {
    const { iv, authTag, data } = encryptionUtil.encryptBuffer(Buffer.from('tamper the tag'));
    const tampered = Buffer.from(authTag);
    tampered[0] ^= 0xff;
    expect(() => encryptionUtil.decryptBuffer({ iv, authTag: tampered, data })).toThrow();
  });

  it('throws on tampered ciphertext', () => {
    const { iv, authTag, data } = encryptionUtil.encryptBuffer(Buffer.from('tamper the body'));
    const corrupted = Buffer.from(data);
    corrupted[0] ^= 0xff;
    expect(() => encryptionUtil.decryptBuffer({ iv, authTag, data: corrupted })).toThrow();
  });
});
