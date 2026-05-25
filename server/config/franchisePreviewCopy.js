// Shared copy for the franchise self-serve preview, used in three places so the
// attestation wording + version stay in lockstep: the request modal checkbox,
// the unlock (password) form, and the unlock email. The FranchisePreviewRequest
// records DISCLAIMER_VERSION in attestation.version, so we can prove which
// wording a franchisee accepted.
//
// ⚠ DRAFT — placeholder copy pending Rick's / legal final sign-off before launch.
'use strict';

const DISCLAIMER_VERSION = '2026-05-25-draft';

// The reminder shown to the franchisee in every surface.
const REMINDER =
  'As the franchisee, you hold the right to market your own location online — by continuing you are confirming that you are authorized to make this decision.';

// The authorization the franchisee affirms (the checkbox label / unlock notice).
const AUTHORIZATION =
  'I am an authorized representative of this business, and I authorize CRHS Enterprises, LLC to temporarily host marketing preview content for this franchise location on my behalf.';

module.exports = { DISCLAIMER_VERSION, REMINDER, AUTHORIZATION };
