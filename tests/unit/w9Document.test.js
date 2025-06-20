const mongoose = require('mongoose');
const W9Document = require('../../server/models/W9Document');

describe('W9Document Model Unit Tests', () => {
  let mockDocument;

  beforeEach(() => {
    // Create a mock document instance
    mockDocument = new W9Document({
      affiliateId: 'AFF-123',
      filename: 'encrypted-file.enc',
      originalName: 'test-w9.pdf',
      mimeType: 'application/pdf',
      size: 1024000,
      storageKey: 'unique-storage-key',
      uploadedBy: 'affiliate123',
      metadata: {
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session123'
      }
    });
  });

  describe('Schema Validation', () => {
    it('should create a valid W9Document with required fields', () => {
      const error = mockDocument.validateSync();
      expect(error).toBeUndefined();
      expect(mockDocument.affiliateId).toBe('AFF-123');
      expect(mockDocument.mimeType).toBe('application/pdf');
      expect(mockDocument.size).toBe(1024000);
    });

    it('should generate documentId automatically', () => {
      expect(mockDocument.documentId).toMatch(/^W9DOC-/);
    });

    it('should set default values correctly', () => {
      expect(mockDocument.isActive).toBe(true);
      expect(mockDocument.uploadMethod).toBe('affiliate_upload');
      expect(mockDocument.verificationStatus).toBe('pending');
      expect(mockDocument.deleted).toBe(false);
      expect(mockDocument.legalHold).toBe(false);
    });

    it('should set expiry date to 3 years from now', () => {
      const threeYearsFromNow = new Date();
      threeYearsFromNow.setFullYear(threeYearsFromNow.getFullYear() + 3);

      const expiryYear = mockDocument.expiryDate.getFullYear();
      const expectedYear = threeYearsFromNow.getFullYear();

      expect(expiryYear).toBe(expectedYear);
    });

    it('should reject invalid mime type', () => {
      mockDocument.mimeType = 'image/jpeg';
      const error = mockDocument.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.mimeType).toBeDefined();
    });

    it('should reject file size over 5MB', () => {
      mockDocument.size = 6000000; // 6MB
      const error = mockDocument.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.size).toBeDefined();
    });
  });

  describe('Instance Methods', () => {
    describe('isValid()', () => {
      it('should return true for valid document', () => {
        mockDocument.isActive = true;
        mockDocument.verificationStatus = 'verified';
        mockDocument.expiryDate = new Date(Date.now() + 86400000); // Tomorrow
        mockDocument.deletedAt = null;

        expect(mockDocument.isValid()).toBe(true);
      });

      it('should return false for inactive document', () => {
        mockDocument.isActive = false;
        mockDocument.verificationStatus = 'verified';

        expect(mockDocument.isValid()).toBe(false);
      });

      it('should return false for unverified document', () => {
        mockDocument.isActive = true;
        mockDocument.verificationStatus = 'pending';

        expect(mockDocument.isValid()).toBe(false);
      });

      it('should return false for expired document', () => {
        mockDocument.isActive = true;
        mockDocument.verificationStatus = 'verified';
        mockDocument.expiryDate = new Date(Date.now() - 86400000); // Yesterday

        expect(mockDocument.isValid()).toBe(false);
      });

      it('should return false for deleted document', () => {
        mockDocument.isActive = true;
        mockDocument.verificationStatus = 'verified';
        mockDocument.deletedAt = new Date();

        expect(mockDocument.isValid()).toBe(false);
      });
    });

    describe('softDelete()', () => {
      it('should soft delete document with metadata', async () => {
        // Mock the save method
        mockDocument.save = jest.fn().mockResolvedValue(mockDocument);

        const deletedBy = 'admin123';
        const reason = 'Document replaced with newer version';

        await mockDocument.softDelete(deletedBy, reason);

        expect(mockDocument.deletedAt).toBeDefined();
        expect(mockDocument.deletedBy).toBe(deletedBy);
        expect(mockDocument.deletionReason).toBe(reason);
        expect(mockDocument.isActive).toBe(false);
        expect(mockDocument.save).toHaveBeenCalled();
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(() => {
      // Mock mongoose methods
      W9Document.findOne = jest.fn();
      W9Document.find = jest.fn();
    });

    describe('findActiveForAffiliate()', () => {
      it('should find active document for affiliate', async () => {
        const mockActiveDoc = {
          affiliateId: 'AFF-123',
          isActive: true,
          deletedAt: null
        };

        W9Document.findOne.mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockActiveDoc)
        });

        const result = await W9Document.findActiveForAffiliate('AFF-123');

        expect(W9Document.findOne).toHaveBeenCalledWith({
          affiliateId: 'AFF-123',
          isActive: true,
          deletedAt: null
        });
        expect(result).toEqual(mockActiveDoc);
      });
    });

    describe('findPendingReview()', () => {
      it('should find all documents pending review', async () => {
        const mockPendingDocs = [
          { documentId: 'W9DOC-001', verificationStatus: 'pending' },
          { documentId: 'W9DOC-002', verificationStatus: 'pending' }
        ];

        W9Document.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue(mockPendingDocs)
        });

        const result = await W9Document.findPendingReview();

        expect(W9Document.find).toHaveBeenCalledWith({
          verificationStatus: 'pending',
          isActive: true,
          deletedAt: null
        });
        expect(result).toEqual(mockPendingDocs);
      });
    });
  });

  describe('Indexes', () => {
    it('should have required indexes defined', () => {
      const indexes = W9Document.schema.indexes();

      // Check for composite index
      const hasAffiliateActiveIndex = indexes.some(index =>
        index[0].affiliateId === 1 && index[0].isActive === 1
      );

      // Check for single field indexes
      const hasVerificationStatusIndex = indexes.some(index =>
        index[0].verificationStatus === 1
      );

      const hasExpiryDateIndex = indexes.some(index =>
        index[0].expiryDate === 1
      );

      expect(hasAffiliateActiveIndex).toBe(true);
      expect(hasVerificationStatusIndex).toBe(true);
      expect(hasExpiryDateIndex).toBe(true);
    });
  });

  describe('Verification Status Workflow', () => {
    it('should allow transition from pending to verified', () => {
      mockDocument.verificationStatus = 'pending';
      mockDocument.verificationStatus = 'verified';
      mockDocument.verifiedAt = new Date();

      const error = mockDocument.validateSync();
      expect(error).toBeUndefined();
      expect(mockDocument.verificationStatus).toBe('verified');
    });

    it('should allow transition from pending to rejected', () => {
      mockDocument.verificationStatus = 'pending';
      mockDocument.verificationStatus = 'rejected';

      const error = mockDocument.validateSync();
      expect(error).toBeUndefined();
      expect(mockDocument.verificationStatus).toBe('rejected');
    });
  });

  describe('Legal Hold', () => {
    it('should set legal hold with reason and date', () => {
      mockDocument.legalHold = true;
      mockDocument.legalHoldReason = 'Audit requirement';
      mockDocument.legalHoldDate = new Date();

      const error = mockDocument.validateSync();
      expect(error).toBeUndefined();
      expect(mockDocument.legalHold).toBe(true);
      expect(mockDocument.legalHoldReason).toBe('Audit requirement');
      expect(mockDocument.legalHoldDate).toBeDefined();
    });
  });
});