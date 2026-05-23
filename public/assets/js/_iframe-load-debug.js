/* TEMPORARY DIAGNOSTIC — capture what re-loads #wavemax-iframe (double-load bug).
 * Logs every JS src assignment, setAttribute('src'), DOM re-parent (which forces
 * an iframe reload), and load event — each with a stack trace. REMOVE after capture. */
(function () {
  'use strict';
  var TAG = '[IFRAME-DEBUG]';
  function isTarget(n) { return n && n.id === 'wavemax-iframe'; }

  // 1. JS `.src =` assignments
  try {
    var d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      configurable: true,
      get: function () { return d.get.call(this); },
      set: function (v) {
        if (isTarget(this)) console.log(TAG, 'SET .src =', v, '\n' + new Error().stack);
        return d.set.call(this, v);
      }
    });
  } catch (e) { console.log(TAG, 'src-wrap failed:', e.message); }

  // 2. setAttribute('src', ...)
  var sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (isTarget(this) && String(name).toLowerCase() === 'src') {
      console.log(TAG, 'setAttribute(src,', value, ')\n' + new Error().stack);
    }
    return sa.apply(this, arguments);
  };

  // 3. DOM re-parenting / removal (moving an <iframe> in the DOM forces a reload)
  ['appendChild', 'insertBefore', 'replaceChild', 'removeChild'].forEach(function (m) {
    var orig = Node.prototype[m];
    Node.prototype[m] = function () {
      for (var i = 0; i < arguments.length; i++) {
        if (isTarget(arguments[i])) {
          console.log(TAG, m + '(iframe) -> <' + (this.tagName || '?') + ' class="' + (this.className || '') + '">\n' + new Error().stack);
          break;
        }
      }
      return orig.apply(this, arguments);
    };
  });

  // 4. load-event counter (attach ASAP)
  var n = 0, attached = false;
  function attach() {
    var f = document.getElementById('wavemax-iframe');
    if (f && !attached) {
      attached = true;
      f.addEventListener('load', function () {
        n++;
        console.log(TAG, 'LOAD #' + n + ' src=' + f.getAttribute('src') + ' @' + Date.now());
      });
      console.log(TAG, 'attached load listener; initial src=' + f.getAttribute('src'));
    }
  }
  var t = setInterval(function () { attach(); if (attached) clearInterval(t); }, 20);
  document.addEventListener('DOMContentLoaded', attach);
})();
