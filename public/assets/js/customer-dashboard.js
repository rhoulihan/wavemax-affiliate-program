(function() {
  'use strict';
  
  // Check if already loaded
  if (window.customerDashboardLoaded) {
    console.log('Customer dashboard already loaded, skipping...');
    return;
  }
  window.customerDashboardLoaded = true;

  // CSRF utilities will be checked when needed
  // They may not be available immediately due to script loading order

  // Global variables
  let customerData = null;
  let customerId = null;

// Function to show loading overlay
function showLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
}

// Function to hide loading overlay
function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    // Fade out animation
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }
}

// Function to initialize dashboard
async function initializeDashboard() {
  console.log('Initializing customer dashboard');
  
  // Show loading overlay immediately
  showLoadingOverlay();
  
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
    // Hide loading overlay before redirecting
    hideLoadingOverlay();
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
        
        // Use navigateTo if available (when in iframe), otherwise use window.location
        if (window.navigateTo && typeof window.navigateTo === 'function') {
          console.log('Navigating to schedule pickup using navigateTo');
          window.navigateTo('/schedule-pickup');
        } else if (window.parent !== window && window.parent.postMessage) {
          // Try to communicate with parent frame
          console.log('Posting navigation message to parent');
          window.parent.postMessage({
            type: 'navigate',
            route: '/schedule-pickup'
          }, '*');
        } else {
          // Fallback to direct navigation
          console.log('Using direct navigation to schedule pickup');
          window.location.href = '/embed-app-v2.html?route=/schedule-pickup';
        }
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
    
    // Hide loading overlay once everything is loaded
    hideLoadingOverlay();

  } catch (error) {
    console.error('Error initializing dashboard:', error);
    // Hide overlay even on error
    hideLoadingOverlay();
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
      // Check both possible response structures
      const stats = (statsResult.dashboard && statsResult.dashboard.statistics) 
                    ? statsResult.dashboard.statistics 
                    : statsResult.statistics;
      
      if (statsResult.success && stats) {
        console.log('Active orders count:', stats.activeOrders);
        // Show Yes/No for active orders instead of a number
        const hasActiveOrder = stats.activeOrders > 0;
        const activeOrderElement = document.getElementById('activeOrders');
        console.log('Active order element found:', !!activeOrderElement);
        console.log('Has active order:', hasActiveOrder);
        if (activeOrderElement) {
          console.log('Updating activeOrders element to:', hasActiveOrder ? 'Yes' : 'No');
          activeOrderElement.innerHTML = hasActiveOrder 
            ? '<span class="text-green-600 font-bold">Yes</span>' 
            : '<span class="text-gray-500">No</span>';
          console.log('ActiveOrders element after update:', activeOrderElement.innerHTML);
        }
        document.getElementById('completedOrders').textContent = stats.completedOrders || 0;
        document.getElementById('totalSpent').textContent = `$${(stats.totalSpent || 0).toFixed(2)}`;
      }
    } else {
      console.error('Failed to fetch dashboard stats:', statsResponse.status, statsResponse.statusText);
    }

    // Load recent orders
    await loadOrders();

  } catch (error) {
    console.error('Error loading dashboard data:', error);
    // Use default values on error
    const activeOrderElement = document.getElementById('activeOrders');
    if (activeOrderElement) {
      activeOrderElement.innerHTML = '<span class="text-gray-500">No</span>';
    }
    document.getElementById('completedOrders').textContent = '0';
    document.getElementById('totalSpent').textContent = '$0.00';
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

      // Track if there are any unpaid orders
      let hasUnpaidOrder = false;
      let firstUnpaidOrderId = null;

      result.orders.forEach(order => {
        // Debug: Log the order structure
        console.log('Order object:', order);
        
        const date = new Date(order.createdAt).toLocaleDateString();
        const statusColor = order.status === 'completed' ? 'text-green-600' :
          order.status === 'cancelled' ? 'text-red-600' :
            'text-blue-600';
        
        // Get the actual order ID - could be _id, id, or orderId
        const actualOrderId = order._id || order.id || order.orderId;
        
        // Check if this is a V2 order that needs payment
        const needsPayment = (order.v2PaymentStatus === 'pending' || order.v2PaymentStatus === 'awaiting') && 
                           order.status === 'processing';
        
        if (needsPayment && !firstUnpaidOrderId) {
          hasUnpaidOrder = true;
          firstUnpaidOrderId = actualOrderId;
          console.log('Found unpaid order with ID:', actualOrderId);
        }

        ordersHtml += `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="p-2">${order.orderId}</td>
                        <td class="p-2">${date}</td>
                        <td class="p-2">
                          <span class="${statusColor} font-semibold">${order.status}</span>
                          ${needsPayment ? '<br><span class="text-orange-600 text-sm">Payment Pending</span>' : ''}
                        </td>
                        <td class="p-2">
                          $${(order.totalAmount || 0).toFixed(2)}
                          ${needsPayment ? `
                            <button data-order-id="${actualOrderId}" 
                                    class="pay-now-btn ml-2 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                              Pay Now
                            </button>
                          ` : ''}
                        </td>
                    </tr>
                `;
      });

      ordersHtml += '</tbody></table></div>';
      contentArea.innerHTML = ordersHtml;
      
      // Add event listeners to Pay Now buttons using event delegation
      const payNowButtons = contentArea.querySelectorAll('.pay-now-btn');
      payNowButtons.forEach(button => {
        button.addEventListener('click', function() {
          const orderId = this.getAttribute('data-order-id');
          console.log('Pay Now clicked for order:', orderId);
          initiatePaymentForOrder(orderId);
        });
      });
      
      // Auto-show payment modal if there's an unpaid order
      if (hasUnpaidOrder && firstUnpaidOrderId) {
        console.log('Found unpaid order, will show payment modal for order:', firstUnpaidOrderId);
        
        // Check if v2Payment is available
        if (window.v2Payment) {
          console.log('v2Payment is available, initiating payment');
          setTimeout(() => {
            window.v2Payment.initiatePayment(firstUnpaidOrderId);
          }, 1000); // Give time for everything to load
        } else {
          console.error('v2Payment not available yet, waiting...');
          // Wait for v2Payment to be available
          let checkCount = 0;
          const checkInterval = setInterval(() => {
            checkCount++;
            if (window.v2Payment) {
              console.log('v2Payment now available, initiating payment');
              clearInterval(checkInterval);
              window.v2Payment.initiatePayment(firstUnpaidOrderId);
            } else if (checkCount > 10) {
              console.error('v2Payment still not available after 5 seconds');
              clearInterval(checkInterval);
            }
          }, 500);
        }
      }
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

// Function to initiate payment for a specific order
function initiatePaymentForOrder(orderId) {
  if (window.v2Payment) {
    console.log('Initiating payment for order:', orderId);
    window.v2Payment.initiatePayment(orderId);
  } else {
    console.error('V2 Payment modal not loaded');
    alert('Payment system is not available. Please refresh the page and try again.');
  }
}

// Make function available globally for onclick handlers
window.initiatePaymentForOrder = initiatePaymentForOrder;

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

// Expose necessary functions to window
window.initializeDashboard = initializeDashboard;
window.handleLogout = handleLogout;

// Auto-initialize is already handled above, no need to duplicate

})();