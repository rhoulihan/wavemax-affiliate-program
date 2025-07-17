const Order = require('../../server/models/Order');
const SystemConfig = require('../../server/models/SystemConfig');

describe('Order Model - Add-on Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock SystemConfig to return default WDF rate
    jest.spyOn(SystemConfig, 'getValue').mockResolvedValue(1.25);
  });

  describe('Add-on Total Calculations', () => {
    it('should calculate add-on total correctly with one add-on selected', async () => {
      const order = new Order({
        orderId: 'ORD001',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 10,
          minimumApplied: true
        },
        addOns: {
          premiumDetergent: true,
          fabricSoftener: false,
          stainRemover: false
        }
      });

      await order.save();

      // 1 add-on × 20 lbs × $0.10 = $2.00
      expect(order.addOnTotal).toBe(2.00);
      // Total = (20 × 1.25) + 10 + 2 = 37.00
      expect(order.estimatedTotal).toBe(37.00);
    });

    it('should calculate add-on total correctly with multiple add-ons selected', async () => {
      const order = new Order({
        orderId: 'ORD002',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'afternoon',
        estimatedWeight: 30,
        numberOfBags: 3,
        feeBreakdown: {
          numberOfBags: 3,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 15,
          minimumApplied: false
        },
        addOns: {
          premiumDetergent: true,
          fabricSoftener: true,
          stainRemover: true
        }
      });

      await order.save();

      // 3 add-ons × 30 lbs × $0.10 = $9.00
      expect(order.addOnTotal).toBe(9.00);
      // Total = (30 × 1.25) + 15 + 9 = 61.50
      expect(order.estimatedTotal).toBe(61.50);
    });

    it('should calculate zero add-on total when no add-ons selected', async () => {
      const order = new Order({
        orderId: 'ORD003',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'evening',
        estimatedWeight: 25,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 10,
          minimumApplied: true
        },
        addOns: {
          premiumDetergent: false,
          fabricSoftener: false,
          stainRemover: false
        }
      });

      await order.save();

      expect(order.addOnTotal).toBe(0);
      // Total = (25 × 1.25) + 10 + 0 = 41.25
      expect(order.estimatedTotal).toBe(41.25);
    });

    it('should handle missing add-ons object gracefully', async () => {
      const order = new Order({
        orderId: 'ORD004',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 10,
          minimumApplied: true
        }
        // No addOns property
      });

      await order.save();

      expect(order.addOnTotal).toBe(0);
      expect(order.estimatedTotal).toBe(35.00); // (20 × 1.25) + 10
    });

    it('should recalculate add-on total when weight changes', async () => {
      const order = new Order({
        orderId: 'ORD005',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 10,
          minimumApplied: true
        },
        addOns: {
          premiumDetergent: true,
          fabricSoftener: true,
          stainRemover: false
        }
      });

      await order.save();
      
      // Initial: 2 add-ons × 20 lbs × $0.10 = $4.00
      expect(order.addOnTotal).toBe(4.00);

      // Update weight
      order.estimatedWeight = 30;
      await order.save();

      // Updated: 2 add-ons × 30 lbs × $0.10 = $6.00
      expect(order.addOnTotal).toBe(6.00);
      // Total = (30 × 1.25) + 10 + 6 = 53.50
      expect(order.estimatedTotal).toBe(53.50);
    });

    it('should use actual weight for add-on calculation when available', async () => {
      const order = new Order({
        orderId: 'ORD006',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        actualWeight: 25,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 10,
          minimumApplied: true
        },
        addOns: {
          premiumDetergent: true,
          fabricSoftener: false,
          stainRemover: false
        }
      });

      await order.save();

      // Should use actual weight: 1 add-on × 25 lbs × $0.10 = $2.50
      expect(order.addOnTotal).toBe(2.50);
      // Actual total = (25 × 1.25) + 10 + 2.50 = 43.75
      expect(order.actualTotal).toBe(43.75);
    });
  });

  describe('Add-on Impact on Totals and Commission', () => {
    it('should include add-ons in estimated total but not in commission', async () => {
      const order = new Order({
        orderId: 'ORD007',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        actualWeight: 20,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 10,
          minimumApplied: true
        },
        addOns: {
          premiumDetergent: true,
          fabricSoftener: true,
          stainRemover: false
        }
      });

      await order.save();

      // Add-ons: 2 × 20 × 0.10 = $4.00
      expect(order.addOnTotal).toBe(4.00);
      
      // Actual total includes add-ons: (20 × 1.25) + 10 + 4 = 39.00
      expect(order.actualTotal).toBe(39.00);
      
      // Commission excludes add-ons: (20 × 1.25 × 0.10) + 10 = 12.50
      expect(order.affiliateCommission).toBe(12.50);
    });

    it('should correctly calculate totals with add-ons and WDF credit', async () => {
      const order = new Order({
        orderId: 'ORD008',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 30,
        numberOfBags: 3,
        feeBreakdown: {
          numberOfBags: 3,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 15,
          minimumApplied: false
        },
        addOns: {
          premiumDetergent: true,
          fabricSoftener: true,
          stainRemover: true
        },
        wdfCreditApplied: 5.00
      });

      await order.save();

      // Add-ons: 3 × 30 × 0.10 = $9.00
      expect(order.addOnTotal).toBe(9.00);
      
      // Total: (30 × 1.25) + 15 + 9 - 5 = 56.50
      expect(order.estimatedTotal).toBe(56.50);
    });

    it('should handle all edge cases for add-on calculations', async () => {
      // Test with very small weight
      const order1 = new Order({
        orderId: 'ORD009',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 0.1,
        numberOfBags: 1,
        feeBreakdown: {
          numberOfBags: 1,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 10,
          minimumApplied: true
        },
        addOns: {
          premiumDetergent: true,
          fabricSoftener: false,
          stainRemover: false
        }
      });

      await order1.save();
      
      // 1 × 0.1 × 0.10 = $0.01
      expect(order1.addOnTotal).toBe(0.01);

      // Test with large weight
      const order2 = new Order({
        orderId: 'ORD010',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 100,
        numberOfBags: 10,
        feeBreakdown: {
          numberOfBags: 10,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 50,
          minimumApplied: false
        },
        addOns: {
          premiumDetergent: true,
          fabricSoftener: true,
          stainRemover: true
        }
      });

      await order2.save();
      
      // 3 × 100 × 0.10 = $30.00
      expect(order2.addOnTotal).toBe(30.00);
    });
  });

  describe('Add-on Default Values', () => {
    it('should have default false values for all add-ons when not specified', async () => {
      const order = new Order({
        orderId: 'ORD011',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 10,
          minimumApplied: true
        }
      });

      await order.save();

      expect(order.addOns.premiumDetergent).toBe(false);
      expect(order.addOns.fabricSoftener).toBe(false);
      expect(order.addOns.stainRemover).toBe(false);
      expect(order.addOnTotal).toBe(0);
    });
  });

  describe('Add-on Updates', () => {
    it('should recalculate totals when add-ons are modified', async () => {
      const order = new Order({
        orderId: 'ORD012',
        customerId: 'CUST001',
        affiliateId: 'AFF001',
        pickupDate: new Date(),
        pickupTime: 'morning',
        estimatedWeight: 20,
        numberOfBags: 2,
        feeBreakdown: {
          numberOfBags: 2,
          minimumFee: 10,
          perBagFee: 5,
          totalFee: 10,
          minimumApplied: true
        },
        addOns: {
          premiumDetergent: false,
          fabricSoftener: false,
          stainRemover: false
        }
      });

      await order.save();
      expect(order.addOnTotal).toBe(0);

      // Add one add-on
      order.addOns.premiumDetergent = true;
      await order.save();
      expect(order.addOnTotal).toBe(2.00); // 1 × 20 × 0.10

      // Add another add-on
      order.addOns.fabricSoftener = true;
      await order.save();
      expect(order.addOnTotal).toBe(4.00); // 2 × 20 × 0.10

      // Add third add-on
      order.addOns.stainRemover = true;
      await order.save();
      expect(order.addOnTotal).toBe(6.00); // 3 × 20 × 0.10

      // Remove one add-on
      order.addOns.premiumDetergent = false;
      await order.save();
      expect(order.addOnTotal).toBe(4.00); // 2 × 20 × 0.10
    });
  });
});