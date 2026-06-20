// Operator-scan rework: the scan confirm DIALOG must actually display (the
// "scanning does nothing" bug was a CSS one), show customer info + current order
// status, gate the out-for-delivery step on a required payment/receipt checkbox,
// and the session-tally metric is removed (metrics live on the expediter).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const html = fs.readFileSync(path.join(ROOT, 'public/operator-scan-embed.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'public/assets/js/operator-scan-init.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'public/assets/css/operator-scan.css'), 'utf8');

describe('operator-scan confirm modal', () => {
  it('reveals the confirm dialog (fixes the display:none bug) via the .block toggle', () => {
    // base .confirmation-modal is display:none; the confirm dialog must be shown
    // explicitly, and there must be a rule that actually displays it.
    expect(css).toMatch(/#scanConfirmModal\.block\s*\{\s*display:\s*flex/);
    expect(js).toMatch(/confirmModal\.classList\.add\('block'\)/);
    expect(js).toMatch(/confirmModal\.classList\.remove\('block'\)/);
  });

  it('shows the full customer record (name + phone + email + address) and order status', () => {
    expect(html).toContain('id="scanConfirmCustomer"');
    expect(html).toContain('id="scanConfirmPhone"');
    expect(html).toContain('id="scanConfirmEmail"');
    expect(html).toContain('id="scanConfirmAddress"');
    expect(html).toContain('id="scanOrderStatus"');
    expect(js).toContain('scanConfirmEmail');
    expect(js).toContain('scanConfirmAddress');
    expect(js).toContain('setDetail');
    expect(js).toContain('statusLabel');
    expect(js).toMatch(/order\.status\./); // status pill uses order.status.* labels
  });

  it('requires the payment+receipt checkbox before the out-for-delivery step', () => {
    // Confirm is disabled until the box is ticked when handing back for delivery.
    expect(js).toMatch(/confirmYes\.disabled = needsPayment/);
    expect(js).toMatch(/paymentCheckbox\.addEventListener\('change'/);
    expect(html).toContain('data-i18n="operator.scan.paymentConfirmed"');
  });

  it('buttons are Confirm / Cancel (cancel available at every stage)', () => {
    expect(html).toContain('data-i18n="operator.scan.confirm"');
    expect(html).toContain('data-i18n="operator.scan.cancel"');
  });

  it('drops the session-tally metric (metrics live on the expediter)', () => {
    expect(html).not.toContain('id="sessionTally"');
    expect(html).not.toContain('stats-summary');
    expect(js).not.toContain('sessionTally');
    expect(js).not.toMatch(/\btally\b/);
  });

  it('captures the scan via keydown accumulation (single path), finalizing on Enter', () => {
    // The field-value approaches (append-each-input-event, or read .value once)
    // both raced with fast wedge scanners and corrupted the 32-hex token (chars
    // dropped/duplicated/reordered -> "bag not registered"). The robust fix
    // accumulates keystrokes directly from keydown, in order, and finalizes on
    // the Enter/Tab suffix (or an idle fallback). There must be exactly ONE
    // scan-capture path — keydown — and NO 'input'-listener field read.
    expect(js).not.toMatch(/scanBuffer\s*\+=/);
    expect(js).not.toMatch(/addEventListener\('input'/); // no field-value scan path
    expect(js).toContain('function handleScanKey');
    expect(js).toMatch(/scanKeyBuffer\s*\+=\s*e\.key/);
    expect(js).toMatch(/addEventListener\('keydown', handleScanKey\)/);
    expect(js).toMatch(/e\.key === 'Enter'[\s\S]{0,120}commitScan\(\)/); // CR/Enter (or Tab) suffix → finalize
  });

  it('stays CSP-clean (no inline handlers/styles/innerHTML)', () => {
    expect(html).not.toMatch(/onclick=/i);
    expect(html).not.toMatch(/ style="/i);
    expect(js).not.toMatch(/\.innerHTML\s*=/);
  });

  it('ships operator.scan.confirm/cancel + order.status.{pending,out_for_delivery,complete} in all four languages', () => {
    for (const lang of ['en', 'es', 'pt', 'de']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `public/locales/${lang}/common.json`), 'utf8'));
      for (const k of ['confirm', 'cancel', 'statusNone']) {
        expect(`${lang}:operator.scan.${k}:${typeof (dict.operator.scan && dict.operator.scan[k])}`)
          .toBe(`${lang}:operator.scan.${k}:string`);
      }
      for (const s of ['pending', 'in_progress', 'out_for_delivery', 'complete']) {
        expect(`${lang}:order.status.${s}:${typeof (dict.order && dict.order.status && dict.order.status[s])}`)
          .toBe(`${lang}:order.status.${s}:string`);
      }
    }
  });
});
