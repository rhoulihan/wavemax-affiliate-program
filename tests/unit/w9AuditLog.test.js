const mongoose = require('mongoose');
const W9AuditLog = require('../../server/models/W9AuditLog');

describe('W9AuditLog Model Unit Tests', () => {
  let mockLogEntry;

  beforeEach(() => {
    // Create a mock audit log entry
    mockLogEntry = new W9AuditLog({
      action: 'upload_success',
      performedBy: {
        userId: 'user123',
        userType: 'affiliate',
        userName: 'John Doe',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      },
      target: {
        affiliateId: 'AFF-123',
        documentId: 'W9DOC-123'
      },
      details: {
        success: true,
        fileSize: 1024000,
        fileName: 'w9-form.pdf'
      },
      metadata: {
        requestId: 'req-123',
        sessionId: 'session-123'
      }
    });
  });

  describe('Schema Validation', () => {
    it('should create a valid audit log entry', () => {
      const error = mockLogEntry.validateSync();
      expect(error).toBeUndefined();
      expect(mockLogEntry.action).toBe('upload_success');
      expect(mockLogEntry.performedBy.userId).toBe('user123');
    });

    it('should require action field', () => {
      const logEntry = new W9AuditLog({
        performedBy: { userId: 'user123', userType: 'affiliate' }
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
        'upload_attempt', 'upload_success', 'upload_failed',
        'download_affiliate', 'download_admin',
        'view_attempt', 'verify_attempt', 'verify_success',
        'reject', 'delete', 'expire',
        'encryption_failed', 'decryption_failed',
        'access_denied', 'quickbooks_export'
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

    it('should set archived to false by default', () => {
      expect(mockLogEntry.archived).toBe(false);
    });
  });

  describe('User Info Validation', () => {
    it('should validate userType enum', () => {
      const validUserTypes = ['affiliate', 'administrator', 'system'];

      validUserTypes.forEach(userType => {
        mockLogEntry.performedBy.userType = userType;
        const error = mockLogEntry.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid userType', () => {
      mockLogEntry.performedBy.userType = 'invalid_type';
      const error = mockLogEntry.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['performedBy.userType']).toBeDefined();
    });
  });

  describe('Static Methods', () => {
    describe('logAction()', () => {
      it('should create audit log entry with all parameters', async () => {
        const action = 'upload_success';
        const performedBy = {
          userId: 'user123',
          userType: 'affiliate',
          userName: 'John Doe'
        };
        const target = {
          affiliateId: 'AFF-123',
          documentId: 'W9DOC-123'
        };
        const details = {
          success: true,
          fileSize: 1024000
        };
        const security = {
          sessionId: 'session-123',
          csrfTokenUsed: true
        };

        // Mock the save method on prototype
        const saveSpy = jest.spyOn(W9AuditLog.prototype, 'save').mockResolvedValue({
          action,
          performedBy,
          target,
          details,
          security,
          timestamp: new Date()
        });

        const result = await W9AuditLog.logAction(
          action,
          performedBy,
          target,
          details,
          security
        );

        expect(saveSpy).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result.action).toBe(action);

        saveSpy.mockRestore();
      });

      it('should handle logging errors gracefully', async () => {
        const error = new Error('Database error');

        // Mock save to throw error
        const saveSpy = jest.spyOn(W9AuditLog.prototype, 'save').mockRejectedValue(error);

        // Mock console.error to prevent test output pollution
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const result = await W9AuditLog.logAction(
          'upload_attempt',
          { userId: 'user123', userType: 'affiliate' }
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to create W9 audit log:',
          expect.objectContaining({
            action: 'upload_attempt',
            performedBy: 'user123',
            error: 'Database error'
          })
        );
        expect(result).toBeNull();

        consoleErrorSpy.mockRestore();
        saveSpy.mockRestore();
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
        index[0]['target.affiliateId'] === 1 &&
        index[0].timestamp === -1
      );

      expect(hasActionIndex).toBe(true);
      expect(hasTimestampIndex).toBe(true);
      expect(hasCompositeIndex).toBe(true);
    });
  });

  describe('Archive Flag', () => {
    it('should track archived status', () => {
      mockLogEntry.archived = true;
      mockLogEntry.archivedAt = new Date();

      const error = mockLogEntry.validateSync();
      expect(error).toBeUndefined();
      expect(mockLogEntry.archived).toBe(true);
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
      mockLogEntry.performedBy = {
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
      expect(mockLogEntry.performedBy.userType).toBe('system');
    });
  });
});