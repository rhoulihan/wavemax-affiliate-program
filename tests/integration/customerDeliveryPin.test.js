jest.mock('../../server/utils/emailService');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server');
const Customer = require('../../server/models/Customer');
const Bag = require('../../server/modules/bags/Bag');
const bagClaimService = require('../../server/services/bagClaimService');
const encryptionUtil = require('../../server/utils/encryption');
const roleCodes = require('../../server/utils/roleCodes');
const { getCsrfToken, createAgent } = require('../helpers/csrfHelper');

jest.setTimeout(60000);

async function createCustomer(overrides = {}) {
  const { salt, hash } = encryptionUtil.hashPassword('TestPassword417!');
  return Customer.create({
    affiliateId: 'AFF-pin-test',
    firstName: 'Pin', lastName: 'Holder',
    email: `pin${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`,
    phone: '5125551234', address: '1 Main St', city: 'Austin', state: 'TX', zipCode: '78701',
    username: `pinuser${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    passwordSalt: salt, passwordHash: hash,
    ...overrides
  });
}

function customerToken(customer) {
  return jwt.sign(
    { id: customer._id.toString(), customerId: customer.customerId, role: 'customer' },
    process.env.JWT_SECRET, { expiresIn: '1h' }
  );
}

describe('Customer delivery PIN', () => {
  test('claimForCustomer generates a PIN (hash + setAt) on the claiming customer', async () => {
    const token = encryptionUtil.generateToken(16);
    const bag = await Bag.create({
      token, tokenHash: Bag.hashToken(token),
      affiliateId: 'AFF-pin-test', status: 'issued', batchId: 'BATCH-pin-test'
    });
    const customer = await createCustomer();
    await bagClaimService.claimForCustomer(bag, customer.customerId);

    const reloaded = await Customer.findOne({ customerId: customer.customerId })
      .select('+deliveryPinHash');
    expect(reloaded.deliveryPinHash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    expect(reloaded.deliveryPinSetAt).toBeInstanceOf(Date);
  });

  test('GET /delivery-pin returns status for self, 403 for another customer', async () => {
    const customer = await createCustomer({
      deliveryPinHash: roleCodes.hashCode('ABC234'), deliveryPinSetAt: new Date()
    });
    const other = await createCustomer();

    const ok = await request(app)
      .get(`/api/v1/customers/${customer.customerId}/delivery-pin`)
      .set('Authorization', `Bearer ${customerToken(customer)}`);
    expect(ok.status).toBe(200);
    expect(ok.body.deliveryPinSet).toBe(true);
    expect(ok.body.deliveryPinSetAt).toBeTruthy();
    expect(JSON.stringify(ok.body)).not.toContain('ABC234');

    const forbidden = await request(app)
      .get(`/api/v1/customers/${customer.customerId}/delivery-pin`)
      .set('Authorization', `Bearer ${customerToken(other)}`);
    expect(forbidden.status).toBe(403);
  });

  test('POST /delivery-pin/reset (self, CSRF) returns a new PIN once and invalidates the old one', async () => {
    const customer = await createCustomer({
      deliveryPinHash: roleCodes.hashCode('OLDPIN'), deliveryPinSetAt: new Date(Date.now() - 1000)
    });
    const agent = createAgent(app);
    const csrfToken = await getCsrfToken(app, agent);

    const res = await agent
      .post(`/api/v1/customers/${customer.customerId}/delivery-pin/reset`)
      .set('Authorization', `Bearer ${customerToken(customer)}`)
      .set('x-csrf-token', csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.deliveryPin).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

    const reloaded = await Customer.findOne({ customerId: customer.customerId })
      .select('+deliveryPinHash');
    expect(roleCodes.verifyCode(res.body.deliveryPin, reloaded.deliveryPinHash)).toBe(true);
    expect(roleCodes.verifyCode('OLDPIN', reloaded.deliveryPinHash)).toBe(false);
  });

  test('reset without CSRF token is rejected', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .post(`/api/v1/customers/${customer.customerId}/delivery-pin/reset`)
      .set('Authorization', `Bearer ${customerToken(customer)}`)
      .send({});
    expect(res.status).toBe(403);
  });
});
