/* Austin landing page initializer.
 * Wires the iframe to the bridge protocol, fetches live 5★ Google reviews
 * from /api/v1/location/austin-tx/reviews, sets up tab interactions, applies
 * data-i18n + data-bind translations.
 */
(function () {
  'use strict';

  /* ---------- Translations ---------- */
  const TRANSLATIONS = {
    en: {
      'landing.eyebrow':      'North Austin · Open daily 7am–10pm',
      'landing.title':        "{{contact.city}}'s Cleanest Laundromat",
      // Equipment-aware variants — applyEquipment picks one based on
      // LOCATION_DATA.equipment flags. Premium = verified UV+highSpin.
      'landing.subtitle.premium': 'Hospital-grade UV-sanitized 450G washers, fast dryers, free WiFi, free parking. Drop off your wash-dry-fold or use our self-serve floor — open every day.',
      'landing.subtitle.default': 'Premium Electrolux washers, fast dryers, free WiFi, free parking. Drop off your wash-dry-fold or use our self-serve floor — open every day.',
      'landing.callBtn':      'Call',
      'landing.directionsBtn':'Get Directions',
      'landing.heroCaption':  'North Austin · 825 E Rundberg Ln',
      'landing.stats.googleRating':'Google Rating',
      'landing.stats.openDaily':   'Open Daily',
      'landing.stats.fullLoad':    'Full Load Done',
      'landing.stats.wdf':         'Wash-Dry-Fold',
      'landing.stats.turnaround':  'Turnaround',
      'landing.services.eyebrow': 'OUR SERVICES',
      'landing.services.title':   'Three ways to get clean laundry',
      'landing.services.subtitle':"Whether you prefer to do it yourself or drop it off, we've got you covered.",
      'landing.tab.wdf':          'Wash-Dry-Fold',
      'landing.tab.selfserve':    'Self-Serve Laundry',
      'landing.tab.commercial':   'Commercial',
      'landing.wdf.dropoff.title':'Drop off, walk out',
      'landing.wdf.dropoff.text.premium': '2-minute drop-off. We weigh, wash, dry, and fold with hospital-grade UV sanitization.',
      'landing.wdf.dropoff.text.default': '2-minute drop-off. We weigh, wash, dry, and fold with care.',
      'landing.wdf.turnaround.title': '24-hour turnaround',
      'landing.wdf.turnaround.text':  'Drop off in the morning, pick up the next day. Need it faster? Ask about same-day.',
      'landing.wdf.pricing.minSuffix': 'lb minimum',
      'landing.wdf.pricing.text': 'Detergent, dryer sheets, and hangers included. Cards-only payment, no cash needed.',
      'landing.wdf.cta':          'See full WDF details →',
      'landing.selfserve.machines.title.premium': 'Electrolux CompassPro 450G Washers',
      'landing.selfserve.machines.title.default': 'Premium Electrolux Washers & Dryers',
      'landing.selfserve.machines.text.premium': "20-minute washes, 20-minute dries. High-spin 450G machines mean less time waiting and more time doing what you'd rather be doing.",
      'landing.selfserve.machines.text.default': 'High-efficiency Electrolux machines from 18 lb to 80 lb capacity — pick the size that fits your load and skip a trip.',
      'landing.selfserve.uv.title':      'Omni LUX UV Water Sanitization',
      'landing.selfserve.uv.text':       'Every wash cycle benefits from our Hospital Grade UV Water Sanitization system — 99.9% pathogen kill before the water ever touches your clothes.',
      'landing.selfserve.amenities.title':'Free WiFi',
      'landing.selfserve.amenities.text': "Wheelchair accessible, free parking, attended every shift. Bring a laptop — the WiFi's fast enough to actually work.",
      'landing.selfserve.cta':           'See full self-serve details →',
      'landing.commercial.airbnb.title': 'Airbnb & rentals',
      'landing.commercial.airbnb.text':  'Same-day turnover support. Sheets, towels, comforters — folded and ready by check-in.',
      'landing.commercial.medical.title':'Medical & clinical',
      'landing.commercial.medical.text': 'Scrubs, lab coats, exam linens. UV-sanitized + temperature-validated wash cycles.',
      'landing.commercial.fitness.title':'Health clubs & spas',
      'landing.commercial.fitness.text': 'Daily towel programs. Volume pricing, scheduled pickup, no contracts required.',
      'landing.commercial.cta':          'See commercial pricing →',
      'landing.reviews.eyebrow':     'FIVE-STAR REVIEWS',
      'landing.reviews.title':       'What our customers say',
      'landing.reviews.attribution': 'Five-star reviews from',
      'landing.reviews.empty':       "We're collecting reviews — check our",
      'landing.reviews.emptyLink':   'Google profile',
      'landing.cta.text':            'Ready to do laundry the easy way?',
      'landing.cta.call':            'Call us',
      'landing.cta.directions':      'Get directions'
    },
    es: {
      'landing.eyebrow':      'Norte de Austin · Abierto diariamente 7am–10pm',
      'landing.title':        'La lavandería más limpia de {{contact.city}}',
      'landing.subtitle.premium': 'Lavadoras 450G con sanitización UV de grado hospitalario, secadoras rápidas, WiFi gratis, estacionamiento gratis. Deja tu lavado o usa el autoservicio — abierto todos los días.',
      'landing.subtitle.default': 'Lavadoras Electrolux premium, secadoras rápidas, WiFi gratis, estacionamiento gratis. Deja tu lavado o usa el autoservicio — abierto todos los días.',
      'landing.callBtn':      'Llamar',
      'landing.directionsBtn':'Cómo Llegar',
      'landing.heroCaption':  'Norte de Austin · 825 E Rundberg Ln',
      'landing.stats.googleRating':'Calificación de Google',
      'landing.stats.openDaily':   'Abierto Diariamente',
      'landing.stats.fullLoad':    'Carga Completa Lista',
      'landing.stats.wdf':         'Lavado · Secado · Doblado',
      'landing.stats.turnaround':  'Tiempo de Entrega',
      'landing.services.eyebrow': 'NUESTROS SERVICIOS',
      'landing.services.title':   'Tres formas de tener ropa limpia',
      'landing.services.subtitle':'Ya sea que prefieras hacerlo tú mismo o dejarlo, te tenemos cubierto.',
      'landing.tab.wdf':          'Lavado · Secado · Doblado',
      'landing.tab.selfserve':    'Autoservicio',
      'landing.tab.commercial':   'Comercial',
      'landing.wdf.dropoff.title':'Déjalo y sal',
      'landing.wdf.dropoff.text.premium': 'Entrega en 2 minutos. Pesamos, lavamos, secamos y doblamos con sanitización UV de grado hospitalario.',
      'landing.wdf.dropoff.text.default': 'Entrega en 2 minutos. Pesamos, lavamos, secamos y doblamos con cuidado.',
      'landing.wdf.turnaround.title': 'Listo en 24 horas',
      'landing.wdf.turnaround.text':  'Deja por la mañana, recoge al día siguiente. ¿Más rápido? Pregunta por el mismo día.',
      'landing.wdf.pricing.minSuffix': 'lb mínimo',
      'landing.wdf.pricing.text': 'Detergente, hojas para secadora y ganchos incluidos. Solo tarjetas, no se necesita efectivo.',
      'landing.wdf.cta':          'Ver detalles completos de LSD →',
      'landing.selfserve.machines.title.premium': 'Lavadoras Electrolux CompassPro 450G',
      'landing.selfserve.machines.title.default': 'Lavadoras y secadoras Electrolux premium',
      'landing.selfserve.machines.text.premium': 'Lavados de 20 minutos, secados de 20 minutos. Las máquinas 450G de alto centrifugado significan menos tiempo esperando.',
      'landing.selfserve.machines.text.default': 'Máquinas Electrolux de alta eficiencia de 18 lb a 80 lb de capacidad — elige el tamaño que se ajuste a tu carga y ahorra un viaje.',
      'landing.selfserve.uv.title':      'Sanitización UV del Agua Omni LUX',
      'landing.selfserve.uv.text':       'Cada ciclo de lavado se beneficia de nuestro sistema de Sanitización UV del Agua de Grado Hospitalario — 99.9% de eliminación de patógenos antes de que el agua toque tu ropa.',
      'landing.selfserve.amenities.title':'WiFi gratis',
      'landing.selfserve.amenities.text': 'Accesible para sillas de ruedas, estacionamiento gratis, atendido en cada turno. Trae una laptop — el WiFi es rápido.',
      'landing.selfserve.cta':           'Ver detalles de autoservicio →',
      'landing.commercial.airbnb.title': 'Airbnb y alquileres',
      'landing.commercial.airbnb.text':  'Soporte de cambio el mismo día. Sábanas, toallas, edredones — doblados y listos antes del check-in.',
      'landing.commercial.medical.title':'Médico y clínico',
      'landing.commercial.medical.text': 'Uniformes médicos, batas, ropa de examen. Ciclos con sanitización UV + temperatura validada.',
      'landing.commercial.fitness.title':'Gimnasios y spas',
      'landing.commercial.fitness.text': 'Programas diarios de toallas. Precios por volumen, recogida programada, sin contratos.',
      'landing.commercial.cta':          'Ver precios comerciales →',
      'landing.reviews.eyebrow':     'RESEÑAS DE CINCO ESTRELLAS',
      'landing.reviews.title':       'Lo que dicen nuestros clientes',
      'landing.reviews.attribution': 'Reseñas de cinco estrellas de',
      'landing.reviews.empty':       'Estamos recopilando reseñas — visita nuestro',
      'landing.reviews.emptyLink':   'perfil de Google',
      'landing.cta.text':            '¿Listo para lavar la ropa de la manera fácil?',
      'landing.cta.call':            'Llámanos',
      'landing.cta.directions':      'Cómo llegar'
    },
    pt: {
      'landing.eyebrow':      'Norte de Austin · Aberto diariamente 7am–10pm',
      'landing.title':        'A lavanderia mais limpa de {{contact.city}}',
      'landing.subtitle.premium': 'Lavadoras 450G com sanitização UV nível hospitalar, secadoras rápidas, WiFi grátis, estacionamento grátis. Entregue sua roupa ou use o autoatendimento — aberto todos os dias.',
      'landing.subtitle.default': 'Lavadoras Electrolux premium, secadoras rápidas, WiFi grátis, estacionamento grátis. Entregue sua roupa ou use o autoatendimento — aberto todos os dias.',
      'landing.callBtn':      'Ligar',
      'landing.directionsBtn':'Ver Direções',
      'landing.heroCaption':  'Norte de Austin · 825 E Rundberg Ln',
      'landing.stats.googleRating':'Avaliação Google',
      'landing.stats.openDaily':   'Aberto Diariamente',
      'landing.stats.fullLoad':    'Carga Completa Pronta',
      'landing.stats.wdf':         'Lavar · Secar · Dobrar',
      'landing.stats.turnaround':  'Prazo de Entrega',
      'landing.services.eyebrow': 'NOSSOS SERVIÇOS',
      'landing.services.title':   'Três maneiras de ter roupa limpa',
      'landing.services.subtitle':'Quer fazer você mesmo ou deixar conosco — temos a solução.',
      'landing.tab.wdf':          'Lavar · Secar · Dobrar',
      'landing.tab.selfserve':    'Autoatendimento',
      'landing.tab.commercial':   'Comercial',
      'landing.wdf.dropoff.title':'Deixe e saia',
      'landing.wdf.dropoff.text.premium': 'Entrega em 2 minutos. Pesamos, lavamos, secamos e dobramos com sanitização UV de nível hospitalar.',
      'landing.wdf.dropoff.text.default': 'Entrega em 2 minutos. Pesamos, lavamos, secamos e dobramos com cuidado.',
      'landing.wdf.turnaround.title': 'Pronto em 24 horas',
      'landing.wdf.turnaround.text':  'Deixe pela manhã, retire no dia seguinte. Mais rápido? Pergunte sobre o mesmo dia.',
      'landing.wdf.pricing.minSuffix': 'lb mínimo',
      'landing.wdf.pricing.text': 'Detergente, lenços para secadora e cabides inclusos. Apenas cartões, não precisa de dinheiro.',
      'landing.wdf.cta':          'Ver detalhes completos de LSD →',
      'landing.selfserve.machines.title.premium': 'Lavadoras Electrolux CompassPro 450G',
      'landing.selfserve.machines.title.default': 'Lavadoras e secadoras Electrolux premium',
      'landing.selfserve.machines.text.premium': 'Lavagens de 20 minutos, secagens de 20 minutos. Máquinas 450G de alta centrifugação — menos tempo esperando.',
      'landing.selfserve.machines.text.default': 'Máquinas Electrolux de alta eficiência de 18 lb a 80 lb de capacidade — escolha o tamanho que se ajusta à sua carga e poupe uma viagem.',
      'landing.selfserve.uv.title':      'Sanitização UV da Água Omni LUX',
      'landing.selfserve.uv.text':       'Cada ciclo de lavagem se beneficia de nosso sistema de Sanitização UV da Água de Nível Hospitalar — 99.9% de eliminação de patógenos antes que a água toque suas roupas.',
      'landing.selfserve.amenities.title':'WiFi grátis',
      'landing.selfserve.amenities.text': 'Acessível para cadeira de rodas, estacionamento grátis, equipe em todos os turnos. Traga seu laptop — o WiFi é rápido.',
      'landing.selfserve.cta':           'Ver detalhes do autoatendimento →',
      'landing.commercial.airbnb.title': 'Airbnb e aluguéis',
      'landing.commercial.airbnb.text':  'Suporte de virada no mesmo dia. Lençóis, toalhas, edredons — dobrados e prontos no check-in.',
      'landing.commercial.medical.title':'Médico e clínico',
      'landing.commercial.medical.text': 'Uniformes, jalecos, roupas de exame. Ciclos com sanitização UV + temperatura validada.',
      'landing.commercial.fitness.title':'Academias e spas',
      'landing.commercial.fitness.text': 'Programas diários de toalhas. Preços por volume, retirada agendada, sem contratos.',
      'landing.commercial.cta':          'Ver preços comerciais →',
      'landing.reviews.eyebrow':     'AVALIAÇÕES CINCO ESTRELAS',
      'landing.reviews.title':       'O que nossos clientes dizem',
      'landing.reviews.attribution': 'Avaliações cinco estrelas do',
      'landing.reviews.empty':       'Estamos coletando avaliações — visite nosso',
      'landing.reviews.emptyLink':   'perfil do Google',
      'landing.cta.text':            'Pronto para lavar de forma fácil?',
      'landing.cta.call':            'Ligue agora',
      'landing.cta.directions':      'Ver direções'
    },
    de: {
      'landing.eyebrow':      'Nord-Austin · Täglich geöffnet 7–22 Uhr',
      'landing.title':        '{{contact.city}}s sauberste Wäscherei',
      'landing.subtitle.premium': 'UV-desinfizierte 450G-Waschmaschinen in Krankenhausqualität, schnelle Trockner, kostenloses WLAN, kostenlose Parkplätze. Wäsche abgeben oder Selbstbedienung nutzen — täglich geöffnet.',
      'landing.subtitle.default': 'Premium Electrolux-Waschmaschinen, schnelle Trockner, kostenloses WLAN, kostenlose Parkplätze. Wäsche abgeben oder Selbstbedienung nutzen — täglich geöffnet.',
      'landing.callBtn':      'Anrufen',
      'landing.directionsBtn':'Wegbeschreibung',
      'landing.heroCaption':  'Nord-Austin · 825 E Rundberg Ln',
      'landing.stats.googleRating':'Google-Bewertung',
      'landing.stats.openDaily':   'Täglich geöffnet',
      'landing.stats.fullLoad':    'Volle Ladung fertig',
      'landing.stats.wdf':         'Waschen · Trocknen · Falten',
      'landing.stats.turnaround':  'Bearbeitungszeit',
      'landing.services.eyebrow': 'UNSERE LEISTUNGEN',
      'landing.services.title':   'Drei Wege zu sauberer Wäsche',
      'landing.services.subtitle':'Ob Sie es selbst machen oder uns überlassen — wir haben die passende Lösung.',
      'landing.tab.wdf':          'Waschen · Trocknen · Falten',
      'landing.tab.selfserve':    'Selbstbedienung',
      'landing.tab.commercial':   'Gewerblich',
      'landing.wdf.dropoff.title':'Abgeben, fertig',
      'landing.wdf.dropoff.text.premium': '2-Minuten-Abgabe. Wir wiegen, waschen, trocknen und falten mit UV-Sanitierung in Krankenhausqualität.',
      'landing.wdf.dropoff.text.default': '2-Minuten-Abgabe. Wir wiegen, waschen, trocknen und falten mit Sorgfalt.',
      'landing.wdf.turnaround.title': 'Fertig in 24 Stunden',
      'landing.wdf.turnaround.text':  'Morgens abgeben, am nächsten Tag abholen. Schneller? Fragen Sie nach Same-Day.',
      'landing.wdf.pricing.minSuffix': 'lb Mindestmenge',
      'landing.wdf.pricing.text': 'Waschmittel, Trocknertücher und Bügel inklusive. Nur Karten, kein Bargeld nötig.',
      'landing.wdf.cta':          'Alle WDF-Details ansehen →',
      'landing.selfserve.machines.title.premium': 'Electrolux CompassPro 450G-Waschmaschinen',
      'landing.selfserve.machines.title.default': 'Premium Electrolux Waschmaschinen & Trockner',
      'landing.selfserve.machines.text.premium': '20-Minuten-Wäschen, 20-Minuten-Trocknen. 450G-Hochschleuder-Maschinen — weniger Wartezeit.',
      'landing.selfserve.machines.text.default': 'Hocheffiziente Electrolux-Maschinen von 18 lb bis 80 lb Kapazität — wählen Sie die Größe, die zu Ihrer Wäsche passt, und sparen Sie eine Fahrt.',
      'landing.selfserve.uv.title':      'Omni LUX UV-Wassersanitierung',
      'landing.selfserve.uv.text':       'Jeder Waschgang profitiert von unserem UV-Wassersanitierungssystem in Krankenhausqualität — 99,9 % Pathogen-Eliminierung, bevor das Wasser Ihre Wäsche berührt.',
      'landing.selfserve.amenities.title':'Kostenloses WLAN',
      'landing.selfserve.amenities.text': 'Rollstuhlgerecht, kostenlose Parkplätze, in jeder Schicht betreut. Bringen Sie einen Laptop mit — das WLAN ist schnell.',
      'landing.selfserve.cta':           'Alle Selbstbedienungs-Details →',
      'landing.commercial.airbnb.title': 'Airbnb & Vermietungen',
      'landing.commercial.airbnb.text':  'Same-Day-Turnover-Support. Bettwäsche, Handtücher, Decken — gefaltet und bereit zum Check-in.',
      'landing.commercial.medical.title':'Medizinisch & klinisch',
      'landing.commercial.medical.text': 'Kittel, Kasacks, Untersuchungsbettwäsche. UV-sanitiert + temperaturvalidierte Waschzyklen.',
      'landing.commercial.fitness.title':'Fitnessstudios & Spas',
      'landing.commercial.fitness.text': 'Tägliche Handtuchprogramme. Mengenpreise, geplante Abholung, keine Verträge.',
      'landing.commercial.cta':          'Gewerbepreise ansehen →',
      'landing.reviews.eyebrow':     'FÜNF-STERNE-BEWERTUNGEN',
      'landing.reviews.title':       'Was unsere Kunden sagen',
      'landing.reviews.attribution': 'Fünf-Sterne-Bewertungen von',
      'landing.reviews.empty':       'Wir sammeln Bewertungen — besuchen Sie unser',
      'landing.reviews.emptyLink':   'Google-Profil',
      'landing.cta.text':            'Bereit, Wäsche einfach zu waschen?',
      'landing.cta.call':            'Jetzt anrufen',
      'landing.cta.directions':      'Wegbeschreibung'
    }
  };

  /* ---------- SEO config (sent to parent via bridge) ---------- */
  const PAGE_URL    = 'https://wavemax.promo/dev/austin-host-mock.html';
  const HOST_URL    = 'https://wavemax.promo/austin-tx/';
  const HERO_IMG    = 'https://wavemaxlaundry.com/wp-content/uploads/locations/austin-tx/hero-1.jpg';
  const BUSINESS_ID = 'https://www.wavemaxlaundry.com/austin-tx/#localbusiness';

  const SEO = {
    meta: {
      title:        'WaveMAX Austin · Laundromat in North Austin',
      description:  "Austin's cleanest, fastest laundromat. Self-serve laundry · wash-dry-fold drop-off · commercial accounts. Open daily 7am–10pm at 825 E Rundberg Ln F1, North Austin.",
      canonicalUrl: PAGE_URL,
      author:       'WaveMAX Laundry Austin',
      keywords:     'laundromat austin tx, laundromat near me, self service laundry austin, wash dry fold austin, drop off laundry austin, north austin laundromat, rundberg laundromat, commercial laundry austin, wavemax austin'
    },
    openGraph: {
      title:       'WaveMAX Austin · Laundromat in North Austin',
      description: "Austin's cleanest laundromat. UV-sanitized, fast machines, open every day.",
      type:        'business.business',
      url:         PAGE_URL,
      image:       HERO_IMG,
      imageWidth:  '1200',
      imageHeight: '630',
      siteName:    'WaveMAX Laundry',
      locale:      'en_US'
    },
    twitter: {
      card:        'summary_large_image',
      title:       'WaveMAX Austin Laundromat',
      description: "Austin's cleanest laundromat — open daily 7am–10pm.",
      image:       HERO_IMG,
      imageAlt:    'WaveMAX Laundry Austin storefront on Rundberg Ln'
    },
    structuredData: {
      localBusiness: {
        '@context':    'https://schema.org',
        '@type':       'LaundryOrDryCleaner',
        '@id':         BUSINESS_ID,
        name:          'WaveMAX Laundry Austin',
        alternateName: 'WaveMAX Austin',
        url:           HOST_URL,
        telephone:     '+15125531674',
        email:         'no-reply@wavemax.promo',
        priceRange:    '$',
        image:         [HERO_IMG],
        address: {
          '@type':         'PostalAddress',
          streetAddress:   '825 E Rundberg Ln F1',
          addressLocality: 'Austin',
          addressRegion:   'TX',
          postalCode:      '78753',
          addressCountry:  'US'
        },
        geo: { '@type': 'GeoCoordinates', latitude: 30.3564789, longitude: -97.6858016 },
        openingHoursSpecification: [{
          '@type':   'OpeningHoursSpecification',
          dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
          opens:     '07:00',
          closes:    '22:00'
        }],
        areaServed: [
          { '@type': 'City', name: 'Austin'        },
          { '@type': 'City', name: 'Round Rock'    },
          { '@type': 'City', name: 'Cedar Park'    },
          { '@type': 'City', name: 'Pflugerville'  },
          { '@type': 'City', name: 'Georgetown'    },
          { '@type': 'City', name: 'Leander'       }
        ]
      },
      breadcrumb: {
        '@context': 'https://schema.org',
        '@type':    'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'WaveMAX Laundry', item: 'https://www.wavemaxlaundry.com/' },
          { '@type': 'ListItem', position: 2, name: 'Austin, TX'                                              }
        ]
      }
    },
    alternateLanguages: [
      { hreflang: 'en',        href: PAGE_URL },
      { hreflang: 'es',        href: PAGE_URL },
      { hreflang: 'pt',        href: PAGE_URL },
      { hreflang: 'de',        href: PAGE_URL },
      { hreflang: 'x-default', href: PAGE_URL }
    ]
  };

  /* ---------- data-bind ---------- */
  function applyBindings(data) {
    if (!data) return;
    document.querySelectorAll('[data-bind]').forEach(el => {
      const path = el.getAttribute('data-bind');
      const value = path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), data);
      if (value === undefined || value === null) return;
      const attr = el.getAttribute('data-bind-attr');
      if (attr) el.setAttribute(attr, String(value));
      else el.textContent = String(value);
    });
  }

  /* ---------- Tabs ----------
   * Document-level event delegation so handlers survive iframe-doc
   * reloads and are immune to the cached-NodeList bug that took down
   * the closure-bound version. Single delegated listener routes via
   * `e.target.closest('.wm-tab')`. Panels query fresh on each click.
   */
  function initTabs() {
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.wm-tab');
      if (!tab) return;
      const target = tab.getAttribute('data-tab');
      document.querySelectorAll('.wm-tab').forEach(t =>
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
      document.querySelectorAll('.wm-tab-panel').forEach(p =>
        p.setAttribute('aria-hidden', p.getAttribute('data-panel') === target ? 'false' : 'true'));
      if (window.IframeBridge?.updateHeight) window.IframeBridge.updateHeight();
    });
  }

  /* ---------- Reviews — direct Google Places API (New) call ----
   * No backend / proxy. Reads:
   *   window.parent.GOOGLE_PLACES_API_KEY    (from the host page)
   *   window.parent.LOCATION_PLACE_ID        (or LOCATION_DATA.google.placeId)
   * Falls back to the empty-state Google profile link if either is missing.
   *
   * The API key is restricted in Google Cloud Console to:
   *   - Places API (New) only
   *   - HTTP referrer whitelist: wavemax.promo, www.wavemax.promo, localhost
   * That's the standard pattern for browser-exposed Places keys — abuse is
   * bounded by referrer enforcement on Google's edge.
   */
  function getReviewsConfig() {
    // Try the host-page globals first (works when iframe is embedded), then
    // fall back to LOCATION_DATA.google.placeId so a single-location demo
    // works without setting both variables.
    let apiKey = null;
    let placeId = null;
    try {
      apiKey = window.parent?.GOOGLE_PLACES_API_KEY || window.GOOGLE_PLACES_API_KEY || null;
    } catch (_) { /* cross-origin parent — ignore */ }
    try {
      placeId = window.parent?.LOCATION_PLACE_ID
              || window.parent?.LOCATION_DATA?.google?.placeId
              || window.IframeBridge?.getLocationData?.()?.google?.placeId
              || null;
    } catch (_) { /* cross-origin parent — ignore */ }
    return { apiKey, placeId };
  }

  function shapeGoogleReview(raw) {
    const author = raw.authorAttribution || {};
    return {
      author:           author.displayName || 'Anonymous',
      rating:           raw.rating,
      text:             (raw.text && raw.text.text) || raw.originalText?.text || '',
      relativeTime:     raw.relativePublishTimeDescription || '',
      publishTime:      raw.publishTime || null,
      photoUrl:         author.photoUri || null,
      googleProfileUrl: author.uri || null
    };
  }

  async function loadReviews() {
    const container = document.getElementById('wm-reviews-cards');
    const googleLink = document.getElementById('wm-reviews-google-link');
    if (!container) return;

    const { apiKey, placeId } = getReviewsConfig();

    if (!apiKey || !placeId) {
      renderReviewsEmpty(container, {});
      return;
    }

    if (googleLink) {
      googleLink.setAttribute('href', `https://www.google.com/maps/place/?q=place_id:${placeId}`);
    }

    try {
      const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
                  `?fields=reviews,rating,userRatingCount`;
      const res = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'reviews,rating,userRatingCount'
        }
      });
      if (!res.ok) throw new Error('places_api_' + res.status);
      const data = await res.json();

      const all = (data.reviews || []).map(shapeGoogleReview);
      const fiveStars = all.filter(r => r.rating >= 5).slice(0, 3);

      if (fiveStars.length === 0) {
        renderReviewsEmpty(container, { attributionHref: googleLink?.getAttribute('href') });
        return;
      }

      container.innerHTML = '';
      fiveStars.forEach(r => container.appendChild(buildReviewCard(r)));
    } catch (err) {
      console.warn('[austin-landing] reviews fetch failed:', err.message);
      renderReviewsEmpty(container, { attributionHref: googleLink?.getAttribute('href') });
    } finally {
      if (window.IframeBridge?.updateHeight) window.IframeBridge.updateHeight();
    }
  }

  function buildReviewCard(r) {
    const card = document.createElement('div');
    card.className = 'wm-review-card';
    card.setAttribute('role', 'listitem');

    const stars = document.createElement('div');
    stars.className = 'wm-review-stars';
    stars.setAttribute('aria-label', `${r.rating} out of 5 stars`);
    stars.textContent = '★'.repeat(r.rating || 5);
    card.appendChild(stars);

    const text = document.createElement('p');
    text.className = 'wm-review-text';
    text.textContent = `"${r.text}"`;
    card.appendChild(text);

    const author = document.createElement('div');
    author.className = 'wm-review-author';

    const photo = document.createElement('div');
    photo.className = 'wm-review-author-photo';
    if (r.photoUrl) {
      photo.style.backgroundImage = `url("${r.photoUrl}")`;
      photo.style.backgroundSize = 'cover';
      photo.style.backgroundPosition = 'center';
      photo.textContent = '';
    } else {
      photo.textContent = (r.author || 'A').charAt(0).toUpperCase();
    }
    author.appendChild(photo);

    const meta = document.createElement('div');
    meta.className = 'wm-review-author-meta';
    const name = document.createElement('span');
    name.className = 'wm-review-author-name';
    name.textContent = r.author || 'Anonymous';
    meta.appendChild(name);
    if (r.relativeTime) {
      const time = document.createElement('span');
      time.className = 'wm-review-author-time';
      time.textContent = r.relativeTime;
      meta.appendChild(time);
    }
    author.appendChild(meta);
    card.appendChild(author);
    return card;
  }

  function renderReviewsEmpty(container, data) {
    const lang = window.IframeBridge?.getCurrentLanguage?.() || localStorage.getItem('wavemax-language') || 'en';
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const empty = document.createElement('div');
    empty.className = 'wm-reviews-empty';
    const text = document.createElement('span');
    text.textContent = `${dict['landing.reviews.empty']} `;
    empty.appendChild(text);
    const link = document.createElement('a');
    link.href = data.attributionHref || 'https://www.google.com/maps/search/WaveMAX+Austin/';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = dict['landing.reviews.emptyLink'] + ' →';
    empty.appendChild(link);
    container.innerHTML = '';
    container.appendChild(empty);
  }

  /* ---------- Hero image rotator ----------
   * Switched from setInterval(step, ms) to a self-recursive setTimeout
   * chain after the deployed page was observed never advancing past
   * image 0. Likely cause: the bridge's per-second updateHeight() poll
   * (iframe-bridge-v2.js, line ~400) was racing with our setInterval
   * in a way that left our timer dangling on prod-only timing. The
   * setTimeout chain re-arms after each step, so a single missed tick
   * can't permanently disable rotation.
   *
   * Hover pause uses a paused flag instead of clear/re-set since the
   * recursive chain self-suspends naturally — easier to reason about.
   */
  function initHeroRotator() {
    // Use rotator container's live children list — getElementById +
    // .children is the freshest possible reference and never stales.
    // The previous closure-cached NodeList AND the per-tick
    // querySelectorAll both failed to update visible state — likely
    // because the iframe doc reloads once during init and we end up
    // mutating elements that the user's render no longer references.
    function step() {
      const rotator = document.getElementById('wm-hero-rotator');
      if (!rotator) { schedule(); return; }
      const imgs = rotator.children;
      if (imgs.length < 2) { schedule(); return; }
      let activeIdx = -1;
      for (let i = 0; i < imgs.length; i++) {
        if (imgs[i].classList?.contains('is-active')) { activeIdx = i; break; }
      }
      if (activeIdx < 0) activeIdx = 0;
      const nextIdx = (activeIdx + 1) % imgs.length;
      imgs[activeIdx].classList.remove('is-active');
      imgs[nextIdx].classList.add('is-active');
      schedule();
    }
    let scheduled = null;
    let paused = false;
    function schedule() {
      if (paused) return;
      if (scheduled) clearTimeout(scheduled);
      // 6000ms — 50% slower than the original 4000ms cadence so each
      // photo lingers long enough to read the alt-text caption and
      // the every-third-frame Austin landmark feels like punctuation
      // rather than rapid-fire flicker.
      scheduled = setTimeout(step, 6000);
    }
    schedule();

    const rotator = document.getElementById('wm-hero-rotator');
    if (rotator) {
      rotator.addEventListener('mouseenter', () => {
        paused = true;
        if (scheduled) { clearTimeout(scheduled); scheduled = null; }
      });
      rotator.addEventListener('mouseleave', () => {
        paused = false;
        schedule();
      });
    }
  }

  /* ---------- Hero watermark — fixed store-image backdrop ----
   * Watermark is the same primary store photo MHR's existing landing
   * uses (hero-1.jpg). Treated with a navy gradient + amber tint
   * multiply blend so the white hero text reads while the store
   * interior peeks through.
   *
   * The Austin landmark photos (Pennybacker / Capitol / Skyline /
   * Mt Bonnell / Lady Bird / South Congress) live in the right-side
   * rotator now — they're declared in the HTML alongside the store
   * photos, so the rotator cycles store-and-landmark together. */
  // Hero watermark + SEO are now driven from LOCATION_DATA via the
  // shared FranchisePage helper. The static Austin URLs that used to
  // live here moved to the registry's per-franchise images.hero[0].
  function setStoreWatermark(data) {
    const root = document.getElementById('wm-austin-watermark');
    if (!root) return;
    root.setAttribute('data-watermark', 'store');
    if (window.FranchisePage) {
      window.FranchisePage.applyHeroWatermark(data);
    }
  }

  /* ---------- Hero rotator (right-column store photos + landmarks) ----------
   * Builds <img> children from LOCATION_DATA.images.interior +
   * LOCATION_DATA.images.landmarks. Cadence: every third slot is a
   * landmark when both arrays are non-empty (Austin: 6 store + 3
   * landmarks → 9 slots). Franchises with no landmarks just cycle
   * store interiors. Franchises with no images fall through to
   * whatever kent-wa returned at registry-build time. */
  function populateHeroRotator(data) {
    const rotator = document.getElementById('wm-hero-rotator');
    if (!rotator) return;
    const interiors = (data?.images?.interior || []).slice();
    const landmarks = (data?.images?.landmarks || []).slice();
    if (interiors.length === 0 && landmarks.length === 0) return;

    // Interleave: 2 interiors then 1 landmark per triplet, until either
    // list runs out. Landmarks go second-position-of-triplet so the
    // rotator opens on a store photo (the page is about WaveMAX, not
    // local tourism — landmarks just punctuate sense-of-place).
    const slots = [];
    let i = 0, l = 0;
    while (i < interiors.length || l < landmarks.length) {
      if (i < interiors.length) slots.push({ url: interiors[i++], alt: data.brand?.name + ' interior', isLandmark: false });
      if (i < interiors.length) slots.push({ url: interiors[i++], alt: data.brand?.name + ' interior', isLandmark: false });
      if (l < landmarks.length) {
        const lm = landmarks[l++];
        slots.push({ url: typeof lm === 'string' ? lm : lm.url, alt: typeof lm === 'string' ? '' : (lm.alt || ''), isLandmark: true });
      }
    }
    if (slots.length === 0) return;

    // Render — replace children atomically so re-binding from a later
    // location-data event doesn't double-up.
    rotator.innerHTML = '';
    slots.forEach((slot, idx) => {
      const img = document.createElement('img');
      img.className = 'wm-hero-rotator-img' + (idx === 0 ? ' is-active' : '');
      img.src = slot.url;
      img.alt = slot.alt;
      img.loading = idx === 0 ? 'eager' : 'lazy';
      img.referrerPolicy = 'no-referrer';
      rotator.appendChild(img);
    });
  }

  /* ---------- Cross-frame nav for tab CTAs ----------
   * Delegate to document so the handler survives the bridge's
   * translatePage() pass (which replaces innerHTML on translated
   * nodes, orphaning any per-anchor listener). One-shot guard so
   * re-init doesn't double-attach.
   */
  function initCrossFrameNav() {
    if (document.__austinLandingNavWired) return;
    document.__austinLandingNavWired = true;
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest && e.target.closest('a[data-route]');
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('href');
      if (window.IframeBridge && window.IframeBridge.navigateParent) {
        window.IframeBridge.navigateParent(href);
      } else {
        window.parent.location.href = href;
      }
    });
  }

  /* ---------- Init ---------- */
  function init() {
    if (!window.IframeBridge) {
      console.error('[austin-landing] IframeBridge missing — bridge script must load first');
      return;
    }
    window.IframeBridge.loadTranslations(TRANSLATIONS);
    window.IframeBridge.init({ pageIdentifier: 'austin-landing', enableTranslation: true, enableAutoResize: true });
    // SEO is built from LOCATION_DATA inside onLocationData below — the
    // template is franchise-agnostic, so we no longer ship a static
    // Austin-flavored bundle.

    initTabs();
    initCrossFrameNav();
    initHeroRotator();

    // Bind whenever location-data arrives — also where the per-franchise
    // hero watermark, rotator photos, and SEO bundle are applied.
    window.IframeBridge.onLocationData((data) => {
      applyBindings(data);
      setStoreWatermark(data);
      populateHeroRotator(data);
      if (window.FranchisePage) {
        // Gate premium-only sections (Omni LUX UV cards, 450G claims) on
        // the resolved equipment profile so non-Austin stores never show
        // claims they can't back up.
        window.FranchisePage.applyEquipment(data);
        // Substitute {{contact.city}} etc. placeholders in translated
        // text. Runs AFTER applyEquipment so hidden variants don't
        // waste a substitution pass.
        window.FranchisePage.applyTextPlaceholders(data);
        const seo = window.FranchisePage.buildSeo(data, 'landing');
        if (seo) window.IframeBridge.loadSEOConfig(seo);
      }
      if (window.IframeBridge?.updateHeight) window.IframeBridge.updateHeight();
    });

    // Re-apply equipment gates AND placeholder substitution after every
    // language change — translatePage rewrites textContent on every
    // [data-i18n] element, which both restores {{placeholder}} tokens
    // we already substituted AND can re-show variants we hid (if a
    // future translation reflows the markup). Cheap to redo.
    window.addEventListener('language-changed', () => {
      if (window.FranchisePage && window.LOCATION_DATA) {
        window.FranchisePage.applyEquipment(window.LOCATION_DATA);
        window.FranchisePage.applyTextPlaceholders(window.LOCATION_DATA);
      }
    });

    // Fetch reviews after a short delay so the bridge has time to settle
    setTimeout(loadReviews, 250);

    // Re-render the empty-state link if language changes (it's localized)
    window.addEventListener('language-changed', () => {
      const container = document.getElementById('wm-reviews-cards');
      if (container && container.querySelector('.wm-reviews-empty')) {
        renderReviewsEmpty(container, {});
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
