// scanProcessed re-point (PR 7 interim): token-resolved, applyTransition,
// gate-driven. No direct reminders, no direct affiliate email.

jest.mock('../../server/utils/emailService', () => ({
  sendV2PaymentRequest: jest.fn(),
  sendCustomerDeliveredEmail: jest.fn(),
  sendAffiliateCommissionEmail: jest.fn(),
  sendOrderReadyNotification: jest.fn()
}));
jest.mock('../../server/services/operatorPickupService', () => ({
  sendPaymentReminder: jest.fn(),
  completePickup: jest.fn(),
  markOrderReady: jest.fn(),
  confirmPickup: jest.fn()
}));

const mongoose = require('mongoose');
const emailService = require('../../server/utils/emailService');
const pickupService = require('../../server/services/operatorPickupService');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const Bag = require('../../server/modules/bags/Bag');
const { createOrderFromBag } = require('../../server/modules/orders/orderIntakeService');
const workflow = require('../../server/services/operatorBagWorkflowService');
const { ensureTestAffiliate, ensureTestCustomer } = require('../helpers/v2TestHelpers');

describe('operatorBagWorkflowService.scanProcessed (token re-point)', () => {
  let affiliate, customer, bag, operatorId, order;
  const TOKEN = 'dddddddddddddddddddddddddddddddd';

  beforeEach(async () => {
    await Promise.all([
      Order.deleteMany({}), Customer.deleteMany({}),
      Affiliate.deleteMany({}), Bag.deleteMany({})
    ]);
    // jest.config has resetMocks: true — re-arm resolved values each test.
    emailService.sendV2PaymentRequest.mockResolvedValue(true);
    emailService.sendCustomerDeliveredEmail.mockResolvedValue(true);
    emailService.sendAffiliateCommissionEmail.mockResolvedValue(true);
    emailService.sendOrderReadyNotification.mockResolvedValue(true);
    pickupService.sendPaymentReminder.mockResolvedValue(true);

    affiliate = await ensureTestAffiliate();
    customer = await ensureTestCustomer({ affiliateId: affiliate.affiliateId });
    operatorId = new mongoose.Types.ObjectId();
    bag = await Bag.create({
      token: TOKEN, tokenHash: Bag.hashToken(TOKEN),
      affiliateId: affiliate.affiliateId, customerId: customer.customerId,
      status: 'active', batchId: 'BATCH-sp'
    });
    ({ order } = await createOrderFromBag({
      bagToken: TOKEN, weight: 10, addOns: {}, freshAddOnsFormPlaced: false, operatorId
    }));
    jest.clearAllMocks(); // discard the intake-time email calls
  });

  it('unpaid: in_progress -> processed, HELD at store, no reminder, no affiliate email', async () => {
    const result = await workflow.scanProcessed({ bagToken: TOKEN, operatorId });

    const saved = await Order.findOne({ orderId: order.orderId });
    expect(saved.status).toBe('processed');
    expect(saved.processedAt).toBeInstanceOf(Date);
    expect(saved.heldAtStore).toBe(true);               // gate's held branch
    expect(saved.readyForPickupAt).toBeUndefined();
    expect(saved.bags[0].status).toBe('processed');
    expect(String(saved.bags[0].scannedBy.processed)).toBe(String(operatorId));
    expect(String(saved.intake.processedBy)).toBe(String(operatorId));

    // The workflow service no longer notifies anyone directly.
    expect(pickupService.sendPaymentReminder).not.toHaveBeenCalled();
    expect(emailService.sendOrderReadyNotification).not.toHaveBeenCalled();
    expect(result.order.status).toBe('processed');
    expect(result.order.heldAtStore).toBe(true);
  });

  it('paid: in_progress -> processed -> gate promotes to ready_for_pickup + affiliate notified BY THE GATE', async () => {
    await Order.updateOne({ orderId: order.orderId }, { $set: { paymentStatus: 'verified' } });

    const result = await workflow.scanProcessed({ bagToken: TOKEN, operatorId });

    const saved = await Order.findOne({ orderId: order.orderId });
    expect(saved.status).toBe('ready_for_pickup');
    expect(saved.readyForPickupAt).toBeInstanceOf(Date); // sole writer = applyReadyGate
    expect(saved.heldAtStore).toBe(false);
    expect(emailService.sendOrderReadyNotification).toHaveBeenCalledTimes(1);
    expect(pickupService.sendPaymentReminder).not.toHaveBeenCalled();
    expect(result.order.status).toBe('ready_for_pickup');
  });

  it('duplicate scan on an already-processed order returns a warning, no state change', async () => {
    await workflow.scanProcessed({ bagToken: TOKEN, operatorId });
    jest.clearAllMocks();

    const result = await workflow.scanProcessed({ bagToken: TOKEN, operatorId });
    expect(result.warning).toBe('duplicate_scan');
    expect(emailService.sendOrderReadyNotification).not.toHaveBeenCalled();
    const saved = await Order.findOne({ orderId: order.orderId });
    expect(saved.status).toBe('processed');
  });

  it('unknown token -> 404 bag_not_found', async () => {
    await expect(workflow.scanProcessed({ bagToken: 'e'.repeat(32), operatorId }))
      .rejects.toMatchObject({ isBagWorkflowError: true, code: 'bag_not_found', status: 404 });
  });

  it('no open in_progress/processed order -> 404 no_active_order', async () => {
    await Order.updateOne({ orderId: order.orderId }, { $set: { status: 'delivered' } });
    await expect(workflow.scanProcessed({ bagToken: TOKEN, operatorId }))
      .rejects.toMatchObject({ isBagWorkflowError: true, code: 'no_active_order', status: 404 });
  });
});
