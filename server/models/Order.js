// Order Model for WaveMAX Laundry Affiliate Program
//
// Redesigned per docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md §4.4:
// orders are created at store intake (one durable bag = one order), priced from
// actualWeight only (no customer estimate exists), and move through
// in_progress -> processed -> ready_for_pickup -> picked_up -> delivered.
// ready_for_pickup is gated on payment (orderReadyGateService.applyReadyGate is
// the SOLE writer of readyForPickupAt — never this pre-save, never a direct PUT).

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const SystemConfig = require('./SystemConfig');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    default: () => 'ORD-' + uuidv4(),
    unique: true
  },
  customerId: { type: String, required: true, ref: 'Customer' },
  affiliateId: { type: String, required: true, ref: 'Affiliate' },

  // Durable bag reference (one bag = one order) — design §4.1 "one identifier per role":
  bagId: { type: String, required: true, ref: 'Bag', index: true },  // == Bag.bagId (BAG-uuid); the JOIN key
  bagToken: { type: String, index: true },                           // == Bag.token (32 hex); denormalized SCAN key

  // Order status
  status: {
    type: String,
    enum: ['in_progress', 'processed', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled'],
    default: 'in_progress'
  },

  // Laundry details
  actualWeight: Number,
  washInstructions: String,

  // Per-order intake snapshot (resets every order; lives here, NOT on the durable Bag)
  intake: {
    weight: { type: Number, default: 0 },
    weighedAt: Date,
    weighedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    processedAt: Date,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    pickedUpAt: Date,                                                // operator scans bag OUT of store
    pickedUpBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    deliveredAt: Date,                                               // affiliate scans at customer door
    deliveredBy: { type: String, ref: 'Affiliate' },                 // affiliateId string
    addOnFormPlaced: { type: Boolean, default: false },              // operator ack: fresh form in pocket
    addOnFormPlacedAt: Date
  },

  // One-element bags[] kept as an array so the 3-stage scanner can iterate.
  // The reference field is bagToken — NEVER bagId — and carries Bag.token (32 hex).
  bags: [{
    bagToken: { type: String, required: true, index: true },
    bagNumber: { type: Number, required: true },                     // always 1 (one bag = one order)
    status: {
      type: String,
      enum: ['intake', 'processed', 'picked_up', 'delivered'],
      default: 'intake'
    },
    weight: { type: Number, default: 0 },
    scannedAt: { intake: Date, processed: Date, picked_up: Date, delivered: Date },
    scannedBy: {
      intake: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
      processed: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
      picked_up: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
      delivered: { type: String, ref: 'Affiliate' }                  // affiliate door-scan
    }
  }],

  // Add-on services — entered by the operator at intake from the paper form
  addOns: {
    premiumDetergent: { type: Boolean, default: false },
    fabricSoftener: { type: Boolean, default: false },
    stainRemover: { type: Boolean, default: false }
  },
  addOnTotal: { type: Number, default: 0 },
  addOnsEnteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  addOnsEnteredAt: Date,
  freshAddOnsFormPlaced: { type: Boolean, default: false },          // operator ack: fresh form in pocket
  freshAddOnsFormAckBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  freshAddOnsFormAckAt: Date,

  // Pricing
  baseRate: { type: Number },                                        // per-pound WDF rate from SystemConfig
  feeBreakdown: {
    numberOfBags: Number,
    minimumFee: Number,
    perBagFee: Number,
    totalFee: Number,                                                // the actual fee charged
    minimumApplied: Boolean
  },
  actualTotal: Number,
  wdfCreditApplied: { type: Number, default: 0 },                    // carry-in credit applied at intake
  wdfCreditGenerated: { type: Number, default: 0 },                  // always 0 — no estimate variance exists
  affiliateCommission: { type: Number, default: 0 },

  // Commission realization (realized at 'delivered', not 'picked_up')
  commissionRealized: { type: Boolean, default: false },
  commissionRealizedAt: Date,

  // Operator processing fields
  assignedOperator: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  operatorNotes: String,
  qualityCheckPassed: { type: Boolean, default: null },
  qualityCheckBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  qualityCheckNotes: String,
  processingTimeMinutes: Number,

  // WDF / delivery fee breakdown extras
  wdfAmount: Number,
  mdfAmount: Number,

  // Post-weigh payment state (enum unchanged — escalation is the boolean below, §4.4)
  paymentStatus: {
    type: String,
    enum: ['pending', 'awaiting', 'confirming', 'verified', 'failed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['venmo', 'paypal', 'cashapp', 'multiple', 'pending', 'credit_card'],
    default: 'pending'
  },
  paymentAmount: { type: Number, default: 0 },
  paymentRequestedAt: Date,
  paymentConfirmedAt: Date,                                          // customer clicked "already paid"
  paymentVerifiedAt: Date,
  paymentTransactionId: String,
  paymentLinks: { venmo: String, paypal: String, cashapp: String },
  paymentQRCodes: { venmo: String, paypal: String, cashapp: String },
  paymentCheckAttempts: { type: Number, default: 0 },                // IMAP detection counter (PR 8 decouples cadence)
  lastPaymentCheck: Date,
  paymentNotes: String,
  paymentReminderCount: { type: Number, default: 0 },                // reminder counter (PR 8: hourly, cap 8)
  paymentLastReminderAt: Date,
  paymentReminders: [{
    sentAt: { type: Date, required: true },
    reminderNumber: { type: Number, required: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Administrator' },
    method: { type: String, enum: ['email', 'sms'], default: 'email' }
  }],
  lastReminderSentAt: Date,
  reminderCount: { type: Number, default: 0 },

  // Payment-hold escalation (design §4.4 — escalated is NOT a paymentStatus value)
  paymentEscalated: { type: Boolean, default: false },               // set true after the 8th reminder (PR 8)
  holdNoticeSentAt: { type: Date },                                  // "come to store" notice sent once (PR 8)
  heldAtStore: { type: Boolean, default: false },                    // processed but unpaid -> physically held

  // Proof of delivery (design §4.4)
  proofOfDelivery: {
    method: { type: String, enum: ['customer_pin', 'affiliate_code', 'reintake', 'manual_confirm'] },
    confirmedByRole: { type: String, enum: ['customer', 'affiliate', 'operator', 'admin'] },
    confirmedById: { type: String },                                 // customerId / affiliateId / operatorId
    confirmedAt: Date,
    geo: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } }, // [lng, lat], optional
    photoKey: String,                                                // FUTURE hook — not built now
    note: { type: String, maxlength: 500 }
  },

  // Test order flag for cleanup
  isTestOrder: { type: Boolean, default: false },

  // Lifecycle timestamps
  createdAt: { type: Date, default: Date.now },
  intakeAt: Date,                                                    // == createdAt for the new flow; explicit for clarity
  processedAt: Date,
  readyForPickupAt: Date,  // SOLE writer = orderReadyGateService.applyReadyGate — never this pre-save, never a direct PUT
  pickedUpAt: Date,                                                  // operator scan-OUT
  deliveredAt: Date,                                                 // renames completedAt
  cancelledAt: Date
}, { timestamps: true });

