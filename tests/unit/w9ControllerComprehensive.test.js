const w9Controller = require('../../server/controllers/w9Controller');
const Affiliate = require('../../server/models/Affiliate');
const W9Document = require('../../server/models/W9Document');
const W9AuditLog = require('../../server/models/W9AuditLog');
const W9AuditService = require('../../server/services/w9AuditService');
const w9Storage = require('../../server/utils/w9Storage');
const emailService = require('../../server/utils/emailService');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/W9Document');
jest.mock('../../server/models/W9AuditLog');
jest.mock('../../server/services/w9AuditService');
jest.mock('../../server/utils/w9Storage');
jest.mock('../../server/utils/emailService');
jest.mock('express-validator');

describe('W9 Controller - Comprehensive Tests', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      user: { _id: 'user123', affiliateId: 'AFF-123' },
      file: {
        originalname: 'w9-form.pdf',
        mimetype: 'application/pdf',
        size: 1024000,
        buffer: Buffer.from('test pdf content')
      },
      params: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      sessionID: 'session123'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      download: jest.fn(),
      set: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Default mock for validation
    validationResult.mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    });
  });

  describe('uploadW9Document', () => {
    it('should upload W9 document successfully', async () => {
      const mockAffiliate = {
        _id: 'aff123',
        affiliateId: 'AFF-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        w9Information: { status: 'not_submitted' },
        save: jest.fn()
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      W9Document.findOne.mockResolvedValue(null); // No pending document
      W9Document.updateMany.mockResolvedValue({});
      const mockSavedDoc = {
        documentId: 'W9DOC-123',
        save: jest.fn()
      };
      W9Document.prototype.save = jest.fn().mockImplementation(function() {
        this.documentId = 'W9DOC-123';
        return Promise.resolve(this);
      });
      w9Storage.store.mockResolvedValue('encrypted-key');
      W9AuditService.logUploadAttempt.mockResolvedValue();

      await w9Controller.uploadW9Document(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'W-9 document uploaded successfully and is pending review',
        documentId: expect.any(String),
        status: 'pending_review'
      });
      expect(mockAffiliate.w9Information.status).toBe('pending_review');
      expect(mockAffiliate.save).toHaveBeenCalled();
    });

    it('should reject upload when validation fails', async () => {
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Invalid input' }])
      });

      await w9Controller.uploadW9Document(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'Invalid input' }] });
    });

    it('should reject upload when no file provided', async () => {
      req.file = null;

      await w9Controller.uploadW9Document(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'No file uploaded' });
    });

    it('should reject upload when affiliate not found', async () => {
      Affiliate.findOne.mockResolvedValue(null);

      await w9Controller.uploadW9Document(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Affiliate not found' });
    });

    it('should reject upload when pending W9 exists', async () => {
      Affiliate.findOne.mockResolvedValue({ affiliateId: 'AFF-123' });
      W9Document.findOne.mockResolvedValue({ 
        documentId: 'W9DOC-999',
        verificationStatus: 'pending' 
      });

      await w9Controller.uploadW9Document(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'You already have a W-9 document pending review. Please wait for verification before uploading another.' 
      });
    });

    it('should handle storage errors gracefully', async () => {
      Affiliate.findOne.mockResolvedValue({
        affiliateId: 'AFF-123',
        w9Information: {},
        save: jest.fn()
      });
      W9Document.findOne.mockResolvedValue(null);
      w9Storage.store.mockRejectedValue(new Error('Storage failed'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await w9Controller.uploadW9Document(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Error uploading W-9 document',
        error: 'Storage failed'
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getW9Status', () => {
    it('should get W9 status for affiliate', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF-123',
        w9Information: {
          status: 'verified',
          taxIdLast4: '1234',
          taxIdType: 'EIN',
          businessName: 'Test LLC',
          submittedAt: new Date('2025-01-01'),
          verifiedAt: new Date('2025-01-02')
        },
        getW9StatusDisplay: jest.fn().mockReturnValue('Verified'),
        canReceivePayments: jest.fn().mockReturnValue(true)
      };

      Affiliate.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliate)
      });

      await w9Controller.getW9Status(req, res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'verified',
        statusDisplay: 'Verified',
        canReceivePayments: true,
        submittedAt: new Date('2025-01-01'),
        verifiedAt: new Date('2025-01-02'),
        rejectedAt: undefined,
        rejectionReason: undefined,
        expiryDate: undefined,
        taxInfo: {
          type: 'EIN',
          last4: '1234',
          businessName: 'Test LLC'
        }
      });
    });

    it('should return not_submitted status when no W9', async () => {
      const mockAffiliate = {
        affiliateId: 'AFF-123',
        w9Information: { status: 'not_submitted' },
        getW9StatusDisplay: jest.fn().mockReturnValue('Not Submitted'),
        canReceivePayments: jest.fn().mockReturnValue(false)
      };

      Affiliate.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliate)
      });

      await w9Controller.getW9Status(req, res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'not_submitted',
        statusDisplay: 'Not Submitted',
        canReceivePayments: false,
        submittedAt: undefined,
        verifiedAt: undefined,
        rejectedAt: undefined,
        rejectionReason: undefined,
        expiryDate: undefined
      });
    });
  });

  describe('downloadOwnW9', () => {
    it('should download own W9 document', async () => {
      const mockDocument = {
        documentId: 'W9DOC-123',
        fileName: 'w9-form.pdf',
        encryptedStorageKey: 'encrypted-key',
        verificationStatus: 'verified'
      };

      W9Document.findActiveForAffiliate.mockResolvedValue(mockDocument);
      w9Storage.retrieve.mockResolvedValue({ buffer: Buffer.from('pdf content') });
      W9AuditService.logDownload.mockResolvedValue();

      await w9Controller.downloadOwnW9(req, res);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="W9_AFF-123.pdf"',
        'Content-Length': 11
      });
      expect(res.send).toHaveBeenCalled();
      expect(W9AuditService.logDownload).toHaveBeenCalled();
    });

    it('should return 404 when no active W9 found', async () => {
      W9Document.findActiveForAffiliate.mockResolvedValue(null);

      await w9Controller.downloadOwnW9(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No W-9 document found'
      });
    });
  });

  describe('getPendingW9Documents', () => {
    it('should get pending W9 documents for admin', async () => {
      req.user = { _id: 'admin123', role: 'administrator' };

      const mockDocuments = [
        {
          documentId: 'W9DOC-123',
          affiliateId: { 
            affiliateId: 'AFF-123',
            firstName: 'John', 
            lastName: 'Doe',
            email: 'john@example.com',
            businessName: 'John Corp'
          },
          uploadedAt: new Date('2025-01-01')
        }
      ];

      W9Document.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockDocuments)
      });

      await w9Controller.getPendingW9Documents(req, res);

      expect(res.json).toHaveBeenCalledWith({
        count: 1,
        documents: [
          {
            documentId: 'W9DOC-123',
            affiliateId: 'AFF-123',
            affiliateName: 'John Doe',
            affiliateEmail: 'john@example.com',
            businessName: 'John Corp',
            uploadedAt: new Date('2025-01-01'),
            daysWaiting: expect.any(Number)
          }
        ]
      });
    });
  });

  describe('verifyW9Document', () => {
    it('should verify W9 document', async () => {
      req.params = { affiliateId: 'AFF-123' };
      req.body = {
        taxIdType: 'SSN',
        taxIdLast4: '1234',
        businessName: 'Test LLC',
        notes: 'Verified successfully'
      };
      req.user = { id: 'admin123' };

      const mockDocument = {
        documentId: 'W9DOC-123',
        verificationStatus: 'pending',
        save: jest.fn()
      };

      const mockAffiliate = {
        affiliateId: 'AFF-123',
        email: 'test@example.com',
        firstName: 'John',
        w9Information: {},
        save: jest.fn()
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      W9Document.findActiveForAffiliate.mockResolvedValue(mockDocument);
      W9AuditService.logVerification.mockResolvedValue();
      emailService.sendW9VerificationEmail.mockResolvedValue();

      await w9Controller.verifyW9Document(req, res);

      expect(mockDocument.verificationStatus).toBe('verified');
      expect(mockDocument.save).toHaveBeenCalled();
      expect(mockAffiliate.w9Information.status).toBe('verified');
      expect(mockAffiliate.w9Information.taxIdLast4).toBe('1234');
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'W-9 verified successfully'
      });
    });

    it('should return 404 when affiliate not found', async () => {
      req.params = { affiliateId: 'AFF-999' };
      Affiliate.findOne.mockResolvedValue(null);

      await w9Controller.verifyW9Document(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Affiliate not found'
      });
    });

    it('should return 404 when no W9 document found', async () => {
      req.params = { affiliateId: 'AFF-123' };
      Affiliate.findOne.mockResolvedValue({ affiliateId: 'AFF-123' });
      W9Document.findActiveForAffiliate.mockResolvedValue(null);

      await w9Controller.verifyW9Document(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'No W-9 document found for this affiliate'
      });
    });
  });

  describe('rejectW9Document', () => {
    it('should reject W9 document', async () => {
      req.params = { affiliateId: 'AFF-123' };
      req.body = {
        rejectionReason: 'illegible_document',
        notes: 'Please upload a clearer copy'
      };
      req.user = { id: 'admin123' };

      const mockDocument = {
        documentId: 'W9DOC-123',
        verificationStatus: 'pending',
        save: jest.fn()
      };

      const mockAffiliate = {
        affiliateId: 'AFF-123',
        email: 'test@example.com',
        firstName: 'John',
        w9Information: {},
        save: jest.fn()
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      W9Document.findActiveForAffiliate.mockResolvedValue(mockDocument);
      W9AuditService.logRejection.mockResolvedValue();
      emailService.sendW9VerificationEmail.mockResolvedValue();

      await w9Controller.rejectW9Document(req, res);

      expect(mockDocument.verificationStatus).toBe('rejected');
      expect(mockDocument.save).toHaveBeenCalled();
      expect(mockAffiliate.w9Information.status).toBe('rejected');
      expect(mockAffiliate.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'W-9 rejected'
      });
    });

    it('should return 404 when affiliate not found', async () => {
      req.params = { affiliateId: 'AFF-999' };
      req.body = { rejectionReason: 'illegible_document' };
      Affiliate.findOne.mockResolvedValue(null);

      await w9Controller.rejectW9Document(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Affiliate not found'
      });
    });
  });

  describe('getW9History', () => {
    it('should get W9 history for affiliate', async () => {
      req.params = { affiliateId: 'AFF-123' };

      const mockDocuments = [
        {
          documentId: 'W9DOC-123',
          uploadedAt: new Date('2025-01-01'),
          verificationStatus: 'verified'
        },
        {
          documentId: 'W9DOC-122',
          uploadedAt: new Date('2024-12-01'),
          verificationStatus: 'rejected'
        }
      ];

      W9Document.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockDocuments)
      });

      await w9Controller.getW9History(req, res);

      expect(W9Document.find).toHaveBeenCalledWith({ affiliateId: 'AFF-123' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        documents: mockDocuments
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should get audit logs with filters', async () => {
      req.query = {
        affiliateId: 'AFF-123',
        action: 'upload_success',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        limit: '20',
        page: '1'
      };

      const mockLogs = [
        {
          action: 'upload_success',
          performedBy: { displayName: 'John Doe' },
          timestamp: new Date()
        }
      ];

      W9AuditLog.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue(mockLogs)
      });
      W9AuditLog.countDocuments.mockResolvedValue(1);

      await w9Controller.getAuditLogs(req, res);

      expect(W9AuditLog.find).toHaveBeenCalledWith({
        'target.id': 'AFF-123',
        action: 'upload_success',
        timestamp: {
          $gte: new Date('2025-01-01'),
          $lte: expect.any(Date)
        }
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        logs: mockLogs,
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          pages: 1
        }
      });
    });
  });

  describe('exportAuditLogs', () => {
    it('should export audit logs as CSV', async () => {
      req.query = { format: 'csv' };

      const mockLogs = [
        {
          action: 'upload_success',
          performedBy: { displayName: 'John Doe' },
          target: { id: 'AFF-123', type: 'affiliate' },
          timestamp: new Date('2025-01-15T10:30:00Z'),
          metadata: { fileName: 'w9.pdf' }
        }
      ];

      W9AuditLog.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockLogs)
      });

      await w9Controller.exportAuditLogs(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename="w9-audit-logs-'));
      expect(res.json).toHaveBeenCalled();
    });

    it('should export audit logs as JSON', async () => {
      req.query = { format: 'json' };

      const mockLogs = [{ action: 'upload_success' }];

      W9AuditLog.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockLogs)
      });

      await w9Controller.exportAuditLogs(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        logs: mockLogs,
        exportDate: expect.any(Date),
        totalRecords: 1
      });
    });
  });
});