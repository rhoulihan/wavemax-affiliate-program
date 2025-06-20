const request = require('supertest');
const express = require('express');
const w9Controller = require('../../server/controllers/w9Controller');
const Affiliate = require('../../server/models/Affiliate');
const W9Document = require('../../server/models/W9Document');
const W9AuditLog = require('../../server/models/W9AuditLog');
const W9AuditService = require('../../server/services/w9AuditService');
const w9Storage = require('../../server/utils/w9Storage');
const emailService = require('../../server/utils/emailService');

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/W9Document');
jest.mock('../../server/models/W9AuditLog');
jest.mock('../../server/services/w9AuditService', () => ({
  logUploadAttempt: jest.fn(),
  logUploadSuccess: jest.fn(),
  logUploadFailure: jest.fn(),
  logVerification: jest.fn(),
  logRejection: jest.fn(),
  logDownload: jest.fn(),
  getComplianceAuditTrail: jest.fn(),
  generateComplianceReport: jest.fn()
}));
jest.mock('../../server/utils/w9Storage');
jest.mock('../../server/utils/emailService');

describe('W9Controller Unit Tests', () => {
  let app;
  let mockReq, mockRes;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock request and response
    mockReq = {
      user: {
        _id: 'admin123',
        userType: 'administrator',
        firstName: 'John',
        lastName: 'Admin'
      },
      file: {
        originalname: 'test-w9.pdf',
        mimetype: 'application/pdf',
        size: 1024000,
        buffer: Buffer.from('test pdf content')
      },
      params: {},
      query: {},
      body: {},
      get: jest.fn().mockReturnValue('127.0.0.1')
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  describe('uploadW9Document', () => {
    it('should successfully upload W-9 document for affiliate', async () => {
      // Setup affiliate user
      mockReq.user = {
        _id: 'affiliate123',
        userType: 'affiliate',
        affiliateId: 'AFF-123'
      };

      const mockAffiliate = {
        _id: 'affiliate123',
        affiliateId: 'AFF-123',
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'test@example.com',
        w9Information: {
          status: 'not_submitted'
        },
        save: jest.fn(),
        canReceivePayments: jest.fn().mockReturnValue(true)
      };

      const mockDocument = {
        _id: 'doc123',
        documentId: 'W9DOC-123',
        affiliateId: 'AFF-123',
        save: jest.fn(),
        canReceivePayments: jest.fn().mockReturnValue(true)
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      W9Document.findActiveForAffiliate.mockResolvedValue(null);
      W9Document.prototype.save = jest.fn().mockResolvedValue(mockDocument);
      w9Storage.store.mockResolvedValue({ documentId: 'W9DOC-123' });
      W9AuditService.logUploadAttempt.mockResolvedValue();

      await w9Controller.uploadW9Document(mockReq, mockRes);

      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF-123' });
      expect(w9Storage.store).toHaveBeenCalled();
      expect(mockAffiliate.w9Information.status).toBe('pending_review');
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(W9AuditService.logUploadAttempt).toHaveBeenCalledWith(
        mockReq,
        'AFF-123',
        true,
        expect.any(Object)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'W-9 document uploaded successfully and is pending review',
        documentId: 'W9DOC-123',
        status: 'pending_review'
      });
    });

    it('should handle upload failure', async () => {
      mockReq.user = {
        _id: 'affiliate123',
        userType: 'affiliate',
        affiliateId: 'AFF-123'
      };

      const mockAffiliate = {
        _id: 'affiliate123',
        affiliateId: 'AFF-123',
        w9Information: { status: 'not_submitted' }
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      w9Storage.store.mockRejectedValue(new Error('Storage failed'));
      W9AuditService.logUploadAttempt.mockResolvedValue();

      await w9Controller.uploadW9Document(mockReq, mockRes);

      expect(W9AuditService.logUploadAttempt).toHaveBeenCalledWith(
        mockReq,
        'AFF-123',
        false,
        expect.any(Object)
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Error uploading W-9 document',
        error: 'Storage failed'
      });
    });
  });

  describe('verifyW9Document', () => {
    it('should successfully verify W-9 document', async () => {
      mockReq.params.affiliateId = 'AFF-123';
      mockReq.body = {
        taxIdType: 'SSN',
        taxIdLast4: '1234',
        businessName: 'Test Business',
        quickbooksVendorId: 'QB-123'
      };

      const mockAffiliate = {
        _id: 'affiliate123',
        affiliateId: 'AFF-123',
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'test@example.com',
        languagePreference: 'en',
        w9Information: {
          status: 'pending_review',
          documentId: 'W9DOC-123',
          quickbooksData: {}
        },
        save: jest.fn(),
        canReceivePayments: jest.fn().mockReturnValue(true)
      };

      const mockDocument = {
        _id: 'doc123',
        documentId: 'W9DOC-123',
        verificationStatus: 'pending',
        save: jest.fn(),
        canReceivePayments: jest.fn().mockReturnValue(true)
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      W9Document.findActiveForAffiliate.mockResolvedValue(mockDocument);
      W9AuditService.logVerification.mockResolvedValue();
      // emailService.sendW9VerificationEmail is not called in the controller

      await w9Controller.verifyW9Document(mockReq, mockRes);

      expect(mockAffiliate.w9Information.status).toBe('verified');
      expect(mockAffiliate.w9Information.taxIdType).toBe('SSN');
      expect(mockAffiliate.w9Information.taxIdLast4).toBe('1234');
      expect(mockDocument.verificationStatus).toBe('verified');
      expect(W9AuditService.logVerification).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'W-9 document verified successfully',
        affiliate: expect.any(Object)
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with filters', async () => {
      mockReq.query = {
        action: 'upload_success',
        affiliateId: 'AFF-123',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        limit: '50'
      };

      const mockLogs = [
        {
          _id: 'log1',
          timestamp: new Date(),
          action: 'upload_success',
          userInfo: { userId: 'user1', userType: 'affiliate' },
          targetInfo: { affiliateId: 'AFF-123' },
          metadata: { ipAddress: '127.0.0.1' },
          details: { success: true }
        }
      ];

      W9AuditLog.countDocuments.mockResolvedValue(1);
      W9AuditLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockLogs)
      });

      await w9Controller.getAuditLogs(mockReq, mockRes);

      expect(W9AuditLog.countDocuments).toHaveBeenCalledWith({
        action: 'upload_success',
        'targetInfo.affiliateId': 'AFF-123',
        timestamp: expect.any(Object)
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        totalCount: 1,
        limit: 50,
        offset: 0,
        logs: expect.arrayContaining([
          expect.objectContaining({
            action: 'upload_success',
            userInfo: expect.any(Object),
            targetInfo: expect.any(Object)
          })
        ])
      });
    });
  });

  describe('exportAuditLogs', () => {
    it('should export audit logs as CSV', async () => {
      mockReq.query = {
        format: 'csv',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      const mockLogs = [
        {
          timestamp: new Date('2025-01-15'),
          action: 'upload_success',
          userInfo: {
            userId: 'user1',
            userType: 'affiliate',
            userName: 'Test User'
          },
          targetInfo: {
            affiliateId: 'AFF-123',
            documentId: 'W9DOC-123'
          },
          metadata: {
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0'
          },
          details: {
            success: true
          }
        }
      ];

      W9AuditLog.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockLogs)
      });

      await w9Controller.exportAuditLogs(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="w9-audit-log-')
      );
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Timestamp,Action'));
    });
  });

  describe('getPendingW9Documents', () => {
    it('should retrieve all pending W-9 documents', async () => {
      const mockDocuments = [
        {
          documentId: 'W9DOC-001',
          uploadedAt: new Date('2025-01-10'),
          affiliateId: {
            affiliateId: 'AFF-001',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            businessName: 'John\'s Business'
          }
        },
        {
          documentId: 'W9DOC-002',
          uploadedAt: new Date('2025-01-15'),
          affiliateId: {
            affiliateId: 'AFF-002',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            businessName: 'Jane\'s Business'
          }
        }
      ];

      W9Document.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockDocuments)
        })
      });

      await w9Controller.getPendingW9Documents(mockReq, mockRes);

      expect(W9Document.find).toHaveBeenCalledWith({
        verificationStatus: 'pending',
        isActive: true
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        count: 2,
        documents: expect.arrayContaining([
          expect.objectContaining({
            documentId: 'W9DOC-001',
            affiliateId: 'AFF-001',
            affiliateName: 'John Doe',
            affiliateEmail: 'john@example.com',
            businessName: 'John\'s Business'
          }),
          expect.objectContaining({
            documentId: 'W9DOC-002',
            affiliateId: 'AFF-002',
            affiliateName: 'Jane Smith',
            affiliateEmail: 'jane@example.com',
            businessName: 'Jane\'s Business'
          })
        ])
      });
    });
  });

  describe('rejectW9Document', () => {
    it('should successfully reject W-9 document', async () => {
      mockReq.params.affiliateId = 'AFF-123';
      mockReq.body = {
        reason: 'Document is illegible'
      };

      const mockAffiliate = {
        _id: 'affiliate123',
        affiliateId: 'AFF-123',
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'test@example.com',
        languagePreference: 'en',
        w9Information: {
          status: 'pending_review',
          documentId: 'W9DOC-123',
          quickbooksData: {}
        },
        save: jest.fn(),
        canReceivePayments: jest.fn().mockReturnValue(true)
      };

      const mockDocument = {
        _id: 'doc123',
        documentId: 'W9DOC-123',
        verificationStatus: 'pending',
        isActive: true,
        save: jest.fn(),
        canReceivePayments: jest.fn().mockReturnValue(true)
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      W9Document.findActiveForAffiliate.mockResolvedValue(mockDocument);
      W9AuditService.logRejection.mockResolvedValue();
      // emailService.sendW9VerificationEmail is not called in the controller

      await w9Controller.rejectW9Document(mockReq, mockRes);

      expect(mockAffiliate.w9Information.status).toBe('rejected');
      expect(mockAffiliate.w9Information.rejectionReason).toBe('Document is illegible');
      expect(mockDocument.verificationStatus).toBe('rejected');
      expect(mockDocument.isActive).toBe(false);
      expect(W9AuditService.logRejection).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'W-9 document rejected',
        affiliate: expect.any(Object)
      });
    });
  });
});