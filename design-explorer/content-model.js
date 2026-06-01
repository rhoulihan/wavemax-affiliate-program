'use strict';

// design-explorer/content-model.js
//
// Skin-agnostic shared content model for the 6 WaveMAX Austin marketing pages.
// Strings sourced from public/locales/<lang>/common.json where keys exist;
// page-level copy for ss/wdf/com/about/contact is lifted from the franchise
// HTML data-i18n inline text (those keys are not in common.json).
// ES falls back to EN when a string is missing.

// ─── Constants ──────────────────────────────────────────────────────────────

const NAP = {
  name: 'WaveMAX Laundry Austin',
  street: '825 E Rundberg Ln F1',
  city: 'Austin', state: 'TX', zip: '78753',
  phone: '(512) 553-1674', phoneTel: '+15125531674',
  hours: 'Open daily · 7:00 am – 10:00 pm',
  mapsDir: 'https://www.google.com/maps/dir/?api=1&destination=825+E+Rundberg+Ln+F1+Austin+TX+78753',
  mapsEmbed: 'https://www.google.com/maps?q=WaveMAX+Laundry,+825+E+Rundberg+Ln,+Austin,+TX+78753&output=embed&t=k&z=16',
};

const TRADEMARK_NOTICE =
  'WaveMAX™ and the WaveMAX logo are trademarks of WaveMAX Franchise, LLC. ' +
  'This location is independently owned and operated by CRHS Enterprises, LLC ' +
  'under a franchise license from WaveMAX Franchise, LLC.';

const PAGES = ['home', 'self-serve', 'wash-dry-fold', 'commercial', 'about', 'contact'];
const LANGS = ['en', 'es', 'pt', 'de'];

// ─── Per-page content builders ───────────────────────────────────────────────
// Each builder takes a lang string and returns { hero, sections, cta }.
// ES deep-clones its own constants (structuredClone) so EN/ES never share refs.

// ─── home ────────────────────────────────────────────────────────────────────
// Re-based on public/franchise-default/landing.html — the REAL Austin location
// landing: a self-serve + wash-dry-fold laundromat (NO pickup/delivery; that
// framing belongs to the affiliate program, not this physical store). Content
// is hardcoded here (mirrors the other page builders) so it doesn't leak the
// affiliate-program copy that lives under common.json `landing.*`.

const HOME_EN = {
  hero: {
    title: "Austin's cleanest self-serve laundry + wash-dry-fold",
    sub: '42 Electrolux 450G washers and 42 fast dryers, hospital-grade UV-sanitized water, free WiFi and free parking — open every day 7am–10pm in North Austin on Rundberg. Wash it yourself or drop off your wash-dry-fold at $1.20/lb with 24-hour turnaround. Cards only, no cash needed.',
    badge: '4.8 ★ on Google',
  },
  sections: [
    {
      id: 'stats',
      kind: 'stats',
      title: '',
      items: [
        { label: 'Electrolux Washers', value: '42' },
        { label: 'Fast Dryers', value: '42' },
        { label: 'Open Daily', value: '7am–10pm' },
        { label: 'Wash-Dry-Fold', value: '$1.20/lb' },
        { label: 'WDF Turnaround', value: '24hr' },
      ],
    },
    {
      id: 'services',
      kind: 'tabs',
      title: 'Two ways to get clean laundry',
      sub: 'Wash it yourself on our floor, or drop off your wash-dry-fold and walk out. Commercial accounts welcome.',
      tabs: ['self-serve', 'wash-dry-fold', 'commercial'],
    },
    {
      id: 'howItWorks',
      kind: 'steps',
      title: 'Wash-dry-fold in three steps',
      items: [
        { title: 'Drop off, walk out', body: '2-minute drop-off. We weigh it, then wash, dry, and fold with hospital-grade UV sanitization.' },
        { title: '24-hour turnaround', body: 'Drop off in the morning, pick up the next day. Need it faster? Ask about same-day.' },
        { title: 'Simple pricing', body: '$1.20/lb, 10lb minimum. Detergent, dryer sheets, and hangers included. Cards-only payment, no cash needed.' },
      ],
    },
    {
      id: 'quality',
      kind: 'cards',
      title: 'Why WaveMAX Austin',
      sub: 'Premium equipment, hospital-grade sanitization, and a fully attended floor every shift.',
      items: [
        { title: 'Electrolux CompassPro 450G', body: '20-minute washes, 20-minute dries. High-spin 450G machines mean less time waiting and more time doing what you\'d rather be doing.' },
        { title: 'Omni LUX UV Water Sanitization', body: 'Every wash cycle benefits from our Hospital Grade UV Water Sanitization system — 99.9% pathogen kill before the water ever touches your clothes.' },
        { title: 'Free WiFi, free parking', body: 'Wheelchair accessible, free parking, attended every shift. Bring a laptop — the WiFi\'s fast enough to actually work.' },
      ],
    },
    {
      id: 'reviews',
      kind: 'reviews',
      title: 'What our customers say',
      sub: 'Five-star reviews from neighbors across North Austin.',
      items: [
        { quote: 'Cleanest laundromat I\'ve been to in Austin. The machines are fast and there\'s always an attendant around to help.', name: 'Marisol R.', meta: 'North Austin' },
        { quote: 'Dropped off two weeks of laundry, picked it up the next day perfectly folded. The wash-dry-fold is worth every penny.', name: 'James T.', meta: 'Rundberg Ln' },
        { quote: 'Big 80-lb machines got my comforters done in one load. Free parking and free WiFi make it easy to get in and out.', name: 'Aisha K.', meta: 'Georgian Acres' },
      ],
    },
  ],
  cta: {
    title: 'Ready to do laundry the easy way?',
    sub: 'Wash it yourself or drop off your wash-dry-fold — open daily 7am–10pm at 825 E Rundberg Ln F1.',
    primaryLabel: 'Get Directions',
  },
};

