const mongoose = require('mongoose');
const PaymentExport = require('../../server/models/PaymentExport');

describe('PaymentExport Model Unit Tests', () => {
  let mockExport;

  beforeEach(() => {
    // Create a mock export instance
    mockExport = new PaymentExport({
      type: 'vendor',
      generatedBy: new mongoose.Types.ObjectId(),
      filename: 'vendor-export-2025-01-16.csv',
      affiliateIds: ['AFF-001', 'AFF-002', 'AFF-003'],
      exportData: {
        vendors: [
          {
            affiliateId: 'AFF-001',
            displayName: 'John Doe LLC',
            taxIdLast4: '1234',
            email: 'john@example.com'
          },
          {
            affiliateId: 'AFF-002',
            displayName: 'Jane Smith',
            taxIdLast4: '5678',
            email: 'jane@example.com'
          }
        ]
      }
    });
  });

  describe('Schema Validation', () => {
    it('should create a valid PaymentExport', () => {
      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.type).toBe('vendor');
      expect(mockExport.affiliateIds).toHaveLength(3);
    });

    it('should generate exportId automatically', () => {
      expect(mockExport.exportId).toMatch(/^EXP-/);
      expect(mockExport.exportId).toHaveLength(40); // EXP- + 36 char UUID
    });

    it('should require type field', () => {
      mockExport.type = undefined;
      const error = mockExport.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.type).toBeDefined();
    });

    it('should validate type enum values', () => {
      const validTypes = ['vendor', 'payment_summary', 'commission_detail'];

      validTypes.forEach(type => {
        mockExport.type = type;
        // Add required fields for payment_summary and commission_detail
        if (type === 'payment_summary' || type === 'commission_detail') {
          mockExport.periodStart = new Date('2025-01-01');
          mockExport.periodEnd = new Date('2025-01-31');
        }
        const error = mockExport.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid type values', () => {
      mockExport.type = 'invalid_type';
      const error = mockExport.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.type).toBeDefined();
    });

    it('should require generatedBy field', () => {
      mockExport.generatedBy = undefined;
      const error = mockExport.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.generatedBy).toBeDefined();
    });
  });

  describe('Period Fields', () => {
    it('should store period dates for payment summary', () => {
      mockExport.type = 'payment_summary';
      mockExport.periodStart = new Date('2025-01-01');
      mockExport.periodEnd = new Date('2025-01-31');

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.periodStart).toEqual(new Date('2025-01-01'));
      expect(mockExport.periodEnd).toEqual(new Date('2025-01-31'));
    });

    it('should store period dates for commission detail', () => {
      mockExport.type = 'commission_detail';
      mockExport.periodStart = new Date('2025-01-01');
      mockExport.periodEnd = new Date('2025-01-31');

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
    });
  });

  describe('Export Data', () => {
    it('should store vendor export data', () => {
      mockExport.type = 'vendor';
      mockExport.exportData = {
        vendors: [
          {
            affiliateId: 'AFF-001',
            displayName: 'Test Vendor',
            quickbooksVendorId: 'QB-001'
          }
        ]
      };

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.exportData.vendors).toHaveLength(1);
    });

    it('should store payment summary data', () => {
      mockExport.type = 'payment_summary';
      mockExport.periodStart = new Date('2025-01-01');
      mockExport.periodEnd = new Date('2025-01-31');
      mockExport.exportData = {
        payments: [
          {
            affiliateId: 'AFF-001',
            orderId: 'ORD-001',
            amount: 150.50,
            date: new Date(),
            description: 'Commission payment'
          }
        ],
        summary: {
          totalVendors: 1,
          totalPayments: 1,
          totalAmount: 150.50
        }
      };

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.exportData.payments[0].amount).toBe(150.50);
    });

    it('should store commission detail data', () => {
      mockExport.type = 'commission_detail';
      mockExport.periodStart = new Date('2025-01-01');
      mockExport.periodEnd = new Date('2025-01-31');
      mockExport.exportData = {
        payments: [
          {
            affiliateId: 'AFF-001',
            orderId: 'ORD-001',
            amount: 10,
            date: new Date(),
            description: 'Order commission'
          }
        ],
        summary: {
          totalVendors: 1,
          totalPayments: 1,
          totalAmount: 50
        }
      };

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.exportData.summary.totalAmount).toBe(50);
    });
  });

  describe('Affiliate IDs', () => {
    it('should store multiple affiliate IDs for vendor export', () => {
      mockExport.type = 'vendor';
      mockExport.affiliateIds = ['AFF-001', 'AFF-002', 'AFF-003', 'AFF-004', 'AFF-005'];

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.affiliateIds).toHaveLength(5);
    });

    it('should store single affiliate ID for commission detail', () => {
      mockExport.type = 'commission_detail';
      mockExport.periodStart = new Date('2025-01-01');
      mockExport.periodEnd = new Date('2025-01-31');
      mockExport.affiliateIds = ['AFF-001'];

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.affiliateIds).toHaveLength(1);
    });

    it('should allow empty affiliate IDs array', () => {
      mockExport.affiliateIds = [];
      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
    });
  });

  describe('Timestamps', () => {
    it('should have createdAt and updatedAt timestamps', () => {
      expect(mockExport.createdAt).toBeUndefined(); // Not set until save
      expect(mockExport.updatedAt).toBeUndefined(); // Not set until save

      // Mongoose will add these on save
      const schema = PaymentExport.schema;
      expect(schema.options.timestamps).toBe(true);
    });
  });

  describe('Indexes', () => {
    it('should have required indexes defined', () => {
      const indexes = PaymentExport.schema.indexes();

      // Check for type and generatedAt composite index
      const hasTypeGeneratedAtIndex = indexes.some(index =>
        index[0].type === 1 && index[0].generatedAt === -1
      );

      // Check for period index
      const hasPeriodIndex = indexes.some(index =>
        index[0].periodStart === 1 && index[0].periodEnd === 1
      );

      // Check for status index
      const hasStatusIndex = indexes.some(index =>
        index[0].status === 1
      );

      // Check for exportId unique index (from default)
      const hasExportIdIndex = indexes.some(index =>
        index[0].exportId === 1
      );

      expect(hasTypeGeneratedAtIndex).toBe(true);
      expect(hasPeriodIndex).toBe(true);
      expect(hasStatusIndex).toBe(true);
    });
  });

  describe('Different Export Types', () => {
    it('should handle vendor export type correctly', () => {
      mockExport.type = 'vendor';
      mockExport.exportData = {
        vendors: Array(25).fill(null).map((_, i) => ({
          affiliateId: `AFF-${String(i + 1).padStart(3, '0')}`,
          displayName: `Vendor ${i + 1}`
        }))
      };

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.exportData.vendors).toHaveLength(25);
    });

    it('should handle payment summary export type correctly', () => {
      mockExport.type = 'payment_summary';
      mockExport.periodStart = new Date('2025-01-01');
      mockExport.periodEnd = new Date('2025-01-31');
      mockExport.exportData = {
        payments: Array(10).fill(null).map((_, i) => ({
          affiliateId: `AFF-${String(i + 1).padStart(3, '0')}`,
          orderId: `ORD-${String(i + 1).padStart(3, '0')}`,
          amount: (i + 1) * 100,
          date: new Date(),
          description: 'Commission payment'
        })),
        summary: {
          totalVendors: 10,
          totalPayments: 10,
          totalAmount: 5500
        }
      };

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.exportData.payments).toHaveLength(10);
    });

    it('should handle commission detail export type correctly', () => {
      mockExport.type = 'commission_detail';
      mockExport.periodStart = new Date('2025-01-01');
      mockExport.periodEnd = new Date('2025-01-31');
      mockExport.affiliateIds = ['AFF-001'];
      mockExport.exportData = {
        payments: Array(50).fill(null).map((_, i) => ({
          affiliateId: 'AFF-001',
          orderId: `ORD-${String(i + 1).padStart(3, '0')}`,
          amount: 10,
          date: new Date(),
          description: 'Order commission'
        })),
        summary: {
          totalVendors: 1,
          totalPayments: 50,
          totalAmount: 500
        }
      };

      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.exportData.payments).toHaveLength(50);
      expect(mockExport.exportData.summary.totalAmount).toBe(500);
    });
  });

  describe('Export ID Generation', () => {
    it('should generate unique export IDs', () => {
      const export1 = new PaymentExport({
        type: 'vendor',
        generatedBy: new mongoose.Types.ObjectId(),
        filename: 'export1.csv',
        affiliateIds: []
      });

      const export2 = new PaymentExport({
        type: 'vendor',
        generatedBy: new mongoose.Types.ObjectId(),
        filename: 'export2.csv',
        affiliateIds: []
      });

      expect(export1.exportId).not.toBe(export2.exportId);
      expect(export1.exportId).toMatch(/^EXP-[a-f0-9-]{36}$/);
      expect(export2.exportId).toMatch(/^EXP-[a-f0-9-]{36}$/);
    });
  });

  describe('Reference Validation', () => {
    it('should validate generatedBy as ObjectId reference', () => {
      mockExport.generatedBy = 'invalid-id';
      const error = mockExport.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.generatedBy).toBeDefined();
    });

    it('should accept valid ObjectId for generatedBy', () => {
      mockExport.generatedBy = new mongoose.Types.ObjectId();
      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
    });
  });

  describe('Instance Methods', () => {
    describe('markDownloaded()', () => {
      beforeEach(async () => {
        await PaymentExport.deleteMany({});
      });

      it('should mark export as downloaded', async () => {
        const adminId = new mongoose.Types.ObjectId();
        const exportDoc = await PaymentExport.create({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'test-export.csv',
          status: 'generated'
        });

        await exportDoc.markDownloaded(adminId);

        const updated = await PaymentExport.findById(exportDoc._id);
        expect(updated.downloadedAt).toBeInstanceOf(Date);
        expect(updated.downloadedBy.toString()).toBe(adminId.toString());
        expect(updated.downloadCount).toBe(1);
        expect(updated.status).toBe('downloaded');
      });

      it('should increment download count on multiple downloads', async () => {
        const adminId = new mongoose.Types.ObjectId();
        const exportDoc = await PaymentExport.create({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'test-export.csv',
          status: 'generated'
        });

        await exportDoc.markDownloaded(adminId);
        const afterFirst = await PaymentExport.findById(exportDoc._id);
        expect(afterFirst.downloadCount).toBe(1);

        await afterFirst.markDownloaded(adminId);
        const afterSecond = await PaymentExport.findById(exportDoc._id);
        expect(afterSecond.downloadCount).toBe(2);
      });

      it('should not change status if already downloaded', async () => {
        const adminId = new mongoose.Types.ObjectId();
        const exportDoc = await PaymentExport.create({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'test-export.csv',
          status: 'imported'
        });

        await exportDoc.markDownloaded(adminId);

        const updated = await PaymentExport.findById(exportDoc._id);
        expect(updated.status).toBe('imported'); // Should remain 'imported'
        expect(updated.downloadCount).toBe(1);
      });

      it('should update downloadedAt timestamp', async () => {
        const adminId = new mongoose.Types.ObjectId();
        const exportDoc = await PaymentExport.create({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'test-export.csv'
        });

        const beforeDownload = new Date();
        await new Promise(resolve => setTimeout(resolve, 10));
        await exportDoc.markDownloaded(adminId);

        const updated = await PaymentExport.findById(exportDoc._id);
        expect(updated.downloadedAt.getTime()).toBeGreaterThan(beforeDownload.getTime());
      });
    });

    describe('updateImportStatus()', () => {
      beforeEach(async () => {
        await PaymentExport.deleteMany({});
      });

      it('should update import status to success', async () => {
        const exportDoc = await PaymentExport.create({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'test-export.csv',
          status: 'downloaded'
        });

        await exportDoc.updateImportStatus('success', 'admin@example.com', 'Imported 10 vendors');

        const updated = await PaymentExport.findById(exportDoc._id);
        expect(updated.quickbooksImportDate).toBeInstanceOf(Date);
        expect(updated.quickbooksImportedBy).toBe('admin@example.com');
        expect(updated.quickbooksImportStatus).toBe('success');
        expect(updated.quickbooksImportNotes).toBe('Imported 10 vendors');
        expect(updated.status).toBe('imported');
      });

      it('should update import status to failed', async () => {
        const exportDoc = await PaymentExport.create({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'test-export.csv',
          status: 'downloaded'
        });

        await exportDoc.updateImportStatus('failed', 'admin@example.com', 'Connection error');

        const updated = await PaymentExport.findById(exportDoc._id);
        expect(updated.quickbooksImportStatus).toBe('failed');
        expect(updated.quickbooksImportNotes).toBe('Connection error');
        expect(updated.status).toBe('downloaded'); // Should not change to 'imported'
      });

      it('should handle partial import status', async () => {
        const exportDoc = await PaymentExport.create({
          type: 'payment_summary',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'payments.csv',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31')
        });

        await exportDoc.updateImportStatus('partial', 'user@example.com', '8 of 10 imported');

        const updated = await PaymentExport.findById(exportDoc._id);
        expect(updated.quickbooksImportStatus).toBe('partial');
        expect(updated.quickbooksImportNotes).toBe('8 of 10 imported');
        expect(updated.status).toBe('generated'); // Original status unchanged
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await PaymentExport.deleteMany({});
      
      // Create test data
      await PaymentExport.create([
        {
          type: 'payment_summary',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'jan-payments.csv',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31')
        },
        {
          type: 'payment_summary',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'feb-payments.csv',
          periodStart: new Date('2025-02-01'),
          periodEnd: new Date('2025-02-28')
        },
        {
          type: 'commission_detail',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'jan-commission.csv',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31')
        },
        {
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'vendors.csv'
        }
      ]);
    });

    describe('findByPeriod()', () => {
      it('should find exports within period', async () => {
        const results = await PaymentExport.findByPeriod(
          new Date('2025-01-01'),
          new Date('2025-01-31')
        );

        expect(results).toHaveLength(2); // Jan payment_summary and commission_detail
        expect(results.every(r => 
          r.periodStart >= new Date('2025-01-01') && 
          r.periodEnd <= new Date('2025-01-31')
        )).toBe(true);
      });

      it('should filter by type when specified', async () => {
        const results = await PaymentExport.findByPeriod(
          new Date('2025-01-01'),
          new Date('2025-01-31'),
          'payment_summary'
        );

        expect(results).toHaveLength(1);
        expect(results[0].type).toBe('payment_summary');
        expect(results[0].filename).toBe('jan-payments.csv');
      });

      it('should return empty array when no matches', async () => {
        const results = await PaymentExport.findByPeriod(
          new Date('2025-03-01'),
          new Date('2025-03-31')
        );

        expect(results).toHaveLength(0);
      });

      it('should sort by generatedAt descending', async () => {
        // Create exports with different timestamps
        await PaymentExport.create({
          type: 'payment_summary',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'jan-payments-2.csv',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31'),
          generatedAt: new Date('2025-01-20')
        });

        const results = await PaymentExport.findByPeriod(
          new Date('2025-01-01'),
          new Date('2025-01-31'),
          'payment_summary'
        );

        expect(results).toHaveLength(2);
        // Most recent first
        expect(results[0].generatedAt.getTime()).toBeGreaterThan(results[1].generatedAt.getTime());
      });
    });

    describe('existsForPeriod()', () => {
      it('should find existing export for period', async () => {
        const exists = await PaymentExport.existsForPeriod(
          new Date('2025-01-01'),
          new Date('2025-01-31'),
          'payment_summary'
        );

        expect(exists).toBeTruthy();
        expect(exists.type).toBe('payment_summary');
      });

      it('should not find export for different period', async () => {
        const exists = await PaymentExport.existsForPeriod(
          new Date('2025-03-01'),
          new Date('2025-03-31'),
          'payment_summary'
        );

        expect(exists).toBeFalsy();
      });

      it('should exclude failed exports', async () => {
        await PaymentExport.create({
          type: 'payment_summary',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'march-failed.csv',
          periodStart: new Date('2025-03-01'),
          periodEnd: new Date('2025-03-31'),
          status: 'failed'
        });

        const exists = await PaymentExport.existsForPeriod(
          new Date('2025-03-01'),
          new Date('2025-03-31'),
          'payment_summary'
        );

        expect(exists).toBeFalsy();
      });

      it('should find export with non-failed status', async () => {
        await PaymentExport.create({
          type: 'commission_detail',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'feb-commission.csv',
          periodStart: new Date('2025-02-01'),
          periodEnd: new Date('2025-02-28'),
          status: 'imported'
        });

        const exists = await PaymentExport.existsForPeriod(
          new Date('2025-02-01'),
          new Date('2025-02-28'),
          'commission_detail'
        );

        expect(exists).toBeTruthy();
        expect(exists.status).toBe('imported');
      });
    });
  });

  describe('Virtual Properties', () => {
    describe('ageInDays', () => {
      it('should calculate age in days correctly', async () => {
        // Create a date exactly 5 days ago (at midnight to avoid fractional days)
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        fiveDaysAgo.setHours(0, 0, 0, 0);
        
        const exportDoc = await PaymentExport.create({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'test.csv',
          generatedAt: fiveDaysAgo
        });

        // Should be 5 or 6 days depending on current time of day
        expect(exportDoc.ageInDays).toBeGreaterThanOrEqual(5);
        expect(exportDoc.ageInDays).toBeLessThanOrEqual(6);
      });

      it('should return 1 for exports created today', async () => {
        const exportDoc = await PaymentExport.create({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'today.csv',
          generatedAt: new Date()
        });

        expect(exportDoc.ageInDays).toBe(1);
      });

      it('should handle exports created in the past correctly', async () => {
        const exportDoc = new PaymentExport({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'old.csv',
          generatedAt: new Date('2025-01-01')
        });

        const expectedDays = Math.ceil((Date.now() - new Date('2025-01-01').getTime()) / (1000 * 60 * 60 * 24));
        expect(exportDoc.ageInDays).toBe(expectedDays);
      });

      it('should update as time passes', async () => {
        const generatedAt = new Date(Date.now() - 23 * 60 * 60 * 1000); // 23 hours ago
        const exportDoc = new PaymentExport({
          type: 'vendor',
          generatedBy: new mongoose.Types.ObjectId(),
          filename: 'yesterday.csv',
          generatedAt
        });

        // Should be 1 day (since we use Math.ceil)
        expect(exportDoc.ageInDays).toBe(1);
      });
    });
  });
});