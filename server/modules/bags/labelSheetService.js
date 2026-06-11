// Label sheet renderer — print-optimized HTML (spec §6.1).
//
// No PDF dependency: a @media print grid (external stylesheet) that prints
// cleanly via the browser's "Save as PDF". CSP-clean: zero inline
// script/style; QR as data-URI <img> (img-src 'self' data: already allowed).
// The QR payload is the full claim URL so a phone camera works with no app.

const QRCode = require('qrcode');
const Bag = require('./Bag');
const Affiliate = require('../../models/Affiliate');
const SystemConfig = require('../../models/SystemConfig');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render the printable label sheet for one mint batch.
 * Returns an HTML string, or null when the batch has no bags.
 * Layout knobs come from SystemConfig: bag_label_columns (grid),
 * bag_label_qr_size_px (QR width). Cells use a .cols-N class — the
 * grid-template definition lives in /assets/css/bag-labels.css, never inline.
 */
async function renderLabelSheet(batchId) {
  const bags = await Bag.find({ batchId }).sort({ bagId: 1 });
  if (bags.length === 0) return null;

  const affiliate = await Affiliate.findOne({ affiliateId: bags[0].affiliateId })
    .select('businessName firstName lastName');
  const affiliateName = affiliate
    ? (affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`)
    : bags[0].affiliateId;

  const qrSize = await SystemConfig.getValue('bag_label_qr_size_px', 300);
  const columnsRaw = await SystemConfig.getValue('bag_label_columns', 3);
  const columns = Math.min(Math.max(parseInt(columnsRaw, 10) || 3, 1), 6);
  const baseUrl = process.env.BASE_URL || 'https://wavemax.promo';

  const cells = await Promise.all(bags.map(async (bag) => {
    const claimUrl = `${baseUrl}/embed-app-v2.html?route=/claim&bag=${bag.token}`;
    const qrDataUri = await QRCode.toDataURL(claimUrl, {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: 'M'
    });
    return `      <div class="label-cell">
        <p class="label-affiliate">${escapeHtml(affiliateName)}</p>
        <img class="label-qr" src="${qrDataUri}" alt="Bag claim QR code">
        <p class="label-ref">Bag ref: ${escapeHtml(bag.bagId.slice(-6))}</p>
      </div>`;
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WaveMAX Bag Labels — ${escapeHtml(batchId)}</title>
  <link rel="stylesheet" href="/assets/css/bag-labels.css">
</head>
<body>
  <header class="sheet-header">
    <h1>WaveMAX Laundry Pickup &amp; Delivery — Bag Labels</h1>
    <p class="print-instructions">Print this sheet, cut along the lines, and attach one label to each bag.</p>
    <p class="sheet-meta">${escapeHtml(affiliateName)} &middot; ${escapeHtml(batchId)} &middot; ${bags.length} labels</p>
  </header>
  <main class="label-grid cols-${columns}">
${cells.join('\n')}
  </main>
</body>
</html>`;
}

module.exports = { renderLabelSheet };
