(function() {
  'use strict';

  // This script handles auto-login for operators accessing from store IP
  async function attemptAutoLogin() {
    const statusElement = document.getElementById('status-message');
    const loadingElement = document.getElementById('loading-message');
    
    try {
      console.log('Attempting operator auto-login from store IP...');
      
      const response = await fetch('/api/v1/auth/operator/login', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const result = await response.json();
      console.log('Auto-login response:', response.status, result);
      
      if (response.ok && result.success) {
        // Store tokens
        localStorage.setItem('operatorToken', result.token);
        localStorage.setItem('operatorRefreshToken', result.refreshToken);
        localStorage.setItem('operatorData', JSON.stringify(result.operator));
        
        // Update status
        if (statusElement) {
          statusElement.textContent = 'Login successful! Redirecting...';
        }
        
        // Redirect to operator scan page
        setTimeout(() => {
          window.location.href = '/embed-app-v2.html?route=/operator-scan';
        }, 500);
      } else {
        // Auto-login failed
        console.log('Auto-login failed:', result.message);
        
        if (statusElement) {
          statusElement.textContent = 'Auto-login not available. Redirecting to login page...';
        }
        
        // Redirect to manual login after a brief delay
        setTimeout(() => {
          window.location.href = '/embed-app-v2.html?route=/operator-login';
        }, 2000);
      }
    } catch (error) {
      console.error('Auto-login error:', error);
      
      if (statusElement) {
        statusElement.textContent = 'An error occurred. Redirecting to login page...';
      }
      
      // Redirect to manual login on error
      setTimeout(() => {
        window.location.href = '/embed-app-v2.html?route=/operator-login';
      }, 2000);
    }
  }

  // Setup help link handler
  function setupHelpLink() {
    const helpLink = document.getElementById('help-link');
    if (helpLink) {
      helpLink.addEventListener('click', function(e) {
        e.preventDefault();
        alert('Please contact your supervisor for assistance.');
      });
    }
  }

  // Start auto-login when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setupHelpLink();
      attemptAutoLogin();
    });
  } else {
    setupHelpLink();
    attemptAutoLogin();
  }
})();