// DocuSign W9 Integration for Affiliate Dashboard
// WaveMAX Laundry Affiliate Program

(function() {
  'use strict';

  // DocuSign integration state
  let docusignState = {
    isSigningInProgress: false,
    currentEnvelopeId: null,
    returnUrl: null
  };

  /**
   * Initialize DocuSign W9 integration
   */
  function initializeDocuSignW9() {
    // Replace upload form with DocuSign button
    replaceUploadWithDocuSign();
    
    // Listen for return from DocuSign
    checkForDocuSignReturn();
    
    // Add event listeners
    addEventListeners();
  }

  /**
   * Replace the upload form with DocuSign signing button
   */
  function replaceUploadWithDocuSign() {
    const uploadForm = document.getElementById('w9UploadForm');
    if (!uploadForm) return;

    // Create DocuSign section
    const docusignSection = document.createElement('div');
    docusignSection.id = 'w9DocuSignSection';
    docusignSection.innerHTML = `
      <div class="space-y-4">
        <!-- Main signing button -->
        <button id="startW9Signing" type="button" 
                class="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
            </path>
          </svg>
          <span data-i18n="affiliate.dashboard.settings.completeW9WithDocuSign">Complete W9 Form with DocuSign</span>
        </button>
        
        <!-- Signing in progress indicator -->
        <div id="signingInProgress" style="display: none;" 
             class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
          <div class="flex items-center">
            <svg class="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
              </path>
            </svg>
            <span data-i18n="affiliate.dashboard.settings.signingInProgress">W9 signing in progress...</span>
          </div>
        </div>
        
        <!-- Embedded signing container (for future enhancement) -->
        <div id="docusignContainer" style="display: none;" class="mt-4">
          <div class="border-2 border-gray-300 rounded-lg p-4">
            <iframe id="docusignFrame" width="100%" height="600px" class="border-0"></iframe>
          </div>
          <button id="closeDocuSignFrame" type="button" 
                  class="mt-2 text-gray-600 hover:text-gray-800">
            <span data-i18n="common.buttons.close">Close</span>
          </button>
        </div>
        
        <!-- Help text -->
        <p class="text-sm text-gray-600 mt-2">
          <span data-i18n="affiliate.dashboard.settings.docusignHelp">
            Click the button above to securely complete your W9 form using DocuSign's e-signature platform. 
            You'll be redirected to DocuSign to fill out and sign your form electronically.
          </span>
        </p>
        
        <!-- Alternative options -->
        <div class="pt-4 border-t">
          <p class="text-sm text-gray-500 mb-2">
            <span data-i18n="affiliate.dashboard.settings.needBlankW9">Need a blank W9 form?</span>
          </p>
          <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" target="_blank" 
             class="inline-flex items-center text-green-600 hover:text-green-700">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
              </path>
            </svg>
            <span data-i18n="affiliate.dashboard.settings.downloadBlankW9">Download Blank W9 Form</span>
          </a>
        </div>
      </div>
    `;

    // Replace upload form with DocuSign section
    uploadForm.parentNode.replaceChild(docusignSection, uploadForm);
  }

  /**
   * Add event listeners
   */
  function addEventListeners() {
    // Start signing button
    const startButton = document.getElementById('startW9Signing');
    if (startButton) {
      startButton.addEventListener('click', handleStartSigning);
    }

    // Close iframe button (for embedded signing)
    const closeButton = document.getElementById('closeDocuSignFrame');
    if (closeButton) {
      closeButton.addEventListener('click', closeEmbeddedSigning);
    }
  }

  /**
   * Handle start signing button click
   */
  async function handleStartSigning() {
    try {
      console.log('Starting W9 signing process...');
      
      // Disable button and show progress
      const button = document.getElementById('startW9Signing');
      button.disabled = true;
      document.getElementById('signingInProgress').style.display = 'block';

      // Get CSRF token
      const csrfToken = await window.CsrfUtils.ensureCsrfToken();

      // Initiate signing with backend
      console.log('Calling initiate-signing endpoint...');
      const response = await fetch('/api/v1/w9/initiate-signing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
        }
      });
      
      console.log('Initiate signing response:', response.status);

      if (response.status === 401) {
        // Need to authorize with DocuSign
        const data = await response.json();
        console.log('Got 401 response, checking for auth URL:', data);
        if (data.authorizationUrl) {
          handleDocuSignAuthorization(data.authorizationUrl, data.state);
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to initiate signing');
      }

      const data = await response.json();
      console.log('DocuSign response:', data);
      
      // Store envelope ID
      docusignState.currentEnvelopeId = data.envelopeId;
      docusignState.isSigningInProgress = true;
      
      // Store return URL for later
      docusignState.returnUrl = window.location.href;
      
      // Open DocuSign in a new window
      console.log('Opening DocuSign window with URL:', data.signingUrl);
      openDocuSignWindow(data.signingUrl, data.envelopeId);
      
    } catch (error) {
      console.error('Failed to start W9 signing:', error);
      showError(window.i18n.t('affiliate.dashboard.settings.signingError'));
      
      // Re-enable button
      document.getElementById('startW9Signing').disabled = false;
      document.getElementById('signingInProgress').style.display = 'none';
    }
  }

  /**
   * Handle DocuSign authorization
   */
  function handleDocuSignAuthorization(authorizationUrl, state) {
    // Store state for verification
    docusignState.authState = state;
    
    showInfo(window.i18n.t('affiliate.dashboard.settings.authorizationRequired', 
      'DocuSign authorization required. A new window will open for you to grant access.'));
    
    // Calculate window position
    const windowWidth = 600;
    const windowHeight = 700;
    const left = (screen.width - windowWidth) / 2;
    const top = (screen.height - windowHeight) / 2;
    
    const windowFeatures = `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    
    // Open authorization window
    const authWindow = window.open(authorizationUrl, 'DocuSignAuth', windowFeatures);
    
    if (!authWindow) {
      showError(window.i18n.t('affiliate.dashboard.settings.popupBlocked', 
        'Please allow popups for this site to complete DocuSign authorization.'));
      // Re-enable button
      document.getElementById('startW9Signing').disabled = false;
      document.getElementById('signingInProgress').style.display = 'none';
      return;
    }
    
    // Store state for verification
    docusignState.authState = state;
    docusignState.authWindow = authWindow;
    docusignState.authInProgress = true;
    
    // Listen for authorization success message
    const messageHandler = (event) => {
      console.log('Received message from:', event.origin);
      console.log('Message data:', event.data);
      
      // Accept messages from our own domain
      if (event.origin !== 'https://wavemax.promo') {
        return;
      }
      
      if (event.data && event.data.type === 'docusign-auth-success') {
        console.log('DocuSign auth success message received');
        window.removeEventListener('message', messageHandler);
        clearInterval(windowCheckInterval); // Clear the interval immediately
        
        // Mark auth as complete
        docusignState.authInProgress = false;
        docusignState.authCompleted = true;
        
        showSuccess(window.i18n.t('affiliate.dashboard.settings.authorizationSuccess',
          'DocuSign authorization successful! Starting W9 signing...'));
        
        // Re-enable button temporarily for retry
        const button = document.getElementById('startW9Signing');
        if (button) {
          button.disabled = false;
        }
        
        // Retry signing after successful authorization
        setTimeout(() => {
          console.log('Retrying W9 signing after auth success');
          handleStartSigning();
        }, 1500);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Check if window is closed
    const windowCheckInterval = setInterval(() => {
      if (authWindow.closed) {
        clearInterval(windowCheckInterval);
        window.removeEventListener('message', messageHandler);
        
        // Check if auth was completed
        if (!docusignState.authCompleted) {
          console.log('Window closed, checking for auth completion...');
          // Wait a bit more to see if auth completed
          setTimeout(() => {
            // Check localStorage as fallback
            try {
              const authData = localStorage.getItem('docusign-auth-success');
              console.log('Checking localStorage for auth success:', authData);
              if (authData) {
                const parsed = JSON.parse(authData);
                // Check if it's recent (within last 60 seconds)
                if (parsed.success && (Date.now() - parsed.timestamp) < 60000) {
                  console.log('Found auth success in localStorage');
                  localStorage.removeItem('docusign-auth-success');
                  
                  docusignState.authCompleted = true;
                  
                  showSuccess(window.i18n.t('affiliate.dashboard.settings.authorizationSuccess',
                    'DocuSign authorization successful! Starting W9 signing...'));
                  
                  // Re-enable button temporarily for retry
                  const button = document.getElementById('startW9Signing');
                  if (button) {
                    button.disabled = false;
                  }
                  
                  // Check authorization status first
                  setTimeout(async () => {
                    console.log('Checking authorization status before retry...');
                    try {
                      const csrfToken = await window.CsrfUtils.ensureCsrfToken();
                      const authCheckResponse = await fetch('/api/v1/w9/authorization-status', {
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`,
                          'X-CSRF-Token': csrfToken
                        }
                      });
                      
                      if (authCheckResponse.ok) {
                        const authStatus = await authCheckResponse.json();
                        if (authStatus.authorized) {
                          console.log('Authorization confirmed, retrying W9 signing...');
                          handleStartSigning();
                        } else {
                          console.log('Authorization not confirmed yet');
                        }
                      }
                    } catch (error) {
                      console.error('Error checking authorization status:', error);
                    }
                  }, 2000);
                  return;
                }
              }
            } catch (e) {
              console.error('Error checking localStorage:', e);
            }
            
            // Give it more time - check again in 2 seconds
            setTimeout(() => {
              const authData = localStorage.getItem('docusign-auth-success');
              if (authData) {
                try {
                  const parsed = JSON.parse(authData);
                  if (parsed.success && (Date.now() - parsed.timestamp) < 60000) {
                    console.log('Found auth success in localStorage (second check)');
                    localStorage.removeItem('docusign-auth-success');
                    
                    docusignState.authCompleted = true;
                    
                    showSuccess(window.i18n.t('affiliate.dashboard.settings.authorizationSuccess',
                      'DocuSign authorization successful! Starting W9 signing...'));
                    
                    // Re-enable button and retry
                    const button = document.getElementById('startW9Signing');
                    if (button) {
                      button.disabled = false;
                    }
                    
                    // Check authorization status first
                    setTimeout(async () => {
                      console.log('Checking authorization status before retry (second check)...');
                      try {
                        const csrfToken = await window.CsrfUtils.ensureCsrfToken();
                        const authCheckResponse = await fetch('/api/v1/w9/authorization-status', {
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`,
                            'X-CSRF-Token': csrfToken
                          }
                        });
                        
                        if (authCheckResponse.ok) {
                          const authStatus = await authCheckResponse.json();
                          if (authStatus.authorized) {
                            console.log('Authorization confirmed (second check), retrying W9 signing...');
                            handleStartSigning();
                          } else {
                            console.log('Authorization not confirmed yet (second check)');
                            // Re-enable button for manual retry
                            const button = document.getElementById('startW9Signing');
                            if (button) {
                              button.disabled = false;
                              document.getElementById('signingInProgress').style.display = 'none';
                            }
                          }
                        }
                      } catch (error) {
                        console.error('Error checking authorization status (second check):', error);
                      }
                    }, 2000);
                    return;
                  }
                } catch (e) {
                  console.error('Error checking localStorage (second check):', e);
                }
              }
              
              if (!docusignState.authCompleted) {
                // Re-enable button if auth wasn't successful
                const button = document.getElementById('startW9Signing');
                if (button && button.disabled) {
                  button.disabled = false;
                  document.getElementById('signingInProgress').style.display = 'none';
                  showInfo(window.i18n.t('affiliate.dashboard.settings.authorizationCancelled',
                    'Authorization was cancelled.'));
                }
              }
            }, 2000);
          }, 1000);
        }
      }
    }, 500);
  }


  /**
   * Open DocuSign in a new window
   */
  function openDocuSignWindow(signingUrl, envelopeId) {
    // Calculate window position
    const windowWidth = 900;
    const windowHeight = 700;
    const left = (screen.width - windowWidth) / 2;
    const top = (screen.height - windowHeight) / 2;
    
    const windowFeatures = `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=yes`;
    
    // Open the DocuSign window
    const docusignWindow = window.open(signingUrl, 'DocuSignW9', windowFeatures);
    
    if (!docusignWindow) {
      showError(window.i18n.t('affiliate.dashboard.settings.popupBlocked', 
        'Please allow popups for this site to complete W9 signing.'));
      // Re-enable button
      document.getElementById('startW9Signing').disabled = false;
      document.getElementById('signingInProgress').style.display = 'none';
      return;
    }
    
    console.log('DocuSign window opened, monitoring status...');
    
    // Track if signing is completed
    let signingCompleted = false;
    let windowClosed = false;
    
    // Monitor window closure
    const windowCheckInterval = setInterval(() => {
      if (docusignWindow.closed) {
        windowClosed = true;
        clearInterval(windowCheckInterval);
        clearInterval(pollingInterval);
        
        // Reset UI
        document.getElementById('startW9Signing').disabled = false;
        document.getElementById('signingInProgress').style.display = 'none';
        
        if (!signingCompleted) {
          console.log('DocuSign window closed without completion');
          showInfo(window.i18n.t('affiliate.dashboard.settings.signingCancelled',
            'W9 signing was cancelled.'));
        }
        
        // Reload W9 status
        if (typeof loadW9Status === 'function') {
          setTimeout(loadW9Status, 1000);
        }
      }
    }, 500);
    
    // Poll for completion status
    let pollCount = 0;
    const maxPolls = 120; // 10 minutes (5 seconds * 120)
    
    const pollingInterval = setInterval(async () => {
      pollCount++;
      
      if (windowClosed || signingCompleted || pollCount > maxPolls) {
        clearInterval(pollingInterval);
        if (pollCount > maxPolls) {
          showWarning(window.i18n.t('affiliate.dashboard.settings.signingTimeout',
            'W9 signing session timed out. Please try again.'));
        }
        return;
      }
      
      try {
        // Check envelope status
        const statusResponse = await fetch(`/api/v1/w9/envelope-status/${envelopeId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('affiliateToken')}`
          }
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          if (statusData.status === 'completed') {
            signingCompleted = true;
            clearInterval(pollingInterval);
            clearInterval(windowCheckInterval);
            
            // Close the window if still open
            if (!docusignWindow.closed) {
              docusignWindow.close();
            }
            
            // Show success
            showSuccess(window.i18n.t('affiliate.dashboard.settings.w9SigningComplete',
              'Your W9 form has been signed successfully! It will be reviewed by our team.'));
            
            // Reset UI
            document.getElementById('startW9Signing').disabled = false;
            document.getElementById('signingInProgress').style.display = 'none';
            
            // Reload W9 status
            if (typeof loadW9Status === 'function') {
              setTimeout(loadW9Status, 1000);
            }
          }
        }
      } catch (error) {
        console.error('Error checking envelope status:', error);
      }
    }, 5000); // Poll every 5 seconds
    
    // Store intervals for cleanup
    docusignState.windowCheckInterval = windowCheckInterval;
    docusignState.pollingInterval = pollingInterval;
  }

  /**
   * Show embedded signing iframe
   */
  function showEmbeddedSigning(signingUrl) {
    const container = document.getElementById('docusignContainer');
    const iframe = document.getElementById('docusignFrame');
    
    // Set iframe source
    iframe.src = signingUrl;
    
    // Show container
    container.style.display = 'block';
    
    // Hide signing button
    document.getElementById('startW9Signing').style.display = 'none';
    
    // Listen for DocuSign events
    window.addEventListener('message', handleDocuSignMessage);
  }

  /**
   * Close embedded signing
   */
  function closeEmbeddedSigning() {
    const container = document.getElementById('docusignContainer');
    const iframe = document.getElementById('docusignFrame');
    
    // Clear iframe
    iframe.src = 'about:blank';
    
    // Hide container
    container.style.display = 'none';
    
    // Show signing button
    document.getElementById('startW9Signing').style.display = 'block';
    document.getElementById('startW9Signing').disabled = false;
    document.getElementById('signingInProgress').style.display = 'none';
    
    // Remove event listener
    window.removeEventListener('message', handleDocuSignMessage);
    
    // Reload W9 status
    if (typeof loadW9Status === 'function') {
      loadW9Status();
    }
  }

  /**
   * Handle messages from DocuSign iframe
   */
  function handleDocuSignMessage(event) {
    // Verify origin
    if (!event.origin.includes('docusign')) return;
    
    const message = event.data;
    
    if (message.event === 'signing_complete') {
      // Signing completed successfully
      closeEmbeddedSigning();
      showSuccess(window.i18n.t('affiliate.dashboard.settings.signingComplete',
        'W9 form signed successfully!'));
    } else if (message.event === 'cancel') {
      // User cancelled signing
      closeEmbeddedSigning();
    }
  }

  /**
   * Check if returning from DocuSign
   */
  function checkForDocuSignReturn() {
    // Check URL parameters for DocuSign return
    const urlParams = new URLSearchParams(window.location.search);
    const event = urlParams.get('event');
    const envelopeId = urlParams.get('envelopeId');
    
    if (event && envelopeId) {
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Handle return event
      handleDocuSignReturn(event, envelopeId);
    }
  }

  /**
   * Handle return from DocuSign
   */
  function handleDocuSignReturn(event, envelopeId) {
    switch (event) {
      case 'signing_complete':
        showSuccess(window.i18n.t('affiliate.dashboard.settings.w9SigningComplete',
          'Your W9 form has been signed successfully! It will be reviewed by our team.'));
        break;
      case 'cancel':
        showInfo(window.i18n.t('affiliate.dashboard.settings.w9SigningCancelled',
          'W9 signing was cancelled.'));
        break;
      case 'decline':
        showWarning(window.i18n.t('affiliate.dashboard.settings.w9SigningDeclined',
          'W9 signing was declined.'));
        break;
      case 'session_timeout':
        showWarning(window.i18n.t('affiliate.dashboard.settings.w9SessionTimeout',
          'Your signing session timed out. Please try again.'));
        break;
      default:
        console.log('Unknown DocuSign event:', event);
    }
    
    // Reset state
    docusignState.isSigningInProgress = false;
    docusignState.currentEnvelopeId = null;
    
    // Reload W9 status
    if (typeof loadW9Status === 'function') {
      setTimeout(loadW9Status, 1000);
    }
  }

  /**
   * Update W9 status display for DocuSign
   */
  function updateW9StatusForDocuSign(statusData) {
    const statusText = document.getElementById('w9StatusText');
    const statusAlert = document.getElementById('w9StatusAlert');
    
    if (!statusText || !statusAlert) return;
    
    // Add DocuSign-specific status information
    if (statusData.docusignStatus) {
      const docusignStatusMap = {
        'sent': {
          text: window.i18n.t('affiliate.dashboard.settings.docusignSent', 'W9 form sent - awaiting signature'),
          class: 'bg-blue-100 border-blue-400 text-blue-700'
        },
        'delivered': {
          text: window.i18n.t('affiliate.dashboard.settings.docusignDelivered', 'W9 form opened - in progress'),
          class: 'bg-blue-100 border-blue-400 text-blue-700'
        },
        'completed': {
          text: window.i18n.t('affiliate.dashboard.settings.docusignCompleted', 'W9 form signed - under review'),
          class: 'bg-green-100 border-green-400 text-green-700'
        },
        'declined': {
          text: window.i18n.t('affiliate.dashboard.settings.docusignDeclined', 'W9 signing declined'),
          class: 'bg-red-100 border-red-400 text-red-700'
        },
        'voided': {
          text: window.i18n.t('affiliate.dashboard.settings.docusignVoided', 'W9 request cancelled'),
          class: 'bg-gray-100 border-gray-400 text-gray-700'
        }
      };
      
      const statusInfo = docusignStatusMap[statusData.docusignStatus];
      if (statusInfo) {
        statusAlert.className = `mb-6 px-4 py-3 rounded border ${statusInfo.class}`;
        statusAlert.innerHTML = `
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
            </svg>
            <span>${statusInfo.text}</span>
          </div>
        `;
      }
    }
    
    // Show "Resume Signing" button if signing is in progress
    if (statusData.docusignStatus === 'sent' && statusData.envelopeId) {
      const button = document.getElementById('startW9Signing');
      if (button) {
        button.innerHTML = `
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          <span data-i18n="affiliate.dashboard.settings.resumeW9Signing">Resume W9 Signing</span>
        `;
      }
    }
  }

  /**
   * Show success message
   */
  function showSuccess(message) {
    const alert = createAlert('success', message);
    showAlert(alert);
  }

  /**
   * Show error message
   */
  function showError(message) {
    const alert = createAlert('error', message);
    showAlert(alert);
  }

  /**
   * Show info message
   */
  function showInfo(message) {
    const alert = createAlert('info', message);
    showAlert(alert);
  }

  /**
   * Show warning message
   */
  function showWarning(message) {
    const alert = createAlert('warning', message);
    showAlert(alert);
  }

  /**
   * Create alert element
   */
  function createAlert(type, message) {
    const alertClasses = {
      success: 'bg-green-100 border-green-400 text-green-700',
      error: 'bg-red-100 border-red-400 text-red-700',
      info: 'bg-blue-100 border-blue-400 text-blue-700',
      warning: 'bg-yellow-100 border-yellow-400 text-yellow-700'
    };

    const alert = document.createElement('div');
    alert.className = `mb-4 px-4 py-3 rounded border ${alertClasses[type]}`;
    alert.innerHTML = `
      <div class="flex items-center justify-between">
        <span>${message}</span>
        <button type="button" onclick="this.parentElement.parentElement.remove()" class="ml-4">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `;
    
    return alert;
  }

  /**
   * Show alert in W9 section
   */
  function showAlert(alert) {
    const w9Section = document.getElementById('w9DocuSignSection');
    if (w9Section) {
      w9Section.insertBefore(alert, w9Section.firstChild);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (alert.parentNode) {
          alert.remove();
        }
      }, 5000);
    }
  }

  // Export functions for use in affiliate dashboard
  window.docuSignW9 = {
    initialize: initializeDocuSignW9,
    updateStatus: updateW9StatusForDocuSign
  };

  // Auto-initialize if dashboard is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDocuSignW9);
  } else {
    initializeDocuSignW9();
  }
})();