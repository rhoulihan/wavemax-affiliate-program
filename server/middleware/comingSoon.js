// Public "coming soon" placeholder for rundberglaundry.com while the site is held
// pending the Section 6.1(a) approval. It serves the SAME page to everyone —
// users and crawlers alike — so there is no cloaking; the page is marked noindex
// so it is not discoverable while held. Exempt paths pass through to normal
// handling: the privacy policy, the API, ACME cert renewal, static assets (so
// the privacy page styles), favicon/robots/sitemap, and the privileged
// affiliate-program app surfaces (the SPA shell, its *-embed.html fragments,
// and /locales/ — all login-gated, so safe to expose while the public
// franchise/marketing pages stay held). To take the whole site live, remove
// the host below and redeploy.
const storeIPs = require('../config/storeIPs');
const { clientIp } = require('../utils/clientIp');

const COMING_SOON_HOSTS = ['rundberglaundry.com', 'www.rundberglaundry.com'];

function reqHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase().split(':')[0].trim();
}

// The store location (STORE_IP_ADDRESS + ADDITIONAL_STORE_IPS + STORE_IP_RANGES,
// IPv4 and the store's IPv6 /64) is trusted to see the real app on EVERY route.
function isStore(req) {
  const ip = clientIp(req);
  return !!ip && storeIPs.isWhitelisted(ip);
}

function isExempt(p) {
  return (
    p === '/privacy-policy' || p === '/privacy-policy/' || p === '/privacy-policy.html' ||
    p === '/terms-of-service' || p === '/terms-of-service/' ||
    p === '/terms-and-conditions' || p === '/terms-and-conditions.html' ||
    p === '/design-explorer' || p.startsWith('/design-explorer/') || // token-gated design review tool (explorerGuard enforces the token)
    p.startsWith('/api/') ||                 // health, app API
    // Affiliate-program app surfaces — privileged, login-gated access, so they
    // pass through while the public franchise/marketing pages stay held. The
    // SPA shell, its embed page fragments, and the i18n locale files.
    p === '/embed-app-v2.html' ||
    p === '/admin' || p === '/admin/' ||     // clean admin URL (IP-gated)
    p === '/operator' || p === '/operator/' || // clean operator URL (IP-gated)
    p === '/scanbag' || p === '/scanbag/' ||   // mobile bag-scanner PWA
    p === '/scanbag-sw.js' || p === '/scanbag-manifest.json' || // its service worker + manifest
    p.endsWith('-embed.html') ||
    p.startsWith('/locales/') ||
    p.startsWith('/.well-known/') ||         // ACME cert renewal, etc.
    p.startsWith('/assets/') ||              // so the exempt pages keep their styles
    p === '/favicon.ico' || p === '/robots.txt' || p === '/sitemap.xml'
  );
}

const PAGE = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Coming soon</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#0b1f43,#16336b 60%,#1e3a8a);color:#fff;padding:24px;text-align:center}
  .wrap{max-width:520px;width:100%}
  h1{font-size:24px;font-weight:600;margin-bottom:20px;letter-spacing:.01em}
  .map{border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.12)}
  .map iframe{width:100%;height:360px;border:0;display:block}
</style></head>
<body><div class="wrap">
  <h1>Coming soon</h1>
  <div class="map">
    <iframe title="Map — 825 E Rundberg Ln, Austin, TX 78753" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=825+E+Rundberg+Ln,+Austin,+TX+78753&amp;output=embed&amp;t=k&amp;z=16"></iframe>
  </div>
</div></body></html>`;

function comingSoon(req, res, next) {
  if (!COMING_SOON_HOSTS.includes(reqHost(req))) return next();
  if (isExempt(req.path)) return next();
  if (isStore(req)) return next(); // the store sees the real app on every route
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'no-store');
  return res.status(200).type('html').send(PAGE);
}

module.exports = comingSoon;
module.exports._hosts = COMING_SOON_HOSTS;
module.exports._isExempt = isExempt;
module.exports._isStore = isStore;
