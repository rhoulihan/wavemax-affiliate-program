// Payment Redirect Script - Auto-submits the payment form
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('paygistixForm');
  if (form) {
    // Submit the form after a brief delay to ensure everything is loaded
    setTimeout(function() {
      form.submit();
    }, 100);
  }
});