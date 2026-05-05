#!/usr/bin/env node
/**
 * Build public/franchise-host.html from public/dev/austin-host-mock.html.
 *
 * austin-host-mock.html is the canonical chrome we tuned over many
 * iterations. Rather than maintain two copies, we generate the
 * parameterized franchise host from it via targeted replacements:
 *
 *   - SEO meta (title / description / canonical / OG / Twitter) → {{…}}
 *   - Per-franchise data scripts → single inline placeholder
 *   - Nav anchor hrefs (?route=/path) → /{{SLUG}}/path/
 *   - Iframe src → {{INITIAL_IFRAME_SRC}}
 *
 * Re-run after any edit to austin-host-mock.html to refresh the template.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC  = path.join(ROOT, 'public/dev/austin-host-mock.html');
const OUT  = path.join(ROOT, 'public/franchise-host.html');

let html = fs.readFileSync(SRC, 'utf8');

// ── SEO meta substitutions ───────────────────────────────────────────
html = html.replace(/<title>.*?<\/title>/, '<title>{{TITLE}}</title>');
html = html.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="{{DESCRIPTION}}">');
html = html.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="{{TITLE}}">');
html = html.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="{{DESCRIPTION}}">');
html = html.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="{{CANONICAL_URL}}">');
html = html.replace(/<meta property="og:site_name" content="[^"]*">/, '<meta property="og:site_name" content="{{TITLE}}">');
html = html.replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="{{TITLE}}">');
html = html.replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="{{DESCRIPTION}}">');
html = html.replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="{{CANONICAL_URL}}">');

// hreflang alternates → point at canonical (server already encodes lang)
html = html.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g, (m, ...args) => {
  const hreflangMatch = m.match(/hreflang="([^"]*)"/);
  return `<link rel="alternate" hreflang="${hreflangMatch[1]}" href="{{CANONICAL_URL}}">`;
});

// ── Per-franchise data injection ─────────────────────────────────────
// Drop the Austin-specific data scripts and insert a single placeholder
// the controller fills in.
html = html.replace(/<script src="\/api\/austin-tx\/places-config"><\/script>/, '');
html = html.replace(/<script src="\/assets\/js\/austin-host-mock-data\.js[^"]*"><\/script>/, '');

const dataInjectionMarker = '<!-- {{FRANCHISE_DATA_INJECTION}} -->';
html = html.replace('</head>', `  ${dataInjectionMarker}\n</head>`);

// ── Nav anchor hrefs: ?route=/path → /{{SLUG}}/path/  ────────────────
// Anchor patterns vary slightly across the file; handle each form.
html = html.replace(/href="\?route=\/"/g,  'href="/{{SLUG}}/"');
html = html.replace(/href="\?route=\/([^"]+?)\/?"/g, (m, p) => `href="/{{SLUG}}/${p.replace(/\/+$/, '')}/"`);

// data-route attributes (used by the chrome to highlight active nav) keep
// their / prefix since the chrome compares against window.location.pathname.

// ── Iframe initial src ───────────────────────────────────────────────
html = html.replace(/(<iframe[^>]*?id="wavemax-iframe"[^>]*?)src="[^"]*"/, '$1src="{{INITIAL_IFRAME_SRC}}"');

// ── Strip dev-only stuff that shouldn't be on franchise pages ─────────
// (none for v1 — leave demo-control bar etc as-is; they no-op without the dev cookie)

fs.writeFileSync(OUT, html);
console.log(`Wrote ${path.relative(ROOT, OUT)} (${html.length.toLocaleString()} bytes)`);
console.log(`Substitutions remaining: ${(html.match(/{{[A-Z_]+}}/g) || []).length} placeholder occurrences:`);
const placeholders = [...new Set((html.match(/{{[A-Z_]+}}/g) || []))];
placeholders.forEach(p => console.log('  ', p));
