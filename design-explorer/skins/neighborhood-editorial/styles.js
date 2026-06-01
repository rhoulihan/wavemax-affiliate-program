'use strict';
/**
 * Direction 2 — "Neighborhood Editorial" stylesheet.
 *
 * Warm, photography-led magazine. A characterful DISPLAY SERIF (Fraunces, with
 * its high-contrast strokes + optical sizing) sets headlines; a clean humanist
 * SANS (Mulish) carries body copy. Deliberately the opposite of Direction 1's
 * dark mono/grotesk bento "OS".
 *
 * One stylesheet renders BOTH intensities by consuming the theme custom props
 * the core injects into :root (--brand, --brand-deep, --accent, --ink, --paper,
 * --lead). `light` leads warm North-Austin terracotta; `heavy` weaves the
 * WaveMAX teal/navy into the editorial frame. We add a few skin-local derived
 * tokens on top.
 *
 * CSP-clean: no <script>, no inline handlers. All interactivity is CSS-only
 * (:target masthead drawer, scroll-snap photo strip, :focus-within desk).
 */

/* Google Fonts — allowed by the explorer CSP (fonts.googleapis.com / gstatic). */
const FONT_LINK = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Mulish:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');`;

const css = `
${FONT_LINK}

/* ============================================================= TOKENS */
:root{
  /* editorial type */
  --ne-display: 'Fraunces', 'Georgia', 'Times New Roman', serif;
  --ne-body: 'Mulish', system-ui, -apple-system, 'Segoe UI', sans-serif;

  /* warm paper system derived from the theme paper, tuned per intensity below */
  --ne-paper: var(--paper);
  --ne-ink: var(--ink);
  --ne-accent: var(--accent);
  --ne-brand: var(--brand);
  --ne-brand-deep: var(--brand-deep);

  /* derived warm neutrals (overridden per data-intensity) */
  --ne-cream: #faf4ec;
  --ne-cream-2: #f3e9da;
  --ne-line: rgba(42,33,28,.16);
  --ne-line-soft: rgba(42,33,28,.10);
  --ne-muted: rgba(42,33,28,.62);
  --ne-rule: var(--ne-ink);

  /* the editorial "lead" — terracotta in light, teal-navy in heavy */
  --ne-lead: var(--accent);
  --ne-lead-ink: #fff;

  --ne-maxw: 1180px;
  --ne-gut: clamp(20px, 5vw, 64px);
  --ne-shadow: 0 1px 0 var(--ne-line), 0 22px 50px -36px rgba(20,12,6,.55);
  --ne-radius: 3px;
}

/* heavy = WaveMAX brand leads. Cooler paper, teal/navy lead, navy ink. */
html[data-intensity="heavy"]{
  --ne-cream: #f7f9fa;
  --ne-cream-2: #eef4f6;
  --ne-line: rgba(11,31,67,.16);
  --ne-line-soft: rgba(11,31,67,.10);
  --ne-muted: rgba(11,31,67,.60);
  --ne-ink: #0b1f43;
  --ne-rule: #0b1f43;
  --ne-lead: var(--brand);          /* teal leads */
  --ne-lead-ink: #ffffff;
  --ne-paper: #ffffff;
}
/* light = warm local leads. Cream paper, terracotta lead, warm-brown ink. */
html[data-intensity="light"]{
  --ne-cream: #faf4ec;
  --ne-cream-2: #f1e4d3;
  --ne-line: rgba(42,33,28,.18);
  --ne-line-soft: rgba(42,33,28,.10);
  --ne-muted: rgba(42,33,28,.64);
  --ne-ink: #2a211c;
  --ne-rule: #2a211c;
  --ne-lead: var(--accent);         /* terracotta leads */
  --ne-lead-ink: #fff7ef;
  --ne-paper: #faf4ec;
}

/* ============================================================= RESET */
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;
  font-family:var(--ne-body);
  color:var(--ne-ink);
  background:var(--ne-paper);
  line-height:1.6;
  font-size:17px;
  font-weight:400;
  -webkit-font-smoothing:antialiased;
  /* faint paper grain via layered radial gradients (no external asset) */
  background-image:
    radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--ne-cream-2) 60%, transparent), transparent 38%),
    radial-gradient(circle at 88% 78%, color-mix(in srgb, var(--ne-cream-2) 45%, transparent), transparent 42%);
  background-attachment:fixed;
}
img{max-width:100%;display:block}
a{color:inherit}
h1,h2,h3,h4{font-family:var(--ne-display);font-weight:600;line-height:1.04;margin:0;
  letter-spacing:-.01em;font-optical-sizing:auto;}
p{margin:0}
::selection{background:var(--ne-lead);color:var(--ne-lead-ink)}
:focus-visible{outline:3px solid var(--ne-lead);outline-offset:3px;border-radius:2px}

/* presentational core hook — hide the brandline text (disclosure lives in §12.2) */
.ds-brandline{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}

.ne-wrap{max-width:var(--ne-maxw);margin:0 auto;padding:0 var(--ne-gut)}

/* ============================================================= MASTHEAD */
.ne-masthead{
  background:var(--ne-paper);
  border-bottom:2px solid var(--ne-rule);
  position:relative;z-index:30;
}
.ne-mast-top{display:flex;align-items:center;gap:18px;
  padding:10px 0;border-bottom:1px solid var(--ne-line-soft);
  font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ne-muted)}
.ne-mast-top b{color:var(--ne-ink);font-weight:700}
.ne-mast-top .ne-mast-spacer{flex:1}
.ne-dot{width:8px;height:8px;border-radius:50%;background:#37b24d;display:inline-block;
  box-shadow:0 0 0 3px color-mix(in srgb,#37b24d 24%, transparent)}
.ne-mast-open{display:inline-flex;align-items:center;gap:7px;color:var(--ne-ink);font-weight:700}

/* logo gets a brand-colored masthead CHIP so the white wordmark stays legible
   on cream/paper backgrounds — required in BOTH intensities. */
.ne-logo-chip{
  display:inline-flex;align-items:center;gap:0;
  background:var(--ne-brand-deep);
  padding:8px 14px;border-radius:var(--ne-radius);
  box-shadow:0 6px 18px -10px color-mix(in srgb,var(--ne-brand-deep) 80%, transparent);
}
html[data-intensity="heavy"] .ne-logo-chip{background:#0b1f43}
html[data-intensity="light"] .ne-logo-chip{background:#23303f} /* dark navy band so white logo reads on cream */
.ne-logo-chip img{height:26px;width:auto;display:block}

.ne-mast-main{display:flex;align-items:flex-end;gap:24px;
  padding:18px 0 16px;flex-wrap:wrap}
.ne-mast-flag{display:flex;align-items:center;gap:16px}
.ne-flag-text{display:flex;flex-direction:column;gap:2px}
.ne-flag-name{font-family:var(--ne-display);font-weight:600;font-size:clamp(26px,4.4vw,40px);
  line-height:.95;letter-spacing:-.02em;color:var(--ne-ink)}
.ne-flag-name em{font-style:italic;color:var(--ne-lead);font-weight:500}
.ne-flag-kicker{font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--ne-muted);font-weight:700}
.ne-mast-main .ne-mast-spacer{flex:1}
.ne-mast-rating{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ne-muted);
  text-align:right;line-height:1.5;display:none}
.ne-mast-rating b{display:block;font-family:var(--ne-display);font-size:18px;letter-spacing:0;
  text-transform:none;color:var(--ne-lead);font-weight:600}
@media(min-width:900px){.ne-mast-rating{display:block}}

/* nav — editorial running heads under a rule */
.ne-nav{border-top:1px solid var(--ne-line);border-bottom:2px solid var(--ne-rule);
  background:var(--ne-paper)}
.ne-nav-in{display:flex;gap:0;align-items:stretch;flex-wrap:wrap}
.ne-nav a{
  font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;
  text-decoration:none;color:var(--ne-ink);
  padding:13px 18px;position:relative;border-right:1px solid var(--ne-line-soft);
  transition:background .18s ease,color .18s ease}
.ne-nav a:first-child{padding-left:0;border-left:0}
.ne-nav a:hover{background:var(--ne-lead);color:var(--ne-lead-ink)}
.ne-nav a[aria-current="page"]{color:var(--ne-lead)}
.ne-nav a[aria-current="page"]:hover{color:var(--ne-lead-ink)}
.ne-nav a[aria-current="page"]::after{content:"";position:absolute;left:18px;right:18px;bottom:6px;
  height:2px;background:var(--ne-lead)}
.ne-nav a:first-child[aria-current="page"]::after{left:0}

/* CSS-only mobile drawer via :target */
.ne-nav-toggle,.ne-nav-close{display:none}
@media(max-width:760px){
  .ne-mast-rating{display:none}
  .ne-nav-toggle{display:inline-flex;align-items:center;gap:8px;
    margin-left:auto;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;
    text-decoration:none;color:var(--ne-ink);border:1.5px solid var(--ne-rule);
    padding:8px 14px;border-radius:var(--ne-radius)}
  .ne-nav{display:none}
  .ne-nav:target{display:block;position:fixed;inset:0;z-index:60;background:var(--ne-paper);
    border:0;overflow:auto;padding:0}
  .ne-nav:target .ne-nav-in{flex-direction:column;padding:24px var(--ne-gut)}
  .ne-nav:target .ne-nav-in a{border:0;border-bottom:1px solid var(--ne-line);
    padding:18px 0;font-size:18px;letter-spacing:.04em}
  .ne-nav:target .ne-nav-in a[aria-current="page"]::after{display:none}
  .ne-nav-close{display:flex;position:absolute;top:18px;right:var(--ne-gut);
    width:42px;height:42px;align-items:center;justify-content:center;
    font-family:var(--ne-display);font-size:28px;line-height:1;text-decoration:none;color:var(--ne-ink)}
}

/* ============================================================= HERO (FEATURE) */
.ne-hero{padding:clamp(34px,6vw,72px) 0 clamp(28px,4vw,46px);position:relative}
.ne-hero-grid{display:grid;gap:clamp(24px,4vw,52px);align-items:end}
@media(min-width:920px){.ne-hero-grid{grid-template-columns:1.05fr .95fr}}
/* Home hero is a 2x2: headline | image (row 1), body text | labels+buttons (row 2).
   Center each row vertically so the image centers with the headline and the
   labels+buttons center with the body text. Banner heroes are unaffected. */
.ne-hero-grid--home{align-items:center;row-gap:clamp(18px,2.6vw,30px)}
.ne-hero-grid--home .ne-byline{margin-top:0}
.ne-hero-grid--home .ne-cta-row{margin-top:18px}
.ne-eyebrow{display:inline-flex;align-items:center;gap:10px;
  font-size:12px;letter-spacing:.24em;text-transform:uppercase;font-weight:800;color:var(--ne-lead)}
.ne-eyebrow::before{content:"";width:30px;height:2px;background:var(--ne-lead)}
.ne-h1{
  font-family:var(--ne-display);font-weight:600;
  font-size:clamp(38px,7vw,76px);line-height:.98;letter-spacing:-.025em;
  margin:18px 0 0;color:var(--ne-ink);text-wrap:balance}
.ne-h1 em{font-style:italic;color:var(--ne-lead);font-weight:500}
.ne-drop::first-letter{
  font-family:var(--ne-display);float:left;font-weight:600;
  font-size:4.1em;line-height:.72;padding:6px 14px 0 0;color:var(--ne-lead)}
.ne-lede{font-size:clamp(18px,2.2vw,21px);line-height:1.62;color:var(--ne-ink);
  max-width:60ch;margin:22px 0 0;font-weight:400}
.ne-lede.ne-drop{margin-top:26px}
.ne-byline{margin-top:20px;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ne-muted);font-weight:700;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ne-byline .ne-tick{color:var(--ne-lead)}

.ne-cta-row{display:flex;flex-wrap:wrap;gap:14px;margin-top:30px}

/* buttons */
.ne-btn{display:inline-flex;align-items:center;gap:10px;
  font-family:var(--ne-body);font-weight:800;font-size:14px;letter-spacing:.04em;
  text-decoration:none;padding:14px 22px;border-radius:var(--ne-radius);
  border:1.5px solid var(--ne-rule);color:var(--ne-ink);background:transparent;
  transition:transform .16s ease,background .16s ease,color .16s ease,box-shadow .16s ease;cursor:pointer}
.ne-btn svg{width:17px;height:17px;flex:none}
.ne-btn:hover{transform:translateY(-2px)}
.ne-btn-primary{background:var(--ne-lead);border-color:var(--ne-lead);color:var(--ne-lead-ink);
  box-shadow:0 14px 30px -16px color-mix(in srgb,var(--ne-lead) 80%, transparent)}
.ne-btn-primary:hover{box-shadow:0 18px 34px -14px color-mix(in srgb,var(--ne-lead) 85%, transparent)}
.ne-btn-ghost:hover{background:var(--ne-ink);color:var(--ne-paper);border-color:var(--ne-ink)}

/* hero photo plate — real photo, duotone-tinted frame */
.ne-plate{position:relative}
.ne-figure{position:relative;margin:0;border:1.5px solid var(--ne-rule);
  border-radius:var(--ne-radius);overflow:hidden;background:var(--ne-cream-2);
  box-shadow:var(--ne-shadow)}
.ne-figure img{width:100%;height:100%;object-fit:cover;display:block;
  filter:saturate(.92) contrast(1.02)}
/* duotone wash so photos harmonize with the palette in both intensities */
.ne-figure::after{content:"";position:absolute;inset:0;mix-blend-mode:multiply;
  background:linear-gradient(180deg,
    color-mix(in srgb,var(--ne-lead) 16%, transparent),
    color-mix(in srgb,var(--ne-brand-deep) 26%, transparent));pointer-events:none}
.ne-figure--tall img{aspect-ratio:3/4}
.ne-figure--wide img{aspect-ratio:4/3}
.ne-figcap{position:absolute;left:0;right:0;bottom:0;z-index:2;
  font-size:12px;letter-spacing:.02em;color:#fff;
  padding:30px 16px 12px;line-height:1.4;
  background:linear-gradient(180deg,transparent,rgba(12,8,4,.78))}
.ne-figcap b{font-weight:800}
.ne-photo-tag{position:absolute;top:12px;left:12px;z-index:2;
  font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;
  background:var(--ne-paper);color:var(--ne-ink);padding:6px 10px;border-radius:2px;
  box-shadow:0 6px 14px -8px rgba(0,0,0,.5)}

/* placeholder photo slot (used when no real asset fits) — clearly intentional */
.ne-figure--ph{display:flex;align-items:center;justify-content:center;min-height:240px}
.ne-figure--ph::before{content:"";position:absolute;inset:0;
  background:
    repeating-linear-gradient(135deg,
      color-mix(in srgb,var(--ne-brand-deep) 18%, var(--ne-cream-2)) 0 14px,
      color-mix(in srgb,var(--ne-lead) 16%, var(--ne-cream-2)) 14px 28px)}
.ne-figure--ph .ne-ph-mark{position:relative;z-index:1;font-family:var(--ne-display);
  font-style:italic;color:var(--ne-ink);opacity:.7;font-size:15px;letter-spacing:.04em;
  background:var(--ne-paper);padding:8px 14px;border-radius:2px}

/* ============================================================= RULES / DIVIDERS */
.ne-rule{border:0;border-top:1px solid var(--ne-line);max-width:var(--ne-maxw);
  margin:0 auto;padding:0 var(--ne-gut)}
.ne-divider{display:flex;align-items:center;gap:16px;color:var(--ne-muted);
  margin:0 auto;max-width:var(--ne-maxw);padding:clamp(28px,4vw,48px) var(--ne-gut)}
.ne-divider::before,.ne-divider::after{content:"";flex:1;height:1px;background:var(--ne-line)}
.ne-divider span{font-size:11px;letter-spacing:.28em;text-transform:uppercase;font-weight:800}
.ne-divider svg{width:14px;height:14px;color:var(--ne-lead)}

/* section scaffolding */
.ne-section{padding:clamp(36px,5vw,64px) 0}
.ne-sec-head{max-width:62ch}
.ne-kicker{font-size:11.5px;letter-spacing:.26em;text-transform:uppercase;font-weight:800;
  color:var(--ne-lead);display:flex;align-items:center;gap:10px}
.ne-kicker::before{content:"§";font-family:var(--ne-display);font-style:italic;
  font-size:16px;letter-spacing:0;opacity:.8}
.ne-sec-title{font-size:clamp(28px,4.4vw,46px);line-height:1.02;margin:14px 0 0;
  letter-spacing:-.02em;color:var(--ne-ink);text-wrap:balance}
.ne-sec-title em{font-style:italic;color:var(--ne-lead);font-weight:500}
.ne-sec-sub{font-size:18px;color:var(--ne-muted);margin:14px 0 0;max-width:56ch;line-height:1.6}

/* ============================================================= STATS (ledger strip) */
.ne-ledger{border-top:2px solid var(--ne-rule);border-bottom:2px solid var(--ne-rule);
  display:grid;grid-template-columns:repeat(2,1fr);background:var(--ne-paper)}
@media(min-width:680px){.ne-ledger{grid-template-columns:repeat(5,1fr)}}
.ne-led-cell{padding:22px 20px;border-right:1px solid var(--ne-line);border-bottom:1px solid var(--ne-line)}
.ne-led-cell:last-child{border-right:0}
@media(min-width:680px){.ne-led-cell{border-bottom:0}}
.ne-led-v{font-family:var(--ne-display);font-weight:600;font-size:clamp(30px,4.5vw,46px);
  line-height:.95;letter-spacing:-.02em;color:var(--ne-lead)}
.ne-led-l{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;
  color:var(--ne-muted);margin-top:10px}

/* ============================================================= COLUMNS (cards as columns) */
.ne-columns{display:grid;gap:clamp(22px,3vw,40px);margin-top:clamp(28px,4vw,44px)}
@media(min-width:760px){.ne-columns{grid-template-columns:repeat(3,1fr)}}
.ne-col{position:relative;padding-top:22px;border-top:2px solid var(--ne-rule)}
.ne-col-no{font-family:var(--ne-display);font-style:italic;font-size:15px;color:var(--ne-lead);
  font-weight:500}
.ne-col h3{font-size:22px;line-height:1.12;margin:10px 0 0;letter-spacing:-.01em}
.ne-col p{color:var(--ne-muted);margin-top:12px;font-size:16px;line-height:1.6}
.ne-col .ne-col-ico{width:24px;height:24px;color:var(--ne-lead);margin-top:14px}

/* ============================================================= STEPS (recipe list) */
.ne-steps{counter-reset:step;margin-top:clamp(26px,4vw,40px);display:grid;gap:0}
.ne-step{display:grid;grid-template-columns:auto 1fr;gap:clamp(18px,3vw,34px);
  padding:clamp(22px,3vw,34px) 0;border-top:1px solid var(--ne-line);align-items:start}
.ne-step:last-child{border-bottom:1px solid var(--ne-line)}
.ne-step-no{counter-increment:step;font-family:var(--ne-display);font-weight:600;
  font-size:clamp(40px,6vw,70px);line-height:.8;color:var(--ne-lead);font-feature-settings:"lnum";
  min-width:1.4ch}
.ne-step-no::before{content:counter(step,decimal-leading-zero)}
.ne-step h3{font-size:clamp(22px,3vw,30px);letter-spacing:-.015em}
.ne-step p{color:var(--ne-muted);margin-top:10px;font-size:17px;max-width:56ch}

/* WDF-only: steps paired with the front-door photo, vertically centered.
   The grid takes over the page wrap; the nested steps <section>/<.ne-wrap>
   are neutralized so the columns align with the rest of the page. */
.ne-wdf-steps{max-width:var(--ne-maxw);margin:0 auto;padding:0 var(--ne-gut);
  display:grid;gap:clamp(24px,4vw,52px);align-items:center}
@media(min-width:880px){.ne-wdf-steps{grid-template-columns:1.15fr .85fr}}
.ne-wdf-steps .ne-section{padding:clamp(36px,5vw,64px) 0}
.ne-wdf-steps .ne-wrap{max-width:none;margin:0;padding:0}
/* photo column: stay vertically centered against the steps on wide screens;
   sits below the steps on mobile (steps then photo for reading flow). */
.ne-wdf-steps-plate{order:2}
@media(min-width:880px){.ne-wdf-steps-plate{order:0}}

/* ============================================================= PROSE / STORY */
.ne-prose{display:grid;gap:clamp(24px,4vw,48px)}
@media(min-width:880px){.ne-prose{grid-template-columns:.85fr 1.15fr;align-items:start}}
.ne-prose-aside{position:relative}
.ne-prose-aside .ne-kicker{margin-bottom:16px}
.ne-prose-body{font-size:clamp(18px,2vw,20px);line-height:1.72;color:var(--ne-ink)}
.ne-prose-body p{margin-bottom:1.1em;max-width:62ch}
.ne-prose-body p:first-of-type::first-letter{
  font-family:var(--ne-display);float:left;font-weight:600;
  font-size:3.6em;line-height:.7;padding:8px 14px 0 0;color:var(--ne-lead)}

/* pull quote — two-column band: quote (vertically centered) | signage photo */
.ne-pull{margin:clamp(28px,4vw,46px) auto;max-width:var(--ne-maxw);padding:0 var(--ne-gut)}
.ne-pull-band{display:grid;gap:clamp(24px,4vw,52px);align-items:center;
  border-top:2px solid var(--ne-rule);border-bottom:2px solid var(--ne-rule)}
@media(min-width:880px){.ne-pull-band{grid-template-columns:1.05fr .95fr}}
.ne-pull-in{padding:clamp(26px,4vw,44px) 0;position:relative}
/* on wide screens give the photo a little breathing room from the top/bottom rules */
@media(min-width:880px){.ne-pull-plate{padding:clamp(22px,3vw,34px) 0}}
.ne-pull blockquote{margin:0;font-family:var(--ne-display);font-style:italic;font-weight:400;
  font-size:clamp(24px,4vw,40px);line-height:1.18;letter-spacing:-.01em;color:var(--ne-ink);
  max-width:24ch}
.ne-pull blockquote::before{content:"\\201C";color:var(--ne-lead);
  font-size:1.1em;margin-right:.04em;line-height:0}
.ne-pull cite{display:block;margin-top:20px;font-style:normal;font-family:var(--ne-body);
  font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--ne-muted)}
.ne-pull cite b{color:var(--ne-lead)}

/* ============================================================= REVIEWS (letters) */
.ne-letters{columns:1;column-gap:clamp(24px,3vw,40px);margin-top:clamp(28px,4vw,40px)}
@media(min-width:680px){.ne-letters{columns:2}}
@media(min-width:1000px){.ne-letters{columns:3}}
.ne-letter{break-inside:avoid;margin:0 0 clamp(20px,3vw,28px);padding:24px 22px;
  background:var(--ne-paper);border:1px solid var(--ne-line);border-radius:var(--ne-radius);
  box-shadow:var(--ne-shadow)}
.ne-letter-stars{color:var(--ne-lead);font-size:15px;letter-spacing:3px}
.ne-letter blockquote{margin:14px 0 0;font-family:var(--ne-display);font-size:19px;line-height:1.4;
  letter-spacing:-.01em;color:var(--ne-ink)}
.ne-letter figcaption{margin-top:16px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ne-muted);font-weight:700}
.ne-letter figcaption b{color:var(--ne-ink);display:block;font-size:13px;letter-spacing:.06em}

/* ============================================================= PHOTO STRIP (scroll-snap) */
.ne-strip{margin:clamp(28px,4vw,46px) 0}
.ne-strip-track{display:grid;grid-auto-flow:column;grid-auto-columns:78%;gap:14px;
  overflow-x:auto;scroll-snap-type:x mandatory;padding:0 var(--ne-gut) 10px;
  -webkit-overflow-scrolling:touch;scrollbar-width:thin}
@media(min-width:760px){.ne-strip-track{grid-auto-columns:minmax(0,1fr);overflow:visible}}
.ne-strip-track > *{scroll-snap-align:start}

/* ============================================================= PRICING (menu card) */
.ne-menu{display:grid;gap:clamp(20px,3vw,32px);margin-top:clamp(26px,4vw,40px)}
@media(min-width:780px){.ne-menu{grid-template-columns:1.1fr .9fr}}
.ne-menu-card{border:1.5px solid var(--ne-rule);border-radius:var(--ne-radius);
  padding:clamp(26px,3.5vw,38px);background:var(--ne-paper);box-shadow:var(--ne-shadow)}
.ne-menu-card--feature{background:var(--ne-lead);color:var(--ne-lead-ink);border-color:var(--ne-lead)}
.ne-menu-card--feature .ne-menu-eyebrow,
.ne-menu-card--feature .ne-menu-price small,
.ne-menu-card--feature li{color:var(--ne-lead-ink)}
.ne-menu-card--feature li::before{color:var(--ne-lead-ink)}
.ne-menu-eyebrow{font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;font-weight:800;color:var(--ne-lead)}
.ne-menu-price{font-family:var(--ne-display);font-weight:600;font-size:clamp(44px,7vw,72px);
  line-height:.9;letter-spacing:-.03em;margin:14px 0 4px}
.ne-menu-price small{font-family:var(--ne-body);font-size:18px;font-weight:700;letter-spacing:0;color:var(--ne-muted)}
.ne-menu-list{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:11px}
.ne-menu-list li{position:relative;padding-left:26px;font-size:16px;line-height:1.45}
.ne-menu-list li::before{content:"\\2014";position:absolute;left:0;color:var(--ne-lead);font-weight:800}

/* ============================================================= NEIGHBORHOOD DESK (concierge stub) */
.ne-desk{margin:clamp(32px,5vw,60px) 0}
.ne-desk-in{border:1.5px solid var(--ne-rule);border-radius:var(--ne-radius);overflow:hidden;
  background:var(--ne-paper);box-shadow:var(--ne-shadow);
  display:grid}
@media(min-width:840px){.ne-desk-in{grid-template-columns:.9fr 1.1fr}}
.ne-desk-copy{padding:clamp(26px,3.5vw,40px);background:var(--ne-cream-2);
  border-bottom:1px solid var(--ne-line)}
@media(min-width:840px){.ne-desk-copy{border-bottom:0;border-right:1px solid var(--ne-line)}}
.ne-desk-copy h2{font-size:clamp(26px,3.4vw,36px);margin:12px 0 0;letter-spacing:-.02em}
.ne-desk-copy p{color:var(--ne-muted);margin-top:14px;font-size:16px;line-height:1.6}
.ne-desk-chat{padding:clamp(22px,3vw,32px);display:flex;flex-direction:column;gap:12px}
.ne-bubble{max-width:84%;padding:13px 16px;border-radius:14px;font-size:15px;line-height:1.45}
.ne-bubble--q{align-self:flex-end;background:var(--ne-lead);color:var(--ne-lead-ink);
  border-bottom-right-radius:4px}
.ne-bubble--a{align-self:flex-start;background:var(--ne-cream-2);color:var(--ne-ink);
  border:1px solid var(--ne-line);border-bottom-left-radius:4px}
.ne-desk-input{display:flex;gap:8px;margin-top:6px;border-top:1px solid var(--ne-line);padding-top:14px;
  transition:box-shadow .2s ease;border-radius:8px}
.ne-desk-input:focus-within{box-shadow:0 0 0 3px color-mix(in srgb,var(--ne-lead) 30%, transparent)}
.ne-desk-input input{flex:1;font-family:var(--ne-body);font-size:14px;padding:12px 14px;
  border:1px solid var(--ne-line);border-radius:8px;background:var(--ne-cream);color:var(--ne-ink)}
.ne-desk-send{font-family:var(--ne-body);font-weight:800;font-size:13px;letter-spacing:.04em;
  padding:0 18px;border-radius:8px;border:0;background:var(--ne-ink);color:var(--ne-paper);cursor:pointer}
.ne-desk-send:disabled{opacity:.55;cursor:progress}
/* empty answer bubble stays out of the layout until the client fills it */
.ne-bubble--a:empty{display:none}
.ne-desk-note{font-size:11.5px;color:var(--ne-muted);margin-top:4px;font-style:italic;
  font-family:var(--ne-display)}

/* ============================================================= CONTACT */
.ne-contact{display:grid;gap:clamp(24px,4vw,44px);margin-top:clamp(24px,3vw,36px)}
@media(min-width:880px){.ne-contact{grid-template-columns:.85fr 1.15fr;align-items:start}}
.ne-nap{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:0}
.ne-nap li{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;
  padding:18px 0;border-top:1px solid var(--ne-line)}
.ne-nap li:last-child{border-bottom:1px solid var(--ne-line)}
.ne-nap-ico{width:26px;height:26px;color:var(--ne-lead)}
.ne-nap-l{font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:var(--ne-muted)}
.ne-nap-v{font-family:var(--ne-display);font-size:19px;line-height:1.3;margin-top:4px;display:block;color:var(--ne-ink)}
.ne-nap-v a{color:inherit;text-decoration:none;border-bottom:2px solid color-mix(in srgb,var(--ne-lead) 50%, transparent)}
.ne-nap-v a:hover{color:var(--ne-lead)}
.ne-map{border:1.5px solid var(--ne-rule);border-radius:var(--ne-radius);overflow:hidden;
  box-shadow:var(--ne-shadow);background:var(--ne-cream-2)}
.ne-map iframe{display:block;width:100%;height:clamp(320px,46vw,520px);border:0;filter:saturate(.9)}

/* form */
.ne-form{margin-top:22px;display:grid;gap:16px}
.ne-form .ne-field{display:grid;gap:7px}
.ne-form label{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:var(--ne-muted)}
.ne-form input,.ne-form textarea{font-family:var(--ne-body);font-size:16px;padding:13px 15px;
  border:1.5px solid var(--ne-line);border-radius:var(--ne-radius);background:var(--ne-paper);color:var(--ne-ink)}
.ne-form input:focus,.ne-form textarea:focus{outline:none;border-color:var(--ne-lead);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--ne-lead) 22%, transparent)}
.ne-form textarea{min-height:130px;resize:vertical}
@media(min-width:560px){.ne-form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}}

/* ============================================================= CLOSING CTA */
.ne-closer{margin:clamp(32px,5vw,60px) 0 0}
/* "Visit us" closer paired with a satellite map: copy left, map right, centered. */
.ne-closer-in--map{display:grid;gap:clamp(22px,3vw,40px);align-items:center}
@media(min-width:860px){.ne-closer-in--map{grid-template-columns:1.1fr .9fr}}
.ne-closer-copy{position:relative;z-index:1}
.ne-closer-map{position:relative;z-index:1;border:1.5px solid rgba(255,255,255,.28);
  border-radius:var(--ne-radius);overflow:hidden;box-shadow:0 22px 44px -28px rgba(0,0,0,.7)}
.ne-closer-map iframe{display:block;width:100%;height:clamp(240px,30vw,330px);border:0;filter:saturate(.95)}
.ne-closer-in{background:var(--ne-brand-deep);color:#fff;border-radius:var(--ne-radius);
  padding:clamp(34px,5vw,60px);position:relative;overflow:hidden;
  box-shadow:0 30px 60px -40px rgba(0,0,0,.6)}
html[data-intensity="light"] .ne-closer-in{background:#23211d}
.ne-closer-in::after{content:"";position:absolute;right:-10%;top:-40%;width:60%;height:180%;
  background:radial-gradient(circle,color-mix(in srgb,var(--ne-lead) 60%, transparent),transparent 62%);
  opacity:.5;pointer-events:none}
.ne-closer .ne-eyebrow{color:color-mix(in srgb,var(--ne-lead) 78%, #fff)}
.ne-closer .ne-eyebrow::before{background:color-mix(in srgb,var(--ne-lead) 78%, #fff)}
.ne-closer h2{font-size:clamp(28px,4.6vw,48px);margin:16px 0 0;color:#fff;max-width:18ch;
  letter-spacing:-.02em;position:relative}
.ne-closer p{color:rgba(255,255,255,.82);margin-top:14px;font-size:18px;max-width:52ch;position:relative}
.ne-closer .ne-cta-row{position:relative}
.ne-closer .ne-btn-ghost{border-color:rgba(255,255,255,.5);color:#fff}
.ne-closer .ne-btn-ghost:hover{background:#fff;color:var(--ne-ink)}

/* ============================================================= COLOPHON (body footer) */
.ne-colophon{border-top:2px solid var(--ne-rule);margin-top:clamp(40px,6vw,72px)}
.ne-colophon-in{display:flex;flex-wrap:wrap;align-items:center;gap:18px;padding:26px 0}
.ne-colophon .ne-logo-chip{flex:none}
.ne-colo-text{font-size:13px;color:var(--ne-muted);line-height:1.5;max-width:54ch}
.ne-colo-text b{color:var(--ne-ink);font-weight:800}
.ne-colophon .ne-mast-spacer{flex:1;min-width:20px}
.ne-colo-own{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;
  color:var(--ne-lead);text-align:right}

/* ============================================================= §12.2 core footer restyle */
.ds-tm{max-width:var(--ne-maxw);margin:0 auto;padding:24px var(--ne-gut) 56px;
  border-top:1px solid var(--ne-line);color:var(--ne-muted);font-size:11.5px;line-height:1.55}
.ds-tm-notice{max-width:90ch}
.ds-tm-copy{margin-top:8px;font-family:var(--ne-display);font-style:italic}

/* reduced motion */
@media(prefers-reduced-motion:reduce){
  *{transition:none!important;scroll-behavior:auto!important}
}
`;

module.exports = { css };
