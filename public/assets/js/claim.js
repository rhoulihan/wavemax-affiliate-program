// /claim — bag claim page (spec §6.3).
// State machine: resolving | claimable | claimed | invalid.
// PR 9 adds 'deliver' and 'reintake' branches to renderState's switch —
// do not dispatch state anywhere else.
(function () {
  'use strict';

  var bagToken = new URLSearchParams(window.location.search).get('bag');
  var oauth = { socialToken: null, provider: null };

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
      // PR 9: branch on data.order.awaitingDelivery -> 'deliver' panel here.
      show('claimed');
      break;
    case 'invalid':
    default:
      show('invalid');
      break;
    }
  }

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
    if (oauth.socialToken) {
      payload.socialToken = oauth.socialToken;
      payload.socialProvider = oauth.provider;
    } else {
      payload.username = fields.username.value.trim();
      payload.password = fields.password.value;
    }

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

  function startOAuth(provider) {
    var sessionId = 'oauth_claim_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    var url = '/api/v1/auth/customer/' + provider +
      '?popup=true&state=' + sessionId + '&bag=' + encodeURIComponent(bagToken) + '&t=' + Date.now();
    var popup = window.open(url, 'claimSocialAuth', 'width=500,height=600,scrollbars=yes,resizable=yes');
    if (!popup || popup.closed) {
      showFormError('Popup was blocked. Please allow popups and try again.');
      return;
    }
    var polls = 0;
    var timer = setInterval(function () {
      polls++;
      if (polls > 20) { clearInterval(timer); return; }
      fetch('/api/v1/auth/oauth/result/' + sessionId)
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (!result.completed) return;
          clearInterval(timer);
          try { if (popup && !popup.closed) popup.close(); } catch (e) { /* noop */ }
          if (!result.success) { showFormError(result.message || 'Authentication failed.'); return; }
          var data = result.data || {};
          oauth.socialToken = data.socialToken;
          oauth.provider = provider;
          if (data.email) { document.getElementById('email').value = data.email; }
          if (data.firstName) { document.getElementById('firstName').value = data.firstName; }
          if (data.lastName) { document.getElementById('lastName').value = data.lastName; }
          // OAuth authenticates — hide username/password
          document.getElementById('claim-credentials').hidden = true;
          document.getElementById('username').removeAttribute('required');
          document.getElementById('password').removeAttribute('required');
        })
        .catch(function () { /* keep polling */ });
    }, 3000);
  }

  function init() {
    document.getElementById('claimRegistrationForm')
      .addEventListener('submit', submitRegistration);
    document.getElementById('claimOAuthGoogle')
      .addEventListener('click', function () { startOAuth('google'); });
    document.getElementById('claimOAuthFacebook')
      .addEventListener('click', function () { startOAuth('facebook'); });
    var login = document.getElementById('claim-login-link');
    if (login) login.href = '/embed-app-v2.html?route=/customer-login';
    resolveBag();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
