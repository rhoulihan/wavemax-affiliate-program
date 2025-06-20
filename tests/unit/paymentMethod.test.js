const mongoose = require('mongoose');
const PaymentMethod = require('../../server/models/PaymentMethod');

describe('PaymentMethod Model Unit Tests', () => {
  let mockPaymentMethod;
  const customerId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    mockPaymentMethod = new PaymentMethod({
      customerId: customerId,
      paygistixId: 'PM-' + Date.now(),
      type: 'card',
      card: {
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: new Date().getFullYear() + 1,
        fingerprint: 'FP-CARD-123'
      }
    });
  });

  describe('Schema Validation', () => {
    it('should create a valid payment method', () => {
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeUndefined();
      expect(mockPaymentMethod.type).toBe('card');
      expect(mockPaymentMethod.card.last4).toBe('4242');
    });

    it('should require customerId', () => {
      mockPaymentMethod.customerId = undefined;
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.customerId).toBeDefined();
    });

    it('should require paygistixId', () => {
      mockPaymentMethod.paygistixId = undefined;
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.paygistixId).toBeDefined();
    });

    it('should validate type enum', () => {
      const validTypes = ['card', 'bank_account', 'wallet'];

      validTypes.forEach(type => {
        const pm = new PaymentMethod({
          customerId: customerId,
          paygistixId: 'PM-TEST',
          type: type
        });
        // Add required fields based on type
        if (type === 'card') {
          pm.card = {
            last4: '4242',
            brand: 'visa',
            expiryMonth: 12,
            expiryYear: new Date().getFullYear() + 1,
            fingerprint: 'FP-123'
          };
        } else if (type === 'bank_account') {
          pm.bankAccount = {
            last4: '6789',
            bankName: 'Test Bank',
            accountType: 'checking',
            fingerprint: 'FP-456'
          };
        } else if (type === 'wallet') {
          pm.walletType = 'apple_pay';
        }

        const error = pm.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid type', () => {
      mockPaymentMethod.type = 'invalid_type';
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.type).toBeDefined();
    });

    it('should default type to card', () => {
      const pm = new PaymentMethod({
        customerId: customerId,
        paygistixId: 'PM-TEST'
      });
      expect(pm.type).toBe('card');
    });
  });

  describe('Card Validation', () => {
    it('should require card details when type is card', () => {
      mockPaymentMethod.card = undefined;
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.card).toBeDefined();
    });

    it('should validate card last4 length', () => {
      mockPaymentMethod.card.last4 = '123';
      let error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['card.last4']).toBeDefined();

      mockPaymentMethod.card.last4 = '12345';
      error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['card.last4']).toBeDefined();
    });

    it('should validate card brand enum', () => {
      const validBrands = ['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unionpay'];

      validBrands.forEach(brand => {
        mockPaymentMethod.card.brand = brand;
        const error = mockPaymentMethod.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid card brand', () => {
      mockPaymentMethod.card.brand = 'invalid_brand';
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['card.brand']).toBeDefined();
    });

    it('should validate expiry month range', () => {
      mockPaymentMethod.card.expiryMonth = 0;
      let error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['card.expiryMonth']).toBeDefined();

      mockPaymentMethod.card.expiryMonth = 13;
      error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['card.expiryMonth']).toBeDefined();
    });

    it('should validate expiry year is not in the past', () => {
      mockPaymentMethod.card.expiryYear = new Date().getFullYear() - 1;
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['card.expiryYear']).toBeDefined();
    });

    it('should require card fingerprint', () => {
      mockPaymentMethod.card.fingerprint = undefined;
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['card.fingerprint']).toBeDefined();
    });
  });

  describe('Bank Account Validation', () => {
    beforeEach(() => {
      mockPaymentMethod = new PaymentMethod({
        customerId: customerId,
        paygistixId: 'PM-BANK-' + Date.now(),
        type: 'bank_account',
        bankAccount: {
          last4: '6789',
          bankName: 'Test Bank',
          accountType: 'checking',
          fingerprint: 'FP-BANK-123'
        }
      });
    });

    it('should create valid bank account payment method', () => {
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeUndefined();
    });

    it('should require bank account details when type is bank_account', () => {
      mockPaymentMethod.bankAccount = undefined;
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.bankAccount).toBeDefined();
    });

    it('should validate bank account last4 length', () => {
      mockPaymentMethod.bankAccount.last4 = '123';
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['bankAccount.last4']).toBeDefined();
    });

    it('should validate account type enum', () => {
      const validTypes = ['checking', 'savings'];

      validTypes.forEach(type => {
        mockPaymentMethod.bankAccount.accountType = type;
        const error = mockPaymentMethod.validateSync();
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid account type', () => {
      mockPaymentMethod.bankAccount.accountType = 'invalid_type';
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors['bankAccount.accountType']).toBeDefined();
    });
  });

  describe('Wallet Validation', () => {
    beforeEach(() => {
      mockPaymentMethod = new PaymentMethod({
        customerId: customerId,
        paygistixId: 'PM-WALLET-' + Date.now(),
        type: 'wallet',
        walletType: 'apple_pay'
      });
    });

    it('should create valid wallet payment method', () => {
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeUndefined();
    });

    it('should require wallet type when type is wallet', () => {
      mockPaymentMethod.walletType = undefined;
      const error = mockPaymentMethod.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.walletType).toBeDefined();
    });

    it('should validate wallet type enum', () => {
      const validTypes = ['apple_pay', 'google_pay', 'paypal'];

      validTypes.forEach(type => {
        mockPaymentMethod.walletType = type;
        const error = mockPaymentMethod.validateSync();
        expect(error).toBeUndefined();
      });
    });
  });

  describe('Default Values', () => {
    it('should default isDefault to false', () => {
      expect(mockPaymentMethod.isDefault).toBe(false);
    });

    it('should default isActive to true', () => {
      expect(mockPaymentMethod.isActive).toBe(true);
    });

    it('should default isVerified to false', () => {
      expect(mockPaymentMethod.isVerified).toBe(false);
    });
  });

  describe('Virtual Properties', () => {
    describe('displayName', () => {
      it('should format card display name', () => {
        expect(mockPaymentMethod.displayName).toBe('VISA •••• 4242');
      });

      it('should format bank account display name', () => {
        const bankPM = new PaymentMethod({
          customerId: customerId,
          paygistixId: 'PM-BANK',
          type: 'bank_account',
          bankAccount: {
            last4: '6789',
            bankName: 'Chase Bank',
            accountType: 'checking',
            fingerprint: 'FP-123'
          }
        });

        expect(bankPM.displayName).toBe('Chase Bank •••• 6789');
      });

      it('should format wallet display name', () => {
        const walletPM = new PaymentMethod({
          customerId: customerId,
          paygistixId: 'PM-WALLET',
          type: 'wallet',
          walletType: 'apple_pay'
        });

        expect(walletPM.displayName).toBe('Apple Pay');
      });

      it('should handle google_pay formatting', () => {
        const walletPM = new PaymentMethod({
          customerId: customerId,
          paygistixId: 'PM-WALLET',
          type: 'wallet',
          walletType: 'google_pay'
        });

        expect(walletPM.displayName).toBe('Google Pay');
      });

      it('should return default for unknown type', () => {
        const pm = new PaymentMethod({
          customerId: customerId,
          paygistixId: 'PM-TEST',
          type: 'card'
        });
        // No card details
        expect(pm.displayName).toBe('Unknown Payment Method');
      });
    });

    describe('isExpired', () => {
      it('should return false for non-card types', () => {
        const bankPM = new PaymentMethod({
          customerId: customerId,
          paygistixId: 'PM-BANK',
          type: 'bank_account',
          bankAccount: {
            last4: '6789',
            bankName: 'Test Bank',
            accountType: 'checking',
            fingerprint: 'FP-123'
          }
        });

        expect(bankPM.isExpired).toBe(false);
      });

      it('should return false for future expiry', () => {
        expect(mockPaymentMethod.isExpired).toBe(false);
      });

      it('should return true for past year', () => {
        mockPaymentMethod.card.expiryYear = new Date().getFullYear() - 1;
        expect(mockPaymentMethod.isExpired).toBe(true);
      });

      it('should return true for current year past month', () => {
        const now = new Date();
        mockPaymentMethod.card.expiryYear = now.getFullYear();
        mockPaymentMethod.card.expiryMonth = now.getMonth(); // getMonth() is 0-based
        expect(mockPaymentMethod.isExpired).toBe(true);
      });

      it('should return false for current year future month', () => {
        const now = new Date();
        mockPaymentMethod.card.expiryYear = now.getFullYear();
        mockPaymentMethod.card.expiryMonth = 12; // December
        expect(mockPaymentMethod.isExpired).toBe(false);
      });
    });
  });

  describe('Instance Methods', () => {
    describe('canUse()', () => {
      it('should allow use of active non-expired card', () => {
        const result = mockPaymentMethod.canUse();
        expect(result.canUse).toBe(true);
      });

      it('should not allow use of inactive payment method', () => {
        mockPaymentMethod.isActive = false;
        const result = mockPaymentMethod.canUse();
        expect(result.canUse).toBe(false);
        expect(result.reason).toContain('inactive');
      });

      it('should not allow use of expired card', () => {
        mockPaymentMethod.card.expiryYear = new Date().getFullYear() - 1;
        const result = mockPaymentMethod.canUse();
        expect(result.canUse).toBe(false);
        expect(result.reason).toContain('expired');
      });

      it('should not allow use of unverified bank account', () => {
        const bankPM = new PaymentMethod({
          customerId: customerId,
          paygistixId: 'PM-BANK',
          type: 'bank_account',
          bankAccount: {
            last4: '6789',
            bankName: 'Test Bank',
            accountType: 'checking',
            fingerprint: 'FP-123'
          },
          isVerified: false
        });

        const result = bankPM.canUse();
        expect(result.canUse).toBe(false);
        expect(result.reason).toContain('verification');
      });

      it('should allow use of verified bank account', () => {
        const bankPM = new PaymentMethod({
          customerId: customerId,
          paygistixId: 'PM-BANK',
          type: 'bank_account',
          bankAccount: {
            last4: '6789',
            bankName: 'Test Bank',
            accountType: 'checking',
            fingerprint: 'FP-123'
          },
          isVerified: true
        });

        const result = bankPM.canUse();
        expect(result.canUse).toBe(true);
      });
    });

    describe('markAsUsed()', () => {
      it('should update lastUsedAt', async () => {
        const beforeUse = new Date();

        // Mock save method
        mockPaymentMethod.save = jest.fn().mockResolvedValue(mockPaymentMethod);

        await mockPaymentMethod.markAsUsed();

        expect(mockPaymentMethod.lastUsedAt).toBeDefined();
        expect(mockPaymentMethod.lastUsedAt.getTime()).toBeGreaterThanOrEqual(beforeUse.getTime());
        expect(mockPaymentMethod.save).toHaveBeenCalled();
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(() => {
      PaymentMethod.findOne = jest.fn();
      PaymentMethod.find = jest.fn().mockReturnThis();
      PaymentMethod.sort = jest.fn().mockReturnThis();
      PaymentMethod.countDocuments = jest.fn();
      PaymentMethod.updateMany = jest.fn();
    });

    describe('findDefault()', () => {
      it('should find default payment method for customer', async () => {
        const mockDefault = { _id: 'pm123', isDefault: true };
        PaymentMethod.findOne.mockResolvedValue(mockDefault);

        const result = await PaymentMethod.findDefault(customerId);

        expect(PaymentMethod.findOne).toHaveBeenCalledWith({
          customerId,
          isActive: true,
          isDefault: true
        });
        expect(result).toEqual(mockDefault);
      });
    });

    describe('findActiveByCustomer()', () => {
      it('should find active payment methods sorted by default and date', async () => {
        const mockMethods = [
          { _id: 'pm1', isDefault: true },
          { _id: 'pm2', isDefault: false }
        ];

        const mockQuery = {
          sort: jest.fn().mockResolvedValue(mockMethods)
        };

        PaymentMethod.find.mockReturnValue(mockQuery);

        const result = await PaymentMethod.findActiveByCustomer(customerId);

        expect(PaymentMethod.find).toHaveBeenCalledWith({
          customerId,
          isActive: true
        });
        expect(mockQuery.sort).toHaveBeenCalledWith({ isDefault: -1, createdAt: -1 });
        expect(result).toEqual(mockMethods);
      });
    });

    describe('checkDuplicate()', () => {
      it('should check for duplicate card fingerprint', async () => {
        const fingerprint = 'FP-123';
        const mockExisting = { _id: 'pm123' };

        PaymentMethod.findOne.mockResolvedValue(mockExisting);

        const result = await PaymentMethod.checkDuplicate(customerId, fingerprint);

        expect(PaymentMethod.findOne).toHaveBeenCalledWith({
          customerId,
          'card.fingerprint': fingerprint,
          isActive: true
        });
        expect(result).toEqual(mockExisting);
      });

      it('should return null if no duplicate found', async () => {
        PaymentMethod.findOne.mockResolvedValue(null);

        const result = await PaymentMethod.checkDuplicate(customerId, 'FP-NEW');

        expect(result).toBeNull();
      });
    });
  });

  describe('Middleware', () => {
    describe('Pre-save middleware existence', () => {
      it('should have pre-save middleware defined', () => {
        const preSaveHooks = PaymentMethod.schema.s.hooks._pres.get('save');
        expect(preSaveHooks).toBeDefined();
        expect(preSaveHooks.length).toBeGreaterThan(0);
      });
    });

    describe('Pre-save default handling', () => {
      it.skip('should remove default from other payment methods when setting default', async () => {
        // Skipping: Testing Mongoose internals is fragile and not recommended
        // The actual middleware functionality is tested through integration tests
      });

      it.skip('should prevent modification of paygistixId', async () => {
        // Skipping: Testing Mongoose internals is fragile and not recommended
        // The actual middleware functionality is tested through integration tests
      });

      it.skip('should prevent modification of customerId', async () => {
        // Skipping: Testing Mongoose internals is fragile and not recommended
        // The actual middleware functionality is tested through integration tests
      });
    });

    describe('Pre-save auto-default', () => {
      it.skip('should set first payment method as default', async () => {
        // Skipping: Testing Mongoose internals is fragile and not recommended
        // The actual middleware functionality is tested through integration tests
      });

      it.skip('should not set as default if other active methods exist', async () => {
        // Skipping: Testing Mongoose internals is fragile and not recommended
        // The actual middleware functionality is tested through integration tests
      });
    });
  });

  describe('Metadata Field', () => {
    it('should store metadata as Map', () => {
      mockPaymentMethod.metadata = new Map([
        ['source', 'mobile_app'],
        ['version', '2.0'],
        ['device', { type: 'ios', version: '14.5' }]
      ]);

      const error = mockPaymentMethod.validateSync();
      expect(error).toBeUndefined();
      expect(mockPaymentMethod.metadata.get('source')).toBe('mobile_app');
      expect(mockPaymentMethod.metadata.get('device')).toEqual({ type: 'ios', version: '14.5' });
    });
  });

  describe('JSON Transformation', () => {
    it('should include virtuals and exclude sensitive fields', () => {
      const json = mockPaymentMethod.toJSON();

      expect(json.__v).toBeUndefined();
      expect(json.paygistixId).toBeUndefined();
      expect(json.displayName).toBeDefined();
      expect(json.isExpired).toBeDefined();
      expect(json.id).toBeDefined();
    });
  });
});