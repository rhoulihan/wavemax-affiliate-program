// Schedule Pickup Page - Requires Authentication
(function() {
  'use strict';
  
  console.log('Schedule pickup script loaded');

  // Load CSRF utilities
  if (!window.CsrfUtils) {
    console.error('CSRF utilities not loaded. Please include csrf-utils.js before this script.');
  }

  // State variables for pricing
  let wdfRate = 1.25; // Default rate
  let deliveryFeeAmount = 0;
  let deliveryFeeBreakdown = null; // Store fee calculation details
  let systemFeeConfig = {
    minimumFee: 10.00,
    perBagFee: 2.00
  };

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
    
    // Fetch system config for delivery fees
    await fetchSystemFeeConfig();

    // Setup form submission handler
    setupFormSubmission(token);

    // Initialize payment fields and dynamic calculation
    initializePaymentFields();
    setupDynamicCalculation();

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

// Function to fetch system fee configuration
async function fetchSystemFeeConfig() {
  try {
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
    const response = await fetch(`${baseUrl}/api/v1/system/config/public`);
    
    if (response.ok) {
      const configs = await response.json();
      
      // Find delivery fee configs
      configs.forEach(config => {
        if (config.key === 'delivery_minimum_fee') {
          systemFeeConfig.minimumFee = config.currentValue || config.value;
          console.log('System minimum delivery fee:', systemFeeConfig.minimumFee);
        } else if (config.key === 'delivery_per_bag_fee') {
          systemFeeConfig.perBagFee = config.currentValue || config.value;
          console.log('System per-bag delivery fee:', systemFeeConfig.perBagFee);
        } else if (config.key === 'wdf_base_rate_per_pound') {
          wdfRate = config.currentValue || config.value;
          // Update WDF rate display
          const wdfRateElement = document.getElementById('wdfRate');
          if (wdfRateElement) {
            wdfRateElement.textContent = `$${wdfRate.toFixed(2)}`;
          }
        }
      });
    }
  } catch (error) {
    console.error('Error fetching system config:', error);
    // Use defaults if fetch fails
  }
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

    // Check if we already have affiliate data with fee structure from login
    if (customer.affiliate) {
      console.log('Using affiliate fee data from login:', customer.affiliate);
      const deliveryFeeField = document.getElementById('deliveryFee');
      if (deliveryFeeField) {
        // Calculate fee based on number of bags
        const bagsInput = document.querySelector('input[name="estimatedSize"]:checked');
        const numberOfBags = bagsInput ? parseInt(bagsInput.dataset.bags || 1) : 1;
        
        if (customer.affiliate.minimumDeliveryFee !== undefined && customer.affiliate.perBagDeliveryFee !== undefined) {
          const minFee = parseFloat(customer.affiliate.minimumDeliveryFee);
          const perBagFee = parseFloat(customer.affiliate.perBagDeliveryFee);
          const calculatedFee = numberOfBags * perBagFee;
          deliveryFeeAmount = Math.max(minFee, calculatedFee);
          deliveryFeeBreakdown = {
            numberOfBags,
            perBagFee,
            calculatedFee,
            minimumFee: minFee,
            appliedFee: deliveryFeeAmount
          };
          
          deliveryFeeField.textContent = `$${deliveryFeeAmount.toFixed(2)}`;
          console.log('Calculated delivery fee:', deliveryFeeBreakdown);
        } else {
          // Fallback for missing fee structure
          deliveryFeeAmount = 25.00;
          deliveryFeeField.textContent = `$${deliveryFeeAmount.toFixed(2)}`;
        }
        calculateEstimate(); // Recalculate with delivery fee
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
          if (fullCustomer.affiliate && fullCustomer.affiliate.minimumDeliveryFee !== undefined) {
            console.log('Setting delivery fee from customer profile:', fullCustomer.affiliate);
            // Calculate fee based on number of bags
            const bagsInput = document.querySelector('input[name="estimatedSize"]:checked');
            const numberOfBags = bagsInput ? parseInt(bagsInput.dataset.bags || 1) : 1;
            
            const minFee = parseFloat(fullCustomer.affiliate.minimumDeliveryFee);
            const perBagFee = parseFloat(fullCustomer.affiliate.perBagDeliveryFee);
            const calculatedFee = numberOfBags * perBagFee;
            deliveryFeeAmount = Math.max(minFee, calculatedFee);
            deliveryFeeBreakdown = {
              numberOfBags,
              perBagFee,
              calculatedFee,
              minimumFee: minFee,
              appliedFee: deliveryFeeAmount
            };
            
            deliveryFeeField.textContent = `$${deliveryFeeAmount.toFixed(2)}`;
            calculateEstimate(); // Recalculate with delivery fee
          } else {
            console.log('No affiliate fee structure in customer profile, fetching directly');
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
          wdfRate = wdfConfig.currentValue; // Update global rate
          const wdfRateDisplay = document.getElementById('wdfRateDisplay');
          if (wdfRateDisplay) {
            wdfRateDisplay.textContent = `$${wdfConfig.currentValue.toFixed(2)} per pound`;
          }
          const wdfRateElement = document.getElementById('wdfRate');
          if (wdfRateElement) {
            wdfRateElement.textContent = `$${wdfConfig.currentValue.toFixed(2)}`;
          }
          calculateEstimate(); // Recalculate with new rate
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

      if (data.success && data.affiliate) {
        // Calculate fee based on number of bags
        const bagsInput = document.querySelector('input[name="estimatedSize"]:checked');
        const numberOfBags = bagsInput ? parseInt(bagsInput.dataset.bags || 1) : 1;
        
        if (data.affiliate.minimumDeliveryFee !== undefined && data.affiliate.perBagDeliveryFee !== undefined) {
          const minFee = parseFloat(data.affiliate.minimumDeliveryFee);
          const perBagFee = parseFloat(data.affiliate.perBagDeliveryFee);
          const calculatedFee = numberOfBags * perBagFee;
          deliveryFeeAmount = Math.max(minFee, calculatedFee);
          deliveryFeeBreakdown = {
            numberOfBags,
            perBagFee,
            calculatedFee,
            minimumFee: minFee,
            appliedFee: deliveryFeeAmount
          };
          
          deliveryFeeField.textContent = `$${deliveryFeeAmount.toFixed(2)}`;
          console.log('Calculated delivery fee from affiliate:', deliveryFeeBreakdown);
        } else {
          // Fallback for missing fee structure
          deliveryFeeAmount = 25.00;
          deliveryFeeField.textContent = '$25.00';
        }
      } else {
        deliveryFeeAmount = 25.00;
        deliveryFeeField.textContent = '$25.00';
      }
      calculateEstimate(); // Recalculate with delivery fee
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

    // Add payment data (remove spaces from card number)
    pickupData.cardNumber = pickupData.cardNumber?.replace(/\s/g, '');
    
    // Add calculated amounts
    pickupData.estimatedTotal = parseFloat(document.getElementById('estimatedTotal')?.textContent.replace('$', '') || '0');
    pickupData.authorizationAmount = parseFloat(document.getElementById('authorizationAmount')?.textContent.replace('$', '') || '0');

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
          deliveryFee: deliveryFeeAmount || 25.00, // Use calculated delivery fee
          deliveryFeeBreakdown: deliveryFeeBreakdown, // Include fee breakdown
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

// Initialize payment field formatting
function initializePaymentFields() {
  const cardNumberInput = document.getElementById('cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 16) value = value.slice(0, 16);
      
      // Format with spaces
      const parts = [];
      for (let i = 0; i < value.length; i += 4) {
        parts.push(value.slice(i, i + 4));
      }
      e.target.value = parts.join(' ');
    });
  }

  const expiryInput = document.getElementById('expiryDate');
  if (expiryInput) {
    expiryInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 4) value = value.slice(0, 4);
      
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
      }
      e.target.value = value;
    });
  }

  const cvvInput = document.getElementById('cvv');
  if (cvvInput) {
    cvvInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 4) value = value.slice(0, 4);
      e.target.value = value;
    });
  }

  const billingZipInput = document.getElementById('billingZip');
  if (billingZipInput) {
    billingZipInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 5) value = value.slice(0, 5);
      e.target.value = value;
    });
  }
}

