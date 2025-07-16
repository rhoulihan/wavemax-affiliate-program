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
  let customerBagCredit = 0; // Store customer's bag credit
  let bagCreditApplied = false; // Track if credit has been applied

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
    // Not logged in, redirect to login page
      console.log('User not authenticated, redirecting to login');
      // Use navigateTo if in iframe, otherwise redirect
      if (window.parent !== window && window.navigateTo) {
        window.navigateTo('/customer-login');
      } else {
        window.location.href = '/embed-app-v2.html?route=/customer-login';
      }
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

      // Navigation script will handle showing the pickup form
      // const pickupDetailsSection = document.getElementById('pickupDetailsSection');
      // if (pickupDetailsSection) {
      //   pickupDetailsSection.style.display = 'block';
      // }

      // If customer doesn't have bagCredit info (coming from registration), fetch full customer data
      if (customer && !customer.hasOwnProperty('bagCredit')) {
        console.log('Customer data missing bagCredit, fetching full customer data...');
        try {
          const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
          const response = await fetch(`${baseUrl}/api/v1/customers/${customer.customerId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.customer) {
              // Update localStorage with full customer data
              customer = data.customer;
              localStorage.setItem('currentCustomer', JSON.stringify(customer));
              console.log('Updated customer data with bagCredit:', customer.bagCredit);
            }
          }
        } catch (error) {
          console.error('Error fetching full customer data:', error);
        }
      }

      // Load customer data into the form
      await loadCustomerIntoForm(customer, token);

      // Check for active orders before allowing scheduling
      const hasActiveOrder = await checkForActiveOrders(token);
      if (hasActiveOrder) {
        // Customer has an active order, don't allow new scheduling
        return;
      }

      // Fetch system config for delivery fees
      await fetchSystemFeeConfig();

      // Setup form submission handler
      setupFormSubmission(token);

      // Initialize payment fields and dynamic calculation
      initializePaymentFields();
      setupDynamicCalculation();

      // Initialize the payment form but keep it hidden
      initializePaymentForm();

    } catch (error) {
      console.error('Error initializing schedule pickup:', error);
      // If there's an error, redirect to login
      if (window.parent !== window && window.navigateTo) {
        window.navigateTo('/customer-login');
      } else {
        window.location.href = '/embed-app-v2.html?route=/customer-login';
      }
    }
  }

  // Function to check for active orders
  async function checkForActiveOrders(token) {
    try {
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      const response = await fetch(`${baseUrl}/api/v1/orders/check-active`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('Failed to check active orders:', response.status);
        return false;
      }

      const data = await response.json();
      
      if (data.hasActiveOrder) {
        console.log('Customer has active order:', data.activeOrder);
        
        // Format the pickup date nicely
        const pickupDate = new Date(data.activeOrder.pickupDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        // Map status to user-friendly text
        const statusMessages = {
          'pending': 'scheduled for pickup',
          'processing': 'currently being processed',
          'processed': 'ready for delivery'
        };
        
        const statusMessage = statusMessages[data.activeOrder.status] || data.activeOrder.status;
        
        // Hide the pickup form and show a message
        const pickupDetailsSection = document.getElementById('pickupDetailsSection');
        if (pickupDetailsSection) {
          pickupDetailsSection.innerHTML = `
            <div class="active-order-notice">
              <div class="notice-icon">
                <svg class="w-16 h-16 text-blue-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-800 mb-4">You Have an Active Order</h2>
              <div class="notice-content">
                <p class="text-lg text-gray-600 mb-4">
                  You already have an order (${data.activeOrder.orderId}) that is ${statusMessage}.
                </p>
                <p class="text-gray-600 mb-6">
                  Please wait for this order to be completed before scheduling a new pickup.
                </p>
                <div class="order-details">
                  <h3 class="font-semibold text-gray-700 mb-2">Order Details:</h3>
                  <ul class="text-gray-600">
                    <li><strong>Order ID:</strong> ${data.activeOrder.orderId}</li>
                    <li><strong>Status:</strong> ${data.activeOrder.status.charAt(0).toUpperCase() + data.activeOrder.status.slice(1)}</li>
                    <li><strong>Pickup Date:</strong> ${pickupDate}</li>
                    <li><strong>Pickup Time:</strong> ${data.activeOrder.pickupTime || 'N/A'}</li>
                  </ul>
                </div>
                <div class="mt-6">
                  <a href="/embed-app-v2.html?route=/customer-dashboard" class="btn btn-primary">
                    View Order Status
                  </a>
                </div>
              </div>
            </div>
            <style>
              .active-order-notice {
                max-width: 600px;
                margin: 40px auto;
                padding: 40px;
                background: #f8f9fa;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              }
              .notice-icon {
                margin-bottom: 20px;
              }
              .notice-content {
                background: white;
                padding: 30px;
                border-radius: 8px;
                margin-top: 20px;
              }
              .order-details {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                text-align: left;
                margin: 20px 0;
              }
              .order-details ul {
                list-style: none;
                padding: 0;
                margin: 0;
              }
              .order-details li {
                padding: 5px 0;
              }
              .btn {
                display: inline-block;
                padding: 12px 24px;
                background: #3b82f6;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 500;
                transition: background 0.2s;
              }
              .btn:hover {
                background: #2563eb;
              }
            </style>
          `;
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking active orders:', error);
      // On error, allow them to continue (fail open)
      return false;
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
              wdfRateElement.textContent = `$${wdfRate.toFixed(2)} per pound`;
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
      
      // Also set the AFFILIATEID hidden field for payment form
      const affiliateIdHidden = document.getElementById('AFFILIATEID');
      if (affiliateIdHidden) {
        affiliateIdHidden.value = customer.affiliateId;
        console.log('Set AFFILIATEID hidden field to:', customer.affiliateId);
      }

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

          // Check for bag credit
          if (fullCustomer.bagCredit && fullCustomer.bagCredit > 0 && !fullCustomer.bagCreditApplied) {
            customerBagCredit = parseFloat(fullCustomer.bagCredit);
            console.log('Customer has bag credit:', customerBagCredit);

            // Display bag credit in order summary
            const bagCreditSection = document.getElementById('bagCreditSection');
            const bagCreditAmount = document.getElementById('bagCreditAmount');
            const bagCreditWeight = document.getElementById('bagCreditWeight');

            if (bagCreditSection && bagCreditAmount && bagCreditWeight) {
            // Calculate equivalent weight for the credit
              const creditWeight = customerBagCredit / wdfRate;

              bagCreditAmount.textContent = `$${customerBagCredit.toFixed(2)}`;
              bagCreditWeight.textContent = creditWeight.toFixed(1);
              bagCreditSection.style.display = 'block';

              // Recalculate totals with credit
              calculateEstimate();
            }
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
              wdfRateElement.textContent = `$${wdfConfig.currentValue.toFixed(2)} per pound`;
            }

            // Update bag credit weight if credit exists
            if (customerBagCredit > 0) {
              const bagCreditWeight = document.getElementById('bagCreditWeight');
              if (bagCreditWeight) {
                const creditWeight = customerBagCredit / wdfRate;
                bagCreditWeight.textContent = creditWeight.toFixed(1);
              }
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
      modalAlert('Error loading customer information. Please try logging in again.', 'Loading Error');
      if (window.parent !== window && window.navigateTo) {
        window.navigateTo('/customer-login');
      } else {
        window.location.href = '/embed-app-v2.html?route=/customer-login';
      }
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
    const pickupDateInput = document.getElementById('pickupDate');

    if (!pickupDateInput) {
      console.error('Pickup date input not found');
      return;
    }

    // Format dates as YYYY-MM-DD for input fields
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Set minimum and default dates for pickup
    pickupDateInput.min = formatDate(today);
    pickupDateInput.value = formatDate(today);
  }

  // Function to setup form submission - NOW HANDLED BY NAVIGATION
  function setupFormSubmission(token) {
  // Form submission is now handled by schedule-pickup-navigation.js
    return;

  /* OLD FORM SUBMISSION CODE - KEPT FOR REFERENCE
  const form = document.getElementById('pickupScheduleForm');
  if (!form) return;

  // Get customer data for delivery fee
  const customerStr = localStorage.getItem('currentCustomer');
  const customer = customerStr ? JSON.parse(customerStr) : {};

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Validate form
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Store form data for later submission
    const formData = new FormData(form);
    const pickupData = {};

    formData.forEach((value, key) => {
      if (key !== '_csrf') {
        // Convert date fields to ISO8601 format
        if (key === 'pickupDate' && value) {
          pickupData[key] = new Date(value + 'T12:00:00').toISOString();
        } else {
          pickupData[key] = value;
        }
      }
    });

    // Store the pickup data for when payment is complete
    window.pendingPickupData = pickupData;

    // Show payment form
    const paymentContainer = document.getElementById('paymentFormContainer');
    if (paymentContainer) {
      paymentContainer.style.display = 'block';
      // Scroll to payment form
      paymentContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // If payment form is available, update delivery fee quantities
      if (window.paymentForm && window.paymentForm.updateDeliveryFeeQuantities) {
        // Update delivery fee quantities based on current breakdown
        if (deliveryFeeBreakdown) {
          window.paymentForm.updateDeliveryFeeQuantities(deliveryFeeBreakdown);
        }
        console.log('Payment form ready for submission');
      }
    }

    // Change the submit button text to indicate waiting for payment
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = 'Complete Payment Below';
      submitButton.disabled = true;
      submitButton.classList.add('opacity-50', 'cursor-not-allowed');
    }

    return; // Don't continue with the original submission logic

    // Add calculated amounts
    pickupData.estimatedTotal = parseFloat(document.getElementById('estimatedTotal')?.textContent.replace('$', '') || '0');

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
          estimatedSize: pickupData.estimatedSize,
          specialPickupInstructions: pickupData.specialPickupInstructions || '',
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
        window.location.href = '/embed-app-v2.html?route=/order-confirmation&id=' + data.orderId;
      } else {
        console.error('Order submission failed:', data);
        modalAlert(data.message || 'Failed to schedule pickup. Please try again.', 'Scheduling Failed');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      modalAlert('An error occurred while scheduling your pickup. Please try again.', 'Scheduling Error');
    }
  });
  */
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
    const totalFee = Math.max(minimumFee, calculatedFee);

    return {
      numberOfBags,
      minimumFee,
      perBagFee,
      calculatedFee,
      totalFee,
      minimumApplied: totalFee === minimumFee
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
    deliveryFeeAmount = deliveryFeeBreakdown.totalFee;

    // Expose globally for navigation script
    window.deliveryFeeBreakdown = deliveryFeeBreakdown;

    // Update display
    deliveryFeeElement.textContent = `$${deliveryFeeBreakdown.totalFee.toFixed(2)}`;

    // Show breakdown
    if (deliveryFeeBreakdownElement) {
      if (deliveryFeeBreakdown.minimumApplied) {
        deliveryFeeBreakdownElement.textContent = '(Minimum fee applied)';
      } else {
        deliveryFeeBreakdownElement.textContent = `(${numberOfBags} bags × $${deliveryFeeBreakdown.perBagFee.toFixed(2)}/bag = $${deliveryFeeBreakdown.calculatedFee.toFixed(2)})`;
      }
    }

    // Update payment form if it's visible
    if (window.paymentForm && window.paymentForm.updateDeliveryFeeQuantities) {
      const paymentContainer = document.getElementById('paymentFormContainer');
      if (paymentContainer && paymentContainer.style.display !== 'none') {
        window.paymentForm.updateDeliveryFeeQuantities(deliveryFeeBreakdown);
      }
    }

    // Recalculate totals
    calculateEstimate();
  }

  function setupDynamicCalculation() {
  // Update fee when number of bags changes
    const numberOfBagsSelect = document.getElementById('numberOfBags');
    if (numberOfBagsSelect) {
      numberOfBagsSelect.addEventListener('change', function() {
        updateDeliveryFeeDisplay();

        // Auto-update estimated weight based on number of bags
        const numberOfBags = parseInt(this.value) || 0;
        if (numberOfBags > 0) {
          const estimatedWeightInput = document.getElementById('estimatedWeight');
          if (estimatedWeightInput) {
            estimatedWeightInput.value = numberOfBags * 25;
            // Trigger input event to update calculations
            estimatedWeightInput.dispatchEvent(new Event('input'));
          }
        }
      });
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
    let estimatedTotal = laundryTotal + (deliveryFeeBreakdown ? deliveryFeeBreakdown.totalFee : 0);

    // Apply bag credit if available
    if (customerBagCredit > 0) {
      estimatedTotal = Math.max(0, estimatedTotal - customerBagCredit);
    }

    // Update displays
    const estimatedTotalElement = document.getElementById('estimatedTotal');
    if (estimatedTotalElement) {
      estimatedTotalElement.textContent = `$${estimatedTotal.toFixed(2)}`;
    }

    // Update payment form quantities
    if (window.paymentForm && window.paymentForm.updateQuantity) {
      console.log('Updating payment form quantities');
      
      // Calculate WDF quantity: estimated weight minus bag credit weight
      let wdfQuantity = weight;
      
      if (customerBagCredit > 0 && wdfRate > 0) {
        const bagCreditWeight = customerBagCredit / wdfRate;
        wdfQuantity = Math.max(0, weight - bagCreditWeight);
      }
      
      console.log('Updating WDF quantity:', wdfQuantity);
      window.paymentForm.updateQuantity('WDF', wdfQuantity);
      
      // Update delivery fee quantities based on the breakdown
      if (deliveryFeeBreakdown) {
        console.log('Updating delivery fees:', deliveryFeeBreakdown);
        
        // Update minimum delivery fee
        if (deliveryFeeBreakdown.minimumFeeApplied && deliveryFeeBreakdown.minimumFee > 0) {
          window.paymentForm.updateQuantity('MDF', 1);
        } else {
          window.paymentForm.updateQuantity('MDF', 0);
        }
        
        // Update per bag fee
        if (deliveryFeeBreakdown.numberOfBags > 0 && deliveryFeeBreakdown.perBagFee > 0) {
          window.paymentForm.updateQuantity('PBF', deliveryFeeBreakdown.numberOfBags);
        } else {
          window.paymentForm.updateQuantity('PBF', 0);
        }
      }
      
      // Update bag credit if applicable
      if (customerBagCredit > 0) {
        const bagCreditWeight = customerBagCredit / wdfRate;
        console.log('Updating bag credit weight:', bagCreditWeight);
        window.paymentForm.updateQuantity('BF', bagCreditWeight);
      } else {
        window.paymentForm.updateQuantity('BF', 0);
      }
    }
  }

  // Submit pickup order after successful payment
  async function submitPickupOrder(paymentDetails) {
    // Prevent duplicate order submissions
    if (window.isSubmittingOrder) {
      console.log('Order submission already in progress, ignoring duplicate call');
      return;
    }
    
    const pickupData = window.pendingPickupData;
    if (!pickupData) {
      console.error('No pending pickup data found');
      return;
    }

    console.log('=== PAYMENT SUCCESS - CREATING ORDER ===');
    console.log('Payment details received:', paymentDetails);
    
    // Set flags to indicate we're processing
    window.isProcessingPayment = true;
    window.isSubmittingOrder = true;

    // If we have payment details with a payment token but no transaction ID,
    // wait a moment and fetch the updated payment status
    if (paymentDetails && !paymentDetails.transactionId && window.paymentForm && window.paymentForm.paymentToken) {
      console.log('Fetching updated payment status for token:', window.paymentForm.paymentToken);
      try {
        const response = await fetch(`/api/v1/payments/check-status/${window.paymentForm.paymentToken}`);
        const data = await response.json();
        if (data.success && data.transactionId) {
          paymentDetails = { ...paymentDetails, transactionId: data.transactionId };
          console.log('Updated payment details with transaction ID:', paymentDetails);
        }
      } catch (error) {
        console.error('Error fetching payment status:', error);
      }
    }

    let spinner = null;
    try {
    // Show spinner
      spinner = window.SwirlSpinnerUtils ?
        window.SwirlSpinnerUtils.showGlobal({
          message: 'Creating your order...',
          submessage: 'Please wait while we process your pickup request'
        }) : null;

      // Add calculated amounts
      pickupData.estimatedTotal = parseFloat(document.getElementById('estimatedTotal')?.textContent.replace('$', '') || '0');

      // Add payment confirmation
      pickupData.paymentConfirmed = true;
      pickupData.paymentToken = paymentDetails.token || paymentDetails.paymentToken;
      pickupData.transactionId = paymentDetails.transactionId;

      // Add bag credit if applicable
      if (customerBagCredit > 0) {
        pickupData.bagCreditApplied = customerBagCredit;
      }

      console.log('Submitting pickup order:', JSON.stringify(pickupData, null, 2));
      // Get auth token
      const token = localStorage.getItem('customerToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Submit the order
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';

      // Use CSRF-enabled fetch if available
      let response;
      if (window.CsrfUtils && window.CsrfUtils.csrfFetch) {
        await window.CsrfUtils.ensureCsrfToken();
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

        // Hide spinner before redirect
        if (spinner) {
          spinner.hide();
        }

        // Order created successfully - the confirmation page will fetch details from API

        // Show success message
        if (window.modalAlert) {
          window.modalAlert('Your pickup has been scheduled successfully!', 'Order Created');
        }

        // Redirect to order confirmation page after a short delay
        setTimeout(() => {
          window.location.href = '/embed-app-v2.html?route=/order-confirmation&orderId=' + data.orderId;
        }, 1500);
      } else {
      // Hide spinner on error
        if (spinner) {
          spinner.hide();
        }

        console.error('Order submission failed:', data);
        // Only show error modal if we're not still processing payment
        if (window.modalAlert && !window.isProcessingPayment) {
          window.modalAlert(data.message || 'Failed to schedule pickup. Please try again.', 'Scheduling Failed');
        }
      }
    } catch (error) {
    // Hide spinner on error
      if (spinner) {
        spinner.hide();
      }

      console.error('Order submission error:', error);
      // Only show error modal if we're not still processing payment
      if (window.modalAlert && !window.isProcessingPayment) {
        window.modalAlert('An error occurred while scheduling your pickup. Please try again.', 'Scheduling Error');
      }
    } finally {
      // Clear the processing flags
      window.isProcessingPayment = false;
      window.isSubmittingOrder = false;
    }
  }

  // Make calculateEstimate globally available
  window.calculateEstimate = calculateEstimate;

  // Initialize payment form
  async function initializePaymentForm() {
    try {
    // Get payment configuration
      const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
      const configResponse = await fetch(`${baseUrl}/api/v1/payments/config`, {
        credentials: 'include'
      });

      if (!configResponse.ok) {
        console.error('Failed to load payment configuration');
        return;
      }

      const configData = await configResponse.json();
      if (!configData.success) {
        console.error('Payment configuration error:', configData.message);
        return;
      }

      const paymentConfig = configData.config;
      
      // Make payment config globally available for navigation script
      window.paymentConfig = paymentConfig;

      // Get affiliate settings from customer data
      const customerStr = localStorage.getItem('currentCustomer');
      const customer = customerStr ? JSON.parse(customerStr) : {};
      const affiliateSettings = customer.affiliate || null;
      
      // Initialize the Paygistix payment form
      console.log('Initializing PaygistixPaymentForm with config:', paymentConfig);
      console.log('Affiliate settings from customer:', affiliateSettings);
      
      const paymentForm = new PaygistixPaymentForm({
        container: document.getElementById('paygistix-payment-container'),
        paymentConfig: paymentConfig,
        hideRegistrationFormRows: false, // Show all form rows for orders
        affiliateSettings: affiliateSettings, // Pass affiliate settings directly
        payContext: 'ORDER',
        onSuccess: function() {
          console.log('Payment form initialized successfully');
          console.log('Payment form object:', window.paymentForm);
          
          // Check if form was rendered
          const formElement = document.getElementById('pxForm');
          console.log('Form element found:', !!formElement);
          if (formElement) {
            console.log('Form inputs:', formElement.querySelectorAll('input').length);
          }
        },
        onError: function(error) {
          console.error('Payment form initialization error:', error);
        },
        onPaymentSuccess: async function(paymentDetails) {
          console.log('=== PAYMENT SUCCESS CALLBACK TRIGGERED ===');
          console.log('Payment successful:', paymentDetails);
          // Now submit the order with payment confirmation
          await submitPickupOrder(paymentDetails);
        },
        onPaymentFailure: function(error) {
          console.error('Payment failed:', error);
          if (window.modalAlert) {
            window.modalAlert(error || 'Payment failed. Please try again.', 'Payment Error');
          }
        }
      });

      // Make payment form globally available
      window.paymentForm = paymentForm;

    } catch (error) {
      console.error('Error initializing payment form:', error);
    }
  }

})(); // End IIFE