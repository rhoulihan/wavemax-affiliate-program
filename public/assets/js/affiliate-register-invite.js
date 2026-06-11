// Invite gate for the affiliate registration page (invite-only onboarding).
//
// The page is opened from an emailed link carrying ?invite=<raw token>.
// This script validates the token against the public endpoint, stores it in
// the hidden #inviteToken input (submitted by affiliate-register-init.js),
// locks the email field to the invite's email, and applies prefill hints.
// Without a valid token the form is replaced by the static invalid notice.
// CSP-compliant: external file, no inline handlers, no innerHTML.
(function() {
  'use strict';

  function getBaseUrl() {
    return (window.EMBED_CONFIG && window.EMBED_CONFIG.baseUrl) || window.location.origin;
  }

  function showInvalidState() {
    var form = document.getElementById('affiliateRegistrationForm');
    var notice = document.getElementById('inviteInvalidNotice');
    if (form) form.classList.add('hidden');
    if (notice) notice.classList.remove('hidden');
  }

  function applyInvite(token, body) {
    var tokenField = document.getElementById('inviteToken');
    if (tokenField) tokenField.value = token;

    var emailField = document.getElementById('email');
    if (emailField) {
      emailField.value = body.email || '';
      emailField.readOnly = true;
      emailField.setAttribute('aria-readonly', 'true');
    }
    var lockNote = document.getElementById('inviteEmailLockedNote');
    if (lockNote) lockNote.classList.remove('hidden');

    var prefill = body.prefill || {};
    ['firstName', 'lastName', 'businessName', 'phone'].forEach(function(name) {
      var field = document.getElementById(name);
      if (field && !field.value && prefill[name]) {
        field.value = prefill[name];
      }
    });
  }

  async function init() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('invite');
    if (!token) {
      showInvalidState();
      return;
    }

    try {
      var response = await fetch(
        getBaseUrl() + '/api/v1/affiliate-invites/' + encodeURIComponent(token) + '/validate',
        { credentials: 'include' }
      );
      if (!response.ok) {
        showInvalidState();
        return;
      }
      var body = await response.json();
      if (!body || body.valid !== true) {
        showInvalidState();
        return;
      }
      applyInvite(token, body);
    } catch (err) {
      // Fail closed: no validated invite, no open form.
      showInvalidState();
    }
  }

  // Exposed for unit tests.
  window.AffiliateInviteGate = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
