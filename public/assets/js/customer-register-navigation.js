(function() {
    'use strict';

    // Define the steps and their sections
    const steps = [
        {
            name: 'Social and Account',
            sections: ['socialAuthSection', 'accountSetupSection'],
            validate: async function() {
                // Validate account setup if not using OAuth
                if (!document.getElementById('accountSetupSection').style.display || 
                    document.getElementById('accountSetupSection').style.display !== 'none') {
                    const username = document.getElementById('username');
                    const password = document.getElementById('password');
                    const confirmPassword = document.getElementById('confirmPassword');
                    
                    if (!username.value || !password.value || !confirmPassword.value) {
                        if (window.modalAlert) {
                            window.modalAlert('Please fill in all account setup fields.', 'Required Fields');
                        } else {
                            alert('Please fill in all account setup fields.');
                        }
                        return false;
                    }
                    
                    if (password.value !== confirmPassword.value) {
                        if (window.modalAlert) {
                            window.modalAlert('Passwords do not match.', 'Password Error');
                        } else {
                            alert('Passwords do not match.');
                        }
                        return false;
                    }
                    
                    // Check password strength
                    const strengthText = document.getElementById('passwordStrength').textContent;
                    if (!strengthText.includes('Strong password')) {
                        if (window.modalAlert) {
                            window.modalAlert('Please create a password that meets all requirements.', 'Weak Password');
                        } else {
                            alert('Please create a password that meets all requirements.');
                        }
                        password.focus();
                        return false;
                    }
                    
                    // Check if username is available (red border means taken)
                    if (username.classList.contains('border-red-500')) {
                        if (window.modalAlert) {
                            window.modalAlert('Username is not available. Please choose a different username.', 'Username Taken');
                        } else {
                            alert('Username is not available. Please choose a different username.');
                        }
                        username.focus();
                        return false;
                    }
                }
                return true;
            }
        },
        {
            name: 'Personal and Address',
            sections: ['personalInfoSection', 'addressInfoSection'],
            validate: async function() {
                const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode'];
                for (let field of requiredFields) {
                    const element = document.getElementById(field);
                    if (!element || !element.value) {
                        if (window.modalAlert) {
                            window.modalAlert('Please fill in all personal and address information.', 'Required Fields');
                        } else {
                            alert('Please fill in all personal and address information.');
                        }
                        return false;
                    }
                }
                
                // Validate email format
                const email = document.getElementById('email');
                const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
                if (!emailRegex.test(email.value.trim())) {
                    if (window.modalAlert) {
                        window.modalAlert('Please enter a valid email address.', 'Invalid Email');
                    } else {
                        alert('Please enter a valid email address.');
                    }
                    email.focus();
                    return false;
                }
                
                // Check if email is available (red border means taken)
                if (email.classList.contains('border-red-500')) {
                    if (window.modalAlert) {
                        window.modalAlert('This email address is already in use. Please use a different email.', 'Email In Use');
                    } else {
                        alert('This email address is already in use. Please use a different email.');
                    }
                    email.focus();
                    return false;
                }
                
                // Validate service area
                if (window.validateServiceArea && typeof window.validateServiceArea === 'function') {
                    const inServiceArea = await window.validateServiceArea();
                    if (!inServiceArea) {
                        return false; // validateServiceArea shows its own modal
                    }
                }
                
                return true;
            }
        },
        {
            name: 'Bags and Preferences',
            sections: ['laundryBagsSection', 'servicePreferencesSection'],
            validate: function() {
                const numberOfBags = document.getElementById('numberOfBags');
                if (!numberOfBags || !numberOfBags.value || numberOfBags.value === '') {
                    if (window.modalAlert) {
                        window.modalAlert('Please select the number of bags needed.', 'Required Field');
                    } else {
                        alert('Please select the number of bags needed.');
                    }
                    return false;
                }
                return true;
            }
        },
        {
            name: 'Summary and Payment',
            sections: ['serviceSummarySection', 'serviceAgreementSection', 'paymentFormContainer'],
            validate: function() {
                const termsAgreement = document.getElementById('termsAgreement');
                if (!termsAgreement || !termsAgreement.checked) {
                    if (window.modalAlert) {
                        window.modalAlert('Please accept the Terms of Service and Privacy Policy.', 'Agreement Required');
                    } else {
                        alert('Please accept the Terms of Service and Privacy Policy.');
                    }
                    return false;
                }
                return true;
            },
            isLastStep: true,
            onShow: function() {
                // Trigger payment form visibility event
                if (window.PaygistixRegistration && window.PaygistixRegistration.updateBagQuantity) {
                    window.PaygistixRegistration.updateBagQuantity();
                }
                
                // Don't hide the payment container - show it properly
                setTimeout(function() {
                    const paymentContainer = document.getElementById('paymentFormContainer');
                    const advanceButton = document.getElementById('advanceButton');
                    
                    if (paymentContainer) {
                        // Make sure payment container is visible
                        paymentContainer.style.display = 'block';
                        
                        // Hide the advance button since this is the last step
                        if (advanceButton) {
                            advanceButton.style.display = 'none';
                        }
                        
                        // Setup the registration mode for the payment form
                        if (window.paymentForm && window.paymentForm.setupRegistrationMode) {
                            window.paymentForm.setupRegistrationMode();
                        }
                    }
                }, 500); // Wait for form to be fully loaded
            }
        }
    ];

    let currentStep = 0;

    function showStep(stepIndex) {
        // Hide all sections except navigation
        const allSections = document.querySelectorAll('#customerRegistrationForm > div[id$="Section"]:not(#navigationSection), #paymentFormContainer');
        allSections.forEach(section => {
            section.style.display = 'none';
        });

        // Show sections for current step
        const currentStepData = steps[stepIndex];
        currentStepData.sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'block';
            }
        });

        // Execute onShow callback if present
        if (currentStepData.onShow) {
            currentStepData.onShow();
        }

        // Update navigation buttons
        const backButton = document.getElementById('backButton');
        const advanceButton = document.getElementById('advanceButton');
        const advanceButtonText = advanceButton.querySelector('span');

        // Show/hide back button
        backButton.style.display = stepIndex > 0 ? 'block' : 'none';

        // Update advance button text
        if (currentStepData.isLastStep) {
            advanceButton.style.display = 'none'; // Hide advance button on last step
        } else {
            advanceButton.style.display = 'block';
            advanceButtonText.setAttribute('data-i18n', 'customer.register.next');
            advanceButtonText.textContent = 'Next →';
        }

        // Update i18n if available
        if (window.i18n && window.i18n.translatePage) {
            window.i18n.translatePage();
        }

        // Scroll to top of form
        const formContainer = document.querySelector('.embed-container');
        if (formContainer) {
            formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    async function advanceStep() {
        console.log('advanceStep called, currentStep:', currentStep);
        
        // Validate current step
        if (steps[currentStep].validate) {
            console.log('Validating step', currentStep);
            try {
                const isValid = await steps[currentStep].validate();
                if (!isValid) {
                    console.log('Validation failed for step', currentStep);
                    return;
                }
            } catch (error) {
                console.error('Validation error:', error);
                return;
            }
        }

        // Move to next step
        if (currentStep < steps.length - 1) {
            currentStep++;
            console.log('Moving to step', currentStep);
            showStep(currentStep);
        } else {
            console.log('Already at last step');
        }
    }

    function goBack() {
        if (currentStep > 0) {
            currentStep--;
            showStep(currentStep);
        }
    }

    // Initialize navigation
    function init() {
        console.log('Initializing customer registration navigation...');
        
        const advanceButton = document.getElementById('advanceButton');
        const backButton = document.getElementById('backButton');

        if (advanceButton) {
            console.log('Advance button found, attaching handler');
            advanceButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Advance button clicked');
                advanceStep();
            });
        } else {
            console.error('Advance button not found!');
        }

        if (backButton) {
            console.log('Back button found, attaching handler');
            backButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Back button clicked');
                goBack();
            });
        } else {
            console.warn('Back button not found (this is normal on first load)');
        }

        // Show initial step
        showStep(0);

        // Handle OAuth login - skip to step 2 if OAuth is used
        window.addEventListener('oauthSuccess', function() {
            currentStep = 1; // Skip to Personal and Address
            showStep(currentStep);
        });
    }

    // Check if DOM is ready
    if (document.readyState === 'loading') {
        console.log('DOM still loading, waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', init);
    } else {
        console.log('DOM ready, initializing navigation');
        // Add small delay to ensure all other scripts have run
        setTimeout(init, 100);
    }

    // Export navigation functions for external use
    window.CustomerRegistrationNavigation = {
        showStep: showStep,
        advanceStep: advanceStep,
        goBack: goBack,
        getCurrentStep: function() { return currentStep; }
    };

})();