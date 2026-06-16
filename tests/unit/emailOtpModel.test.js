// EmailVerification model — TTL OTP record for bag-claim email verification (PR 7).
const mongoose = require('mongoose');
const EmailVerification = require('../../server/models/EmailVerification');

describe('EmailVerification model', () => {
  beforeEach(async () => {
    await EmailVerification.deleteMany({});
  });

  it('persists a record with the expected fields and defaults', async () => {
    const doc = await EmailVerification.create({
      bagTokenHash: 'a'.repeat(64),
      email: 'user@example.com',
      codeHash: 'hash:salt',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    expect(doc.verified).toBe(false);
    expect(doc.attempts).toBe(0);
    expect(doc.verificationToken).toBeFalsy();
    expect(doc.email).toBe('user@example.com');
  });

  it('has a compound index on { bagTokenHash, email }', () => {
    const indexes = EmailVerification.schema.indexes().map(([fields]) => fields);
    const compound = indexes.find(
      (f) => f.bagTokenHash === 1 && f.email === 1
    );
    expect(compound).toBeTruthy();
  });

  it('has a TTL index on expiresAt', () => {
    const ttl = EmailVerification.schema.indexes().find(
      ([fields, opts]) => fields.expiresAt && opts && opts.expireAfterSeconds === 0
    );
    expect(ttl).toBeTruthy();
  });
});
