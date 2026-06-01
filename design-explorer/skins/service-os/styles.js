'use strict';
/* Service OS — a utility-first "product, not brochure" skin.
   ONE stylesheet renders both intensities by consuming the theme vars
   (--brand, --brand-deep, --accent, --ink, --paper, --lead) injected by
   the core into :root. Interactivity is CSS-only (:target, :focus-within,
   sticky, scroll-snap, :hover) — no scripts, no inline handlers. */

const css = `
/* ===== Fonts: distinctive, efficiently loaded ===== */
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Public+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');

/* ===== Derived tokens — both intensities flow from theme vars ===== */
:root{
  --so-display:'Bricolage Grotesque', 'Trebuchet MS', sans-serif;
  --so-body:'Public Sans','Segoe UI', sans-serif;
  --so-mono:'Space Mono', ui-monospace, 'Courier New', monospace;
  --so-radius:14px; --so-radius-lg:22px;
  --so-line:color-mix(in srgb, var(--ink) 14%, transparent);
  --so-line-soft:color-mix(in srgb, var(--ink) 8%, transparent);
  --so-panel:color-mix(in srgb, var(--paper) 92%, var(--ink) 8%);
  --so-panel-2:color-mix(in srgb, var(--paper) 97%, var(--ink) 3%);
  --so-muted:color-mix(in srgb, var(--ink) 62%, var(--paper));
  --so-shadow:0 1px 0 var(--so-line),0 18px 40px -28px color-mix(in srgb,var(--ink) 60%,transparent);
  --so-glow:color-mix(in srgb, var(--accent) 24%, transparent);
  /* lead = brand (heavy) vs accent (light): controls hero gradient + chrome */
  --so-lead:var(--brand);
  --so-on-lead:#ffffff;
}
[data-intensity="light"]{ --so-lead:var(--accent); }

/* ===== Reset ===== */
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; font-family:var(--so-body); color:var(--ink);
  background:var(--paper);
  background-image:
    radial-gradient(120% 80% at 100% -10%, color-mix(in srgb,var(--so-lead) 12%,transparent), transparent 60%),
    radial-gradient(100% 60% at -10% 0%, color-mix(in srgb,var(--accent) 10%,transparent), transparent 55%);
  line-height:1.55; font-size:16px; letter-spacing:-.005em;
  -webkit-font-smoothing:antialiased;
}
img{max-width:100%;display:block}
a{color:inherit}
:focus-visible{outline:3px solid var(--so-lead); outline-offset:2px; border-radius:6px}

/* presentational hook from core — keep as faint OS watermark, not content */
.ds-brandline{
  margin:0; position:fixed; top:50%; right:-2px; transform:rotate(180deg) translateY(50%);
  writing-mode:vertical-rl; font-family:var(--so-mono); font-size:10px; letter-spacing:.32em;
  text-transform:uppercase; color:color-mix(in srgb,var(--ink) 22%,transparent);
  pointer-events:none; z-index:1; user-select:none;
}
@media (max-width:760px){ .ds-brandline{display:none} }

/* ===== Shared layout ===== */
.so-wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.so-eyebrow{font-family:var(--so-mono);text-transform:uppercase;letter-spacing:.22em;
  font-size:11px;color:var(--so-lead);font-weight:700;display:inline-flex;gap:.5em;align-items:center}
.so-eyebrow::before{content:"";width:7px;height:7px;border-radius:2px;background:var(--so-lead);
  box-shadow:0 0 0 3px var(--so-glow)}
h1,h2,h3{font-family:var(--so-display);font-weight:700;letter-spacing:-.02em;line-height:1.02;margin:0}
.so-sec-title{font-size:clamp(26px,4vw,40px);margin:0 0 6px}
.so-sec-sub{color:var(--so-muted);max-width:60ch;margin:0 0 26px;font-size:1.02rem}

/* ===== OS top bar ===== */
.so-os{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--paper) 82%,transparent);
  backdrop-filter:saturate(1.2) blur(10px);border-bottom:1px solid var(--so-line)}
.so-os-in{display:flex;align-items:center;gap:16px;height:64px}
.so-brand{display:flex;align-items:center;gap:12px;text-decoration:none;flex:0 0 auto}
/* Logo lockup: brand-colored chip so the white wordmark is always legible */
.so-logo-lockup{display:inline-flex;align-items:center;justify-content:center;
  background:var(--brand-deep);border-radius:8px;padding:5px 10px;flex:0 0 auto}
.so-footer .so-logo-lockup{border-radius:7px;padding:4px 8px}
.so-brand img{height:28px;width:auto}
.so-footer .so-brand img{height:22px}
.so-brand .so-brand-meta{display:flex;flex-direction:column;line-height:1.05}
.so-brand-name{font-family:var(--so-display);font-weight:800;font-size:15px}
.so-brand-tag{font-family:var(--so-mono);font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--so-muted)}
.so-os-spacer{flex:1}
.so-nav{display:flex;gap:2px}
.so-nav a{font-family:var(--so-mono);font-size:12px;letter-spacing:.04em;text-decoration:none;
  padding:7px 11px;border-radius:8px;color:var(--so-muted)}
.so-nav a:hover{background:var(--so-panel);color:var(--ink)}
.so-nav a[aria-current="page"]{color:var(--so-on-lead);background:var(--so-lead)}
.so-pill{font-family:var(--so-mono);font-size:11px;display:inline-flex;align-items:center;gap:7px;
  padding:6px 11px;border-radius:999px;border:1px solid var(--so-line);background:var(--so-panel-2);white-space:nowrap}
.so-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 30%,transparent)}
@media (max-width:860px){ .so-nav{display:none} .so-os-in{height:58px} }

/* ===== HERO (bento on home; banner elsewhere) ===== */
.so-hero{padding:34px 0 10px}
.so-hero--bento{padding:26px 0 4px}
.so-hero-head{max-width:46ch}
.so-h1{font-size:clamp(34px,6vw,64px);letter-spacing:-.03em;margin:14px 0 12px}
.so-h1 .so-lead-word{color:var(--so-lead)}
.so-hero-sub{font-size:clamp(16px,2vw,19px);color:var(--so-muted);max-width:54ch;margin:0 0 22px}
.so-hero-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.so-chip{font-family:var(--so-mono);font-size:11px;letter-spacing:.03em;padding:6px 11px;border-radius:8px;
  border:1px solid var(--so-line);background:var(--so-panel-2);display:inline-flex;gap:7px;align-items:center}
.so-chip svg{width:13px;height:13px}

/* CTA buttons */
.so-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.so-btn{font-family:var(--so-mono);font-weight:700;font-size:13px;letter-spacing:.02em;text-decoration:none;
  display:inline-flex;align-items:center;gap:9px;padding:13px 20px;border-radius:12px;border:1px solid var(--so-line);
  background:var(--so-panel-2);color:var(--ink);transition:transform .12s ease,box-shadow .12s ease}
.so-btn svg{width:16px;height:16px}
.so-btn:hover{transform:translateY(-2px);box-shadow:var(--so-shadow)}
.so-btn-primary{background:var(--so-lead);color:var(--so-on-lead);border-color:transparent;
  box-shadow:0 12px 26px -14px var(--so-lead)}
.so-btn-primary:hover{box-shadow:0 18px 34px -14px var(--so-lead)}

/* ===== BENTO GRID =====
   12-col grid that fills BOTH sides at desktop width. The LEAD tile (H1 +
   sub + chips + actions) spans 7 cols × 2 rows on the left; the right column
   stacks the self-serve + consolidated wash-dry-fold tiles. A bottom band
   runs the Omni UV showcase + commercial + map so there's no empty region.
   Collapses to 6-col, then single-column on mobile. */
.so-bento{display:grid;grid-template-columns:repeat(12,1fr);grid-auto-rows:minmax(150px,auto);gap:14px;margin:8px 0}
.so-tile{grid-column:span 4;position:relative;border:1px solid var(--so-line);border-radius:var(--so-radius-lg);
  background:var(--so-panel-2);padding:18px;min-height:150px;display:flex;flex-direction:column;
  text-decoration:none;color:inherit;overflow:hidden;transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease}
.so-tile:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--so-lead) 45%,var(--so-line));box-shadow:var(--so-shadow)}
.so-tile-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.so-tile-tag{font-family:var(--so-mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--so-muted)}
.so-tile-ico{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;
  background:color-mix(in srgb,var(--so-lead) 14%,transparent);color:var(--so-lead);flex:0 0 auto}
.so-tile-ico svg{width:18px;height:18px}
.so-tile h3{font-size:19px;margin:auto 0 4px}
.so-tile p{margin:0;color:var(--so-muted);font-size:13.5px}
.so-tile-open{margin-top:12px;font-family:var(--so-mono);font-size:11px;letter-spacing:.08em;
  color:var(--so-lead);display:inline-flex;align-items:center;gap:6px}
.so-tile-open svg{width:13px;height:13px;transition:transform .14s ease}
.so-tile:hover .so-tile-open svg{transform:translateX(3px)}

/* LEAD/hero tile — carries the H1 + sub + chips + actions */
.so-tile--lead{background:
  linear-gradient(140deg, var(--so-lead), color-mix(in srgb,var(--so-lead) 55%, var(--brand-deep)));
  color:var(--so-on-lead);border-color:transparent}
.so-tile--lead .so-tile-tag,.so-tile--lead p{color:color-mix(in srgb,#fff 84%,transparent)}
.so-tile--lead .so-tile-ico{background:rgba(255,255,255,.16);color:#fff}
.so-tile--lead .so-tile-open{color:#fff}
.so-tile--hero{grid-column:span 7;grid-row:span 2;padding:26px 26px 24px;justify-content:flex-start;cursor:default}
.so-tile--hero .so-h1{font-size:clamp(30px,3.6vw,46px);margin:14px 0 12px;color:#fff;line-height:1.04}
.so-tile--hero .so-h1 .so-lead-word{color:color-mix(in srgb,var(--accent) 70%,#fff)}
.so-tile--hero .so-hero-sub{color:color-mix(in srgb,#fff 86%,transparent);max-width:52ch;font-size:clamp(14.5px,1.4vw,16.5px);margin:0 0 16px}
.so-tile--hero .so-hero-chips{margin-bottom:0}
.so-tile--hero .so-chip{border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff}
.so-tile--hero .so-actions{margin-top:18px}
.so-tile--hero .so-btn{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.3)}
.so-tile--hero .so-btn-primary{background:#fff;color:var(--brand-deep);border-color:#fff;box-shadow:0 12px 26px -16px rgba(0,0,0,.5)}

/* right-column tiles share the remaining 5 cols, stacked beside the lead */
.so-tile--service,.so-tile--wdf{grid-column:span 5}

/* bottom band: Omni UV showcase (5) + commercial (3) + map (4) = 12 */
.so-tile--showcase{grid-column:span 5}
.so-tile--commercial{grid-column:span 3}
.so-tile--map{grid-column:span 4;padding:0;min-height:200px}

/* consolidated WASH-DRY-FOLD tile (service + pricing in one) */
.so-tile--wdf h3{margin:auto 0 8px}
.so-wdf-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;
  font-family:var(--so-display);font-weight:800;letter-spacing:-.03em;color:var(--so-lead)}
.so-wdf-price b{font-size:clamp(28px,3.6vw,40px)}
.so-wdf-price small{font-size:15px;color:var(--so-muted);font-family:var(--so-mono);font-weight:400}
.so-wdf-price .so-wdf-meta{font-family:var(--so-mono);font-size:11px;font-weight:700;letter-spacing:.04em;
  color:var(--so-muted);background:var(--so-panel);border:1px solid var(--so-line);
  padding:3px 8px;border-radius:999px;margin-left:auto;align-self:center}
.so-tile--wdf p{margin:6px 0 0}

/* Omni UV SHOWCASE tile — visually distinct selling point */
.so-tile--showcase{color:var(--so-on-lead);border-color:transparent;
  background:
    radial-gradient(120% 120% at 100% 0%, color-mix(in srgb,var(--accent) 60%,transparent), transparent 60%),
    linear-gradient(150deg, color-mix(in srgb,var(--so-lead) 90%,var(--brand-deep)), var(--brand-deep))}
.so-tile--showcase::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;
  background:radial-gradient(80% 60% at 12% 110%, color-mix(in srgb,#fff 26%,transparent), transparent 60%)}
.so-tile--showcase .so-tile-tag{color:color-mix(in srgb,#fff 82%,transparent)}
.so-tile--showcase .so-tile-ico{background:rgba(255,255,255,.18);color:#fff}
.so-tile--showcase h3{font-size:clamp(19px,1.7vw,23px);margin:6px 0 8px;position:relative}
.so-tile--showcase p{color:color-mix(in srgb,#fff 84%,transparent);font-size:13.5px;position:relative}
.so-showcase-badge{position:relative;margin-top:auto;align-self:flex-start;display:inline-flex;align-items:center;gap:7px;
  font-family:var(--so-mono);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  padding:6px 11px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);color:#fff}
.so-showcase-badge svg{width:13px;height:13px}

/* find-us MAP tile — caption is a real "Open in Maps" link; pin sized so
   nothing covers the action */
.so-tile--map iframe{width:100%;height:100%;min-height:200px;border:0;filter:saturate(1.05)}
.so-tile--map .so-map-cap{position:absolute;left:12px;bottom:12px;z-index:1;
  display:inline-flex;align-items:center;gap:7px;text-decoration:none;color:var(--ink);
  font-family:var(--so-mono);font-size:11px;font-weight:700;letter-spacing:.02em;
  background:color-mix(in srgb,var(--paper) 92%,transparent);padding:7px 11px;border-radius:9px;
  border:1px solid var(--so-line);box-shadow:var(--so-shadow);transition:transform .12s ease}
.so-tile--map .so-map-cap svg{width:14px;height:14px;flex:0 0 auto;color:var(--so-lead)}
.so-tile--map .so-map-cap:hover{transform:translateY(-1px)}

/* tablet: lead tile goes full width above a 6-col grid of the rest */
@media (max-width:880px){
  .so-bento{grid-template-columns:repeat(6,1fr)}
  .so-tile{grid-column:span 3}
  .so-tile--hero{grid-column:span 6;grid-row:auto}
  .so-tile--service,.so-tile--wdf,.so-tile--showcase{grid-column:span 3}
  .so-tile--commercial,.so-tile--map{grid-column:span 3}
}
@media (max-width:560px){
  .so-bento{grid-template-columns:1fr;gap:11px}
  .so-tile,.so-tile--hero,.so-tile--service,.so-tile--wdf,.so-tile--showcase,
  .so-tile--commercial,.so-tile--map{grid-column:span 1;grid-row:auto}
}

/* ===== KPI strip — full-width stat band BELOW the hero bento ===== */
.so-kpis{padding:10px 0 6px}
.so-kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;
  border:1px solid var(--so-line);border-radius:var(--so-radius-lg);background:var(--so-panel-2);
  padding:18px 14px;box-shadow:var(--so-shadow)}
.so-kpi{display:flex;flex-direction:column;align-items:flex-start;gap:3px;
  padding:2px 14px;position:relative}
.so-kpi + .so-kpi::before{content:"";position:absolute;left:0;top:6px;bottom:6px;width:1px;background:var(--so-line)}
.so-kpi-ico{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;margin-bottom:5px;
  background:color-mix(in srgb,var(--so-lead) 13%,transparent);color:var(--so-lead)}
.so-kpi-ico svg{width:16px;height:16px}
.so-kpi-v{font-family:var(--so-display);font-weight:800;font-size:clamp(20px,2.4vw,28px);
  letter-spacing:-.02em;color:var(--so-lead);line-height:1}
.so-kpi-l{font-family:var(--so-mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--so-muted)}
@media (max-width:760px){
  .so-kpi-row{grid-template-columns:repeat(2,1fr);gap:14px 8px}
  .so-kpi{padding:2px 10px}
  .so-kpi + .so-kpi::before{display:none}
}
@media (max-width:380px){ .so-kpi-row{grid-template-columns:1fr} }

/* ===== CONCIERGE launcher (visual STUB) ===== */
.so-concierge{margin:32px 0;border:1px solid var(--so-line);border-radius:var(--so-radius-lg);overflow:hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb,var(--so-lead) 8%,var(--paper)), var(--paper));
  box-shadow:var(--so-shadow)}
.so-cc-bar{display:flex;align-items:center;gap:8px;padding:11px 16px;border-bottom:1px solid var(--so-line);
  font-family:var(--so-mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--so-muted)}
.so-cc-bar .so-dot{background:var(--accent)}
.so-cc-bar .so-traffic{display:flex;gap:6px;margin-left:auto}
.so-traffic span{width:10px;height:10px;border-radius:50%;background:var(--so-line)}
.so-cc-body{display:grid;grid-template-columns:1.1fr 1fr;gap:22px;padding:24px 24px 26px}
.so-cc-kicker{font-family:var(--so-mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--so-lead);font-weight:700}
.so-cc-body h2{font-size:clamp(24px,3.2vw,34px);margin:10px 0 8px}
.so-cc-body p{margin:0;color:var(--so-muted);max-width:42ch}
.so-cc-chat{background:var(--so-panel-2);border:1px solid var(--so-line);border-radius:var(--so-radius);padding:14px;display:flex;flex-direction:column;gap:12px}
.so-bubble{font-size:14px;padding:11px 14px;border-radius:14px;max-width:90%}
.so-bubble--user{align-self:flex-end;background:var(--so-lead);color:var(--so-on-lead);border-bottom-right-radius:5px}
.so-bubble--bot{align-self:flex-start;background:var(--paper);border:1px solid var(--so-line);border-bottom-left-radius:5px}
.so-bubble--bot .so-typing{display:inline-flex;gap:4px;vertical-align:middle}
.so-typing i{width:6px;height:6px;border-radius:50%;background:var(--so-muted);opacity:.5;animation:so-blink 1.2s infinite}
.so-typing i:nth-child(2){animation-delay:.2s} .so-typing i:nth-child(3){animation-delay:.4s}
@keyframes so-blink{0%,60%,100%{opacity:.25}30%{opacity:.9}}
.so-cc-input{display:flex;gap:8px;margin-top:2px}
.so-cc-input input{flex:1;font-family:var(--so-body);font-size:13px;padding:11px 13px;border-radius:10px;
  border:1px solid var(--so-line);background:var(--paper);color:var(--ink)}
.so-cc-input input::placeholder{color:var(--so-muted)}
.so-cc-send{font-family:var(--so-mono);font-weight:700;font-size:12px;padding:0 16px;border-radius:10px;border:0;
  background:var(--so-lead);color:var(--so-on-lead);cursor:not-allowed}
.so-cc-note{font-family:var(--so-mono);font-size:10.5px;letter-spacing:.04em;color:var(--so-muted);margin:0}
@media (max-width:720px){ .so-cc-body{grid-template-columns:1fr;gap:18px;padding:20px} }

/* ===== Generic content sections ===== */
.so-section{padding:42px 0}
.so-section--alt{background:linear-gradient(180deg,transparent,var(--so-line-soft),transparent)}

/* stats strip */
.so-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.so-stat{border:1px solid var(--so-line);border-radius:var(--so-radius);background:var(--so-panel-2);padding:16px 14px}
.so-stat-v{font-family:var(--so-display);font-weight:800;font-size:clamp(22px,3vw,30px);color:var(--so-lead);letter-spacing:-.02em}
.so-stat-l{font-family:var(--so-mono);font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--so-muted);margin-top:4px}
@media (max-width:760px){ .so-stats{grid-template-columns:repeat(2,1fr)} }

/* cards grid */
.so-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.so-card{border:1px solid var(--so-line);border-radius:var(--so-radius-lg);background:var(--so-panel-2);padding:22px;position:relative}
.so-card-no{font-family:var(--so-mono);font-size:11px;letter-spacing:.2em;color:var(--so-lead)}
.so-card h3{font-size:19px;margin:12px 0 8px}
.so-card p{margin:0;color:var(--so-muted);font-size:14.5px}
.so-card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  box-shadow:inset 0 0 0 1px transparent;transition:box-shadow .14s}
.so-card:hover::after{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--so-lead) 40%,transparent)}
@media (max-width:820px){ .so-cards{grid-template-columns:1fr} }

/* steps (timeline) */
.so-steps{display:grid;gap:0}
.so-step{display:grid;grid-template-columns:54px 1fr;gap:18px;padding:18px 0;border-bottom:1px solid var(--so-line-soft)}
.so-step:last-child{border-bottom:0}
.so-step-no{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-family:var(--so-mono);
  font-weight:700;background:color-mix(in srgb,var(--so-lead) 13%,transparent);color:var(--so-lead);font-size:16px}
.so-step h3{font-size:18px;margin:0 0 5px}
.so-step p{margin:0;color:var(--so-muted)}

/* tabs (CSS-only, radio hack) */
.so-tabs{border:1px solid var(--so-line);border-radius:var(--so-radius-lg);background:var(--so-panel-2);overflow:hidden}
.so-tabs input{position:absolute;opacity:0;pointer-events:none}
.so-tablist{display:flex;flex-wrap:wrap;gap:4px;padding:10px;border-bottom:1px solid var(--so-line);background:var(--so-panel)}
.so-tablist label{font-family:var(--so-mono);font-size:12px;letter-spacing:.02em;padding:9px 14px;border-radius:9px;cursor:pointer;color:var(--so-muted)}
.so-tablist label:hover{background:var(--paper)}
.so-tabpanel{display:none;padding:24px}
.so-tabpanel h3{font-size:22px;margin:0 0 8px}
.so-tabpanel p{margin:0 0 6px;color:var(--so-muted);max-width:60ch}
.so-tabpanel .so-btn{margin-top:12px}
#so-t0:checked~.so-tablist label[for=so-t0],
#so-t1:checked~.so-tablist label[for=so-t1],
#so-t2:checked~.so-tablist label[for=so-t2]{background:var(--so-lead);color:var(--so-on-lead)}
#so-t0:checked~.so-tabpanels .so-tabpanel:nth-child(1),
#so-t1:checked~.so-tabpanels .so-tabpanel:nth-child(2),
#so-t2:checked~.so-tabpanels .so-tabpanel:nth-child(3){display:block}

/* pricing */
.so-price{display:grid;grid-template-columns:1.2fr 1fr;gap:16px}
.so-price-card{border:1px solid var(--so-line);border-radius:var(--so-radius-lg);padding:24px;background:var(--so-panel-2)}
.so-price-card--feature{background:linear-gradient(150deg,color-mix(in srgb,var(--so-lead) 10%,var(--paper)),var(--paper));
  border-color:color-mix(in srgb,var(--so-lead) 30%,var(--so-line))}
.so-price-big{font-family:var(--so-display);font-weight:800;font-size:clamp(34px,6vw,52px);color:var(--so-lead);letter-spacing:-.03em}
.so-price-big small{font-size:16px;color:var(--so-muted);font-family:var(--so-mono);font-weight:400}
.so-price-list{list-style:none;padding:0;margin:14px 0 0;display:flex;flex-direction:column;gap:9px}
.so-price-list li{display:flex;gap:10px;align-items:flex-start;font-size:14.5px}
.so-price-list li::before{content:"";flex:0 0 auto;width:16px;height:16px;margin-top:2px;border-radius:5px;
  background:color-mix(in srgb,var(--accent) 22%,transparent);
  box-shadow:inset 0 0 0 2px var(--accent)}
@media (max-width:760px){ .so-price{grid-template-columns:1fr} }

/* reviews */
.so-reviews{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.so-review{margin:0;border:1px solid var(--so-line);border-radius:var(--so-radius-lg);background:var(--so-panel-2);
  padding:22px;display:flex;flex-direction:column;gap:12px}
.so-review-stars{color:var(--accent);letter-spacing:.12em;font-size:15px}
.so-review blockquote{margin:0;font-size:15px;color:color-mix(in srgb,var(--ink) 88%,var(--paper));line-height:1.5}
.so-review figcaption{margin-top:auto;display:flex;flex-direction:column;gap:2px;
  font-family:var(--so-mono);font-size:11.5px;color:var(--so-muted)}
.so-review figcaption b{color:var(--ink);font-size:13px;font-family:var(--so-body)}
@media (max-width:820px){ .so-reviews{grid-template-columns:1fr} }

/* prose */
.so-prose{max-width:64ch;font-size:1.06rem}
.so-prose p{color:color-mix(in srgb,var(--ink) 84%,var(--paper))}

/* ===== Contact ===== */
.so-contact{display:grid;grid-template-columns:1fr 1.1fr;gap:18px}
.so-contact-card{border:1px solid var(--so-line);border-radius:var(--so-radius-lg);background:var(--so-panel-2);padding:24px}
.so-nap{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:14px}
.so-nap li{display:flex;gap:13px;align-items:flex-start}
.so-nap-ico{width:38px;height:38px;flex:0 0 auto;border-radius:11px;display:grid;place-items:center;
  background:color-mix(in srgb,var(--so-lead) 13%,transparent);color:var(--so-lead)}
.so-nap-ico svg{width:18px;height:18px}
.so-nap-l{font-family:var(--so-mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--so-muted)}
.so-nap-v{font-weight:600}
.so-nap-v a{text-decoration:none}
.so-map-frame{border:1px solid var(--so-line);border-radius:var(--so-radius-lg);overflow:hidden;min-height:340px;background:var(--so-panel)}
.so-map-frame iframe{width:100%;height:100%;min-height:340px;border:0}
.so-form{display:grid;gap:12px;margin-top:16px}
.so-field{display:flex;flex-direction:column;gap:5px}
.so-field label{font-family:var(--so-mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--so-muted)}
.so-field input,.so-field textarea{font-family:var(--so-body);font-size:14px;padding:11px 13px;border-radius:10px;
  border:1px solid var(--so-line);background:var(--paper);color:var(--ink)}
.so-field textarea{min-height:96px;resize:vertical}
@media (max-width:820px){ .so-contact{grid-template-columns:1fr} }

/* ===== Closing CTA banner ===== */
.so-cta{margin:46px 0 110px;border-radius:26px;padding:42px;color:var(--so-on-lead);position:relative;overflow:hidden;
  background:linear-gradient(135deg,var(--so-lead),color-mix(in srgb,var(--so-lead) 60%,var(--brand-deep)))}
.so-cta::after{content:"";position:absolute;inset:0;opacity:.5;mix-blend-mode:overlay;
  background:radial-gradient(60% 120% at 90% 10%, color-mix(in srgb,var(--accent) 70%,transparent), transparent 60%)}
.so-cta .so-eyebrow{color:#fff}.so-cta .so-eyebrow::before{background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.25)}
.so-cta h2{font-size:clamp(28px,4.4vw,46px);max-width:18ch;margin:12px 0 8px;position:relative}
.so-cta p{max-width:50ch;margin:0 0 22px;color:color-mix(in srgb,#fff 86%,transparent);position:relative}
.so-cta .so-actions{position:relative}
.so-cta .so-btn{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.28)}
.so-cta .so-btn-primary{background:#fff;color:var(--brand-deep);border-color:#fff}

/* ===== Sticky mobile action bar (CSS only) ===== */
.so-dock{position:fixed;left:0;right:0;bottom:0;z-index:50;display:none;
  padding:8px 10px calc(8px + env(safe-area-inset-bottom));
  background:color-mix(in srgb,var(--paper) 90%,transparent);backdrop-filter:blur(10px);
  border-top:1px solid var(--so-line);grid-template-columns:1fr 1fr 1fr;gap:8px}
.so-dock a{display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none;
  font-family:var(--so-mono);font-size:11px;font-weight:700;padding:9px 4px;border-radius:11px;color:var(--ink)}
.so-dock a svg{width:19px;height:19px}
.so-dock a.so-dock-primary{background:var(--so-lead);color:var(--so-on-lead)}
.so-dock a:not(.so-dock-primary){background:var(--so-panel-2);border:1px solid var(--so-line)}
@media (max-width:860px){ .so-dock{display:grid} body{padding-bottom:74px} }

/* footer-of-body (skin chrome above core §12.2 footer) */
.so-footer{border-top:1px solid var(--so-line);margin-top:24px;padding:30px 0}
.so-footer-in{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between}
.so-footer .so-brand img{height:26px}
.so-footer-meta{font-family:var(--so-mono);font-size:11px;color:var(--so-muted);letter-spacing:.03em}
.so-footer-meta b{color:var(--ink)}

/* core §12.2 footer — quiet it to match the OS chrome */
.ds-tm{max-width:1120px;margin:0 auto;padding:18px 20px 90px;font-family:var(--so-mono);font-size:11px;
  line-height:1.7;color:var(--so-muted)}
.ds-tm .ds-tm-notice{margin:0 0 4px;max-width:80ch}
.ds-tm .ds-tm-copy{margin:0}
@media (max-width:860px){ .ds-tm{padding-bottom:96px} }

@media (prefers-reduced-motion:reduce){ *{animation:none!important;transition:none!important} }
`;

module.exports = { css };
