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
        const btn = document.getElementById('copyLinkBtn');
        
        // Method 1: Try selecting the input directly first
        try {
            linkInput.select();
            linkInput.setSelectionRange(0, 99999);
            
            const successful = document.execCommand('copy');
            
            if (successful) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.classList.add('bg-green-600');
                btn.classList.remove('bg-blue-600');
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('bg-green-600');
                    btn.classList.add('bg-blue-600');
                }, 2000);
                
                sendMessageToParent('link-copied', { link: linkInput.value });
                return;
            }
        } catch (err) {
            console.log('Direct copy failed, trying textarea method');
        }
        
        // Method 2: Fallback to textarea method
        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = linkInput.value;
        tempTextarea.style.position = 'fixed';
        tempTextarea.style.top = '0';
        tempTextarea.style.left = '0';
        tempTextarea.style.width = '2em';
        tempTextarea.style.height = '2em';
        tempTextarea.style.padding = '0';
        tempTextarea.style.border = 'none';
        tempTextarea.style.outline = 'none';
        tempTextarea.style.boxShadow = 'none';
        tempTextarea.style.background = 'transparent';
        
        document.body.appendChild(tempTextarea);
        
        try {
            tempTextarea.focus();
            tempTextarea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(tempTextarea);
            
            if (successful) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.classList.add('bg-green-600');
                btn.classList.remove('bg-blue-600');
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('bg-green-600');
                    btn.classList.add('bg-blue-600');
                }, 2000);
                
                sendMessageToParent('link-copied', { link: linkInput.value });
            } else {
                throw new Error('Copy command failed');
            }
        } catch (err) {
            document.body.removeChild(tempTextarea);
            console.error('Failed to copy link:', err);
            // Fallback: select the input for manual copying
            linkInput.select();
            linkInput.focus();
            alert('Please press Ctrl+C (or Cmd+C on Mac) to copy the link.');
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
                const registrationLink = `${baseUrl}/customer-register?affid=${affiliateData.affiliateId}`;
                document.getElementById('registrationLink').value = registrationLink;
                
                // Update dashboard link to go to login
                const dashboardLink = document.getElementById('dashboardLink');
                if (dashboardLink) {
                    dashboardLink.onclick = function(e) {
                        e.preventDefault();
                        console.log('Dashboard button clicked - redirecting to login');
                        
                        if (isEmbedded && window.parent && window.parent !== window) {
                            console.log('Sending navigation message to parent');
                            
                            // Try multiple parent levels in case of nested iframes
                            let targetWindow = window.parent;
                            let attempts = 0;
                            
                            while (targetWindow && attempts < 5) {
                                console.log(`Attempting to send message to parent level ${attempts + 1}`);
                                targetWindow.postMessage({
                                    type: 'navigate',
                                    data: { url: '/affiliate-login' }
                                }, '*');
                                
                                if (targetWindow.parent && targetWindow.parent !== targetWindow) {
                                    targetWindow = targetWindow.parent;
                                    attempts++;
                                } else {
                                    break;
                                }
                            }
                            
                            // Also try direct navigation as ultimate fallback
                            setTimeout(() => {
                                if (window.location.href.includes('affiliate-success')) {
                                    console.log('Fallback: Direct navigation to login');
                                    window.location.href = '/embed-app.html?route=/affiliate-login';
                                }
                            }, 1000);
                        } else {
                            window.location.href = '/embed-app.html?route=/affiliate-login';
                        }
                        return false;
                    };
                }
                
                // Set up copy button event listener
                const copyBtn = document.getElementById('copyLinkBtn');
                if (copyBtn) {
                    copyBtn.onclick = function(e) {
                        e.preventDefault();
                        window.copyLink();
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