const request = require('supertest');
const app = require('../server');
const Affiliate = require('../server/models/Affiliate');

describe('Affiliate API', () => {
  test('should register a new affiliate', async () => {
    const res = await request(app)
      .post('/api/affiliates/register')
      .send({
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'test@example.com',
        phone: '555-1234',
        address: '123 Test St',
        city: 'Testville',
        state: 'TX',
        zipCode: '12345',
        serviceArea: 'Test Area',
        deliveryFee: 5.99,
        username: 'testaffiliate',
        password: 'Password123!',
        paymentMethod: 'directDeposit'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('affiliateId');
  });
});