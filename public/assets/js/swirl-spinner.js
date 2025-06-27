/**
 * Swirl Spinner Library
 * A reusable animated loading spinner for forms and data fetching
 */

console.log('[SwirlSpinner] Script file loaded');

(function(window) {
  'use strict';

  try {
    console.log('[SwirlSpinner] IIFE starting execution at:', new Date().toISOString());

    // SVG template for the swirl shape with animated dots
    const swirlSVG = `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <!-- Background ovals -->
            <ellipse cx="50" cy="50" rx="48" ry="35" fill="#2563eb" opacity="0.9"/>
            <ellipse cx="50" cy="50" rx="40" ry="28" fill="#3b82f6"/>
            
            <!-- Center swirl design (static) -->
            <path d="M 35 50 Q 50 35, 65 50 Q 60 60, 50 62 Q 40 60, 35 50 Z" fill="#1e40af" opacity="0.6"/>
            
            <!-- Animated dots -->
            <circle class="swirl-dot1" cx="30" cy="45" r="4" fill="white"/>
            <circle class="swirl-dot2" cx="70" cy="45" r="4" fill="white"/>
            <circle class="swirl-dot3" cx="30" cy="55" r="3" fill="white"/>
            <circle class="swirl-dot4" cx="70" cy="55" r="3" fill="white"/>
        </svg>
    `;

    // Spinner class
    class SwirlSpinner {
      constructor(options = {}) {
        this.options = {
          size: options.size || 'default', // 'small', 'default', 'large'
          speed: options.speed || 'normal', // 'smooth', 'normal', 'fast'
          container: options.container || null,
          message: options.message || '',
          overlay: options.overlay || false,
          className: options.className || ''
        };

        this.element = null;
        this.overlayElement = null;
      }

      // Create the spinner element
      create() {
        // Create spinner container
        const spinner = document.createElement('div');
        spinner.className = 'swirl-spinner';
        console.log('[SwirlSpinner] Creating spinner with options:', this.options);

        // Add size class
        if (this.options.size === 'small') {
          spinner.classList.add('spinner-small');
        } else if (this.options.size === 'large') {
          spinner.classList.add('spinner-large');
        }

        // Add speed class
        if (this.options.speed === 'smooth') {
          spinner.classList.add('swirl-spinner-smooth');
        } else if (this.options.speed === 'fast') {
          spinner.classList.add('swirl-spinner-fast');
        }

        // Add custom className
        if (this.options.className) {
          spinner.classList.add(this.options.className);
        }

        // Add SVG
        spinner.innerHTML = swirlSVG;

        // Create wrapper if message is provided
        if (this.options.message) {
          const wrapper = document.createElement('div');
          wrapper.className = 'swirl-spinner-wrapper';
          wrapper.appendChild(spinner);

          const message = document.createElement('div');
          message.className = 'swirl-spinner-message';
          message.textContent = this.options.message;
          wrapper.appendChild(message);

          this.element = wrapper;
        } else {
          this.element = spinner;
        }

        // Create overlay if requested
        if (this.options.overlay && this.options.container) {
          this.overlayElement = document.createElement('div');
          this.overlayElement.className = 'swirl-spinner-overlay';
          this.overlayElement.appendChild(this.element);

          // Make container relative if not already
          const position = window.getComputedStyle(this.options.container).position;
          if (position === 'static') {
            this.options.container.classList.add('swirl-spinner-relative');
          }
        }

        return this;
      }

      // Show the spinner
      show() {
        if (!this.element) {
          this.create();
        }

        if (this.options.overlay && this.overlayElement) {
          this.options.container.appendChild(this.overlayElement);
        } else if (this.options.container) {
          this.options.container.appendChild(this.element);
        }

        return this;
      }

      // Hide the spinner
      hide() {
        if (this.overlayElement && this.overlayElement.parentNode) {
          this.overlayElement.parentNode.removeChild(this.overlayElement);
        } else if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }

        // Clean up any style changes on container
        if (this.options.container) {
          // Remove any classes that might have been added
          this.options.container.classList.remove('swirl-spinner-relative');
          this.options.container.classList.remove('swirl-spinner-form-disabled');
        }

        return this;
      }

      // Update message
      updateMessage(message) {
        const messageEl = this.element.querySelector('.swirl-spinner-message');
        if (messageEl) {
          messageEl.textContent = message;
        }
        return this;
      }

      // Destroy the spinner
      destroy() {
        this.hide();
        this.element = null;
        this.overlayElement = null;
      }
    }

    // Utility functions for common use cases
    const SwirlSpinnerUtils = {
      // Show spinner on a button
      showOnButton(button, options = {}) {
        const originalContent = button.innerHTML;
        const originalDisabled = button.disabled;

        button.disabled = true;
        button.innerHTML = '';

        const spinner = new SwirlSpinner({
          size: 'small',
          speed: 'fast',
          container: button,
          ...options
        }).show();

        return {
          hide: () => {
            spinner.hide();
            button.innerHTML = originalContent;
            button.disabled = originalDisabled;
          }
        };
      },

      // Show spinner on a form
      showOnForm(form, options = {}) {
        const spinner = new SwirlSpinner({
          container: form,
          overlay: true,
          ...options
        }).show();

        // Track and disable form inputs
        const inputs = form.querySelectorAll('input, select, textarea, button');
        const disabledStates = [];

        inputs.forEach((input, index) => {
          // Store the current disabled state BEFORE disabling
          disabledStates[index] = input.disabled;
          input.disabled = true;
        });

        return {
          hide: () => {
            spinner.hide();

            // Re-enable form inputs based on their original state
            inputs.forEach((input, index) => {
              // Only re-enable if it wasn't originally disabled
              if (!disabledStates[index]) {
                input.disabled = false;
              }
            });

            // Also remove any pointer-events restrictions
            form.classList.remove('swirl-spinner-form-disabled');

            // Clean up any lingering overlay elements
            const overlays = form.querySelectorAll('.swirl-spinner-overlay');
            overlays.forEach(overlay => overlay.remove());

            console.log('[SwirlSpinner] Form controls re-enabled after hide');
          },

          updateMessage: (message, submessage) => {
            spinner.updateMessage(message);
            if (submessage) {
              const messageEl = spinner.element?.querySelector('.swirl-spinner-message');
              if (messageEl && messageEl.nextSibling?.tagName !== 'P') {
                const subEl = document.createElement('p');
                subEl.className = 'swirl-spinner-submessage';
                subEl.textContent = submessage;
                messageEl.parentNode.appendChild(subEl);
              }
            }
            return this;
          }
        };
      },

      // Show global spinner
      showGlobal(options = {}) {
        const container = document.createElement('div');
        container.className = 'swirl-spinner-global';
        document.body.appendChild(container);

        const spinner = new SwirlSpinner({
          container: container,
          size: 'large',
          pulse: true,
          ...options
        }).show();

        // Add cancel button if requested
        if (options.showCancelButton) {
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel Payment';
          cancelBtn.className = 'swirl-spinner-cancel-btn';

          if (options.onCancel) {
            cancelBtn.onclick = options.onCancel;
          }

          // Find the wrapper and add button
          const wrapper = container.querySelector('.swirl-spinner-wrapper');
          if (wrapper) {
            wrapper.appendChild(cancelBtn);
          } else {
            // If no wrapper, add directly to spinner element's parent
            spinner.element.parentNode.appendChild(cancelBtn);
          }
        }

        return {
          hide: () => {
            spinner.hide();
            if (container.parentNode) {
              container.parentNode.removeChild(container);
            }
          },
          updateMessage: (message, submessage) => {
            spinner.updateMessage(message);
            if (submessage) {
              const messageEl = spinner.element?.querySelector('.swirl-spinner-message');
              if (messageEl && messageEl.nextSibling?.tagName !== 'P') {
                const subEl = document.createElement('p');
                subEl.className = 'swirl-spinner-submessage';
                subEl.textContent = submessage;
                messageEl.parentNode.appendChild(subEl);
              }
            }
            return this;
          }
        };
      }
    };

    // Note: Styles are now loaded via external CSS file to comply with CSP
    // The swirl-spinner.css file must be included in the HTML

    // Export to window
    window.SwirlSpinner = SwirlSpinner;
    window.SwirlSpinnerUtils = SwirlSpinnerUtils;

    // Debug logging
    console.log('[SwirlSpinner] Library loaded at:', new Date().toISOString());
    console.log('[SwirlSpinner] Document readyState:', document.readyState);
    console.log('[SwirlSpinner] SwirlSpinner class available:', !!window.SwirlSpinner);
    console.log('[SwirlSpinner] SwirlSpinnerUtils available:', !!window.SwirlSpinnerUtils);

  } catch (error) {
    console.error('[SwirlSpinner] Error loading library:', error);
  }

})(typeof window !== 'undefined' ? window : this);