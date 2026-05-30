/* WaveMAX Design Explorer — shell controller (external, CSP-clean).
   Builds controls from render/manifest.json (never hardcodes the state list),
   drives the preview iframe, and renders review notes from rationale.json.
   The ?k token is carried on every fetch / iframe src; the explorer_k cookie
   the guard sets also covers sub-resources. */
(function () {
  'use strict';

  // Carry whatever query string we were opened with (the ?k token) onto every
  // guarded sub-resource request.
  var SEARCH = window.location.search || '';

  var PAGE_LABELS = {
    'home': 'Home',
    'self-serve': 'Self-Serve',
    'wash-dry-fold': 'Wash · Dry · Fold',
    'commercial': 'Commercial',
    'about': 'About',
    'contact': 'Contact'
  };
  var INTENSITY_LABELS = { heavy: 'Brand-Heavy', light: 'Brand-Light' };
  var LANG_LABELS = { en: 'EN', es: 'ES' };
  var DEVICE_LABELS = { desktop: 'Desktop', mobile: 'Mobile' };

  var state = { skin: null, intensity: null, page: null, lang: null, device: 'desktop' };
  var manifest = null;
  var rationale = { skins: {} };

  // ---- helpers ----------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }
  function titleCase(s) {
    return String(s).split('-').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }
  function skinLabel(skin) {
    return (rationale.skins[skin] && rationale.skins[skin].label) || titleCase(skin);
  }

  function showFallback(msg) {
    var fb = $('fallback');
    if (msg) { $('fallbackMsg').textContent = msg; }
    $('app').hidden = true;
    fb.hidden = false;
  }

  // ---- control rendering -------------------------------------------------
  // Renders a segmented row of <button aria-pressed> controls into `host`.
  function renderSeg(host, values, labelFn, current, onPick) {
    host.innerHTML = '';
    values.forEach(function (val) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg__btn';
      b.textContent = labelFn(val);
      b.setAttribute('aria-pressed', String(val === current));
      b.addEventListener('click', function () { onPick(val); });
      host.appendChild(b);
    });
  }

  // Re-syncs aria-pressed on an already-rendered row.
  function syncPressed(host, current) {
    var btns = host.querySelectorAll('.seg__btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.val === current));
    });
  }

  // Build all control rows from the manifest.
  function buildControls() {
    var states = manifest.states;
    var skins = uniq(states.map(function (s) { return s.skin; }));
    var intensities = uniq(states.map(function (s) { return s.intensity; }));
    var pages = uniq(states.map(function (s) { return s.page; }));
    var langs = uniq(states.map(function (s) { return s.lang; }));

    renderSeg($('ctl-direction'), skins, skinLabel, state.skin, function (v) {
      state.skin = v; reconcile(); apply();
    });
    renderSeg($('ctl-intensity'), intensities, function (v) {
      return INTENSITY_LABELS[v] || titleCase(v);
    }, state.intensity, function (v) { state.intensity = v; reconcile(); apply(); });
    renderSeg($('ctl-page'), pages, function (v) {
      return PAGE_LABELS[v] || titleCase(v);
    }, state.page, function (v) { state.page = v; reconcile(); apply(); });
    renderSeg($('ctl-lang'), langs, function (v) {
      return LANG_LABELS[v] || v.toUpperCase();
    }, state.lang, function (v) { state.lang = v; reconcile(); apply(); });
    renderSeg($('ctl-device'), ['desktop', 'mobile'], function (v) {
      return DEVICE_LABELS[v];
    }, state.device, function (v) { state.device = v; apply(); });

    // tag buttons with their value so syncPressed can find the active one
    tagButtons('ctl-direction', skins);
    tagButtons('ctl-intensity', intensities);
    tagButtons('ctl-page', pages);
    tagButtons('ctl-lang', langs);
    tagButtons('ctl-device', ['desktop', 'mobile']);
  }

  function tagButtons(id, values) {
    var btns = $(id).querySelectorAll('.seg__btn');
    Array.prototype.forEach.call(btns, function (b, i) { b.dataset.val = values[i]; });
  }

  // ---- state reconciliation ---------------------------------------------
  // After a change, make sure the current selection corresponds to a real
  // state; if not, fall back to the nearest available value.
  function findState() {
    return manifest.states.filter(function (s) {
      return s.skin === state.skin && s.intensity === state.intensity &&
             s.page === state.page && s.lang === state.lang;
    })[0];
  }

  function reconcile() {
    if (findState()) return;
    // Narrow progressively: keep skin, then find any matching combo.
    var pool = manifest.states.filter(function (s) { return s.skin === state.skin; });
    if (!pool.length) { pool = manifest.states; state.skin = pool[0].skin; }
    var byInt = pool.filter(function (s) { return s.intensity === state.intensity; });
    if (!byInt.length) { state.intensity = pool[0].intensity; byInt = pool.filter(function (s) { return s.intensity === state.intensity; }); }
    var byPage = byInt.filter(function (s) { return s.page === state.page; });
    if (!byPage.length) { state.page = byInt[0].page; byPage = byInt.filter(function (s) { return s.page === state.page; }); }
    var byLang = byPage.filter(function (s) { return s.lang === state.lang; });
    if (!byLang.length) { state.lang = byPage[0].lang; }
  }

  // ---- apply (re-render preview + labels + notes) -----------------------
  function apply() {
    var match = findState();
    if (!match) { reconcile(); match = findState(); }
    if (!match) { showFallback('No matching design state was found.'); return; }

    // preview iframe
    var src = 'render/' + match.file + SEARCH;
    var iframe = $('preview');
    if (iframe.getAttribute('src') !== src) { iframe.setAttribute('src', src); }

    // device frame
    $('device').setAttribute('data-device', state.device);

    // sync controls
    syncPressed($('ctl-direction'), state.skin);
    syncPressed($('ctl-intensity'), state.intensity);
    syncPressed($('ctl-page'), state.page);
    syncPressed($('ctl-lang'), state.lang);
    syncPressed($('ctl-device'), state.device);

    // state label
    $('statelabel').innerHTML = [
      skinLabel(state.skin),
      INTENSITY_LABELS[state.intensity] || titleCase(state.intensity),
      PAGE_LABELS[state.page] || titleCase(state.page),
      (LANG_LABELS[state.lang] || state.lang.toUpperCase()),
      DEVICE_LABELS[state.device]
    ].map(function (t) { return escapeHtml(t); }).join('<span class="sep">·</span>');

    renderNotes();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- review notes ------------------------------------------------------
  function renderNotes() {
    var body = $('notesBody');
    body.innerHTML = '';
    var skin = rationale.skins[state.skin];
    if (!skin) {
      body.appendChild(noteEl('Notes', 'No review notes are available for this direction yet.', 'note--summary'));
      $('notesDirection').textContent = skinLabel(state.skin);
      return;
    }
    var intensity = (skin.intensities && skin.intensities[state.intensity]) || {};

    $('notesDirection').textContent =
      skinLabel(state.skin) + ' · ' + (intensity.label || titleCase(state.intensity));

    if (skin.summary) {
      body.appendChild(noteEl('Direction', skin.summary, 'note--summary'));
    }
    var fields = [
      ['This intensity', intensity.direction],
      ['Brand treatment', intensity.brandTreatment],
      ['§12.2 notice', intensity.noticeLocation],
      ['vs. corporate site', intensity.differsFromCorporate],
      ['Conversion', intensity.conversionNote],
      ['Performance', intensity.performanceNote],
      ['This page', intensity.pages && intensity.pages[state.page]]
    ];
    fields.forEach(function (f) {
      if (f[1]) { body.appendChild(noteEl(f[0], f[1])); }
    });
  }

  function noteEl(title, text, extraClass) {
    var d = document.createElement('div');
    d.className = 'note' + (extraClass ? ' ' + extraClass : '');
    var h = document.createElement('h3'); h.textContent = title;
    var p = document.createElement('p'); p.textContent = text;
    d.appendChild(h); d.appendChild(p);
    return d;
  }

  // ---- notes collapse ----------------------------------------------------
  function wireNotesToggle() {
    var notes = $('notes');
    $('notesToggle').addEventListener('click', function () {
      var open = notes.getAttribute('data-open') !== 'true';
      notes.setAttribute('data-open', String(open));
      this.setAttribute('aria-expanded', String(open));
    });
  }

  // ---- defaults ----------------------------------------------------------
  function pickDefaults() {
    var has = function (skin, intensity, page, lang) {
      return manifest.states.some(function (s) {
        return s.skin === skin && s.intensity === intensity && s.page === page && s.lang === lang;
      });
    };
    state.skin = 'service-os';
    state.intensity = 'heavy';
    state.page = 'home';
    state.lang = 'en';
    state.device = 'desktop';
    if (!has(state.skin, state.intensity, state.page, state.lang)) {
      // fall back to the first state in the manifest
      var s0 = manifest.states[0];
      state.skin = s0.skin; state.intensity = s0.intensity; state.page = s0.page; state.lang = s0.lang;
    }
  }

  // ---- boot --------------------------------------------------------------
  function boot() {
    Promise.all([
      fetch('render/manifest.json' + SEARCH, { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); }),
      fetch('rationale.json' + SEARCH, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { skins: {} }; })
        .catch(function () { return { skins: {} }; })
    ]).then(function (res) {
      manifest = res[0];
      rationale = res[1] || { skins: {} };
      if (!manifest || !Array.isArray(manifest.states) || !manifest.states.length) {
        showFallback('The design manifest is empty. Run the build, then reload.');
        return;
      }
      $('app').hidden = false;
      pickDefaults();
      buildControls();
      wireNotesToggle();
      apply();
    }).catch(function (err) {
      showFallback('Could not load the design states (' + err.message +
        '). This tool needs a valid access link with a ?k= token.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
