const W9AuditService = require('../../server/services/w9AuditService');
const W9AuditLog = require('../../server/models/W9AuditLog');

// Mock the W9AuditLog model
jest.mock('../../server/models/W9AuditLog');

describe('W9AuditService Unit Tests', () => {
  let mockReq;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock request
    mockReq = {
      user: {
        _id: 'user123',
        userType: 'affiliate',
        firstName: 'John',
        lastName: 'Doe'
      },
      get: jest.fn((header) => {
        const headers = {
          'user-agent': 'Mozilla/5.0',
          'x-forwarded-for': '192.168.1.1'
        };
        return headers[header.toLowerCase()];
      }),
      ip: '127.0.0.1',
      sessionID: 'session-123',
      headers: {
        'x-request-id': 'req-123'
      }
    };

    // Mock W9AuditLog.logAction
    W9AuditLog.logAction = jest.fn().mockResolvedValue({
      _id: 'log123',
      action: 'test_action',
      timestamp: new Date()
    });
  });

  describe('getUserInfo()', () => {
    it('should extract user info from request', () => {
      const userInfo = W9AuditService.getUserInfo(mockReq);
      
      expect(userInfo).toEqual({
        userId: 'user123',
        userType: 'affiliate',
        userName: 'John Doe'
      });
    });

    it('should handle missing user', () => {
      mockReq.user = null;
      
      const userInfo = W9AuditService.getUserInfo(mockReq);
      
      expect(userInfo).toEqual({
        userId: 'anonymous',
        userType: 'unknown',
        userName: 'Anonymous User'
      });
    });

    it('should handle administrator user type', () => {
      mockReq.user = {
        _id: 'admin123',
        userType: 'administrator',
        firstName: 'Admin',
        lastName: 'User'
      };
      
      const userInfo = W9AuditService.getUserInfo(mockReq);
      
      expect(userInfo.userType).toBe('administrator');
      expect(userInfo.userName).toBe('Admin User');
    });
  });

  describe('getMetadata()', () => {
    it('should extract metadata from request', () => {
      const metadata = W9AuditService.getMetadata(mockReq);
      
      expect(metadata).toEqual({
        ipAddress: '192.168.1.1', // x-forwarded-for takes precedence
        userAgent: 'Mozilla/5.0',
        requestId: 'req-123',
        sessionId: 'session-123'
      });
    });

    it('should fall back to req.ip if no x-forwarded-for', () => {
      mockReq.get = jest.fn().mockReturnValue(null);
      
      const metadata = W9AuditService.getMetadata(mockReq);
      
      expect(metadata.ipAddress).toBe('127.0.0.1');
    });

    it('should handle missing optional fields', () => {
      mockReq.sessionID = undefined;
      mockReq.headers = {};
      
      const metadata = W9AuditService.getMetadata(mockReq);
      
      expect(metadata.requestId).toBeUndefined();
      expect(metadata.sessionId).toBeUndefined();
    });
  });

  describe('logUploadAttempt()', () => {
    it('should log successful upload attempt', async () => {
      const affiliateId = 'AFF-123';
      const success = true;
      const details = { fileName: 'w9-form.pdf' };
      
      await W9AuditService.logUploadAttempt(mockReq, affiliateId, success, details);
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'upload_attempt',
        expect.objectContaining({
          userId: 'user123',
          userType: 'affiliate'
        }),
        { affiliateId },
        { success, ...details },
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String)
        })
      );
    });

    it('should log failed upload attempt', async () => {
      const affiliateId = 'AFF-123';
      const success = false;
      const details = { error: 'File too large' };
      
      await W9AuditService.logUploadAttempt(mockReq, affiliateId, success, details);
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'upload_attempt',
        expect.any(Object),
        { affiliateId },
        { success: false, error: 'File too large' },
        expect.any(Object)
      );
    });
  });

  describe('logUploadSuccess()', () => {
    it('should log successful upload', async () => {
      const affiliateId = 'AFF-123';
      const documentId = 'W9DOC-123';
      const details = {
        fileName: 'w9-form.pdf',
        fileSize: 1024000
      };
      
      await W9AuditService.logUploadSuccess(mockReq, affiliateId, documentId, details);
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'upload_success',
        expect.any(Object),
        { affiliateId, documentId },
        { success: true, ...details },
        expect.any(Object)
      );
    });
  });

  describe('logDownload()', () => {
    it('should log admin download', async () => {
      mockReq.user.userType = 'administrator';
      const affiliateId = 'AFF-123';
      const documentId = 'W9DOC-123';
      
      await W9AuditService.logDownload(mockReq, affiliateId, documentId);
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'download_admin',
        expect.objectContaining({ userType: 'administrator' }),
        { affiliateId, documentId },
        { success: true },
        expect.any(Object)
      );
    });

    it('should log affiliate download', async () => {
      mockReq.user.userType = 'affiliate';
      const affiliateId = 'AFF-123';
      const documentId = 'W9DOC-123';
      
      await W9AuditService.logDownload(mockReq, affiliateId, documentId);
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'download_affiliate',
        expect.objectContaining({ userType: 'affiliate' }),
        { affiliateId, documentId },
        { success: true },
        expect.any(Object)
      );
    });
  });

  describe('logVerifySuccess()', () => {
    it('should log successful verification', async () => {
      const affiliateId = 'AFF-123';
      const documentId = 'W9DOC-123';
      const details = {
        taxIdType: 'SSN',
        taxIdLast4: '1234',
        quickbooksVendorId: 'QB-123'
      };
      
      await W9AuditService.logVerifySuccess(mockReq, affiliateId, documentId, details);
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'verify_success',
        expect.any(Object),
        { affiliateId, documentId },
        { success: true, ...details },
        expect.any(Object)
      );
    });
  });

  describe('logReject()', () => {
    it('should log document rejection', async () => {
      const affiliateId = 'AFF-123';
      const documentId = 'W9DOC-123';
      const reason = 'Document is illegible';
      
      await W9AuditService.logReject(mockReq, affiliateId, documentId, reason);
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'reject',
        expect.any(Object),
        { affiliateId, documentId },
        { success: true, reason },
        expect.any(Object)
      );
    });
  });

  describe('logQuickBooksExport()', () => {
    it('should log QuickBooks export', async () => {
      const exportType = 'vendor';
      const exportId = 'EXP-123';
      const details = {
        format: 'csv',
        recordCount: 25
      };
      
      await W9AuditService.logQuickBooksExport(mockReq, exportType, exportId, details);
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'quickbooks_export',
        expect.any(Object),
        { exportType, exportId },
        { success: true, ...details },
        expect.any(Object)
      );
    });
  });

  describe('archiveOldLogs()', () => {
    it('should archive logs older than 90 days', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      W9AuditLog.updateMany = jest.fn().mockResolvedValue({
        modifiedCount: 150
      });
      
      const result = await W9AuditService.archiveOldLogs();
      
      expect(W9AuditLog.updateMany).toHaveBeenCalledWith(
        {
          timestamp: { $lt: expect.any(Date) },
          isArchived: false
        },
        {
          $set: {
            isArchived: true,
            archivedAt: expect.any(Date)
          }
        }
      );
      
      expect(result.archivedCount).toBe(150);
    });

    it('should use custom days parameter', async () => {
      W9AuditLog.updateMany = jest.fn().mockResolvedValue({
        modifiedCount: 50
      });
      
      await W9AuditService.archiveOldLogs(30);
      
      expect(W9AuditLog.updateMany).toHaveBeenCalled();
      const query = W9AuditLog.updateMany.mock.calls[0][0];
      const cutoffDate = query.timestamp.$lt;
      
      // Check that cutoff is approximately 30 days ago
      const daysDiff = (new Date() - cutoffDate) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(30, 0);
    });
  });

  describe('generateComplianceReport()', () => {
    it('should generate compliance report for date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      
      // Mock aggregation pipeline
      W9AuditLog.aggregate = jest.fn().mockResolvedValue([
        {
          _id: { action: 'upload_success' },
          count: 25,
          uniqueUsers: 20,
          uniqueAffiliates: 20
        },
        {
          _id: { action: 'verify_success' },
          count: 15,
          uniqueUsers: 2,
          uniqueAffiliates: 15
        }
      ]);
      
      const report = await W9AuditService.generateComplianceReport(startDate, endDate);
      
      expect(W9AuditLog.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          })
        })
      ]));
      
      expect(report).toEqual({
        period: { start: startDate, end: endDate },
        summary: expect.arrayContaining([
          expect.objectContaining({
            action: 'upload_success',
            count: 25
          })
        ]),
        generatedAt: expect.any(Date)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle W9AuditLog.logAction errors gracefully', async () => {
      W9AuditLog.logAction.mockRejectedValue(new Error('Database error'));
      
      // Should not throw
      await expect(
        W9AuditService.logUploadAttempt(mockReq, 'AFF-123', true)
      ).resolves.not.toThrow();
    });

    it('should handle missing request object', async () => {
      const nullReq = null;
      
      await W9AuditService.logUploadAttempt(nullReq, 'AFF-123', true);
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'upload_attempt',
        expect.objectContaining({
          userId: 'anonymous',
          userType: 'unknown'
        }),
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          ipAddress: 'unknown'
        })
      );
    });
  });

  describe('System User Actions', () => {
    it('should handle system-initiated actions', async () => {
      const systemReq = {
        user: {
          _id: 'system',
          userType: 'system',
          firstName: 'System',
          lastName: 'Process'
        },
        get: jest.fn(),
        ip: '127.0.0.1'
      };
      
      await W9AuditService.logUploadSuccess(
        systemReq,
        'AFF-123',
        'W9DOC-123',
        { automated: true }
      );
      
      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'upload_success',
        expect.objectContaining({
          userType: 'system',
          userName: 'System Process'
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});