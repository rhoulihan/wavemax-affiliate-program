// Payment Callback Handler JavaScript
// Handles payment callbacks from Paygistix payment forms

console.log('Payment callback handler loaded');
console.log('Current URL:', window.location.href);
console.log('Window.opener exists:', !!window.opener);

// Immediately notify parent window that callback is starting
if (window.opener && !window.opener.closed) {
    try {
        window.opener.postMessage({ type: 'paygistix-callback-starting' }, '*');
        console.log('Notified parent window that callback is starting');
    } catch (e) {
        console.error('Could not notify parent:', e);
    }
}

// Get query parameters
const urlParams = new URLSearchParams(window.location.search);

// Handle Paygistix parameters
const result = urlParams.get('Result');
const pnRef = urlParams.get('PNRef');
const orderId = urlParams.get('OrderID');
const amount = urlParams.get('Amount');
const authCode = urlParams.get('AuthCode');
let custom1 = urlParams.get('custom1'); // This should contain the payment token

// Check if payment token is in the URL (added to ReturnURL)
if (!custom1) {
    custom1 = urlParams.get('paymentToken');
    console.log('Retrieved payment token from URL parameter:', custom1);
}

// Map Paygistix parameters to expected values
const status = result === '0' ? 'approved' : 'declined';
const transactionId = pnRef;
const type = 'registration'; // Default to registration for now
const responseMessage = urlParams.get('ResponseMsg') || (result !== '0' ? 'Payment declined' : 'Payment approved');

// Process payment callback
async function processPaymentCallback() {
    const statusDiv = document.getElementById('status-message');
    
    // Log the callback parameters for debugging
    console.log('Payment callback received:', {
        result,
        status,
        transactionId,
        orderId,
        amount,
        authCode,
        custom1
    });
    
    // Prepare callback data for parent window
    const callbackData = {
        type: 'paygistix-payment-callback',
        result: result,
        status: status,
        transactionId: transactionId || pnRef,
        PNRef: pnRef,
        orderId: orderId,
        amount: amount,
        authCode: authCode,
        paymentToken: custom1,
        success: result === '0'
    };
    
    // Debug logging
    console.log('Checking window.opener:', {
        hasOpener: !!window.opener,
        openerClosed: window.opener ? window.opener.closed : 'no opener',
        currentWindow: window.location.href
    });
    
    // If we have window.opener, send the message and close
    if (window.opener && !window.opener.closed) {
        console.log('Sending payment result to parent window:', callbackData);
        
        try {
            window.opener.postMessage(callbackData, '*');
            console.log('PostMessage sent successfully');
        } catch (error) {
            console.error('Error sending postMessage:', error);
        }
        
        // Show appropriate message based on payment result
        if (result === '0') {
            statusDiv.innerHTML = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                        <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-green-800 mb-2">Payment Successful!</h3>
                    <p class="text-green-600 mb-4">Your payment has been processed successfully.</p>
                    <p class="text-sm text-green-500">This window will close in a few seconds...</p>
                </div>
            `;
        } else {
            statusDiv.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                        <svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-red-800 mb-2">Payment Failed</h3>
                    <p class="text-red-600 mb-4">${responseMessage || 'Your payment could not be processed.'}</p>
                    <p class="text-sm text-red-500">This window will close in a few seconds...</p>
                </div>
            `;
        }
        statusDiv.classList.remove('hidden');
        
        // Hide the entire spinner container
        const spinnerContainer = document.querySelector('.mb-6');
        if (spinnerContainer) {
            spinnerContainer.style.display = 'none';
        }
        
        console.log('Payment callback processed, closing window in 3 seconds...');
        
        // Close the window after giving user time to see the message
        setTimeout(() => {
            console.log('Attempting to close payment window...');
            try {
                window.close();
                console.log('Window.close() called successfully');
            } catch (e) {
                console.error('Error closing window:', e);
            }
            
            // Check if window is still open after attempting to close
            setTimeout(() => {
                if (!window.closed) {
                    console.log('Window did not close, may need user interaction');
                    // Update message to inform user
                    const messageDiv = statusDiv.querySelector('p.text-sm');
                    if (messageDiv) {
                        messageDiv.textContent = 'You can now close this window.';
                    }
                }
            }, 100);
        }, 3000);
        
        return;
    }
    
    // Fallback: If no opener, try the original approach
    console.log('No window.opener available, using fallback approach');
    
    // If we have a payment token (custom1), verify the payment status server-side
    if (custom1) {
        try {
            const response = await fetch(`/api/v1/payments/check-status/${custom1}`);
            const data = await response.json();
            
            if (data.success && (data.status === 'success' || data.status === 'completed')) {
                // Payment was successful, redirect to success page with transaction ID
                const params = new URLSearchParams({
                    PNRef: transactionId || pnRef,
                    transactionId: transactionId || pnRef
                });
                window.location.href = `/registration-success.html?${params.toString()}`;
                return;
            }
        } catch (error) {
            console.error('Error checking payment status:', error);
        }
    }
    
    // If Result=0 from Paygistix, payment was successful
    if (result === '0' && status === 'approved') {
        // Show success in the current window since no opener
        statusDiv.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                    <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-bold text-green-800 mb-2">Payment Successful!</h3>
                <p class="text-green-600 mb-4">Your payment has been processed successfully.</p>
                <p class="text-sm text-green-500">Redirecting to success page...</p>
            </div>
        `;
        statusDiv.classList.remove('hidden');
        
        // Hide the spinner
        const spinnerContainer = document.querySelector('.mb-6');
        if (spinnerContainer) {
            spinnerContainer.style.display = 'none';
        }
        
        // Redirect to payment success page
        const params = new URLSearchParams({
            PNRef: transactionId,
            transactionId: transactionId
        });
        window.location.href = `/payment-success.html?${params.toString()}`;
        return;
    }
    
    // For any payment type without window.opener, redirect to appropriate page
    if (status === 'approved' || status === 'success') {
        const params = new URLSearchParams({
            PNRef: transactionId,
            transactionId: transactionId,
            orderId: urlParams.get('orderId') || urlParams.get('OrderID')
        });
        window.location.href = `/payment-success.html?${params.toString()}`;
    } else {
        const params = new URLSearchParams({
            message: responseMessage || 'Payment was declined',
            ResponseMsg: responseMessage
        });
        window.location.href = `/payment-error.html?${params.toString()}`;
    }
}

// Process callback when page loads
document.addEventListener('DOMContentLoaded', () => {
    processPaymentCallback();
});

// Also run immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already loaded
    processPaymentCallback();
}