// Unit tests for the Oracle ADB MongoDB-API cursor diagnostics capture.
//
// Purpose: gather irrefutable evidence for the Oracle team — when their API
// returns a `find`/`getMore` reply MISSING the required `cursor` envelope, we
// record the command, the malformed reply's shape, the backend node, and the
// connection age. PII (filter values, returned docs) is never logged.

const { isCursorAnomaly, buildAnomalyRecord } = require('../../server/utils/mongoOracleDiagnostics');

describe('mongoOracleDiagnostics', () => {
  describe('isCursorAnomaly', () => {
    test('find reply missing cursor → anomaly', () => {
      expect(isCursorAnomaly('succeeded', 'find', { ok: 1 })).toBe(true);
      expect(isCursorAnomaly('succeeded', 'find', { ok: 0, errmsg: 'boom' })).toBe(true);
    });
    test('find reply WITH cursor → not an anomaly', () => {
      expect(isCursorAnomaly('succeeded', 'find', { cursor: { firstBatch: [], id: 0 }, ok: 1 })).toBe(false);
    });
    test('getMore / aggregate missing cursor → anomaly', () => {
      expect(isCursorAnomaly('succeeded', 'getMore', { ok: 1 })).toBe(true);
      expect(isCursorAnomaly('succeeded', 'aggregate', { ok: 1 })).toBe(true);
    });
    test('non-cursor commands are never anomalies', () => {
      expect(isCursorAnomaly('succeeded', 'insert', { ok: 1 })).toBe(false);
      expect(isCursorAnomaly('succeeded', 'findAndModify', { ok: 1 })).toBe(false);
      expect(isCursorAnomaly('succeeded', 'ping', { ok: 1 })).toBe(false);
    });
    test('failed event matches only the cursor-missing error', () => {
      expect(isCursorAnomaly('failed', 'find', { message: 'BSON element "cursor" is missing' })).toBe(true);
      expect(isCursorAnomaly('failed', 'find', { message: 'connection timed out' })).toBe(false);
    });
  });

  describe('buildAnomalyRecord', () => {
    const started = {
      commandName: 'find',
      command: { find: 'sessions', filter: { _id: 'secret-session-id' }, limit: 1, batchSize: 1, singleBatch: true, projection: { a: 1 }, sort: { x: 1 } },
      address: '130.35.130.64:27017',
      serviceId: 'svc-abc',
      connectionId: 42
    };
    const rec = buildAnomalyRecord({
      kind: 'malformed-reply',
      started,
      reply: { ok: 1, operationTime: 123 },
      connAgeMS: 1800000,
      driverVersion: '6.20.0',
      label: 'mongoose'
    });

    test('captures the diagnostic shape Oracle needs', () => {
      expect(rec.commandName).toBe('find');
      expect(rec.ns).toBe('sessions');
      expect(rec.address).toBe('130.35.130.64:27017');
      expect(rec.serviceId).toBe('svc-abc');
      expect(rec.connectionId).toBe(42);
      expect(rec.connectionAgeMS).toBe(1800000);
      expect(rec.driver).toBe('6.20.0');
      expect(rec.label).toBe('mongoose');
      expect(rec.hasCursor).toBe(false);
      expect(rec.replyKeys).toEqual(expect.arrayContaining(['ok', 'operationTime']));
      expect(rec.filterKeys).toEqual(['_id']);     // KEYS only
      expect(rec.options).toMatchObject({ limit: 1, batchSize: 1, singleBatch: true });
    });

    test('never leaks PII (filter values or returned documents)', () => {
      const json = JSON.stringify(rec);
      expect(json).not.toContain('secret-session-id');
      expect(rec.options.projection).toEqual(['a']);   // projection KEYS, not values
      expect(rec.options.sort).toEqual(['x']);
    });

    test('failed-kind records the error message', () => {
      const f = buildAnomalyRecord({ kind: 'command-failed', started, failure: { message: 'BSON element "cursor" is missing' }, driverVersion: '6.20.0', label: 'mongoose' });
      expect(f.kind).toBe('command-failed');
      expect(f.error).toMatch(/cursor.*is missing/i);
    });
  });
});
