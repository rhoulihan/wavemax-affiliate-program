'use strict';
/**
 * Direction 3 — "RUNDBERG PRESS" stylesheet (austin-bold).
 *
 * A gig-poster / risograph broadside. ALL texture is gradient + SVG-data-URI
 * (no raster). Misregistered overprint headlines = layered text-shadow copies
 * over a multiply-blended halftone dot screen. The brand WAVE is the literal
 * seam between full-bleed color bands.
 *
 * Two intensities swap which "press plates" (inks) are loaded by overriding a
 * handful of skin-local tokens under html[data-intensity="…"]. The geometry is
 * identical; only the plates change.
 *
 * CONTRAST RULE: paragraph / body copy ALWAYS sits on a solid paper/ink token
 * pair (--ap-paper / --ap-ink), NEVER directly on the halftone/grain layers
 * (those are -1 z-index, aria-hidden, behind solid panels). Display poster type
 * may be loud; running text holds WCAG-AA.
 *
 * CSP-clean: no <script>, no inline handlers; the only @import is the CSP-allowed
 * Google Fonts CSS, and the only data: URIs are img-src-allowed SVG textures.
 */

/* Google Fonts — allowed by the explorer CSP (style-src fonts.googleapis.com,
   font-src fonts.gstatic.com). Hanken Grotesk carries full latin-ext for the
   es/pt/de diacritics in running copy. */
const FONT_LINK = `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Big+Shoulders+Display:wght@600;700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&display=swap');`;

