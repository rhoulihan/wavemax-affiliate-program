const request = require('supertest');
const express = require('express');
const quickbooksController = require('../../server/controllers/quickbooksController');
const Affiliate = require('../../server/models/Affiliate');
const Order = require('../../server/models/Order');
const PaymentExport = require('../../server/models/PaymentExport');
const W9AuditService = require('../../server/services/w9AuditService');

// Mock dependencies
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/PaymentExport');
jest.mock('../../server/services/w9AuditService');

describe('QuickBooksController Unit Tests', () => {
  let app;
  let mockReq, mockRes;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock request and response
    mockReq = {
      user: {
        _id: 'admin123',
        userType: 'administrator',
        firstName: 'John',
        lastName: 'Admin'
      },
      query: {},
      params: {},
      body: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    // Mock PaymentExport.create to return a valid export record
    PaymentExport.create = jest.fn().mockResolvedValue({
      _id: 'export123',
      exportId: 'EXP-123',
      type: 'vendor',
      exportedBy: 'admin123',
      createdAt: new Date()
    });

    // Mock W9AuditService
    W9AuditService.logQuickBooksExport = jest.fn().mockResolvedValue();
  });

  describe('exportVendors', () => {
    it('should export vendors as CSV', async () => {
      mockReq.query = { format: 'csv' };
      
      const mockAffiliates = [
        {
          _id: 'aff1',
          affiliateId: 'AFF-001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          w9Information: {
            status: 'verified',
            taxIdType: 'SSN',
            taxIdLast4: '1234',
            businessName: 'John Doe LLC',
            quickbooksVendorId: 'QB-001',
            quickbooksData: {
              displayName: 'John Doe LLC',
              vendorType: '1099 Contractor',
              terms: 'Net 15'
            }
          }
        },
        {
          _id: 'aff2',
          affiliateId: 'AFF-002',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          w9Information: {
            status: 'verified',
            taxIdType: 'EIN',
            taxIdLast4: '5678',
            businessName: 'Smith Enterprises',
            quickbooksData: {
              displayName: 'Smith Enterprises'
            }
          }
        }
      ];

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliates)
      });

      await quickbooksController.exportVendors(mockReq, mockRes);

      expect(Affiliate.find).toHaveBeenCalledWith({
        'w9Information.status': 'verified'
      });

      expect(PaymentExport.create).toHaveBeenCalledWith({
        type: 'vendor',
        exportedBy: 'admin123',
        affiliateIds: ['AFF-001', 'AFF-002'],
        exportData: expect.any(Object)
      });

      expect(W9AuditService.logQuickBooksExport).toHaveBeenCalledWith(
        mockReq,
        'vendor',
        'EXP-123',
        {
          format: 'csv',
          recordCount: 2
        }
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="wavemax-vendors-')
      );
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Vendor,Company'));
    });

    it('should export vendors as JSON', async () => {
      mockReq.query = { format: 'json' };
      
      const mockAffiliates = [{
        _id: 'aff1',
        affiliateId: 'AFF-001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        w9Information: {
          status: 'verified',
          taxIdLast4: '1234'
        }
      }];

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliates)
      });

      await quickbooksController.exportVendors(mockReq, mockRes);

      expect(W9AuditService.logQuickBooksExport).toHaveBeenCalledWith(
        mockReq,
        'vendor',
        'EXP-123',
        {
          format: 'json',
          recordCount: 1
        }
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        export: expect.objectContaining({
          exportId: 'EXP-123',
          type: 'vendor'
        }),
        vendorCount: 1
      });
    });

    it('should handle no verified vendors', async () => {
      mockReq.query = { format: 'csv' };
      
      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      await quickbooksController.exportVendors(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'No verified vendors found for export'
      });
    });

    it('should handle export errors', async () => {
      mockReq.query = { format: 'csv' };
      
      Affiliate.find.mockRejectedValue(new Error('Database error'));

      await quickbooksController.exportVendors(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to export vendors',
        error: 'Database error'
      });
    });
  });

  describe('exportPaymentSummary', () => {
    it('should export payment summary for date range', async () => {
      mockReq.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        format: 'csv'
      };

      const mockOrders = [
        {
          _id: 'order1',
          orderId: 'ORD-001',
          status: 'complete',
          completedAt: new Date('2025-01-15'),
          totalPrice: 100,
          affiliate: {
            affiliateId: {
              _id: 'aff1',
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
          _id: 'order2',
          orderId: 'ORD-002',
          status: 'complete',
          completedAt: new Date('2025-01-20'),
          totalPrice: 200,
          affiliate: {
            affiliateId: {
              _id: 'aff1',
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

      Order.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrders)
      });

      await quickbooksController.exportPaymentSummary(mockReq, mockRes);

      expect(Order.find).toHaveBeenCalledWith({
        status: 'complete',
        completedAt: {
          $gte: new Date('2025-01-01'),
          $lte: expect.any(Date) // End of day 2025-01-31
        },
        'affiliate.affiliateId': { $exists: true },
        'affiliate.commission': { $gt: 0 }
      });

      expect(PaymentExport.create).toHaveBeenCalledWith({
        type: 'payment_summary',
        periodStart: new Date('2025-01-01'),
        periodEnd: expect.any(Date),
        exportedBy: 'admin123',
        affiliateIds: ['AFF-001'],
        exportData: expect.objectContaining({
          payments: expect.arrayContaining([
            expect.objectContaining({
              affiliateId: 'AFF-001',
              totalCommission: 30
            })
          ])
        })
      });

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Date,Vendor'));
    });

    it('should handle missing date parameters', async () => {
      mockReq.query = { format: 'csv' };

      await quickbooksController.exportPaymentSummary(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Start date and end date are required'
      });
    });

    it('should filter out non-verified affiliates', async () => {
      mockReq.query = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        format: 'json'
      };

      const mockOrders = [
        {
          orderId: 'ORD-001',
          status: 'complete',
          completedAt: new Date('2025-01-15'),
          totalPrice: 100,
          affiliate: {
            affiliateId: {
              affiliateId: 'AFF-001',
              w9Information: { status: 'pending_review' } // Not verified
            },
            commission: 10
          }
        }
      ];

      Order.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockOrders)
      });

      await quickbooksController.exportPaymentSummary(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'No payable commissions found for the specified period'
      });
    });
  });

  describe('exportCommissionDetail', () => {
    it('should export commission details for specific affiliate', async () => {
      mockReq.query = {
        affiliateId: 'AFF-001',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        format: 'csv'
      };

      const mockAffiliate = {
        _id: 'aff1',
        affiliateId: 'AFF-001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        w9Information: {
          status: 'verified'
        }
      };

      const mockOrders = [
        {
          _id: 'order1',
          orderId: 'ORD-001',
          status: 'complete',
          completedAt: new Date('2025-01-15'),
          totalPrice: 100,
          customer: {
            firstName: 'Customer',
            lastName: 'One'
          },
          affiliate: {
            commission: 10,
            commissionRate: 10
          }
        },
        {
          _id: 'order2',
          orderId: 'ORD-002',
          status: 'complete',
          completedAt: new Date('2025-01-20'),
          totalPrice: 200,
          customer: {
            firstName: 'Customer',
            lastName: 'Two'
          },
          affiliate: {
            commission: 20,
            commissionRate: 10
          }
        }
      ];

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Order.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockOrders)
      });

      await quickbooksController.exportCommissionDetail(mockReq, mockRes);

      expect(Affiliate.findOne).toHaveBeenCalledWith({ affiliateId: 'AFF-001' });
      expect(Order.find).toHaveBeenCalledWith({
        status: 'complete',
        completedAt: {
          $gte: new Date('2025-01-01'),
          $lte: expect.any(Date)
        },
        'affiliate.affiliateId': 'aff1',
        'affiliate.commission': { $gt: 0 }
      });

      expect(PaymentExport.create).toHaveBeenCalledWith({
        type: 'commission_detail',
        periodStart: new Date('2025-01-01'),
        periodEnd: expect.any(Date),
        exportedBy: 'admin123',
        affiliateIds: ['AFF-001'],
        exportData: expect.objectContaining({
          totalCommission: 30
        })
      });

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('Order ID,Date,Customer')
      );
    });

    it('should handle missing parameters', async () => {
      mockReq.query = { startDate: '2025-01-01' };

      await quickbooksController.exportCommissionDetail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate ID, start date, and end date are required'
      });
    });

    it('should handle non-existent affiliate', async () => {
      mockReq.query = {
        affiliateId: 'AFF-999',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      Affiliate.findOne.mockResolvedValue(null);

      await quickbooksController.exportCommissionDetail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate not found'
      });
    });

    it('should handle unverified W-9 status', async () => {
      mockReq.query = {
        affiliateId: 'AFF-001',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      const mockAffiliate = {
        affiliateId: 'AFF-001',
        w9Information: {
          status: 'pending_review'
        }
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);

      await quickbooksController.exportCommissionDetail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Affiliate does not have a verified W-9 on file'
      });
    });
  });

  describe('getExportHistory', () => {
    it('should retrieve export history', async () => {
      mockReq.query = {
        type: 'vendor',
        limit: '10'
      };

      const mockExports = [
        {
          _id: 'exp1',
          exportId: 'EXP-001',
          type: 'vendor',
          createdAt: new Date('2025-01-15'),
          exportedBy: {
            firstName: 'Admin',
            lastName: 'User'
          },
          affiliateIds: ['AFF-001', 'AFF-002']
        },
        {
          _id: 'exp2',
          exportId: 'EXP-002',
          type: 'vendor',
          createdAt: new Date('2025-01-20'),
          exportedBy: {
            firstName: 'Super',
            lastName: 'Admin'
          },
          affiliateIds: ['AFF-003']
        }
      ];

      PaymentExport.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockExports)
      });

      await quickbooksController.getExportHistory(mockReq, mockRes);

      expect(PaymentExport.find).toHaveBeenCalledWith({ type: 'vendor' });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        exports: mockExports
      });
    });

    it('should retrieve all export types when type not specified', async () => {
      mockReq.query = { limit: '20' };

      PaymentExport.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      await quickbooksController.getExportHistory(mockReq, mockRes);

      expect(PaymentExport.find).toHaveBeenCalledWith({});
    });

    it('should handle export history errors', async () => {
      PaymentExport.find.mockRejectedValue(new Error('Database error'));

      await quickbooksController.getExportHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to retrieve export history',
        error: 'Database error'
      });
    });
  });

  describe('CSV Generation', () => {
    it('should properly escape CSV values', async () => {
      mockReq.query = { format: 'csv' };
      
      const mockAffiliates = [{
        affiliateId: 'AFF-001',
        firstName: 'John',
        lastName: 'Doe, Jr.', // Contains comma
        email: 'john@example.com',
        w9Information: {
          status: 'verified',
          taxIdLast4: '1234',
          businessName: 'John "The Best" Doe LLC' // Contains quotes
        }
      }];

      Affiliate.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockAffiliates)
      });

      await quickbooksController.exportVendors(mockReq, mockRes);

      const csvContent = mockRes.send.mock.calls[0][0];
      
      // Check that values with special characters are properly handled
      expect(csvContent).toContain('Doe, Jr.');
      expect(csvContent).toContain('John "The Best" Doe LLC');
    });
  });
});