// Order Expediter display (PR D) — always-on in-store stats board.
//
// Reads the read-only token from the page URL (?k=...) and polls
// GET /api/v1/expediter/summary?k=... every 30s, rendering active orders by
// affiliate, cross-affiliate counters, and today's completed-orders summary.
// Aggregate-only data (no customer PII). CSP-safe: textContent + createElement
// only (no innerHTML), addEventListener only.
(function () {
  'use strict';

  var REFRESH_MS = 30000;
  var token = new URLSearchParams(window.location.search).get('k') || '';

  function t(key, fallback) {
    var v = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : key;
    return (v && v !== key) ? v : (fallback || key);
  }
  function byId(id) { return document.getElementById(id); }
  function setText(id, text) { var el = byId(id); if (el) el.textContent = text; }

  function showError() {
    var err = byId('exp-error');
    var content = byId('exp-content');
    if (err) err.hidden = false;
    if (content) content.hidden = true;
  }

  function render(data) {
    byId('exp-error').hidden = true;
    byId('exp-content').hidden = false;

    var c = data.counters || {};
    setText('exp-c-pending', c.pending || 0);
    setText('exp-c-in_progress', c.in_progress || 0);
    setText('exp-c-out_for_delivery', c.out_for_delivery || 0);
    setText('exp-c-total', c.total || 0);

    var tbody = byId('exp-affiliates');
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    var rows = data.activeByAffiliate || [];
    byId('exp-empty').hidden = rows.length > 0;
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      [r.name || r.affiliateId, r.pending || 0, r.in_progress || 0, r.out_for_delivery || 0, r.total || 0]
        .forEach(function (val, i) {
          var td = document.createElement('td');
          td.textContent = String(val);
          if (i === 0) td.className = 'exp-partner';
          tr.appendChild(td);
        });
      tbody.appendChild(tr);
    });

    var d = data.dailyCompleted || {};
    setText('exp-d-count', d.count || 0);
    setText('exp-d-proc', d.avgProcessingMinutes == null ? '—' : d.avgProcessingMinutes);
    setText('exp-d-turn', d.avgTurnaroundMinutes == null ? '—' : d.avgTurnaroundMinutes);

    if (data.generatedAt) {
      var when = new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setText('exp-updated', t('expediter.updated', 'Updated') + ' ' + when);
    }
  }

  function refresh() {
    if (!token) { showError(); return; }
    // Send the token via header (not the query string) so it stays out of the
    // API request URL / access logs. The page-load URL still carries ?k=, but
    // that is redacted server-side in the request logger.
    fetch('/api/v1/expediter/summary', {
      headers: { 'Accept': 'application/json', 'x-expediter-token': token }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('http_' + res.status);
        return res.json();
      })
      .then(function (body) {
        if (body && body.success && body.data) render(body.data);
        else showError();
      })
      .catch(function () { showError(); });
  }

  var pollId = null;
  function start() {
    refresh();
    pollId = setInterval(refresh, REFRESH_MS);
    // Stop polling when the SPA navigates away (avoids a runaway interval).
    window.statsInterval = pollId; // the SPA's cleanupCurrentPage clears this too
    window.addEventListener('page-cleanup', function () {
      if (pollId) { clearInterval(pollId); pollId = null; }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
