// Order Model — slim state record (Phase 1 PR 3, spec §6).
//
// The order is a thin bag-tracking state record: bag linkage, a 4-state
// status, and a {at, by, role} stamp per scan gate. ALL money, weight,
// pricing, payment, and commission live externally in Cents — this model
// holds none of it (those fields + the pricing/lifecycle pre-save hooks were
// removed; recoverable on the phase2-reference tag).
//
// `by` is a String, not an ObjectId: partners scan (affiliateId) and operators
// scan (Operator _id) — `role` ('affiliate' | 'operator') disambiguates.

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { OPEN_STATUSES } = require('../modules/orders/orderStateMachine');

// Per-scan stamp: who scanned, in what role, when.
const scanEventSchema = new mongoose.Schema({
  at: { type: Date },
  by: { type: String },                 // affiliateId OR Operator _id (as string)
  role: { type: String, enum: ['affiliate', 'operator'] }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    default: () => 'ORD-' + uuidv4(),
    unique: true
  },
  customerId: { type: String, required: true, ref: 'Customer' },
  affiliateId: { type: String, required: true, ref: 'Affiliate' },

  // Durable bag references (one bag = one order) — design §6.
  bagId: { type: String, required: true, ref: 'Bag', index: true },  // == Bag.bagId (BAG-uuid); the JOIN key
  bagToken: { type: String, index: true },                           // == Bag.token (32 hex); denormalized SCAN key

  // 4-state scan-gate machine (spec §3). pending is the birth state.
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'out_for_delivery', 'complete', 'cancelled'],
    default: 'pending'
  },

  // Per-scan stamps (one per gate):
  pickup: scanEventSchema,        // scan 1 — partner pickup -> pending (creation)
  intake: scanEventSchema,        // scan 2 — store intake   -> in_progress
  storePickup: scanEventSchema,   // scan 3 — store pickup    -> out_for_delivery
  delivery: scanEventSchema,      // scan 4 — partner delivery-> complete

  // Manual payment confirmation at store-pickup — a flag only (no payment data;
  // money lives in Cents). Set when the operator checks the payment box.
  paymentConfirmedManually: { type: Boolean, default: false },

  // Terminal timestamps. completedAt is the 4h delivery-rescan reference.
  completedAt: Date,
  cancelledAt: Date,

  // Test order flag for cleanup.
  isTestOrder: { type: Boolean, default: false }
}, { timestamps: true });

// At most ONE open order per bag (open = pending | in_progress | out_for_delivery).
// Backstops the read-then-write open-order guard in the transition service: two
// concurrent pickup scans race, exactly one save wins, the loser's E11000 maps
// to a clean order_already_open. Named so it never collides with the plain
// field-level bagId index (which serves closed-status lookups a partial cannot).
orderSchema.index(
  { bagId: 1 },
  {
    unique: true,
    name: 'bagId_open_unique',
    partialFilterExpression: {
      status: { $in: OPEN_STATUSES }
    }
  }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
