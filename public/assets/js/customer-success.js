document.addEventListener('DOMContentLoaded', function() {
    // Get registration data from sessionStorage
    const registrationData = sessionStorage.getItem('registrationData');
    
    if (!registrationData) {
        // Check URL parameters as fallback (for backward compatibility)
        const urlParams = new URLSearchParams(window.location.search);
        const customerId = urlParams.get('id');
        const bagBarcode = urlParams.get('barcode');
        
        if (!customerId) {
            alert('No registration data found. Please register first.');
            window.location.href = 'index.html';
            return;
        }
        
        // If we have URL params, try to fetch from server (fallback behavior)
        fetch(`/api/customers/${customerId}/profile`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.customer) {
                    const customer = data.customer;
                    displayCustomerData({
                        customerId: customer.customerId,
                        firstName: customer.firstName,
                        lastName: customer.lastName,
                        email: customer.email,
                        affiliateId: customer.affiliateId,
                        affiliateName: customer.affiliate ? customer.affiliate.name : 'WaveMAX Affiliate Partner',
                        deliveryFee: customer.affiliate ? customer.affiliate.deliveryFee : '5.99',
                        bagBarcode: bagBarcode || (customer.bags && customer.bags.length > 0 ? customer.bags[0].barcode : 'Will be assigned upon delivery')
                    });
                } else {
                    console.error('Failed to load customer data:', data.message);
                    alert('Unable to load customer information.');
                    window.location.href = 'index.html';
                }
            })
            .catch(error => {
                console.error('Error fetching customer data:', error);
                alert('An error occurred while loading customer information.');
                window.location.href = 'index.html';
            });
    } else {
        // Use data from sessionStorage
        const data = JSON.parse(registrationData);
        displayCustomerData(data);
        
        // Clear the registration data from sessionStorage
        sessionStorage.removeItem('registrationData');
    }
});

function displayCustomerData(data) {
    // Set customer information
    document.getElementById('customerId').textContent = data.customerId;
    document.getElementById('customerName').textContent = `${data.firstName} ${data.lastName}`;
    document.getElementById('customerEmail').textContent = data.email;
    
    // Set affiliate information
    document.getElementById('affiliateName').textContent = data.affiliateName;
    document.getElementById('serviceArea').textContent = 'Austin, TX area';
    document.getElementById('deliveryFee').textContent = `$${parseFloat(data.deliveryFee).toFixed(2)} per pickup/delivery`;
    
    // Update button links
    document.getElementById('schedulePickupBtn').href = `schedule-pickup.html?affiliate=${data.affiliateId}&customer=${data.customerId}`;
    document.getElementById('customerDashboardBtn').href = `customer-dashboard.html?id=${data.customerId}`;
    
    // Set bag barcode
    if (data.bagBarcode) {
        document.getElementById('bagBarcode').textContent = data.bagBarcode;
    }
}