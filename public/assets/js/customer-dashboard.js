// Global variables
let customerData = null;
let customerId = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async function() {
  // Check authentication
  const token = localStorage.getItem('customerToken');
  const customerStr = localStorage.getItem('currentCustomer');

  if (!token || !customerStr) {
    window.location.href = 'customer-login.html';
    return;
  }

  try {
    customerData = JSON.parse(customerStr);
    customerId = customerData.customerId;

    // Update welcome message
    document.getElementById('welcomeMessage').textContent = `Welcome, ${customerData.firstName}!`;
    document.getElementById('customerInfo').textContent = `Customer ID: ${customerId}`;

    // Set schedule pickup link
    document.getElementById('schedulePickupBtn').href = `schedule-pickup.html?affiliate=${customerData.affiliateId}&customer=${customerId}`;

    // Load dashboard data
    await loadDashboardData();

  } catch (error) {
    console.error('Error initializing dashboard:', error);
    alert('Error loading dashboard. Please login again.');
    window.location.href = 'customer-login.html';
  }
});

// Load dashboard data
async function loadDashboardData() {
  try {
    const token = localStorage.getItem('customerToken');

    // Fetch customer details
    const customerResponse = await fetch(`/api/customers/${customerId}`, {
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
    const statsResponse = await fetch(`/api/customers/${customerId}/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (statsResponse.ok) {
      const statsResult = await statsResponse.json();
      if (statsResult.success && statsResult.stats) {
        document.getElementById('activeOrders').textContent = statsResult.stats.activeOrdersCount || 0;
        document.getElementById('completedOrders').textContent = statsResult.stats.completedOrdersCount || 0;
        document.getElementById('totalSpent').textContent = `$${(statsResult.stats.totalSpent || 0).toFixed(2)}`;
      }
    }

    // Load recent orders
    await loadOrders();

  } catch (error) {
    console.error('Error loading dashboard data:', error);
    // Use default values on error
    document.getElementById('activeOrders').textContent = '0';
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
        `;

    contentArea.innerHTML = profileHtml;

    // Add event listener for edit button
    document.getElementById('editProfileBtn').addEventListener('click', function() {
      loadProfile(true);
    });
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

    // Make API request to update customer
    const response = await fetch(`/api/customers/${customerId}`, {
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

// Set up event listeners after DOM content loads
document.addEventListener('DOMContentLoaded', function() {
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', function() {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('currentCustomer');
    window.location.href = 'customer-login.html';
  });

  // View Orders button
  document.getElementById('viewOrdersBtn').addEventListener('click', function() {
    loadOrders();
  });

  // My Profile button
  document.getElementById('myProfileBtn').addEventListener('click', function() {
    loadProfile();
  });
});