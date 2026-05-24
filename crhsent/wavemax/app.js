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
})();
