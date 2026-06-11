// scanCustomer/weighBags are now thin delegates over the bag-token flow
// (spec §6.4 service re-points). parseCustomerQr & co. are gone.

jest.mock('../../server/modules/orders/orderIntakeService', () => ({
  createOrderFromBag: jest.fn(),
  IntakeError: class IntakeError extends Error {}
}));
jest.mock('../../server/modules/bags/bagService', () => ({
  resolveByToken: jest.fn()
}));

const orderIntakeService = require('../../server/modules/orders/orderIntakeService');
const bagService = require('../../server/modules/bags/bagService');
const workflow = require('../../server/services/operatorBagWorkflowService');

describe('operatorBagWorkflowService delegates', () => {
  // jest.config has resetMocks: true — implementations must be (re)set per test.
  beforeEach(() => {
    orderIntakeService.createOrderFromBag.mockResolvedValue({ order: { orderId: 'ORD-x' }, reIntake: false });
    bagService.resolveByToken.mockResolvedValue({
      bag: { bagId: 'BAG-1', status: 'active', customerId: 'CUST-1', affiliateId: 'AFF-1' },
      outcome: 'claimed'
    });
  });

  it('no longer exports the customer-QR helpers', () => {
    expect(workflow.parseCustomerQr).toBeUndefined();
    expect(workflow.generatePaymentURLs).toBeUndefined();
  });

  it('weighBags delegates to orderIntakeService.createOrderFromBag with the token shape', async () => {
    const args = {
      bagToken: 'c'.repeat(32), weight: 10,
      addOns: { premiumDetergent: true }, freshAddOnsFormPlaced: true,
      operatorId: 'op-1', req: undefined
    };
    const result = await workflow.weighBags(args);
    expect(orderIntakeService.createOrderFromBag).toHaveBeenCalledWith(args);
    expect(result.order.orderId).toBe('ORD-x');
  });

  it('scanCustomer delegates to bagService.resolveByToken', async () => {
    const result = await workflow.scanCustomer({ bagToken: 'c'.repeat(32), operatorId: 'op-1' });
    expect(bagService.resolveByToken).toHaveBeenCalledWith('c'.repeat(32));
    expect(result.outcome).toBe('claimed');
    expect(result.bag.bagId).toBe('BAG-1');
  });

  it('scanCustomer throws bag_not_found for an unknown token', async () => {
    bagService.resolveByToken.mockResolvedValueOnce(null);
    await expect(workflow.scanCustomer({ bagToken: 'd'.repeat(32), operatorId: 'op-1' }))
      .rejects.toMatchObject({ isBagWorkflowError: true, code: 'bag_not_found', status: 404 });
  });
});
