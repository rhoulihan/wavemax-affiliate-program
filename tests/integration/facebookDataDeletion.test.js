const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const DataDeletionRequest = require('../../server/models/DataDeletionRequest');
const Affiliate = require('../../server/models/Affiliate');
const Customer = require('../../server/models/Customer');
const crypto = require('crypto');

describe('Facebook Data Deletion Integration Tests', () => {
  let server;
  const appSecret = process.env.FACEBOOK_APP_SECRET || 'test-secret';

  beforeAll(async () => {
    // Set test environment variable
    process.env.FACEBOOK_APP_SECRET = appSecret;
    server = app;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await DataDeletionRequest.deleteMany({});
    await Affiliate.deleteMany({ 'socialAccounts.facebook.id': { $regex: /^test-fb-/ } });
    await Customer.deleteMany({ 'socialAccounts.facebook.id': { $regex: /^test-fb-/ } });
  });

  // Helper function to create signed request
  function createSignedRequest(payload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const sig = crypto
      .createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    return `${sig}.${encodedPayload}`;
  }

  describe('POST /api/v1/auth/facebook/deletion-callback', () => {
    it('should handle valid deletion request', async () => {
      const payload = {
        user_id: 'test-fb-123',
        algorithm: 'HMAC-SHA256',
        issued_at: Math.floor(Date.now() / 1000)
      };
      
      const signedRequest = createSignedRequest(payload);

      const response = await request(server)
        .post('/api/v1/auth/facebook/deletion-callback')
        .send({ signed_request: signedRequest })
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('confirmation_code');
      expect(response.body.url).toMatch(/\/deletion-status\?code=[A-Z0-9]{10}/);
      expect(response.body.confirmation_code).toMatch(/^[A-Z0-9]{10}$/);

      // Verify deletion request was created
      const deletionRequest = await DataDeletionRequest.findOne({
        facebookUserId: payload.user_id
      });
      expect(deletionRequest).toBeTruthy();
      expect(deletionRequest.status).toBe('completed'); // Since no users exist
      expect(deletionRequest.confirmationCode).toBe(response.body.confirmation_code);
    });

    it('should delete data for existing affiliate', async () => {
      // Create test affiliate with Facebook data
      const affiliate = await Affiliate.create({
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'test@example.com',
        phone: '123-456-7890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        serviceLatitude: 40.7128,
        serviceLongitude: -74.0060,
        username: 'testaffiliate456',
        passwordHash: 'hashedpassword',
        passwordSalt: 'salt',
        paymentMethod: 'directDeposit',
        socialAccounts: {
          facebook: {
            id: 'test-fb-456',
            email: 'fb@example.com',
            name: 'Facebook User',
            accessToken: 'test-token'
          }
        },
        registrationMethod: 'facebook'
      });

      const payload = {
        user_id: 'test-fb-456',
        algorithm: 'HMAC-SHA256',
        issued_at: Math.floor(Date.now() / 1000)
      };
      
      const signedRequest = createSignedRequest(payload);

      const response = await request(server)
        .post('/api/v1/auth/facebook/deletion-callback')
        .send({ signed_request: signedRequest })
        .expect(200);

      // Verify affiliate data was deleted
      const updatedAffiliate = await Affiliate.findById(affiliate._id);
      expect(updatedAffiliate.socialAccounts.facebook.id).toBeNull();
      expect(updatedAffiliate.socialAccounts.facebook.email).toBeNull();
      expect(updatedAffiliate.socialAccounts.facebook.accessToken).toBeNull();
      expect(updatedAffiliate.registrationMethod).toBe('traditional');

      // Verify deletion request shows completed
      const deletionRequest = await DataDeletionRequest.findOne({
        confirmationCode: response.body.confirmation_code
      });
      expect(deletionRequest.status).toBe('completed');
      expect(deletionRequest.deletionDetails.dataDeleted).toContain('affiliate_facebook_id');
      expect(deletionRequest.deletionDetails.dataDeleted).toContain('affiliate_registration_method');
    });

    it('should delete data for both affiliate and customer', async () => {
      // Create test users
      const [affiliate, customer] = await Promise.all([
        Affiliate.create({
          firstName: 'Test',
          lastName: 'Both',
          email: 'affiliate@example.com',
          phone: '123-456-7890',
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          serviceLatitude: 40.7128,
          serviceLongitude: -74.0060,
          username: 'testboth789',
          passwordHash: 'hashedpassword',
          passwordSalt: 'salt',
          paymentMethod: 'directDeposit',
          socialAccounts: {
            facebook: {
              id: 'test-fb-789',
              email: 'fb@example.com'
            }
          }
        }),
        Customer.create({
          firstName: 'Test',
          lastName: 'Customer',
          email: 'customer@example.com',
          phone: '+1234567890',
          address: '456 Customer Ave',
          city: 'Customer City',
          state: 'CS',
          zipCode: '54321',
          username: 'testcustomer789',
          passwordHash: 'hashedpassword',
          passwordSalt: 'salt',
          affiliateId: 'AFF-test-affiliate',
          socialAccounts: {
            facebook: {
              id: 'test-fb-789',
              email: 'fb@example.com'
            }
          }
        })
      ]);

      const payload = {
        user_id: 'test-fb-789',
        algorithm: 'HMAC-SHA256'
      };
      
      const signedRequest = createSignedRequest(payload);

      await request(server)
        .post('/api/v1/auth/facebook/deletion-callback')
        .send({ signed_request: signedRequest })
        .expect(200);

      // Verify both accounts had Facebook data deleted
      const [updatedAffiliate, updatedCustomer] = await Promise.all([
        Affiliate.findById(affiliate._id),
        Customer.findById(customer._id)
      ]);

      expect(updatedAffiliate.socialAccounts.facebook.id).toBeNull();
      expect(updatedCustomer.socialAccounts.facebook.id).toBeNull();
    });

    it('should reject request with invalid signature', async () => {
      const payload = {
        user_id: 'test-fb-bad',
        algorithm: 'HMAC-SHA256'
      };
      
      // Create signed request with wrong secret
      const wrongSecret = 'wrong-secret';
      const encodedPayload = Buffer.from(JSON.stringify(payload))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      const sig = crypto
        .createHmac('sha256', wrongSecret)
        .update(encodedPayload)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      const signedRequest = `${sig}.${encodedPayload}`;

      const response = await request(server)
        .post('/api/v1/auth/facebook/deletion-callback')
        .send({ signed_request: signedRequest })
        .expect(400);

      expect(response.body.error).toBe('Invalid signed request');
    });

    it('should reject request without signed_request', async () => {
      const response = await request(server)
        .post('/api/v1/auth/facebook/deletion-callback')
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('signed_request is required');
    });

    it('should handle malformed signed request', async () => {
      const response = await request(server)
        .post('/api/v1/auth/facebook/deletion-callback')
        .send({ signed_request: 'malformed.request.data' })
        .expect(400);

      expect(response.body.error).toBe('Invalid signed request');
    });
  });

  describe('GET /api/v1/auth/facebook/deletion-status/:code', () => {
    it('should return status for valid confirmation code', async () => {
      // Create a deletion request
      const deletionRequest = await DataDeletionRequest.create({
        facebookUserId: 'test-fb-status',
        confirmationCode: 'TESTCODE01',
        status: 'completed',
        userType: 'affiliate',
        signedRequest: 'test',
        deletionDetails: {
          dataDeleted: ['facebook_id', 'facebook_email'],
          completedActions: ['Deleted Facebook data from affiliate account']
        },
        completedAt: new Date()
      });

      const response = await request(server)
        .get('/api/v1/auth/facebook/deletion-status/TESTCODE01')
        .expect(200);

      expect(response.body.confirmationCode).toBe('TESTCODE01');
      expect(response.body.status).toBe('completed');
      expect(response.body.formattedStatus).toBe('Completed Successfully');
      expect(response.body.deletionDetails).toBeTruthy();
      expect(response.body.deletionDetails.dataDeleted).toEqual(['facebook_id', 'facebook_email']);
    });

    it('should return 404 for non-existent code', async () => {
      const response = await request(server)
        .get('/api/v1/auth/facebook/deletion-status/NOTEXIST99')
        .expect(404);

      expect(response.body.error).toBe('Deletion request not found');
    });

    it('should return error for invalid code format', async () => {
      const response = await request(server)
        .get('/api/v1/auth/facebook/deletion-status/invalid!')
        .expect(400);

      expect(response.body.errors).toBeTruthy();
      expect(response.body.errors[0].msg).toBe('Invalid confirmation code format');
    });

    it('should return error for missing code', async () => {
      const response = await request(server)
        .get('/api/v1/auth/facebook/deletion-status/')
        .expect(404); // 404 because route doesn't match
    });

    it('should show failed status with errors', async () => {
      await DataDeletionRequest.create({
        facebookUserId: 'test-fb-failed',
        confirmationCode: 'FAILCODE01',
        status: 'failed',
        userType: 'customer',
        signedRequest: 'test',
        deletionDetails: {
          errors: ['Database connection failed', 'Unable to delete customer data']
        }
      });

      const response = await request(server)
        .get('/api/v1/auth/facebook/deletion-status/FAILCODE01')
        .expect(200);

      expect(response.body.status).toBe('failed');
      expect(response.body.formattedStatus).toBe('Failed - Please Contact Support');
      expect(response.body.errors).toEqual([
        'Database connection failed',
        'Unable to delete customer data'
      ]);
    });
  });

  describe('Data Deletion Process', () => {
    it('should track deletion request lifecycle', async () => {
      const payload = {
        user_id: 'test-fb-lifecycle',
        algorithm: 'HMAC-SHA256'
      };
      
      const signedRequest = createSignedRequest(payload);

      // Make deletion request
      const response = await request(server)
        .post('/api/v1/auth/facebook/deletion-callback')
        .send({ signed_request: signedRequest })
        .expect(200);

      const { confirmation_code } = response.body;

      // Check status immediately
      const statusResponse = await request(server)
        .get(`/api/v1/auth/facebook/deletion-status/${confirmation_code}`)
        .expect(200);

      // Should be completed since no users exist
      expect(statusResponse.body.status).toBe('completed');
      expect(statusResponse.body.requestedAt).toBeTruthy();
      expect(statusResponse.body.completedAt).toBeTruthy();
    });

    it('should handle concurrent deletion requests', async () => {
      const requests = [];
      
      // Create multiple deletion requests concurrently
      for (let i = 0; i < 5; i++) {
        const payload = {
          user_id: `test-fb-concurrent-${i}`,
          algorithm: 'HMAC-SHA256'
        };
        
        const signedRequest = createSignedRequest(payload);
        
        requests.push(
          request(server)
            .post('/api/v1/auth/facebook/deletion-callback')
            .send({ signed_request: signedRequest })
        );
      }

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.confirmation_code).toBeTruthy();
      });

      // Verify all deletion requests were created
      const deletionRequests = await DataDeletionRequest.find({
        facebookUserId: { $regex: /^test-fb-concurrent-/ }
      });
      
      expect(deletionRequests.length).toBe(5);
      deletionRequests.forEach(req => {
        expect(req.status).toBe('completed');
      });
    });
  });
});