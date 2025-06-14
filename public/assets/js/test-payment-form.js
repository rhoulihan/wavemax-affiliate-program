// Test Payment Form JavaScript
(function() {
    'use strict';
    
    // Add error handler to catch any issues
    window.addEventListener('error', function(event) {
        console.error('Test payment form error:', event.error);
    });
    
    console.log('Test payment form loaded');
    
    // Generate random payment data
    window.generateRandomData = function() {
        // Generate random card last 4
        const last4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        document.getElementById('cardNumber').value = '************' + last4;
        
        // Generate random expiration (future date)
        const month = Math.floor(Math.random() * 12) + 1;
        const year = new Date().getFullYear() + Math.floor(Math.random() * 5) + 1;
        const expDate = month.toString().padStart(2, '0') + year.toString().slice(-2);
        document.getElementById('expDate').value = expDate;
        
        // Generate random auth code
        const authCode = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    };
    
    // Generate callback URL
    window.generateCallbackUrl = function() {
        const cardNumber = document.getElementById('cardNumber').value;
        const last4 = cardNumber.slice(-4);
        const cardType = document.getElementById('cardType').value;
        const expDate = document.getElementById('expDate').value;
        const amount = document.getElementById('amount').value;
        const callbackUrl = document.getElementById('callbackUrl').value;
        const paymentToken = document.getElementById('paymentToken').value;
        const result = document.getElementById('result').value;
        
        // Generate realistic values
        const merchantId = 'wmaxaustWEB';
        const orderId = 'WMAX' + Date.now();
        const pnRef = Math.floor(Math.random() * 100000000).toString();
        const authCode = result === '0' ? Math.floor(Math.random() * 1000000).toString().padStart(6, '0') : '';
        const txnType = 'SALE';
        
        // Generate hash (in production this would be calculated by Paygistix)
        const hash = btoa(orderId + pnRef + amount).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
        
        // Build query parameters
        const params = new URLSearchParams({
            hash: hash,
            MerchantID: merchantId,
            OrderID: orderId,
            Amount: amount,
            PNRef: pnRef,
            Result: result,
            TxnType: txnType,
            Last4: last4,
            ExpDate: expDate,
            CardType: cardType
        });
        
        // Add auth code if successful
        if (result === '0' && authCode) {
            params.append('AuthCode', authCode);
        }
        
        // Don't add payment token to URL - the handler will find it by callback path
        
        // Use the full URL including https://wavemax.promo
        const baseUrl = 'https://wavemax.promo';
        return `${baseUrl}${callbackUrl}?${params.toString()}`;
    };
    
    // Simulate payment
    window.simulatePayment = async function() {
        const url = generateCallbackUrl();
        document.getElementById('generatedUrl').classList.remove('hidden');
        document.getElementById('urlDisplay').textContent = url;
        
        // Get payment token
        const paymentToken = document.getElementById('paymentToken').value;
        const result = document.getElementById('result').value;
        
        // Check if this is a customer registration test
        const customerDataStr = sessionStorage.getItem('testPaymentCustomerData');
        if (customerDataStr && paymentToken) {
            // Update payment status via API
            try {
                const status = result === '0' ? 'success' : 'failed';
                const response = await fetch(`/api/v1/payments/update-status/${paymentToken}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: status,
                        result: result,
                        message: result === '0' ? 'Test payment successful' : 'Test payment failed'
                    })
                });
                
                if (response.ok) {
                    console.log(`Payment token ${paymentToken} updated to ${status}`);
                    
                    // For successful payment, close window after brief delay
                    if (result === '0') {
                        setTimeout(() => {
                            if (confirm('Payment successful! Close this window?')) {
                                window.close();
                            }
                        }, 1000);
                    } else {
                        // For failed payment, show error and close
                        setTimeout(() => {
                            alert('Payment failed. Please try again.');
                            window.close();
                        }, 1000);
                    }
                } else {
                    console.error('Failed to update payment status');
                    alert('Error updating payment status. Please try again.');
                }
            } catch (error) {
                console.error('Error updating payment status:', error);
                alert('Error processing payment. Please try again.');
            }
        } else {
            // Regular test payment - redirect to callback URL
            setTimeout(() => {
                if (confirm('Redirect to callback URL?')) {
                    window.location.href = url;
                }
            }, 1000);
        }
    };
    
    // Simulate in new window
    window.simulateInNewWindow = function() {
        const url = generateCallbackUrl();
        document.getElementById('generatedUrl').classList.remove('hidden');
        document.getElementById('urlDisplay').textContent = url;
        
        // Check if this is a customer registration test
        const customerDataStr = sessionStorage.getItem('testPaymentCustomerData');
        if (customerDataStr) {
            // For registration test, show a simple success/failure dialog
            const result = document.getElementById('result').value;
            const width = 400;
            const height = 300;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            
            const testWindow = window.open('', 'PaymentSimulator', `width=${width},height=${height},left=${left},top=${top}`);
            testWindow.document.write(`
                <html>
                <head>
                    <title>Test Payment Result</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                        .success { color: green; }
                        .failure { color: red; }
                        button { padding: 10px 20px; margin: 10px; cursor: pointer; }
                    </style>
                </head>
                <body>
                    <h2>Test Payment Result</h2>
                    ${result === '0' 
                        ? '<p class="success">✅ Payment Successful!</p><button onclick="window.opener.completeRegistration(); window.close();">Complete Registration</button>' 
                        : '<p class="failure">❌ Payment Failed</p><button onclick="window.close();">Close</button>'
                    }
                </body>
                </html>
            `);
            
            // Add function to handle registration completion
            window.completeRegistration = async function() {
                // Update payment status first
                const paymentToken = document.getElementById('paymentToken').value;
                if (paymentToken) {
                    try {
                        await fetch(`/api/v1/payments/update-status/${paymentToken}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                status: 'success',
                                result: '0',
                                message: 'Test payment successful'
                            })
                        });
                        console.log('Payment status updated to success');
                    } catch (error) {
                        console.error('Error updating payment status:', error);
                    }
                }
                
                // Close the test window
                testWindow.close();
            };
        } else {
            // Regular test - open callback URL in new window
            const width = 800;
            const height = 600;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            window.open(url, 'PaymentSimulator', `width=${width},height=${height},left=${left},top=${top}`);
        }
    };
    
    // Copy URL to clipboard
    window.copyUrl = function() {
        const url = document.getElementById('urlDisplay').textContent;
        navigator.clipboard.writeText(url).then(() => {
            alert('URL copied to clipboard!');
        });
    };
    
    // Initialize page
    function initializePage() {
        // Check if test form is enabled by checking if we can access this page
        fetch('/api/v1/environment').then(response => response.json()).then(data => {
            // Just log the environment for debugging
            console.log('Environment:', data);
        }).catch(err => {
            console.error('Could not check environment:', err);
        });
        
        // Check if we have customer data from registration form
        const customerDataStr = sessionStorage.getItem('testPaymentCustomerData');
        if (customerDataStr) {
            try {
                const customerData = JSON.parse(customerDataStr);
                console.log('Customer registration data:', customerData);
                
                // Update the UI to show customer info
                const infoDiv = document.createElement('div');
                infoDiv.className = 'section-card bg-green-50 border-2 border-green-200';
                infoDiv.innerHTML = `
                    <h3 class="text-lg font-semibold text-green-800 mb-2">💳 Customer Registration Test Payment</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div><span class="font-medium text-gray-600">Customer:</span> ${customerData.firstName} ${customerData.lastName}</div>
                        <div><span class="font-medium text-gray-600">Email:</span> ${customerData.email}</div>
                        <div><span class="font-medium text-gray-600">Bags:</span> ${customerData.numberOfBags}</div>
                        <div><span class="font-medium text-gray-600">Affiliate:</span> ${customerData.affiliateId}</div>
                    </div>
                `;
                document.querySelector('.max-w-5xl').insertBefore(infoDiv, document.querySelector('.section-card:nth-child(2)'));
                
                // Set amount based on number of bags
                const bagFee = 10.00;
                const totalAmount = parseInt(customerData.numberOfBags) * bagFee;
                document.getElementById('amount').value = totalAmount.toFixed(2);
                
                // Get payment token from URL or session
                const urlParams = new URLSearchParams(window.location.search);
                const tokenFromUrl = urlParams.get('token');
                const tokenFromSession = sessionStorage.getItem('testPaymentToken');
                const paymentToken = tokenFromUrl || tokenFromSession || ('TEST_' + Date.now() + '_' + Math.random().toString(36).substring(2));
                
                document.getElementById('paymentToken').value = paymentToken;
                
                // Store the customer data with the payment token for completion
                sessionStorage.setItem('pendingRegistration', JSON.stringify({
                    token: paymentToken,
                    amount: totalAmount * 100, // Convert to cents
                    timestamp: Date.now(),
                    customerData: customerData,
                    numberOfBags: parseInt(customerData.numberOfBags)
                }));
                
                // Check if we have a callback URL from the payment token creation
                const callbackUrl = sessionStorage.getItem('testPaymentCallbackUrl');
                if (callbackUrl) {
                    // Display the assigned callback URL
                    document.getElementById('callbackUrlDisplay').classList.remove('hidden');
                    document.getElementById('assignedCallbackUrl').textContent = callbackUrl;
                    document.getElementById('callbackUrlSelect').style.display = 'none';
                    
                    // Use this callback URL for the simulation
                    document.getElementById('callbackUrl').value = callbackUrl;
                }
                
            } catch (error) {
                console.error('Error parsing customer data:', error);
            }
        }
        
        // For non-registration test payments, check for callback URL from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const callbackUrlParam = urlParams.get('callbackUrl');
        if (callbackUrlParam && !customerDataStr) {
            document.getElementById('callbackUrlDisplay').classList.remove('hidden');
            document.getElementById('assignedCallbackUrl').textContent = callbackUrlParam;
            document.getElementById('callbackUrlSelect').style.display = 'none';
            document.getElementById('callbackUrl').value = callbackUrlParam;
        }
        
        // Add event listeners to buttons
        // Find buttons by their position/text content since we removed onclick attributes
        const buttons = document.querySelectorAll('.button-primary, .button-success, .button-secondary');
        
        // Simulate Callback button (first button-primary)
        const simulateButton = document.querySelector('.button-primary');
        if (simulateButton && simulateButton.textContent.includes('Simulate Callback')) {
            simulateButton.addEventListener('click', simulatePayment);
        }
        
        // New Window button (button-success)
        const newWindowButton = document.querySelector('.button-success');
        if (newWindowButton && newWindowButton.textContent.includes('New Window')) {
            newWindowButton.addEventListener('click', simulateInNewWindow);
        }
        
        // Random Data button (first button-secondary in actions section)
        const randomButton = document.querySelector('.section-card .button-secondary');
        if (randomButton && randomButton.textContent.includes('Random Data')) {
            randomButton.addEventListener('click', generateRandomData);
        }
        
        // Copy URL button (button-secondary in generated URL section)
        const copyButton = document.querySelector('#generatedUrl .button-secondary');
        if (copyButton && copyButton.textContent.includes('Copy URL')) {
            copyButton.addEventListener('click', copyUrl);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePage);
    } else {
        initializePage();
    }
})();