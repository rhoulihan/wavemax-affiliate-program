// Store CSRF token globally
let csrfToken = null;

// Helper function to fetch CSRF token if needed
async function ensureCsrfToken() {
  if (!csrfToken) {
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    console.log('Fetching CSRF token from:', `${baseUrl}/api/csrf-token`);
    const response = await fetch(`${baseUrl}/api/csrf-token`, {
      credentials: 'include'
    });
    const data = await response.json();
    csrfToken = data.csrfToken;
    console.log('CSRF token received:', csrfToken);
  }
  return csrfToken;
}

// Helper function to make authenticated API requests with CSRF token
async function authenticatedFetch(url, options = {}) {
  const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

  // Add authorization header
  const token = localStorage.getItem('affiliateToken');
  console.log('Auth token from localStorage:', token ? 'Token exists' : 'No token found');
  const headers = {
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  // Add CSRF token for non-GET requests
  if (options.method && options.method !== 'GET') {
    await ensureCsrfToken();
    headers['x-csrf-token'] = csrfToken;
    console.log('Request headers:', headers);
  }

  console.log('Making request to:', fullUrl, 'with method:', options.method || 'GET');

  return fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include'
  });
}

// Helper function to format address from Nominatim response
function formatDashboardAddress(displayName) {
  const parts = displayName.split(',').map(p => p.trim());
  let street = '', city = '', state = '', zipcode = '';

  // Parse address components
  if (parts.length >= 2) {
    if (parts[0].match(/^\d+$/)) {
      street = parts[0] + ' ' + parts[1];
      for (let i = 2; i < parts.length; i++) {
        const part = parts[i];
        if (part.match(/^[A-Z]{2}$/)) {
          state = part;
        } else if (part.match(/\d{5}/)) {
          zipcode = part.match(/\d{5}/)[0];
        } else if (!city && !state && !part.match(/USA|United States|county|township/i)) {
          city = part;
        }
      }
    } else {
      street = parts[0];
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.match(/^[A-Z]{2}$/)) {
          state = part;
        } else if (part.match(/\d{5}/)) {
          zipcode = part.match(/\d{5}/)[0];
        } else if (!city && !state && !part.match(/USA|United States|county|township/i)) {
          city = part;
        }
      }
    }
  }

  // Build formatted address
  let formatted = street;
  if (city) formatted += ', ' + city;
  if (state) {
    formatted += ', ' + state;
    if (zipcode) formatted += ' ' + zipcode;
  }

  return formatted || parts.slice(0, 3).join(', ');
}