const HOME_ES = {
  hero: {
    title: 'El autoservicio de lavandería + lava-seca-dobla más limpio de Austin',
    sub: '42 lavadoras Electrolux 450G y 42 secadoras rápidas, agua sanitizada con UV de grado hospitalario, WiFi gratis y estacionamiento gratis — abierto todos los días de 7am a 10pm en el norte de Austin sobre Rundberg. Lava tú mismo o deja tu lava-seca-dobla a $1.20/lb, lista en 24 horas. Solo tarjetas, sin efectivo.',
    badge: '4.8 ★ en Google',
  },
  sections: [
    {
      id: 'stats',
      kind: 'stats',
      title: '',
      items: [
        { label: 'Lavadoras Electrolux', value: '42' },
        { label: 'Secadoras rápidas', value: '42' },
        { label: 'Abierto a diario', value: '7am–10pm' },
        { label: 'Lava-Seca-Dobla', value: '$1.20/lb' },
        { label: 'Lista en', value: '24hr' },
      ],
    },
    {
      id: 'services',
      kind: 'tabs',
      title: 'Dos maneras de tener ropa limpia',
      sub: 'Lava tú mismo en nuestro local, o deja tu lava-seca-dobla y sal listo. Cuentas comerciales bienvenidas.',
      tabs: ['self-serve', 'wash-dry-fold', 'commercial'],
    },
    {
      id: 'howItWorks',
      kind: 'steps',
      title: 'Lava-seca-dobla en tres pasos',
      items: [
        { title: 'Déjala y sal', body: 'Déjala en 2 minutos. La pesamos, luego lavamos, secamos y doblamos con sanitización UV de grado hospitalario.' },
        { title: 'Lista en 24 horas', body: 'Déjala en la mañana, está lista al día siguiente. ¿Necesitas algo más rápido? Pregunta por el servicio del mismo día.' },
        { title: 'Precios simples', body: '$1.20/lb, mínimo 10 lb. Detergente, hojas para secadora y ganchos incluidos. Solo tarjetas, sin efectivo.' },
      ],
    },
    {
      id: 'quality',
      kind: 'cards',
      title: 'Por qué WaveMAX Austin',
      sub: 'Equipos de primera, sanitización de grado hospitalario y un local atendido en cada turno.',
      items: [
        { title: 'Electrolux CompassPro 450G', body: 'Lavados de 20 minutos, secados de 20 minutos. Las máquinas de alta centrifugación 450G significan menos tiempo esperando y más tiempo haciendo lo que prefieres.' },
        { title: 'Sanitización UV de agua Omni LUX', body: 'Cada ciclo de lavado se beneficia de nuestro sistema de sanitización UV de agua de grado hospitalario — eliminación del 99.9% de patógenos antes de que el agua toque tu ropa.' },
        { title: 'WiFi gratis, estacionamiento gratis', body: 'Accesible para sillas de ruedas, estacionamiento gratuito, atendido en cada turno. Trae tu laptop — el WiFi es suficientemente rápido para trabajar de verdad.' },
      ],
    },
    {
      id: 'reviews',
      kind: 'reviews',
      title: 'Lo que dicen nuestros clientes',
      sub: 'Reseñas de cinco estrellas de vecinos del norte de Austin.',
      items: [
        { quote: 'La lavandería más limpia en la que he estado en Austin. Las máquinas son rápidas y siempre hay alguien para ayudar.', name: 'Marisol R.', meta: 'Norte de Austin' },
        { quote: 'Dejé dos semanas de ropa y la recogí al día siguiente perfectamente doblada. El lava-seca-dobla vale cada centavo.', name: 'James T.', meta: 'Rundberg Ln' },
        { quote: 'Las máquinas grandes de 80 lb lavaron mis edredones en una sola carga. El estacionamiento y el WiFi gratis facilitan todo.', name: 'Aisha K.', meta: 'Georgian Acres' },
      ],
    },
  ],
  cta: {
    title: '¿Listo para lavar de la manera fácil?',
    sub: 'Lava tú mismo o deja tu lava-seca-dobla — abierto todos los días de 7am a 10pm en 825 E Rundberg Ln F1.',
    primaryLabel: 'Cómo llegar',
  },
};

const HOME_PT = {
  hero: {
    title: 'A lavanderia de autoatendimento + lavar-secar-dobrar mais limpa de Austin',
    sub: '42 lavadoras Electrolux 450G e 42 secadoras rápidas, água com sanitização UV de grau hospitalar, WiFi grátis e estacionamento grátis — aberta todos os dias das 7h às 22h no norte de Austin na Rundberg. Lave você mesmo ou deixe sua roupa no serviço lavar-secar-dobrar a $1,20/lb, pronta em 24 horas. Só cartão, sem dinheiro.',
    badge: '4,8 ★ no Google',
  },
  sections: [
    {
      id: 'stats',
      kind: 'stats',
      title: '',
      items: [
        { label: 'Lavadoras Electrolux', value: '42' },
        { label: 'Secadoras Rápidas', value: '42' },
        { label: 'Aberta Todo Dia', value: '7h–22h' },
        { label: 'Lavar-Secar-Dobrar', value: '$1,20/lb' },
        { label: 'Prazo LSD', value: '24h' },
      ],
    },
    {
      id: 'services',
      kind: 'tabs',
      title: 'Duas formas de ter roupa limpa',
      sub: 'Lave você mesmo em nossas máquinas, ou deixe sua roupa no lavar-secar-dobrar e saia. Contas comerciais bem-vindas.',
      tabs: ['self-serve', 'wash-dry-fold', 'commercial'],
    },
    {
      id: 'howItWorks',
      kind: 'steps',
      title: 'Lavar-secar-dobrar em três passos',
      items: [
        { title: 'Deixe sua roupa e vá', body: 'Atendimento em 2 minutos. Pesamos, lavamos, secamos e dobramos com sanitização UV de grau hospitalar.' },
        { title: 'Pronta em 24 horas', body: 'Deixe de manhã, sua roupa fica pronta no dia seguinte. Precisa mais rápido? Pergunte sobre o mesmo dia.' },
        { title: 'Preço simples', body: '$1,20/lb, mínimo de 10 lb. Sabão em pó, folhas para secadora e cabides incluídos. Só cartão, sem dinheiro.' },
      ],
    },
    {
      id: 'quality',
      kind: 'cards',
      title: 'Por que WaveMAX Austin',
      sub: 'Equipamentos de primeira linha, sanitização de grau hospitalar e atendimento completo em cada turno.',
      items: [
        { title: 'Electrolux CompassPro 450G', body: 'Lavagem em 20 minutos, secagem em 20 minutos. As máquinas de alta centrifugação 450G significam menos tempo esperando e mais tempo fazendo o que você prefere.' },
        { title: 'Sanitização UV de Água Omni LUX', body: 'Cada ciclo de lavagem conta com nosso sistema de Sanitização UV de Água de Grau Hospitalar — eliminação de 99,9% de patógenos antes de a água tocar suas roupas.' },
        { title: 'WiFi grátis, estacionamento grátis', body: 'Acessível para cadeiras de rodas, estacionamento gratuito, atendimento em cada turno. Traga seu notebook — o WiFi é rápido o suficiente para trabalhar de verdade.' },
      ],
    },
    {
      id: 'reviews',
      kind: 'reviews',
      title: 'O que nossos clientes dizem',
      sub: 'Avaliações cinco estrelas de vizinhos do norte de Austin.',
      items: [
        { quote: 'A lavanderia mais limpa que já fui em Austin. As máquinas são rápidas e sempre tem alguém para ajudar.', name: 'Marisol R.', meta: 'Norte de Austin' },
        { quote: 'Deixei duas semanas de roupa e fui buscar no dia seguinte perfeitamente dobrada. O lavar-secar-dobrar vale cada centavo.', name: 'James T.', meta: 'Rundberg Ln' },
        { quote: 'As máquinas grandes de 80 lb lavaram meus edredons em uma única carga. O estacionamento e o WiFi grátis facilitam tudo.', name: 'Aisha K.', meta: 'Georgian Acres' },
      ],
    },
  ],
  cta: {
    title: 'Pronto para lavar com facilidade?',
    sub: 'Lave você mesmo ou deixe sua roupa no lavar-secar-dobrar — aberta todos os dias das 7h às 22h na 825 E Rundberg Ln F1.',
    primaryLabel: 'Como Chegar',
  },
};

