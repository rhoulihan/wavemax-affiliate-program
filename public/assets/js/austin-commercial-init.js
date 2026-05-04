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
      'com.subtitle':              'Hospital-grade UV-sanitized water, 80-lb commercial machines, scheduled or on-demand turnaround. Serving North Austin medical offices, gyms, short-term-rental hosts, salons, and restaurants — no contracts, no setup fees, lower minimums than any other commercial laundry in town.',
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
      'com.includes.scheduled':    'Scheduled pickup & delivery on request',
      'com.includes.terms':        'No contracts · no setup fees · no minimums',
      'com.verticals.eyebrow':     'INDUSTRY EXPERTISE',
      'com.verticals.title':       'Three industries we serve every week',
      'com.verticals.medical.title':'Medical & clinical',
      'com.verticals.medical.text': 'Scrubs, lab coats, exam-table linens, barrier protection. UV-sanitized + temperature-validated wash cycles. Daily or weekly.',
      'com.verticals.medical.cta':  'See medical-office details →',
      'com.verticals.gym.title':    'Gyms & health clubs',
      'com.verticals.gym.text':     'Daily towel programs at scale. Volume pricing, scheduled pickup, no contracts required. Member-towel grade quality every cycle.',
      'com.verticals.gym.cta':      'See gym & health-club details →',
      'com.verticals.airbnb.title': 'Airbnb & short-term rentals',
      'com.verticals.airbnb.text':  'Same-day turnover support. Sheets, towels, comforters folded and ready by check-in. Drop before 11am, ready that evening.',
      'com.verticals.airbnb.cta':   'See Airbnb & rental details →',
      'com.tabs.how':              'How it works',
      'com.tabs.why':              'Why WaveMAX',
      'com.tabs.lux':              'Sanitization',
      'com.tabs.industries':       'Industries served',
      'com.tabs.faq':              'FAQ',
      'com.how.step1.title':       'Get a quote in one call',
      'com.how.step1.text':        'Tell us what you wash, how often, and the volume. We quote a per-pound rate scaled to your routine. No contracts, no setup fees, no on-site sales pitch.',
      'com.how.step2.title':       'Drop, schedule, or we pick up',
      'com.how.step2.text':        'Three intake options: walk-in drop-off, recurring scheduled drop-off, or scheduled pickup from your business. Pick what fits your operations.',
      'com.how.step3.title':       'Wash, dry, fold, return',
      'com.how.step3.text':        'UV-sanitized water, temperature-validated cycles, hand folding, ready in 24 hours. Same-day available for drop-offs before 11am. Delivered or held for pickup.',
      'com.tiles.turnaround.title':'24-hour turnaround',
      'com.tiles.turnaround.text': 'Standard 24-hour cycle, same-day for drops before 11am. Predictable rotation so you can plan around it.',
      'com.tiles.terms.title':     'No contracts, no minimums',
      'com.tiles.terms.text':      'Pay per pound, scale up or down as your business needs change. Walk away anytime — no exit fees, no penalty clauses.',
      'com.tiles.uv.title':        'UV-sanitized water',
      'com.tiles.uv.text':         'Every wash uses Omni LUX UV-treated water — hospital-grade sanitization that exceeds standard commercial laundry hygiene.',
      'com.tiles.capacity.title':  '80-lb machines, 42 of them',
      'com.tiles.capacity.text':   "Volume gets handled by volume. 42 commercial Electrolux 450G machines mean your load doesn't wait in queue.",
      'com.tiles.scheduled.title': 'Scheduled or on-demand',
      'com.tiles.scheduled.text':  'Recurring pickup & delivery on a schedule, or one-off drops as needed. Two service modes, one price book.',
      'com.tiles.local.title':     'Family-owned, local',
      'com.tiles.local.text':      'Talk to a real person every time. Issues get fixed by the same team that runs the floor — no national 1-800 hold music.',
      'com.lux.disinfection.title':'99.9% disinfection',
      'com.lux.disinfection.text': 'Omni LUX UV at the water inlet kills 99.9% of bacteria and viruses before water reaches the drum. Same UV-C wavelength hospitals use.',
      'com.lux.temp.title':        'Temperature-validated',
      'com.lux.temp.text':         'Hot, warm, or sanitize cycles run at calibrated temperatures. We document run logs on request for clinical accounts that need them.',
      'com.lux.detergent.title':   'Hypoallergenic detergent',
      'com.lux.detergent.text':    'Eco-friendly, biodegradable, fragrance-light. Safe for member towels, exam linens, and sensitive-skin clientele.',
      'com.lux.lifespan.title':    '+20% fabric lifespan',
      'com.lux.lifespan.text':     'UV-treated water is gentler on fabrics. Towels, scrubs, and linens last about 20% longer than standard commercial laundry per Omni Solutions.',
      'com.lux.odor.title':        'Odor eliminated at source',
      'com.lux.odor.text':         'UV kills the bacteria that cause odor before they imprint on fabrics. No more "clean but still musty" gym towels.',
      'com.lux.bleach.title':      'Less harsh chemistry',
      'com.lux.bleach.text':       'UV does the disinfection step, so we use less bleach and less detergent. Easier on fabrics, easier on hands, easier on the environment.',
      'com.ind.medical.title':     'Medical & clinical',
      'com.ind.medical.text':      'Scrubs · lab coats · exam linens · barrier protection · therapy clinics. UV-sanitized + temperature-validated.',
      'com.ind.gym.title':         'Gyms & health clubs',
      'com.ind.gym.text':          'Member towels · staff towels · spa-room linens · steam-room sets. Daily rotation, scheduled pickups, volume tier pricing.',
      'com.ind.airbnb.title':      'Airbnb & rentals',
      'com.ind.airbnb.text':       'Sheets · towels · comforters · throws. Same-day turnover for back-to-back bookings. Drop before 11am, ready that evening.',
      'com.ind.salon.title':       'Salons & barbershops',
      'com.ind.salon.text':        'Capes · towels · color-stained linens · pedicure cloths. Stain-protocol cycles plus UV sanitization, weekly or daily.',
      'com.ind.restaurant.title':  'Restaurants & bars',
      'com.ind.restaurant.text':   'Aprons · server towels · table linens · kitchen rags. Daily turnover, grease-cycle protocols, no contracts required.',
      'com.ind.other.title':       'Custom commercial accounts',
      'com.ind.other.text':        "Pet groomers · physical therapists · day-care centers · specialty workshops. Tell us what you wash and we'll build a routine around it.",
      'com.faq.q1.q':              "What's the minimum volume to open a commercial account?",
      'com.faq.q1.a':              "There isn't one — a single 25-lb weekly drop counts as a commercial account if you want consistent service. Volume tier discounts kick in at 50 lb / 200 lb / 500 lb per week, but the standard rate applies below that without penalty.",
      'com.faq.q2.q':              'Do you require a contract?',
      'com.faq.q2.a':              'No. Per-pound pricing, no setup fees, no exit fees, no auto-renewal. Walk away anytime, scale up or down as your business changes.',
      'com.faq.q3.q':              'Do you offer pickup & delivery?',
      'com.faq.q3.a':              'Yes — scheduled pickup & delivery is available within North Austin and surrounding areas. Quote is part of the standard onboarding call. Most accounts use a mix of scheduled pickups + walk-in drops as their schedule allows.',
      'com.faq.q4.q':              'How fast is the turnaround?',
      'com.faq.q4.a':              'Standard 24-hour cycle. Drops before 11am can usually be returned same-day. Rush turnaround is available for emergency runs at a small surcharge.',
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
      'com.subtitle':              'Agua sanitizada con UV de grado hospitalario, máquinas comerciales de 80 libras, entrega programada o por demanda. Atendiendo a oficinas médicas del norte de Austin, gimnasios, anfitriones de alquileres de corta estancia, salones y restaurantes — sin contratos, sin tarifas de configuración, mínimos más bajos que cualquier otra lavandería comercial.',
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
      'com.includes.scheduled':    'Recolección y entrega programada bajo solicitud',
      'com.includes.terms':        'Sin contratos · sin tarifas de configuración · sin mínimos',
      'com.verticals.eyebrow':     'EXPERIENCIA POR INDUSTRIA',
      'com.verticals.title':       'Tres industrias que servimos cada semana',
      'com.verticals.medical.title':'Médico y clínico',
      'com.verticals.medical.text': 'Uniformes, batas, sábanas de mesa de examen, protección de barrera. Ciclos sanitizados con UV + temperatura validada. Diario o semanal.',
      'com.verticals.medical.cta':  'Ver detalles de oficinas médicas →',
      'com.verticals.gym.title':    'Gimnasios y clubes deportivos',
      'com.verticals.gym.text':     'Programas diarios de toallas a escala. Precios por volumen, recolección programada, sin contratos. Calidad de toalla de socio en cada ciclo.',
      'com.verticals.gym.cta':      'Ver detalles de gimnasios →',
      'com.verticals.airbnb.title': 'Airbnb y rentas a corto plazo',
      'com.verticals.airbnb.text':  'Soporte de cambio el mismo día. Sábanas, toallas, edredones doblados y listos para el check-in. Deje antes de las 11am, listo esa tarde.',
      'com.verticals.airbnb.cta':   'Ver detalles de Airbnb y rentas →',
      'com.tabs.how':              'Cómo funciona',
      'com.tabs.why':              'Por qué WaveMAX',
      'com.tabs.lux':              'Sanitización',
      'com.tabs.industries':       'Industrias servidas',
      'com.tabs.faq':              'Preguntas',
      'com.how.step1.title':       'Cotización en una llamada',
      'com.how.step1.text':        'Cuéntenos qué lava, con qué frecuencia, y el volumen. Cotizamos una tarifa por libra escalada a su rutina. Sin contratos, sin tarifas de configuración, sin presentación de ventas en sitio.',
      'com.how.step2.title':       'Deje, programe o recogemos',
      'com.how.step2.text':        'Tres opciones de entrega: entrega presencial, entrega programada recurrente, o recolección programada en su negocio. Elija lo que se ajuste a sus operaciones.',
      'com.how.step3.title':       'Lavar, secar, doblar, regresar',
      'com.how.step3.text':        'Agua sanitizada con UV, ciclos de temperatura validada, doblado a mano, listo en 24 horas. Mismo día disponible para entregas antes de las 11am. Entregado o retenido para recolección.',
      'com.tiles.turnaround.title':'Entrega en 24 horas',
      'com.tiles.turnaround.text': 'Ciclo estándar de 24 horas, mismo día para entregas antes de las 11am. Rotación predecible para que pueda planear alrededor.',
      'com.tiles.terms.title':     'Sin contratos, sin mínimos',
      'com.tiles.terms.text':      'Pague por libra, escale arriba o abajo según cambien las necesidades de su negocio. Váyase cuando quiera — sin tarifas de salida, sin cláusulas de penalización.',
      'com.tiles.uv.title':        'Agua sanitizada con UV',
      'com.tiles.uv.text':         'Cada lavado usa agua tratada con UV Omni LUX — sanitización de grado hospitalario que excede la higiene estándar de lavandería comercial.',
      'com.tiles.capacity.title':  'Máquinas de 80 lb, 42 de ellas',
      'com.tiles.capacity.text':   'Volumen se maneja con volumen. 42 máquinas comerciales Electrolux 450G significan que su carga no espera en cola.',
      'com.tiles.scheduled.title': 'Programado o por demanda',
      'com.tiles.scheduled.text':  'Recolección y entrega recurrente programada, o entregas únicas según sea necesario. Dos modos de servicio, un solo libro de precios.',
      'com.tiles.local.title':     'Familiar, local',
      'com.tiles.local.text':      'Hable con una persona real cada vez. Los problemas los resuelve el mismo equipo que opera el piso — sin música de espera 1-800 nacional.',
      'com.lux.disinfection.title':'99.9% desinfección',
      'com.lux.disinfection.text': 'Omni LUX UV en la entrada de agua mata 99.9% de bacterias y virus antes de que el agua llegue al tambor. La misma longitud de onda UV-C que usan los hospitales.',
      'com.lux.temp.title':        'Temperatura validada',
      'com.lux.temp.text':         'Ciclos calientes, tibios o de sanitización corren a temperaturas calibradas. Documentamos registros de ejecución bajo solicitud para cuentas clínicas que los necesiten.',
      'com.lux.detergent.title':   'Detergente hipoalergénico',
      'com.lux.detergent.text':    'Ecológico, biodegradable, ligero en fragancia. Seguro para toallas de socios, sábanas de examen y clientela de piel sensible.',
      'com.lux.lifespan.title':    '+20% vida útil de tela',
      'com.lux.lifespan.text':     'El agua tratada con UV es más suave con las telas. Toallas, uniformes y sábanas duran ~20% más que la lavandería comercial estándar según Omni Solutions.',
      'com.lux.odor.title':        'Olor eliminado en la fuente',
      'com.lux.odor.text':         'El UV mata las bacterias causantes de olor antes de que se impriman en las telas. No más toallas de gimnasio "limpias pero todavía con olor".',
      'com.lux.bleach.title':      'Química menos agresiva',
      'com.lux.bleach.text':       'El UV hace el paso de desinfección, así que usamos menos cloro y menos detergente. Más suave para las telas, las manos y el medio ambiente.',
      'com.ind.medical.title':     'Médico y clínico',
      'com.ind.medical.text':      'Uniformes · batas · sábanas de examen · protección de barrera · clínicas terapéuticas. UV-sanitizado + temperatura validada.',
      'com.ind.gym.title':         'Gimnasios y clubes deportivos',
      'com.ind.gym.text':          'Toallas de socios · toallas de personal · sábanas de spa · sets de sauna. Rotación diaria, recolecciones programadas, precios por nivel de volumen.',
      'com.ind.airbnb.title':      'Airbnb y rentas',
      'com.ind.airbnb.text':       'Sábanas · toallas · edredones · mantas. Cambio el mismo día para reservas consecutivas. Deje antes de las 11am, listo esa tarde.',
      'com.ind.salon.title':       'Salones y barberías',
      'com.ind.salon.text':        'Capas · toallas · sábanas manchadas con tinte · paños de pedicura. Ciclos con protocolo de manchas más sanitización UV, semanal o diario.',
      'com.ind.restaurant.title':  'Restaurantes y bares',
      'com.ind.restaurant.text':   'Mandiles · toallas de mesero · manteles · trapos de cocina. Cambio diario, protocolos de ciclo de grasa, sin contratos requeridos.',
      'com.ind.other.title':       'Cuentas comerciales personalizadas',
      'com.ind.other.text':        'Peluqueros caninos · fisioterapeutas · guarderías · talleres especializados. Cuéntenos qué lava y construiremos una rutina alrededor.',
      'com.faq.q1.q':              '¿Cuál es el volumen mínimo para abrir una cuenta comercial?',
      'com.faq.q1.a':              'No hay — una sola entrega semanal de 25 lb cuenta como cuenta comercial si quiere servicio consistente. Los descuentos por nivel comienzan a 50 lb / 200 lb / 500 lb por semana, pero la tarifa estándar aplica debajo de eso sin penalización.',
      'com.faq.q2.q':              '¿Requieren contrato?',
      'com.faq.q2.a':              'No. Precios por libra, sin tarifas de configuración, sin tarifas de salida, sin renovación automática. Váyase cuando quiera, escale arriba o abajo según cambie su negocio.',
      'com.faq.q3.q':              '¿Ofrecen recolección y entrega?',
      'com.faq.q3.a':              'Sí — recolección y entrega programada está disponible dentro del norte de Austin y áreas cercanas. La cotización es parte de la llamada estándar de incorporación. La mayoría de las cuentas usan una mezcla de recolecciones programadas + entregas presenciales según permita su horario.',
      'com.faq.q4.q':              '¿Qué tan rápida es la entrega?',
      'com.faq.q4.a':              'Ciclo estándar de 24 horas. Las entregas antes de las 11am usualmente se pueden devolver el mismo día. Entrega urgente disponible para corridas de emergencia con un pequeño recargo.',
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
      'com.subtitle':              'Água sanitizada com UV de nível hospitalar, máquinas comerciais de 80 libras, entrega programada ou sob demanda. Atendendo consultórios médicos do norte de Austin, academias, anfitriões de aluguel de curta temporada, salões e restaurantes — sem contratos, sem taxas de configuração, mínimos mais baixos que qualquer outra lavanderia comercial.',
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
      'com.includes.scheduled':    'Coleta e entrega programada sob solicitação',
      'com.includes.terms':        'Sem contratos · sem taxas de configuração · sem mínimos',
      'com.verticals.eyebrow':     'EXPERTISE POR SETOR',
      'com.verticals.title':       'Três setores que atendemos toda semana',
      'com.verticals.medical.title':'Médico e clínico',
      'com.verticals.medical.text': 'Uniformes, jalecos, lençóis de mesa de exame, proteção de barreira. Ciclos sanitizados com UV + temperatura validada. Diário ou semanal.',
      'com.verticals.medical.cta':  'Ver detalhes de consultórios médicos →',
      'com.verticals.gym.title':    'Academias e clubes de saúde',
      'com.verticals.gym.text':     'Programas diários de toalhas em escala. Preços por volume, coleta programada, sem contratos. Qualidade de toalha de membro em cada ciclo.',
      'com.verticals.gym.cta':      'Ver detalhes de academias →',
      'com.verticals.airbnb.title': 'Airbnb e aluguéis curtos',
      'com.verticals.airbnb.text':  'Suporte de troca no mesmo dia. Lençóis, toalhas, edredons dobrados e prontos para check-in. Deixe antes das 11h, pronto à noite.',
      'com.verticals.airbnb.cta':   'Ver detalhes de Airbnb →',
      'com.tabs.how':              'Como funciona',
      'com.tabs.why':              'Por que WaveMAX',
      'com.tabs.lux':              'Sanitização',
      'com.tabs.industries':       'Setores atendidos',
      'com.tabs.faq':              'Perguntas',
      'com.how.step1.title':       'Orçamento em uma ligação',
      'com.how.step1.text':        'Conte o que lava, com que frequência e o volume. Cotamos uma taxa por libra escalonada à sua rotina. Sem contratos, sem taxas de configuração, sem apresentação de vendas no local.',
      'com.how.step2.title':       'Deixe, agende ou buscamos',
      'com.how.step2.text':        'Três opções de entrada: entrega presencial, entrega programada recorrente ou coleta programada no seu negócio. Escolha o que se encaixa nas suas operações.',
      'com.how.step3.title':       'Lavar, secar, dobrar, devolver',
      'com.how.step3.text':        'Água sanitizada com UV, ciclos de temperatura validada, dobra à mão, pronto em 24 horas. Mesmo dia disponível para entregas antes das 11h. Entregue ou retido para coleta.',
      'com.tiles.turnaround.title':'Entrega em 24 horas',
      'com.tiles.turnaround.text': 'Ciclo padrão de 24 horas, mesmo dia para entregas antes das 11h. Rotação previsível para que você possa planejar.',
      'com.tiles.terms.title':     'Sem contratos, sem mínimos',
      'com.tiles.terms.text':      'Pague por libra, escale acima ou abaixo conforme as necessidades do seu negócio mudam. Saia quando quiser — sem taxas de saída, sem cláusulas de penalidade.',
      'com.tiles.uv.title':        'Água sanitizada com UV',
      'com.tiles.uv.text':         'Toda lavagem usa água tratada com UV Omni LUX — sanitização de nível hospitalar que excede a higiene padrão da lavanderia comercial.',
      'com.tiles.capacity.title':  'Máquinas de 80 lb, 42 delas',
      'com.tiles.capacity.text':   'Volume é tratado com volume. 42 máquinas comerciais Electrolux 450G significam que sua carga não espera na fila.',
      'com.tiles.scheduled.title': 'Programado ou sob demanda',
      'com.tiles.scheduled.text':  'Coleta e entrega recorrente programada, ou entregas únicas conforme necessário. Dois modos de serviço, um livro de preços.',
      'com.tiles.local.title':     'Família, local',
      'com.tiles.local.text':      'Fale com uma pessoa real toda vez. Problemas são resolvidos pela mesma equipe que opera o chão — sem música de espera 1-800 nacional.',
      'com.lux.disinfection.title':'99.9% desinfecção',
      'com.lux.disinfection.text': 'Omni LUX UV na entrada da água mata 99.9% das bactérias e vírus antes da água atingir o tambor. O mesmo comprimento de onda UV-C que hospitais usam.',
      'com.lux.temp.title':        'Temperatura validada',
      'com.lux.temp.text':         'Ciclos quentes, mornos ou de sanitização rodam em temperaturas calibradas. Documentamos registros de execução sob solicitação para contas clínicas que precisem.',
      'com.lux.detergent.title':   'Detergente hipoalergênico',
      'com.lux.detergent.text':    'Ecológico, biodegradável, leve em fragrância. Seguro para toalhas de membros, lençóis de exame e clientela de pele sensível.',
      'com.lux.lifespan.title':    '+20% vida útil do tecido',
      'com.lux.lifespan.text':     'Água tratada com UV é mais suave nos tecidos. Toalhas, uniformes e lençóis duram ~20% mais que a lavanderia comercial padrão segundo a Omni Solutions.',
      'com.lux.odor.title':        'Odor eliminado na fonte',
      'com.lux.odor.text':         'O UV mata as bactérias que causam odor antes que se imprimam nos tecidos. Não mais toalhas de academia "limpas mas ainda com cheiro".',
      'com.lux.bleach.title':      'Química menos agressiva',
      'com.lux.bleach.text':       'O UV faz a etapa de desinfecção, então usamos menos cloro e menos detergente. Mais suave para os tecidos, mãos e o ambiente.',
      'com.ind.medical.title':     'Médico e clínico',
      'com.ind.medical.text':      'Uniformes · jalecos · lençóis de exame · proteção de barreira · clínicas de terapia. UV-sanitizado + temperatura validada.',
      'com.ind.gym.title':         'Academias e clubes',
      'com.ind.gym.text':          'Toalhas de membros · toalhas de equipe · lençóis de spa · sets de sauna. Rotação diária, coletas programadas, preços por nível.',
      'com.ind.airbnb.title':      'Airbnb e aluguéis',
      'com.ind.airbnb.text':       'Lençóis · toalhas · edredons · cobertas. Troca no mesmo dia para reservas consecutivas. Deixe antes das 11h, pronto à noite.',
      'com.ind.salon.title':       'Salões e barbearias',
      'com.ind.salon.text':        'Capas · toalhas · lençóis manchados de tinta · panos de pedicure. Ciclos com protocolo de manchas mais sanitização UV, semanal ou diário.',
      'com.ind.restaurant.title':  'Restaurantes e bares',
      'com.ind.restaurant.text':   'Aventais · toalhas de garçom · toalhas de mesa · panos de cozinha. Troca diária, protocolos de ciclo de gordura, sem contratos requeridos.',
      'com.ind.other.title':       'Contas comerciais personalizadas',
      'com.ind.other.text':        'Tosquiadores de pet · fisioterapeutas · creches · oficinas especializadas. Conte o que você lava e construiremos uma rotina ao redor.',
      'com.faq.q1.q':              'Qual é o volume mínimo para abrir uma conta comercial?',
      'com.faq.q1.a':              'Não há — uma única entrega semanal de 25 lb conta como conta comercial se você quiser serviço consistente. Os descontos por nível começam em 50 lb / 200 lb / 500 lb por semana, mas a taxa padrão se aplica abaixo disso sem penalidade.',
      'com.faq.q2.q':              'Vocês exigem contrato?',
      'com.faq.q2.a':              'Não. Preços por libra, sem taxas de configuração, sem taxas de saída, sem renovação automática. Saia quando quiser, escale acima ou abaixo conforme seu negócio muda.',
      'com.faq.q3.q':              'Vocês oferecem coleta e entrega?',
      'com.faq.q3.a':              'Sim — coleta e entrega programada está disponível dentro do norte de Austin e áreas próximas. O orçamento faz parte da ligação padrão de integração. A maioria das contas usa uma mistura de coletas programadas + entregas presenciais conforme o cronograma permite.',
      'com.faq.q4.q':              'Qual a velocidade de entrega?',
      'com.faq.q4.a':              'Ciclo padrão de 24 horas. Entregas antes das 11h geralmente podem ser devolvidas no mesmo dia. Entrega urgente disponível para corridas de emergência com pequena sobretaxa.',
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
      'com.subtitle':              'UV-sanitisiertes Wasser in Krankenhausqualität, gewerbliche 80-Pfund-Maschinen, geplante oder bedarfsorientierte Bearbeitung. Wir bedienen Arztpraxen in Nord-Austin, Fitnessstudios, Kurzzeitvermieter, Salons und Restaurants — keine Verträge, keine Einrichtungsgebühren, niedrigere Mindestmengen als jede andere Gewerbewäscherei.',
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
      'com.includes.scheduled':    'Geplante Abholung & Lieferung auf Anfrage',
      'com.includes.terms':        'Keine Verträge · keine Einrichtungsgebühren · keine Mindestmengen',
      'com.verticals.eyebrow':     'BRANCHENEXPERTISE',
      'com.verticals.title':       'Drei Branchen, die wir jede Woche bedienen',
      'com.verticals.medical.title':'Medizinisch & klinisch',
      'com.verticals.medical.text': 'Kasacks, Laborkittel, Untersuchungsliegen-Wäsche, Barrierematerial. UV-sanitisiert + temperaturvalidierte Waschgänge. Täglich oder wöchentlich.',
      'com.verticals.medical.cta':  'Details Arztpraxen ansehen →',
      'com.verticals.gym.title':    'Fitnessstudios & Health Clubs',
      'com.verticals.gym.text':     'Tägliche Handtuchprogramme im großen Maßstab. Volumenpreise, geplante Abholung, keine Verträge. Mitglieder-Handtuch-Qualität in jedem Zyklus.',
      'com.verticals.gym.cta':      'Details Fitnessstudios ansehen →',
      'com.verticals.airbnb.title': 'Airbnb & Kurzzeitvermietung',
      'com.verticals.airbnb.text':  'Gleichtagige Wechselunterstützung. Bettlaken, Handtücher, Bettdecken gefaltet und bereit zum Check-in. Vor 11 Uhr abgeben, abends fertig.',
      'com.verticals.airbnb.cta':   'Details Airbnb & Vermietung →',
      'com.tabs.how':              'So funktioniert es',
      'com.tabs.why':              'Warum WaveMAX',
      'com.tabs.lux':              'Sanitisierung',
      'com.tabs.industries':       'Bedienste Branchen',
      'com.tabs.faq':              'FAQ',
      'com.how.step1.title':       'Angebot in einem Anruf',
      'com.how.step1.text':        'Sagen Sie uns, was Sie waschen, wie oft und das Volumen. Wir nennen einen Preis pro Pfund, skaliert auf Ihre Routine. Keine Verträge, keine Einrichtungsgebühren, kein Vor-Ort-Verkaufsgespräch.',
      'com.how.step2.title':       'Abgeben, planen oder wir holen ab',
      'com.how.step2.text':        'Drei Aufnahmeoptionen: Walk-in-Abgabe, wiederkehrende geplante Abgabe oder geplante Abholung von Ihrem Geschäft. Wählen Sie, was zu Ihrem Betrieb passt.',
      'com.how.step3.title':       'Waschen, trocknen, falten, zurück',
      'com.how.step3.text':        'UV-sanitisiertes Wasser, temperaturvalidierte Zyklen, Handfaltung, in 24 Stunden fertig. Gleichtagig verfügbar bei Abgaben vor 11 Uhr. Geliefert oder zur Abholung bereitgehalten.',
      'com.tiles.turnaround.title':'24-Stunden-Bearbeitung',
      'com.tiles.turnaround.text': 'Standard-24-Stunden-Zyklus, gleichtagig bei Abgaben vor 11 Uhr. Vorhersehbare Rotation, damit Sie planen können.',
      'com.tiles.terms.title':     'Keine Verträge, keine Mindestmengen',
      'com.tiles.terms.text':      'Pro-Pfund-Bezahlung, hoch- oder runterskalieren, wenn sich Ihre Geschäftsbedürfnisse ändern. Jederzeit kündbar — keine Ausstiegsgebühren, keine Strafklauseln.',
      'com.tiles.uv.title':        'UV-sanitisiertes Wasser',
      'com.tiles.uv.text':         'Jede Wäsche nutzt mit UV behandeltes Omni-LUX-Wasser — Krankenhaus-Sanitisierung, die die Standard-Hygiene der Gewerbewäscherei übertrifft.',
      'com.tiles.capacity.title':  '80-Pfund-Maschinen, 42 davon',
      'com.tiles.capacity.text':   'Volumen wird mit Volumen bewältigt. 42 gewerbliche Electrolux 450G-Maschinen bedeuten, dass Ihre Ladung nicht in der Schlange wartet.',
      'com.tiles.scheduled.title': 'Geplant oder bedarfsorientiert',
      'com.tiles.scheduled.text':  'Wiederkehrende geplante Abholung & Lieferung oder einmalige Abgaben nach Bedarf. Zwei Servicemodi, ein Preisbuch.',
      'com.tiles.local.title':     'Familienbetrieb, lokal',
      'com.tiles.local.text':      'Sprechen Sie jedes Mal mit einer echten Person. Probleme werden vom selben Team gelöst, das den Laden betreibt — keine nationale 1-800-Warteschleifenmusik.',
      'com.lux.disinfection.title':'99,9% Desinfektion',
      'com.lux.disinfection.text': 'Omni LUX UV am Wassereinlass tötet 99,9% der Bakterien und Viren ab, bevor das Wasser die Trommel erreicht. Dieselbe UV-C-Wellenlänge, die Krankenhäuser nutzen.',
      'com.lux.temp.title':        'Temperaturvalidiert',
      'com.lux.temp.text':         'Heiße, warme oder Sanitisierungszyklen laufen bei kalibrierten Temperaturen. Wir dokumentieren Laufprotokolle auf Anfrage für klinische Konten, die sie benötigen.',
      'com.lux.detergent.title':   'Hypoallergenes Waschmittel',
      'com.lux.detergent.text':    'Umweltfreundlich, biologisch abbaubar, parfümarm. Sicher für Mitgliederhandtücher, Untersuchungstuch und empfindliche Haut.',
      'com.lux.lifespan.title':    '+20% Stofflebensdauer',
      'com.lux.lifespan.text':     'UV-behandeltes Wasser ist sanfter zu Stoffen. Handtücher, Kasacks und Bettwäsche halten ~20% länger als bei Standard-Gewerbewäscherei laut Omni Solutions.',
      'com.lux.odor.title':        'Geruch an der Quelle eliminiert',
      'com.lux.odor.text':         'UV tötet die Bakterien ab, die Geruch verursachen, bevor sie sich auf Stoffen festsetzen. Keine "saubere aber muffige" Sportstudio-Handtücher mehr.',
      'com.lux.bleach.title':      'Weniger aggressive Chemie',
      'com.lux.bleach.text':       'UV übernimmt den Desinfektionsschritt, also nutzen wir weniger Bleiche und weniger Waschmittel. Sanfter zu Stoffen, Händen und der Umwelt.',
      'com.ind.medical.title':     'Medizinisch & klinisch',
      'com.ind.medical.text':      'Kasacks · Laborkittel · Untersuchungswäsche · Barrierematerial · Therapiekliniken. UV-sanitisiert + temperaturvalidiert.',
      'com.ind.gym.title':         'Fitnessstudios & Clubs',
      'com.ind.gym.text':          'Mitgliederhandtücher · Personalhandtücher · Spa-Wäsche · Sauna-Sets. Tägliche Rotation, geplante Abholungen, Volumenstufenpreise.',
      'com.ind.airbnb.title':      'Airbnb & Vermietung',
      'com.ind.airbnb.text':       'Bettlaken · Handtücher · Bettdecken · Tagesdecken. Gleichtagiger Wechsel für aufeinanderfolgende Buchungen. Vor 11 Uhr abgeben, abends fertig.',
      'com.ind.salon.title':       'Salons & Barbershops',
      'com.ind.salon.text':        'Umhänge · Handtücher · farbverschmutzte Wäsche · Pediküre-Tücher. Fleckenprotokoll-Zyklen plus UV-Sanitisierung, wöchentlich oder täglich.',
      'com.ind.restaurant.title':  'Restaurants & Bars',
      'com.ind.restaurant.text':   'Schürzen · Servierhandtücher · Tischwäsche · Küchentücher. Tägliche Rotation, Fettzyklus-Protokolle, keine Verträge erforderlich.',
      'com.ind.other.title':       'Individuelle Geschäftskonten',
      'com.ind.other.text':        'Hundefriseure · Physiotherapeuten · Kindertagesstätten · Spezialwerkstätten. Sagen Sie uns, was Sie waschen, und wir bauen eine Routine darum.',
      'com.faq.q1.q':              'Was ist die Mindestmenge, um ein Geschäftskonto zu eröffnen?',
      'com.faq.q1.a':              'Es gibt keine — eine einzelne 25-Pfund-Wochenlieferung zählt als Geschäftskonto, wenn Sie konsistenten Service möchten. Volumenstufenrabatte beginnen bei 50 lb / 200 lb / 500 lb pro Woche, aber der Standardpreis gilt darunter ohne Strafe.',
      'com.faq.q2.q':              'Verlangen Sie einen Vertrag?',
      'com.faq.q2.a':              'Nein. Pro-Pfund-Preise, keine Einrichtungsgebühren, keine Ausstiegsgebühren, keine automatische Verlängerung. Jederzeit kündbar, hoch- oder runterskalieren, wenn sich Ihr Geschäft ändert.',
      'com.faq.q3.q':              'Bieten Sie Abholung & Lieferung an?',
      'com.faq.q3.a':              'Ja — geplante Abholung & Lieferung ist innerhalb von Nord-Austin und Umgebung verfügbar. Das Angebot ist Teil des Standard-Onboarding-Anrufs. Die meisten Konten nutzen eine Mischung aus geplanten Abholungen + Walk-in-Abgaben, wie es ihr Zeitplan erlaubt.',
      'com.faq.q4.q':              'Wie schnell ist die Bearbeitung?',
      'com.faq.q4.a':              'Standard-24-Stunden-Zyklus. Abgaben vor 11 Uhr können meist gleichtagig zurückgegeben werden. Eilbearbeitung ist für Notfallläufe mit kleinem Aufpreis verfügbar.',
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
  const HERO_IMG    = 'https://wavemaxlaundry.com/wp-content/uploads/locations/austin-tx/hero-3.jpg';
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
      description: 'UV-sanitized · 80-lb capacity · 24-hour turnaround · pickup & delivery · no contracts.',
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
        serviceType: 'Commercial laundry pickup, wash, dry, fold, delivery',
        category:    'Commercial laundry service',
        url:         PAGE_URL,
        description: 'Volume commercial laundry with 80-lb commercial Electrolux machines and UV-sanitized water. Medical scrubs, gym towels, Airbnb linens, salon capes, restaurant linens. 24-hour turnaround, scheduled pickup & delivery, no contracts.',
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
          { '@type': 'Question', name: 'Do you offer pickup & delivery?', acceptedAnswer: { '@type': 'Answer', text: 'Yes — scheduled pickup & delivery is available within North Austin and surrounding areas. Quote is part of the standard onboarding call.' } },
          { '@type': 'Question', name: 'How fast is the turnaround?', acceptedAnswer: { '@type': 'Answer', text: 'Standard 24-hour cycle. Drops before 11am can usually be returned same-day. Rush turnaround is available for emergency runs at a small surcharge.' } },
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
  const WATERMARK_URL = 'https://wavemaxlaundry.com/wp-content/uploads/locations/austin-tx/hero-1.jpg';

  function setHeroWatermark() {
    const root = document.getElementById('wm-austin-watermark');
    if (!root) return;
    const probe = new Image();
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => {
      root.style.backgroundImage = `url("${WATERMARK_URL}")`;
      root.classList.add('is-loaded');
    };
    probe.onerror = () => { root.classList.add('is-loaded'); };
    probe.src = WATERMARK_URL;
  }

  /* ---------- Tabs (delegated) ---------- */
  function initTabs() {
    if (document.__austinComTabsWired) return;
    document.__austinComTabsWired = true;
    document.addEventListener('click', (e) => {
      const tab = e.target.closest && e.target.closest('[data-com-tab]');
      if (!tab) return;
      const target = tab.getAttribute('data-com-tab');
      document.querySelectorAll('[data-com-tab]').forEach((t) =>
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
      document.querySelectorAll('[data-com-panel]').forEach((p) =>
        p.setAttribute('aria-hidden', p.getAttribute('data-com-panel') === target ? 'false' : 'true'));
      if (window.IframeBridge && window.IframeBridge.updateHeight) {
        window.IframeBridge.updateHeight();
      }
    });
  }

  /* ---------- Cross-frame nav for vertical-page anchors ---------- */
  function initCrossFrameNav() {
    if (document.__austinComNavWired) return;
    document.__austinComNavWired = true;
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
    window.IframeBridge.loadSEOConfig(SEO);

    window.IframeBridge.onLocationData((data) => {
      applyBindings(data);
      if (window.IframeBridge.updateHeight) window.IframeBridge.updateHeight();
    });

    setHeroWatermark();
    initTabs();
    initCrossFrameNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
