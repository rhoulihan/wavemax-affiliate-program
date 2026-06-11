// labelSheetService — print-HTML label grid (spec §6.1)
jest.mock('qrcode'); // mock BEFORE require

const QRCode = require('qrcode');
const Bag = require('../../../server/modules/bags/Bag');
const Affiliate = require('../../../server/models/Affiliate');
const bagService = require('../../../server/modules/bags/bagService');
const labelSheetService = require('../../../server/modules/bags/labelSheetService');
const { hashPassword } = require('../../../server/utils/encryption');

async function createAffiliate(businessName) {
  const { salt, hash } = hashPassword('TestAffiliatePass123!');
  const affiliate = new Affiliate({
    firstName: 'Test', lastName: 'Affiliate',
    email: `labels-${Date.now()}@example.com`, username: `labels${Date.now()}`,
    passwordHash: hash, passwordSalt: salt,
    phone: '+15125550100', address: '123 Test St', city: 'Austin',
    state: 'TX', zipCode: '78701', businessName,
    serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
    serviceRadius: 10, minimumDeliveryFee: 25, perBagDeliveryFee: 5,
    paymentMethod: 'check'
  });
  await affiliate.save();
  return affiliate;
}

describe('labelSheetService', () => {
  beforeEach(async () => {
    await Bag.deleteMany({});
    await Affiliate.deleteMany({});
    // jest.config resetMocks:true — re-arm the mock every test
    QRCode.toDataURL.mockResolvedValue('data:image/png;base64,TESTQR');
  });

  it('renders one cell per bag: QR data-URI, affiliate name, BAG- ref suffix', async () => {
    const affiliate = await createAffiliate('Austin Wash Co');
    const { batchId, bags } = await bagService.mintBatch({
      affiliateId: affiliate.affiliateId, quantity: 3, adminId: affiliate._id
    });

    const html = await labelSheetService.renderLabelSheet(batchId);

    expect(html).toContain('<!DOCTYPE html>');
    expect((html.match(/data:image\/png;base64,TESTQR/g) || [])).toHaveLength(3);
    expect(html).toContain('Austin Wash Co');
    for (const bag of bags) {
      expect(html).toContain(bag.bagId.slice(-6));   // staff ref, not the secret
      expect(html).not.toContain(bag.token);          // raw token NEVER in markup
      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        `https://wavemax.promo/embed-app-v2.html?route=/claim&bag=${bag.token}`,
        { width: 300, margin: 2, errorCorrectionLevel: 'M' }
      );
    }
  });

  it('is CSP-clean: external stylesheet, zero inline script/style', async () => {
    const affiliate = await createAffiliate('CSP Clean Co');
    const { batchId } = await bagService.mintBatch({
      affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
    });
    const html = await labelSheetService.renderLabelSheet(batchId);
    expect(html).toContain('href="/assets/css/bag-labels.css"');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/ style="/i);
    expect(html).not.toMatch(/<style/i);
  });

  it('HTML-escapes the affiliate name', async () => {
    const affiliate = await createAffiliate('<script>alert(1)</script>');
    const { batchId } = await bagService.mintBatch({
      affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
    });
    const html = await labelSheetService.renderLabelSheet(batchId);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('returns null for an unknown batch', async () => {
    expect(await labelSheetService.renderLabelSheet('BATCH-nope')).toBeNull();
  });
});
