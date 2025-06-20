// Debug script to find what's opening the operator modal
console.log('[Modal Debug] Starting modal debug script...');

// Override classList.add to catch when 'active' is added
(function() {
    const originalAdd = DOMTokenList.prototype.add;
    const originalRemove = DOMTokenList.prototype.remove;
    
    DOMTokenList.prototype.add = function(...tokens) {
        // Check if this is the operator modal and 'active' is being added
        if (this._element && this._element.id === 'operatorModal' && tokens.includes('active')) {
            console.error('[Modal Debug] ACTIVE CLASS BEING ADDED TO OPERATOR MODAL!');
            console.trace('Stack trace for modal activation');
            
            // Prevent the modal from opening automatically on page load
            const isPageLoading = performance.now() < 5000; // Within first 5 seconds
            if (isPageLoading) {
                console.warn('[Modal Debug] Blocking modal activation during page load');
                return; // Don't add the active class
            }
        }
        return originalAdd.apply(this, tokens);
    };
    
    DOMTokenList.prototype.remove = function(...tokens) {
        if (this._element && this._element.id === 'operatorModal' && tokens.includes('active')) {
            console.log('[Modal Debug] Active class being removed from operator modal');
        }
        return originalRemove.apply(this, tokens);
    };
    
    // Store element reference in classList
    Object.defineProperty(Element.prototype, 'classList', {
        get: function() {
            const classList = Object.getOwnPropertyDescriptor(this.constructor.prototype, 'classList').get.call(this);
            if (!classList._element) {
                classList._element = this;
            }
            return classList;
        },
        configurable: true
    });
})();

// Monitor modal style changes
window.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('operatorModal');
    if (modal) {
        console.log('[Modal Debug] Operator modal found, setting up observers...');
        
        // Create mutation observer
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes') {
                    if (mutation.attributeName === 'class') {
                        console.log('[Modal Debug] Modal class changed:', modal.className);
                        if (modal.classList.contains('active')) {
                            console.error('[Modal Debug] Modal became active via class change!');
                            console.trace('Class change stack trace');
                        }
                    } else if (mutation.attributeName === 'style') {
                        console.log('[Modal Debug] Modal style changed:', modal.style.cssText);
                    }
                }
            });
        });
        
        observer.observe(modal, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });
        
        // Log initial state
        console.log('[Modal Debug] Initial modal state:', {
            classes: modal.className,
            style: modal.style.cssText,
            display: window.getComputedStyle(modal).display
        });
    }
});

console.log('[Modal Debug] Debug script loaded');