// Guard: the admin "create location affiliate" form must send every field the
// POST /api/v1/administrators/affiliates route requires.
//
// Regression context: pickupInstructions was made REQUIRED on the create route
// (commit 735a3d1, 2026-06-17) but never added to this admin form, so
// location-affiliate creation 400'd ("Pickup instructions are required"). The
// integration test (locationAffiliate.test.js) masked it by POSTing the field
// directly — the real form never sent it. This pins form <-> route field parity.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const init = fs.readFileSync(path.join(ROOT, 'public/assets/js/administrator-dashboard-init.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'public/administrator-dashboard-embed.html'), 'utf8');

describe('admin location-affiliate create form <-> route field parity', () => {
  // Fields the create route validates as REQUIRED (server/routes/administratorRoutes.js,
  // the POST /affiliates chain). Keep in sync with that chain.
  const REQUIRED = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode', 'username', 'pickupInstructions'];

  // The body object literal built in handleCreateLocationAffiliate.
  const bodyBlock = (init.match(/handleCreateLocationAffiliate[\s\S]*?const body = \{([\s\S]*?)\};/) || [])[1] || '';

  it('handleCreateLocationAffiliate sends every required create-route field', () => {
    expect(bodyBlock).toBeTruthy();
    REQUIRED.forEach((field) => {
      expect(bodyBlock).toMatch(new RegExp(`\\b${field}:`));
    });
  });

  it('the create form has a pickupInstructions input (the field that was missing)', () => {
    expect(html).toMatch(/id="locAffPickupInstructions"/);
  });

  it('the create form has a SEPARATE deliveryInstructions input + sends it', () => {
    expect(html).toMatch(/id="locAffDeliveryInstructions"/);
    expect(bodyBlock).toMatch(/\bdeliveryInstructions:/);
  });

  it('the pickup label no longer says "drop-off" (separate pickup vs delivery)', () => {
    const en = require(path.join(ROOT, 'public/locales/en/common.json'));
    expect(en.admin.affiliateSettings.pickupInstructionsLabel).not.toMatch(/drop.?off/i);
  });
});
