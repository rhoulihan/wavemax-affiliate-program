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
            this.options.container.style.position = 'relative';
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
          // Remove any inline styles that might have been added
          if (this.options.container.style.pointerEvents === 'none') {
            this.options.container.style.pointerEvents = '';
          }
          if (this.options.container.style.opacity === '0.5') {
            this.options.container.style.opacity = '';
          }
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
            form.style.pointerEvents = '';

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
                subEl.style.cssText = 'color: #6b7280; margin-top: 5px; font-size: 14px;';
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
          cancelBtn.style.cssText = 'margin-top: 20px; padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: 600;';
          cancelBtn.onmouseover = () => cancelBtn.style.background = '#b91c1c';
          cancelBtn.onmouseout = () => cancelBtn.style.background = '#dc2626';

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
                subEl.style.cssText = 'color: #6b7280; margin-top: 5px; font-size: 14px;';
                subEl.textContent = submessage;
                messageEl.parentNode.appendChild(subEl);
              }
            }
            return this;
          }
        };
      }
    };

    // Add CSS styles dynamically
    function injectStyles() {
      if (document.getElementById('swirl-spinner-styles')) {
        return;
      }

      const styles = `
            .swirl-spinner {
                width: 80px;
                height: 80px;
                display: inline-block;
                position: relative;
            }

            .swirl-spinner svg {
                width: 100%;
                height: 100%;
            }

            /* Animate dots along elliptical path */
            .swirl-dot1 {
                animation: swirl-ellipticalOrbit1 2s linear infinite;
            }

            .swirl-dot2 {
                animation: swirl-ellipticalOrbit2 2s linear infinite;
            }

            .swirl-dot3 {
                animation: swirl-ellipticalOrbit3 2s linear infinite;
            }

            .swirl-dot4 {
                animation: swirl-ellipticalOrbit4 2s linear infinite;
            }

            @keyframes swirl-ellipticalOrbit1 {
                0% {
                    transform: translate(0px, 0px);
                }
                25% {
                    transform: translate(20px, -8px);
                }
                50% {
                    transform: translate(0px, -16px);
                }
                75% {
                    transform: translate(-20px, -8px);
                }
                100% {
                    transform: translate(0px, 0px);
                }
            }

            @keyframes swirl-ellipticalOrbit2 {
                0% {
                    transform: translate(0px, -16px);
                }
                25% {
                    transform: translate(-20px, -8px);
                }
                50% {
                    transform: translate(0px, 0px);
                }
                75% {
                    transform: translate(20px, -8px);
                }
                100% {
                    transform: translate(0px, -16px);
                }
            }

            @keyframes swirl-ellipticalOrbit3 {
                0% {
                    transform: translate(0px, 0px);
                }
                25% {
                    transform: translate(20px, 8px);
                }
                50% {
                    transform: translate(0px, 16px);
                }
                75% {
                    transform: translate(-20px, 8px);
                }
                100% {
                    transform: translate(0px, 0px);
                }
            }

            @keyframes swirl-ellipticalOrbit4 {
                0% {
                    transform: translate(0px, 16px);
                }
                25% {
                    transform: translate(-20px, 8px);
                }
                50% {
                    transform: translate(0px, 0px);
                }
                75% {
                    transform: translate(20px, 8px);
                }
                100% {
                    transform: translate(0px, 16px);
                }
            }

            .spinner-small {
                width: 40px;
                height: 40px;
            }

            .spinner-large {
                width: 120px;
                height: 120px;
            }

            /* Speed variations */
            .swirl-spinner-smooth .swirl-dot1 {
                animation: swirl-ellipticalOrbit1 3s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
            }
            .swirl-spinner-smooth .swirl-dot2 {
                animation: swirl-ellipticalOrbit2 3s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
            }
            .swirl-spinner-smooth .swirl-dot3 {
                animation: swirl-ellipticalOrbit3 3s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
            }
            .swirl-spinner-smooth .swirl-dot4 {
                animation: swirl-ellipticalOrbit4 3s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
            }

            .swirl-spinner-fast .swirl-dot1 {
                animation: swirl-ellipticalOrbit1 1s linear infinite;
            }
            .swirl-spinner-fast .swirl-dot2 {
                animation: swirl-ellipticalOrbit2 1s linear infinite;
            }
            .swirl-spinner-fast .swirl-dot3 {
                animation: swirl-ellipticalOrbit3 1s linear infinite;
            }
            .swirl-spinner-fast .swirl-dot4 {
                animation: swirl-ellipticalOrbit4 1s linear infinite;
            }

            .swirl-spinner-wrapper {
                display: inline-flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                position: relative;
                z-index: 10000;
            }

            .swirl-spinner-message {
                color: #333;
                font-size: 14px;
                text-align: center;
            }

            .swirl-spinner-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.75);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                border-radius: inherit;
                backdrop-filter: blur(1px);
                -webkit-backdrop-filter: blur(1px);
            }

            .swirl-spinner-global {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }

            .swirl-spinner-global .swirl-spinner-wrapper {
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            }

            /* Integration with buttons */
            button .swirl-spinner {
                width: 1.2em;
                height: 1.2em;
                vertical-align: middle;
            }

            button .swirl-spinner svg {
                vertical-align: top;
            }
        `;

      const styleSheet = document.createElement('style');
      styleSheet.id = 'swirl-spinner-styles';
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    }

    // Initialize styles on load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
      injectStyles();
    }

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