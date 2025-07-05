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
        // Get test customer
        const customerRes = await fetch('/api/v1/test/customer');
        if (customerRes.ok) {
            testCustomer = await customerRes.json();
            await displayCustomerInfo();
        } else {
            // Create test customer if doesn't exist
            await createTestCustomer();
        }

        // Get or create test order with bags
        await recreateTestOrder();
    } catch (error) {
        console.error('Error loading test data:', error);
        showStatus('Error loading test data: ' + error.message, 'danger');
    }
}

async function createTestCustomer() {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add CSRF token if available
        if (window.csrfUtils && window.csrfUtils.getToken) {
            headers['X-CSRF-Token'] = window.csrfUtils.getToken();
        }
        
        const response = await fetch('/api/v1/test/customer', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                firstName: 'Test',
                lastName: 'Customer',
                email: 'test.customer@wavemax.test',
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
        if (bagIdElement) bagIdElement.textContent = `Bag ID: ${bag.bagId}`;
        
        // Generate QR code with new format: customerId#bagId
        const qrData = `${testCustomer.customerId || testCustomer._id}#${bag.bagId}`;
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

async function recreateTestOrder() {
    try {
        showStatus('Creating test order with 2 bags...', 'info');
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add CSRF token if available
        if (window.csrfUtils && window.csrfUtils.getToken) {
            headers['X-CSRF-Token'] = window.csrfUtils.getToken();
        }

        // Generate two bag IDs
        testBags = [
            { bagId: generateUUID(), bagNumber: 1 },
            { bagId: generateUUID(), bagNumber: 2 }
        ];

        const response = await fetch('/api/v1/test/order', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                customerId: testCustomer?._id,
                recreate: true, // This will delete existing test orders first
                numberOfBags: 2
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create test order');
        }

        testOrder = await response.json();
        
        // Display the order and bag information
        await displayCustomerInfo();
        
        showStatus(`Test order created successfully! Order ID: ${testOrder.orderId || testOrder._id} with ${testBags.length} bags`, 'success');
    } catch (error) {
        console.error('Error creating test order:', error);
        showStatus('Error creating test order: ' + error.message, 'danger');
    }
}

function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('orderStatus');
    statusDiv.className = `alert alert-${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('d-none');
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
            `Bag ID: ${bag.bagId}`
        ].filter(line => line);
        
        let yPosition = margin + 1.3;
        infoLines.forEach(line => {
            pdf.text(line, margin, yPosition);
            yPosition += 0.2;
        });
        
        // Generate QR code data with new format
        const qrData = `${testCustomer.customerId || testCustomer._id}#${bag.bagId}`;
        
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

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize CSRF token
    if (window.csrfUtils && window.csrfUtils.initialize) {
        await window.csrfUtils.initialize();
    }
    
    // Set up button event handlers
    document.getElementById('recreateOrderBtn').addEventListener('click', recreateTestOrder);
    document.getElementById('printAllCardsBtn').addEventListener('click', printAllBagCards);
    
    // Load initial data
    loadTestData();
});