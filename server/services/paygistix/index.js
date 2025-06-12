/**
 * Paygistix Hosted Form Services
 * 
 * This module provides configuration for the Paygistix hosted payment form.
 * No API authentication is required for the hosted form solution.
 */

const paygistixConfig = require('../../config/paygistix.config');

module.exports = {
  getConfig: () => paygistixConfig.getClientConfig(),
  isConfigured: () => paygistixConfig.isConfigured()
};