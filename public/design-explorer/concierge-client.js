/* concierge-client.js — CSP-clean client for the WaveMAX Austin concierge.
 *
 * External, same-origin script (allowed by the explorer's `script-src 'self'`).
 * No inline handlers, no innerHTML — replies are written with textContent only,
 * so a model response can never inject markup. Dependency-free.
 *
 * Binds to every `<form data-concierge>` on the page: reads the labelled input,
 * POSTs JSON to /api/concierge (same-origin; connect-src 'self'), shows a
 * loading state, and renders { reply } into the form's aria-live region.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/concierge';
  var MAX_LEN = 500;

  function findResponseRegion(form) {
    // Prefer an explicit hook; fall back to any aria-live region in the form.
    return (
      form.querySelector('[data-concierge-response]') ||
      form.querySelector('[aria-live]')
    );
  }

  function setBusy(form, input, button, busy) {
    if (input) input.disabled = busy;
    if (button) button.disabled = busy;
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function render(region, text) {
    if (!region) return;
    region.textContent = text; // textContent only — never innerHTML
  }

  function handleSubmit(form) {
    return function (ev) {
      ev.preventDefault();

      var input = form.querySelector('input[type="text"], input:not([type])');
      var button = form.querySelector('button[type="submit"], button:not([type])');
      var region = findResponseRegion(form);

      if (!input) return;
      var message = (input.value || '').trim();
      if (!message) return;
      if (message.length > MAX_LEN) message = message.slice(0, MAX_LEN);

      var lang = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2);
      var loadingText = {
        en: 'Asking the front desk…',
        es: 'Preguntando en recepción…',
        pt: 'Perguntando na recepção…',
        de: 'Frage an der Rezeption…'
      }[lang] || 'Asking the front desk…';

      var errorText = {
        en: 'Sorry, something went wrong — please call us at (512) 553-1674.',
        es: 'Lo sentimos, algo salió mal — llámanos al (512) 553-1674.',
        pt: 'Desculpe, algo deu errado — ligue para (512) 553-1674.',
        de: 'Entschuldigung, etwas ist schiefgelaufen — rufen Sie uns unter (512) 553-1674 an.'
      }[lang] || 'Sorry, something went wrong — please call us at (512) 553-1674.';

      setBusy(form, input, button, true);
      render(region, loadingText);

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ message: message })
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; });
        })
        .then(function (data) {
          var reply = data && typeof data.reply === 'string' ? data.reply : '';
          render(region, reply || errorText);
        })
        .catch(function () {
          render(region, errorText);
        })
        .then(function () {
          setBusy(form, input, button, false);
          if (input && typeof input.focus === 'function') input.focus();
        });
    };
  }

  function init() {
    var forms = document.querySelectorAll('form[data-concierge]');
    for (var i = 0; i < forms.length; i++) {
      forms[i].addEventListener('submit', handleSubmit(forms[i]));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
