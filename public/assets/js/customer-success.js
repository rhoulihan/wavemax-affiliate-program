// Debug info
console.log('customer-success.js loaded');
console.log('Current URL:', window.location.href);

function initializeSuccessPage() {
  console.log('Initializing success page');
  // Get registration data from sessionStorage
  const registrationData = sessionStorage.getItem('registrationData');
  console.log('Registration data from sessionStorage:', registrationData);

  if (!registrationData) {
    // Check URL parameters as fallback (for backward compatibility)
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('id');

    if (!customerId) {
      alert('No registration data found. Please register first.');
      window.location.href = '/embed-app-v2.html?login=customer';
      return;
    }

    // If we have URL params, try to fetch from server (fallback behavior)
    fetch(`/api/customers/${customerId}/profile`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.customer) {
          const customer = data.customer;
          displayCustomerData({
            customerId: customer.customerId,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            affiliateId: customer.affiliateId,
            affiliateName: customer.affiliate ? customer.affiliate.name : 'WaveMAX Affiliate Partner',
            minimumDeliveryFee: customer.affiliate ? customer.affiliate.minimumDeliveryFee : '25.00',
            perBagDeliveryFee: customer.affiliate ? customer.affiliate.perBagDeliveryFee : '5.00',
            bagsPurchased: customer.bagsPurchased || '1'
          });
        } else {
          console.error('Failed to load customer data:', data.message);
          alert('Unable to load customer information.');
          window.location.href = '/embed-app-v2.html?login=customer';
        }
      })
      .catch(error => {
        console.error('Error fetching customer data:', error);
        alert('An error occurred while loading customer information.');
        window.location.href = '/embed-app-v2.html?login=customer';
      });
  } else {
    // Use data from sessionStorage
    const data = JSON.parse(registrationData);
    displayCustomerData(data);

    // Clear the registration data from sessionStorage
    sessionStorage.removeItem('registrationData');
  }
}

// Check if DOM is already loaded or wait for it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSuccessPage);
} else {
  // DOM is already loaded, initialize immediately
  initializeSuccessPage();
}

function displayCustomerData(data) {
  // Set customer information
  document.getElementById('customerId').textContent = data.customerId;
  document.getElementById('customerName').textContent = `${data.firstName} ${data.lastName}`;
  document.getElementById('customerEmail').textContent = data.email;

  // Set transaction ID if available
  const transactionIdElement = document.getElementById('transactionId');
  if (transactionIdElement && data.transactionId) {
    transactionIdElement.textContent = data.transactionId;
  }

  // Set affiliate information
  if (data.affiliateInfo) {
    // Use the new affiliateInfo object structure
    const affiliate = data.affiliateInfo;
    document.getElementById('affiliateName').textContent =
      `${affiliate.firstName} ${affiliate.lastName} (${affiliate.businessName})`;
    document.getElementById('serviceArea').textContent =
      `${affiliate.city}, ${affiliate.state}`;

    // Display delivery fee structure
    if (affiliate.minimumDeliveryFee !== undefined && affiliate.perBagDeliveryFee !== undefined) {
      const minFee = parseFloat(affiliate.minimumDeliveryFee);
      const perBag = parseFloat(affiliate.perBagDeliveryFee);
      document.getElementById('deliveryFee').textContent =
        `$${minFee.toFixed(2)} minimum, then $${perBag.toFixed(2)} per bag`;
    } else {
      document.getElementById('deliveryFee').textContent = 'Contact for pricing';
    }
  } else {
    // Fallback for legacy data structure
    document.getElementById('affiliateName').textContent = data.affiliateName || 'Your local WaveMAX partner';
    document.getElementById('serviceArea').textContent = 'Austin, TX area';

    // Display delivery fee structure (legacy)
    if (data.minimumDeliveryFee !== undefined && data.perBagDeliveryFee !== undefined) {
      const minFee = parseFloat(data.minimumDeliveryFee);
      const perBag = parseFloat(data.perBagDeliveryFee);
      document.getElementById('deliveryFee').textContent = `Starting at $${minFee.toFixed(2)} (min) or $${perBag.toFixed(2)}/bag`;
    } else if (data.deliveryFee !== undefined) {
      document.getElementById('deliveryFee').textContent = `$${parseFloat(data.deliveryFee).toFixed(2)} per pickup/delivery`;
    } else {
      document.getElementById('deliveryFee').textContent = 'Contact for pricing';
    }
  }

  // Update button links to use direct navigation
  const schedulePickupBtn = document.getElementById('schedulePickupBtn');
  const customerDashboardBtn = document.getElementById('customerDashboardBtn');

  if (schedulePickupBtn) {
    schedulePickupBtn.href = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer&pickup=true';
    schedulePickupBtn.onclick = function(e) {
      e.preventDefault();
      // For embedded context, navigate within iframe
      if (window.parent !== window) {
        window.location.href = '/embed-app-v2.html?login=customer&pickup=true';
      } else {
        // For direct access, navigate to the parent site
        window.top.location.href = this.href;
      }
    };
  }

  if (customerDashboardBtn) {
    customerDashboardBtn.href = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer';
    customerDashboardBtn.onclick = function(e) {
      e.preventDefault();
      // For embedded context, navigate within iframe
      if (window.parent !== window) {
        window.location.href = '/embed-app-v2.html?login=customer';
      } else {
        // For direct access, navigate to the parent site
        window.top.location.href = this.href;
      }
    };
  }

  // Set bags purchased (check both field names for compatibility)
  const bagCount = data.numberOfBags || data.bagsPurchased || 1;
  const bagsPurchasedElement = document.getElementById('bagsPurchased');
  if (bagsPurchasedElement) {
    bagsPurchasedElement.textContent = bagCount;
  }

  // Fetch bag fee from system config to calculate credit
  fetch('/api/v1/system/config/public')
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
}