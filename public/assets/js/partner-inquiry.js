/* Rundberg Laundry — partner inquiry form + language switch.
   CSP-clean external script (no inline). Posts to /api/v1/partner-inquiry. */
(function () {
  'use strict';

  // Small i18n helper with English fallback (works whether or not i18n.js is ready).
  function t(key, fallback) {
    try {
      var fn = window.i18n && (window.i18n.t || window.i18n.translate);
      if (typeof fn === 'function') {
        var v = fn.call(window.i18n, key);
        if (v && v !== key) return v;
      }
    } catch (e) { /* fall through */ }
    return fallback;
  }

  // ---------------------------------------------------------------- language switch
  function initLangSwitch() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.ap-lang'));
    if (!buttons.length) return;

    function sync(active) {
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === active));
      });
    }
    // reflect whatever i18n settled on
    var current = (window.i18n && window.i18n.currentLanguage) || document.documentElement.lang || 'en';
    sync(current);

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var lang = b.getAttribute('data-lang');
        if (window.i18n && typeof window.i18n.setLanguage === 'function') {
          window.i18n.setLanguage(lang);
        }
        document.documentElement.lang = lang;
        sync(lang);
      });
    });
  }

  // ---------------------------------------------------------------- inquiry form
  function initForm() {
    var form = document.getElementById('pp-form');
    if (!form) return;
    var statusEl = document.getElementById('pp-status');
    var submitBtn = document.getElementById('pp-submit');

    function setStatus(kind, msg) {
      if (!statusEl) return;
      statusEl.className = 'ap-form-status ' + (kind === 'ok' ? 'is-ok' : 'is-err');
      statusEl.textContent = msg;
    }
    function clearStatus() {
      if (!statusEl) return;
      statusEl.className = 'ap-form-status';
      statusEl.textContent = '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearStatus();

      var data = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (el.name) data[el.name] = (el.value || '').trim();
      });

      // minimal client validation; the server is the source of truth
      var required = ['firstName', 'lastName', 'email', 'phone'];
      var missing = required.filter(function (k) { return !data[k]; });
      var emailOk = /.+@.+\..+/.test(data.email || '');
      if (missing.length || !emailOk) {
        setStatus('err', t('partner.form.errRequired', 'Please fill in your name, a valid email, and a phone number.'));
        var firstBad = form.querySelector('[name="' + (missing[0] || 'email') + '"]');
        if (firstBad) firstBad.focus();
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      setStatus('ok', t('partner.form.sending', 'Sending…'));

      fetch('/api/v1/partner-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            return { ok: res.ok, body: body };
          });
        })
        .then(function (r) {
          if (r.ok) {
            form.reset();
            setStatus('ok', t('partner.form.successMsg', "Thanks — your inquiry is on its way. We'll be in touch within one business day."));
          } else {
            var msg = (r.body && (r.body.message || (r.body.errors && r.body.errors[0] && r.body.errors[0].msg))) ||
              t('partner.form.errGeneric', 'Something went wrong sending your inquiry. Please try again, or email pickups@rundberglaundry.com.');
            setStatus('err', msg);
          }
        })
        .catch(function () {
          setStatus('err', t('partner.form.errNetwork', 'Network error — please try again, or email pickups@rundberglaundry.com.'));
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  function init() { initLangSwitch(); initForm(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
