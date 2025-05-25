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
async function loadProfile() {
    const contentArea = document.getElementById('contentArea');
    
    let profileHtml = `
        <h3 class="text-xl font-bold mb-4">My Profile</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-gray-600 mb-1">Name</label>
                <p class="font-semibold">${customerData.firstName} ${customerData.lastName}</p>
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
                <p class="font-semibold">${customerData.customerId}</p>
            </div>
        </div>
        ${customerData.address ? `
            <div class="mt-4">
                <label class="block text-gray-600 mb-1">Address</label>
                <p class="font-semibold">${customerData.address}<br>
                ${customerData.city}, ${customerData.state} ${customerData.zipCode}</p>
            </div>
        ` : ''}
    `;
    
    contentArea.innerHTML = profileHtml;
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