// Affiliate dashboard functionality for embedded environment
function initializeAffiliateDashboard() {
  const isEmbedded = window.EMBED_CONFIG?.isEmbedded || false;
  const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';

  // Check authentication
  const token = localStorage.getItem('affiliateToken');
  const currentAffiliate = JSON.parse(localStorage.getItem('currentAffiliate'));

  console.log('Dashboard initialization - Token:', token ? 'exists' : 'missing');
  console.log('Dashboard initialization - Affiliate:', currentAffiliate ? currentAffiliate.affiliateId : 'missing');

  // Update session activity if authenticated
  if (token && window.SessionManager) {
    window.SessionManager.updateActivity('affiliate');
  }

  if (!token || !currentAffiliate) {
    // Redirect to login if not authenticated
    if (isEmbedded) {
      // For embedded, use postMessage navigation
      console.log('Not authenticated, navigating to login');
      window.parent.postMessage({
        type: 'navigate',
        data: { page: '/affiliate-login' }
      }, '*');
    } else {
      window.location.href = '/embed-app.html?route=/affiliate-login';
    }
    return;
  }

  // Get affiliate ID from current affiliate data
  const affiliateId = currentAffiliate.affiliateId;

  // Set affiliate ID in the page
  const affiliateIdElement = document.getElementById('affiliateId');
  if (affiliateIdElement) {
    affiliateIdElement.textContent = `Affiliate ID: ${affiliateId}`;
  }

  // Load affiliate data
  loadAffiliateData(affiliateId);

  // Load dashboard statistics
  loadDashboardStats(affiliateId);

  // Load settings data on initial load
  loadSettingsData(affiliateId);

  // Check URL parameters for specific customer filtering
  // Try both window.location.search and the global urlParams if available
  const urlParams = new URLSearchParams(window.location.search);
  let filterCustomerId = urlParams.get('customer');

  // Also check if embed-app.html has parsed parameters globally
  if (!filterCustomerId && window.location.search.includes('customer=')) {
    const searchParams = window.location.search;
    const customerMatch = searchParams.match(/customer=([^&]+)/);
    if (customerMatch) {
      filterCustomerId = customerMatch[1];
    }
  }

  console.log('Dashboard initialization - customer filter:', filterCustomerId);

  // Tab loading is handled below when we restore the saved tab or switch to customers

  // Setup tab navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Function to switch to a specific tab
  function switchToTab(tabId) {
    // Remove active class from all buttons and tabs
    tabButtons.forEach(btn => {
      btn.classList.remove('border-blue-600');
      btn.classList.remove('text-blue-600');
      btn.classList.add('border-transparent');
    });

    tabContents.forEach(content => {
      content.classList.remove('active');
    });

    // Find and activate the tab button
    const targetButton = document.querySelector(`[data-tab="${tabId}"]`);
    if (targetButton) {
      targetButton.classList.add('border-blue-600');
      targetButton.classList.add('text-blue-600');
      targetButton.classList.remove('border-transparent');

      const tabContent = document.getElementById(`${tabId}-tab`);
      if (tabContent) {
        tabContent.classList.add('active');
      }

      // Save current tab to localStorage
      localStorage.setItem('affiliateCurrentTab', tabId);

      // Update URL with tab parameter for browser history
      if (window.updateTabInUrl) {
        window.updateTabInUrl(tabId);
      }

      // Load tab-specific data
      if (tabId === 'pickups') {
        loadPickupRequests(affiliateId);
      } else if (tabId === 'customers') {
        loadCustomers(affiliateId);
      } else if (tabId === 'invoices') {
        loadInvoices(affiliateId);
      } else if (tabId === 'settings') {
        loadSettingsData(affiliateId);
      }
    }
  }

  // Add click handlers to tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      switchToTab(tabId);
    });
  });

  // Check URL for tab parameter first, then handle customer filter, then localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get('tab');
  
  if (filterCustomerId) {
    // If filtering by customer, switch to customers tab
    setTimeout(() => {
      switchToTab('customers');
      // Apply the filter after tab loads
      setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.value = filterCustomerId;
          searchInput.dispatchEvent(new Event('input'));
        }
      }, 300);
    }, 500);
  } else if (urlTab) {
    // URL tab parameter takes precedence
    switchToTab(urlTab);
  } else {
    // Restore saved tab or default to pickups
    const savedTab = localStorage.getItem('affiliateCurrentTab') || 'pickups';
    switchToTab(savedTab);
  }

  // Listen for tab restore messages from browser navigation
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'restore-tab' && event.data.tab) {
      console.log('[Affiliate Dashboard] Restoring tab from browser navigation:', event.data.tab);
      switchToTab(event.data.tab);
    }
  });

  // Logout functionality
  const logoutBtn = document.getElementById('logoutBtn');
  console.log('Logout button found:', logoutBtn);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Logout button clicked');
      localStorage.removeItem('affiliateToken');
      localStorage.removeItem('currentAffiliate');
      localStorage.removeItem('affiliateCurrentTab');

      // Clear session manager data
      if (window.SessionManager) {
        window.SessionManager.clearAuth('affiliate');
      }

      if (isEmbedded) {
        console.log('Sending logout navigation message');
        // For embedded, use postMessage navigation
        window.parent.postMessage({
          type: 'navigate',
          data: { page: '/affiliate-login' }
        }, '*');

        // Fallback direct navigation after a short delay
        setTimeout(() => {
          console.log('Fallback: Direct navigation to login');
          window.location.href = '/embed-app.html?route=/affiliate-login';
        }, 500);
      } else {
        window.location.href = '/embed-app.html?route=/affiliate-login';
      }
    });
  } else {
    console.error('Logout button not found in DOM');
  }

  // Schedule pickup button removed - affiliates should not schedule pickups

  // Copy registration link button
  const copyBtn = document.getElementById('copyRegistrationLinkBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      copyRegistrationLink();
    });
  }

  // Copy landing page link button
  const copyLandingBtn = document.getElementById('copyLandingPageLinkBtn');
  if (copyLandingBtn) {
    copyLandingBtn.addEventListener('click', function() {
      copyLandingPageLink();
    });
  }

  // Settings form edit mode
  const editBtn = document.getElementById('editBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const settingsForm = document.getElementById('settingsForm');
  const formButtons = document.getElementById('formButtons');

  if (editBtn) {
    editBtn.addEventListener('click', function() {
      enableEditMode();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      disableEditMode();
      loadSettingsData(affiliateId); // Reload original data
    });
  }

  if (settingsForm) {
    settingsForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      await saveSettings(affiliateId);
    });
  }

  // Change password form
  const changePasswordForm = document.getElementById('changePasswordForm');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      await changePassword(affiliateId);
    });
  }

  // Delete data button (development only)
  const deleteBtn = document.getElementById('deleteAllDataBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function() {
      deleteAllData(affiliateId);
    });
  }

  // Check if we should show delete section
  checkAndShowDeleteSection();

  // Make functions available globally (they're used by the existing dashboard code)
  window.loadAffiliateData = loadAffiliateData;
  window.loadDashboardStats = loadDashboardStats;
  window.loadPickupRequests = loadPickupRequests;
  window.loadCustomers = loadCustomers;
  window.loadInvoices = loadInvoices;
  window.loadSettingsData = loadSettingsData;
}

// Function to switch to customers tab and highlight specific customer
function switchToCustomersTab(affiliateId, customerIdToHighlight) {
  // Switch to customers tab
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Remove active class from all buttons and tabs
  tabButtons.forEach(btn => {
    btn.classList.remove('border-blue-600');
    btn.classList.remove('text-blue-600');
    btn.classList.add('border-transparent');
  });

  tabContents.forEach(content => {
    content.classList.remove('active');
  });

  // Find and activate customers tab
  const customersTabBtn = document.querySelector('[data-tab="customers"]');
  if (customersTabBtn) {
    customersTabBtn.classList.add('border-blue-600');
    customersTabBtn.classList.add('text-blue-600');
    customersTabBtn.classList.remove('border-transparent');
  }

  const customersTabContent = document.getElementById('customers-tab');
  if (customersTabContent) {
    customersTabContent.classList.add('active');
  }

  // Load customers with highlighting
  loadCustomersWithHighlight(affiliateId, customerIdToHighlight);
}

// Function to initialize pricing preview component
function initializePricingPreview(affiliateData) {
  if (!window.PricingPreviewComponent) {
    console.warn('PricingPreviewComponent still not available');
    return;
  }

  // Initialize the pricing preview in the settings tab
  window.settingsPricingPreview = window.PricingPreviewComponent.init(
    'settingsPricingPreview',
    'settingsMinimumDeliveryFee',
    'settingsPerBagDeliveryFee',
    {
      titleText: 'Earnings Preview',
      titleI18n: 'affiliate.dashboard.settings.earningsPreview',
      showNotes: true
    }
  );
  console.log('Pricing preview initialized (delayed):', !!window.settingsPricingPreview);

  // Set initial values
  const minimumFee = parseFloat(affiliateData.minimumDeliveryFee) || 25;
  const perBagFee = parseFloat(affiliateData.perBagDeliveryFee) || 10;

  // Update inputs
  const minInput = document.getElementById('settingsMinimumDeliveryFee');
  const perBagInput = document.getElementById('settingsPerBagDeliveryFee');
  if (minInput) minInput.value = minimumFee;
  if (perBagInput) perBagInput.value = perBagFee;

  // Trigger update
  if (window.settingsPricingPreview) {
    window.settingsPricingPreview.update();
  }
}

