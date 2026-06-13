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

    // Handle logout
    function handleLogout() {
        localStorage.removeItem('affiliateToken');
        localStorage.removeItem('currentAffiliate');
        localStorage.removeItem('currentRoute');
        
        // Clear session manager data
        if (window.SessionManager) {
            window.SessionManager.clearAuth('affiliate');
        }
        
        sendMessageToParent('logout', { userType: 'affiliate' });
        navigateParent('affiliate-login');
    }

    // Make functions globally available
    window.sendMessageToParent = sendMessageToParent;
    window.navigateParent = navigateParent;
    window.handleLogout = handleLogout;

    // Override link behaviors for embedded version
    document.addEventListener('DOMContentLoaded', function() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.dataset.tab;
                
                // Update button states
                tabButtons.forEach(btn => {
                    btn.classList.remove('border-blue-600', 'text-blue-600');
                    btn.classList.add('border-transparent');
                });
                this.classList.remove('border-transparent');
                this.classList.add('border-blue-600', 'text-blue-600');
                
                // Show/hide tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${targetTab}-tab`).classList.add('active');
                
                // Notify parent of tab change
                sendMessageToParent('tab-change', { tab: targetTab });
            });
        });

        // Notify parent that iframe is loaded
        sendMessageToParent('iframe-loaded', { page: 'affiliate-dashboard' });
    });

    // Override API calls to use full URLs
    if (window.loadDashboardData) {
        const originalLoadData = window.loadDashboardData;
        window.loadDashboardData = function() {
            // Update API base URL
            window.API_BASE_URL = window.location.origin + '/api/v1';
            originalLoadData();
        };
    }
})();