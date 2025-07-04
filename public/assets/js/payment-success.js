        // Get parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('orderId');
        const transactionId = urlParams.get('transactionId');
        
        // Load order details
        async function loadOrderDetails() {
            if (!orderId) {
                document.getElementById('orderDetails').innerHTML = '<p>No order information available.</p>';
                return;
            }
            
            try {
                const response = await fetch(`/api/v1/orders/${orderId}`, {
                    headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.order) {
                        displayOrderDetails(data.order);
                    }
                }
            } catch (error) {
                console.error('Error loading order details:', error);
                document.getElementById('orderDetails').innerHTML = `
                    <h3>Order Confirmation</h3>
                    <div class="detail-row">
                        <span class="detail-label">Order ID:</span>
                        <span class="detail-value">${orderId}</span>
                    </div>
                    ${transactionId ? `
                    <div class="detail-row">
                        <span class="detail-label">Transaction ID:</span>
                        <span class="detail-value">${transactionId}</span>
                    </div>
                    ` : ''}
                `;
            }
        }
        
        function displayOrderDetails(order) {
            const detailsHtml = `
                <h3>Order Confirmation</h3>
                <div class="detail-row">
                    <span class="detail-label">Order Number:</span>
                    <span class="detail-value">#${order.orderId}</span>
                </div>
                ${transactionId ? `
                <div class="detail-row">
                    <span class="detail-label">Transaction ID:</span>
                    <span class="detail-value">${transactionId}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">Customer:</span>
                    <span class="detail-value">${order.customer?.name || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Pickup Date:</span>
                    <span class="detail-value">${formatDate(order.pickupDate)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Delivery Date:</span>
                    <span class="detail-value">${formatDate(order.deliveryDate)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Paid:</span>
                    <span class="detail-value">$${(order.estimatedTotal || 0).toFixed(2)}</span>
                </div>
            `;
            
            document.getElementById('orderDetails').innerHTML = detailsHtml;
        }
        
        function formatDate(dateString) {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        
        // Set up button links
        document.getElementById('viewOrderBtn').href = `/order-details?orderId=${orderId}`;
        document.getElementById('dashboardBtn').href = '/customer-dashboard';
        
        // Load details on page load
        document.addEventListener('DOMContentLoaded', function() {
            loadOrderDetails();
            
            // Notify parent window if embedded
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'paymentSuccess',
                    orderId: orderId,
                    transactionId: transactionId
                }, '*');
            }
        });
