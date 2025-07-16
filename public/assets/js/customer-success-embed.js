// Customer Success Embed Page Script
(function() {
  'use strict';

  // PostMessage communication with parent window
  function sendMessageToParent(type, data) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: type,
        source: 'wavemax-embed',
        data: data
      }, '*');
    }
  }

  // Navigate parent frame
  function navigateParent(page) {
    // For embedded context, navigate within iframe
    if (window.parent !== window) {
      // Get current URL parameters to preserve affiliate ID
      const currentParams = new URLSearchParams(window.location.search);
      const affiliateId = currentParams.get('affid') || currentParams.get('affiliate');

      // Build new URL with route
      const newParams = new URLSearchParams();
      newParams.set('route', `/${page}`);

      // Preserve affiliate ID if present
      if (affiliateId) {
        newParams.set('affid', affiliateId);
      }

      // Navigate to the new route
      window.location.href = `/embed-app-v2.html?${newParams.toString()}`;
    } else {
      // For direct access, just navigate
      window.location.href = `/${page}.html`;
    }
  }

  // Make navigateParent available globally for onclick handlers
  window.navigateParent = navigateParent;
  
  // Add click handler for dashboard button
  function setupEventHandlers() {
    const customerDashboardBtn = document.getElementById('customerDashboardBtn');
    if (customerDashboardBtn) {
      customerDashboardBtn.addEventListener('click', function(e) {
        e.preventDefault();
        navigateParent('customer-login');
      });
    }
  }

  function loadAffiliateInfo(affiliateId) {
    console.log('Loading affiliate info for ID:', affiliateId);
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const url = `${baseUrl}/api/v1/affiliates/${affiliateId}/public`;
    console.log('Fetching from URL:', url);

    fetch(url, {
      credentials: 'include'
    })
      .then(response => {
        console.log('Affiliate response status:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('Affiliate data received:', data);
        if (data.success && data.affiliate) {
          const affiliate = data.affiliate;
          document.getElementById('affiliateName').textContent =
                    `${affiliate.firstName} ${affiliate.lastName} (${affiliate.businessName})`;
          document.getElementById('serviceArea').textContent =
                    affiliate.serviceArea || `${affiliate.city}, ${affiliate.state}` || 'Your local area';

          // Calculate delivery fee based on the affiliate's fee structure
          let deliveryFeeText = '';
          if (affiliate.minimumDeliveryFee !== null && affiliate.minimumDeliveryFee !== undefined &&
                    affiliate.perBagDeliveryFee !== null && affiliate.perBagDeliveryFee !== undefined) {
            deliveryFeeText = `$${affiliate.minimumDeliveryFee.toFixed(2)} minimum, then $${affiliate.perBagDeliveryFee.toFixed(2)} per bag`;
          } else if (affiliate.deliveryFee !== null && affiliate.deliveryFee !== undefined) {
            deliveryFeeText = `$${affiliate.deliveryFee.toFixed(2)} per pickup/delivery`;
          } else {
            deliveryFeeText = 'Contact provider for pricing';
          }
          document.getElementById('deliveryFee').textContent = deliveryFeeText;
        } else {
          console.log('No affiliate data or success=false, showing fallback');
          showFallbackAffiliateInfo();
        }
      })
      .catch(error => {
        console.error('Error loading affiliate:', error);
        showFallbackAffiliateInfo();
      });
  }

  function showFallbackAffiliateInfo() {
    document.getElementById('affiliateName').textContent = 'Your local WaveMAX partner';
    document.getElementById('serviceArea').textContent = 'Your local area';
    document.getElementById('deliveryFee').textContent = 'Contact provider for pricing';
  }

  function showFallbackContent() {
    document.getElementById('customerId').textContent = 'Your unique ID will be provided shortly';
    document.getElementById('customerName').textContent = 'Your information is being processed';
    document.getElementById('customerEmail').textContent = 'Check your email for confirmation';
    document.getElementById('bagsPurchased').textContent = '1';
    showFallbackAffiliateInfo();
  }

  // Load customer information
  function loadCustomerInformation() {
    // Try to get customer info from sessionStorage first (for registration flow)
    const registrationData = sessionStorage.getItem('registrationData');
    let customerData = null;

    if (registrationData) {
      try {
        customerData = JSON.parse(registrationData);
        // Clear registration data after use
        sessionStorage.removeItem('registrationData');
      } catch (e) {
        console.error('Error parsing registration data:', e);
      }
    }

    // Fall back to localStorage if no registration data
    if (!customerData) {
      const customer = localStorage.getItem('currentCustomer');
      if (customer) {
        try {
          customerData = JSON.parse(customer);
        } catch (e) {
          console.error('Error parsing customer data:', e);
        }
      }
    }

    if (customerData) {
      // Display customer information
      document.getElementById('customerId').textContent = customerData.customerId;
      document.getElementById('customerName').textContent =
                `${customerData.firstName} ${customerData.lastName}`;
      document.getElementById('customerEmail').textContent = customerData.email;
      document.getElementById('transactionId').textContent = customerData.transactionId || '-';

      // Display bags purchased (check both field names for compatibility)
      const bagCount = customerData.numberOfBags || customerData.bagsPurchased || 1;
      document.getElementById('bagsPurchased').textContent = bagCount;

      // Fetch bag fee from system config to calculate credit
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      fetch(`${baseUrl}/api/v1/system/config/public`, {
        credentials: 'include'
      })
        .then(response => response.json())
        .then(configs => {
          const bagFeeConfig = configs.find(c => c.key === 'laundry_bag_fee');
          if (bagFeeConfig && bagFeeConfig.currentValue) {
            const bagFee = bagFeeConfig.currentValue;
            const totalCredit = bagFee * bagCount;
            document.getElementById('bagCreditAmount').textContent = `$${totalCredit.toFixed(2)}`;
          }
        })
        .catch(error => {
          console.error('Error fetching bag fee:', error);
          // Keep default $10.00 if fetch fails
        });

      // Load affiliate information if available
      if (customerData.affiliateInfo) {
        // Use stored affiliate info from registration
        console.log('Using stored affiliate info:', customerData.affiliateInfo);
        const affiliate = customerData.affiliateInfo;
        document.getElementById('affiliateName').textContent =
                    `${affiliate.firstName} ${affiliate.lastName} (${affiliate.businessName})`;
        document.getElementById('serviceArea').textContent =
                    `${affiliate.city}, ${affiliate.state}`;

        // Calculate delivery fee based on the affiliate's fee structure
        let deliveryFeeText = '';
        if (affiliate.minimumDeliveryFee !== null && affiliate.perBagDeliveryFee !== null) {
          deliveryFeeText = `$${affiliate.minimumDeliveryFee.toFixed(2)} minimum, then $${affiliate.perBagDeliveryFee.toFixed(2)} per bag`;
        } else {
          deliveryFeeText = 'Contact provider for pricing';
        }
        document.getElementById('deliveryFee').textContent = deliveryFeeText;
      } else if (customerData.affiliateId) {
        // Fallback to API call if no stored info
        loadAffiliateInfo(customerData.affiliateId);
      } else {
        showFallbackAffiliateInfo();
      }

      // Notify parent of successful registration
      sendMessageToParent('customer-registered', {
        customerId: customerData.customerId,
        affiliateId: customerData.affiliateId
      });
    } else {
      showFallbackContent();
    }

    // Notify parent that iframe is loaded
    sendMessageToParent('iframe-loaded', { page: 'customer-success' });
  }

  // Initialize i18n
  async function initializeI18n() {
    await window.i18n.init({ debugMode: false });
    window.LanguageSwitcher.createSwitcher('language-switcher-container', {
      style: 'dropdown',
      showLabel: false
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      loadCustomerInformation();
      initializeI18n();
      setupEventHandlers();
    });
  } else {
    // DOM is already loaded
    loadCustomerInformation();
    initializeI18n();
    setupEventHandlers();
  }

})();