// Email dispatcher — aggregates per-domain email senders under a single
// export surface.
//
// Background: the original utils/emailService.js was a 3,620-line file that
// mixed transport config, template loading, i18n fallback, and 35+ email-
// type wrappers. In Phase 2 we split it by responsibility (transport,
// template-manager) and by recipient/domain (affiliate, customer, admin,
// operator, ops, payment, beta).

const affiliate = require('./affiliate');
const customer = require('./customer');
const admin = require('./admin');
const operator = require('./operator');
const ops = require('./ops');
const payment = require('./payment');
const beta = require('./beta');

const { sendEmail } = require('../transport');
const { formatSize } = require('../template-manager');

module.exports = {
  ...affiliate,
  ...customer,
  ...admin,
  ...operator,
  ...ops,
  ...payment,
  ...beta,
  // Low-level helpers kept for backward compatibility with existing callers.
  sendEmail,
  formatSize
};
