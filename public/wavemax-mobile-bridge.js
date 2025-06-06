// WaveMAX Mobile Bridge - Simplified Version
(function() {
    'use strict';
    
    // Wait for page to fully load
    window.addEventListener('load', function() {
        // Only run on mobile
        if (window.innerWidth >= 768) return;
        
        // Find elements
        var topbar = document.querySelector('.topbar');
        var wrapper = document.querySelector('.wrapper');
        var navbar = document.querySelector('.navbar');
        var footer = document.querySelector('.footer');
        var pageHeader = document.querySelector('.page-header');
        var iframe = document.querySelector('iframe');
        
        // Hide topbar
        if (topbar) {
            topbar.style.display = 'none';
        }
        
        // Hide wrapper (contains navbar)
        if (wrapper) {
            wrapper.style.display = 'none';
        } else if (navbar) {
            // Fallback if wrapper not found
            navbar.style.transition = 'transform 0.3s ease-in-out';
            navbar.style.transform = 'translateY(-100%)';
            navbar.style.position = 'relative';
            navbar.style.zIndex = '1';
        }
        
        // Hide page header
        if (pageHeader) {
            pageHeader.style.display = 'none';
        }
        
        // Hide footer
        if (footer) {
            footer.style.transition = 'transform 0.3s ease-in-out';
            footer.style.transform = 'translateY(100%)';
            footer.style.position = 'relative';
            footer.style.zIndex = '1';
        }
        
        // Adjust iframe container if exists
        if (iframe && iframe.parentElement) {
            iframe.parentElement.style.minHeight = '100vh';
            iframe.style.minHeight = '100vh';
        }
        
        // Optional: Show what happened
        setTimeout(function() {
            alert('Mobile Bridge: Header and footer hidden');
        }, 500);
    });
})();