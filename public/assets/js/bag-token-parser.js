// Bag-token extraction for the operator kiosk scanner.
// Accepts either the raw 32-hex Bag.token or the full claim URL printed
// in the bag QR (…?route=/claim&bag=<token>). Returns the lowercase
// token, or null when the scan is not a bag (spec §4.1 token canon).
// Dual-export: window global for the kiosk page, CommonJS for Jest.
(function (root) {
  'use strict';

  var TOKEN_RE = /^[a-f0-9]{32}$/;
  var URL_BAG_RE = /[?&]bag=([A-Fa-f0-9]{32})(?:[&#]|$)/;

  function extractBagToken(scanData) {
    if (!scanData || typeof scanData !== 'string') {
      return null;
    }
    var trimmed = scanData.trim();

    var lowered = trimmed.toLowerCase();
    if (TOKEN_RE.test(lowered)) {
      return lowered;
    }

    var match = trimmed.match(URL_BAG_RE);
    if (match) {
      return match[1].toLowerCase();
    }

    return null;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractBagToken: extractBagToken };
  }
  if (root) {
    root.BagTokenParser = { extractBagToken: extractBagToken };
  }
})(typeof window !== 'undefined' ? window : null);
