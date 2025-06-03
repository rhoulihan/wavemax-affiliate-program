// Schedule Pickup Page - Requires Authentication
(function() {
  'use strict';
  
  console.log('Schedule pickup script loaded');

  // Load CSRF utilities
  if (!window.CsrfUtils) {
    console.error('CSRF utilities not loaded. Please include csrf-utils.js before this script.');
  }

// Function to initialize the page
async function initializeSchedulePickup() {
  console.log('Initializing schedule pickup page');

  // Initialize CSRF token
  if (window.CsrfUtils) {
    try {
      await window.CsrfUtils.ensureCsrfToken();
      console.log('CSRF token initialized');
    } catch (error) {
      console.error('Failed to initialize CSRF token:', error);
    }
  }

  // Check if customer is logged in
  const token = localStorage.getItem('customerToken');
  const customerStr = localStorage.getItem('currentCustomer');

  console.log('Token exists:', !!token);
  console.log('Customer data exists:', !!customerStr);
  console.log('LocalStorage contents:', {
    customerToken: token ? 'exists' : 'missing',
    currentCustomer: customerStr ? 'exists' : 'missing'
  });

  if (!token || !customerStr) {
    // Not logged in, redirect to login page with pickup flag
    console.log('User not authenticated, redirecting to login');
    window.location.href = '/embed-app.html?login=customer&pickup=true';
    return;
  }

  try {
    console.log('Raw customer string from localStorage:', customerStr);
    const customer = JSON.parse(customerStr);
    console.log('Customer authenticated:', customer.customerId);
    console.log('Customer data:', customer);
    console.log('Customer has all fields:', {
      hasFirstName: !!customer.firstName,
      hasLastName: !!customer.lastName,
      hasPhone: !!customer.phone,
      hasAddress: !!customer.address,
      hasAffiliateId: !!customer.affiliateId,
      hasAffiliate: !!customer.affiliate
    });

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
    window.location.href = '/embed-app.html?login=customer&pickup=true';
  }
}

// Check if DOM is already loaded
if (document.readyState === 'loading') {
  console.log('DOM still loading, adding event listener');
  document.addEventListener('DOMContentLoaded', initializeSchedulePickup);
} else {
  console.log('DOM already loaded, initializing immediately');
  initializeSchedulePickup();
}

// Function to load customer data into the pickup form
async function loadCustomerIntoForm(customer, token) {
  console.log('Loading customer into form:', customer);

  try {
    // Check if form fields exist
    const customerIdField = document.getElementById('customerId');
    const customerNameField = document.getElementById('customerName');
    const customerPhoneField = document.getElementById('customerPhone');
    const customerAddressField = document.getElementById('customerAddress');
    const affiliateIdField = document.getElementById('affiliateId');

    console.log('Form fields found:', {
      customerId: !!customerIdField,
      customerName: !!customerNameField,
      customerPhone: !!customerPhoneField,
      customerAddress: !!customerAddressField,
      affiliateId: !!affiliateIdField
    });

    // Set customer data fields
    if (customerIdField) customerIdField.value = customer.customerId;
    if (customerNameField) customerNameField.textContent = `${customer.firstName} ${customer.lastName}`;
    if (customerPhoneField) customerPhoneField.textContent = customer.phone || customer.email;

    // Set address if available
    if (customerAddressField) {
      if (customer.address && customer.city && customer.state && customer.zipCode) {
        const fullAddress = `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`;
        console.log('Setting customer address:', fullAddress);
        customerAddressField.textContent = fullAddress;
      } else {
        console.log('Customer address fields missing:', {
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zipCode: customer.zipCode
        });
        customerAddressField.textContent = 'Loading address...';
      }
    }

    // Set affiliate ID
    if (affiliateIdField) affiliateIdField.value = customer.affiliateId;

    console.log('Customer affiliateId:', customer.affiliateId);
    console.log('Customer data has affiliate info:', customer.affiliate);

    // Check if we already have affiliate data with delivery fee from login
    if (customer.affiliate && customer.affiliate.deliveryFee) {
      console.log('Using affiliate delivery fee from login data:', customer.affiliate.deliveryFee);
      const deliveryFeeField = document.getElementById('deliveryFee');
      if (deliveryFeeField) {
        deliveryFeeField.textContent = `$${parseFloat(customer.affiliate.deliveryFee).toFixed(2)}`;
      }
    }

    // Fetch full customer profile to get address and other details
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    // Use the authenticated endpoint (without /profile) to get full data
    const profileResponse = await fetch(`${baseUrl}/api/v1/customers/${customer.customerId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log('Customer profile response:', profileData);

      if (profileData.success && profileData.customer) {
        const fullCustomer = profileData.customer;
        console.log('Full customer data:', fullCustomer);
        console.log('Affiliate data in customer:', fullCustomer.affiliate);

        // Update address only if we have the data
        if (fullCustomer.address && fullCustomer.city && fullCustomer.state && fullCustomer.zipCode) {
          const address = `${fullCustomer.address}, ${fullCustomer.city}, ${fullCustomer.state} ${fullCustomer.zipCode}`;
          console.log('Updating address from profile:', address);
          document.getElementById('customerAddress').textContent = address;
        } else {
          console.log('Profile missing address fields, keeping existing address');
        }

        // Update phone if available
        if (fullCustomer.phone) {
          document.getElementById('customerPhone').textContent = fullCustomer.phone;
        }

        // Set delivery fee if available and not already set
        const deliveryFeeField = document.getElementById('deliveryFee');
        if (deliveryFeeField && deliveryFeeField.textContent === '$0.00') {
          if (fullCustomer.affiliate && fullCustomer.affiliate.deliveryFee) {
            console.log('Setting delivery fee from customer profile:', fullCustomer.affiliate.deliveryFee);
            deliveryFeeField.textContent = `$${parseFloat(fullCustomer.affiliate.deliveryFee).toFixed(2)}`;
          } else {
            console.log('No affiliate delivery fee in customer profile, fetching directly');
            // Try to fetch affiliate data directly
            await fetchAffiliateDeliveryFee(customer.affiliateId);
          }
        }
      }
    } else {
      console.error('Customer profile request failed:', profileResponse.status, profileResponse.statusText);
    }

    // Fetch WDF rate from system configuration
    try {
      const wdfResponse = await fetch(`${baseUrl}/api/v1/system/config/public`);
      if (wdfResponse.ok) {
        const configs = await wdfResponse.json();
        const wdfConfig = configs.find(c => c.key === 'wdf_base_rate_per_pound');
        if (wdfConfig && wdfConfig.currentValue) {
          const wdfRateDisplay = document.getElementById('wdfRateDisplay');
          if (wdfRateDisplay) {
            wdfRateDisplay.textContent = `$${wdfConfig.currentValue.toFixed(2)} per pound`;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching WDF rate:', error);
      // Keep the placeholder text if fetch fails
    }

    // Setup date fields
    setupDateFields();

  } catch (error) {
    console.error('Error loading customer data:', error);
    alert('Error loading customer information. Please try logging in again.');
    window.location.href = '/embed-app.html?login=customer&pickup=true';
  }
}

// Function to fetch affiliate delivery fee
async function fetchAffiliateDeliveryFee(affiliateId) {
  console.log('Fetching affiliate delivery fee for:', affiliateId);

  const deliveryFeeField = document.getElementById('deliveryFee');
  if (!deliveryFeeField) {
    console.error('Delivery fee field not found in DOM');
    return;
  }

  if (!affiliateId) {
    deliveryFeeField.textContent = '$5.99';
    return;
  }

  try {
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const response = await fetch(`${baseUrl}/api/v1/affiliates/${affiliateId}/public`);
    console.log('Affiliate API response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('Affiliate data:', data);

      if (data.success && data.affiliate && data.affiliate.deliveryFee) {
        deliveryFeeField.textContent = `$${parseFloat(data.affiliate.deliveryFee).toFixed(2)}`;
      } else {
        deliveryFeeField.textContent = '$5.99';
      }
    } else {
      deliveryFeeField.textContent = '$5.99';
    }
  } catch (error) {
    console.error('Error fetching affiliate fee:', error);
    deliveryFeeField.textContent = '$5.99';
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

  // Get customer data for delivery fee
  const customerStr = localStorage.getItem('currentCustomer');
  const customer = customerStr ? JSON.parse(customerStr) : {};

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

    console.log('Submitting pickup order:', JSON.stringify(pickupData, null, 2));

    try {
      // Submit the order
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      
      // Use CSRF-enabled fetch if available
      let response;
      if (window.CsrfUtils && window.CsrfUtils.csrfFetch) {
        // Ensure CSRF token is available
        await window.CsrfUtils.ensureCsrfToken();
        console.log('Using CSRF-enabled fetch with token:', window.CsrfUtils.getToken());
        
        // Use csrfFetch directly with authorization header
        response = await window.CsrfUtils.csrfFetch(`${baseUrl}/api/v1/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include',
          body: JSON.stringify(pickupData)
        });
      } else {
        // Fallback to regular fetch
        console.warn('CSRF utils not available, using regular fetch');
        response = await fetch(`${baseUrl}/api/v1/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include',
          body: JSON.stringify(pickupData)
        });
      }

      console.log('Order submission response status:', response.status);
      const data = await response.json();
      console.log('Order submission response:', JSON.stringify(data, null, 2));

      if (response.ok && data.success) {
        console.log('Order created successfully:', data.orderId);

        // Store order data for confirmation page
        const orderData = {
          orderId: data.orderId,
          customerId: pickupData.customerId,
          affiliateId: pickupData.affiliateId,
          pickupDate: pickupData.pickupDate,
          pickupTime: pickupData.pickupTime,
          deliveryDate: pickupData.deliveryDate,
          deliveryTime: pickupData.deliveryTime,
          estimatedSize: pickupData.estimatedSize,
          specialPickupInstructions: pickupData.specialPickupInstructions || '',
          specialDeliveryInstructions: pickupData.specialDeliveryInstructions || '',
          serviceNotes: pickupData.serviceNotes || '',
          estimatedTotal: data.estimatedTotal,
          deliveryFee: customer.affiliate?.deliveryFee || 5.99, // Get from customer's affiliate data
          createdAt: new Date().toISOString()
        };

        // Store in localStorage for the confirmation page - use object format expected by order-confirmation.js
        const storedOrders = JSON.parse(localStorage.getItem('wavemax_orders') || '{}');
        storedOrders[data.orderId] = orderData;
        localStorage.setItem('wavemax_orders', JSON.stringify(storedOrders));

        // Redirect to order confirmation page
        window.location.href = '/embed-app.html?route=/order-confirmation&id=' + data.orderId;
      } else {
        console.error('Order submission failed:', data);
        alert(data.message || 'Failed to schedule pickup. Please try again.');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      alert('An error occurred while scheduling your pickup. Please try again.');
    }
  });
}

})(); // End IIFE