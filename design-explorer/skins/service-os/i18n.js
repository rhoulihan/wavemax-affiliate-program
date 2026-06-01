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
  },
};
function t(lang) { return T[lang] || T.en; }
module.exports = { t };
