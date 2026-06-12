// Operational email dispatchers — service alerts + ready/picked-up notifications.
// Extracted from utils/emailService.js in Phase 2.

const { loadTemplate, fillTemplate, formatTimeSlot, formatSize } = require('../template-manager');
const { sendEmail } = require('../transport');
/**
 * Send service down alert email
 */
exports.sendServiceDownAlert = async function({ serviceName, error, timestamp, serviceData }) {
  const mailOptions = {
    from: `"WaveMAX Monitoring" <${process.env.EMAIL_FROM || 'no-reply@wavemax.promo'}>`,
    to: process.env.ALERT_EMAIL || process.env.DEFAULT_ADMIN_EMAIL || 'admin@wavemax.promo',
    subject: `⚠️ CRITICAL: ${serviceName} Service Down - ${new Date().toISOString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Service Down Alert</h2>
        </div>
        <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 0 0 8px 8px; padding: 20px;">
          <h3 style="color: #dc3545;">Critical Service Failure Detected</h3>
          
          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Service:</strong> ${serviceName}</p>
            <p style="margin: 5px 0 0;"><strong>Status:</strong> DOWN</p>
            <p style="margin: 5px 0 0;"><strong>Error:</strong> ${error || 'Connection timeout'}</p>
            <p style="margin: 5px 0 0;"><strong>Time:</strong> ${timestamp.toLocaleString()}</p>
          </div>
          
          <h4>Service Statistics:</h4>
          <ul style="list-style: none; padding: 0;">
            <li>• <strong>Last Success:</strong> ${serviceData.lastSuccess ? new Date(serviceData.lastSuccess).toLocaleString() : 'Never'}</li>
            <li>• <strong>Total Checks:</strong> ${serviceData.totalChecks}</li>
            <li>• <strong>Failed Checks:</strong> ${serviceData.failedChecks}</li>
            <li>• <strong>Availability:</strong> ${((serviceData.uptime / serviceData.totalChecks) * 100).toFixed(2)}%</li>
          </ul>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Action Required:</strong></p>
            <p style="margin: 5px 0 0;">This critical service requires immediate attention. Please investigate and resolve the issue as soon as possible.</p>
          </div>
          
          <p style="margin-top: 20px;">
            <a href="https://wavemax.promo/monitoring-dashboard.html" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Monitoring Dashboard</a>
          </p>
        </div>
      </div>
    `,
    text: `
CRITICAL SERVICE DOWN ALERT

Service: ${serviceName}
Status: DOWN
Error: ${error || 'Connection timeout'}
Time: ${timestamp.toLocaleString()}

Service Statistics:
- Last Success: ${serviceData.lastSuccess ? new Date(serviceData.lastSuccess).toLocaleString() : 'Never'}
- Total Checks: ${serviceData.totalChecks}
- Failed Checks: ${serviceData.failedChecks}
- Availability: ${((serviceData.uptime / serviceData.totalChecks) * 100).toFixed(2)}%

ACTION REQUIRED: This critical service requires immediate attention.

View monitoring dashboard: https://wavemax.promo/monitoring-dashboard.html
    `
  };

  // Use the internal sendEmail function
  return sendEmail(mailOptions.to, mailOptions.subject, mailOptions.html);
};

// Send order ready notification to affiliate (Notification A — the ready gate's
// "collect from store" email; spec §6.5/§6.6). Language-resolved via
// template-manager; data.language is the affiliate's languagePreference.
exports.sendOrderReadyNotification = async (affiliateEmail, data) => {
  const language = data.language || 'en';
  const subjects = {
    en: `Order ${data.orderId} Ready for Pickup`,
    es: `Pedido ${data.orderId} listo para recoger`,
    pt: `Pedido ${data.orderId} pronto para retirada`,
    de: `Bestellung ${data.orderId} abholbereit`
  };
  const template = await loadTemplate('order-ready', language);
  const html = fillTemplate(template, {
    AFFILIATE_NAME: data.affiliateName,
    ORDER_ID: data.orderId,
    CUSTOMER_NAME: data.customerName,
    TOTAL_WEIGHT: data.totalWeight
  });
  return sendEmail(affiliateEmail, subjects[language] || subjects.en, html);
};

// ---------------------------------------------------------------------------
// PR 9 — overloaded-bag-URL lifecycle emails
// Templates use the [PLACEHOLDER] token convention (template-manager
// fillTemplate). loadTemplate resolves templates/emails/{lang}/<name>.html
// with the root file as the English fallback.
// ---------------------------------------------------------------------------

const ON_THE_WAY_SUBJECTS = {
  en: (orderId) => `Your laundry is on the way — Order ${orderId}`,
  es: (orderId) => `Tu ropa está en camino — Pedido ${orderId}`,
  pt: (orderId) => `Sua roupa está a caminho — Pedido ${orderId}`,
  de: (orderId) => `Ihre Wäsche ist unterwegs — Bestellung ${orderId}`
};

/**
 * "On the way" — sent at operator scan-OUT (ready_for_pickup -> picked_up).
 * Includes the customer's (freshly rotated) delivery PIN so they can confirm
 * receipt at the door (spec §6.4/§6.6).
 */
exports.sendOrderOnTheWayEmail = async (customer, order, { deliveryPin, affiliateName } = {}) => {
  const language = customer.languagePreference || 'en';
  const template = await loadTemplate('customer-on-the-way', language);
  const html = fillTemplate(template, {
    customer_name: `${customer.firstName} ${customer.lastName}`,
    order_id: order.orderId,
    affiliate_name: affiliateName || 'Your delivery provider',
    delivery_pin: deliveryPin || '',
    total_weight: order.actualWeight != null ? String(order.actualWeight) : ''
  });
  const subjectFor = ON_THE_WAY_SUBJECTS[language] || ON_THE_WAY_SUBJECTS.en;
  return sendEmail(customer.email, subjectFor(order.orderId), html);
};

module.exports = exports;
