document.addEventListener('DOMContentLoaded', function() {
    // Extract parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const affiliateId = urlParams.get('affiliate');
    const customerId = urlParams.get('customer');
    
    // If customer ID is provided, try to auto-login
    if (customerId) {
        // This would typically require a session token
        // For now, show a message
        const loginSection = document.getElementById('loginSection');
        const message = document.createElement('div');
        message.className = 'bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4';
        message.textContent = 'Please login to continue with your pickup scheduling.';
        loginSection.insertBefore(message, loginSection.firstChild);
    }
    
    // Login form handling
    const loginBtn = document.getElementById('loginBtn');
    const loginSection = document.getElementById('loginSection');
    const pickupDetailsSection = document.getElementById('pickupDetailsSection');
    
    loginBtn.addEventListener('click', async function() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            alert('Please enter both username and password.');
            return;
        }
        
        try {
            // Login using the actual API
            const loginResponse = await fetch('/api/auth/customer/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const loginData = await loginResponse.json();
            
            if (loginData.success) {
                const customer = loginData.customer;
                const token = loginData.token;
                
                // Store token for future API calls
                localStorage.setItem('customerToken', token);
                
                // Set customer data fields
                document.getElementById('customerId').value = customer.customerId;
                document.getElementById('customerName').textContent = `${customer.firstName} ${customer.lastName}`;
                document.getElementById('customerPhone').textContent = customer.email; // Using email instead of phone if phone not available
                document.getElementById('customerAddress').textContent = 'Address will be loaded from profile';
                
                // Set affiliate ID
                document.getElementById('affiliateId').value = customer.affiliateId || affiliateId;
                
                // Display affiliate delivery fee from login response if available
                if (customer.affiliate && customer.affiliate.deliveryFee) {
                    document.getElementById('deliveryFee').textContent = `$${parseFloat(customer.affiliate.deliveryFee).toFixed(2)}`;
                    console.log('Set delivery fee from login response:', customer.affiliate.deliveryFee);
                } else {
                    console.log('No affiliate delivery fee in login response, will try from profile API');
                }
                
                // Fetch full customer profile to get address and affiliate details
                const profileResponse = await fetch(`/api/customers/${customer.customerId}/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const profileData = await profileResponse.json();
                
                if (profileData.success && profileData.customer) {
                    const fullCustomer = profileData.customer;
                    
                    // Update customer information with full details
                    document.getElementById('customerPhone').textContent = fullCustomer.phone;
                    document.getElementById('customerAddress').textContent = `${fullCustomer.address}, ${fullCustomer.city}, ${fullCustomer.state} ${fullCustomer.zipCode}`;
                    
                    // Display affiliate delivery fee
                    if (fullCustomer.affiliate && fullCustomer.affiliate.deliveryFee) {
                        document.getElementById('deliveryFee').textContent = `$${parseFloat(fullCustomer.affiliate.deliveryFee).toFixed(2)}`;
                        console.log('Set delivery fee from profile response:', fullCustomer.affiliate.deliveryFee);
                    } else {
                        console.log('No affiliate delivery fee in profile response, trying to fetch affiliate directly');
                        // Try to fetch affiliate data directly
                        const affiliateResponse = await fetch(`/api/affiliates/${customer.affiliateId || affiliateId}/public`);
                        if (affiliateResponse.ok) {
                            const affiliateData = await affiliateResponse.json();
                            if (affiliateData.success && affiliateData.affiliate && affiliateData.affiliate.deliveryFee) {
                                document.getElementById('deliveryFee').textContent = `$${parseFloat(affiliateData.affiliate.deliveryFee).toFixed(2)}`;
                                console.log('Set delivery fee from direct affiliate API:', affiliateData.affiliate.deliveryFee);
                            } else {
                                // Final fallback price
                                document.getElementById('deliveryFee').textContent = '$5.99';
                                console.log('Using fallback delivery fee: $5.99');
                            }
                        } else {
                            // Final fallback price
                            document.getElementById('deliveryFee').textContent = '$5.99';
                            console.log('Using fallback delivery fee: $5.99');
                        }
                    }
                } else {
                    console.log('Failed to get customer profile, trying to fetch affiliate directly');
                    // Try to fetch affiliate data directly as fallback
                    const affiliateResponse = await fetch(`/api/affiliates/${customer.affiliateId || affiliateId}/public`);
                    if (affiliateResponse.ok) {
                        const affiliateData = await affiliateResponse.json();
                        if (affiliateData.success && affiliateData.affiliate && affiliateData.affiliate.deliveryFee) {
                            document.getElementById('deliveryFee').textContent = `$${parseFloat(affiliateData.affiliate.deliveryFee).toFixed(2)}`;
                            console.log('Set delivery fee from direct affiliate API (profile fallback):', affiliateData.affiliate.deliveryFee);
                        } else {
                            // Final fallback price
                            document.getElementById('deliveryFee').textContent = '$5.99';
                            console.log('Using fallback delivery fee: $5.99');
                        }
                    } else {
                        // Final fallback price
                        document.getElementById('deliveryFee').textContent = '$5.99';
                        console.log('Using fallback delivery fee: $5.99');
                    }
                }
                
                // Show pickup details form
                loginSection.style.display = 'none';
                pickupDetailsSection.style.display = 'block';
                
                // Add required attributes to the form fields now that they're visible
                document.getElementById('pickupDate').setAttribute('required', 'required');
                document.getElementById('pickupTime').setAttribute('required', 'required');
                document.getElementById('estimatedSize').setAttribute('required', 'required');
                document.getElementById('deliveryDate').setAttribute('required', 'required');
                document.getElementById('deliveryTime').setAttribute('required', 'required');
                
                // Set minimum dates
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
                
                pickupDateInput.min = formatDate(today);
                deliveryDateInput.min = formatDate(tomorrow);
                
                // Set default pickup date to today
                pickupDateInput.value = formatDate(today);
                
                // Set default delivery date to day after tomorrow
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
            } else {
                alert(loginData.message || 'Invalid username or password. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('An error occurred during login. Please try again.');
        }
    });
    
    // Form submission
    const form = document.getElementById('pickupScheduleForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Only process if the pickup details section is visible
        if (pickupDetailsSection.style.display === 'none') {
            return;
        }
        
        // Collect form data
        const formData = new FormData(form);
        const pickupData = {};
        
        formData.forEach((value, key) => {
            if (key !== 'loginUsername' && key !== 'loginPassword' && key !== '_csrf') {
                pickupData[key] = value;
            }
        });
        
        console.log('Pickup data being sent:', pickupData);
        
        try {
            // Get the stored token
            const token = localStorage.getItem('customerToken');
            
            if (!token) {
                alert('Session expired. Please login again.');
                location.reload();
                return;
            }
            
            console.log('Sending order request with token:', token.substring(0, 20) + '...');
            
            // Submit order to the server
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(pickupData)
            });
            
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                // Get delivery fee from the page
                const deliveryFeeText = document.getElementById('deliveryFee').textContent;
                const deliveryFee = parseFloat(deliveryFeeText.replace('$', '')) || 5.99;
                
                // Store order data temporarily for confirmation page
                const orderData = {
                    orderId: data.orderId,
                    estimatedTotal: data.estimatedTotal,
                    deliveryFee: deliveryFee,
                    ...pickupData,
                    createdAt: new Date().toISOString()
                };
                
                // Store order in localStorage
                const storedOrders = JSON.parse(localStorage.getItem('wavemax_orders')) || {};
                storedOrders[data.orderId] = orderData;
                localStorage.setItem('wavemax_orders', JSON.stringify(storedOrders));
                
                // Clear the stored token
                localStorage.removeItem('customerToken');
                
                // Redirect directly to order confirmation page
                window.location.href = 'order-confirmation.html?id=' + data.orderId;
            } else {
                alert(data.message || 'Failed to schedule pickup. Please try again.');
            }
        } catch (error) {
            console.error('Order submission error:', error);
            alert('An error occurred while scheduling your pickup. Please try again.');
        }
    });
});