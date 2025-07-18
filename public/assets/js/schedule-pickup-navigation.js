(function() {
  'use strict';

  console.log('Schedule pickup navigation script loaded');

  // Define the steps
  const steps = [
    {
      name: 'Pickup Details',
      sectionId: 'pickupDetailsSection',
      validate: function() {
        // Validate pickup date
        const pickupDate = document.getElementById('pickupDate');
        if (!pickupDate || !pickupDate.value) {
          if (window.modalAlert) {
            window.modalAlert('Please select a pickup date.', 'Required Field');
          }
          return false;
        }

        // Validate pickup time
        const pickupTime = document.getElementById('pickupTime');
        if (!pickupTime || !pickupTime.value) {
          if (window.modalAlert) {
            window.modalAlert('Please select a preferred pickup time.', 'Required Field');
          }
          return false;
        }

        // Validate number of bags
        const numberOfBags = document.getElementById('numberOfBags');
        if (!numberOfBags || !numberOfBags.value) {
          if (window.modalAlert) {
            window.modalAlert('Please select the number of bags.', 'Required Field');
          }
          return false;
        }

        // Validate estimated weight
        const estimatedWeight = document.getElementById('estimatedWeight');
        if (!estimatedWeight || !estimatedWeight.value || parseFloat(estimatedWeight.value) <= 0) {
          if (window.modalAlert) {
            window.modalAlert('Please enter an estimated weight.', 'Required Field');
          }
          return false;
        }

        return true;
      }
    },
    {
      name: 'Summary and Payment',
      sectionId: 'summaryPaymentSection',
      isLastStep: true,
      onShow: function() {
        // When showing the last step, prepare for payment
        const advanceButton = document.getElementById('advanceButton');
        if (advanceButton) {
          advanceButton.style.display = 'none';
        }

        // Show submit button or complete payment button
        setTimeout(function() {
          console.log('[Schedule Navigation] Setting up payment button for Summary step');
          
          // Check if payment form is visible
          const paymentContainer = document.getElementById('paymentFormContainer');
          const navigationSection = document.getElementById('navigationSection');
          
          console.log('[Schedule Navigation] Payment container found:', !!paymentContainer);
          console.log('[Schedule Navigation] Navigation section found:', !!navigationSection);
          console.log('[Schedule Navigation] Payment container display:', paymentContainer ? paymentContainer.style.display : 'N/A');

          // Always create the Complete Payment button on the summary page
          if (navigationSection) {
            // Create "Continue to Payment" button if it doesn't exist
            let continueButton = document.getElementById('continueToPaymentBtn');
            console.log('[Schedule Navigation] Existing button found:', !!continueButton);
            
            if (!continueButton) {
              continueButton = document.createElement('button');
              continueButton.id = 'continueToPaymentBtn';
              continueButton.type = 'button';
              continueButton.className = 'px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition';
              continueButton.innerHTML = '<span>Complete Payment</span>';

              continueButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('[Schedule Navigation] Complete Payment clicked');
                // Process payment
                showPaymentForm();
              });

              const buttonsContainer = navigationSection.querySelector('.flex.justify-between');
              console.log('[Schedule Navigation] Buttons container found:', !!buttonsContainer);
              
              if (buttonsContainer) {
                buttonsContainer.appendChild(continueButton);
                console.log('[Schedule Navigation] Complete Payment button appended');
              }
            }
          }
        }, 100);
      }
    }
  ];

  let currentStep = 0;

  function showStep(stepIndex) {
    // Hide all step sections
    const allSteps = document.querySelectorAll('.schedule-step');
    allSteps.forEach(step => {
      step.style.display = 'none';
    });

    // Show current step
    const currentStepData = steps[stepIndex];
    const currentSection = document.getElementById(currentStepData.sectionId);
    if (currentSection) {
      currentSection.style.display = 'block';
    }

    // Execute onShow callback if present
    if (currentStepData.onShow) {
      currentStepData.onShow();
    }

    // Update navigation buttons
    const backButton = document.getElementById('backButton');
    const advanceButton = document.getElementById('advanceButton');

    // Show/hide back button
    backButton.style.display = stepIndex > 0 ? 'block' : 'none';

    // Update advance button
    if (currentStepData.isLastStep) {
      // Advance button will be hidden by onShow callback
    } else {
      advanceButton.style.display = 'block';
    }

    // Scroll to top
    const formContainer = document.querySelector('.embed-container');
    if (formContainer) {
      formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function advanceStep() {
    // Validate current step
    if (steps[currentStep].validate) {
      const isValid = steps[currentStep].validate();
      if (!isValid) {
        return;
      }
    }

    // Move to next step
    if (currentStep < steps.length - 1) {
      currentStep++;
      showStep(currentStep);
    }
  }

  function goBack() {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);

      // Hide payment form if going back from last step
      const paymentContainer = document.getElementById('paymentFormContainer');
      if (paymentContainer) {
        paymentContainer.style.display = 'none';
      }

      // Remove continue to payment button if it exists
      const continueButton = document.getElementById('continueToPaymentBtn');
      if (continueButton) {
        continueButton.remove();
      }
    }
  }

  function showPaymentForm() {
    // The main schedule-pickup.js will handle the form submission and data collection
    // This function now just triggers the submit event on the form
    const form = document.getElementById('pickupScheduleForm');
    if (!form) return;

    // Trigger the form's submit event which will be handled by schedule-pickup.js
    const submitEvent = new Event('submit', {
      bubbles: true,
      cancelable: true
    });
    form.dispatchEvent(submitEvent);

    // Don't hide the payment form - let schedule-pickup.js handle the display
    const paymentContainer = document.getElementById('paymentFormContainer');
    if (paymentContainer) {
      // paymentContainer.style.display = 'none'; // Removed - let main script handle this

      // Trigger a recalculation to update payment form quantities
      const calculateEstimateFunc = window.calculateEstimate;
      if (typeof calculateEstimateFunc === 'function') {
        console.log('Triggering estimate calculation to update payment form');
        calculateEstimateFunc();
      }
    }

    // Submit the payment form directly
    const continueButton = document.getElementById('continueToPaymentBtn');
    if (continueButton) {
      // Don't show spinner here - the payment form will show its own
      continueButton.textContent = 'Processing...';
      continueButton.disabled = true;
      continueButton.classList.add('opacity-50', 'cursor-not-allowed');
      
      // Add delay to ensure form values are set
      setTimeout(function() {
        console.log('Checking payment config for test mode:', window.paymentConfig);
        
        // Check if test payment form is enabled
        if (window.paymentConfig && window.paymentConfig.testPaymentFormEnabled) {
          console.log('Test payment form is enabled, opening test form in popup');
          
          // Open test payment form in popup
          const testFormUrl = '/test-payment';
          const width = 800;
          const height = 600;
          const left = (window.screen.width - width) / 2;
          const top = (window.screen.height - height) / 2;
          
          const testWindow = window.open(testFormUrl, 'testPayment', 
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
          
          if (!testWindow) {
            if (window.modalAlert) {
              window.modalAlert('Please allow pop-ups for this site to complete payment.', 'Pop-up Blocked');
            }
            // Re-enable the button
            continueButton.textContent = 'Complete Payment';
            continueButton.disabled = false;
            continueButton.classList.remove('opacity-50', 'cursor-not-allowed');
          }
        } else {
          console.log('Production mode, looking for payment form submit button');
          
          // Check if payment form is ready
          const submitButton = document.getElementById('pxSubmit');
          console.log('Submit button found:', !!submitButton);
          
          if (!submitButton) {
            // Try again after a longer delay
            console.log('Submit button not found, waiting longer for form to load...');
            setTimeout(function() {
              const retryButton = document.getElementById('pxSubmit');
              if (retryButton) {
                console.log('Submit button found on retry, clicking it');
                retryButton.click();
              } else if (window.paymentForm && window.paymentForm.processPayment) {
                console.log('Calling processPayment() as fallback');
                // Get customer data for payment
                const customerStr = localStorage.getItem('currentCustomer');
                const customer = customerStr ? JSON.parse(customerStr) : {};
                const customerData = {
                  firstName: customer.firstName || 'Order',
                  lastName: customer.lastName || 'Customer',
                  email: customer.email || 'order@test.com'
                };
                window.paymentForm.processPayment(customerData);
              } else {
                console.error('Payment form still not ready');
                continueButton.textContent = 'Complete Payment';
                continueButton.disabled = false;
                continueButton.classList.remove('opacity-50', 'cursor-not-allowed');
                if (window.modalAlert) {
                  window.modalAlert('Payment form is not ready. Please try again.', 'Payment Error');
                }
              }
            }, 1000);
          } else {
            console.log('Submit button found, triggering form submission');
            
            // Instead of clicking the button, trigger the form submission directly
            const paygistixForm = document.getElementById('paygistixPaymentForm');
            if (paygistixForm) {
              console.log('Triggering form submit event');
              // Create and dispatch a submit event
              const submitEvent = new Event('submit', {
                bubbles: true,
                cancelable: true
              });
              paygistixForm.dispatchEvent(submitEvent);
            } else {
              // Fallback to clicking the button
              console.log('Form not found, falling back to button click');
              submitButton.click();
            }
          }
        }
      }, 500);
    }
  }

  // Initialize navigation
  function init() {
    console.log('Schedule pickup navigation init called');

    // Remove the old form submission handler FIRST
    const form = document.getElementById('pickupScheduleForm');
    // Form submission is now handled by schedule-pickup.js

    // Now attach button handlers
    const advanceButton = document.getElementById('advanceButton');
    const backButton = document.getElementById('backButton');

    console.log('Advance button found:', !!advanceButton);
    console.log('Back button found:', !!backButton);

    if (advanceButton) {
      advanceButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Advance button clicked');
        advanceStep();
      });
    } else {
      console.error('Advance button not found in DOM');
    }

    if (backButton) {
      backButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Back button clicked');
        goBack();
      });
    }

    // Show initial step
    showStep(0);
  }

  // Check if DOM is ready
  console.log('DOM readyState:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('Adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', init);
  } else {
    console.log('DOM already loaded, scheduling init');
    // Add delay to ensure page content and other scripts have loaded
    setTimeout(function() {
      console.log('Delayed init starting');
      init();
    }, 500);
  }

  // Export navigation functions for external use
  window.SchedulePickupNavigation = {
    showStep: showStep,
    advanceStep: advanceStep,
    goBack: goBack,
    getCurrentStep: function() { return currentStep; },
    showPaymentForm: showPaymentForm
  };

})();