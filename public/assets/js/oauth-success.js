// OAuth Success Handler — fetches the auth result from the server-side
// OAuthSession store using a one-time lookup key, then postMessages it
// to the parent/opener window.
//
// SEC H-3: tokens used to live in this URL's `message` query parameter
// (full message JSON-encoded). They now live server-side; we only carry
// an opaque session lookup key in the URL.
//
// The legacy `?message=...` path remains supported so any in-flight
// flows during deploy don't break — gradually phased out as soon as
// every issuer has been redeployed.

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const sessionKey = params.get('session');
  const legacyMessage = params.get('message');

  function showError(text) {
    const messageDiv = document.getElementById('message-container');
    if (!messageDiv) return;
    messageDiv.innerHTML =
      '<div class="error-icon">✗</div>' +
      '<h3>Error</h3>' +
      '<p>' + text + '</p>';
    messageDiv.classList.add('show', 'error');
  }

  function deliverMessage(message) {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, '*');
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, '*');
      } else {
        localStorage.setItem('socialAuthResult', JSON.stringify(message));
      }
    } catch (e) {
      console.error('Failed to deliver OAuth message:', e);
    }

    setTimeout(function () {
      try {
        window.close();
      } catch (_) {
        const messageDiv = document.getElementById('message-container');
        if (messageDiv) {
          messageDiv.innerHTML =
            '<div class="success-icon">✓</div>' +
            '<h3>Login Successful!</h3>' +
            '<p>You can close this window.</p>' +
            '<button class="close-btn">Close Window</button>';
          messageDiv.classList.add('show');
        }
      }
    }, 500);
  }

  if (sessionKey) {
    // Server-side lookup. The endpoint consumes (deletes) on read so the
    // key is single-use; replay by an attacker who sniffed the URL
    // doesn't yield the message.
    fetch('/api/v1/auth/oauth-session/' + encodeURIComponent(sessionKey), {
      credentials: 'include'
    })
      .then(function (r) { return r.json(); })
      .then(function (body) {
        if (body && body.success && body.result) {
          deliverMessage(body.result);
        } else {
          showError('Login data was not available. Please try again.');
        }
      })
      .catch(function (err) {
        console.error('OAuth session fetch failed:', err);
        showError('Could not retrieve login result. Please try again.');
      });
  } else if (legacyMessage) {
    // Legacy URL-message path (deprecated, kept for backward compat).
    try {
      deliverMessage(JSON.parse(decodeURIComponent(legacyMessage)));
    } catch (e) {
      console.error('Error parsing legacy OAuth message:', e);
      showError('There was an error processing your login. Please try again.');
    }
  } else {
    showError('No login data received. Please try again.');
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.classList.contains('close-btn')) {
      try { window.close(); } catch (_) {}
    }
  });
})();
