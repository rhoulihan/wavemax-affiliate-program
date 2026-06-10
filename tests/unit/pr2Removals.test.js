// PR 2 module-level removal regressions. Express guarantees the route table
// can't reference a deleted handler (Route.get() throws at load), so handler
// absence + module absence is sufficient here.
describe('PR 2 — beta program code removed', () => {
  it('administratorController no longer exports beta handlers', () => {
    const administratorController = require('../../server/controllers/administratorController');
    expect(administratorController.getBetaRequests).toBeUndefined();
    expect(administratorController.sendBetaWelcomeEmail).toBeUndefined();
    expect(administratorController.sendBetaReminderEmail).toBeUndefined();
    expect(administratorController.checkAffiliateExists).toBeUndefined();
  });

  it('betaRequestService module is deleted', () => {
    expect(() => require('../../server/services/betaRequestService')).toThrow(/Cannot find module/);
  });

  it('orderController no longer exports the customer-creation / Pickup Now handlers', () => {
    const orderController = require('../../server/controllers/orderController');
    expect(orderController.createOrder).toBeUndefined();
    expect(orderController.createImmediateOrder).toBeUndefined();
    expect(orderController.checkImmediateAvailability).toBeUndefined();
    expect(orderController.checkActiveOrders).toBeUndefined();
  });

  it('orderImmediatePickupHours service is deleted', () => {
    expect(() => require('../../server/services/orderImmediatePickupHours')).toThrow(/Cannot find module/);
  });
});
