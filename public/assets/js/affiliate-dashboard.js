document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('affiliateToken');
    const currentAffiliate = JSON.parse(localStorage.getItem('currentAffiliate'));
    
    if (!token || !currentAffiliate) {
        // Redirect to login if not authenticated
        window.location.href = 'affiliate-login.html';
        return;
    }
    
    // Get affiliate ID from current affiliate data
    const affiliateId = currentAffiliate.affiliateId;
    
    // Set affiliate ID in the page
    document.getElementById('affiliateId').textContent = `Affiliate ID: ${affiliateId}`;
    
    // Load affiliate data
    loadAffiliateData(affiliateId);
    
    // Load dashboard statistics
    loadDashboardStats(affiliateId);
    
    // Setup tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons and tabs
            tabButtons.forEach(btn => {
                btn.classList.remove('border-blue-600');
                btn.classList.remove('text-blue-600');
                btn.classList.add('border-transparent');
            });
            
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            // Add active class to clicked button and corresponding tab
            this.classList.add('border-blue-600');
            this.classList.add('text-blue-600');
            this.classList.remove('border-transparent');
            
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Load tab-specific data
            if (tabId === 'pickups') {
                loadOrders(affiliateId);
            } else if (tabId === 'customers') {
                loadCustomers(affiliateId);
            } else if (tabId === 'earnings') {
                loadEarnings(affiliateId);
            } else if (tabId === 'settings') {
                loadSettings(affiliateId);
            }
        });
    });
    
    // Register button redirects
    document.getElementById('registerCustomerBtn').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = `customer-register.html?affiliate=${affiliateId}`;
    });
    
    document.getElementById('registerCustomerBtn2').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = `customer-register.html?affiliate=${affiliateId}`;
    });
    
    document.getElementById('schedulePickupBtn').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = `schedule-pickup.html?affiliate=${affiliateId}`;
    });
    
    // Logout functionality
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        // Clear affiliate session
        localStorage.removeItem('currentAffiliate');
        localStorage.removeItem('affiliateToken');
        // Redirect to login page
        window.location.href = 'affiliate-login.html';
    });
    
    // Settings form payment method toggle
    const settingsPaymentMethod = document.getElementById('settingsPaymentMethod');
    const settingsBankInfoContainer = document.getElementById('settingsBankInfoContainer');
    const settingsPaypalInfoContainer = document.getElementById('settingsPaypalInfoContainer');
    
    settingsPaymentMethod.addEventListener('change', function() {
        // Hide all payment containers
        settingsBankInfoContainer.style.display = 'none';
        settingsPaypalInfoContainer.style.display = 'none';
        
        // Show relevant container based on selection
        if (this.value === 'directDeposit') {
            settingsBankInfoContainer.style.display = 'block';
        } else if (this.value === 'paypal') {
            settingsPaypalInfoContainer.style.display = 'block';
        }
    });
    
    // Settings form submission
    document.getElementById('settingsForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Collect form data
        const formData = new FormData(this);
        const settingsData = {};
        
        formData.forEach((value, key) => {
            if (key !== '_csrf' && value) {  // Skip CSRF token and empty values
                settingsData[key] = value;
            }
        });
        
        // Validate password fields if they were filled
        if (settingsData.newPassword) {
            if (!settingsData.currentPassword) {
                alert('Please enter your current password to change your password.');
                return;
            }
            
            if (settingsData.newPassword !== settingsData.confirmPassword) {
                alert('New passwords do not match.');
                return;
            }
        }
        
        // Remove confirmPassword from data sent to server
        delete settingsData.confirmPassword;
        
        try {
            const token = localStorage.getItem('affiliateToken');
            const response = await fetch(`/api/affiliates/${affiliateId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settingsData)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                alert('Settings updated successfully!');
                // Clear password fields
                document.getElementById('settingsCurrentPassword').value = '';
                document.getElementById('settingsNewPassword').value = '';
                document.getElementById('settingsConfirmPassword').value = '';
            } else {
                alert(data.message || 'Failed to update settings. Please try again.');
            }
        } catch (error) {
            console.error('Settings update error:', error);
            alert('An error occurred while updating settings. Please try again.');
        }
    });
    
    // Load initial data
    loadOrders(affiliateId);
});

// Load affiliate data
async function loadAffiliateData(affiliateId) {
    try {
        const token = localStorage.getItem('affiliateToken');
        const response = await fetch(`/api/affiliates/${affiliateId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch affiliate data');
        }
        
        const data = await response.json();
        
        if (data.success && data.affiliate) {
            const affiliate = data.affiliate;
            document.getElementById('welcomeMessage').textContent = `Welcome back, ${affiliate.firstName} ${affiliate.lastName}!`;
            
            // Store affiliate data for other functions
            window.currentAffiliateData = affiliate;
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error('Error loading affiliate data:', error);
        // Use cached data if available
        const currentAffiliate = JSON.parse(localStorage.getItem('currentAffiliate'));
        if (currentAffiliate) {
            document.getElementById('welcomeMessage').textContent = `Welcome back, ${currentAffiliate.firstName} ${currentAffiliate.lastName}!`;
        }
    }
}

// Load dashboard statistics
async function loadDashboardStats(affiliateId) {
    try {
        const token = localStorage.getItem('affiliateToken');
        const response = await fetch(`/api/affiliates/${affiliateId}/dashboard`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch dashboard stats');
        }
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            const stats = data.stats;
            
            // Update stats in the UI
            document.getElementById('totalCustomers').textContent = stats.customerCount || 0;
            document.getElementById('activeOrders').textContent = stats.activeOrderCount || 0;
            document.getElementById('totalEarnings').textContent = `$${(stats.totalEarnings || 0).toFixed(2)}`;
            
            // Update earnings tab data
            document.getElementById('monthEarnings').textContent = `$${(stats.monthEarnings || 0).toFixed(2)}`;
            document.getElementById('weekEarnings').textContent = `$${(stats.weekEarnings || 0).toFixed(2)}`;
            document.getElementById('pendingEarnings').textContent = `$${(stats.pendingEarnings || 0).toFixed(2)}`;
            
            // Set order counts
            document.getElementById('monthOrderCount').textContent = stats.monthlyOrders || 0;
            document.getElementById('weekOrderCount').textContent = stats.weeklyOrders || 0;
            
            // Set next payout date
            if (stats.nextPayoutDate) {
                const nextPayoutDate = new Date(stats.nextPayoutDate);
                document.getElementById('nextPayoutDate').textContent = nextPayoutDate.toLocaleDateString();
            } else {
                const nextPayoutDate = new Date();
                nextPayoutDate.setDate(nextPayoutDate.getDate() + 7);
                document.getElementById('nextPayoutDate').textContent = nextPayoutDate.toLocaleDateString();
            }
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        // Set default values on error
        document.getElementById('totalCustomers').textContent = '0';
        document.getElementById('activeOrders').textContent = '0';
        document.getElementById('totalEarnings').textContent = '$0.00';
        document.getElementById('monthEarnings').textContent = '$0.00';
        document.getElementById('weekEarnings').textContent = '$0.00';
        document.getElementById('pendingEarnings').textContent = '$0.00';
        document.getElementById('monthOrderCount').textContent = '0';
        document.getElementById('weekOrderCount').textContent = '0';
        
        const nextPayoutDate = new Date();
        nextPayoutDate.setDate(nextPayoutDate.getDate() + 7);
        document.getElementById('nextPayoutDate').textContent = nextPayoutDate.toLocaleDateString();
    }
}

// Load orders for the pickups tab
async function loadOrders(affiliateId) {
    const ordersTableBody = document.getElementById('ordersTableBody');
    ordersTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading...</td></tr>';
    
    try {
        const token = localStorage.getItem('affiliateToken');
        const response = await fetch(`/api/affiliates/${affiliateId}/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }
        
        const data = await response.json();
        
        if (data.success && data.orders) {
            let ordersForAffiliate = data.orders;
    
            // Process orders data
            ordersForAffiliate = ordersForAffiliate.map(order => {
                // Add customer name and address if not present
                if (!order.customerName && order.customer) {
                    order.customerName = order.customer.name;
                    order.customerAddress = order.customer.address;
                }
                return order;
            });
    
    // Filter based on status dropdown
    const statusFilter = document.getElementById('orderStatusFilter').value;
    if (statusFilter !== 'all') {
        ordersForAffiliate = ordersForAffiliate.filter(order => order.status === statusFilter);
    }
    
    // Sort orders by date (newest first)
    ordersForAffiliate.sort((a, b) => new Date(b.pickupDate) - new Date(a.pickupDate));
    
    // Update UI with orders
    if (ordersForAffiliate.length === 0) {
        ordersTableBody.innerHTML = '<tr class="text-center"><td colspan="7" class="px-6 py-4 text-gray-500">No orders found.</td></tr>';
    } else {
        // Clear the loading message first
        ordersTableBody.innerHTML = '';
        ordersForAffiliate.forEach(order => {
            const row = document.createElement('tr');
            
            // Format dates for display
            const pickupDate = new Date(order.pickupDate);
            const formattedPickupDate = pickupDate.toLocaleDateString();
            
            // Determine if this is a pickup or delivery based on status
            const actionType = ['scheduled', 'picked_up'].includes(order.status) ? 'Pickup' : 'Delivery';
            const actionTime = actionType === 'Pickup' ? order.pickupTime : order.deliveryTime;
            const actionTimeFormatted = actionTime === 'morning' ? '8am-12pm' : actionTime === 'afternoon' ? '12pm-5pm' : '5pm-8pm';
            
            // Create status badge
            let statusBadge = '';
            switch (order.status) {
                case 'scheduled':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Scheduled</span>';
                    break;
                case 'picked_up':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Picked Up</span>';
                    break;
                case 'processing':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Processing</span>';
                    break;
                case 'ready_for_delivery':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">Ready for Delivery</span>';
                    break;
                case 'delivered':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Delivered</span>';
                    break;
                case 'cancelled':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Cancelled</span>';
                    break;
            }
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${order.orderId}</div>
                    <div class="text-sm text-gray-500">Created: ${new Date(order.createdAt).toLocaleDateString()}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${order.customerName || 'Unknown'}</div>
                    <div class="text-sm text-gray-500">${order.customerId}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">${order.customerAddress || 'N/A'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${actionType}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${formattedPickupDate}</div>
                    <div class="text-sm text-gray-500">${actionTimeFormatted}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a href="#" class="text-blue-600 hover:text-blue-900 mr-3">View</a>
                    <a href="#" class="text-blue-600 hover:text-blue-900">Update</a>
                </td>
            `;
            
            ordersTableBody.appendChild(row);
        });
    }
    
            // Update pagination info
            document.getElementById('ordersShowing').textContent = ordersForAffiliate.length;
            document.getElementById('ordersTotal').textContent = data.totalItems || ordersForAffiliate.length;
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        ordersTableBody.innerHTML = '<tr class="text-center"><td colspan="7" class="px-6 py-4 text-red-500">Failed to load orders. Please try again.</td></tr>';
    }
}

