// Server-rendered pages for the gated franchise preview (crhsent.com/<location>):
//   - unlock page: password form (native POST, no JS) + re-shown authorization
//   - preview page: the unlocked preview (Phase 2: GBP basics; Phase 3 localizes)
//   - notice page: invalid/expired link (served with 404)
// Inline <style> is intentional and CSP-permitted (style-src allows 'unsafe-inline');
// there are NO inline scripts. Copy mirrors server/config/franchisePreviewCopy.js.
'use strict';

const { REMINDER, AUTHORIZATION } = require('../config/franchisePreviewCopy');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const STYLE = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.6;background:#f1f5f9}
  .wrap{max-width:560px;margin:0 auto;padding:0 20px}
  .topbar{background:#1e3a8a;color:#fff;text-align:center;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:9px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:30px 28px;margin:34px auto;box-shadow:0 10px 40px rgba(15,23,42,.08)}
  h1{font-size:23px;line-height:1.25;margin-bottom:6px}
  h2{font-size:18px;margin:18px 0 8px}
  .addr{color:#64748b;font-size:14.5px;margin-bottom:18px}
  .reminder{font-size:13.5px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:11px 13px;margin:14px 0}
  label{display:block;font-size:14px;font-weight:600;margin:16px 0 6px}
  input[type=password]{width:100%;font-size:16px;padding:12px;border:1px solid #cbd5e1;border-radius:8px}
  input[type=password]:focus{outline:2px solid #2563eb;border-color:#2563eb}
  .chk{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:13px;color:#334155;margin-top:16px;cursor:pointer}
  .chk input{margin-top:3px;width:16px;height:16px;flex:0 0 auto}
  button{margin-top:18px;width:100%;background:#2563eb;color:#fff;font-weight:700;font-size:16px;padding:13px;border:0;border-radius:8px;cursor:pointer}
  button:hover{background:#1e3a8a}
  .err{background:#fef2f2;border:1px solid #fecaca;color:#b42318;font-size:14px;border-radius:8px;padding:10px 12px;margin-bottom:14px}
  .fine{font-size:12px;color:#94a3b8;margin-top:14px;line-height:1.5}
  .info{display:grid;gap:10px;margin-top:10px}
  .row{display:flex;justify-content:space-between;gap:14px;font-size:14.5px;border-bottom:1px solid #f1f5f9;padding-bottom:9px}
  .row .k{color:#64748b}
  .row .v{font-weight:600;text-align:right}
  .pill{display:inline-block;background:#eef2ff;color:#1e3a8a;border:1px solid #c7d2fe;border-radius:999px;font-size:12px;font-weight:700;padding:4px 11px}
  a.btnlink{color:#2563eb;text-decoration:underline;font-size:14px}
  .foot{font-size:11.5px;color:#94a3b8;text-align:center;padding:0 20px 40px;line-height:1.5}
`;

function shell(title, bar, body) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head><body>
<div class="topbar">${esc(bar)}</div>
${body}
</body></html>`;
}

// Password form. error is optional (re-render after a bad attempt).
function buildUnlockPage({ businessName, token, error }) {
  const who = businessName ? esc(businessName) : 'your location';
  const errHtml = error ? `<div class="err">${esc(error)}</div>` : '';
  return shell('Unlock your preview', 'Private preview', `
<div class="wrap"><div class="card">
  <h1>Unlock the preview for ${who}</h1>
  <p class="addr">Enter the password we emailed you to view your private site preview.</p>
  ${errHtml}
  <p class="reminder">${esc(REMINDER)}</p>
  <form method="POST" action="/__preview/unlock">
    <input type="hidden" name="key" value="${esc(token)}">
    <label for="pw">Password</label>
    <input id="pw" type="password" name="password" autocomplete="off" autofocus required>
    <label class="chk"><input type="checkbox" name="attest" value="yes" required><span>${esc(AUTHORIZATION)}</span></label>
    <button type="submit">Unlock my preview</button>
  </form>
  <p class="fine">Your preview is private, hosted temporarily by CRHS Enterprises, LLC, and is never published publicly. Draft terms — pending final review.</p>
</div></div>`);
}

// The unlocked preview. Phase 2 shows the Google Business basics we'd localize
// from; Phase 3 will render the full franchise template.
function buildPreviewPage(reqDoc) {
  const g = (reqDoc && reqDoc.gbpData) || {};
  const name = esc(reqDoc.businessName || g.name || 'Your business');
  const address = esc(reqDoc.formattedAddress || g.formattedAddress || '');
  const rows = [];
  if (g.phone) rows.push(`<div class="row"><span class="k">Phone</span><span class="v">${esc(g.phone)}</span></div>`);
  if (g.rating) rows.push(`<div class="row"><span class="k">Google rating</span><span class="v">${esc(g.rating)} ★ (${esc(g.userRatingCount || 0)})</span></div>`);
  if (Array.isArray(g.hours) && g.hours.length) {
    rows.push(`<div class="row"><span class="k">Hours</span><span class="v">${g.hours.map(esc).join('<br>')}</span></div>`);
  }
  const maps = g.mapsUri ? `<p style="margin-top:16px"><a class="btnlink" href="${esc(g.mapsUri)}" target="_blank" rel="noopener">View on Google Maps →</a></p>` : '';
  return shell(`${name} — preview`, 'Preview', `
<div class="wrap"><div class="card">
  <span class="pill">Your private preview</span>
  <h1 style="margin-top:12px">${name}</h1>
  <p class="addr">${address}</p>
  <h2>Pulled from your Google Business Profile</h2>
  <div class="info">${rows.join('') || '<p class="addr">No public details available yet.</p>'}</div>
  ${maps}
  <p class="fine" style="margin-top:22px">This is an early preview built automatically from your Google Business Profile. Your full localized site — content, photos, booking, and SEO — is what we build together on the onboarding call. This preview unlocks for one hour; reopen your email link anytime to view it again.</p>
</div></div>
<p class="foot">© 2026 CRHS Enterprises, LLC. Independent WaveMAX® franchisee. This private preview is not a published website and is hosted temporarily for your review.</p>`);
}

function buildNoticePage(title, message) {
  return shell(title, 'Preview', `
<div class="wrap"><div class="card">
  <h1>${esc(title)}</h1>
  <p class="addr" style="margin-top:8px">${esc(message)}</p>
</div></div>`);
}

module.exports = { buildUnlockPage, buildPreviewPage, buildNoticePage, esc };
