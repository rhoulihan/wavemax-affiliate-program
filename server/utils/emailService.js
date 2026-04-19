// Email service — thin re-export of the modular email dispatcher.
//
// The implementation was split in Phase 2 of the refactor:
//   - server/services/email/transport.js          — SMTP (Mailcow) + console adapter
//   - server/services/email/template-manager.js   — template loading + i18n fallback + fillers
//   - server/services/email/dispatcher/{affiliate,customer,admin,operator,ops,payment,beta}.js
//     — per-domain email senders
//
// New code should import from `server/services/email/...` directly. This shim
// preserves the existing import path (`require('../utils/emailService')`) so
// we don't have to touch every controller/service in the same commit.

module.exports = require('../services/email/dispatcher');
