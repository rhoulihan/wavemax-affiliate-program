// orderIntakeService — order birth at store intake (spec §6.4).
// MANDATORY: the silent-zero regression guard (non-zero totalFee /
// affiliateCommission / paymentAmount after intake).

jest.mock('../../server/utils/emailService', () => ({
  sendV2PaymentRequest: jest.fn().mockResolvedValue(true),
  sendCustomerDeliveredEmail: jest.fn().mockResolvedValue(true),
  sendAffiliateCommissionEmail: jest.fn().mockResolvedValue(true),
  sendOrderReadyNotification: jest.fn().mockResolvedValue(true)
}));

const mongoose = require('mongoose');
const emailService = require('../../server/utils/emailService');
const paymentLinkService = require('../../server/services/paymentLinkService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Bag = require('../../server/modules/bags/Bag');
const { createOrderFromBag } = require('../../server/modules/orders/orderIntakeService');
const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');

describe('orderIntakeService.createOrderFromBag', () => {
  let affiliate, customer, bag, operatorId, linkSpy;
  const TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 32 hex chars

  beforeEach(async () => {
    await Promise.all([
      Order.deleteMany({}), Customer.deleteMany({}),
      Affiliate.deleteMany({}), Bag.deleteMany({})
    ]);
    jest.clearAllMocks();

    affiliate = await ensureTestAffiliate();           // minimumDeliveryFee 10, perBagDeliveryFee 2.50
    customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
    operatorId = new mongoose.Types.ObjectId();

    bag = await Bag.create({
      token: TOKEN,
      tokenHash: Bag.hashToken(TOKEN),
      affiliateId: affiliate.affiliateId,
      customerId: customer.customerId,
      status: 'active',
      batchId: 'BATCH-test'
    });

    linkSpy = jest.spyOn(paymentLinkService, 'generatePaymentLinks');
  });

  afterEach(() => {
    linkSpy.mockRestore();
  });

  it('creates exactly one in_progress order with ids derived from the bag', async () => {
    const { order } = await createOrderFromBag({
      bagToken: TOKEN, weight: 10,
      addOns: { premiumDetergent: true, fabricSoftener: false, stainRemover: false },
      freshAddOnsFormPlaced: true, operatorId
    });

    expect(order.status).toBe('in_progress');
    expect(order.customerId).toBe(customer.customerId);   // from the bag, not from input
    expect(order.affiliateId).toBe(affiliate.affiliateId);
    expect(order.bagId).toBe(bag.bagId);                  // BAG-uuid join key
    expect(order.bagToken).toBe(TOKEN);                   // 32-hex scan key
    expect(order.bags).toHaveLength(1);
    expect(order.bags[0].bagToken).toBe(TOKEN);           // sub-doc uses bagToken, never bagId
    expect(order.bags[0].bagNumber).toBe(1);
    expect(order.bags[0].status).toBe('intake');
    expect(order.bags[0].scannedAt.intake).toBeInstanceOf(Date);
    expect(String(order.bags[0].scannedBy.intake)).toBe(String(operatorId));
    expect(order.intake.weight).toBe(10);
    expect(String(order.intake.weighedBy)).toBe(String(operatorId));
    expect(order.intakeAt).toBeInstanceOf(Date);
    expect(order.actualWeight).toBe(10);
    expect(order.freshAddOnsFormPlaced).toBe(true);
    expect(String(order.freshAddOnsFormAckBy)).toBe(String(operatorId));
    expect(order.freshAddOnsFormAckAt).toBeInstanceOf(Date);
    expect(String(order.addOnsEnteredBy)).toBe(String(operatorId));

    expect(await Order.countDocuments({ bagId: bag.bagId })).toBe(1);
  });

  it('SILENT-ZERO GUARD: saved order has non-zero totalFee, affiliateCommission, paymentAmount', async () => {
    await createOrderFromBag({
      bagToken: TOKEN, weight: 10,
      addOns: { premiumDetergent: true }, freshAddOnsFormPlaced: true, operatorId
    });

    const saved = await Order.findOne({ bagId: bag.bagId });
    // 10 lbs @ 1.25 = 12.50 WDF; fee = max(10, 1×2.50) = 10.00 (min applied);
    // add-on = 1 × 10 × 0.10 = 1.00; total = 23.50; commission = 1.25 + 10 = 11.25
    expect(saved.feeBreakdown.totalFee).toBeGreaterThan(0);
    expect(saved.feeBreakdown.totalFee).toBeCloseTo(10.0, 2);
    expect(saved.feeBreakdown.minimumApplied).toBe(true);
    expect(saved.addOnTotal).toBeCloseTo(1.0, 2);
    expect(saved.actualTotal).toBeCloseTo(23.5, 2);
    expect(saved.paymentAmount).toBeGreaterThan(0);
    expect(saved.paymentAmount).toBeCloseTo(23.5, 2);
    expect(saved.affiliateCommission).toBeGreaterThan(0);
    expect(saved.affiliateCommission).toBeCloseTo(11.25, 2);
  });

  it('generates payment links exactly ONCE, flips paymentStatus to awaiting, emails the request', async () => {
    const { order } = await createOrderFromBag({
      bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: true, operatorId
    });

    expect(linkSpy).toHaveBeenCalledTimes(1);
    expect(linkSpy).toHaveBeenCalledWith(order.orderId, expect.any(Number), expect.any(String));
    expect(order.paymentStatus).toBe('awaiting');
    expect(order.paymentRequestedAt).toBeInstanceOf(Date);
    expect(order.paymentLinks.venmo).toBeTruthy();
    expect(order.paymentQRCodes.venmo).toMatch(/^data:image\/png/);
    expect(emailService.sendV2PaymentRequest).toHaveBeenCalledTimes(1);
    const callArg = emailService.sendV2PaymentRequest.mock.calls[0][0];
    expect(callArg.customer.customerId).toBe(customer.customerId);
    expect(callArg.paymentAmount).toBeCloseTo(order.paymentAmount, 2);
  });

  it('applies carry-in WDF credit at intake and resets the customer balance', async () => {
    customer.wdfCredit = 5;
    await customer.save();

    await createOrderFromBag({
      bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
    });

    const saved = await Order.findOne({ bagId: bag.bagId });
    expect(saved.wdfCreditApplied).toBeCloseTo(5, 2);
    // actualTotal nets the credit (12.50 + 10 − 5 = 17.50); paymentAmount stays gross (22.50)
    expect(saved.actualTotal).toBeCloseTo(17.5, 2);
    expect(saved.paymentAmount).toBeCloseTo(22.5, 2);

    const freshCustomer = await Customer.findOne({ customerId: customer.customerId });
    expect(freshCustomer.wdfCredit).toBe(0);
  });
});
