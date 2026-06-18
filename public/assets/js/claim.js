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
  var selfStartByCustomer = false; // true when the registered customer started the order (vs staff)

  function enterStaffScan() {
    selfStartByCustomer = false; // a resumed batch session is staff
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

  // Staff scan is behind a link that opens #staffCodeModal.
  function openStaffModal(errorText) {
    var errorEl = document.getElementById('scan-code-error');
    if (errorEl) { if (errorText) { errorEl.textContent = errorText; errorEl.hidden = false; } else { errorEl.hidden = true; } }
    var input = document.getElementById('scan-code');
    if (input) input.value = '';
    if (window.ModalSystem && typeof window.ModalSystem.showModal === 'function') {
      window.ModalSystem.showModal('staffCodeModal');
    } else {
      var m = document.getElementById('staffCodeModal');
      if (m) m.classList.add('active');
    }
    if (input) input.focus();
  }

  function closeStaffModal() {
    if (window.ModalSystem && typeof window.ModalSystem.closeActiveModal === 'function') {
      window.ModalSystem.closeActiveModal();
    } else {
      var m = document.getElementById('staffCodeModal');
      if (m) m.classList.remove('active');
    }
  }

  function startSession() {
    var codeInput = document.getElementById('scan-code');
    var errorEl = document.getElementById('scan-code-error');
    errorEl.hidden = true;
    var code = codeInput.value.trim();
    if (!code) return;
    selfStartByCustomer = false; // staff session
    window.ScanSession.init({ mode: 'session' });
    var s = spin(document.getElementById('scan-code-submit'));
    window.ScanSession.mint(bagToken, code)
      .then(function () {
        closeStaffModal();
        showSessionActive();
        resolveAndConfirm();
      })
      .catch(function (err) {
        errorEl.textContent = err.status === 429
          ? t('claim.scan.lockedOut', 'Too many attempts. Please try again later.')
          : t('claim.scan.badCode', "That code didn't match. Please try again.");
        errorEl.hidden = false;
      })
      .then(function () { s.hide(); });
  }

  // Customer self-start (PR C): the registered customer enters their verified
  // phone/email; the server mints a START-ONLY customer session. Same mint +
  // resolve/confirm flow as the staff path — the server decides the actor type.
  function startCustomerSession() {
    var input = document.getElementById('scan-customer-contact');
    var errorEl = document.getElementById('scan-customer-error');
    errorEl.hidden = true;
    var value = input.value.trim();
    if (!value) return;
    selfStartByCustomer = true; // registered customer starting their own order
    window.ScanSession.init({ mode: 'session' });
    var s = spin(document.getElementById('scan-customer-submit'));
    window.ScanSession.mint(bagToken, value)
      .then(function () {
        showSessionActive();
        resolveAndConfirm();
      })
      .catch(function (err) {
        errorEl.textContent = err.status === 429
          ? t('claim.scan.lockedOut', 'Too many attempts. Please try again later.')
          : t('claim.scan.badContact', "That phone or email didn't match this bag. Please try again.");
        errorEl.hidden = false;
      })
      .then(function () { s.hide(); });
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
        if (selfStartByCustomer) {
          // Customer started their own order — acknowledge the request; no staff
          // batch controls (a customer can't scan-next / undo / run a session).
          resultEl.textContent = t('claim.pickup.requestedTitle', 'Your order request has been received');
          resultEl.hidden = false;
          document.getElementById('scan-confirm-prompt').textContent = '';
          document.getElementById('scan-confirm-customer').textContent = '';
          document.getElementById('scan-payment-row').hidden = true;
          hideById('scan-undo');
          hideById('scan-end-session');
          return;
        }
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
        if (err.status === 403 && err.code === 'customer_not_allowed') {
          errorEl.textContent = t('claim.scan.customerNotAllowed',
            'This step is handled by store staff. Your order is already in progress.');
          errorEl.hidden = false;
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
    closeStaffModal();
    showPanel('claim-scan-code-panel');
    var codeInput = document.getElementById('scan-code');
    if (codeInput) codeInput.value = '';
  }

  function handleScanError(err) {
    var errorEl = document.getElementById('scan-confirm-error');
    if (err.status === 401) {
      // session expired/invalidated — fall back to the start panel and reopen
      // the staff code modal so a partner can re-enter their code.
      if (window.ScanSession) window.ScanSession.clearSession();
      showPanel('claim-scan-code-panel');
      openStaffModal(t('claim.scan.sessionExpired', 'Your session expired. Please enter your code again.'));
      return;
    }
    errorEl.textContent = (err.status === 404 || err.code === 'bag_not_registered')
      ? t('claim.scan.notRegistered', 'Bag not registered')
      : (err.message || t('claim.scan.networkError', 'Network error — please try again.'));
    errorEl.hidden = false;
  }

  // ---- customer registration branch (PR 7: email + phone verification) ------

  // Verification state held in the closure (never trusted by the server — the
  // server re-verifies the Firebase phone token). Email is optional/unverified.
  var phoneIdToken = null;           // Firebase phone ID token (flag on)
  var phoneRequired = false;         // server says phone verification is required (config.enabled)
  var phoneEnabled = false;          // the Firebase SDK actually loaded + initialized (Send button works)
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

  // Show a FULL-PAGE swirl spinner during a server round-trip (send SMS / verify
  // / submit); returns a handle with hide(). The passed button is also disabled
  // to prevent a double-submit. Falls back to a plain disable if the lib isn't
  // loaded.
  function spin(btn) {
    if (btn) btn.disabled = true;
    if (window.SwirlSpinnerUtils && typeof window.SwirlSpinnerUtils.showGlobal === 'function') {
      try {
        var handle = window.SwirlSpinnerUtils.showGlobal();
        return { hide: function () { try { handle.hide(); } catch (e) { /* noop */ } if (btn) btn.disabled = false; } };
      } catch (e) { /* fall through */ }
    }
    return { hide: function () { if (btn) btn.disabled = false; } };
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el && typeof text === 'string') el.textContent = text;
  }

  // The code modal is SMS-only (email is no longer verified).
  function openCodeModal(statusText) {
    setText('claimCodeTitle', t('claim.verify.modalTitlePhone', 'Enter your SMS code'));
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

  function onCodeVerify() { verifyPhoneSms(); }
  function onCodeResend() { sendPhoneSms(true); }

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
    // phoneRequired is server-driven and is the SUBMIT GATE — independent of
    // whether the SDK loads. If the SDK fails while phone is required, the form
    // stays blocked (isVerified) and we surface a clear error rather than
    // silently letting a submit through that the server will reject.
    phoneRequired = !!(config && config.enabled);
    if (!phoneRequired) { phoneEnabled = false; return; }
    // Defer SDK download until we know phone verification is on, then init.
    loadFirebaseSdk()
      .then(function () { setupFirebasePhone(config); updateSubmitState(); })
      .catch(function () { onPhoneSetupFailed(); });
  }

  function onPhoneSetupFailed() {
    phoneEnabled = false;
    // Phone is required but unavailable — keep submit disabled and explain why.
    showFormError(t('claim.verify.phoneUnavailable',
      'Phone verification is temporarily unavailable. Please reload the page and try again.'));
    updateSubmitState();
  }

  function setupFirebasePhone(config) {
    phoneEnabled = !!window.firebase;
    if (!phoneEnabled) { onPhoneSetupFailed(); return; }
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
      onPhoneSetupFailed();
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
        openCodeModal(t('claim.verify.smsSent', 'Text sent. Enter the code below.'));
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
        // Remove the Send button once verified — the badge replaces it.
        hideById('phoneSendSms');
        showById('phone-verified-badge');
        updateSubmitState();
      })
      .catch(function () {
        showById('claimCodeError', t('claim.verify.invalidSms', 'That SMS code is incorrect. Please try again.'));
      })
      .then(function () { s.hide(); });
  }

  // ---- gating + submit -------------------------------------------------------

  // ---- registered confirmation: pickup / drop-off instructions ---------------

  var registeredPhone = null;     // the phone just registered (to mint a customer session)
  var registeredAffiliate = null; // { serviceType, pickupInstructions } from the register response

  function renderRegistered(affiliateData) {
    registeredAffiliate = affiliateData || {};
    show('registered');
    if (registeredAffiliate.serviceType === 'full_service') {
      // Full-service: offer to start the order now; instructions show after.
      showById('requestPickupBtn');
      hideById('pickupInstructionsBlock');
    } else {
      // Pickup location (or unconfigured): show the drop-off instructions now.
      hideById('requestPickupBtn');
      showPickupInstructions(t('claim.pickup.dropOffTitle', 'How to drop off your bag'));
    }
  }

  function instructionsText() {
    var txt = registeredAffiliate && registeredAffiliate.pickupInstructions;
    return (txt && String(txt).trim())
      ? txt
      : t('claim.pickup.fallback', 'Your laundry partner will be in touch with what to do next.');
  }

  function showPickupInstructions(title) {
    setText('pickupInstructionsTitle', title);
    setText('pickupInstructionsText', instructionsText());
    showById('pickupInstructionsBlock');
  }

  // "Request pickup now" — start the order with the just-registered phone,
  // reusing the customer-initiated scan flow (mint → resolve → create-pending).
  var pickupRequesting = false; // re-entry guard against double-taps

  function pickupErrorFor(err) {
    var s = err && err.status;
    if (s === 429) return t('claim.pickup.tooManyAttempts', 'Too many attempts. Please try again in a few minutes.');
    if (s === 401 || s === 403) return t('claim.pickup.cannotVerify', "We couldn't start your order automatically. Your provider will be in touch.");
    return t('claim.pickup.error', 'Could not request pickup. Please try again.');
  }

  function requestPickupNow() {
    hideById('requestPickupError');
    if (pickupRequesting) return; // ignore double-taps
    // Normalize to digits so the contact reliably matches the bag's customer
    // (matchesCustomerContact compares last-10 digits; needs ≥10).
    var contact = String(registeredPhone || '').replace(/\D/g, '');
    if (contact.length < 10 || !window.ScanSession) {
      showById('requestPickupError', t('claim.pickup.error', 'Could not request pickup. Please try again.'));
      return;
    }
    pickupRequesting = true;
    var btn = document.getElementById('requestPickupBtn');
    var s = spin(btn);
    var orderCreated = false;
    window.ScanSession.init({ mode: 'session' });
    window.ScanSession.mint(bagToken, contact)
      .then(function () { return window.ScanSession.resolve(bagToken); })
      .then(function (resolveData) {
        if (resolveData && resolveData.proposedAction && resolveData.proposedAction !== 'create-pending') {
          // An order already exists for this bag — nothing new to create.
          return null;
        }
        orderCreated = true;
        return window.ScanSession.apply(bagToken, 'create-pending');
      })
      .then(function () {
        hideById('requestPickupBtn');
        showPickupInstructions(orderCreated
          ? t('claim.pickup.requestedTitle', 'Your order request has been received')
          : t('claim.pickup.alreadyStartedTitle', 'Your order is already in progress'));
      })
      .catch(function (err) {
        showById('requestPickupError', pickupErrorFor(err));
      })
      .then(function () { s.hide(); pickupRequesting = false; });
  }

  function isVerified() {
    // Phone is the only required verification — gated on phoneREQUIRED (server),
    // not on whether the SDK loaded, so an SDK failure can't open the gate.
    // Email is optional.
    if (phoneRequired && !phoneIdToken) return false;
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

    if (phoneRequired && !phoneIdToken) {
      showFormError(t('claim.verify.phoneRequired', 'Please verify your phone number to continue.'));
      return;
    }
    var s = spin(submit);

    var payload = {
      firstName: fields.firstName.value.trim(),
      lastName: fields.lastName.value.trim(),
      phone: fields.phone.value.trim(),
      address: fields.address.value.trim(),
      city: fields.city.value.trim(),
      state: fields.state.value.trim(),
      zipCode: fields.zipCode.value.trim(),
      languagePreference: localStorage.getItem('selectedLanguage') || 'en'
    };
    // Email is optional — only send it when provided.
    var emailVal = fields.email.value.trim();
    if (emailVal) payload.email = emailVal;
    if (phoneRequired && phoneIdToken) payload.phoneIdToken = phoneIdToken;

    fetch('/api/v1/customers/claim/' + encodeURIComponent(bagToken) + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (body) { return { status: res.status, body: body }; }); })
      .then(function (result) {
        if (result.status === 201) {
          // Phase 1: registration-only — no customer portal to land in.
          // Show the success state with the right next step for this partner.
          registeredPhone = payload.phone;
          renderRegistered((result.body && result.body.affiliateData) || {});
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

    // Phone verification controls (CSP: addEventListener only). Wrap the send
    // handler so the click Event isn't passed as the isResend flag.
    var phoneSendSms = document.getElementById('phoneSendSms');
    if (phoneSendSms) phoneSendSms.addEventListener('click', function () { sendPhoneSms(false); });

    // Registered-confirmation "Request pickup now" (full-service partners).
    var pickupBtn = document.getElementById('requestPickupBtn');
    if (pickupBtn) pickupBtn.addEventListener('click', requestPickupNow);

    // SMS confirmation-code modal.
    var codeVerify = document.getElementById('claimCodeVerify');
    if (codeVerify) codeVerify.addEventListener('click', onCodeVerify);
    var codeResend = document.getElementById('claimCodeResend');
    if (codeResend) codeResend.addEventListener('click', onCodeResend);
    var codeInput = document.getElementById('claimCodeInput');
    if (codeInput) codeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); onCodeVerify(); }
    });

    // Staff scan-session controls (CSP: addEventListener only, no inline handlers).
    // Customer self-start is primary; staff code lives behind a link → modal.
    var custBtn = document.getElementById('scan-customer-submit');
    if (custBtn) custBtn.addEventListener('click', startCustomerSession);
    var custInput = document.getElementById('scan-customer-contact');
    if (custInput) custInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); startCustomerSession(); }
    });
    var staffLink = document.getElementById('scan-staff-link');
    if (staffLink) staffLink.addEventListener('click', function (e) { e.preventDefault(); openStaffModal(); });
    var codeBtn = document.getElementById('scan-code-submit');
    if (codeBtn) codeBtn.addEventListener('click', startSession);
    var scanCodeInput = document.getElementById('scan-code');
    if (scanCodeInput) scanCodeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); startSession(); }
    });
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
