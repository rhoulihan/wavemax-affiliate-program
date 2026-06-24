// bagClaimService — claim-path adapter over bagService (spec §6.3)
const Bag = require('../../server/modules/bags/Bag');
const Affiliate = require('../../server/models/Affiliate');
const bagService = require('../../server/modules/bags/bagService');
const bagClaimService = require('../../server/services/bagClaimService');
const { hashPassword } = require('../../server/utils/encryption');

async function createAffiliate() {
  const { salt, hash } = hashPassword('TestAffiliatePass123!');
  const affiliate = new Affiliate({
    firstName: 'Claim', lastName: 'Affiliate',
    email: `claimsvc-${Date.now()}@example.com`, username: `claimsvc${Date.now()}`,
    passwordHash: hash, passwordSalt: salt,
    phone: '+15125550100', address: '1 Main', city: 'Austin', state: 'TX',
    zipCode: '78701', businessName: 'Claim Wash Co',
    serviceArea: 'Downtown', serviceLatitude: 30.2672, serviceLongitude: -97.7431,
    serviceRadius: 10,
    paymentMethod: 'check'
  });
  await affiliate.save();
  return affiliate;
}

describe('bagClaimService', () => {
  let affiliate, token, batchId;

  beforeEach(async () => {
    await Bag.deleteMany({});
    await Affiliate.deleteMany({});
    affiliate = await createAffiliate();
    const minted = await bagService.mintBatch({
      affiliateId: affiliate.affiliateId, quantity: 1, adminId: affiliate._id
    });
    batchId = minted.batchId;
    token = minted.bags[0].token;
  });

  describe('resolveClaimToken', () => {
    it("maps unknown and minted tokens to { state: 'invalid' } (no oracle)", async () => {
      expect(await bagClaimService.resolveClaimToken('f'.repeat(32))).toEqual({ state: 'invalid' });
      expect(await bagClaimService.resolveClaimToken(token)).toEqual({ state: 'invalid' });
    });

    it("maps issued to 'claimable' with the affiliate public projection", async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      const result = await bagClaimService.resolveClaimToken(token);
      expect(result.state).toBe('claimable');
      expect(result.bag.affiliateId).toBe(affiliate.affiliateId);
      expect(result.affiliate.businessName).toBe('Claim Wash Co');
      // public projection only — no credentials / contact internals
      expect(result.affiliate.passwordHash).toBeUndefined();
      expect(result.affiliate.email).toBeUndefined();
    });

    it("maps active to 'claimed' and omits order when no open order", async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      await bagService.claim({ token, customerId: 'CUST-1' });
      const result = await bagClaimService.resolveClaimToken(token);
      expect(result.state).toBe('claimed');
      expect(result.order).toBeUndefined();
      // no customer PII on the claim-path response
      expect(result.customer).toBeUndefined();
    });
  });

  describe('claimForCustomer', () => {
    it('claims and returns the active bag', async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      const { bag } = await bagClaimService.resolveClaimToken(token);
      const claimed = await bagClaimService.claimForCustomer(bag, 'CUST-1');
      expect(claimed.status).toBe('active');
      expect(claimed.customerId).toBe('CUST-1');
    });

    it("throws ClaimError('bag_already_claimed', 409) on race loss", async () => {
      await bagService.issueBatch({ batchId, adminId: affiliate._id });
      const { bag } = await bagClaimService.resolveClaimToken(token);
      await bagClaimService.claimForCustomer(bag, 'CUST-1');
      await expect(bagClaimService.claimForCustomer(bag, 'CUST-2'))
        .rejects.toMatchObject({ isClaimError: true, code: 'bag_already_claimed', status: 409 });
    });
  });
});
