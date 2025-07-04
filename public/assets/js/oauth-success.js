// OAuth Success Handler
// This script handles OAuth callback success and closes the popup window

(function() {
    'use strict';
    
    // Get the message from URL parameters
    const params = new URLSearchParams(window.location.search);
    const messageStr = params.get('message');
    
    if (messageStr) {
        try {
            const message = JSON.parse(decodeURIComponent(messageStr));
            console.log('OAuth Success - Message:', message);
            
            // Try multiple approaches to communicate with parent
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage(message, '*');
            } else if (window.parent && window.parent !== window) {
                window.parent.postMessage(message, '*');
            } else {
                // Store in localStorage as fallback
                localStorage.setItem('socialAuthResult', JSON.stringify(message));
            }
            
            // Always try to close the window
            setTimeout(() => {
                try {
                    window.close();
                } catch (e) {
                    console.log('Could not close window:', e);
                    // Show message to user
                    const messageDiv = document.getElementById('message-container');
                    if (messageDiv) {
                        messageDiv.innerHTML = `
                            <div class="success-icon">✓</div>
                            <h3>Login Successful!</h3>
                            <p>You can close this window.</p>
                            <button class="close-btn" onclick="window.close()">Close Window</button>
                        `;
                        messageDiv.classList.add('show');
                    }
                }
            }, 500);
        } catch (e) {
            console.error('Error processing OAuth message:', e);
            const messageDiv = document.getElementById('message-container');
            if (messageDiv) {
                messageDiv.innerHTML = `
                    <div class="error-icon">✗</div>
                    <h3>Error</h3>
                    <p>There was an error processing your login. Please try again.</p>
                `;
                messageDiv.classList.add('show', 'error');
            }
        }
    } else {
        console.error('No message found in URL');
        const messageDiv = document.getElementById('message-container');
        if (messageDiv) {
            messageDiv.innerHTML = `
                <div class="error-icon">✗</div>
                <h3>Error</h3>
                <p>No login data received. Please try again.</p>
            `;
            messageDiv.classList.add('show', 'error');
        }
    }
    
    // Add event listener for close button
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('close-btn')) {
            try {
                window.close();
            } catch (error) {
                console.error('Cannot close window:', error);
            }
        }
    });
})();