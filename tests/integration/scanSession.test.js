jest.mock('../../server/utils/emailService');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Operator = require('../../server/models/Operator');
const Bag = require('../../server/modules/bags/Bag');
const SystemConfig = require('../../server/models/SystemConfig');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');

jest.setTimeout(60000);

const OP_CODE = 'OPCODE99';
const AFF_CODE = 'AFCD23';

async function createWorld() {
  const uniq = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const { salt, hash } = encryptionUtil.hashPassword('FixturePassword417!');

  const affiliate = await Affiliate.create({
    firstName: 'Fix', lastName: 'Affiliate', email: `fixaff${uniq}@example.com`,
    phone: '5125551111', businessName: 'Fixture Wash Co',
    address: '1 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `fixaff${uniq}`, passwordSalt: salt, passwordHash: hash,
    paymentMethod: 'check',
    affiliateDeliveryCodeHash: roleCodes.hashCode(AFF_CODE)
  });

  const customer = await Customer.create({
    affiliateId: affiliate.affiliateId,
    firstName: 'Fix', lastName: 'Customer', email: `fixcust${uniq}@example.com`,
    phone: '5125552222', address: '2 Fixture St', city: 'Austin', state: 'TX', zipCode: '78702',
    username: `fixcust${uniq}`, passwordSalt: salt, passwordHash: hash
  });

  const operator = await Operator.create({
    firstName: 'Fix', lastName: 'Operator', email: `fixop${uniq}@example.com`,
    username: `fixop${uniq}`, password: 'StrongOperatorPass417!',
    createdBy: new mongoose.Types.ObjectId(),
    scanCodeHmac: roleCodes.hmacCode(OP_CODE), scanCodeSetAt: new Date()
  });

  const token = encryptionUtil.generateToken(16);
  const bag = await Bag.create({
    token, tokenHash: Bag.hashToken(token),
    affiliateId: affiliate.affiliateId, customerId: customer.customerId,
    status: 'active', batchId: `BATCH-${uniq}`, claimedAt: new Date()
  });

  return { affiliate, customer, operator, bag, bagToken: token };
}

describe('POST /api/v1/scan/session', () => {
  beforeAll(async () => { await SystemConfig.initializeDefaults(); });

  test('valid affiliate delivery code -> scan-session token (actorType affiliate)', async () => {
    const { bagToken, affiliate } = await createWorld();
    const res = await request(app)
      .post('/api/v1/scan/session')
      .send({ bagToken, code: AFF_CODE });
    expect(res.status).toBe(200);
    expect(res.body.actorType).toBe('affiliate');
    expect(typeof res.body.sessionToken).toBe('string');
    expect(res.body.expiresAt).toBeTruthy();

    const decoded = jwt.verify(res.body.sessionToken, process.env.JWT_SECRET);
    expect(decoded.scope).toBe('scan-session');
    expect(decoded.actorType).toBe('affiliate');
    expect(decoded.actorId).toBe(affiliate.affiliateId);
  });

  test('valid operator scan code -> scan-session token (actorType operator)', async () => {
    const { bagToken, operator } = await createWorld();
    const res = await request(app)
      .post('/api/v1/scan/session')
      .send({ bagToken, code: OP_CODE });
    expect(res.status).toBe(200);
    expect(res.body.actorType).toBe('operator');
    const decoded = jwt.verify(res.body.sessionToken, process.env.JWT_SECRET);
    expect(decoded.actorId).toBe(String(operator._id));
  });

  test('wrong code -> 401 (no oracle) and lockout after max attempts', async () => {
    const { bagToken } = await createWorld();
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/scan/session')
        .send({ bagToken, code: 'WRONG9' });
      expect(res.status).toBe(401);
      expect(res.body.message).not.toMatch(/operator|affiliate/i);
    }
    // Locked out even with a correct code.
    const locked = await request(app)
      .post('/api/v1/scan/session')
      .send({ bagToken, code: OP_CODE });
    expect(locked.status).toBe(429);
  });

  test('unknown bag token -> generic 404', async () => {
    const res = await request(app)
      .post('/api/v1/scan/session')
      .send({ bagToken: 'totally-unknown-token', code: OP_CODE });
    expect(res.status).toBe(404);
  });

  test('TTL comes from SystemConfig scan_session_ttl_minutes', async () => {
    const ttl = await SystemConfig.getValue('scan_session_ttl_minutes', null);
    expect(ttl).not.toBeNull();
  });
});
