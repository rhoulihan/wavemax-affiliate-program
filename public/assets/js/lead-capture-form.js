/* lead-capture-form.js
 *
 * AJAX submission for the /laundromat-investment-guide/ lead form.
 * POSTs to /api/v1/franchise-lead, swaps to a thank-you state on
 * success, displays the reference token returned by the server.
 */
(function () {
  'use strict';

  const ENDPOINT = '/api/v1/franchise-lead';

  function setStatus(el, kind, msg) {
    el.classList.remove('ok', 'err', 'hide');
    el.classList.add(kind);
    el.textContent = msg;
  }

  function init() {
    const form = document.getElementById('wm-ig-lead-form');
    if (!form) return;
    const status = document.getElementById('ig-status');
    const submit = document.getElementById('ig-submit');
    const formState = document.getElementById('wm-ig-form-state');
    const thanks = document.getElementById('wm-ig-thanks');
    const tokenEl = document.getElementById('wm-ig-token');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const payload = {};
      fd.forEach((v, k) => { payload[k] = String(v).trim(); });
      payload.source = window.location.pathname;

      // Minimal client-side guard.
      if (!payload.firstName || !payload.lastName || !payload.email || !payload.phone || !payload.timeline || !payload.capital) {
        setStatus(status, 'err', 'Please fill in all required fields.');
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
          // Swap to thank-you state
          if (body.data && body.data.token && tokenEl) tokenEl.textContent = body.data.token;
          if (formState) formState.style.display = 'none';
          if (thanks) thanks.classList.add('shown');
          // Scroll thank-you into view if the form was below the fold
          if (thanks) thanks.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        if (res.status === 429) {
          setStatus(status, 'err', "You're submitting too quickly. Please try again in a few minutes.");
        } else if (body && body.errors && body.errors.length) {
          setStatus(status, 'err', body.errors.map((e) => e.msg).join(' · '));
        } else {
          setStatus(status, 'err', (body && body.message) || 'Could not process your request — please try again later.');
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
