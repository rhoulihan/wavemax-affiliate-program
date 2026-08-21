/* Load-order demonstration (CSP-safe, no external deps, no eval).
 *
 * Faithfully re-creates the WaveMAX franchise-recruitment page's real, verified bug
 * (captured live 2026-08-21):
 *   - Line 18 (page <head>) installs a PLACEHOLDER "$"/jQuery stub — a speed/"delay
 *     JavaScript" trick. The stub only queues calls and defines NO real methods
 *     (no .on, .ajax, .click…). Its `let $` also lexically shadows the real jQuery.
 *   - The page then loads the REAL jQuery three times (3.6.4 @1926, 3.7.1 @4756,
 *     migrate @4757).
 *   - The page's own inline code (line 2566) runs `$('#formLaundry').on('submit',…)`.
 *     Because `$` resolves to the STUB, `.on` does not exist → the browser throws
 *     `$(...).on is not a function` on every load. Menu-close + form-submit handlers
 *     never attach. The real jQuery loading afterward is too late.
 *
 * This models exactly that: whether the mock page's controls are "bound" depends on
 * whether the page's code ran against the placeholder (broken) or the real jQuery
 * (correct). Break, then re-enable.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var state = { bound: false, running: false, ranPlatform: false, ranCorrect: false };
  var statusEl = $('status'), stageEl = document.querySelector('.stage'), explainEl = $('explain'), hintEl = $('run-hint'), tryEl = $('try-prompt');
  function reveal(el) { if (el) { el.hidden = false; } }
  function hide(el) { if (el) { el.hidden = true; } }
  function revealStage() { hide(hintEl); reveal(statusEl); reveal(stageEl); }
  // Static, developer-authored strings only (no user input) → innerHTML is safe here.
  function showTry(kind, html) { if (!tryEl) { return; } tryEl.className = 'try-prompt ' + kind; tryEl.innerHTML = html; reveal(tryEl); }

  var menu = $('menu'), stuck = $('stuck'), toast = $('toast');
  var chipMenu = $('chip-menu'), chipForm = $('chip-form');
  var consoleEl = $('console');
  var tiles = {
    a: document.querySelector('[data-tile="a"]'), // placeholder stub
    b: document.querySelector('[data-tile="b"]'), // the page's own code
    c: document.querySelector('[data-tile="c"]')  // the real jQuery (x3)
  };
  var cVdefault = tiles.c.querySelector('.v').textContent;
  var aVdefault = tiles.a.querySelector('.v').textContent;

  function log(text, cls) {
    var p = document.createElement('p');
    p.className = 'line' + (cls ? ' ' + cls : '');
    p.textContent = text;
    consoleEl.appendChild(p);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
  function clearConsole() { consoleEl.textContent = ''; }

  function clearTiles() {
    ['a', 'b', 'c'].forEach(function (k) {
      tiles[k].classList.remove('loading', 'ran', 'crashed');
      var b = tiles[k].querySelector('.badge');
      if (b) { b.remove(); }
    });
    tiles.c.querySelector('.v').textContent = cVdefault;
    tiles.a.querySelector('.v').textContent = aVdefault;
  }
  function badge(tile, txt, kind) {
    var b = tile.querySelector('.badge');
    if (!b) { b = document.createElement('span'); b.className = 'badge'; tile.appendChild(b); }
    b.className = 'badge ' + kind;
    b.textContent = txt;
  }

  function setChips() {
    chipMenu.className = 'chip ' + (state.bound ? 'live' : 'dead');
    chipMenu.textContent = 'Menu close button: ' + (state.bound ? '✓ working' : '✗ dead (handler never attached)');
    chipForm.className = 'chip ' + (state.bound ? 'live' : 'dead');
    chipForm.textContent = 'Form submit: ' + (state.bound ? '✓ working' : '✗ dead (handler never attached)');
  }
  function resetChipsNeutral() {
    chipMenu.className = 'chip'; chipMenu.textContent = 'Menu close button: — not run yet';
    chipForm.className = 'chip'; chipForm.textContent = 'Form submit: — not run yet';
  }

  function openMenu() { menu.classList.add('open'); }
  function closeMenu() { menu.classList.remove('open'); stuck.classList.remove('show'); }
  function hideToast() { toast.className = 'toast'; toast.textContent = ''; }

  // ---- mock page controls: behave based on state.bound ----
  $('hamb').addEventListener('click', function () {
    if (menu.classList.contains('open')) {
      if (state.bound) { closeMenu(); } else { stuck.classList.add('show'); }
    } else {
      openMenu();
    }
  });
  $('menu-close').addEventListener('click', function () {
    if (state.bound) { closeMenu(); }
    else { stuck.classList.add('show'); }
  });
  $('f-submit').addEventListener('click', function () {
    hideToast();
    if (state.bound) {
      toast.className = 'toast good';
      toast.textContent = '✓ Thanks — your request was submitted.';
    } else {
      toast.className = 'toast dead';
      toast.textContent = 'Nothing happens. The submit handler was never attached, so the button is inert.';
    }
  });

  function afterReset() { clearTiles(); hideToast(); closeMenu(); }
  function maybeShowExplain() { if (state.ranPlatform && state.ranCorrect) { reveal(explainEl); } }

  // ---- BROKEN: placeholder stub → page code crashes on it → real jQuery too late ----
  function runPlatform() {
    if (state.running) { return; }
    state.running = true; state.bound = false; state.ranPlatform = true;
    revealStage();
    afterReset(); clearConsole(); resetChipsNeutral();
    log('// Loading scripts in the platform’s actual order…', 'dim');

    step([
      [300, function () { tiles.a.classList.add('loading'); log('› installing the placeholder “$” stub (speed trick, line 18) — a stand-in with no real methods…'); }],
      [750, function () { tiles.a.classList.remove('loading'); tiles.a.classList.add('ran'); badge(tiles.a, 'installed', 'ok'); }],
      [300, function () { tiles.b.classList.add('loading'); log('› running the page’s own code (line 2566): $(\'#formLaundry\').on(\'submit\', …)'); }],
      [750, function () {
        tiles.b.classList.remove('loading'); tiles.b.classList.add('crashed'); badge(tiles.b, 'crashed', 'err');
        log('Uncaught TypeError: $(...).on is not a function', 'err');
        log('    at become-a-franchisee:2566', 'err');
        log('  → $ was the placeholder stub, which has no .on(); the menu-close and form-submit handlers never attached.', 'err');
      }],
      [300, function () { tiles.c.classList.add('loading'); log('› the real jQuery loads now (3.6.4 + 3.7.1 + migrate)… too late — the code already ran against the placeholder.', 'dim'); }],
      [750, function () { tiles.c.classList.remove('loading'); tiles.c.classList.add('ran'); badge(tiles.c, 'loaded', 'ok'); }],
      [250, function () {
        setChips();
        openMenu();
        log('// Result: menu opens but won’t close; form does nothing. Try them →', 'dim');
        showTry('broken', '<span class="big">👉</span> Now try the controls below — with the crash above still showing. Click <strong>✕ Close</strong> on the open menu, then click <strong>Request Information</strong>. <strong>Nothing happens.</strong> Those buttons were never wired up, because the code that would have wired them crashed. That is the bug a real visitor hits on every page load.');
        maybeShowExplain();
        state.running = false;
      }]
    ]);
  }

  // ---- CORRECT: real jQuery in place first, no placeholder → page code works ----
  function runCorrect() {
    if (state.running) { return; }
    state.running = true; state.bound = true; state.ranCorrect = true;
    revealStage();
    afterReset(); clearConsole(); resetChipsNeutral();
    log('// Loading scripts in a correct order…', 'dim');

    step([
      [300, function () { tiles.c.classList.add('loading'); log('› the real jQuery is in place first — nothing shadowing $…'); }],
      [800, function () {
        tiles.c.classList.remove('loading'); tiles.c.classList.add('ran'); badge(tiles.c, 'loaded', 'ok');
        tiles.a.querySelector('.v').textContent = 'not installed — no stand-in in front of the real library';
        badge(tiles.a, 'not used', 'ok');
      }],
      [300, function () { tiles.b.classList.add('loading'); log('› now running the page’s own code: $(\'#formLaundry\').on(\'submit\', …) — $ is the real jQuery'); }],
      [800, function () {
        tiles.b.classList.remove('loading'); tiles.b.classList.add('ran'); badge(tiles.b, 'ran ✓', 'ok');
        log('✓ handlers bound: menu close, form submit', 'ok');
      }],
      [250, function () {
        setChips();
        log('// Result: the close button and the form both work. Try them →', 'ok');
        showTry('working', '<span class="big">👉</span> Now try the same controls again. <strong>✕ Close</strong> closes the menu, and <strong>Request Information</strong> submits. Same page, same buttons — working this time, because the code ran against the real jQuery instead of the placeholder.');
        maybeShowExplain();
        state.running = false;
      }]
    ]);
  }

  function step(seq) {
    var i = 0;
    function next() {
      if (i >= seq.length) { return; }
      var item = seq[i++];
      setTimeout(function () { item[1](); next(); }, item[0]);
    }
    next();
  }

  function reset() {
    if (state.running) { return; }
    state.bound = false; state.ranPlatform = false; state.ranCorrect = false;
    afterReset();
    clearConsole();
    log('// Press a button above. This panel shows what the browser reports while the scripts load.', 'dim');
    resetChipsNeutral();
    hide(statusEl); hide(stageEl); hide(explainEl); hide(tryEl); reveal(hintEl);
  }

  $('run-platform').addEventListener('click', runPlatform);
  $('run-correct').addEventListener('click', runCorrect);
  $('reset').addEventListener('click', reset);
})();
