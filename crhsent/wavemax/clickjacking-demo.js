/* Clickjacking-demo interactivity
 *
 * Reveal sequence:
 *   1. Page loads. Watermark visible immediately. Iframe begins loading
 *      the real WaveMAX Austin page. Fake button is hidden. Arrow is hidden.
 *   2. After ~600ms: intro modal opens, explaining what's about to happen.
 *   3. User dismisses intro -> add-button modal opens, narrating that the
 *      attacker is about to inject the bait.
 *   4. User dismisses add-button modal -> the fake "Schedule a Pickup" button
 *      reveals with a fade-in + light scale animation (~550ms via CSS).
 *   5. Once the button is in place (after the reveal animation), the click
 *      arrow appears and pulses to attract the click.
 *   6. User clicks the button -> attack modal explains the takeover, offers
 *      "See proper security" (switches to the rundberg tab) or "Close".
 *   7. Rundberg tab attempts to load rundberglaundry.com — browser blocks
 *      via X-Frame-Options + CSP frame-ancestors, and our protected-overlay
 *      panel renders on top with the explanation.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var introModal      = $('intro-modal');
  var addbuttonModal  = $('addbutton-modal');
  var attackModal     = $('attack-modal');
  var dismissIntro    = $('dismiss-intro');
  var addButtonBtn    = $('add-button-btn');
  var dismissAttack   = $('dismiss-attack');
  var showProtected   = $('show-protected-btn');
  var pickupBtnWrap   = document.querySelector('.fake-button-overlay');
  var pickupBtn       = $('schedule-pickup-btn');
  var clickArrow      = $('click-arrow');

  var stageVulnerable = $('stage-vulnerable');
  var stageProtected  = $('stage-protected');
  var tabVulnerable   = document.querySelector('.tab-vulnerable');
  var tabProtected    = document.querySelector('.tab-protected');
  var protectedFrame  = $('protected-frame');

  // Modal helpers
  function openModal(el) {
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    var firstBtn = el.querySelector('button');
    if (firstBtn) { try { firstBtn.focus(); } catch (e) { /* ignore */ } }
  }
  function closeModal(el) {
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
  }

  // 1+2. On load, show intro modal after a brief delay so the iframe
  //      has begun painting and the watermark is visible against content.
  window.addEventListener('load', function () {
    setTimeout(function () { openModal(introModal); }, 600);
  });

  // 3. Intro dismissed -> open the add-button modal (NOT the button reveal yet).
  dismissIntro.addEventListener('click', function () {
    closeModal(introModal);
    setTimeout(function () { openModal(addbuttonModal); }, 220);
  });

  // 4+5. Add-button dismissed -> reveal the button first, then the arrow.
  //      Sequence the arrow ~750ms after the button starts revealing so
  //      the user clearly perceives "button appears, then arrow points to it".
  addButtonBtn.addEventListener('click', function () {
    closeModal(addbuttonModal);
    setTimeout(function () {
      pickupBtnWrap.classList.add('revealed');
      setTimeout(function () { clickArrow.classList.add('revealed'); }, 750);
      // arrow stays visible+pulsing until the user clicks the fake button
      // (the click handler removes .revealed). No auto-fade.
    }, 320);
  });

  // 6. Fake "Schedule a Pickup" -> attack modal
  pickupBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    clickArrow.classList.remove('revealed');
    openModal(attackModal);
  });

  // Attack modal -> "see protected" tab swap
  showProtected.addEventListener('click', function () {
    closeModal(attackModal);
    activateTab('protected');
  });

  // Attack modal -> close
  dismissAttack.addEventListener('click', function () {
    closeModal(attackModal);
  });

  // Close modal on Escape or backdrop click
  [introModal, addbuttonModal, attackModal].forEach(function (m) {
    m.addEventListener('click', function (e) {
      if (e.target === m) closeModal(m);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (introModal.classList.contains('open'))     closeModal(introModal);
      if (addbuttonModal.classList.contains('open')) closeModal(addbuttonModal);
      if (attackModal.classList.contains('open'))    closeModal(attackModal);
    }
  });

  // Tab switching
  function activateTab(which) {
    if (which === 'protected') {
      stageVulnerable.classList.add('hidden');
      stageProtected.classList.remove('hidden');
      tabVulnerable.classList.remove('tab-active');
      tabVulnerable.setAttribute('aria-selected', 'false');
      tabProtected.classList.add('tab-active');
      tabProtected.setAttribute('aria-selected', 'true');
      // Lazy-load the rundberglaundry.com frame — browser will block it
      // (the iframe load event still fires; the visual is a blocked render
      // behind our protected-overlay panel, so the overlay reads cleanly
      // regardless of whether the browser shows its own error or blank).
      if (protectedFrame.getAttribute('src') === 'about:blank') {
        protectedFrame.setAttribute('src', 'https://rundberglaundry.com/');
      }
    } else {
      stageProtected.classList.add('hidden');
      stageVulnerable.classList.remove('hidden');
      tabProtected.classList.remove('tab-active');
      tabProtected.setAttribute('aria-selected', 'false');
      tabVulnerable.classList.add('tab-active');
      tabVulnerable.setAttribute('aria-selected', 'true');
    }
  }
  tabVulnerable.addEventListener('click', function () { activateTab('vulnerable'); });
  tabProtected.addEventListener('click',  function () { activateTab('protected');  });
})();
