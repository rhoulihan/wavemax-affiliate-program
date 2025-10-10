// Test Operator Scan JavaScript
let testCustomer = null;
let testOrder = null;
let testBags = [];

// Generate UUID v4
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function loadTestData() {
    try {
        showStatus('Cleaning up old test data...', 'info');
        
        // First, clean up any existing test data
        await cleanupTestData();
        
        // Then create fresh test customer and affiliate
        await createTestCustomer();
        
        // Create default V2 order with 1 bag
        await createV2TestOrder(1);
    } catch (error) {
        console.error('Error loading test data:', error);
        showStatus('Error loading test data: ' + error.message, 'danger');
    }
}

async function cleanupTestData() {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add CSRF token if available
        if (window.CsrfUtils && window.CsrfUtils.getToken) {
            headers['X-CSRF-Token'] = window.CsrfUtils.getToken();
        }
        
        const response = await fetch('/api/v1/test/cleanup', {
            method: 'DELETE',
            headers: headers
        });
        
        if (!response.ok) {
            console.warn('Cleanup may have failed, continuing anyway');
        }
        
        console.log('Test data cleaned up');
    } catch (error) {
        console.warn('Error during cleanup (continuing):', error);
    }
}

async function createTestCustomer() {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add CSRF token if available
        if (window.CsrfUtils && window.CsrfUtils.getToken) {
            headers['X-CSRF-Token'] = window.CsrfUtils.getToken();
        }
        
        const response = await fetch('/api/v1/test/customer', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                firstName: 'Test',
                lastName: 'Customer',
                email: 'spam-me@wavemax.promo',  // Use spam-me email
                phone: '512-555-0100',
                address: {
                    street: '123 Test Street',
                    city: 'Austin',
                    state: 'TX',
                    zipCode: '78701'
                }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create test customer');
        }

        testCustomer = await response.json();
        await displayCustomerInfo();
    } catch (error) {
        console.error('Error creating test customer:', error);
        showStatus('Error creating test customer: ' + error.message, 'danger');
    }
}

async function displayCustomerInfo() {
    if (!testCustomer) return;

    document.getElementById('customerName').textContent = `${testCustomer.firstName} ${testCustomer.lastName}`;
    document.getElementById('customerEmail').textContent = testCustomer.email;
    document.getElementById('customerId').textContent = testCustomer.customerId || testCustomer._id;

    // Update order info
    if (testOrder) {
        document.getElementById('orderId').textContent = testOrder.orderId || testOrder._id;
        document.getElementById('bagCount').textContent = testBags.length;

        // Update stage display
        updateStageDisplay();
    }

    // Update bag cards
    for (let i = 0; i < testBags.length; i++) {
        const bagNum = i + 1;
        const bag = testBags[i];
        
        // Update card info
        const cardName = document.getElementById(`cardName${bagNum}`);
        const cardId = document.getElementById(`cardId${bagNum}`);
        const bagIdElement = document.getElementById(`bagId${bagNum}`);
        
        if (cardName) cardName.textContent = `${testCustomer.firstName} ${testCustomer.lastName}`;
        if (cardId) cardId.textContent = `Customer: ${testCustomer.customerId || testCustomer._id}`;
        if (bagIdElement) bagIdElement.textContent = `Bag ${bagNum} of ${testBags.length}`;
        
        // Generate QR code with format: CUST-{customerId}-{bagNumber}
        // This matches the admin dashboard format
        const qrData = `${testCustomer.customerId || testCustomer._id}-${bagNum}`;
        await generateQRCode(qrData, `qrcode${bagNum}`);
    }
}

async function generateQRCode(data, elementId = 'qrcode') {
    const qrcodeDiv = document.getElementById(elementId);
    if (!qrcodeDiv) return;
    
    qrcodeDiv.innerHTML = ''; // Clear existing QR code
    
    try {
        // Create canvas element
        const canvas = document.createElement('canvas');
        
        // Generate QR code on canvas
        await QRCode.toCanvas(canvas, data, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'H'
        });
        
        // Append canvas to div
        qrcodeDiv.appendChild(canvas);
    } catch (error) {
        console.error('Error generating QR code:', error);
        qrcodeDiv.innerHTML = '<p>Error generating QR code</p>';
    }
}

