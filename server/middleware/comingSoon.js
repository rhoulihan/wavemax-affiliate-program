// Public "coming soon" placeholder for rundberglaundry.com while the site is held
// pending the Section 6.1(a) approval. It serves the SAME page to everyone —
// users and crawlers alike — so there is no cloaking; the page is marked noindex
// so it is not discoverable while held. Exempt paths pass through to normal
// handling: the privacy policy (an OAuth-provider precondition), the API / OAuth
// callbacks, ACME cert renewal, static assets (so the privacy page styles), and
// favicon/robots/sitemap. To take the site live, remove the host below and redeploy.
const COMING_SOON_HOSTS = ['rundberglaundry.com', 'www.rundberglaundry.com'];

function reqHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase().split(':')[0].trim();
}

function isExempt(p) {
  return (
    p === '/privacy-policy' || p === '/privacy-policy/' || p === '/privacy-policy.html' ||
    p === '/terms-of-service' || p === '/terms-of-service/' ||
    p === '/terms-and-conditions' || p === '/terms-and-conditions.html' ||
    p.startsWith('/api/') ||                 // health, app API, OAuth callbacks
    p.startsWith('/.well-known/') ||         // ACME cert renewal, etc.
    p.startsWith('/assets/') ||              // so the exempt pages keep their styles
    p === '/favicon.ico' || p === '/robots.txt' || p === '/sitemap.xml'
  );
}

const PAGE = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>WaveMAX Austin — Coming Soon</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#0b1f43,#16336b 60%,#1e3a8a);color:#fff;padding:24px;text-align:center}
  .wrap{max-width:460px}
  .mark{display:inline-flex;align-items:center;gap:11px;font-weight:700;letter-spacing:.02em;font-size:20px;margin-bottom:22px}
  .mark .dot{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#1bcaa3,#0c93ad);display:grid;place-items:center}
  h1{font-size:24px;font-weight:600;margin-bottom:10px}
  p{font-size:15px;color:#bcd3ff;line-height:1.6}
  .ft{margin-top:30px;font-size:12px;color:#7e96c4}
</style></head>
<body><div class="wrap">
  <div class="mark"><span class="dot"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#0b1f43" stroke-width="2.4" stroke-linecap="round"><path d="M4 14c2-3 5-3 8 0s6 3 8 0"/><path d="M4 9c2-3 5-3 8 0s6 3 8 0"/></svg></span>WaveMAX&nbsp;Austin</div>
  <h1>Our new website is coming soon.</h1>
  <p>We're putting the finishing touches on it. Please check back shortly.</p>
  <div class="ft">&copy; 2026 CRHS Enterprises, LLC.</div>
</div></body></html>`;

function comingSoon(req, res, next) {
  if (!COMING_SOON_HOSTS.includes(reqHost(req))) return next();
  if (isExempt(req.path)) return next();
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'no-store');
  return res.status(200).type('html').send(PAGE);
}

module.exports = comingSoon;
module.exports._hosts = COMING_SOON_HOSTS;
module.exports._isExempt = isExempt;
