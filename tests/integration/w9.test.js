const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const W9Document = require('../../server/models/W9Document');
const W9AuditLog = require('../../server/models/W9AuditLog');
const { generateToken } = require('../../server/utils/auth');
const fs = require('fs').promises;
const path = require('path');

describe('W-9 Integration Tests', () => {
  let mongoServer;
  let affiliateToken, adminToken;
  let testAffiliate, testAdmin;
  let testPdfBuffer;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to in-memory database
    await mongoose.disconnect();
    await mongoose.connect(mongoUri);
    
    // Create test PDF buffer
    testPdfBuffer = Buffer.from('test pdf content for w9');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collections
    await Affiliate.deleteMany({});
    await Administrator.deleteMany({});
    await W9Document.deleteMany({});
    await W9AuditLog.deleteMany({});
    
    // Create test affiliate
    testAffiliate = await Affiliate.create({
      affiliateId: 'AFF-TEST-001',
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'test@example.com',
      password: 'Test123!@#',
      phoneNumber: '+1234567890',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      },
      w9Information: {
        status: 'not_submitted'
      }
    });
    
    // Create test administrator
    testAdmin = await Administrator.create({
      adminId: 'ADMIN-TEST-001',
      firstName: 'Test',
      lastName: 'Admin',
      email: 'admin@example.com',
      password: 'Admin123!@#'
    });
    
    // Generate tokens
    affiliateToken = generateToken(testAffiliate._id, 'affiliate');
    adminToken = generateToken(testAdmin._id, 'administrator');
  });

  describe('W-9 Upload Flow', () => {
    it('should allow affiliate to upload W-9 document', async () => {
      const response = await request(app)
        .post('/api/v1/w9/upload')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .attach('w9document', testPdfBuffer, 'test-w9.pdf')
        .expect(200);
      
      expect(response.body).toMatchObject({
        message: 'W-9 document uploaded successfully',
        documentId: expect.stringMatching(/^W9DOC-/),
        status: 'pending_review'
      });
      
      // Verify document was created
      const document = await W9Document.findOne({ affiliateId: 'AFF-TEST-001' });
      expect(document).toBeDefined();
      expect(document.verificationStatus).toBe('pending');
      
      // Verify affiliate status was updated
      const updatedAffiliate = await Affiliate.findById(testAffiliate._id);
      expect(updatedAffiliate.w9Information.status).toBe('pending_review');
      
      // Verify audit log was created
      const auditLog = await W9AuditLog.findOne({ 
        action: 'upload_success',
        'targetInfo.affiliateId': 'AFF-TEST-001' 
      });
      expect(auditLog).toBeDefined();
    });

    it('should reject non-PDF files', async () => {
      const response = await request(app)
        .post('/api/v1/w9/upload')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .attach('w9document', Buffer.from('test'), 'test.txt')
        .expect(400);
      
      expect(response.body.message).toContain('Only PDF files are allowed');
    });

    it('should reject files over 5MB', async () => {
      const largePdf = Buffer.alloc(6 * 1024 * 1024); // 6MB
      
      const response = await request(app)
        .post('/api/v1/w9/upload')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .attach('w9document', largePdf, 'large.pdf')
        .expect(413);
      
      expect(response.body.message).toContain('too large');
    });
  });

  describe('W-9 Status Check', () => {
    it('should return current W-9 status for affiliate', async () => {
      const response = await request(app)
        .get('/api/v1/w9/status')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'not_submitted',
        canReceivePayments: false
      });
    });

    it('should show pending status after upload', async () => {
      // Upload W-9
      await request(app)
        .post('/api/v1/w9/upload')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .attach('w9document', testPdfBuffer, 'test-w9.pdf');
      
      // Check status
      const response = await request(app)
        .get('/api/v1/w9/status')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'pending_review',
        canReceivePayments: false,
        documentId: expect.stringMatching(/^W9DOC-/),
        submittedAt: expect.any(String)
      });
    });
  });

  describe('Admin W-9 Review', () => {
    beforeEach(async () => {
      // Upload a W-9 for review
      await request(app)
        .post('/api/v1/w9/upload')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .attach('w9document', testPdfBuffer, 'test-w9.pdf');
    });

    it('should list pending W-9 documents for admin', async () => {
      const response = await request(app)
        .get('/api/v1/w9/admin/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toMatchObject({
        count: 1,
        affiliates: [
          {
            affiliateId: 'AFF-TEST-001',
            name: 'Test Affiliate',
            email: 'test@example.com',
            w9Status: 'pending_review',
            documentId: expect.stringMatching(/^W9DOC-/),
            submittedAt: expect.any(String)
          }
        ]
      });
    });

    it('should allow admin to verify W-9 document', async () => {
      const response = await request(app)
        .post(`/api/v1/w9/admin/${testAffiliate.affiliateId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          taxIdType: 'SSN',
          taxIdLast4: '1234',
          businessName: 'Test Business LLC',
          quickbooksVendorId: 'QB-TEST-001'
        })
        .expect(200);
      
      expect(response.body).toMatchObject({
        message: 'W-9 document verified successfully',
        affiliate: {
          affiliateId: 'AFF-TEST-001',
          name: 'Test Affiliate',
          w9Status: 'verified'
        }
      });
      
      // Verify affiliate can now receive payments
      const updatedAffiliate = await Affiliate.findById(testAffiliate._id);
      expect(updatedAffiliate.canReceivePayments()).toBe(true);
      
      // Verify audit log
      const auditLog = await W9AuditLog.findOne({ 
        action: 'verify_success',
        'userInfo.userId': testAdmin._id.toString()
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.details.taxIdType).toBe('SSN');
    });

    it('should allow admin to reject W-9 document', async () => {
      const response = await request(app)
        .post(`/api/v1/w9/admin/${testAffiliate.affiliateId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Document is illegible, please upload a clearer copy'
        })
        .expect(200);
      
      expect(response.body).toMatchObject({
        message: 'W-9 document rejected',
        affiliate: {
          affiliateId: 'AFF-TEST-001',
          w9Status: 'rejected'
        }
      });
      
      // Verify document is marked as inactive
      const document = await W9Document.findOne({ affiliateId: 'AFF-TEST-001' });
      expect(document.isActive).toBe(false);
      expect(document.verificationStatus).toBe('rejected');
    });
  });

  describe('W-9 Download', () => {
    let uploadedDocumentId;

    beforeEach(async () => {
      // Upload a W-9
      const uploadResponse = await request(app)
        .post('/api/v1/w9/upload')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .attach('w9document', testPdfBuffer, 'test-w9.pdf');
      
      uploadedDocumentId = uploadResponse.body.documentId;
    });

    it('should allow affiliate to download their own W-9', async () => {
      const response = await request(app)
        .get('/api/v1/w9/download')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .expect(200);
      
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      
      // Verify audit log
      const auditLog = await W9AuditLog.findOne({ 
        action: 'download_affiliate',
        'userInfo.userId': testAffiliate._id.toString()
      });
      expect(auditLog).toBeDefined();
    });

    it('should allow admin to download any W-9', async () => {
      const document = await W9Document.findOne({ affiliateId: 'AFF-TEST-001' });
      
      const response = await request(app)
        .get(`/api/v1/w9/admin/${document.documentId}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.headers['content-type']).toBe('application/pdf');
      
      // Verify audit log
      const auditLog = await W9AuditLog.findOne({ 
        action: 'download_admin',
        'userInfo.userId': testAdmin._id.toString()
      });
      expect(auditLog).toBeDefined();
    });
  });

  describe('Audit Log Functionality', () => {
    beforeEach(async () => {
      // Create various audit log entries
      await request(app)
        .post('/api/v1/w9/upload')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .attach('w9document', testPdfBuffer, 'test-w9.pdf');
      
      await request(app)
        .post(`/api/v1/w9/admin/${testAffiliate.affiliateId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          taxIdType: 'SSN',
          taxIdLast4: '1234'
        });
    });

    it('should retrieve audit logs with filters', async () => {
      const response = await request(app)
        .get('/api/v1/w9/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          action: 'upload_success',
          affiliateId: 'AFF-TEST-001'
        })
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        totalCount: expect.any(Number),
        logs: expect.arrayContaining([
          expect.objectContaining({
            action: 'upload_success',
            targetInfo: {
              affiliateId: 'AFF-TEST-001'
            }
          })
        ])
      });
    });

    it('should export audit logs as CSV', async () => {
      const response = await request(app)
        .get('/api/v1/w9/admin/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          startDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          endDate: new Date().toISOString()
        })
        .expect(200);
      
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.text).toContain('Timestamp,Action');
      expect(response.text).toContain('upload_success');
      expect(response.text).toContain('verify_success');
    });
  });

  describe('W-9 Expiry and Retention', () => {
    it('should set expiry date 3 years from upload', async () => {
      await request(app)
        .post('/api/v1/w9/upload')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .attach('w9document', testPdfBuffer, 'test-w9.pdf');
      
      const document = await W9Document.findOne({ affiliateId: 'AFF-TEST-001' });
      
      const expectedExpiry = new Date();
      expectedExpiry.setFullYear(expectedExpiry.getFullYear() + 3);
      
      expect(document.expiryDate.getFullYear()).toBe(expectedExpiry.getFullYear());
    });
  });

  describe('Security and Permissions', () => {
    it('should not allow non-admin to access admin endpoints', async () => {
      await request(app)
        .get('/api/v1/w9/admin/pending')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .expect(403);
    });

    it('should not allow unauthenticated access', async () => {
      await request(app)
        .get('/api/v1/w9/status')
        .expect(401);
    });

    it('should not allow affiliate to download other affiliates W-9', async () => {
      // Create another affiliate
      const otherAffiliate = await Affiliate.create({
        affiliateId: 'AFF-OTHER-001',
        firstName: 'Other',
        lastName: 'Affiliate',
        email: 'other@example.com',
        password: 'Other123!@#',
        phoneNumber: '+1234567891'
      });
      
      // Upload W-9 for other affiliate
      const otherToken = generateToken(otherAffiliate._id, 'affiliate');
      await request(app)
        .post('/api/v1/w9/upload')
        .set('Authorization', `Bearer ${otherToken}`)
        .attach('w9document', testPdfBuffer, 'other-w9.pdf');
      
      // Try to download with first affiliate's token
      const response = await request(app)
        .get('/api/v1/w9/download')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .expect(404);
      
      expect(response.body.message).toContain('No W-9 document found');
    });
  });
});