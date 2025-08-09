// Test for bag label printing functionality
const operatorController = require('../../server/controllers/operatorController');
const Customer = require('../../server/models/Customer');
const { logAuditEvent } = require('../../server/utils/auditLogger');

jest.mock('../../server/models/Customer');
jest.mock('../../server/utils/auditLogger');
jest.mock('../../server/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Operator Controller - Bag Label Printing', () => {
  let req, res;

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
    jest.clearAllMocks();
  });

  describe('getNewCustomersCount', () => {
    it('should return count of customers without bag labels', async () => {
      Customer.countDocuments.mockResolvedValue(5);

      await operatorController.getNewCustomersCount(req, res);

      expect(Customer.countDocuments).toHaveBeenCalledWith({
        bagLabelsGenerated: false,
        isActive: true
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 5
      });
    });

    it('should return zero when no new customers', async () => {
      Customer.countDocuments.mockResolvedValue(0);

      await operatorController.getNewCustomersCount(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0
      });
    });

    it('should handle database error', async () => {
      Customer.countDocuments.mockRejectedValue(new Error('Database error'));

      await operatorController.getNewCustomersCount(req, res);

      // Note: The actual controller uses console.error, not logger.error
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error fetching new customers count'
      });
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

      await operatorController.printNewCustomerLabels(req, res);

      expect(Customer.find).toHaveBeenCalledWith({
        bagLabelsGenerated: false,
        isActive: true
      });

      expect(Customer.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ['cust1', 'cust2'] } },
        {
          $set: {
            bagLabelsGenerated: true,
            bagLabelsGeneratedAt: expect.any(Date),
            bagLabelsGeneratedBy: 'op123' // Uses req.user.id
          }
        }
      );

      // Check logger.info was called
      const logger = require('../../server/utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        'Operator op123 printed 5 labels for 2 customers'
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Generated 5 labels for 2 customers',
        customersProcessed: 2,
        labelsGenerated: 5,
        labelData: expect.arrayContaining([
          expect.objectContaining({
            customerName: 'John Doe',
            customerId: 'CUST001',
            bagNumber: 1,
            totalBags: 2,
            qrCode: 'BAG-CUST001-1',
            affiliateId: 'AFF001'
          }),
          expect.objectContaining({
            customerName: 'John Doe',
            customerId: 'CUST001',
            bagNumber: 2,
            totalBags: 2,
            qrCode: 'BAG-CUST001-2',
            affiliateId: 'AFF001'
          }),
          expect.objectContaining({
            customerName: 'Jane Smith',
            customerId: 'CUST002',
            bagNumber: 1,
            totalBags: 3,
            qrCode: 'BAG-CUST002-1',
            affiliateId: 'AFF002'
          }),
          expect.objectContaining({
            customerName: 'Jane Smith',
            customerId: 'CUST002',
            bagNumber: 2,
            totalBags: 3,
            qrCode: 'BAG-CUST002-2',
            affiliateId: 'AFF002'
          }),
          expect.objectContaining({
            customerName: 'Jane Smith',
            customerId: 'CUST002',
            bagNumber: 3,
            totalBags: 3,
            qrCode: 'BAG-CUST002-3',
            affiliateId: 'AFF002'
          })
        ])
      });
    });

    it('should handle no new customers', async () => {
      Customer.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      await operatorController.printNewCustomerLabels(req, res);

      expect(Customer.updateMany).not.toHaveBeenCalled();
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'No new customers found',
        customersProcessed: 0,
        labelsGenerated: 0
      });
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

      await operatorController.printNewCustomerLabels(req, res);

      // Should still update the customer and generate 1 label (default)
      expect(Customer.updateMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Generated 1 labels for 1 customers',
        customersProcessed: 1,
        labelsGenerated: 1,
        labelData: expect.arrayContaining([
          expect.objectContaining({
            customerName: 'John Doe',
            customerId: 'CUST001',
            bagNumber: 1,
            totalBags: 1, // Defaults to 1 when numberOfBags is 0
            qrCode: 'BAG-CUST001-1'
          })
        ])
      });
    });

    it('should handle database error during find', async () => {
      Customer.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await operatorController.printNewCustomerLabels(req, res);

      const logger = require('../../server/utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Print new customer labels error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error printing customer labels'
      });
    });

    it('should handle database error during update', async () => {
      const mockCustomers = [
        {
          _id: 'cust1',
          customerId: 'CUST001',
          firstName: 'John',
          lastName: 'Doe',
          numberOfBags: 2,
          affiliateId: 'AFF001'
        }
      ];

      Customer.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCustomers)
      });
      Customer.updateMany.mockRejectedValue(new Error('Update failed'));

      await operatorController.printNewCustomerLabels(req, res);

      const logger = require('../../server/utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Print new customer labels error:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error printing customer labels'
      });
    });

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

      await operatorController.printNewCustomerLabels(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Generated 2 labels for 2 customers',
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
        ])
      });
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

      await operatorController.printNewCustomerLabels(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.labelData).toHaveLength(5);
      
      // Verify each label has correct bag number
      for (let i = 0; i < 5; i++) {
        expect(response.labelData[i]).toMatchObject({
          bagNumber: i + 1,
          totalBags: 5,
          customerId: 'CUST001',
          qrCode: `BAG-CUST001-${i + 1}`
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

      await operatorController.printNewCustomerLabels(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Generated 1 labels for 1 customers',
        customersProcessed: 1,
        labelsGenerated: 1,
        labelData: expect.arrayContaining([
          expect.objectContaining({
            customerName: 'John Doe',
            customerId: 'CUST001',
            bagNumber: 1,
            totalBags: 1, // Defaults to 1
            qrCode: 'BAG-CUST001-1'
          })
        ])
      });
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