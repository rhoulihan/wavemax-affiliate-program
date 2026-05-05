/* faq-accordion.js
 *
 * Lightweight accordion for the FAQ page. Each .wm-fr-q button toggles
 * its sibling .wm-fr-a panel. Uses scrollHeight + max-height transition
 * for smooth open/close; pure CSS would also work but JS lets us close
 * other open items in the same group when one opens.
 */
(function () {
  'use strict';

  function close(panel) {
    panel.style.maxHeight = '0px';
  }
  function open(panel) {
    panel.style.maxHeight = panel.scrollHeight + 'px';
  }

  function init() {
    document.querySelectorAll('.wm-fr-q').forEach((btn) => {
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        const panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (!panel) return;

        if (expanded) {
          btn.setAttribute('aria-expanded', 'false');
          close(panel);
        } else {
          btn.setAttribute('aria-expanded', 'true');
          open(panel);
        }
      });
    });

    // Smooth in-page hash scroll: if the URL has #money etc, scroll past
    // the sticky header.
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
