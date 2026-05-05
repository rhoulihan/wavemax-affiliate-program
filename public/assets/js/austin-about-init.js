/* Austin About-Us page initializer.
 *
 * Wires the iframe to the bridge protocol, applies data-bind / data-i18n
 * translations, sets the hero watermark photo, and ships an AboutPage
 * SEO bundle (LocalBusiness, AboutPage, BreadcrumbList).
 *
 * No tabs, no forms — read-only owner / values / community page.
 */
(function () {
  'use strict';

  /* ---------- Translations (en/es/pt/de) ---------- */
  const TRANSLATIONS = {
    en: {
      // Defaults below are CORPORATE-GENERIC. Per-franchise overrides
      // come from LOCATION_DATA.aboutContent (applied by applyAboutContent
      // after translatePage runs). Austin's specific Houlihan content
      // lives in known-overrides.json → austin-tx.json.
      'about.title':              'About this WaveMAX',
      'about.tagline':            'Locally owned. Locally invested.',
      'about.subtitle':           "This WaveMAX is owned and operated by people who live in the community we serve. We chose WaveMAX because we believe in delivering the best quality and service at the lowest fair price — and reinvesting in our neighborhood, every day.",
      'about.callBtn':            'Call',
      'about.directionsBtn':      'Visit us',

      'about.stats.founded':      'Serving the Community',
      'about.stats.owners':       'Local Owners',
      'about.stats.local':        'Locally Owned',
      'about.stats.disciplines':  'Years Combined Experience',
      'about.stats.community':    'Community First',

      'about.mission.eyebrow':    'WHY WAVEMAX',
      'about.mission.title':      'Why we chose WaveMAX',
      'about.mission.body1':      "We're locals who wanted to invest in our neighborhood — not just write a check, but build something that delivers real value to the people who live here.",
      'about.mission.body2':      "WaveMAX is the platform that lets us do that: modern equipment, professional service, and a model designed to keep prices fair and quality high. Community first, quality always — that's the standard we operate by.",
      'about.mission.proud':      'Proud to serve our local community.',

      'about.values.eyebrow':     'WHAT WE STAND FOR',
      'about.values.title':       'Our values, on every wash',
      'about.values.v1.t':        'Community first.',
      'about.values.v1.b':        'Locally owned. Profits reinvested in our community.',
      'about.values.v2.t':        'Quality service.',
      'about.values.v2.b':        'Modern equipment, professional standards, and a clean store every visit.',
      'about.values.v3.t':        'Fair pricing.',
      'about.values.v3.b':        'No hidden fees, no contracts. Pay for what you use, transparent every step.',
      'about.values.v4.t':        'Reliable hours.',
      'about.values.v4.b':        "Convenient hours that fit your schedule. We're here when you need us.",
      'about.values.v5.t':        'Friendly service.',
      'about.values.v5.b':        "Real people, not a vending machine. Need help? We're here.",

      'about.team.eyebrow':       'MEET THE OWNERS',
      'about.team.title':         'Meet the local owners',
      'about.team.lede':          'Local people committed to running a clean, fast, friendly laundromat for our community.',

      'about.community.eyebrow':  'GIVING BACK',
      'about.community.title':    'Investing in our community',
      'about.community.text':     "Every fold, every wash, every dollar that comes through our door goes back into the community — into staff who live here, suppliers who operate here, and causes we support here. When you choose this WaveMAX, you're not buying laundry from a chain. You're investing in your neighbors.",

      'about.cta.text':           "Stop in to say hello. We'd love to meet you.",
      'about.cta.callBtn':        'Call us',
      'about.cta.directionsBtn':  'Get directions'
    },

    es: {
      'about.title':              'Sobre WaveMAX Austin',
      'about.tagline':            'Un negocio familiar, construyendo un mejor Austin lavada por lavada.',
      'about.subtitle':           'WaveMAX Austin es propiedad de la familia Houlihan, quienes lo operan. Elegimos WaveMAX porque creemos en retribuir a nuestra comunidad invirtiendo en la mejor calidad y servicio al precio más bajo — y construyendo localmente, todos los días.',
      'about.callBtn':            'Llamar',
      'about.directionsBtn':      'Visítanos',

      'about.stats.founded':      'Sirviendo a Austin Desde',
      'about.stats.owners':       'Dueños Familiares',
      'about.stats.local':        'Local de Austin',
      'about.stats.disciplines':  'Disciplinas',
      'about.stats.community':    'Comunidad Primero',

      'about.mission.eyebrow':    'POR QUÉ WAVEMAX',
      'about.mission.title':      'Por qué elegimos WaveMAX',
      'about.mission.body1':      'Somos tres locales de Austin que queríamos invertir en nuestro vecindario — no solo escribir un cheque, sino construir algo que entregue valor real a las personas que viven aquí.',
      'about.mission.body2':      'WaveMAX es la plataforma que nos permite hacerlo: equipo de primer nivel, sanitización de agua de grado hospitalario y un modelo de servicio diseñado para mantener precios bajos y calidad alta. Podemos poner nuestros valores en práctica — comunidad primero, calidad siempre — y la gente obtiene la experiencia de lavandería más limpia, rápida y amistosa en el centro de Austin.',
      'about.mission.proud':      'Orgullosos de servir a la comunidad de Central Austin desde 2025.',

      'about.values.eyebrow':     'NUESTROS VALORES',
      'about.values.title':       'Nuestros valores, en cada lavada',
      'about.values.v1.t':        'Comunidad primero.',
      'about.values.v1.b':        'Ganancias reinvertidas localmente — personal, equipo y apoyando causas de Austin que nos importan.',
      'about.values.v2.t':        'Calidad de primer nivel.',
      'about.values.v2.b':        'Agua sanitizada con UV Omni LUX, detergente hipoalergénico ecológico, pesajes calibrados, doblado a mano.',
      'about.values.v3.t':        'Precio justo más bajo.',
      'about.values.v3.b':        'Sin tarifas ocultas, sin contratos, sin suscripciones. Solo tarjeta, precios transparentes — paga por lo que uses.',
      'about.values.v4.t':        'Siempre abiertos.',
      'about.values.v4.b':        '7am–10pm, todos los días, 365 días al año. Estamos aquí cuando el día de lavandería realmente ocurre.',
      'about.values.v5.t':        'Servicio amistoso.',
      'about.values.v5.b':        '¿Necesitas ayuda? Estamos aquí.',

      'about.team.eyebrow':       'CONOCE A LOS DUEÑOS',
      'about.team.title':         'La familia Houlihan',
      'about.team.lede':          'Tres locales de Austin — un músico, un ejecutivo de tecnología y una artista — operando el WaveMAX más concurrido de Texas. Mundos diferentes, mismo valor: invertir en tu comunidad.',
      'about.team.colin.role':    'Dueño / Operador',
      'about.team.colin.tag':     'Local del Norte de Austin · músico en activo',
      'about.team.colin.bio':     'Colin maneja el día a día en la ubicación de Rundberg. Nacido y criado en el Norte de Austin, toca en la escena musical local, y aporta el ojo de un músico para el detalle y la presentación al operar una tienda limpia, rápida y amistosa.',
      'about.team.rick.role':     'Co-Dueño',
      'about.team.rick.tag':      'Ejecutivo de tecnología local e influencer',
      'about.team.rick.bio':      'Rick es un ejecutivo de tecnología de larga trayectoria en Austin e influencer en la comunidad de datos e IA. Aporta una mirada de operaciones y experiencia de cliente al negocio familiar — medir todo, luego mejorarlo, en cada turno.',
      'about.team.simone.role':   'Co-Dueña',
      'about.team.simone.tag':    'Artista local y filántropa',
      'about.team.simone.bio':    'Simone es una artista de Austin activa en la comunidad local de artes y filantropía. Mantiene el corazón del negocio al frente y al centro — valores de comunidad primero, servicio de calidad al precio justo más bajo, con ganancias reinvertidas localmente.',

      'about.community.eyebrow':  'RETRIBUYENDO',
      'about.community.title':    'Invirtiendo en el Centro de Austin',
      'about.community.text':     'Cada doblado, cada lavada, cada dólar que entra por nuestra puerta vuelve a Austin — a personal que vive aquí, proveedores que operan aquí y causas que la familia apoya aquí. Cuando eliges WaveMAX Austin, no estás comprando lavandería de una cadena. Estás invirtiendo en tus vecinos.',

      'about.cta.text':           'Ven a conocer a la familia. Estamos en 825 E Rundberg Ln F1, todos los días, 7am–10pm.',
      'about.cta.callBtn':        'Llámanos',
      'about.cta.directionsBtn':  'Cómo llegar'
    },

    pt: {
      'about.title':              'Sobre a WaveMAX Austin',
      'about.tagline':            'Um negócio familiar, construindo uma Austin melhor uma lavagem de cada vez.',
      'about.subtitle':           'A WaveMAX Austin é de propriedade e operada pela família Houlihan. Escolhemos a WaveMAX porque acreditamos em retribuir à nossa comunidade investindo na melhor qualidade e serviço pelo menor preço — e construindo localmente, todos os dias.',
      'about.callBtn':            'Ligar',
      'about.directionsBtn':      'Visite-nos',

      'about.stats.founded':      'Servindo Austin Desde',
      'about.stats.owners':       'Donos Familiares',
      'about.stats.local':        'Local de Austin',
      'about.stats.disciplines':  'Disciplinas',
      'about.stats.community':    'Comunidade Primeiro',

      'about.mission.eyebrow':    'POR QUE WAVEMAX',
      'about.mission.title':      'Por que escolhemos a WaveMAX',
      'about.mission.body1':      'Somos três locais de Austin que queriam investir em nosso bairro — não apenas escrever um cheque, mas construir algo que entregue valor real às pessoas que vivem aqui.',
      'about.mission.body2':      'A WaveMAX é a plataforma que nos permite fazer isso: equipamentos de primeira linha, sanitização de água de grau hospitalar e um modelo de serviço projetado para manter os preços baixos e a qualidade alta. Conseguimos colocar nossos valores em prática — comunidade primeiro, qualidade sempre — e as pessoas obtêm a experiência de lavanderia mais limpa, rápida e amigável no centro de Austin.',
      'about.mission.proud':      'Orgulhosos de servir à comunidade do centro de Austin desde 2025.',

      'about.values.eyebrow':     'NOSSOS VALORES',
      'about.values.title':       'Nossos valores, em cada lavagem',
      'about.values.v1.t':        'Comunidade primeiro.',
      'about.values.v1.b':        'Lucros reinvestidos localmente — equipe, equipamento e apoio a causas de Austin que importam para nós.',
      'about.values.v2.t':        'Qualidade de primeira linha.',
      'about.values.v2.b':        'Água sanitizada com UV Omni LUX, detergente hipoalergênico ecológico, pesagens calibradas, dobragem manual.',
      'about.values.v3.t':        'Preço justo mais baixo.',
      'about.values.v3.b':        'Sem taxas ocultas, sem contratos, sem assinaturas. Apenas cartão, preços transparentes — pague pelo que usar.',
      'about.values.v4.t':        'Sempre aberto.',
      'about.values.v4.b':        '7h–22h, todos os dias, 365 dias por ano. Estamos aqui quando o dia de lavar realmente acontece.',
      'about.values.v5.t':        'Atendimento amigável.',
      'about.values.v5.b':        'Loja totalmente atendida. Pessoas reais, não uma máquina. Precisa de ajuda? Estamos aqui.',

      'about.team.eyebrow':       'CONHEÇA OS DONOS',
      'about.team.title':         'A família Houlihan',
      'about.team.lede':          'Três locais de Austin — um músico, um executivo de tecnologia e uma artista — operando a WaveMAX mais movimentada do Texas. Mundos diferentes, mesmo valor: invista na sua comunidade.',
      'about.team.colin.role':    'Dono / Operador',
      'about.team.colin.tag':     'Local do Norte de Austin · músico em atividade',
      'about.team.colin.bio':     'Colin gerencia o dia a dia da localização Rundberg. Nascido e criado no Norte de Austin, toca na cena musical local, e traz um olhar de músico para o detalhe e a apresentação ao operar uma loja limpa, rápida e amigável.',
      'about.team.rick.role':     'Co-Dono',
      'about.team.rick.tag':      'Executivo de tecnologia local e influenciador',
      'about.team.rick.bio':      'Rick é um executivo de tecnologia de longa data em Austin e influenciador na comunidade de dados e IA. Traz uma visão de operações e experiência do cliente para o negócio familiar — meça tudo, depois melhore, em cada turno.',
      'about.team.simone.role':   'Co-Dona',
      'about.team.simone.tag':    'Artista local e filantropa',
      'about.team.simone.bio':    'Simone é uma artista de Austin ativa na comunidade local de artes e filantropia. Mantém o coração do negócio na frente e no centro — valores de comunidade primeiro, serviço de qualidade pelo menor preço justo, com lucros reinvestidos localmente.',

      'about.community.eyebrow':  'RETRIBUINDO',
      'about.community.title':    'Investindo no Centro de Austin',
      'about.community.text':     'Cada dobra, cada lavagem, cada dólar que entra pela nossa porta volta para Austin — para a equipe que vive aqui, fornecedores que operam aqui e causas que a família apoia aqui. Quando você escolhe a WaveMAX Austin, não está comprando lavanderia de uma rede. Está investindo nos seus vizinhos.',

      'about.cta.text':           'Venha conhecer a família. Estamos em 825 E Rundberg Ln F1, todos os dias, 7h–22h.',
      'about.cta.callBtn':        'Ligue para nós',
      'about.cta.directionsBtn':  'Ver direções'
    },

    de: {
      'about.title':              'Über WaveMAX Austin',
      'about.tagline':            'Ein Familienunternehmen, das ein besseres Austin Wäsche für Wäsche aufbaut.',
      'about.subtitle':           'WaveMAX Austin ist im Besitz und wird betrieben von der Familie Houlihan. Wir haben uns für WaveMAX entschieden, weil wir daran glauben, unserer Gemeinschaft etwas zurückzugeben, indem wir in beste Qualität und Service zum niedrigsten Preis investieren — und lokal aufbauen, jeden Tag.',
      'about.callBtn':            'Anrufen',
      'about.directionsBtn':      'Besuchen Sie uns',

      'about.stats.founded':      'Austin Bedient Seit',
      'about.stats.owners':       'Familieninhaber',
      'about.stats.local':        'Austin Lokal',
      'about.stats.disciplines':  'Disziplinen',
      'about.stats.community':    'Gemeinschaft Zuerst',

      'about.mission.eyebrow':    'WARUM WAVEMAX',
      'about.mission.title':      'Warum wir WaveMAX gewählt haben',
      'about.mission.body1':      'Wir sind drei Einheimische aus Austin, die in unsere Nachbarschaft investieren wollten — nicht nur einen Scheck schreiben, sondern etwas aufbauen, das den Menschen, die hier leben, echten Wert liefert.',
      'about.mission.body2':      'WaveMAX ist die Plattform, die uns das ermöglicht: erstklassige Ausrüstung, Wassersterilisation auf Krankenhausniveau und ein Servicemodell, das darauf ausgelegt ist, Preise niedrig und Qualität hoch zu halten. Wir können unsere Werte in die Praxis umsetzen — Gemeinschaft zuerst, Qualität immer — und die Menschen erhalten das sauberste, schnellste und freundlichste Wäscheerlebnis im Zentrum von Austin.',
      'about.mission.proud':      'Stolz darauf, die Gemeinschaft im Zentrum von Austin seit 2025 zu bedienen.',

      'about.values.eyebrow':     'UNSERE WERTE',
      'about.values.title':       'Unsere Werte, bei jeder Wäsche',
      'about.values.v1.t':        'Gemeinschaft zuerst.',
      'about.values.v1.b':        'Gewinne werden lokal reinvestiert — Mitarbeiter, Ausrüstung und Unterstützung von Austin-Anliegen, die uns wichtig sind.',
      'about.values.v2.t':        'Erstklassige Qualität.',
      'about.values.v2.b':        'Omni LUX UV-sterilisiertes Wasser, umweltfreundliches hypoallergenes Waschmittel, kalibrierte Wiegungen, von Hand gefaltete Ergebnisse.',
      'about.values.v3.t':        'Niedrigster fairer Preis.',
      'about.values.v3.b':        'Keine versteckten Gebühren, keine Verträge, keine Abonnements. Nur Karten, transparente Preise — zahlen Sie für das, was Sie nutzen.',
      'about.values.v4.t':        'Immer geöffnet.',
      'about.values.v4.b':        '7–22 Uhr, jeden Tag, 365 Tage im Jahr. Wir sind hier, wenn der Waschtag wirklich stattfindet.',
      'about.values.v5.t':        'Freundlicher Service.',
      'about.values.v5.b':        'Voll besetzte Filiale. Echte Menschen, kein Automat. Brauchen Sie Hilfe? Wir sind da.',

      'about.team.eyebrow':       'LERNEN SIE DIE INHABER KENNEN',
      'about.team.title':         'Die Familie Houlihan',
      'about.team.lede':          'Drei Einheimische aus Austin — ein Musiker, ein Technologie-Executive und eine Künstlerin — die das geschäftigste WaveMAX in Texas betreiben. Verschiedene Welten, derselbe Wert: Investiere in deine Gemeinschaft.',
      'about.team.colin.role':    'Inhaber / Betreiber',
      'about.team.colin.tag':     'Lokaler aus Nord-Austin · arbeitender Musiker',
      'about.team.colin.bio':     'Colin leitet den Tagesbetrieb am Standort Rundberg. Geboren und aufgewachsen in Nord-Austin, spielt in der lokalen Musikszene und bringt das Auge eines arbeitenden Musikers für Details und Showmanship in den Betrieb einer sauberen, schnellen und freundlichen Filiale ein.',
      'about.team.rick.role':     'Mitinhaber',
      'about.team.rick.tag':      'Lokaler Technologie-Executive & Influencer',
      'about.team.rick.bio':      'Rick ist ein langjähriger Technologie-Executive in Austin und Influencer in der Daten- und KI-Community. Er bringt eine Betriebs- und Kundenerlebnis-Perspektive in das Familienunternehmen ein — alles messen, dann verbessern, in jeder Schicht.',
      'about.team.simone.role':   'Mitinhaberin',
      'about.team.simone.tag':    'Lokale Künstlerin & Philanthropin',
      'about.team.simone.bio':    'Simone ist eine Austin-Künstlerin, die in der lokalen Kunst- und Philanthropie-Community aktiv ist. Sie hält das Herz des Unternehmens vorne und in der Mitte — Gemeinschaft-zuerst-Werte, Qualitätsservice zum niedrigsten fairen Preis, mit lokal reinvestierten Gewinnen.',

      'about.community.eyebrow':  'ZURÜCKGEBEN',
      'about.community.title':    'Investitionen in das Zentrum von Austin',
      'about.community.text':     'Jede Falte, jede Wäsche, jeder Dollar, der durch unsere Tür kommt, geht zurück nach Austin — an Mitarbeiter, die hier leben, Lieferanten, die hier tätig sind, und Anliegen, die die Familie hier unterstützt. Wenn Sie WaveMAX Austin wählen, kaufen Sie keine Wäsche von einer Kette. Sie investieren in Ihre Nachbarn.',

      'about.cta.text':           'Kommen Sie und treffen Sie die Familie. Wir sind in 825 E Rundberg Ln F1, jeden Tag, 7–22 Uhr.',
      'about.cta.callBtn':        'Rufen Sie uns an',
      'about.cta.directionsBtn':  'Wegbeschreibung'
    }
  };

  /* ---------- SEO ---------- */
  const PAGE_URL    = 'https://wavemax.promo/dev/austin-host-mock.html?route=/about-us';
  const HOST_URL    = 'https://wavemax.promo/austin-tx/';
  const HERO_IMG    = 'https://wavemaxlaundry.com/wp-content/uploads/locations/austin-tx/hero-1.jpg';
  const BUSINESS_ID = 'https://www.wavemaxlaundry.com/austin-tx/#localbusiness';

  const SEO = {
    meta: {
      title:        'About WaveMAX Austin · The Houlihan Family · Serving Central Austin since 2025',
      description:  'WaveMAX Austin is owned and operated by the Houlihan family — Colin (musician), Rick (technology executive), and Simone (artist and philanthropist). Three Austin locals giving back to the community by delivering best-in-class laundry service at the lowest fair price.',
      canonicalUrl: PAGE_URL,
      author:       'WaveMAX Laundry Austin',
      keywords:     'about wavemax austin, houlihan family laundry, family owned laundromat austin, north austin laundry owners, austin local business, community-first laundromat, wavemax owners austin'
    },
    openGraph: {
      title:       'About WaveMAX Austin · The Houlihan Family',
      description: 'Family-owned laundromat in North Austin. Community first, quality always. Serving Central Austin since 2025.',
      type:        'website',
      url:         PAGE_URL,
      image:       HERO_IMG,
      imageWidth:  '1200',
      imageHeight: '630',
      siteName:    'WaveMAX Laundry',
      locale:      'en_US'
    },
    twitter: {
      card:        'summary_large_image',
      title:       'About WaveMAX Austin · Family Owned',
      description: 'The Houlihan family — three Austin locals giving back to the community through best-in-class laundry service.',
      image:       HERO_IMG,
      imageAlt:    'WaveMAX Laundry Austin family-owned laundromat'
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
        foundingDate:  '2025',
        founder: [
          { '@type': 'Person', name: 'Colin Houlihan',  jobTitle: 'Owner / Operator' },
          { '@type': 'Person', name: 'Rick Houlihan',   jobTitle: 'Co-Owner' },
          { '@type': 'Person', name: 'Simone Houlihan', jobTitle: 'Co-Owner' }
        ],
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
        }]
      },
      // AboutPage describes this URL as the "about" of the business —
      // helps search engines tie the owner / company info to the
      // LocalBusiness entity above.
      aboutPage: {
        '@context':   'https://schema.org',
        '@type':      'AboutPage',
        '@id':        PAGE_URL + '#aboutpage',
        url:          PAGE_URL,
        name:         'About WaveMAX Austin',
        description:  'About the Houlihan family — owners and operators of WaveMAX Austin. Family-owned, community-first, serving Central Austin since 2025.',
        primaryImageOfPage: { '@type': 'ImageObject', url: HERO_IMG },
        about:        { '@id': BUSINESS_ID },
        mainEntity:   { '@id': BUSINESS_ID },
        inLanguage:   ['en', 'es', 'pt', 'de']
      },
      breadcrumb: {
        '@context': 'https://schema.org',
        '@type':    'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'WaveMAX Laundry', item: 'https://www.wavemaxlaundry.com/' },
          { '@type': 'ListItem', position: 2, name: 'Austin, TX',      item: HOST_URL },
          { '@type': 'ListItem', position: 3, name: 'About Us'                                              }
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

  /* ---------- Hero watermark ---------- */
  // Hero watermark + SEO are now driven from LOCATION_DATA via the
  // shared FranchisePage helper. The Austin URL that used to live here
  // moved to images.hero[0] in the per-franchise registry.
  function setHeroWatermark(data) {
    if (window.FranchisePage) window.FranchisePage.applyHeroWatermark(data);
  }

  /* ---------- data-bind ---------- */
  function applyBindings(data) {
    if (!data) return;
    document.querySelectorAll('[data-bind]').forEach((el) => {
      const path = el.getAttribute('data-bind');
      const value = path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), data);
      if (value === undefined || value === null) return;
      const attr = el.getAttribute('data-bind-attr');
      if (attr) el.setAttribute(attr, String(value));
      else el.textContent = String(value);
    });
  }

  /* ---------- Team grid ----------
   * Renders LOCATION_DATA.owners[] into the team grid. Empty array →
   * single placeholder card. avatarStyle drives the disc gradient
   * (primary | secondary | amber | …); falls back to primary.
   *
   * No data-i18n on the rendered cards: bios are franchise-specific
   * data, not translatable copy. If a franchise wants multilingual
   * bios, they'd ship per-language strings inside owner.bio
   * (a future schema extension; not v1).
   */
  function avatarClassFor(style) {
    const s = (style || 'primary').toLowerCase();
    return 'wm-about-team-avatar wm-about-team-avatar--' + s;
  }
  function initialFor(name) {
    const trimmed = (name || '?').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
  }
  function escapeText(s) { return String(s == null ? '' : s); }

  function renderTeamGrid(data) {
    const grid = document.getElementById('wm-about-team-grid');
    if (!grid) return;
    const owners = (data && Array.isArray(data.owners)) ? data.owners : [];

    grid.innerHTML = '';

    if (owners.length === 0) {
      // Placeholder so the grid never collapses for franchises that
      // haven't filled in their owner block yet. Generic, friendly,
      // doesn't claim to be anyone in particular.
      const card = document.createElement('article');
      card.className = 'wm-about-team-card';
      card.innerHTML =
        '<div class="' + avatarClassFor('primary') + '" aria-hidden="true">' +
          '<span class="wm-about-team-initial">★</span>' +
        '</div>' +
        '<h3 class="wm-about-team-name">Local owner-operator</h3>' +
        '<p class="wm-about-team-role">Owner / Operator</p>' +
        '<p class="wm-about-team-tag">Coming soon</p>' +
        '<p class="wm-about-team-bio">Local owner committed to your community. Full bio coming soon — check back as the team grows.</p>';
      grid.appendChild(card);
      return;
    }

    owners.forEach((o) => {
      const card = document.createElement('article');
      card.className = 'wm-about-team-card';
      const safeName = escapeText(o && o.name);
      const role = escapeText(o && o.role);
      const tag  = escapeText(o && o.tag);
      const bio  = escapeText(o && o.bio);
      // Build with createElement to avoid HTML injection from the JSON
      // (owner names/bios are operator-supplied content).
      const avatar = document.createElement('div');
      avatar.className = avatarClassFor(o && o.avatarStyle);
      avatar.setAttribute('aria-hidden', 'true');
      const initial = document.createElement('span');
      initial.className = 'wm-about-team-initial';
      initial.textContent = initialFor(safeName);
      avatar.appendChild(initial);
      card.appendChild(avatar);
      const nameEl = document.createElement('h3');
      nameEl.className = 'wm-about-team-name';
      nameEl.textContent = safeName;
      card.appendChild(nameEl);
      if (role) {
        const r = document.createElement('p');
        r.className = 'wm-about-team-role';
        r.textContent = role;
        card.appendChild(r);
      }
      if (tag) {
        const t = document.createElement('p');
        t.className = 'wm-about-team-tag';
        t.textContent = tag;
        card.appendChild(t);
      }
      if (bio) {
        const b = document.createElement('p');
        b.className = 'wm-about-team-bio';
        b.textContent = bio;
        card.appendChild(b);
      }
      grid.appendChild(card);
    });
  }

  /* ---------- About-content overrides ----------
   * Apply LOCATION_DATA.aboutContent.* values to the data-i18n-keyed
   * elements that the translations dictionary normally handles. When
   * an aboutContent field is empty, the existing translation default
   * stays in place (translatePage already ran by the time we get
   * called — we just override what the franchise has supplied).
   *
   * Also handles missionBody (array of paragraphs) which doesn't fit
   * the simple key→string model: replaces the two .wm-about-card-body
   * paragraphs in the mission card with whatever the franchise shipped.
   */
  function setText(selector, value) {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }
  function setMissionBody(paragraphs) {
    if (!Array.isArray(paragraphs) || paragraphs.length === 0) return;
    const card = document.querySelector('.wm-about-card-mission');
    if (!card) return;
    // Find existing body paragraphs (excluding the emphasized "proud" line)
    const bodyEls = card.querySelectorAll('.wm-about-card-body:not(.wm-about-card-emphasis)');
    paragraphs.forEach((p, i) => {
      if (bodyEls[i]) bodyEls[i].textContent = p;
    });
  }
  function applyAboutContent(data) {
    const a = data && data.aboutContent;
    if (!a) return;

    setText('.wm-hero-title',                      a.heroTitle);
    setText('.wm-hero-tagline',                    a.heroTagline);
    setText('.wm-hero-subtitle',                   a.heroSubtitle);
    setText('.wm-about-card-mission .wm-about-card-eyebrow', a.missionEyebrow);
    setText('.wm-about-card-mission .wm-about-card-title',   a.missionTitle);
    setMissionBody(a.missionBody);
    setText('.wm-about-card-mission .wm-about-card-emphasis', a.missionProud);
    setText('.wm-about-card-values .wm-about-card-eyebrow',  a.valuesEyebrow);
    setText('.wm-about-card-values .wm-about-card-title',    a.valuesTitle);
    // Values list: replace items if franchise supplied 5+ entries
    if (Array.isArray(a.values) && a.values.length > 0) {
      const list = document.querySelector('.wm-about-values-list');
      if (list) {
        list.innerHTML = '';
        a.values.forEach((v) => {
          const li = document.createElement('li');
          if (v.title) {
            const strong = document.createElement('strong');
            strong.textContent = v.title;
            li.appendChild(strong);
            li.appendChild(document.createTextNode(' '));
          }
          if (v.body) {
            const span = document.createElement('span');
            span.textContent = v.body;
            li.appendChild(span);
          }
          list.appendChild(li);
        });
      }
    }
    setText('.wm-about-team .wm-about-eyebrow',     a.teamEyebrow);
    setText('.wm-about-team .wm-about-section-title', a.teamTitle);
    setText('.wm-about-team .wm-about-section-lede', a.teamLede);
    setText('.wm-about-community .wm-about-eyebrow', a.communityEyebrow);
    setText('.wm-about-community .wm-about-section-title', a.communityTitle);
    setText('.wm-about-community-text',             a.communityText);
    setText('.wm-cta-strip-text',                   a.ctaText);
    // Stat band — replace numbers + labels per slot when supplied.
    if (a.stats) {
      const cards = document.querySelectorAll('.wm-stats .wm-stat-card');
      const order = ['founded', 'owners', 'local', 'extra', 'community'];
      order.forEach((key, i) => {
        const stat = a.stats[key];
        if (!stat || !cards[i]) return;
        if (stat.number) cards[i].querySelector('.wm-stat-number').textContent = stat.number;
        if (stat.label)  cards[i].querySelector('.wm-stat-label').textContent  = stat.label;
      });
    }
  }

  /* ---------- Init ---------- */
  function init() {
    if (!window.IframeBridge) {
      console.error('[austin-about] IframeBridge missing — bridge script must load first');
      return;
    }
    window.IframeBridge.loadTranslations(TRANSLATIONS);
    window.IframeBridge.init({ pageIdentifier: 'austin-about', enableTranslation: true, enableAutoResize: true });
    // SEO is built from LOCATION_DATA inside onLocationData below.

    window.IframeBridge.onLocationData((data) => {
      applyBindings(data);
      setHeroWatermark(data);
      renderTeamGrid(data);
      applyAboutContent(data);
      if (window.FranchisePage) {
        const seo = window.FranchisePage.buildSeo(data, 'about-us');
        if (seo) window.IframeBridge.loadSEOConfig(seo);
      }
      if (window.IframeBridge && window.IframeBridge.updateHeight) window.IframeBridge.updateHeight();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
