// Schedule Pickup V2 Embed - External JavaScript
(function() {
    'use strict';

    // Store affiliate availability data
    let affiliateAvailability = null;

    // Get current time in CDT timezone
    function getCurrentCDT() {
        const now = new Date();
        // Get CDT time components
        const cdtString = now.toLocaleString("en-US", {
            timeZone: "America/Chicago",
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        // Parse the CDT string to get components
        const [datePart, timePart] = cdtString.split(', ');
        const [month, day, year] = datePart.split('/');
        const [hour, minute, second] = timePart.split(':');
        
        return {
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            hour: parseInt(hour),
            minute: parseInt(minute),
            second: parseInt(second),
            dateString: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        };
    }
    
    // Get the minimum allowed pickup date (considering 24-hour rule)
    function getMinimumPickupDate() {
        const cdtNow = getCurrentCDT();
        
        // Always start with tomorrow as the minimum selectable date
        // Individual time slots will be disabled based on the 24-hour rule
        let minDate = new Date(cdtNow.year, cdtNow.month - 1, cdtNow.day);
        minDate.setDate(minDate.getDate() + 1);
        
        // Only push to day after tomorrow if NO slots tomorrow would be valid
        // This happens when it's 8 PM CDT or later (tomorrow's evening slot at 4 PM would be < 24 hours)
        if (cdtNow.hour >= 20) {
            // It's 8 PM or later, so even tomorrow evening (4-8 PM) starts in less than 24 hours
            minDate.setDate(minDate.getDate() + 1);
        }
        
        return minDate;
    }
    
    // Check if a pickup window is valid (ends more than 24 hours from now)
    function isPickupWindowValid(date, timeSlot) {
        const cdtNow = getCurrentCDT();
        const [year, month, day] = date.split('-').map(n => parseInt(n));
        
        // Set the END hour based on the time slot
        let endHour;
        switch(timeSlot) {
            case 'morning':
                endHour = 12;  // Morning ends at 12 PM
                break;
            case 'afternoon':
                endHour = 16;  // Afternoon ends at 4 PM
                break;
            case 'evening':
                endHour = 20;  // Evening ends at 8 PM
                break;
            default:
                return false;
        }
        
        // Create date objects for comparison
        const nowDateTime = new Date(cdtNow.year, cdtNow.month - 1, cdtNow.day, cdtNow.hour, cdtNow.minute);
        const pickupEndDateTime = new Date(year, month - 1, day, endHour, 0);
        
        // Calculate hours difference to the END of the pickup window
        const hoursDiff = (pickupEndDateTime - nowDateTime) / (1000 * 60 * 60);
        
        // Debug logging
        if (timeSlot === 'morning') {
            console.log(`[Schedule V2 Embed] Validation - Now: ${cdtNow.year}-${cdtNow.month}-${cdtNow.day} ${cdtNow.hour}:${cdtNow.minute}`);
            console.log(`[Schedule V2 Embed] Validation - Pickup window ends: ${year}-${month}-${day} ${endHour}:00`);
            console.log(`[Schedule V2 Embed] Validation - Hours until window ends: ${hoursDiff.toFixed(2)}`);
        }
        
        // Window end must be more than 24 hours in the future
        return hoursDiff > 24;
    }

    // Fetch affiliate availability from API
    async function fetchAffiliateAvailability(affiliateId) {
        if (!affiliateId) {
            console.log('[Schedule V2 Embed] No affiliate ID, skipping availability fetch');
            return null;
        }

        try {
            console.log('[Schedule V2 Embed] Fetching availability for affiliate:', affiliateId);

            // Calculate date range (today + 30 days)
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 30);

            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];

            const url = `/api/v1/affiliates/${affiliateId}/available-slots?startDate=${startDateStr}&endDate=${endDateStr}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.warn('[Schedule V2 Embed] Failed to fetch availability:', response.status);
                return null;
            }

            const data = await response.json();
            console.log('[Schedule V2 Embed] Availability data received:', data);

            if (data.success && data.availableDates) {
                return data.availableDates;
            }
            return null;
        } catch (error) {
            console.warn('[Schedule V2 Embed] Error fetching availability:', error);
            return null;
        }
    }

    // Check if a date and time slot is available according to affiliate schedule
    function isAffiliateAvailable(dateString, timeSlot) {
        if (!affiliateAvailability) {
            // If no availability data, assume all slots are available (backward compatibility)
            return true;
        }

        const dateEntry = affiliateAvailability.find(entry => {
            const entryDate = new Date(entry.date).toISOString().split('T')[0];
            return entryDate === dateString;
        });

        if (!dateEntry) {
            // Date not in available range
            return false;
        }

        // Check if the specific time slot is available
        return dateEntry.availableSlots && dateEntry.availableSlots[timeSlot] === true;
    }

    // Get all available dates from affiliate schedule
    function getAvailableDatesFromSchedule() {
        if (!affiliateAvailability) {
            return null; // No restriction
        }

        return affiliateAvailability
            .filter(entry => {
                // Check if at least one slot is available
                const slots = entry.availableSlots;
                return slots && (slots.morning || slots.afternoon || slots.evening);
            })
            .map(entry => new Date(entry.date).toISOString().split('T')[0]);
    }

    // Setup date picker with proper restrictions
    function setupDatePicker() {
        const pickupDateInput = document.getElementById('pickupDate');
        if (!pickupDateInput) return;
        
        // Get minimum date based on 24-hour rule
        const minDate = getMinimumPickupDate();
        
        // Format for input min attribute (YYYY-MM-DD)
        const year = minDate.getFullYear();
        const month = String(minDate.getMonth() + 1).padStart(2, '0');
        const day = String(minDate.getDate()).padStart(2, '0');
        const minDateString = `${year}-${month}-${day}`;
        
        pickupDateInput.min = minDateString;
        pickupDateInput.value = minDateString;
        
        const cdtNow = getCurrentCDT();
        console.log('[Schedule V2 Embed] Current CDT time:', `${cdtNow.dateString} ${cdtNow.hour}:${cdtNow.minute}`);
        console.log('[Schedule V2 Embed] Minimum pickup date set to:', minDateString);
        
        // Add change listener to validate time slots when date changes
        pickupDateInput.addEventListener('change', updateTimeSlotAvailability);
        
        // Initial time slot validation
        updateTimeSlotAvailability();
    }
    
    // Update time slot availability based on selected date
    function updateTimeSlotAvailability() {
        const pickupDateInput = document.getElementById('pickupDate');
        if (!pickupDateInput || !pickupDateInput.value) return;

        const selectedDate = pickupDateInput.value;
        const timeSlots = document.querySelectorAll('.time-slot');

        console.log('[Schedule V2 Embed] Validating time slots for date:', selectedDate);

        timeSlots.forEach(slot => {
            const timeValue = slot.dataset.timeValue;
            const is24HourValid = isPickupWindowValid(selectedDate, timeValue);
            const isAffiliateSlotAvailable = isAffiliateAvailable(selectedDate, timeValue);
            const isValid = is24HourValid && isAffiliateSlotAvailable;
            const radioInput = slot.querySelector('input[type="radio"]');

            const slotTimes = {
                'morning': '8 AM - 12 PM',
                'afternoon': '12 PM - 4 PM',
                'evening': '4 PM - 8 PM'
            };

            let unavailableReason = '';
            if (!is24HourValid) {
                unavailableReason = 'within 24 hrs';
            } else if (!isAffiliateSlotAvailable) {
                unavailableReason = 'affiliate unavailable';
            }

            console.log(`[Schedule V2 Embed] ${timeValue} (${slotTimes[timeValue]}): ${isValid ? 'AVAILABLE' : `UNAVAILABLE (${unavailableReason})`}`);

            if (isValid) {
                slot.classList.remove('disabled', 'opacity-50', 'cursor-not-allowed');
                slot.classList.add('cursor-pointer');
                if (radioInput) radioInput.disabled = false;
                // Remove any unavailability indicator
                const indicator = slot.querySelector('.unavailable-indicator');
                if (indicator) indicator.remove();
            } else {
                slot.classList.add('disabled', 'opacity-50', 'cursor-not-allowed');
                slot.classList.remove('cursor-pointer', 'selected');
                if (radioInput) {
                    radioInput.disabled = true;
                    radioInput.checked = false;
                }
                // Add visual indicator if not already present
                if (!slot.querySelector('.unavailable-indicator') && !isAffiliateSlotAvailable && is24HourValid) {
                    const indicator = document.createElement('span');
                    indicator.className = 'unavailable-indicator text-xs text-red-500 block mt-1';
                    indicator.textContent = 'Not available';
                    slot.appendChild(indicator);
                }
            }
        });

        // Auto-select first available time slot if none selected
        const selectedSlot = document.querySelector('.time-slot input[type="radio"]:checked');
        if (!selectedSlot) {
            const firstAvailable = document.querySelector('.time-slot:not(.disabled) input[type="radio"]');
            if (firstAvailable) {
                firstAvailable.checked = true;
                firstAvailable.closest('.time-slot').classList.add('selected');
            }
        }
    }
    
    // Time slot selection
    window.selectTimeSlot = function(element, value) {
        // Don't select if disabled
        if (element.classList.contains('disabled')) {
            return;
        }
        
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
        element.classList.add('selected');
        document.getElementById(value).checked = true;
    };

    // Initialize when DOM is ready
    async function init() {
        console.log('[Schedule V2 Embed] Initializing...');
        
        // Initialize ApiClient CSRF token
        if (window.ApiClient) {
            ApiClient.initCSRF();
        }
        
        // Setup date picker with 24-hour minimum in CDT
        setupDatePicker();
        
        // Update time slot availability and set default
        updateTimeSlotAvailability();
        
        // Set default time slot if none selected
        setTimeout(() => {
            const pickupTimeInputs = document.querySelectorAll('input[name="pickupTime"]');
            let hasSelection = false;
            pickupTimeInputs.forEach(input => {
                if (input.checked) hasSelection = true;
            });
            
            if (!hasSelection && pickupTimeInputs.length > 0) {
                // Check the first available (non-disabled) time slot
                for (let input of pickupTimeInputs) {
                    const parentSlot = input.closest('.time-slot');
                    if (!parentSlot?.classList.contains('disabled')) {
                        input.checked = true;
                        parentSlot?.classList.add('selected');
                        console.log('[Schedule V2 Embed] Set default pickup time to:', input.value);
                        break;
                    }
                }
            }
        }, 100); // Small delay to ensure DOM is ready
        
        // Fetch and display pricing information
        await loadPricingInfo();
        
        // Get customer info from token
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        console.log('[Schedule V2 Embed] URL params:', window.location.search);
        console.log('[Schedule V2 Embed] Token present:', !!token);
        
        if (token) {
            // Decode token to get customer info
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const customerIdInput = document.getElementById('customerId');
                const affiliateIdInput = document.getElementById('affiliateId');
                
                if (customerIdInput) customerIdInput.value = payload.customerId;
                if (affiliateIdInput) affiliateIdInput.value = payload.affiliateId;
                
                // Load customer and affiliate info
                await loadCustomerAndAffiliateInfo(token);
            } catch (e) {
                console.error('[Schedule V2 Embed] Invalid token:', e);
            }
        } else {
            console.log('[Schedule V2 Embed] No token found, checking localStorage...');
            // Try to load from localStorage
            const customerData = localStorage.getItem('currentCustomer');
            if (customerData) {
                const customer = JSON.parse(customerData);
                console.log('[Schedule V2 Embed] Customer from localStorage:', customer);
                
                // Check multiple possible locations for affiliate ID
                const possibleAffiliateId = customer.affiliateId || customer.affiliate?.affiliateId || customer.affiliate?._id;
                console.log('[Schedule V2 Embed] Possible affiliate ID from customer:', possibleAffiliateId);
                
                // Show success message if coming from registration
                if (urlParams.get('registered') === 'true') {
                    showRegistrationSuccess(customer);
                }
                
                // Check for numberOfBags first, then initialBagsRequested, default to 1
                const bags = customer.numberOfBags || customer.initialBagsRequested || 1;
                window.populateBagOptions(bags);
                
                // Load affiliate info if available
                if (possibleAffiliateId) {
                    console.log('[Schedule V2 Embed] Loading affiliate from customer data:', possibleAffiliateId);
                    await loadAffiliateInfo(possibleAffiliateId);
                }
            } else {
                console.log('[Schedule V2 Embed] No customer data in localStorage');
                // Default to 1 bag if no customer data
                window.populateBagOptions(1);
            }
            
            // Also check for affiliate ID in URL params (affid or affiliateId)
            const affiliateIdParam = urlParams.get('affid') || urlParams.get('affiliateId');
            console.log('[Schedule V2 Embed] Affiliate ID from URL params:', affiliateIdParam);
            
            if (affiliateIdParam) {
                // Extract the ID part if it's in format "AFF-xxxxx"
                const affiliateId = affiliateIdParam.startsWith('AFF-') ? affiliateIdParam : `AFF-${affiliateIdParam}`;
                console.log('[Schedule V2 Embed] Loading affiliate from URL:', affiliateId);
                await loadAffiliateInfo(affiliateId);
            }
        }
        
        // Setup time slot click handlers
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.addEventListener('click', function() {
                // Don't process click if disabled
                if (this.classList.contains('disabled')) {
                    return;
                }
                const radioInput = this.querySelector('input[type="radio"]');
                if (radioInput && !radioInput.disabled) {
                    window.selectTimeSlot(this, radioInput.value);
                }
            });
        });
        
        // Setup dashboard button handler
        const dashboardBtn = document.getElementById('dashboardButton');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', function() {
                window.location.href = '/customer-dashboard-embed.html';
            });
        }
        
        // Setup add-on icon click listeners
        const addonItems = document.querySelectorAll('.addon-item');
        console.log('[Schedule V2 Embed] Found', addonItems.length, 'addon items');
        addonItems.forEach(item => {
            item.addEventListener('click', function() {
                const addonType = this.dataset.addon;
                const checkbox = this.querySelector('.addon-checkbox');
                
                // Toggle the checkbox state
                checkbox.checked = !checkbox.checked;
                
                // Toggle the selected class for visual feedback
                this.classList.toggle('selected', checkbox.checked);
                
                console.log('[Schedule V2 Embed] Add-on toggled:', addonType, checkbox.checked);
                
                // Update pricing display
                window.updateAddonsDisplay();
            });
            
            // Set initial state based on checkbox
            const checkbox = item.querySelector('.addon-checkbox');
            if (checkbox && checkbox.checked) {
                item.classList.add('selected');
            }
        });
        
        // Initialize add-ons display
        window.updateAddonsDisplay();
        
        // Form submission
        const form = document.getElementById('schedulePickupForm');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }
    }
    
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        console.log('[Schedule V2 Embed] Submitting pickup schedule');
        
        // Debug form elements
        const form = e.target;
        console.log('[Schedule V2 Embed] Form element:', form);
        console.log('[Schedule V2 Embed] Form elements count:', form.elements.length);
        
        // Check specific fields directly
        const pickupDateInput = document.getElementById('pickupDate');
        const pickupTimeInputs = document.querySelectorAll('input[name="pickupTime"]');
        console.log('[Schedule V2 Embed] Pickup date input value:', pickupDateInput?.value);
        console.log('[Schedule V2 Embed] Pickup time radio buttons:', pickupTimeInputs.length);
        
        // Check if any time slot is selected
        let selectedTime = null;
        pickupTimeInputs.forEach(input => {
            if (input.checked) {
                selectedTime = input.value;
            }
        });
        console.log('[Schedule V2 Embed] Selected pickup time:', selectedTime);
        
        const loadingSpinner = document.getElementById('loadingSpinner');
        const submitBtn = document.getElementById('submitBtn');
        const successModal = document.getElementById('successModal');
        
        // Show spinner using SwirlSpinner if available
        let spinner = null;
        if (window.SwirlSpinnerUtils) {
            // Use getTranslation method or fallback to default messages
            const getMessage = (key, defaultText) => {
                if (window.i18n && typeof window.i18n.getTranslation === 'function') {
                    return window.i18n.getTranslation(key) || defaultText;
                }
                return defaultText;
            };
            
            spinner = window.SwirlSpinnerUtils.showOnForm(e.target, {
                message: getMessage('spinner.schedulingPickup', 'Scheduling your pickup...'),
                submessage: getMessage('spinner.confirmingPickup', 'Please wait while we confirm your pickup time')
            });
        } else if (loadingSpinner) {
            loadingSpinner.classList.remove('hidden');
        }
        
        if (submitBtn) submitBtn.disabled = true;
        
        // Manually collect form data since FormData might not be working properly
        const data = {};
        
        // Get date directly
        data.pickupDate = pickupDateInput?.value || '';
        
        // Get selected time
        data.pickupTime = selectedTime || '';
        
        // Get number of bags from dropdown or hidden field
        const numberOfBagsInput = document.getElementById('numberOfBags');
        if (numberOfBagsInput?.value) {
            data.numberOfBags = parseInt(numberOfBagsInput.value);
        }
        
        // Process add-ons
        const addOns = {
            premiumDetergent: false,
            fabricSoftener: false,
            stainRemover: false
        };
        
        // Check each addon checkbox
        const premiumDetergentCheckbox = document.querySelector('input[value="premiumDetergent"]:checked');
        const fabricSoftenerCheckbox = document.querySelector('input[value="fabricSoftener"]:checked');
        const stainRemoverCheckbox = document.querySelector('input[value="stainRemover"]:checked');
        
        if (premiumDetergentCheckbox) addOns.premiumDetergent = true;
        if (fabricSoftenerCheckbox) addOns.fabricSoftener = true;
        if (stainRemoverCheckbox) addOns.stainRemover = true;
        
        data.addOns = addOns;
        
        console.log('[Schedule V2 Embed] Manually collected form data:', data);
        
        // Get tokens early
        const customerToken = localStorage.getItem('customerToken');
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        const token = customerToken || urlToken;
        
        // Get customer data for IDs
        const customerData = localStorage.getItem('currentCustomer');
        let customerId = null;
        let affiliateId = null;
        let customerBags = 1; // Default
        
        if (customerData) {
            const customer = JSON.parse(customerData);
            // Try multiple possible ID fields
            customerId = customer._id || customer.id || customer.customerId;
            affiliateId = customer.affiliateId || customer.affiliate?.affiliateId || customer.affiliate?._id;
            // Get customer's bag count
            customerBags = customer.numberOfBags || customer.initialBagsRequested || 1;
            
            // If still no customer ID, try decoding the token
            if (!customerId && token) {
                try {
                    const tokenParts = token.split('.');
                    if (tokenParts.length === 3) {
                        const payload = JSON.parse(atob(tokenParts[1]));
                        customerId = customerId || payload.userId || payload.id || payload._id;
                        affiliateId = affiliateId || payload.affiliateId;
                        console.log('[Schedule V2 Embed] Decoded token payload:', payload);
                    }
                } catch (e) {
                    console.error('[Schedule V2 Embed] Failed to decode token:', e);
                }
            }
            
            console.log('[Schedule V2 Embed] Customer ID:', customerId, 'Affiliate ID:', affiliateId);
        }
        
        // Add required IDs to data
        if (customerId) data.customerId = customerId;
        if (affiliateId) data.affiliateId = affiliateId;
        
        // Set numberOfBags - use form value if provided, otherwise use customer's bag count
        if (!data.numberOfBags) {
            data.numberOfBags = customerBags;
            console.log('[Schedule V2 Embed] Using customer bag count:', customerBags);
        }
        
        // Set estimated weight based on bags (always calculate, not user input)
        data.estimatedWeight = parseInt(data.numberOfBags || 1) * 20;
        
        // Validate required fields
        const requiredFields = ['pickupDate', 'pickupTime', 'numberOfBags', 'customerId', 'affiliateId'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            console.error('[Schedule V2 Embed] Missing required fields:', missingFields);
            console.log('[Schedule V2 Embed] Current form data:', data);
            
            // Show error to user
            if (spinner) spinner.hide();
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
            if (submitBtn) submitBtn.disabled = false;
            
            alert('Missing required fields: ' + missingFields.join(', ') + '. Please fill in all required fields.');
            return;
        }
        
        console.log('[Schedule V2 Embed] Using token:', token ? 'Token found' : 'No token available');
        console.log('[Schedule V2 Embed] Submitting order data:', data);
        
        try {
            const result = await ApiClient.post('/api/orders', data, {
                showLoading: true,
                loadingMessage: spinner ? undefined : 'Scheduling your pickup...',
                headers: {
                    'Authorization': token ? 'Bearer ' + token : ''
                }
            });
            
            console.log('[Schedule V2 Embed] Response data:', result);
            
            if (spinner) spinner.hide();
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
            if (submitBtn) submitBtn.disabled = false;
            
            if (result.success) {
                // Show success using the showScheduleSuccess function
                showScheduleSuccess(result.order);
                // Also show modal if it exists
                if (successModal) successModal.classList.remove('hidden');
            } else {
                if (window.ModalSystem && window.ModalSystem.error) {
                    window.ModalSystem.error(result.message || 'Failed to schedule pickup. Please try again.', 'Scheduling Error');
                } else {
                    alert(result.message || 'Failed to schedule pickup. Please try again.');
                }
                if (submitBtn) submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('[Schedule V2 Embed] Error scheduling pickup:', error);
            
            if (spinner) spinner.hide();
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
            if (submitBtn) submitBtn.disabled = false;
            
            if (window.ModalSystem && window.ModalSystem.error) {
                window.ModalSystem.error('An error occurred. Please try again.', 'Scheduling Error');
            } else {
                alert('An error occurred. Please try again.');
            }
        }
    }
    
    // Setup dashboard button click handler
    window.goToDashboard = function() {
        window.location.href = '/customer-dashboard-embed.html';
    };
    
    // Load customer and affiliate information
    async function loadCustomerAndAffiliateInfo(token) {
        try {
            // Fetch customer info
            const customerData = await ApiClient.get('/api/customers/me', {
                showError: false,
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            
            if (customerData.customer) {
                // Populate bag options based on customer's initial selection
                // Check for numberOfBags first, then initialBagsRequested, default to 1
                const bags = customerData.customer.numberOfBags || customerData.customer.initialBagsRequested || 1;
                window.populateBagOptions(bags);
                
                // Store customer data
                localStorage.setItem('currentCustomer', JSON.stringify(customerData.customer));
                
                // Load affiliate info if available
                if (customerData.customer.affiliateId) {
                    await loadAffiliateInfo(customerData.customer.affiliateId);
                }
            }
        } catch (error) {
            console.error('[Schedule V2 Embed] Error loading customer info:', error);
        }
    }
    
    // Load affiliate information
    async function loadAffiliateInfo(affiliateId) {
        try {
            console.log('[Schedule V2 Embed] Loading affiliate info for ID:', affiliateId);

            if (!affiliateId) {
                console.warn('[Schedule V2 Embed] No affiliate ID provided');
                return;
            }

            const data = await ApiClient.get(`/api/affiliates/${affiliateId}/public`, {
                showError: false
            });

            console.log('[Schedule V2 Embed] API response:', data);
            if (data && data.affiliate) {
                // Update affiliate name in the subtitle
                const affiliateNameEl = document.getElementById('affiliateName');
                if (affiliateNameEl) {
                    const name = data.affiliate.businessName ||
                                `${data.affiliate.firstName} ${data.affiliate.lastName}`;
                    affiliateNameEl.textContent = name;
                    console.log('[Schedule V2 Embed] Affiliate name set to:', name);
                }
            }

            // Fetch affiliate availability schedule
            affiliateAvailability = await fetchAffiliateAvailability(affiliateId);
            if (affiliateAvailability) {
                console.log('[Schedule V2 Embed] Availability loaded, updating time slots');
                updateTimeSlotAvailability();
            }
        } catch (error) {
            console.warn('[Schedule V2 Embed] Failed to load affiliate info:', error);
        }
    }
    
    // Update add-ons display in pricing section
    window.updateAddonsDisplay = function() {
        console.log('[Schedule V2 Embed] updateAddonsDisplay called');
        
        const selectedAddons = [];
        const addonNames = {
            'premiumDetergent': 'Premium Detergent',
            'fabricSoftener': 'Fabric Softener',
            'stainRemover': 'Stain Remover'
        };
        
        // Check which add-ons are selected
        const checkedBoxes = document.querySelectorAll('.addon-checkbox:checked');
        console.log('[Schedule V2 Embed] Checked addon boxes:', checkedBoxes.length);
        
        checkedBoxes.forEach(checkbox => {
            const addonKey = checkbox.value;
            if (addonNames[addonKey]) {
                selectedAddons.push(addonNames[addonKey]);
            }
        });
        
        const addonsLineItem = document.getElementById('addonsLineItem');
        const addonsRate = document.getElementById('addonsRate');
        const selectedAddonsText = document.getElementById('selectedAddonsText');
        
        console.log('[Schedule V2 Embed] Selected addons:', selectedAddons);
        console.log('[Schedule V2 Embed] addonsLineItem element:', addonsLineItem);
        
        if (selectedAddons.length > 0) {
            // Show the add-ons line item
            if (addonsLineItem) {
                addonsLineItem.classList.remove('hidden');
                addonsLineItem.classList.add('flex');
            }
            
            // Calculate total add-on rate
            const addonRatePerItem = 0.10;
            const totalAddonRate = selectedAddons.length * addonRatePerItem;
            if (addonsRate) addonsRate.textContent = `+$${totalAddonRate.toFixed(2)}/lb`;
            
            // Show selected add-ons (abbreviated if many)
            if (selectedAddonsText) {
                if (selectedAddons.length === 1) {
                    selectedAddonsText.textContent = `(${selectedAddons[0]})`;
                } else if (selectedAddons.length === 2) {
                    selectedAddonsText.textContent = `(${selectedAddons.join(', ')})`;
                } else {
                    selectedAddonsText.textContent = `(${selectedAddons.length} selected)`;
                }
            }
        } else {
            // Hide the add-ons line item
            if (addonsLineItem) {
                addonsLineItem.classList.add('hidden');
                addonsLineItem.classList.remove('flex');
            }
        }
    }
    
    // Populate bag options based on customer's initial selection
    window.populateBagOptions = function(maxBags) {
        console.log('[Schedule V2 Embed] populateBagOptions called with maxBags:', maxBags);
        
        const selectEl = document.getElementById('numberOfBags');
        const bagsContainer = selectEl ? selectEl.closest('div') : null;
        
        console.log('[Schedule V2 Embed] Bags select element:', selectEl);
        console.log('[Schedule V2 Embed] Bags container:', bagsContainer);
        
        if (!selectEl || !bagsContainer) {
            console.log('[Schedule V2 Embed] Missing bags elements, returning');
            return;
        }
        
        const bagCount = parseInt(maxBags) || 1;
        console.log('[Schedule V2 Embed] Bag count:', bagCount);
        
        if (bagCount === 1) {
            // Hide the entire bags section for single bag customers
            bagsContainer.classList.add('hidden');
            
            // Create a hidden input with value 1
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = 'numberOfBags';
            hiddenInput.value = '1';
            hiddenInput.id = 'numberOfBagsHidden';
            
            // Remove any existing hidden input
            const existingHidden = document.getElementById('numberOfBagsHidden');
            if (existingHidden) {
                existingHidden.remove();
            }
            
            // Add the hidden input after the container
            bagsContainer.parentNode.insertBefore(hiddenInput, bagsContainer.nextSibling);
            
            // Disable the select to prevent it from being submitted
            selectEl.disabled = true;
            selectEl.required = false;
        } else {
            // Show the bags section for multiple bag customers
            bagsContainer.classList.remove('hidden');
            
            // Clear existing options
            selectEl.innerHTML = '';
            
            // Enable the select
            selectEl.disabled = false;
            selectEl.required = true;
            
            // Add options up to the customer's initial bag count
            for (let i = 1; i <= bagCount; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i === 1 ? '1 Bag' : `${i} Bags`;
                selectEl.appendChild(option);
            }
            
            // Set default value to the maximum bags they have
            selectEl.value = bagCount;
            
            // Remove hidden input if it exists
            const existingHidden = document.getElementById('numberOfBagsHidden');
            if (existingHidden) {
                existingHidden.remove();
            }
        }
    }
    
    // Load pricing info from system config
    async function loadPricingInfo() {
        try {
            // Fetch WDF rate from system config
            const wdfData = await ApiClient.get('/api/v1/system/config/public/wdf_base_rate_per_pound', {
                showError: false
            });
            const wdfRate = wdfData.currentValue || 1.25;
            
            // Update WDF rate display
            const wdfRateElement = document.getElementById('wdfRate');
            if (wdfRateElement) {
                wdfRateElement.textContent = `$${wdfRate.toFixed(2)}/lb`;
            }
            
            // Calculate and display minimum charge (assuming 20 lbs minimum)
            const minimumWeight = 20;
            const minimumCharge = wdfRate * minimumWeight;
            const minimumChargeElement = document.getElementById('minimumCharge');
            if (minimumChargeElement) {
                minimumChargeElement.textContent = `$${minimumCharge.toFixed(2)}`;
            }
            
            console.log('[Schedule V2 Embed] Pricing loaded - WDF: $' + wdfRate + '/lb, Min: $' + minimumCharge);
        } catch (error) {
            console.error('[Schedule V2 Embed] Error loading pricing:', error);
            // Use defaults if fetch fails
            const wdfEl = document.getElementById('wdfRate');
            const minEl = document.getElementById('minimumCharge');
            if (wdfEl) wdfEl.textContent = '$1.25/lb';
            if (minEl) minEl.textContent = '$25.00';
        }
    }
    
    // Show registration success modal
    function showRegistrationSuccess(customer) {
        const successModal = document.getElementById('registrationSuccessModal');
        if (successModal) {
            successModal.classList.remove('hidden');
            
            // Customize message with customer name
            const messageEl = successModal.querySelector('.success-message');
            if (messageEl && customer.firstName) {
                messageEl.textContent = `Welcome ${customer.firstName}! Your registration is complete.`;
            }
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                successModal.classList.add('hidden');
            }, 5000);
        }
    }
    
    // Show schedule success section
    function showScheduleSuccess(order) {
        const successSection = document.getElementById('scheduleSuccessSection');
        const formSection = document.getElementById('scheduleFormSection');
        
        if (successSection && formSection) {
            formSection.classList.add('hidden');
            successSection.classList.remove('hidden');
            
            // Update order details
            if (order) {
                const orderIdEl = document.getElementById('orderId');
                const pickupDateEl = document.getElementById('confirmedPickupDate');
                const pickupTimeEl = document.getElementById('confirmedPickupTime');
                
                if (orderIdEl) orderIdEl.textContent = order.orderNumber || order._id;
                if (pickupDateEl) pickupDateEl.textContent = formatDate(order.pickupDate);
                if (pickupTimeEl) pickupTimeEl.textContent = order.pickupTime || 'Morning (8 AM - 12 PM)';
            }
        }
    }
    
    // Format date for display
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();