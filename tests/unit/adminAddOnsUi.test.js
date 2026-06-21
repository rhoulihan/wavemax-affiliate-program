// PR 5 — admin dashboard add-on management UI (list + create + edit + deactivate).
// Source-level wiring test (matches the dashboard's other UI tests).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const html = fs.readFileSync(path.join(ROOT, 'public/administrator-dashboard-embed.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'public/assets/js/administrator-dashboard-init.js'), 'utf8');

describe('admin add-on management UI', () => {
  it('has an Add-ons nav tab + tab content + list + add button', () => {
    expect(html).toContain('data-tab="addons"');
    expect(html).toContain('id="addons-tab"');
    expect(html).toContain('id="addonsList"');
    expect(html).toContain('id="addAddOnBtn"');
  });

  it('has an add/edit modal with name, per-language, price, sortOrder, active fields', () => {
    expect(html).toContain('id="addonModal"');
    expect(html).toContain('id="addonName"');
    expect(html).toContain('id="addonNameEs"');
    expect(html).toContain('id="addonNamePt"');
    expect(html).toContain('id="addonNameDe"');
    expect(html).toContain('id="addonPrice"');
    expect(html).toContain('id="addonPriceUnit"'); // flat | per_lb selector
    expect(html).toContain('id="addonSortOrder"');
    expect(html).toContain('id="addonActive"');
    expect(html).toContain('id="saveAddOnBtn"');
  });

  it('carries price + priceUnit through the list, modal prefill, and save payload', () => {
    expect(js).toContain("t('admin.addons.priceColumn'"); // list column header
    expect(js).toMatch(/getElementById\('addonPrice'\)\.value/); // modal prefill
    expect(js).toMatch(/price:\s*parseFloat/); // save payload
    expect(js).toMatch(/getElementById\('addonPriceUnit'\)\.value/); // unit prefill + save
    expect(js).toMatch(/priceUnit:/); // unit in save payload
    expect(js).toContain("'per_lb'"); // list renders the /lb suffix off the unit
  });

  it('loads the tab and renders/saves via the admin add-on API', () => {
    expect(js).toMatch(/case 'addons'/);
    expect(js).toContain('loadAddOns');
    expect(js).toContain('renderAddOnsList');
    expect(js).toContain('saveAddOn');
    // CRUD against the admin endpoint
    expect(js).toContain('/api/v1/administrators/addons');
    expect(js).toMatch(/method:\s*'POST'/);
    expect(js).toMatch(/method:\s*'PATCH'/);
    expect(js).toMatch(/method:\s*'DELETE'/);
  });

  it('ships admin.addons.* + the Add-ons tab label in all four languages', () => {
    for (const lang of ['en', 'es', 'pt', 'de']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `public/locales/${lang}/common.json`), 'utf8'));
      for (const k of ['title', 'add', 'name', 'priceLabel', 'priceUnitLabel', 'priceUnitFlat', 'priceUnitPerLb', 'priceColumn', 'free', 'sortOrder', 'active', 'edit', 'deactivate', 'save', 'cancel', 'modalTitleAdd', 'modalTitleEdit', 'noAddOns']) {
        expect(`${lang}:admin.addons.${k}:${typeof (dict.admin.addons && dict.admin.addons[k])}`)
          .toBe(`${lang}:admin.addons.${k}:string`);
      }
      const tabs = dict.administrator && dict.administrator.dashboard && dict.administrator.dashboard.tabs;
      expect(`${lang}:tabs.addons:${typeof (tabs && tabs.addons)}`).toBe(`${lang}:tabs.addons:string`);
    }
  });
});
