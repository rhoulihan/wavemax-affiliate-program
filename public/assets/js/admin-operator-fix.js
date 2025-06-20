// Fix for operator modal issues
console.log('[Operator Fix] Loading fix...');

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Operator Fix] DOM loaded');
    
    // Wait a bit for all scripts to load
    setTimeout(function() {
        const modal = document.getElementById('operatorModal');
        const passwordContainer = document.getElementById('passwordContainer');
        
        if (modal) {
            // Ensure modal is closed on page load
            if (modal.classList.contains('active')) {
                console.warn('[Operator Fix] Modal was active on load - closing it');
                modal.classList.remove('active');
            }
            
            // Monitor modal state
            console.log('[Operator Fix] Modal initial state:', {
                hasActiveClass: modal.classList.contains('active'),
                computedDisplay: window.getComputedStyle(modal).display,
                visibility: window.getComputedStyle(modal).visibility
            });
        }
        
        // Fix Add Operator button to show password fields
        const addOperatorBtn = document.getElementById('addOperatorBtn');
        if (addOperatorBtn) {
            const originalHandler = addOperatorBtn.onclick;
            addOperatorBtn.onclick = function(e) {
                console.log('[Operator Fix] Add operator clicked');
                
                // Ensure password fields are visible for new operator
                setTimeout(function() {
                    const passwordContainer = document.getElementById('passwordContainer');
                    const operatorId = document.getElementById('operatorId');
                    
                    if (passwordContainer && (!operatorId || !operatorId.value)) {
                        passwordContainer.style.display = 'block';
                        console.log('[Operator Fix] Password fields made visible');
                    }
                }, 100);
                
                // Call original handler if exists
                if (originalHandler) {
                    return originalHandler.call(this, e);
                }
            };
        }
        
        // Escape key to close modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const modal = document.getElementById('operatorModal');
                if (modal && modal.classList.contains('active')) {
                    modal.classList.remove('active');
                    console.log('[Operator Fix] Modal closed with ESC key');
                }
            }
        });
        
        // Override save operator to ensure password validation
        if (window.saveOperator) {
            const originalSave = window.saveOperator;
            window.saveOperator = async function() {
                console.log('[Operator Fix] Save operator called');
                
                const operatorId = document.getElementById('operatorId');
                const passwordContainer = document.getElementById('passwordContainer');
                
                // For new operators, ensure password fields are visible
                if (!operatorId || !operatorId.value) {
                    if (passwordContainer) {
                        passwordContainer.style.display = 'block';
                    }
                    
                    // Check password validator exists
                    if (!window.passwordValidator) {
                        console.error('[Operator Fix] Password validator not found');
                        alert('Password validator component is not loaded. Please refresh the page and try again.');
                        return;
                    }
                }
                
                return originalSave.call(this);
            };
        }
        
        console.log('[Operator Fix] Fix applied successfully');
    }, 1000);
});