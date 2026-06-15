// Token-guard for /design-explorer/* — not publicly discoverable.
//
// Auth model: a request is authenticated when EITHER
//   - the query param ?k= matches EXPLORER_TOKEN, OR
//   - the explorer_k cookie matches EXPLORER_TOKEN.
// When ?k matches we ALSO set the explorer_k cookie (httpOnly, sameSite=Lax,
// path=/design-explorer). This lets corporate open
//   /design-explorer/index.html?k=TOKEN
// once; every sub-resource the static shell then requests (explorer.css,
// explorer.js, render/manifest.json, and the iframed render files)
// authenticates via the cookie, since a static index.html cannot append ?k=
// to its own <link>/<script>/<iframe> references.
//
// Unauthenticated explorer paths 404; non-explorer paths pass straight through.
//
// NOTE: The prefix check below is case-sensitive and assumes a case-sensitive
// filesystem (Linux/ext4 in production). On a case-insensitive FS (macOS HFS+,
// Windows NTFS) an attacker could reach the files via a differently-cased URL
// without being guarded; an additional lower-casing guard would be required.

// Scoped CSP for authenticated explorer responses. Helmet's global policy uses
// a strict per-request style nonce, which would block the render files' static
// inline <style nonce="DSNONCE">. This guard runs AFTER helmet, so res.set()
// here replaces helmet's header. With 'unsafe-inline' (and NO nonce-source) in
// style-src, the render files' inline <style> are allowed regardless of their
// DSNONCE attribute; the shell's own assets are external and covered by 'self';
// Google Maps iframes/fonts are explicitly allowed.
const EXPLORER_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://maps.gstatic.com https://maps.googleapis.com",
  "frame-src 'self' https://www.google.com https://maps.google.com",
  "connect-src 'self'",
  "base-uri 'self'",
  "object-src 'none'"
].join('; ');

const crypto = require('crypto');

// Constant-time compare for the token so a wrong ?k/cookie cannot be told apart
// from a right one by response timing. Non-strings (e.g. ?k supplied as an array)
// and length mismatches return false without throwing.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function explorerGuard(req, res, next) {
  // NB: req.path is NOT percent-decoded by Express, but express.static decodes before
  // resolving files. Decode here so encoded variants (e.g. /%64esign-explorer/...) are
  // matched and guarded consistently with what static will actually serve.
  // On malformed encoding decodeURIComponent throws; keep the raw path in that case
  // (it still matches if it literally starts with /design-explorer).
  let p = req.path;
  try { p = decodeURIComponent(req.path); } catch (e) { /* malformed encoding: keep raw */ }
  const inExplorer = p === '/design-explorer' || p.startsWith('/design-explorer/');
  if (!inExplorer) return next();

  const token = process.env.EXPLORER_TOKEN;
  const queryOk = Boolean(token) && safeEqual(req.query.k, token);
  const cookieOk = Boolean(token) && req.cookies && safeEqual(req.cookies.explorer_k, token);

  if (!queryOk && !cookieOk) {
    res.set('Cache-Control', 'no-store');
    return res.status(404).type('html').send('<!doctype html><title>Not found</title>Not found');
  }

  // Promote a valid ?k into a session cookie so sub-resources authenticate.
  if (queryOk) {
    res.cookie('explorer_k', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/design-explorer'
    });
  }

  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Content-Security-Policy', EXPLORER_CSP);
  return next();
}

module.exports = explorerGuard;
