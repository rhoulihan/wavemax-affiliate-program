/* Austin Commercial overview page initializer.
 *
 * Wires the iframe bridge, sets the hero watermark, applies
 * data-bind / data-i18n translations, and handles the tabbed info
 * section. Vertical-page anchors (data-route="/commercial/...")
 * are intercepted by document delegation and routed via
 * IframeBridge.navigateParent so they update the parent host page
 * instead of trying to navigate the iframe.
 */
(function () {
  'use strict';

  /* ---------- Translations ---------- */
  const TRANSLATIONS = {
    en: {
      'com.title':                 'Commercial laundry that scales with your business',
      'com.tagline':               'VOLUME · SAME-DAY · NO CONTRACTS',
      'com.subtitle.premium':              'Hospital-grade UV-sanitized water, 80-lb commercial machines, scheduled or on-demand turnaround. Serving {{contact.city}} medical offices, gyms, short-term-rental hosts, salons, and restaurants — no contracts, no setup fees, lower minimums than any other commercial laundry in town.',
      'com.subtitle.default':              'Commercial Electrolux machines, scheduled or on-demand turnaround. Serving {{contact.city}} medical offices, gyms, short-term-rental hosts, salons, and restaurants — no contracts, no setup fees, lower minimums than any other commercial laundry in town.',
      'com.callBtn':               'Call for a quote',
      'com.directionsBtn':         'Get directions',
      'com.stats.turnaround':      'Standard Turnaround',
      'com.stats.capacity':        'Per-Machine Capacity',
      'com.stats.uv':              'UV Sanitization',
      'com.stats.contracts':       'Contracts Required',
      'com.stats.days':            'Days a Week',
      'com.pricing.eyebrow':       'VOLUME PRICING',
      'com.pricing.rate':          'From $0.95/lb',
      'com.pricing.minLabel':      'Volume tiers',
      'com.pricing.minSuffix':     'discounts at 50 lb, 200 lb, 500 lb/week',
      'com.pricing.blurb':         'Tiered per-pound pricing scaled to weekly volume. Quotes are free and customized to your routine — daily towel rotations, weekly sheet swaps, monthly deep cleans, or anything else. No contracts, no minimums, no setup fees.',
      'com.pricing.callBtn':       'Get a custom quote',
      'com.includes.eyebrow':      'INCLUDED FOR EVERY ACCOUNT',
      'com.includes.title':        'What every commercial account gets',
      'com.includes.uv':           'Hospital-grade UV-sanitized water (Omni LUX)',
      'com.includes.bigload':      '80-lb commercial Electrolux washers + fast dryers',
      'com.includes.turnaround':   '24-hour standard turnaround, same-day available',
      'com.includes.detergent':    'Premium hypoallergenic detergent included',
      'com.includes.scheduled':    'Flexible drop-off scheduling on request',
      'com.includes.terms':        'No contracts · no setup fees · no minimums',
      'com.why.eyebrow':           'WHY WAVEMAX',
      'com.why.title':             'Built for commercial volume:',
      'com.tabs.medical':          'Medical',
      'com.tabs.gym':              'Gyms',
      'com.tabs.airbnb':           'Airbnb',
      'com.tabs.restaurant':       'Restaurants',
      'com.tabs.contractors':      'Contractors',
      'com.tabs.faq':              'FAQ',
      'com.medical.eyebrow':       'MEDICAL & CLINICAL',
      'com.medical.lede':          'Hospital-grade laundry for medical, dental, and therapy practices',
      'com.medical.t1.title':      'What we wash',
      'com.medical.t1.text':       'Scrubs · lab coats · exam-table covers · barrier protection · therapy linens · dental bibs. Whites and colors separated, never mixed with other accounts.',
      'com.medical.t2.title':      'Compliance & protocols',
      'com.medical.t2.text':       'Hospital-grade Omni LUX UV at the water inlet, temperature-validated cycles, run-log documentation on request. Stain-protocol cycles for blood and biological soils.',
      'com.medical.t3.title':      'Routine',
      'com.medical.t3.text':       'Daily, weekly, or hybrid drop-off. Predictable 24-hour turnaround. No contracts, no minimums — scale up or down as your practice changes.',
      'com.gym.eyebrow':           'GYMS & HEALTH CLUBS',
      'com.gym.lede':              'Daily towel programs at scale, member-towel grade quality',
      'com.gym.t1.title':          'What we wash',
      'com.gym.t1.text':           'Member towels · staff towels · spa-room linens · steam-room sets · sauna sheets · group-class wipes. Folded for fast restocking.',
      'com.gym.t2.title':          'Volume tier pricing',
      'com.gym.t2.text':           'Discounts at 50, 200, and 500 lb per week. Flexible drop-off scheduling in North Austin. Most clubs see daily rotations stabilize within the first month.',
      'com.gym.t3.title':          'Hygiene at scale',
      'com.gym.t3.text':           'UV-sanitized water at the inlet kills odor-causing bacteria before they imprint on fabrics. No more "clean but still musty" gym towels.',
      'com.airbnb.eyebrow':        'AIRBNB & SHORT-TERM RENTALS',
      'com.airbnb.lede':           'Same-day turnover for back-to-back bookings',
      'com.airbnb.t1.title':       'What we wash',
      'com.airbnb.t1.text':        'Sheets · pillowcases · towels · bath mats · comforters · throws · kitchen linens. Folded check-in-ready and bagged per property.',
      'com.airbnb.t2.title':       'Same-day turnover',
      'com.airbnb.t2.text':        'Drop before 11am, ready that evening for the next check-in. Multi-property hosts can mix scheduled drop-offs with rush drops as bookings stack.',
      'com.airbnb.t3.title':       'Host-friendly billing',
      'com.airbnb.t3.text':        'No contracts, no minimums, no per-property setup fees. Predictable per-pound rate that scales whether you run one unit or twenty.',
      'com.restaurant.eyebrow':    'RESTAURANTS & CATERING',
      'com.restaurant.lede':       'Daily linens for high-volume kitchens',
      'com.restaurant.t1.title':   'What we wash',
      'com.restaurant.t1.text':    'Aprons · chef coats · server towels · bar rags · kitchen rags · table linens · napery. Sized by service shift, ready for restock.',
      'com.restaurant.t2.title':   'Grease-cycle protocols',
      'com.restaurant.t2.text':    'Pre-treatment for cooking oils and stains, dedicated cycles for kitchen-grade soils. UV-sanitized water at the inlet on every load.',
      'com.restaurant.t3.title':   'Daily routine',
      'com.restaurant.t3.text':    'Scheduled drop-offs on a rotation that matches your service days. No contracts, scale up for events or peak season without renegotiation.',
      'com.contractors.eyebrow':   'CONTRACTORS & SERVICE PROVIDERS',
      'com.contractors.lede':      'Heavy-soil cycles for working trades',
      'com.contractors.t1.title':  'What we wash',
      'com.contractors.t1.text':   'Uniforms · work shirts · coveralls · shop rags · drop cloths · mechanic rags · landscape gear. Heavy-soil pre-treatment on intake.',
      'com.contractors.t2.title':  'Trades served',
      'com.contractors.t2.text':   'Plumbers · electricians · mechanics · landscapers · painters · HVAC · carpenters · cleaning crews. Heavy-soil cycles for grease, paint, mud, and grime.',
      'com.contractors.t3.title':  'Routine',
      'com.contractors.t3.text':   'Weekly rotation works for most crews; bi-weekly available. Flexible drop-off scheduling for shop-based businesses. No contracts, scale with your headcount.',
      'com.tiles.turnaround.title':'24-hour turnaround',
      'com.tiles.turnaround.text': 'Standard 24-hour cycle, same-day for drops before 11am. Predictable rotation so you can plan around it.',
      'com.tiles.terms.title':     'No contracts, no minimums',
      'com.tiles.terms.text':      'Pay per pound, scale up or down as your business needs change. Walk away anytime — no exit fees, no penalty clauses.',
      'com.tiles.uv.title':        'UV-sanitized water',
      'com.tiles.uv.text':         'Every wash uses Omni LUX UV-treated water — hospital-grade sanitization that exceeds standard commercial laundry hygiene.',
      'com.tiles.capacity.title':  '80-lb machines, 42 of them',
      'com.tiles.capacity.text':   "Volume gets handled by volume. 42 commercial Electrolux 450G machines mean your load doesn't wait in queue.",
      'com.tiles.scheduled.title': 'Scheduled or on-demand',
      'com.tiles.scheduled.text':  'Recurring drop-offs on a schedule, or one-off drops as needed. Two service modes, one price book.',
      'com.tiles.local.title':     'Family-owned, local',
      'com.tiles.local.text':      'Talk to a real person every time. Issues get fixed by the same team that runs the floor — no national 1-800 hold music.',
      'com.faq.q1.q':              "What's the minimum volume to open a commercial account?",
      'com.faq.q1.a':              "There isn't one — a single 25-lb weekly drop counts as a commercial account if you want consistent service. Volume tier discounts kick in at 50 lb / 200 lb / 500 lb per week, but the standard rate applies below that without penalty.",
      'com.faq.q2.q':              'Do you require a contract?',
      'com.faq.q2.a':              'No. Per-pound pricing, no setup fees, no exit fees, no auto-renewal. Walk away anytime, scale up or down as your business changes.',
      'com.faq.q3.q':              'Can we set up a recurring drop-off schedule?',
      'com.faq.q3.a':              "Yes — we'll work out a recurring drop-off schedule that fits your business during the standard onboarding call. Most accounts use a mix of scheduled drop-offs and one-off walk-ins as their week allows.",
      'com.faq.q4.q':              'How fast is the turnaround?',
      'com.faq.q4.a':              'Standard 24-hour cycle. Drops before 11am can usually be ready for same-day pickup. Rush turnaround is available for emergency runs at a small surcharge.',
      'com.faq.q5.q':              'Can you handle stained or contaminated linens?',
      'com.faq.q5.a':              "Yes. We have stain-protocol cycles for grease, color treatments, blood/biological, and other heavy soils. Tell us what you'll be sending at the quote stage so we can plan the cycle mix.",
      'com.faq.q6.q':              'Can you document our wash cycles for compliance?',
      'com.faq.q6.a':              'For clinical or regulated accounts, yes — temperature run logs and chemistry sheets are available on request. Mention it during the quote call so we set the documentation cadence with the rest of your service plan.',
      'com.cta.text':              "Volume laundry shouldn't be a contract trap. Let's build your routine.",
      'com.cta.callBtn':           'Call for a quote',
      'com.cta.directionsBtn':     'Get directions'
    },

    es: {
      'com.title':                 'Lavandería comercial que escala con su negocio',
      'com.tagline':               'VOLUMEN · MISMO-DÍA · SIN CONTRATOS',
      'com.subtitle.premium':              'Agua sanitizada con UV de grado hospitalario, máquinas comerciales de 80 libras, entrega programada o por demanda. Atendiendo a oficinas médicas de {{contact.city}}, gimnasios, anfitriones de alquileres de corta estancia, salones y restaurantes — sin contratos, sin tarifas de configuración, mínimos más bajos que cualquier otra lavandería comercial.',
      'com.subtitle.default':              'Máquinas comerciales Electrolux, entrega programada o por demanda. Atendiendo a oficinas médicas de {{contact.city}}, gimnasios, anfitriones de alquileres de corta estancia, salones y restaurantes — sin contratos, sin tarifas de configuración, mínimos más bajos que cualquier otra lavandería comercial.',
      'com.callBtn':               'Llamar para cotización',
      'com.directionsBtn':         'Cómo llegar',
      'com.stats.turnaround':      'Entrega Estándar',
      'com.stats.capacity':        'Capacidad Por Máquina',
      'com.stats.uv':              'Sanitización UV',
      'com.stats.contracts':       'Contratos Requeridos',
      'com.stats.days':            'Días a la Semana',
      'com.pricing.eyebrow':       'PRECIOS POR VOLUMEN',
      'com.pricing.rate':          'Desde $0.95/lb',
      'com.pricing.minLabel':      'Niveles de volumen',
      'com.pricing.minSuffix':     'descuentos en 50, 200, 500 lb/semana',
      'com.pricing.blurb':         'Precios por libra escalados al volumen semanal. Cotizaciones gratis y personalizadas a su rutina — rotación diaria de toallas, intercambio semanal de sábanas, limpiezas mensuales o cualquier otra cosa. Sin contratos, sin mínimos, sin tarifas de configuración.',
      'com.pricing.callBtn':       'Obtener cotización personalizada',
      'com.includes.eyebrow':      'INCLUIDO PARA TODA CUENTA',
      'com.includes.title':        'Lo que recibe toda cuenta comercial',
      'com.includes.uv':           'Agua sanitizada con UV de grado hospitalario (Omni LUX)',
      'com.includes.bigload':      'Lavadoras comerciales Electrolux de 80 lb + secadoras rápidas',
      'com.includes.turnaround':   'Entrega estándar de 24 horas, mismo día disponible',
      'com.includes.detergent':    'Detergente hipoalergénico premium incluido',
      'com.includes.scheduled':    'Programación flexible de entrega en tienda bajo solicitud',
      'com.includes.terms':        'Sin contratos · sin tarifas de configuración · sin mínimos',
      'com.why.eyebrow':           'POR QUÉ WAVEMAX',
      'com.why.title':             'Construido para volumen comercial:',
      'com.tabs.medical':          'Médico',
      'com.tabs.gym':              'Gimnasios',
      'com.tabs.airbnb':           'Airbnb',
      'com.tabs.restaurant':       'Restaurantes',
      'com.tabs.contractors':      'Contratistas',
      'com.tabs.faq':              'Preguntas',
      'com.medical.eyebrow':       'MÉDICO Y CLÍNICO',
      'com.medical.lede':          'Lavandería de grado hospitalario para consultorios médicos, dentales y de terapia',
      'com.medical.t1.title':      'Qué lavamos',
      'com.medical.t1.text':       'Uniformes · batas · sábanas de mesa de examen · protección de barrera · sábanas de terapia · baberos dentales. Blancos y colores separados, nunca mezclados con otras cuentas.',
      'com.medical.t2.title':      'Cumplimiento y protocolos',
      'com.medical.t2.text':       'UV Omni LUX de grado hospitalario en la entrada del agua, ciclos de temperatura validada, documentación de registros bajo solicitud. Ciclos con protocolo de manchas para sangre y suciedades biológicas.',
      'com.medical.t3.title':      'Rutina',
      'com.medical.t3.text':       'Entrega en tienda diaria, semanal o híbrida. Tiempo de entrega predecible en 24 horas. Sin contratos, sin mínimos — escale arriba o abajo según cambie su práctica.',
      'com.gym.eyebrow':           'GIMNASIOS Y CLUBES DEPORTIVOS',
      'com.gym.lede':              'Programas diarios de toallas a escala, calidad de toalla de socio',
      'com.gym.t1.title':          'Qué lavamos',
      'com.gym.t1.text':           'Toallas de socios · toallas de personal · sábanas de spa · sets de sauna · sábanas de hidromasaje · paños de clase grupal. Doblados para reabasto rápido.',
      'com.gym.t2.title':          'Precios por nivel de volumen',
      'com.gym.t2.text':           'Descuentos a 50, 200 y 500 libras por semana. Programación flexible de entrega en tienda en el norte de Austin. La mayoría de clubes ven la rotación diaria estabilizarse en el primer mes.',
      'com.gym.t3.title':          'Higiene a escala',
      'com.gym.t3.text':           'El agua sanitizada con UV en la entrada elimina bacterias causantes de olor antes de que se impriman en las telas. No más toallas de gimnasio "limpias pero todavía con olor".',
      'com.airbnb.eyebrow':        'AIRBNB Y RENTAS A CORTO PLAZO',
      'com.airbnb.lede':           'Cambio el mismo día para reservas consecutivas',
      'com.airbnb.t1.title':       'Qué lavamos',
      'com.airbnb.t1.text':        'Sábanas · fundas · toallas · alfombras de baño · edredones · mantas · linos de cocina. Doblados listos para check-in y embolsados por propiedad.',
      'com.airbnb.t2.title':       'Cambio el mismo día',
      'com.airbnb.t2.text':        'Deje antes de las 11am, listo esa tarde para el siguiente check-in. Anfitriones de varias propiedades pueden combinar entregas programadas con entregas urgentes.',
      'com.airbnb.t3.title':       'Facturación amigable para anfitriones',
      'com.airbnb.t3.text':        'Sin contratos, sin mínimos, sin tarifas de configuración por propiedad. Tarifa predecible por libra que escala ya sea que opere una unidad o veinte.',
      'com.restaurant.eyebrow':    'RESTAURANTES Y CATERING',
      'com.restaurant.lede':       'Linos diarios para cocinas de alto volumen',
      'com.restaurant.t1.title':   'Qué lavamos',
      'com.restaurant.t1.text':    'Mandiles · chaquetas de chef · toallas de mesero · trapos de bar · trapos de cocina · manteles · servilletería. Dimensionados por turno de servicio, listos para reabasto.',
      'com.restaurant.t2.title':   'Protocolos de ciclo de grasa',
      'com.restaurant.t2.text':    'Pretratamiento para aceites de cocina y manchas, ciclos dedicados para suciedades de grado de cocina. Agua sanitizada con UV en la entrada en cada carga.',
      'com.restaurant.t3.title':   'Rutina diaria',
      'com.restaurant.t3.text':    'Entregas en tienda programadas en una rotación que coincida con sus días de servicio. Sin contratos, escale arriba para eventos o temporada alta sin renegociación.',
      'com.contractors.eyebrow':   'CONTRATISTAS Y PROVEEDORES DE SERVICIOS',
      'com.contractors.lede':      'Ciclos de suciedad pesada para oficios trabajadores',
      'com.contractors.t1.title':  'Qué lavamos',
      'com.contractors.t1.text':   'Uniformes · camisas de trabajo · monos · trapos de taller · cubiertas · trapos de mecánico · equipo de paisajismo. Pretratamiento de suciedad pesada al ingreso.',
      'com.contractors.t2.title':  'Oficios servidos',
      'com.contractors.t2.text':   'Plomeros · electricistas · mecánicos · paisajistas · pintores · HVAC · carpinteros · equipos de limpieza. Ciclos de suciedad pesada para grasa, pintura, lodo y mugre.',
      'com.contractors.t3.title':  'Rutina',
      'com.contractors.t3.text':   'La rotación semanal funciona para la mayoría de cuadrillas; bi-semanal disponible. Programación flexible de entrega en tienda para negocios con taller. Sin contratos, escale con su personal.',
      'com.tiles.turnaround.title':'Entrega en 24 horas',
      'com.tiles.turnaround.text': 'Ciclo estándar de 24 horas, mismo día para entregas antes de las 11am. Rotación predecible para que pueda planear alrededor.',
      'com.tiles.terms.title':     'Sin contratos, sin mínimos',
      'com.tiles.terms.text':      'Pague por libra, escale arriba o abajo según cambien las necesidades de su negocio. Váyase cuando quiera — sin tarifas de salida, sin cláusulas de penalización.',
      'com.tiles.uv.title':        'Agua sanitizada con UV',
      'com.tiles.uv.text':         'Cada lavado usa agua tratada con UV Omni LUX — sanitización de grado hospitalario que excede la higiene estándar de lavandería comercial.',
      'com.tiles.capacity.title':  'Máquinas de 80 lb, 42 de ellas',
      'com.tiles.capacity.text':   'Volumen se maneja con volumen. 42 máquinas comerciales Electrolux 450G significan que su carga no espera en cola.',
      'com.tiles.scheduled.title': 'Programado o por demanda',
      'com.tiles.scheduled.text':  'Entregas en tienda recurrentes programadas, o entregas únicas según sea necesario. Dos modos de servicio, un solo libro de precios.',
      'com.tiles.local.title':     'Familiar, local',
      'com.tiles.local.text':      'Hable con una persona real cada vez. Los problemas los resuelve el mismo equipo que opera el piso — sin música de espera 1-800 nacional.',
      'com.faq.q1.q':              '¿Cuál es el volumen mínimo para abrir una cuenta comercial?',
      'com.faq.q1.a':              'No hay — una sola entrega semanal de 25 lb cuenta como cuenta comercial si quiere servicio consistente. Los descuentos por nivel comienzan a 50 lb / 200 lb / 500 lb por semana, pero la tarifa estándar aplica debajo de eso sin penalización.',
      'com.faq.q2.q':              '¿Requieren contrato?',
      'com.faq.q2.a':              'No. Precios por libra, sin tarifas de configuración, sin tarifas de salida, sin renovación automática. Váyase cuando quiera, escale arriba o abajo según cambie su negocio.',
      'com.faq.q3.q':              '¿Podemos establecer un horario recurrente de entrega en tienda?',
      'com.faq.q3.a':              'Sí — durante la llamada estándar de incorporación definimos un horario recurrente de entrega en tienda que se ajuste a su negocio. La mayoría de las cuentas usan una mezcla de entregas programadas y visitas presenciales puntuales según permita su semana.',
      'com.faq.q4.q':              '¿Qué tan rápido es el tiempo de entrega?',
      'com.faq.q4.a':              'Ciclo estándar de 24 horas. Las entregas antes de las 11am usualmente están listas para recoger el mismo día. Servicio urgente disponible para corridas de emergencia con un pequeño recargo.',
      'com.faq.q5.q':              '¿Pueden manejar sábanas manchadas o contaminadas?',
      'com.faq.q5.a':              'Sí. Tenemos ciclos con protocolo de manchas para grasa, tratamientos de color, sangre/biológico y otras suciedades pesadas. Cuéntenos qué enviará en la etapa de cotización para planear la mezcla de ciclos.',
      'com.faq.q6.q':              '¿Pueden documentar nuestros ciclos para cumplimiento?',
      'com.faq.q6.a':              'Para cuentas clínicas o reguladas, sí — registros de ejecución de temperatura y hojas de química disponibles bajo solicitud. Menciónelo durante la llamada de cotización para establecer la cadencia de documentación con el resto de su plan de servicio.',
      'com.cta.text':              'La lavandería de volumen no debería ser una trampa de contrato. Construyamos su rutina.',
      'com.cta.callBtn':           'Llamar para cotización',
      'com.cta.directionsBtn':     'Cómo llegar'
    },

    pt: {
      'com.title':                 'Lavanderia comercial que escala com seu negócio',
      'com.tagline':               'VOLUME · MESMO-DIA · SEM CONTRATOS',
      'com.subtitle.premium':              'Água sanitizada com UV de nível hospitalar, máquinas comerciais de 80 libras, entrega programada ou sob demanda. Atendendo consultórios médicos de {{contact.city}}, academias, anfitriões de aluguel de curta temporada, salões e restaurantes — sem contratos, sem taxas de configuração, mínimos mais baixos que qualquer outra lavanderia comercial.',
      'com.subtitle.default':              'Máquinas comerciais Electrolux, entrega programada ou sob demanda. Atendendo consultórios médicos de {{contact.city}}, academias, anfitriões de aluguel de curta temporada, salões e restaurantes — sem contratos, sem taxas de configuração, mínimos mais baixos que qualquer outra lavanderia comercial.',
      'com.callBtn':               'Ligar para orçamento',
      'com.directionsBtn':         'Como chegar',
      'com.stats.turnaround':      'Entrega Padrão',
      'com.stats.capacity':        'Capacidade Por Máquina',
      'com.stats.uv':              'Sanitização UV',
      'com.stats.contracts':       'Contratos Requeridos',
      'com.stats.days':            'Dias por Semana',
      'com.pricing.eyebrow':       'PREÇOS POR VOLUME',
      'com.pricing.rate':          'A partir de $0.95/lb',
      'com.pricing.minLabel':      'Níveis de volume',
      'com.pricing.minSuffix':     'descontos em 50, 200, 500 lb/semana',
      'com.pricing.blurb':         'Preços por libra escalonados ao volume semanal. Orçamentos gratuitos e personalizados à sua rotina — rotação diária de toalhas, troca semanal de lençóis, limpezas mensais ou qualquer outra coisa. Sem contratos, sem mínimos, sem taxas de configuração.',
      'com.pricing.callBtn':       'Obter orçamento personalizado',
      'com.includes.eyebrow':      'INCLUÍDO PARA TODA CONTA',
      'com.includes.title':        'O que toda conta comercial recebe',
      'com.includes.uv':           'Água sanitizada com UV de nível hospitalar (Omni LUX)',
      'com.includes.bigload':      'Lavadoras comerciais Electrolux de 80 lb + secadoras rápidas',
      'com.includes.turnaround':   'Entrega padrão de 24 horas, mesmo dia disponível',
      'com.includes.detergent':    'Detergente hipoalergênico premium incluído',
      'com.includes.scheduled':    'Agendamento flexível de entrega na loja sob solicitação',
      'com.includes.terms':        'Sem contratos · sem taxas de configuração · sem mínimos',
      'com.why.eyebrow':           'POR QUE WAVEMAX',
      'com.why.title':             'Construído para volume comercial:',
      'com.tabs.medical':          'Médico',
      'com.tabs.gym':              'Academias',
      'com.tabs.airbnb':           'Airbnb',
      'com.tabs.restaurant':       'Restaurantes',
      'com.tabs.contractors':      'Empreiteiros',
      'com.tabs.faq':              'Perguntas',
      'com.medical.eyebrow':       'MÉDICO E CLÍNICO',
      'com.medical.lede':          'Lavanderia de nível hospitalar para consultórios médicos, dentários e de terapia',
      'com.medical.t1.title':      'O que lavamos',
      'com.medical.t1.text':       'Uniformes · jalecos · lençóis de mesa de exame · proteção de barreira · lençóis de terapia · babadores dentários. Brancos e coloridos separados, nunca misturados com outras contas.',
      'com.medical.t2.title':      'Conformidade e protocolos',
      'com.medical.t2.text':       'UV Omni LUX de nível hospitalar na entrada da água, ciclos de temperatura validada, registros documentados sob solicitação. Ciclos com protocolo de manchas para sangue e sujeiras biológicas.',
      'com.medical.t3.title':      'Rotina',
      'com.medical.t3.text':       'Entrega na loja diária, semanal ou híbrida. Prazo de entrega previsível em 24 horas. Sem contratos, sem mínimos — escale acima ou abaixo conforme sua prática muda.',
      'com.gym.eyebrow':           'ACADEMIAS E CLUBES',
      'com.gym.lede':              'Programas diários de toalhas em escala, qualidade de toalha de membro',
      'com.gym.t1.title':          'O que lavamos',
      'com.gym.t1.text':           'Toalhas de membros · toalhas de equipe · lençóis de spa · sets de sauna · lençóis de hidromassagem · panos de aulas em grupo. Dobrados para reposição rápida.',
      'com.gym.t2.title':          'Preços por nível de volume',
      'com.gym.t2.text':           'Descontos em 50, 200 e 500 libras por semana. Agendamento flexível de entrega na loja no norte de Austin. A maioria dos clubes vê a rotação diária estabilizar no primeiro mês.',
      'com.gym.t3.title':          'Higiene em escala',
      'com.gym.t3.text':           'A água sanitizada com UV na entrada elimina bactérias causadoras de odor antes que impregnem nos tecidos. Sem mais toalhas de academia "limpas mas ainda com cheiro".',
      'com.airbnb.eyebrow':        'AIRBNB E ALUGUÉIS CURTOS',
      'com.airbnb.lede':           'Troca no mesmo dia para reservas consecutivas',
      'com.airbnb.t1.title':       'O que lavamos',
      'com.airbnb.t1.text':        'Lençóis · fronhas · toalhas · tapetes de banho · edredons · cobertas · linhos de cozinha. Dobrados prontos para check-in e ensacados por propriedade.',
      'com.airbnb.t2.title':       'Troca no mesmo dia',
      'com.airbnb.t2.text':        'Deixe antes das 11h, pronto à noite para o próximo check-in. Anfitriões de múltiplas propriedades podem combinar entregas programadas com entregas urgentes.',
      'com.airbnb.t3.title':       'Cobrança amigável para anfitriões',
      'com.airbnb.t3.text':        'Sem contratos, sem mínimos, sem taxas de configuração por propriedade. Tarifa por libra previsível que escala se você opera uma unidade ou vinte.',
      'com.restaurant.eyebrow':    'RESTAURANTES E CATERING',
      'com.restaurant.lede':       'Linhos diários para cozinhas de alto volume',
      'com.restaurant.t1.title':   'O que lavamos',
      'com.restaurant.t1.text':    'Aventais · jalecos de chef · toalhas de garçom · panos de bar · panos de cozinha · toalhas de mesa · guardanapos. Dimensionados por turno de serviço, prontos para reposição.',
      'com.restaurant.t2.title':   'Protocolos de ciclo de gordura',
      'com.restaurant.t2.text':    'Pré-tratamento para óleos de cozinha e manchas, ciclos dedicados para sujeiras de cozinha. Água sanitizada com UV na entrada em cada carga.',
      'com.restaurant.t3.title':   'Rotina diária',
      'com.restaurant.t3.text':    'Entregas na loja programadas em uma rotação que combina com seus dias de serviço. Sem contratos, escale acima para eventos ou alta temporada sem renegociação.',
      'com.contractors.eyebrow':   'EMPREITEIROS E PRESTADORES DE SERVIÇO',
      'com.contractors.lede':      'Ciclos de sujeira pesada para ofícios trabalhadores',
      'com.contractors.t1.title':  'O que lavamos',
      'com.contractors.t1.text':   'Uniformes · camisas de trabalho · macacões · panos de oficina · lonas · panos de mecânico · equipamento de paisagismo. Pré-tratamento de sujeira pesada na entrada.',
      'com.contractors.t2.title':  'Ofícios atendidos',
      'com.contractors.t2.text':   'Encanadores · eletricistas · mecânicos · paisagistas · pintores · HVAC · carpinteiros · equipes de limpeza. Ciclos de sujeira pesada para gordura, tinta, lama e sujeira.',
      'com.contractors.t3.title':  'Rotina',
      'com.contractors.t3.text':   'Rotação semanal funciona para a maioria das equipes; quinzenal disponível. Agendamento flexível de entrega na loja para negócios baseados em oficina. Sem contratos, escale com sua equipe.',
      'com.tiles.turnaround.title':'Entrega em 24 horas',
      'com.tiles.turnaround.text': 'Ciclo padrão de 24 horas, mesmo dia para entregas antes das 11h. Rotação previsível para que você possa planejar.',
      'com.tiles.terms.title':     'Sem contratos, sem mínimos',
      'com.tiles.terms.text':      'Pague por libra, escale acima ou abaixo conforme as necessidades do seu negócio mudam. Saia quando quiser — sem taxas de saída, sem cláusulas de penalidade.',
      'com.tiles.uv.title':        'Água sanitizada com UV',
      'com.tiles.uv.text':         'Toda lavagem usa água tratada com UV Omni LUX — sanitização de nível hospitalar que excede a higiene padrão da lavanderia comercial.',
      'com.tiles.capacity.title':  'Máquinas de 80 lb, 42 delas',
      'com.tiles.capacity.text':   'Volume é tratado com volume. 42 máquinas comerciais Electrolux 450G significam que sua carga não espera na fila.',
      'com.tiles.scheduled.title': 'Programado ou sob demanda',
      'com.tiles.scheduled.text':  'Entregas na loja recorrentes programadas, ou entregas únicas conforme necessário. Dois modos de serviço, um livro de preços.',
      'com.tiles.local.title':     'Família, local',
      'com.tiles.local.text':      'Fale com uma pessoa real toda vez. Problemas são resolvidos pela mesma equipe que opera o chão — sem música de espera 1-800 nacional.',
      'com.faq.q1.q':              'Qual é o volume mínimo para abrir uma conta comercial?',
      'com.faq.q1.a':              'Não há — uma única entrega semanal de 25 lb conta como conta comercial se você quiser serviço consistente. Os descontos por nível começam em 50 lb / 200 lb / 500 lb por semana, mas a taxa padrão se aplica abaixo disso sem penalidade.',
      'com.faq.q2.q':              'Vocês exigem contrato?',
      'com.faq.q2.a':              'Não. Preços por libra, sem taxas de configuração, sem taxas de saída, sem renovação automática. Saia quando quiser, escale acima ou abaixo conforme seu negócio muda.',
      'com.faq.q3.q':              'Podemos definir um cronograma recorrente de entrega na loja?',
      'com.faq.q3.a':              'Sim — durante a ligação padrão de integração definimos um cronograma recorrente de entrega na loja que se ajuste ao seu negócio. A maioria das contas usa uma mistura de entregas programadas e visitas presenciais pontuais conforme a semana permite.',
      'com.faq.q4.q':              'Qual a velocidade do prazo de entrega?',
      'com.faq.q4.a':              'Ciclo padrão de 24 horas. Entregas antes das 11h geralmente ficam prontas para retirada no mesmo dia. Serviço urgente disponível para corridas de emergência com pequena sobretaxa.',
      'com.faq.q5.q':              'Vocês podem lidar com lençóis manchados ou contaminados?',
      'com.faq.q5.a':              'Sim. Temos ciclos com protocolo de manchas para gordura, tratamentos de cor, sangue/biológico e outras sujeiras pesadas. Conte o que enviará na fase de orçamento para planejarmos a mistura de ciclos.',
      'com.faq.q6.q':              'Vocês podem documentar nossos ciclos para conformidade?',
      'com.faq.q6.a':              'Para contas clínicas ou regulamentadas, sim — registros de execução de temperatura e folhas de química disponíveis sob solicitação. Mencione na ligação de orçamento para definirmos a cadência de documentação com o resto do seu plano de serviço.',
      'com.cta.text':              'Lavanderia de volume não deveria ser uma armadilha de contrato. Vamos construir sua rotina.',
      'com.cta.callBtn':           'Ligar para orçamento',
      'com.cta.directionsBtn':     'Como chegar'
    },

    de: {
      'com.title':                 'Gewerbliche Wäscherei, die mit Ihrem Geschäft mitwächst',
      'com.tagline':               'VOLUMEN · GLEICHTAGIG · OHNE VERTRÄGE',
      'com.subtitle.premium':              'UV-sanitisiertes Wasser in Krankenhausqualität, gewerbliche 80-Pfund-Maschinen, geplante oder bedarfsorientierte Bearbeitung. Wir bedienen Arztpraxen in {{contact.city}}, Fitnessstudios, Kurzzeitvermieter, Salons und Restaurants — keine Verträge, keine Einrichtungsgebühren, niedrigere Mindestmengen als jede andere Gewerbewäscherei.',
      'com.subtitle.default':              'Gewerbliche Electrolux-Maschinen, geplante oder bedarfsorientierte Bearbeitung. Wir bedienen Arztpraxen in {{contact.city}}, Fitnessstudios, Kurzzeitvermieter, Salons und Restaurants — keine Verträge, keine Einrichtungsgebühren, niedrigere Mindestmengen als jede andere Gewerbewäscherei.',
      'com.callBtn':               'Anrufen für Angebot',
      'com.directionsBtn':         'Wegbeschreibung',
      'com.stats.turnaround':      'Standard-Bearbeitung',
      'com.stats.capacity':        'Pro-Maschine-Kapazität',
      'com.stats.uv':              'UV-Sanitisierung',
      'com.stats.contracts':       'Vertrag erforderlich',
      'com.stats.days':            'Tage pro Woche',
      'com.pricing.eyebrow':       'VOLUMENPREISE',
      'com.pricing.rate':          'Ab $0.95/lb',
      'com.pricing.minLabel':      'Volumenstufen',
      'com.pricing.minSuffix':     'Rabatte bei 50, 200, 500 lb/Woche',
      'com.pricing.blurb':         'Gestaffelte Preise pro Pfund, skaliert auf das Wochenvolumen. Angebote sind kostenlos und auf Ihre Routine zugeschnitten — tägliche Handtuchrotation, wöchentlicher Bettwäschetausch, monatliche Tiefenreinigung oder anderes. Keine Verträge, keine Mindestmengen, keine Einrichtungsgebühren.',
      'com.pricing.callBtn':       'Individuelles Angebot anfordern',
      'com.includes.eyebrow':      'IM PREIS ENTHALTEN',
      'com.includes.title':        'Was jedes Geschäftskonto bekommt',
      'com.includes.uv':           'UV-sanitisiertes Wasser in Krankenhausqualität (Omni LUX)',
      'com.includes.bigload':      '80-Pfund Electrolux Profimaschinen + schnelle Trockner',
      'com.includes.turnaround':   '24-Stunden-Standardbearbeitung, gleichtagig verfügbar',
      'com.includes.detergent':    'Premium hypoallergenes Waschmittel inklusive',
      'com.includes.scheduled':    'Flexible Terminplanung für die Abgabe im Geschäft auf Anfrage',
      'com.includes.terms':        'Keine Verträge · keine Einrichtungsgebühren · keine Mindestmengen',
      'com.why.eyebrow':           'WARUM WAVEMAX',
      'com.why.title':             'Gebaut für gewerbliches Volumen:',
      'com.tabs.medical':          'Medizinisch',
      'com.tabs.gym':              'Fitnessstudios',
      'com.tabs.airbnb':           'Airbnb',
      'com.tabs.restaurant':       'Restaurants',
      'com.tabs.contractors':      'Handwerker',
      'com.tabs.faq':              'FAQ',
      'com.medical.eyebrow':       'MEDIZINISCH & KLINISCH',
      'com.medical.lede':          'Wäscherei in Krankenhausqualität für Arzt-, Zahnarzt- und Therapiepraxen',
      'com.medical.t1.title':      'Was wir waschen',
      'com.medical.t1.text':       'Kasacks · Laborkittel · Untersuchungstuch · Barrierematerial · Therapiewäsche · Zahnarzt-Lätzchen. Weiß und Bunt getrennt, nie mit anderen Konten gemischt.',
      'com.medical.t2.title':      'Compliance & Protokolle',
      'com.medical.t2.text':       'Omni LUX UV in Krankenhausqualität am Wassereinlass, temperaturvalidierte Zyklen, Laufprotokoll-Dokumentation auf Anfrage. Fleckenprotokoll-Zyklen für Blut und biologische Verschmutzungen.',
      'com.medical.t3.title':      'Routine',
      'com.medical.t3.text':       'Tägliche, wöchentliche oder hybride Abgabe im Geschäft. Vorhersehbare 24-Stunden-Bearbeitung. Keine Verträge, keine Mindestmengen — skalieren Sie hoch oder runter, wie sich Ihre Praxis ändert.',
      'com.gym.eyebrow':           'FITNESSSTUDIOS & HEALTH CLUBS',
      'com.gym.lede':              'Tägliche Handtuchprogramme im großen Maßstab, Mitglieder-Handtuch-Qualität',
      'com.gym.t1.title':          'Was wir waschen',
      'com.gym.t1.text':           'Mitgliederhandtücher · Personalhandtücher · Spa-Wäsche · Sauna-Sets · Whirlpool-Tücher · Gruppenkurs-Tücher. Gefaltet für schnelle Auffüllung.',
      'com.gym.t2.title':          'Volumenstufen-Preise',
      'com.gym.t2.text':           'Rabatte bei 50, 200 und 500 Pfund pro Woche. Flexible Terminplanung für die Abgabe im Geschäft in Nord-Austin. Die meisten Clubs sehen die tägliche Rotation im ersten Monat stabilisieren.',
      'com.gym.t3.title':          'Hygiene im großen Maßstab',
      'com.gym.t3.text':           'UV-sanitisiertes Wasser am Einlass tötet geruchsbildende Bakterien ab, bevor sie sich auf Stoffen festsetzen. Keine "saubere aber muffige" Sportstudio-Handtücher mehr.',
      'com.airbnb.eyebrow':        'AIRBNB & KURZZEITVERMIETUNG',
      'com.airbnb.lede':           'Gleichtagiger Wechsel für aufeinanderfolgende Buchungen',
      'com.airbnb.t1.title':       'Was wir waschen',
      'com.airbnb.t1.text':        'Bettlaken · Kissenbezüge · Handtücher · Badematten · Bettdecken · Tagesdecken · Küchenwäsche. Gefaltet check-in-bereit und pro Objekt verpackt.',
      'com.airbnb.t2.title':       'Gleichtagiger Wechsel',
      'com.airbnb.t2.text':        'Vor 11 Uhr abgeben, abends bereit für den nächsten Check-in. Mehrobjekt-Vermieter können geplante Abgaben mit Eilabgaben kombinieren.',
      'com.airbnb.t3.title':       'Vermieterfreundliche Abrechnung',
      'com.airbnb.t3.text':        'Keine Verträge, keine Mindestmengen, keine Pro-Objekt-Einrichtungsgebühren. Vorhersehbarer Pro-Pfund-Preis, der skaliert — egal ob Sie eine oder zwanzig Einheiten betreiben.',
      'com.restaurant.eyebrow':    'RESTAURANTS & CATERING',
      'com.restaurant.lede':       'Tägliche Wäsche für Hochvolumen-Küchen',
      'com.restaurant.t1.title':   'Was wir waschen',
      'com.restaurant.t1.text':    'Schürzen · Kochjacken · Servierhandtücher · Bartücher · Küchentücher · Tischwäsche · Servietten. Nach Servierschicht dimensioniert, bereit zum Auffüllen.',
      'com.restaurant.t2.title':   'Fettzyklus-Protokolle',
      'com.restaurant.t2.text':    'Vorbehandlung für Speiseöle und Flecken, dedizierte Zyklen für küchengrade Verschmutzungen. UV-sanitisiertes Wasser am Einlass bei jeder Ladung.',
      'com.restaurant.t3.title':   'Tägliche Routine',
      'com.restaurant.t3.text':    'Geplante Abgaben im Geschäft in einer Rotation, die zu Ihren Servicetagen passt. Keine Verträge, hochskalieren für Veranstaltungen oder Hochsaison ohne Neuverhandlung.',
      'com.contractors.eyebrow':   'HANDWERKER & DIENSTLEISTER',
      'com.contractors.lede':      'Schwerverschmutzungs-Zyklen für arbeitende Gewerke',
      'com.contractors.t1.title':  'Was wir waschen',
      'com.contractors.t1.text':   'Uniformen · Arbeitshemden · Overalls · Werkstatttücher · Abdeckplanen · Mechanikertücher · Landschaftsausrüstung. Schwerverschmutzungs-Vorbehandlung am Eingang.',
      'com.contractors.t2.title':  'Bediente Gewerke',
      'com.contractors.t2.text':   'Klempner · Elektriker · Mechaniker · Landschaftsgärtner · Maler · HLK · Tischler · Reinigungstrupps. Schwerverschmutzungs-Zyklen für Fett, Farbe, Schlamm und Schmutz.',
      'com.contractors.t3.title':  'Routine',
      'com.contractors.t3.text':   'Wöchentliche Rotation funktioniert für die meisten Trupps; zweiwöchentlich verfügbar. Flexible Terminplanung für die Abgabe im Geschäft für werkstattbasierte Unternehmen. Keine Verträge, skalieren mit Ihrer Personalstärke.',
      'com.tiles.turnaround.title':'24-Stunden-Bearbeitung',
      'com.tiles.turnaround.text': 'Standard-24-Stunden-Zyklus, gleichtagig bei Abgaben vor 11 Uhr. Vorhersehbare Rotation, damit Sie planen können.',
      'com.tiles.terms.title':     'Keine Verträge, keine Mindestmengen',
      'com.tiles.terms.text':      'Pro-Pfund-Bezahlung, hoch- oder runterskalieren, wenn sich Ihre Geschäftsbedürfnisse ändern. Jederzeit kündbar — keine Ausstiegsgebühren, keine Strafklauseln.',
      'com.tiles.uv.title':        'UV-sanitisiertes Wasser',
      'com.tiles.uv.text':         'Jede Wäsche nutzt mit UV behandeltes Omni-LUX-Wasser — Krankenhaus-Sanitisierung, die die Standard-Hygiene der Gewerbewäscherei übertrifft.',
      'com.tiles.capacity.title':  '80-Pfund-Maschinen, 42 davon',
      'com.tiles.capacity.text':   'Volumen wird mit Volumen bewältigt. 42 gewerbliche Electrolux 450G-Maschinen bedeuten, dass Ihre Ladung nicht in der Schlange wartet.',
      'com.tiles.scheduled.title': 'Geplant oder bedarfsorientiert',
      'com.tiles.scheduled.text':  'Wiederkehrende geplante Abgaben im Geschäft oder einmalige Abgaben nach Bedarf. Zwei Servicemodi, ein Preisbuch.',
      'com.tiles.local.title':     'Familienbetrieb, lokal',
      'com.tiles.local.text':      'Sprechen Sie jedes Mal mit einer echten Person. Probleme werden vom selben Team gelöst, das den Laden betreibt — keine nationale 1-800-Warteschleifenmusik.',
      'com.faq.q1.q':              'Was ist die Mindestmenge, um ein Geschäftskonto zu eröffnen?',
      'com.faq.q1.a':              'Es gibt keine — eine einzelne 25-Pfund-Wochenlieferung zählt als Geschäftskonto, wenn Sie konsistenten Service möchten. Volumenstufenrabatte beginnen bei 50 lb / 200 lb / 500 lb pro Woche, aber der Standardpreis gilt darunter ohne Strafe.',
      'com.faq.q2.q':              'Verlangen Sie einen Vertrag?',
      'com.faq.q2.a':              'Nein. Pro-Pfund-Preise, keine Einrichtungsgebühren, keine Ausstiegsgebühren, keine automatische Verlängerung. Jederzeit kündbar, hoch- oder runterskalieren, wenn sich Ihr Geschäft ändert.',
      'com.faq.q3.q':              'Können wir einen wiederkehrenden Abgabetermin im Geschäft einrichten?',
      'com.faq.q3.a':              'Ja — im Standard-Onboarding-Anruf legen wir einen wiederkehrenden Abgabeplan im Geschäft fest, der zu Ihrem Betrieb passt. Die meisten Konten nutzen eine Mischung aus geplanten Abgaben und einzelnen Walk-in-Besuchen, wie es ihre Woche erlaubt.',
      'com.faq.q4.q':              'Wie schnell ist die Bearbeitung?',
      'com.faq.q4.a':              'Standard-24-Stunden-Zyklus. Abgaben vor 11 Uhr sind meist am selben Tag zur Abholung bereit. Eilbearbeitung ist für Notfallläufe mit kleinem Aufpreis verfügbar.',
      'com.faq.q5.q':              'Können Sie verschmutzte oder kontaminierte Wäsche bearbeiten?',
      'com.faq.q5.a':              'Ja. Wir haben Fleckenprotokoll-Zyklen für Fett, Farbbehandlungen, Blut/biologisch und andere starke Verschmutzungen. Sagen Sie uns in der Angebotsphase, was Sie senden werden, damit wir den Zyklusmix planen können.',
      'com.faq.q6.q':              'Können Sie unsere Waschzyklen für Compliance dokumentieren?',
      'com.faq.q6.a':              'Für klinische oder regulierte Konten ja — Temperaturlaufprotokolle und Chemiebögen sind auf Anfrage verfügbar. Erwähnen Sie es während des Angebotsanrufs, damit wir die Dokumentationskadenz mit dem Rest Ihres Serviceplans festlegen.',
      'com.cta.text':              'Volumenwäsche sollte keine Vertragsfalle sein. Lassen Sie uns Ihre Routine bauen.',
      'com.cta.callBtn':           'Anrufen für Angebot',
      'com.cta.directionsBtn':     'Wegbeschreibung'
    }
  };

  /* ---------- SEO ---------- */
  const PAGE_URL    = 'https://wavemax.promo/dev/austin-host-mock.html?route=/commercial';
  const HOST_URL    = 'https://wavemax.promo/austin-tx/';
  const HERO_IMG    = window.wmLocationImage('austin-tx/hero-3.jpg');
  const BUSINESS_ID = 'https://www.wavemaxlaundry.com/austin-tx/#localbusiness';

  const SEO = {
    meta: {
      title:        "Commercial Laundry Service · WaveMAX Austin · Volume Pricing & Same-Day Turnaround",
      description:  "Commercial laundry that scales. UV-sanitized water, 80-lb commercial machines, 24-hour turnaround, no contracts. Serving North Austin medical offices, gyms, Airbnb, salons, and restaurants. Quotes free.",
      canonicalUrl: PAGE_URL,
      author:       'WaveMAX Laundry Austin',
      keywords:     'commercial laundry austin, austin commercial laundry service, gym towel service austin, medical laundry austin, airbnb laundry service austin, restaurant linen service austin, salon laundry austin, no-contract commercial laundry'
    },
    openGraph: {
      title:       "Commercial Laundry · WaveMAX Austin · Volume + No Contracts",
      description: 'UV-sanitized · 80-lb capacity · 24-hour turnaround · flexible drop-off scheduling · no contracts.',
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
      title:       'Commercial Laundry · WaveMAX Austin',
      description: 'Volume pricing, 24-hr turnaround, no contracts. Medical, gyms, Airbnb, salons, restaurants.',
      image:       HERO_IMG,
      imageAlt:    'WaveMAX Laundry Austin commercial floor'
    },
    structuredData: {
      localBusiness: {
        '@context':  'https://schema.org',
        '@type':     'LaundryOrDryCleaner',
        '@id':       BUSINESS_ID,
        name:        'WaveMAX Laundry Austin',
        alternateName: 'WaveMAX Austin',
        url:         HOST_URL,
        telephone:   '+15125531674',
        email:       'no-reply@wavemax.promo',
        priceRange:  '$$',
        image:       [HERO_IMG],
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
          { '@type': 'City', name: 'Austin' },
          { '@type': 'City', name: 'Round Rock' },
          { '@type': 'City', name: 'Cedar Park' },
          { '@type': 'City', name: 'Pflugerville' },
          { '@type': 'City', name: 'Georgetown' },
          { '@type': 'City', name: 'Leander' }
        ]
      },
      service: {
        '@context':  'https://schema.org',
        '@type':     'Service',
        '@id':       PAGE_URL + '#service',
        name:        'Commercial Laundry Service',
        serviceType: 'Commercial laundry drop-off, wash, dry, fold',
        category:    'Commercial laundry service',
        url:         PAGE_URL,
        description: 'Volume commercial laundry with 80-lb commercial Electrolux machines and UV-sanitized water. Medical scrubs, gym towels, Airbnb linens, salon capes, restaurant linens. 24-hour turnaround, flexible drop-off scheduling, no contracts.',
        provider:    { '@id': BUSINESS_ID },
        offers: {
          '@type':         'AggregateOffer',
          priceCurrency:   'USD',
          lowPrice:        '0.95',
          priceSpecification: {
            '@type':           'UnitPriceSpecification',
            priceCurrency:     'USD',
            unitText:          'pound',
            referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'LBR' }
          },
          availability:    'https://schema.org/InStock',
          businessFunction: 'https://schema.org/Sell',
          seller:          { '@id': BUSINESS_ID }
        }
      },
      faqPage: {
        '@context':  'https://schema.org',
        '@type':     'FAQPage',
        '@id':       PAGE_URL + '#faq',
        mainEntity: [
          { '@type': 'Question', name: "What's the minimum volume to open a commercial account?", acceptedAnswer: { '@type': 'Answer', text: "There isn't one — a single 25-lb weekly drop counts as a commercial account if you want consistent service. Volume tier discounts kick in at 50 lb / 200 lb / 500 lb per week, but the standard rate applies below that without penalty." } },
          { '@type': 'Question', name: 'Do you require a contract?', acceptedAnswer: { '@type': 'Answer', text: 'No. Per-pound pricing, no setup fees, no exit fees, no auto-renewal. Walk away anytime, scale up or down as your business changes.' } },
          { '@type': 'Question', name: 'Can we set up a recurring drop-off schedule?', acceptedAnswer: { '@type': 'Answer', text: "Yes — we'll work out a recurring drop-off schedule that fits your business during the standard onboarding call." } },
          { '@type': 'Question', name: 'How fast is the turnaround?', acceptedAnswer: { '@type': 'Answer', text: 'Standard 24-hour cycle. Drops before 11am can usually be ready for same-day pickup. Rush turnaround is available for emergency runs at a small surcharge.' } },
          { '@type': 'Question', name: 'Can you handle stained or contaminated linens?', acceptedAnswer: { '@type': 'Answer', text: "Yes. We have stain-protocol cycles for grease, color treatments, blood/biological, and other heavy soils." } },
          { '@type': 'Question', name: 'Can you document our wash cycles for compliance?', acceptedAnswer: { '@type': 'Answer', text: 'For clinical or regulated accounts, yes — temperature run logs and chemistry sheets are available on request.' } }
        ]
      },
      breadcrumb: {
        '@context': 'https://schema.org',
        '@type':    'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'WaveMAX Laundry',  item: 'https://www.wavemaxlaundry.com/' },
          { '@type': 'ListItem', position: 2, name: 'Austin, TX',       item: HOST_URL },
          { '@type': 'ListItem', position: 3, name: 'Commercial'                                              }
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

  /* ---------- Tabs (delegated) ---------- */
  const VALID_TABS = ['medical', 'gym', 'airbnb', 'restaurant', 'contractors', 'faq'];

  function activateTab(target) {
    if (!target || !VALID_TABS.includes(target)) return;
    document.querySelectorAll('[data-com-tab]').forEach((t) =>
      t.setAttribute('aria-selected', t.getAttribute('data-com-tab') === target ? 'true' : 'false'));
    document.querySelectorAll('[data-com-panel]').forEach((p) =>
      p.setAttribute('aria-hidden', p.getAttribute('data-com-panel') === target ? 'false' : 'true'));
    if (window.IframeBridge && window.IframeBridge.updateHeight) {
      window.IframeBridge.updateHeight();
    }
  }

  function initTabs() {
    if (document.__austinComTabsWired) return;
    document.__austinComTabsWired = true;
    document.addEventListener('click', (e) => {
      const tab = e.target.closest && e.target.closest('[data-com-tab]');
      if (!tab) return;
      activateTab(tab.getAttribute('data-com-tab'));
    });
  }

  // Activate the tab specified by ?tab= on initial load and ask the parent
  // to scroll the tab section into view. The auto-resize protocol expands
  // the iframe to its full content height, so the parent — not the iframe —
  // owns the scroll position; we send the section's offset within the
  // iframe document and let the parent compute the scroll target.
  function applyInitialTabFromQuery() {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (!tab) return;
      activateTab(tab);
      // Wait two frames so the panel reflow settles before measuring.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const section = document.getElementById('com-tabs');
        if (!section) return;
        const offset = section.getBoundingClientRect().top + window.scrollY;
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'scroll-to', data: { offset } }, '*');
        }
      }));
    } catch (_) { /* noop */ }
  }

  /* ---------- Cross-frame nav for vertical-page anchors ---------- */
  function initCrossFrameNav() {
    if (document.__austinComNavWired) return;
    document.__austinComNavWired = true;
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest && e.target.closest('a[data-route]');
      if (!a) return;
      e.preventDefault();
      // Build /<slug>/<route>/ from data-route + the slug delivered via
      // location-data. The literal href="?route=..." legacy attribute is
      // ignored — the franchise template uses path-based routing, so a
      // ?route= query just reloads the same page (which was the bug).
      const route = a.getAttribute('data-route') || '';
      const ld    = window.IframeBridge && window.IframeBridge.getLocationData && window.IframeBridge.getLocationData();
      const slug  = (ld && ld.slug) || 'austin-tx';
      const cleanRoute = route.startsWith('/') ? route : '/' + route;
      const targetPath = `/${slug}${cleanRoute}${cleanRoute.endsWith('/') ? '' : '/'}`;
      if (window.IframeBridge && window.IframeBridge.navigateParent) {
        window.IframeBridge.navigateParent(targetPath);
      } else if (window.parent) {
        window.parent.location.href = targetPath;
      }
    });
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

  /* ---------- Init ---------- */
  function init() {
    if (!window.IframeBridge) {
      console.error('[austin-commercial] IframeBridge missing — bridge script must load first');
      return;
    }
    window.IframeBridge.loadTranslations(TRANSLATIONS);
    window.IframeBridge.init({ pageIdentifier: 'austin-commercial', enableTranslation: true, enableAutoResize: true });
    // SEO is built from LOCATION_DATA inside onLocationData below.

    let _locationData = null;
    window.IframeBridge.onLocationData((data) => {
      _locationData = data;
      applyBindings(data);
      setHeroWatermark(data);
      if (window.FranchisePage) {
        window.FranchisePage.applyEquipment(data);
        window.FranchisePage.applyTextPlaceholders(data);
        window.FranchisePage.applyDocumentTitle(data, 'commercial');
        const seo = window.FranchisePage.buildSeo(data, 'commercial');
        if (seo) window.IframeBridge.loadSEOConfig(seo);
      }
      if (window.IframeBridge && window.IframeBridge.updateHeight) window.IframeBridge.updateHeight();
    });
    window.addEventListener('language-changed', () => {
      if (window.FranchisePage && _locationData) {
        applyBindings(_locationData);
        window.FranchisePage.applyEquipment(_locationData);
        window.FranchisePage.applyTextPlaceholders(_locationData);
      }
    });
    initTabs();
    initCrossFrameNav();
    applyInitialTabFromQuery();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