/* Re-usable SVG fractalNoise grain (data URI; opacity tuned in CSS). */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const css = `
${FONT_LINK}

/* ============================================================ TOKENS */
:root{
  --ap-display:'Anton','Arial Narrow',sans-serif;
  --ap-stamp:'Big Shoulders Display','Arial Narrow',sans-serif;
  --ap-kick:'Bricolage Grotesque','Hanken Grotesk',sans-serif;
  --ap-body:'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif;

  /* shared brand hit (the teal plate) — same in both intensities */
  --ap-teal:#0C93AD;
  --ap-navy:#0A2A3A;

  /* default = HEAVY plates (brand leads); LIGHT overrides below */
  --ap-paper:#F4EFE4;          /* warm newsprint */
  --ap-paper-2:#ECE3D1;
  --ap-ink:#0A2A3A;            /* near-navy ink */
  --ap-plate-a:#0C93AD;        /* dominant plate A (teal) */
  --ap-plate-b:#0A2A3A;        /* dominant plate B (deep navy) */
  --ap-hot:#FF4D23;            /* hot accent — stamps/CTAs */
  --ap-hot-ink:#FFF3EE;        /* readable ink ON hot */
  --ap-mis-a:var(--ap-hot);    /* misregistration copy A */
  --ap-mis-b:var(--ap-teal);   /* misregistration copy B */
  --ap-dark-band:#0A2A3A;      /* UV headliner band ground */
  --ap-dark-ink:#F4EFE4;
  --ap-seal-line:rgba(10,42,58,.85);

  /* storefront-relief duotone plates (default = HEAVY: navy ground + teal accent) */
  --ap-relief-a:#0A2A3A;       /* dominant photo plate (shadows) */
  --ap-relief-b:#0C93AD;       /* accent photo plate (highlights) */
  --ap-relief-paper:#F4EFE4;   /* the plate "stock" tint behind the photo */

  /* halftone dot screens (gradient only) */
  --ap-dot:rgba(10,42,58,.16);
  --ap-dot-2:rgba(12,147,173,.18);

  --ap-line:rgba(10,42,58,.22);
  --ap-muted:rgba(10,42,58,.66);

  --ap-maxw:1220px;
  --ap-gut:clamp(18px,5vw,56px);
  --ap-rail:46px;               /* width reserved for the vertical ticker rail */
}

/* HEAVY = brand LEADS. (defaults above already encode heavy; restated for clarity) */
html[data-intensity="heavy"]{
  --ap-paper:#F4EFE4; --ap-paper-2:#E9DFCB;
  --ap-ink:#0A2A3A;
  --ap-plate-a:#0C93AD; --ap-plate-b:#0A2A3A;
  --ap-hot:#FF4D23; --ap-hot-ink:#FFF3EE;
  --ap-mis-a:#FF4D23; --ap-mis-b:#0C93AD;
  --ap-dark-band:#0A2A3A; --ap-dark-ink:#F4EFE4;
  --ap-dot:rgba(10,42,58,.15); --ap-dot-2:rgba(12,147,173,.20);
  --ap-line:rgba(10,42,58,.22); --ap-muted:rgba(10,42,58,.66);
  --ap-seal-line:rgba(10,42,58,.85);
  /* heavy plates lead the relief: teal + navy duotone */
  --ap-relief-a:#0A2A3A; --ap-relief-b:#0C93AD; --ap-relief-paper:#F4EFE4;
}
/* LIGHT = local LEADS, brand recedes to ONE teal hit (seals/rule/chip). Dusk
   magenta + marigold lead on sun-bleached kraft; warm near-black ink. */
html[data-intensity="light"]{
  --ap-paper:#F2E7D2; --ap-paper-2:#E7D7B8;
  --ap-ink:#241A12;
  --ap-plate-a:#C2306B;          /* dusk magenta plate */
  --ap-plate-b:#E8A33D;          /* marigold plate */
  --ap-hot:#C2306B;              /* hot = magenta in light */
  --ap-hot-ink:#FFF1F5;
  --ap-mis-a:#C2306B; --ap-mis-b:#E8A33D;
  --ap-dark-band:#241A12; --ap-dark-ink:#F2E7D2;
  --ap-dot:rgba(36,26,18,.16); --ap-dot-2:rgba(194,48,107,.18);
  --ap-line:rgba(36,26,18,.24); --ap-muted:rgba(36,26,18,.68);
  --ap-seal-line:rgba(36,26,18,.85);
  /* light plates lead the relief: dusk-magenta + marigold duotone on sun-bleached kraft */
  --ap-relief-a:#C2306B; --ap-relief-b:#E8A33D; --ap-relief-paper:#F2E7D2;
}

/* ============================================================ RESET */
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{
  margin:0;
  background:var(--ap-paper);
  color:var(--ap-ink);
  font-family:var(--ap-body);
  font-size:clamp(16px,1.05vw,18px);
  line-height:1.62;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}
img{max-width:100%;display:block}
a{color:inherit}
.ap-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
:focus-visible{outline:3px solid var(--ap-hot);outline-offset:3px}
html[data-intensity="light"] :focus-visible{outline-color:var(--ap-plate-a)}

.ap-skip{position:absolute;left:-999px;top:0;z-index:60;background:var(--ap-navy);color:#fff;
  padding:10px 16px;font:700 14px/1 var(--ap-stamp);letter-spacing:.04em;text-decoration:none}
.ap-skip:focus{left:8px;top:8px}

.ap-wrap{width:100%;max-width:var(--ap-maxw);margin-inline:auto;padding-inline:var(--ap-gut)}

/* hide the core's presentational brandline; our masthead carries the identity */
.ds-brandline{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* ============================================ TEXTURE LAYERS (behind solids) */
/* Halftone dot screen — gradient only, multiply-blended onto a band ground.
   Always z-index:0 / behind solid content panels; aria-hidden in markup. */
.ap-grain{
  position:absolute;inset:0;z-index:0;pointer-events:none;
  background-image:${GRAIN};
  background-size:160px 160px;
  opacity:.07;mix-blend-mode:multiply;
}
html[data-intensity="light"] .ap-grain{opacity:.09}

/* ============================================================ THE CHIP */
/* white WaveMAX wordmark on a solid NAVY chip — white-on-navy is ~16:1 and reads
   cleanly (white-on-teal was ~2.3:1 and unreadable). Teal offset shadow = the second
   "plate" (the misregistration hit). Legible in BOTH intensities. */
.ap-chip{display:inline-flex;align-items:center;justify-content:center;
  background:var(--ap-navy);padding:6px 10px;border-radius:3px;
  box-shadow:3px 3px 0 var(--ap-teal);line-height:0}
.ap-chip img{height:24px;width:auto;display:block;filter:brightness(0) invert(1)}

/* ============================================================ MASTHEAD */
.ap-mast{position:relative;z-index:30;background:var(--ap-paper);
  border-bottom:4px solid var(--ap-ink)}
.ap-mast-in{display:flex;align-items:center;gap:18px;min-height:64px;flex-wrap:wrap}
.ap-mast-brand{display:inline-flex;align-items:center;gap:12px;text-decoration:none}
.ap-mast-name{font:800 26px/1 var(--ap-stamp);letter-spacing:.06em;color:var(--ap-ink);
  text-transform:uppercase}
.ap-nav{display:flex;gap:4px 16px;flex-wrap:wrap;margin-inline-start:auto}
.ap-nav a{font:700 14px/1 var(--ap-stamp);letter-spacing:.05em;text-transform:uppercase;
  text-decoration:none;color:var(--ap-ink);padding:6px 4px;border-bottom:3px solid transparent}
.ap-nav a:hover{border-color:var(--ap-hot)}
.ap-nav a[aria-current="page"]{border-color:var(--ap-plate-a)}
.ap-mast-open{display:inline-flex;align-items:center;gap:8px;font:800 12px/1 var(--ap-stamp);
  letter-spacing:.08em;text-transform:uppercase;background:var(--ap-hot);color:var(--ap-hot-ink);
  padding:8px 12px;border-radius:3px;transform:rotate(-2deg);box-shadow:2px 2px 0 var(--ap-ink)}
.ap-blink{width:9px;height:9px;border-radius:50%;background:var(--ap-hot-ink);
  animation:ap-blink 1.6s steps(1) infinite}
@keyframes ap-blink{50%{opacity:.25}}

/* ============================================================ VERTICAL TICKER */
.ap-ticker{position:fixed;left:0;top:0;bottom:0;width:var(--ap-rail);z-index:25;
  background:var(--ap-ink);color:var(--ap-paper);
  display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
  padding-block:14px;overflow:hidden;border-right:3px solid var(--ap-hot)}
.ap-tick-label{writing-mode:vertical-rl;font:800 12px/1 var(--ap-stamp);letter-spacing:.22em;
  text-transform:uppercase;margin-bottom:14px;color:var(--ap-plate-a)}
html[data-intensity="light"] .ap-tick-label{color:var(--ap-plate-b)}
.ap-tick-track{flex:1;writing-mode:vertical-rl;overflow:hidden;position:relative}
.ap-tick-run{display:block;animation:ap-tick 26s linear infinite}
.ap-tick-item{font:800 13px/1 var(--ap-stamp);letter-spacing:.16em;text-transform:uppercase}
.ap-tick-dot{color:var(--ap-hot);padding-block:10px;font-size:9px}
@keyframes ap-tick{from{transform:translateY(0)}to{transform:translateY(-50%)}}
@media (prefers-reduced-motion:reduce){.ap-tick-run{animation:none}.ap-blink{animation:none}}

/* the poster document is inset to clear the fixed ticker rail */
.ap-poster-doc{margin-left:var(--ap-rail)}
.ap-colophon{margin-left:var(--ap-rail)}

/* ============================================================ BANDS / SNAP */
.ap-band{position:relative;padding-block:clamp(54px,8vw,104px);
  scroll-snap-align:start;overflow:hidden}
.ap-band>.ap-wrap{position:relative;z-index:2}
.ap-poster-doc{scroll-snap-type:y proximity}
/* alternating band grounds = the "plates" overprinting newsprint */
.ap-band--stats{background:var(--ap-paper-2)}
.ap-band--bills{background:var(--ap-paper)}
.ap-band--steps{background:var(--ap-paper-2)}
.ap-band--ledger{background:var(--ap-paper)}
.ap-band--posters{background:var(--ap-paper-2)}
.ap-band--clips{background:var(--ap-paper)}
.ap-band--hours{background:var(--ap-paper-2)}
.ap-band--contact{background:var(--ap-paper-2)}
.ap-band--prose{background:var(--ap-paper)}

/* ============================================================ WAVE SEAM */
/* the brand wave promoted to the structural divider between bands */
.ap-seam{position:relative;line-height:0;height:clamp(26px,4vw,52px);z-index:3;
  background:transparent;margin-top:-1px}
.ap-seam svg{display:block;width:100%;height:100%}
.ap-seam svg path{fill:var(--ap-plate-a)}
.ap-seam--flip{transform:scaleY(-1)}
.ap-seam--flip svg path{fill:var(--ap-plate-b)}
html[data-intensity="light"] .ap-seam svg path{fill:var(--ap-plate-a)}
html[data-intensity="light"] .ap-seam--flip svg path{fill:var(--ap-plate-b)}

/* ============================================================ TYPE: POSTER H2 */
/* misregistered overprint = two offset color copies via text-shadow on a
   halftone-screened ground. The dot screen lives in ::before BEHIND the text. */
.ap-h2{position:relative;font-family:var(--ap-display);font-weight:400;
  font-size:clamp(34px,6vw,70px);line-height:.92;letter-spacing:.005em;
  text-transform:uppercase;color:var(--ap-ink);margin:0 0 .35em;
  text-shadow:.045em .03em 0 var(--ap-mis-a), -.03em -.025em 0 var(--ap-mis-b)}
.ap-h2::before{content:"";position:absolute;inset:-.1em -.2em;z-index:-1;
  background-image:radial-gradient(var(--ap-dot-2) 28%,transparent 29%);
  background-size:9px 9px;opacity:.6;pointer-events:none}
.ap-h3{font-family:var(--ap-stamp);font-weight:800;text-transform:uppercase;
  letter-spacing:.02em;font-size:clamp(22px,3vw,30px);line-height:1.02;
  color:var(--ap-ink);margin:0 0 16px}

.ap-kicker{display:inline-block;font:800 13px/1 var(--ap-stamp);letter-spacing:.18em;
  text-transform:uppercase;color:var(--ap-hot);
  border:2px solid currentColor;padding:6px 10px;border-radius:2px;transform:rotate(-1deg)}
.ap-kicker--invert{color:var(--ap-plate-a)}
.ap-sub{font-family:var(--ap-kick);font-size:clamp(16px,1.6vw,20px);font-weight:500;
  color:var(--ap-muted);max-width:60ch;margin:14px 0 0}
.ap-band-head{margin-bottom:clamp(26px,4vw,44px)}
.ap-band-head .ap-kicker{margin-bottom:18px}

/* ============================================================ HERO MARQUEE */
.ap-band--hero{background:
  linear-gradient(180deg,var(--ap-paper),var(--ap-paper-2));
  padding-top:clamp(40px,6vw,72px)}
.ap-hero-wrap{position:relative;z-index:2}
.ap-hero-kicker{display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  font:700 13px/1.3 var(--ap-stamp);letter-spacing:.14em;text-transform:uppercase;
  color:var(--ap-muted);margin:0 0 10px}
.ap-hero-rule{flex:1;min-width:30px;height:3px;background:var(--ap-plate-a)}

/* the PAINTED per-language hero word — the giant overprinted display element.
   Misregistration via stacked text-shadow plates; a halftone screen behind. */
.ap-hero-word{position:relative;font-family:var(--ap-display);font-weight:400;
  font-size:clamp(84px,21vw,260px);line-height:.82;letter-spacing:-.01em;
  text-transform:uppercase;color:var(--ap-plate-b);margin:.04em 0 .06em;
  word-break:break-word;
  text-shadow:
    .035em .03em 0 var(--ap-mis-a),
    -.022em -.018em 0 var(--ap-plate-a)}
.ap-hero-word::before{content:attr(data-word);position:absolute;inset:0;z-index:-1;
  color:transparent;
  background-image:radial-gradient(var(--ap-dot) 30%,transparent 31%);
  background-size:11px 11px;-webkit-background-clip:text;background-clip:text;
  transform:translate(.06em,.05em);opacity:.9;pointer-events:none}
html[data-intensity="light"] .ap-hero-word{color:var(--ap-plate-b)}

.ap-hero-title{font-family:var(--ap-kick);font-weight:800;
  font-size:clamp(20px,2.6vw,32px);line-height:1.08;color:var(--ap-ink);
  margin:0 0 12px;max-width:24ch;text-wrap:balance}
.ap-hero-sub{font-size:clamp(16px,1.5vw,19px);color:var(--ap-ink);max-width:62ch;
  margin:0 0 24px;line-height:1.6}

/* ---- HOME hero: 2-column split (content left, storefront relief right) ----
   single column by default (mobile / inner pages); becomes 2-col at >=900px. */
.ap-hero-wrap--split{display:block}
@media (min-width:900px){
  .ap-hero-wrap--split{display:grid;
    grid-template-columns:minmax(0,1.32fr) minmax(300px,.78fr);
    gap:clamp(28px,4vw,64px);align-items:center}
}

/* ---- the storefront RELIEF (CSS-only duotone + halftone screenprint plate) ----
   On mobile it stacks under the hero content (the painted word stays the star);
   the column layout above promotes it into the right column at >=900px. */
.ap-relief{position:relative;margin:34px 0 0;max-width:520px}
@media (min-width:900px){.ap-relief{margin:0;justify-self:end;width:100%}}

/* the plate = the dominant ink (--ap-relief-a) on the stock tint; the photo and
   accent plate are blended ONTO this ground. A poster frame + misregistration nudge. */
.ap-relief-plate{position:relative;overflow:hidden;
  aspect-ratio:4/3;isolation:isolate;
  background:var(--ap-relief-paper);
  border:3px solid var(--ap-ink);border-radius:4px;
  box-shadow:9px 9px 0 var(--ap-relief-a);
  transform:rotate(-1.1deg)}
.ap-relief-plate::before{content:"";position:absolute;inset:0;z-index:1;
  background:var(--ap-relief-a);mix-blend-mode:normal;opacity:.96}

/* the photo: grayscale + punchy contrast, multiplied over the dominant plate so
   the ink only shows through the photo's tonal values (the duotone "dark" plate). */
.ap-relief-img{position:absolute;inset:0;width:100%;height:100%;z-index:2;
  object-fit:cover;
  filter:grayscale(1) contrast(1.28) brightness(1.08);
  mix-blend-mode:screen}

/* accent plate: the SECOND ink flushed into the highlights, offset ~6px = the
   misregistration hit that sells the screenprint. lighten keeps it to the lights. */
.ap-relief-plate::after{content:"";position:absolute;inset:0;z-index:3;
  background:linear-gradient(160deg,var(--ap-relief-b),transparent 62%);
  mix-blend-mode:lighten;opacity:.55;transform:translate(6px,5px);pointer-events:none}

/* halftone dot screen + grain, multiplied on top = the printed-dot texture. Reuses
   the codebase --ap-dot radial pattern and the shared SVG GRAIN data-URI. */
.ap-relief-screen{position:absolute;inset:0;z-index:4;pointer-events:none;
  background-image:
    radial-gradient(var(--ap-dot) 30%,transparent 31%),
    ${GRAIN};
  background-size:6px 6px,160px 160px;
  mix-blend-mode:multiply;opacity:.5}
html[data-intensity="light"] .ap-relief-screen{opacity:.42}
/* a thin top seam rule = the plate registration edge */
.ap-relief-screen::after{content:"";position:absolute;left:0;right:0;top:0;
  height:3px;background:var(--ap-relief-b);opacity:.7}

/* rotated address seal tucked on the corner */
.ap-relief-cap{position:absolute;right:-8px;bottom:-14px;z-index:5;
  display:flex;flex-direction:column;align-items:flex-end;gap:5px;transform:rotate(-2.4deg)}
.ap-relief-stamp{font:800 10px/1 var(--ap-stamp);letter-spacing:.16em;text-transform:uppercase;
  color:var(--ap-hot-ink);background:var(--ap-hot);padding:5px 9px;border-radius:2px;
  box-shadow:2px 2px 0 var(--ap-ink);transform:rotate(2deg)}
.ap-relief-addr{font:800 12px/1 var(--ap-stamp);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ap-ink);background:var(--ap-relief-paper);border:2.5px solid var(--ap-ink);
  padding:7px 11px;border-radius:2px;box-shadow:3px 3px 0 var(--ap-relief-b)}
@media (prefers-reduced-motion:reduce){.ap-relief-plate{transform:none}}

/* language stamp row (display-only) */
.ap-langrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:22px 0 0}
.ap-langrow-l{font:700 12px/1 var(--ap-stamp);letter-spacing:.14em;text-transform:uppercase;
  color:var(--ap-muted)}
.ap-langstamp{font:800 13px/1 var(--ap-stamp);letter-spacing:.06em;padding:6px 9px;border-radius:2px;
  border:2px solid var(--ap-line);color:var(--ap-muted);transform:rotate(-2deg)}
.ap-langstamp:nth-child(even){transform:rotate(2deg)}
.ap-langstamp.is-active{background:var(--ap-plate-a);color:#fff;border-color:var(--ap-plate-a);
  box-shadow:2px 2px 0 var(--ap-ink)}

/* ============================================================ SEALS / STAMPS */
.ap-seals{display:flex;flex-wrap:wrap;gap:14px 18px;align-items:center;margin:8px 0 0}
.ap-seal{position:relative;font-family:var(--ap-stamp);font-weight:800;letter-spacing:.06em;
  text-transform:uppercase;transform:rotate(var(--rot,-2deg));
  color:var(--ap-ink);border:2.5px solid currentColor;background:transparent}
.ap-seal--rect{font-size:13px;padding:8px 12px;border-radius:2px;
  border-style:dashed;box-shadow:3px 3px 0 currentColor}
.ap-seal--rect::after{content:"";position:absolute;inset:3px;border:1px solid currentColor;opacity:.4;border-radius:1px}
.ap-seal--round{width:96px;height:96px;border-radius:50%;display:inline-flex;align-items:center;
  justify-content:center;text-align:center;font-size:11px;line-height:1.05;padding:10px;
  border-style:double;border-width:5px}
.ap-seal--round .ap-seal-in{display:block;max-width:74px}
.ap-seal--ink{color:var(--ap-ink)}
.ap-seal--accent{color:var(--ap-plate-a)}
.ap-seal--deep{color:var(--ap-plate-b)}
.ap-seal--hot{color:var(--ap-hot)}

/* ============================================================ BUTTONS */
.ap-actions{display:flex;flex-wrap:wrap;gap:14px}
.ap-btn{display:inline-flex;align-items:center;gap:9px;font:800 15px/1 var(--ap-stamp);
  letter-spacing:.04em;text-transform:uppercase;text-decoration:none;
  padding:14px 20px;border:3px solid var(--ap-ink);background:var(--ap-paper);
  color:var(--ap-ink);border-radius:3px;box-shadow:4px 4px 0 var(--ap-ink);
  transition:transform .08s ease,box-shadow .08s ease}
.ap-btn svg{width:18px;height:18px;flex:none}
.ap-btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ap-ink)}
.ap-btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ap-ink)}
.ap-btn--hot{background:var(--ap-hot);color:var(--ap-hot-ink);border-color:var(--ap-ink)}

/* ============================================================ STATS STAMPS */
.ap-stats{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 0;
  border-block:4px solid var(--ap-ink);padding-block:22px}
.ap-stat{flex:1 1 140px;text-align:center;padding-inline:14px}
.ap-stat-v{display:block;font-family:var(--ap-display);font-size:clamp(34px,5vw,58px);
  line-height:1;color:var(--ap-plate-b);
  text-shadow:.02em .02em 0 var(--ap-mis-a)}
.ap-stat-l{display:block;margin-top:8px;font:700 12px/1.2 var(--ap-stamp);letter-spacing:.1em;
  text-transform:uppercase;color:var(--ap-muted)}
.ap-stat-perf{flex:0 0 0;align-self:stretch;border-left:3px dashed var(--ap-line)}

/* ============================================================ SERVICE SHOW-BILLS */
.ap-bills{position:relative}
.ap-bill-tabs{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.ap-bill-tab{cursor:pointer;font:800 14px/1 var(--ap-stamp);letter-spacing:.03em;
  text-transform:uppercase;padding:11px 15px;border:3px solid var(--ap-ink);border-radius:3px;
  background:var(--ap-paper);box-shadow:3px 3px 0 var(--ap-ink);display:inline-flex;gap:8px;align-items:center}
.ap-bill-no{color:var(--ap-hot);font-size:16px}
.ap-bill-tab:hover{background:var(--ap-paper-2)}
.ap-bill-stage{position:relative}
.ap-bill-panel{display:none;position:relative;background:var(--ap-paper);
  border:3px solid var(--ap-ink);border-radius:4px;padding:clamp(22px,3.5vw,40px);
  box-shadow:8px 8px 0 var(--ap-plate-a);transform:rotate(-.8deg)}
html[data-intensity="light"] .ap-bill-panel{box-shadow:8px 8px 0 var(--ap-plate-b)}
.ap-bill-title{font-family:var(--ap-display);font-weight:400;text-transform:uppercase;
  font-size:clamp(26px,4vw,46px);line-height:.96;color:var(--ap-ink);margin:0 0 12px}
.ap-bill-body{color:var(--ap-ink);max-width:60ch;margin:0 0 16px}
/* CSS-only switcher: each checked radio reveals its panel by document order */
.ap-bill-radio:nth-of-type(1):checked~.ap-bill-stage .ap-bill-panel:nth-of-type(1),
.ap-bill-radio:nth-of-type(2):checked~.ap-bill-stage .ap-bill-panel:nth-of-type(2),
.ap-bill-radio:nth-of-type(3):checked~.ap-bill-stage .ap-bill-panel:nth-of-type(3){display:block}
.ap-bill-radio:nth-of-type(1):checked~.ap-bill-tabs label:nth-of-type(1),
.ap-bill-radio:nth-of-type(2):checked~.ap-bill-tabs label:nth-of-type(2),
.ap-bill-radio:nth-of-type(3):checked~.ap-bill-tabs label:nth-of-type(3){background:var(--ap-hot);color:var(--ap-hot-ink);border-color:var(--ap-ink)}
.ap-bill-radio:checked~.ap-bill-tabs label:nth-of-type(1) .ap-bill-no,
.ap-bill-radio:checked~.ap-bill-tabs label:nth-of-type(2) .ap-bill-no,
.ap-bill-radio:checked~.ap-bill-tabs label:nth-of-type(3) .ap-bill-no{color:inherit}
.ap-bill-radio:focus-visible~.ap-bill-tabs label{outline:3px solid var(--ap-hot);outline-offset:2px}

.ap-link{display:inline-flex;align-items:center;gap:7px;font:800 14px/1 var(--ap-stamp);
  letter-spacing:.05em;text-transform:uppercase;text-decoration:none;color:var(--ap-ink);
  border-bottom:3px solid var(--ap-hot);padding-bottom:3px}
.ap-link svg{width:16px;height:16px}
.ap-link:hover{color:var(--ap-hot)}

/* tape corners */
.ap-tape{position:absolute;width:64px;height:22px;background:rgba(255,255,255,.42);
  border:1px dashed rgba(10,42,58,.3);transform:rotate(-30deg)}
html[data-intensity="light"] .ap-tape{border-color:rgba(36,26,18,.3)}
.ap-tape--tl{top:-10px;left:-14px}
.ap-tape--br{bottom:-10px;right:-14px;transform:rotate(-30deg)}

/* ============================================================ TORN TICKETS (steps) */
.ap-tickets{list-style:none;margin:0;padding:0;display:grid;gap:20px;
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.ap-ticket{position:relative;background:var(--ap-paper);border:3px solid var(--ap-ink);
  border-radius:4px;padding:26px 24px 24px;box-shadow:5px 5px 0 var(--ap-ink)}
.ap-ticket::before{content:"";position:absolute;left:18px;right:18px;top:-2px;height:8px;
  background-image:radial-gradient(circle at 6px 0,transparent 5px,var(--ap-paper-2) 5px);
  background-size:12px 8px;background-position:0 -4px}
.ap-ticket-no{position:absolute;top:-18px;right:18px;font-family:var(--ap-display);
  font-size:46px;line-height:1;color:var(--ap-plate-a);
  text-shadow:.03em .03em 0 var(--ap-mis-a)}
.ap-ticket-title{font-family:var(--ap-stamp);font-weight:800;text-transform:uppercase;
  font-size:21px;line-height:1.05;color:var(--ap-ink);margin:0 0 10px;letter-spacing:.01em}
.ap-ticket-body{color:var(--ap-ink);margin:0}

/* ============================================================ PASTED POSTERS (cards) */
.ap-posters{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.ap-poster{position:relative;background:var(--ap-paper);border:3px solid var(--ap-ink);
  border-radius:4px;padding:30px 26px 26px;box-shadow:6px 6px 0 var(--ap-plate-b);
  transform:rotate(calc((var(--i) - 1) * 1.4deg));outline:none;
  transition:transform .12s ease,box-shadow .12s ease}
html[data-intensity="light"] .ap-poster{box-shadow:6px 6px 0 var(--ap-plate-a)}
.ap-poster:hover,.ap-poster:focus-within,.ap-poster:focus{transform:rotate(0deg) translate(-3px,-4px);
  box-shadow:10px 12px 0 var(--ap-hot)}
.ap-poster-no{position:absolute;top:14px;right:18px;font-family:var(--ap-display);font-size:34px;
  line-height:1;color:var(--ap-line)}
.ap-poster-title{font-family:var(--ap-stamp);font-weight:800;text-transform:uppercase;
  font-size:20px;line-height:1.05;color:var(--ap-ink);margin:0 0 12px;max-width:18ch;letter-spacing:.01em}
.ap-poster-body{color:var(--ap-ink);margin:0}

/* ============================================================ PROSE COLUMN */
.ap-column{max-width:66ch}
.ap-dropcap{color:var(--ap-ink);font-size:clamp(17px,1.5vw,19px);line-height:1.66;margin:0}
.ap-dropcap::first-letter{font-family:var(--ap-display);float:left;font-size:4.6em;line-height:.74;
  padding:.04em .1em 0 0;color:var(--ap-hot)}

/* ============================================================ PRICE LEDGER */
.ap-ledger{position:relative;background:var(--ap-paper);border:4px solid var(--ap-ink);
  border-radius:5px;padding:clamp(22px,3.5vw,44px);box-shadow:8px 8px 0 var(--ap-ink);max-width:920px}
.ap-ledger-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 26px}
.ap-ledger-name{flex:1 1 240px}
.ap-ledger-name .ap-kicker{margin-bottom:10px}
.ap-ledger-foot{font:500 14px/1.4 var(--ap-kick);color:var(--ap-muted);margin:0;max-width:42ch}
.ap-ledger-price{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.ap-num{font-family:var(--ap-display);font-variant-numeric:tabular-nums;
  font-size:clamp(40px,7vw,82px);line-height:.9;color:var(--ap-plate-b);
  text-shadow:.025em .025em 0 var(--ap-mis-a)}
.ap-num--big{font-size:clamp(56px,9vw,110px);color:var(--ap-hot);
  text-shadow:.022em .022em 0 var(--ap-plate-b)}
.ap-num-to{font-family:var(--ap-display);font-size:clamp(26px,4vw,48px);color:var(--ap-muted)}
.ap-ledger-unit{font:800 13px/1 var(--ap-stamp);letter-spacing:.1em;text-transform:uppercase;
  color:var(--ap-muted);align-self:flex-end;margin-bottom:8px}
.ap-perf{height:0;border-top:3px dashed var(--ap-line);margin:22px 0;position:relative}
.ap-perf::before,.ap-perf::after{content:"";position:absolute;top:-12px;width:22px;height:22px;
  border-radius:50%;background:var(--ap-paper-2)}
.ap-perf::before{left:-26px}.ap-perf::after{right:-26px}
.ap-ledger-stub{position:absolute;top:14px;right:16px;font:800 11px/1 var(--ap-stamp);
  letter-spacing:.18em;text-transform:uppercase;color:var(--ap-muted);transform:rotate(90deg);
  transform-origin:right top}

/* ============================================================ REVIEW CLIPPINGS */
.ap-clips{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.ap-clip{position:relative;background:var(--ap-paper);border:2px solid var(--ap-ink);
  border-radius:3px;padding:24px;box-shadow:4px 5px 0 var(--ap-ink);
  transform:rotate(calc((var(--i) - 1) * 1.1deg))}
.ap-stars{display:inline-flex;gap:3px;color:var(--ap-hot);margin-bottom:12px}
.ap-stars svg{width:18px;height:18px}
.ap-clip-q{font-family:var(--ap-kick);font-weight:500;font-size:18px;line-height:1.42;
  color:var(--ap-ink);margin:0 0 14px}
.ap-clip-cap{display:flex;flex-direction:column;font:700 13px/1.3 var(--ap-stamp);
  letter-spacing:.04em;text-transform:uppercase;color:var(--ap-ink)}
.ap-clip-cap span{color:var(--ap-muted);font-weight:600}

/* ============================================================ UV HEADLINER BAND */
.ap-band--uv{background:var(--ap-dark-band);color:var(--ap-dark-ink)}
.ap-uv-wrap{position:relative;z-index:2}
.ap-band--uv .ap-grain{opacity:.12;mix-blend-mode:screen}
.ap-uv-head{position:relative;font-family:var(--ap-display);font-weight:400;text-transform:uppercase;
  font-size:clamp(40px,9vw,120px);line-height:.86;letter-spacing:.005em;color:var(--ap-dark-ink);
  margin:16px 0 26px;
  text-shadow:.03em .025em 0 var(--ap-plate-a),-.022em -.018em 0 var(--ap-hot)}
.ap-uv-head::before{content:"";position:absolute;inset:-.05em -.1em;z-index:-1;
  background-image:radial-gradient(rgba(244,239,228,.16) 28%,transparent 29%);
  background-size:12px 12px;pointer-events:none}
.ap-uv-foot{display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap}
.ap-uv-foot .ap-seal--hot{color:var(--ap-hot);flex:none}
.ap-uv-body{max-width:58ch;color:var(--ap-dark-ink);opacity:.94;margin:0;font-size:clamp(16px,1.4vw,18px)}

/* ============================================================ HOURS + MAP */
.ap-hours-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:clamp(24px,4vw,52px);align-items:center}
.ap-hours-note{font:500 14px/1.4 var(--ap-kick);color:var(--ap-muted);margin:14px 0 20px}
.ap-nap{list-style:none;margin:20px 0;padding:0;display:grid;gap:14px}
.ap-nap li{display:flex;flex-direction:column;gap:3px;border-left:4px solid var(--ap-plate-a);
  padding-left:14px}
html[data-intensity="light"] .ap-nap li{border-left-color:var(--ap-plate-a)}
.ap-nap-l{font:800 12px/1 var(--ap-stamp);letter-spacing:.12em;text-transform:uppercase;color:var(--ap-muted)}
.ap-nap-v{font-family:var(--ap-kick);font-weight:700;font-size:18px;color:var(--ap-ink)}
.ap-nap-v a{text-decoration:none;border-bottom:2px solid var(--ap-hot)}
.ap-nap-v a:hover{color:var(--ap-hot)}
.ap-map{position:relative;border:4px solid var(--ap-ink);border-radius:5px;overflow:hidden;
  box-shadow:8px 8px 0 var(--ap-plate-b);aspect-ratio:4/3;background:var(--ap-paper-2)}
html[data-intensity="light"] .ap-map{box-shadow:8px 8px 0 var(--ap-plate-a)}
.ap-map iframe{width:100%;height:100%;border:0;display:block}
.ap-map--tall{aspect-ratio:3/4;min-height:420px}

/* ============================================================ CONTACT */
.ap-contact{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(24px,4vw,48px);align-items:start}
.ap-contact-col{display:grid;gap:24px}
.ap-nap-card{background:var(--ap-paper);border:3px solid var(--ap-ink);border-radius:5px;
  padding:clamp(22px,3vw,36px);box-shadow:6px 6px 0 var(--ap-ink)}
.ap-form{display:grid;gap:14px;margin-top:10px}
.ap-field{display:grid;gap:6px}
.ap-field label{font:800 12px/1 var(--ap-stamp);letter-spacing:.1em;text-transform:uppercase;color:var(--ap-muted)}
.ap-field input,.ap-field textarea{font:500 16px/1.4 var(--ap-body);color:var(--ap-ink);
  background:var(--ap-paper-2);border:2px solid var(--ap-ink);border-radius:3px;padding:11px 12px;width:100%}
.ap-field textarea{resize:vertical}
.ap-field input:focus,.ap-field textarea:focus{outline:3px solid var(--ap-hot);outline-offset:1px;background:var(--ap-paper)}

/* ============================================================ FRONT DESK STUB */
.ap-desk{padding-block:clamp(40px,6vw,72px);background:var(--ap-paper-2);scroll-snap-align:start}
.ap-desk-card{max-width:var(--ap-maxw);margin-inline:auto;margin-left:auto;
  background:var(--ap-paper);border:4px solid var(--ap-ink);border-radius:6px;
  padding:clamp(22px,3.4vw,40px);box-shadow:8px 8px 0 var(--ap-plate-b);
  width:calc(100% - 2*var(--ap-gut))}
html[data-intensity="light"] .ap-desk-card{box-shadow:8px 8px 0 var(--ap-plate-a)}
.ap-desk{margin-left:var(--ap-rail)}
.ap-desk-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
.ap-desk-label{font:800 12px/1 var(--ap-stamp);letter-spacing:.16em;text-transform:uppercase;
  color:var(--ap-hot-ink);background:var(--ap-hot);padding:7px 11px;border-radius:2px;transform:rotate(-2deg)}
.ap-desk-title{font-family:var(--ap-display);font-weight:400;text-transform:uppercase;
  font-size:clamp(28px,4.4vw,52px);line-height:.94;color:var(--ap-ink);margin:0 0 12px;
  text-shadow:.025em .02em 0 var(--ap-mis-a)}
.ap-desk-body{color:var(--ap-ink);max-width:60ch;margin:0 0 20px}
.ap-desk-thread{display:grid;gap:12px;margin-bottom:18px}
.ap-bubble{margin:0;padding:13px 16px;border-radius:4px;max-width:88%;line-height:1.45;
  border:2px solid var(--ap-ink)}
.ap-bubble--q{justify-self:end;background:var(--ap-ink);color:var(--ap-paper);
  font-family:var(--ap-kick);font-weight:600}
.ap-bubble--a{justify-self:start;background:var(--ap-paper-2);color:var(--ap-ink)}
.ap-desk-input{display:flex;gap:10px;flex-wrap:wrap;align-items:stretch}
.ap-desk-input input{flex:1 1 240px;font:500 16px/1.4 var(--ap-body);color:var(--ap-ink);
  background:var(--ap-paper-2);border:2px solid var(--ap-ink);border-radius:3px;padding:12px 14px}
.ap-desk-input input::placeholder{color:var(--ap-muted)}
.ap-desk-send{display:inline-flex;align-items:center;gap:8px;font:800 14px/1 var(--ap-stamp);
  letter-spacing:.04em;text-transform:uppercase;border:3px solid var(--ap-ink);
  background:var(--ap-hot);color:var(--ap-hot-ink);border-radius:3px;padding:0 18px;cursor:not-allowed}
.ap-desk-send svg{width:16px;height:16px}
.ap-desk-note{font:500 13px/1.4 var(--ap-kick);color:var(--ap-muted);margin:14px 0 0}
/* :focus-within nudge (still no JS) so the stub feels alive when tabbed into */
.ap-desk-card:focus-within{box-shadow:12px 12px 0 var(--ap-hot)}

/* ============================================================ COUPON CTA */
.ap-coupon{position:relative;margin:0 var(--ap-gut) clamp(40px,6vw,72px);margin-left:calc(var(--ap-rail) + var(--ap-gut));
  background:var(--ap-hot);color:var(--ap-hot-ink);border:4px dashed var(--ap-ink);border-radius:6px;
  padding:clamp(28px,4vw,56px);text-align:center;box-shadow:10px 10px 0 var(--ap-ink)}
.ap-coupon .ap-kicker{color:var(--ap-hot-ink);border-color:var(--ap-hot-ink);background:transparent}
.ap-coupon-stub{position:absolute;top:12px;left:14px;font:800 11px/1 var(--ap-stamp);
  letter-spacing:.18em;text-transform:uppercase;opacity:.8}
.ap-coupon-title{font-family:var(--ap-display);font-weight:400;text-transform:uppercase;
  font-size:clamp(32px,6vw,72px);line-height:.92;margin:14px 0 12px;color:var(--ap-hot-ink);
  text-shadow:.03em .025em 0 var(--ap-ink)}
.ap-coupon-sub{max-width:54ch;margin:0 auto 24px;font-size:clamp(16px,1.4vw,18px);line-height:1.55}
.ap-coupon .ap-actions{justify-content:center}
.ap-coupon .ap-btn{background:var(--ap-paper);color:var(--ap-ink);border-color:var(--ap-ink);box-shadow:4px 4px 0 var(--ap-ink)}
.ap-coupon .ap-btn:hover{box-shadow:6px 6px 0 var(--ap-ink)}

/* ============================================================ COLOPHON */
.ap-colophon{background:var(--ap-ink);color:var(--ap-paper);padding-block:34px}
/* Core §12.2 footer (emitted by the engine after the skin body): clear the fixed
   ticker rail — otherwise the rail covers its left edge and the declaration looks
   cut off. --ap-rail collapses to 0 on mobile, so this needs no separate override. */
.ds-tm{margin-left:var(--ap-rail);padding:18px var(--ap-gut);background:var(--ap-paper);
  border-top:2px solid var(--ap-ink);font-family:var(--ap-kick);font-size:12px;
  line-height:1.55;color:var(--ap-ink)}
.ds-tm .ds-tm-notice{max-width:var(--ap-maxw)}
.ds-tm .ds-tm-copy{margin-top:4px;opacity:.7}
.ap-colophon-in{display:flex;align-items:center;justify-content:space-between;gap:18px 30px;flex-wrap:wrap}
.ap-colophon .ap-chip{box-shadow:3px 3px 0 rgba(0,0,0,.45)}
.ap-colophon-mark{display:flex;align-items:center;gap:14px}
.ap-pressmark{font:800 13px/1.2 var(--ap-stamp);letter-spacing:.14em;text-transform:uppercase;
  color:var(--ap-plate-a)}
html[data-intensity="light"] .ap-pressmark{color:var(--ap-plate-b)}
.ap-colophon-text{font-family:var(--ap-kick);font-weight:600;font-size:14px;line-height:1.5;
  color:var(--ap-paper);opacity:.92;margin:0;text-align:right}
.ap-colophon-text a{text-decoration:none;border-bottom:2px solid var(--ap-plate-a)}

/* ============================================================ RESPONSIVE */
@media (max-width:860px){
  .ap-hours-wrap,.ap-contact{grid-template-columns:1fr}
  .ap-map--tall{aspect-ratio:4/3;min-height:0}
  .ap-nav{order:3;width:100%;margin-inline-start:0}
  .ap-mast-open{order:2;margin-inline-start:auto}
}
@media (max-width:640px){
  :root{--ap-rail:0px}
  .ap-ticker{display:none}
  .ap-poster-doc,.ap-colophon,.ap-desk{margin-left:0}
  .ap-coupon{margin-left:var(--ap-gut)}
  .ap-hero-word{font-size:clamp(64px,26vw,140px)}
  .ap-stat{flex-basis:46%}
  .ap-stat-perf{display:none}
  .ap-bill-panel{transform:none}
  .ap-poster,.ap-clip{transform:none}
}

/* Honor reduced motion globally */
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .ap-btn,.ap-poster{transition:none}
}
`;

module.exports = { css };
