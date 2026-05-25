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
