// Shared scan-session client (Phase 1 PR 5, spec §4).
//
// One authenticate-once, batch-scan helper used by BOTH scan frontends:
//   - the store kiosk (operator JWT — mode:'operator'), and
//   - the field/partner phone flow on the /claim overload (a minted
//     scan-session token — mode:'session').
//
// The scan endpoints (/api/v1/scan/*) are CSRF-exempt: they carry no ambient
// cookie credential (auth is the Bearer JWT or the x-scan-session token), so we
// never attach x-csrf-token here.
//
// Persistence primitive: the minted session lives in sessionStorage under
// `wavemax_scan_session`. Each bag QR opens a fresh full-page /claim load; only
// sessionStorage survives across those loads, which is exactly what lets a
// partner authenticate once and then scan bag after bag (each a new QR open)
// without re-entering their code until the session expires.
(function (root) {
  'use strict';

  var SESSION_KEY = 'wavemax_scan_session';

  // --- session store (sessionStorage-backed) --------------------------------

  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.sessionToken) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function setSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      sessionToken: session.sessionToken,
      actorType: session.actorType,
      expiresAt: session.expiresAt
    }));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isExpired() {
    var s = getSession();
    if (!s || !s.expiresAt) return true;
    return new Date(s.expiresAt).getTime() <= Date.now();
  }

  // --- auth mode ------------------------------------------------------------
  // 'operator' -> Authorization: Bearer <operatorToken from localStorage>
  // 'session'  -> x-scan-session: <minted session token>
  var authMode = 'session';

  function init(opts) {
    authMode = (opts && opts.mode) === 'operator' ? 'operator' : 'session';
  }

  function operatorToken() {
    return localStorage.getItem('operatorToken') || '';
  }

  function authHeaders() {
    if (authMode === 'operator') {
      return { 'Authorization': 'Bearer ' + operatorToken() };
    }
    var s = getSession();
    return s ? { 'x-scan-session': s.sessionToken } : {};
  }

  // --- HTTP -----------------------------------------------------------------

  // A 401 from resolve/apply means the scan-session token is gone/expired;
  // clear it so the caller can re-show the code panel. Thrown error carries
  // {status, code, body} for the caller to branch on.
  function scanError(status, body) {
    var err = new Error((body && body.message) || ('scan_error_' + status));
    err.status = status;
    err.code = (body && body.errors && body.errors.code) ||
      (body && body.code) || null;
    err.body = body || {};
    return err;
  }

  function postScan(path, payload) {
    return fetch('/api/v1/scan/' + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify(payload || {})
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok || body.success === false) {
          if (res.status === 401 && authMode === 'session') clearSession();
          throw scanError(res.status, body);
        }
        return body;
      });
    });
  }

  // POST /scan/session — mint and store a session (field/partner code flow).
  function mint(bagToken, code) {
    return fetch('/api/v1/scan/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bagToken: bagToken, code: code })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok || body.success === false) throw scanError(res.status, body);
        setSession({
          sessionToken: body.sessionToken,
          actorType: body.actorType,
          expiresAt: body.expiresAt
        });
        return body;
      });
    });
  }

  // POST /scan/resolve — read-only: what would the next scan do?
  function resolve(bagToken) {
    return postScan('resolve', { bagToken: bagToken });
  }

  // POST /scan/apply — apply the confirmed transition. expectedAction REQUIRED.
  function apply(bagToken, expectedAction, opts) {
    var payload = { bagToken: bagToken, expectedAction: expectedAction };
    if (opts && typeof opts.reopen === 'boolean') payload.reopen = opts.reopen;
    if (opts && opts.paymentConfirmed) payload.paymentConfirmed = true;
    return postScan('apply', payload);
  }

  // POST /scan/undo — reverse the last transition for the bag.
  function undo(bagToken) {
    return postScan('undo', { bagToken: bagToken });
  }

  root.ScanSession = {
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    isExpired: isExpired,
    init: init,
    mint: mint,
    resolve: resolve,
    apply: apply,
    undo: undo
  };
})(typeof window !== 'undefined' ? window : this);
