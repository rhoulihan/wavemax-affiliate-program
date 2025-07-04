// Test Operator Scan JavaScript
let testCustomer = null;
let testOrder = null;

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

        // Get or create test order
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
    document.getElementById('customerQR').textContent = testCustomer.customerId || testCustomer._id;

    // Update card
    document.getElementById('cardName').textContent = `${testCustomer.firstName} ${testCustomer.lastName}`;
    document.getElementById('cardId').textContent = `ID: ${testCustomer.customerId || testCustomer._id}`;

    // Generate QR code with customer ID (not the old qrCode field)
    await generateQRCode(testCustomer.customerId || testCustomer._id);
}

async function generateQRCode(data) {
    const qrcodeDiv = document.getElementById('qrcode');
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
        showStatus('Creating test order...', 'info');
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add CSRF token if available
        if (window.csrfUtils && window.csrfUtils.getToken) {
            headers['X-CSRF-Token'] = window.csrfUtils.getToken();
        }

        const response = await fetch('/api/v1/test/order', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                customerId: testCustomer?._id,
                recreate: true // This will delete existing test orders first
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create test order');
        }

        testOrder = await response.json();
        showStatus(`Test order created successfully! Order ID: ${testOrder._id}`, 'success');
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

async function printCustomerCard() {
    if (!testCustomer) {
        showStatus('No customer data available', 'warning');
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
    
    // Set margins and positions
    const margin = 0.375;
    const pageWidth = 4;
    const pageHeight = 6;
    const contentWidth = pageWidth - (margin * 2);
    
    // Add WaveMAX Laundry logo/title
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(74, 144, 226); // #4A90E2
    pdf.text('WaveMAX Laundry', margin, margin + 0.3);
    
    // Add customer name
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${testCustomer.firstName} ${testCustomer.lastName}`, margin, margin + 0.7);
    
    // Add customer address
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    const addressLines = [
        testCustomer.address,
        testCustomer.phone,
        testCustomer.email || ''
    ].filter(line => line);
    
    let yPosition = margin + 1;
    addressLines.forEach(line => {
        pdf.text(line, margin, yPosition);
        yPosition += 0.2;
    });
    
    // Generate QR code data - just the customer ID for operator scanning
    const qrData = testCustomer.customerId || testCustomer._id;
    
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
        
        // Add QR code to PDF (bottom right)
        const qrSize = 1.25;
        const qrX = pageWidth - margin - qrSize;
        const qrY = pageHeight - margin - qrSize;
        pdf.addImage(qrImageUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (err) {
        console.error('QR Code generation failed:', err);
    }
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `customer-card-${testCustomer.customerId || testCustomer._id}-${timestamp}.pdf`;
    
    // Save the PDF and open in new window for printing
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Open PDF in new window
    const printWindow = window.open(pdfUrl, '_blank');
    
    // Clean up the URL after a short delay
    setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
    }, 100);
    
    console.log(`Generated PDF customer card`);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize CSRF token
    if (window.csrfUtils && window.csrfUtils.initialize) {
        await window.csrfUtils.initialize();
    }
    
    // Set up button event handlers
    document.getElementById('recreateOrderBtn').addEventListener('click', recreateTestOrder);
    document.getElementById('printCardBtn').addEventListener('click', printCustomerCard);
    
    // Load initial data
    loadTestData();
});