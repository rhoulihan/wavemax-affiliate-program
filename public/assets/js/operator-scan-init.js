// Store kiosk scanner (Phase 1 PR 5/§6). Operator is already authenticated
// (JWT). Each scan is STATE-DRIVEN: resolve the bag against the PR 4 engine,
// show ONE confirm dialog for the proposed transition, apply on Yes, bump a
// running session tally. Undo reverses the last bag scanned this session.
//
// No weight / add-ons / pricing in Phase 1 — the old intake/processed modals and
// their retired operator endpoints are gone; everything goes through ScanSession
// (operator mode → Authorization: Bearer).
(function () {
  'use strict';

  // --- i18n helper (i18n.t returns the key when missing → fall back) --------
  function t(key, fallback) {
    var v = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : key;
    return (v && v !== key) ? v : (fallback || key);
  }

  // --- DOM ------------------------------------------------------------------
  var scanInput = document.getElementById('scanInput');
  var sessionTally = document.getElementById('sessionTally');
  var undoBtn = document.getElementById('undoBtn');

  var confirmModal = document.getElementById('scanConfirmModal');
  var confirmPrompt = document.getElementById('scanConfirmPrompt');
  var confirmCustomer = document.getElementById('scanConfirmCustomer');
  var centsWarning = document.getElementById('scanCentsWarning');
  var paymentRow = document.getElementById('scanPaymentRow');
  var paymentCheckbox = document.getElementById('scanPaymentConfirmed');
  var confirmYes = document.getElementById('scanConfirmYes');
  var confirmNo = document.getElementById('scanConfirmNo');

  var toast = document.getElementById('confirmationModal');
  var toastIcon = document.getElementById('confirmIcon');
  var toastTitle = document.getElementById('confirmTitle');
  var toastMessage = document.getElementById('confirmMessage');

  // --- state ----------------------------------------------------------------
  var scanBuffer = '';
  var scanTimeout = null;
  var toastTimeout = null;
  var tally = 0;
  var lastBagToken = null; // last bag this session applied a transition to (undo target)
  var pending = null;      // { bagToken, resolveData }

  // --- toast ----------------------------------------------------------------
  function showToast(message, icon, type) {
    if (type === 'error') {
      toastTitle.textContent = t('operator.scan.errorTitle', 'Error');
    } else if (type === 'info') {
      toastTitle.textContent = t('operator.scan.infoTitle', 'No change');
    } else {
      toastTitle.textContent = t('operator.scan.successTitle', 'Success');
    }
    toastMessage.textContent = message;
    toastIcon.textContent = icon || '✓';
    toast.className = 'confirmation-modal ' + (type || 'success');
    toast.classList.add('block');
    toast.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(hideToast, 3000);
  }
  function hideToast() {
    toast.classList.add('hidden');
    toast.classList.remove('block');
  }
  function showError(message) { showToast(message, '❌', 'error'); }

  // --- confirm dialog -------------------------------------------------------
  function hideConfirm() {
    confirmModal.hidden = true;
    paymentRow.hidden = true;
    paymentCheckbox.checked = false;
    pending = null;
  }

  function openConfirm(bagToken, resolveData) {
    pending = { bagToken: bagToken, resolveData: resolveData };

    var promptKey = resolveData.promptKey ? 'claim.' + resolveData.promptKey : null;
    confirmPrompt.textContent = promptKey
      ? t(promptKey, t('operator.scan.confirmGeneric', 'Apply this scan?'))
      : t('operator.scan.confirmGeneric', 'Apply this scan?');

    // Customer first/last for the intake screen.
    var c = resolveData.customer;
    confirmCustomer.textContent = c
      ? ((c.firstName || '') + ' ' + (c.lastName || '')).trim()
      : '';

    // Warn the operator to update Cents when the customer changed their phone.
    if (centsWarning) {
      if (resolveData.centsSyncNeeded) {
        centsWarning.textContent = t('operator.scan.centsSyncWarning', 'Phone changed — update this number in Cents:') +
          ' ' + (resolveData.customerPhone || '');
        centsWarning.hidden = false;
      } else {
        centsWarning.hidden = true;
      }
    }

    // Payment-confirmed checkbox only when handing a bag back for delivery.
    var needsPayment = resolveData.proposedAction === 'advance' &&
      resolveData.to === 'out_for_delivery';
    paymentRow.hidden = !needsPayment;
    paymentCheckbox.checked = false;

    confirmModal.hidden = false;
  }

  function expectedActionFor(resolveData) {
    // delivery-rescan-prompt is confirmed as a reopen decision; everything else
    // applies its proposedAction directly.
    return resolveData.proposedAction;
  }

  async function onConfirmYes() {
    if (!pending) return;
    var bagToken = pending.bagToken;
    var resolveData = pending.resolveData;
    var action = expectedActionFor(resolveData);
    var opts = {};
    if (resolveData.proposedAction === 'advance' && resolveData.to === 'out_for_delivery') {
      opts.paymentConfirmed = paymentCheckbox.checked;
    }
    if (resolveData.proposedAction === 'delivery-rescan-prompt') {
      opts.reopen = true; // Yes → start a new order
    }
    hideConfirm();
    await applyAction(bagToken, action, opts);
  }

  function onConfirmNo() {
    if (!pending) { hideConfirm(); return; }
    var resolveData = pending.resolveData;
    var bagToken = pending.bagToken;
    // delivery-rescan-prompt No = explicit no-op (do NOT reopen); send it so the
    // server records the decision. Any other action: just dismiss.
    if (resolveData.proposedAction === 'delivery-rescan-prompt') {
      hideConfirm();
      applyAction(bagToken, 'delivery-rescan-prompt', { reopen: false });
      return;
    }
    hideConfirm();
    focusScanner();
  }

  async function applyAction(bagToken, expectedAction, opts) {
    try {
      var result = await window.ScanSession.apply(bagToken, expectedAction, opts);
      lastBagToken = bagToken;
      if (result.action === 'no-op') {
        // e.g. delivery-rescan-prompt answered "No" — the order was deliberately
        // left as-is. Acknowledge with a neutral toast, not a success one.
        showToast(t('operator.scan.noChange', 'No change — order left as delivered'), 'ℹ️', 'info');
      } else {
        tally += 1;
        sessionTally.textContent = String(tally);
        undoBtn.hidden = false;
        showToast(t('operator.scan.applied', 'Done'), '✅', 'success');
      }
    } catch (err) {
      if (err.status === 409 && err.code === 'state_changed') {
        showError(t('operator.scan.stateChanged', 'Bag state changed — please re-scan'));
        // Re-resolve so the operator can confirm the now-current action.
        await resolveAndConfirm(bagToken);
        return;
      }
      handleScanError(err);
    } finally {
      focusScanner();
    }
  }

  async function resolveAndConfirm(bagToken) {
    try {
      var resolveData = await window.ScanSession.resolve(bagToken);
      openConfirm(bagToken, resolveData);
    } catch (err) {
      handleScanError(err);
      focusScanner();
    }
  }

  function handleScanError(err) {
    if (err.status === 404 || err.code === 'bag_not_registered') {
      showError(t('operator.scan.notRegistered', 'Bag not registered'));
    } else if (err.status === 401) {
      // operator token expired — bounce to login
      localStorage.removeItem('operatorToken');
      localStorage.removeItem('operatorData');
      goToLogin();
    } else {
      showError(err.message || t('operator.scan.networkError', 'Network error — please try again.'));
    }
  }

  async function onUndo() {
    if (!lastBagToken) return;
    try {
      var result = await window.ScanSession.undo(lastBagToken);
      if (result.undone) {
        if (tally > 0) { tally -= 1; sessionTally.textContent = String(tally); }
        showToast(t('operator.scan.undone', 'Last scan undone'), '↩️', 'success');
      } else {
        showError(t('operator.scan.nothingToUndo', 'Nothing to undo'));
      }
      lastBagToken = null;
      undoBtn.hidden = true;
    } catch (err) {
      handleScanError(err);
    } finally {
      focusScanner();
    }
  }

  // --- scanner input (keyboard-wedge) --------------------------------------
  function handleScanInput(e) {
    var value = e.target.value;
    if (scanTimeout) clearTimeout(scanTimeout);
    scanBuffer += value;
    scanInput.value = '';
    scanTimeout = setTimeout(function () {
      if (scanBuffer.length > 0) {
        processScan(scanBuffer.trim());
        scanBuffer = '';
      }
    }, 100);
  }

  function processScan(scanData) {
    var bagToken = window.BagTokenParser.extractBagToken(scanData);
    if (!bagToken) {
      showError(t('operator.scan.notRegistered', 'Bag not registered'));
      return;
    }
    resolveAndConfirm(bagToken);
  }

  function focusScanner() {
    if (!scanInput) return;
    scanInput.removeAttribute('readonly');
    scanInput.focus();
    scanInput.select();
  }

  // --- navigation -----------------------------------------------------------
  function goToLogin() {
    if (window.navigateTo) window.navigateTo('/operator-login');
    else window.location.href = '/embed-app-v2.html?route=/operator-login';
  }

  // --- init -----------------------------------------------------------------
  async function init() {
    var token = localStorage.getItem('operatorToken');
    if (!token) { goToLogin(); return; }

    // Verify the operator token is still valid.
    try {
      var data = await ApiClient.get('/api/v1/auth/verify', {
        showError: false,
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!data.success) {
        localStorage.removeItem('operatorToken');
        localStorage.removeItem('operatorData');
        goToLogin();
        return;
      }
    } catch (err) {
      localStorage.removeItem('operatorToken');
      localStorage.removeItem('operatorData');
      goToLogin();
      return;
    }

    // Operator mode → Authorization: Bearer <operatorToken>.
    window.ScanSession.init({ mode: 'operator' });

    // Android kiosk fullscreen affordance (best-effort).
    if (/android/i.test(navigator.userAgent || '') &&
        window.location.pathname.indexOf('operator-scan') !== -1) {
      document.body.classList.add('android-kiosk');
      document.documentElement.classList.add('android-kiosk');
      var enableFullscreen = function () {
        var elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen().catch(function () {});
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        document.removeEventListener('click', enableFullscreen);
        document.removeEventListener('touchstart', enableFullscreen);
      };
      document.addEventListener('click', enableFullscreen);
      document.addEventListener('touchstart', enableFullscreen);
    }

    // Wire events.
    scanInput.addEventListener('input', handleScanInput);
    scanInput.addEventListener('blur', function () {
      setTimeout(function () {
        if (confirmModal.hidden && document.activeElement !== scanInput) focusScanner();
      }, 100);
    });
    confirmYes.addEventListener('click', onConfirmYes);
    confirmNo.addEventListener('click', onConfirmNo);
    undoBtn.addEventListener('click', onUndo);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideConfirm();
    });

    focusScanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