const HOME_DE = {
  hero: {
    title: 'Austins sauberste SB-Wäscherei + Waschen-Trocknen-Falten',
    sub: '42 Electrolux-450G-Waschmaschinen und 42 schnelle Trockner, krankenhausreines UV-desinfiziertes Wasser, kostenloses WLAN und kostenfreie Parkplätze — täglich geöffnet von 7 bis 22 Uhr in Nord-Austin an der Rundberg. Waschen Sie selbst oder geben Sie Ihre Wäsche zum Waschen-Trocknen-Falten für $1,20/lb ab, fertig in 24 Std. Nur Kartenzahlung, kein Bargeld.',
    badge: '4,8 ★ bei Google',
  },
  sections: [
    {
      id: 'stats',
      kind: 'stats',
      title: '',
      items: [
        { label: 'Electrolux-Waschmaschinen', value: '42' },
        { label: 'Schnelle Trockner', value: '42' },
        { label: 'Tägl. geöffnet', value: '7–22 Uhr' },
        { label: 'Waschen-Trocknen-Falten', value: '$1,20/lb' },
        { label: 'Bearbeitungszeit', value: '24 Std.' },
      ],
    },
    {
      id: 'services',
      kind: 'tabs',
      title: 'Zwei Wege zu sauberer Wäsche',
      sub: 'Waschen Sie selbst an unseren Maschinen oder geben Sie Ihre Wäsche zum Waschen-Trocknen-Falten ab. Gewerbekunden willkommen.',
      tabs: ['self-serve', 'wash-dry-fold', 'commercial'],
    },
    {
      id: 'howItWorks',
      kind: 'steps',
      title: 'Waschen-Trocknen-Falten in drei Schritten',
      items: [
        { title: 'Wäsche abgeben, fertig', body: 'Abgabe in 2 Minuten. Wir wiegen, waschen, trocknen und falten mit krankenhausreiner UV-Desinfektion.' },
        { title: 'Fertig in 24 Stunden', body: 'Morgens abgeben, am nächsten Tag abholen. Brauchen Sie es schneller? Fragen Sie nach dem Expressservice.' },
        { title: 'Einfache Preise', body: '$1,20/lb, Mindestmenge 10 lb. Waschmittel, Trocknertücher und Kleiderbügel inklusive. Nur Kartenzahlung, kein Bargeld.' },
      ],
    },
    {
      id: 'quality',
      kind: 'cards',
      title: 'Warum WaveMAX Austin',
      sub: 'Erstklassige Geräte, krankenhausreine Desinfektion und vollständig betreuter Betrieb in jeder Schicht.',
      items: [
        { title: 'Electrolux CompassPro 450G', body: '20 Minuten Waschen, 20 Minuten Trocknen. Die Hochschleuder-450G-Maschinen bedeuten weniger Wartezeit und mehr Zeit für das, was Ihnen wichtiger ist.' },
        { title: 'Omni LUX UV-Wasser­desinfektion', body: 'Jeder Waschgang profitiert von unserem UV-Wasser­desinfektionssystem in Krankenhausqualität — 99,9 % Keimreduktion, bevor das Wasser Ihre Kleidung berührt.' },
        { title: 'Kostenloses WLAN, kostenfreie Parkplätze', body: 'Barrierefrei, kostenfreie Parkplätze, betreuter Betrieb in jeder Schicht. Bringen Sie Ihren Laptop — das WLAN ist schnell genug zum Arbeiten.' },
      ],
    },
    {
      id: 'reviews',
      kind: 'reviews',
      title: 'Was unsere Kunden sagen',
      sub: 'Fünf-Sterne-Bewertungen von Nachbarn aus Nord-Austin.',
      items: [
        { quote: 'Die sauberste Wäscherei, die ich je in Austin besucht habe. Die Maschinen sind schnell und es ist immer jemand da, der hilft.', name: 'Marisol R.', meta: 'Nord-Austin' },
        { quote: 'Ich habe zwei Wochen Wäsche abgegeben und sie am nächsten Tag perfekt gefaltet abgeholt. Das Waschen-Trocknen-Falten ist jeden Cent wert.', name: 'James T.', meta: 'Rundberg Ln' },
        { quote: 'Die großen 80-lb-Maschinen haben meine Bettdecken in einem Durchgang gewaschen. Kostenfreie Parkplätze und WLAN machen alles einfacher.', name: 'Aisha K.', meta: 'Georgian Acres' },
      ],
    },
  ],
  cta: {
    title: 'Bereit, Wäsche unkompliziert zu erledigen?',
    sub: 'Selbst waschen oder Wäsche abgeben — täglich geöffnet von 7 bis 22 Uhr, 825 E Rundberg Ln F1.',
    primaryLabel: 'Wegbeschreibung',
  },
};

function buildHome(lang) {
  const en = HOME_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, HOME_ES.hero),
      sections: structuredClone(HOME_ES.sections),
      cta: structuredClone(HOME_ES.cta),
    };
  }
  if (lang === 'pt') {
    return {
      hero: Object.assign({}, en.hero, HOME_PT.hero),
      sections: structuredClone(HOME_PT.sections),
      cta: structuredClone(HOME_PT.cta),
    };
  }
  if (lang === 'de') {
    return {
      hero: Object.assign({}, en.hero, HOME_DE.hero),
      sections: structuredClone(HOME_DE.sections),
      cta: structuredClone(HOME_DE.cta),
    };
  }
  return {
    hero: Object.assign({}, en.hero),
    sections: structuredClone(en.sections),
    cta: structuredClone(en.cta),
  };
}

// ─── self-serve ──────────────────────────────────────────────────────────────
// Hero text from franchise HTML data-i18n inline copy (keys ss.title / ss.subtitle.premium).
// No ES equivalent in common.json → EN fallback for all fields.

const SS_EN = {
  hero: {
    title: 'Wash on your time, in our space',
    sub: "Austin's cleanest self-serve laundromat — 42 Electrolux 450G washers, 42 fast dryers, hospital-grade UV-sanitized water, fully attended every shift. Family-owned, no-coin, no-membership. Wash 20 minutes, dry 20 minutes, out the door in under an hour.",
    tagline: 'CLEANER · FASTER · SAFER',
  },
  sections: [
    { id: 'stats', kind: 'stats', title: '', items: [
      { label: 'Washers', value: '42' },
      { label: 'Dryers', value: '42' },
      { label: 'Largest Load', value: '80lb' },
      { label: 'Faster Drying', value: '50%' },
      { label: 'UV Sanitization', value: '99.9%' },
    ]},
    { id: 'machines', kind: 'cards', title: 'Equipment', items: [
      { title: 'Electrolux CompassPro 450G Washers',
        body: '20-minute washes, 20-minute dries. High-spin 450G machines mean less time waiting and more time doing what you\'d rather be doing.' },
      { title: 'Omni LUX UV Water Sanitization',
        body: 'Every wash cycle benefits from our Hospital Grade UV Water Sanitization system — 99.9% pathogen kill before the water ever touches your clothes.' },
      { title: 'Free WiFi & Amenities',
        body: 'Wheelchair accessible, free parking, attended every shift. Bring a laptop — the WiFi\'s fast enough to actually work.' },
    ]},
    { id: 'pricing', kind: 'pricing', title: 'Simple pricing', items: [] },
  ],
  cta: {
    title: 'Ready to do laundry the easy way?',
    sub: 'Call us or stop by — open daily 7am–10pm.',
    primaryLabel: 'Get Directions',
  },
};

