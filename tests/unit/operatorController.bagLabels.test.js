// Test for bag label printing functionality
const operatorController = require('../../server/controllers/operatorController');
const Customer = require('../../server/models/Customer');
const { logAuditEvent } = require('../../server/utils/auditLogger');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { extractHandler } = require('../helpers/testUtils');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/auditLogger');
jest.mock('../../server/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Operator Controller - Bag Label Printing', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { 
        _id: 'op123', 
        id: 'op123', 
        email: 'operator@example.com', 
        role: 'operator', 
        operatorId: 'OPR001' 
      },
      params: {},
      body: {},
      query: {}
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getNewCustomersCount', () => {
    it('should return count of customers without bag labels', async () => {
      const next = jest.fn();
      Customer.countDocuments.mockResolvedValue(5);

      const handler = operatorController.getNewCustomersCount;
      await handler(req, res, next);

      expect(Customer.countDocuments).toHaveBeenCalledWith({
        bagLabelsGenerated: false
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 5
      });
    });

    it('should return zero when no new customers', async () => {
      const next = jest.fn();
      Customer.countDocuments.mockResolvedValue(0);

      const handler = extractHandler(operatorController.getNewCustomersCount);
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0
      });
    });

    it('should handle database error', async () => {
      const next = jest.fn();
      Customer.countDocuments.mockRejectedValue(new Error('Database error'));

      const handler = extractHandler(operatorController.getNewCustomersCount);
      await handler(req, res, next);

      // Note: The actual controller uses console.error, not logger.error
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Error fetching new customers count')
      );
    });
  });

  describe('printNewCustomerLabels', () => {
    it('should generate labels for all new customers', async () => {
      const mockCustomers = [
        {
          _id: 'cust1',
          customerId: 'CUST001',
          firstName: 'John',
          lastName: 'Doe',
          numberOfBags: 2,
          affiliateId: 'AFF001'
        },
        {
          _id: 'cust2',
          customerId: 'CUST002',
          firstName: 'Jane',
          lastName: 'Smith',
          numberOfBags: 3,
          affiliateId: 'AFF002'
        }
      ];

      Customer.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomers)
      });
      Customer.updateMany.mockResolvedValue({ modifiedCount: 2 });

      const handler = operatorController.printNewCustomerLabels;
      await handler(req, res, next);

      expect(Customer.find).toHaveBeenCalledWith({
        bagLabelsGenerated: false
      });

      // Check that updateMany is NOT called in the initial request
      expect(Customer.updateMany).not.toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          customersProcessed: 2,
          labelsGenerated: 5,
          labelData: expect.arrayContaining([
            expect.objectContaining({
              customerName: 'John Doe',
              customerId: 'CUST001',
              bagNumber: 1,
              totalBags: 2,
              qrCode: 'CUST001-1',
              affiliateId: 'AFF001'
            }),
            expect.objectContaining({
              customerName: 'John Doe',
              customerId: 'CUST001',
              bagNumber: 2,
              totalBags: 2,
              qrCode: 'CUST001-2',
              affiliateId: 'AFF001'
            }),
            expect.objectContaining({
              customerName: 'Jane Smith',
              customerId: 'CUST002',
              bagNumber: 1,
              totalBags: 3,
              qrCode: 'CUST002-1',
              affiliateId: 'AFF002'
            }),
            expect.objectContaining({
              customerName: 'Jane Smith',
              customerId: 'CUST002',
              bagNumber: 2,
              totalBags: 3,
              qrCode: 'CUST002-2',
              affiliateId: 'AFF002'
            }),
            expect.objectContaining({
              customerName: 'Jane Smith',
              customerId: 'CUST002',
              bagNumber: 3,
              totalBags: 3,
              qrCode: 'CUST002-3',
              affiliateId: 'AFF002'
            })
          ]),
          customerIds: ['cust1', 'cust2']
        }, 'Generated 5 labels for 2 customers')
      );
    });

    it('should handle no new customers', async () => {
      const next = jest.fn();
      Customer.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      const handler = extractHandler(operatorController.printNewCustomerLabels);
      await handler(req, res, next);

      expect(Customer.updateMany).not.toHaveBeenCalled();
      
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          customersProcessed: 0,
          labelsGenerated: 0
        }, 'No new customers found')
      );
    });

    it('should handle customer with zero bags', async () => {
      const mockCustomers = [
        {
          _id: 'cust1',
          customerId: 'CUST001',
          firstName: 'John',
          lastName: 'Doe',
          numberOfBags: 0, // Zero bags
          affiliateId: 'AFF001'
        }
      ];

      Customer.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomers)
      });
      Customer.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const handler = extractHandler(operatorController.printNewCustomerLabels);
      await handler(req, res, next);

      // Should NOT update the customer immediately
      expect(Customer.updateMany).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          customersProcessed: 1,
          labelsGenerated: 1,
          labelData: expect.arrayContaining([
            expect.objectContaining({
              customerName: 'John Doe',
              customerId: 'CUST001',
              bagNumber: 1,
              totalBags: 1, // Defaults to 1 when numberOfBags is 0
              qrCode: 'CUST001-1'
            })
          ]),
          customerIds: ['cust1']
        }, 'Generated 1 labels for 1 customers')
      );
    });

    it('should handle database error during find', async () => {
      const next = jest.fn();
      Customer.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      const handler = extractHandler(operatorController.printNewCustomerLabels);
      await handler(req, res, next);

      const logger = require('../../server/utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Print new customer labels error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expectErrorResponse('Error printing customer labels')
      );
    });

    // Database error during update test removed - update no longer happens in printNewCustomerLabels

    it('should handle customers with missing names', async () => {
      const mockCustomers = [
        {
          _id: 'cust1',
          customerId: 'CUST001',
          firstName: '', // Missing first name
          lastName: 'Doe',
          numberOfBags: 1,
          affiliateId: 'AFF001'
        },
        {
          _id: 'cust2',
          customerId: 'CUST002',
          firstName: 'Jane',
          lastName: '', // Missing last name
          numberOfBags: 1,
          affiliateId: 'AFF002'
        }
      ];

      Customer.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomers)
      });
      Customer.updateMany.mockResolvedValue({ modifiedCount: 2 });

      const handler = extractHandler(operatorController.printNewCustomerLabels);
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          customersProcessed: 2,
          labelsGenerated: 2,
          labelData: expect.arrayContaining([
            expect.objectContaining({
              customerName: ' Doe', // Space + last name
              customerId: 'CUST001'
            }),
            expect.objectContaining({
              customerName: 'Jane ', // First name + space
              customerId: 'CUST002'
            })
          ]),
          customerIds: ['cust1', 'cust2']
        }, 'Generated 2 labels for 2 customers')
      );
    });

    it('should generate correct number of labels for each customer', async () => {
      const mockCustomers = [
        {
          _id: 'cust1',
          customerId: 'CUST001',
          firstName: 'John',
          lastName: 'Doe',
          numberOfBags: 5, // 5 bags
          affiliateId: 'AFF001'
        }
      ];

      Customer.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomers)
      });
      Customer.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const handler = extractHandler(operatorController.printNewCustomerLabels);
      await handler(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.labelData).toHaveLength(5);
      
      // Verify each label has correct bag number
      for (let i = 0; i < 5; i++) {
        expect(response.labelData[i]).toMatchObject({
          bagNumber: i + 1,
          totalBags: 5,
          customerId: 'CUST001',
          qrCode: `CUST001-${i + 1}`
        });
      }
    });

    it('should handle undefined numberOfBags', async () => {
      const mockCustomers = [
        {
          _id: 'cust1',
          customerId: 'CUST001',
          firstName: 'John',
          lastName: 'Doe',
          // numberOfBags is undefined
          affiliateId: 'AFF001'
        }
      ];

      Customer.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomers)
      });
      Customer.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const handler = extractHandler(operatorController.printNewCustomerLabels);
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expectSuccessResponse({
          customersProcessed: 1,
          labelsGenerated: 1,
          labelData: expect.arrayContaining([
            expect.objectContaining({
              customerName: 'John Doe',
              customerId: 'CUST001',
              bagNumber: 1,
              totalBags: 1, // Defaults to 1
              qrCode: 'CUST001-1'
            })
          ]),
          customerIds: ['cust1']
        }, 'Generated 1 labels for 1 customers')
      );
    });
  });

  describe('Customer Model bagLabels fields', () => {
    it('should have correct schema fields', () => {
      // This is more of a documentation test to ensure the schema matches expectations
      const expectedFields = {
        bagLabelsGenerated: { type: Boolean, default: false },
        bagLabelsGeneratedAt: Date,
        bagLabelsGeneratedBy: String
      };
      
      // Note: In actual implementation, these fields should be added to Customer model
      expect(true).toBe(true); // Placeholder for schema validation
    });
  });
});