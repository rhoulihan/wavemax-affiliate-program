// Bag labels — auto-open the print dialog on load (convenience for the admin
// print-labels flow). External script under script-src 'self' (no nonce
// needed). The labels page stays readable on screen if the dialog is dismissed.
(function () {
  'use strict';
  function openPrint() {
    // Defer one frame so the QR/logo data-URI images are laid out before print.
    window.requestAnimationFrame(function () {
      window.print();
    });
  }
  if (document.readyState === 'complete') {
    openPrint();
  } else {
    window.addEventListener('load', openPrint);
  }
})();
