'use strict';
// Skin-chrome microcopy. The page CONTENT comes translated from the content
// model; this lookup only covers OS-chrome labels the skin invents (buttons,
// status chips, concierge stub, nav, footer-of-body). EN + ES both first-class.
// Austin is a self-serve + wash-dry-fold laundromat — NO pickup/delivery.
const T = {
  en: {
    nav: { home: 'Home', selfServe: 'Self-Serve', wdf: 'Wash-Dry-Fold', commercial: 'Commercial', about: 'About', contact: 'Contact' },
    call: 'Call', directions: 'Get directions', wdf: 'Wash-dry-fold', menu: 'Sections',
    openNow: 'Open now', until: 'until 10 PM', system: 'WaveMAX · Rundberg',
    statusLabel: 'Live status', turnaround: '24-hr turnaround', cardsOnly: 'Cards only · no cash',
    bilingual: 'Se habla español', neighborhood: 'North Austin · Rundberg Ln',
    conciergeKicker: 'Ask the front desk',
    conciergeTitle: 'WaveMAX Concierge',
    conciergeBody: 'Hours, pricing, machines, wash-dry-fold drop-off — ask in plain English or Spanish.',
    conciergeSample: 'How much is wash-dry-fold, and how long does it take?',
    conciergePlaceholder: 'Type a question…',
    conciergeNote: 'Preview. Live answers in production.',
    conciergeSend: 'Ask',
    bentoStatus: 'Live status', bentoMap: 'Find us', bentoWdf: 'Wash-dry-fold',
    machinesTag: 'On the floor', machinesTitle: '42 washers · 42 dryers',
    machinesSub: 'Electrolux 450G · loads up to 80 lb',
    pricingTag: 'Wash-dry-fold', pricingNote: 'Detergent + hangers included',
    quickActions: 'Quick actions', explore: 'Explore the OS',
    learnMore: 'Open', tileOpen: 'Open', tileDrop: 'Drop off',
    rating: '4.8 on Google', established: 'Locally owned',
    panel: 'PANEL', module: 'MODULE', ready: 'READY',
    openInMaps: 'Open in Maps',
    // Consolidated wash-dry-fold tile (service + pricing in one)
    wdfTileSub: '$1.20/lb · 10-lb minimum · ready in 24 hours',
    wdfPerLb: '/lb', wdfMin: '10-lb min', wdf24: '24-hr',
    // Omni UV sanitization showcase tile
    uvTag: 'Hygiene · LUX system',
    uvTitle: 'Hospital-grade UV-sanitized water',
    uvSub: 'Every wash runs on water treated by the Omni Solutions LUX system — UV light sanitizes the water itself, not just the clothes.',
    uvBadge: 'Omni Solutions',
    // KPI strip below the hero
    kpiWashers: 'Washers', kpiDryers: 'Dryers',
    kpiTurn: 'Turnaround', kpiHours: 'Open daily',
    kpiHoursVal: '7 AM – 10 PM',
  },
  es: {
    nav: { home: 'Inicio', selfServe: 'Autoservicio', wdf: 'Lava-Seca-Dobla', commercial: 'Comercial', about: 'Nosotros', contact: 'Contacto' },
    call: 'Llamar', directions: 'Cómo llegar', wdf: 'Lava-seca-dobla', menu: 'Secciones',
    openNow: 'Abierto ahora', until: 'hasta las 10 PM', system: 'WaveMAX · Rundberg',
    statusLabel: 'Estado en vivo', turnaround: 'Lista en 24 h', cardsOnly: 'Solo tarjeta · sin efectivo',
    bilingual: 'Se habla español', neighborhood: 'Norte de Austin · Rundberg Ln',
    conciergeKicker: 'Pregunta en recepción',
    conciergeTitle: 'Asistente WaveMAX',
    conciergeBody: 'Horarios, precios, máquinas, lava-seca-dobla — pregunta en inglés o español.',
    conciergeSample: '¿Cuánto cuesta el lava-seca-dobla y cuánto tarda?',
    conciergePlaceholder: 'Escribe una pregunta…',
    conciergeNote: 'Vista previa. Respuestas en vivo en producción.',
    conciergeSend: 'Preguntar',
    bentoStatus: 'Estado en vivo', bentoMap: 'Ubicación', bentoWdf: 'Lava-seca-dobla',
    machinesTag: 'En el local', machinesTitle: '42 lavadoras · 42 secadoras',
    machinesSub: 'Electrolux 450G · cargas hasta 80 lb',
    pricingTag: 'Lava-seca-dobla', pricingNote: 'Detergente y ganchos incluidos',
    quickActions: 'Acciones rápidas', explore: 'Explora el OS',
    learnMore: 'Abrir', tileOpen: 'Abrir', tileDrop: 'Déjala',
    rating: '4.8 en Google', established: 'Negocio local',
    panel: 'PANEL', module: 'MÓDULO', ready: 'LISTO',
    openInMaps: 'Abrir en Maps',
    // Mosaico de lava-seca-dobla consolidado (servicio + precio en uno)
    wdfTileSub: '$1.20/lb · mínimo 10 lb · lista en 24 horas',
    wdfPerLb: '/lb', wdfMin: 'mín. 10 lb', wdf24: '24 h',
    // Mosaico destacado de sanitización UV de Omni
    uvTag: 'Higiene · sistema LUX',
    uvTitle: 'Agua sanitizada con UV de grado hospitalario',
    uvSub: 'Cada lavado usa agua tratada por el sistema LUX de Omni Solutions: la luz UV sanitiza el agua misma, no solo la ropa.',
    uvBadge: 'Omni Solutions',
    // Franja de indicadores bajo el hero
    kpiWashers: 'Lavadoras', kpiDryers: 'Secadoras',
    kpiTurn: 'Lista en', kpiHours: 'Abierto a diario',
    kpiHoursVal: '7 AM – 10 PM',
  },
};
function t(lang) { return T[lang] || T.en; }
module.exports = { t };
