// crhsent proof-tab "next" buttons: advance tab + refocus (no inline JS, CSP-safe)
(function () {
  function go(el) { if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  var tabs = document.getElementById('prooftabs');
  document.querySelectorAll('.tab-next').forEach(function (b) {
    b.addEventListener('click', function () {
      var tab = b.getAttribute('data-tab'), to = b.getAttribute('data-to');
      if (tab) { var r = document.getElementById(tab); if (r) { r.checked = true; } go(tabs); }
      else if (to) { go(document.querySelector(to)); }
    });
  });

  // Anchor-URL tab activation: when the page loads with a hash matching a
  // callout inside one of the proof-tab panels (e.g. when a visitor follows
  // /wavemax/#audit-callout back from the security-audit page on a fresh
  // navigation rather than via the bfcache history.back() fast path), check
  // the corresponding radio button so the panel is visible, then scroll the
  // callout into view. Otherwise the visitor lands on a hash that points
  // inside a hidden panel and sees nothing change.
  var hashToTab = { 'audit-callout': 'tab-sec', 'clickjack-callout': 'tab-sec' };
  function activateFromHash() {
    var id = (location.hash || '').slice(1);
    if (!id || !hashToTab[id]) { return; }
    var tabRadio = document.getElementById(hashToTab[id]);
    if (tabRadio) { tabRadio.checked = true; }
    var target = document.getElementById(id);
    if (target) {
      // Slight delay so the radio-change has actually toggled panel visibility
      // before scrollIntoView measures the target's final position.
      setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
    }
  }
  activateFromHash();
  window.addEventListener('hashchange', activateFromHash);

  // "What do I actually get?" buttons: unhide the offer block (hidden by
  // default) and focus the what-you-get section. CSP-safe (external, no inline).
  document.querySelectorAll('.reveal-offer').forEach(function (b) {
    b.addEventListener('click', function () {
      var wrap = document.getElementById('offer-reveal');
      if (wrap) { wrap.hidden = false; }
      var target = document.getElementById('what-you-get');
      if (target) {
        go(target);
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });
})();

// Franchise self-serve preview modal: paste a Google Business link -> confirm the
// business -> attest + Turnstile -> we email a private preview link + password.
// Talks to /__preview/resolve and /__preview/request on the crhsent host.
// CSP-safe: external file, class toggles, Turnstile lazy-loaded from its CF origin
// (allowed in script-src/frame-src) only when the modal opens — no inline anything.
(function () {
  var modal = document.getElementById('preview-modal');
  if (!modal) { return; }
  var meta = document.querySelector('meta[name="turnstile-sitekey"]');
  var SITEKEY = meta ? (meta.getAttribute('content') || '').trim() : '';
  var state = { placeId: null, name: null };
  var ts = { id: null, token: null, loading: false, queue: [] };

  function $(sel) { return modal.querySelector(sel); }
  function step(n) {
    modal.querySelectorAll('.pv-step').forEach(function (s) {
      s.hidden = (parseInt(s.getAttribute('data-step'), 10) !== n);
    });
  }
  function err(el, msg) { el.textContent = msg; el.hidden = false; }
  function clearErr(el) { el.hidden = true; el.textContent = ''; }
  function busy(btn, on) { btn.disabled = on; btn.classList.toggle('is-busy', on); }

  function message(code) {
    switch (code) {
      case 'RESOLVE_FAILED': return "We couldn't find that business on Google. Try your name and city below.";
      case 'INVALID_LINK': return 'That doesn\'t look like a valid link. Use Google Maps → Share → copy link.';
      case 'CAPTCHA_FAILED': return 'Please complete the verification, then try again.';
      case 'INVALID_EMAIL': return 'Please enter a valid email address.';
      case 'ATTESTATION_REQUIRED': return 'Please confirm you are authorized for this business.';
      case 'EMAIL_FAILED': return "We couldn't send the email just now — please try again shortly.";
      case 'THROTTLED': return 'Too many attempts. Please wait a minute and try again.';
      case 'UNAVAILABLE': return 'Live previews are launching soon — please check back shortly.';
      default: return 'Something went wrong. Please try again.';
    }
  }

  function post(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      // A non-JSON body means the preview backend isn't live yet (deploys dark:
      // the endpoint falls through to a redirect/404). Degrade gracefully rather
      // than surfacing a parse error on the live sales page.
      return r.text().then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { j = { ok: false, code: 'UNAVAILABLE' }; }
        return { status: r.status, json: j };
      });
    });
  }

  function loadTurnstile(cb) {
    if (window.turnstile) { cb(); return; }
    ts.queue.push(cb);
    if (ts.loading) { return; }
    ts.loading = true;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true; s.defer = true;
    s.onload = function () { ts.queue.forEach(function (f) { f(); }); ts.queue = []; };
    document.head.appendChild(s);
  }
  function renderTurnstile() {
    if (!SITEKEY) { return; }
    loadTurnstile(function () {
      if (!window.turnstile) { return; }
      if (ts.id !== null) { window.turnstile.reset(ts.id); ts.token = null; return; }
      ts.id = window.turnstile.render('#pv-turnstile', {
        sitekey: SITEKEY,
        callback: function (t) { ts.token = t; },
        'error-callback': function () { ts.token = null; },
        'expired-callback': function () { ts.token = null; }
      });
    });
  }
  function resetTurnstile() {
    ts.token = null;
    if (window.turnstile && ts.id !== null) { try { window.turnstile.reset(ts.id); } catch (e) { /* noop */ } }
  }

  function open() {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pv-lock');
    step(1);
    var f = $('#pv-gbp'); if (f) { setTimeout(function () { f.focus(); }, 40); }
  }
  function close() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('pv-lock');
    resetTurnstile();
  }

  function showFound(d) {
    state.placeId = d.placeId; state.name = d.name;
    $('#pv-found-name').textContent = d.name || 'Your business';
    $('#pv-found-addr').textContent = d.formattedAddress || '';
    step(2);
    renderTurnstile();
  }
  function resolve(payload, errEl, btn) {
    clearErr(errEl); busy(btn, true);
    post('/__preview/resolve', payload).then(function (r) {
      busy(btn, false);
      if (r.json && r.json.ok) { showFound(r.json); }
      else {
        err(errEl, message(r.json && r.json.code));
        if (r.json && r.json.code === 'RESOLVE_FAILED') { $('#pv-fallback').hidden = false; }
      }
    }).catch(function () { busy(btn, false); err(errEl, message()); });
  }

  // Open / close wiring
  document.querySelectorAll('[data-preview-open]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); open(); });
  });
  modal.querySelectorAll('[data-preview-close]').forEach(function (b) {
    b.addEventListener('click', close);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) { close(); }
  });

  // Step 1 — find the business
  $('#pv-find').addEventListener('click', function () {
    var link = ($('#pv-gbp').value || '').trim();
    if (!link) { err($('#pv-find-error'), 'Paste your Google Business link to continue.'); return; }
    resolve({ gbpLink: link }, $('#pv-find-error'), this);
  });
  $('#pv-find-text').addEventListener('click', function () {
    var text = ($('#pv-text').value || '').trim();
    if (!text) { err($('#pv-find-error'), 'Enter your business name and city.'); return; }
    resolve({ text: text }, $('#pv-find-error'), this);
  });

  // Step 2 — confirm + request
  $('#pv-back').addEventListener('click', function () {
    state.placeId = null; state.name = null; resetTurnstile(); step(1);
  });
  $('#pv-submit').addEventListener('click', function () {
    var errEl = $('#pv-submit-error'); clearErr(errEl);
    var email = ($('#pv-email').value || '').trim();
    if (!email) { err(errEl, 'Please enter your email.'); return; }
    if (!$('#pv-attest').checked) { err(errEl, message('ATTESTATION_REQUIRED')); return; }
    if (SITEKEY && !ts.token) { err(errEl, message('CAPTCHA_FAILED')); return; }
    var btn = this; busy(btn, true);
    post('/__preview/request', {
      placeId: state.placeId, email: email, attestation: true, turnstileToken: ts.token
    }).then(function (r) {
      busy(btn, false);
      if (r.json && r.json.ok) { $('#pv-sent-email').textContent = email; step(3); }
      else { err(errEl, message(r.json && r.json.code)); resetTurnstile(); }
    }).catch(function () { busy(btn, false); err(errEl, message()); resetTurnstile(); });
  });
})();
