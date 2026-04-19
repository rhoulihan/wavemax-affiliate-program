// Order pricing service
//
// Pure pricing logic for orders: delivery-fee calculation with affiliate
// overrides + system defaults, plus the commission formula used both in
// the Order model's pre-save hook and in reporting code.
//
// Extracted from orderController.js in Phase 2 so pricing lives in one
// place and can be unit-tested in isolation.

const SystemConfig = require('../models/SystemConfig');

/**
 * Compute the delivery fee for a given bag count.
 * Uses the affiliate's per-bag / minimum overrides if set, otherwise
 * falls back to system-wide SystemConfig defaults.
 *
 * The returned shape matches Order.feeBreakdown and is spread into it
 * directly when creating an order.
 */
async function calculateDeliveryFee(numberOfBags, affiliate = null) {
  const systemMinimumFee = await SystemConfig.getValue('delivery_minimum_fee', 10.00);
  const systemPerBagFee = await SystemConfig.getValue('delivery_per_bag_fee', 2.00);

  const minimumFee = affiliate?.minimumDeliveryFee ?? systemMinimumFee;
  const perBagFee = affiliate?.perBagDeliveryFee ?? systemPerBagFee;

  const calculatedFee = numberOfBags * perBagFee;
  const totalFee = Math.max(minimumFee, calculatedFee);

  return {
    numberOfBags,
    minimumFee,
    perBagFee,
    totalFee,
    minimumApplied: totalFee === minimumFee
  };
}

/**
 * Affiliate commission = 10% of WDF (weight × baseRate) + full delivery fee.
 * Add-ons and customer credits are NOT part of the commission base.
 */
function calculateCommission({ actualWeight, baseRate, deliveryFee }) {
  const wdfAmount = (actualWeight || 0) * (baseRate || 0);
  const wdfCommission = wdfAmount * 0.1;
  return parseFloat((wdfCommission + (deliveryFee || 0)).toFixed(2));
}

module.exports = {
  calculateDeliveryFee,
  calculateCommission
};