const SS_ES = {
  hero: {
    title: 'Lava cuando quieras, en nuestro espacio',
    sub: "La lavandería de autoservicio más limpia de Austin — 42 lavadoras Electrolux 450G, 42 secadoras rápidas, agua sanitizada con UV de grado hospitalario, atendida en cada turno. Familiar, sin monedas, sin membresía. Lava en 20 minutos, seca en 20 minutos, listo en menos de una hora.",
    tagline: 'MÁS LIMPIA · MÁS RÁPIDA · MÁS SEGURA',
  },
  sections: [
    { id: 'stats', kind: 'stats', title: '', items: [
      { label: 'Lavadoras', value: '42' },
      { label: 'Secadoras', value: '42' },
      { label: 'Carga máxima', value: '80lb' },
      { label: 'Secado más rápido', value: '50%' },
      { label: 'Sanitización UV', value: '99.9%' },
    ]},
    { id: 'machines', kind: 'cards', title: 'Equipos', items: [
      { title: 'Lavadoras Electrolux CompassPro 450G',
        body: 'Lavados de 20 minutos, secados de 20 minutos. Las máquinas de alta centrifugación 450G significan menos tiempo esperando y más tiempo haciendo lo que prefieres.' },
      { title: 'Sanitización UV de agua Omni LUX',
        body: 'Cada ciclo de lavado se beneficia de nuestro sistema de sanitización UV de agua de grado hospitalario — eliminación del 99.9% de patógenos antes de que el agua toque tu ropa.' },
      { title: 'WiFi gratis y comodidades',
        body: 'Accesible para sillas de ruedas, estacionamiento gratuito, atendida en cada turno. Trae tu laptop — el WiFi es suficientemente rápido para trabajar de verdad.' },
    ]},
    { id: 'pricing', kind: 'pricing', title: 'Precios simples', items: [] },
  ],
  cta: {
    title: '¿Listo para lavar de la manera fácil?',
    sub: 'Llámanos o pásate — abierto todos los días de 7am a 10pm.',
    primaryLabel: 'Cómo llegar',
  },
};

const SS_PT = {
  hero: {
    title: 'Lave no seu ritmo, no nosso espaço',
    sub: 'A lavanderia de autoatendimento mais limpa de Austin — 42 lavadoras Electrolux 450G, 42 secadoras rápidas, água com sanitização UV de grau hospitalar, com atendimento em cada turno. Familiar, sem moedas, sem mensalidade. Lave em 20 minutos, seque em 20 minutos, saia em menos de uma hora.',
    tagline: 'MAIS LIMPA · MAIS RÁPIDA · MAIS SEGURA',
  },
  sections: [
    { id: 'stats', kind: 'stats', title: '', items: [
      { label: 'Lavadoras', value: '42' },
      { label: 'Secadoras', value: '42' },
      { label: 'Maior Carga', value: '80 lb' },
      { label: 'Secagem Mais Rápida', value: '50%' },
      { label: 'Sanitização UV', value: '99,9%' },
    ]},
    { id: 'machines', kind: 'cards', title: 'Equipamentos', items: [
      { title: 'Lavadoras Electrolux CompassPro 450G',
        body: 'Lavagem em 20 minutos, secagem em 20 minutos. As máquinas de alta centrifugação 450G significam menos tempo esperando e mais tempo fazendo o que você prefere.' },
      { title: 'Sanitização UV de Água Omni LUX',
        body: 'Cada ciclo de lavagem conta com nosso sistema de Sanitização UV de Água de Grau Hospitalar — eliminação de 99,9% de patógenos antes de a água tocar suas roupas.' },
      { title: 'WiFi Grátis e Comodidades',
        body: 'Acessível para cadeiras de rodas, estacionamento gratuito, atendimento em cada turno. Traga seu notebook — o WiFi é rápido o suficiente para trabalhar de verdade.' },
    ]},
    { id: 'pricing', kind: 'pricing', title: 'Preços simples', items: [] },
  ],
  cta: {
    title: 'Pronto para lavar com facilidade?',
    sub: 'Ligue ou apareça — aberta todos os dias das 7h às 22h.',
    primaryLabel: 'Como Chegar',
  },
};

const SS_DE = {
  hero: {
    title: 'Waschen nach Ihrem Zeitplan, in unserem Raum',
    sub: 'Austins sauberste SB-Wäscherei — 42 Electrolux-450G-Waschmaschinen, 42 schnelle Trockner, krankenhausreines UV-desinfiziertes Wasser, vollständig betreut in jeder Schicht. Familiengeführt, ohne Münzen, ohne Mitgliedschaft. Waschen in 20 Minuten, trocknen in 20 Minuten, in unter einer Stunde fertig.',
    tagline: 'SAUBERER · SCHNELLER · SICHERER',
  },
  sections: [
    { id: 'stats', kind: 'stats', title: '', items: [
      { label: 'Waschmaschinen', value: '42' },
      { label: 'Trockner', value: '42' },
      { label: 'Größte Ladung', value: '80 lb' },
      { label: 'Schnelleres Trocknen', value: '50 %' },
      { label: 'UV-Desinfektion', value: '99,9 %' },
    ]},
    { id: 'machines', kind: 'cards', title: 'Ausstattung', items: [
      { title: 'Electrolux CompassPro 450G Waschmaschinen',
        body: '20 Minuten Waschen, 20 Minuten Trocknen. Die Hochschleuder-450G-Maschinen bedeuten weniger Wartezeit und mehr Zeit für das, was Ihnen wichtiger ist.' },
      { title: 'Omni LUX UV-Wasserdesinfektion',
        body: 'Jeder Waschgang profitiert von unserem UV-Wasser­desinfektionssystem in Krankenhausqualität — 99,9 % Keimreduktion, bevor das Wasser Ihre Kleidung berührt.' },
      { title: 'Kostenloses WLAN und Annehmlichkeiten',
        body: 'Barrierefrei, kostenfreie Parkplätze, betreuter Betrieb in jeder Schicht. Bringen Sie Ihren Laptop — das WLAN ist schnell genug zum Arbeiten.' },
    ]},
    { id: 'pricing', kind: 'pricing', title: 'Einfache Preise', items: [] },
  ],
  cta: {
    title: 'Bereit, Wäsche unkompliziert zu erledigen?',
    sub: 'Rufen Sie an oder kommen Sie vorbei — täglich geöffnet von 7 bis 22 Uhr.',
    primaryLabel: 'Wegbeschreibung',
  },
};

function buildSelfServe(lang) {
  const en = SS_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, SS_ES.hero),
      sections: structuredClone(SS_ES.sections),
      cta: structuredClone(SS_ES.cta),
    };
  }
  if (lang === 'pt') {
    return {
      hero: Object.assign({}, en.hero, SS_PT.hero),
      sections: structuredClone(SS_PT.sections),
      cta: structuredClone(SS_PT.cta),
    };
  }
  if (lang === 'de') {
    return {
      hero: Object.assign({}, en.hero, SS_DE.hero),
      sections: structuredClone(SS_DE.sections),
      cta: structuredClone(SS_DE.cta),
    };
  }
  return {
    hero: Object.assign({}, en.hero),
    sections: structuredClone(en.sections),
    cta: structuredClone(en.cta),
  };
}

