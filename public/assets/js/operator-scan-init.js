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

    // Helper function to update stats display
    function updateStatsDisplay(data) {
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
    }

    // Detect Android OS
    function isAndroid() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return /android/i.test(userAgent);
    }

    // Enter fullscreen mode
    function enterFullscreen() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { // Safari
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { // IE11
            elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) { // Firefox
            elem.mozRequestFullScreen();
        }
    }

    // Show fullscreen prompt
    function showFullscreenPrompt() {
        // Create prompt element
        const prompt = document.createElement('div');
        prompt.className = 'fullscreen-prompt';
        prompt.innerHTML = `
            <div class="fullscreen-prompt-content">
                <h3>Setup Kiosk Mode</h3>
                <p>For kiosk mode without browser controls:</p>
                <ol>
                    <li>Install a kiosk browser app (e.g., "Fully Kiosk Browser")</li>
                    <li>Or use Samsung's "Internet Browser" with immersive mode</li>
                    <li>Or add to home screen and use a launcher that hides status bar</li>
                </ol>
                <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">Got it</button>
            </div>
        `;
        document.body.appendChild(prompt);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (prompt.parentNode) {
                prompt.remove();
            }
        }, 10000);
    }

    // Initialize
    async function init() {
        // Check authentication
        const token = localStorage.getItem('operatorToken');
        console.log('Operator scan init - Token status:', token ? 'Present' : 'Missing');
        
        if (!token) {
            console.log('No token found, redirecting to login...');
            // Use navigateTo if available (when in embed-app-v2.html)
            if (window.navigateTo) {
                window.navigateTo('/operator-login');
            } else {
                window.location.href = '/embed-app-v2.html?route=/operator-login';
            }
            return;
        }

        // Verify the token is still valid
        try {
            console.log('Verifying operator token...');
            const response = await fetch(`${BASE_URL}/api/v1/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.log('Token validation failed, redirecting to login...');
                localStorage.removeItem('operatorToken');
                localStorage.removeItem('operatorRefreshToken');
                localStorage.removeItem('operatorData');
                
                if (window.navigateTo) {
                    window.navigateTo('/operator-login');
                } else {
                    window.location.href = '/embed-app-v2.html?route=/operator-login';
                }
                return;
            }

            const data = await response.json();
            if (!data.success) {
                console.log('Token invalid, redirecting to login...');
                localStorage.removeItem('operatorToken');
                localStorage.removeItem('operatorRefreshToken');
                localStorage.removeItem('operatorData');
                
                if (window.navigateTo) {
                    window.navigateTo('/operator-login');
                } else {
                    window.location.href = '/embed-app-v2.html?route=/operator-login';
                }
                return;
            }

            console.log('Token validated successfully');
        } catch (error) {
            console.error('Error validating token:', error);
            localStorage.removeItem('operatorToken');
            localStorage.removeItem('operatorRefreshToken');
            localStorage.removeItem('operatorData');
            
            if (window.navigateTo) {
                window.navigateTo('/operator-login');
            } else {
                window.location.href = '/embed-app-v2.html?route=/operator-login';
            }
            return;
        }

        // Register service worker for PWA functionality
        if ('serviceWorker' in navigator && window.location.pathname.includes('operator-scan')) {
            navigator.serviceWorker.register('/sw-operator.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed:', err));
        }

        // Check if running in Fully Kiosk Browser
        const isFullyKiosk = typeof fully !== 'undefined';
        
        // Enter fullscreen mode on Android for operator-scan page only
        if (isAndroid() && window.location.pathname.includes('operator-scan')) {
            console.log('Android detected on operator-scan page, setting up fullscreen mode');
            
            // Add class for styling
            document.body.classList.add('android-kiosk');
            document.documentElement.classList.add('android-kiosk');
            
            // If in Fully Kiosk Browser, use PLUS features
            if (isFullyKiosk) {
                console.log('Fully Kiosk Browser detected - initializing PLUS features');
                
                // Screen settings (PLUS features)
                if (fully.setScreenBrightness) {
                    console.log('Setting screen brightness to maximum');
                    fully.setScreenBrightness(255);
                }
                
                if (fully.setScreenOn) {
                    console.log('Keeping screen on');
                    fully.setScreenOn(true);
                }
                
                // Hide system UI for true fullscreen (PLUS)
                if (fully.hideSystemUI) {
                    console.log('Hiding system UI');
                    fully.hideSystemUI();
                }
                
                // Hide navigation bar (PLUS)
                if (fully.hideNavigationBar) {
                    console.log('Hiding navigation bar');
                    fully.hideNavigationBar();
                }
                
                // Keyboard control (PLUS)
                if (fully.hideKeyboard) {
                    console.log('Hiding keyboard');
                    fully.hideKeyboard();
                }
                
                if (fully.setKeyboardVisibility) {
                    console.log('Disabling keyboard auto-show');
                    fully.setKeyboardVisibility(false);
                }
                
                // Lock kiosk mode to prevent exit without code (PLUS)
                if (fully.lockKiosk) {
                    console.log('Locking kiosk mode');
                    // Don't lock if you want logout button to work
                    // fully.lockKiosk();
                }
                
                // Set volume to reasonable level (PLUS)
                if (fully.setAudioVolume) {
                    console.log('Setting audio volume');
                    fully.setAudioVolume(0.7, 3); // 70% media volume
                }
            }
            
            // Hide address bar by scrolling
            window.scrollTo(0, 1);
            
            // Function to request fullscreen with all vendor prefixes
            const requestFullscreen = () => {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(err => {
                        console.log('Fullscreen error:', err);
                    });
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                } else if (elem.mozRequestFullScreen) {
                    elem.mozRequestFullScreen();
                } else if (elem.msRequestFullscreen) {
                    elem.msRequestFullscreen();
                }
                
                // For Samsung Internet browser
                if (window.AndroidFullScreen) {
                    window.AndroidFullScreen.immersiveMode();
                }
            };
            
            // Try on first user interaction (required by browsers)
            const enableFullscreen = () => {
                requestFullscreen();
                // Remove listeners after first attempt
                document.removeEventListener('click', enableFullscreen);
                document.removeEventListener('touchstart', enableFullscreen);
            };
            
            document.addEventListener('click', enableFullscreen);
            document.addEventListener('touchstart', enableFullscreen);
            
            // Show fullscreen prompt if not in standalone mode and not in Fully Kiosk
            if (!isFullyKiosk && 
                !window.matchMedia('(display-mode: standalone)').matches && 
                !window.matchMedia('(display-mode: fullscreen)').matches) {
                // Create a prompt to guide user to add to home screen
                setTimeout(() => {
                    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                        console.log('Not in fullscreen, showing prompt');
                        showFullscreenPrompt();
                    }
                }, 2000);
            }
        }
        
        // Verify token is still valid by making a test request
        console.log('Verifying token validity...');
        try {
            const testResponse = await fetch(`${BASE_URL}/api/v1/operators/stats/today`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('Token validation response:', testResponse.status);
            
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
        
        // Remove modal class from orderModal to prevent modal-utils from controlling it
        if (orderModal) {
            orderModal.classList.remove('modal');
            orderModal.classList.add('operator-modal');
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
        
        // Global keyboard hiding for Fully Kiosk
        if (typeof fully !== 'undefined' && fully.hideKeyboard) {
            console.log('Setting up Fully Kiosk keyboard handlers');
            
            // Hide keyboard on any focus event
            document.addEventListener('focusin', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    setTimeout(() => {
                        fully.hideKeyboard();
                    }, 100);
                }
            });
            
            // Also hide on window resize (keyboard appearing often triggers resize)
            window.addEventListener('resize', function() {
                fully.hideKeyboard();
            });
            
            // Periodic keyboard hide to ensure it stays hidden
            setInterval(() => {
                fully.hideKeyboard();
            }, 5000);
        }
    }

    // Load operator stats
    async function loadStats() {
        console.log('=== LOADING STATS ===');
        console.log('Current operator data:', operatorData);
        console.log('Operator ID:', operatorData?.id || 'No ID');
        console.log('Stats call timestamp:', new Date().toISOString());
        
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
            
            // Always check for renewed token in response headers, even on non-ok responses
            const renewedToken = response.headers.get('X-Renewed-Token');
            const tokenRenewed = response.headers.get('X-Token-Renewed');
            const wasExpired = response.headers.get('X-Token-Was-Expired');
            
            if (tokenRenewed === 'true' && renewedToken) {
                // Update stored token with renewed one
                console.log('Token renewed by server, updating local storage');
                console.log('Old token:', token.substring(0, 50) + '...');
                console.log('New token:', renewedToken.substring(0, 50) + '...');
                console.log('Was expired:', wasExpired);
                
                // Decode tokens to compare
                try {
                    const oldPayload = JSON.parse(atob(token.split('.')[1]));
                    const newPayload = JSON.parse(atob(renewedToken.split('.')[1]));
                    console.log('Old token payload:', oldPayload);
                    console.log('New token payload:', newPayload);
                } catch (e) {
                    console.error('Error decoding tokens:', e);
                }
                
                localStorage.setItem('operatorToken', renewedToken);
                
                // If token was expired and renewed, retry the request with new token
                if (wasExpired === 'true') {
                    console.log('Token was expired and renewed, retrying request...');
                    const retryResponse = await csrfFetch(`${BASE_URL}/api/v1/operators/stats/today`, {
                        headers: {
                            'Authorization': `Bearer ${renewedToken}`
                        }
                    });
                    
                    if (retryResponse.ok) {
                        const data = await retryResponse.json();
                        updateStatsDisplay(data);
                        return;
                    }
                }
            }

            if (response.ok) {
                const data = await response.json();
                updateStatsDisplay(data);
            } else if (response.status === 401) {
                // Unauthorized - token might be expired
                console.error('Stats call got 401 error at:', new Date().toISOString());
                console.error('Current token:', localStorage.getItem('operatorToken')?.substring(0, 20) + '...');
                console.error('Operator token expired or invalid');
                
                // Add a delay to prevent rapid refresh loops
                clearInterval(statsInterval);
                localStorage.removeItem('operatorToken');
                localStorage.removeItem('operatorData');
                
                setTimeout(function() {
                    window.location.href = '/operator-login-embed.html';
                }, 1000);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            console.error('Stats error details:', {
                message: error.message,
                stack: error.stack
            });
        }
    }

    // Scanner blur handler
    function handleScannerBlur() {
        // Only refocus if no modal is open and not focusing on an input
        setTimeout(function() {
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && 
                (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
                activeElement.id !== 'scanInput';
            
            // Check if weight input section is visible
            const weightInputSection = document.querySelector('.weight-input-section');
            const weightInputsVisible = weightInputSection && weightInputSection.offsetParent !== null;
            
            // Check if pickup modal is active (we want to keep scanning during pickup)
            const isPickupModalActive = orderModal.classList.contains('active') && 
                currentOrder && currentOrder.scannedBagsForPickup;
            
            // Refocus scanner if:
            // 1. No modal is active, OR
            // 2. Pickup modal is active (we want to keep scanning)
            // AND no other input is focused AND weight inputs are not visible
            if ((!orderModal.classList.contains('active') || isPickupModalActive) && 
                !isInputFocused && !weightInputsVisible) {
                focusScanner();
            }
        }, 100);
    }

    // Document click handler
    function handleDocumentClick(e) {
        // Check if weight input section is visible
        const weightInputSection = document.querySelector('.weight-input-section');
        const weightInputsVisible = weightInputSection && weightInputSection.offsetParent !== null;
        
        // Don't refocus scanner if weight inputs are visible
        if (weightInputsVisible) {
            return;
        }
        
        if (!e.target.closest('.modal') && !e.target.closest('button')) {
            focusScanner();
        }
    }

    // Keyboard shortcut handler
    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        console.log('Setting up event listeners...');
        console.log('scanInput element:', scanInput);
        
        // Scanner input handling
        scanInput.addEventListener('input', handleScanInput);
        scanInput.addEventListener('blur', handleScannerBlur);
        
        // Add keypress listener for debugging
        scanInput.addEventListener('keypress', function(e) {
            console.log('Keypress detected:', e.key, 'KeyCode:', e.keyCode);
        });
        
        // Add paste listener for barcode scanners that paste
        scanInput.addEventListener('paste', function(e) {
            console.log('Paste event detected');
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text');
            console.log('Pasted data:', pastedData);
            if (pastedData) {
                scanInput.value = pastedData;
                handleScanInput({ target: scanInput });
            }
        });

        // Keep focus on scanner input
        document.addEventListener('click', handleDocumentClick);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyDown);

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                logout();
            });
        }
        
        // Modal close button
        const modalCloseBtn = document.getElementById('modalCloseBtn');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeModal);
        }
    }

    // Focus scanner input
    function focusScanner() {
        console.log('Focusing scanner input...');
        // Remove readonly to allow scanner input
        scanInput.removeAttribute('readonly');
        scanInput.focus();
        scanInput.select();
        
        // In Fully Kiosk, ensure keyboard stays hidden
        if (typeof fully !== 'undefined' && fully.hideKeyboard) {
            setTimeout(() => {
                fully.hideKeyboard();
            }, 50);
        }
        
        // Don't re-add readonly - let the scanner work
        // The blur handler will manage refocusing as needed
    }

    // Handle scanner input
    function handleScanInput(e) {
        const value = e.target.value;
        
        console.log('=== SCAN INPUT DETECTED ===');
        console.log('Input value:', value);
        console.log('Buffer before:', scanBuffer);
        console.log('Modal active:', orderModal.classList.contains('active'));
        console.log('Current order:', currentOrder ? currentOrder.orderId : 'none');
        
        // Clear any existing timeout
        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }

        // Add to buffer
        scanBuffer += value;
        scanInput.value = '';
        
        console.log('Buffer after:', scanBuffer);

        // Process after a short delay (scanner sends data quickly)
        scanTimeout = setTimeout(function() {
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
            
            // Parse the scan data - format is customerId#bagId
            let customerId = scanData;
            let bagId = null;
            
            if (scanData.includes('#')) {
                const parts = scanData.split('#');
                customerId = parts[0];
                bagId = parts[1];
                console.log('Parsed scan data - Customer ID:', customerId, 'Bag ID:', bagId);
            } else {
                console.log('No bag ID in scan data, using full string as customer ID');
            }
            
            // Use scan-customer endpoint - bags have customer IDs on them
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/scan-customer`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    customerId: customerId,
                    bagId: bagId
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
                console.log('Data from server:', JSON.stringify(data));
                // Pass the customerId and bagId along with the response
                data.scannedCustomerId = customerId;
                if (bagId && !data.scannedBagId) {
                    // Ensure bagId is passed if it was in the scan
                    data.scannedBagId = bagId;
                }
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
        const { order, action, scannedBagId, scannedCustomerId } = data;
        
        console.log('=== HANDLE SCAN RESPONSE ===');
        console.log('Action received:', action);
        console.log('Order data:', order);
        console.log('Scanned bag ID:', scannedBagId);
        console.log('Scanned customer ID:', scannedCustomerId);
        console.log('Order status:', order?.status);
        console.log('Bags weighed:', order?.bagsWeighed);
        console.log('Bags processed:', order?.bagsProcessed);
        console.log('Number of bags:', order?.numberOfBags);
        
        // Hide the scanning confirmation first
        hideConfirmation();

        switch (action) {
            case 'weight_input':
                console.log('=> Handling weight_input action');
                // Check if modal is already open and we're scanning additional bags
                if (orderModal.classList.contains('active') && 
                    currentOrder && 
                    currentOrder.orderId === order.orderId && 
                    currentOrder.scannedBagsForWeighing) {
                    console.log('Modal already open, adding bag to existing scan session');
                    // Add the new bag to the existing set
                    if (scannedBagId && !currentOrder.scannedBagsForWeighing.has(scannedBagId)) {
                        currentOrder.scannedBagsForWeighing.add(scannedBagId);
                        // Update the modal with the new scan
                        showWeightInputModal(currentOrder, null); // Don't pass bagId again, it's already in the set
                    } else {
                        console.log('Bag already scanned or no bag ID');
                        showConfirmation('Bag already scanned', '⚠️', 'warning');
                        setTimeout(hideConfirmation, 2000);
                    }
                } else {
                    // First scan - need weight input
                    // Check if we already have scanned bags for this order
                    if (currentOrder && currentOrder.orderId === order.orderId && currentOrder.scannedBagsForWeighing) {
                        // Preserve existing scanned bags
                        order.scannedBagsForWeighing = currentOrder.scannedBagsForWeighing;
                    }
                    // Store the customer ID from the scan
                    order.customerId = scannedCustomerId;
                    showWeightInputModal(order, scannedBagId);
                }
                break;

            case 'process_complete':
                console.log('=> Handling process_complete action');
                // Second scan - mark bag as processed after WDF
                order.customerId = scannedCustomerId;
                handleProcessComplete(order, scannedBagId);
                break;

            case 'pickup_scan':
                console.log('=> Handling pickup_scan action');
                console.log('Order ID:', order.orderId);
                console.log('Scanned bag ID:', scannedBagId);
                console.log('Modal active?', orderModal.classList.contains('active'));
                console.log('Current order exists?', !!currentOrder);
                console.log('Current order ID:', currentOrder ? currentOrder.orderId : 'none');
                console.log('Current order scannedBagsForPickup:', currentOrder && currentOrder.scannedBagsForPickup ? Array.from(currentOrder.scannedBagsForPickup) : 'none');
                
                // Third scan - scanning for pickup by affiliate
                order.customerId = scannedCustomerId;
                
                // Check if pickup modal is already open and we're scanning additional bags
                if (orderModal.classList.contains('active') && 
                    currentOrder && 
                    currentOrder.orderId === order.orderId) {
                    console.log('Pickup modal already open, adding bag to existing scan session');
                    
                    // Preserve the existing scanned bags tracking
                    if (currentOrder.scannedBagsForPickup) {
                        order.scannedBagsForPickup = currentOrder.scannedBagsForPickup;
                        console.log('Preserved existing tracking:', Array.from(order.scannedBagsForPickup));
                    } else {
                        order.scannedBagsForPickup = new Set();
                        console.log('Created new tracking set');
                    }
                    
                    // Add the new bag to the existing set
                    if (scannedBagId && !order.scannedBagsForPickup.has(scannedBagId)) {
                        console.log('Adding new bag to tracking:', scannedBagId);
                        order.scannedBagsForPickup.add(scannedBagId);
                        currentOrder = order; // Update currentOrder with the preserved tracking
                        // Update the modal with the new scan
                        showPickupModal(order);
                    } else if (scannedBagId && order.scannedBagsForPickup.has(scannedBagId)) {
                        console.log('Bag already scanned:', scannedBagId);
                        // Add a small delay to ensure the previous confirmation is hidden
                        setTimeout(() => {
                            showConfirmation('Bag already scanned', '⚠️', 'warning');
                            setTimeout(hideConfirmation, 2000);
                        }, 100);
                    } else {
                        console.log('No bag ID provided');
                    }
                } else {
                    console.log('First scan or different order - showing new pickup modal');
                    // First scan - show pickup modal
                    handlePickupScan(order, scannedBagId);
                }
                break;

            default:
                console.log('=> Handling default action:', action);
                showConfirmation(`Order ${order.orderId} - Status: ${action}`, '✓', 'success');
        }
        
        console.log('=== END HANDLE SCAN RESPONSE ===');
    }

    // Show weight input modal
    function showWeightInputModal(order, scannedBagId) {
        console.log('showWeightInputModal called');
        console.log('orderModal element:', orderModal);
        console.log('Scanned bag ID:', scannedBagId);
        console.log('Order addOns:', order.addOns);
        
        // Initialize or preserve scanned bags tracking
        if (!currentOrder || currentOrder.orderId !== order.orderId) {
            currentOrder = order;
            currentOrder.scannedBagsForWeighing = new Set();
        }
        
        // Add the scanned bag ID to the set
        if (scannedBagId) {
            currentOrder.scannedBagsForWeighing.add(scannedBagId);
        }
        
        modalTitle.textContent = 'Scan All Bags First';

        // Calculate how many bags still need weights
        const bagsToWeigh = order.numberOfBags - (order.bagsWeighed || 0);
        const scannedCount = currentOrder.scannedBagsForWeighing.size;
        const allBagsScanned = scannedCount >= bagsToWeigh;

        // Check if order has add-ons
        const hasAddOns = order.addOns && (order.addOns.premiumDetergent || order.addOns.fabricSoftener || order.addOns.stainRemover);

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
                        <div class="info-value" id="bagsWeighedValue">${order.bagsWeighed || 0}</div>
                    </div>
                </div>
                ${hasAddOns ? `
                    <div class="add-ons-alert" style="background-color: #fff3cd; border: 2px solid #856404; border-radius: 4px; padding: 12px; margin-top: 12px;">
                        <h5 style="color: #856404; margin: 0 0 8px 0;">⚠️ Add-ons Required</h5>
                        <div style="color: #721c24; font-weight: bold;">
                            ${[
                                order.addOns.premiumDetergent && '✓ Premium Detergent',
                                order.addOns.fabricSoftener && '✓ Fabric Softener',
                                order.addOns.stainRemover && '✓ Stain Remover'
                            ].filter(Boolean).join('<br>')}
                        </div>
                    </div>
                ` : ''}
            </div>

            <div class="scan-progress-section">
                <h5>Scan all bags before entering weights</h5>
                <div class="scan-progress">
                    <p class="text-info"><strong>Bags scanned: ${scannedCount} of ${bagsToWeigh}</strong></p>
                    <div class="progress mb-3">
                        <div class="progress-bar" role="progressbar" 
                             id="scanProgressBar"
                             aria-valuenow="${scannedCount}" 
                             aria-valuemin="0" 
                             aria-valuemax="${bagsToWeigh}">
                        </div>
                    </div>
                    ${!allBagsScanned ? 
                        '<p class="text-warning">Please scan all bags to continue.</p>' : 
                        '<p class="text-success"><strong>All bags scanned! Now enter weights.</strong></p>'}
                </div>
            </div>
        `;

        // Only show weight inputs if all bags are scanned
        if (allBagsScanned) {
            modalTitle.textContent = 'Enter Bag Weights';
            html += '<div class="weight-input-section">';
            
            // Create weight inputs for each scanned bag
            const scannedBagIds = Array.from(currentOrder.scannedBagsForWeighing);
            scannedBagIds.forEach((bagId, index) => {
                const bagNumber = (order.bagsWeighed || 0) + index + 1;
                // Replace hyphens with underscores for valid HTML IDs
                const sanitizedBagId = bagId.replace(/-/g, '_');
                html += `
                    <div class="bag-weight-input">
                        <label>Bag ${bagNumber} (${bagId.substring(0, 8)}...):</label>
                        <input type="number" 
                               id="bagWeight_${sanitizedBagId}" 
                               class="weight-input"
                               data-bag-id="${bagId}"
                               data-bag-number="${bagNumber}"
                               step="0.1" 
                               min="0.1" 
                               placeholder="Weight in lbs">
                    </div>
                `;
            });
            
            html += '</div>';
            
            // Add add-on confirmation checkbox if order has add-ons
            if (hasAddOns) {
                html += `
                    <div class="add-ons-confirmation" style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; margin-top: 12px;">
                        <label style="display: flex; align-items: center; margin: 0; cursor: pointer;">
                            <input type="checkbox" id="addOnsConfirmed" style="margin-right: 8px; width: 18px; height: 18px;">
                            <span style="font-weight: bold;">I confirm all add-ons have been applied to this order</span>
                        </label>
                    </div>
                `;
            }
        }

        html += `
            <div class="action-buttons">
                <button class="btn btn-secondary" id="cancelWeightModalBtn">Cancel</button>
                <button class="btn btn-primary" 
                        id="submitWeightsBtn"
                        ${!allBagsScanned ? 'disabled' : ''}>
                    Mark as In Progress
                </button>
            </div>
        `;

        modalBody.innerHTML = html;
        
        // Show modal using CSS classes only
        console.log('Setting modal to visible');
        orderModal.classList.add('active');
        
        // Keep scanner focused if not all bags are scanned
        if (!allBagsScanned) {
            setTimeout(function() {
                focusScanner();
            }, 100);
        }
        
        // Simple event listener setup without arrow functions
        setTimeout(function() {
            // Add event listeners to buttons
            const cancelBtn = document.getElementById('cancelWeightModalBtn');
            const submitBtn = document.getElementById('submitWeightsBtn');
            const progressBar = document.getElementById('scanProgressBar');
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    // Clear the scanned bags when canceling
                    if (currentOrder && currentOrder.scannedBagsForWeighing) {
                        currentOrder.scannedBagsForWeighing.clear();
                    }
                    closeModal();
                });
            }
            
            if (submitBtn) {
                submitBtn.addEventListener('click', submitWeights);
                // Enable/disable button based on whether all bags are scanned
                submitBtn.disabled = !allBagsScanned;
                
                // If all bags are scanned, also check for weight inputs
                if (allBagsScanned) {
                    // Add input listeners to all weight inputs
                    const weightInputs = document.querySelectorAll('.weight-input');
                    const addOnsCheckbox = document.getElementById('addOnsConfirmed');
                    
                    function checkAllWeights() {
                        let allValid = true;
                        weightInputs.forEach(function(input) {
                            const value = parseFloat(input.value);
                            if (!value || value <= 0) {
                                allValid = false;
                            }
                        });
                        
                        // Also check add-ons confirmation if required
                        if (hasAddOns && addOnsCheckbox && !addOnsCheckbox.checked) {
                            allValid = false;
                        }
                        
                        submitBtn.disabled = !allValid;
                    }
                    
                    // Add listeners to each weight input
                    weightInputs.forEach(function(input) {
                        input.addEventListener('input', checkAllWeights);
                        input.addEventListener('change', checkAllWeights);
                    });
                    
                    // Add listener to add-ons checkbox if it exists
                    if (addOnsCheckbox) {
                        addOnsCheckbox.addEventListener('change', checkAllWeights);
                    }
                    
                    // Initial check
                    checkAllWeights();
                }
            }
            
            // Set progress bar width
            if (progressBar) {
                const percentage = (scannedCount / bagsToWeigh) * 100;
                progressBar.style.width = percentage + '%';
                progressBar.textContent = Math.round(percentage) + '%';
            }
            
            // Focus on first input if all bags are scanned
            if (allBagsScanned) {
                const scannedBagIds = Array.from(currentOrder.scannedBagsForWeighing);
                if (scannedBagIds.length > 0) {
                    const sanitizedBagId = scannedBagIds[0].replace(/-/g, '_');
                    const firstInput = document.getElementById(`bagWeight_${sanitizedBagId}`);
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            }
        }, 100);
    }

    // Handle process complete scan (after WDF)
    function handleProcessComplete(order, scannedBagId) {
        console.log('=== HANDLE PROCESS COMPLETE ===');
        console.log('Order:', order);
        console.log('Scanned bag ID:', scannedBagId);
        console.log('Order bags:', order.bags);
        
        // Check if this specific bag has already been processed
        if (order.bags && scannedBagId) {
            const scannedBag = order.bags.find(b => b.bagId === scannedBagId);
            if (scannedBag && scannedBag.status === 'processed') {
                console.log('Bag already processed:', scannedBagId);
                // Check if all bags are processed
                const allBagsProcessed = order.bags.every(b => b.status === 'processed' || b.status === 'completed');
                if (allBagsProcessed) {
                    showConfirmation('All bags already processed - ready for pickup', '✅', 'success');
                } else {
                    const remainingBags = order.bags.filter(b => b.status === 'processing').length;
                    showConfirmation(`This bag has already been processed. ${remainingBags} bags still need processing.`, '⚠️', 'info');
                }
                setTimeout(hideConfirmation, 3000);
                return;
            }
        }
        
        currentOrder = order;
        currentOrder.scannedBagId = scannedBagId; // Store for later use
        
        // Show confirmation modal for bag processing
        console.log('Calling showBagProcessingModal');
        showBagProcessingModal(order);
    }

    // Show bag processing confirmation modal
    function showBagProcessingModal(order) {
        console.log('=== SHOW BAG PROCESSING MODAL ===');
        const processedBags = order.bagsProcessed || 0;
        const totalBags = order.numberOfBags || 1;
        const scannedBagId = order.scannedBagId;
        
        console.log('Processed bags:', processedBags);
        console.log('Total bags:', totalBags);
        console.log('Scanned bag ID:', scannedBagId);
        console.log('Modal elements check:');
        console.log('- orderModal:', orderModal ? 'Found' : 'Missing');
        console.log('- modalTitle:', modalTitle ? 'Found' : 'Missing');
        console.log('- modalBody:', modalBody ? 'Found' : 'Missing');
        
        // Find the bag number for the scanned bag
        let bagNumber = 'Unknown';
        if (order.bags && scannedBagId) {
            const scannedBag = order.bags.find(b => b.bagId === scannedBagId);
            if (scannedBag) {
                bagNumber = scannedBag.bagNumber;
            }
        }
        
        modalTitle.textContent = 'Confirm Bag Processing';
        
        // Check if order has add-ons
        const hasAddOns = order.addOns && (order.addOns.premiumDetergent || order.addOns.fabricSoftener || order.addOns.stainRemover);
        
        modalBody.innerHTML = `
            <div class="order-info">
                <p><strong>Customer:</strong> ${order.customerName}</p>
                <p><strong>Order ID:</strong> ${order.orderId}</p>
                <p><strong>Order Type:</strong> ${order.orderType || 'WDF'}</p>
                <p><strong>Bags Processed:</strong> ${processedBags} of ${totalBags}</p>
            </div>
            ${hasAddOns ? `
                <div class="add-ons-reminder" style="background-color: #d4edda; border: 2px solid #155724; border-radius: 4px; padding: 12px; margin: 12px 0;">
                    <h5 style="color: #155724; margin: 0 0 8px 0;">✅ Add-ons Applied</h5>
                    <div style="color: #155724; font-weight: bold;">
                        ${[
                            order.addOns.premiumDetergent && '✓ Premium Detergent',
                            order.addOns.fabricSoftener && '✓ Fabric Softener',
                            order.addOns.stainRemover && '✓ Stain Remover'
                        ].filter(Boolean).join('<br>')}
                    </div>
                </div>
            ` : ''}
            <div class="process-confirm-section">
                <h5>Confirm this bag has been processed (WDF complete)?</h5>
                <p class="text-muted">Bag ${bagNumber} (${scannedBagId || 'Unknown ID'})</p>
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
        console.log('Scanned bag ID:', order.scannedBagId);
        
        if (!order) {
            console.error('No order provided to markBagProcessed');
            showError('Error: No order to process');
            return;
        }
        
        try {
            const token = localStorage.getItem('operatorToken');
            console.log('Processing bag with operator:', operatorData);
            console.log('Order being processed:', order.orderId);
            
            // Need to get the customer ID - it might be in the order
            let qrCode;
            if (order.customerId && order.scannedBagId) {
                qrCode = `${order.customerId}#${order.scannedBagId}`;
            } else {
                // If we don't have customerId, we can't proceed
                showError('Customer ID not found in order');
                return;
            }
            
            console.log('Sending QR code:', qrCode);
            
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/scan-processed`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    qrCode: qrCode
                })
            });
            
            // Check for token renewal
            checkAndUpdateToken(response);

            const data = await response.json();
            console.log('Process bag response:', data);

            if (response.ok) {
                if (data.warning === 'duplicate_scan') {
                    // Handle duplicate scan - show warning but not as error
                    console.log('Duplicate scan detected:', data.message);
                    showConfirmation(
                        data.message,
                        '⚠️',
                        'info'
                    );
                    setTimeout(hideConfirmation, 3000);
                } else if (data.success) {
                    if (data.allBagsProcessed) {
                        console.log('All bags processed - order ready for pickup');
                        showConfirmation(
                            data.message || 'All bags processed - ready for pickup',
                            '✅',
                            'success'
                        );
                        // Don't automatically show pickup modal - wait for actual pickup scan
                        setTimeout(hideConfirmation, 3000);
                    } else if (data.bag && data.orderProgress) {
                        console.log(`Bag processed:`, data.bag);
                        showConfirmation(
                            `${data.orderProgress.bagsProcessed} of ${data.orderProgress.totalBags} bags processed`,
                            '✓',
                            'success'
                        );
                    } else {
                        // Fallback message
                        showConfirmation(
                            data.message || 'Bag processed',
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
                    
                    // Hide confirmation after 3 seconds
                    setTimeout(hideConfirmation, 3000);
                } else {
                    console.error('Failed to process bag:', data.message);
                    showError(data.message || 'Failed to mark bag as processed');
                }
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
                <div class="success-message">
                    <p>
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
    function handlePickupScan(order, scannedBagId) {
        console.log('=== HANDLE PICKUP SCAN ===');
        console.log('Scanned bag ID:', scannedBagId);
        
        // Check if we're already tracking this order
        if (currentOrder && currentOrder.orderId === order.orderId && currentOrder.scannedBagsForPickup) {
            // Preserve the existing scanned bags tracking
            console.log('Preserving existing scanned bags tracking');
            order.scannedBagsForPickup = currentOrder.scannedBagsForPickup;
        }
        
        // Track current order for pickup
        currentOrder = order;
        currentOrder.scannedBagId = scannedBagId; // Store for later use

        // Initialize scanned bags tracking if not exists
        if (!currentOrder.scannedBagsForPickup) {
            currentOrder.scannedBagsForPickup = new Set();
            console.log('Initialized scannedBagsForPickup Set');
        }
        
        // Add this bag ID to the set if provided
        if (scannedBagId) {
            currentOrder.scannedBagsForPickup.add(scannedBagId);
            console.log('Added bag to pickup set:', scannedBagId);
        }
        console.log(`Total scanned bags: ${currentOrder.scannedBagsForPickup.size}`);
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
        
        // Check if order has add-ons
        const hasAddOns = order.addOns && (order.addOns.premiumDetergent || order.addOns.fabricSoftener || order.addOns.stainRemover);
        
        modalBody.innerHTML = `
            <div class="order-info">
                <p><strong>Customer:</strong> ${order.customerName}</p>
                <p><strong>Order ID:</strong> ${order.orderId}</p>
                <p><strong>Total Bags:</strong> ${totalBags}</p>
            </div>
            ${hasAddOns ? `
                <div class="add-ons-complete" style="background-color: #cce5ff; border: 2px solid #004085; border-radius: 4px; padding: 12px; margin: 12px 0;">
                    <h5 style="color: #004085; margin: 0 0 8px 0;">ℹ️ Add-ons Included</h5>
                    <div style="color: #004085; font-weight: bold;">
                        ${[
                            order.addOns.premiumDetergent && '✓ Premium Detergent',
                            order.addOns.fabricSoftener && '✓ Fabric Softener',
                            order.addOns.stainRemover && '✓ Stain Remover'
                        ].filter(Boolean).join('<br>')}
                    </div>
                </div>
            ` : ''}
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
                const percentage = remainingBags > 0 ? Math.round((scannedCount / remainingBags) * 100) : 0;
                progressBar.style.width = percentage + '%';
                progressBar.textContent = percentage + '%';
                console.log(`Progress: ${scannedCount}/${remainingBags} bags = ${percentage}%`);
            }
            
            // Keep scanner focused for additional bag scans
            if (!allBagsScanned) {
                focusScanner();
                console.log('Focused scanner for additional bag scans');
            }
        }, 50);
    }

    // Confirm all bags pickup
    function confirmAllBagsPickup() {
        console.log('=== CONFIRM ALL BAGS PICKUP ===');
        const bagsToPickup = currentOrder.numberOfBags - (currentOrder.bagsPickedUp || 0);
        console.log(`Confirming pickup of ${bagsToPickup} bags`);
        
        // Save the order data before closing modal since closeModal sets currentOrder to null
        const orderToConfirm = currentOrder;
        closeModal();
        
        // Pass the saved order data to confirmPickup
        confirmPickup(bagsToPickup, orderToConfirm);
    }

    // Cancel pickup and clear scanned bags
    function cancelPickup() {
        if (currentOrder && currentOrder.scannedBagsForPickup) {
            currentOrder.scannedBagsForPickup.clear();
        }
        closeModal();
    }

    // Submit weights
    const submitWeights = async function(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        
        const bagWeights = [];
        
        // Get the scanned bag IDs
        const scannedBagIds = Array.from(currentOrder.scannedBagsForWeighing);
        
        // Collect weights for each scanned bag
        for (let i = 0; i < scannedBagIds.length; i++) {
            const bagId = scannedBagIds[i];
            // Replace hyphens with underscores to match the input ID
            const sanitizedBagId = bagId.replace(/-/g, '_');
            const weightInput = document.getElementById(`bagWeight_${sanitizedBagId}`);
            
            if (!weightInput) {
                showError(`Weight input not found for bag ${i + 1}`);
                return;
            }
            
            const weight = parseFloat(weightInput.value);
            if (!weight || weight <= 0) {
                showError(`Please enter weight for Bag ${i + 1}`);
                return;
            }
            
            bagWeights.push({ 
                bagId: bagId,
                weight: weight
            });
        }

        try {
            const token = localStorage.getItem('operatorToken');
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/orders/weigh-bags`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    orderId: currentOrder.orderId,
                    bags: bagWeights
                })
            });
            
            // Check for token renewal
            checkAndUpdateToken(response);

            const data = await response.json();

            if (response.ok && data.success) {
                // Clear the scanned bags set
                if (currentOrder && currentOrder.scannedBagsForWeighing) {
                    currentOrder.scannedBagsForWeighing.clear();
                }
                closeModal();
                showConfirmation(`${bagWeights.length} bag${bagWeights.length > 1 ? 's' : ''} marked as processing`, '⚖️', 'success');
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
    async function confirmPickup(numberOfBags = 1, order = null) {
        console.log('=== CONFIRM PICKUP CALLED ===');
        console.log('Number of bags:', numberOfBags);
        console.log('Order:', order || currentOrder);
        
        // Use passed order or fall back to currentOrder
        const orderToProcess = order || currentOrder;
        
        if (!orderToProcess) {
            console.error('No order to process!');
            return;
        }

        try {
            const token = localStorage.getItem('operatorToken');
            
            // Get the scanned bag IDs
            const scannedBagIds = orderToProcess.scannedBagsForPickup ? 
                Array.from(orderToProcess.scannedBagsForPickup) : [];
            
            console.log('Confirming pickup with bag IDs:', scannedBagIds);
            console.log('Order ID:', orderToProcess.orderId);
            console.log('Request body:', JSON.stringify({ 
                orderId: orderToProcess.orderId,
                bagIds: scannedBagIds
            }));
            
            const response = await csrfFetch(`${BASE_URL}/api/v1/operators/complete-pickup`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    orderId: orderToProcess.orderId,
                    bagIds: scannedBagIds
                })
            });
            
            // Check for token renewal
            checkAndUpdateToken(response);

            const data = await response.json();
            console.log('Complete pickup response:', data);
            console.log('Response status:', response.status);
            
            if (response.ok && data.success) {
                await loadStats();
                
                // Show success message
                showConfirmation(`Order ${orderToProcess.orderId} complete! Customer notified.`, '✅', 'success');
                setTimeout(hideConfirmation, 3000);
                
                // Clear the scanned bags tracking
                if (orderToProcess && orderToProcess.scannedBagsForPickup) {
                    orderToProcess.scannedBagsForPickup.clear();
                }
            } else {
                console.error('Complete pickup failed:', data);
                showError(data.message || 'Failed to complete pickup');
            }
        } catch (error) {
            console.error('Pickup confirmation error:', error);
            showError('Network error. Please try again.');
        }
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
    const closeModal = function(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        console.log('=== CLOSE MODAL ===');
        console.log('Modal state before close:', {
            classes: orderModal.className,
            forceVisible: orderModal.getAttribute('data-force-visible')
        });
        
        // Remove the force-visible attribute
        orderModal.removeAttribute('data-force-visible');
        
        // Remove active class
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


    // Logout
    const logout = function() {
        console.log('Logout function called');
        
        localStorage.removeItem('operatorToken');
        localStorage.removeItem('operatorRefreshToken');
        localStorage.removeItem('operatorData');
        
        // Clear session manager data if available
        if (window.SessionManager) {
            window.SessionManager.clearAuth('operator');
        }
        
        // Exit fullscreen if in fullscreen mode
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
        
        // Check if running in Fully Kiosk Browser
        console.log('Checking for Fully Kiosk Browser...');
        console.log('typeof fully:', typeof fully);
        
        if (typeof fully !== 'undefined') {
            console.log('Fully Kiosk Browser detected');
            console.log('fully.exit available:', typeof fully.exit);
            
            // With PLUS license, we can use the exit function
            if (fully.exit && typeof fully.exit === 'function') {
                console.log('Calling fully.exit() - PLUS license feature');
                fully.exit();
                return;
            }
            
            // Fallback if exit is not available
            console.log('fully.exit not available - check PLUS license and settings');
            
            // Try other PLUS methods
            if (fully.stopKiosk && typeof fully.stopKiosk === 'function') {
                console.log('Calling fully.stopKiosk()');
                fully.stopKiosk();
                return;
            }
            
            // Final fallback - clear screen and show message
            document.body.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #1e3a8a; color: white; font-family: Arial;">
                    <div style="text-align: center;">
                        <h1 style="font-size: 48px; margin-bottom: 20px;">Logged Out</h1>
                        <p style="font-size: 24px;">Exit function not available. Check Fully Kiosk settings.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Try other kiosk browser methods
        if (window.AndroidFullScreen && window.AndroidFullScreen.closeApp) {
            console.log('AndroidFullScreen API detected, closing app');
            window.AndroidFullScreen.closeApp();
            return;
        }
        
        // Try standard window.close()
        console.log('Trying window.close()');
        window.close();
        
        // If window.close() doesn't work, redirect as fallback
        setTimeout(function() {
            if (!window.closed) {
                console.log('Window still open, redirecting...');
                window.location.href = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program';
            }
        }, 100);
    };

    // Expose functions to global scope for onclick handlers
    window.closeModal = closeModal;
    window.confirmBagProcessed = confirmBagProcessed;
    window.confirmReady = confirmReady;
    window.confirmAllBagsPickup = confirmAllBagsPickup;
    window.cancelPickup = cancelPickup;
    window.submitWeights = submitWeights;
    window.logout = logout; // Expose logout function

    // Initialize on DOM ready (only once)
    let initialized = false;
    function handleDOMReady() {
        if (!initialized) {
            initialized = true;
            init();
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleDOMReady);
    } else {
        handleDOMReady();
    }
})();