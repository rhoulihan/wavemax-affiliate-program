/* Rundberg Laundry — UT affiliate application form.
   CSP-clean external script. Posts to /api/v1/affiliate-application. */
(function () {
  'use strict';

  function init() {
    var form = document.getElementById('af-form');
    if (!form) return;
    var statusEl = document.getElementById('af-status');
    var submitBtn = document.getElementById('af-submit');
    var eligible = document.getElementById('af-eligible');

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
        if (el.name && el.type !== 'checkbox') data[el.name] = (el.value || '').trim();
      });

      var required = ['firstName', 'lastName', 'email', 'phone'];
      var missing = required.filter(function (k) { return !data[k]; });
      var emailOk = /.+@.+\..+/.test(data.email || '');
      if (missing.length || !emailOk) {
        setStatus('err', 'Please fill in your name, a valid email, and a phone number.');
        var firstBad = form.querySelector('[name="' + (missing[0] || 'email') + '"]');
        if (firstBad) firstBad.focus();
        return;
      }
      if (eligible && !eligible.checked) {
        setStatus('err', 'Please confirm you’re U.S. work-eligible and understand this is a 1099 role.');
        eligible.focus();
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      setStatus('ok', 'Sending…');

      fetch('/api/v1/affiliate-application', {
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
            setStatus('ok', 'Thanks — your application is in. We’ll be in touch within a couple of business days.');
          } else {
            var msg = (r.body && (r.body.message || (r.body.errors && r.body.errors[0] && r.body.errors[0].msg))) ||
              'Something went wrong sending your application. Please try again, or email admin@crhsent.com.';
            setStatus('err', msg);
          }
        })
        .catch(function () {
          setStatus('err', 'Network error — please try again, or email admin@crhsent.com.');
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