// Two-kiosk re-intake race backstop (PR 9): at most ONE open order per bag.
// The intake guard is read-then-write; this partial unique index makes the
// invariant a database guarantee — the race loser's E11000 is mapped to a
// 409 order_already_open by orderIntakeService. Named explicitly so it never
// collides with the plain field-level bagId index (which still serves the
// $nin / closed-status lookups a partial index cannot).
orderSchema.index(
  { bagId: 1 },
  {
    unique: true,
    name: 'bagId_open_unique',
    partialFilterExpression: {
      status: { $in: ['in_progress', 'processed', 'ready_for_pickup', 'picked_up'] }
    }
  }
);

// Pricing + lifecycle pre-save engine (design §4.4 rewrite).
// Pricing inputs (feeBreakdown, addOns, actualWeight, wdfCreditApplied) must be
// set BEFORE the first .save() — this hook READS feeBreakdown.totalFee, it does
// not compute the delivery fee (intake owns that via orderPricingService, PR 7).
orderSchema.pre('save', async function(next) {
  // Fetch current WDF rate from system config if not explicitly set
  if (this.isNew && !this.baseRate) {
    try {
      this.baseRate = await SystemConfig.getValue('wdf_base_rate_per_pound', 1.25);
    } catch (error) {
      // If SystemConfig is not available, use default
      this.baseRate = 1.25;
    }
  }

  if (this.isNew && !this.intakeAt) {
    this.intakeAt = this.createdAt || new Date();
  }

  // Add-on total — based on actualWeight ONLY (no estimate exists in the at-intake flow)
  if (this.isNew || this.isModified('addOns') || this.isModified('actualWeight')) {
    const weight = this.actualWeight || 0;
    const selectedAddOns = Object.values(this.addOns || {}).filter(selected => selected === true).length;
    this.addOnTotal = parseFloat((selectedAddOns * weight * 0.10).toFixed(2));
  }

  // Actual total / payment amount / commission — actualWeight only; fee READ from feeBreakdown
  if (this.actualWeight &&
      (this.isNew || this.isModified('actualWeight') || this.isModified('addOns') ||
       this.isModified('feeBreakdown') || this.isModified('wdfCreditApplied') || this.isModified('baseRate'))) {
    const totalFee = this.feeBreakdown?.totalFee || 0;
    const wdfTotal = this.actualWeight * this.baseRate;
    const subtotal = wdfTotal + totalFee + (this.addOnTotal || 0);
    // Apply carry-in WDF credit (subtract if positive credit, add if negative/debit)
    this.actualTotal = parseFloat((subtotal - (this.wdfCreditApplied || 0)).toFixed(2));
    // Payment amount is the gross total without credits (credits apply to the customer, not the invoice)
    this.paymentAmount = parseFloat((wdfTotal + totalFee + (this.addOnTotal || 0)).toFixed(2));
    // Affiliate commission = (WDF x 10%) + delivery fee. Add-ons and credits are NOT included.
    this.affiliateCommission = parseFloat(((wdfTotal * 0.1) + totalFee).toFixed(2));
    // No estimate-vs-actual variance exists in the at-intake flow.
    this.wdfCreditGenerated = 0;
  }

  // Stamp paymentVerifiedAt when payment becomes verified
  if (this.isModified('paymentStatus') && this.paymentStatus === 'verified' && !this.paymentVerifiedAt) {
    this.paymentVerifiedAt = new Date();
  }

  // Lifecycle timestamps, set-once. 'ready_for_pickup' is deliberately absent:
  // readyForPickupAt has a single writer — orderReadyGateService.applyReadyGate
  // (design §4.4 / settled §13 #3).
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
    case 'processed':
      if (!this.processedAt) this.processedAt = now;
      break;
    case 'picked_up':
      if (!this.pickedUpAt) this.pickedUpAt = now;
      break;
    case 'delivered':
      if (!this.deliveredAt) this.deliveredAt = now;
      if (!this.commissionRealized) {
        this.commissionRealized = true;
        this.commissionRealizedAt = now;
      }
      break;
    case 'cancelled':
      if (!this.cancelledAt) this.cancelledAt = now;
      break;
    }
  }

  next();
});

// Create model
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
