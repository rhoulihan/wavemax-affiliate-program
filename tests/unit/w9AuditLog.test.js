const mongoose = require('mongoose');
const W9AuditLog = require('../../server/models/W9AuditLog');

describe('W9AuditLog Model Unit Tests', () => {
  let mockLogEntry;

  beforeEach(() => {
    // Create a mock audit log entry
    mockLogEntry = new W9AuditLog({
      action: 'upload_success',
      userInfo: {
        userId: 'user123',
        userType: 'affiliate',
        userName: 'John Doe'
      },
      targetInfo: {
        affiliateId: 'AFF-123',
        documentId: 'W9DOC-123'
      },
      metadata: {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'req-123',
        sessionId: 'session-123'
      },
      details: {
        success: true,
        fileSize: 1024000,
        fileName: 'w9-form.pdf'
      }
    });
  });

  describe('Schema Validation', () => {
    it('should create a valid audit log entry', () => {
      const error = mockLogEntry.validateSync();
      expect(error).toBeUndefined();
      expect(mockLogEntry.action).toBe('upload_success');
      expect(mockLogEntry.userInfo.userId).toBe('user123');
    });

    it('should require action field', () => {
      const logEntry = new W9AuditLog({
        userInfo: { userId: 'user123', userType: 'affiliate' }
      });
      const error = logEntry.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.action).toBeDefined();
    });

    it('should validate action enum values', () => {
      const invalidActions = ['invalid_action', 'fake_action'];
      
      invalidActions.forEach(action => {
        mockLogEntry.action = action;
        const error = mockLogEntry.validateSync();
        expect(error).toBeDefined();
        expect(error.errors.action).toBeDefined();
      });
    });

    it('should accept all valid action types', () => {
      const validActions = [
        'upload_attempt', 'upload_success', 'upload_failure',
        'download_affiliate', 'download_admin',
        'verify_attempt', 'verify_success',
        'reject', 'expire', 'delete',
        'quickbooks_export', 'legal_hold'
      ];
      
      validActions.forEach(action => {
        mockLogEntry.action = action;
        const error = mockLogEntry.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should set default timestamp', () => {
      expect(mockLogEntry.timestamp).toBeDefined();
      expect(mockLogEntry.timestamp).toBeInstanceOf(Date);
    });

    it('should set isArchived to false by default', () => {
      expect(mockLogEntry.isArchived).toBe(false);
    });
  });

  describe('User Info Validation', () => {
    it('should validate userType enum', () => {
      const validUserTypes = ['affiliate', 'administrator', 'operator', 'system'];
      
      validUserTypes.forEach(userType => {
        mockLogEntry.userInfo.userType = userType;
        const error = mockLogEntry.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid userType', () => {
      mockLogEntry.userInfo.userType = 'invalid_type';
      const error = mockLogEntry.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['userInfo.userType']).toBeDefined();
    });
  });

  describe('Static Methods', () => {
    beforeEach(() => {
      // Mock the create method
      W9AuditLog.create = jest.fn();
    });

    describe('logAction()', () => {
      it('should create audit log entry with all parameters', async () => {
        const action = 'upload_success';
        const userInfo = {
          userId: 'user123',
          userType: 'affiliate',
          userName: 'John Doe'
        };
        const targetInfo = {
          affiliateId: 'AFF-123',
          documentId: 'W9DOC-123'
        };
        const details = {
          success: true,
          fileSize: 1024000
        };
        const metadata = {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        };

        const mockCreatedLog = {
          _id: 'log123',
          action,
          userInfo,
          targetInfo,
          details,
          metadata,
          timestamp: new Date()
        };

        W9AuditLog.create.mockResolvedValue(mockCreatedLog);

        const result = await W9AuditLog.logAction(
          action,
          userInfo,
          targetInfo,
          details,
          metadata
        );

        expect(W9AuditLog.create).toHaveBeenCalledWith({
          action,
          userInfo,
          targetInfo,
          details,
          metadata,
          timestamp: expect.any(Date)
        });
        expect(result).toEqual(mockCreatedLog);
      });

      it('should handle logging errors gracefully', async () => {
        const error = new Error('Database error');
        W9AuditLog.create.mockRejectedValue(error);
        
        // Mock console.error to prevent test output pollution
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const result = await W9AuditLog.logAction(
          'upload_attempt',
          { userId: 'user123', userType: 'affiliate' }
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to create audit log:',
          error
        );
        expect(result).toBeNull();
        
        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('Indexes', () => {
    it('should have required indexes defined', () => {
      const indexes = W9AuditLog.schema.indexes();
      
      // Check for action index
      const hasActionIndex = indexes.some(index => 
        index[0].action === 1
      );
      
      // Check for timestamp index
      const hasTimestampIndex = indexes.some(index => 
        index[0].timestamp === -1
      );
      
      // Check for composite index
      const hasCompositeIndex = indexes.some(index => 
        index[0]['targetInfo.affiliateId'] === 1 && 
        index[0].timestamp === -1
      );
      
      expect(hasActionIndex).toBe(true);
      expect(hasTimestampIndex).toBe(true);
      expect(hasCompositeIndex).toBe(true);
    });
  });

  describe('Archive Flag', () => {
    it('should track archived status', () => {
      mockLogEntry.isArchived = true;
      mockLogEntry.archivedAt = new Date();
      
      const error = mockLogEntry.validateSync();
      expect(error).toBeUndefined();
      expect(mockLogEntry.isArchived).toBe(true);
      expect(mockLogEntry.archivedAt).toBeDefined();
    });
  });

  describe('Different Action Types', () => {
    it('should handle upload action details', () => {
      mockLogEntry.action = 'upload_success';
      mockLogEntry.details = {
        success: true,
        fileSize: 2048000,
        fileName: 'tax-w9-2025.pdf',
        encryptionApplied: true
      };
      
      const error = mockLogEntry.validateSync();
      expect(error).toBeUndefined();
    });

    it('should handle verification action details', () => {
      mockLogEntry.action = 'verify_success';
      mockLogEntry.details = {
        success: true,
        taxIdType: 'SSN',
        taxIdLast4: '1234',
        quickbooksVendorId: 'QB-VENDOR-123'
      };
      
      const error = mockLogEntry.validateSync();
      expect(error).toBeUndefined();
    });

    it('should handle rejection action details', () => {
      mockLogEntry.action = 'reject';
      mockLogEntry.details = {
        success: true,
        reason: 'Document is illegible',
        emailSent: true
      };
      
      const error = mockLogEntry.validateSync();
      expect(error).toBeUndefined();
    });

    it('should handle QuickBooks export action details', () => {
      mockLogEntry.action = 'quickbooks_export';
      mockLogEntry.details = {
        success: true,
        exportType: 'vendor',
        recordCount: 25,
        format: 'csv',
        exportId: 'EXP-123'
      };
      
      const error = mockLogEntry.validateSync();
      expect(error).toBeUndefined();
    });
  });

  describe('System Actions', () => {
    it('should allow system user type for automated actions', () => {
      mockLogEntry.action = 'expire';
      mockLogEntry.userInfo = {
        userId: 'system',
        userType: 'system',
        userName: 'Data Retention Service'
      };
      mockLogEntry.details = {
        success: true,
        reason: 'Document age exceeds 3 year retention policy'
      };
      
      const error = mockLogEntry.validateSync();
      expect(error).toBeUndefined();
      expect(mockLogEntry.userInfo.userType).toBe('system');
    });
  });
});