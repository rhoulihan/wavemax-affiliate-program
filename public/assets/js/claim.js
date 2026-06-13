// /claim — bag claim page (spec §6.3).
// State machine: resolving | claimable | claimed | invalid.
// PR 9 adds 'deliver' and 'reintake' branches to renderState's switch —
// do not dispatch state anywhere else.
(function () {
  'use strict';

  var bagToken = new URLSearchParams(window.location.search).get('bag');

  var SECTIONS = ['resolving', 'claimable', 'claimed', 'invalid'];

  function show(state) {
    SECTIONS.forEach(function (name) {
      var el = document.getElementById('claim-state-' + name);
      if (el) el.hidden = (name !== state);
    });
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
      // PR 9: dispatch on the resolve order context (deliver / status panels).
      dispatchClaimedState(data);
      break;
    case 'invalid':
    default:
      show('invalid');
      break;
    }
  }

  // ---- PR 9: deliver / status / re-intake branches ---------------------------

  function t9(key, fallback) {
    if (window.i18n && typeof window.i18n.translate === 'function') {
      const v = window.i18n.translate(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function showPanel(id) {
    // The PR 6 base sections and the PR 9 panels are mutually exclusive.
    show('__none__');
    ['claim-deliver-panel', 'claim-reintake-panel', 'claim-status-panel'].forEach(function (p) {
      var el = document.getElementById(p);
      if (el) el.hidden = (p !== id);
    });
  }

  // Called from renderState's `state === 'claimed'` branch:
  function dispatchClaimedState(data) {
    if (data && data.order && data.order.awaitingDelivery) {
      showPanel('claim-deliver-panel');
      const remembered = localStorage.getItem('wavemax_role_code');
      if (remembered) {
        document.getElementById('deliver-code').value = remembered;
        document.getElementById('deliver-remember-code').checked = true;
      }
    } else if (data && data.order) {
      showStatusPanel(data.order.status);
    } else {
      showStatusPanel(null); // claimed, nothing open — status/login affordance
    }
  }

  function showStatusPanel(status) {
    showPanel('claim-status-panel');
    const heading = document.getElementById('claim-status-heading');
    heading.textContent = status
      ? t9('claim.status.' + status, status.replace(/_/g, ' '))
      : t9('claim.alreadyClaimedTitle', 'This bag is registered'); // PR 6 key
  }

  function getGeoOptIn() {
    return new Promise(function (resolve) {
      if (!document.getElementById('deliver-geo-optin').checked) return resolve(undefined);
      if (!navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        function (pos) { resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        function () { resolve(undefined); },
        { timeout: 5000, maximumAge: 60000 }
      );
    });
  }

  async function submitDeliveryCode() {
    const codeInput = document.getElementById('deliver-code');
    const errorEl = document.getElementById('deliver-error');
    const successEl = document.getElementById('deliver-success');
    errorEl.hidden = true;
    const code = codeInput.value.trim();
    if (!code) return;

    const geo = await getGeoOptIn();
    const res = await fetch('/api/v1/bags/' + encodeURIComponent(bagToken) + '/confirm-delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geo ? { code: code, geo: geo } : { code: code })
    });
    const data = await res.json().catch(function () { return {}; });

    if (res.ok) {
      if (document.getElementById('deliver-remember-code').checked) {
        localStorage.setItem('wavemax_role_code', code); // explicit opt-in (§6.6)
      } else {
        localStorage.removeItem('wavemax_role_code');
      }
      successEl.hidden = false;
      document.getElementById('deliver-submit').disabled = true;
      return;
    }
    if (res.status === 401 && data.errors && data.errors.code === 'operator_code') {
      // Operator code on a picked_up bag = back at the store -> explicit
      // confirm before closing the order (§6.6 re-intake prompt).
      window.__pendingOperatorCode = code;
      showPanel('claim-reintake-panel');
      return;
    }
    errorEl.textContent = res.status === 429
      ? t9('claim.deliver.lockedOut', 'Too many attempts. Please try again later.')
      : t9('claim.deliver.badCode', "That code didn't match. Please try again.");
    errorEl.hidden = false;
  }

  async function submitReintake() {
    const errorEl = document.getElementById('reintake-error');
    errorEl.hidden = true;
    const weight = parseFloat(document.getElementById('reintake-weight').value);
    if (!Number.isFinite(weight) || weight <= 0) {
      errorEl.textContent = t9('operator.intake.weightLabel', 'Weight (lbs)');
      errorEl.hidden = false;
      return;
    }
    const res = await fetch('/api/v1/bags/' + encodeURIComponent(bagToken) + '/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorCode: window.__pendingOperatorCode,
        weight: weight,
        addOns: {
          premiumDetergent: document.getElementById('reintake-addon-detergent').checked,
          fabricSoftener: document.getElementById('reintake-addon-softener').checked,
          stainRemover: document.getElementById('reintake-addon-stain').checked
        },
        freshAddOnsFormPlaced: document.getElementById('reintake-fresh-form').checked
      })
    });
    if (res.ok) {
      showStatusPanel('in_progress'); // new order opened
      return;
    }
    errorEl.textContent = res.status === 429
      ? t9('claim.deliver.lockedOut', 'Too many attempts. Please try again later.')
      : t9('claim.deliver.badCode', "That code didn't match. Please try again.");
    errorEl.hidden = false;
  }

  // ---- end PR 9 ---------------------------------------------------------------

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
          localStorage.setItem('customerToken', result.body.token);
          localStorage.setItem('currentCustomer', JSON.stringify(result.body.customerData));
          window.location.href = '/embed-app-v2.html?route=/customer-dashboard';
          return;
        }
        submit.disabled = false;
        if (result.status === 409) {
          var raceMsg = (window.i18n && window.i18n.translate('claim.raceLost')) ||
            'Someone just claimed this bag. If that was you on another device, please log in.';
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
    var login = document.getElementById('claim-login-link');
    if (login) login.href = '/embed-app-v2.html?route=/customer-login';
    // PR 9 panels (CSP: addEventListener only, no inline handlers)
    var deliverBtn = document.getElementById('deliver-submit');
    if (deliverBtn) deliverBtn.addEventListener('click', submitDeliveryCode);
    var reintakeBtn = document.getElementById('reintake-confirm');
    if (reintakeBtn) reintakeBtn.addEventListener('click', submitReintake);
    resolveBag();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
