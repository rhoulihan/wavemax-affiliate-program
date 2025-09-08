// Payment Redirect Script - Auto-submits the payment form
document.addEventListener('DOMContentLoaded', function() {
  // Check for either production form or test form
  const form = document.getElementById('paygistixForm') || document.getElementById('testPaymentForm');
  if (form) {
    // Submit the form after a brief delay to ensure everything is loaded
    setTimeout(function() {
      form.submit();
    }, 100);
  }
});