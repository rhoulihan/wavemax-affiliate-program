#!/usr/bin/env node

/**
 * Script to send a test Venmo payment email
 */

require('dotenv').config();
const mongoose = require('mongoose');
const emailService = require('../server/utils/emailService');

async function sendTestVenmoEmail() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Test order details
    const testOrderId = 'ORD-' + require('uuid').v4();
    const senderName = 'Joe User';
    const amount = 5.00;
    const recipientEmail = 'payments@wavemax.promo';
    
    // Format date like the real Venmo email: "Sat, Aug 30, 2025 at 4:38 PM"
    const date = new Date();
    const dateOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    };
    const timeOptions = { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    };
    const dateStr = date.toLocaleDateString('en-US', dateOptions);
    const timeStr = date.toLocaleTimeString('en-US', timeOptions);
    const venmoDate = `${dateStr} at ${timeStr}`;
    
    // Generate a random Venmo transaction ID (19 digits like in real email)
    const transactionId = '44' + Math.floor(Math.random() * 10000000000000000).toString().padStart(17, '0');
    
    // Format amount in Venmo's actual format with spaces between digits and decimal
    const dollars = Math.floor(amount);
    const cents = Math.round((amount - dollars) * 100);
    const centsStr = cents.toString().padStart(2, '0');
    
    // Generate sender email
    const senderEmail = 'joeuser@gmail.com';
    
    const subject = `Fwd: ${senderName} paid you $${amount.toFixed(2)}`;
    
    const html = `
        <div><br></div><div><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>From: <strong class="gmail_sendername" dir="auto">Venmo</strong> <span dir="auto">&lt;<a href="mailto:venmo@venmo.com">venmo@venmo.com</a>&gt;</span><br>Date: ${venmoDate}<br>Subject: ${senderName} paid you $${amount.toFixed(2)}<br>To:  &lt;<a href="mailto:${senderEmail}">${senderEmail}</a>&gt;<br></div><br><br>
        
        <div style="margin:0;box-sizing:border-box;color:#2f3033;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:1.375;margin:0;min-width:100%;padding:0;text-align:center;width:100%!important">
            <span style="color:#f1f2f4;display:none!important;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${senderName} paid you $${amount.toFixed(2)}</span>
            
            <table role="presentation" style="margin:0;background:#fff;background-color:#fff;border-collapse:collapse;border-spacing:0;box-sizing:border-box;width:100%">
                <tbody>
                    <tr>
                        <td align="center" valign="top">
                            <div style="text-align:center;padding:20px;">
                                <h2>${senderName} paid you $${amount.toFixed(2)}</h2>
                                <img src="https://venmo.com/logo" alt="Venmo logo" style="width:100px;margin:10px;">
                            </div>
                            
                            <div style="text-align:center;padding:20px;">
                                <img src="https://venmo.com/user" alt="${senderName} image" style="width:60px;border-radius:50%;">
                                <div style="margin:20px 0;">
                                    <strong>${senderName} paid you</strong><br>
                                    <span style="font-size:24px;font-weight:bold;">
                                        $<br>${dollars}<br>.<br>${centsStr}
                                    </span>
                                </div>
                                <div style="padding:10px;background:#f5f5f5;margin:10px auto;max-width:300px;">
                                    WaveMAX Order ${testOrderId}
                                </div>
                            </div>
                            
                            <div style="text-align:center;padding:20px;">
                                <a href="https://venmo.com/story/${transactionId}" style="background:#3D95CE;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">See transaction</a>
                                <p style="color:#666;font-size:14px;">Money credited to your Venmo account.</p>
                            </div>
                            
                            <div style="background:#f5f5f5;padding:15px;margin:20px 0;">
                                <h4>Transaction details</h4>
                                <p><strong>Date</strong><br>${dateStr}</p>
                                <p><strong>Transaction ID</strong><br>${transactionId}</p>
                                <p><strong>Sent to</strong><br>@wavemaxATX</p>
                            </div>
                            
                            <div style="text-align:center;padding:20px;color:#999;font-size:12px;">
                                <img src="https://venmo.com/logo" alt="Venmo logo" style="width:60px;margin:10px;">
                                <p>For any issues, including the recipient not receiving funds, please contact us at Help Center at help.venmo.com or call 1-855-812-4430.</p>
                                <p>Venmo is a service of PayPal, Inc., a licensed provider of money transfer services.</p>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        </div></div>
    `;
    
    // Also create text version
    const text = `---------- Forwarded message ---------
From: Venmo <venmo@venmo.com>
Date: ${venmoDate}
Subject: ${senderName} paid you $${amount.toFixed(2)}
To: <${senderEmail}>


${senderName} paid you $${amount.toFixed(2)}
[image: Venmo logo]

[image: ${senderName} image]

${senderName} paid you
$
${dollars}
.
${centsStr}

WaveMAX Order ${testOrderId}

See transaction
https://venmo.com/story/${transactionId}
Money credited to your Venmo account.
Transaction details
Date

${dateStr}
Transaction ID

${transactionId}
Sent to

@wavemaxATX
[image: Venmo logo]

For any issues, including the recipient not receiving funds, please contact
us at Help Center at help.venmo.com or call 1-855-812-4430.

Venmo is a service of PayPal, Inc., a licensed provider of money transfer
services.`;
    
    console.log('\n=== TEST EMAIL PREVIEW ===\n');
    console.log('To:', recipientEmail);
    console.log('Subject:', subject);
    console.log('From: Primary Account Holder <primary@wavemax.promo>');
    console.log('\n--- TEXT VERSION ---');
    console.log(text.substring(0, 800) + '...');
    console.log('\n--- HTML VERSION (first 1000 chars) ---');
    console.log(html.substring(0, 1000) + '...');
    console.log('\n=== END PREVIEW ===\n');
    
    // Send the email
    console.log('Sending test email...');
    await emailService.sendEmail(recipientEmail, subject, html);
    
    console.log(`\n✅ Test Venmo payment email sent successfully!`);
    console.log(`   Order ID: ${testOrderId}`);
    console.log(`   Sender: ${senderName}`);
    console.log(`   Amount: $${amount.toFixed(2)}`);
    console.log(`   To: ${recipientEmail}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error sending test email:', error);
    process.exit(1);
  }
}

sendTestVenmoEmail();