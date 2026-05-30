'use strict';
// Skin-chrome microcopy. The page CONTENT comes translated from the content
// model; this lookup only covers OS-chrome labels the skin invents (buttons,
// status chips, concierge stub, nav, footer-of-body). EN + ES both first-class.
const T = {
  en: {
    nav: { home: 'Home', selfServe: 'Self-Serve', wdf: 'Wash-Dry-Fold', commercial: 'Commercial', about: 'About', contact: 'Contact' },
    call: 'Call', directions: 'Get directions', book: 'Book a pickup', menu: 'Sections',
    openNow: 'Open now', until: 'until 10 PM', system: 'WaveMAX · Rundberg',
    statusLabel: 'Live status', turnaround: '24-hr turnaround', cardsOnly: 'Cards only · no cash',
    bilingual: 'Se habla español', neighborhood: 'North Austin · Rundberg Ln',
    conciergeKicker: 'Ask the front desk',
    conciergeTitle: 'WaveMAX Concierge',
    conciergeBody: 'Pickup times, pricing, drop-off — ask in plain English or Spanish.',
    conciergeSample: 'When can you pick up near Rundberg & I-35?',
    conciergePlaceholder: 'Type a question…',
    conciergeNote: 'Preview. Live answers in production.',
    conciergeSend: 'Ask',
    bentoStatus: 'Status', bentoMap: 'Find us', bentoBook: 'Book a pickup',
    quickActions: 'Quick actions', explore: 'Explore the OS',
    learnMore: 'Open', tileOpen: 'Open',
    rating: '4.8 on Google', established: 'Locally owned',
    panel: 'PANEL', module: 'MODULE', ready: 'READY',
  },
  es: {
    nav: { home: 'Inicio', selfServe: 'Autoservicio', wdf: 'Lava-Seca-Dobla', commercial: 'Comercial', about: 'Nosotros', contact: 'Contacto' },
    call: 'Llamar', directions: 'Cómo llegar', book: 'Reservar recogida', menu: 'Secciones',
    openNow: 'Abierto ahora', until: 'hasta las 10 PM', system: 'WaveMAX · Rundberg',
    statusLabel: 'Estado en vivo', turnaround: 'Entrega en 24 h', cardsOnly: 'Solo tarjeta · sin efectivo',
    bilingual: 'Se habla español', neighborhood: 'Norte de Austin · Rundberg Ln',
    conciergeKicker: 'Pregunta en recepción',
    conciergeTitle: 'Asistente WaveMAX',
    conciergeBody: 'Horarios de recogida, precios, entrega — pregunta en inglés o español.',
    conciergeSample: '¿Cuándo pueden recoger cerca de Rundberg e I-35?',
    conciergePlaceholder: 'Escribe una pregunta…',
    conciergeNote: 'Vista previa. Respuestas en vivo en producción.',
    conciergeSend: 'Preguntar',
    bentoStatus: 'Estado', bentoMap: 'Ubicación', bentoBook: 'Reservar recogida',
    quickActions: 'Acciones rápidas', explore: 'Explora el OS',
    learnMore: 'Abrir', tileOpen: 'Abrir',
    rating: '4.8 en Google', established: 'Negocio local',
    panel: 'PANEL', module: 'MÓDULO', ready: 'LISTO',
  },
};
function t(lang) { return T[lang] || T.en; }
module.exports = { t };