// Setup dynamic calculation for authorization amount
// Function to calculate delivery fee based on bags
function calculateDeliveryFee(numberOfBags, affiliate = null) {
  // Use affiliate overrides if available
  const minimumFee = affiliate?.minimumDeliveryFee ?? systemFeeConfig.minimumFee;
  const perBagFee = affiliate?.perBagDeliveryFee ?? systemFeeConfig.perBagFee;
  
  // Calculate fees
  const calculatedFee = numberOfBags * perBagFee;
  const oneWayFee = Math.max(minimumFee, calculatedFee);
  const roundTripFee = oneWayFee * 2;
  
  return {
    numberOfBags,
    minimumFee,
    perBagFee,
    calculatedFee,
    oneWayFee,
    roundTripFee,
    minimumApplied: oneWayFee === minimumFee
  };
}

// Function to update delivery fee display
function updateDeliveryFeeDisplay() {
  const numberOfBagsSelect = document.getElementById('numberOfBags');
  const deliveryFeeElement = document.getElementById('deliveryFee');
  const deliveryFeeBreakdownElement = document.getElementById('deliveryFeeBreakdown');
  
  if (!numberOfBagsSelect || !deliveryFeeElement) return;
  
  const numberOfBags = parseInt(numberOfBagsSelect.value) || 1;
  
  // Get current customer's affiliate info if available
  const customerStr = localStorage.getItem('currentCustomer');
  const customer = customerStr ? JSON.parse(customerStr) : {};
  const affiliate = customer.affiliate || null;
  
  // Calculate fee
  deliveryFeeBreakdown = calculateDeliveryFee(numberOfBags, affiliate);
  deliveryFeeAmount = deliveryFeeBreakdown.oneWayFee;
  
  // Update display
  deliveryFeeElement.textContent = `$${deliveryFeeBreakdown.roundTripFee.toFixed(2)}`;
  
  // Show breakdown
  if (deliveryFeeBreakdownElement) {
    if (deliveryFeeBreakdown.minimumApplied) {
      deliveryFeeBreakdownElement.textContent = `(Minimum fee: $${deliveryFeeBreakdown.oneWayFee.toFixed(2)} × 2 trips)`;
    } else {
      deliveryFeeBreakdownElement.textContent = `(${numberOfBags} bags × $${deliveryFeeBreakdown.perBagFee.toFixed(2)}/bag × 2 trips)`;
    }
  }
  
  // Recalculate totals
  calculateEstimate();
}

