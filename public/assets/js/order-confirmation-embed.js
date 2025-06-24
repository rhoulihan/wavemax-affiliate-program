// Order Confirmation Page JavaScript for Embedded Version

(function() {
    'use strict';

    // PostMessage communication with parent window
    function sendMessageToParent(type, data) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: type,
                source: 'wavemax-embed',
                data: data
            }, '*');
        }
    }

    // Navigate parent frame
    function navigateParent(page) {
        sendMessageToParent('navigate', { page: page });
    }

    // Get URL parameters
    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // Time slot mapping
    const timeSlotMapping = {
        'morning': 'Morning (8am - 12pm)',
        'afternoon': 'Afternoon (12pm - 5pm)',
        'evening': 'Evening (5pm - 8pm)'
    };

    // Size mapping
    const sizeMapping = {
        'small': 'Small (1-2 bags, approx. 10-15 lbs)',
        'medium': 'Medium (3-4 bags, approx. 16-30 lbs)',
        'large': 'Large (5+ bags, approx. 31+ lbs)'
    };

    // Load order details
    function loadOrderDetails() {
        const orderId = getUrlParameter('id');
        if (!orderId) {
            const container = document.querySelector('.p-6');
            if (container) {
                container.innerHTML = '<p class="text-red-600">No order ID provided</p>';
            }
            return;
        }

        const token = localStorage.getItem('customerToken');
        if (!token) {
            // Try to fetch from API without token for testing
            console.warn('No customer token found, attempting to load order anyway');
        }
        
        fetch(`https://wavemax.promo/api/v1/orders/${orderId}`, {
            headers: token ? {
                'Authorization': `Bearer ${token}`
            } : {},
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            console.log('Order API response:', data);
            if (data.success && data.order) {
                const order = data.order;
                
                // Order Information
                document.getElementById('orderId').textContent = order.orderId;
                document.getElementById('orderDate').textContent = new Date(order.createdAt).toLocaleString();
                document.getElementById('orderStatus').textContent = order.status.replace(/_/g, ' ');
                
                // Pickup Details
                document.getElementById('pickupDate').textContent = new Date(order.pickupDate).toLocaleDateString();
                document.getElementById('pickupTime').textContent = timeSlotMapping[order.pickupTime] || order.pickupTime;
                document.getElementById('pickupInstructions').textContent = order.specialPickupInstructions || 'None provided';
                
                // Service Notes
                document.getElementById('serviceNotes').textContent = order.serviceNotes || 'None provided';
                
                // Order Summary - handle estimatedSize which might come as weight
                let sizeText = 'Not specified';
                if (order.estimatedSize) {
                    sizeText = sizeMapping[order.estimatedSize] || order.estimatedSize;
                } else if (order.estimatedWeight) {
                    // Convert weight to size category
                    if (order.estimatedWeight <= 15) {
                        sizeText = sizeMapping['small'];
                    } else if (order.estimatedWeight <= 30) {
                        sizeText = sizeMapping['medium'];
                    } else {
                        sizeText = sizeMapping['large'];
                    }
                }
                document.getElementById('estimatedSize').textContent = sizeText;
                
                // Display WDF rate
                if (order.baseRate) {
                    document.getElementById('wdfRateDisplay').textContent = `$${order.baseRate.toFixed(2)} per pound`;
                } else {
                    // Fetch and display WDF rate
                    fetch('https://wavemax.promo/api/v1/system/config/public')
                        .then(response => response.json())
                        .then(configs => {
                            const wdfConfig = configs.find(c => c.key === 'wdf_base_rate_per_pound');
                            const wdfRate = wdfConfig ? wdfConfig.currentValue : 1.25;
                            document.getElementById('wdfRateDisplay').textContent = `$${wdfRate.toFixed(2)} per pound`;
                        })
                        .catch(error => {
                            console.error('Error fetching WDF rate:', error);
                            document.getElementById('wdfRateDisplay').textContent = '$1.25 per pound';
                        });
                }
                
                // Display fee breakdown
                if (order.feeBreakdown && order.feeBreakdown.totalFee !== undefined) {
                    const fee = order.feeBreakdown;
                    document.getElementById('deliveryFee').textContent = `$${fee.totalFee.toFixed(2)}`;
                    if (fee.numberOfBags && fee.perBagFee) {
                        const calculatedFee = fee.numberOfBags * fee.perBagFee;
                        const breakdownText = `${fee.numberOfBags} bag${fee.numberOfBags > 1 ? 's' : ''} × $${fee.perBagFee}/bag = $${calculatedFee.toFixed(2)} ${fee.minimumApplied ? `(minimum $${fee.minimumFee} applies)` : ''}`;
                        document.getElementById('feeBreakdown').textContent = breakdownText;
                    }
                } else {
                    // Fallback for old orders
                    document.getElementById('deliveryFee').textContent = `$${(order.deliveryFee || 0).toFixed(2)}`;
                }
                
                // Check for bag credit
                let bagCredit = 0;
                if (order.customer && order.customer.bagCredit > 0 && !order.customer.bagCreditApplied) {
                    bagCredit = order.customer.bagCredit;
                    document.getElementById('bagCreditSection').style.display = 'block';
                    document.getElementById('bagCreditAmount').textContent = `-$${bagCredit.toFixed(2)}`;
                }
                
                // Display the estimated total with bag credit applied
                let displayTotal = 0;
                if (order.estimatedTotal) {
                    displayTotal = Math.max(0, order.estimatedTotal - bagCredit);
                    document.getElementById('estimatedTotal').textContent = `$${displayTotal.toFixed(2)}`;
                } else if (order.actualTotal) {
                    displayTotal = Math.max(0, order.actualTotal - bagCredit);
                    document.getElementById('estimatedTotal').textContent = `$${displayTotal.toFixed(2)}`;
                } else {
                    document.getElementById('estimatedTotal').textContent = 'Calculated after weighing';
                }
                
                // Load affiliate info if available
                if (order.affiliateId) {
                    loadAffiliateInfo(order.affiliateId);
                } else {
                    document.getElementById('affiliateInfo').innerHTML = '<p class="text-gray-500">No affiliate assigned</p>';
                }
                
                // Notify parent of order view
                sendMessageToParent('order-viewed', {
                    orderId: order.orderId,
                    status: order.status
                });
            } else {
                const container = document.querySelector('.p-6');
                if (container) {
                    container.innerHTML = '<p class="text-red-600">Order not found</p>';
                }
            }
        })
        .catch(error => {
            console.error('Error loading order:', error);
            const container = document.querySelector('.p-6');
            if (container) {
                container.innerHTML = '<p class="text-red-600">Error loading order details</p>';
            }
        });
    }

    // Load affiliate information
    function loadAffiliateInfo(affiliateId) {
        fetch(`https://wavemax.promo/api/v1/affiliates/${affiliateId}/public`, {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.affiliate) {
                const affiliate = data.affiliate;
                // Display affiliate name with business name if available
                let affiliateName = `${affiliate.firstName} ${affiliate.lastName}`;
                if (affiliate.businessName) {
                    affiliateName += ` - ${affiliate.businessName}`;
                }
                document.getElementById('affiliateName').textContent = affiliateName;
                
                // Display service area instead of contact since phone is not included in public data
                const serviceInfo = `Service Area: ${affiliate.serviceArea}${affiliate.serviceRadius ? ` (${affiliate.serviceRadius} mile radius)` : ''}`;
                document.getElementById('affiliateContact').textContent = serviceInfo;
            } else {
                document.getElementById('affiliateInfo').innerHTML = '<p class="text-gray-500">Affiliate information not available</p>';
            }
        })
        .catch(error => {
            console.error('Error loading affiliate:', error);
            document.getElementById('affiliateInfo').innerHTML = '<p class="text-gray-500">Error loading affiliate information</p>';
        });
    }

    // Initialize order confirmation
    function initOrderConfirmation() {
        console.log('Initializing order confirmation page');
        
        // Load order details
        loadOrderDetails();
        
        // Setup button click handlers
        const viewOrdersBtn = document.getElementById('viewOrdersBtn');
        if (viewOrdersBtn) {
            viewOrdersBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Navigate using the embed navigation system
                if (window.navigateTo) {
                    window.navigateTo('/customer-dashboard');
                } else {
                    navigateParent('/customer-dashboard');
                }
            });
        }
        
        const scheduleAnotherBtn = document.getElementById('scheduleAnotherBtn');
        if (scheduleAnotherBtn) {
            scheduleAnotherBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Navigate using the embed navigation system
                if (window.navigateTo) {
                    window.navigateTo('/schedule-pickup');
                } else {
                    navigateParent('/schedule-pickup');
                }
            });
        }
        
        // Notify parent that iframe is loaded
        sendMessageToParent('iframe-loaded', { page: 'order-confirmation' });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOrderConfirmation);
    } else {
        // DOM is already loaded
        initOrderConfirmation();
    }

})();