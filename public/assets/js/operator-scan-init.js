// Store kiosk scanner (Phase 1 PR 5/§6). Operator is already authenticated
// (JWT). Each scan is STATE-DRIVEN: resolve the bag against the PR 4 engine,
// then show ONE confirm dialog (customer + current order status + next step)
// and apply on Confirm. Undo reverses the last bag scanned this session.
// Order metrics live on the expediter, not here.
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
  var undoBtn = document.getElementById('undoBtn');

  var confirmModal = document.getElementById('scanConfirmModal');
  var confirmPrompt = document.getElementById('scanConfirmPrompt');
  var confirmCustomer = document.getElementById('scanConfirmCustomer');
  var confirmPhone = document.getElementById('scanConfirmPhone');
  var confirmEmail = document.getElementById('scanConfirmEmail');
  var confirmAddress = document.getElementById('scanConfirmAddress');
  var orderStatusEl = document.getElementById('scanOrderStatus');
  var addOnsEl = document.getElementById('scanAddOns');
  var instructionsEl = document.getElementById('scanInstructions');
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
  var lastBagToken = null; // last bag this session applied a transition to (undo target)
  var pending = null;      // { bagToken, resolveData }

  // Order-status display labels (current state shown in the confirm modal).
  function statusLabel(status) {
    if (!status || status === 'none') return t('operator.scan.statusNone', 'No active order');
    return t('order.status.' + status, status);
  }

  // Set a customer-detail line, hiding it when there's no value.
  function setDetail(el, value) {
    if (!el) return;
    if (value) { el.textContent = value; el.hidden = false; }
    else { el.textContent = ''; el.hidden = true; }
  }

  function clearChildren(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  // Localized add-on label: active language's translation, else English name/key.
  function addonLabel(a) {
    var lang = (window.i18n && window.i18n.getLanguage && window.i18n.getLanguage()) || 'en';
    if (lang !== 'en' && a.translations && a.translations[lang]) return a.translations[lang];
    return a.name || a.key;
  }

  // Render the order's add-ons + special instructions — ONLY at intake (the order
  // is still pending and the next scan checks it in). Suppressed on every later
  // scan ("not needed on scan-out"). CSP-clean (createElement/textContent).
  function renderOrderExtras(resolveData) {
    var atIntake = resolveData.currentStatus === 'pending';
    var addOns = (atIntake && Array.isArray(resolveData.addOns)) ? resolveData.addOns : [];
    var instructions = atIntake ? (resolveData.specialInstructions || '') : '';

    if (addOnsEl) {
      clearChildren(addOnsEl);
      if (addOns.length) {
        var aLabel = document.createElement('span');
        aLabel.className = 'scan-addons-label';
        aLabel.textContent = t('operator.scan.addonsLabel', 'Add-ons');
        addOnsEl.appendChild(aLabel);
        var ul = document.createElement('ul');
        ul.className = 'scan-addons-list';
        addOns.forEach(function (a) {
          var li = document.createElement('li');
          li.textContent = addonLabel(a);
          ul.appendChild(li);
        });
        addOnsEl.appendChild(ul);
        addOnsEl.hidden = false;
      } else {
        addOnsEl.hidden = true;
      }
    }

    if (instructionsEl) {
      clearChildren(instructionsEl);
      if (instructions) {
        var iLabel = document.createElement('span');
        iLabel.className = 'scan-instructions-label';
        iLabel.textContent = t('operator.scan.instructionsLabel', 'Special instructions');
        var p = document.createElement('p');
        p.className = 'scan-instructions-text';
        p.textContent = instructions;
        instructionsEl.appendChild(iLabel);
        instructionsEl.appendChild(p);
        instructionsEl.hidden = false;
      } else {
        instructionsEl.hidden = true;
      }
    }
  }

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
    confirmModal.classList.remove('block');
    paymentRow.hidden = true;
    paymentCheckbox.checked = false;
    confirmYes.disabled = false;
    if (addOnsEl) addOnsEl.hidden = true;
    if (instructionsEl) instructionsEl.hidden = true;
    pending = null;
  }

  function openConfirm(bagToken, resolveData) {
    pending = { bagToken: bagToken, resolveData: resolveData };

    var promptKey = resolveData.promptKey ? 'claim.' + resolveData.promptKey : null;
    confirmPrompt.textContent = promptKey
      ? t(promptKey, t('operator.scan.confirmGeneric', 'Apply this scan?'))
      : t('operator.scan.confirmGeneric', 'Apply this scan?');

    // Full customer record for the operator (name, phone, email, address, notes).
    var c = resolveData.customer || {};
    confirmCustomer.textContent = ((c.firstName || '') + ' ' + (c.lastName || '')).trim();
    if (confirmPhone) confirmPhone.textContent = c.phone || resolveData.customerPhone || '';
    setDetail(confirmEmail, c.email);
    var cityLine = [c.city, c.state].filter(Boolean).join(', ');
    var addr = [c.address, [cityLine, c.zipCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    setDetail(confirmAddress, addr);

    // Current order status pill.
    if (orderStatusEl) {
      orderStatusEl.textContent = statusLabel(resolveData.currentStatus);
      orderStatusEl.hidden = false;
    }

    // Add-ons + special instructions (only at intake / pending).
    renderOrderExtras(resolveData);

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

    // Payment + receipt confirmation is REQUIRED before handing a bag back for
    // delivery: the checkbox must be ticked to enable Confirm (the server also
    // hard-rejects the transition without it).
    var needsPayment = resolveData.proposedAction === 'advance' &&
      resolveData.to === 'out_for_delivery';
    paymentRow.hidden = !needsPayment;
    paymentCheckbox.checked = false;
    confirmYes.disabled = needsPayment; // must tick the box first

    confirmModal.hidden = false;
    confirmModal.classList.add('block'); // actually reveal it (base style is display:none)
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
      // TEMP DIAGNOSTIC (kiosk "bag not registered" triage 2026-06-20): the parser
      // found no token in the scanner output — send the raw string to the server
      // log so we can see exactly what the hardware scanner emitted. Remove after.
      try { window.ScanSession.resolve('RAWSCAN:' + scanData).catch(function () {}); } catch (e) { /* noop */ }
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
    // Payment+receipt gate: Confirm stays disabled until the box is ticked.
    paymentCheckbox.addEventListener('change', function () {
      if (!paymentRow.hidden) confirmYes.disabled = !paymentCheckbox.checked;
    });
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
