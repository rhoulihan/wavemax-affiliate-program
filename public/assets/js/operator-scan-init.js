(function() {
    'use strict';

    // Configuration
    const config = window.EMBED_CONFIG || {
        baseUrl: 'https://wavemax.promo'
    };
    const BASE_URL = config.baseUrl;
    
    // Use csrfFetch if available, otherwise fall back to regular fetch
    const csrfFetch = window.CsrfUtils && window.CsrfUtils.csrfFetch ? window.CsrfUtils.csrfFetch : fetch;

    // State
    let currentOrder = null;
    let scanBuffer = '';
    let scanTimeout = null;
    let confirmationTimeout = null;
    let operatorData = null;
    let statsInterval = null;

    // DOM elements
    const operatorName = document.getElementById('operatorName');
    const scanInput = document.getElementById('scanInput');
    const orderModal = document.getElementById('orderModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmIcon = document.getElementById('confirmIcon');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');

    // Stats elements
    const ordersToday = document.getElementById('ordersToday');
    const bagsScanned = document.getElementById('bagsScanned');
    const ordersReady = document.getElementById('ordersReady');

    // Initialize
    async function init() {
        // Check authentication
        const token = localStorage.getItem('operatorToken');
        if (!token) {
            window.location.href = '/operator-login-embed.html';
            return;
        }
        
        // Verify token is still valid by making a test request
        try {
            const testResponse = await fetch(`${BASE_URL}/api/v1/operators/stats/today`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (testResponse.status === 401) {
                console.error('Operator token is invalid or expired');
                localStorage.removeItem('operatorToken');
                localStorage.removeItem('operatorData');
                window.location.href = '/operator-login-embed.html';
                return;
            }
        } catch (error) {
            console.error('Error verifying operator token:', error);
        }

        // Initialize CSRF token
        try {
            await CsrfUtils.fetchCsrfToken();
            console.log('CSRF token initialized');
        } catch (error) {
            console.error('Failed to initialize CSRF token:', error);
        }

        // Disable ModalSystem if it exists to prevent interference
        if (window.ModalSystem) {
            console.log('Disabling ModalSystem to prevent interference');
            window.ModalSystem.closeActiveModal = function() {};
            window.ModalSystem.showModal = function() {};
        }
        
        // Override ErrorHandler to redirect on auth errors
        if (window.ErrorHandler) {
            const originalShowError = window.ErrorHandler.showError;
            window.ErrorHandler.showError = function(message, timeout) {
                // Check if this is an authentication error
                if (message && (
                    message.toLowerCase().includes('unauthorized') ||
                    message.toLowerCase().includes('authentication') ||
                    message.toLowerCase().includes('token') ||
                    message.toLowerCase().includes('expired') ||
                    message.toLowerCase().includes('invalid session') ||
                    message.toLowerCase().includes('401')
                )) {
                    // Redirect to affiliate landing page
                    console.log('Authentication error detected by ErrorHandler, redirecting...');
                    clearInterval(statsInterval);
                    localStorage.removeItem('operatorToken');
                    localStorage.removeItem('operatorData');
                    window.top.location.href = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program';
                    return;
                }
                // For other errors, use the original handler
                originalShowError.call(this, message, timeout);
            };
            
            // Also override handleFetchError
            const originalHandleFetchError = window.ErrorHandler.handleFetchError;
            window.ErrorHandler.handleFetchError = async function(response) {
                if (response.status === 401) {
                    // Don't show error, just redirect
                    console.log('401 error detected by ErrorHandler.handleFetchError, redirecting...');
                    clearInterval(statsInterval);
                    localStorage.removeItem('operatorToken');
                    localStorage.removeItem('operatorData');
                    window.top.location.href = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program';
                    return response;
                }
                // For other errors, use the original handler
                return originalHandleFetchError.call(this, response);
            };
        }

        // Hide any existing error containers
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.style.display = 'none';
            errorContainer.classList.add('hidden');
        }
        
        // Get operator data
        operatorData = JSON.parse(localStorage.getItem('operatorData') || '{}');
        operatorName.textContent = operatorData.name || 'Operator';
        
        console.log('Operator data:', operatorData);
        console.log('Token present:', !!token);

        // Load stats
        await loadStats();

        // Focus on scan input
        focusScanner();

        // Set up event listeners
        setupEventListeners();

        // Update stats every 30 seconds
        statsInterval = setInterval(loadStats, 30000);
    }

    // Load operator stats
    async function loadStats() {
        try {
            const token = localStorage.getItem('operatorToken');
            if (!token) {
                // No token, redirect to login
                clearInterval(statsInterval);
                window.location.href = '/operator-login-embed.html';
                return;
            }
            
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/stats/today`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // Check for renewed token in response headers
            const renewedToken = response.headers.get('X-Renewed-Token');
            const tokenRenewed = response.headers.get('X-Token-Renewed');
            
            if (tokenRenewed === 'true' && renewedToken) {
                // Update stored token with renewed one
                console.log('Token renewed by server, updating local storage');
                localStorage.setItem('operatorToken', renewedToken);
            }

            if (response.ok) {
                const data = await response.json();
                ordersToday.textContent = data.ordersProcessed || 0;
                bagsScanned.textContent = data.bagsScanned || 0;
                ordersReady.textContent = data.ordersReady || 0;
            } else if (response.status === 401) {
                // Unauthorized - token might be expired
                console.error('Operator token expired or invalid');
                clearInterval(statsInterval);
                localStorage.removeItem('operatorToken');
                localStorage.removeItem('operatorData');
                window.location.href = '/operator-login-embed.html';
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        // Scanner input handling
        scanInput.addEventListener('input', handleScanInput);
        scanInput.addEventListener('blur', () => {
            // Only refocus if no modal is open and not focusing on an input
            setTimeout(() => {
                const activeElement = document.activeElement;
                const isInputFocused = activeElement && 
                    (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
                
                if (orderModal.style.display !== 'block' && !isInputFocused) {
                    focusScanner();
                }
            }, 100);
        });

        // Keep focus on scanner input
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.modal') && !e.target.closest('button')) {
                focusScanner();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        });

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                logout();
            });
        }
        
        // Manual input button
        const manualInputBtn = document.getElementById('manualInputBtn');
        if (manualInputBtn) {
            manualInputBtn.addEventListener('click', showManualInput);
        }
        
        // Modal close button
        const modalCloseBtn = document.getElementById('modalCloseBtn');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeModal);
        }
    }

    // Focus scanner input
    function focusScanner() {
        scanInput.focus();
        scanInput.select();
    }

    // Handle scanner input
    function handleScanInput(e) {
        const value = e.target.value;
        
        // Clear any existing timeout
        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }

        // Add to buffer
        scanBuffer += value;
        scanInput.value = '';

        // Process after a short delay (scanner sends data quickly)
        scanTimeout = setTimeout(() => {
            if (scanBuffer.length > 0) {
                processScan(scanBuffer.trim());
                scanBuffer = '';
            }
        }, 100);
    }

    // Helper function to check for renewed token
    function checkAndUpdateToken(response) {
        const renewedToken = response.headers.get('X-Renewed-Token');
        const tokenRenewed = response.headers.get('X-Token-Renewed');
        
        if (tokenRenewed === 'true' && renewedToken) {
            console.log('Token renewed by server, updating local storage');
            localStorage.setItem('operatorToken', renewedToken);
        }
    }

    // Process scanned code
    async function processScan(scanData) {
        try {
            showConfirmation('Scanning...', '🔍', 'info');

            const token = localStorage.getItem('operatorToken');
            
            console.log('Processing scan with token:', token ? 'Present' : 'Missing');
            console.log('CSRF token status:', CsrfUtils.getToken() ? 'Present' : 'Missing');
            
            // Use scan-customer endpoint - bags have customer IDs on them
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/scan-customer`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    customerId: scanData
                })
            });
            
            // Check for token renewal
            checkAndUpdateToken(response);

            if (!response.ok) {
                console.error('Scan failed:', response.status, response.statusText);
                
                // Handle 401 Unauthorized
                if (response.status === 401) {
                    console.error('Operator token expired or invalid');
                    clearInterval(statsInterval);
                    localStorage.removeItem('operatorToken');
                    localStorage.removeItem('operatorData');
                    window.location.href = '/operator-login-embed.html';
                    return;
                }
                
                const responseText = await response.text();
                console.error('Response body:', responseText);
                
                try {
                    const data = JSON.parse(responseText);
                    showError(data.message || data.error || 'Invalid scan');
                } catch (e) {
                    showError(`Error ${response.status}: ${response.statusText}`);
                }
                return;
            }
            
            const data = await response.json();
            if (data.success) {
                handleScanResponse(data);
            } else {
                hideConfirmation();
                showError(data.message || 'Invalid scan');
            }
        } catch (error) {
            console.error('Scan error:', error);
            hideConfirmation();
            showError('Network error. Please try again.');
        }
    }

    // Handle scan response based on order status
    function handleScanResponse(data) {
        const { order, action } = data;
        
        // Hide the scanning confirmation first
        hideConfirmation();

        switch (action) {
            case 'weight_input':
                // First scan - need weight input
                showWeightInputModal(order);
                break;

            case 'process_complete':
                // Second scan - mark bag as processed after WDF
                handleProcessComplete(order);
                break;

            case 'pickup_scan':
                // Third scan - scanning for pickup by affiliate
                handlePickupScan(order);
                break;

            default:
                showConfirmation(`Order ${order.orderId} - Status: ${action}`, '✓', 'success');
        }
    }

    // Show weight input modal
    function showWeightInputModal(order) {
        console.log('showWeightInputModal called');
        console.log('orderModal element:', orderModal);
        console.log('orderModal display before:', orderModal?.style.display);
        
        currentOrder = order;
        modalTitle.textContent = 'Enter Bag Weights';

        // Calculate how many bags still need weights
        const bagsToWeigh = order.numberOfBags - (order.bagsWeighed || 0);

        let html = `
            <div class="order-info">
                <h4>Order ${order.orderId}</h4>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Customer</div>
                        <div class="info-value">${order.customerName || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Affiliate</div>
                        <div class="info-value">${order.affiliateName || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Total Bags</div>
                        <div class="info-value">${order.numberOfBags}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Bags Weighed</div>
                        <div class="info-value">${order.bagsWeighed || 0}</div>
                    </div>
                </div>
            </div>

            <div class="weight-input-section">
                <h5>Enter weight for ${bagsToWeigh} bag${bagsToWeigh > 1 ? 's' : ''}:</h5>
        `;

        // Create weight inputs for remaining bags
        const startBag = (order.bagsWeighed || 0) + 1;
        for (let i = startBag; i <= order.numberOfBags; i++) {
            html += `
                <div class="bag-weight-input">
                    <label>Bag ${i}:</label>
                    <input type="number" 
                           id="bagWeight${i}" 
                           step="0.1" 
                           min="0.1" 
                           placeholder="Weight in lbs">
                </div>
            `;
        }

        html += `
            </div>
            <div class="action-buttons">
                <button class="btn btn-secondary" id="cancelWeightModalBtn">Cancel</button>
                <button class="btn btn-primary" id="submitWeightsBtn">Mark as In Progress</button>
            </div>
        `;

        modalBody.innerHTML = html;
        
        // Use multiple strategies to ensure modal stays visible
        console.log('Setting modal to visible');
        
        // Strategy 1: Set display immediately
        orderModal.style.setProperty('display', 'block', 'important');
        orderModal.setAttribute('data-force-visible', 'true');
        
        // Temporarily remove the 'modal' class to avoid being targeted by modal-utils.js
        orderModal.classList.remove('modal');
        orderModal.classList.add('weight-input-modal-active');
        
        // Strategy 2: Use requestAnimationFrame to show after next paint
        requestAnimationFrame(() => {
            orderModal.style.setProperty('display', 'block', 'important');
            console.log('Modal display set in requestAnimationFrame');
        });
        
        // Strategy 3: Use multiple setTimeout calls
        [0, 10, 50, 100, 200, 500].forEach(delay => {
            setTimeout(() => {
                if (orderModal.getAttribute('data-force-visible') === 'true') {
                    orderModal.style.setProperty('display', 'block', 'important');
                    console.log(`Modal display reinforced at ${delay}ms`);
                }
            }, delay);
        });
        
        // Prevent click events OUTSIDE the modal from propagating
        const preventClickPropagation = (e) => {
            // Only prevent if click is outside the modal
            if (orderModal.getAttribute('data-force-visible') === 'true' && 
                !orderModal.contains(e.target)) {
                console.log('Preventing outside click event from closing modal');
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
            }
            // Allow clicks inside the modal to work normally
        };
        
        // Add capture phase listener to intercept ALL clicks
        document.addEventListener('click', preventClickPropagation, true);
        orderModal._clickInterceptor = preventClickPropagation;
        
        // Override the modal element's style property to prevent hiding
        const originalStyleDescriptor = Object.getOwnPropertyDescriptor(orderModal.style, 'display');
        Object.defineProperty(orderModal.style, 'display', {
            get: function() {
                return 'block';
            },
            set: function(value) {
                if (orderModal.getAttribute('data-force-visible') === 'true' && value === 'none') {
                    console.log('Blocked attempt to hide modal via style.display');
                    return;
                }
                if (originalStyleDescriptor && originalStyleDescriptor.set) {
                    originalStyleDescriptor.set.call(this, value);
                }
            },
            configurable: true
        });
        
        // Store the original descriptor so we can restore it later
        orderModal._originalStyleDescriptor = originalStyleDescriptor;
        
        // Prevent modal from being removed from DOM
        const originalRemove = orderModal.remove;
        orderModal.remove = function() {
            if (orderModal.getAttribute('data-force-visible') === 'true') {
                console.log('Blocked attempt to remove modal from DOM');
                return;
            }
            originalRemove.call(this);
        };
        orderModal._originalRemove = originalRemove;
        
        // Also override parentNode.removeChild
        if (orderModal.parentNode) {
            const originalRemoveChild = orderModal.parentNode.removeChild;
            orderModal.parentNode.removeChild = function(child) {
                if (child === orderModal && orderModal.getAttribute('data-force-visible') === 'true') {
                    console.log('Blocked attempt to remove modal via removeChild');
                    return child;
                }
                return originalRemoveChild.call(this, child);
            };
            orderModal._originalRemoveChild = originalRemoveChild;
        }
        
        // Prevent ESC key from closing modal
        const preventEscKey = (e) => {
            if (e.key === 'Escape' && orderModal.getAttribute('data-force-visible') === 'true') {
                console.log('Preventing ESC key from closing modal');
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
            }
        };
        document.addEventListener('keydown', preventEscKey, true);
        orderModal._escInterceptor = preventEscKey;
        
        // Add event listeners to weight inputs for updates on blur only
        setTimeout(() => {
            const updateBagsWeighedCount = () => {
                // Start with already weighed bags
                let baseWeighedCount = order.bagsWeighed || 0;
                let newWeighedCount = 0;
                
                // Count how many new bags have weights entered
                for (let i = startBag; i <= order.numberOfBags; i++) {
                    const input = document.getElementById(`bagWeight${i}`);
                    if (input && input.value && parseFloat(input.value) > 0) {
                        newWeighedCount++;
                    }
                }
                
                // Total is base + new
                const totalWeighed = baseWeighedCount + newWeighedCount;
                
                // Update the display
                const bagsWeighedDisplay = document.querySelector('.info-item:nth-child(4) .info-value');
                if (bagsWeighedDisplay) {
                    bagsWeighedDisplay.textContent = totalWeighed;
                }
            };
            
            // Add blur listeners to all weight fields (only update when focus leaves)
            for (let i = startBag; i <= order.numberOfBags; i++) {
                const input = document.getElementById(`bagWeight${i}`);
                if (input) {
                    // Only update count when focus leaves the field (blur event)
                    input.addEventListener('blur', (e) => {
                        // Only update if there's a valid value
                        if (e.target.value && parseFloat(e.target.value) > 0) {
                            updateBagsWeighedCount();
                        }
                    });
                    
                    // Also ensure focus works properly
                    input.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.target.focus();
                    });
                }
            }
            
            // Add event listeners to buttons
            const cancelBtn = document.getElementById('cancelWeightModalBtn');
            const submitBtn = document.getElementById('submitWeightsBtn');
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', closeModal);
            }
            
            if (submitBtn) {
                submitBtn.addEventListener('click', submitWeights);
            }
            
            // Focus on first input
            const firstInput = document.getElementById(`bagWeight${startBag}`);
            if (firstInput) {
                firstInput.focus();
            }
        }, 300);
    }

    // Handle process complete scan (after WDF)
    function handleProcessComplete(order) {
        currentOrder = order;
        
        // Automatically mark bag as processed
        markBagProcessed();
    }

    // Mark bag as processed
    async function markBagProcessed() {
        try {
            const token = localStorage.getItem('operatorToken');
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/orders/${currentOrder.orderId}/process-bag`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Check for token renewal
            checkAndUpdateToken(response);

            const data = await response.json();

            if (response.ok && data.success) {
                if (data.orderReady) {
                    showConfirmation(
                        `All ${data.totalBags} bags processed! Affiliate notified for pickup.`,
                        '✅',
                        'success'
                    );
                } else {
                    showConfirmation(
                        `Bag ${data.bagsProcessed} of ${data.totalBags} processed`,
                        '✓',
                        'success'
                    );
                }
                await loadStats();
                setTimeout(hideConfirmation, 3000);
            } else {
                showError(data.message || 'Failed to mark bag as processed');
            }
        } catch (error) {
            console.error('Process complete error:', error);
            showError('Network error. Please try again.');
        }
    }

    // Show ready confirmation modal (deprecated)
    function showReadyConfirmModal(order) {
        currentOrder = order;
        modalTitle.textContent = 'Confirm Order Ready';

        const html = `
            <div class="order-info">
                <h4>Order ${order.orderId}</h4>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Customer</div>
                        <div class="info-value">${order.customerName || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Affiliate</div>
                        <div class="info-value">${order.affiliateName || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Total Weight</div>
                        <div class="info-value">${order.actualWeight} lbs</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Bags</div>
                        <div class="info-value">${order.numberOfBags}</div>
                    </div>
                </div>
                <div style="margin-top: 20px; padding: 15px; background: #e8f8f5; border-radius: 8px;">
                    <p style="color: #27ae60; font-weight: 500;">
                        ✓ All ${order.numberOfBags} bags have been processed and are ready for pickup
                    </p>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="confirmReady()">Confirm Ready for Pickup</button>
            </div>
        `;

        modalBody.innerHTML = html;
        orderModal.style.display = 'block';
    }

    // Handle pickup scan (auto-dismiss)
    function handlePickupScan(order) {
        // Track current order for pickup
        currentOrder = order;

        // Clear existing timeout
        if (confirmationTimeout) {
            clearTimeout(confirmationTimeout);
        }

        // Show pickup progress
        const bagsRemaining = order.numberOfBags - (order.bagsPickedUp || 0);
        showConfirmation(
            `Order ${order.orderId} - Scanning bag (${order.bagsPickedUp + 1}/${order.numberOfBags})`,
            '📦',
            'success'
        );

        // Auto-dismiss after 5 seconds and confirm pickup of one bag
        confirmationTimeout = setTimeout(() => {
            confirmPickup(1); // Confirm pickup of 1 bag
        }, 5000);
    }

    // Submit weights
    const submitWeights = async function() {
        const weights = [];
        let totalWeight = 0;

        // Only get weights for bags that haven't been weighed yet
        const startBag = (currentOrder.bagsWeighed || 0) + 1;
        for (let i = startBag; i <= currentOrder.numberOfBags; i++) {
            const weightInput = document.getElementById(`bagWeight${i}`);
            if (!weightInput) continue;
            
            const weight = parseFloat(weightInput.value);
            if (!weight || weight <= 0) {
                showError(`Please enter weight for Bag ${i}`);
                return;
            }
            weights.push({ bagNumber: i, weight });
            totalWeight += weight;
        }

        // Add to any existing weight
        if (currentOrder.actualWeight) {
            totalWeight += currentOrder.actualWeight;
        }

        try {
            const token = localStorage.getItem('operatorToken');
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/orders/${currentOrder.orderId}/receive`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    bagWeights: weights,
                    totalWeight: totalWeight
                })
            });
            
            // Check for token renewal
            checkAndUpdateToken(response);

            const data = await response.json();

            if (response.ok && data.success) {
                closeModal();
                showConfirmation('Order marked as in progress', '✓', 'success');
                await loadStats();
            } else {
                showError(data.message || 'Failed to update order');
            }
        } catch (error) {
            console.error('Submit error:', error);
            showError('Network error. Please try again.');
        }
    };

    // Confirm ready for pickup
    const confirmReady = async function() {
        try {
            const token = localStorage.getItem('operatorToken');
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/orders/${currentOrder.orderId}/ready`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                closeModal();
                showConfirmation('Order marked as ready for pickup', '✓', 'success');
                await loadStats();
            } else {
                showError(data.message || 'Failed to update order');
            }
        } catch (error) {
            console.error('Confirm error:', error);
            showError('Network error. Please try again.');
        }
    };

    // Confirm pickup
    async function confirmPickup(numberOfBags = 1) {
        if (!currentOrder) return;

        try {
            const token = localStorage.getItem('operatorToken');
            
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/confirm-pickup`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    orderId: currentOrder.orderId,
                    numberOfBags: numberOfBags 
                })
            });
            
            // Check for token renewal
            checkAndUpdateToken(response);

            const data = await response.json();
            
            if (response.ok) {
                await loadStats();
                
                // Check if order is complete
                if (data.orderComplete) {
                    showConfirmation(`Order ${currentOrder.orderId} complete! Customer notified.`, '✅', 'success');
                    setTimeout(hideConfirmation, 3000);
                }
            }
        } catch (error) {
            console.error('Pickup confirmation error:', error);
        }

        hideConfirmation();
    }

    // Show confirmation message
    function showConfirmation(message, icon = '✓', type = 'success') {
        confirmTitle.textContent = type === 'success' ? 'Success' : 'Processing';
        confirmMessage.textContent = message;
        confirmIcon.textContent = icon;
        confirmationModal.className = `confirmation-modal ${type}`;
        confirmationModal.style.display = 'block';
    }

    // Hide confirmation
    function hideConfirmation() {
        confirmationModal.style.display = 'none';
        if (confirmationTimeout) {
            clearTimeout(confirmationTimeout);
            confirmationTimeout = null;
        }
    }

    // Show error
    function showError(message) {
        // Check if this is an authentication error
        if (message && (
            message.toLowerCase().includes('unauthorized') ||
            message.toLowerCase().includes('authentication') ||
            message.toLowerCase().includes('token') ||
            message.toLowerCase().includes('expired') ||
            message.toLowerCase().includes('invalid session')
        )) {
            // Redirect to affiliate landing page for auth errors
            console.log('Authentication error detected, redirecting...');
            clearInterval(statsInterval);
            localStorage.removeItem('operatorToken');
            localStorage.removeItem('operatorData');
            window.top.location.href = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program';
            return;
        }
        
        // For other errors, show the confirmation modal
        showConfirmation(message, '❌', 'error');
        setTimeout(hideConfirmation, 3000);
    }

    // Close modal
    const closeModal = function() {
        // Remove the force-visible attribute
        orderModal.removeAttribute('data-force-visible');
        
        // Restore the modal class
        orderModal.classList.add('modal');
        orderModal.classList.remove('weight-input-modal-active');
        
        // Remove click interceptor
        if (orderModal._clickInterceptor) {
            document.removeEventListener('click', orderModal._clickInterceptor, true);
            delete orderModal._clickInterceptor;
        }
        
        // Remove ESC key interceptor
        if (orderModal._escInterceptor) {
            document.removeEventListener('keydown', orderModal._escInterceptor, true);
            delete orderModal._escInterceptor;
        }
        
        // Restore original style descriptor
        if (orderModal._originalStyleDescriptor) {
            Object.defineProperty(orderModal.style, 'display', orderModal._originalStyleDescriptor);
            delete orderModal._originalStyleDescriptor;
        }
        
        // Restore original remove method
        if (orderModal._originalRemove) {
            orderModal.remove = orderModal._originalRemove;
            delete orderModal._originalRemove;
        }
        
        // Restore original removeChild method
        if (orderModal.parentNode && orderModal._originalRemoveChild) {
            orderModal.parentNode.removeChild = orderModal._originalRemoveChild;
            delete orderModal._originalRemoveChild;
        }
        
        // Now we can safely hide the modal
        orderModal.style.display = 'none';
        currentOrder = null;
        focusScanner();
    };

    // Show manual input
    const showManualInput = function() {
        const id = prompt('Enter Customer ID (e.g., CUST123456) or Bag ID:');
        if (id && id.trim()) {
            processScan(id.trim());
        }
    };

    // Logout
    const logout = function() {
        localStorage.removeItem('operatorToken');
        localStorage.removeItem('operatorRefreshToken');
        localStorage.removeItem('operatorData');
        
        // Clear session manager data if available
        if (window.SessionManager) {
            window.SessionManager.clearAuth('operator');
        }
        
        // Redirect to the parent page URL
        window.top.location.href = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program';
    };

    // Initialize on DOM ready (only once)
    let initialized = false;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!initialized) {
                initialized = true;
                init();
            }
        });
    } else {
        if (!initialized) {
            initialized = true;
            init();
        }
    }
})();