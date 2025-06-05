// Order confirmation page initialization
function initializeOrderConfirmation() {
  console.log('Order confirmation page initializing');

  // Extract order ID from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');
  console.log('Order ID from URL:', orderId);

  if (!orderId) {
    alert('No order ID provided. Redirecting to homepage.');
    window.location.href = '/embed-app.html?login=customer';
    return;
  }

  // Set order ID in the page
  const orderIdElement = document.getElementById('orderId');
  console.log('Order ID element found:', !!orderIdElement);
  if (orderIdElement) {
    orderIdElement.textContent = orderId;
  }

  // Get order details from localStorage
  const storedOrdersStr = localStorage.getItem('wavemax_orders');
  console.log('Stored orders string:', storedOrdersStr);
  let storedOrders = {};
  let order = null;

  try {
    const parsed = JSON.parse(storedOrdersStr || '{}');

    // Handle both old array format and new object format
    if (Array.isArray(parsed)) {
      console.log('Converting old array format to new object format');
      // Convert array to object format
      storedOrders = {};
      parsed.forEach(o => {
        if (o.orderId) {
          storedOrders[o.orderId] = o;
        }
      });
      // Update localStorage with new format
      localStorage.setItem('wavemax_orders', JSON.stringify(storedOrders));
    } else {
      storedOrders = parsed;
    }

    order = storedOrders[orderId];
  } catch (e) {
    console.error('Error parsing stored orders:', e);
  }

  console.log('Stored orders object:', storedOrders);
  console.log('Order data for', orderId, ':', order);

  if (order) {
    displayOrderData(order);
  } else {
    // Order not found in localStorage - try to fetch from API
    fetchOrderFromAPI(orderId);
  }

  // Helper function to safely set element text
  function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    } else {
      console.warn(`Element with id '${elementId}' not found`);
    }
  }

  // Fetch WDF rate from system config
  async function fetchWdfRate() {
    try {
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      const response = await fetch(`${baseUrl}/api/v1/system/config/public`);
      if (response.ok) {
        const configs = await response.json();
        const wdfConfig = configs.find(c => c.key === 'wdf_base_rate_per_pound');
        return wdfConfig ? wdfConfig.currentValue : 1.25;
      }
    } catch (error) {
      console.error('Error fetching WDF rate:', error);
    }
    return 1.25; // Default fallback
  }

  // Function to display order data
  async function displayOrderData(order) {
    console.log('Displaying order data:', order);

    // Set order date
    const orderDate = new Date(order.createdAt || Date.now());
    const orderDateElement = document.getElementById('orderDate');
    if (orderDateElement) {
      orderDateElement.textContent = orderDate.toLocaleDateString() + ' ' + orderDate.toLocaleTimeString();
    }

    // Set pickup details
    const pickupDate = new Date(order.pickupDate);
    setElementText('pickupDate', pickupDate.toLocaleDateString());

    let pickupTimeText = 'Not specified';
    if (order.pickupTime === 'morning') {
      pickupTimeText = 'Morning (8am - 12pm)';
    } else if (order.pickupTime === 'afternoon') {
      pickupTimeText = 'Afternoon (12pm - 5pm)';
    } else if (order.pickupTime === 'evening') {
      pickupTimeText = 'Evening (5pm - 8pm)';
    }
    document.getElementById('pickupTime').textContent = pickupTimeText;

    document.getElementById('pickupInstructions').textContent = order.specialPickupInstructions || 'None provided';

    // Set delivery details
    const deliveryDate = new Date(order.deliveryDate);
    document.getElementById('deliveryDate').textContent = deliveryDate.toLocaleDateString();

    let deliveryTimeText = 'Not specified';
    if (order.deliveryTime === 'morning') {
      deliveryTimeText = 'Morning (8am - 12pm)';
    } else if (order.deliveryTime === 'afternoon') {
      deliveryTimeText = 'Afternoon (12pm - 5pm)';
    } else if (order.deliveryTime === 'evening') {
      deliveryTimeText = 'Evening (5pm - 8pm)';
    }
    document.getElementById('deliveryTime').textContent = deliveryTimeText;

    document.getElementById('deliveryInstructions').textContent = order.specialDeliveryInstructions || 'None provided';

    // Set estimated size
    let sizeText = 'Not specified';
    if (order.estimatedSize === 'small') {
      sizeText = 'Small (1-2 bags, approx. 10-15 lbs)';
    } else if (order.estimatedSize === 'medium') {
      sizeText = 'Medium (3-4 bags, approx. 16-30 lbs)';
    } else if (order.estimatedSize === 'large') {
      sizeText = 'Large (5+ bags, approx. 31+ lbs)';
    }
    document.getElementById('estimatedSize').textContent = sizeText;

    // Set affiliate information
    const affiliateId = order.affiliateId;
    // For now, we'll use placeholder affiliate info
    // In a real app, this would come from the order data or a separate API call
    document.getElementById('affiliateName').textContent = 'Your WaveMAX Affiliate';
    document.getElementById('affiliateContact').textContent = 'Contact information will be provided soon';

    // Display delivery fee information
    const deliveryFeeElement = document.getElementById('deliveryFee');
    let deliveryFee = 25.00; // Default
    
    if (order.deliveryFeeBreakdown) {
      // Use the breakdown info if available
      const breakdown = order.deliveryFeeBreakdown;
      deliveryFee = breakdown.roundTripFee || breakdown.appliedFee * 2 || order.deliveryFee || 25.00;
      
      if (deliveryFeeElement) {
        deliveryFeeElement.textContent = `$${parseFloat(deliveryFee).toFixed(2)}`;
        // Optionally show breakdown
        const parent = deliveryFeeElement.parentElement;
        if (parent && breakdown.minimumApplied) {
          const note = document.createElement('small');
          note.className = 'text-gray-500 block';
          note.textContent = `(Minimum fee applies)`;
          parent.appendChild(note);
        }
      }
    } else {
      // Fallback to simple fee
      deliveryFee = order.deliveryFee || 25.00;
      if (deliveryFeeElement) {
        deliveryFeeElement.textContent = `$${parseFloat(deliveryFee).toFixed(2)}`;
      }
    }

    // Update order link with affiliate ID - redirect to main site with pickup flag
    const scheduleAnotherBtn = document.getElementById('scheduleAnotherBtn');
    if (scheduleAnotherBtn) {
      // Redirect to WaveMAX main site with affiliate ID and pickup flag
      scheduleAnotherBtn.href = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?affid=${affiliateId}&pickup=true`;
      // Open in parent window, not iframe
      scheduleAnotherBtn.target = '_parent';
    }

    // Set view orders link to customer dashboard on main site
    const customerId = order.customerId;
    const viewOrdersBtn = document.getElementById('viewOrdersBtn');
    if (viewOrdersBtn) {
      // Redirect to WaveMAX main site with affiliate ID
      viewOrdersBtn.href = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?affid=${affiliateId}`;
      // Open in parent window, not iframe
      viewOrdersBtn.target = '_parent';
    }

    // Use the estimated total from the order data if available
    if (order.estimatedTotal) {
      document.getElementById('estimatedTotal').textContent = `$${parseFloat(order.estimatedTotal).toFixed(2)} (estimated)`;
    } else {
      // Calculate estimated total based on size
      let estimatedWeight = 0;
      if (order.estimatedSize === 'small') {
        estimatedWeight = 12.5; // average of 10-15 lbs
      } else if (order.estimatedSize === 'medium') {
        estimatedWeight = 23; // average of 16-30 lbs
      } else if (order.estimatedSize === 'large') {
        estimatedWeight = 35; // approximate for 31+ lbs
      }

      // Fetch WDF rate from system config or use default
      const wdfRate = await fetchWdfRate();
      
      // Update WDF rate display
      const wdfRateDisplay = document.getElementById('wdfRateDisplay');
      if (wdfRateDisplay) {
        wdfRateDisplay.textContent = `$${wdfRate.toFixed(2)} per pound`;
      }
      
      const estimatedWdfTotal = estimatedWeight * wdfRate;
      const estimatedTotal = estimatedWdfTotal + deliveryFee;

      document.getElementById('estimatedTotal').textContent = `$${estimatedTotal.toFixed(2)} (estimated)`;
    }

    // Set special instructions
    document.getElementById('serviceNotes').textContent = order.serviceNotes || 'None provided';

    // Fetch affiliate information
    fetchAffiliateInfo(affiliateId);
  }

  // Fetch affiliate information from API
  async function fetchAffiliateInfo(affiliateId) {
    try {
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      const response = await fetch(`${baseUrl}/api/v1/affiliates/${affiliateId}/public`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.affiliate) {
          document.getElementById('affiliateName').textContent =
                        data.affiliate.businessName || `${data.affiliate.firstName} ${data.affiliate.lastName}`;

          // Build contact info
          let contactInfo = [];
          if (data.affiliate.phone) contactInfo.push(`Phone: ${data.affiliate.phone}`);
          if (data.affiliate.email) contactInfo.push(`Email: ${data.affiliate.email}`);

          if (contactInfo.length > 0) {
            document.getElementById('affiliateContact').textContent = contactInfo.join(' | ');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching affiliate info:', error);
    }
  }

  // Fetch order from API if not in localStorage
  async function fetchOrderFromAPI(orderId) {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        alert('Please log in to view order details.');
        window.location.href = '/embed-app.html?route=/customer-login&login=customer';
        return;
      }

      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      const response = await fetch(`${baseUrl}/api/v1/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.order) {
          // Store in localStorage for future reference
          const storedOrders = JSON.parse(localStorage.getItem('wavemax_orders') || '{}');
          storedOrders[orderId] = data.order;
          localStorage.setItem('wavemax_orders', JSON.stringify(storedOrders));

          // Display the order data directly without reloading
          displayOrderData(data.order);
        }
      } else {
        alert('Order not found. Redirecting to homepage.');
        window.location.href = '/embed-app.html?login=customer';
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      alert('Error loading order details. Please try again later.');
    }
  }
}

// Check if DOM is already loaded
console.log('Order confirmation script loaded, checking DOM state');
if (document.readyState === 'loading') {
  console.log('DOM still loading, adding event listener');
  document.addEventListener('DOMContentLoaded', initializeOrderConfirmation);
} else {
  console.log('DOM already loaded, initializing immediately');
  initializeOrderConfirmation();
}