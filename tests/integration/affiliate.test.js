const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const jwt = require('jsonwebtoken');

describe('Affiliate API', () => {
  let testAffiliate;
  let authToken;
  
  beforeEach(async () => {
    // Create a test affiliate
    testAffiliate = new Affiliate({
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
      passwordSalt: 'testsalt',
      passwordHash: 'testhash',
      paymentMethod: 'directDeposit'
    });
    
    await testAffiliate.save();
    
    // Generate auth token
    authToken = jwt.sign(
      {
        id: testAffiliate._id,
        affiliateId: testAffiliate.affiliateId,
        role: 'affiliate'
      },
      process.env.JWT_SECRET || 'testsecret',
      { expiresIn: '1h' }
    );
  });
  
  test('should register a new affiliate', async () => {
    const res = await request(app)
      .post('/api/affiliates/register')
      .send({
        firstName: 'New',
        lastName: 'Affiliate',
        email: 'new@example.com',
        phone: '555-5678',
        address: '456 Test St',
        city: 'Testville',
        state: 'TX',
        zipCode: '12345',
        serviceArea: 'Test Area',
        deliveryFee: 5.99,
        username: 'newaffiliate',
        password: 'Password123!',
        paymentMethod: 'directDeposit'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('affiliateId');
  });
  
  test('should get affiliate profile', async () => {
    const res = await request(app)
      .get(`/api/affiliates/${testAffiliate.affiliateId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.affiliate).toHaveProperty('firstName', 'Test');
    expect(res.body.affiliate).toHaveProperty('lastName', 'Affiliate');
  });
  
  test('should update affiliate profile', async () => {
    const res = await request(app)
      .put(`/api/affiliates/${testAffiliate.affiliateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        firstName: 'Updated',
        deliveryFee: 6.99
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    
    // Verify the update
    const updatedAffiliate = await Affiliate.findOne({ affiliateId: testAffiliate.affiliateId });
    expect(updatedAffiliate.firstName).toBe('Updated');
    expect(updatedAffiliate.deliveryFee).toBe(6.99);
  });
});