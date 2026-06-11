// W-9 upload / status / admin review controller (redesign PR 10 — GREENFIELD).
// Spec: docs/superpowers/specs/2026-06-08-invite-bag-workflow-redesign-design.md
// §4.3 (storage + fields), §5 (API), §6.2 (subsystem), §9 (audit/RBAC).
//
// Bytes flow: multer memoryStorage (middleware/uploadW9.js) -> req.file.buffer
// -> secureFileStore.storeEncrypted (AES-256-GCM self-framed file under
// W9_STORAGE_PATH) -> only metadata persisted on Affiliate.w9Document.

const path = require('path');
const Affiliate = require('../../models/Affiliate');
const secureFileStore = require('../../services/secureFileStore');
const affiliatePaymentLockService = require('../../services/affiliatePaymentLockService');
const onboardingEmails = require('../../services/email/dispatcher/onboarding');
const ControllerHelpers = require('../../utils/controllerHelpers');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');
const logger = require('../../utils/logger');

/** Strip directories + dangerous chars from a client filename. */
function sanitizeFilename(name) {
  return path.basename(String(name || 'w9')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

async function sendStatusEmailBestEffort(affiliate, status, ...opts) {
  try {
    await onboardingEmails.sendAffiliateW9StatusEmail(affiliate, status, ...opts);
  } catch (emailError) {
    logger.warn('W-9 status email failed (continuing)', {
      affiliateId: affiliate.affiliateId, status, error: emailError.message
    });
  }
}

/**
 * POST /api/v1/affiliates/:affiliateId/w9 — self affiliate OR administrator.
 * Multipart field 'w9' (middleware/uploadW9.js). Re-upload deletes the prior
 * encrypted file (spec §6.2 — no orphan files). 201 -> pending_review.
 */
exports.uploadW9 = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;

  const isSelf = req.user.role === 'affiliate' && req.user.affiliateId === affiliateId;
  const isAdmin = req.user.role === 'administrator' || req.user.role === 'admin';
  if (!isSelf && !isAdmin) {
    return ControllerHelpers.sendError(res, 'Unauthorized', 403);
  }

  if (!req.file || !req.file.buffer) {
    return ControllerHelpers.sendError(res, 'A W-9 file is required (multipart field "w9")', 400);
  }

  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);

  // Re-upload cleanup: remove the previous encrypted file before replacing.
  if (affiliate.w9Document && affiliate.w9Document.storageKey) {
    try {
      await secureFileStore.deleteFile(affiliate.w9Document.storageKey);
    } catch (cleanupError) {
      logger.warn('Failed to delete prior W-9 file (continuing)', {
        affiliateId, storageKey: affiliate.w9Document.storageKey, error: cleanupError.message
      });
    }
  }

  // Filesystem failures must never leak paths into the HTTP response —
  // log the detail, return a generic message (review-mandated hardening).
  let storageKey, sha256;
  try {
    ({ storageKey, sha256 } = await secureFileStore.storeEncrypted(req.file.buffer, {
      affiliateId,
      contentType: req.file.mimetype,
      filename: req.file.originalname
    }));
  } catch (storeError) {
    logger.error('W-9 encrypted store failed', { affiliateId, error: storeError.message });
    return ControllerHelpers.sendError(res, 'Unable to store W-9 document', 500);
  }

  const now = new Date();
  affiliate.w9Document = {
    storageKey,
    filename: sanitizeFilename(req.file.originalname),
    contentType: req.file.mimetype,
    sizeBytes: req.file.size,
    sha256,
    submittedAt: now
  };
  affiliate.w9Status = 'pending_review';
  affiliate.w9SubmittedAt = now;
  await affiliate.save();

  logAuditEvent(AuditEvents.W9_UPLOADED, {
    affiliateId, storageKey, sizeBytes: req.file.size, contentType: req.file.mimetype
  }, req);

  await sendStatusEmailBestEffort(affiliate, 'received');

  return ControllerHelpers.sendSuccess(res, {
    w9Status: affiliate.w9Status,
    submittedAt: affiliate.w9SubmittedAt
  }, 'W-9 uploaded and pending review', 201);
});

/** GET /api/v1/w9/status — affiliate (self). */
exports.getW9Status = ControllerHelpers.asyncWrapper(async (req, res) => {
  const affiliate = await Affiliate.findOne({ affiliateId: req.user.affiliateId })
    .select('w9Status w9SubmittedAt w9RejectedReason');
  if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  return ControllerHelpers.sendSuccess(res, {
    w9Status: affiliate.w9Status,
    submittedAt: affiliate.w9SubmittedAt || null,
    rejectedReason: affiliate.w9Status === 'rejected' ? (affiliate.w9RejectedReason || null) : null
  }, 'W-9 status');
});

