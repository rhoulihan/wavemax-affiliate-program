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
        
        // Check if this is an OAuth account and hide change password section if so
        // This check will also happen in loadAffiliateData, but we do it here for immediate effect
        const currentAffiliate = localStorage.getItem('currentAffiliate');
        if (currentAffiliate) {
            try {
                const affiliateData = JSON.parse(currentAffiliate);
                console.log('Initial OAuth check - registrationMethod:', affiliateData.registrationMethod);
                if (affiliateData.registrationMethod && affiliateData.registrationMethod !== 'traditional') {
                    // This is an OAuth account, hide the change password section
                    const changePasswordSection = document.getElementById('changePasswordSection');
                    if (changePasswordSection) {
                        changePasswordSection.style.display = 'none';
                        console.log('Hiding change password section for OAuth account:', affiliateData.registrationMethod);
                    }
                }
            } catch (error) {
                console.error('Error parsing affiliate data:', error);
            }
        }
        
        // Also add a global function to check OAuth status that can be called anytime
        window.checkOAuthStatus = function() {
            const storedData = localStorage.getItem('currentAffiliate');
            if (storedData) {
                try {
                    const affiliate = JSON.parse(storedData);
                    console.log('OAuth Status Check:', {
                        hasRegistrationMethod: !!affiliate.registrationMethod,
                        registrationMethod: affiliate.registrationMethod,
                        isOAuth: affiliate.registrationMethod && affiliate.registrationMethod !== 'traditional'
                    });
                    return affiliate.registrationMethod && affiliate.registrationMethod !== 'traditional';
                } catch (e) {
                    console.error('Error checking OAuth status:', e);
                }
            }
            return false;
        };
    });

    // Override API calls to use full URLs
    if (window.loadDashboardData) {
        const originalLoadData = window.loadDashboardData;
        window.loadDashboardData = function() {
            // Update API base URL
            window.API_BASE_URL = 'https://wavemax.promo/api/v1';
            originalLoadData();
        };
    }
})();