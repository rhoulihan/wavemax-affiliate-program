const { generateQRCode } = require('../../server/utils/qrCodeGenerator');

describe('QR Code Generator', () => {
  describe('generateQRCode', () => {
    it('should generate a customer QR code with timestamp when no ID provided', () => {
      const code = generateQRCode('customer');
      
      expect(code).toMatch(/^WAVEMAX:CUSTOMER:\d+:[a-f0-9]{16}$/);
      
      // Extract timestamp and verify it's recent
      const parts = code.split(':');
      const timestamp = parseInt(parts[2]);
      const now = Date.now();
      expect(timestamp).toBeGreaterThan(now - 1000); // Within last second
      expect(timestamp).toBeLessThanOrEqual(now);
    });

    it('should generate an order QR code with timestamp when no ID provided', () => {
      const code = generateQRCode('order');
      
      expect(code).toMatch(/^WAVEMAX:ORDER:\d+:[a-f0-9]{16}$/);
    });

    it('should generate a customer QR code with provided ID', () => {
      const customerId = 'CUST123';
      const code = generateQRCode('customer', customerId);
      
      expect(code).toMatch(/^WAVEMAX:CUSTOMER:CUST123:[a-f0-9]{16}$/);
    });

    it('should generate an order QR code with provided ID', () => {
      const orderId = 'ORD456';
      const code = generateQRCode('order', orderId);
      
      expect(code).toMatch(/^WAVEMAX:ORDER:ORD456:[a-f0-9]{16}$/);
    });

    it('should convert type to uppercase', () => {
      const code = generateQRCode('CUSTOMER');
      expect(code).toMatch(/^WAVEMAX:CUSTOMER:/);
      
      const code2 = generateQRCode('Customer');
      expect(code2).toMatch(/^WAVEMAX:CUSTOMER:/);
    });

    it('should use default type of customer when not specified', () => {
      const code = generateQRCode();
      expect(code).toMatch(/^WAVEMAX:CUSTOMER:/);
    });

    it('should generate unique codes on consecutive calls', () => {
      const codes = new Set();
      
      // Generate 100 codes to ensure uniqueness
      for (let i = 0; i < 100; i++) {
        codes.add(generateQRCode('customer'));
      }
      
      expect(codes.size).toBe(100);
    });

    it('should handle special characters in ID', () => {
      const specialId = 'CUST-123_456';
      const code = generateQRCode('customer', specialId);
      
      expect(code).toMatch(/^WAVEMAX:CUSTOMER:CUST-123_456:[a-f0-9]{16}$/);
    });

    it('should handle empty string ID as null', () => {
      const code = generateQRCode('customer', '');
      
      // Should use timestamp format when ID is empty string
      expect(code).toMatch(/^WAVEMAX:CUSTOMER:\d+:[a-f0-9]{16}$/);
    });

    it('should handle null ID parameter', () => {
      const code = generateQRCode('customer', null);
      
      // Should use timestamp format when ID is null
      expect(code).toMatch(/^WAVEMAX:CUSTOMER:\d+:[a-f0-9]{16}$/);
    });
  });
});