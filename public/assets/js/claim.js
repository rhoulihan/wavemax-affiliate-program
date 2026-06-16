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

  // ---- customer registration branch (unchanged) -----------------------------

  function showFormError(message) {
    var el = document.getElementById('claim-form-error');
    el.textContent = message;
    el.hidden = false;
  }

  function resolveBag() {
    if (!bagToken) { renderState('invalid'); return; }
    fetch('/api/v1/customers/claim/' + encodeURIComponent(bagToken))
      .then(function (res) { return res.json(); })
      .then(function (body) { renderState(body.state, body); })
      .catch(function () { renderState('invalid'); });
  }

  function submitRegistration(event) {
    event.preventDefault();
    var form = document.getElementById('claimRegistrationForm');
    var fields = form.elements;
    var submit = document.getElementById('claimSubmit');
    submit.disabled = true;

    var payload = {
      firstName: fields.firstName.value.trim(),
      lastName: fields.lastName.value.trim(),
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim(),
      address: fields.address.value.trim(),
      city: fields.city.value.trim(),
      state: fields.state.value.trim(),
      zipCode: fields.zipCode.value.trim(),
      languagePreference: localStorage.getItem('selectedLanguage') || 'en'
    };
    payload.username = fields.username.value.trim();
    payload.password = fields.password.value;

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
        submit.disabled = false;
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
        submit.disabled = false;
        showFormError('Network error — please try again.');
      });
  }

  function init() {
    document.getElementById('claimRegistrationForm')
      .addEventListener('submit', submitRegistration);

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