// Load customers for the customers tab
async function loadCustomers(affiliateId) {
    const customersTableBody = document.getElementById('customersTableBody');
    customersTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading...</td></tr>';
    
    try {
        const token = localStorage.getItem('affiliateToken');
        const response = await fetch(`/api/affiliates/${affiliateId}/customers`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch customers');
        }
        
        const data = await response.json();
        
        if (data.success && data.customers) {
            let customersForAffiliate = data.customers;
    
    
    // Get order counts for each customer
    const storedOrders = JSON.parse(localStorage.getItem('wavemax_orders')) || {};
    const customerOrderCounts = {};
    
    Object.values(storedOrders).forEach(order => {
        if (order.customerId) {
            customerOrderCounts[order.customerId] = (customerOrderCounts[order.customerId] || 0) + 1;
        }
    });
    
    // Update UI with customers
    if (customersForAffiliate.length === 0) {
        customersTableBody.innerHTML = '<tr class="text-center"><td colspan="7" class="px-6 py-4 text-gray-500">No customers found.</td></tr>';
    } else {
        // Clear the loading message first
        customersTableBody.innerHTML = '';
        customersForAffiliate.forEach(customer => {
            const row = document.createElement('tr');
            
            // Format date for display
            const registrationDate = new Date(customer.registrationDate);
            const formattedDate = registrationDate.toLocaleDateString();
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${customer.customerId}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${customer.firstName} ${customer.lastName}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${customer.email}</div>
                    <div class="text-sm text-gray-500">${customer.phone}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">${customer.address}</div>
                    <div class="text-sm text-gray-500">${customer.city}, ${customer.state} ${customer.zipCode}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${formattedDate}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-sm font-medium text-gray-900">${customerOrderCounts[customer.customerId] || 0}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a href="#" class="text-blue-600 hover:text-blue-900 mr-3">View</a>
                    <a href="#" class="text-blue-600 hover:text-blue-900">Edit</a>
                </td>
            `;
            
            customersTableBody.appendChild(row);
        });
    }
    
            // Update pagination info
            document.getElementById('customersShowing').textContent = customersForAffiliate.length;
            document.getElementById('customersTotal').textContent = data.totalItems || customersForAffiliate.length;
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error('Error loading customers:', error);
        customersTableBody.innerHTML = '<tr class="text-center"><td colspan="7" class="px-6 py-4 text-red-500">Failed to load customers. Please try again.</td></tr>';
    }
}

// Load earnings data for the earnings tab
function loadEarnings(affiliateId) {
    // In a real implementation, this would make an API call to get earnings data
    // For demo purposes, we'll generate mock data
    
    const transactionsTableBody = document.getElementById('transactionsTableBody');
    transactionsTableBody.innerHTML = '';
    
    // Generate mock transactions
    const transactions = [];
    const storedOrders = JSON.parse(localStorage.getItem('wavemax_orders')) || {};
    const storedCustomers = JSON.parse(localStorage.getItem('wavemax_customers')) || {};
    
    // Use existing orders if available, otherwise generate mock data
    if (Object.keys(storedOrders).length > 0) {
        Object.entries(storedOrders).forEach(([orderId, order]) => {
            if (order.affiliateId === affiliateId && order.status === 'delivered') {
                const customer = storedCustomers[order.customerId] || { firstName: 'Unknown', lastName: 'Customer' };
                
                // Generate mock payment data
                const weight = order.estimatedSize === 'small' ? Math.random() * 10 + 5 : 
                              order.estimatedSize === 'medium' ? Math.random() * 15 + 15 : 
                              Math.random() * 20 + 30;
                
                const orderTotal = (weight * 1.89).toFixed(2);
                const commission = (orderTotal * 0.1).toFixed(2);
                
                transactions.push({
                    date: new Date(order.deliveryDate || Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                    orderId,
                    customerName: `${customer.firstName} ${customer.lastName}`,
                    service: 'Wash, Dry, Fold',
                    weight: weight.toFixed(2),
                    orderTotal,
                    commission
                });
            }
        });
    }
    
    // If no transactions, generate mock data
    if (transactions.length === 0) {
        const customers = [
            { name: 'John Doe' },
            { name: 'Jane Smith' },
            { name: 'Michael Johnson' }
        ];
        
        for (let i = 0; i < 10; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));
            
            const weight = Math.floor(Math.random() * 30) + 5;
            const orderTotal = (weight * 1.89).toFixed(2);
            const commission = (orderTotal * 0.1).toFixed(2);
            
            transactions.push({
                date,
                orderId: 'ORD' + Math.floor(100000 + Math.random() * 900000),
                customerName: customers[Math.floor(Math.random() * customers.length)].name,
                service: 'Wash, Dry, Fold',
                weight: weight.toFixed(2),
                orderTotal,
                commission
            });
        }
    }
    
    // Sort transactions by date (newest first)
    transactions.sort((a, b) => b.date - a.date);
    
    // Update UI with transactions
    if (transactions.length === 0) {
        transactionsTableBody.innerHTML = '<tr class="text-center"><td colspan="6" class="px-6 py-4 text-gray-500">No transactions found.</td></tr>';
    } else {
        // Clear the loading message first
        transactionsTableBody.innerHTML = '';
        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${transaction.date.toLocaleDateString()}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${transaction.orderId}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${transaction.customerName}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${transaction.service}</div>
                    <div class="text-sm text-gray-500">${transaction.weight} lbs</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">$${transaction.orderTotal}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-green-600">$${transaction.commission}</div>
                </td>
            `;
            
            transactionsTableBody.appendChild(row);
        });
    }
    
    // Update pagination info
    document.getElementById('transactionsShowing').textContent = transactions.length;
    document.getElementById('transactionsTotal').textContent = transactions.length;
}

// Load settings data for the settings tab
async function loadSettings(affiliateId) {
    try {
        const token = localStorage.getItem('affiliateToken');
        const response = await fetch(`/api/affiliates/${affiliateId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch affiliate data');
        }
        
        const data = await response.json();
        
        if (data.success && data.affiliate) {
            const affiliate = data.affiliate;
            
            // Fill form fields with affiliate data
            document.getElementById('settingsFirstName').value = affiliate.firstName || '';
            document.getElementById('settingsLastName').value = affiliate.lastName || '';
            document.getElementById('settingsEmail').value = affiliate.email || '';
            document.getElementById('settingsPhone').value = affiliate.phone || '';
            document.getElementById('settingsAddress').value = affiliate.address || '';
            document.getElementById('settingsCity').value = affiliate.city || '';
            document.getElementById('settingsState').value = affiliate.state || '';
            document.getElementById('settingsZipCode').value = affiliate.zipCode || '';
            document.getElementById('settingsServiceArea').value = affiliate.serviceArea || '';
            document.getElementById('settingsDeliveryFee').value = affiliate.deliveryFee || '';
            
            // Set payment method and show relevant fields
            const paymentMethod = affiliate.paymentMethod || 'directDeposit';
            document.getElementById('settingsPaymentMethod').value = paymentMethod;
            
            // Show relevant payment containers
            document.getElementById('settingsBankInfoContainer').style.display = 'none';
            document.getElementById('settingsPaypalInfoContainer').style.display = 'none';
            
            if (paymentMethod === 'directDeposit') {
                document.getElementById('settingsBankInfoContainer').style.display = 'block';
                // Note: Account numbers are sensitive and should not be displayed in full
                // The API should return masked versions if needed
            } else if (paymentMethod === 'paypal') {
                document.getElementById('settingsPaypalInfoContainer').style.display = 'block';
                // Display PayPal email if available
                if (affiliate.paypalEmail) {
                    document.getElementById('settingsPaypalEmail').value = affiliate.paypalEmail;
                }
            }
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        alert('Failed to load settings. Please try again.');
    }
}