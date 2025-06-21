const quickbooksController = require('../../server/controllers/quickbooksController');
const Affiliate = require('../../server/models/Affiliate');
const Order = require('../../server/models/Order');
const PaymentExport = require('../../server/models/PaymentExport');
const SystemConfig = require('../../server/models/SystemConfig');
const W9AuditService = require('../../server/services/w9AuditService');
// Mock csv-writer
jest.mock('csv-writer', () => ({
  createObjectCsvStringifier: jest.fn()
}));
const csvWriter = require('csv-writer');

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/PaymentExport');
jest.mock('../../server/models/SystemConfig');
jest.mock('../../server/services/w9AuditService');
jest.mock('csv-writer');

describe('QuickBooks Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: { _id: 'admin123' },
      query: {},
      params: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn()
    };
  });

  describe('exportVendors', () => {
    const mockAffiliates = [
      {
        affiliateId: 'AFF-001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        w9Information: {
          status: 'verified',
          taxIdLast4: '1234',
          businessName: 'John Doe LLC',
          quickbooksVendorId: 'QB-001',
          quickbooksData: {
            displayName: 'John Doe LLC',
            vendorType: '1099 Contractor',
            terms: 'Net 15',
            defaultExpenseAccount: 'Commission Expense'
          }
        }
      },
      {
        affiliateId: 'AFF-002',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        w9Information: {
          status: 'verified',
          taxIdLast4: '5678',
          businessName: null,
          quickbooksVendorId: null,
          quickbooksData: null
        }
      }
    ];

    it('should export vendors as JSON', async () => {
      req.query = { format: 'json' };

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliates)
      });

      PaymentExport.create.mockResolvedValue({
        exportId: 'EXP-123',
        type: 'vendor',
        affiliateIds: ['AFF-001', 'AFF-002']
      });

      W9AuditService.logQuickBooksExport = jest.fn().mockResolvedValue(true);

      await quickbooksController.exportVendors(req, res);

      expect(Affiliate.find).toHaveBeenCalledWith({
        'w9Information.status': 'verified'
      });

      expect(PaymentExport.create).toHaveBeenCalledWith({
        type: 'vendor',
        generatedBy: 'admin123',
        filename: expect.stringContaining('wavemax-vendors-EXP-'),
        format: 'json',
        recordCount: 2,
        affiliateIds: ['AFF-001', 'AFF-002'],
        exportData: {
          vendors: [
            {
              affiliateId: 'AFF-001',
              displayName: 'John Doe LLC',
              taxIdLast4: '1234',
              businessName: 'John Doe LLC',
              email: 'john@example.com',
              quickbooksVendorId: 'QB-001'
            },
            {
              affiliateId: 'AFF-002',
              displayName: 'Jane Smith',
              taxIdLast4: '5678',
              businessName: null,
              email: 'jane@example.com',
              quickbooksVendorId: null
            }
          ]
        }
      });

      expect(W9AuditService.logQuickBooksExport).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        export: expect.any(Object),
        vendorCount: 2
      });
    });

    it('should export vendors as CSV', async () => {
      req.query = { format: 'csv' };

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliates)
      });

      PaymentExport.create.mockResolvedValue({
        exportId: 'EXP-123',
        type: 'vendor'
      });

      const mockStringifier = {
        getHeaderString: jest.fn().mockReturnValue('header\n'),
        stringifyRecords: jest.fn().mockReturnValue('data\n')
      };

      csvWriter.createObjectCsvStringifier.mockReturnValue(mockStringifier);
      W9AuditService.logQuickBooksExport = jest.fn().mockResolvedValue(true);

      await quickbooksController.exportVendors(req, res);

      expect(csvWriter.createObjectCsvStringifier).toHaveBeenCalledWith({
        header: expect.arrayContaining([
          { id: 'vendorName', title: 'Vendor' },
          { id: 'email', title: 'Main Email' },
          { id: 'taxId', title: 'Tax ID' }
        ])
      });

      expect(mockStringifier.stringifyRecords).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            vendorName: 'John Doe',
            email: 'john@example.com',
            taxId: '****1234'
          })
        ])
      );

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="wavemax-vendors-')
      );
      expect(res.send).toHaveBeenCalledWith('header\ndata\n');
    });

    it('should return 404 when no verified vendors found', async () => {
      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      await quickbooksController.exportVendors(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No verified vendors found for export'
      });
    });

    it('should handle errors gracefully', async () => {
      Affiliate.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await quickbooksController.exportVendors(req, res);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'QuickBooks vendor export error:',
        expect.any(Error)
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to export vendors',
        error: 'Database error'
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('exportPaymentSummary', () => {
    const mockOrders = [
      {
        orderId: 'ORD-001',
        status: 'complete',
        completedAt: new Date('2025-01-15'),
        totalPrice: 100,
        affiliate: {
          affiliateId: {
            affiliateId: 'AFF-001',
            firstName: 'John',
            lastName: 'Doe',
            w9Information: {
              status: 'verified',
              quickbooksData: {
                displayName: 'John Doe LLC',
                defaultExpenseAccount: 'Commission Expense'
              }
            }
          },
          commission: 10
        }
      },
      {
        orderId: 'ORD-002',
        status: 'complete',
        completedAt: new Date('2025-01-16'),
        totalPrice: 200,
        affiliate: {
          affiliateId: {
            affiliateId: 'AFF-001',
            firstName: 'John',
            lastName: 'Doe',
            w9Information: {
              status: 'verified'
            }
          },
          commission: 20
        }
      }
    ];

    it('should export payment summary as JSON', async () => {
      req.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        format: 'json'
      };

      Order.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrders)
      });

      PaymentExport.create.mockResolvedValue({
        exportId: 'EXP-124',
        type: 'payment_summary'
      });

      await quickbooksController.exportPaymentSummary(req, res);

      expect(Order.find).toHaveBeenCalledWith({
        status: 'complete',
        completedAt: {
          $gte: new Date('2025-01-01'),
          $lte: expect.any(Date)
        },
        'affiliate.affiliateId': { $exists: true },
        'affiliate.commission': { $gt: 0 }
      });

      expect(PaymentExport.create).toHaveBeenCalledWith({
        type: 'payment_summary',
        periodStart: new Date('2025-01-01'),
        periodEnd: expect.any(Date),
        generatedBy: 'admin123',
        filename: expect.stringContaining('wavemax-payment-summary-EXP-'),
        format: 'json',
        affiliateIds: ['AFF-001'],
        orderIds: ['ORD-001', 'ORD-002'],
        totalAmount: 30,
        recordCount: 1,
        exportData: {
          payments: [
            {
              affiliateId: 'AFF-001',
              affiliateName: 'John Doe',
              orderCount: 2,
              totalCommission: 30,
              orders: [
                {
                  orderId: 'ORD-001',
                  completedAt: new Date('2025-01-15'),
                  orderTotal: 100,
                  commission: 10
                },
                {
                  orderId: 'ORD-002',
                  completedAt: new Date('2025-01-16'),
                  orderTotal: 200,
                  commission: 20
                }
              ]
            }
          ]
        }
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        export: expect.any(Object),
        summary: {
          periodStart: expect.any(Date),
          periodEnd: expect.any(Date),
          totalAffiliates: 1,
          totalCommissions: 30,
          totalOrders: 2
        }
      });
    });

    it('should export payment summary as CSV', async () => {
      req.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        format: 'csv'
      };

      Order.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrders)
      });

      PaymentExport.create.mockResolvedValue({
        exportId: 'EXP-124'
      });

      const mockStringifier = {
        getHeaderString: jest.fn().mockReturnValue('header\n'),
        stringifyRecords: jest.fn().mockReturnValue('data\n')
      };

      csvWriter.createObjectCsvStringifier.mockReturnValue(mockStringifier);

      await quickbooksController.exportPaymentSummary(req, res);

      expect(mockStringifier.stringifyRecords).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            vendorName: 'John Doe LLC',
            amount: '30.00',
            memo: '2 orders processed'
          })
        ])
      );

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.send).toHaveBeenCalledWith('header\ndata\n');
    });

    it('should return 400 when dates are missing', async () => {
      req.query = { format: 'json' };

      await quickbooksController.exportPaymentSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Start date and end date are required'
      });
    });

    it('should return 404 when no payable commissions found', async () => {
      req.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      Order.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      await quickbooksController.exportPaymentSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No payable commissions found for the specified period'
      });
    });

    it('should filter out orders without verified W-9', async () => {
      req.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        format: 'json'
      };

      const ordersWithUnverified = [
        ...mockOrders,
        {
          orderId: 'ORD-003',
          affiliate: {
            affiliateId: {
              affiliateId: 'AFF-002',
              w9Information: { status: 'pending' }
            },
            commission: 15
          }
        }
      ];

      Order.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(ordersWithUnverified)
      });

      PaymentExport.create.mockResolvedValue({ exportId: 'EXP-125' });

      await quickbooksController.exportPaymentSummary(req, res);

      expect(PaymentExport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          affiliateIds: ['AFF-001'] // Only verified affiliate
        })
      );
    });
  });

  describe('exportCommissionDetail', () => {
    const mockAffiliate = {
      _id: 'mongo-id-123',
      affiliateId: 'AFF-001',
      firstName: 'John',
      lastName: 'Doe',
      w9Information: {
        status: 'verified',
        quickbooksData: {
          displayName: 'John Doe LLC'
        }
      }
    };

    const mockOrders = [
      {
        orderId: 'ORD-001',
        customer: { firstName: 'John', lastName: 'Doe' },
        status: 'complete',
        completedAt: new Date('2025-01-15'),
        totalPrice: 100,
        affiliate: { commission: 10, commissionRate: 0.1 }
      },
      {
        orderId: 'ORD-002',
        customer: { firstName: 'Jane', lastName: 'Smith' },
        status: 'complete',
        completedAt: new Date('2025-01-16'),
        totalPrice: 200,
        affiliate: { commission: 20, commissionRate: 0.1 }
      }
    ];

    it('should export commission detail as JSON', async () => {
      req.query = {
        affiliateId: 'AFF-001',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        format: 'json'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      Order.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrders)
      });

      PaymentExport.create.mockResolvedValue({
        exportId: 'EXP-126',
        type: 'commission_detail'
      });

      await quickbooksController.exportCommissionDetail(req, res);

      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF-001' });

      expect(Order.find).toHaveBeenCalledWith({
        status: 'complete',
        completedAt: {
          $gte: new Date('2025-01-01'),
          $lte: expect.any(Date)
        },
        'affiliate.affiliateId': 'mongo-id-123',
        'affiliate.commission': { $gt: 0 }
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        export: expect.any(Object)
      });
    });

    it('should return 400 when required parameters are missing', async () => {
      req.query = { startDate: '2025-01-01' };

      await quickbooksController.exportCommissionDetail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate ID, start date, and end date are required'
      });
    });

    it('should return 404 when affiliate not found', async () => {
      req.query = {
        affiliateId: 'AFF-999',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      Affiliate.findOne.mockResolvedValue(null);

      await quickbooksController.exportCommissionDetail(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate not found'
      });
    });

    it('should return 400 when affiliate has no verified W-9', async () => {
      req.query = {
        affiliateId: 'AFF-001',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      Affiliate.findOne.mockResolvedValue({
        ...mockAffiliate,
        w9Information: { status: 'pending' }
      });

      await quickbooksController.exportCommissionDetail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate does not have a verified W-9 on file'
      });
    });
  });

  describe('getExportHistory', () => {
    it('should get export history', async () => {
      const mockExports = [
        { exportId: 'EXP-1', type: 'vendor' },
        { exportId: 'EXP-2', type: 'payment_summary' }
      ];

      PaymentExport.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockExports)
      });

      await quickbooksController.getExportHistory(req, res);

      expect(PaymentExport.find).toHaveBeenCalledWith({});

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        exports: mockExports
      });
    });

    it('should filter by type', async () => {
      req.query = { type: 'vendor' };

      PaymentExport.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      await quickbooksController.getExportHistory(req, res);

      expect(PaymentExport.find).toHaveBeenCalledWith({ type: 'vendor' });
    });
  });
});