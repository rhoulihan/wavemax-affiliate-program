// Affiliate payment-lock service
//
// The admin-manual-unlock half of the DocuSign removal: affiliates who
// exceed the payout threshold without a W-9 on file get
// paymentProcessingLocked=true. Admins review, collect paperwork out of
// band, then unlock here with notes that become the audit trail.
//
// getAffiliatesList doubles as the dashboard data source and supports
// filtering by status/locked/search across the four name/email/ID fields.

const Affiliate = require('../models/Affiliate');
const { escapeRegex } = require('../utils/securityUtils');

class PaymentLockError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.isPaymentLockError = true;
  }
}

function toAffiliateSummary(affiliate) {
  return {
    _id: affiliate._id,
    affiliateId: affiliate.affiliateId,
    businessName: affiliate.businessName,
    firstName: affiliate.firstName,
    lastName: affiliate.lastName,
    email: affiliate.email,
    isActive: affiliate.isActive,
    serviceArea: affiliate.serviceArea,
    paymentProcessingLocked: affiliate.paymentProcessingLocked || false,
    paymentLockedAt: affiliate.paymentLockedAt,
    paymentLockReason: affiliate.paymentLockReason,
    paymentUnlockedAt: affiliate.paymentUnlockedAt,
    paymentUnlockNotes: affiliate.paymentUnlockNotes,
    w9Status: affiliate.w9Status,
    w9OnFileAt: affiliate.w9OnFileAt
  };
}

async function listAffiliates({ search, status, locked, limit = 100 }) {
  const query = {};
  if (search) {
    const escapedSearch = escapeRegex(search);
    query.$or = [
      { businessName: { $regex: escapedSearch, $options: 'i' } },
      { firstName: { $regex: escapedSearch, $options: 'i' } },
      { lastName: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
      { affiliateId: { $regex: escapedSearch, $options: 'i' } }
    ];
  }
  if (status === 'active') query.isActive = true;
  else if (status === 'inactive') query.isActive = false;

  if (locked === 'true') query.paymentProcessingLocked = true;
  else if (locked === 'false') query.paymentProcessingLocked = { $ne: true };

  const affiliates = await Affiliate.find(query)
    .select('affiliateId firstName lastName businessName email isActive serviceArea '
          + 'paymentProcessingLocked paymentLockedAt paymentLockReason '
          + 'paymentUnlockedAt paymentUnlockNotes w9Status w9OnFileAt')
    .limit(parseInt(limit, 10))
    .sort('businessName');

  return affiliates.map(toAffiliateSummary);
}

async function lockPayments({ affiliateId, reason = 'admin_hold', notes }) {
  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) throw new PaymentLockError('not_found', 'Affiliate not found', 404);

  affiliate.paymentProcessingLocked = true;
  affiliate.paymentLockedAt = new Date();
  affiliate.paymentLockReason = reason;
  if (notes) affiliate.paymentUnlockNotes = notes;

  await affiliate.save();

  return {
    affiliateId: affiliate.affiliateId,
    paymentProcessingLocked: true,
    paymentLockedAt: affiliate.paymentLockedAt,
    paymentLockReason: affiliate.paymentLockReason
  };
}

async function unlockPayments({ affiliateId, notes, w9Received = true, adminId }) {
  if (!notes) {
    throw new PaymentLockError('notes_required', 'Notes are required when unlocking payments');
  }

  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) throw new PaymentLockError('not_found', 'Affiliate not found', 404);

  const wasLockedForW9 = affiliate.paymentLockReason === 'w9_required';

  affiliate.paymentProcessingLocked = false;
  affiliate.paymentUnlockedAt = new Date();
  affiliate.paymentUnlockedBy = adminId;
  affiliate.paymentUnlockNotes = notes;

  // Flip w9Status to on_file only when the admin explicitly confirms it.
  // This is the post-DocuSign manual trail that replaces the envelope webhook.
  if (wasLockedForW9 && w9Received) {
    affiliate.w9Status = 'on_file';
    affiliate.w9OnFileAt = new Date();
  }

  await affiliate.save();

  return {
    affiliateId: affiliate.affiliateId,
    paymentProcessingLocked: false,
    paymentUnlockedAt: affiliate.paymentUnlockedAt,
    paymentUnlockNotes: affiliate.paymentUnlockNotes,
    w9Status: affiliate.w9Status,
    w9OnFileAt: affiliate.w9OnFileAt
  };
}

module.exports = {
  listAffiliates,
  lockPayments,
  unlockPayments,
  PaymentLockError
};