// ─── wash-dry-fold ────────────────────────────────────────────────────────────

const WDF_EN = {
  hero: {
    title: 'Drop off, walk out',
    sub: 'Drop your laundry off at WaveMAX Austin — we\'ll wash it, dry it, fold it, and have it ready for you the next day. Hospital-grade UV-sanitized water, eco-friendly hypoallergenic detergent, no cash needed.',
  },
  sections: [
    { id: 'howItWorks', kind: 'steps', title: 'How it works', items: [
      { title: 'Drop off', body: '2-minute drop-off. We weigh, wash, dry, and fold with hospital-grade UV sanitization.' },
      { title: '24-hour turnaround', body: 'Drop off in the morning, pick up the next day. Need it faster? Ask about same-day.' },
      { title: 'Simple pricing', body: '$1.20/lb, 10lb minimum. Detergent, dryer sheets, and hangers included. Cards-only payment, no cash needed.' },
    ]},
    { id: 'addOns', kind: 'cards', title: 'Add-ons', items: [
      { title: 'Premium Detergent', body: '$0.10/lb — hypoallergenic, free of dyes and perfumes.' },
      { title: 'Fabric Softener', body: '$0.10/lb — keeps clothes soft and static-free.' },
      { title: 'Stain Remover', body: '$0.10/lb — pre-treatment applied before washing.' },
    ]},
  ],
  cta: {
    title: 'Ready to drop off?',
    sub: 'Call or stop by during open hours.',
    primaryLabel: 'Call Now',
  },
};

const WDF_ES = {
  hero: {
    title: 'Deja tu ropa, nosotros la cuidamos',
    sub: 'Deja tu ropa en WaveMAX Austin — la lavaremos, secaremos y doblaremos, y estará lista para ti al día siguiente. Agua sanitizada con UV de grado hospitalario, detergente hipoalergénico ecológico, sin efectivo.',
  },
  sections: [
    { id: 'howItWorks', kind: 'steps', title: 'Cómo funciona', items: [
      { title: 'Deja tu ropa', body: 'Déjala en 2 minutos. Pesamos, lavamos, secamos y doblamos con sanitización UV de grado hospitalario.' },
      { title: 'Lista en 24 horas', body: 'Deja tu ropa en la mañana, está lista al día siguiente. ¿Necesitas algo más rápido? Pregunta por el servicio del mismo día.' },
      { title: 'Precios simples', body: '$1.20/lb, mínimo 10 lb. Detergente, hojas para secadora y ganchos incluidos. Solo tarjetas, sin efectivo.' },
    ]},
    { id: 'addOns', kind: 'cards', title: 'Servicios adicionales', items: [
      { title: 'Detergente premium', body: '$0.10/lb — hipoalergénico, sin colorantes ni perfumes.' },
      { title: 'Suavizante de telas', body: '$0.10/lb — mantiene la ropa suave y sin estática.' },
      { title: 'Removedor de manchas', body: '$0.10/lb — pretratamiento aplicado antes del lavado.' },
    ]},
  ],
  cta: {
    title: '¿Listo para dejar tu ropa?',
    sub: 'Llama o pásate durante el horario de atención.',
    primaryLabel: 'Llamar ahora',
  },
};

const WDF_PT = {
  hero: {
    title: 'Deixe sua roupa, cuide de você',
    sub: 'Deixe sua roupa na WaveMAX Austin — lavamos, secamos, dobramos e sua roupa fica pronta para você no dia seguinte. Água com sanitização UV de grau hospitalar, sabão em pó hipoalergênico ecológico, só cartão.',
  },
  sections: [
    { id: 'howItWorks', kind: 'steps', title: 'Como funciona', items: [
      { title: 'Deixe sua roupa', body: 'Atendimento em 2 minutos. Pesamos, lavamos, secamos e dobramos com sanitização UV de grau hospitalar.' },
      { title: 'Pronta em 24 horas', body: 'Deixe de manhã, sua roupa fica pronta no dia seguinte. Precisa mais rápido? Pergunte sobre o mesmo dia.' },
      { title: 'Preço simples', body: '$1,20/lb, mínimo de 10 lb. Sabão em pó, folhas para secadora e cabides incluídos. Só cartão, sem dinheiro.' },
    ]},
    { id: 'addOns', kind: 'cards', title: 'Adicionais', items: [
      { title: 'Sabão Premium', body: '$0,10/lb — hipoalergênico, sem corantes nem perfumes.' },
      { title: 'Amaciante', body: '$0,10/lb — mantém a roupa macia e sem estática.' },
      { title: 'Removedor de Manchas', body: '$0,10/lb — pré-tratamento aplicado antes da lavagem.' },
    ]},
  ],
  cta: {
    title: 'Pronto para deixar sua roupa?',
    sub: 'Ligue ou apareça durante o horário de funcionamento.',
    primaryLabel: 'Ligar Agora',
  },
};

const WDF_DE = {
  hero: {
    title: 'Wäsche abgeben, fertig',
    sub: 'Geben Sie Ihre Wäsche bei WaveMAX Austin ab — wir waschen, trocknen und falten sie und haben sie am nächsten Tag fertig für Sie. Krankenhausreines UV-desinfiziertes Wasser, umweltfreundliches hypoallergenes Waschmittel, kein Bargeld nötig.',
  },
  sections: [
    { id: 'howItWorks', kind: 'steps', title: 'So funktioniert es', items: [
      { title: 'Wäsche abgeben', body: 'Abgabe in 2 Minuten. Wir wiegen, waschen, trocknen und falten mit krankenhausreiner UV-Desinfektion.' },
      { title: 'Fertig in 24 Stunden', body: 'Morgens abgeben, am nächsten Tag fertig. Brauchen Sie es schneller? Fragen Sie nach dem Expressservice.' },
      { title: 'Einfache Preise', body: '$1,20/lb, Mindestmenge 10 lb. Waschmittel, Trocknertücher und Kleiderbügel inklusive. Nur Kartenzahlung, kein Bargeld.' },
    ]},
    { id: 'addOns', kind: 'cards', title: 'Zusatzleistungen', items: [
      { title: 'Premium-Waschmittel', body: '$0,10/lb — hypoallergen, frei von Farbstoffen und Parfüm.' },
      { title: 'Weichspüler', body: '$0,10/lb — hält Kleidung weich und antistatisch.' },
      { title: 'Fleckenentferner', body: '$0,10/lb — Vorbehandlung wird vor dem Waschen aufgetragen.' },
    ]},
  ],
  cta: {
    title: 'Bereit, Ihre Wäsche abzugeben?',
    sub: 'Rufen Sie an oder kommen Sie während der Öffnungszeiten vorbei.',
    primaryLabel: 'Jetzt Anrufen',
  },
};

