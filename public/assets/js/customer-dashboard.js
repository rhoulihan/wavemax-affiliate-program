// Load CSRF utilities
if (!window.CsrfUtils) {
  console.error('CSRF utilities not loaded. Please include csrf-utils.js before this script.');
}

// Global variables
let customerData = null;
let customerId = null;

// Function to initialize dashboard
async function initializeDashboard() {
  console.log('Initializing customer dashboard');
  // Check authentication
  const token = localStorage.getItem('customerToken');
  const customerStr = localStorage.getItem('currentCustomer');

  console.log('Token exists:', !!token);
  console.log('Customer data exists:', !!customerStr);

  // Update session activity if authenticated
  if (token && window.SessionManager) {
    window.SessionManager.updateActivity('customer');
  }

  if (!token || !customerStr) {
    console.log('No authentication found, redirecting to login');
    // Use embed navigation
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'navigate',
        data: { page: '/customer-login' }
      }, '*');
    } else {
      window.location.href = '/embed-app-v2.html?route=/customer-login';
    }
    return;
  }

  try {
    customerData = JSON.parse(customerStr);
    customerId = customerData.customerId;

    // Update welcome message
    document.getElementById('welcomeMessage').textContent = `Welcome, ${customerData.firstName}!`;
    document.getElementById('customerInfo').textContent = `Customer ID: ${customerId}`;

    // Set schedule pickup link
    const schedulePickupBtn = document.getElementById('schedulePickupBtn');
    if (schedulePickupBtn) {
      schedulePickupBtn.href = '#';
      schedulePickupBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = '/embed-app-v2.html?route=/schedule-pickup';
      });
    }

    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        handleLogout();
      });
    }

    // Setup view orders button
    const viewOrdersBtn = document.getElementById('viewOrdersBtn');
    if (viewOrdersBtn) {
      viewOrdersBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showOrders();
      });
    }

    // Setup profile button
    const myProfileBtn = document.getElementById('myProfileBtn');
    if (myProfileBtn) {
      myProfileBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showProfile();
      });
    }

    // Load dashboard data
    await loadDashboardData();

  } catch (error) {
    console.error('Error initializing dashboard:', error);
    alert('Error loading dashboard. Please login again.');
    window.location.href = '/embed-app-v2.html?route=/customer-login';
  }
}

// Check if DOM is already loaded or wait for it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
  // DOM is already loaded, initialize immediately
  initializeDashboard();
}

