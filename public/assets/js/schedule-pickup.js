// Schedule Pickup Page - Requires Authentication
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Schedule pickup page loading');
  
  // Check if customer is logged in
  const token = localStorage.getItem('customerToken');
  const customerStr = localStorage.getItem('currentCustomer');
  
  if (!token || !customerStr) {
    // Not logged in, redirect to login page with pickup flag
    console.log('User not authenticated, redirecting to login');
    window.location.href = '/embed-app.html?route=/customer-login&pickup=true';
    return;
  }
  
  try {
    const customer = JSON.parse(customerStr);
    console.log('Customer authenticated:', customer.customerId);
    
    // Hide login section if it exists
    const loginSection = document.getElementById('loginSection');
    if (loginSection) {
      loginSection.style.display = 'none';
    }
    
    // Show pickup form
    const pickupDetailsSection = document.getElementById('pickupDetailsSection');
    if (pickupDetailsSection) {
      pickupDetailsSection.style.display = 'block';
    }
    
    // Load customer data into the form
    await loadCustomerIntoForm(customer, token);
    
    // Setup form submission handler
    setupFormSubmission(token);
    
  } catch (error) {
    console.error('Error initializing schedule pickup:', error);
    // If there's an error, redirect to login
    window.location.href = '/embed-app.html?route=/customer-login&pickup=true';
  }
});

// Function to load customer data into the pickup form
async function loadCustomerIntoForm(customer, token) {
  try {
    // Set customer data fields
    document.getElementById('customerId').value = customer.customerId;
    document.getElementById('customerName').textContent = `${customer.firstName} ${customer.lastName}`;
    document.getElementById('customerPhone').textContent = customer.phone || customer.email;
    document.getElementById('customerAddress').textContent = 'Loading address...';

    // Set affiliate ID
    document.getElementById('affiliateId').value = customer.affiliateId;

    // Fetch full customer profile to get address and affiliate details
    const profileResponse = await fetch(`/api/customers/${customer.customerId}/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      
      if (profileData.success && profileData.customer) {
        const fullCustomer = profileData.customer;
        
        // Update address
        const address = `${fullCustomer.address}, ${fullCustomer.city}, ${fullCustomer.state} ${fullCustomer.zipCode}`;
        document.getElementById('customerAddress').textContent = address;
        
        // Update phone if available
        if (fullCustomer.phone) {
          document.getElementById('customerPhone').textContent = fullCustomer.phone;
        }
        
        // Set delivery fee if available
        if (fullCustomer.affiliate && fullCustomer.affiliate.deliveryFee) {
          document.getElementById('deliveryFee').textContent = `$${parseFloat(fullCustomer.affiliate.deliveryFee).toFixed(2)}`;
        } else {
          // Try to fetch affiliate data directly
          await fetchAffiliateDeliveryFee(customer.affiliateId);
        }
      }
    }
    
    // Setup date fields
    setupDateFields();
    
  } catch (error) {
    console.error('Error loading customer data:', error);
    alert('Error loading customer information. Please try logging in again.');
    window.location.href = '/embed-app.html?route=/customer-login&pickup=true';
  }
}

// Function to fetch affiliate delivery fee
async function fetchAffiliateDeliveryFee(affiliateId) {
  if (!affiliateId) {
    document.getElementById('deliveryFee').textContent = '$5.99';
    return;
  }
  
  try {
    const response = await fetch(`/api/affiliates/${affiliateId}/public`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.affiliate && data.affiliate.deliveryFee) {
        document.getElementById('deliveryFee').textContent = `$${parseFloat(data.affiliate.deliveryFee).toFixed(2)}`;
      } else {
        document.getElementById('deliveryFee').textContent = '$5.99';
      }
    } else {
      document.getElementById('deliveryFee').textContent = '$5.99';
    }
  } catch (error) {
    console.error('Error fetching affiliate fee:', error);
    document.getElementById('deliveryFee').textContent = '$5.99';
  }
}

// Function to setup date fields
function setupDateFields() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const pickupDateInput = document.getElementById('pickupDate');
  const deliveryDateInput = document.getElementById('deliveryDate');
  
  // Format dates as YYYY-MM-DD for input fields
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Set minimum and default dates
  pickupDateInput.min = formatDate(today);
  pickupDateInput.value = formatDate(today);
  
  deliveryDateInput.min = formatDate(tomorrow);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  deliveryDateInput.value = formatDate(dayAfterTomorrow);
  
  // Update delivery date when pickup date changes
  pickupDateInput.addEventListener('change', function() {
    const pickupDate = new Date(this.value);
    const minDeliveryDate = new Date(pickupDate);
    minDeliveryDate.setDate(minDeliveryDate.getDate() + 1);
    
    deliveryDateInput.min = formatDate(minDeliveryDate);
    
    // If current delivery date is before new minimum, update it
    if (new Date(deliveryDateInput.value) < minDeliveryDate) {
      deliveryDateInput.value = formatDate(minDeliveryDate);
    }
  });
}

// Function to setup form submission
function setupFormSubmission(token) {
  const form = document.getElementById('pickupScheduleForm');
  if (!form) return;
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Collect form data
    const formData = new FormData(form);
    const pickupData = {};
    
    formData.forEach((value, key) => {
      if (key !== '_csrf') {
        // Convert date fields to ISO8601 format
        if ((key === 'pickupDate' || key === 'deliveryDate') && value) {
          pickupData[key] = new Date(value + 'T12:00:00').toISOString();
        } else {
          pickupData[key] = value;
        }
      }
    });
    
    console.log('Submitting pickup order:', pickupData);
    
    try {
      // Submit the order
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(pickupData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Order created successfully:', data.orderId);
        
        // Store order data for confirmation page
        const orderData = {
          orderId: data.orderId,
          pickupDate: pickupData.pickupDate,
          pickupTime: pickupData.pickupTime,
          deliveryDate: pickupData.deliveryDate,
          deliveryTime: pickupData.deliveryTime,
          estimatedSize: pickupData.estimatedSize,
          specialInstructions: pickupData.specialPickupInstructions || 'None'
        };
        
        // Store in localStorage for the confirmation page
        const storedOrders = JSON.parse(localStorage.getItem('wavemax_orders') || '[]');
        storedOrders.push(orderData);
        localStorage.setItem('wavemax_orders', JSON.stringify(storedOrders));
        
        // Redirect to order confirmation page
        window.location.href = '/embed-app.html?route=/order-confirmation&id=' + data.orderId;
      } else {
        alert(data.message || 'Failed to schedule pickup. Please try again.');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      alert('An error occurred while scheduling your pickup. Please try again.');
    }
  });
}