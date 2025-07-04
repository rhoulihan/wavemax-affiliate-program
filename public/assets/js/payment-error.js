        // Get parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('orderId');
        const message = urlParams.get('message') || 'Payment processing failed';
        const responseCode = urlParams.get('responseCode');
        
        // Display error message
        function displayError() {
            let errorHtml = message;
            
            if (responseCode) {
                errorHtml += `<br><small style="color: #9ca3af;">Error Code: ${responseCode}</small>`;
            }
            
            document.getElementById('errorMessage').innerHTML = errorHtml;
        }
        
        // Set up button links
        if (orderId) {
            document.getElementById('retryBtn').href = `/paygistix-payment-embed.html?orderId=${orderId}`;
            document.getElementById('backBtn').href = `/order-details?orderId=${orderId}`;
        } else {
            document.getElementById('retryBtn').href = '/schedule-pickup';
            document.getElementById('backBtn').href = '/customer-dashboard';
        }
        
        // Set up support link
        document.getElementById('supportLink').href = 'mailto:support@wavemaxlaundry.com?subject=Payment Failed - Order ' + (orderId || 'Unknown');
        
        // Display error on page load
        document.addEventListener('DOMContentLoaded', function() {
            displayError();
            
            // Notify parent window if embedded
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'paymentError',
                    orderId: orderId,
                    message: message,
                    responseCode: responseCode
                }, '*');
            }
        });
