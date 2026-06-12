(function() {
    'use strict';

    // Configuration
    const config = window.EMBED_CONFIG || {
        baseUrl: window.location.origin
    };
    const BASE_URL = config.baseUrl;
    
    // Use ApiClient for all API calls

    // State
    let currentOrder = null;
    let scanBuffer = '';
    let scanTimeout = null;
    let confirmationTimeout = null;
    let operatorData = null;
    let statsInterval = null;

    // i18n helper — i18n.js returns the key itself when a translation is
    // missing; fall back to readable English in that case.
    function t(key, fallback) {
        var translated = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : key;
        return (translated && translated !== key) ? translated : (fallback || key);
    }

    // DOM elements
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

    // Helper function to manage action bar visibility
    function toggleActionBar(show) {
        const actionBar = document.querySelector('.action-bar');
        if (actionBar) {
            if (show) {
                // Label printing moved to the admin dashboard; nothing to show here.
            } else {
                actionBar.style.display = 'none';
                actionBar.style.opacity = '0';
            }
        }
    }

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
            const data = await ApiClient.get('/api/v1/auth/verify', {
                showError: false,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

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
            await ApiClient.get('/api/v1/operators/stats/today', {
                showError: false,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('Token validation successful');
        } catch (error) {
            if (error.status === 401) {
                console.error('Operator token is invalid or expired');
                localStorage.removeItem('operatorToken');
                localStorage.removeItem('operatorData');
                window.location.href = '/operator-login-embed.html';
                return;
            }
            console.error('Error verifying operator token:', error);
        }

        // Initialize ApiClient CSRF token
        if (window.ApiClient) {
            ApiClient.initCSRF();
            console.log('ApiClient CSRF token initialized');
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
        
        // Keyboard hiding for Fully Kiosk (only for scanner input)
        if (typeof fully !== 'undefined' && fully.hideKeyboard) {
            console.log('Setting up Fully Kiosk keyboard handlers');

            // Hide keyboard only for the scanner input field
            document.addEventListener('focusin', function(e) {
                // Only hide keyboard for the scanner input, not for weight inputs or other fields
                if (e.target.id === 'scanInput') {
                    setTimeout(() => {
                        fully.hideKeyboard();
                    }, 100);
                }
            });

            // Periodic keyboard hide only if scanner input is focused
            setInterval(() => {
                if (document.activeElement && document.activeElement.id === 'scanInput') {
                    fully.hideKeyboard();
                }
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
            
            const data = await ApiClient.get('/api/v1/operators/stats/today', {
                showError: false,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('Stats response received');
            
            updateStatsDisplay(data);
        } catch (error) {
            if (error.status === 401) {
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
            } else {
                console.error('Error loading stats:', error);
                console.error('Stats error details:', {
                    message: error.message,
                    stack: error.stack
                });
            }
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

            // Refocus scanner only when no modal is active, no other input is
            // focused, and weight inputs are not visible.
            if (!orderModal.classList.contains('active') &&
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

    // Token renewal is handled automatically by ApiClient

    // Process scanned code
    async function processScan(scanData) {
        console.log('=== SCAN WORKFLOW START ===');
        console.log('Scan data received:', scanData);
        
        try {
            showConfirmation('Scanning...', '🔍', 'info');

            const token = localStorage.getItem('operatorToken');
            
            console.log('Processing scan with token:', token ? 'Present' : 'Missing');
            console.log('CSRF token status:', CsrfUtils.getToken() ? 'Present' : 'Missing');
            
            // Extract the durable-bag token (raw 32-hex or printed claim URL).
            const bagToken = window.BagTokenParser.extractBagToken(scanData);
            if (!bagToken) {
                hideConfirmation();
                showError(t('operator.intake.error.bagNotFound', 'Bag not recognized'));
                return;
            }

            // Canonical scan-context resolver (PR 6). Drives the kiosk branch.
            // ApiClient throws on non-2xx and on success:false bodies, so any
            // resolver failure (e.g. the anti-enumeration 404) lands in catch.
            const resolveData = await ApiClient.get(`/api/v1/bags/resolve/${bagToken}`, { showError: false });
            hideConfirmation();

            if (resolveData.outcome === 'unclaimed') {
                showError(t('operator.intake.error.bagNotActive', 'This bag has not been claimed by a customer yet'));
                return;
            }

            const nextAction = resolveData.order && resolveData.order.nextAction
                ? resolveData.order.nextAction
                : 'intake'; // claimed bag with no open order -> intake

            switch (nextAction) {
                case 'intake':
                    showIntakeModal(bagToken, resolveData, false);
                    break;
                case 'advance':
                    await sendScanProcessed(bagToken);
                    break;
                case 'deliver-or-reintake':
                    // Kiosk = operator context: the bag is physically back at the
                    // store. Explicit confirm before closing the picked_up order.
                    showReintakeConfirm(bagToken, resolveData);
                    break;
                default:
                    showError(t('operator.intake.error.bagNotActive', 'This bag has not been claimed by a customer yet'));
            }
        } catch (error) {
            console.error('Scan error:', error);
            hideConfirmation();
            if (error.status === 404) {
                // Anti-enumeration 404: unknown / minted / retired tokens.
                showError(t('operator.intake.error.bagNotFound', 'Bag not recognized'));
            } else {
                showError('Network error. Please try again.');
            }
        }
    }

    // Intake modal — weight + add-ons (operator ENTERS from the paper form)
    // + required fresh-form-placed ack (spec §6.4).
    function showIntakeModal(bagToken, resolveData, isReintake) {
        modalTitle.textContent = t('operator.intake.title', 'Bag Intake');
        // No affiliate slot here: the claimed-outcome resolve response carries
        // {outcome, customerId, nextAction, order} — no affiliate object — so
        // the slot could never populate on the intake path.
        modalBody.innerHTML = `
            <div class="weight-input-section">
                <div class="bag-weight-input">
                    <label for="intakeWeight" id="intakeWeightLabel"></label>
                    <input type="number" id="intakeWeight" class="weight-input" step="0.1" min="0.1">
                </div>
            </div>
            <div class="add-ons-confirmation">
                <h5 id="intakeAddOnsHeading"></h5>
                <label><input type="checkbox" id="intakeAddOnDetergent"> <span id="intakeAddOnDetergentLabel"></span></label><br>
                <label><input type="checkbox" id="intakeAddOnSoftener"> <span id="intakeAddOnSoftenerLabel"></span></label><br>
                <label><input type="checkbox" id="intakeAddOnStain"> <span id="intakeAddOnStainLabel"></span></label>
            </div>
            <div class="add-ons-confirmation">
                <label><input type="checkbox" id="intakeFreshFormAck"> <span id="intakeFreshFormAckLabel"></span></label>
            </div>
            <div class="action-buttons">
                <button class="btn btn-secondary" id="intakeCancelBtn"></button>
                <button class="btn btn-primary" id="intakeSubmitBtn" disabled></button>
            </div>
        `;

        // Translated copy via textContent (CSP/XSS-safe).
        document.getElementById('intakeWeightLabel').textContent = t('operator.intake.weightLabel', 'Weight (lbs)');
        document.getElementById('intakeWeight').setAttribute('placeholder', t('operator.intake.weightPlaceholder', 'Enter weight in pounds'));
        document.getElementById('intakeAddOnsHeading').textContent = t('operator.intake.addOnsHeading', 'Add-ons (from the paper form)');
        document.getElementById('intakeAddOnDetergentLabel').textContent = t('operator.intake.addOns.premiumDetergent', 'Premium Detergent');
        document.getElementById('intakeAddOnSoftenerLabel').textContent = t('operator.intake.addOns.fabricSoftener', 'Fabric Softener');
        document.getElementById('intakeAddOnStainLabel').textContent = t('operator.intake.addOns.stainRemover', 'Stain Remover');
        document.getElementById('intakeFreshFormAckLabel').textContent = t('operator.intake.freshFormAck', 'A fresh add-ons form has been placed in the bag pocket');
        document.getElementById('intakeCancelBtn').textContent = t('operator.intake.cancel', 'Cancel');
        document.getElementById('intakeSubmitBtn').textContent = t('operator.intake.submit', 'Create Order');

        orderModal.classList.add('weight-input-modal-active', 'active');
        toggleActionBar(false);

        const weightInput = document.getElementById('intakeWeight');
        const ackBox = document.getElementById('intakeFreshFormAck');
        const submitBtn = document.getElementById('intakeSubmitBtn');

        function validate() {
            const w = parseFloat(weightInput.value);
            submitBtn.disabled = !(w > 0 && ackBox.checked);
        }
        weightInput.addEventListener('input', validate);
        ackBox.addEventListener('change', validate);
        document.getElementById('intakeCancelBtn').addEventListener('click', closeModal);
        submitBtn.addEventListener('click', function() { submitIntake(bagToken, isReintake); });

        setTimeout(function() { weightInput.focus(); }, 100);
    }

    async function submitIntake(bagToken, isReintake) {
        const submitBtn = document.getElementById('intakeSubmitBtn');
        if (submitBtn) submitBtn.disabled = true;

        const body = {
            bagToken: bagToken,
            weight: parseFloat(document.getElementById('intakeWeight').value),
            addOns: {
                premiumDetergent: document.getElementById('intakeAddOnDetergent').checked,
                fabricSoftener: document.getElementById('intakeAddOnSoftener').checked,
                stainRemover: document.getElementById('intakeAddOnStain').checked
            },
            freshAddOnsFormPlaced: document.getElementById('intakeFreshFormAck').checked
        };

        try {
            const token = localStorage.getItem('operatorToken');
            await ApiClient.post('/api/v1/operators/intake', body, {
                showError: false,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // ApiClient throws on non-2xx / success:false, so reaching here
            // means the order was created.
            closeModal();
            showConfirmation(t('operator.intake.created', 'Order created — payment request sent'), '✅', 'success');
            setTimeout(hideConfirmation, 3000);
            await loadStats();
        } catch (error) {
            console.error('Intake submit error:', error);
            if (submitBtn) submitBtn.disabled = false;
            // The intake endpoint sends sendError(..., { code, ... });
            // ApiClient carries the parsed body on error.data.
            const body = error.data;
            const code = (body && body.errors && body.errors.code) || null;
            if (code === 'order_already_open') {
                showError(t('operator.intake.error.orderAlreadyOpen', 'An order is already open for this bag'));
            } else if (code === 'bag_not_active') {
                showError(t('operator.intake.error.bagNotActive', 'This bag has not been claimed by a customer yet'));
            } else if (code === 'invalid_bag') {
                showError(t('operator.intake.error.bagNotFound', 'Bag not recognized'));
            } else if (body && body.message) {
                showError(body.message);
            } else {
                showError('Network error. Please try again.');
            }
        }
    }

    // Stage-2 scan: WDF done. PR 9 swaps this to /api/v1/operators/advance.
    async function sendScanProcessed(bagToken) {
        try {
            const token = localStorage.getItem('operatorToken');
            await ApiClient.post('/api/v1/operators/scan-processed',
                { bagToken: bagToken },
                { showError: false, headers: { 'Authorization': `Bearer ${token}` } }
            );
            // ApiClient throws on success:false, so reaching here means the
            // bag advanced. duplicate_scan replies are 200 + success:false +
            // warning, which ApiClient also throws — handled in catch below.
            showConfirmation(t('operator.intake.processedScan', 'Bag marked processed'), '✅', 'success');
            setTimeout(hideConfirmation, 3000);
            await loadStats();
        } catch (error) {
            console.error('scan-processed error:', error);
            const body = error.data;
            if (body && body.warning === 'duplicate_scan') {
                showConfirmation(t('operator.intake.alreadyProcessed', 'This bag has already been processed'), '⚠️', 'warning');
                setTimeout(hideConfirmation, 3000);
                await loadStats();
            } else if (body && (body.message || body.error)) {
                showError(body.message || body.error);
            } else {
                showError('Network error. Please try again.');
            }
        }
    }

    // picked_up bag back at the store: explicit confirm, then intake
    // (the server auto-delivers the prior order — spec §6.4 re-intake).
    function showReintakeConfirm(bagToken, resolveData) {
        modalTitle.textContent = t('operator.intake.title', 'Bag Intake');
        modalBody.innerHTML = `
            <div class="process-confirm-section">
                <h5 id="reintakePromptText"></h5>
            </div>
            <div class="action-buttons">
                <button class="btn btn-secondary" id="reintakeCancelBtn"></button>
                <button class="btn btn-primary" id="reintakeConfirmBtn"></button>
            </div>
        `;
        document.getElementById('reintakePromptText').textContent =
            t('operator.intake.reintakePrompt', "This bag's last order is still out for delivery. Mark it delivered and start a new order?");
        document.getElementById('reintakeCancelBtn').textContent = t('operator.intake.cancel', 'Cancel');
        document.getElementById('reintakeConfirmBtn').textContent = t('operator.intake.reintakeConfirm', 'Mark delivered & start new order');

        orderModal.classList.add('active');
        toggleActionBar(false);

        document.getElementById('reintakeCancelBtn').addEventListener('click', closeModal);
        document.getElementById('reintakeConfirmBtn').addEventListener('click', function() {
            showIntakeModal(bagToken, resolveData, true);
        });
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
        toggleActionBar(true); // Show action bar when modal closes
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
                        <h1 class="logout-title">Logged Out</h1>
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

    // Expose to global scope (kiosk-browser integrations may call these).
    window.closeModal = closeModal;
    window.logout = logout;

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