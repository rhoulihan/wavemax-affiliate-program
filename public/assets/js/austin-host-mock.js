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
    '/':                                '/austin-landing-v3-embed.html',
    '/wash-dry-fold':                   '/wash-dry-fold-embed.html',
    '/self-serve-laundry':              '/self-serve-laundry-embed.html',
    '/commercial':                      '/commercial-embed.html',
    '/commercial/medical-offices':      '/commercial-embed.html?tab=medical',
    '/commercial/health-clubs':         '/commercial-embed.html?tab=gym',
    '/commercial/airbnb-rentals':       '/commercial-embed.html?tab=airbnb',
    '/commercial/restaurants-catering': '/commercial-embed.html?tab=restaurant',
    '/commercial/contractors':          '/commercial-embed.html?tab=contractors',
    '/about-us':                        '/about-us-embed.html',
    '/contact':                         '/contact-embed.html'
  };

  const ROUTE_BREADCRUMBS = {
    '/':                                  'Home',
    '/wash-dry-fold':                     'Wash · Dry · Fold',
    '/self-serve-laundry':                'Self-Service Laundry',
    '/commercial':                        'Commercial',
    '/commercial/medical-offices':        'Medical Offices',
    '/commercial/health-clubs':           'Health Clubs',
    '/commercial/airbnb-rentals':         'Airbnb & Rentals',
    '/commercial/restaurants-catering':   'Restaurants & Catering',
    '/commercial/contractors':            'Contractors & Service Providers',
    '/about-us':                          'About Us',
    '/contact':                           'Contact'
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

  // Module-level helpers used by both initLanguageSwitcher() and the
  // delegated document-level click handler below. Pulling them out of the
  // function closure means a delegated click works even if the inner
  // initLanguageSwitcher call had a problem attaching its own listener.
  function _langOpen()  { const r = document.getElementById('wm-lang'); const m = r?.querySelector('.wm-lang-menu'); if (!r || !m) return; r.setAttribute('aria-expanded', 'true');  m.classList.add('wm-lang-menu--open'); }
  function _langClose() { const r = document.getElementById('wm-lang'); const m = r?.querySelector('.wm-lang-menu'); if (!r || !m) return; r.setAttribute('aria-expanded', 'false'); m.classList.remove('wm-lang-menu--open'); }
  function _langToggle() { const r = document.getElementById('wm-lang'); if (!r) return; r.getAttribute('aria-expanded') === 'true' ? _langClose() : _langOpen(); }

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
      menu.appendChild(item);
    });

    refreshActiveLanguage();
  }

  // Document-level event delegation for the language switcher. This
  // pattern is immune to DOM replacement / re-render of the chrome
  // because the listener is attached to document, not to the button —
  // every click is routed through here regardless of whether the button
  // was re-mounted after init. Two reasons we hit this path on prod:
  //   1. An earlier closure-based listener attached to btn was being
  //      orphaned (suspected DOM re-mount inside data-binding pass).
  //   2. Hardens against any future re-render that swaps chrome nodes.
  document.addEventListener('click', (e) => {
    const root = document.getElementById('wm-lang');
    if (!root) return;

    // Click inside the toggle button → flip menu open state.
    if (e.target.closest('.wm-lang-btn')) {
      _langToggle();
      return;
    }
    // Click on a menu item → set language and close.
    const item = e.target.closest('.wm-lang-item');
    if (item && root.contains(item)) {
      if (item.disabled) return;
      const code = item.getAttribute('data-lang');
      if (code) setLanguage(code);
      _langClose();
      return;
    }
    // Click outside the switcher → close menu.
    if (!root.contains(e.target)) _langClose();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _langClose(); });

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
      'chrome.subnav.restaurants':      'Restaurants & Catering Laundry in Austin, TX',
      'chrome.subnav.contractors':      'Contractors & Service Providers in Austin, TX',
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
      'chrome.subnav.restaurants':      'Lavandería para Restaurantes y Catering en Austin, TX',
      'chrome.subnav.contractors':      'Contratistas y Proveedores de Servicios en Austin, TX',
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
      'chrome.subnav.restaurants':      'Lavanderia para Restaurantes e Catering em Austin, TX',
      'chrome.subnav.contractors':      'Empreiteiros e Prestadores de Serviços em Austin, TX',
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
      'chrome.subnav.restaurants':      'Wäscherei für Restaurants & Catering in Austin, TX',
      'chrome.subnav.contractors':      'Auftragnehmer & Dienstleister in Austin, TX',
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
  // Lazy-loaded Google Maps JS API on first modal open. Uses the
  // GOOGLE_PLACES_API_KEY already injected on the host page (same
  // browser-restricted key the live-reviews call uses on the landing).
  let mapsPromise = null;
  function loadGoogleMaps() {
    if (window.google?.maps?.Map) return Promise.resolve(window.google);
    if (mapsPromise) return mapsPromise;
    const apiKey = window.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return Promise.reject(new Error('GOOGLE_PLACES_API_KEY missing on host page'));
    mapsPromise = new Promise((resolve, reject) => {
      const cbName = '__wmGoogleMapsReady_' + Date.now();
      window[cbName] = () => { delete window[cbName]; resolve(window.google); };
      const script = document.createElement('script');
      // loading=async marks this as the modern non-blocking import; the
      // marker library covers AdvancedMarkerElement which we use for
      // custom-styled franchise pins.
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=marker&callback=${cbName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => { delete window[cbName]; reject(new Error('Google Maps failed to load')); };
      // Honor the page CSP nonce — same pattern the franchise data
      // injection uses.
      const existing = document.querySelector('script[nonce]');
      if (existing && existing.nonce) script.nonce = existing.nonce;
      document.head.appendChild(script);
    });
    return mapsPromise;
  }

  // Subtle dark map style — desaturated, navy-leaning, low-contrast
  // labels. Keeps the map readable inside our navy modal without
  // visually competing with the franchise tiles.
  const WM_MAP_STYLE = [
    { elementType: 'geometry',          stylers: [{ color: '#1e3a5f' }] },
    { elementType: 'labels.text.stroke',stylers: [{ color: '#0f2035' }] },
    { elementType: 'labels.text.fill',  stylers: [{ color: '#a3b8d4' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cfdcee' }] },
    { featureType: 'poi',                     elementType: 'all',              stylers: [{ visibility: 'off' }] },
    { featureType: 'road',          elementType: 'geometry', stylers: [{ color: '#254876' }] },
    { featureType: 'road',          elementType: 'labels.text.fill', stylers: [{ color: '#90a4c0' }] },
    { featureType: 'road.highway',  elementType: 'geometry', stylers: [{ color: '#2c5396' }] },
    { featureType: 'transit',       elementType: 'all',      stylers: [{ visibility: 'off' }] },
    { featureType: 'water',         elementType: 'geometry', stylers: [{ color: '#0f2035' }] },
    { featureType: 'water',         elementType: 'labels.text.fill', stylers: [{ color: '#5a7398' }] }
  ];

  let franchisesPromise = null;
  function loadFranchises() {
    if (franchisesPromise) return franchisesPromise;
    franchisesPromise = fetch('/api/v1/franchises', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(body => Array.isArray(body.franchises) ? body.franchises : []);
    return franchisesPromise;
  }

  function initLocationModal() {
    const overlay = document.getElementById('locModal');
    if (!overlay) return;

    const list           = document.getElementById('locList');
    const search         = document.getElementById('locSearch');
    const status         = document.getElementById('modalStatus');
    const statusText     = document.getElementById('modalStatusText');
    const actions        = document.getElementById('locActions');
    const selectedName   = document.getElementById('locSelectedName');
    const selectedAddr   = document.getElementById('locSelectedAddr');
    const directionsLink = document.getElementById('locActionDirections');
    const visitLink      = document.getElementById('locActionVisit');
    const mapEl          = document.getElementById('locMap');

    let map = null;
    let markersBySlug = new Map();
    let franchises = [];
    let initialized = false;
    let selectedSlug = null;

    const open = async () => {
      // Re-fetch overlay each time — the Hibu phone-swap may have rewritten
      // chrome subtrees, but the modal lives outside that subtree so the
      // closure-captured reference is normally fine. The fallback is cheap.
      const liveOverlay = document.getElementById('locModal') || overlay;
      liveOverlay.setAttribute('aria-hidden', 'false');
      liveOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      // Auto-select the current franchise on open so the action bar
      // shows immediately (operator can click Visit to confirm).
      if (!initialized) await initialize();
      if (!selectedSlug && window.FRANCHISE_SLUG) selectFranchise(window.FRANCHISE_SLUG, { centerMap: true, zoom: 12 });
      // Google Maps needs a resize trigger when its container goes from
      // display:none to flex (modal opens). The resize event refits the
      // bounds we computed at init.
      if (map) setTimeout(() => google.maps.event.trigger(map, 'resize'), 100);
      search?.focus();
    };
    const close = () => {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    };

    async function initialize() {
      if (initialized) return;
      initialized = true;
      try {
        if (status) { status.hidden = false; statusText.textContent = 'Loading franchises…'; }
        const [google, fs] = await Promise.all([loadGoogleMaps(), loadFranchises()]);
        franchises = fs;
        if (status) status.hidden = true;
        renderTiles(franchises);
        renderMap(google, franchises);
      } catch (err) {
        console.error('[locModal] init failed', err);
        if (status) { status.hidden = false; statusText.textContent = 'Could not load franchise list — please try again.'; }
      }
    }

    // Render tiles grouped by state, alphabetically.
    function renderTiles(items) {
      list.innerHTML = '';
      const byState = new Map();
      for (const f of items) {
        const k = f.state || '—';
        if (!byState.has(k)) byState.set(k, []);
        byState.get(k).push(f);
      }
      const states = [...byState.keys()].sort();
      const frag = document.createDocumentFragment();
      for (const st of states) {
        const header = document.createElement('div');
        header.className = 'loc-section-header';
        header.textContent = st;
        frag.appendChild(header);
        byState.get(st).sort((a, b) => (a.city || '').localeCompare(b.city || ''));
        for (const f of byState.get(st)) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'loc-card';
          btn.setAttribute('data-loc-slug', f.slug);
          btn.setAttribute('aria-selected', 'false');
          btn.innerHTML =
            '<div class="loc-info">' +
              `<div class="loc-name">${escapeText(f.name)}</div>` +
              `<div class="loc-addr">${escapeText(f.address || '')}</div>` +
              `<div class="loc-addr">${escapeText((f.city || '') + (f.city ? ', ' : '') + (f.state || '') + ' ' + (f.zip || ''))}</div>` +
              `<div class="loc-meta">${f.phone ? `<span class="loc-phone">${escapeText(f.phone)}</span>` : ''}</div>` +
            '</div>';
          btn.addEventListener('click', () => selectFranchise(f.slug, { centerMap: true, zoom: 16 }));
          frag.appendChild(btn);
        }
      }
      list.appendChild(frag);
    }
    function escapeText(s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
    }

    let infoWindow = null;
    function renderMap(google, items) {
      if (!mapEl) return;
      const gmaps = google.maps;

      map = new gmaps.Map(mapEl, {
        center:   { lat: 39.5, lng: -98.5 },   // continental US default
        zoom:     4,
        styles:   WM_MAP_STYLE,
        // Strip the controls that don't make sense in a small modal map
        // — keep zoom only, drop street view + map type + fullscreen.
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',  // single-finger pan on mobile
        clickableIcons: false       // suppress non-franchise POIs
      });
      infoWindow = new gmaps.InfoWindow();

      markersBySlug.clear();
      const bounds = new gmaps.LatLngBounds();
      let placedCount = 0;
      for (const f of items) {
        if (typeof f.lat !== 'number' || typeof f.lng !== 'number') continue;
        const m = new gmaps.Marker({
          map,
          position: { lat: f.lat, lng: f.lng },
          title:    f.name,
          // Custom SVG marker (cyan disc, white outline) — switches to
          // amber for the selected franchise via setIcon() below.
          icon:     wmMarkerIcon(false)
        });
        m.addListener('click', () => selectFranchise(f.slug, { centerMap: true, zoom: 16 }));
        markersBySlug.set(f.slug, m);
        bounds.extend(m.getPosition());
        placedCount++;
      }
      if (placedCount > 0) {
        map.fitBounds(bounds, 24);
        // Cap initial zoom so a tightly-clustered single state doesn't
        // open at street level.
        const onceListener = gmaps.event.addListenerOnce(map, 'idle', () => {
          if (map.getZoom() > 6) map.setZoom(6);
        });
      }
    }

    function wmMarkerIcon(selected) {
      // Encoded SVG so we don't ship marker assets. Selected variant is
      // larger + amber to match the in-page hero accent color.
      const fill   = selected ? '#f5a623' : '#27aae1';
      const stroke = '#ffffff';
      const r      = selected ? 11 : 8;
      const size   = (r + 2) * 2;
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}'><circle cx='${size/2}' cy='${size/2}' r='${r}' fill='${fill}' stroke='${stroke}' stroke-width='2'/></svg>`;
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(size, size),
        anchor:     new google.maps.Point(size / 2, size / 2)
      };
    }

    function selectFranchise(slug, opts = {}) {
      const f = franchises.find(x => x.slug === slug);
      if (!f) return;
      selectedSlug = slug;

      // Highlight tile + scroll the selected card to the top of the
      // visible list. Instant scroll (no 'smooth') because smooth
      // scrolling against scroll-snap left mid-row clipping where
      // the next/previous card's text was half-cut.
      list.querySelectorAll('.loc-card').forEach(c => {
        const isSelected = c.getAttribute('data-loc-slug') === slug;
        c.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        if (isSelected) {
          c.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      });

      // Re-icon every marker (selected gets amber + larger pin)
      markersBySlug.forEach((m, s) => {
        m.setIcon(wmMarkerIcon(s === slug));
        m.setZIndex(s === slug ? 1000 : 0);
      });

      // Pan + zoom map
      if (map && opts.centerMap !== false) {
        map.panTo({ lat: f.lat, lng: f.lng });
        map.setZoom(opts.zoom || 13);
      }

      // Open info window on the selected marker
      if (infoWindow) {
        const m = markersBySlug.get(slug);
        if (m) {
          infoWindow.setContent(
            `<div style="font-family: Barlow, sans-serif; min-width: 180px;">` +
              `<strong style="display:block; margin-bottom:2px; color:#143852;">${escapeText(f.name)}</strong>` +
              `<span style="color:#3a4a5c; font-size:0.86rem;">${escapeText(f.address || '')}<br>${escapeText((f.city || '') + ', ' + (f.state || ''))}</span>` +
            `</div>`
          );
          infoWindow.open({ map, anchor: m });
        }
      }

      // Update + show action bar
      if (selectedName) selectedName.textContent = f.name;
      if (selectedAddr) selectedAddr.textContent = (f.address ? f.address + ' · ' : '') + f.city + ', ' + f.state;
      if (directionsLink) {
        const q = encodeURIComponent([f.address, f.city, f.state, f.zip].filter(Boolean).join(' '));
        directionsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
      }
      if (visitLink) visitLink.href = '/' + slug + '/';
      if (actions) actions.hidden = false;
    }

    // Wire up open / close triggers via event delegation. The Hibu phone-
    // insertion script (austin-hibu-phone-swap.js + ybDynamicPhoneInsertion)
    // runs at window.load + 500ms and rewrites innerHTML on chrome elements
    // whose subtree contains the local phone number. Anywhere it does that,
    // event handlers attached to specific buttons get destroyed. Delegating
    // at document level survives any number of subtree rewrites.
    document.addEventListener('click', (e) => {
      const openTrig = e.target.closest && e.target.closest('[data-locmodal-open]');
      if (openTrig) { open(e); return; }
      const closeTrig = e.target.closest && e.target.closest('[data-locmodal-close]');
      if (closeTrig) { close(); return; }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') close();
    });

    // The Visit button navigates same-window; Directions opens a new tab
    // AND ALSO navigates the parent (after a short delay so the new tab
    // has time to open before this window unloads).
    if (visitLink) {
      visitLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (!selectedSlug) return;
        close();
        window.location.href = '/' + selectedSlug + '/';
      });
    }
    if (directionsLink) {
      directionsLink.addEventListener('click', (e) => {
        // Let the browser open the maps tab natively (target="_blank"
        // already set), then navigate this window after a beat.
        if (!selectedSlug) return;
        const slug = selectedSlug;
        setTimeout(() => {
          close();
          window.location.href = '/' + slug + '/';
        }, 200);
      });
    }

    // Search filter — works against both tiles and markers.
    if (search) {
      search.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        list.querySelectorAll('.loc-card').forEach(card => {
          const text = (card.textContent || '').toLowerCase();
          card.style.display = q && !text.includes(q) ? 'none' : '';
        });
        // Also hide section headers whose state has no visible cards
        list.querySelectorAll('.loc-section-header').forEach(h => {
          let next = h.nextElementSibling;
          let anyVisible = false;
          while (next && !next.classList.contains('loc-section-header')) {
            if (next.style.display !== 'none') { anyVisible = true; break; }
            next = next.nextElementSibling;
          }
          h.style.display = anyVisible ? '' : 'none';
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
    // 1) Server-rendered franchise pages publish their route via a global
    //    so the chrome doesn't have to parse the slug-prefixed URL itself.
    if (typeof window.FRANCHISE_INITIAL_ROUTE === 'string') {
      return window.FRANCHISE_INITIAL_ROUTE || '/';
    }
    // 2) Legacy demo path: query-param routing on /dev/austin-host-mock.html.
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

    // Update breadcrumb current label.
    // Landing route ('/') uses chrome.bc.locationName via data-i18n; deep
    // routes use the route label from ROUTE_BREADCRUMBS.
    const bcCurrent = document.getElementById('wm-bc-current');
    if (bcCurrent) {
      const label = ROUTE_BREADCRUMBS[route];
      if (route === '/' || !label) {
        bcCurrent.setAttribute('data-i18n', 'chrome.bc.locationName');
      } else {
        bcCurrent.removeAttribute('data-i18n');
        bcCurrent.textContent = label;
      }
    }
  }

  function loadIframeRoute(route) {
    const iframe = document.getElementById('wavemax-iframe');
    if (!iframe) return;
    // Server-rendered franchise pages set the iframe src up front (the
    // controller already resolved iframeOverride vs default content).
    // Don't clobber that on first paint.
    if (window.FRANCHISE_INITIAL_ROUTE !== undefined && iframe.getAttribute('src')) {
      return;
    }
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