async function createV2TestOrder(numberOfBags = 1) {
    try {
        showStatus(`Creating V2 test order with ${numberOfBags} bag${numberOfBags > 1 ? 's' : ''}...`, 'info');
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add CSRF token if available
        if (window.CsrfUtils && window.CsrfUtils.getToken) {
            headers['X-CSRF-Token'] = window.CsrfUtils.getToken();
        }

        // Generate bag IDs based on number of bags
        testBags = [];
        for (let i = 0; i < numberOfBags; i++) {
            testBags.push({ bagId: generateUUID(), bagNumber: i + 1 });
        }

        const response = await fetch('/api/v1/test/order', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                customerId: testCustomer?._id,
                recreate: true, // This will delete existing test orders first
                numberOfBags: numberOfBags,
                orderType: 'v2', // Specify V2 order type
                isV2Order: true   // Mark as V2 order
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create V2 test order');
        }

        testOrder = await response.json();
        
        // Update tab visibility based on number of bags
        const bag2Tab = document.getElementById('bag2-tab');
        const bag2Pane = document.getElementById('bag2');
        if (numberOfBags === 1) {
            if (bag2Tab) bag2Tab.style.display = 'none';
            if (bag2Pane) bag2Pane.classList.remove('show', 'active');
            // Make sure bag1 is active
            const bag1Tab = document.getElementById('bag1-tab');
            const bag1Pane = document.getElementById('bag1');
            if (bag1Tab) bag1Tab.classList.add('active');
            if (bag1Pane) bag1Pane.classList.add('show', 'active');
        } else {
            if (bag2Tab) bag2Tab.style.display = 'block';
        }
        
        // Display the order and bag information
        await displayCustomerInfo();

        showStatus(`V2 test order created successfully! Order ID: ${testOrder.orderId || testOrder._id} with ${testBags.length} bag${testBags.length > 1 ? 's' : ''}`, 'success');

        // Enable the advance stage button for new orders
        const advanceBtn = document.getElementById('advanceOrderStageBtn');
        if (advanceBtn) {
            advanceBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error creating V2 test order:', error);
        showStatus('Error creating V2 test order: ' + error.message, 'danger');
    }
}

function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('orderStatus');
    statusDiv.className = `alert alert-${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('d-none');
}

function updateStageDisplay() {
    const currentStageEl = document.getElementById('currentStage');
    const nextStageEl = document.getElementById('nextStage');
    const advanceBtn = document.getElementById('advanceOrderStageBtn');

    if (!testOrder) {
        currentStageEl.textContent = 'No Order';
        currentStageEl.className = 'badge bg-secondary';
        nextStageEl.textContent = 'N/A';
        nextStageEl.className = 'badge bg-secondary';
        advanceBtn.disabled = true;
        return;
    }

    // Define stage progression
    const stageProgression = {
        'pending': { next: 'processing', action: 'Weigh Bags (Drop-off)' },
        'processing': { next: 'processed', action: 'Mark as Washed/Dried' },
        'processed': { next: 'complete', action: 'Customer Pickup' },
        'complete': { next: null, action: 'Order Complete' }
    };

    const currentStage = testOrder.status || 'pending';
    const stageInfo = stageProgression[currentStage];

    // Update current stage display
    currentStageEl.textContent = currentStage.charAt(0).toUpperCase() + currentStage.slice(1);
    currentStageEl.className = `badge bg-${
        currentStage === 'complete' ? 'success' :
        currentStage === 'processed' ? 'info' :
        currentStage === 'processing' ? 'warning' : 'secondary'
    }`;

    // Update next stage display
    if (stageInfo.next) {
        nextStageEl.textContent = stageInfo.action;
        nextStageEl.className = 'badge bg-primary';
        advanceBtn.disabled = false;
        advanceBtn.innerHTML = `<i class="fas fa-forward"></i> ${stageInfo.action} (Test Mode)`;
    } else {
        nextStageEl.textContent = 'Order Complete';
        nextStageEl.className = 'badge bg-success';
        advanceBtn.disabled = true;
        advanceBtn.innerHTML = '<i class="fas fa-check"></i> Order Complete';
    }
}

async function advanceOrderStage() {
    if (!testOrder) {
        showStatus('No order available to advance', 'warning');
        return;
    }

    const advanceBtn = document.getElementById('advanceOrderStageBtn');
    advanceBtn.disabled = true;

    try {
        // Define stage transitions
        const currentStage = testOrder.status || 'pending';
        let nextStage = '';
        let actionData = {};

        switch (currentStage) {
            case 'pending':
                // Simulate weighing bags (drop-off)
                nextStage = 'processing';
                actionData = {
                    action: 'weigh',
                    weights: testBags.map(() => 30), // Use 30 pounds as specified
                    actualWeight: testBags.length * 30
                };
                showStatus('Simulating bag weigh-in at drop-off (30 lbs per bag)...', 'info');
                break;

            case 'processing':
                // Simulate marking as processed (after washing/drying)
                nextStage = 'processed';
                actionData = {
                    action: 'process',
                    processedBags: testBags.map(b => b.bagId)
                };
                showStatus('Simulating bags marked as washed and dried...', 'info');
                break;

            case 'processed':
                // Simulate customer pickup
                nextStage = 'complete';
                actionData = {
                    action: 'pickup',
                    pickedUpBags: testBags.map(b => b.bagId)
                };
                showStatus('Simulating customer pickup...', 'info');
                break;

            case 'complete':
                showStatus('Order is already complete', 'success');
                advanceBtn.disabled = true;
                return;

            default:
                showStatus('Unknown order status', 'danger');
                advanceBtn.disabled = false;
                return;
        }

        // Prepare request headers
        const headers = {
            'Content-Type': 'application/json'
        };

        // Add CSRF token if available
        if (window.CsrfUtils && window.CsrfUtils.getToken) {
            headers['X-CSRF-Token'] = window.CsrfUtils.getToken();
        }

        // Send request to advance the order stage
        const response = await fetch('/api/v1/test/order/advance-stage', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                orderId: testOrder._id || testOrder.orderId,
                currentStage: currentStage,
                nextStage: nextStage,
                ...actionData
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Failed to advance order to ${nextStage}`);
        }

        const updatedOrder = await response.json();
        testOrder = updatedOrder;

        // Update displays
        await displayCustomerInfo();
        updateStageDisplay();

        // Check if we can enable Venmo payment button
        if (testOrder.actualWeight && testOrder.actualWeight > 0) {
            enableVenmoTestButton();
        }

        showStatus(`Order advanced to: ${nextStage.toUpperCase()}`, 'success');

    } catch (error) {
        console.error('Error advancing order stage:', error);
        showStatus('Error advancing order stage: ' + error.message, 'danger');
    } finally {
        // Re-enable button if not complete
        if (testOrder && testOrder.status !== 'complete') {
            advanceBtn.disabled = false;
        }
    }
}

