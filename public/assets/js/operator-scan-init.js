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

    // Stats elements - will be populated in init
    let ordersToday = null;
    let bagsScanned = null;
    let ordersReady = null;

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
            errorContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
        }
        
        // Get operator data
        operatorData = JSON.parse(localStorage.getItem('operatorData') || '{}');
        operatorName.textContent = operatorData.name || 'Operator';
        
        console.log('Operator data:', operatorData);
        console.log('Token present:', !!token);
        
        // Get stats elements after page is loaded
        ordersToday = document.getElementById('ordersToday');
        bagsScanned = document.getElementById('bagsScanned');
        ordersReady = document.getElementById('ordersReady');
        
        console.log('Stats elements found after init:', {
            ordersToday: ordersToday ? 'Found' : 'Missing',
            bagsScanned: bagsScanned ? 'Found' : 'Missing',
            ordersReady: ordersReady ? 'Found' : 'Missing'
        });
        
        // Removed debug API calls that were returning 403

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
        console.log('=== LOADING STATS ===');
        console.log('Current operator data:', operatorData);
        console.log('Operator ID:', operatorData?.id || 'No ID');
        
        try {
            const token = localStorage.getItem('operatorToken');
            if (!token) {
                // No token, redirect to login
                clearInterval(statsInterval);
                window.location.href = '/operator-login-embed.html';
                return;
            }
            
            // Get current date in different formats to test
            const now = new Date();
            const localDate = now.toLocaleDateString('en-US');
            const isoDate = now.toISOString().split('T')[0];
            
            console.log('Fetching stats from:', `${BASE_URL}/api/v1/operators/stats/today`);
            console.log('Current date (local):', localDate);
            console.log('Current date (ISO):', isoDate);
            console.log('With token:', token.substring(0, 20) + '...');
            
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/stats/today`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('Stats response status:', response.status);
            
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
                console.log('Stats data received:', data);
                console.log('Raw stats values:', {
                    ordersProcessed: data.ordersProcessed,
                    bagsScanned: data.bagsScanned,
                    ordersReady: data.ordersReady,
                    fullData: JSON.stringify(data)
                });
                
                // Update DOM elements
                if (ordersToday) {
                    ordersToday.textContent = data.ordersProcessed || 0;
                    console.log('Set ordersToday to:', data.ordersProcessed || 0);
                }
                if (bagsScanned) {
                    bagsScanned.textContent = data.bagsScanned || 0;
                    console.log('Set bagsScanned to:', data.bagsScanned || 0);
                }
                if (ordersReady) {
                    ordersReady.textContent = data.ordersReady || 0;
                    console.log('Set ordersReady to:', data.ordersReady || 0);
                }
                
                console.log('Stats updated in DOM:', {
                    ordersProcessed: data.ordersProcessed || 0,
                    bagsScanned: data.bagsScanned || 0,
                    ordersReady: data.ordersReady || 0
                });
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
            console.error('Stats error details:', {
                message: error.message,
                stack: error.stack
            });
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
                
                if (!orderModal.classList.contains('active') && !isInputFocused) {
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
        
        console.log('=== SCAN INPUT DETECTED ===');
        console.log('Input value:', value);
        console.log('Buffer before:', scanBuffer);
        
        // Clear any existing timeout
        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }

        // Add to buffer
        scanBuffer += value;
        scanInput.value = '';
        
        console.log('Buffer after:', scanBuffer);

        // Process after a short delay (scanner sends data quickly)
        scanTimeout = setTimeout(() => {
            if (scanBuffer.length > 0) {
                console.log('Processing buffered scan:', scanBuffer);
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
        console.log('=== SCAN WORKFLOW START ===');
        console.log('Scan data received:', scanData);
        
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
            console.log('API Response:', data);
            
            if (data.success) {
                console.log('Scan successful, calling handleScanResponse');
                handleScanResponse(data);
            } else {
                console.log('Scan failed:', data.message);
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
        
        console.log('=== HANDLE SCAN RESPONSE ===');
        console.log('Action received:', action);
        console.log('Order data:', order);
        console.log('Order status:', order?.status);
        console.log('Bags weighed:', order?.bagsWeighed);
        console.log('Bags processed:', order?.bagsProcessed);
        console.log('Number of bags:', order?.numberOfBags);
        
        // Hide the scanning confirmation first
        hideConfirmation();

        switch (action) {
            case 'weight_input':
                console.log('=> Handling weight_input action');
                // First scan - need weight input
                showWeightInputModal(order);
                break;

            case 'process_complete':
                console.log('=> Handling process_complete action');
                // Second scan - mark bag as processed after WDF
                handleProcessComplete(order);
                break;

            case 'pickup_scan':
                console.log('=> Handling pickup_scan action');
                // Third scan - scanning for pickup by affiliate
                handlePickupScan(order);
                break;

            default:
                console.log('=> Handling default action:', action);
                showConfirmation(`Order ${order.orderId} - Status: ${action}`, '✓', 'success');
        }
        
        console.log('=== END HANDLE SCAN RESPONSE ===');
    }

    // Show weight input modal
    function showWeightInputModal(order) {
        console.log('showWeightInputModal called');
        console.log('orderModal element:', orderModal);
        console.log('orderModal active before:', orderModal?.classList.contains('active'));
        
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
        orderModal.classList.add('active');
        orderModal.setAttribute('data-force-visible', 'true');
        
        // Temporarily remove the 'modal' class to avoid being targeted by modal-utils.js
        orderModal.classList.remove('modal');
        orderModal.classList.add('weight-input-modal-active');
        
        // Strategy 2: Use requestAnimationFrame to show after next paint
        requestAnimationFrame(() => {
            orderModal.classList.add('active');
            console.log('Modal display set in requestAnimationFrame');
        });
        
        // Strategy 3: Use multiple setTimeout calls
        [0, 10, 50, 100, 200, 500].forEach(delay => {
            setTimeout(() => {
                if (orderModal.getAttribute('data-force-visible') === 'true') {
                    orderModal.classList.add('active');
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
        
        // CSP-compliant: Ensure modal stays visible using classes
        // The 'active' class will keep the modal visible
        
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
        console.log('=== HANDLE PROCESS COMPLETE ===');
        console.log('Order:', order);
        currentOrder = order;
        
        // Show confirmation modal for bag processing
        console.log('Calling showBagProcessingModal');
        showBagProcessingModal(order);
    }

    // Show bag processing confirmation modal
    function showBagProcessingModal(order) {
        console.log('=== SHOW BAG PROCESSING MODAL ===');
        const processedBags = order.bagsProcessed || 0;
        const totalBags = order.numberOfBags || 1;
        
        console.log('Processed bags:', processedBags);
        console.log('Total bags:', totalBags);
        console.log('Modal elements check:');
        console.log('- orderModal:', orderModal ? 'Found' : 'Missing');
        console.log('- modalTitle:', modalTitle ? 'Found' : 'Missing');
        console.log('- modalBody:', modalBody ? 'Found' : 'Missing');
        
        modalTitle.textContent = 'Confirm Bag Processing';
        modalBody.innerHTML = `
            <div class="order-info">
                <p><strong>Customer:</strong> ${order.customerName}</p>
                <p><strong>Order ID:</strong> ${order.orderId}</p>
                <p><strong>Order Type:</strong> ${order.orderType || 'WDF'}</p>
                <p><strong>Bags Processed:</strong> ${processedBags} of ${totalBags}</p>
            </div>
            <div class="process-confirm-section">
                <h5>Confirm this bag has been processed (WDF complete)?</h5>
                <p class="text-muted">Scanning bag ${processedBags + 1} of ${totalBags}</p>
                ${processedBags + 1 === totalBags ? 
                    '<p class="text-success"><strong>This is the last bag! Customer will be notified when confirmed.</strong></p>' : 
                    ''}
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" id="confirmBagProcessedBtn">Confirm Processed</button>
                <button class="btn btn-secondary" id="cancelBagProcessingBtn">Cancel</button>
            </div>
        `;
        
        // Remove modal class that might hide it and add active class
        orderModal.classList.remove('modal');
        orderModal.classList.add('modal', 'active');
        
        // Apply important to override any CSS
        // CSP-compliant: active class handles display
        
        // Force the modal to stay visible
        setTimeout(() => {
            if (!orderModal.classList.contains('active')) {
                console.log('Modal was hidden, forcing it back to visible');
                orderModal.classList.add('active');
                // CSP-compliant: active class handles display
            }
            
            // Log the actual computed style
            const computedStyle = window.getComputedStyle(orderModal);
            console.log('After timeout - Computed display:', computedStyle.display);
            console.log('After timeout - Opacity:', computedStyle.opacity);
            console.log('After timeout - Visibility:', computedStyle.visibility);
        }, 100);
        
        console.log('Modal active class set:', orderModal.classList.contains('active'));
        console.log('Modal classes:', orderModal.className);
        console.log('Modal computed display:', window.getComputedStyle(orderModal).display);
        
        // Add event listeners to buttons
        setTimeout(() => {
            const confirmBtn = document.getElementById('confirmBagProcessedBtn');
            const cancelBtn = document.getElementById('cancelBagProcessingBtn');
            
            if (confirmBtn) {
                confirmBtn.addEventListener('click', confirmBagProcessed);
                console.log('Added event listener to confirm button');
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', closeModal);
                console.log('Added event listener to cancel button');
            }
        }, 50);
        
        console.log('=== END SHOW BAG PROCESSING MODAL ===');
    }

    // Confirm bag processed button handler
    function confirmBagProcessed() {
        console.log('=== CONFIRM BAG PROCESSED ===');
        // Save the order before closing modal since closeModal sets currentOrder to null
        const orderToProcess = currentOrder;
        closeModal();
        // Pass the saved order to markBagProcessed
        markBagProcessed(orderToProcess);
    }

    // Mark bag as processed
    async function markBagProcessed(order) {
        console.log('=== MARK BAG PROCESSED ===');
        console.log('Order to process:', order);
        
        if (!order) {
            console.error('No order provided to markBagProcessed');
            showError('Error: No order to process');
            return;
        }
        
        try {
            const token = localStorage.getItem('operatorToken');
            console.log('Processing bag with operator:', operatorData);
            console.log('Order being processed:', order.orderId);
            
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/orders/${order.orderId}/process-bag`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Check for token renewal
            checkAndUpdateToken(response);

            const data = await response.json();
            console.log('Process bag response:', data);

            if (response.ok && data.success) {
                if (data.orderReady) {
                    console.log('All bags processed - order ready for pickup');
                    showConfirmation(
                        `All ${data.totalBags} bags processed! Affiliate notified for pickup.`,
                        '✅',
                        'success'
                    );
                } else {
                    console.log(`Bag processed: ${data.bagsProcessed}/${data.totalBags}`);
                    showConfirmation(
                        `Bag ${data.bagsProcessed} of ${data.totalBags} processed`,
                        '✓',
                        'success'
                    );
                }
                await loadStats();
                
                // Also refresh stats after a short delay to ensure backend has updated
                setTimeout(async () => {
                    console.log('Refreshing stats after delay...');
                    await loadStats();
                }, 1000);
                
                setTimeout(hideConfirmation, 3000);
            } else {
                console.error('Failed to process bag:', data.message);
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
                <button class="btn btn-secondary" id="cancelReadyBtn">Cancel</button>
                <button class="btn btn-primary" id="confirmReadyBtn">Confirm Ready for Pickup</button>
            </div>
        `;

        modalBody.innerHTML = html;
        orderModal.classList.add('active');
        
        // Add event listeners to buttons
        setTimeout(() => {
            const confirmBtn = document.getElementById('confirmReadyBtn');
            const cancelBtn = document.getElementById('cancelReadyBtn');
            
            if (confirmBtn) {
                confirmBtn.addEventListener('click', confirmReady);
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', closeModal);
            }
        }, 50);
    }

    // Handle pickup scan (auto-dismiss)
    function handlePickupScan(order) {
        console.log('=== HANDLE PICKUP SCAN ===');
        
        // Check if we're already tracking this order
        if (currentOrder && currentOrder.orderId === order.orderId && currentOrder.scannedBagsForPickup) {
            // Preserve the existing scanned bags tracking
            console.log('Preserving existing scanned bags tracking');
            order.scannedBagsForPickup = currentOrder.scannedBagsForPickup;
        }
        
        // Track current order for pickup
        currentOrder = order;

        // Initialize scanned bags tracking if not exists
        if (!currentOrder.scannedBagsForPickup) {
            currentOrder.scannedBagsForPickup = new Set();
            console.log('Initialized scannedBagsForPickup Set');
        }
        
        // Add this scan to the set (using timestamp to track unique scans)
        const scanId = Date.now();
        currentOrder.scannedBagsForPickup.add(scanId);
        console.log(`Added scan ${scanId} to set. Total scans: ${currentOrder.scannedBagsForPickup.size}`);
        console.log('Scanned bag IDs:', Array.from(currentOrder.scannedBagsForPickup));
        
        // Show pickup modal
        showPickupModal(order);
    }

    // Show pickup modal with bag scanning progress
    function showPickupModal(order) {
        console.log('=== SHOW PICKUP MODAL ===');
        const bagsPickedUp = order.bagsPickedUp || 0;
        const totalBags = order.numberOfBags;
        const scannedCount = currentOrder.scannedBagsForPickup ? currentOrder.scannedBagsForPickup.size : 0;
        const remainingBags = totalBags - bagsPickedUp;
        const allBagsScanned = scannedCount >= remainingBags;
        
        console.log(`Pickup status: ${scannedCount}/${remainingBags} bags scanned (${totalBags} total, ${bagsPickedUp} already picked up)`);
        console.log('All bags scanned?', allBagsScanned);
        
        modalTitle.textContent = 'Order Pickup';
        modalBody.innerHTML = `
            <div class="order-info">
                <p><strong>Customer:</strong> ${order.customerName}</p>
                <p><strong>Order ID:</strong> ${order.orderId}</p>
                <p><strong>Total Bags:</strong> ${totalBags}</p>
            </div>
            <div class="pickup-scan-section">
                <h5>Scan all bags before confirming pickup</h5>
                <div class="scan-progress">
                    <p class="text-info"><strong>Bags scanned in this session: ${scannedCount} of ${remainingBags}</strong></p>
                    <div class="progress mb-3">
                        <div class="progress-bar" role="progressbar" 
                             id="pickupProgressBar"
                             aria-valuenow="${scannedCount}" 
                             aria-valuemin="0" 
                             aria-valuemax="${remainingBags}">
                        </div>
                    </div>
                    ${!allBagsScanned ? 
                        '<p class="text-warning">Please scan all remaining bags before confirming pickup.</p>' : 
                        '<p class="text-success"><strong>All bags scanned! Ready for pickup.</strong></p>'}
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" 
                        id="confirmAllBagsPickupBtn"
                        ${!allBagsScanned ? 'disabled' : ''}>
                    Confirm Pickup (${remainingBags} bags)
                </button>
                <button class="btn btn-secondary" id="cancelPickupBtn">Cancel</button>
            </div>
        `;
        
        // Show modal with active class
        orderModal.classList.add('modal', 'active');
        // CSP-compliant: active class handles display
        
        // Add event listeners to buttons and set progress bar width
        setTimeout(() => {
            const confirmBtn = document.getElementById('confirmAllBagsPickupBtn');
            const cancelBtn = document.getElementById('cancelPickupBtn');
            const progressBar = document.getElementById('pickupProgressBar');
            
            if (confirmBtn) {
                confirmBtn.addEventListener('click', confirmAllBagsPickup);
                // Enable/disable button based on whether all bags are scanned
                confirmBtn.disabled = !allBagsScanned;
                console.log('Confirm button disabled?', confirmBtn.disabled);
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', cancelPickup);
            }
            
            // Set progress bar width
            if (progressBar) {
                const percentage = Math.round((scannedCount / remainingBags) * 100);
                // CSP-compliant: use class instead of style
                const roundedPercentage = Math.min(100, Math.max(0, Math.round(percentage / 10) * 10));
                progressBar.className = `progress-bar progress-bar-striped progress-bar-animated progress-${roundedPercentage}`;
                console.log(`Progress: ${scannedCount}/${remainingBags} bags = ${percentage}% (rounded to ${roundedPercentage}%)`);
                console.log('Progress bar classes:', progressBar.className);
            }
        }, 50);
    }

    // Confirm all bags pickup
    function confirmAllBagsPickup() {
        console.log('=== CONFIRM ALL BAGS PICKUP ===');
        const bagsToPickup = currentOrder.numberOfBags - (currentOrder.bagsPickedUp || 0);
        console.log(`Confirming pickup of ${bagsToPickup} bags`);
        closeModal();
        confirmPickup(bagsToPickup);
    }

    // Cancel pickup and clear scanned bags
    function cancelPickup() {
        if (currentOrder && currentOrder.scannedBagsForPickup) {
            currentOrder.scannedBagsForPickup.clear();
        }
        closeModal();
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
                setTimeout(hideConfirmation, 3000);
                await loadStats();
                
                // Refresh stats after delay
                setTimeout(async () => {
                    console.log('Refreshing stats after weight submission...');
                    await loadStats();
                }, 1000);
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
        confirmationModal.classList.add('block');
        confirmationModal.classList.remove('hidden');
    }

    // Hide confirmation
    function hideConfirmation() {
        confirmationModal.classList.add('hidden');
        confirmationModal.classList.remove('block');
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
        console.log('=== CLOSE MODAL ===');
        console.log('Modal state before close:', {
            display: orderModal.style.display,
            classes: orderModal.className,
            forceVisible: orderModal.getAttribute('data-force-visible')
        });
        
        // Remove the force-visible attribute
        orderModal.removeAttribute('data-force-visible');
        
        // Restore the modal class and remove active
        orderModal.classList.add('modal');
        orderModal.classList.remove('weight-input-modal-active', 'active');
        
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
        
        // CSP-compliant: No need to restore style descriptor
        
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
        orderModal.classList.remove('active');
        currentOrder = null;
        focusScanner();
        
        console.log('Modal state after close:', {
            display: orderModal.classList.contains('active') ? 'block' : 'none',
            classes: orderModal.className
        });
        console.log('=== END CLOSE MODAL ===');
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

    // Expose functions to global scope for onclick handlers
    window.closeModal = closeModal;
    window.confirmBagProcessed = confirmBagProcessed;
    window.confirmReady = confirmReady;
    window.confirmAllBagsPickup = confirmAllBagsPickup;
    window.cancelPickup = cancelPickup;
    window.submitWeights = submitWeights;

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