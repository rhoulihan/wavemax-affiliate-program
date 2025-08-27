(function() {
    'use strict';

    // Define the steps and their sections
    const steps = [
        {
            name: 'Social and Account',
            sections: ['socialAuthSection', 'accountSetupSection'],
            validate: async function() {
                // Check if OAuth was used
                const socialToken = document.getElementById('socialToken');
                const isOAuthUser = socialToken && socialToken.value;
                
                if (isOAuthUser) {
                    // OAuth user - skip password validation
                    return true;
                }
                
                // Validate account setup if not using OAuth
                const accountSection = document.getElementById('accountSetupSection');
                if (!accountSection.style.display || accountSection.style.display !== 'none') {
                    const username = document.getElementById('username');
                    const password = document.getElementById('password');
                    const confirmPassword = document.getElementById('confirmPassword');

                    if (!username.value || !password.value || !confirmPassword.value) {
                        if (window.ModalSystem) {
                            window.ModalSystem.error('Please fill in all account setup fields.', 'Required Fields');
                        } else {
                            alert('Please fill in all account setup fields.');
                        }
                        return false;
                    }

                    if (password.value !== confirmPassword.value) {
                        if (window.ModalSystem) {
                            window.ModalSystem.error('Passwords do not match.', 'Password Error');
                        } else {
                            alert('Passwords do not match.');
                        }
                        return false;
                    }

                    // Check password strength
                    const strengthText = document.getElementById('passwordStrength')?.textContent || '';
                    if (!strengthText.includes('Strong password')) {
                        if (window.ModalSystem) {
                            window.ModalSystem.error('Please create a password that meets all requirements.', 'Weak Password');
                        } else {
                            alert('Please create a password that meets all requirements.');
                        }
                        password.focus();
                        return false;
                    }

                    // Check if username is available (red border means taken)
                    if (username.classList.contains('border-red-500')) {
                        if (window.ModalSystem) {
                            window.ModalSystem.error('Username is not available. Please choose a different username.', 'Username Taken');
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
                        if (window.ModalSystem) {
                            window.ModalSystem.error('Please fill in all personal and address information.', 'Required Fields');
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
                    if (window.ModalSystem) {
                        window.ModalSystem.error('Please enter a valid email address.', 'Invalid Email');
                    } else {
                        alert('Please enter a valid email address.');
                    }
                    email.focus();
                    return false;
                }

                // Check if email is available (red border means taken)
                if (email.classList.contains('border-red-500')) {
                    if (window.ModalSystem) {
                        window.ModalSystem.error('This email address is already in use. Please use a different email.', 'Email In Use');
                    } else {
                        alert('This email address is already in use. Please use a different email.');
                    }
                    email.focus();
                    return false;
                }

                // Validate phone format
                const phone = document.getElementById('phone');
                const phoneRegex = /^\d{10}$|^\d{3}-\d{3}-\d{4}$/;
                const phoneValue = phone.value.replace(/[^\d]/g, '');
                if (phoneValue.length !== 10) {
                    if (window.ModalSystem) {
                        window.ModalSystem.error('Please enter a valid 10-digit phone number.', 'Invalid Phone');
                    } else {
                        alert('Please enter a valid 10-digit phone number.');
                    }
                    phone.focus();
                    return false;
                }

                // Check if address validation was performed and successful
                const validatedAddress = document.getElementById('addressValidationComponent');
                if (validatedAddress && validatedAddress.dataset.validated === 'false') {
                    if (window.ModalSystem) {
                        window.ModalSystem.error('Please validate your address before proceeding.', 'Address Validation Required');
                    } else {
                        alert('Please validate your address before proceeding.');
                    }
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
            },
            onShow: function() {
                // Initialize address validation if available
                if (window.AddressValidation && window.AddressValidation.init) {
                    window.AddressValidation.init({
                        onValidationComplete: function(isValid) {
                            const validationComponent = document.getElementById('addressValidationComponent');
                            if (validationComponent) {
                                validationComponent.dataset.validated = isValid ? 'true' : 'false';
                            }
                        }
                    });
                }
            }
        },
        {
            name: 'Service Summary',
            sections: ['serviceSummarySection'],
            isLastStep: true,
            validate: async function() {
                // Ensure bags are selected
                const numberOfBags = document.getElementById('numberOfBags');
                if (!numberOfBags || !numberOfBags.value) {
                    if (window.ModalSystem) {
                        window.ModalSystem.error('Please select the number of bags.', 'Required Selection');
                    } else {
                        alert('Please select the number of bags.');
                    }
                    return false;
                }
                return true;
            }
        }
    ];

    let currentStep = 0;

    function showStep(stepIndex) {
        // Hide all sections except navigation
        const allSections = document.querySelectorAll('#customerRegistrationForm > div[id$="Section"]:not(#navigationSection)');
        allSections.forEach(section => {
            section.classList.remove('active');
        });

        // Show sections for current step
        const currentStepData = steps[stepIndex];
        currentStepData.sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.add('active');
            }
        });

        // Execute onShow callback if present
        if (currentStepData.onShow) {
            currentStepData.onShow();
        }

        // Update navigation buttons
        const backButton = document.getElementById('backButton');
        const advanceButton = document.getElementById('advanceButton');
        const submitButton = document.getElementById('submitBtn');
        const advanceButtonText = advanceButton?.querySelector('span');

        // Show/hide back button
        if (backButton) {
            if (stepIndex > 0) {
                backButton.classList.remove('button-hidden');
                backButton.classList.add('button-visible');
            } else {
                backButton.classList.remove('button-visible');
                backButton.classList.add('button-hidden');
            }
        }

        // Update advance button and submit button
        if (currentStepData.isLastStep) {
            // Hide advance button, show submit button
            if (advanceButton) {
                advanceButton.classList.remove('button-visible');
                advanceButton.classList.add('button-hidden');
            }
            if (submitButton) {
                submitButton.classList.remove('button-hidden');
                submitButton.classList.add('button-visible');
            }
        } else {
            // Show advance button, hide submit button
            if (advanceButton) {
                advanceButton.classList.remove('button-hidden');
                advanceButton.classList.add('button-visible');
            }
            if (submitButton) {
                submitButton.classList.remove('button-visible');
                submitButton.classList.add('button-hidden');
            }
            if (advanceButtonText) {
                advanceButtonText.setAttribute('data-i18n', 'customer.register.next');
                advanceButtonText.textContent = 'Next →';
            }
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
        console.log('[V2 Navigation] advanceStep called, currentStep:', currentStep);

        // Validate current step
        if (steps[currentStep].validate) {
            console.log('[V2 Navigation] Validating step', currentStep);
            try {
                const isValid = await steps[currentStep].validate();
                if (!isValid) {
                    console.log('[V2 Navigation] Validation failed for step', currentStep);
                    return;
                }
            } catch (error) {
                console.error('[V2 Navigation] Validation error:', error);
                return;
            }
        }

        // Move to next step
        if (currentStep < steps.length - 1) {
            currentStep++;
            console.log('[V2 Navigation] Moving to step', currentStep);
            showStep(currentStep);
        }
    }

    function goBack() {
        if (currentStep > 0) {
            currentStep--;
            console.log('[V2 Navigation] Going back to step', currentStep);
            showStep(currentStep);
        }
    }

    // Initialize navigation
    function init() {
        console.log('[V2 Navigation] Initializing customer registration navigation...');

        // Set up button event listeners
        const advanceButton = document.getElementById('advanceButton');
        const backButton = document.getElementById('backButton');

        if (advanceButton) {
            advanceButton.addEventListener('click', function(e) {
                e.preventDefault();
                advanceStep();
            });
        }

        if (backButton) {
            backButton.addEventListener('click', function(e) {
                e.preventDefault();
                goBack();
            });
        }

        // Show initial step
        showStep(0);

        // Handle OAuth success - skip to step 2 if OAuth is used
        window.addEventListener('oauthSuccess', function() {
            console.log('[V2 Navigation] OAuth success detected, skipping to Personal and Address step');
            
            // Hide account setup section for OAuth users
            const accountSetup = document.getElementById('accountSetupSection');
            if (accountSetup) {
                accountSetup.classList.remove('active');
                accountSetup.classList.add('hidden');
            }
            
            currentStep = 1; // Skip to Personal and Address
            showStep(currentStep);
        });
    }

    // Check if DOM is ready
    if (document.readyState === 'loading') {
        console.log('[V2 Navigation] DOM still loading, waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', init);
    } else {
        console.log('[V2 Navigation] DOM ready, initializing navigation');
        // Add small delay to ensure all other scripts have run
        setTimeout(init, 100);
    }

    // Export navigation functions for external use
    window.CustomerRegistrationV2Navigation = {
        showStep: showStep,
        advanceStep: advanceStep,
        goBack: goBack,
        getCurrentStep: function() { return currentStep; }
    };

})();