/** GET /api/v1/w9/admin/pending — administrator + manage_affiliates. */
exports.getPendingW9s = ControllerHelpers.asyncWrapper(async (req, res) => {
  const affiliates = await Affiliate.find({ w9Status: 'pending_review' })
    .select('affiliateId firstName lastName businessName email w9SubmittedAt '
          + 'w9Document.filename w9Document.contentType w9Document.sizeBytes')
    .sort('w9SubmittedAt');
  return ControllerHelpers.sendSuccess(res, { affiliates }, 'Pending W-9 reviews');
});

/**
 * GET /api/v1/w9/admin/:affiliateId/document — administrator + manage_affiliates.
 * Streams DECRYPTED bytes: Content-Disposition attachment + nosniff, never
 * inlined, audit-logged on EVERY read (spec §9). Decrypt/integrity failure
 * -> 500 + SUSPICIOUS_ACTIVITY audit.
 */
exports.downloadW9 = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate || !affiliate.w9Document || !affiliate.w9Document.storageKey) {
    return ControllerHelpers.sendError(res, 'No W-9 document on file', 404);
  }

  let plaintext;
  try {
    plaintext = await secureFileStore.readDecrypted(affiliate.w9Document.storageKey, {
      expectedSha256: affiliate.w9Document.sha256
    });
  } catch (err) {
    logAuditEvent(AuditEvents.SUSPICIOUS_ACTIVITY, {
      activityType: 'W9_DECRYPT_FAILED',
      affiliateId,
      storageKey: affiliate.w9Document.storageKey
    }, req);
    logger.error('W-9 decrypt/integrity failure', { affiliateId, error: err.message });
    return ControllerHelpers.sendError(res, 'Unable to read W-9 document', 500);
  }

  logAuditEvent(AuditEvents.W9_DOCUMENT_ACCESSED, {
    affiliateId, storageKey: affiliate.w9Document.storageKey
  }, req);

  res.setHeader('Content-Type', affiliate.w9Document.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition',
    `attachment; filename="${affiliate.w9Document.filename || 'w9'}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(plaintext);
});

/**
 * POST /api/v1/w9/admin/:affiliateId/verify — administrator + manage_affiliates.
 * pending_review -> on_file; unlocks payments when locked for 'w9_required'
 * via the EXISTING affiliatePaymentLockService.unlockPayments (which itself
 * re-asserts w9Status='on_file' for the w9_required case — idempotent).
 */
exports.verifyW9 = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  if (affiliate.w9Status !== 'pending_review') {
    return ControllerHelpers.sendError(res,
      `W-9 is not pending review (current status: ${affiliate.w9Status})`, 409);
  }

  const now = new Date();
  affiliate.w9Status = 'on_file';
  affiliate.w9OnFileAt = now;
  affiliate.w9VerifiedAt = now;
  affiliate.w9VerifiedBy = req.user.id;
  await affiliate.save();

  let paymentsUnlocked = false;
  if (affiliate.paymentProcessingLocked && affiliate.paymentLockReason === 'w9_required') {
    await affiliatePaymentLockService.unlockPayments({
      affiliateId,
      notes: 'W-9 verified via in-app admin review (PR10 W-9 surface)',
      w9Received: true,
      adminId: req.user.id
    });
    paymentsUnlocked = true;
  }

  logAuditEvent(AuditEvents.W9_VERIFIED, { affiliateId, paymentsUnlocked }, req);
  await sendStatusEmailBestEffort(affiliate, 'verified');

  return ControllerHelpers.sendSuccess(res,
    { w9Status: 'on_file', paymentsUnlocked }, 'W-9 verified');
});

/**
 * POST /api/v1/w9/admin/:affiliateId/reject — administrator + manage_affiliates.
 * Requires body.reason. The encrypted file is NOT deleted here — it is
 * replaced (and the old one deleted) on the affiliate's re-upload.
 */
exports.rejectW9 = ControllerHelpers.asyncWrapper(async (req, res) => {
  const { affiliateId } = req.params;
  const reason = ((req.body && req.body.reason) || '').trim();
  if (!reason) return ControllerHelpers.sendError(res, 'A rejection reason is required', 400);

  const affiliate = await Affiliate.findOne({ affiliateId });
  if (!affiliate) return ControllerHelpers.sendError(res, 'Affiliate not found', 404);
  if (affiliate.w9Status !== 'pending_review') {
    return ControllerHelpers.sendError(res,
      `W-9 is not pending review (current status: ${affiliate.w9Status})`, 409);
  }

  affiliate.w9Status = 'rejected';
  affiliate.w9RejectedAt = new Date();
  affiliate.w9RejectedReason = reason;
  await affiliate.save();

  logAuditEvent(AuditEvents.W9_REJECTED, { affiliateId, reason }, req);
  await sendStatusEmailBestEffort(affiliate, 'rejected', { reason });

  return ControllerHelpers.sendSuccess(res, { w9Status: 'rejected' }, 'W-9 rejected');
});
