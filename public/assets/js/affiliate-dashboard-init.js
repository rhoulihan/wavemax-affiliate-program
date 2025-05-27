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
  
  // Load settings data on initial load
  loadSettingsData(affiliateId);
  
  // Load pickups data for the default active tab
  loadPickupRequests(affiliateId);

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
  
  // Copy registration link button
  const copyBtn = document.getElementById('copyRegistrationLinkBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      copyRegistrationLink();
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
      
      const deliveryFeeElement = document.getElementById('deliveryFee');
      if (deliveryFeeElement) deliveryFeeElement.textContent = `$${data.deliveryFee.toFixed(2)}`;
      
      // Generate and display registration link with wavemaxlaundry.com format
      const registrationLink = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?affid=${affiliateId}`;
      const linkElement = document.getElementById('registrationLink');
      if (linkElement) linkElement.value = registrationLink;
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
                order.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                order.status === 'picked_up' ? 'bg-blue-100 text-blue-800' :
                order.status === 'processing' ? 'bg-purple-100 text-purple-800' :
                order.status === 'ready_for_delivery' ? 'bg-indigo-100 text-indigo-800' :
                order.status === 'delivered' ? 'bg-green-100 text-green-800' :
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
          row.className = 'border-b hover:bg-gray-50';
          row.innerHTML = `
            <td class="py-3 px-4">${customer.firstName} ${customer.lastName}</td>
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
        const serviceAreaField = document.getElementById('settingsServiceArea');
        const registrationLinkField = document.getElementById('registrationLink');
        
        console.log('Setting field values:', {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          businessName: data.businessName,
          serviceArea: data.serviceArea
        });
        
        if (firstNameField) firstNameField.value = data.firstName || '';
        if (lastNameField) lastNameField.value = data.lastName || '';
        if (emailField) emailField.value = data.email || '';
        if (phoneField) phoneField.value = data.phone || '';
        if (businessNameField) businessNameField.value = data.businessName || '';
        if (serviceAreaField) serviceAreaField.value = data.serviceArea || '';
        
        // Generate and display registration link with wavemaxlaundry.com format
        const registrationLink = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?affid=${affiliateId}`;
        if (registrationLinkField) registrationLinkField.value = registrationLink;
        
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
    
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const response = await fetch(`${baseUrl}/api/v1/affiliates/${affiliateId}`, {
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
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const response = await fetch(`${baseUrl}/api/v1/affiliates/${affiliateId}/change-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`,
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

// Initialize when DOM is ready or immediately if already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAffiliateDashboard);
} else {
  initializeAffiliateDashboard();
}