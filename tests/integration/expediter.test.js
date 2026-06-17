// PR D — Order Expediter API (read-only, token-guarded, aggregate-only).
jest.mock('../../server/utils/emailService');

const request = require('supertest');
const app = require('../../server');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const encryptionUtil = require('../../server/utils/encryption');

jest.setTimeout(60000);

const TOKEN = 'expediter-test-token-1234567890';

async function makeAffiliate(name) {
  const { salt, hash } = encryptionUtil.hashPassword('FixturePass123!');
  const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  return Affiliate.create({
    firstName: name, lastName: 'Co', email: `${uniq}@example.com`, phone: '5125550000',
    businessName: `${name} Wash`, address: '1 A St', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `u${uniq}`, passwordSalt: salt, passwordHash: hash, paymentMethod: 'check'
  });
}
let bagSeq = 0;
async function makeOrder(affiliateId, status, stamps = {}) {
  bagSeq += 1;
  return Order.create({
    customerId: `CUST-${bagSeq}`, affiliateId, bagId: `BAG-${bagSeq}`, bagToken: `tok${bagSeq}`,
    status, ...stamps
  });
}

describe('GET /api/v1/expediter/summary', () => {
  let prevToken;
  beforeAll(async () => {
    await SystemConfig.initializeDefaults();
    prevToken = process.env.EXPEDITER_TOKEN;
    process.env.EXPEDITER_TOKEN = TOKEN;
  });
  afterAll(() => {
    if (prevToken === undefined) delete process.env.EXPEDITER_TOKEN;
    else process.env.EXPEDITER_TOKEN = prevToken;
  });
  beforeEach(async () => {
    await Promise.all([Order.deleteMany({}), Affiliate.deleteMany({})]);
  });

  test('401 without a token', async () => {
    const res = await request(app).get('/api/v1/expediter/summary');
    expect(res.status).toBe(401);
  });

  test('401 with a wrong token', async () => {
    const res = await request(app).get('/api/v1/expediter/summary?k=nope');
    expect(res.status).toBe(401);
  });

  test('valid token returns the summary shape', async () => {
    const res = await request(app).get('/api/v1/expediter/summary?k=' + TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('counters');
    expect(res.body.data).toHaveProperty('activeByAffiliate');
    expect(res.body.data).toHaveProperty('dailyCompleted');
  });

  test('aggregates active orders by affiliate + cross-affiliate counters', async () => {
    const a = await makeAffiliate('Alpha');
    const b = await makeAffiliate('Bravo');
    await makeOrder(a.affiliateId, 'pending');
    await makeOrder(a.affiliateId, 'pending');
    await makeOrder(a.affiliateId, 'in_progress');
    await makeOrder(b.affiliateId, 'out_for_delivery');
    await makeOrder(b.affiliateId, 'complete'); // closed → excluded from active
    await makeOrder(a.affiliateId, 'cancelled'); // closed → excluded

    const res = await request(app).get('/api/v1/expediter/summary?k=' + TOKEN);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.counters).toMatchObject({ pending: 2, in_progress: 1, out_for_delivery: 1, total: 4 });

    const alpha = d.activeByAffiliate.find((r) => r.affiliateId === a.affiliateId);
    const bravo = d.activeByAffiliate.find((r) => r.affiliateId === b.affiliateId);
    expect(alpha).toMatchObject({ name: 'Alpha Wash', pending: 2, in_progress: 1, total: 3 });
    expect(bravo).toMatchObject({ name: 'Bravo Wash', out_for_delivery: 1, total: 1 });
    // sorted by total desc
    expect(d.activeByAffiliate[0].affiliateId).toBe(a.affiliateId);
  });

  test('daily completed summary: count + avg processing/turnaround (no pounds)', async () => {
    const a = await makeAffiliate('Gamma');
    const now = Date.now();
    await makeOrder(a.affiliateId, 'complete', {
      pickup: { at: new Date(now - 120 * 60000), by: 'x', role: 'operator' },
      intake: { at: new Date(now - 90 * 60000), by: 'x', role: 'operator' },
      storePickup: { at: new Date(now - 30 * 60000), by: 'x', role: 'operator' },
      completedAt: new Date(now - 10 * 60000)
    });
    const res = await request(app).get('/api/v1/expediter/summary?k=' + TOKEN);
    const d = res.body.data.dailyCompleted;
    expect(d.count).toBe(1);
    expect(d.avgProcessingMinutes).toBe(60); // intake(-90) -> storePickup(-30) = 60 min
    expect(d.avgTurnaroundMinutes).toBe(110); // pickup(-120) -> completed(-10) = 110 min
    // no weight/pounds anywhere in the payload
    expect(JSON.stringify(res.body.data)).not.toMatch(/pound|weight|wdf/i);
  });

  test('503 when EXPEDITER_TOKEN is not configured', async () => {
    delete process.env.EXPEDITER_TOKEN;
    const res = await request(app).get('/api/v1/expediter/summary?k=anything');
    expect(res.status).toBe(503);
    process.env.EXPEDITER_TOKEN = TOKEN;
  });

  test('authenticates via the x-expediter-token header (token stays out of the URL)', async () => {
    const res = await request(app).get('/api/v1/expediter/summary').set('x-expediter-token', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('counters');
  });

  test('empty state: no open orders → activeByAffiliate [] and zero counters', async () => {
    const res = await request(app).get('/api/v1/expediter/summary?k=' + TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.data.activeByAffiliate).toEqual([]);
    expect(res.body.data.counters).toMatchObject({ pending: 0, in_progress: 0, out_for_delivery: 0, total: 0 });
    expect(res.body.data.dailyCompleted).toMatchObject({ count: 0, avgProcessingMinutes: null, avgTurnaroundMinutes: null });
  });

  test('affiliate name falls back to first+last when businessName is empty', async () => {
    const { salt, hash } = encryptionUtil.hashPassword('FixturePass123!');
    const uniq = `${Date.now()}fb`;
    const a = await Affiliate.create({
      firstName: 'Jane', lastName: 'Doe', email: `${uniq}@example.com`, phone: '5125550000',
      businessName: '', address: '1 A St', city: 'Austin', state: 'TX', zipCode: '78701',
      username: `u${uniq}`, passwordSalt: salt, passwordHash: hash, paymentMethod: 'check'
    });
    await makeOrder(a.affiliateId, 'pending');
    const res = await request(app).get('/api/v1/expediter/summary?k=' + TOKEN);
    const rec = res.body.data.activeByAffiliate.find((r) => r.affiliateId === a.affiliateId);
    expect(rec.name).toBe('Jane Doe');
  });
});
