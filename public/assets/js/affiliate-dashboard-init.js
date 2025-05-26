// Affiliate dashboard functionality for embedded environment
function initializeAffiliateDashboard() {
  const isEmbedded = window.EMBED_CONFIG?.isEmbedded || false;
  const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';

  // Check authentication
  const token = localStorage.getItem('affiliateToken');
  const currentAffiliate = JSON.parse(localStorage.getItem('currentAffiliate'));

  if (!token || !currentAffiliate) {
    // Redirect to login if not authenticated
    if (isEmbedded) {
      // For embedded, use postMessage navigation
      console.log('Not authenticated, navigating to login');
      window.parent.postMessage({
        type: 'navigate',
        data: { url: '/affiliate-login' }
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
        loadPickupRequests(affiliateId);
      } else if (tabId === 'customers') {
        loadCustomers(affiliateId);
      } else if (tabId === 'invoices') {
        loadInvoices(affiliateId);
      } else if (tabId === 'settings') {
        loadSettingsData(affiliateId);
      }
    });
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
      
      if (isEmbedded) {
        console.log('Sending logout navigation message');
        // For embedded, use postMessage navigation
        window.parent.postMessage({
          type: 'navigate',
          data: { url: '/affiliate-login' }
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

  // Make functions available globally (they're used by the existing dashboard code)
  window.loadAffiliateData = loadAffiliateData;
  window.loadDashboardStats = loadDashboardStats;
  window.loadPickupRequests = loadPickupRequests;
  window.loadCustomers = loadCustomers;
  window.loadInvoices = loadInvoices;
  window.loadSettingsData = loadSettingsData;
}

// Copy the existing functions from affiliate-dashboard.js
async function loadAffiliateData(affiliateId) {
  try {
    const response = await fetch(`/api/v1/affiliates/${affiliateId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Update profile information with null checks
      const nameElement = document.getElementById('affiliateName');
      if (nameElement) nameElement.textContent = `${data.firstName} ${data.lastName}`;
      
      const emailElement = document.getElementById('affiliateEmail');
      if (emailElement) emailElement.textContent = data.email;
      
      const businessElement = document.getElementById('businessName');
      if (businessElement) businessElement.textContent = data.businessName || 'N/A';
      
      const serviceAreaElement = document.getElementById('serviceArea');
      if (serviceAreaElement) serviceAreaElement.textContent = data.serviceArea;
      
      const deliveryFeeElement = document.getElementById('deliveryFee');
      if (deliveryFeeElement) deliveryFeeElement.textContent = `$${data.deliveryFee.toFixed(2)}`;
      
      // Generate and display registration link
      const baseUrl = window.location.origin;
      const registrationLink = `${baseUrl}/customer-register?affid=${affiliateId}`;
      const linkElement = document.getElementById('registrationLink');
      if (linkElement) linkElement.value = registrationLink;
    }
  } catch (error) {
    console.error('Error loading affiliate data:', error);
  }
}

async function loadDashboardStats(affiliateId) {
  try {
    const response = await fetch(`/api/v1/affiliates/${affiliateId}/dashboard`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const stats = await response.json();
      
      // Update dashboard statistics with null checks
      const customersElement = document.getElementById('totalCustomers');
      if (customersElement) customersElement.textContent = stats.totalCustomers || 0;
      
      const ordersElement = document.getElementById('activeOrders');
      if (ordersElement) ordersElement.textContent = stats.activeOrders || 0;
      
      const revenueElement = document.getElementById('monthlyRevenue');
      if (revenueElement) revenueElement.textContent = `$${(stats.monthlyRevenue || 0).toFixed(2)}`;
      
      const paymentElement = document.getElementById('pendingPayment');
      if (paymentElement) paymentElement.textContent = `$${(stats.pendingPayment || 0).toFixed(2)}`;
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

async function loadPickupRequests(affiliateId) {
  try {
    const response = await fetch(`/api/v1/affiliates/${affiliateId}/pickups`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const pickups = await response.json();
      const tbody = document.querySelector('#pickupsTable tbody');
      tbody.innerHTML = '';

      if (pickups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No pickup requests found</td></tr>';
      } else {
        pickups.forEach(pickup => {
          const row = document.createElement('tr');
          row.className = 'border-b hover:bg-gray-50';
          row.innerHTML = `
            <td class="py-3 px-4">${new Date(pickup.date).toLocaleDateString()}</td>
            <td class="py-3 px-4">${pickup.customerName}</td>
            <td class="py-3 px-4">${pickup.address}</td>
            <td class="py-3 px-4">
              <span class="px-2 py-1 rounded text-xs ${
                pickup.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                pickup.status === 'completed' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }">
                ${pickup.status}
              </span>
            </td>
            <td class="py-3 px-4">
              <button class="text-blue-600 hover:underline">View Details</button>
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
  try {
    const response = await fetch(`/api/v1/affiliates/${affiliateId}/customers`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const customers = await response.json();
      const tbody = document.querySelector('#customersTable tbody');
      tbody.innerHTML = '';

      if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No customers found</td></tr>';
      } else {
        customers.forEach(customer => {
          const row = document.createElement('tr');
          row.className = 'border-b hover:bg-gray-50';
          row.innerHTML = `
            <td class="py-3 px-4">${customer.name}</td>
            <td class="py-3 px-4">${customer.email}</td>
            <td class="py-3 px-4">${customer.phone}</td>
            <td class="py-3 px-4">
              <span class="px-2 py-1 rounded text-xs ${
                customer.status === 'active' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }">
                ${customer.status}
              </span>
            </td>
          `;
          tbody.appendChild(row);
        });
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
}

// Load settings data
async function loadSettingsData(affiliateId) {
  try {
    const response = await fetch(`/api/v1/affiliates/${affiliateId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Populate settings fields
      document.getElementById('settingsFirstName').value = data.firstName || '';
      document.getElementById('settingsLastName').value = data.lastName || '';
      document.getElementById('settingsEmail').value = data.email || '';
      document.getElementById('settingsPhone').value = data.phone || '';
      document.getElementById('settingsBusinessName').value = data.businessName || '';
      document.getElementById('settingsServiceArea').value = data.serviceArea || '';
      
      // Generate and display registration link
      const baseUrl = window.location.origin;
      const registrationLink = `${baseUrl}/customer-register?affid=${affiliateId}`;
      document.getElementById('registrationLink').value = registrationLink;
    }
  } catch (error) {
    console.error('Error loading settings data:', error);
  }
}

// Enable edit mode
function enableEditMode() {
  const inputs = document.querySelectorAll('#settingsForm input[type="text"], #settingsForm input[type="email"], #settingsForm input[type="tel"]');
  inputs.forEach(input => {
    // Skip the registration link field
    if (input.id !== 'registrationLink') {
      input.removeAttribute('readonly');
      input.classList.remove('bg-gray-100');
    }
  });
  
  document.getElementById('editBtn').style.display = 'none';
  document.getElementById('formButtons').style.display = 'block';
}

// Disable edit mode
function disableEditMode() {
  const inputs = document.querySelectorAll('#settingsForm input[type="text"], #settingsForm input[type="email"], #settingsForm input[type="tel"]');
  inputs.forEach(input => {
    if (input.id !== 'registrationLink') {
      input.setAttribute('readonly', true);
      input.classList.add('bg-gray-100');
    }
  });
  
  document.getElementById('editBtn').style.display = 'block';
  document.getElementById('formButtons').style.display = 'none';
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
      serviceArea: formData.get('serviceArea')
    };
    
    const response = await fetch(`/api/v1/affiliates/${affiliateId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`,
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

// Initialize when DOM is ready or immediately if already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAffiliateDashboard);
} else {
  initializeAffiliateDashboard();
}