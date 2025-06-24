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

        // Get operator data
        operatorData = JSON.parse(localStorage.getItem('operatorData') || '{}');
        operatorName.textContent = operatorData.name || 'Operator';

        // Load stats
        await loadStats();

        // Focus on scan input
        focusScanner();

        // Set up event listeners
        setupEventListeners();

        // Update stats every 30 seconds
        setInterval(loadStats, 30000);
    }

    // Load operator stats
    async function loadStats() {
        try {
            const token = localStorage.getItem('operatorToken');
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/stats/today`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                ordersToday.textContent = data.ordersProcessed || 0;
                bagsScanned.textContent = data.bagsScanned || 0;
                ordersReady.textContent = data.ordersReady || 0;
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
            setTimeout(focusScanner, 100);
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

    // Process scanned code
    async function processScan(scanData) {
        try {
            showConfirmation('Scanning...', '🔍', 'info');

            const token = localStorage.getItem('operatorToken');
            
            // Use scan-bag endpoint (which internally calls scan-customer)
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/scan-bag`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    bagId: scanData,
                    customerId: scanData  // Backend expects customerId in req.body for scanCustomer
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                handleScanResponse(data);
            } else {
                showError(data.message || 'Invalid scan');
            }
        } catch (error) {
            console.error('Scan error:', error);
            showError('Network error. Please try again.');
        }
    }

    // Handle scan response based on order status
    function handleScanResponse(data) {
        const { order, action } = data;

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
                           placeholder="Weight in lbs"
                           ${i === startBag ? 'autofocus' : ''}>
                </div>
            `;
        }

        html += `
            </div>
            <div class="action-buttons">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitWeights()">Mark as In Progress</button>
            </div>
        `;

        modalBody.innerHTML = html;
        orderModal.style.display = 'block';
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
    window.submitWeights = async function() {
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
    window.confirmReady = async function() {
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
        showConfirmation(message, '❌', 'error');
        setTimeout(hideConfirmation, 3000);
    }

    // Close modal
    window.closeModal = function() {
        orderModal.style.display = 'none';
        currentOrder = null;
        focusScanner();
    };

    // Show manual input
    window.showManualInput = function() {
        const id = prompt('Enter Customer ID (e.g., CUST123456) or Bag ID:');
        if (id && id.trim()) {
            processScan(id.trim());
        }
    };

    // Logout
    window.logout = function() {
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

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();