// Copy the existing functions from affiliate-dashboard.js
async function loadAffiliateData(affiliateId) {
  try {
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const response = await fetch(`${baseUrl}/api/v1/affiliates/${affiliateId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      // Extract the actual affiliate data from the response
      const data = result.affiliate || result;

      // Update profile information with null checks
      const nameElement = document.getElementById('affiliateName');
      if (nameElement) nameElement.textContent = `${data.firstName} ${data.lastName}`;

      const emailElement = document.getElementById('affiliateEmail');
      if (emailElement) emailElement.textContent = data.email;

      const businessElement = document.getElementById('businessName');
      if (businessElement) businessElement.textContent = data.businessName || 'N/A';

      const serviceAreaElement = document.getElementById('serviceArea');
      if (serviceAreaElement) serviceAreaElement.textContent = data.serviceArea;

      // Display delivery fee structure
      const deliveryFeeElement = document.getElementById('deliveryFee');
      if (deliveryFeeElement) {
        if (data.minimumDeliveryFee !== undefined && data.perBagDeliveryFee !== undefined) {
          const minFee = parseFloat(data.minimumDeliveryFee);
          const perBag = parseFloat(data.perBagDeliveryFee);
          deliveryFeeElement.textContent = `$${minFee.toFixed(2)} min, $${perBag.toFixed(2)}/bag`;
        } else {
          deliveryFeeElement.textContent = 'Contact support';
        }
      }

      // Generate and display registration link with wavemaxlaundry.com format
      const registrationLink = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?affid=${affiliateId}`;
      const linkElement = document.getElementById('registrationLink');
      if (linkElement) linkElement.value = registrationLink;

      // Generate and display landing page link
      const landingPageLink = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?route=/affiliate-landing&code=${affiliateId}`;
      const landingPageElement = document.getElementById('landingPageLink');
      if (landingPageElement) landingPageElement.value = landingPageLink;

      // Store affiliate data in localStorage for other uses
      localStorage.setItem('currentAffiliate', JSON.stringify(data));

      // Initialize service area component if available
      if (window.ServiceAreaComponent) {
        console.log('Initializing service area component in loadAffiliateData');
        const lat = parseFloat(data.serviceLatitude) || 30.3524;
        const lng = parseFloat(data.serviceLongitude) || -97.6841;
        const hasAddress = data.serviceArea && data.serviceArea.trim() !== '';

        window.settingsServiceArea = window.ServiceAreaComponent.init('settingsServiceAreaComponent', {
          latitude: lat,
          longitude: lng,
          radius: parseInt(data.serviceRadius) || 5,
          address: data.serviceArea || '',
          readOnly: true, // Start in read-only mode
          showInfo: true,
          showMap: false, // Hide map initially
          showControls: false, // Hide controls initially
          onUpdate: function(serviceData) {
            console.log('Service area updated:', serviceData);
          }
        });

        // If no address is stored, trigger reverse geocoding
        if (!hasAddress && lat && lng) {
          console.log('No address stored, triggering reverse geocoding for coordinates:', lat, lng);
          // Trigger reverse geocoding through the component
          if (window.parent !== window) {
            const requestId = 'dashboard_init_' + Date.now();

            window.parent.postMessage({
              type: 'geocode-reverse',
              data: { lat, lng, requestId }
            }, '*');

            // Set up one-time handler for the response
            const handleResponse = function(event) {
              if (event.data && event.data.type === 'geocode-reverse-response' &&
                  event.data.data && event.data.data.requestId === requestId) {

                if (event.data.data.address) {
                  // Format the address
                  const formattedAddress = formatDashboardAddress(event.data.data.address);
                  // Update the location element directly
                  const locationElement = document.getElementById('settingsServiceAreaComponent-centerLocation');
                  if (locationElement) {
                    locationElement.textContent = formattedAddress;
                  }
                  // Update the component's config
                  if (window.settingsServiceArea) {
                    window.settingsServiceArea.config.address = formattedAddress;
                  }
                }

                window.removeEventListener('message', handleResponse);
              }
            };

            window.addEventListener('message', handleResponse);
          }
        }
      }

      // Check if this is an OAuth account and hide change password section if so
      if (data.registrationMethod && data.registrationMethod !== 'traditional') {
        // This is an OAuth account, hide the change password section
        const changePasswordSection = document.getElementById('changePasswordSection');
        if (changePasswordSection) {
          changePasswordSection.style.display = 'none';
          console.log('Hiding change password section for OAuth account:', data.registrationMethod);
        }
      }

      // Initialize pricing preview component if available
      console.log('Checking for PricingPreviewComponent:', !!window.PricingPreviewComponent);
      if (window.PricingPreviewComponent) {
        console.log('PricingPreviewComponent found, initializing...');
        // Initialize the pricing preview in the settings tab
        window.settingsPricingPreview = window.PricingPreviewComponent.init(
          'settingsPricingPreview',
          'settingsMinimumDeliveryFee',
          'settingsPerBagDeliveryFee',
          {
            titleText: 'Earnings Preview',
            titleI18n: 'affiliate.dashboard.settings.earningsPreview',
            showNotes: true
          }
        );
        console.log('Pricing preview initialized:', !!window.settingsPricingPreview);

        // Set initial values
        const minimumFee = parseFloat(data.minimumDeliveryFee) || 25;
        const perBagFee = parseFloat(data.perBagDeliveryFee) || 10;

        // Update inputs
        const minInput = document.getElementById('settingsMinimumDeliveryFee');
        const perBagInput = document.getElementById('settingsPerBagDeliveryFee');
        if (minInput) minInput.value = minimumFee;
        if (perBagInput) perBagInput.value = perBagFee;

        // Trigger update
        if (window.settingsPricingPreview) {
          window.settingsPricingPreview.update();
        }
      } else {
        console.warn('PricingPreviewComponent not available yet');
        // Try again after a short delay
        setTimeout(() => {
          if (window.PricingPreviewComponent) {
            console.log('PricingPreviewComponent now available, initializing...');
            initializePricingPreview(data);
          }
        }, 500);
      }
    }
  } catch (error) {
    console.error('Error loading affiliate data:', error);
  }
}

async function loadDashboardStats(affiliateId) {
  try {
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const response = await fetch(`${baseUrl}/api/v1/affiliates/${affiliateId}/dashboard`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Dashboard stats response:', data);

      // Extract stats from response
      const stats = data.stats || data;

      // Update dashboard statistics with null checks
      const customersElement = document.getElementById('totalCustomers');
      if (customersElement) customersElement.textContent = stats.customerCount || 0;

      const ordersElement = document.getElementById('activeOrders');
      if (ordersElement) ordersElement.textContent = stats.activeOrderCount || 0;

      const revenueElement = document.getElementById('monthlyRevenue');
      if (revenueElement) revenueElement.textContent = `$${(stats.monthEarnings || 0).toFixed(2)}`;

      const paymentElement = document.getElementById('pendingPayment');
      if (paymentElement) paymentElement.textContent = `$${(stats.pendingEarnings || 0).toFixed(2)}`;
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

async function loadPickupRequests(affiliateId) {
  try {
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const response = await fetch(`${baseUrl}/api/v1/affiliates/${affiliateId}/orders`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Orders response:', data);

      // Extract orders array from response
      const orders = data.orders || [];
      const tbody = document.getElementById('ordersTableBody');
      tbody.innerHTML = '';

      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No orders found</td></tr>';
      } else {
        orders.forEach(order => {
          // Get customer info from order
          const customerName = order.customer ?
            order.customer.name :
            'Unknown Customer';

          const address = order.customer ?
            order.customer.address :
            'No address';

          const row = document.createElement('tr');
          row.className = 'border-b hover:bg-gray-50';
          row.innerHTML = `
            <td class="py-3 px-4">${new Date(order.pickupDate).toLocaleDateString()}</td>
            <td class="py-3 px-4">${customerName}</td>
            <td class="py-3 px-4">${address}</td>
            <td class="py-3 px-4">
              <span class="px-2 py-1 rounded text-xs ${
  order.status === 'pending' ? 'bg-gray-100 text-gray-800' :
    order.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
      order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
        order.status === 'processed' ? 'bg-purple-100 text-purple-800' :
          order.status === 'complete' ? 'bg-green-100 text-green-800' :
            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
}">
                ${order.status.replace(/_/g, ' ')}
              </span>
            </td>
            <td class="py-3 px-4">
              <span class="text-gray-600">Order #${order.orderId}</span>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    }
  } catch (error) {
    console.error('Error loading pickup requests:', error);
  }
}

