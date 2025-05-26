// Affiliate success page functionality for embedded environment
function initializeAffiliateSuccess() {
    const isEmbedded = window.EMBED_CONFIG?.isEmbedded || false;
    const baseUrl = window.EMBED_CONFIG?.baseUrl || 'https://wavemax.promo';

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
    window.navigateParent = function(page) {
        if (isEmbedded) {
            // For embed-app, use the navigate message
            window.parent.postMessage({
                type: 'navigate',
                data: { url: `/${page}` }
            }, '*');
        } else {
            sendMessageToParent('navigate', { page: page });
        }
    }

    // Copy link functionality
    window.copyLink = function() {
        const linkInput = document.getElementById('registrationLink');
        linkInput.select();
        linkInput.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            const btn = document.getElementById('copyLinkBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.classList.add('bg-green-600');
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('bg-green-600');
            }, 2000);
            
            sendMessageToParent('link-copied', { link: linkInput.value });
        } catch (err) {
            console.error('Failed to copy link:', err);
            alert('Failed to copy link. Please copy it manually.');
        }
    }

    // Load affiliate information
    function loadAffiliateInfo() {
        // Try to get affiliate info from localStorage
        const affiliate = localStorage.getItem('currentAffiliate');
        
        if (affiliate) {
            try {
                const affiliateData = JSON.parse(affiliate);
                
                // Display affiliate information
                document.getElementById('affiliateId').textContent = affiliateData.affiliateId;
                document.getElementById('affiliateName').textContent = 
                    `${affiliateData.firstName} ${affiliateData.lastName}`;
                document.getElementById('affiliateEmail').textContent = affiliateData.email;
                
                // Generate registration link
                const registrationLink = `${baseUrl}/customer-register.html?affid=${affiliateData.affiliateId}`;
                document.getElementById('registrationLink').value = registrationLink;
                
                // Update dashboard link
                const dashboardLink = document.getElementById('dashboardLink');
                if (dashboardLink) {
                    dashboardLink.onclick = function(e) {
                        e.preventDefault();
                        window.navigateParent('affiliate-dashboard');
                        return false;
                    };
                }
                
                // Notify parent of successful registration
                sendMessageToParent('registration-complete', {
                    affiliateId: affiliateData.affiliateId,
                    registrationLink: registrationLink
                });
            } catch (e) {
                console.error('Error parsing affiliate data:', e);
                // Show fallback content
                showFallbackContent();
            }
        } else {
            // Show fallback content if no affiliate data
            showFallbackContent();
        }
        
        // Notify parent that iframe is loaded
        sendMessageToParent('iframe-loaded', { page: 'affiliate-success' });
    }

    function showFallbackContent() {
        document.getElementById('affiliateId').textContent = 'Your unique ID will be provided shortly';
        document.getElementById('affiliateName').textContent = 'Your information is being processed';
        document.getElementById('affiliateEmail').textContent = 'Check your email for confirmation';
        document.getElementById('registrationLink').value = 
            'Your unique registration link will be available after confirmation';
    }

    // Initialize when DOM is ready or immediately if already ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAffiliateInfo);
    } else {
        loadAffiliateInfo();
    }
}

// Initialize immediately
initializeAffiliateSuccess();