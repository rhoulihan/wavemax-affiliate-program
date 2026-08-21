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
})();