function setupDynamicCalculation() {
  // Update fee when number of bags changes
  const numberOfBagsSelect = document.getElementById('numberOfBags');
  if (numberOfBagsSelect) {
    numberOfBagsSelect.addEventListener('change', updateDeliveryFeeDisplay);
  }
  
  // Update estimate when weight changes
  const estimatedWeightInput = document.getElementById('estimatedWeight');
  if (estimatedWeightInput) {
    estimatedWeightInput.addEventListener('input', calculateEstimate);
    estimatedWeightInput.addEventListener('change', calculateEstimate);
  }
  
  // Initial calculation
  updateDeliveryFeeDisplay();
}

// Calculate estimate and authorization amount
function calculateEstimate() {
  const weightInput = document.getElementById('estimatedWeight');
  const weight = parseFloat(weightInput?.value) || 0;

  // Update weight display
  const weightDisplay = document.getElementById('estimatedWeightDisplay');
  if (weightDisplay) {
    weightDisplay.textContent = weight;
  }

  // Use the calculated delivery fee breakdown
  if (!deliveryFeeBreakdown) {
    updateDeliveryFeeDisplay();
  }

  // Calculate costs
  const laundryTotal = weight * wdfRate;
  const estimatedTotal = laundryTotal + (deliveryFeeBreakdown ? deliveryFeeBreakdown.roundTripFee : 0);
  const authorizationAmount = estimatedTotal * 1.10; // 10% over estimate

  // Update displays
  const estimatedTotalElement = document.getElementById('estimatedTotal');
  if (estimatedTotalElement) {
    estimatedTotalElement.textContent = `$${estimatedTotal.toFixed(2)}`;
  }

  const authorizationAmountElement = document.getElementById('authorizationAmount');
  if (authorizationAmountElement) {
    authorizationAmountElement.textContent = `$${authorizationAmount.toFixed(2)}`;
  }
}

})(); // End IIFE