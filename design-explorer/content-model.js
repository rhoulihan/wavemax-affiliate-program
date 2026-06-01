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
const LANGS = ['en', 'es'];

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

function buildHome(lang) {
  const en = HOME_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, HOME_ES.hero),
      sections: structuredClone(HOME_ES.sections),
      cta: structuredClone(HOME_ES.cta),
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

function buildSelfServe(lang) {
  const en = SS_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, SS_ES.hero),
      sections: structuredClone(SS_ES.sections),
      cta: structuredClone(SS_ES.cta),
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

function buildWashDryFold(lang) {
  const en = WDF_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, WDF_ES.hero),
      sections: structuredClone(WDF_ES.sections),
      cta: structuredClone(WDF_ES.cta),
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

function buildCommercial(lang) {
  const en = COM_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, COM_ES.hero),
      sections: structuredClone(COM_ES.sections),
      cta: structuredClone(COM_ES.cta),
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

function buildAbout(lang) {
  const en = ABOUT_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, ABOUT_ES.hero),
      sections: structuredClone(ABOUT_ES.sections),
      cta: structuredClone(ABOUT_ES.cta),
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

function buildContact(lang) {
  const en = CONTACT_EN;
  if (lang === 'es') {
    return {
      hero: Object.assign({}, en.hero, CONTACT_ES.hero),
      sections: structuredClone(CONTACT_ES.sections),
      cta: structuredClone(CONTACT_ES.cta),
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
