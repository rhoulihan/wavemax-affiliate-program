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

// Send order ready for pickup notification to affiliate
exports.sendOrderReadyNotification = async (affiliateEmail, data) => {
  const subject = `Order ${data.orderId} Ready for Pickup`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2ecc71; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Order Ready for Pickup!</h2>
      </div>
      
      <div style="padding: 20px; background-color: #f8f9fa;">
        <p>Hello ${data.affiliateName},</p>
        
        <p>Great news! The following order has been processed and is ready for pickup:</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Order Details</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Customer:</strong> ${data.customerName}</p>
          <p><strong>Number of Bags:</strong> ${data.numberOfBags}</p>
          <p><strong>Total Weight:</strong> ${data.totalWeight} lbs</p>
        </div>
        
        <div style="background-color: #e8f8f5; border-left: 4px solid #2ecc71; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Please pick up this order at your earliest convenience.</strong></p>
        </div>
        
        <p>Thank you for your prompt service!</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px; text-align: center;">
          This is an automated notification from WaveMAX Laundry Services.<br>
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  `;

  return sendEmail(affiliateEmail, subject, html);
};

// Send order picked up notification to customer
exports.sendOrderPickedUpNotification = async (customerEmail, data) => {
  const subject = `Your Fresh Laundry is On Its Way - Order ${data.orderId}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #3498db; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Your Fresh Laundry is On Its Way! 🚚</h2>
      </div>
      
      <div style="padding: 20px; background-color: #f8f9fa;">
        <p>Hello ${data.customerName},</p>
        
        <p><strong>Great news!</strong> Your freshly cleaned laundry has been picked up from our facility and is now on its way to you.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Delivery Details</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Number of Bags:</strong> ${data.numberOfBags}</p>
          ${data.totalWeight ? `<p><strong>Total Weight:</strong> ${data.totalWeight} lbs</p>` : ''}
          <p><strong>Delivery Provider:</strong> ${data.affiliateName}</p>
          ${data.businessName ? `<p><strong>Business:</strong> ${data.businessName}</p>` : ''}
        </div>
        
        <div style="background-color: #e8f5ff; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>${data.affiliateName}</strong> is on the way with your freshly cleaned laundry! Please be available to receive your order.</p>
        </div>
        
        <p>Thank you for choosing WaveMAX Laundry Services!</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px; text-align: center;">
          This is an automated notification from WaveMAX Laundry Services.<br>
          If you have any questions, please contact your laundry service provider.
        </p>
      </div>
    </div>
  `;

  return sendEmail(customerEmail, subject, html);
};

module.exports = exports;
