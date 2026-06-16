// GET /api/v1/firebase-config — public web config + the phone-verification flag (PR 7).
const request = require('supertest');
const app = require('../../server');

describe('GET /api/v1/firebase-config', () => {
  const ORIG = { ...process.env };
  afterEach(() => {
    process.env.PHONE_VERIFICATION_ENABLED = ORIG.PHONE_VERIFICATION_ENABLED;
    process.env.FIREBASE_API_KEY = ORIG.FIREBASE_API_KEY;
    process.env.FIREBASE_PROJECT_ID = ORIG.FIREBASE_PROJECT_ID;
  });

  it('returns the public web config and enabled:true when the flag is on', async () => {
    process.env.PHONE_VERIFICATION_ENABLED = 'true';
    process.env.FIREBASE_API_KEY = 'test-api-key';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    const res = await request(app).get('/api/v1/firebase-config');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.apiKey).toBe('test-api-key');
    expect(res.body.projectId).toBe('test-project');
    expect(res.body).toHaveProperty('authDomain');
    expect(res.body).toHaveProperty('appId');
    expect(res.body).toHaveProperty('messagingSenderId');
    expect(res.body).toHaveProperty('storageBucket');
  });

  it('reports enabled:false when the flag is off', async () => {
    process.env.PHONE_VERIFICATION_ENABLED = 'false';
    const res = await request(app).get('/api/v1/firebase-config');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });
});
