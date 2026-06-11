// inviteController — admin mint/list/resend/revoke + public token validate.

const { validationResult } = require('express-validator');
const inviteService = require('./inviteService');
const { InviteError } = inviteService;
const AffiliateInvite = require('./AffiliateInvite');
const ControllerHelpers = require('../../utils/controllerHelpers');
const { logAuditEvent, AuditEvents } = require('../../utils/auditLogger');

// Admin-facing projection. NEVER include tokenHash (and the raw token is
// never available here at all — it lives only in the emailed link).
function inviteSummary(invite) {
  return {
    inviteId: invite.inviteId,
    email: invite.email,
    prefill: invite.prefill,
    status: invite.status,
    expiresAt: invite.expiresAt,
    sentAt: invite.sentAt,
    resendCount: invite.resendCount,
    acceptedAt: invite.acceptedAt,
    acceptedAffiliateId: invite.acceptedAffiliateId,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt
  };
}

function sendInviteError(res, err) {
  return ControllerHelpers.sendError(res, 'Invite operation failed', err.statusCode, [{ code: err.code }]);
}

/**
 * POST /api/v1/administrators/affiliate-invites
 */
exports.mintInvite = ControllerHelpers.asyncWrapper(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, prefill, ttlHours } = req.body;
  try {
    const { invite } = await inviteService.createInvite({
      email, prefill, ttlHours, adminId: req.user.id
    });
    logAuditEvent(AuditEvents.INVITE_MINTED, { inviteId: invite.inviteId, email: invite.email }, req);
    return ControllerHelpers.sendSuccess(res, { invite: inviteSummary(invite) }, 'Invite created', 201);
  } catch (err) {
    if (err instanceof InviteError) return sendInviteError(res, err);
    throw err;
  }
});

/**
 * GET /api/v1/administrators/affiliate-invites?status=
 */
exports.listInvites = ControllerHelpers.asyncWrapper(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const invites = await AffiliateInvite.find(filter).sort({ createdAt: -1 }).limit(200);
  return ControllerHelpers.sendSuccess(res, { invites: invites.map(inviteSummary) }, 'Invites retrieved');
});

/**
 * POST /api/v1/administrators/affiliate-invites/:inviteId/resend
 */
exports.resendInvite = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const { invite } = await inviteService.resendInvite({
      inviteId: req.params.inviteId, adminId: req.user.id
    });
    return ControllerHelpers.sendSuccess(res, { invite: inviteSummary(invite) }, 'Invite re-sent');
  } catch (err) {
    if (err instanceof InviteError) return sendInviteError(res, err);
    throw err;
  }
});

/**
 * POST /api/v1/administrators/affiliate-invites/:inviteId/revoke
 */
exports.revokeInvite = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const invite = await inviteService.revokeInvite({
      inviteId: req.params.inviteId, adminId: req.user.id
    });
    logAuditEvent(AuditEvents.INVITE_REVOKED, { inviteId: invite.inviteId, email: invite.email }, req);
    return ControllerHelpers.sendSuccess(res, { invite: inviteSummary(invite) }, 'Invite revoked');
  } catch (err) {
    if (err instanceof InviteError) return sendInviteError(res, err);
    throw err;
  }
});

/**
 * GET /api/v1/affiliate-invites/:token/validate  (PUBLIC — Task 5 mounts it)
 *
 * Anti-enumeration (spec §9): every failure is the same generic 410 shape.
 * 'expired' is the only specific reason (the holder already has the real
 * token, so naming expiry leaks nothing); already_used/revoked/unknown all
 * collapse to 'invalid'.
 */
exports.validateInvite = ControllerHelpers.asyncWrapper(async (req, res) => {
  try {
    const invite = await inviteService.validateInvite(req.params.token);
    return ControllerHelpers.sendSuccess(res, {
      valid: true,
      email: invite.email,
      prefill: invite.prefill,
      expiresAt: invite.expiresAt
    }, 'Invite valid');
  } catch (err) {
    if (err instanceof InviteError) {
      const reason = err.code === 'expired' ? 'expired' : 'invalid';
      return res.status(410).json({ success: false, valid: false, reason });
    }
    throw err;
  }
});
