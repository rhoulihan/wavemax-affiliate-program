const { getFilteredData, fieldDefinitions } = require('../../server/utils/fieldFilter');

describe('Field Filter WDF Credit Support', () => {
  describe('Customer WDF Credit Fields', () => {
    const mockCustomer = {
      _id: '507f1f77bcf86cd799439011',
      customerId: 'CUST-001',
      affiliateId: 'AFF-001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '1234567890',
      address: '123 Main St',
      city: 'Anytown',
      state: 'ST',
      zipCode: '12345',
      wdfCredit: 15.50,
      wdfCreditUpdatedAt: new Date('2024-01-15'),
      wdfCreditFromOrderId: 'ORD-123',
      bagCredit: 20,
      bagCreditApplied: false,
      passwordSalt: 'secret',
      passwordHash: 'secret'
    };

    it('should include WDF credit fields for customer viewing own profile', () => {
      const filtered = getFilteredData('customer', mockCustomer, 'customer', { isSelf: true });
      
      expect(filtered).toHaveProperty('wdfCredit', 15.50);
      expect(filtered).toHaveProperty('wdfCreditUpdatedAt');
      expect(filtered).toHaveProperty('wdfCreditFromOrderId', 'ORD-123');
      
      // Should also include other expected fields
      expect(filtered).toHaveProperty('customerId');
      expect(filtered).toHaveProperty('email');
      expect(filtered).toHaveProperty('bagCredit');
      
      // Should not include sensitive fields
      expect(filtered).not.toHaveProperty('passwordSalt');
      expect(filtered).not.toHaveProperty('passwordHash');
    });

    it('should include WDF credit fields for affiliate viewing customer', () => {
      const filtered = getFilteredData('customer', mockCustomer, 'affiliate');
      
      expect(filtered).toHaveProperty('wdfCredit', 15.50);
      expect(filtered).toHaveProperty('wdfCreditUpdatedAt');
      expect(filtered).toHaveProperty('wdfCreditFromOrderId', 'ORD-123');
    });

    it('should include WDF credit fields for admin viewing customer', () => {
      const filtered = getFilteredData('customer', mockCustomer, 'admin');
      
      expect(filtered).toHaveProperty('wdfCredit', 15.50);
      expect(filtered).toHaveProperty('wdfCreditUpdatedAt');
      expect(filtered).toHaveProperty('wdfCreditFromOrderId', 'ORD-123');
      
      // Admin should see more fields
      expect(filtered).toHaveProperty('_id');
      expect(filtered).toHaveProperty('affiliateId');
    });

    it('should NOT include WDF credit for public access', () => {
      const filtered = getFilteredData('customer', mockCustomer, 'public');
      
      expect(filtered).not.toHaveProperty('wdfCredit');
      expect(filtered).not.toHaveProperty('wdfCreditUpdatedAt');
      expect(filtered).not.toHaveProperty('wdfCreditFromOrderId');
      
      // Should only have basic public fields
      expect(filtered).toHaveProperty('customerId');
      expect(filtered).toHaveProperty('firstName');
      expect(filtered).toHaveProperty('lastName');
      expect(Object.keys(filtered).length).toBe(3);
    });

    it('should NOT include WDF credit for other customers', () => {
      const filtered = getFilteredData('customer', mockCustomer, 'customer', { isSelf: false });
      
      expect(filtered).not.toHaveProperty('wdfCredit');
      expect(filtered).not.toHaveProperty('email');
      expect(filtered).not.toHaveProperty('phone');
    });
  });

  describe('Order WDF Credit Fields', () => {
    const mockOrder = {
      _id: '507f1f77bcf86cd799439012',
      orderId: 'ORD-001',
      customerId: 'CUST-001',
      affiliateId: 'AFF-001',
      pickupDate: new Date(),
      pickupTime: 'morning',
      status: 'complete',
      estimatedWeight: 20,
      actualWeight: 25,
      estimatedTotal: 35,
      actualTotal: 41.25,
      wdfCreditApplied: 5.00,
      wdfCreditGenerated: 6.25,
      weightDifference: 5,
      specialPickupInstructions: 'Ring doorbell',
      paymentStatus: 'completed'
    };

    it('should include WDF fields for customer viewing own order', () => {
      const filtered = getFilteredData('order', mockOrder, 'customer');
      
      expect(filtered).toHaveProperty('wdfCreditApplied', 5.00);
      expect(filtered).toHaveProperty('wdfCreditGenerated', 6.25);
      expect(filtered).toHaveProperty('weightDifference', 5);
      
      // Should not include instructions
      expect(filtered).not.toHaveProperty('specialPickupInstructions');
    });

    it('should include WDF fields for affiliate viewing order', () => {
      const filtered = getFilteredData('order', mockOrder, 'affiliate');
      
      expect(filtered).toHaveProperty('wdfCreditApplied', 5.00);
      expect(filtered).toHaveProperty('wdfCreditGenerated', 6.25);
      expect(filtered).toHaveProperty('weightDifference', 5);
      
      // Affiliate should see more fields
      expect(filtered).toHaveProperty('specialPickupInstructions');
      expect(filtered).toHaveProperty('customerId');
    });

    it('should include WDF fields for admin viewing order', () => {
      const filtered = getFilteredData('order', mockOrder, 'admin');
      
      expect(filtered).toHaveProperty('wdfCreditApplied', 5.00);
      expect(filtered).toHaveProperty('wdfCreditGenerated', 6.25);
      expect(filtered).toHaveProperty('weightDifference', 5);
      
      // Admin should see all fields
      expect(filtered).toHaveProperty('_id');
      expect(filtered).toHaveProperty('affiliateId');
    });
  });

  describe('Field Definition Verification', () => {
    it('should have WDF credit fields defined in customer field definitions', () => {
      expect(fieldDefinitions.customer.self).toContain('wdfCredit');
      expect(fieldDefinitions.customer.self).toContain('wdfCreditUpdatedAt');
      expect(fieldDefinitions.customer.self).toContain('wdfCreditFromOrderId');
      
      expect(fieldDefinitions.customer.affiliate).toContain('wdfCredit');
      expect(fieldDefinitions.customer.affiliate).toContain('wdfCreditUpdatedAt');
      expect(fieldDefinitions.customer.affiliate).toContain('wdfCreditFromOrderId');
      
      expect(fieldDefinitions.customer.admin).toContain('wdfCredit');
      expect(fieldDefinitions.customer.admin).toContain('wdfCreditUpdatedAt');
      expect(fieldDefinitions.customer.admin).toContain('wdfCreditFromOrderId');
    });

    it('should have WDF credit fields defined in order field definitions', () => {
      expect(fieldDefinitions.order.customer).toContain('wdfCreditApplied');
      expect(fieldDefinitions.order.customer).toContain('wdfCreditGenerated');
      expect(fieldDefinitions.order.customer).toContain('weightDifference');
      
      expect(fieldDefinitions.order.affiliate).toContain('wdfCreditApplied');
      expect(fieldDefinitions.order.affiliate).toContain('wdfCreditGenerated');
      expect(fieldDefinitions.order.affiliate).toContain('weightDifference');
      
      expect(fieldDefinitions.order.admin).toContain('wdfCreditApplied');
      expect(fieldDefinitions.order.admin).toContain('wdfCreditGenerated');
      expect(fieldDefinitions.order.admin).toContain('weightDifference');
    });
  });

  describe('Array Filtering', () => {
    it('should filter WDF credit fields in customer arrays', () => {
      const customers = [
        {
          customerId: 'CUST-001',
          firstName: 'John',
          lastName: 'Doe',
          wdfCredit: 10,
          wdfCreditFromOrderId: 'ORD-001'
        },
        {
          customerId: 'CUST-002',
          firstName: 'Jane',
          lastName: 'Smith',
          wdfCredit: -5,
          wdfCreditFromOrderId: 'ORD-002'
        }
      ];

      const filtered = getFilteredData('customer', customers, 'affiliate');
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toHaveProperty('wdfCredit', 10);
      expect(filtered[1]).toHaveProperty('wdfCredit', -5);
    });

    it('should filter WDF credit fields in order arrays', () => {
      const orders = [
        {
          orderId: 'ORD-001',
          wdfCreditApplied: 5,
          wdfCreditGenerated: 0,
          weightDifference: 0
        },
        {
          orderId: 'ORD-002',
          wdfCreditApplied: 0,
          wdfCreditGenerated: 7.5,
          weightDifference: 6
        }
      ];

      const filtered = getFilteredData('order', orders, 'customer');
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toHaveProperty('wdfCreditApplied', 5);
      expect(filtered[1]).toHaveProperty('wdfCreditGenerated', 7.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined WDF credit values', () => {
      const customer = {
        customerId: 'CUST-003',
        firstName: 'Test',
        lastName: 'User',
        wdfCredit: null,
        wdfCreditUpdatedAt: undefined,
        wdfCreditFromOrderId: null
      };

      const filtered = getFilteredData('customer', customer, 'admin');
      
      expect(filtered).toHaveProperty('wdfCredit', null);
      expect(filtered).toHaveProperty('wdfCreditUpdatedAt', undefined);
      expect(filtered).toHaveProperty('wdfCreditFromOrderId', null);
    });

    it('should handle zero WDF credit values', () => {
      const order = {
        orderId: 'ORD-003',
        wdfCreditApplied: 0,
        wdfCreditGenerated: 0,
        weightDifference: 0
      };

      const filtered = getFilteredData('order', order, 'customer');
      
      expect(filtered).toHaveProperty('wdfCreditApplied', 0);
      expect(filtered).toHaveProperty('wdfCreditGenerated', 0);
      expect(filtered).toHaveProperty('weightDifference', 0);
    });
  });
});