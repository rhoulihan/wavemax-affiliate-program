// Accepts a raw 32-hex bag token OR the full printed claim URL
// (https://.../embed-app-v2.html?route=/claim&bag=<token>) and returns the
// normalized token, or null. Kiosk scanners deliver the full URL; the
// overloaded bag page already has the bare token.
const TOKEN_RE = /^[a-f0-9]{32}$/i;

module.exports = function extractBagToken(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (TOKEN_RE.test(raw)) return raw.toLowerCase();
  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get('bag');
    if (fromQuery && TOKEN_RE.test(fromQuery)) return fromQuery.toLowerCase();
  } catch (_e) { /* not a URL */ }
  return null;
};
