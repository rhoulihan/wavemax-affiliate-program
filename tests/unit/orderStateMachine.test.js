// Unit tests for the single shared order-status transition map (design §6.4).
// Pure logic — no DB needed. `{ virtual: true }` lets this mock exist before
// the real orderReadyGateService file is created in Task 4.
jest.mock(
  '../../server/services/orderReadyGateService',
  () => ({ applyReadyGate: jest.fn().mockResolvedValue({ promoted: true, held: false }) }),
  { virtual: true }
);

const {
  TRANSITIONS,
  canTransition,
  applyTransition,
  maybeReadyForPickup,
  TransitionError
} = require('../../server/modules/orders/orderStateMachine');
const { applyReadyGate } = require('../../server/services/orderReadyGateService');

// jest.config.js sets resetMocks: true, which wipes the factory's
// mockResolvedValue before each test — re-prime it here.
beforeEach(() => {
  applyReadyGate.mockResolvedValue({ promoted: true, held: false });
});

describe('orderStateMachine', () => {
  describe('TRANSITIONS', () => {
    it('defines the canonical map from design §6.4', () => {
      expect(TRANSITIONS).toEqual({
        in_progress: ['processed', 'cancelled'],
        processed: ['ready_for_pickup', 'cancelled'],
        ready_for_pickup: ['picked_up'],
        picked_up: ['delivered'],
        delivered: [],
        cancelled: []
      });
    });
  });

  describe('canTransition', () => {
    it.each([
      ['in_progress', 'processed'],
      ['in_progress', 'cancelled'],
      ['processed', 'ready_for_pickup'],
      ['processed', 'cancelled'],
      ['ready_for_pickup', 'picked_up'],
      ['picked_up', 'delivered']
    ])('allows %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    it.each([
      ['in_progress', 'ready_for_pickup'], // must pass through processed
      ['in_progress', 'picked_up'],
      ['in_progress', 'delivered'],
      ['processed', 'picked_up'],          // must pass through the gate
      ['processed', 'delivered'],
      ['ready_for_pickup', 'cancelled'],   // cancel only from in_progress/processed
      ['picked_up', 'cancelled'],
      ['delivered', 'cancelled'],
      ['cancelled', 'in_progress'],
      ['pending', 'processing'],           // old enum values are dead
      [undefined, 'processed']
    ])('rejects %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });
  });

  describe('applyTransition', () => {
    it('sets the status and stamps processedAt set-once', () => {
      const order = { status: 'in_progress' };
      applyTransition(order, 'processed');
      expect(order.status).toBe('processed');
      expect(order.processedAt).toBeInstanceOf(Date);
      const first = order.processedAt;
      order.status = 'in_progress'; // contrived re-run to prove set-once
      applyTransition(order, 'processed');
      expect(order.processedAt).toBe(first);
    });

    it('stamps pickedUpAt on picked_up', () => {
      const order = { status: 'ready_for_pickup' };
      applyTransition(order, 'picked_up');
      expect(order.status).toBe('picked_up');
      expect(order.pickedUpAt).toBeInstanceOf(Date);
    });

    it('stamps deliveredAt and realizes commission exactly once on delivered', () => {
      const order = { status: 'picked_up' };
      applyTransition(order, 'delivered');
      expect(order.deliveredAt).toBeInstanceOf(Date);
      expect(order.commissionRealized).toBe(true);
      expect(order.commissionRealizedAt).toBeInstanceOf(Date);
    });

    it('stamps cancelledAt on cancel from processed', () => {
      const order = { status: 'processed' };
      applyTransition(order, 'cancelled');
      expect(order.status).toBe('cancelled');
      expect(order.cancelledAt).toBeInstanceOf(Date);
    });

    it('does NOT stamp readyForPickupAt (sole writer is the ready gate)', () => {
      const order = { status: 'processed' };
      applyTransition(order, 'ready_for_pickup');
      expect(order.status).toBe('ready_for_pickup');
      expect(order.readyForPickupAt).toBeUndefined();
    });

    it('throws TransitionError on an invalid transition and leaves the order untouched', () => {
      const order = { status: 'delivered' };
      expect(() => applyTransition(order, 'cancelled')).toThrow(TransitionError);
      expect(order.status).toBe('delivered');
      expect(order.cancelledAt).toBeUndefined();
    });
  });

  describe('maybeReadyForPickup', () => {
    it('delegates to orderReadyGateService.applyReadyGate', async () => {
      const order = { status: 'processed' };
      const result = await maybeReadyForPickup(order, { trigger: 'unit_test' });
      expect(applyReadyGate).toHaveBeenCalledWith(order, { trigger: 'unit_test' });
      expect(result).toEqual({ promoted: true, held: false });
    });
  });
});
