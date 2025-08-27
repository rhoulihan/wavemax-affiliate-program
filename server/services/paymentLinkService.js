/**
 * Payment Link Generation Service
 * Generates payment links and QR codes for Venmo, PayPal, and CashApp
 */

const QRCode = require('qrcode');
const SystemConfig = require('../models/SystemConfig');

class PaymentLinkService {
  constructor() {
    this.handles = {
      venmo: null,
      paypal: null,
      cashapp: null
    };
    this.initialized = false;
  }

  /**
   * Initialize payment handles from SystemConfig
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.handles.venmo = await SystemConfig.getValue('venmo_handle', '@wavemax');
      this.handles.paypal = await SystemConfig.getValue('paypal_handle', 'wavemax');
      this.handles.cashapp = await SystemConfig.getValue('cashapp_handle', '$wavemax');
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing payment handles:', error);
      throw new Error('Failed to initialize payment link service');
    }
  }

  /**
   * Generate payment links for all supported providers
   * @param {String} orderId - The order ID
   * @param {Number} amount - The payment amount
   * @param {String} customerName - Customer name for reference
   * @returns {Object} Links and QR codes for each provider
   */
  async generatePaymentLinks(orderId, amount, customerName) {
    await this.initialize();
    
    // Use last 8 characters of order ID for reference
    const shortOrderId = orderId.toString().slice(-8).toUpperCase();
    const note = `WaveMAX Order #${shortOrderId}`;
    
    // Format amount to 2 decimal places
    const formattedAmount = parseFloat(amount).toFixed(2);
    
    // Generate payment links
    const links = {
      venmo: this.generateVenmoLink(formattedAmount, note),
      paypal: this.generatePayPalLink(formattedAmount, note),
      cashapp: this.generateCashAppLink(formattedAmount, note)
    };
    
    // Generate QR codes
    const qrCodes = {};
    for (const [provider, link] of Object.entries(links)) {
      try {
        qrCodes[provider] = await this.generateQRCode(link);
      } catch (error) {
        console.error(`Error generating QR code for ${provider}:`, error);
        qrCodes[provider] = null;
      }
    }
    
    return { 
      links, 
      qrCodes,
      shortOrderId,
      note,
      amount: formattedAmount
    };
  }

  /**
   * Generate Venmo payment link
   */
  generateVenmoLink(amount, note) {
    // Remove @ symbol if present
    const handle = this.handles.venmo.replace('@', '');
    // Venmo deep link format
    return `venmo://paycharge?txn=pay&recipients=${handle}&amount=${amount}&note=${encodeURIComponent(note)}`;
  }

  /**
   * Generate PayPal payment link
   */
  generatePayPalLink(amount, note) {
    // PayPal.me format with USD currency
    return `https://paypal.me/${this.handles.paypal}/${amount}USD?notes=${encodeURIComponent(note)}`;
  }

  /**
   * Generate CashApp payment link
   */
  generateCashAppLink(amount, note) {
    // CashApp link format
    // Note: CashApp uses cashtag with $ symbol
    const cashtag = this.handles.cashapp.startsWith('$') 
      ? this.handles.cashapp 
      : `$${this.handles.cashapp}`;
    return `https://cash.app/${cashtag}/${amount}?note=${encodeURIComponent(note)}`;
  }

  /**
   * Generate QR code for a payment link
   */
  async generateQRCode(link) {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(link, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      return qrCodeDataURL;
    } catch (error) {
      console.error('QR code generation error:', error);
      throw error;
    }
  }

