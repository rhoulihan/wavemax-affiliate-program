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
        role: 'affiliate',
        affiliateId: 'AFF000001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
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
      },
      connection: {
        encrypted: true,
        getCipher: jest.fn().mockReturnValue({ version: 'TLSv1.3' }),
        remoteAddress: '127.0.0.1'
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

      expect(userInfo).toMatchObject({
        userId: 'user123',
        userType: 'affiliate',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0'
      });
    });

    it('should handle missing user', () => {
      mockReq.user = null;

      const userInfo = W9AuditService.getUserInfo(mockReq);

      expect(userInfo).toMatchObject({
        userId: 'system',
        userType: 'system',
        userName: 'System',
        userEmail: 'unknown',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0'
      });
    });

    it('should handle administrator user type', () => {
      mockReq.user = {
        _id: 'admin123',
        role: 'administrator',
        administratorId: 'ADM001',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com'
      };

      const userInfo = W9AuditService.getUserInfo(mockReq);

      expect(userInfo.userType).toBe('administrator');
      expect(userInfo.userName).toBe('Admin User');
      expect(userInfo.userEmail).toBe('admin@example.com');
      expect(userInfo.userId).toBe('admin123');
    });
  });

  describe('getSecurityInfo()', () => {
    it('should extract security info from request', () => {
      const securityInfo = W9AuditService.getSecurityInfo(mockReq);

      expect(securityInfo).toEqual({
        sessionId: 'session-123',
        csrfTokenUsed: false,
        tlsVersion: 'TLSv1.3',
        encryptionKeyId: 'default'
      });
    });

    it('should handle missing connection encryption', () => {
      mockReq.connection.encrypted = false;

      const securityInfo = W9AuditService.getSecurityInfo(mockReq);

      expect(securityInfo.tlsVersion).toBeNull();
    });

    it('should handle missing optional fields', () => {
      mockReq.sessionID = undefined;
      mockReq.connection = {};

      const securityInfo = W9AuditService.getSecurityInfo(mockReq);

      expect(securityInfo.sessionId).toBeUndefined();
      expect(securityInfo.tlsVersion).toBeNull();
    });
  });

  describe('logUploadAttempt()', () => {
    it('should log successful upload attempt', async () => {
      const affiliateId = 'AFF-123';
      const success = true;
      const details = { fileName: 'w9-form.pdf' };

      await W9AuditService.logUploadAttempt(mockReq, affiliateId, success, details);

      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'upload_success',
        expect.objectContaining({
          userId: 'user123',
          userType: 'affiliate'
        }),
        { affiliateId },
        { success, ...details },
        expect.objectContaining({
          sessionId: 'session-123'
        })
      );
    });

    it('should log failed upload attempt', async () => {
      const affiliateId = 'AFF-123';
      const success = false;
      const details = { error: 'File too large' };

      await W9AuditService.logUploadAttempt(mockReq, affiliateId, success, details);

      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'upload_failed',
        expect.any(Object),
        { affiliateId },
        { success: false, error: 'File too large' },
        expect.any(Object)
      );
    });
  });

  describe('logDownload()', () => {
    it('should log admin download', async () => {
      const affiliateId = 'AFF-123';
      const documentId = 'W9DOC-123';

      await W9AuditService.logDownload(mockReq, affiliateId, documentId, true);

      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'download_admin',
        expect.any(Object),
        { affiliateId, documentId },
        { success: true },
        expect.any(Object)
      );
    });

    it('should log affiliate download', async () => {
      const affiliateId = 'AFF-123';
      const documentId = 'W9DOC-123';

      await W9AuditService.logDownload(mockReq, affiliateId, documentId, false);

      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'download_affiliate',
        expect.any(Object),
        { affiliateId, documentId },
        { success: true },
        expect.any(Object)
      );
    });
  });

  describe('logVerification()', () => {
    it('should log successful verification', async () => {
      const affiliateId = 'AFF-123';
      const documentId = 'W9DOC-123';
      const verificationData = {
        taxIdType: 'SSN',
        taxIdLast4: '1234',
        businessName: 'Test Business',
        quickbooksVendorId: 'QB-123'
      };

      await W9AuditService.logVerification(mockReq, affiliateId, documentId, verificationData);

      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'verify_success',
        expect.any(Object),
        { affiliateId, documentId },
        {
          success: true,
          verificationData: {
            taxIdType: 'SSN',
            taxIdLast4: '1234',
            businessName: 'Test Business',
            quickbooksVendorId: 'QB-123'
          }
        },
        expect.any(Object)
      );
    });
  });

  describe('logRejection()', () => {
    it('should log document rejection', async () => {
      const affiliateId = 'AFF-123';
      const documentId = 'W9DOC-123';
      const reason = 'Document is illegible';

      await W9AuditService.logRejection(mockReq, affiliateId, documentId, reason);

      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'reject',
        expect.any(Object),
        { affiliateId, documentId },
        { success: true, rejectionReason: reason },
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
        { exportId },
        {
          success: true,
          exportType,
          exportFormat: 'csv',
          recordCount: 25,
          format: 'csv'
        },
        expect.any(Object)
      );
    });
  });

  describe('archiveOldLogs()', () => {
    it('should archive logs older than 90 days', async () => {
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() - 90);

      W9AuditLog.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 10 });

      const result = await W9AuditService.archiveOldLogs();

      expect(W9AuditLog.updateMany).toHaveBeenCalledWith(
        {
          timestamp: { $lt: expect.any(Date) },
          archived: false,
          'compliance.legalHold': false
        },
        {
          $set: {
            archived: true,
            archivedAt: expect.any(Date),
            archivedBy: 'system_retention_policy'
          }
        }
      );
      expect(result).toMatchObject({
        archivedCount: 10,
        cutoffDate: expect.any(Date),
        policy: '2555 days retention'
      });
    });

    it('should use custom days parameter', async () => {
      W9AuditLog.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 5 });

      await W9AuditService.archiveOldLogs(30);

      expect(W9AuditLog.updateMany).toHaveBeenCalled();
    });
  });

  describe('generateComplianceReport()', () => {
    it('should generate compliance report for date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockReport = [
        { _id: 'upload_success', total: 10, successful: 8, failed: 2 },
        { _id: 'verify_success', total: 5, successful: 5, failed: 0 }
      ];

      W9AuditLog.aggregate = jest.fn().mockResolvedValue(mockReport);

      W9AuditLog.getComplianceReport = jest.fn().mockResolvedValue(mockReport);

      const result = await W9AuditService.generateComplianceReport(startDate, endDate);

      expect(W9AuditLog.getComplianceReport).toHaveBeenCalledWith(startDate, endDate);
      expect(result).toMatchObject({
        period: {
          start: startDate,
          end: endDate
        },
        summary: {
          totalActions: 15,
          successfulActions: 13,
          failedActions: 2
        },
        details: mockReport
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle W9AuditLog.logAction errors gracefully', async () => {
      W9AuditLog.logAction = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should re-throw the error
      await expect(
        W9AuditService.logUploadAttempt(mockReq, 'AFF-123', true)
      ).rejects.toThrow('Database error');
    });

    it('should handle missing request object', () => {
      // getUserInfo should handle null request safely
      expect(() => {
        W9AuditService.getUserInfo(null);
      }).toThrow();
    });
  });

  describe('System User Actions', () => {
    it('should handle system-initiated actions', async () => {
      const systemReq = {
        user: null,
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('System/1.0'),
        connection: { remoteAddress: '127.0.0.1' }
      };

      await W9AuditService.logAccessDenied(systemReq, 'AFF-123', 'Unauthorized access');

      expect(W9AuditLog.logAction).toHaveBeenCalledWith(
        'access_denied',
        expect.objectContaining({
          userId: 'system',
          userType: 'system',
          userName: 'System'
        }),
        { affiliateId: 'AFF-123' },
        {
          success: false,
          errorMessage: 'Unauthorized access'
        },
        expect.any(Object)
      );
    });
  });
});