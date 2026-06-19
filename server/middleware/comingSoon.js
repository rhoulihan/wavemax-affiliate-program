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
const COMING_SOON_HOSTS = ['rundberglaundry.com', 'www.rundberglaundry.com'];

function reqHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase().split(':')[0].trim();
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
<title>WaveMAX Austin — Coming Soon</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#0b1f43,#16336b 60%,#1e3a8a);color:#fff;padding:24px;text-align:center}
  .wrap{max-width:520px;width:100%}
  .mark{display:inline-flex;align-items:center;gap:11px;font-weight:700;letter-spacing:.02em;font-size:20px;margin-bottom:22px}
  .logo{display:block;max-width:180px;height:auto;margin:0 auto 18px}
  h1{font-size:24px;font-weight:600;margin-bottom:10px}
  p.lead{font-size:15px;color:#bcd3ff;line-height:1.6;margin-bottom:24px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;text-align:left}
  .nap{display:grid;gap:11px;font-size:15px;color:#e8f0ff;line-height:1.45}
  .nap .row{display:flex;align-items:flex-start;gap:11px}
  .nap .ic{flex:0 0 auto;line-height:1.3}
  .nap strong{font-weight:600}
  .nap a{color:#9fe3d2;text-decoration:none}
  .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
  .btn{flex:1 1 150px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px}
  .btn-call{background:linear-gradient(135deg,#1bcaa3,#0c93ad);color:#06243a}
  .btn-dir{background:rgba(255,255,255,.10);color:#fff;border:1px solid rgba(255,255,255,.22)}
  .map{margin-top:16px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.12)}
  .map iframe{width:100%;height:345px;border:0;display:block}
  .ft{margin-top:26px;font-size:12px;color:#7e96c4}
  .ft p{margin:0 0 6px}
  .ft .tm{font-size:11px;line-height:1.55;color:#6f86ad}
</style></head>
<body><div class="wrap">
  <img src="/assets/images/brand/logo-wavemax.png" alt="WaveMAX" class="logo">
  <div class="mark">WaveMAX&nbsp;Austin</div>
  <h1>Our new website is coming soon.</h1>
  <p class="lead">We're putting the finishing touches on it. In the meantime, here's how to find us and reach us.</p>
  <div class="card">
    <div class="nap">
      <div class="row"><span class="ic" aria-hidden="true">📍</span><span><strong>WaveMAX Laundry Austin</strong><br>825 E Rundberg Ln F1<br>Austin, TX 78753</span></div>
      <div class="row"><span class="ic" aria-hidden="true">📞</span><span><a href="tel:+15125531674">(512) 553-1674</a></span></div>
      <div class="row"><span class="ic" aria-hidden="true">🕐</span><span>Open daily · 7:00 am – 10:00 pm</span></div>
    </div>
    <div class="actions">
      <a class="btn btn-call" href="tel:+15125531674"><span aria-hidden="true">📞</span> Call us</a>
      <a class="btn btn-dir" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&amp;destination=825+E+Rundberg+Ln+F1+Austin+TX+78753"><span aria-hidden="true">🧭</span> Get directions</a>
    </div>
    <div class="map">
      <iframe title="Map to WaveMAX Laundry Austin — 825 E Rundberg Ln F1, Austin, TX 78753" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=WaveMAX+Laundry,+825+E+Rundberg+Ln,+Austin,+TX+78753&amp;output=embed&amp;t=k&amp;z=16"></iframe>
    </div>
  </div>
  <div class="ft">
    <p class="tm">WaveMAX™ and the WaveMAX logo are trademarks of WaveMAX Franchise, LLC. This location is independently owned and operated by CRHS Enterprises, LLC under a franchise license from WaveMAX Franchise, LLC.</p>
    <p>&copy; 2026 CRHS Enterprises, LLC.</p>
  </div>
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