function buildWashDryFold(lang) {
  const en = WDF_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, WDF_ES.hero),
      sections: structuredClone(WDF_ES.sections),
      cta: structuredClone(WDF_ES.cta),
    };
  }
  if (lang === 'pt') {
    return {
      hero: Object.assign({}, en.hero, WDF_PT.hero),
      sections: structuredClone(WDF_PT.sections),
      cta: structuredClone(WDF_PT.cta),
    };
  }
  if (lang === 'de') {
    return {
      hero: Object.assign({}, en.hero, WDF_DE.hero),
      sections: structuredClone(WDF_DE.sections),
      cta: structuredClone(WDF_DE.cta),
    };
  }
  return { hero: Object.assign({}, en.hero), sections: structuredClone(en.sections), cta: structuredClone(en.cta) };
}

// ─── commercial ────────────────────────────────────────────────────────────

const COM_EN = {
  hero: {
    title: 'Commercial laundry that scales with your business',
    sub: 'Hospital-grade UV-sanitized water, 80-lb commercial machines, scheduled or on-demand turnaround. Serving Austin medical offices, gyms, short-term-rental hosts, salons, and restaurants — no contracts, no setup fees.',
    tagline: 'VOLUME · SAME-DAY · NO CONTRACTS',
  },
  sections: [
    { id: 'whoWeServe', kind: 'cards', title: 'Who we serve', items: [
      { title: 'Airbnb & rentals', body: 'Same-day turnover support. Sheets, towels, comforters — folded and ready by check-in.' },
      { title: 'Medical offices & gyms', body: 'Scrubs, uniforms, towels — reliably clean, reliably on time.' },
      { title: 'Restaurants & salons', body: 'Linens, aprons, and towels handled in volume. No-contract accounts.' },
    ]},
    { id: 'whyUs', kind: 'cards', title: 'Why WaveMAX', items: [
      { title: 'Hospital-grade sanitization', body: '99.9% pathogen elimination with Omni LUX UV water purification.' },
      { title: 'No contracts', body: 'Scale up or down without commitment. Pay only for what you bring in.' },
      { title: '80-lb capacity machines', body: 'Handle large commercial loads in a single cycle.' },
    ]},
  ],
  cta: {
    title: 'Ready to open a commercial account?',
    sub: 'Call for a quote — no contracts, no setup fees.',
    primaryLabel: 'Call for a Quote',
  },
};

const COM_ES = {
  hero: {
    title: 'Lavandería comercial que crece con tu negocio',
    sub: 'Agua sanitizada con UV de grado hospitalario, máquinas comerciales de 80 lb, turnaround programado o bajo demanda. Atendemos oficinas médicas, gimnasios, anfitriones de alquiler a corto plazo, salones y restaurantes en Austin — sin contratos, sin cargos de instalación.',
    tagline: 'VOLUMEN · MISMO DÍA · SIN CONTRATOS',
  },
  sections: [
    { id: 'whoWeServe', kind: 'cards', title: 'A quién atendemos', items: [
      { title: 'Airbnb y alquileres', body: 'Apoyo para el cambio de turno el mismo día. Sábanas, toallas, edredones — doblados y listos antes del check-in.' },
      { title: 'Oficinas médicas y gimnasios', body: 'Uniformes, ropa de trabajo, toallas — limpieza confiable, siempre a tiempo.' },
      { title: 'Restaurantes y salones', body: 'Ropa de cama, delantales y toallas manejados en volumen. Cuentas sin contrato.' },
    ]},
    { id: 'whyUs', kind: 'cards', title: 'Por qué WaveMAX', items: [
      { title: 'Sanitización de grado hospitalario', body: 'Eliminación del 99.9% de patógenos con purificación de agua UV Omni LUX.' },
      { title: 'Sin contratos', body: 'Escala hacia arriba o hacia abajo sin compromisos. Paga solo por lo que traes.' },
      { title: 'Máquinas de 80 lb de capacidad', body: 'Maneja grandes cargas comerciales en un solo ciclo.' },
    ]},
  ],
  cta: {
    title: '¿Listo para abrir una cuenta comercial?',
    sub: 'Llama para un presupuesto — sin contratos, sin cargos de instalación.',
    primaryLabel: 'Llamar para presupuesto',
  },
};

const COM_PT = {
  hero: {
    title: 'Lavanderia comercial que cresce com o seu negócio',
    sub: 'Água com sanitização UV de grau hospitalar, máquinas comerciais de 80 lb, prazo programado ou sob demanda. Atendemos consultórios médicos, academias, anfitriões de aluguel de curta temporada, salões e restaurantes em Austin — sem contratos, sem taxas de adesão.',
    tagline: 'VOLUME · MESMO DIA · SEM CONTRATOS',
  },
  sections: [
    { id: 'whoWeServe', kind: 'cards', title: 'Quem atendemos', items: [
      { title: 'Airbnb e aluguéis', body: 'Apoio para virada rápida no mesmo dia. Lençóis, toalhas, edredons — dobrados e prontos antes do check-in.' },
      { title: 'Consultórios médicos e academias', body: 'Uniformes, roupas de trabalho, toalhas — limpeza confiável, sempre no prazo.' },
      { title: 'Restaurantes e salões', body: 'Roupas de cama, aventais e toalhas em grande volume. Contas sem contrato.' },
    ]},
    { id: 'whyUs', kind: 'cards', title: 'Por que WaveMAX', items: [
      { title: 'Sanitização de grau hospitalar', body: 'Eliminação de 99,9% de patógenos com purificação de água UV Omni LUX.' },
      { title: 'Sem contratos', body: 'Aumente ou reduza sem compromisso. Pague apenas pelo que trouxer.' },
      { title: 'Máquinas com capacidade de 80 lb', body: 'Lide com grandes cargas comerciais em um único ciclo.' },
    ]},
  ],
  cta: {
    title: 'Pronto para abrir uma conta comercial?',
    sub: 'Ligue para um orçamento — sem contratos, sem taxas de adesão.',
    primaryLabel: 'Ligar para Orçamento',
  },
};

const COM_DE = {
  hero: {
    title: 'Gewerbeservice, der mit Ihrem Unternehmen wächst',
    sub: 'Krankenhausreines UV-desinfiziertes Wasser, 80-lb-Gewerbewaschmaschinen, geplante oder bedarfsgerechte Bearbeitung. Wir bedienen Arztpraxen, Fitnessstudios, Kurzzeitvermietungen, Salons und Restaurants in Austin — ohne Verträge, ohne Einrichtungsgebühren.',
    tagline: 'VOLUMEN · GLEICHER TAG · OHNE VERTRAG',
  },
  sections: [
    { id: 'whoWeServe', kind: 'cards', title: 'Unsere Kunden', items: [
      { title: 'Airbnb und Ferienvermietungen', body: 'Schnelle Umrüstung am selben Tag. Bettwäsche, Handtücher, Bettdecken — gefaltet und rechtzeitig zum Check-in bereit.' },
      { title: 'Arztpraxen und Fitnessstudios', body: 'Berufskleidung, Uniformen, Handtücher — zuverlässig sauber, zuverlässig pünktlich.' },
      { title: 'Restaurants und Salons', body: 'Tischwäsche, Schürzen und Handtücher in großer Stückzahl. Konten ohne Vertrag.' },
    ]},
    { id: 'whyUs', kind: 'cards', title: 'Warum WaveMAX', items: [
      { title: 'Desinfektion in Krankenhausqualität', body: '99,9 % Keimreduktion mit Omni LUX UV-Wasserreinigung.' },
      { title: 'Ohne Vertrag', body: 'Hoch- oder runterskalieren ohne Bindung. Zahlen Sie nur für das, was Sie bringen.' },
      { title: 'Maschinen mit 80-lb-Kapazität', body: 'Große Gewerbeladungen in einem einzigen Durchgang erledigen.' },
    ]},
  ],
  cta: {
    title: 'Bereit, ein Gewerbekonto zu eröffnen?',
    sub: 'Rufen Sie für ein Angebot an — ohne Verträge, ohne Einrichtungsgebühren.',
    primaryLabel: 'Für Angebot Anrufen',
  },
};

