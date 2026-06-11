// bagService — mint/issue (spec §6.1)
jest.mock('../../../server/utils/auditLogger', () => {
  const actual = jest.requireActual('../../../server/utils/auditLogger');
  return { ...actual, logAuditEvent: jest.fn() };
});

const crypto = require('crypto');
const Bag = require('../../../server/modules/bags/Bag');
const Affiliate = require('../../../server/models/Affiliate');
const encryptionUtil = require('../../../server/utils/encryption');
const { logAuditEvent, AuditEvents } = require('../../../server/utils/auditLogger');
const bagService = require('../../../server/modules/bags/bagService');
const { hashPassword } = require('../../../server/utils/encryption');

async function createAffiliate(suffix = '1') {
  const { salt, hash } = hashPassword('TestAffiliatePass123!');
  // Extra fields are harmless if a prior PR already removed them from the
  // schema (mongoose strict mode strips unknown paths silently).
  const affiliate = new Affiliate({
    firstName: 'Test', lastName: 'Affiliate',
    email: `bagsvc-aff-${suffix}@example.com`,
    username: `bagsvcaff${suffix}`,
    passwordHash: hash, passwordSalt: salt,
    phone: '+15125550100', address: '123 Test St', city: 'Austin',
    state: 'TX', zipCode: '78701', businessName: `Bag Service Co ${suffix}`,
    serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
    serviceRadius: 10, minimumDeliveryFee: 25, perBagDeliveryFee: 5,
    paymentMethod: 'check'
  });
  await affiliate.save();
  return affiliate;
}

describe('bagService mint/issue', () => {
  let affiliate;

  beforeEach(async () => {
    await Bag.deleteMany({});
    await Affiliate.deleteMany({});
    affiliate = await createAffiliate();
  });

  describe('mintBatch', () => {
    it('mints N minted bags under one BATCH- id with 32-hex tokens', async () => {
      const { batchId, bags } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 5, adminId: affiliate._id
      });
      expect(batchId).toMatch(/^BATCH-[0-9a-f-]{36}$/);
      expect(bags).toHaveLength(5);
      for (const bag of bags) {
        expect(bag.status).toBe('minted');
        expect(bag.affiliateId).toBe(affiliate.affiliateId);
        expect(bag.batchId).toBe(batchId);
        expect(bag.token).toMatch(/^[0-9a-f]{32}$/);
        expect(bag.tokenHash).toBe(Bag.hashToken(bag.token));
      }
      const distinctHashes = new Set(bags.map((b) => b.tokenHash));
      expect(distinctHashes.size).toBe(5);
      expect(logAuditEvent).toHaveBeenCalledWith(
        AuditEvents.BAG_MINTED,
        expect.objectContaining({ batchId, count: 5, affiliateId: affiliate.affiliateId }),
        null
      );
    });

    it('rejects quantity below 1 and above bag_mint_max_batch', async () => {
      await expect(bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 0, adminId: affiliate._id
      })).rejects.toMatchObject({ isBagError: true, code: 'invalid_quantity', status: 400 });
      await expect(bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 201, adminId: affiliate._id
      })).rejects.toMatchObject({ isBagError: true, code: 'invalid_quantity', status: 400 });
    });

    it('rejects an unknown affiliate', async () => {
      await expect(bagService.mintBatch({
        affiliateId: 'AFF-does-not-exist', quantity: 1, adminId: affiliate._id
      })).rejects.toMatchObject({ isBagError: true, code: 'invalid_affiliate', status: 404 });
    });

    it('retries token collisions (E11000) and still mints the full batch', async () => {
      await Bag.createIndexes(); // setup.js afterEach drops indexes; init() caches
      const real = encryptionUtil.generateToken;
      const dup = 'a'.repeat(32);
      jest.spyOn(encryptionUtil, 'generateToken')
        .mockImplementation((n) => real(n))
        .mockReturnValueOnce(dup)
        .mockReturnValueOnce(dup); // two bags in the same batch collide
      const { batchId, bags } = await bagService.mintBatch({
        affiliateId: affiliate.affiliateId, quantity: 2, adminId: affiliate._id
      });
      expect(bags).toHaveLength(2);
      const hashes = new Set(bags.map((b) => b.tokenHash));
      expect(hashes.size).toBe(2);
      const stored = await Bag.find({ batchId });
      expect(stored).toHaveLength(2);
    });
  });

  describe('issueBatch', () => {
    it('flips minted -> issued for exactly that batch', async () => {
      const a = await bagService.mintBatch({ affiliateId: affiliate.affiliateId, quantity: 3, adminId: affiliate._id });
      const b = await bagService.mintBatch({ affiliateId: affiliate.affiliateId, quantity: 2, adminId: affiliate._id });

      const result = await bagService.issueBatch({ batchId: a.batchId, adminId: affiliate._id });
      expect(result).toMatchObject({ batchId: a.batchId, issued: 3 });

      const issued = await Bag.find({ batchId: a.batchId });
      expect(issued.every((bag) => bag.status === 'issued' && bag.issuedAt instanceof Date)).toBe(true);
      const untouched = await Bag.find({ batchId: b.batchId });
      expect(untouched.every((bag) => bag.status === 'minted')).toBe(true);

      expect(logAuditEvent).toHaveBeenCalledWith(
        AuditEvents.BAG_ISSUED,
        expect.objectContaining({ batchId: a.batchId, issued: 3 }),
        null
      );
    });

    it('404s an unknown batch', async () => {
      await expect(bagService.issueBatch({ batchId: 'BATCH-nope', adminId: affiliate._id }))
        .rejects.toMatchObject({ isBagError: true, code: 'batch_not_found', status: 404 });
    });
  });
});
