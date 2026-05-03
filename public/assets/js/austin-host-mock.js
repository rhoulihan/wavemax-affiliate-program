/* Austin host-mock chrome wiring (visual-fidelity rebuild)
 * Drives the chrome of dev/austin-host-mock.html from window.LOCATION_DATA
 * and routes the iframe based on the URL ?route= parameter.
 *
 * Owns:
 *   - data-bind substitutions across header / breadcrumb / footer / modal
 *   - language switcher (en/es/pt/de) — drives the bridge protocol
 *   - location-finder modal open/close (F2 fix: selectable)
 *   - mobile drawer toggle for the wmv3 stack
 *   - active-nav highlight (wmlnav-on)
 *   - iframe route loader
 *
 * Loaded after parent-iframe-bridge-v3.js (which owns the iframe message
 * protocol) so window.WaveMaxBridgeV3 is available here.
 */
(function () {
  'use strict';

  const LANGUAGE_KEY = 'wavemax-language';
  const LANGUAGES = [
    { code: 'en', label: 'English',   short: 'EN', flagClass: 'wm-flag-en' },
    { code: 'es', label: 'Español',   short: 'ES', flagClass: 'wm-flag-es' },
    { code: 'pt', label: 'Português', short: 'PT', flagClass: 'wm-flag-pt' },
    { code: 'de', label: 'Deutsch',   short: 'DE', flagClass: 'wm-flag-de' }
  ];

  function flagSpan(flagClass) {
    const span = document.createElement('span');
    span.className = `wm-lang-flag ${flagClass}`;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  /* Routes we OWN. Map grows as Phase 2/3/4 land. Anything not in the map
   * routes through embed-app-v2 (the existing SPA router). */
  const ROUTE_MAP = {
    '/':                          '/austin-landing-v3-embed.html',
    '/wash-dry-fold':             '/wash-dry-fold-embed.html',
    '/self-serve-laundry':        '/self-serve-laundry-embed.html'
  };

  const ROUTE_BREADCRUMBS = {
    '/':                          'Home',
    '/wash-dry-fold':             'Wash · Dry · Fold',
    '/self-serve-laundry':        'Self-Service Laundry',
    '/commercial':                'Commercial',
    '/commercial/medical-offices':'Medical Offices',
    '/commercial/health-clubs':   'Health Clubs',
    '/commercial/airbnb-rentals': 'Airbnb & Rentals',
    '/about-us':                  'About Us',
    '/contact':                   'Contact'
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /* ---------- data-bind ---------- */

  function applyDataBindings() {
    const data = window.LOCATION_DATA;
    if (!data) return;
    $$('[data-bind]').forEach(el => {
      const path = el.getAttribute('data-bind');
      const value = path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), data);
      if (value === undefined || value === null) return;
      const attr = el.getAttribute('data-bind-attr');
      if (attr) {
        el.setAttribute(attr, String(value));
      } else {
        el.textContent = String(value);
      }
    });
  }

  /* ---------- Language switcher ---------- */

  function initLanguageSwitcher() {
    const root = document.getElementById('wm-lang');
    if (!root) return;
    const btn = root.querySelector('.wm-lang-btn');
    const menu = root.querySelector('.wm-lang-menu');
    if (!btn || !menu) return;

    const available = (window.LOCATION_DATA?.i18n?.languagesAvailable) || ['en', 'es'];
    menu.innerHTML = '';

    LANGUAGES.forEach(lang => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'wm-lang-item';
      item.setAttribute('data-lang', lang.code);

      item.appendChild(flagSpan(lang.flagClass));

      const label = document.createElement('span');
      label.textContent = lang.label;
      item.appendChild(label);

      if (!available.includes(lang.code)) {
        item.classList.add('wm-lang-item--unavailable');
        item.disabled = true;
        item.title = 'Available on iframe-wrapped pages only';
      }
      item.addEventListener('click', () => {
        if (item.disabled) return;
        setLanguage(lang.code);
        closeMenu();
      });
      menu.appendChild(item);
    });

    function openMenu()  { root.setAttribute('aria-expanded', 'true');  menu.style.display = 'block'; }
    function closeMenu() { root.setAttribute('aria-expanded', 'false'); menu.style.display = 'none'; }
    function toggle()    { root.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu(); }

    btn.addEventListener('click', toggle);
    document.addEventListener('click', (e) => { if (!root.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

    refreshActiveLanguage();
  }

  function setLanguage(lang) {
    if (window.WaveMaxBridgeV3?.setLanguage) {
      window.WaveMaxBridgeV3.setLanguage(lang);
    } else {
      localStorage.setItem(LANGUAGE_KEY, lang);
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }
    refreshActiveLanguage();
    applyChromeTranslations(lang);
  }

  function refreshActiveLanguage() {
    const active = localStorage.getItem(LANGUAGE_KEY) || 'en';
    const current = LANGUAGES.find(l => l.code === active) || LANGUAGES[0];

    // Replace the trigger flag with a freshly-built one (cleanest swap;
    // the static markup only contains a placeholder flag).
    const btn = $('#wm-lang .wm-lang-btn');
    if (btn) {
      const oldFlag = btn.querySelector('.wm-lang-flag, .wm-lang-current-flag');
      if (oldFlag) oldFlag.replaceWith(flagSpan(current.flagClass));
    }
    const btnLabel = $('#wm-lang .wm-lang-current-label');
    if (btnLabel) btnLabel.textContent = current.short;

    // Mark the active item in the menu
    $$('#wm-lang .wm-lang-item').forEach(item => {
      item.setAttribute('aria-selected', item.getAttribute('data-lang') === active ? 'true' : 'false');
    });
  }

  /* ---------- Chrome translations — full en/es/pt/de coverage
   *
   * Every visible string in the host chrome is keyed here. Iframe pages
   * carry their own dictionary via iframe-bridge-v2 / per-page init scripts.
   * Note: per the i18n plan, MHR's parent-chrome translation responsibility
   * ends at en+es; pt+de chrome strings are franchisee-supplied via this
   * dictionary. The iframe bridge protocol can also fed them in if MHR ever
   * adopts the contract on their real parent.
   */
  const CHROME_STRINGS = {
    en: {
      'chrome.callUs':            'CALL US',
      'chrome.lastWash':          'LAST WASH',
      'chrome.address':           'VISIT US',
      'chrome.callShort':         'Call',
      'chrome.locations':         'Locations',
      'chrome.franchise':         'Franchise',
      'chrome.findLocation':      'Find a Location',
      'chrome.signIn':            'Sign in',
      'chrome.menu':              'Menu',

      'chrome.nav.home':          'Home',
      'chrome.nav.selfserve':     'Self-Service Laundry',
      'chrome.nav.wdf':           'Wash-Dry-Fold',
      'chrome.nav.commercial':    'Commercial',
      'chrome.nav.about':         'About Us',
      'chrome.nav.contact':       'Contact',

      'chrome.subnav.commercialAll':    'Commercial Laundry',
      'chrome.subnav.medicalOffices':   'Medical Offices Laundry in Austin, TX',
      'chrome.subnav.healthClubs':      'Health Clubs Laundry in Austin, TX',
      'chrome.subnav.airbnbRentals':    'Airbnb & Rentals Laundry in Austin, TX',
      'chrome.subnav.aboutUs':          'About Us',
      'chrome.subnav.contact':          'Contact',

      'chrome.bc.home':           'Home',
      'chrome.bc.locationName':   'WaveMAX Austin, TX',

      'chrome.footer.localLinks': 'Local Links',
      'chrome.footer.contactUs':  'Contact Us',
      'chrome.footer.contactBlurb':'We\'re here to help — choose how you\'d like to connect.',
      'chrome.footer.lookingFor': "I'M LOOKING FOR…",
      'chrome.footer.routeSelect':'— Please select —',
      'chrome.footer.routeLaundry':'Laundry Service',
      'chrome.footer.routeFranchise':'Franchise Information (use franchise site)',
      'chrome.footer.fnPlaceholder':'First name',
      'chrome.footer.lnPlaceholder':'Last name',
      'chrome.footer.phonePlaceholder':'Your phone number',
      'chrome.footer.emailPlaceholder':'Your email',
      'chrome.footer.msgPlaceholder':'How can we help you?',
      'chrome.footer.submit':     'SUBMIT →',
      'chrome.footer.sending':    'SENDING…',
      'chrome.footer.alertOk':    "Thanks — your message has been sent. We'll be in touch shortly.",
      'chrome.footer.alertErr':   "Sorry, that didn't go through. Please try again or call us directly.",

      'chrome.footer.getDirections':'Get Directions',
      'chrome.footer.allLocations': 'All Locations',
      'chrome.footer.privacy':    'Privacy Policy',
      'chrome.footer.terms':      'Terms & Conditions',
      'chrome.footer.refBuild':   'Local-dev reference build (noindex)',
      'chrome.footer.copyright':  '© 2026 CRHS Enterprises, LLC. All rights reserved.',

      'chrome.modal.title':       'Find a Location',
      'chrome.modal.subtitle':    'Choose your store, or search by city / state / zip.',
      'chrome.modal.searchPh':    '🔍  Search by city, state or zip…',
      'chrome.modal.close':       'Close',
      'chrome.modal.detecting':   'Finding locations near you…',
      'chrome.modal.selected':    'Selected',
      'chrome.lastWashShort':     'Last wash'
    },

    es: {
      'chrome.callUs':            'LLÁMANOS',
      'chrome.lastWash':          'ÚLTIMO LAVADO',
      'chrome.address':           'VISÍTANOS',
      'chrome.callShort':         'Llamar',
      'chrome.locations':         'Ubicaciones',
      'chrome.franchise':         'Franquicia',
      'chrome.findLocation':      'Buscar Ubicación',
      'chrome.signIn':            'Iniciar sesión',
      'chrome.menu':              'Menú',

      'chrome.nav.home':          'Inicio',
      'chrome.nav.selfserve':     'Lavandería de Autoservicio',
      'chrome.nav.wdf':           'Lavado · Secado · Doblado',
      'chrome.nav.commercial':    'Comercial',
      'chrome.nav.about':         'Sobre Nosotros',
      'chrome.nav.contact':       'Contacto',

      'chrome.subnav.commercialAll':    'Lavandería Comercial',
      'chrome.subnav.medicalOffices':   'Lavandería para Consultorios Médicos en Austin, TX',
      'chrome.subnav.healthClubs':      'Lavandería para Gimnasios en Austin, TX',
      'chrome.subnav.airbnbRentals':    'Lavandería para Airbnb y Alquileres en Austin, TX',
      'chrome.subnav.aboutUs':          'Sobre Nosotros',
      'chrome.subnav.contact':          'Contacto',

      'chrome.bc.home':           'Inicio',
      'chrome.bc.locationName':   'WaveMAX Austin, TX',

      'chrome.footer.localLinks': 'Enlaces Locales',
      'chrome.footer.contactUs':  'Contáctenos',
      'chrome.footer.contactBlurb':'Estamos aquí para ayudar — elige cómo te gustaría conectarte.',
      'chrome.footer.lookingFor': 'BUSCO…',
      'chrome.footer.routeSelect':'— Por favor seleccione —',
      'chrome.footer.routeLaundry':'Servicio de Lavandería',
      'chrome.footer.routeFranchise':'Información de Franquicia (visitar sitio de franquicia)',
      'chrome.footer.fnPlaceholder':'Nombre',
      'chrome.footer.lnPlaceholder':'Apellido',
      'chrome.footer.phonePlaceholder':'Tu número de teléfono',
      'chrome.footer.emailPlaceholder':'Tu correo electrónico',
      'chrome.footer.msgPlaceholder':'¿Cómo podemos ayudarte?',
      'chrome.footer.submit':     'ENVIAR →',
      'chrome.footer.sending':    'ENVIANDO…',
      'chrome.footer.alertOk':    'Gracias — tu mensaje ha sido enviado. Nos pondremos en contacto pronto.',
      'chrome.footer.alertErr':   'Lo sentimos, no se pudo enviar. Inténtalo de nuevo o llámanos directamente.',

      'chrome.footer.getDirections':'Cómo Llegar',
      'chrome.footer.allLocations': 'Todas las Ubicaciones',
      'chrome.footer.privacy':    'Política de Privacidad',
      'chrome.footer.terms':      'Términos y Condiciones',
      'chrome.footer.refBuild':   'Build de referencia local (noindex)',
      'chrome.footer.copyright':  '© 2026 CRHS Enterprises, LLC. Todos los derechos reservados.',

      'chrome.modal.title':       'Buscar una Ubicación',
      'chrome.modal.subtitle':    'Elige tu tienda, o busca por ciudad / estado / código postal.',
      'chrome.modal.searchPh':    '🔍  Buscar por ciudad, estado o código postal…',
      'chrome.modal.close':       'Cerrar',
      'chrome.modal.detecting':   'Buscando ubicaciones cerca de ti…',
      'chrome.modal.selected':    'Seleccionado',
      'chrome.lastWashShort':     'Último lavado'
    },

    pt: {
      'chrome.callUs':            'LIGUE PARA NÓS',
      'chrome.lastWash':          'ÚLTIMA LAVAGEM',
      'chrome.address':           'VISITE-NOS',
      'chrome.callShort':         'Ligar',
      'chrome.locations':         'Localizações',
      'chrome.franchise':         'Franquia',
      'chrome.findLocation':      'Encontrar Localização',
      'chrome.signIn':            'Entrar',
      'chrome.menu':              'Menu',

      'chrome.nav.home':          'Início',
      'chrome.nav.selfserve':     'Lavanderia de Autoatendimento',
      'chrome.nav.wdf':           'Lavar · Secar · Dobrar',
      'chrome.nav.commercial':    'Comercial',
      'chrome.nav.about':         'Sobre Nós',
      'chrome.nav.contact':       'Contato',

      'chrome.subnav.commercialAll':    'Lavanderia Comercial',
      'chrome.subnav.medicalOffices':   'Lavanderia para Consultórios Médicos em Austin, TX',
      'chrome.subnav.healthClubs':      'Lavanderia para Academias em Austin, TX',
      'chrome.subnav.airbnbRentals':    'Lavanderia para Airbnb e Aluguéis em Austin, TX',
      'chrome.subnav.aboutUs':          'Sobre Nós',
      'chrome.subnav.contact':          'Contato',

      'chrome.bc.home':           'Início',
      'chrome.bc.locationName':   'WaveMAX Austin, TX',

      'chrome.footer.localLinks': 'Links Locais',
      'chrome.footer.contactUs':  'Fale Conosco',
      'chrome.footer.contactBlurb':'Estamos aqui para ajudar — escolha como gostaria de se conectar.',
      'chrome.footer.lookingFor': 'PROCURO POR…',
      'chrome.footer.routeSelect':'— Por favor selecione —',
      'chrome.footer.routeLaundry':'Serviço de Lavanderia',
      'chrome.footer.routeFranchise':'Informações de Franquia (visitar site de franquia)',
      'chrome.footer.fnPlaceholder':'Nome',
      'chrome.footer.lnPlaceholder':'Sobrenome',
      'chrome.footer.phonePlaceholder':'Seu número de telefone',
      'chrome.footer.emailPlaceholder':'Seu email',
      'chrome.footer.msgPlaceholder':'Como podemos ajudar?',
      'chrome.footer.submit':     'ENVIAR →',
      'chrome.footer.sending':    'ENVIANDO…',
      'chrome.footer.alertOk':    'Obrigado — sua mensagem foi enviada. Entraremos em contato em breve.',
      'chrome.footer.alertErr':   'Desculpe, não conseguimos enviar. Tente novamente ou ligue para nós diretamente.',

      'chrome.footer.getDirections':'Ver Direções',
      'chrome.footer.allLocations': 'Todas as Localizações',
      'chrome.footer.privacy':    'Política de Privacidade',
      'chrome.footer.terms':      'Termos e Condições',
      'chrome.footer.refBuild':   'Build de referência local (noindex)',
      'chrome.footer.copyright':  '© 2026 CRHS Enterprises, LLC. Todos os direitos reservados.',

      'chrome.modal.title':       'Encontrar uma Localização',
      'chrome.modal.subtitle':    'Escolha sua loja, ou procure por cidade / estado / cep.',
      'chrome.modal.searchPh':    '🔍  Pesquisar por cidade, estado ou cep…',
      'chrome.modal.close':       'Fechar',
      'chrome.modal.detecting':   'Procurando localizações perto de você…',
      'chrome.modal.selected':    'Selecionado',
      'chrome.lastWashShort':     'Última lavagem'
    },

    de: {
      'chrome.callUs':            'RUFEN SIE UNS AN',
      'chrome.lastWash':          'LETZTE WÄSCHE',
      'chrome.address':           'BESUCHEN SIE UNS',
      'chrome.callShort':         'Anrufen',
      'chrome.locations':         'Standorte',
      'chrome.franchise':         'Franchise',
      'chrome.findLocation':      'Standort finden',
      'chrome.signIn':            'Anmelden',
      'chrome.menu':              'Menü',

      'chrome.nav.home':          'Start',
      'chrome.nav.selfserve':     'Selbstbedienungs-Wäscherei',
      'chrome.nav.wdf':           'Waschen · Trocknen · Falten',
      'chrome.nav.commercial':    'Gewerblich',
      'chrome.nav.about':         'Über uns',
      'chrome.nav.contact':       'Kontakt',

      'chrome.subnav.commercialAll':    'Gewerbliche Wäscherei',
      'chrome.subnav.medicalOffices':   'Wäscherei für Arztpraxen in Austin, TX',
      'chrome.subnav.healthClubs':      'Wäscherei für Fitnessstudios in Austin, TX',
      'chrome.subnav.airbnbRentals':    'Wäscherei für Airbnb & Vermietungen in Austin, TX',
      'chrome.subnav.aboutUs':          'Über uns',
      'chrome.subnav.contact':          'Kontakt',

      'chrome.bc.home':           'Start',
      'chrome.bc.locationName':   'WaveMAX Austin, TX',

      'chrome.footer.localLinks': 'Lokale Links',
      'chrome.footer.contactUs':  'Kontakt',
      'chrome.footer.contactBlurb':'Wir sind hier, um zu helfen — wählen Sie, wie Sie uns kontaktieren möchten.',
      'chrome.footer.lookingFor': 'ICH SUCHE NACH…',
      'chrome.footer.routeSelect':'— Bitte wählen —',
      'chrome.footer.routeLaundry':'Wäschedienst',
      'chrome.footer.routeFranchise':'Franchise-Informationen (Franchise-Seite besuchen)',
      'chrome.footer.fnPlaceholder':'Vorname',
      'chrome.footer.lnPlaceholder':'Nachname',
      'chrome.footer.phonePlaceholder':'Ihre Telefonnummer',
      'chrome.footer.emailPlaceholder':'Ihre E-Mail',
      'chrome.footer.msgPlaceholder':'Wie können wir helfen?',
      'chrome.footer.submit':     'SENDEN →',
      'chrome.footer.sending':    'SENDEN…',
      'chrome.footer.alertOk':    'Vielen Dank — Ihre Nachricht wurde gesendet. Wir melden uns in Kürze.',
      'chrome.footer.alertErr':   'Leider konnte das nicht gesendet werden. Bitte versuchen Sie es erneut oder rufen Sie uns direkt an.',

      'chrome.footer.getDirections':'Wegbeschreibung',
      'chrome.footer.allLocations': 'Alle Standorte',
      'chrome.footer.privacy':    'Datenschutzrichtlinie',
      'chrome.footer.terms':      'Geschäftsbedingungen',
      'chrome.footer.refBuild':   'Lokaler Referenz-Build (noindex)',
      'chrome.footer.copyright':  '© 2026 CRHS Enterprises, LLC. Alle Rechte vorbehalten.',

      'chrome.modal.title':       'Standort finden',
      'chrome.modal.subtitle':    'Wählen Sie Ihren Laden oder suchen Sie nach Stadt / Bundesland / PLZ.',
      'chrome.modal.searchPh':    '🔍  Suche nach Stadt, Bundesland oder PLZ…',
      'chrome.modal.close':       'Schließen',
      'chrome.modal.detecting':   'Standorte in Ihrer Nähe werden gesucht…',
      'chrome.modal.selected':    'Ausgewählt',
      'chrome.lastWashShort':     'Letzte Wäsche'
    }
  };

  function applyChromeTranslations(lang) {
    const dict = CHROME_STRINGS[lang] || CHROME_STRINGS.en;
    $$('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const value = dict[key] || CHROME_STRINGS.en[key];
      if (value === undefined) return;
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = value;
      else el.textContent = value;
    });

    // Translate placeholders / select option text via data-i18n-attr
    $$('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr');
      try {
        const map = JSON.parse(spec);
        Object.keys(map).forEach(attr => {
          const val = dict[map[attr]] || CHROME_STRINGS.en[map[attr]];
          if (val !== undefined) el.setAttribute(attr, val);
        });
      } catch (_) { /* malformed json — skip */ }
    });
  }

  /* ---------- Location modal ---------- */

  function initLocationModal() {
    const overlay = document.getElementById('locModal');
    if (!overlay) return;

    const open = () => {
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      $('#locSearch')?.focus();
    };
    const close = () => {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    };

    $$('[data-locmodal-open]').forEach(t => t.addEventListener('click', open));
    $$('[data-locmodal-close]').forEach(t => t.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') close();
    });

    // Selectable cards (F2a fix)
    $$('.loc-card', overlay).forEach(card => {
      card.addEventListener('click', () => {
        $$('.loc-card', overlay).forEach(c => c.setAttribute('aria-selected', 'false'));
        card.setAttribute('aria-selected', 'true');
        const slug = card.getAttribute('data-loc-slug');
        if (slug && slug !== window.LOCATION_DATA?.slug) {
          // For the demo only one franchisee is wired; cross-franchise routing
          // would happen here when multi-location support lands.
          console.info('[host] location selected:', slug);
        }
        close();
      });
    });

    // Search filter (basic — for demo, only one location)
    const search = $('#locSearch');
    if (search) {
      search.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        $$('.loc-card', overlay).forEach(card => {
          const text = (card.textContent || '').toLowerCase();
          card.style.display = q && !text.includes(q) ? 'none' : '';
        });
      });
    }
  }

  /* ---------- Mobile drawer (wmv3) ---------- */

  function initMobileDrawer() {
    const burger = document.getElementById('wmv3-burger');
    const drawer = document.getElementById('wmv3-drawer');
    if (!burger || !drawer) return;
    burger.addEventListener('click', () => {
      const open = burger.classList.toggle('is-open');
      drawer.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- Active nav state + iframe route ---------- */

  function getActiveRoute() {
    const params = new URLSearchParams(window.location.search);
    return params.get('route') || '/';
  }

  function applyActiveNav(route) {
    $$('a[data-route]').forEach(a => {
      const r = a.getAttribute('data-route');
      const isActive = r === route;
      a.classList.toggle('wmlnav-on', isActive);
      a.classList.toggle('is-active', isActive);
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    // Mark drop parent as active when one of its children matches
    $$('.wmlnav-drop').forEach(drop => {
      const childRoutes = $$('a[data-route]', drop).map(a => a.getAttribute('data-route'));
      const isActiveChild = childRoutes.some(r => r === route);
      drop.classList.toggle('wmlnav-on', isActiveChild);
    });

    // Breadcrumb removed — no per-route label update needed.
  }

  function loadIframeRoute(route) {
    const iframe = document.getElementById('wavemax-iframe');
    if (!iframe) return;
    const direct = ROUTE_MAP[route];
    iframe.src = direct || `/embed-app-v2.html?route=${encodeURIComponent(route)}`;
  }

  /* ---------- Footer contact form (POST /api/v1/contact/austin-tx) ---------- */

  async function fetchCsrfToken() {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'include' });
      if (!res.ok) return null;
      const json = await res.json();
      return json.csrfToken || null;
    } catch (_) {
      return null;
    }
  }

  function initFooterContactForm() {
    const form = document.getElementById('wm-pgfooter-form');
    if (!form) return;

    const submitBtn = document.getElementById('wm-pgfooter-submit');
    const okAlert = document.getElementById('wm-pgfooter-alert-ok');
    const errAlert = document.getElementById('wm-pgfooter-alert-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      okAlert?.classList.remove('is-shown');
      errAlert?.classList.remove('is-shown');

      const fd = new FormData(form);
      const payload = {
        firstName: (fd.get('firstName') || '').toString().trim(),
        lastName:  (fd.get('lastName')  || '').toString().trim(),
        email:     (fd.get('email')     || '').toString().trim(),
        phone:     (fd.get('phone')     || '').toString().trim(),
        message:   (fd.get('message')   || '').toString().trim()
      };
      if (!payload.firstName || !payload.lastName || !payload.email || !payload.message) {
        errAlert.textContent = 'Please fill in name, email, and message.';
        errAlert.classList.add('is-shown');
        return;
      }

      submitBtn.disabled = true;
      const lang = localStorage.getItem(LANGUAGE_KEY) || 'en';
      submitBtn.textContent = (CHROME_STRINGS[lang] || CHROME_STRINGS.en)['chrome.footer.sending'] || 'SENDING…';

      try {
        const csrf = await fetchCsrfToken();
        const headers = { 'Content-Type': 'application/json' };
        if (csrf) headers['x-csrf-token'] = csrf;

        const slug = window.LOCATION_DATA?.slug || 'austin-tx';
        const res = await fetch(`/api/v1/contact/${slug}`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          okAlert.classList.add('is-shown');
          form.reset();
        } else {
          let msg = "Sorry, that didn't go through. Please try again or call us directly.";
          try {
            const body = await res.json();
            if (body?.message) msg = body.message;
          } catch (_) {}
          errAlert.textContent = msg;
          errAlert.classList.add('is-shown');
        }
      } catch (_) {
        errAlert.textContent = "Network error — please try again or call us directly.";
        errAlert.classList.add('is-shown');
      } finally {
        submitBtn.disabled = false;
        const langNow = localStorage.getItem(LANGUAGE_KEY) || 'en';
        submitBtn.textContent = (CHROME_STRINGS[langNow] || CHROME_STRINGS.en)['chrome.footer.submit'] || 'SUBMIT →';
      }
    });
  }

  /* ---------- Init ---------- */

  function init() {
    applyDataBindings();
    applyChromeTranslations(localStorage.getItem(LANGUAGE_KEY) || 'en');
    initLanguageSwitcher();
    initLocationModal();
    initMobileDrawer();
    initFooterContactForm();

    const route = getActiveRoute();
    applyActiveNav(route);
    loadIframeRoute(route);

    // Re-translate chrome whenever language changes — covers both the
    // menu-click path AND any bridge-driven setLanguage call from the
    // iframe or from window.WaveMaxBridgeV3 directly.
    window.addEventListener('languageChanged', (e) => {
      const lang = e?.detail?.language || localStorage.getItem(LANGUAGE_KEY) || 'en';
      refreshActiveLanguage();
      applyChromeTranslations(lang);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
