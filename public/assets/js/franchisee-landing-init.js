(function() {
    'use strict';

    // Revenue Calculator
    function calculateRevenue() {
        const affiliates = document.getElementById('affiliates').value;
        const loads = document.getElementById('loads').value;
        const weight = document.getElementById('weight').value;
        const price = document.getElementById('price').value;
        
        const weeklyRevenue = affiliates * loads * weight * price;
        const annualRevenue = weeklyRevenue * 52;
        
        document.getElementById('revenue').textContent = '$' + annualRevenue.toLocaleString('en-US', {
            maximumFractionDigits: 0
        });
    }

    // Add event listeners for calculator
    function initializeCalculator() {
        const inputs = ['affiliates', 'loads', 'weight', 'price'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', calculateRevenue);
            }
        });
        
        // Initial calculation
        calculateRevenue();
    }

    // Intersection Observer for animations
    function initializeAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe all feature cards and stat cards
        document.querySelectorAll('.feature-card, .stat-card, .step').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'all 0.6s ease-out';
            observer.observe(el);
        });
    }

    // CTA button click handler
    function initializeCTA() {
        const ctaButton = document.querySelector('.cta-button');
        if (ctaButton) {
            ctaButton.addEventListener('click', (e) => {
                e.preventDefault();
                // In production, this would scroll to a contact form or open a modal
                if (window.modalAlert) {
                    window.modalAlert('Contact form would open here. Please implement your preferred contact method.', 'Contact Form');
                } else {
                    alert('Contact form would open here. Please implement your preferred contact method.');
                }
            });
        }
    }

    // Initialize i18n and language switcher
    async function initializeI18n() {
        try {
            if (window.i18n) {
                await window.i18n.init({ debugMode: false });
            }
            
            if (window.LanguageSwitcher) {
                window.LanguageSwitcher.createSwitcher('language-switcher-container', {
                    style: 'dropdown',
                    showLabel: false
                });
            }
        } catch (error) {
            console.error('Error initializing i18n:', error);
        }
    }

    // Main initialization function
    function initialize() {
        initializeCalculator();
        initializeAnimations();
        initializeCTA();
        initializeI18n();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();