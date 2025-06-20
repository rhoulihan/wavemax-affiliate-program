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
});