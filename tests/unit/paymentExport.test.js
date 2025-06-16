const mongoose = require('mongoose');
const PaymentExport = require('../../server/models/PaymentExport');

describe('PaymentExport Model Unit Tests', () => {
  let mockExport;

  beforeEach(() => {
    // Create a mock export instance
    mockExport = new PaymentExport({
      type: 'vendor',
      exportedBy: mongoose.Types.ObjectId(),
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

    it('should require exportedBy field', () => {
      mockExport.exportedBy = undefined;
      const error = mockExport.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.exportedBy).toBeDefined();
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
      mockExport.exportData = {
        payments: [
          {
            affiliateId: 'AFF-001',
            affiliateName: 'John Doe',
            orderCount: 5,
            totalCommission: 150.50,
            orders: [
              {
                orderId: 'ORD-001',
                completedAt: new Date(),
                orderTotal: 100,
                commission: 10
              }
            ]
          }
        ]
      };
      
      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.exportData.payments[0].totalCommission).toBe(150.50);
    });

    it('should store commission detail data', () => {
      mockExport.type = 'commission_detail';
      mockExport.exportData = {
        affiliate: {
          affiliateId: 'AFF-001',
          name: 'John Doe',
          email: 'john@example.com'
        },
        orders: [
          {
            orderId: 'ORD-001',
            completedAt: new Date(),
            customerName: 'Customer One',
            orderTotal: 100,
            commission: 10,
            commissionRate: 10
          }
        ],
        totalCommission: 50
      };
      
      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.exportData.totalCommission).toBe(50);
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
      
      // Check for exportId unique index
      const hasExportIdIndex = indexes.some(index => 
        index[0].exportId === 1 && index[1].unique === true
      );
      
      // Check for type index
      const hasTypeIndex = indexes.some(index => 
        index[0].type === 1
      );
      
      // Check for exportedBy index
      const hasExportedByIndex = indexes.some(index => 
        index[0].exportedBy === 1
      );
      
      // Check for createdAt index
      const hasCreatedAtIndex = indexes.some(index => 
        index[0].createdAt === -1
      );
      
      expect(hasExportIdIndex).toBe(true);
      expect(hasTypeIndex).toBe(true);
      expect(hasExportedByIndex).toBe(true);
      expect(hasCreatedAtIndex).toBe(true);
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
          totalCommission: (i + 1) * 100
        }))
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
        affiliate: {
          affiliateId: 'AFF-001',
          name: 'John Doe'
        },
        orders: Array(50).fill(null).map((_, i) => ({
          orderId: `ORD-${String(i + 1).padStart(3, '0')}`,
          commission: 10
        })),
        totalCommission: 500
      };
      
      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
      expect(mockExport.exportData.orders).toHaveLength(50);
      expect(mockExport.exportData.totalCommission).toBe(500);
    });
  });

  describe('Export ID Generation', () => {
    it('should generate unique export IDs', () => {
      const export1 = new PaymentExport({
        type: 'vendor',
        exportedBy: mongoose.Types.ObjectId(),
        affiliateIds: []
      });
      
      const export2 = new PaymentExport({
        type: 'vendor',
        exportedBy: mongoose.Types.ObjectId(),
        affiliateIds: []
      });
      
      expect(export1.exportId).not.toBe(export2.exportId);
      expect(export1.exportId).toMatch(/^EXP-[a-f0-9-]{36}$/);
      expect(export2.exportId).toMatch(/^EXP-[a-f0-9-]{36}$/);
    });
  });

  describe('Reference Validation', () => {
    it('should validate exportedBy as ObjectId reference', () => {
      mockExport.exportedBy = 'invalid-id';
      const error = mockExport.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.exportedBy).toBeDefined();
    });

    it('should accept valid ObjectId for exportedBy', () => {
      mockExport.exportedBy = mongoose.Types.ObjectId();
      const error = mockExport.validateSync();
      expect(error).toBeUndefined();
    });
  });
});