// Load dashboard data
async function loadDashboardData() {
  try {
    const token = localStorage.getItem('customerToken');

    // Create authenticated fetch with CSRF support
    const authenticatedFetch = window.CsrfUtils ? window.CsrfUtils.createAuthenticatedFetch(() => token) : fetch;

    // Fetch customer details
    const customerResponse = await authenticatedFetch(`/api/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (customerResponse.ok) {
      const customerResult = await customerResponse.json();
      if (customerResult.success && customerResult.customer) {
        customerData = { ...customerData, ...customerResult.customer };
        document.getElementById('welcomeMessage').textContent = `Welcome, ${customerData.firstName} ${customerData.lastName}!`;
      }
    }

    // Fetch dashboard stats
    const statsResponse = await authenticatedFetch(`/api/customers/${customerId}/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (statsResponse.ok) {
      const statsResult = await statsResponse.json();
      console.log('Dashboard stats response:', statsResult);
      if (statsResult.success && statsResult.dashboard && statsResult.dashboard.statistics) {
        const stats = statsResult.dashboard.statistics;
        console.log('Active orders count:', stats.activeOrders);
        document.getElementById('activeOrders').textContent = stats.activeOrders || 0;
        document.getElementById('completedOrders').textContent = stats.completedOrders || 0;
        document.getElementById('totalSpent').textContent = `$${(stats.totalSpent || 0).toFixed(2)}`;

        // Display bag credit
        if (statsResult.dashboard.bagCredit) {
          const bagCredit = statsResult.dashboard.bagCredit;
          const bagCreditAmount = bagCredit.amount || 0;
          document.getElementById('bagCredits').textContent = `$${bagCreditAmount.toFixed(2)}`;
          console.log('Bag credit displayed:', bagCreditAmount);
        }
      }
    } else {
      console.error('Failed to fetch dashboard stats:', statsResponse.status, statsResponse.statusText);
    }

    // Load recent orders
    await loadOrders();

  } catch (error) {
    console.error('Error loading dashboard data:', error);
    // Use default values on error
    document.getElementById('activeOrders').textContent = '0';
    document.getElementById('completedOrders').textContent = '0';
    document.getElementById('totalSpent').textContent = '$0.00';
    document.getElementById('bagCredits').textContent = '$0.00';
  }
}

// Load orders
async function loadOrders() {
  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = '<h3 class="text-xl font-bold mb-4">My Orders</h3><div class="text-gray-500">Loading orders...</div>';

  try {
    const token = localStorage.getItem('customerToken');
    const response = await fetch(`/api/customers/${customerId}/orders`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }

    const result = await response.json();

    if (result.success && result.orders && result.orders.length > 0) {
      let ordersHtml = `
                <h3 class="text-xl font-bold mb-4">My Orders</h3>
                <div class="overflow-x-auto">
                    <table class="w-full border-collapse">
                        <thead>
                            <tr class="border-b">
                                <th class="text-left p-2">Order ID</th>
                                <th class="text-left p-2">Date</th>
                                <th class="text-left p-2">Status</th>
                                <th class="text-left p-2">Total</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

      result.orders.forEach(order => {
        const date = new Date(order.createdAt).toLocaleDateString();
        const statusColor = order.status === 'completed' ? 'text-green-600' :
          order.status === 'cancelled' ? 'text-red-600' :
            'text-blue-600';

        ordersHtml += `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="p-2">${order.orderId}</td>
                        <td class="p-2">${date}</td>
                        <td class="p-2 ${statusColor} font-semibold">${order.status}</td>
                        <td class="p-2">$${(order.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                `;
      });

      ordersHtml += '</tbody></table></div>';
      contentArea.innerHTML = ordersHtml;
    } else {
      contentArea.innerHTML = `
                <h3 class="text-xl font-bold mb-4">My Orders</h3>
                <p class="text-gray-500">No orders found. Schedule your first pickup to get started!</p>
            `;
    }
  } catch (error) {
    console.error('Error loading orders:', error);
    contentArea.innerHTML = `
            <h3 class="text-xl font-bold mb-4">My Orders</h3>
            <p class="text-gray-500">No orders yet. Schedule your first pickup!</p>
        `;
  }
}

// Load profile
async function loadProfile(editMode = false) {
  const contentArea = document.getElementById('contentArea');

  if (!editMode) {
    // View mode
    let profileHtml = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">My Profile</h3>
                <button id="editProfileBtn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Edit Profile
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-gray-600 mb-1">First Name</label>
                    <p class="font-semibold">${customerData.firstName}</p>
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">Last Name</label>
                    <p class="font-semibold">${customerData.lastName}</p>
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">Email</label>
                    <p class="font-semibold">${customerData.email}</p>
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">Phone</label>
                    <p class="font-semibold">${customerData.phone || 'Not provided'}</p>
                </div>
                <div>
                    <label class="block text-gray-600 mb-1">Customer ID</label>
                    <p class="font-semibold text-gray-500">${customerData.customerId} (Cannot be changed)</p>
                </div>
            </div>
            ${customerData.address || customerData.city ? `
                <div class="mt-4">
                    <label class="block text-gray-600 mb-1">Address</label>
                    <p class="font-semibold">${customerData.address || 'Not provided'}<br>
                    ${customerData.city || ''}, ${customerData.state || ''} ${customerData.zipCode || ''}</p>
                </div>
            ` : `
                <div class="mt-4">
                    <label class="block text-gray-600 mb-1">Address</label>
                    <p class="font-semibold">Not provided</p>
                </div>
            `}
            <div id="deleteDataSection" class="mt-8 pt-6 border-t">
                <h3 class="text-lg font-bold mb-4 text-red-600">Danger Zone - Development Only</h3>
                <div class="bg-red-50 border border-red-300 rounded-lg p-4">
                    <p class="text-red-800 mb-4">
                        <strong>Warning:</strong> This will permanently delete ALL your data including:
                    </p>
                    <ul class="list-disc list-inside text-red-700 mb-4">
                        <li>Your customer account</li>
                        <li>All your orders</li>
                    </ul>
                    <p class="text-red-800 font-bold mb-4">This action cannot be undone!</p>
                    <button type="button" id="deleteAllDataBtn" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition">
                        Delete All My Data
                    </button>
                </div>
            </div>
        `;

    contentArea.innerHTML = profileHtml;

    // Add event listener for edit button
    document.getElementById('editProfileBtn').addEventListener('click', function() {
      loadProfile(true);
    });

    // Add event listener for delete data button
    const deleteDataBtn = document.getElementById('deleteAllDataBtn');
    if (deleteDataBtn) {
      deleteDataBtn.addEventListener('click', function() {
        deleteAllData();
      });
    }

    // Check if delete data feature should be shown
    checkAndShowDeleteSection();
  } else {
    // Edit mode
    let editHtml = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">Edit Profile</h3>
                <div>
                    <button id="saveProfileBtn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mr-2">
                        Save Changes
                    </button>
                    <button id="cancelEditBtn" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
                        Cancel
                    </button>
                </div>
            </div>
            <form id="profileForm" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-gray-600 mb-1">First Name</label>
                        <input type="text" id="editFirstName" value="${customerData.firstName}" 
                               class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-gray-600 mb-1">Last Name</label>
                        <input type="text" id="editLastName" value="${customerData.lastName}" 
                               class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-gray-600 mb-1">Email</label>
                        <input type="email" id="editEmail" value="${customerData.email}" 
                               class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-gray-600 mb-1">Phone</label>
                        <input type="tel" id="editPhone" value="${customerData.phone || ''}" 
                               class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-gray-600 mb-1">Customer ID</label>
                        <input type="text" value="${customerData.customerId}" disabled
                               class="w-full p-2 border rounded bg-gray-100 text-gray-500">
                    </div>
                </div>
                <div class="mt-4">
                    <label class="block text-gray-600 mb-1">Address</label>
                    <input type="text" id="editAddress" value="${customerData.address || ''}" 
                           class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                           placeholder="Street Address">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input type="text" id="editCity" value="${customerData.city || ''}" 
                               class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                               placeholder="City">
                        <input type="text" id="editState" value="${customerData.state || ''}" 
                               class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                               placeholder="State" maxlength="2">
                        <input type="text" id="editZipCode" value="${customerData.zipCode || ''}" 
                               class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                               placeholder="ZIP Code">
                    </div>
                </div>
            </form>
        `;

    contentArea.innerHTML = editHtml;

    // Initialize service area autocomplete if available
    if (window.ServiceAreaAutocomplete) {
      // Re-initialize for the dynamically created fields
      window.ServiceAreaAutocomplete.init();
    }

    // Add event listeners for save and cancel buttons
    document.getElementById('saveProfileBtn').addEventListener('click', function() {
      saveProfile();
    });

    document.getElementById('cancelEditBtn').addEventListener('click', function() {
      loadProfile(false);
    });
  }
}

// Save profile changes
async function saveProfile() {
  try {
    const token = localStorage.getItem('customerToken');

    // Gather form data
    const updatedData = {
      firstName: document.getElementById('editFirstName').value.trim(),
      lastName: document.getElementById('editLastName').value.trim(),
      email: document.getElementById('editEmail').value.trim(),
      phone: document.getElementById('editPhone').value.trim(),
      address: document.getElementById('editAddress').value.trim(),
      city: document.getElementById('editCity').value.trim(),
      state: document.getElementById('editState').value.trim().toUpperCase(),
      zipCode: document.getElementById('editZipCode').value.trim()
    };

    // Validate required fields
    if (!updatedData.firstName || !updatedData.lastName || !updatedData.email) {
      alert('First name, last name, and email are required.');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updatedData.email)) {
      alert('Please enter a valid email address.');
      return;
    }

    // Validate phone format if provided
    if (updatedData.phone) {
      const phoneRegex = /^[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(updatedData.phone)) {
        alert('Please enter a valid phone number.');
        return;
      }
    }

    // Use CSRF-enabled fetch if available
    const authenticatedFetch = window.CsrfUtils ? window.CsrfUtils.createAuthenticatedFetch(() => token) : fetch;

    // Make API request to update customer
    const response = await authenticatedFetch(`/api/customers/${customerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      body: JSON.stringify(updatedData)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        // Update local customer data
        customerData = { ...customerData, ...updatedData };

        // Update localStorage
        localStorage.setItem('currentCustomer', JSON.stringify(customerData));

        // Update welcome message
        document.getElementById('welcomeMessage').textContent = `Welcome, ${customerData.firstName}!`;

        alert('Profile updated successfully!');
        loadProfile(false); // Return to view mode
      } else {
        alert(result.message || 'Failed to update profile.');
      }
    } else {
      alert('Failed to update profile. Please try again.');
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    alert('An error occurred while saving. Please try again.');
  }
}

// Handle logout
function handleLogout() {
  console.log('Customer logout initiated');
  
  // Clear local storage
  localStorage.removeItem('customerToken');
  localStorage.removeItem('currentCustomer');
  localStorage.removeItem('currentRoute');
  
  // Clear session manager data
  if (window.SessionManager) {
    window.SessionManager.clearAuth('customer');
  }
  
  // Send logout message to parent if in iframe
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'logout',
      userType: 'customer'
    }, '*');
  }

  // Use embed navigation - check for navigateTo function first
  if (window.navigateTo && typeof window.navigateTo === 'function') {
    // We're in embed-app-v2.html context
    window.navigateTo('/customer-login');
  } else if (window.parent !== window) {
    // We're in an iframe but not embed-app-v2
    window.parent.postMessage({
      type: 'navigate',
      route: '/customer-login'
    }, '*');
  } else {
    // Direct navigation
    window.location.href = '/embed-app-v2.html?route=/customer-login';
  }
}

// Show orders (alias for loadOrders)
function showOrders() {
  loadOrders();
}

// Show profile (alias for loadProfile)
function showProfile() {
  loadProfile();
}

// Check and show delete section if enabled
async function checkAndShowDeleteSection() {
  try {
    const response = await fetch('/api/v1/environment');
    const data = await response.json();

    if (data.enableDeleteDataFeature === true) {
      const deleteSection = document.getElementById('deleteDataSection');
      if (deleteSection) {
        deleteSection.style.display = 'block';
      }
    }
  } catch (error) {
    console.log('Environment check failed:', error);
  }
}

// Delete all customer data
async function deleteAllData() {
  if (!confirm('Are you absolutely sure? This will delete ALL your data permanently!')) {
    return;
  }

  if (!confirm('This is your last chance to cancel. Do you really want to delete everything?')) {
    return;
  }

  try {
    const token = localStorage.getItem('customerToken');

    // Use CSRF-enabled fetch if available
    const authenticatedFetch = window.CsrfUtils ? window.CsrfUtils.createAuthenticatedFetch(() => token) : fetch;

    const response = await authenticatedFetch(`/api/v1/customers/${customerId}/delete-all-data`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    const data = await response.json();

    if (data.success) {
      alert('All data has been deleted successfully.');
      handleLogout();
    } else {
      alert(data.message || 'Failed to delete data');
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('An error occurred while deleting data');
  }
}