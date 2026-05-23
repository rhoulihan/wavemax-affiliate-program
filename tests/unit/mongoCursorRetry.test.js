// Unit tests for the MongoDB cursor-retry shim.
//
// Background: the Oracle ADB MongoDB API intermittently returns a `find`
// response missing the `cursor` envelope, which the mongodb 6.x driver's strict
// CursorResponse parser rejects with
//   MongoUnexpectedServerResponseError: BSON element "cursor" is missing
// on `Collection.findOne`. A fresh connection always succeeds, so retrying the
// read (which checks out a different pooled connection) recovers it. This shim
// wraps Collection.prototype.findOne to retry that specific error.

const { installCursorRetry, isCursorMissingError } = require('../../server/utils/mongoCursorRetry');

function cursorErr() {
  const e = new Error('BSON element "cursor" is missing');
  e.name = 'MongoUnexpectedServerResponseError';
  return e;
}

// Fresh fake Collection class per test so the prototype patch never leaks.
function makeCollectionClass(behavior) {
  return class FakeCollection {
    constructor() { this.calls = 0; this.namespace = 'db.fake'; }
    async findOne(query) { this.calls += 1; return behavior(this.calls, query); }
  };
}

describe('mongoCursorRetry', () => {
  describe('isCursorMissingError', () => {
    test('matches by error name', () => {
      expect(isCursorMissingError(cursorErr())).toBe(true);
    });
    test('matches by message', () => {
      expect(isCursorMissingError(new Error('BSON element \"cursor\" is missing'))).toBe(true);
    });
    test('does not match unrelated errors', () => {
      expect(isCursorMissingError(new Error('connection timed out'))).toBe(false);
      expect(isCursorMissingError(null)).toBe(false);
    });
  });

  describe('installCursorRetry (findOne)', () => {
    test('retries the cursor-missing error then returns the eventual result', async () => {
      const C = makeCollectionClass((n) => {
        if (n < 3) throw cursorErr();
        return { ok: true };
      });
      installCursorRetry({ Collection: C, retries: 3, backoffMs: 0 });
      const c = new C();
      const res = await c.findOne({ _id: 'x' });
      expect(res).toEqual({ ok: true });
      expect(c.calls).toBe(3); // 2 failures + 1 success
    });

    test('gives up after the retry budget and rethrows the error', async () => {
      const C = makeCollectionClass(() => { throw cursorErr(); });
      installCursorRetry({ Collection: C, retries: 3, backoffMs: 0 });
      const c = new C();
      await expect(c.findOne({})).rejects.toThrow(/cursor.*is missing/i);
      expect(c.calls).toBe(4); // 1 initial + 3 retries
    });

    test('does NOT retry unrelated errors (fails fast)', async () => {
      const C = makeCollectionClass(() => { throw new Error('permission denied'); });
      installCursorRetry({ Collection: C, retries: 3, backoffMs: 0 });
      const c = new C();
      await expect(c.findOne({})).rejects.toThrow('permission denied');
      expect(c.calls).toBe(1);
    });

    test('passes through on first-try success without extra calls', async () => {
      const C = makeCollectionClass(() => ({ hit: 1 }));
      installCursorRetry({ Collection: C, retries: 3, backoffMs: 0 });
      const c = new C();
      await expect(c.findOne({})).resolves.toEqual({ hit: 1 });
      expect(c.calls).toBe(1);
    });

    test('logs the failing collection + filter keys + option shape, but NOT filter values (PII-safe)', async () => {
      const C = makeCollectionClass((n) => { if (n < 2) throw cursorErr(); return {}; });
      const warns = [];
      installCursorRetry({
        Collection: C, retries: 2, backoffMs: 0,
        logger: { info: () => {}, warn: (m) => warns.push(m), error: () => {} }
      });
      const c = new C();
      await c.findOne({ _id: 'secret-session-id' }, { session: {}, projection: { a: 1 } });
      expect(warns.length).toBe(1);
      expect(warns[0]).toContain('ns=db.fake');
      expect(warns[0]).toContain('filterKeys=["_id"]');
      expect(warns[0]).toContain('hasSession');
      expect(warns[0]).not.toContain('secret-session-id'); // never log filter values
    });

    test('is idempotent — does not double-wrap the prototype', () => {
      const C = makeCollectionClass(() => ({}));
      expect(installCursorRetry({ Collection: C, retries: 1, backoffMs: 0 })).toBe(true);
      expect(installCursorRetry({ Collection: C, retries: 1, backoffMs: 0 })).toBe(false);
    });
  });
});
