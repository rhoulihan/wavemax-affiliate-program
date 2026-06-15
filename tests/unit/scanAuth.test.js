// Unit tests for the scan-auth middleware (PR 4).
//
// scanAuth accepts EITHER a normal operator JWT (role operator/administrator/admin)
// OR a short-lived scan-session token (scope === 'scan-session'); populates
// req.scanActor = { type, id, role }; rejects everything else with 401.

const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-scan-auth';

const scanAuth = require('../../server/middleware/scanAuth');

function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

function run(req) {
  const res = mockRes();
  let nextCalled = false;
  scanAuth(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

describe('scanAuth middleware', () => {
  test('accepts a valid operator JWT (Authorization Bearer)', () => {
    const token = jwt.sign({ id: 'OP-1', role: 'operator' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const { nextCalled } = run(req);
    expect(nextCalled).toBe(true);
    expect(req.scanActor).toEqual({ type: 'operator', id: 'OP-1', role: 'operator' });
  });

  test('accepts an administrator JWT', () => {
    const token = jwt.sign({ id: 'ADM-1', role: 'administrator' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const { nextCalled } = run(req);
    expect(nextCalled).toBe(true);
    expect(req.scanActor.role).toBe('administrator');
    expect(req.scanActor.type).toBe('operator');
  });

  test('accepts a valid scan-session token via x-scan-session header', () => {
    const token = jwt.sign(
      { scope: 'scan-session', actorType: 'affiliate', actorId: 'AFF-9' },
      process.env.JWT_SECRET, { expiresIn: '15m' });
    const req = { headers: { 'x-scan-session': token } };
    const { nextCalled } = run(req);
    expect(nextCalled).toBe(true);
    expect(req.scanActor).toEqual({ type: 'affiliate', id: 'AFF-9', role: 'affiliate' });
  });

  test('accepts a scan-session token via Authorization Bearer too', () => {
    const token = jwt.sign(
      { scope: 'scan-session', actorType: 'operator', actorId: 'OP-7' },
      process.env.JWT_SECRET, { expiresIn: '15m' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const { nextCalled } = run(req);
    expect(nextCalled).toBe(true);
    expect(req.scanActor).toEqual({ type: 'operator', id: 'OP-7', role: 'operator' });
  });

  test('rejects a JWT with a non-scan role and no scan scope (e.g. customer)', () => {
    const token = jwt.sign({ id: 'CUST-1', role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const { res, nextCalled } = run(req);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('rejects an expired scan-session token', () => {
    const token = jwt.sign(
      { scope: 'scan-session', actorType: 'affiliate', actorId: 'AFF-9' },
      process.env.JWT_SECRET, { expiresIn: -10 });
    const req = { headers: { 'x-scan-session': token } };
    const { res, nextCalled } = run(req);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('rejects a garbage token', () => {
    const req = { headers: { authorization: 'Bearer not-a-jwt' } };
    const { res, nextCalled } = run(req);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('rejects when no credential at all', () => {
    const req = { headers: {} };
    const { res, nextCalled } = run(req);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});
