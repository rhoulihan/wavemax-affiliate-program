/* Stub iframe initializer — proves the v3 bridge contract end-to-end.
 * Replaced in Phase 2 by per-page initializers (austin-landing-init.js,
 * wash-dry-fold-init.js, etc.).
 */
(function () {
  'use strict';

  const STUB_TRANSLATIONS = {
    en: {
      'stub.eyebrow':           'BRIDGE TEST',
      'stub.title':             'Bridge protocol verification',
      'stub.subtitle':          "This stub page proves the parent-iframe bridge contract works end-to-end. Every value below is bound from the parent's LOCATION_DATA via PostMessage.",
      'stub.callButton':        'Call',
      'stub.directionsButton':  'Get Directions',
      'stub.stats.washers':     'Washers',
      'stub.stats.dryers':      'Dryers',
      'stub.stats.hours':       'Daily Hours',
      'stub.stats.wdf':         'WDF Pricing',
      'stub.section.eyebrow':   'FOUNDATION VERIFICATION',
      'stub.section.title':     'What this page proves',
      'stub.section.subtitle':  'Six capabilities the bridge contract delivers. Open the browser console to see the message log.',
      'stub.cards.bridge.title':'PostMessage bridge',
      'stub.cards.bridge.text': 'Parent ↔ iframe messages flow through the v3 protocol with origin checks on both sides.',
      'stub.cards.data.title':  'Single source of truth',
      'stub.cards.data.text':   "Every value on this page comes from the parent's LOCATION_DATA object via data-bind.",
      'stub.cards.i18n.title':  'Live language switching',
      'stub.cards.i18n.text':   'Switch language in the host header. Iframe re-renders all data-i18n targets without reload.',
      'stub.cards.resize.title':'Auto-resize',
      'stub.cards.resize.text': 'The iframe reports its content height to the parent on every change.',
      'stub.cards.seo.title':   'Bridge-driven SEO',
      'stub.cards.seo.text':    "Iframe pushes meta, OG tags, Twitter cards, and JSON-LD up to the parent's <head> on load.",
      'stub.cards.nav.title':   'Cross-frame navigation',
      'stub.cards.nav.text':    'Iframe can request same-origin navigation via navigate messages with origin enforcement.',
      'stub.cta.text':          'Ready to see your store rendered like this?',
      'stub.cta.call':          'Call us',
      'stub.cta.directions':    'Get directions'
    },
    es: {
      'stub.eyebrow':           'PRUEBA DE PUENTE',
      'stub.title':             'Verificación del protocolo del puente',
      'stub.subtitle':          'Esta página de prueba demuestra que el contrato del puente padre-iframe funciona de extremo a extremo.',
      'stub.callButton':        'Llamar',
      'stub.directionsButton':  'Cómo Llegar',
      'stub.stats.washers':     'Lavadoras',
      'stub.stats.dryers':      'Secadoras',
      'stub.stats.hours':       'Horario Diario',
      'stub.stats.wdf':         'Precio LSD',
      'stub.section.eyebrow':   'VERIFICACIÓN DE BASE',
      'stub.section.title':     'Lo que prueba esta página',
      'stub.section.subtitle':  'Seis capacidades que entrega el contrato del puente. Abre la consola para ver el registro.',
      'stub.cards.bridge.title':'Puente PostMessage',
      'stub.cards.bridge.text': 'Mensajes padre ↔ iframe fluyen por el protocolo v3 con verificación de origen en ambos lados.',
      'stub.cards.data.title':  'Fuente única de verdad',
      'stub.cards.data.text':   'Cada valor en esta página viene del objeto LOCATION_DATA del padre vía data-bind.',
      'stub.cards.i18n.title':  'Cambio de idioma en vivo',
      'stub.cards.i18n.text':   'Cambia el idioma en el encabezado anfitrión. El iframe vuelve a renderizar sin recargar.',
      'stub.cards.resize.title':'Auto-redimensionado',
      'stub.cards.resize.text': 'El iframe informa al padre la altura del contenido en cada cambio.',
      'stub.cards.seo.title':   'SEO vía puente',
      'stub.cards.seo.text':    'El iframe envía meta, OG, Twitter cards y JSON-LD al <head> del padre al cargar.',
      'stub.cards.nav.title':   'Navegación entre marcos',
      'stub.cards.nav.text':    'El iframe puede solicitar navegación del mismo origen vía mensajes navigate.',
      'stub.cta.text':          '¿Listo para ver tu tienda así?',
      'stub.cta.call':          'Llámanos',
      'stub.cta.directions':    'Cómo llegar'
    },
    pt: {
      'stub.eyebrow':           'TESTE DE PONTE',
      'stub.title':             'Verificação do protocolo da ponte',
      'stub.subtitle':          'Esta página de teste prova que o contrato da ponte pai-iframe funciona ponta a ponta.',
      'stub.callButton':        'Ligar',
      'stub.directionsButton':  'Ver Direções',
      'stub.stats.washers':     'Lavadoras',
      'stub.stats.dryers':      'Secadoras',
      'stub.stats.hours':       'Horário Diário',
      'stub.stats.wdf':         'Preço LSD',
      'stub.section.eyebrow':   'VERIFICAÇÃO DE BASE',
      'stub.section.title':     'O que esta página prova',
      'stub.section.subtitle':  'Seis capacidades que o contrato da ponte entrega.',
      'stub.cards.bridge.title':'Ponte PostMessage',
      'stub.cards.bridge.text': 'Mensagens pai ↔ iframe fluem pelo protocolo v3 com verificação de origem.',
      'stub.cards.data.title':  'Fonte única da verdade',
      'stub.cards.data.text':   'Cada valor vem do objeto LOCATION_DATA do pai via data-bind.',
      'stub.cards.i18n.title':  'Troca de idioma ao vivo',
      'stub.cards.i18n.text':   'Troque o idioma no cabeçalho do host. O iframe re-renderiza sem recarregar.',
      'stub.cards.resize.title':'Auto-redimensionamento',
      'stub.cards.resize.text': 'O iframe informa ao pai a altura do conteúdo a cada mudança.',
      'stub.cards.seo.title':   'SEO via ponte',
      'stub.cards.seo.text':    'O iframe envia meta, OG, Twitter cards e JSON-LD ao <head> do pai ao carregar.',
      'stub.cards.nav.title':   'Navegação entre quadros',
      'stub.cards.nav.text':    'O iframe pode solicitar navegação de mesma origem via mensagens navigate.',
      'stub.cta.text':          'Pronto para ver sua loja assim?',
      'stub.cta.call':          'Ligue agora',
      'stub.cta.directions':    'Ver direções'
    },
    de: {
      'stub.eyebrow':           'BRIDGE-TEST',
      'stub.title':             'Verifikation des Brücken-Protokolls',
      'stub.subtitle':          'Diese Testseite beweist, dass der Eltern-iframe-Brücken-Vertrag durchgängig funktioniert.',
      'stub.callButton':        'Anrufen',
      'stub.directionsButton':  'Wegbeschreibung',
      'stub.stats.washers':     'Waschmaschinen',
      'stub.stats.dryers':      'Trockner',
      'stub.stats.hours':       'Tägliche Öffnungszeiten',
      'stub.stats.wdf':         'WDF-Preis',
      'stub.section.eyebrow':   'BASISVERIFIKATION',
      'stub.section.title':     'Was diese Seite beweist',
      'stub.section.subtitle':  'Sechs Fähigkeiten, die der Brücken-Vertrag liefert.',
      'stub.cards.bridge.title':'PostMessage-Brücke',
      'stub.cards.bridge.text': 'Eltern ↔ iframe-Nachrichten fließen über das v3-Protokoll mit Ursprungsprüfung.',
      'stub.cards.data.title':  'Einheitliche Datenquelle',
      'stub.cards.data.text':   'Jeder Wert auf dieser Seite kommt vom LOCATION_DATA-Objekt des Eltern über data-bind.',
      'stub.cards.i18n.title':  'Live-Sprachumschaltung',
      'stub.cards.i18n.text':   'Sprache im Host-Header umschalten. Der iframe rendert ohne Neuladen neu.',
      'stub.cards.resize.title':'Auto-Größenanpassung',
      'stub.cards.resize.text': 'Der iframe meldet dem Eltern die Inhaltshöhe bei jeder Änderung.',
      'stub.cards.seo.title':   'SEO via Brücke',
      'stub.cards.seo.text':    'Der iframe sendet Meta, OG, Twitter-Cards und JSON-LD an den <head> des Eltern.',
      'stub.cards.nav.title':   'Frame-übergreifende Navigation',
      'stub.cards.nav.text':    'Der iframe kann eine Navigation gleichen Ursprungs über navigate-Nachrichten anfordern.',
      'stub.cta.text':          'Bereit, deinen Laden so zu sehen?',
      'stub.cta.call':          'Jetzt anrufen',
      'stub.cta.directions':    'Wegbeschreibung'
    }
  };

  const STUB_SEO = {
    meta: {
      title:        'WaveMAX Austin · Bridge Verification',
      description:  'Reference build verification page demonstrating the parent-iframe bridge contract for the WaveMAX Austin franchisee.',
      canonicalUrl: 'https://wavemax.promo/dev/austin-host-mock.html',
      author:       'WaveMAX Laundry Austin'
    },
    openGraph: {
      title:       'WaveMAX Austin · Bridge Verification',
      description: 'Reference parent-iframe bridge verification for the WaveMAX Austin franchisee.',
      type:        'website',
      url:         'https://wavemax.promo/dev/austin-host-mock.html',
      siteName:    'WaveMAX Laundry',
      locale:      'en_US'
    },
    twitter: {
      card:        'summary',
      title:       'WaveMAX Austin · Bridge Verification',
      description: 'Reference parent-iframe bridge verification page.'
    },
    structuredData: {
      localBusiness: {
        '@context':    'https://schema.org',
        '@type':       'LocalBusiness',
        '@id':         'https://www.wavemaxlaundry.com/austin-tx/#localbusiness',
        name:          'WaveMAX Laundry Austin',
        telephone:     '+15125531674',
        address: {
          '@type':         'PostalAddress',
          streetAddress:   '825 E Rundberg Ln F1',
          addressLocality: 'Austin',
          addressRegion:   'TX',
          postalCode:      '78753',
          addressCountry:  'US'
        },
        geo: {
          '@type':   'GeoCoordinates',
          latitude:  '30.3564789',
          longitude: '-97.6858016'
        },
        openingHoursSpecification: [{
          '@type':     'OpeningHoursSpecification',
          dayOfWeek:   ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
          opens:       '07:00',
          closes:      '22:00'
        }],
        priceRange: '$$'
      }
    }
  };

  function logToScreen(line) {
    const el = document.getElementById('bridge-log');
    if (!el) return;
    const stamp = new Date().toISOString().slice(11, 23);
    if (el.textContent === 'Waiting for bridge handshake...') el.textContent = '';
    el.textContent += `[${stamp}] ${line}\n`;
    el.scrollTop = el.scrollHeight;
  }

  function init() {
    if (!window.IframeBridge) {
      logToScreen('FAIL: IframeBridge global missing — iframe-bridge-v2.js did not load');
      return;
    }

    window.IframeBridge.loadTranslations(STUB_TRANSLATIONS);

    window.IframeBridge.init({
      pageIdentifier:   'austin-stub',
      enableTranslation: true,
      enableAutoResize:  true
    });

    window.IframeBridge.loadSEOConfig(STUB_SEO);

    window.IframeBridge.onLocationData((data) => {
      logToScreen(`location-data received → slug="${data.slug}", phone=${data?.contact?.phone}, address="${data?.contact?.address}"`);
    });

    window.addEventListener('language-changed', (e) => {
      logToScreen(`language-changed → ${e?.detail?.language}`);
    });

    logToScreen('iframe-ready sent. Waiting for parent...');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