async function printAllBagCards() {
    if (!testCustomer || testBags.length === 0) {
        showStatus('No customer or bag data available', 'warning');
        return;
    }

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF library not loaded');
        alert('PDF generation library not loaded. Please refresh the page and try again.');
        return;
    }
    
    // Create new PDF with 4x6 inch dimensions
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [4, 6]
    });
    
    let isFirstCard = true;
    
    // Generate a card for each bag
    for (let i = 0; i < testBags.length; i++) {
        const bag = testBags[i];
        
        // Add new page for each card except the first
        if (!isFirstCard) {
            pdf.addPage();
        }
        isFirstCard = false;
        
        // Set margins and positions
        const margin = 0.375;
        const pageWidth = 4;
        const pageHeight = 6;
        
        // Add WaveMAX Laundry logo/title
        pdf.setFontSize(18);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(74, 144, 226); // #4A90E2
        pdf.text('WaveMAX Laundry', margin, margin + 0.3);
        
        // Add bag number
        pdf.setFontSize(14);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Bag ${bag.bagNumber}`, margin, margin + 0.6);
        
        // Add customer name
        pdf.setFontSize(16);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${testCustomer.firstName} ${testCustomer.lastName}`, margin, margin + 1);
        
        // Add customer info
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'normal');
        const infoLines = [
            testCustomer.phone,
            testCustomer.email || '',
            `Customer ID: ${testCustomer.customerId || testCustomer._id}`,
            `Bag ${bag.bagNumber} of ${testBags.length}`
        ].filter(line => line);
        
        let yPosition = margin + 1.3;
        infoLines.forEach(line => {
            pdf.text(line, margin, yPosition);
            yPosition += 0.2;
        });
        
        // Generate QR code data with format: CUST-{customerId}-{bagNumber}
        // This matches the admin dashboard format
        const qrData = `${testCustomer.customerId || testCustomer._id}-${bag.bagNumber}`;
        
        // Create QR code
        try {
            const qrImageUrl = await QRCode.toDataURL(qrData, {
                width: 150,
                margin: 1,
                errorCorrectionLevel: 'M',
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            // Add QR code to PDF (bottom center)
            const qrSize = 1.5;
            const qrX = (pageWidth - qrSize) / 2;
            const qrY = pageHeight - margin - qrSize - 0.5;
            pdf.addImage(qrImageUrl, 'PNG', qrX, qrY, qrSize, qrSize);
            
            // Add QR data text below QR code
            pdf.setFontSize(8);
            pdf.text(qrData, pageWidth / 2, qrY + qrSize + 0.1, { align: 'center' });
        } catch (err) {
            console.error('QR Code generation failed:', err);
        }
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `bag-cards-${testCustomer.customerId || testCustomer._id}-${timestamp}.pdf`;
    
    // Save the PDF and open in new window for printing
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Open PDF in new window
    window.open(pdfUrl, '_blank');
    
    // Clean up the URL after a short delay
    setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
    }, 100);
    
    console.log(`Generated PDF with ${testBags.length} bag cards`);
}

