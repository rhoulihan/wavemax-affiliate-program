/* Austin Wash-Dry-Fold page initializer.
 *
 * Wires the iframe to the bridge protocol and applies data-bind /
 * data-i18n translations. No form, no API calls — page is read-only
 * informational, content comes from LOCATION_DATA + the translation
 * dictionary below.
 */
(function () {
  'use strict';

  /* ---------- Translations ---------- */
  const TRANSLATIONS = {
    en: {
      'wdf.eyebrow':              'WASH · DRY · FOLD',
      'wdf.title':                'Drop off, walk out',
      'wdf.subtitle':             "Drop your laundry off at WaveMAX Austin — we'll wash it, dry it, fold it, and have it ready for you the next day. Hospital-grade UV-sanitized water, eco-friendly hypoallergenic detergent, no cash needed.",
      'wdf.callBtn':              'Call',
      'wdf.directionsBtn':        'Get directions',
      'wdf.stats.rate':           'Per Pound',
      'wdf.stats.uv':             'UV Sanitization',
      'wdf.stats.turnaround':     'Turnaround',
      'wdf.stats.min':            'Minimum',
      'wdf.stats.days':           'Days a Week',
      'wdf.pricing.eyebrow':      'PRICING',
      'wdf.pricing.minPrefix':    'Minimum',
      'wdf.pricing.minSuffix':    'lb per order',
      'wdf.pricing.blurb':        "Cards-only payment. No cash needed. We weigh on a calibrated scale at drop-off and again at pickup so you always know what you're paying.",
      'wdf.pricing.callBtn':      'Call to schedule',
      'wdf.includes.eyebrow':     'INCLUDED',
      'wdf.includes.title':       'What you get for $1.20/lb',
      'wdf.includes.uv':          'Hospital-grade UV-sanitized water (Omni LUX)',
      'wdf.includes.detergent':   'Eco-friendly hypoallergenic detergent',
      'wdf.includes.fold':        'Professional folding, ready for the closet',
      'wdf.includes.hangers':     'Hangers for delicate items, on request',
      'wdf.includes.turnaround':  '24-hour turnaround (same-day for orders before 11am)',
      'wdf.includes.scale':       'Calibrated weigh at drop-off and pickup',
      'wdf.how.eyebrow':          'HOW IT WORKS',
      'wdf.how.title':            'Three steps, no laundry day',
      'wdf.how.step1.title':      'Drop it off',
      'wdf.how.step1.text':       "Walk in any time during open hours, hand your laundry to the attendant, and you're done. Two-minute drop-off.",
      'wdf.how.step1.hoursLabel': 'Open',
      'wdf.how.step2.title':      'We wash, dry, and fold',
      'wdf.how.step2.text':       'Your clothes are weighed, washed in UV-sanitized water with hypoallergenic detergent, dried at the right temperature, and folded by hand. Whites separated from colors, delicates flagged.',
      'wdf.how.step3.title':      'Pick it up the next day',
      'wdf.how.step3.text':       "Most orders are ready in 24 hours. Drop off before 11am and we can usually have it ready the same evening. We'll text you when it's ready.",
      'wdf.tiles.eyebrow':        'WHY WDF AT WAVEMAX',
      'wdf.tiles.title':          'More than a wash',
      'wdf.tiles.turnaround.title': '24-hour turnaround',
      'wdf.tiles.turnaround.text':  'Drop off Monday, pick up Tuesday. Drop before 11am and we can usually have it ready that same evening.',
      'wdf.tiles.weigh.title':    'Calibrated weigh',
      'wdf.tiles.weigh.text':     'We weigh on a calibrated commercial scale at drop-off and again at pickup. You see what we see.',
      'wdf.tiles.uv.title':       'UV-sanitized water',
      'wdf.tiles.uv.text':        'Every wash uses hospital-grade Omni LUX UV-treated water — the same UV technology hospitals use to kill bacteria and viruses.',
      'wdf.tiles.detergent.title':'Hypoallergenic detergent',
      'wdf.tiles.detergent.text': 'Eco-friendly, biodegradable, fragrance-light. Built for sensitive skin and households with kids or pets.',
      'wdf.tiles.hangers.title':  'Hangers on request',
      'wdf.tiles.hangers.text':   "Flag delicates at drop-off — we'll air-dry, hand-fold, and put them on hangers instead of folding into the stack.",
      'wdf.tabs.how':             'How it works',
      'wdf.tabs.why':             'Why WaveMAX',
      'wdf.tabs.who':             "Who it's for",
      'wdf.tabs.lux':             'Sanitization',
      'wdf.tabs.faq':             'FAQ',
      'wdf.who.families.title':   'Busy families',
      'wdf.who.families.text':    'Reclaim your weekends. Drop off Saturday morning, fold-ready by Sunday — soccer, errands, life all uninterrupted.',
      'wdf.who.pros.title':       'Working professionals',
      'wdf.who.pros.text':        'Skip the laundry-day evenings. Drop off after work; pick up the next afternoon, professionally folded and ready for the closet.',
      'wdf.who.students.title':   'Students',
      'wdf.who.students.text':    "No machine in the building? No problem. Drop a load between classes — we wash, dry, fold while you're off campus.",
      'wdf.who.seniors.title':    'Seniors',
      'wdf.who.seniors.text':     'No more wrestling with bags down to the basement. Drive in, hand off the laundry, drive home. Hand-folded and gentle on delicates.',
      'wdf.who.airbnb.title':     'Airbnb & rental hosts',
      'wdf.who.airbnb.text':      'Same-day turnover support for sheets, towels, comforters. Drop before 11am, pick up that evening — ready for the next check-in.',
      'wdf.who.business.title':   'Small businesses',
      'wdf.who.business.text':    'Salons, barbershops, gyms, restaurants — towels, aprons, uniforms washed on a schedule. Volume pricing, no contracts.',
      'wdf.lux.eyebrow':          'SANITIZATION',
      'wdf.lux.title':            'Hospital-grade clean before the wash even starts',
      'wdf.lux.lede':             "Every WaveMAX Austin washer is fed water that's been sanitized by the Omni LUX UV system at the point of fill. Your laundry never touches untreated water — bacteria, viruses, and odors are killed before the cycle begins.",
      'wdf.lux.stat1':            'odor-causing bacteria eliminated by UV at the inlet',
      'wdf.lux.stat2':            'average clothing lifespan extension reported by Omni Solutions',
      'wdf.lux.stat3':            'harsh chlorine bleach needed — UV does the disinfection step',
      'wdf.lux.point1':           'Same UV-C wavelength technology hospitals use for surgical-room water and air.',
      'wdf.lux.point2':           "Treats the water before it reaches the drum, so every fabric in the load benefits — even those we'd never bleach.",
      'wdf.lux.point3':           'Pairs with our hypoallergenic detergent so the wash is gentle on skin while still hygienically clean.',
      'wdf.lux.point4':           'Works on every cycle — cold, warm, hot — without changing your selected wash temperature.',
      'wdf.tiles.cards.title':    'No subscription',
      'wdf.tiles.cards.text':     'Pay per pound, cards-only. No memberships, no contracts, no hidden fees. Use us when you need us.',
      'wdf.faq.eyebrow':          'QUESTIONS',
      'wdf.faq.title':            'Things people ask',
      'wdf.faq.q1.q':             'How fast is the turnaround?',
      'wdf.faq.q1.a':             "Most orders are ready in 24 hours. Drop off before 11am and we can usually have it ready the same evening. We text you when it's ready.",
      'wdf.faq.q2.q':             'Is there a minimum order size?',
      'wdf.faq.q2.a':             'Yes — 10 lb minimum (~$12 at the $1.20/lb rate). For reference, one full grocery bag of laundry typically weighs 8–12 lb.',
      'wdf.faq.q3.q':             'What about delicates and dry-clean only items?',
      'wdf.faq.q3.a':             "Flag them at drop-off and we'll air-dry, hand-fold, and put them on hangers. We don't currently dry-clean — those items should go to a dedicated dry cleaner.",
      'wdf.faq.q4.q':             'How are loads separated?',
      'wdf.faq.q4.a':             "Whites and colors are washed in separate machines. Your order is never mixed with another customer's. Each bag is tagged at intake.",
      'wdf.faq.q5.q':             'What if something goes missing?',
      'wdf.faq.q5.a':             "We log the weight + bag count at intake, and folded items are bagged together at completion. If you notice something missing, call us within 7 days and we'll trace it.",
      'wdf.faq.q6.q':             'When can I drop off?',
      'wdf.faq.q6.a':             "We're open 7am–10pm, every day, 365 days a year. Drop-off is fully attended — we don't have an after-hours slot, but our hours cover most schedules.",
      'wdf.cta.text':             'Ready to get your weekend back?',
      'wdf.cta.callBtn':          'Call us',
      'wdf.cta.directionsBtn':    'Get directions'
    },
    es: {
      'wdf.eyebrow':              'LAVAR · SECAR · DOBLAR',
      'wdf.title':                'Déjelo, váyase',
      'wdf.subtitle':             'Déjenos su ropa en WaveMAX Austin — la lavamos, secamos, doblamos y la tendremos lista al día siguiente. Agua sanitizada con UV de grado hospitalario, detergente hipoalergénico ecológico, sin efectivo necesario.',
      'wdf.callBtn':              'Llamar',
      'wdf.directionsBtn':        'Cómo llegar',
      'wdf.stats.rate':           'Por Libra',
      'wdf.stats.uv':             'Sanitización UV',
      'wdf.stats.turnaround':     'Entrega',
      'wdf.stats.min':            'Mínimo',
      'wdf.stats.days':           'Días a la Semana',
      'wdf.pricing.eyebrow':      'PRECIOS',
      'wdf.pricing.minPrefix':    'Mínimo',
      'wdf.pricing.minSuffix':    'lb por pedido',
      'wdf.pricing.blurb':        'Pago solo con tarjeta. No se necesita efectivo. Pesamos en una báscula calibrada al dejar y al recoger, así siempre sabe lo que paga.',
      'wdf.pricing.callBtn':      'Llamar para coordinar',
      'wdf.includes.eyebrow':     'INCLUIDO',
      'wdf.includes.title':       'Qué incluye por $1.20/lb',
      'wdf.includes.uv':          'Agua sanitizada con UV de grado hospitalario (Omni LUX)',
      'wdf.includes.detergent':   'Detergente hipoalergénico ecológico',
      'wdf.includes.fold':        'Doblado profesional, listo para el clóset',
      'wdf.includes.hangers':     'Ganchos para prendas delicadas, bajo pedido',
      'wdf.includes.turnaround':  'Entrega en 24 horas (mismo día si llega antes de las 11am)',
      'wdf.includes.scale':       'Pesado calibrado al dejar y al recoger',
      'wdf.how.eyebrow':          'CÓMO FUNCIONA',
      'wdf.how.title':            'Tres pasos, sin día de lavandería',
      'wdf.how.step1.title':      'Déjelo',
      'wdf.how.step1.text':       'Pase en cualquier momento durante el horario de atención, entregue su ropa al encargado y listo. Dos minutos.',
      'wdf.how.step1.hoursLabel': 'Abierto',
      'wdf.how.step2.title':      'Lavamos, secamos y doblamos',
      'wdf.how.step2.text':       'Pesamos su ropa, la lavamos en agua sanitizada con UV y detergente hipoalergénico, la secamos a la temperatura adecuada y la doblamos a mano. Separamos blancos de colores y marcamos las delicadas.',
      'wdf.how.step3.title':      'Recójalo al día siguiente',
      'wdf.how.step3.text':       'La mayoría de los pedidos están listos en 24 horas. Si llega antes de las 11am, puede estar listo esa misma tarde. Le enviamos un mensaje cuando esté listo.',
      'wdf.tiles.eyebrow':        'POR QUÉ WDF EN WAVEMAX',
      'wdf.tiles.title':          'Más que un lavado',
      'wdf.tiles.turnaround.title': 'Entrega en 24 horas',
      'wdf.tiles.turnaround.text':  'Deje el lunes, recoja el martes. Si llega antes de las 11am, casi siempre está listo esa misma tarde.',
      'wdf.tiles.weigh.title':    'Pesaje calibrado',
      'wdf.tiles.weigh.text':     'Pesamos en una báscula comercial calibrada al dejar y al recoger. Usted ve lo que nosotros vemos.',
      'wdf.tiles.uv.title':       'Agua sanitizada con UV',
      'wdf.tiles.uv.text':        'Cada lavado usa agua tratada con UV Omni LUX de grado hospitalario — la misma tecnología UV que usan los hospitales para eliminar bacterias y virus.',
      'wdf.tiles.detergent.title':'Detergente hipoalergénico',
      'wdf.tiles.detergent.text': 'Ecológico, biodegradable, con poco perfume. Pensado para piel sensible y hogares con niños o mascotas.',
      'wdf.tiles.hangers.title':  'Ganchos a pedido',
      'wdf.tiles.hangers.text':   'Marque las prendas delicadas al dejar — las secamos al aire, las doblamos a mano y las colgamos en ganchos en lugar de doblarlas en la pila.',
      'wdf.tabs.how':             'Cómo funciona',
      'wdf.tabs.why':             'Por qué WaveMAX',
      'wdf.tabs.who':             'Para quién es',
      'wdf.tabs.lux':             'Sanitización',
      'wdf.tabs.faq':             'Preguntas',
      'wdf.who.families.title':   'Familias ocupadas',
      'wdf.who.families.text':    'Recupere sus fines de semana. Deje el sábado por la mañana, listo y doblado el domingo — fútbol, mandados, vida sin interrupciones.',
      'wdf.who.pros.title':       'Profesionales',
      'wdf.who.pros.text':        'Olvídese del día de lavandería. Deje al salir del trabajo; recoja al día siguiente, doblado profesionalmente y listo para el clóset.',
      'wdf.who.students.title':   'Estudiantes',
      'wdf.who.students.text':    'Sin máquina en el edificio? No hay problema. Deje una carga entre clases — lavamos, secamos y doblamos mientras está fuera del campus.',
      'wdf.who.seniors.title':    'Adultos mayores',
      'wdf.who.seniors.text':     'Sin batallar con bolsas hasta el sótano. Llegue, entregue la ropa y váyase. Doblado a mano y suave con las prendas delicadas.',
      'wdf.who.airbnb.title':     'Airbnb y rentas',
      'wdf.who.airbnb.text':      'Soporte de turnover el mismo día para sábanas, toallas y edredones. Deje antes de las 11am, recoja esa tarde — listo para el próximo huésped.',
      'wdf.who.business.title':   'Pequeños negocios',
      'wdf.who.business.text':    'Salones, barberías, gimnasios, restaurantes — toallas, mandiles y uniformes lavados en horario fijo. Precios por volumen, sin contratos.',
      'wdf.lux.eyebrow':          'SANITIZACIÓN',
      'wdf.lux.title':            'Limpieza de grado hospitalario antes de iniciar el lavado',
      'wdf.lux.lede':             'Cada lavadora WaveMAX Austin recibe agua sanitizada por el sistema UV Omni LUX en el punto de carga. Su ropa nunca toca agua sin tratar — bacterias, virus y olores son eliminados antes de que comience el ciclo.',
      'wdf.lux.stat1':            'bacterias causantes de olor eliminadas por UV en la entrada',
      'wdf.lux.stat2':            'extensión promedio de la vida útil de la ropa según Omni Solutions',
      'wdf.lux.stat3':            'cloro fuerte necesario — el UV hace el paso de desinfección',
      'wdf.lux.point1':           'La misma tecnología UV-C que los hospitales usan para agua y aire de quirófanos.',
      'wdf.lux.point2':           'Trata el agua antes de llegar al tambor, así toda la ropa de la carga se beneficia — incluso prendas que nunca blanquearíamos.',
      'wdf.lux.point3':           'Se combina con nuestro detergente hipoalergénico para que el lavado sea suave con la piel y aún así higiénicamente limpio.',
      'wdf.lux.point4':           'Funciona en cada ciclo — frío, tibio, caliente — sin alterar la temperatura de lavado seleccionada.',
      'wdf.tiles.cards.title':    'Sin suscripción',
      'wdf.tiles.cards.text':     'Pague por libra, solo tarjeta. Sin membresías, sin contratos, sin cargos ocultos. Úsenos cuando lo necesite.',
      'wdf.faq.eyebrow':          'PREGUNTAS',
      'wdf.faq.title':            'Lo que la gente pregunta',
      'wdf.faq.q1.q':             '¿Cuánto demora la entrega?',
      'wdf.faq.q1.a':             'La mayoría de los pedidos están listos en 24 horas. Si llega antes de las 11am, casi siempre está listo esa misma tarde. Le enviamos un mensaje cuando esté listo.',
      'wdf.faq.q2.q':             '¿Hay un tamaño mínimo de pedido?',
      'wdf.faq.q2.a':             'Sí — mínimo 10 libras (~$12 a $1.20/lb). Como referencia, una bolsa de supermercado llena de ropa pesa entre 8 y 12 libras.',
      'wdf.faq.q3.q':             '¿Y las prendas delicadas o de tintorería?',
      'wdf.faq.q3.a':             'Márquelas al dejar y las secamos al aire, las doblamos a mano y las colgamos en ganchos. No hacemos tintorería — esas prendas deben ir a una tintorería dedicada.',
      'wdf.faq.q4.q':             '¿Cómo separan las cargas?',
      'wdf.faq.q4.a':             'Los blancos y colores se lavan en máquinas separadas. Su pedido nunca se mezcla con el de otro cliente. Cada bolsa se etiqueta al ingreso.',
      'wdf.faq.q5.q':             '¿Qué pasa si falta algo?',
      'wdf.faq.q5.a':             'Registramos el peso y la cantidad de bolsas al ingreso, y las prendas dobladas se embolsan juntas al final. Si nota algo faltante, llámenos en los primeros 7 días y lo rastreamos.',
      'wdf.faq.q6.q':             '¿Cuándo puedo dejar la ropa?',
      'wdf.faq.q6.a':             'Abrimos de 7am a 10pm, todos los días, 365 días al año. El servicio es totalmente atendido — no hay buzón fuera de horario, pero nuestro horario cubre la mayoría de las agendas.',
      'wdf.cta.text':             '¿Listo para recuperar su fin de semana?',
      'wdf.cta.callBtn':          'Llámenos',
      'wdf.cta.directionsBtn':    'Cómo llegar'
    },
    pt: {
      'wdf.eyebrow':              'LAVAR · SECAR · DOBRAR',
      'wdf.title':                'Deixe e vá',
      'wdf.subtitle':             'Deixe sua roupa na WaveMAX Austin — lavamos, secamos, dobramos e devolvemos no dia seguinte. Água sanitizada com UV de nível hospitalar, detergente hipoalergênico ecológico, sem dinheiro necessário.',
      'wdf.callBtn':              'Ligar',
      'wdf.directionsBtn':        'Como chegar',
      'wdf.stats.rate':           'Por Libra',
      'wdf.stats.uv':             'Sanitização UV',
      'wdf.stats.turnaround':     'Entrega',
      'wdf.stats.min':            'Mínimo',
      'wdf.stats.days':           'Dias por Semana',
      'wdf.pricing.eyebrow':      'PREÇOS',
      'wdf.pricing.minPrefix':    'Mínimo',
      'wdf.pricing.minSuffix':    'lb por pedido',
      'wdf.pricing.blurb':        'Pagamento só com cartão. Pesamos em balança calibrada na entrega e na retirada, então você sempre sabe quanto está pagando.',
      'wdf.pricing.callBtn':      'Ligue para agendar',
      'wdf.includes.eyebrow':     'INCLUÍDO',
      'wdf.includes.title':       'O que está incluído por $1.20/lb',
      'wdf.includes.uv':          'Água sanitizada com UV de nível hospitalar (Omni LUX)',
      'wdf.includes.detergent':   'Detergente hipoalergênico ecológico',
      'wdf.includes.fold':        'Dobra profissional, pronto para o armário',
      'wdf.includes.hangers':     'Cabides para peças delicadas, sob solicitação',
      'wdf.includes.turnaround':  'Entrega em 24 horas (mesmo dia para pedidos antes das 11h)',
      'wdf.includes.scale':       'Pesagem calibrada na entrega e na retirada',
      'wdf.how.eyebrow':          'COMO FUNCIONA',
      'wdf.how.title':            'Três passos, sem dia de lavanderia',
      'wdf.how.step1.title':      'Deixe',
      'wdf.how.step1.text':       'Passe a qualquer hora dentro do expediente, entregue sua roupa para o atendente e pronto. Dois minutos.',
      'wdf.how.step1.hoursLabel': 'Aberto',
      'wdf.how.step2.title':      'Nós lavamos, secamos e dobramos',
      'wdf.how.step2.text':       'Pesamos sua roupa, lavamos em água sanitizada com UV e detergente hipoalergênico, secamos na temperatura certa e dobramos à mão. Brancos separados das cores, delicadas marcadas.',
      'wdf.how.step3.title':      'Retire no dia seguinte',
      'wdf.how.step3.text':       'A maioria dos pedidos fica pronta em 24 horas. Se você deixar antes das 11h, pode estar pronto na mesma noite. Mandamos uma mensagem quando estiver pronto.',
      'wdf.tiles.eyebrow':        'POR QUE WDF NA WAVEMAX',
      'wdf.tiles.title':          'Mais que uma lavagem',
      'wdf.tiles.turnaround.title': 'Entrega em 24 horas',
      'wdf.tiles.turnaround.text':  'Deixe na segunda, retire na terça. Deixando antes das 11h, geralmente fica pronto na mesma noite.',
      'wdf.tiles.weigh.title':    'Pesagem calibrada',
      'wdf.tiles.weigh.text':     'Pesamos em balança comercial calibrada na entrega e na retirada. Você vê o que nós vemos.',
      'wdf.tiles.uv.title':       'Água sanitizada com UV',
      'wdf.tiles.uv.text':        'Toda lavagem usa água tratada com UV Omni LUX de nível hospitalar — a mesma tecnologia UV que hospitais usam para eliminar bactérias e vírus.',
      'wdf.tiles.detergent.title':'Detergente hipoalergênico',
      'wdf.tiles.detergent.text': 'Ecológico, biodegradável, com pouco perfume. Feito para pele sensível e lares com crianças ou pets.',
      'wdf.tiles.hangers.title':  'Cabides sob solicitação',
      'wdf.tiles.hangers.text':   'Marque as peças delicadas na entrega — secamos ao ar, dobramos à mão e colocamos em cabides em vez de dobrar na pilha.',
      'wdf.tabs.how':             'Como funciona',
      'wdf.tabs.why':             'Por que WaveMAX',
      'wdf.tabs.who':             'Para quem é',
      'wdf.tabs.lux':             'Sanitização',
      'wdf.tabs.faq':             'Perguntas',
      'wdf.who.families.title':   'Famílias ocupadas',
      'wdf.who.families.text':    'Recupere seus fins de semana. Deixe sábado de manhã, dobrado pronto domingo — futebol, compras, vida sem interrupções.',
      'wdf.who.pros.title':       'Profissionais',
      'wdf.who.pros.text':        'Pule as noites de lavanderia. Deixe ao sair do trabalho; retire na tarde seguinte, dobrado profissionalmente e pronto para o armário.',
      'wdf.who.students.title':   'Estudantes',
      'wdf.who.students.text':    'Sem máquina no prédio? Sem problemas. Deixe uma carga entre aulas — lavamos, secamos e dobramos enquanto você está fora do campus.',
      'wdf.who.seniors.title':    'Idosos',
      'wdf.who.seniors.text':     'Sem mais carregar sacolas até o porão. Chegue, entregue a roupa e volte para casa. Dobra à mão e suave com peças delicadas.',
      'wdf.who.airbnb.title':     'Airbnb e aluguéis',
      'wdf.who.airbnb.text':      'Apoio de virada no mesmo dia para lençóis, toalhas e edredons. Deixe antes das 11h, retire à tarde — pronto para o próximo check-in.',
      'wdf.who.business.title':   'Pequenos negócios',
      'wdf.who.business.text':    'Salões, barbearias, academias, restaurantes — toalhas, aventais, uniformes lavados em horário fixo. Preços por volume, sem contratos.',
      'wdf.lux.eyebrow':          'SANITIZAÇÃO',
      'wdf.lux.title':            'Limpeza de nível hospitalar antes mesmo da lavagem começar',
      'wdf.lux.lede':             'Cada lavadora WaveMAX Austin recebe água sanitizada pelo sistema UV Omni LUX no ponto de enchimento. Sua roupa nunca toca água sem tratamento — bactérias, vírus e odores são eliminados antes do ciclo começar.',
      'wdf.lux.stat1':            'bactérias causadoras de odor eliminadas pelo UV na entrada',
      'wdf.lux.stat2':            'extensão média da vida útil da roupa relatada pela Omni Solutions',
      'wdf.lux.stat3':            'cloro forte necessário — o UV faz a etapa de desinfecção',
      'wdf.lux.point1':           'A mesma tecnologia UV-C que hospitais usam para água e ar de salas cirúrgicas.',
      'wdf.lux.point2':           'Trata a água antes que chegue ao tambor, então toda a roupa da carga se beneficia — mesmo peças que nunca branquearíamos.',
      'wdf.lux.point3':           'Combina com nosso detergente hipoalergênico para que a lavagem seja suave com a pele e ainda higienicamente limpa.',
      'wdf.lux.point4':           'Funciona em todo ciclo — frio, morno, quente — sem alterar a temperatura de lavagem selecionada.',
      'wdf.tiles.cards.title':    'Sem assinatura',
      'wdf.tiles.cards.text':     'Pague por libra, só cartão. Sem mensalidades, sem contratos, sem taxas escondidas. Use quando precisar.',
      'wdf.faq.eyebrow':          'PERGUNTAS',
      'wdf.faq.title':            'O que as pessoas perguntam',
      'wdf.faq.q1.q':             'Qual é o prazo de entrega?',
      'wdf.faq.q1.a':             'A maioria dos pedidos fica pronta em 24 horas. Se você deixar antes das 11h, geralmente está pronto na mesma noite. Mandamos uma mensagem quando estiver pronto.',
      'wdf.faq.q2.q':             'Existe um pedido mínimo?',
      'wdf.faq.q2.a':             'Sim — mínimo de 10 libras (~$12 a $1.20/lb). Para referência, uma sacola de mercado cheia de roupa pesa de 8 a 12 libras.',
      'wdf.faq.q3.q':             'E peças delicadas ou de lavagem a seco?',
      'wdf.faq.q3.a':             'Marque na entrega e secamos ao ar, dobramos à mão e colocamos em cabides. Não fazemos lavagem a seco — essas peças devem ir a uma lavanderia dedicada.',
      'wdf.faq.q4.q':             'Como as cargas são separadas?',
      'wdf.faq.q4.a':             'Brancos e coloridos são lavados em máquinas separadas. Seu pedido nunca é misturado com o de outro cliente. Cada saco é etiquetado na entrada.',
      'wdf.faq.q5.q':             'E se algo sumir?',
      'wdf.faq.q5.a':             'Registramos o peso e o número de sacos na entrada, e as peças dobradas são ensacadas juntas no fim. Se notar algo faltando, ligue em até 7 dias e rastreamos.',
      'wdf.faq.q6.q':             'Quando posso deixar?',
      'wdf.faq.q6.a':             'Abrimos das 7h às 22h, todos os dias, 365 dias por ano. O atendimento é totalmente acompanhado — não há caixa fora de horário, mas nossos horários cobrem a maioria das rotinas.',
      'wdf.cta.text':             'Pronto para recuperar seu fim de semana?',
      'wdf.cta.callBtn':          'Ligue para nós',
      'wdf.cta.directionsBtn':    'Como chegar'
    },
    de: {
      'wdf.eyebrow':              'WASCHEN · TROCKNEN · FALTEN',
      'wdf.title':                'Abgeben, weitergehen',
      'wdf.subtitle':             'Geben Sie Ihre Wäsche bei WaveMAX Austin ab — wir waschen, trocknen und falten sie und haben sie am nächsten Tag fertig. UV-sanitisiertes Wasser in Krankenhausqualität, umweltfreundliches hypoallergenes Waschmittel, kein Bargeld erforderlich.',
      'wdf.callBtn':              'Anrufen',
      'wdf.directionsBtn':        'Wegbeschreibung',
      'wdf.stats.rate':           'Pro Pfund',
      'wdf.stats.uv':             'UV-Sanitisierung',
      'wdf.stats.turnaround':     'Bearbeitung',
      'wdf.stats.min':            'Mindestmenge',
      'wdf.stats.days':           'Tage pro Woche',
      'wdf.pricing.eyebrow':      'PREISE',
      'wdf.pricing.minPrefix':    'Mindestmenge',
      'wdf.pricing.minSuffix':    'lb pro Auftrag',
      'wdf.pricing.blurb':        'Kartenzahlung nur. Kein Bargeld erforderlich. Wir wiegen auf einer kalibrierten Waage bei Abgabe und Abholung, damit Sie immer wissen, was Sie zahlen.',
      'wdf.pricing.callBtn':      'Anrufen zur Terminvereinbarung',
      'wdf.includes.eyebrow':     'INKLUSIVE',
      'wdf.includes.title':       'Was Sie für $1.20/lb bekommen',
      'wdf.includes.uv':          'UV-sanitisiertes Wasser in Krankenhausqualität (Omni LUX)',
      'wdf.includes.detergent':   'Umweltfreundliches hypoallergenes Waschmittel',
      'wdf.includes.fold':        'Professionelles Falten, schrankfertig',
      'wdf.includes.hangers':     'Bügel für empfindliche Stücke, auf Anfrage',
      'wdf.includes.turnaround':  '24-Stunden-Lieferung (gleicher Tag bei Aufträgen vor 11 Uhr)',
      'wdf.includes.scale':       'Kalibrierte Wägung bei Abgabe und Abholung',
      'wdf.how.eyebrow':          'SO FUNKTIONIERT ES',
      'wdf.how.title':            'Drei Schritte, kein Waschtag',
      'wdf.how.step1.title':      'Abgeben',
      'wdf.how.step1.text':       'Kommen Sie jederzeit während der Öffnungszeiten vorbei, übergeben Sie Ihre Wäsche dem Mitarbeiter und fertig. Zwei Minuten.',
      'wdf.how.step1.hoursLabel': 'Geöffnet',
      'wdf.how.step2.title':      'Wir waschen, trocknen und falten',
      'wdf.how.step2.text':       'Ihre Kleidung wird gewogen, in UV-sanitisiertem Wasser mit hypoallergenem Waschmittel gewaschen, bei der richtigen Temperatur getrocknet und von Hand gefaltet. Weiß von Farben getrennt, Empfindliches markiert.',
      'wdf.how.step3.title':      'Am nächsten Tag abholen',
      'wdf.how.step3.text':       'Die meisten Aufträge sind in 24 Stunden fertig. Bei Abgabe vor 11 Uhr können wir sie meist am selben Abend fertig haben. Wir benachrichtigen Sie per SMS, sobald sie bereit ist.',
      'wdf.tiles.eyebrow':        'WARUM WDF BEI WAVEMAX',
      'wdf.tiles.title':          'Mehr als nur ein Waschgang',
      'wdf.tiles.turnaround.title': '24-Stunden-Lieferung',
      'wdf.tiles.turnaround.text':  'Montag abgeben, Dienstag abholen. Bei Abgabe vor 11 Uhr meist noch am selben Abend fertig.',
      'wdf.tiles.weigh.title':    'Kalibrierte Wägung',
      'wdf.tiles.weigh.text':     'Wir wiegen auf einer kalibrierten Profi-Waage bei Abgabe und bei Abholung. Sie sehen, was wir sehen.',
      'wdf.tiles.uv.title':       'UV-sanitisiertes Wasser',
      'wdf.tiles.uv.text':        'Jeder Waschgang nutzt UV-behandeltes Omni-LUX-Wasser in Krankenhausqualität — dieselbe UV-Technologie, die Krankenhäuser nutzen, um Bakterien und Viren abzutöten.',
      'wdf.tiles.detergent.title':'Hypoallergenes Waschmittel',
      'wdf.tiles.detergent.text': 'Umweltfreundlich, biologisch abbaubar, parfümarm. Für empfindliche Haut und Haushalte mit Kindern oder Haustieren.',
      'wdf.tiles.hangers.title':  'Bügel auf Anfrage',
      'wdf.tiles.hangers.text':   'Markieren Sie empfindliche Stücke bei der Abgabe — wir trocknen sie an der Luft, falten von Hand und hängen sie auf Bügel statt in den Stapel.',
      'wdf.tabs.how':             'So funktioniert es',
      'wdf.tabs.why':             'Warum WaveMAX',
      'wdf.tabs.who':             'Für wen es ist',
      'wdf.tabs.lux':             'Sanitisierung',
      'wdf.tabs.faq':             'FAQ',
      'wdf.who.families.title':   'Vielbeschäftigte Familien',
      'wdf.who.families.text':    'Holen Sie sich Ihre Wochenenden zurück. Samstagmorgen abgeben, sonntags gefaltet abholbereit — Sport, Erledigungen, Leben ohne Unterbrechung.',
      'wdf.who.pros.title':       'Berufstätige',
      'wdf.who.pros.text':        'Schluss mit Wäscheabenden. Nach der Arbeit abgeben; am nächsten Nachmittag abholen, professionell gefaltet und schrankfertig.',
      'wdf.who.students.title':   'Studierende',
      'wdf.who.students.text':    'Keine Maschine im Wohnheim? Kein Problem. Geben Sie zwischen Vorlesungen eine Ladung ab — wir waschen, trocknen und falten, während Sie unterwegs sind.',
      'wdf.who.seniors.title':    'Senioren',
      'wdf.who.seniors.text':     'Keine Wäschesäcke mehr in den Keller schleppen. Ankommen, Wäsche übergeben, nach Hause fahren. Handgefaltet und schonend zu Empfindlichem.',
      'wdf.who.airbnb.title':     'Airbnb & Vermieter',
      'wdf.who.airbnb.text':      'Same-Day-Wechsel für Bettwäsche, Handtücher, Bettdecken. Vor 11 Uhr abgeben, am Abend abholen — bereit für den nächsten Check-in.',
      'wdf.who.business.title':   'Kleinunternehmen',
      'wdf.who.business.text':    'Friseursalons, Barbershops, Fitnessstudios, Restaurants — Handtücher, Schürzen, Uniformen nach Zeitplan gewaschen. Mengenpreise, keine Verträge.',
      'wdf.lux.eyebrow':          'SANITISIERUNG',
      'wdf.lux.title':            'Krankenhausreinheit, bevor der Waschgang überhaupt beginnt',
      'wdf.lux.lede':             'Jede WaveMAX-Austin-Maschine bekommt Wasser, das vom Omni-LUX-UV-System am Einfüllpunkt sanitisiert wurde. Ihre Wäsche berührt nie unbehandeltes Wasser — Bakterien, Viren und Gerüche werden abgetötet, bevor der Zyklus beginnt.',
      'wdf.lux.stat1':            'geruchsbildende Bakterien werden von UV am Einlass eliminiert',
      'wdf.lux.stat2':            'durchschnittliche Verlängerung der Kleidungslebensdauer laut Omni Solutions',
      'wdf.lux.stat3':            'aggressives Chlorbleichmittel erforderlich — UV übernimmt die Desinfektion',
      'wdf.lux.point1':           'Dieselbe UV-C-Wellenlänge, die Krankenhäuser für Wasser und Luft im OP verwenden.',
      'wdf.lux.point2':           'Behandelt das Wasser, bevor es die Trommel erreicht, sodass jeder Stoff in der Ladung profitiert — auch Stücke, die wir nie bleichen würden.',
      'wdf.lux.point3':           'Kombiniert mit unserem hypoallergenen Waschmittel, damit der Waschgang hautschonend und dennoch hygienisch sauber ist.',
      'wdf.lux.point4':           'Funktioniert in jedem Zyklus — kalt, warm, heiß — ohne die gewählte Waschtemperatur zu ändern.',
      'wdf.tiles.cards.title':    'Kein Abo',
      'wdf.tiles.cards.text':     'Zahlen Sie pro Pfund, nur Karte. Keine Mitgliedschaften, keine Verträge, keine versteckten Gebühren. Nutzen Sie uns, wenn Sie uns brauchen.',
      'wdf.faq.eyebrow':          'FRAGEN',
      'wdf.faq.title':            'Was Leute fragen',
      'wdf.faq.q1.q':             'Wie schnell ist die Bearbeitung?',
      'wdf.faq.q1.a':             'Die meisten Aufträge sind in 24 Stunden fertig. Bei Abgabe vor 11 Uhr meist noch am selben Abend. Wir benachrichtigen Sie per SMS, sobald es fertig ist.',
      'wdf.faq.q2.q':             'Gibt es eine Mindestmenge?',
      'wdf.faq.q2.a':             'Ja — Mindestmenge 10 Pfund (~$12 bei $1,20/lb). Zur Orientierung: Eine volle Einkaufstasche Wäsche wiegt typischerweise 8–12 Pfund.',
      'wdf.faq.q3.q':             'Wie ist es mit Empfindlichem oder Reinigungsstücken?',
      'wdf.faq.q3.a':             'Markieren Sie sie bei der Abgabe — wir trocknen sie an der Luft, falten von Hand und hängen sie auf Bügel. Wir reinigen derzeit nicht chemisch — solche Stücke gehören zu einer Reinigung.',
      'wdf.faq.q4.q':             'Wie werden die Ladungen getrennt?',
      'wdf.faq.q4.a':             'Weiß und Bunt werden in getrennten Maschinen gewaschen. Ihr Auftrag wird nie mit dem eines anderen Kunden gemischt. Jeder Beutel wird beim Eingang markiert.',
      'wdf.faq.q5.q':             'Was, wenn etwas fehlt?',
      'wdf.faq.q5.a':             'Wir protokollieren Gewicht und Beutelzahl beim Eingang; gefaltete Stücke werden zusammen verpackt. Wenn etwas fehlt, rufen Sie uns innerhalb von 7 Tagen an — wir gehen dem nach.',
      'wdf.faq.q6.q':             'Wann kann ich abgeben?',
      'wdf.faq.q6.a':             'Wir haben täglich von 7–22 Uhr geöffnet, 365 Tage im Jahr. Vollständig betreute Annahme — keinen Außerhalb-der-Zeit-Briefkasten, aber unsere Öffnungszeiten decken die meisten Tagesabläufe ab.',
      'wdf.cta.text':             'Bereit, Ihr Wochenende zurückzubekommen?',
      'wdf.cta.callBtn':          'Rufen Sie uns an',
      'wdf.cta.directionsBtn':    'Wegbeschreibung'
    }
  };

  /* ---------- SEO ----------
   * Bridge schema (parent-iframe-bridge-v3.applySeoData):
   *   meta · openGraph · twitter · structuredData · alternateLanguages
   *
   * structuredData blocks emitted:
   *   - localBusiness  (LaundryOrDryCleaner, anchored by stable @id)
   *   - service        (the WDF service offering, with priceSpecification)
   *   - faqPage        (the six on-page FAQs — drives Google rich results)
   *   - breadcrumb     (Home → Austin → WDF)
   */
  const PAGE_URL    = 'https://wavemax.promo/dev/austin-host-mock.html?route=/wash-dry-fold';
  const HOST_URL    = 'https://wavemax.promo/austin-tx/';
  const HERO_IMG    = 'https://wavemaxlaundry.com/wp-content/uploads/locations/austin-tx/hero-3.jpg';
  const BUSINESS_ID = 'https://www.wavemaxlaundry.com/austin-tx/#localbusiness';

  const SEO = {
    meta: {
      title:        'Wash-Dry-Fold Laundry Service · WaveMAX Austin',
      description:  'Drop-off wash-dry-fold laundry in North Austin. $1.20/lb, 10-lb minimum, hospital-grade UV-sanitized water, hypoallergenic detergent, 24-hour turnaround at 825 E Rundberg Ln F1.',
      canonicalUrl: PAGE_URL,
      author:       'WaveMAX Laundry Austin',
      keywords:     'wash dry fold austin, wdf laundry austin, drop off laundry austin tx, laundry service near me, fluff and fold austin, north austin wash dry fold, wavemax austin wdf, same-day laundry austin, hypoallergenic laundry service'
    },
    openGraph: {
      title:       'Wash-Dry-Fold at WaveMAX Austin · $1.20/lb · 24h turnaround',
      description: 'Drop off, walk out. Hospital-grade UV-sanitized water, hypoallergenic detergent, calibrated weighs, hand-folded.',
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
      title:       'Wash-Dry-Fold · WaveMAX Austin',
      description: '$1.20/lb drop-off laundry in North Austin. 24-hour turnaround, UV-sanitized water, hypoallergenic detergent.',
      image:       HERO_IMG,
      imageAlt:    'WaveMAX Laundry Austin folded laundry'
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
        priceRange:  '$',
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
      // The actual service offering with priceSpec — this is what
      // Google shops to local-service search experiences.
      service: {
        '@context':  'https://schema.org',
        '@type':     'Service',
        '@id':       PAGE_URL + '#service',
        name:        'Wash-Dry-Fold Drop-Off Laundry',
        alternateName: 'Fluff and Fold',
        serviceType: 'Wash and fold laundry service',
        category:    'Laundry service',
        url:         PAGE_URL,
        description: 'Drop your laundry off and we wash, dry, and fold it. Hospital-grade UV-sanitized water, hypoallergenic detergent, 24-hour turnaround. 10-lb minimum.',
        areaServed: [
          { '@type': 'City', name: 'Austin'        },
          { '@type': 'City', name: 'Round Rock'    },
          { '@type': 'City', name: 'Cedar Park'    },
          { '@type': 'City', name: 'Pflugerville'  }
        ],
        provider:   { '@id': BUSINESS_ID },
        offers: {
          '@type':         'Offer',
          priceCurrency:   'USD',
          price:           '1.20',
          unitText:        'pound',
          eligibleQuantity: { '@type': 'QuantitativeValue', minValue: 10, unitCode: 'LBR' },
          priceSpecification: {
            '@type':           'UnitPriceSpecification',
            price:             1.20,
            priceCurrency:     'USD',
            unitText:          'pound',
            referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'LBR' }
          },
          availability:    'https://schema.org/InStock',
          businessFunction: 'https://schema.org/Sell',
          seller:          { '@id': BUSINESS_ID }
        },
        hoursAvailable: [{
          '@type':   'OpeningHoursSpecification',
          dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
          opens:     '07:00',
          closes:    '22:00'
        }]
      },
      // FAQPage — feeds Google's "People Also Ask" / accordion rich
      // results. Q+A wording mirrors the on-page FAQ exactly so Google
      // can match the rendered DOM to the schema.
      faqPage: {
        '@context':  'https://schema.org',
        '@type':     'FAQPage',
        '@id':       PAGE_URL + '#faq',
        mainEntity: [
          {
            '@type':         'Question',
            name:            'How fast is the turnaround?',
            acceptedAnswer:  {
              '@type': 'Answer',
              text:    "Most orders are ready in 24 hours. Drop off before 11am and we can usually have it ready the same evening. We text you when it's ready."
            }
          },
          {
            '@type':         'Question',
            name:            'Is there a minimum order size?',
            acceptedAnswer:  {
              '@type': 'Answer',
              text:    'Yes — 10 lb minimum (~$12 at the $1.20/lb rate). For reference, one full grocery bag of laundry typically weighs 8–12 lb.'
            }
          },
          {
            '@type':         'Question',
            name:            'What about delicates and dry-clean only items?',
            acceptedAnswer:  {
              '@type': 'Answer',
              text:    "Flag them at drop-off and we'll air-dry, hand-fold, and put them on hangers. We don't currently dry-clean — those items should go to a dedicated dry cleaner."
            }
          },
          {
            '@type':         'Question',
            name:            'How are loads separated?',
            acceptedAnswer:  {
              '@type': 'Answer',
              text:    "Whites and colors are washed in separate machines. Your order is never mixed with another customer's. Each bag is tagged at intake."
            }
          },
          {
            '@type':         'Question',
            name:            'What if something goes missing?',
            acceptedAnswer:  {
              '@type': 'Answer',
              text:    "We log the weight and bag count at intake, and folded items are bagged together at completion. If you notice something missing, call us within 7 days and we'll trace it."
            }
          },
          {
            '@type':         'Question',
            name:            'When can I drop off?',
            acceptedAnswer:  {
              '@type': 'Answer',
              text:    "We're open 7am–10pm, every day, 365 days a year. Drop-off is fully attended — we don't have an after-hours slot, but our hours cover most schedules."
            }
          }
        ]
      },
      breadcrumb: {
        '@context': 'https://schema.org',
        '@type':    'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'WaveMAX Laundry',  item: 'https://www.wavemaxlaundry.com/' },
          { '@type': 'ListItem', position: 2, name: 'Austin, TX',       item: HOST_URL },
          { '@type': 'ListItem', position: 3, name: 'Wash-Dry-Fold'                                            }
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

  /* ---------- Hero watermark ----------
   * Same treatment as the landing-page hero: set the Austin store-photo
   * as a background-image on the watermark div once it loads, then fade
   * in. Probe pattern means slow connections never flash an empty box. */
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
    probe.onerror = () => {
      // Image unreachable: still mark loaded so the gradient overlay shows.
      root.classList.add('is-loaded');
    };
    probe.src = WATERMARK_URL;
  }

  /* ---------- Tabs ----------
   * Document-level delegation so the handler survives any future
   * iframe-doc swap. Reads data-wdf-tab on the clicked tab and
   * toggles aria-selected / aria-hidden across the trio.
   */
  function initTabs() {
    if (document.__austinWdfTabsWired) return;
    document.__austinWdfTabsWired = true;
    document.addEventListener('click', (e) => {
      const tab = e.target.closest && e.target.closest('[data-wdf-tab]');
      if (!tab) return;
      const target = tab.getAttribute('data-wdf-tab');
      document.querySelectorAll('[data-wdf-tab]').forEach((t) =>
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
      document.querySelectorAll('[data-wdf-panel]').forEach((p) =>
        p.setAttribute('aria-hidden', p.getAttribute('data-wdf-panel') === target ? 'false' : 'true'));
      if (window.IframeBridge && window.IframeBridge.updateHeight) {
        window.IframeBridge.updateHeight();
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
      console.error('[austin-wdf] IframeBridge missing — bridge script must load first');
      return;
    }
    window.IframeBridge.loadTranslations(TRANSLATIONS);
    window.IframeBridge.init({ pageIdentifier: 'austin-wdf', enableTranslation: true, enableAutoResize: true });
    window.IframeBridge.loadSEOConfig(SEO);

    // Bind data-bind attributes whenever location-data arrives.
    window.IframeBridge.onLocationData((data) => {
      applyBindings(data);
      if (window.IframeBridge.updateHeight) window.IframeBridge.updateHeight();
    });

    setHeroWatermark();
    initTabs();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
