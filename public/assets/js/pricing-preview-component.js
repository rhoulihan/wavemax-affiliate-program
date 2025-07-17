/**
 * Pricing Preview Component for WaveMAX Affiliate Program
 * Reusable component to display earnings preview based on delivery fee structure
 */

(function() {
  'use strict';

  // Constants for commission calculation
  const WDF_RATE = 1.25; // $1.25 per pound
  const LBS_PER_BAG = 30; // 30 lbs per bag average
  const COMMISSION_RATE = 0.10; // 10% commission

  /**
   * Create the pricing preview HTML structure
   * @param {string} containerId - The ID of the container element
   * @param {Object} options - Configuration options
   * @returns {void}
   */
  function createPricingPreview(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with ID "${containerId}" not found`);
      return;
    }

    // Default options
    const config = {
      showTitle: true,
      titleText: options.titleText || 'Earnings Preview',
      showNotes: true,
      compact: false,
      ...options
    };

    // Create the HTML structure
    const html = `
      <div class="pricing-preview-component">
        ${config.showTitle ? `<p class="text-sm font-semibold text-gray-700 mb-3" data-i18n="${config.titleI18n || 'affiliate.dashboard.settings.earningsPreview'}">${config.titleText}</p>` : ''}
        
        <!-- Pricing Table -->
        <div class="mb-4">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-2 text-gray-600" data-i18n="affiliate.register.bags">Bags</th>
                <th class="text-right py-2 text-gray-600"><span data-i18n="affiliate.register.deliveryFee">Delivery</span><sup>1</sup></th>
                <th class="text-right py-2 text-gray-600"><span data-i18n="affiliate.register.yourCommission">Your Commission</span><sup>2</sup></th>
                <th class="text-right py-2 text-gray-600"><span data-i18n="affiliate.register.total">Total Earnings</span><sup>3</sup></th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-gray-100">
                <td class="py-2 text-gray-600">1</td>
                <td class="text-right py-2 text-gray-600" id="${containerId}-calc1bag">$25</td>
                <td class="text-right py-2 text-green-600" id="${containerId}-comm1bag">$3.75</td>
                <td class="text-right py-2 font-semibold text-blue-600" id="${containerId}-total1bag">$28.75</td>
              </tr>
              <tr class="border-b border-gray-100">
                <td class="py-2 text-gray-600">3</td>
                <td class="text-right py-2 text-gray-600" id="${containerId}-calc3bags">$30</td>
                <td class="text-right py-2 text-green-600" id="${containerId}-comm3bags">$11.25</td>
                <td class="text-right py-2 font-semibold text-blue-600" id="${containerId}-total3bags">$41.25</td>
              </tr>
              <tr class="border-b border-gray-100">
                <td class="py-2 text-gray-600">5</td>
                <td class="text-right py-2 text-gray-600" id="${containerId}-calc5bags">$50</td>
                <td class="text-right py-2 text-green-600" id="${containerId}-comm5bags">$18.75</td>
                <td class="text-right py-2 font-semibold text-blue-600" id="${containerId}-total5bags">$68.75</td>
              </tr>
              <tr>
                <td class="py-2 text-gray-600">10</td>
                <td class="text-right py-2 text-gray-600" id="${containerId}-calc10bags">$100</td>
                <td class="text-right py-2 text-green-600" id="${containerId}-comm10bags">$37.50</td>
                <td class="text-right py-2 font-semibold text-blue-600" id="${containerId}-total10bags">$137.50</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        ${config.showNotes ? `
        <div class="text-xs text-gray-500 space-y-1">
          <p data-i18n="affiliate.register.paymentNote">You will be paid the minimum delivery fee or the per bag fees, whichever is greater.</p>
          <p data-i18n="affiliate.register.deliveryNote">1. Delivery: 100% of delivery fees go to you</p>
          <p data-i18n="affiliate.register.commissionNote">2. Commission: 10% of WDF service (30 lbs × $1.25/lb per bag)</p>
          <p data-i18n="affiliate.register.totalNote">3. Total Earnings: Delivery fee + Commission</p>
        </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;

    // Initialize i18n for the new elements if available
    if (window.i18n && window.i18n.translateElement) {
      window.i18n.translateElement(container);
    }
  }

  /**
   * Update the pricing preview with new fee values
   * @param {string} containerId - The ID of the container element
   * @param {number} minimumFee - Minimum delivery fee
   * @param {number} perBagFee - Per-bag delivery fee
   * @returns {void}
   */
  function updatePricingPreview(containerId, minimumFee, perBagFee) {
    // Ensure we have valid numbers
    minimumFee = parseFloat(minimumFee) || 25;
    perBagFee = parseFloat(perBagFee) || 10;

    // Update all example calculations
    [1, 3, 5, 10].forEach(bags => {
      const calculatedFee = bags * perBagFee;
      const deliveryFee = Math.max(minimumFee, calculatedFee);

      // Calculate WDF commission
      const wdfRevenue = bags * LBS_PER_BAG * WDF_RATE;
      const commission = wdfRevenue * COMMISSION_RATE;

      // Update delivery fee display
      const feeElement = document.getElementById(`${containerId}-calc${bags}bag${bags > 1 ? 's' : ''}`);
      if (feeElement) {
        feeElement.textContent = `$${deliveryFee}`;
        // Add visual indicator if minimum applies
        if (deliveryFee === minimumFee && calculatedFee < minimumFee) {
          feeElement.title = 'Minimum fee applies';
          feeElement.classList.add('font-semibold');
        } else {
          feeElement.title = `${bags} bags × $${perBagFee}/bag = $${calculatedFee}`;
          feeElement.classList.remove('font-semibold');
        }
      }

      // Update commission display
      const commElement = document.getElementById(`${containerId}-comm${bags}bag${bags > 1 ? 's' : ''}`);
      if (commElement) {
        commElement.textContent = `$${commission.toFixed(2)}`;
        commElement.title = `${bags} bags × ${LBS_PER_BAG} lbs × $${WDF_RATE}/lb × ${COMMISSION_RATE * 100}% = $${commission.toFixed(2)}`;
      }

      // Calculate and update total earnings (delivery + commission)
      const totalEarnings = deliveryFee + commission;
      const totalElement = document.getElementById(`${containerId}-total${bags}bag${bags > 1 ? 's' : ''}`);
      if (totalElement) {
        totalElement.textContent = `$${totalEarnings.toFixed(2)}`;
        totalElement.title = `Delivery: $${deliveryFee} + Commission: $${commission.toFixed(2)} = $${totalEarnings.toFixed(2)}`;
      }
    });
  }

  /**
   * Initialize a pricing preview component with input bindings
   * @param {string} containerId - The ID of the container element
   * @param {string} minimumFeeInputId - The ID of the minimum fee input
   * @param {string} perBagFeeInputId - The ID of the per-bag fee input
   * @param {Object} options - Configuration options
   * @returns {Object} Component instance with update method
   */
  function initPricingPreview(containerId, minimumFeeInputId, perBagFeeInputId, options = {}) {
    // Create the preview HTML
    createPricingPreview(containerId, options);

    // Get input elements
    const minimumFeeInput = document.getElementById(minimumFeeInputId);
    const perBagFeeInput = document.getElementById(perBagFeeInputId);

    // Function to update the preview
    const update = () => {
      const minimumFee = parseFloat(minimumFeeInput?.value) || 25;
      const perBagFee = parseFloat(perBagFeeInput?.value) || 10;
      updatePricingPreview(containerId, minimumFee, perBagFee);
    };

    // Bind to input changes if inputs exist
    if (minimumFeeInput) {
      minimumFeeInput.addEventListener('input', update);
      minimumFeeInput.addEventListener('change', update);
    }
    if (perBagFeeInput) {
      perBagFeeInput.addEventListener('input', update);
      perBagFeeInput.addEventListener('change', update);
    }

    // Initial update
    update();

    // Return component instance
    return {
      update,
      destroy: () => {
        // Remove event listeners
        if (minimumFeeInput) {
          minimumFeeInput.removeEventListener('input', update);
          minimumFeeInput.removeEventListener('change', update);
        }
        if (perBagFeeInput) {
          perBagFeeInput.removeEventListener('input', update);
          perBagFeeInput.removeEventListener('change', update);
        }
      }
    };
  }

  // Export to global scope
  window.PricingPreviewComponent = {
    create: createPricingPreview,
    update: updatePricingPreview,
    init: initPricingPreview
  };

})();