  /**
   * Get translated payment text based on language
   */
  getPaymentTranslations(lang = 'en') {
    const translations = {
      en: {
        totalDue: 'Total Due',
        payWithVenmo: 'Pay with Venmo',
        payWithPayPal: 'Pay with PayPal',
        payWithCashApp: 'Pay with CashApp',
        important: 'Important',
        includeOrderNumber: 'Please include the order number in your payment note',
        orScanToPay: 'Or Scan to Pay',
        paymentNote: 'Payment Note'
      },
      es: {
        totalDue: 'Total a Pagar',
        payWithVenmo: 'Pagar con Venmo',
        payWithPayPal: 'Pagar con PayPal',
        payWithCashApp: 'Pagar con CashApp',
        important: 'Importante',
        includeOrderNumber: 'Por favor incluya el número de orden en la nota de pago',
        orScanToPay: 'O Escanee para Pagar',
        paymentNote: 'Nota de Pago'
      },
      pt: {
        totalDue: 'Total a Pagar',
        payWithVenmo: 'Pagar com Venmo',
        payWithPayPal: 'Pagar com PayPal',
        payWithCashApp: 'Pagar com CashApp',
        important: 'Importante',
        includeOrderNumber: 'Por favor, inclua o número do pedido na nota de pagamento',
        orScanToPay: 'Ou Escaneie para Pagar',
        paymentNote: 'Nota de Pagamento'
      },
      de: {
        totalDue: 'Gesamtbetrag',
        payWithVenmo: 'Mit Venmo bezahlen',
        payWithPayPal: 'Mit PayPal bezahlen',
        payWithCashApp: 'Mit CashApp bezahlen',
        important: 'Wichtig',
        includeOrderNumber: 'Bitte geben Sie die Bestellnummer in der Zahlungsnotiz an',
        orScanToPay: 'Oder zum Bezahlen scannen',
        paymentNote: 'Zahlungsnotiz'
      }
    };
    
    return translations[lang] || translations.en;
  }

  /**
   * Generate mobile-friendly payment buttons HTML
   * Used in email templates
   */
  generatePaymentButtonsHTML(links, amount, lang = 'en') {
    const t = this.getPaymentTranslations(lang);
    
    return `
      <div style="text-align: center; margin: 30px 0;">
        <p style="font-size: 24px; font-weight: bold; color: #333;">
          ${t.totalDue}: $${amount}
        </p>
        
        <div style="margin: 20px 0;">
          <!-- Venmo Button -->
          <a href="${links.venmo}" 
             style="display: inline-block; background-color: #3D95CE; color: white; 
                    padding: 15px 30px; text-decoration: none; border-radius: 5px; 
                    font-size: 16px; font-weight: bold; margin: 10px;">
            ${t.payWithVenmo}
          </a>
        </div>
        
        <div style="margin: 20px 0;">
          <!-- PayPal Button -->
          <a href="${links.paypal}" 
             style="display: inline-block; background-color: #0070BA; color: white; 
                    padding: 15px 30px; text-decoration: none; border-radius: 5px; 
                    font-size: 16px; font-weight: bold; margin: 10px;">
            ${t.payWithPayPal}
          </a>
        </div>
        
        <div style="margin: 20px 0;">
          <!-- CashApp Button -->
          <a href="${links.cashapp}" 
             style="display: inline-block; background-color: #00D632; color: white; 
                    padding: 15px 30px; text-decoration: none; border-radius: 5px; 
                    font-size: 16px; font-weight: bold; margin: 10px;">
            ${t.payWithCashApp}
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          <strong>${t.important}:</strong> ${t.includeOrderNumber}
        </p>
      </div>
    `;
  }

  /**
   * Generate QR code images for email embedding
   * Returns HTML with embedded base64 images
   */
  generateQRCodesHTML(qrCodes, note, lang = 'en') {
    const t = this.getPaymentTranslations(lang);
    
    let html = '<div style="text-align: center; margin: 30px 0;">';
    html += `<h3 style="color: #333;">${t.orScanToPay}:</h3>`;
    html += '<div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 20px;">';
    
    const providers = [
      { name: 'Venmo', color: '#3D95CE' },
      { name: 'PayPal', color: '#0070BA' },
      { name: 'CashApp', color: '#00D632' }
    ];
    
    for (const provider of providers) {
      const key = provider.name.toLowerCase();
      if (qrCodes[key]) {
        html += `
          <div style="text-align: center; margin: 10px;">
            <p style="font-weight: bold; color: ${provider.color}; margin-bottom: 10px;">
              ${provider.name}
            </p>
            <img src="${qrCodes[key]}" 
                 alt="${provider.name} QR Code" 
                 style="width: 200px; height: 200px; border: 2px solid #ddd; border-radius: 10px;">
          </div>
        `;
      }
    }
    
    html += '</div>';
    html += `<p style="color: #666; font-size: 12px; margin-top: 15px;">${t.paymentNote}: ${note}</p>`;
    html += '</div>';
    
    return html;
  }
}

// Export singleton instance
module.exports = new PaymentLinkService();