const crypto = require('crypto');
const customerController = require('../../server/controllers/customerController');
const orderController = require('../../server/controllers/orderController');
const Customer = require('../../server/models/Customer');
const Order = require('../../server/models/Order');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const paymentLinkService = require('../../server/services/paymentLinkService');
const emailService = require('../../server/utils/emailService');
const { extractHandler } = require('../helpers/testUtils');
const { expectSuccessResponse, expectErrorResponse } = require('../helpers/responseHelpers');
const { createFindOneMock, createFindMock, createMockDocument, createAggregateMock } = require('../helpers/mockHelpers');

// Mock external services
jest.mock('../../server/services/paymentLinkService');
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/controllerHelpers', () => ({
  asyncWrapper: (fn) => fn,
  sendSuccess: (res, data, message, statusCode = 200) => {
    return res.status(statusCode || 200).json({ success: true, message: message || 'Success', ...data });
  },
  sendError: (res, message, statusCode = 400, details) => {
    return res.status(statusCode).json({ success: false, message, ...(details && { ...details }) });
  },
  validateRequiredFields: (body, fields) => {
    const missing = fields.filter(field => !body[field]);
    return missing.length > 0 ? { missingFields: missing } : null;
  }
}));

describe('V2 Controller Logic', () => {
  let testAffiliate;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Ensure SystemConfig is set up for V2
    await SystemConfig.deleteMany({});
    await SystemConfig.create([
      { key: 'payment_version', value: 'v2', dataType: 'string', category: 'payment' },
      { key: 'free_initial_bags', value: 2, dataType: 'number', category: 'payment' },
      { key: 'venmo_handle', value: '@wavemax', dataType: 'string', category: 'payment' },
      { key: 'paypal_handle', value: 'wavemax', dataType: 'string', category: 'payment' },
      { key: 'cashapp_handle', value: '$wavemax', dataType: 'string', category: 'payment' }
    ]);
    
    // Create test affiliate with proper auth fields
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
    
    testAffiliate = await Affiliate.create({
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'affiliate@test.com',
      phone: '555-0001',
      address: '123 Affiliate St',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      username: `affiliate${Date.now()}`,
      passwordHash: hash,
      passwordSalt: salt,
      paymentMethod: 'check'
    });
  });

  afterEach(async () => {
    await Customer.deleteMany({});
    await Order.deleteMany({});
    await Affiliate.deleteMany({});
  });

  afterAll(async () => {
    await SystemConfig.deleteMany({});
  });

  describe('V2 Order Processing', () => {
    let testCustomer, testOrder;
    
    beforeEach(async () => {
      // Create V2 customer
      testCustomer = await Customer.create({
        name: 'Test V2 Customer',
        firstName: 'Test',
        lastName: 'Customer',
        email: 'v2customer@test.com',
        phone: '555-2222',
        address: '456 Customer Ave',
        city: 'Customer City',
        state: 'TX',
        zipCode: '54321',
        username: `v2customer${Date.now()}`,
        passwordHash: crypto.randomBytes(32).toString('hex'),
        passwordSalt: crypto.randomBytes(16).toString('hex'),
        affiliateId: testAffiliate._id,
        registrationVersion: 'v2',
        initialBagsRequested: 2
      });
      
      // Create pending order
      testOrder = await Order.create({
        customerId: testCustomer.customerId,
        affiliateId: testAffiliate.affiliateId,
        bagId: 'BAG-v2cl-1',
        status: 'in_progress',
        paymentStatus: 'pending',
        paymentMethod: 'pending'
      });
    });

    it('should handle payment confirmation from customer', async () => {
      testOrder.paymentStatus = 'awaiting';
      testOrder.paymentAmount = 45.00;
      testOrder.paymentRequestedAt = new Date();
      await testOrder.save();
      
      const req = {
        body: {
          orderId: testOrder._id.toString().slice(-8).toUpperCase(),
          paymentMethod: 'venmo'
        }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      const handler = orderController.confirmPayment;
      await handler(req, res, next);
      
      // Verify order was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentStatus).toBe('confirming');
      expect(updatedOrder.paymentConfirmedAt).toBeDefined();
      expect(updatedOrder.paymentMethod).toBe('venmo');
      expect(updatedOrder.paymentNotes).toContain('Customer confirmed payment');
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('verifying it now'),
          escalated: true
        })
      );
    });

    it('should allow admin to manually verify payment', async () => {
      testOrder.paymentStatus = 'awaiting';
      testOrder.paymentAmount = 55.00;
      await testOrder.save();
      
      const req = {
        params: { orderId: testOrder._id.toString() },
        body: {
          transactionId: 'MANUAL123',
          notes: 'Verified via phone call'
        },
        user: {
          role: 'admin',
          _id: 'admin123'
        }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      const handler = orderController.verifyPaymentManually;
      await handler(req, res, next);
      
      // Verify payment was marked as verified
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentStatus).toBe('verified');
      expect(updatedOrder.paymentVerifiedAt).toBeDefined();
      expect(updatedOrder.paymentTransactionId).toBe('MANUAL123');
      expect(updatedOrder.paymentNotes).toContain('Manually verified by admin');
      expect(updatedOrder.paymentNotes).toContain('Verified via phone call');
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          order: expect.objectContaining({
            paymentStatus: 'verified'
          })
        })
      );
    });

    it('should not send pickup notification until payment is verified', async () => {
      testOrder.actualWeight = 25;
      testOrder.actualTotal = 60.00;
      testOrder.paymentStatus = 'awaiting';
      testOrder.paymentAmount = 60.00;
      await testOrder.save();
      
      emailService.sendPickupReadyNotification = jest.fn();
      
      const req = {
        params: { orderId: testOrder._id.toString() },
        body: {
          status: 'processed' // WDF complete
        },
        user: {
          role: 'operator',
          affiliateId: testAffiliate.affiliateId
        }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      const handler = extractHandler(orderController.updateOrderStatus);
      await handler(req, res, next);
      
      // Should NOT send pickup notification (payment not verified)
      expect(emailService.sendPickupReadyNotification).not.toHaveBeenCalled();

      // The ready gate holds the unpaid processed order at the store instead
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe('processed');
      expect(updatedOrder.heldAtStore).toBe(true);
    });
  });

});