// Venmo Payment Testing Functions
let venmoModal = null;
let orderMonitorInterval = null;
let currentOrderSnapshot = null;

function enableVenmoTestButton() {
    const btn = document.getElementById('testVenmoPaymentBtn');
    if (btn && testOrder) {
        // Check if order has been weighed (has actualWeight)
        if (testOrder.actualWeight && testOrder.actualWeight > 0) {
            btn.disabled = false;
            btn.title = 'Send test Venmo payment confirmation';
        } else {
            btn.disabled = true;
            btn.title = 'Weigh the bag first using the operator scan page';
        }
    }
}

async function checkOrderWeighed() {
    if (!testOrder) return;
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Get the CSRF token
        const csrfToken = window.CsrfUtils ? window.CsrfUtils.getToken() : null;
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
        
        const response = await fetch(`/api/v1/test/order/${testOrder._id || testOrder.orderId}`, {
            method: 'GET',
            headers: headers
        });
        
        if (response.ok) {
            const updatedOrder = await response.json();
            testOrder = updatedOrder;
            
            // Update order status display
            const statusText = `Status: ${testOrder.status}${testOrder.actualWeight ? ` | Weight: ${testOrder.actualWeight} lbs | Total: $${testOrder.actualTotal || '0.00'}` : ''}`;
            document.getElementById('orderStatus').textContent = statusText;
            
            // Enable Venmo button if order is weighed
            enableVenmoTestButton();
        }
    } catch (error) {
        console.error('Error checking order status:', error);
    }
}

async function openVenmoPaymentModal() {
    if (!testOrder) {
        showStatus('No test order available', 'warning');
        return;
    }
    
    // Refresh order data first
    await checkOrderWeighed();
    
    if (!testOrder.actualWeight || testOrder.actualWeight === 0) {
        showStatus('Please weigh the bag first using the operator scan page', 'warning');
        return;
    }
    
    // Update modal with order details
    document.getElementById('modalOrderId').textContent = testOrder.orderId || testOrder._id;
    document.getElementById('modalExpectedAmount').textContent = (testOrder.actualTotal || 0).toFixed(2);
    document.getElementById('modalOrderStatus').textContent = testOrder.status;
    document.getElementById('paymentAmount').value = (testOrder.actualTotal || 0).toFixed(2);
    
    // Reset modal state
    document.getElementById('paymentProgress').classList.add('d-none');
    document.getElementById('paymentResults').classList.add('d-none');
    document.getElementById('sendVenmoEmail').disabled = false;
    
    // Show modal
    venmoModal.show();
}