async function loadCustomers(affiliateId) {
  await loadCustomersWithHighlight(affiliateId, null);
}

async function loadCustomersWithHighlight(affiliateId, highlightCustomerId) {
  try {
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const response = await fetch(`${baseUrl}/api/v1/affiliates/${affiliateId}/customers`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Customers response:', data);

      // Extract customers array from response
      const customers = data.customers || [];
      const tbody = document.getElementById('customersTableBody');
      tbody.innerHTML = '';

      if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No customers found</td></tr>';
      } else {
        customers.forEach(customer => {
          const row = document.createElement('tr');
          const isHighlighted = highlightCustomerId && customer.customerId === highlightCustomerId;

          row.className = `border-b ${isHighlighted ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`;

          row.innerHTML = `
            <td class="py-3 px-4">
              ${isHighlighted ? '<span class="font-bold text-blue-800">★ </span>' : ''}
              ${customer.firstName} ${customer.lastName}
              ${isHighlighted ? ' <span class="text-xs text-blue-600">(New Registration)</span>' : ''}
            </td>
            <td class="py-3 px-4">${customer.email}</td>
            <td class="py-3 px-4">${customer.phone}</td>
            <td class="py-3 px-4">
              <span class="px-2 py-1 rounded text-xs ${
  customer.isActive !== false ? 'bg-green-100 text-green-800' :
    'bg-gray-100 text-gray-800'
}">
                ${customer.isActive !== false ? 'Active' : 'Inactive'}
              </span>
            </td>
          `;
          tbody.appendChild(row);
        });

        // Scroll highlighted customer into view if found
        if (highlightCustomerId) {
          const highlightedRow = tbody.querySelector('tr.bg-blue-50');
          if (highlightedRow) {
            setTimeout(() => {
              highlightedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading customers:', error);
  }
}

async function loadInvoices(affiliateId) {
  try {
    const response = await fetch(`/api/v1/affiliates/${affiliateId}/invoices`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const invoices = await response.json();
      const tbody = document.querySelector('#invoicesTable tbody');
      tbody.innerHTML = '';

      if (invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No invoices found</td></tr>';
      } else {
        invoices.forEach(invoice => {
          const row = document.createElement('tr');
          row.className = 'border-b hover:bg-gray-50';
          row.innerHTML = `
            <td class="py-3 px-4">${invoice.number}</td>
            <td class="py-3 px-4">${new Date(invoice.date).toLocaleDateString()}</td>
            <td class="py-3 px-4">$${invoice.amount.toFixed(2)}</td>
            <td class="py-3 px-4">
              <span class="px-2 py-1 rounded text-xs ${
  invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
    invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
      'bg-gray-100 text-gray-800'
}">
                ${invoice.status}
              </span>
            </td>
            <td class="py-3 px-4">
              <button class="text-blue-600 hover:underline">Download</button>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    }
  } catch (error) {
    console.error('Error loading invoices:', error);
  }
}

// Copy link functionality
window.copyLink = function() {
  const linkInput = document.getElementById('registrationLink');
  linkInput.select();
  document.execCommand('copy');

  const copyBtn = event.target;
  const originalText = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  copyBtn.classList.add('bg-green-600');

  setTimeout(() => {
    copyBtn.textContent = originalText;
    copyBtn.classList.remove('bg-green-600');
  }, 2000);
};

// Copy registration link
function copyRegistrationLink() {
  const linkInput = document.getElementById('registrationLink');
  const copyBtn = document.getElementById('copyRegistrationLinkBtn');

  // Use setTimeout to ensure our code runs in a clean call stack
  setTimeout(() => {
    // Focus the input first
    linkInput.focus();
    linkInput.select();

    try {
      // Use execCommand which works better in iframes
      const successful = document.execCommand('copy');
      if (successful) {
        showCopySuccess(copyBtn);
        // Blur the input after successful copy
        linkInput.blur();
      } else {
        // If copy fails, show the text for manual copying
        linkInput.blur();
        showManualCopyPrompt(linkInput.value);
      }
    } catch (err) {
      // Show text for manual copying if everything fails
      linkInput.blur();
      showManualCopyPrompt(linkInput.value);
    }
  }, 10);
}

// Show manual copy prompt
function showManualCopyPrompt(text) {
  // Create a temporary textarea for better compatibility
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.top = '50%';
  textarea.style.left = '50%';
  textarea.style.transform = 'translate(-50%, -50%)';
  textarea.style.width = '80%';
  textarea.style.maxWidth = '400px';
  textarea.style.height = '100px';
  textarea.style.padding = '10px';
  textarea.style.border = '2px solid #1e3a8a';
  textarea.style.borderRadius = '8px';
  textarea.style.backgroundColor = 'white';
  textarea.style.zIndex = '10000';
  textarea.style.fontSize = '14px';

  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  overlay.style.zIndex = '9999';

  // Create instruction text
  const instruction = document.createElement('div');
  instruction.textContent = 'Press Ctrl+C (or Cmd+C) to copy, then click anywhere to close';
  instruction.style.position = 'fixed';
  instruction.style.top = 'calc(50% - 70px)';
  instruction.style.left = '50%';
  instruction.style.transform = 'translateX(-50%)';
  instruction.style.color = 'white';
  instruction.style.fontSize = '16px';
  instruction.style.fontWeight = 'bold';
  instruction.style.zIndex = '10001';
  instruction.style.textAlign = 'center';

  document.body.appendChild(overlay);
  document.body.appendChild(instruction);
  document.body.appendChild(textarea);

  // Select the text
  textarea.focus();
  textarea.select();

  // Remove elements when clicked
  const cleanup = () => {
    document.body.removeChild(textarea);
    document.body.removeChild(overlay);
    document.body.removeChild(instruction);
  };

  overlay.addEventListener('click', cleanup);
  textarea.addEventListener('blur', () => {
    setTimeout(cleanup, 100);
  });
}

// Show copy success feedback
function copyLandingPageLink() {
  const linkInput = document.getElementById('landingPageLink');
  const copyBtn = document.getElementById('copyLandingPageLinkBtn');

  // Use setTimeout to ensure our code runs in a clean call stack
  setTimeout(() => {
    // Focus the input first
    linkInput.focus();
    linkInput.select();

    try {
      // Use execCommand which works better in iframes
      const successful = document.execCommand('copy');
      if (successful) {
        showCopySuccess(copyBtn);
        // Blur the input after successful copy
        linkInput.blur();
      } else {
        // If copy fails, show the text for manual copying
        linkInput.blur();
        showManualCopyPrompt(linkInput.value);
      }
    } catch (err) {
      console.error('Unable to copy:', err);
      linkInput.blur();
      showManualCopyPrompt(linkInput.value);
    }
  }, 100);
}

function showCopySuccess(button) {
  const originalText = button.textContent;
  button.textContent = 'Copied!';
  button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
  button.classList.add('bg-green-600', 'hover:bg-green-700');

  setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('bg-green-600', 'hover:bg-green-700');
    button.classList.add('bg-blue-600', 'hover:bg-blue-700');
  }, 2000);
}

// Load settings data
async function loadSettingsData(affiliateId) {
  try {
    console.log('Loading settings data for affiliate:', affiliateId);
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const response = await fetch(`${baseUrl}/api/v1/affiliates/${affiliateId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Affiliate data received:', result);

      // Extract the actual affiliate data from the response
      const data = result.affiliate || result;
      console.log('Extracted affiliate data:', data);

      // Wait a bit to ensure DOM is ready
      setTimeout(() => {
        // Populate settings fields with null checks
        const firstNameField = document.getElementById('settingsFirstName');
        const lastNameField = document.getElementById('settingsLastName');
        const emailField = document.getElementById('settingsEmail');
        const phoneField = document.getElementById('settingsPhone');
        const businessNameField = document.getElementById('settingsBusinessName');
        const registrationLinkField = document.getElementById('registrationLink');
        const minimumDeliveryFeeField = document.getElementById('settingsMinimumDeliveryFee');
        const perBagDeliveryFeeField = document.getElementById('settingsPerBagDeliveryFee');

        console.log('Setting field values:', {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          businessName: data.businessName,
          serviceArea: data.serviceArea,
          minimumDeliveryFee: data.minimumDeliveryFee,
          perBagDeliveryFee: data.perBagDeliveryFee
        });

        if (firstNameField) firstNameField.value = data.firstName || '';
        if (lastNameField) lastNameField.value = data.lastName || '';
        if (emailField) emailField.value = data.email || '';
        if (phoneField) phoneField.value = data.phone || '';
        if (businessNameField) businessNameField.value = data.businessName || '';
        if (minimumDeliveryFeeField) minimumDeliveryFeeField.value = data.minimumDeliveryFee || 25;
        if (perBagDeliveryFeeField) perBagDeliveryFeeField.value = data.perBagDeliveryFee || 5;

        // Initialize or update service area component
        if (window.ServiceAreaComponent) {
          if (window.settingsServiceArea) {
            // Update existing component
            window.ServiceAreaComponent.update('settingsServiceAreaComponent', {
              latitude: parseFloat(data.serviceLatitude) || 30.3524,
              longitude: parseFloat(data.serviceLongitude) || -97.6841,
              radius: parseInt(data.serviceRadius) || 5,
              address: data.serviceArea || ''
            });
          } else {
            // Initialize new component
            window.settingsServiceArea = window.ServiceAreaComponent.init('settingsServiceAreaComponent', {
              latitude: parseFloat(data.serviceLatitude) || 30.3524,
              longitude: parseFloat(data.serviceLongitude) || -97.6841,
              radius: parseInt(data.serviceRadius) || 5,
              address: data.serviceArea || '',
              readOnly: true,
              showInfo: true,
              showMap: false,
              showControls: false
            });
          }
        }

        // Initialize pricing preview component
        if (window.PricingPreviewComponent) {
          console.log('Initializing pricing preview in loadSettingsData');
          initializePricingPreview(data);
        } else {
          console.warn('PricingPreviewComponent not available in loadSettingsData, falling back to legacy');
          // Fallback to old calculator
          updateFeeCalculatorPreview();
        }

        // Generate and display registration link with wavemaxlaundry.com format
        const registrationLink = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?affid=${affiliateId}`;
        if (registrationLinkField) registrationLinkField.value = registrationLink;

        // Load W-9 status
        loadW9Status();

        // Set up W-9 event listeners
        const w9UploadForm = document.getElementById('w9UploadFormElement');
        if (w9UploadForm) {
          w9UploadForm.addEventListener('submit', handleW9Upload);
        }

        // Download button removed - using DocuSign for W9 management

        // Set landing page link
        const landingPageLinkField = document.getElementById('landingPageLink');
        const landingPageLink = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?route=/affiliate-landing&code=${affiliateId}`;
        if (landingPageLinkField) landingPageLinkField.value = landingPageLink;

        console.log('Settings fields populated');
      }, 100);
    } else {
      console.error('Failed to load affiliate data:', response.status);
    }
  } catch (error) {
    console.error('Error loading settings data:', error);
  }
}

// Enable edit mode
function enableEditMode() {
  const inputs = document.querySelectorAll('#settingsForm input[type="text"], #settingsForm input[type="email"], #settingsForm input[type="tel"], #settingsForm input[type="number"]');
  inputs.forEach(input => {
    // Skip the registration link field
    if (input.id !== 'registrationLink' && input.id !== 'landingPageLink') {
      input.removeAttribute('readonly');
      input.classList.remove('bg-gray-100');
    }
  });

  document.getElementById('editBtn').style.display = 'none';
  document.getElementById('formButtons').style.display = 'block';

  // Enable service area editing
  if (window.settingsServiceArea && window.ServiceAreaComponent) {
    // Update the component to show map and controls
    window.ServiceAreaComponent.update('settingsServiceAreaComponent', {
      readOnly: false,
      showMap: true,
      showControls: true
    });
  }

  // The pricing preview component handles its own event listeners
  // No need to add additional listeners here
}

// Disable edit mode
function disableEditMode() {
  const inputs = document.querySelectorAll('#settingsForm input[type="text"], #settingsForm input[type="email"], #settingsForm input[type="tel"], #settingsForm input[type="number"]');
  inputs.forEach(input => {
    if (input.id !== 'registrationLink' && input.id !== 'landingPageLink') {
      input.setAttribute('readonly', true);
      input.classList.add('bg-gray-100');
    }
  });

  document.getElementById('editBtn').style.display = 'block';
  document.getElementById('formButtons').style.display = 'none';

  // Disable service area editing
  if (window.settingsServiceArea && window.ServiceAreaComponent) {
    // Update the component to hide map and controls
    window.ServiceAreaComponent.update('settingsServiceAreaComponent', {
      readOnly: true,
      showMap: false,
      showControls: false
    });
  }

  // The pricing preview component handles its own event listeners
  // No need to remove listeners here
}

// Save settings
async function saveSettings(affiliateId) {
  try {
    const formData = new FormData(document.getElementById('settingsForm'));
    const data = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      businessName: formData.get('businessName'),
      minimumDeliveryFee: parseFloat(formData.get('minimumDeliveryFee')) || null,
      perBagDeliveryFee: parseFloat(formData.get('perBagDeliveryFee')) || null
    };

    // Get service area data from component
    if (window.settingsServiceArea && window.ServiceAreaComponent) {
      const serviceAreaData = window.ServiceAreaComponent.getData('settingsServiceAreaComponent');
      if (serviceAreaData) {
        data.serviceArea = serviceAreaData.address;
        data.serviceLatitude = serviceAreaData.latitude;
        data.serviceLongitude = serviceAreaData.longitude;
        data.serviceRadius = serviceAreaData.radius;
      }
    }

    const response = await authenticatedFetch(`/api/v1/affiliates/${affiliateId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      alert('Settings updated successfully!');
      disableEditMode();
      loadSettingsData(affiliateId); // Reload data
    } else {
      const error = await response.json();
      alert('Error updating settings: ' + (error.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Error saving settings. Please try again.');
  }
}

// Change password function
async function changePassword(affiliateId) {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorDiv = document.getElementById('passwordError');
  const successDiv = document.getElementById('passwordSuccess');

  // Hide previous messages
  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');

  // Validate passwords match
  if (newPassword !== confirmPassword) {
    errorDiv.textContent = 'New passwords do not match';
    errorDiv.classList.remove('hidden');
    return;
  }

  // Validate password length
  if (newPassword.length < 8) {
    errorDiv.textContent = 'Password must be at least 8 characters long';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    const response = await authenticatedFetch(`/api/v1/affiliates/${affiliateId}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword: currentPassword,
        newPassword: newPassword
      })
    });

    if (response.ok) {
      successDiv.textContent = 'Password changed successfully!';
      successDiv.classList.remove('hidden');

      // Clear the form
      document.getElementById('changePasswordForm').reset();

      // Hide success message after 5 seconds
      setTimeout(() => {
        successDiv.classList.add('hidden');
      }, 5000);
    } else {
      const error = await response.json();
      errorDiv.textContent = error.message || 'Failed to change password';
      errorDiv.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error changing password:', error);
    errorDiv.textContent = 'Error changing password. Please try again.';
    errorDiv.classList.remove('hidden');
  }
}

// Check and show delete section if enabled
function checkAndShowDeleteSection() {
  console.log('Checking environment for delete section visibility...');
  const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
  console.log('Fetching environment from:', `${baseUrl}/api/v1/environment`);

  fetch(`${baseUrl}/api/v1/environment`)
    .then(response => response.json())
    .then(data => {
      console.log('Environment data received:', data);
      if (data.enableDeleteDataFeature === true) {
        console.log('Delete data feature enabled, showing delete section');
        const deleteSection = document.getElementById('deleteDataSection');
        if (deleteSection) {
          deleteSection.style.display = 'block';
          console.log('Delete section made visible');
        } else {
          console.error('Delete section element not found!');
        }
      } else {
        console.log('Delete data feature not enabled, hiding delete section');
      }
    })
    .catch(error => console.error('Environment check failed:', error));
}

// Delete all data function
async function deleteAllData(affiliateId) {
  if (!confirm('Are you absolutely sure? This will delete ALL your data permanently!')) {
    return;
  }

  if (!confirm('This is your last chance to cancel. Do you really want to delete everything?')) {
    return;
  }

  try {
    // Get CSRF token first
    await ensureCsrfToken();

    const response = await authenticatedFetch(`/api/v1/affiliates/${affiliateId}/delete-all-data`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        _csrf: csrfToken  // Try sending in body as well
      })
    });

    const data = await response.json();

    if (data.success) {
      alert('All data has been deleted successfully.');
      // Clear local storage and redirect to login
      localStorage.removeItem('affiliateToken');
      localStorage.removeItem('currentAffiliate');

      if (window.EMBED_CONFIG?.isEmbedded) {
        window.parent.postMessage({
          type: 'navigate',
          data: { url: '/affiliate-login' }
        }, '*');
      } else {
        window.location.href = '/embed-app.html?route=/affiliate-login';
      }
    } else {
      alert(data.message || 'Failed to delete data');
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('An error occurred while deleting data');
  }
}

// Fee calculator preview function
function updateFeeCalculatorPreview() {
  const minFeeInput = document.getElementById('settingsMinimumDeliveryFee');
  const perBagInput = document.getElementById('settingsPerBagDeliveryFee');

  if (!minFeeInput || !perBagInput) return;

  const minFee = parseFloat(minFeeInput.value) || 25;
  const perBag = parseFloat(perBagInput.value) || 5;

  // Calculate fees for different bag quantities (round trip = x2)
  const bags = [1, 3, 5, 10];
  bags.forEach(qty => {
    const calculated = qty * perBag * 2; // Round trip
    const total = Math.max(minFee * 2, calculated); // Round trip minimum
    const elem = document.getElementById(`preview${qty}bag${qty > 1 ? 's' : ''}`);
    if (elem) {
      elem.textContent = `$${total}`;
      // Add visual indicator if minimum applies
      if (total === minFee * 2 && calculated < minFee * 2) {
        elem.classList.add('font-bold');
        elem.title = 'Minimum fee applies';
      } else {
        elem.classList.remove('font-bold');
        elem.title = `${qty} × $${perBag} × 2 trips = $${calculated}`;
      }
    }
  });
}

// W-9 Tax Information Functions
let w9Status = null;

async function loadW9Status() {
  try {
    const response = await authenticatedFetch('/api/v1/w9/status');

    if (response.ok) {
      w9Status = await response.json();
      updateW9Display();
    } else {
      console.error('Failed to load W-9 status');
    }
  } catch (error) {
    console.error('Error loading W-9 status:', error);
  }
}

function updateW9Display() {
  if (!w9Status) return;

  // Update status text
  const statusText = document.getElementById('w9StatusText');
  const statusAlert = document.getElementById('w9StatusAlert');
  const uploadForm = document.getElementById('w9UploadForm');
  // Download button removed - using DocuSign only

  if (statusText) {
    statusText.textContent = w9Status.statusDisplay;
    statusText.className = 'ml-2 font-semibold ';

    // Add color coding based on status
    switch (w9Status.status) {
    case 'not_submitted':
      statusText.className += 'text-red-600';
      break;
    case 'pending_review':
      statusText.className += 'text-yellow-600';
      break;
    case 'verified':
      statusText.className += 'text-green-600';
      break;
    case 'rejected':
      statusText.className += 'text-red-600';
      break;
    case 'expired':
      statusText.className += 'text-orange-600';
      break;
    }
  }

  // Update status alert
  if (statusAlert) {
    let alertHTML = '';

    if (w9Status.status === 'not_submitted') {
      alertHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong class="font-bold" data-i18n="affiliate.dashboard.settings.w9Required">W-9 Required!</strong>
          <span class="block sm:inline" data-i18n="affiliate.dashboard.settings.w9RequiredMessage">You must submit a W-9 form before payments can be processed.</span>
        </div>
      `;
      if (uploadForm) uploadForm.style.display = 'block';
    } else if (w9Status.status === 'pending_review') {
      alertHTML = `
        <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative">
          <strong class="font-bold" data-i18n="affiliate.dashboard.settings.w9UnderReview">W-9 Under Review</strong>
          <span class="block sm:inline" data-i18n="affiliate.dashboard.settings.w9UnderReviewMessage">Your W-9 is being reviewed by our team.</span>
        </div>
      `;
      // Download button removed - DocuSign handles document access
    } else if (w9Status.status === 'verified') {
      alertHTML = `
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          <strong class="font-bold" data-i18n="affiliate.dashboard.settings.w9Verified">W-9 Verified</strong>
          <span class="block sm:inline" data-i18n="affiliate.dashboard.settings.w9VerifiedMessage">Your W-9 has been verified. You can receive payments.</span>
        </div>
      `;
      // Download button removed - DocuSign handles document access
    } else if (w9Status.status === 'rejected') {
      alertHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong class="font-bold" data-i18n="affiliate.dashboard.settings.w9Rejected">W-9 Rejected</strong>
          <span class="block sm:inline" data-i18n="affiliate.dashboard.settings.w9RejectedMessage">Your W-9 was rejected. Please submit a new one.</span>
        </div>
      `;
      if (uploadForm) uploadForm.style.display = 'block';
    }

    statusAlert.innerHTML = alertHTML;
  }

  // Update dates
  if (w9Status.submittedAt) {
    const submittedDateDiv = document.getElementById('w9SubmittedDate');
    const submittedDateText = document.getElementById('w9SubmittedDateText');
    if (submittedDateDiv && submittedDateText) {
      submittedDateDiv.style.display = 'block';
      submittedDateText.textContent = new Date(w9Status.submittedAt).toLocaleDateString();
    }
  }

  if (w9Status.verifiedAt) {
    const verifiedDateDiv = document.getElementById('w9VerifiedDate');
    const verifiedDateText = document.getElementById('w9VerifiedDateText');
    if (verifiedDateDiv && verifiedDateText) {
      verifiedDateDiv.style.display = 'block';
      verifiedDateText.textContent = new Date(w9Status.verifiedAt).toLocaleDateString();
    }
  }

  // Update tax info (only shown if verified)
  if (w9Status.status === 'verified' && w9Status.taxInfo) {
    const taxInfoDiv = document.getElementById('w9TaxInfo');
    const taxIdType = document.getElementById('w9TaxIdType');
    const taxIdLast4 = document.getElementById('w9TaxIdLast4');

    if (taxInfoDiv && taxIdType && taxIdLast4) {
      taxInfoDiv.style.display = 'block';
      taxIdType.textContent = w9Status.taxInfo.type;
      taxIdLast4.textContent = '***-**-' + w9Status.taxInfo.last4;
    }
  }

  // Update rejection reason
  if (w9Status.status === 'rejected' && w9Status.rejectionReason) {
    const rejectionDiv = document.getElementById('w9RejectionReason');
    const rejectionText = document.getElementById('w9RejectionReasonText');

    if (rejectionDiv && rejectionText) {
      rejectionDiv.style.display = 'block';
      rejectionText.textContent = w9Status.rejectionReason;
    }
  }

  // Re-apply i18n translations
  if (window.i18next && window.i18next.isInitialized) {
    window.applyTranslations();
  }
}

async function handleW9Upload(event) {
  event.preventDefault();

  const fileInput = document.getElementById('w9File');
  const file = fileInput.files[0];

  if (!file) {
    alert('Please select a file to upload');
    return;
  }

  if (file.type !== 'application/pdf') {
    alert('Only PDF files are accepted');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('File size must be less than 5MB');
    return;
  }

  // Show progress
  document.getElementById('w9UploadProgress').style.display = 'block';
  document.getElementById('w9UploadSuccess').style.display = 'none';
  document.getElementById('w9UploadError').style.display = 'none';

  const formData = new FormData();
  formData.append('w9document', file);

  try {
    const response = await authenticatedFetch('/api/v1/w9/upload', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      document.getElementById('w9UploadProgress').style.display = 'none';
      document.getElementById('w9UploadSuccess').style.display = 'block';

      // Reset form
      fileInput.value = '';

      // Reload W-9 status
      setTimeout(() => {
        loadW9Status();
        document.getElementById('w9UploadSuccess').style.display = 'none';
      }, 3000);
    } else {
      const error = await response.json();
      document.getElementById('w9UploadProgress').style.display = 'none';
      document.getElementById('w9UploadError').style.display = 'block';
      document.getElementById('w9UploadErrorText').textContent = error.message || 'Failed to upload W-9';
    }
  } catch (error) {
    console.error('Upload error:', error);
    document.getElementById('w9UploadProgress').style.display = 'none';
    document.getElementById('w9UploadError').style.display = 'block';
    document.getElementById('w9UploadErrorText').textContent = 'An error occurred while uploading the file';
  }
}

async function downloadSubmittedW9() {
  try {
    const response = await authenticatedFetch('/api/v1/w9/download');

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'W9_Submitted.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      alert('Failed to download W-9');
    }
  } catch (error) {
    console.error('Download error:', error);
    alert('An error occurred while downloading the W-9');
  }
}

// Initialize when DOM is ready or immediately if already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initializeAffiliateDashboard();
  });
} else {
  initializeAffiliateDashboard();
}