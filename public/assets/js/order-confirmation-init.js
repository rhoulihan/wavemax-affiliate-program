(function() {
    'use strict';
    
    console.log('[Order Confirmation] Script loaded');

    // Initialize page when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[Order Confirmation] DOM loaded, initializing');
            initializeOrderConfirmation();
        });
    } else {
        // DOM already loaded
        console.log('[Order Confirmation] DOM already loaded, initializing immediately');
        initializeOrderConfirmation();
    }

    function initializeOrderConfirmation() {
        console.log('[Order Confirmation] Initializing order confirmation page');
        // Get order ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('orderId');

        if (!orderId) {
            console.error('No order ID provided');
            // Redirect to dashboard
            if (window.parent && window.parent.navigateTo) {
                window.parent.navigateTo('/customer-dashboard');
            } else if (window.navigateTo) {
                window.navigateTo('/customer-dashboard');
            } else {
                window.location.href = '/embed-app-v2.html?route=/customer-dashboard';
            }
            return;
        }

        // Load order details
        loadOrderDetails(orderId);

        // Set up navigation buttons
        const viewOrdersBtn = document.getElementById('viewOrdersBtn');
        const scheduleAnotherBtn = document.getElementById('scheduleAnotherBtn');

        if (viewOrdersBtn) {
            viewOrdersBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('[Order Confirmation] Navigate to dashboard clicked');
                
                // Try different navigation methods
                if (window.parent && window.parent.navigateTo) {
                    // embed-app-v2.html navigation
                    window.parent.navigateTo('/customer-dashboard');
                } else if (window.navigateTo) {
                    // Direct navigation if available
                    window.navigateTo('/customer-dashboard');
                } else {
                    // Fallback to direct navigation
                    window.location.href = '/embed-app-v2.html?route=/customer-dashboard';
                }
            });
        }

        if (scheduleAnotherBtn) {
            scheduleAnotherBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('[Order Confirmation] Schedule another clicked');
                
                // Try different navigation methods
                if (window.parent && window.parent.navigateTo) {
                    // embed-app-v2.html navigation
                    window.parent.navigateTo('/schedule-pickup');
                } else if (window.navigateTo) {
                    // Direct navigation if available
                    window.navigateTo('/schedule-pickup');
                } else {
                    // Fallback to direct navigation
                    window.location.href = '/embed-app-v2.html?route=/schedule-pickup';
                }
            });
        }
    }

    async function loadOrderDetails(orderId) {
        try {
            console.log('Fetching order details for:', orderId);
            
            // Get auth token
            const token = localStorage.getItem('customerToken');
            if (!token) {
                console.error('No auth token found');
                if (window.parent && window.parent.navigateTo) {
                    window.parent.navigateTo('/customer-login');
                } else if (window.navigateTo) {
                    window.navigateTo('/customer-login');
                } else {
                    window.location.href = '/embed-app-v2.html?route=/customer-login';
                }
                return;
            }
            
            // Fetch order details from API
            const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';
            const response = await fetch(`${baseUrl}/api/orders/${orderId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch order: ${response.status}`);
            }
            
            const data = await response.json();
            if (!data.success || !data.order) {
                throw new Error('Invalid order data received');
            }
            
            const orderData = data.order;
            console.log('Loading order data:', orderData);
            console.log('Order data keys:', Object.keys(orderData));
            console.log('Delivery fee:', orderData.deliveryFee);
            console.log('Delivery fee breakdown:', orderData.deliveryFeeBreakdown);
            console.log('Bag credit applied:', orderData.bagCreditApplied);
            
            // Check for delivery fee in different locations
            console.log('Estimated total:', orderData.estimatedTotal);
            console.log('Number of bags:', orderData.numberOfBags);
            console.log('Estimated weight:', orderData.estimatedWeight);
            
            // Order info
            document.getElementById('orderId').textContent = orderData.orderId;
            document.getElementById('orderDate').textContent = new Date(orderData.createdAt).toLocaleDateString();
            
            // Order status
            const statusElement = document.getElementById('orderStatus');
            if (statusElement) {
                statusElement.textContent = orderData.status || 'Scheduled';
                // Update status badge color based on status
                statusElement.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ';
                switch(orderData.status) {
                    case 'completed':
                        statusElement.className += 'bg-green-100 text-green-800';
                        break;
                    case 'in_progress':
                        statusElement.className += 'bg-yellow-100 text-yellow-800';
                        break;
                    default:
                        statusElement.className += 'bg-blue-100 text-blue-800';
                }
            }
            
            // Pickup details
            const pickupDate = new Date(orderData.pickupDate);
            document.getElementById('pickupDate').textContent = pickupDate.toLocaleDateString();
            document.getElementById('pickupTime').textContent = orderData.pickupTime;
            
            // Special instructions
            if (orderData.specialPickupInstructions) {
                document.getElementById('pickupInstructions').textContent = orderData.specialPickupInstructions;
            }
            
            // Service notes
            if (orderData.serviceNotes) {
                document.getElementById('serviceNotes').textContent = orderData.serviceNotes;
            }
            
            // Affiliate info
            if (orderData.affiliate) {
                document.getElementById('affiliateName').textContent = orderData.affiliate.businessName || 
                    `${orderData.affiliate.firstName} ${orderData.affiliate.lastName}`;
                document.getElementById('affiliateContact').textContent = orderData.affiliate.phone || 
                    orderData.affiliate.email || 'Contact info not available';
            }
            
            // Order summary
            document.getElementById('estimatedSize').textContent = `${orderData.estimatedWeight || 0} lbs`;
            
            // WDF rate
            const wdfRate = orderData.wdfRate || 1.25;
            document.getElementById('wdfRateDisplay').textContent = `$${wdfRate.toFixed(2)}/lb`;
            
            // Calculate delivery fee if not provided
            let deliveryFee = orderData.deliveryFee;
            let feeBreakdownText = '';
            
            if (deliveryFee === undefined && orderData.affiliate) {
                // Calculate based on affiliate settings
                const minimumFee = orderData.affiliate.minimumDeliveryFee || 25;
                const perBagFee = orderData.affiliate.perBagDeliveryFee || 10;
                const numberOfBags = orderData.numberOfBags || 1;
                
                const calculatedFee = numberOfBags * perBagFee;
                deliveryFee = Math.max(calculatedFee, minimumFee);
                
                if (deliveryFee === minimumFee && calculatedFee < minimumFee) {
                    feeBreakdownText = `Minimum fee: $${minimumFee.toFixed(2)}`;
                } else {
                    feeBreakdownText = `${numberOfBags} bags × $${perBagFee.toFixed(2)}/bag`;
                }
                
                console.log('Calculated delivery fee:', deliveryFee, 'Breakdown:', feeBreakdownText);
            }
            
            // Display delivery fee
            deliveryFee = deliveryFee || 0;
            document.getElementById('deliveryFee').textContent = `$${deliveryFee.toFixed(2)}`;
            
            // Display fee breakdown
            const feeBreakdownEl = document.getElementById('feeBreakdown');
            if (feeBreakdownEl && feeBreakdownText) {
                feeBreakdownEl.textContent = feeBreakdownText;
            }
            
            // Estimated total
            const estimatedTotal = orderData.estimatedTotal || 0;
            document.getElementById('estimatedTotal').textContent = `$${estimatedTotal.toFixed(2)}`;
            
            // Check for bag credit - might be in customer data
            let bagCreditAmount = orderData.bagCreditApplied;
            
            // If not in order, check if customer has bag credit and this is their first order
            if (bagCreditAmount === undefined && orderData.customer) {
                console.log('Customer bag credit:', orderData.customer.bagCredit);
                console.log('Is first order:', orderData.isFirstOrder);
                
                // Show bag credit if customer has it and it's applicable to this order
                if (orderData.customer.bagCredit > 0) {
                    bagCreditAmount = orderData.customer.bagCredit;
                }
            }
            
            // Show bag credit if applied
            if (bagCreditAmount && bagCreditAmount > 0) {
                const bagCreditSection = document.getElementById('bagCreditSection');
                if (bagCreditSection) {
                    bagCreditSection.classList.remove('hidden-section');
                    document.getElementById('bagCreditAmount').textContent = `-$${bagCreditAmount.toFixed(2)}`;
                    
                    // Calculate bag credit weight if WDF rate is available
                    if (wdfRate > 0) {
                        const bagCreditWeight = bagCreditAmount / wdfRate;
                        const bagCreditWeightEl = document.getElementById('bagCreditWeight');
                        if (bagCreditWeightEl) {
                            bagCreditWeightEl.textContent = bagCreditWeight.toFixed(0);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading order details:', error);
            
            // Show error message to user
            const orderInfoSection = document.querySelector('.bg-green-50');
            if (orderInfoSection) {
                orderInfoSection.className = 'bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6';
                orderInfoSection.innerHTML = `
                    <h3 class="font-bold text-lg">Error Loading Order</h3>
                    <p>We couldn't load your order details. Please try refreshing the page or contact support.</p>
                `;
            }
        }
    }

    function isFirstOrder() {
        // Check if this is the customer's first order
        // This would normally come from the API
        return true;
    }
})();