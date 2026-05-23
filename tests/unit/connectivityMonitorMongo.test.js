// The connectivity monitor used to health-check MongoDB by opening a BRAND-NEW
// connection every 60s (mongoose.createConnection + close), which on the Oracle
// ADB loadBalanced endpoint meant a fresh `hello` handshake + PLAIN `saslStart`
// auth per minute per worker — the connection churn Oracle flagged ("not pooling
// well; reconstructing MongoClient frequently"). It must instead ping the EXISTING
// pooled connection and NEVER open a new one.

const mockMongoose = {
  connection: { readyState: 1, db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) } },
  createConnection: jest.fn()
};
jest.mock('mongoose', () => mockMongoose);
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../server/utils/emailService', () => ({ sendEmail: jest.fn() }), { virtual: true });

const { checkMongoDB } = require('../../server/monitoring/connectivity-monitor');

describe('connectivity monitor — MongoDB health check', () => {
  beforeEach(() => { mockMongoose.createConnection.mockClear(); });

  test('pings the EXISTING pooled connection and opens NO new connection', async () => {
    const ping = jest.fn().mockResolvedValue({ ok: 1 });
    mockMongoose.connection.readyState = 1;
    mockMongoose.connection.db = { admin: () => ({ ping }) };
    const r = await checkMongoDB({ url: 'mongodb://x/db' });
    expect(r.success).toBe(true);
    expect(ping).toHaveBeenCalled();
    expect(mockMongoose.createConnection).not.toHaveBeenCalled(); // the whole point
  });

  test('reports failure when mongoose is not connected — still no new connection', async () => {
    mockMongoose.connection.readyState = 0;
    const r = await checkMongoDB({ url: 'mongodb://x/db' });
    expect(r.success).toBe(false);
    expect(mockMongoose.createConnection).not.toHaveBeenCalled();
  });

  test('reports failure (not a throw) when ping rejects', async () => {
    mockMongoose.connection.readyState = 1;
    mockMongoose.connection.db = { admin: () => ({ ping: jest.fn().mockRejectedValue(new Error('ping boom')) }) };
    const r = await checkMongoDB({ url: 'mongodb://x/db' });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/ping boom/);
    expect(mockMongoose.createConnection).not.toHaveBeenCalled();
  });
});
