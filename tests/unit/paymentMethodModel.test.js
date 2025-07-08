// Unit tests for PaymentMethod model methods
const PaymentMethod = require('../../server/models/PaymentMethod');
const mongoose = require('mongoose');

describe('PaymentMethod Model Methods', () => {
  beforeEach(async () => {
    await PaymentMethod.deleteMany({});
  });

  describe('Virtual Properties', () => {
    it('should calculate displayName for card payment method', () => {
      const paymentMethod = new PaymentMethod({
        customerId: new mongoose.Types.ObjectId(),
        paygistixId: 'pg_test123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
          fingerprint: 'fp_test123'
        },
      });

      expect(paymentMethod.displayName).toBe('VISA •••• 4242');

      // Test with different brands
      paymentMethod.card.brand = 'mastercard';
      expect(paymentMethod.displayName).toBe('MASTERCARD •••• 4242');

      paymentMethod.card.brand = 'amex';
      paymentMethod.card.last4 = '0005';
      expect(paymentMethod.displayName).toBe('AMEX •••• 0005');
    });

    it('should calculate displayName for bank account payment method', () => {
      const paymentMethod = new PaymentMethod({
        customerId: new mongoose.Types.ObjectId(),
        paygistixId: 'pg_test456',
        type: 'bank_account',
        bankAccount: {
          bankName: 'Chase Bank',
          last4: '6789',
          accountType: 'checking',
          fingerprint: 'fp_test456'
        },
      });

      expect(paymentMethod.displayName).toBe('Chase Bank •••• 6789');

      // Test with different bank
      paymentMethod.bankAccount.bankName = 'Bank of America';
      paymentMethod.bankAccount.last4 = '1234';
      expect(paymentMethod.displayName).toBe('Bank of America •••• 1234');
    });

    it('should return unknown for unsupported payment type', () => {
      const paymentMethod = new PaymentMethod({
        customerId: new mongoose.Types.ObjectId(),
        paygistixId: 'pg_test789',
        type: 'wallet',
        walletType: 'apple_pay',
      });

      // Wallet type should show formatted name
      expect(paymentMethod.displayName).toBe('Apple Pay');

      // Test with different wallet type
      paymentMethod.walletType = 'google_pay';
      expect(paymentMethod.displayName).toBe('Google Pay');
    });

    it('should check if card is expired', () => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const paymentMethod = new PaymentMethod({
        customerId: new mongoose.Types.ObjectId(),
        paygistixId: 'pg_test999',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          expiryMonth: currentMonth - 1,
          expiryYear: currentYear,
          fingerprint: 'fp_test999'
        },
      });

      // Card expired last month
      expect(paymentMethod.isExpired).toBe(true);

      // Card expires this month (not expired yet)
      paymentMethod.card.expiryMonth = currentMonth;
      expect(paymentMethod.isExpired).toBe(false);

      // Card expires next year
      paymentMethod.card.expiryYear = currentYear + 1;
      expect(paymentMethod.isExpired).toBe(false);

      // Bank account never expires
      const bankPaymentMethod = new PaymentMethod({
        customerId: new mongoose.Types.ObjectId(),
        paygistixId: 'pg_test888',
        type: 'bank_account',
        bankAccount: {
          bankName: 'Chase',
          last4: '1234',
          accountType: 'checking',
          fingerprint: 'fp_test888'
        },
      });
      expect(bankPaymentMethod.isExpired).toBe(false);
    });
  });

  describe('Static Methods', () => {
    it.skip('should find default payment method for customer', async () => {
      const customerId = new mongoose.Types.ObjectId();

      // Create multiple payment methods
      await PaymentMethod.create([
        {
          customerId,
          paygistixId: 'pg_static1',
          type: 'card',
          card: { brand: 'visa', last4: '1111', expiryMonth: 12, expiryYear: 2025, fingerprint: 'fp1' },
          isDefault: false,
          isActive: true
        },
        {
          customerId,
          paygistixId: 'pg_static2',
          type: 'card',
          card: { brand: 'visa', last4: '2222', expiryMonth: 12, expiryYear: 2025, fingerprint: 'fp2' },
          isDefault: true,
          isActive: true
        },
        {
          customerId,
          paygistixId: 'pg_static3',
          type: 'card',
          card: { brand: 'visa', last4: '3333', expiryMonth: 12, expiryYear: 2025, fingerprint: 'fp3' },
          isDefault: false,
          isActive: false
        }
      ]);

      const defaultMethod = await PaymentMethod.findDefault(customerId);
      expect(defaultMethod).toBeDefined();
      expect(defaultMethod.card.last4).toBe('2222');
      expect(defaultMethod.isDefault).toBe(true);
      expect(defaultMethod.isActive).toBe(true);
    });

    it('should find active payment methods for customer', async () => {
      const customerId = new mongoose.Types.ObjectId();

      // Create mixed active/inactive payment methods
      await PaymentMethod.create([
        {
          customerId,
          paygistixId: 'pg_active1',
          type: 'card',
          card: { brand: 'visa', last4: '1111', expiryMonth: 12, expiryYear: 2025, fingerprint: 'fp_a1' },
          isActive: true
        },
        {
          customerId,
          paygistixId: 'pg_active2',
          type: 'card',
          card: { brand: 'visa', last4: '2222', expiryMonth: 12, expiryYear: 2025, fingerprint: 'fp_a2' },
          isActive: false
        },
        {
          customerId,
          paygistixId: 'pg_active3',
          type: 'bank_account',
          bankAccount: { bankName: 'Chase', last4: '3333', accountType: 'checking', fingerprint: 'fp_a3' },
          isActive: true
        }
      ]);

      const activeMethods = await PaymentMethod.findActiveByCustomer(customerId);
      expect(activeMethods).toHaveLength(2);
      expect(activeMethods.every(m => m.isActive)).toBe(true);
      expect(activeMethods.map(m => m.paygistixId).sort()).toEqual(['pg_active1', 'pg_active3']);
    });
  });
});