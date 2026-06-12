// secureFileStore — encrypted W-9 file store (spec §4.3, §13 #7).
// NOTE: do NOT assert on-disk permission bits — this repo runs under WSL
// drvfs (/mnt/c) where chmod is not faithfully represented. We assert the
// frame layout and that bytes at rest are not plaintext instead.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w9-store-'));
process.env.W9_STORAGE_PATH = tmpRoot;
const secureFileStore = require('../../server/services/secureFileStore');

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('secureFileStore', () => {
  it('stores a self-framed encrypted file and returns { storageKey, sha256 }', async () => {
    const plaintext = Buffer.from('%PDF-1.4 fake w9 pdf bytes for the round-trip test');
    const { storageKey, sha256 } = await secureFileStore.storeEncrypted(plaintext, {
      affiliateId: 'AFF-test-1', contentType: 'application/pdf', filename: 'w9.pdf'
    });

    expect(storageKey).toMatch(/^aff\/AFF-test-1\/[0-9a-f-]{36}\.enc$/);
    expect(sha256).toBe(crypto.createHash('sha256').update(plaintext).digest('hex'));

    const onDisk = fs.readFileSync(path.join(tmpRoot, storageKey));
    expect(onDisk.length).toBe(32 + plaintext.length);        // [iv(16)|authTag(16)|ciphertext]
    expect(onDisk.includes(plaintext)).toBe(false);           // at-rest bytes are NOT plaintext
    expect(onDisk.subarray(32).equals(plaintext)).toBe(false);
  });

  it('readDecrypted returns the exact plaintext and verifies sha256', async () => {
    const plaintext = crypto.randomBytes(2048);
    const { storageKey, sha256 } = await secureFileStore.storeEncrypted(plaintext, {
      affiliateId: 'AFF-test-2', contentType: 'image/png', filename: 'w9.png'
    });
    const out = await secureFileStore.readDecrypted(storageKey, { expectedSha256: sha256 });
    expect(out.equals(plaintext)).toBe(true);
  });

  it('throws when the stored authTag is tampered', async () => {
    const { storageKey } = await secureFileStore.storeEncrypted(Buffer.from('tamper the frame'), {
      affiliateId: 'AFF-test-3', contentType: 'application/pdf', filename: 'w9.pdf'
    });
    const abs = path.join(tmpRoot, storageKey);
    const framed = fs.readFileSync(abs);
    framed[20] ^= 0xff; // a byte inside the authTag region [16..32)
    fs.writeFileSync(abs, framed);
    await expect(secureFileStore.readDecrypted(storageKey)).rejects.toThrow();
  });

  it('throws on sha256 mismatch even when decryption succeeds', async () => {
    const { storageKey } = await secureFileStore.storeEncrypted(Buffer.from('sha mismatch case'), {
      affiliateId: 'AFF-test-4', contentType: 'application/pdf', filename: 'w9.pdf'
    });
    await expect(
      secureFileStore.readDecrypted(storageKey, { expectedSha256: 'deadbeef'.repeat(8) })
    ).rejects.toThrow(/sha256/i);
  });

  it('rejects path-traversal storage keys', async () => {
    await expect(secureFileStore.readDecrypted('../../etc/passwd')).rejects.toThrow(/invalid storage key/i);
  });

  it('rejects affiliateIds containing path metacharacters', async () => {
    await expect(secureFileStore.storeEncrypted(Buffer.from('x'), {
      affiliateId: '../escape', contentType: 'application/pdf', filename: 'w9.pdf'
    })).rejects.toThrow(/invalid affiliateid/i);
    await expect(secureFileStore.storeEncrypted(Buffer.from('x'), {
      affiliateId: 'AFF/..', contentType: 'application/pdf', filename: 'w9.pdf'
    })).rejects.toThrow(/invalid affiliateid/i);
  });

  it('deleteFile removes the file and is idempotent', async () => {
    const { storageKey } = await secureFileStore.storeEncrypted(Buffer.from('delete me'), {
      affiliateId: 'AFF-test-5', contentType: 'application/pdf', filename: 'w9.pdf'
    });
    await expect(secureFileStore.deleteFile(storageKey)).resolves.toBe(true);
    await expect(secureFileStore.deleteFile(storageKey)).resolves.toBe(false);
  });
});