async function sendVenmoTestEmail() {
    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    const senderName = document.getElementById('senderName').value;
    const sendMultiple = document.getElementById('sendMultiplePayments').checked;
    
    if (!paymentAmount || paymentAmount <= 0) {
        alert('Please enter a valid payment amount');
        return;
    }
    
    if (!senderName) {
        alert('Please enter a sender name');
        return;
    }
    
    // Disable send button
    document.getElementById('sendVenmoEmail').disabled = true;
    
    // Show progress
    document.getElementById('paymentProgress').classList.remove('d-none');
    document.getElementById('paymentResults').classList.add('d-none');
    
    // Take snapshot of current order state
    currentOrderSnapshot = { ...testOrder };
    
    // Start monitoring order for changes
    startOrderMonitoring();
    
    try {
        // Ensure we have a fresh CSRF token
        if (window.CsrfUtils) {
            await window.CsrfUtils.ensureCsrfToken();
        }
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Get the CSRF token
        const csrfToken = window.CsrfUtils ? window.CsrfUtils.getToken() : null;
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        } else {
            console.warn('No CSRF token available');
        }
        
        // Create the forwarded Venmo email template
        const emailBody = createForwardedVenmoEmail(testOrder, paymentAmount, senderName);
        
        // Send the test email
        const response = await fetch('/api/v1/test/send-payment-email', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                to: 'payments@wavemax.promo',
                subject: `Fwd: You received $${paymentAmount.toFixed(2)} from ${senderName}`,
                html: emailBody,
                orderId: testOrder.orderId || testOrder._id
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send test email');
        }
        
        showStatus(`Test Venmo payment email sent for $${paymentAmount.toFixed(2)}`, 'success');
        
        // If multiple payments requested, send another after delay
        if (sendMultiple) {
            setTimeout(async () => {
                await sendDuplicatePayment(paymentAmount, senderName);
            }, 5000);
        }
        
    } catch (error) {
        console.error('Error sending Venmo test email:', error);
        showStatus('Error sending test email: ' + error.message, 'danger');
        stopOrderMonitoring();
        document.getElementById('sendVenmoEmail').disabled = false;
    }
}

