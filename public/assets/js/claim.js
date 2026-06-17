// /claim — overloaded bag URL (Phase 1 PR 5).
//
// Two audiences hit the same URL:
//   1. A CUSTOMER scanning an unregistered ('claimable') bag → registration form.
//   2. STAFF (partner/operator) scanning a registered ('claimed') bag → a
//      scan-session panel: enter a code once → batch-scan transitions.
//
// Batch-across-QR persistence: each bag QR opens a fresh full-page /claim load.
// Only sessionStorage survives those loads, so on every 'claimed' load we check
// ScanSession.getSession(); a live session SKIPS the code panel and goes straight
// to resolve → confirm. (Registration OTP / Firebase phone gates arrive in PR 8.)
(function () {
  'use strict';

  var bagToken = new URLSearchParams(window.location.search).get('bag');

  var SECTIONS = ['resolving', 'claimable', 'registered', 'claimed', 'invalid'];
  var PANELS = ['claim-scan-code-panel', 'claim-scan-confirm-panel'];

  function show(state) {
    SECTIONS.forEach(function (name) {
      var el = document.getElementById('claim-state-' + name);
      if (el) el.hidden = (name !== state);
    });
  }

  function showPanel(id) {
    show('__none__');
    PANELS.forEach(function (p) {
      var el = document.getElementById(p);
      if (el) el.hidden = (p !== id);
    });
  }

  // i18n.t returns the key when a translation is missing → fall back to English.
  function t(key, fallback) {
    var v = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : key;
    return (v && v !== key) ? v : (fallback || key);
  }

  function renderState(state, data) {
    switch (state) {
    case 'claimable': {
      var affiliate = (data && data.affiliate) || {};
      var name = affiliate.businessName ||
          ((affiliate.firstName || '') + ' ' + (affiliate.lastName || '')).trim() || 'WaveMAX';
      // textContent — never innerHTML (XSS)
      document.getElementById('claim-affiliate-name').textContent = name;
      show('claimable');
      // Submit stays disabled until email (and phone, when enabled) verify.
      updateSubmitState();
      // Load the Firebase phone-verification config (may enable the phone step).
      fetch('/api/v1/firebase-config')
        .then(function (res) { return res.json(); })
        .then(function (cfg) { initFirebasePhone(cfg); updateSubmitState(); })
        .catch(function () { /* phone stays disabled → email-only */ });
      break;
    }
    case 'claimed':
      // Registered bag → staff scan-session overload.
      enterStaffScan();
      break;
    case 'invalid':
    default:
      show('invalid');
      break;
    }
  }

  // ---- staff scan-session flow -----------------------------------------------

  var pending = null; // last resolveData awaiting confirm

  function enterStaffScan() {
    // Batch-across-QR: a live session skips the code panel.
    if (window.ScanSession && window.ScanSession.getSession() && !window.ScanSession.isExpired()) {
      window.ScanSession.init({ mode: 'session' });
      showSessionActive();
      resolveAndConfirm();
    } else {
      if (window.ScanSession) window.ScanSession.clearSession();
      showPanel('claim-scan-code-panel');
    }
  }

  function showSessionActive() {
    var note = document.getElementById('scan-session-active');
    if (!note) return;
    var s = window.ScanSession.getSession();
    if (s && s.expiresAt) {
      var time = new Date(s.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      note.textContent = t('claim.scan.sessionActiveUntil', 'Session active until') + ' ' + time;
      note.hidden = false;
    }
  }

  function startSession() {
    var codeInput = document.getElementById('scan-code');
    var errorEl = document.getElementById('scan-code-error');
    errorEl.hidden = true;
    var code = codeInput.value.trim();
    if (!code) return;
    window.ScanSession.init({ mode: 'session' });
    window.ScanSession.mint(bagToken, code)
      .then(function () {
        showSessionActive();
        resolveAndConfirm();
      })
      .catch(function (err) {
        errorEl.textContent = err.status === 429
          ? t('claim.scan.lockedOut', 'Too many attempts. Please try again later.')
          : t('claim.scan.badCode', "That code didn't match. Please try again.");
        errorEl.hidden = false;
      });
  }

  function resolveAndConfirm() {
    showPanel('claim-scan-confirm-panel');
    showSessionActive();
    document.getElementById('scan-confirm-result').hidden = true;
    document.getElementById('scan-confirm-error').hidden = true;
    window.ScanSession.resolve(bagToken)
      .then(renderConfirm)
      .catch(handleScanError);
  }

  function renderConfirm(resolveData) {
    pending = resolveData;
    var promptKey = resolveData.promptKey ? 'claim.' + resolveData.promptKey : null;
    document.getElementById('scan-confirm-prompt').textContent = promptKey
      ? t(promptKey, t('claim.scan.confirmGeneric', 'Apply this scan?'))
      : t('claim.scan.confirmGeneric', 'Apply this scan?');

    var c = resolveData.customer;
    document.getElementById('scan-confirm-customer').textContent = c
      ? ((c.firstName || '') + ' ' + (c.lastName || '')).trim()
      : '';

    var needsPayment = resolveData.proposedAction === 'advance' &&
      resolveData.to === 'out_for_delivery';
    var paymentRow = document.getElementById('scan-payment-row');
    paymentRow.hidden = !needsPayment;
    document.getElementById('scan-payment-confirmed').checked = false;
  }

  function onConfirmYes() {
    if (!pending) return;
    var resolveData = pending;
    var opts = {};
    if (resolveData.proposedAction === 'advance' && resolveData.to === 'out_for_delivery') {
      opts.paymentConfirmed = document.getElementById('scan-payment-confirmed').checked;
    }
    if (resolveData.proposedAction === 'delivery-rescan-prompt') {
      opts.reopen = true;
    }
    applyAction(resolveData.proposedAction, opts);
  }

  function onConfirmNo() {
    if (pending && pending.proposedAction === 'delivery-rescan-prompt') {
      applyAction('delivery-rescan-prompt', { reopen: false });
      return;
    }
    // Other actions: just dismiss this bag.
    pending = null;
    document.getElementById('scan-confirm-prompt').textContent =
      t('claim.scan.scanNext', 'Scan the next bag.');
    document.getElementById('scan-confirm-customer').textContent = '';
    document.getElementById('scan-payment-row').hidden = true;
  }

  function applyAction(expectedAction, opts) {
    var resultEl = document.getElementById('scan-confirm-result');
    var errorEl = document.getElementById('scan-confirm-error');
    resultEl.hidden = true;
    errorEl.hidden = true;
    window.ScanSession.apply(bagToken, expectedAction, opts)
      .then(function (result) {
        pending = null;
        if (result.action !== 'no-op') {
          document.getElementById('scan-undo').hidden = false;
        }
        resultEl.textContent = t('claim.scan.applied', 'Done — scan the next bag.');
        resultEl.hidden = false;
        document.getElementById('scan-confirm-prompt').textContent =
          t('claim.scan.scanNext', 'Scan the next bag.');
        document.getElementById('scan-confirm-customer').textContent = '';
        document.getElementById('scan-payment-row').hidden = true;
      })
      .catch(function (err) {
        if (err.status === 409 && err.code === 'state_changed') {
          errorEl.textContent = t('claim.scan.stateChanged', 'Bag state changed — please re-scan');
          errorEl.hidden = false;
          resolveAndConfirm();
          return;
        }
        handleScanError(err);
      });
  }

  function onUndo() {
    window.ScanSession.undo(bagToken)
      .then(function (result) {
        var resultEl = document.getElementById('scan-confirm-result');
        if (result.undone) {
          resultEl.textContent = t('claim.scan.undone', 'Last scan undone.');
        } else {
          resultEl.textContent = t('claim.scan.nothingToUndo', 'Nothing to undo.');
        }
        resultEl.hidden = false;
        document.getElementById('scan-undo').hidden = true;
      })
      .catch(handleScanError);
  }

  function endSession() {
    if (window.ScanSession) window.ScanSession.clearSession();
    showPanel('claim-scan-code-panel');
    var codeInput = document.getElementById('scan-code');
    if (codeInput) codeInput.value = '';
  }

  function handleScanError(err) {
    var errorEl = document.getElementById('scan-confirm-error');
    if (err.status === 401) {
      // session expired/invalidated — fall back to the code panel.
      if (window.ScanSession) window.ScanSession.clearSession();
      var codeError = document.getElementById('scan-code-error');
      codeError.textContent = t('claim.scan.sessionExpired', 'Your session expired. Please enter your code again.');
      codeError.hidden = false;
      showPanel('claim-scan-code-panel');
      return;
    }
    errorEl.textContent = (err.status === 404 || err.code === 'bag_not_registered')
      ? t('claim.scan.notRegistered', 'Bag not registered')
      : (err.message || t('claim.scan.networkError', 'Network error — please try again.'));
    errorEl.hidden = false;
  }

  // ---- customer registration branch (PR 7: email + phone verification) ------

  // Verification state held in the closure (never trusted by the server — the
  // server re-verifies the email token and the Firebase phone token).
  var emailVerificationToken = null; // minted by the email-OTP verify endpoint
  var phoneIdToken = null;           // Firebase phone ID token (flag on)
  var phoneEnabled = false;          // from /api/v1/firebase-config
  var firebaseConfirmation = null;   // Firebase confirmationResult
  var recaptchaVerifier = null;

  function showFormError(message) {
    var el = document.getElementById('claim-form-error');
    el.textContent = message;
    el.hidden = false;
  }

  function showById(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    if (typeof text === 'string') el.textContent = text;
    el.hidden = false;
  }
  function hideById(id) { var el = document.getElementById(id); if (el) el.hidden = true; }

  function resolveBag() {
    if (!bagToken) { renderState('invalid'); return; }
    fetch('/api/v1/customers/claim/' + encodeURIComponent(bagToken))
      .then(function (res) { return res.json(); })
      .then(function (body) { renderState(body.state, body); })
      .catch(function () { renderState('invalid'); });
  }

  // ---- spinner + confirmation-code modal -------------------------------------

  // Show a swirl spinner on a button during a server round-trip; returns a
  // handle with hide(). Falls back to a plain disable if the lib isn't loaded.
  function spin(btn) {
    if (btn && window.SwirlSpinnerUtils && typeof window.SwirlSpinnerUtils.showOnButton === 'function') {
      try { return window.SwirlSpinnerUtils.showOnButton(btn); } catch (e) { /* fall through */ }
    }
    if (btn) btn.disabled = true;
    return { hide: function () { if (btn) btn.disabled = false; } };
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el && typeof text === 'string') el.textContent = text;
  }

  // One modal serves both the email OTP and the SMS OTP; mode routes verify/resend.
  var codeModalMode = 'email'; // 'email' | 'phone'

  function openCodeModal(mode, statusText) {
    codeModalMode = mode;
    setText('claimCodeTitle', mode === 'phone'
      ? t('claim.verify.modalTitlePhone', 'Enter your SMS code')
      : t('claim.verify.modalTitleEmail', 'Enter your email code'));
    setText('claimCodeStatus', statusText || '');
    var input = document.getElementById('claimCodeInput');
    if (input) input.value = '';
    hideById('claimCodeError');
    if (window.ModalSystem && typeof window.ModalSystem.showModal === 'function') {
      window.ModalSystem.showModal('claimCodeModal');
    } else {
      var m = document.getElementById('claimCodeModal');
      if (m) m.classList.add('active');
    }
    if (input) input.focus();
  }

  function closeCodeModal() {
    if (window.ModalSystem && typeof window.ModalSystem.closeActiveModal === 'function') {
      window.ModalSystem.closeActiveModal();
    } else {
      var m = document.getElementById('claimCodeModal');
      if (m) m.classList.remove('active');
    }
  }

  function onCodeVerify() { if (codeModalMode === 'phone') verifyPhoneSms(); else verifyEmailOtp(); }
  function onCodeResend() { if (codeModalMode === 'phone') sendPhoneSms(true); else requestEmailOtp(true); }

  // ---- email OTP -------------------------------------------------------------

  function requestEmailOtp(isResend) {
    var email = document.getElementById('email').value.trim();
    hideById('email-verify-error');
    hideById('claimCodeError');
    if (!email) { showById('email-verify-error', t('claim.verify.enterEmailFirst', 'Enter your email first.')); return; }
    var s = spin(document.getElementById(isResend ? 'claimCodeResend' : 'emailSendCode'));
    fetch('/api/v1/customers/claim/' + encodeURIComponent(bagToken) + '/email-otp/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, languagePreference: localStorage.getItem('selectedLanguage') || 'en' })
    }).then(function () {
      openCodeModal('email', t('claim.verify.codeSent', 'Code sent. Check your email.'));
    }).catch(function () {
      var target = isResend ? 'claimCodeError' : 'email-verify-error';
      showById(target, t('claim.verify.recaptchaError', 'Verification check failed. Please reload and try again.'));
    }).then(function () { s.hide(); });
  }

  function verifyEmailOtp() {
    var email = document.getElementById('email').value.trim();
    var code = document.getElementById('claimCodeInput').value.trim();
    hideById('claimCodeError');
    var s = spin(document.getElementById('claimCodeVerify'));
    fetch('/api/v1/customers/claim/' + encodeURIComponent(bagToken) + '/email-otp/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, code: code })
    }).then(function (res) {
      return res.json().then(function (body) { return { status: res.status, body: body }; });
    }).then(function (r) {
      if (r.status === 200 && r.body.emailVerificationToken) {
        emailVerificationToken = r.body.emailVerificationToken;
        closeCodeModal();
        showById('email-verified-badge');
        updateSubmitState();
        return;
      }
      showById('claimCodeError', r.status === 429
        ? t('claim.verify.lockedOut', 'Too many attempts. Please try again later.')
        : t('claim.verify.invalidCode', 'That code is incorrect or expired. Please try again.'));
    }).catch(function () {
      showById('claimCodeError', t('claim.verify.invalidCode', 'That code is incorrect or expired. Please try again.'));
    }).then(function () { s.hide(); });
  }

  // ---- Firebase phone --------------------------------------------------------

  // The Firebase compat SDK (~170 KB) is only needed for the phone-verification
  // step, which is a later interaction — it MUST stay off the initial critical
  // path so it doesn't delay revealing the registration form (the LCP element).
  // So we lazy-load the two vendored SDK files on demand, only when the server
  // says phone verification is enabled. CSP-safe: self-hosted /assets/js/vendor/
  // files injected with the page nonce, loaded sequentially (app before auth).
  var firebaseSdkPromise = null;
  function loadFirebaseSdk() {
    if (firebaseSdkPromise) return firebaseSdkPromise;
    var nonce = window.CSP_NONCE ||
      (document.querySelector('meta[name="csp-nonce"]') || {}).content || '';
    function inject(src) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        if (nonce) s.nonce = nonce;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    firebaseSdkPromise = inject('/assets/js/vendor/firebase-app-compat.js')
      .then(function () { return inject('/assets/js/vendor/firebase-auth-compat.js'); });
    return firebaseSdkPromise;
  }

  function initFirebasePhone(config) {
    if (!(config && config.enabled)) { phoneEnabled = false; return; }
    // Defer SDK download until we know phone verification is on, then init.
    loadFirebaseSdk()
      .then(function () { setupFirebasePhone(config); updateSubmitState(); })
      .catch(function () { phoneEnabled = false; });
  }

  function setupFirebasePhone(config) {
    phoneEnabled = !!window.firebase;
    if (!phoneEnabled) return;
    try {
      if (!window.firebase.apps || !window.firebase.apps.length) {
        window.firebase.initializeApp({
          apiKey: config.apiKey, authDomain: config.authDomain,
          projectId: config.projectId, storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId, appId: config.appId
        });
      }
      recaptchaVerifier = new window.firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
      var sendBtn = document.getElementById('phoneSendSms');
      if (sendBtn) sendBtn.hidden = false;
    } catch (e) {
      phoneEnabled = false;
    }
  }

  function sendPhoneSms(isResend) {
    var phone = document.getElementById('phone').value.trim();
    hideById('phone-verify-error');
    hideById('claimCodeError');
    if (!phone) { showById('phone-verify-error', t('claim.verify.enterPhoneFirst', 'Enter your phone number first.')); return; }
    var e164 = phone.charAt(0) === '+' ? phone.replace(/[^\d+]/g, '') : '+1' + phone.replace(/\D/g, '');
    var s = spin(document.getElementById(isResend ? 'claimCodeResend' : 'phoneSendSms'));
    window.firebase.auth().signInWithPhoneNumber(e164, recaptchaVerifier)
      .then(function (confirmation) {
        firebaseConfirmation = confirmation;
        openCodeModal('phone', t('claim.verify.smsSent', 'Text sent. Enter the code below.'));
      })
      .catch(function (err) {
        // Surface the actual Firebase error (code + message) so config issues
        // (auth/operation-not-allowed, auth/invalid-app-credential,
        // auth/captcha-check-failed, …) are diagnosable from the page itself
        // rather than hidden behind a generic message.
        if (window.console && console.error) console.error('signInWithPhoneNumber failed:', err);
        var detail = (err && (err.code || err.message)) ? ' [' + (err.code || '') + ' ' + (err.message || '') + ']' : '';
        var target = isResend ? 'claimCodeError' : 'phone-verify-error';
        showById(target,
          t('claim.verify.recaptchaError', 'Verification check failed. Please reload and try again.') + detail);
      })
      .then(function () { s.hide(); });
  }

  function verifyPhoneSms() {
    var code = document.getElementById('claimCodeInput').value.trim();
    hideById('claimCodeError');
    if (!firebaseConfirmation) { showById('claimCodeError', t('claim.verify.invalidSms', 'That SMS code is incorrect. Please try again.')); return; }
    var s = spin(document.getElementById('claimCodeVerify'));
    firebaseConfirmation.confirm(code)
      .then(function (result) { return result.user.getIdToken(); })
      .then(function (token) {
        phoneIdToken = token;
        closeCodeModal();
        showById('phone-verified-badge');
        updateSubmitState();
      })
      .catch(function () {
        showById('claimCodeError', t('claim.verify.invalidSms', 'That SMS code is incorrect. Please try again.'));
      })
      .then(function () { s.hide(); });
  }

  // ---- gating + submit -------------------------------------------------------

  function isVerified() {
    if (!emailVerificationToken) return false;
    if (phoneEnabled && !phoneIdToken) return false;
    return true;
  }

  function updateSubmitState() {
    var submit = document.getElementById('claimSubmit');
    if (submit) submit.disabled = !isVerified();
  }

  function submitRegistration(event) {
    event.preventDefault();
    var form = document.getElementById('claimRegistrationForm');
    var fields = form.elements;
    var submit = document.getElementById('claimSubmit');

    if (!emailVerificationToken) {
      showFormError(t('claim.verify.emailRequired', 'Please verify your email to continue.'));
      return;
    }
    if (phoneEnabled && !phoneIdToken) {
      showFormError(t('claim.verify.phoneRequired', 'Please verify your phone number to continue.'));
      return;
    }
    var s = spin(submit);

    var payload = {
      firstName: fields.firstName.value.trim(),
      lastName: fields.lastName.value.trim(),
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim(),
      address: fields.address.value.trim(),
      city: fields.city.value.trim(),
      state: fields.state.value.trim(),
      zipCode: fields.zipCode.value.trim(),
      emailVerificationToken: emailVerificationToken,
      languagePreference: localStorage.getItem('selectedLanguage') || 'en'
    };
    if (phoneEnabled && phoneIdToken) payload.phoneIdToken = phoneIdToken;

    fetch('/api/v1/customers/claim/' + encodeURIComponent(bagToken) + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (body) { return { status: res.status, body: body }; }); })
      .then(function (result) {
        if (result.status === 201) {
          // Phase 1: registration-only — no customer portal to land in.
          // Show a simple success state right here on the claim page.
          show('registered');
          return;
        }
        if (result.status === 409) {
          var raceMsg = t('claim.raceLost',
            'Someone just claimed this bag. If that was you on another device, you\'re all set.');
          showFormError(raceMsg);
          return;
        }
        var msg = result.body.message || 'Registration failed';
        if (result.body.errors && result.body.errors.length) {
          msg = result.body.errors.map(function (e) { return e.msg; }).join(' ');
        }
        showFormError(msg);
      })
      .catch(function () {
        showFormError('Network error — please try again.');
      })
      .then(function () { s.hide(); });
  }

  function init() {
    document.getElementById('claimRegistrationForm')
      .addEventListener('submit', submitRegistration);

    // PR 7 verification controls (CSP: addEventListener only). Wrap the send
    // handlers so the click Event isn't passed as the isResend flag.
    var sendCode = document.getElementById('emailSendCode');
    if (sendCode) sendCode.addEventListener('click', function () { requestEmailOtp(false); });
    var phoneSendSms = document.getElementById('phoneSendSms');
    if (phoneSendSms) phoneSendSms.addEventListener('click', function () { sendPhoneSms(false); });

    // Shared confirmation-code modal (email + SMS).
    var codeVerify = document.getElementById('claimCodeVerify');
    if (codeVerify) codeVerify.addEventListener('click', onCodeVerify);
    var codeResend = document.getElementById('claimCodeResend');
    if (codeResend) codeResend.addEventListener('click', onCodeResend);
    var codeInput = document.getElementById('claimCodeInput');
    if (codeInput) codeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); onCodeVerify(); }
    });

    // Staff scan-session controls (CSP: addEventListener only, no inline handlers).
    var codeBtn = document.getElementById('scan-code-submit');
    if (codeBtn) codeBtn.addEventListener('click', startSession);
    var yesBtn = document.getElementById('scan-confirm-yes');
    if (yesBtn) yesBtn.addEventListener('click', onConfirmYes);
    var noBtn = document.getElementById('scan-confirm-no');
    if (noBtn) noBtn.addEventListener('click', onConfirmNo);
    var undoBtn = document.getElementById('scan-undo');
    if (undoBtn) undoBtn.addEventListener('click', onUndo);
    var endBtn = document.getElementById('scan-end-session');
    if (endBtn) endBtn.addEventListener('click', endSession);

    resolveBag();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
