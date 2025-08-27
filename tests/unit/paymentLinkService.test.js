const paymentLinkService = require('../../server/services/paymentLinkService');
const SystemConfig = require('../../server/models/SystemConfig');

describe('PaymentLinkService', () => {
  beforeAll(async () => {
    // Initialize SystemConfig with test values
    // Use existing connection from setup.js
    await SystemConfig.deleteMany({ key: { $in: ['venmo_handle', 'paypal_handle', 'cashapp_handle'] } });
    await SystemConfig.create([
      { key: 'venmo_handle', value: '@testvenmo', dataType: 'string', category: 'payment' },
      { key: 'paypal_handle', value: 'testpaypal', dataType: 'string', category: 'payment' },
      { key: 'cashapp_handle', value: '$testcash', dataType: 'string', category: 'payment' }
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    await SystemConfig.deleteMany({ key: { $in: ['venmo_handle', 'paypal_handle', 'cashapp_handle'] } });
  });

  beforeEach(() => {
    // Reset initialization state
    paymentLinkService.initialized = false;
  });

  describe('generatePaymentLinks', () => {
    it('should generate payment links for all providers', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const amount = 45.67;
      const customerName = 'John Doe';

      const result = await paymentLinkService.generatePaymentLinks(
        orderId,
        amount,
        customerName
      );

      expect(result).toHaveProperty('links');
      expect(result).toHaveProperty('qrCodes');
      expect(result).toHaveProperty('shortOrderId');
      expect(result).toHaveProperty('note');
      expect(result).toHaveProperty('amount');

      // Check short order ID
      expect(result.shortOrderId).toBe('99439011');
      expect(result.note).toBe('WaveMAX Order #99439011');
      expect(result.amount).toBe('45.67');

      // Check Venmo link
      expect(result.links.venmo).toContain('venmo://paycharge');
      expect(result.links.venmo).toContain('recipients=testvenmo');
      expect(result.links.venmo).toContain('amount=45.67');
      expect(result.links.venmo).toContain('note=WaveMAX%20Order%20%2399439011');

      // Check PayPal link
      expect(result.links.paypal).toContain('https://paypal.me/testpaypal/45.67USD');
      expect(result.links.paypal).toContain('notes=WaveMAX%20Order%20%2399439011');

      // Check CashApp link
      expect(result.links.cashapp).toContain('https://cash.app/$testcash/45.67');
      expect(result.links.cashapp).toContain('note=WaveMAX%20Order%20%2399439011');

      // Check QR codes were generated
      expect(result.qrCodes.venmo).toMatch(/^data:image\/png;base64,/);
      expect(result.qrCodes.paypal).toMatch(/^data:image\/png;base64,/);
      expect(result.qrCodes.cashapp).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle decimal amounts correctly', async () => {
      const orderId = 'test123';
      const amount = 100.5;
      const customerName = 'Jane Doe';

      const result = await paymentLinkService.generatePaymentLinks(
        orderId,
        amount,
        customerName
      );

      expect(result.amount).toBe('100.50');
      expect(result.links.venmo).toContain('amount=100.50');
      expect(result.links.paypal).toContain('/100.50USD');
      expect(result.links.cashapp).toContain('/100.50');
    });

    it('should handle short order IDs', async () => {
      const orderId = 'abc123';
      const amount = 25;
      const customerName = 'Test User';

      const result = await paymentLinkService.generatePaymentLinks(
        orderId,
        amount,
        customerName
      );

      expect(result.shortOrderId).toBe('ABC123');
      expect(result.note).toBe('WaveMAX Order #ABC123');
    });
  });

  describe('generateVenmoLink', () => {
    it('should generate correct Venmo deep link', async () => {
      await paymentLinkService.initialize();
      const link = paymentLinkService.generateVenmoLink('50.00', 'Test Order #123');

      expect(link).toBe('venmo://paycharge?txn=pay&recipients=testvenmo&amount=50.00&note=Test%20Order%20%23123');
    });

    it('should handle @ symbol in handle', async () => {
      paymentLinkService.handles.venmo = '@venmouser';
      const link = paymentLinkService.generateVenmoLink('25.50', 'Order');

      expect(link).not.toContain('@');
      expect(link).toContain('recipients=venmouser');
    });
  });

  describe('generatePayPalLink', () => {
    it('should generate correct PayPal.me link', async () => {
      await paymentLinkService.initialize();
      const link = paymentLinkService.generatePayPalLink('75.25', 'Test Payment');

      expect(link).toBe('https://paypal.me/testpaypal/75.25USD?notes=Test%20Payment');
    });
  });

  describe('generateCashAppLink', () => {
    it('should generate correct CashApp link', async () => {
      await paymentLinkService.initialize();
      const link = paymentLinkService.generateCashAppLink('30.00', 'Order #456');

      expect(link).toBe('https://cash.app/$testcash/30.00?note=Order%20%23456');
    });

    it('should add $ symbol if missing', async () => {
      paymentLinkService.handles.cashapp = 'cashuser';
      const link = paymentLinkService.generateCashAppLink('15.00', 'Test');

      expect(link).toContain('https://cash.app/$cashuser');
    });
  });

  describe('translations', () => {
    it('should provide translations for all supported languages', () => {
      const languages = ['en', 'es', 'pt', 'de'];
      
      languages.forEach(lang => {
        const translations = paymentLinkService.getPaymentTranslations(lang);
        
        expect(translations).toHaveProperty('totalDue');
        expect(translations).toHaveProperty('payWithVenmo');
        expect(translations).toHaveProperty('payWithPayPal');
        expect(translations).toHaveProperty('payWithCashApp');
        expect(translations).toHaveProperty('important');
        expect(translations).toHaveProperty('includeOrderNumber');
        expect(translations).toHaveProperty('orScanToPay');
        expect(translations).toHaveProperty('paymentNote');
      });
    });

    it('should default to English for unsupported languages', () => {
      const translations = paymentLinkService.getPaymentTranslations('fr');
      const englishTranslations = paymentLinkService.getPaymentTranslations('en');
      
      expect(translations).toEqual(englishTranslations);
    });

    it('should generate Spanish payment buttons HTML', async () => {
      const links = {
        venmo: 'venmo://test',
        paypal: 'https://paypal.me/test',
        cashapp: 'https://cash.app/test'
      };
      
      const html = paymentLinkService.generatePaymentButtonsHTML(links, '50.00', 'es');
      
      expect(html).toContain('Total a Pagar: $50.00');
      expect(html).toContain('Pagar con Venmo');
      expect(html).toContain('Pagar con PayPal');
      expect(html).toContain('Pagar con CashApp');
      expect(html).toContain('Importante');
      expect(html).toContain('Por favor incluya el número de orden en la nota de pago');
    });

    it('should generate Portuguese QR codes HTML', async () => {
      const qrCodes = {
        venmo: 'data:image/png;base64,test1',
        paypal: 'data:image/png;base64,test2',
        cashapp: 'data:image/png;base64,test3'
      };
      
      const html = paymentLinkService.generateQRCodesHTML(qrCodes, 'Order #123', 'pt');
      
      expect(html).toContain('Ou Escaneie para Pagar');
      expect(html).toContain('Nota de Pagamento: Order #123');
    });

    it('should generate German payment buttons HTML', async () => {
      const links = {
        venmo: 'venmo://test',
        paypal: 'https://paypal.me/test',
        cashapp: 'https://cash.app/test'
      };
      
      const html = paymentLinkService.generatePaymentButtonsHTML(links, '75.50', 'de');
      
      expect(html).toContain('Gesamtbetrag: $75.50');
      expect(html).toContain('Mit Venmo bezahlen');
      expect(html).toContain('Mit PayPal bezahlen');
      expect(html).toContain('Mit CashApp bezahlen');
      expect(html).toContain('Wichtig');
      expect(html).toContain('Bitte geben Sie die Bestellnummer in der Zahlungsnotiz an');
    });
  });

  describe('HTML generation', () => {
    it('should generate valid payment buttons HTML', async () => {
      const links = {
        venmo: 'venmo://paycharge?txn=pay',
        paypal: 'https://paypal.me/test/50USD',
        cashapp: 'https://cash.app/$test/50'
      };

      const html = paymentLinkService.generatePaymentButtonsHTML(links, '50.00');

      // Check structure
      expect(html).toContain('<div style="text-align: center');
      expect(html).toContain('Total Due: $50.00');
      
      // Check buttons
      expect(html).toContain('href="venmo://paycharge?txn=pay"');
      expect(html).toContain('href="https://paypal.me/test/50USD"');
      expect(html).toContain('href="https://cash.app/$test/50"');
      
      // Check styling
      expect(html).toContain('background-color: #3D95CE'); // Venmo
      expect(html).toContain('background-color: #0070BA'); // PayPal
      expect(html).toContain('background-color: #00D632'); // CashApp
    });

    it('should generate valid QR codes HTML', async () => {
      const qrCodes = {
        venmo: 'data:image/png;base64,abc123',
        paypal: 'data:image/png;base64,def456',
        cashapp: 'data:image/png;base64,ghi789'
      };

      const html = paymentLinkService.generateQRCodesHTML(qrCodes, 'Order #TEST123');

      // Check structure
      expect(html).toContain('<div style="text-align: center');
      expect(html).toContain('Or Scan to Pay');
      expect(html).toContain('Payment Note: Order #TEST123');
      
      // Check images
      expect(html).toContain('src="data:image/png;base64,abc123"');
      expect(html).toContain('src="data:image/png;base64,def456"');
      expect(html).toContain('src="data:image/png;base64,ghi789"');
      
      // Check provider labels
      expect(html).toContain('Venmo');
      expect(html).toContain('PayPal');
      expect(html).toContain('CashApp');
    });
  });
});