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
      'landing.title':        "Austin's Cleanest Laundromat",
      'landing.subtitle':     'UV-sanitized 450G washers, fast dryers, touchless payment, free WiFi. Drop off your wash-dry-fold or use our self-serve floor — open every day.',
      'landing.callBtn':      'Call',
      'landing.directionsBtn':'Get Directions',
      'landing.stats.washers':'Washers',
      'landing.stats.dryers': 'Dryers',
      'landing.stats.hours':  'Open Daily',
      'landing.stats.wdf':    'WDF Pricing',
      'landing.services.eyebrow': 'OUR SERVICES',
      'landing.services.title':   'Three ways to get clean laundry',
      'landing.services.subtitle':"Whether you prefer to do it yourself or drop it off, we've got you covered.",
      'landing.tab.wdf':          'Wash-Dry-Fold',
      'landing.tab.selfserve':    'Self-Serve Laundry',
      'landing.tab.commercial':   'Commercial',
      'landing.wdf.dropoff.title':'Drop off, walk out',
      'landing.wdf.dropoff.text': '2-minute drop-off. We weigh, wash, dry, and fold with hospital-grade UV sanitization.',
      'landing.wdf.turnaround.title': '24-hour turnaround',
      'landing.wdf.turnaround.text':  'Drop off in the morning, pick up the next day. Need it faster? Ask about same-day.',
      'landing.wdf.pricing.text': 'Detergent, dryer sheets, and hangers included. Cards-only payment, no cash needed.',
      'landing.wdf.cta':          'See full WDF details →',
      'landing.selfserve.machines.text': 'Loads from 20lb to 80lb. Faster spin = less drying time = less time waiting.',
      'landing.selfserve.uv.title':      'UV sanitization',
      'landing.selfserve.uv.text':       'Every cycle finishes with a UV sterilization pass. 99.9% pathogen kill.',
      'landing.selfserve.amenities.title':'Free WiFi · Touchless pay',
      'landing.selfserve.amenities.text': 'Wheelchair accessible, free parking, attended every shift. Comfortable, clean, reliable.',
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
      'landing.title':        'La lavandería más limpia de Austin',
      'landing.subtitle':     'Lavadoras 450G con sanitización UV, secadoras rápidas, pago sin contacto, WiFi gratis. Deja tu lavado o usa nuestro autoservicio — abierto todos los días.',
      'landing.callBtn':      'Llamar',
      'landing.directionsBtn':'Cómo Llegar',
      'landing.stats.washers':'Lavadoras',
      'landing.stats.dryers': 'Secadoras',
      'landing.stats.hours':  'Abierto Diariamente',
      'landing.stats.wdf':    'Precio LSD',
      'landing.services.eyebrow': 'NUESTROS SERVICIOS',
      'landing.services.title':   'Tres formas de tener ropa limpia',
      'landing.services.subtitle':'Ya sea que prefieras hacerlo tú mismo o dejarlo, te tenemos cubierto.',
      'landing.tab.wdf':          'Lavado · Secado · Doblado',
      'landing.tab.selfserve':    'Autoservicio',
      'landing.tab.commercial':   'Comercial',
      'landing.wdf.dropoff.title':'Déjalo y sal',
      'landing.wdf.dropoff.text': 'Entrega en 2 minutos. Pesamos, lavamos, secamos y doblamos con sanitización UV de grado hospitalario.',
      'landing.wdf.turnaround.title': 'Listo en 24 horas',
      'landing.wdf.turnaround.text':  'Deja por la mañana, recoge al día siguiente. ¿Más rápido? Pregunta por el mismo día.',
      'landing.wdf.pricing.text': 'Detergente, hojas para secadora y ganchos incluidos. Solo tarjetas, no se necesita efectivo.',
      'landing.wdf.cta':          'Ver detalles completos de LSD →',
      'landing.selfserve.machines.title': 'lavadoras 450G, secadoras',
      'landing.selfserve.machines.text': 'Cargas de 20lb a 80lb. Centrifugado más rápido = menos tiempo secando = menos tiempo esperando.',
      'landing.selfserve.uv.title':      'Sanitización UV',
      'landing.selfserve.uv.text':       'Cada ciclo termina con esterilización UV. 99.9% de eliminación de patógenos.',
      'landing.selfserve.amenities.title':'WiFi gratis · Pago sin contacto',
      'landing.selfserve.amenities.text': 'Accesible para sillas de ruedas, estacionamiento gratis, atendido en cada turno. Cómodo, limpio, confiable.',
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
      'landing.title':        'A lavanderia mais limpa de Austin',
      'landing.subtitle':     'Lavadoras 450G com sanitização UV, secadoras rápidas, pagamento sem contato, WiFi grátis. Entregue sua roupa ou use nosso autoatendimento — aberto todos os dias.',
      'landing.callBtn':      'Ligar',
      'landing.directionsBtn':'Ver Direções',
      'landing.stats.washers':'Lavadoras',
      'landing.stats.dryers': 'Secadoras',
      'landing.stats.hours':  'Aberto Diariamente',
      'landing.stats.wdf':    'Preço LSD',
      'landing.services.eyebrow': 'NOSSOS SERVIÇOS',
      'landing.services.title':   'Três maneiras de ter roupa limpa',
      'landing.services.subtitle':'Quer fazer você mesmo ou deixar conosco — temos a solução.',
      'landing.tab.wdf':          'Lavar · Secar · Dobrar',
      'landing.tab.selfserve':    'Autoatendimento',
      'landing.tab.commercial':   'Comercial',
      'landing.wdf.dropoff.title':'Deixe e saia',
      'landing.wdf.dropoff.text': 'Entrega em 2 minutos. Pesamos, lavamos, secamos e dobramos com sanitização UV de nível hospitalar.',
      'landing.wdf.turnaround.title': 'Pronto em 24 horas',
      'landing.wdf.turnaround.text':  'Deixe pela manhã, retire no dia seguinte. Mais rápido? Pergunte sobre o mesmo dia.',
      'landing.wdf.pricing.text': 'Detergente, lenços para secadora e cabides inclusos. Apenas cartões, não precisa de dinheiro.',
      'landing.wdf.cta':          'Ver detalhes completos de LSD →',
      'landing.selfserve.machines.title': 'lavadoras 450G, secadoras',
      'landing.selfserve.machines.text': 'Cargas de 20lb a 80lb. Centrifugação mais rápida = menos tempo secando.',
      'landing.selfserve.uv.title':      'Sanitização UV',
      'landing.selfserve.uv.text':       'Cada ciclo termina com esterilização UV. 99.9% de eliminação de patógenos.',
      'landing.selfserve.amenities.title':'WiFi grátis · Pagamento sem contato',
      'landing.selfserve.amenities.text': 'Acessível para cadeira de rodas, estacionamento grátis, equipe em todos os turnos.',
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
      'landing.title':        'Austins sauberste Wäscherei',
      'landing.subtitle':     'UV-desinfizierte 450G-Waschmaschinen, schnelle Trockner, kontaktloses Bezahlen, kostenloses WLAN. Wäsche abgeben oder Selbstbedienung nutzen — täglich geöffnet.',
      'landing.callBtn':      'Anrufen',
      'landing.directionsBtn':'Wegbeschreibung',
      'landing.stats.washers':'Waschmaschinen',
      'landing.stats.dryers': 'Trockner',
      'landing.stats.hours':  'Täglich geöffnet',
      'landing.stats.wdf':    'WDF-Preis',
      'landing.services.eyebrow': 'UNSERE LEISTUNGEN',
      'landing.services.title':   'Drei Wege zu sauberer Wäsche',
      'landing.services.subtitle':'Ob Sie es selbst machen oder uns überlassen — wir haben die passende Lösung.',
      'landing.tab.wdf':          'Waschen · Trocknen · Falten',
      'landing.tab.selfserve':    'Selbstbedienung',
      'landing.tab.commercial':   'Gewerblich',
      'landing.wdf.dropoff.title':'Abgeben, fertig',
      'landing.wdf.dropoff.text': '2-Minuten-Abgabe. Wir wiegen, waschen, trocknen und falten mit UV-Sanitierung in Krankenhausqualität.',
      'landing.wdf.turnaround.title': 'Fertig in 24 Stunden',
      'landing.wdf.turnaround.text':  'Morgens abgeben, am nächsten Tag abholen. Schneller? Fragen Sie nach Same-Day.',
      'landing.wdf.pricing.text': 'Waschmittel, Trocknertücher und Bügel inklusive. Nur Karten, kein Bargeld nötig.',
      'landing.wdf.cta':          'Alle WDF-Details ansehen →',
      'landing.selfserve.machines.title': '450G-Waschmaschinen, Trockner',
      'landing.selfserve.machines.text': 'Beladungen von 20–80 lb. Schnelleres Schleudern = weniger Trocknerzeit.',
      'landing.selfserve.uv.title':      'UV-Sanitierung',
      'landing.selfserve.uv.text':       'Jeder Zyklus endet mit UV-Sterilisation. 99,9 % Pathogen-Eliminierung.',
      'landing.selfserve.amenities.title':'Kostenloses WLAN · Kontaktlos',
      'landing.selfserve.amenities.text': 'Rollstuhlgerecht, kostenlose Parkplätze, in jeder Schicht betreut.',
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
  const SEO = {
    meta: {
      title:        'WaveMAX Austin · Laundromat in North Austin',
      description:  "Austin's cleanest, fastest laundromat. Self-serve laundry · wash-dry-fold drop-off · commercial accounts. Open daily 7am–10pm at 825 E Rundberg Ln F1, North Austin.",
      canonicalUrl: 'https://wavemax.promo/austin-tx/',
      author:       'WaveMAX Laundry Austin'
    },
    openGraph: {
      title:       'WaveMAX Austin · Laundromat in North Austin',
      description: "Austin's cleanest laundromat. UV-sanitized, fast machines, open every day.",
      type:        'business.business',
      url:         'https://wavemax.promo/austin-tx/',
      siteName:    'WaveMAX Laundry',
      locale:      'en_US'
    },
    twitter: {
      card:        'summary_large_image',
      title:       'WaveMAX Austin Laundromat',
      description: "Austin's cleanest laundromat — open daily 7am–10pm."
    },
    structuredData: {
      localBusiness: {
        '@context':    'https://schema.org',
        '@type':       'LocalBusiness',
        '@id':         'https://www.wavemaxlaundry.com/austin-tx/#localbusiness',
        name:          'WaveMAX Laundry Austin',
        telephone:     '+15125531674',
        priceRange:    '$',
        address: {
          '@type':         'PostalAddress',
          streetAddress:   '825 E Rundberg Ln F1',
          addressLocality: 'Austin',
          addressRegion:   'TX',
          postalCode:      '78753',
          addressCountry:  'US'
        },
        geo: { '@type': 'GeoCoordinates', latitude: '30.3564789', longitude: '-97.6858016' },
        openingHoursSpecification: [{
          '@type':   'OpeningHoursSpecification',
          dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
          opens:     '07:00',
          closes:    '22:00'
        }]
      }
    }
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

  /* ---------- Tabs ---------- */
  function initTabs() {
    const tabs = document.querySelectorAll('.wm-tab');
    const panels = document.querySelectorAll('.wm-tab-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        tabs.forEach(t => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
        panels.forEach(p => {
          p.setAttribute('aria-hidden', p.getAttribute('data-panel') === target ? 'false' : 'true');
        });
        if (window.IframeBridge?.updateHeight) window.IframeBridge.updateHeight();
      });
    });
  }

  /* ---------- Reviews ---------- */
  async function loadReviews() {
    const container = document.getElementById('wm-reviews-cards');
    const googleLink = document.getElementById('wm-reviews-google-link');
    if (!container) return;
    try {
      const res = await fetch('/api/v1/location/austin-tx/reviews?minRating=5&limit=3', { credentials: 'include' });
      if (!res.ok) throw new Error('http_' + res.status);
      const json = await res.json();
      const data = json?.data || {};

      if (data.attributionHref && googleLink) googleLink.setAttribute('href', data.attributionHref);

      if (!data.reviews || data.reviews.length === 0) {
        renderReviewsEmpty(container, data);
        return;
      }
      container.innerHTML = '';
      data.reviews.forEach(r => container.appendChild(buildReviewCard(r)));
    } catch (_) {
      renderReviewsEmpty(container, {});
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

  /* ---------- Cross-frame nav for tab CTAs ---------- */
  function initCrossFrameNav() {
    document.querySelectorAll('a[data-route]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const href = a.getAttribute('href');
        if (window.IframeBridge?.navigateParent) window.IframeBridge.navigateParent(href);
        else window.parent.location.href = href;
      });
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
    window.IframeBridge.loadSEOConfig(SEO);

    initTabs();
    initCrossFrameNav();

    // Bind whenever location-data arrives
    window.IframeBridge.onLocationData((data) => {
      applyBindings(data);
      if (window.IframeBridge?.updateHeight) window.IframeBridge.updateHeight();
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