function buildCommercial(lang) {
  const en = COM_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, COM_ES.hero),
      sections: structuredClone(COM_ES.sections),
      cta: structuredClone(COM_ES.cta),
    };
  }
  if (lang === 'pt') {
    return {
      hero: Object.assign({}, en.hero, COM_PT.hero),
      sections: structuredClone(COM_PT.sections),
      cta: structuredClone(COM_PT.cta),
    };
  }
  if (lang === 'de') {
    return {
      hero: Object.assign({}, en.hero, COM_DE.hero),
      sections: structuredClone(COM_DE.sections),
      cta: structuredClone(COM_DE.cta),
    };
  }
  return { hero: Object.assign({}, en.hero), sections: structuredClone(en.sections), cta: structuredClone(en.cta) };
}

// ─── about ──────────────────────────────────────────────────────────────────

const ABOUT_EN = {
  hero: {
    title: 'About this WaveMAX',
    sub: 'This WaveMAX is owned and operated by people who live in the community we serve. We chose WaveMAX because we believe in providing the best quality and service at the lowest fair price — and reinvesting in our neighborhood, every day.',
    tagline: 'Locally owned. Locally invested.',
  },
  sections: [
    { id: 'story', kind: 'prose', title: 'Our story', body: 'WaveMAX Austin is owned and operated by the Houlihan family — Colin (musician), Rick (technology executive), and Simone (artist and philanthropist). Three Austin locals giving back to the community by providing best-in-class laundry service at the lowest fair price.' },
    { id: 'values', kind: 'cards', title: 'What we believe', items: [
      { title: 'Community first', body: 'We live here. We shop here. We invest the profits back into the neighborhood.' },
      { title: 'Honest pricing', body: 'No hidden fees. No bait-and-switch. The price you see is the price you pay.' },
      { title: 'Premium equipment', body: 'WaveMAX only operates Electrolux 450G machines. Your clothes deserve the best.' },
    ]},
  ],
  cta: {
    title: 'Come say hello',
    sub: 'Open daily 7am–10pm at 825 E Rundberg Ln F1, Austin.',
    primaryLabel: 'Get Directions',
  },
};

const ABOUT_ES = {
  hero: {
    title: 'Sobre este WaveMAX',
    sub: 'Este WaveMAX es propiedad y está operado por personas que viven en la comunidad a la que servimos. Elegimos WaveMAX porque creemos en brindar la mejor calidad y servicio al precio justo más bajo — y reinvertir en nuestro vecindario, cada día.',
    tagline: 'Propiedad local. Inversión local.',
  },
  sections: [
    { id: 'story', kind: 'prose', title: 'Nuestra historia', body: 'WaveMAX Austin es propiedad y está operada por la familia Houlihan — Colin (músico), Rick (ejecutivo tecnológico) y Simone (artista y filántropa). Tres locales de Austin devolviendo a la comunidad al brindar el mejor servicio de lavandería al precio justo más bajo.' },
    { id: 'values', kind: 'cards', title: 'En lo que creemos', items: [
      { title: 'La comunidad primero', body: 'Vivimos aquí. Compramos aquí. Reinvertimos las ganancias en el vecindario.' },
      { title: 'Precios honestos', body: 'Sin cargos ocultos. Sin trampas. El precio que ves es el precio que pagas.' },
      { title: 'Equipos de primera', body: 'WaveMAX solo opera máquinas Electrolux 450G. Tu ropa merece lo mejor.' },
    ]},
  ],
  cta: {
    title: 'Ven a saludarnos',
    sub: 'Abierto todos los días de 7am a 10pm en 825 E Rundberg Ln F1, Austin.',
    primaryLabel: 'Cómo llegar',
  },
};

const ABOUT_PT = {
  hero: {
    title: 'Sobre esta WaveMAX',
    sub: 'Esta WaveMAX é de propriedade e operada por pessoas que vivem na comunidade que servimos. Escolhemos WaveMAX porque acreditamos em oferecer a melhor qualidade e serviço pelo menor preço justo — e reinvestindo em nosso bairro, todos os dias.',
    tagline: 'Propriedade local. Investimento local.',
  },
  sections: [
    { id: 'story', kind: 'prose', title: 'Nossa história', body: 'A WaveMAX Austin é de propriedade e operada pela família Houlihan — Colin (músico), Rick (executivo de tecnologia) e Simone (artista e filantropa). Três moradores de Austin retribuindo à comunidade ao oferecer o melhor serviço de lavanderia pelo menor preço justo.' },
    { id: 'values', kind: 'cards', title: 'O que acreditamos', items: [
      { title: 'Comunidade em primeiro lugar', body: 'Moramos aqui. Compramos aqui. Reinvestimos os lucros no bairro.' },
      { title: 'Preços honestos', body: 'Sem taxas ocultas. Sem surpresas. O preço que você vê é o preço que você paga.' },
      { title: 'Equipamentos de primeira linha', body: 'A WaveMAX opera somente máquinas Electrolux 450G. Suas roupas merecem o melhor.' },
    ]},
  ],
  cta: {
    title: 'Venha nos visitar',
    sub: 'Aberta todos os dias das 7h às 22h na 825 E Rundberg Ln F1, Austin.',
    primaryLabel: 'Como Chegar',
  },
};

const ABOUT_DE = {
  hero: {
    title: 'Über diese WaveMAX',
    sub: 'Diese WaveMAX gehört Menschen aus der Gemeinschaft, der wir dienen, und wird von ihnen betrieben. Wir haben WaveMAX gewählt, weil wir daran glauben, beste Qualität und besten Service zum fairsten Preis zu bieten — und jeden Tag in unsere Nachbarschaft zu reinvestieren.',
    tagline: 'Lokal besessen. Lokal investiert.',
  },
  sections: [
    { id: 'story', kind: 'prose', title: 'Unsere Geschichte', body: 'WaveMAX Austin gehört der Familie Houlihan — Colin (Musiker), Rick (Technologiemanager) und Simone (Künstlerin und Philanthropin) — und wird von ihr betrieben. Drei Austin-Einheimische, die der Gemeinschaft etwas zurückgeben, indem sie erstklassigen Wäscheservice zum fairen Preis anbieten.' },
    { id: 'values', kind: 'cards', title: 'Unsere Überzeugungen', items: [
      { title: 'Gemeinschaft zuerst', body: 'Wir leben hier. Wir kaufen hier ein. Wir reinvestieren den Gewinn in das Viertel.' },
      { title: 'Ehrliche Preise', body: 'Keine versteckten Gebühren. Kein Kleingedrucktes. Der Preis, den Sie sehen, ist der Preis, den Sie zahlen.' },
      { title: 'Erstklassige Ausstattung', body: 'WaveMAX betreibt ausschließlich Electrolux-450G-Maschinen. Ihre Kleidung verdient das Beste.' },
    ]},
  ],
  cta: {
    title: 'Kommen Sie uns besuchen',
    sub: 'Täglich geöffnet von 7 bis 22 Uhr, 825 E Rundberg Ln F1, Austin.',
    primaryLabel: 'Wegbeschreibung',
  },
};