function createForwardedVenmoEmail(order, amount, senderName) {
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
    // e.g., "$ 2 . 35" for $2.35
    const dollars = Math.floor(amount);
    const cents = Math.round((amount - dollars) * 100);
    const centsStr = cents.toString().padStart(2, '0');
    const venmoFormattedAmount = `$\n${dollars}\n.\n${centsStr}`;
    
    // Generate random sender email
    const senderEmail = senderName.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 100) + '@gmail.com';
    
    return `
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
                                    WaveMAX Order ${order.orderId || order._id}
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
}

async function sendDuplicatePayment(amount, senderName) {
    showStatus('Sending duplicate payment email...', 'info');
    
    try {
        // Ensure we have a fresh CSRF token
        if (window.CsrfUtils) {
            await window.CsrfUtils.ensureCsrfToken();
        }
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Get the CSRF token
        const csrfToken = window.CsrfUtils ? window.CsrfUtils.getToken() : null;
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        } else {
            console.warn('No CSRF token available');
        }
        
        const emailBody = createForwardedVenmoEmail(testOrder, amount, senderName);
        
        const response = await fetch('/api/v1/test/send-payment-email', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                to: 'payments@wavemax.promo',
                subject: `Fwd: You received $${amount.toFixed(2)} from ${senderName}`,
                html: emailBody,
                orderId: testOrder.orderId || testOrder._id
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send duplicate email');
        }
        
        showStatus(`Duplicate payment email sent for $${amount.toFixed(2)}`, 'warning');
        
    } catch (error) {
        console.error('Error sending duplicate payment:', error);
        showStatus('Error sending duplicate email: ' + error.message, 'danger');
    }
}

function startOrderMonitoring() {
    // Clear any existing interval
    stopOrderMonitoring();
    
    // Check order status every 2 seconds
    orderMonitorInterval = setInterval(async () => {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Get the CSRF token
            const csrfToken = window.CsrfUtils ? window.CsrfUtils.getToken() : null;
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }
            
            const response = await fetch(`/api/v1/test/order/${testOrder._id || testOrder.orderId}`, {
                method: 'GET',
                headers: headers
            });
            
            if (response.ok) {
                const updatedOrder = await response.json();
                
                // Check for changes in V2 payment status or regular payment status
                if (updatedOrder.v2PaymentStatus !== currentOrderSnapshot.v2PaymentStatus ||
                    updatedOrder.paymentStatus !== currentOrderSnapshot.paymentStatus ||
                    updatedOrder.status !== currentOrderSnapshot.status) {
                    
                    // Check if payment was actually detected (not just status change)
                    if ((updatedOrder.v2PaymentStatus === 'verified' && currentOrderSnapshot.v2PaymentStatus !== 'verified') ||
                        (updatedOrder.paymentStatus === 'completed' && currentOrderSnapshot.paymentStatus !== 'completed')) {
                        // Payment detected!
                        onPaymentDetected(updatedOrder);
                    }
                    
                    // Update snapshot
                    currentOrderSnapshot = updatedOrder;
                    testOrder = updatedOrder;
                }
            }
        } catch (error) {
            console.error('Error monitoring order:', error);
        }
    }, 2000);
}

function stopOrderMonitoring() {
    if (orderMonitorInterval) {
        clearInterval(orderMonitorInterval);
        orderMonitorInterval = null;
    }
}

function onPaymentDetected(updatedOrder) {
    // Hide progress, show results
    document.getElementById('paymentProgress').classList.add('d-none');
    document.getElementById('paymentResults').classList.remove('d-none');
    
    // Build result details
    let resultHtml = `
        <p><strong>V2 Payment Status:</strong> <span class="badge bg-success">${updatedOrder.v2PaymentStatus || 'N/A'}</span></p>
        <p><strong>V2 Payment Method:</strong> ${updatedOrder.v2PaymentMethod || 'N/A'}</p>
        <p><strong>Order Status:</strong> ${updatedOrder.status}</p>
    `;
    
    // Show V2 payment records if available
    if (updatedOrder.v2PaymentRecords && updatedOrder.v2PaymentRecords.length > 0) {
        resultHtml += '<p><strong>V2 Payments Detected:</strong></p><ul class="list-group">';
        updatedOrder.v2PaymentRecords.forEach(payment => {
            const statusBadge = payment.status === 'verified' ? 'success' : 
                               payment.status === 'overpaid' ? 'warning' : 
                               payment.status === 'underpaid' ? 'danger' : 'secondary';
            resultHtml += `
                <li class="list-group-item">
                    <div class="d-flex justify-content-between">
                        <span><strong>${payment.provider}</strong> - $${payment.amount}</span>
                        <span class="badge bg-${statusBadge}">${payment.status}</span>
                    </div>
                    <small class="text-muted">
                        From: ${payment.sender}<br>
                        Transaction: ${payment.transactionId}<br>
                        Verified: ${new Date(payment.verifiedAt).toLocaleString()}
                    </small>
                </li>`;
        });
        resultHtml += '</ul>';
    }
    
    // Also show legacy payments if any
    if (updatedOrder.payments && updatedOrder.payments.length > 0) {
        resultHtml += '<p class="mt-3"><strong>Legacy Payments:</strong></p><ul>';
        updatedOrder.payments.forEach(payment => {
            resultHtml += `<li>$${payment.amount} - ${payment.status} (${new Date(payment.createdAt).toLocaleTimeString()})</li>`;
        });
        resultHtml += '</ul>';
    }
    
    document.getElementById('paymentResultDetails').innerHTML = resultHtml;
    
    // Show notification with V2 status
    const v2Status = updatedOrder.v2PaymentStatus || updatedOrder.paymentStatus;
    showStatus(`Payment detected! V2 Status: ${v2Status}, Method: ${updatedOrder.v2PaymentMethod || 'N/A'}`, 'success');
    
    // Stop monitoring since payment was detected
    stopOrderMonitoring();
    
    // Re-enable send button for additional tests
    document.getElementById('sendVenmoEmail').disabled = false;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize CSRF token
    if (window.CsrfUtils) {
        await window.CsrfUtils.ensureCsrfToken();
    }
    
    // Initialize Bootstrap modal
    venmoModal = new bootstrap.Modal(document.getElementById('venmoPaymentModal'));
    
    // Set up button event handlers
    document.getElementById('createV2Order1BagBtn').addEventListener('click', () => createV2TestOrder(1));
    document.getElementById('createV2Order2BagsBtn').addEventListener('click', () => createV2TestOrder(2));
    document.getElementById('printAllCardsBtn').addEventListener('click', printAllBagCards);
    document.getElementById('testVenmoPaymentBtn').addEventListener('click', openVenmoPaymentModal);
    document.getElementById('sendVenmoEmail').addEventListener('click', sendVenmoTestEmail);
    document.getElementById('advanceOrderStageBtn').addEventListener('click', advanceOrderStage);
    
    // Set up periodic order status check
    setInterval(checkOrderWeighed, 5000);
    
    // Load initial data
    loadTestData();
});