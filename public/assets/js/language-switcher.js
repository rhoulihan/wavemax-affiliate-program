/**
 * Language Switcher Component for WaveMAX
 * Creates a dropdown UI for language selection
 */

(function(window) {
  'use strict';

  const LanguageSwitcher = {
    /**
         * Create language switcher HTML
         */
    createSwitcher(containerId, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`Container with id '${containerId}' not found`);
        return;
      }

      const config = {
        position: 'top-right',
        style: 'dropdown', // dropdown or flags
        showLabel: true,
        ...options
      };

      const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'pt', name: 'Português', flag: '🇧🇷' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
      ];

      const currentLang = window.i18n ? window.i18n.getLanguage() : 'en';

      if (config.style === 'dropdown') {
        this.createDropdown(container, languages, currentLang, config);
      } else {
        this.createFlags(container, languages, currentLang, config);
      }
    },

    /**
         * Create dropdown style switcher
         */
    createDropdown(container, languages, currentLang, config) {
      const currentLanguage = languages.find(lang => lang.code === currentLang) || languages[0];

      const html = `
                <div class="language-switcher dropdown">
                    <button class="language-switcher-toggle" type="button" data-toggle="dropdown" aria-expanded="false">
                        <span class="language-flag">${currentLanguage.flag}</span>
                        ${config.showLabel ? `<span class="language-name">${currentLanguage.name}</span>` : ''}
                        <span class="dropdown-arrow">▼</span>
                    </button>
                    <div class="language-dropdown-menu">
                        ${languages.map(lang => `
                            <a href="#" class="language-option ${lang.code === currentLang ? 'active' : ''}" 
                               data-lang="${lang.code}">
                                <span class="language-flag">${lang.flag}</span>
                                <span class="language-name">${lang.name}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;

      container.innerHTML = html;
      this.attachDropdownEvents(container);
    },

    /**
         * Create flag style switcher
         */
    createFlags(container, languages, currentLang, config) {
      const html = `
                <div class="language-switcher flags">
                    ${languages.map(lang => `
                        <button class="language-flag-button ${lang.code === currentLang ? 'active' : ''}" 
                                data-lang="${lang.code}"
                                title="${lang.name}">
                            <span class="language-flag">${lang.flag}</span>
                            ${config.showLabel ? `<span class="language-name">${lang.name}</span>` : ''}
                        </button>
                    `).join('')}
                </div>
            `;

      container.innerHTML = html;
      this.attachFlagEvents(container);
    },

    /**
         * Attach events for dropdown
         */
    attachDropdownEvents(container) {
      const toggle = container.querySelector('.language-switcher-toggle');
      const menu = container.querySelector('.language-dropdown-menu');
      const options = container.querySelectorAll('.language-option');

      // Toggle dropdown
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        menu.classList.toggle('show');
        toggle.setAttribute('aria-expanded', menu.classList.contains('show'));
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          menu.classList.remove('show');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });

      // Handle language selection
      options.forEach(option => {
        option.addEventListener('click', (e) => {
          e.preventDefault();
          const lang = option.getAttribute('data-lang');
          this.changeLanguage(lang);
          menu.classList.remove('show');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    },

    /**
         * Attach events for flags
         */
    attachFlagEvents(container) {
      const buttons = container.querySelectorAll('.language-flag-button');

      buttons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const lang = button.getAttribute('data-lang');
          this.changeLanguage(lang);
        });
      });
    },

    /**
         * Change language
         */
    async changeLanguage(lang) {
      if (window.i18n) {
        await window.i18n.setLanguage(lang);

        // Update active state
        document.querySelectorAll('.language-option, .language-flag-button').forEach(el => {
          el.classList.toggle('active', el.getAttribute('data-lang') === lang);
        });

        // Update dropdown toggle if exists
        const toggle = document.querySelector('.language-switcher-toggle');
        if (toggle) {
          const languages = [
            { code: 'en', name: 'English', flag: '🇺🇸' },
            { code: 'es', name: 'Español', flag: '🇪🇸' },
            { code: 'pt', name: 'Português', flag: '🇧🇷' },
            { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
          ];
          const currentLanguage = languages.find(l => l.code === lang);
          if (currentLanguage) {
            const flagSpan = toggle.querySelector('.language-flag');
            const nameSpan = toggle.querySelector('.language-name');
            if (flagSpan) flagSpan.textContent = currentLanguage.flag;
            if (nameSpan) nameSpan.textContent = currentLanguage.name;
          }
        }
      }
    },

    /**
         * Add default styles
         */
    addDefaultStyles() {
      if (document.getElementById('language-switcher-styles')) return;

      const styles = `
                <style id="language-switcher-styles">
                    .language-switcher {
                        position: relative;
                        display: inline-block;
                        font-family: inherit;
                    }

                    .language-switcher-toggle {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 16px;
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.2s;
                    }

                    .language-switcher-toggle:hover {
                        background: #f5f5f5;
                        border-color: #bbb;
                    }

                    .language-flag {
                        font-size: 20px;
                        line-height: 1;
                    }

                    .dropdown-arrow {
                        font-size: 10px;
                        margin-left: 4px;
                        transition: transform 0.2s;
                    }

                    .language-switcher-toggle[aria-expanded="true"] .dropdown-arrow {
                        transform: rotate(180deg);
                    }

                    .language-dropdown-menu {
                        position: absolute;
                        top: 100%;
                        right: 0;
                        margin-top: 4px;
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        display: none;
                        min-width: 150px;
                        z-index: 1000;
                    }

                    .language-dropdown-menu.show {
                        display: block;
                    }

                    .language-option {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 10px 16px;
                        color: #333;
                        text-decoration: none;
                        transition: background 0.2s;
                    }

                    .language-option:hover {
                        background: #f5f5f5;
                    }

                    .language-option.active {
                        background: #e3f2fd;
                        color: #1976d2;
                    }

                    .language-option:first-child {
                        border-radius: 7px 7px 0 0;
                    }

                    .language-option:last-child {
                        border-radius: 0 0 7px 7px;
                    }

                    /* Flag style */
                    .language-switcher.flags {
                        display: flex;
                        gap: 8px;
                    }

                    .language-flag-button {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        padding: 6px 12px;
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .language-flag-button:hover {
                        background: #f5f5f5;
                        border-color: #bbb;
                    }

                    .language-flag-button.active {
                        background: #1976d2;
                        color: white;
                        border-color: #1976d2;
                    }

                    /* Mobile responsive */
                    @media (max-width: 768px) {
                        .language-name {
                            display: none;
                        }
                        
                        .language-option .language-name {
                            display: inline;
                        }
                    }
                </style>
            `;

      document.head.insertAdjacentHTML('beforeend', styles);
    }
  };

  // Auto-add styles
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => LanguageSwitcher.addDefaultStyles());
  } else {
    LanguageSwitcher.addDefaultStyles();
  }

  // Expose to global scope
  window.LanguageSwitcher = LanguageSwitcher;

})(window);