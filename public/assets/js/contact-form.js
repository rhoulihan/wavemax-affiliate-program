/* contact-form.js
 *
 * AJAX submission for the corporate /contact/ form. POSTs to
 * /api/v1/corporate-contact, displays the resulting status inline.
 */
(function () {
  'use strict';

  const ENDPOINT = '/api/v1/corporate-contact';

  function setStatus(el, kind, msg) {
    el.classList.remove('ok', 'err', 'hide');
    el.classList.add(kind);
    el.textContent = msg;
  }

  function init() {
    const form = document.getElementById('wm-co-contact-form');
    if (!form) return;
    const status = document.getElementById('co-status');
    const submit = document.getElementById('co-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const payload = {};
      fd.forEach((v, k) => { payload[k] = String(v).trim(); });
      payload.source = window.location.pathname;

      // Minimal client-side guard — server validates definitively.
      if (!payload.topic || !payload.firstName || !payload.lastName || !payload.email || !payload.message) {
        setStatus(status, 'err', 'Please fill in all required fields.');
        return;
      }
      if (payload.message.length < 5) {
        setStatus(status, 'err', 'Message is too short.');
        return;
      }

      submit.disabled = true;
      status.classList.add('hide');

      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        const body = await res.json().catch(() => ({}));

        if (res.ok && body.success) {
          setStatus(status, 'ok', body.message || "Your message has been sent — we'll be in touch shortly.");
          form.reset();
        } else if (res.status === 429) {
          setStatus(status, 'err', "You're sending messages too quickly. Please try again in a few minutes.");
        } else if (body && body.errors && body.errors.length) {
          setStatus(status, 'err', body.errors.map((e) => e.msg).join(' · '));
        } else {
          setStatus(status, 'err', (body && body.message) || 'Could not send your message — please try again later.');
        }
      } catch (err) {
        setStatus(status, 'err', 'Network error — please check your connection and try again.');
      } finally {
        submit.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
