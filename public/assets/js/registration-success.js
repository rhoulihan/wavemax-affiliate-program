// Registration Success Page JavaScript

// Debug logging
console.log('Registration success page loaded');
console.log('Current URL:', window.location.href);
console.log('URL search params:', window.location.search);

// Get transaction ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
console.log('All URL parameters:');
for (const [key, value] of urlParams) {
    console.log(`  ${key}: ${value}`);
}

const transactionId = urlParams.get('PNRef') || urlParams.get('transactionId') || urlParams.get('token') || '-';
console.log('Transaction ID found:', transactionId);
document.getElementById('transactionId').textContent = transactionId;

// Countdown timer
let countdown = 30;
const countdownElement = document.getElementById('countdown');
const countdownInterval = setInterval(() => {
    countdown--;
    countdownElement.textContent = countdown;
    if (countdown <= 0) {
        clearInterval(countdownInterval);
        window.close();
    }
}, 1000);

// Handle OK button click
document.getElementById('okButton').addEventListener('click', function() {
    // Clear the countdown
    clearInterval(countdownInterval);
    
    // Try to close the window
    window.close();
    
    // If window doesn't close (might be blocked), update UI
    setTimeout(() => {
        if (!window.closed) {
            document.getElementById('okButton').textContent = 'You can now close this window';
            document.getElementById('okButton').disabled = true;
            document.getElementById('okButton').classList.add('opacity-50', 'cursor-not-allowed');
            document.getElementById('okButton').classList.remove('hover:bg-green-700', 'hover:shadow-lg', 'transform', 'hover:-translate-y-0.5');
            
            // Hide countdown
            const countdownText = document.querySelector('.text-xs.text-gray-500.mt-4');
            if (countdownText) {
                countdownText.style.display = 'none';
            }
        }
    }, 100);
});