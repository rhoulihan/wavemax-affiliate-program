// Bag-token extraction for the operator kiosk scanner.
// Accepts either the raw 32-hex Bag.token or the full claim URL printed
// in the bag QR (…?route=/claim&bag=<token>). Returns the lowercase
// token, or null when the scan is not a bag (spec §4.1 token canon).
//
// Robustness: hardware keyboard-wedge scanners frequently mangle a URL QR —
// uppercasing it and/or garbling punctuation (?/&=:) on non-US keyboard
// layouts — while the hex token (a-f, 0-9) always survives. So everything is
// matched case-insensitively, and a final fallback recovers a lone 32-hex run
// from anywhere in the scan. The run must be bounded by non-hex (or the ends)
// so an ambiguous 33+ contiguous-hex string still returns null.
// Dual-export: window global for the kiosk page, CommonJS for Jest.
(function (root) {
  'use strict';

  var TOKEN_RE = /^[a-f0-9]{32}$/;
  var URL_BAG_RE = /[?&]bag=([a-f0-9]{32})(?:[&#]|$)/;
  var LOOSE_HEX_RE = /(?:^|[^a-f0-9])([a-f0-9]{32})(?:[^a-f0-9]|$)/;

  function extractBagToken(scanData) {
    if (!scanData || typeof scanData !== 'string') {
      return null;
    }
    // Lowercase first so the DB token-hash (computed over the lowercase hex)
    // matches even when the scanner uppercases everything.
    var lowered = scanData.trim().toLowerCase();

    if (TOKEN_RE.test(lowered)) {
      return lowered;
    }

    var match = lowered.match(URL_BAG_RE);
    if (match) {
      return match[1];
    }

    // Fallback: a single bounded 32-hex run anywhere — survives scanners that
    // mangle the URL's punctuation/case but preserve the hex token.
    var loose = lowered.match(LOOSE_HEX_RE);
    if (loose) {
      return loose[1];
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
