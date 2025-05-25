document.addEventListener('DOMContentLoaded', function() {
    // Form submission
    const form = document.getElementById('affiliateLoginForm');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Collect form data
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // In a real implementation, this would be an API call to the server
        console.log('Login request:', { username, password });
        
        // Mock API request
        fetch('/api/auth/affiliate/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => {
            // For demo purposes
            if (!response.ok) {
                throw new Error('Login failed');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Store token in localStorage
                localStorage.setItem('affiliateToken', data.token);
                localStorage.setItem('currentAffiliate', JSON.stringify(data.affiliate));
                
                // Redirect to dashboard
                window.location.href = `affiliate-dashboard.html?id=${data.affiliate.affiliateId}`;
            } else {
                alert(data.message || 'Login failed. Please check your credentials and try again.');
            }
        })
        .catch(error => {
            // For demo purposes, simulate successful login
            console.error('Error:', error);
            alert('Login failed. Please check your credentials and try again.');
        });
    });
});