function buildAbout(lang) {
  const en = ABOUT_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, ABOUT_ES.hero),
      sections: structuredClone(ABOUT_ES.sections),
      cta: structuredClone(ABOUT_ES.cta),
    };
  }
  if (lang === 'pt') {
    return {
      hero: Object.assign({}, en.hero, ABOUT_PT.hero),
      sections: structuredClone(ABOUT_PT.sections),
      cta: structuredClone(ABOUT_PT.cta),
    };
  }
  if (lang === 'de') {
    return {
      hero: Object.assign({}, en.hero, ABOUT_DE.hero),
      sections: structuredClone(ABOUT_DE.sections),
      cta: structuredClone(ABOUT_DE.cta),
    };
  }
  return { hero: Object.assign({}, en.hero), sections: structuredClone(en.sections), cta: structuredClone(en.cta) };
}

// ─── contact ────────────────────────────────────────────────────────────────

const CONTACT_EN = {
  hero: {
    title: 'Get in touch with WaveMAX Austin',
    sub: 'Call us, swing by during open hours, or drop a note below — we reply within a few hours during business hours.',
  },
  sections: [
    { id: 'info', kind: 'contact-info', title: 'Find us', items: [
      { label: 'Address', value: '825 E Rundberg Ln F1, Austin, TX 78753' },
      { label: 'Phone', value: '(512) 553-1674' },
      { label: 'Hours', value: 'Open daily · 7:00 am – 10:00 pm' },
    ]},
    { id: 'form', kind: 'contact-form', title: 'Send a message', body: '' },
  ],
  cta: {
    title: 'We\'d love to hear from you',
    sub: 'Call, visit, or send a message — we\'re here to help.',
    primaryLabel: 'Call Now',
  },
};

const CONTACT_ES = {
  hero: {
    title: 'Contáctanos en WaveMAX Austin',
    sub: 'Llámanos, visítanos durante el horario de atención, o déjanos un mensaje — respondemos dentro de pocas horas durante el horario comercial.',
  },
  sections: [
    { id: 'info', kind: 'contact-info', title: 'Encuéntranos', items: [
      { label: 'Dirección', value: '825 E Rundberg Ln F1, Austin, TX 78753' },
      { label: 'Teléfono', value: '(512) 553-1674' },
      { label: 'Horario', value: 'Abierto todos los días · 7:00 am – 10:00 pm' },
    ]},
    { id: 'form', kind: 'contact-form', title: 'Envíanos un mensaje', body: '' },
  ],
  cta: {
    title: 'Nos encantaría saber de ti',
    sub: 'Llama, visítanos o envía un mensaje — estamos aquí para ayudarte.',
    primaryLabel: 'Llamar ahora',
  },
};

const CONTACT_PT = {
  hero: {
    title: 'Entre em contato com WaveMAX Austin',
    sub: 'Ligue, passe durante o horário de funcionamento ou deixe uma mensagem abaixo — respondemos em poucas horas durante o expediente comercial.',
  },
  sections: [
    { id: 'info', kind: 'contact-info', title: 'Nos encontre', items: [
      { label: 'Endereço', value: '825 E Rundberg Ln F1, Austin, TX 78753' },
      { label: 'Telefone', value: '(512) 553-1674' },
      { label: 'Horário', value: 'Aberta todos os dias · 7h00 – 22h00' },
    ]},
    { id: 'form', kind: 'contact-form', title: 'Envie uma mensagem', body: '' },
  ],
  cta: {
    title: 'Adoraríamos ouvir de você',
    sub: 'Ligue, venha nos visitar ou envie uma mensagem — estamos aqui para ajudar.',
    primaryLabel: 'Ligar Agora',
  },
};

const CONTACT_DE = {
  hero: {
    title: 'Kontaktieren Sie WaveMAX Austin',
    sub: 'Rufen Sie an, kommen Sie während der Öffnungszeiten vorbei oder hinterlassen Sie uns eine Nachricht — wir antworten während der Geschäftszeiten innerhalb weniger Stunden.',
  },
  sections: [
    { id: 'info', kind: 'contact-info', title: 'Finden Sie uns', items: [
      { label: 'Adresse', value: '825 E Rundberg Ln F1, Austin, TX 78753' },
      { label: 'Telefon', value: '(512) 553-1674' },
      { label: 'Öffnungszeiten', value: 'Täglich geöffnet · 7:00 – 22:00 Uhr' },
    ]},
    { id: 'form', kind: 'contact-form', title: 'Nachricht senden', body: '' },
  ],
  cta: {
    title: 'Wir freuen uns von Ihnen zu hören',
    sub: 'Anrufen, vorbeikommen oder eine Nachricht senden — wir sind für Sie da.',
    primaryLabel: 'Jetzt Anrufen',
  },
};

function buildContact(lang) {
  const en = CONTACT_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, CONTACT_ES.hero),
      sections: structuredClone(CONTACT_ES.sections),
      cta: structuredClone(CONTACT_ES.cta),
    };
  }
  if (lang === 'pt') {
    return {
      hero: Object.assign({}, en.hero, CONTACT_PT.hero),
      sections: structuredClone(CONTACT_PT.sections),
      cta: structuredClone(CONTACT_PT.cta),
    };
  }
  if (lang === 'de') {
    return {
      hero: Object.assign({}, en.hero, CONTACT_DE.hero),
      sections: structuredClone(CONTACT_DE.sections),
      cta: structuredClone(CONTACT_DE.cta),
    };
  }
  return { hero: Object.assign({}, en.hero), sections: structuredClone(en.sections), cta: structuredClone(en.cta) };
}

// ─── Main builder ────────────────────────────────────────────────────────────

function buildContent() {
  const result = {};
  for (const lang of LANGS) {
    result[lang] = {
      pages: {
        // Every builder takes a lang string — all page copy is hardcoded here
        // (mirrors the franchise-default landing + service pages), NOT pulled
        // from common.json `landing.*` (which is the affiliate program copy).
        'home': buildHome(lang),
        'self-serve': buildSelfServe(lang),
        'wash-dry-fold': buildWashDryFold(lang),
        'commercial': buildCommercial(lang),
        'about': buildAbout(lang),
        'contact': buildContact(lang),
      },
    };
  }
  return result;
}

const content = buildContent();

module.exports = { NAP, TRADEMARK_NOTICE, PAGES, LANGS, content };
