/* Austin Self-Serve Laundry page initializer.
 *
 * Wires the iframe to the bridge protocol, sets the hero watermark,
 * applies data-bind / data-i18n translations, and handles the
 * tabbed info section. No form, no API calls — page is read-only
 * informational, content comes from LOCATION_DATA + the translation
 * dictionary below.
 */
(function () {
  'use strict';

  /* ---------- Translations ---------- */
  const TRANSLATIONS = {
    en: {
      'ss.title':                 'Wash on your time, in our space',
      'ss.tagline':               'CLEANER · FASTER · SAFER',
      'ss.subtitle.premium':              "{{contact.city}}'s cleanest self-serve laundromat — 42 Electrolux 450G washers, 42 fast dryers, hospital-grade UV-sanitized water, fully attended every shift. Family-owned, no-coin, no-membership. Wash 20 minutes, dry 20 minutes, out the door in under an hour.",
      'ss.subtitle.default':              "{{contact.city}}'s family-owned self-serve laundromat — Electrolux washers and dryers from 18 lb up to 80 lb, fully attended every shift. No-coin, no-membership. Pick the size that fits your load and skip a trip.",
      'ss.callBtn':               'Call',
      'ss.directionsBtn':         'Get directions',
      'ss.stats.washers':         'Washers',
      'ss.stats.dryers':          'Dryers',
      'ss.stats.capacity':        'Largest Load',
      'ss.stats.faster':          'Faster Drying',
      'ss.stats.uv':              'UV Sanitization',
      'ss.pricing.eyebrow':       'PRICING',
      'ss.pricing.cyclePrefix':   'Per wash cycle',
      'ss.pricing.cycleSuffix':   '-min wash + 20-min dry',
      'ss.pricing.blurb':         'Cards-only payment, no coins needed. Pricing scales with machine size — pick the smallest that fits your load. Largest washer takes an 80-pound load, perfect for comforters and king bedding.',
      'ss.pricing.callBtn':       'Call with questions',
      'ss.includes.eyebrow':      'INCLUDED',
      'ss.includes.title':        'What you get with every wash',
      'ss.includes.uv':           'Hospital-grade UV-sanitized water (Omni LUX)',
      'ss.includes.fast':         'Lightning-fast 450G high-extraction washers',
      'ss.includes.bigload':      'Up to 80-lb capacity for comforters & bedding',
      'ss.includes.wifi':         'Free fast WiFi — bring a laptop or just relax',
      'ss.includes.parking':      'Free on-site parking and wheelchair access',
      'ss.includes.attended':     'Family-owned, fully attended every shift',
      'ss.tabs.how':              'How it works',
      'ss.tabs.why':              'Why WaveMAX',
      'ss.tabs.who':              "Who it's for",
      'ss.tabs.lux':              'Sanitization',
      'ss.tabs.faq':              'FAQ',
      'ss.how.step1.title':       'Pick the right washer',
      'ss.how.step1.text':        "Machines are sized 20 lb up to 80 lb. Pick the smallest one your load fits in — you'll save money and the wash cycle still finishes in 20 minutes. Staff at the front can help you size your load if you're unsure.",
      'ss.how.step1.hoursLabel':  'Open',
      'ss.how.step2.title':       'Load, swipe, walk away',
      'ss.how.step2.text':        'Cards only — no coins to count. Detergent and dryer sheets sold at the front, or bring your own. Free WiFi, comfortable seating, fully attended floor while you wait.',
      'ss.how.step3.title':       "Dry and you're out",
      'ss.how.step3.text':        'Move the load to a dryer next door. The 450G high-extraction wash leaves clothes drier going in, so dryer cycles finish roughly 50% faster than a typical laundromat. Whole trip fits inside an hour.',
      'ss.tiles.fast.title':      'Lightning-fast 450G',
      'ss.tiles.fast.text':       'High-extraction Electrolux washers spin water out faster, cutting dry time roughly 50% compared with a typical laundromat. Wash 20 minutes, dry 20 minutes.',
      'ss.tiles.bigload.title':   '80-lb capacity machines',
      'ss.tiles.bigload.text':    "Comforters, king bedding, sleeping bags, area rugs — fits in one cycle instead of three. Save the trip and the time.",
      'ss.tiles.uv.title':        'UV-sanitized water',
      'ss.tiles.uv.text':         'Every wash uses Omni LUX UV-treated water — the same UV technology hospitals use to kill bacteria and viruses before water touches your clothes.',
      'ss.tiles.attended.title':  'Family-owned, fully attended',
      'ss.tiles.attended.text':   'Staff on-site every shift to help with machines, supplies, and questions. Security cameras throughout. Clean, calm, supervised — not a coin-box-on-the-wall laundromat.',
      'ss.tiles.wifi.title':      'Free WiFi & vending',
      'ss.tiles.wifi.text':       'Quick enough for video calls. Comfortable seating, snack and drink vending, and detergent/dryer-sheet vending if you forgot supplies at home.',
      'ss.tiles.cards.title':     'Cards-only, no coins',
      'ss.tiles.cards.text':      'Credit, debit, or laundry cards. Skip the bill-changer dance. Buy detergent + dryer sheets at the front in the same swipe.',
      'ss.who.apartment.title':   'Apartment & dorm dwellers',
      'ss.who.apartment.text':    'No machine in your unit, or a 50-cent-per-quarter laundry room that takes all evening? 42 fast machines available the moment you walk in.',
      'ss.who.bigload.title':     'Big-load weekends',
      'ss.who.bigload.text':      "Comforters, king bedding, dog beds, sleeping bags — anything your home washer can't handle. One 80-lb machine and one trip.",
      'ss.who.travelers.title':   'Travelers & visitors',
      'ss.who.travelers.text':    "In Austin for a few days and need fresh clothes for the rest of the trip? Walk in, two cycles, you're packed and going again.",
      'ss.who.specialty.title':   'Specialty fabrics',
      'ss.who.specialty.text':    'Athletic wear, technical fabrics, baby clothes, hypoallergenic loads — pick your machine, pick your settings, run it your way.',
      'ss.who.fast.title':        'Time-pressed evenings',
      'ss.who.fast.text':         'Wash 20 minutes, dry 20 minutes. Get in, get out, still beat the dinner-time rush. Open till 10pm, last wash 9pm.',
      'ss.who.occasional.title':  'Occasional users',
      'ss.who.occasional.text':   'Home machine in the shop? Backed up after a vacation? Drop in once and skip the membership-pitch routine. No subscription, no contract.',
      'ss.lux.eyebrow':           'SANITIZATION · OMNI LUX',
      'ss.lux.title':             'Hospital-grade clean before the wash even starts',
      'ss.lux.lede':              "Every WaveMAX Austin washer is fed water that's been sanitized by the Omni LUX UV system at the point of fill — the same UV-C wavelength hospitals use for surgical-room water and air. Nine compounding benefits show up in every load.",
      'ss.lux.stat1':             'odor-causing bacteria eliminated by UV at the inlet',
      'ss.lux.stat2':             'average clothing lifespan extension reported by Omni Solutions',
      'ss.lux.stat3':             'reduction in dry time vs typical laundromats',
      'ss.lux.point1':            'Highest disinfection level available — 99.9% bacteria + virus elimination at the water inlet, before fill.',
      'ss.lux.point2':            'Less detergent needed — UV does the disinfection step, so you save money and reduce chemical exposure for sensitive skin.',
      'ss.lux.point3':            'Clothes last about 20% longer — gentler cleaning process, fewer aggressive cycles needed.',
      'ss.lux.point4':            'Increased fabric softness — UV-treated water is softer on fabrics, clothes feel better off the line.',
      'ss.lux.point5':            'Brighter whites, truer colors — water sanitized at the point of fill produces visibly cleaner results.',
      'ss.lux.point6':            'Eliminates odor at the source — odor-causing bacteria are killed before they can imprint on fabrics.',
      'ss.lux.point7':            'More effective stain removal — the UV-treated wash environment loosens stains that survive a standard cycle.',
      'ss.lux.point8':            'Less water retention going into the dryer — combined with 450G extraction, dry times drop ~50% vs typical laundromats.',
      'ss.lux.point9':            'Safe for every fabric — UV treats the water, not the clothes. Works on cold, warm, and hot cycles alike, no chemistry change required.',
      'ss.faq.q1.q':              'How do I pick the right washer size?',
      'ss.faq.q1.a':              "Pack the drum loosely and leave a hand's width at the top — that's the sweet spot. Staff at the front desk can also help size your load. Smaller machines are cheaper per cycle, so use the smallest one that fits.",
      'ss.faq.q2.q':              'What about coins or cash?',
      'ss.faq.q2.a':              "Cards only — credit, debit, or our laundry cards. No coin slots, no bill changer queue. Add value to a laundry card at the front desk if you'd rather not swipe per machine.",
      'ss.faq.q3.q':              'Do I need to bring detergent?',
      'ss.faq.q3.a':              'You can — feel free to bring your own. We also sell single-use detergent pods, dryer sheets, and bleach at the front desk if you forgot or just want the convenience.',
      'ss.faq.q4.q':              'How long is the whole trip?',
      'ss.faq.q4.a':              'Wash is about 20 minutes; dry is about 20 minutes. Counting transfer + folding, plan for 50–70 minutes total. The 450G high-extraction wash means dry times are ~50% shorter than home machines or typical laundromats.',
      'ss.faq.q5.q':              'Is the facility safe and clean?',
      'ss.faq.q5.a':              'All machines run on UV-sanitized water at the inlet — bacteria and viruses are killed before the water enters the drum. The floor is fully attended every shift, security cameras throughout, and the space is family-owned and run with that level of care.',
      'ss.faq.q6.q':              'When are you open?',
      'ss.faq.q6.a':              "7am–10pm, every day, 365 days a year. Last wash starts at 9pm so every cycle finishes before close. We're fully attended every minute we're open — no after-hours unstaffed slot.",
      'ss.cta.text':              'Drop in any day, any hour 7am–10pm.',
      'ss.cta.callBtn':           'Call us',
      'ss.cta.directionsBtn':     'Get directions'
    },

    es: {
      'ss.title':                 'Lava cuando puedas, en nuestro espacio',
      'ss.tagline':               'MÁS LIMPIO · MÁS RÁPIDO · MÁS SEGURO',
      'ss.subtitle.premium':              'La lavandería autoservicio más limpia de {{contact.city}} — 42 lavadoras Electrolux 450G, 42 secadoras rápidas, agua sanitizada con UV de grado hospitalario, totalmente atendida en cada turno. Negocio familiar, sin monedas, sin membresía. 20 minutos lavado, 20 minutos secado, en menos de una hora.',
      'ss.subtitle.default':              'La lavandería autoservicio familiar de {{contact.city}} — lavadoras y secadoras Electrolux de 18 a 80 libras, totalmente atendida en cada turno. Sin monedas, sin membresía. Elige el tamaño que se ajuste a tu carga y ahorra un viaje.',
      'ss.callBtn':               'Llamar',
      'ss.directionsBtn':         'Cómo llegar',
      'ss.stats.washers':         'Lavadoras',
      'ss.stats.dryers':          'Secadoras',
      'ss.stats.capacity':        'Carga Máxima',
      'ss.stats.faster':          'Secado Más Rápido',
      'ss.stats.uv':              'Sanitización UV',
      'ss.pricing.eyebrow':       'PRECIOS',
      'ss.pricing.cyclePrefix':   'Por ciclo de lavado',
      'ss.pricing.cycleSuffix':   '-min lavado + 20-min secado',
      'ss.pricing.blurb':         'Pago solo con tarjeta, sin monedas. El precio depende del tamaño de la máquina — elija la más pequeña que su carga necesite. La lavadora más grande acepta 80 libras, ideal para edredones y ropa de cama king.',
      'ss.pricing.callBtn':       'Llamar con preguntas',
      'ss.includes.eyebrow':      'INCLUIDO',
      'ss.includes.title':        'Lo que recibe en cada lavado',
      'ss.includes.uv':           'Agua sanitizada con UV de grado hospitalario (Omni LUX)',
      'ss.includes.fast':         'Lavadoras 450G de alta extracción',
      'ss.includes.bigload':      'Capacidad hasta 80 libras para edredones y ropa de cama',
      'ss.includes.wifi':         'WiFi rápido gratis — traiga laptop o relájese',
      'ss.includes.parking':      'Estacionamiento gratis en sitio y acceso para sillas de ruedas',
      'ss.includes.attended':     'Negocio familiar, totalmente atendido en cada turno',
      'ss.tabs.how':              'Cómo funciona',
      'ss.tabs.why':              'Por qué WaveMAX',
      'ss.tabs.who':              'Para quién es',
      'ss.tabs.lux':              'Sanitización',
      'ss.tabs.faq':              'Preguntas',
      'ss.how.step1.title':       'Elija la lavadora correcta',
      'ss.how.step1.text':        'Las máquinas son de 20 lb hasta 80 lb. Elija la más pequeña donde su carga quepa — ahorra dinero y el ciclo igual termina en 20 minutos. El personal del frente puede ayudarle a calcular el tamaño.',
      'ss.how.step1.hoursLabel':  'Abierto',
      'ss.how.step2.title':       'Cargue, pase la tarjeta, váyase',
      'ss.how.step2.text':        'Solo tarjetas — nada de contar monedas. Detergente y hojas para secadora a la venta al frente, o traiga el suyo. WiFi gratis, asientos cómodos, atendido mientras espera.',
      'ss.how.step3.title':       'Seque y váyase',
      'ss.how.step3.text':        'Pase la carga a una secadora al lado. El lavado 450G de alta extracción deja la ropa más seca al entrar a la secadora, así que los ciclos terminan ~50% más rápido que en una lavandería típica. Todo cabe en menos de una hora.',
      'ss.tiles.fast.title':      'Velocidad 450G',
      'ss.tiles.fast.text':       'Lavadoras Electrolux de alta extracción exprimen el agua más rápido, cortando el tiempo de secado ~50% comparado con una lavandería típica. 20 minutos lavado, 20 minutos secado.',
      'ss.tiles.bigload.title':   'Máquinas de 80 libras',
      'ss.tiles.bigload.text':    'Edredones, ropa de cama king, sacos de dormir, alfombras — cabe en un ciclo en lugar de tres. Ahorre el viaje y el tiempo.',
      'ss.tiles.uv.title':        'Agua sanitizada con UV',
      'ss.tiles.uv.text':         'Cada lavado usa agua tratada con UV Omni LUX — la misma tecnología UV que usan los hospitales para eliminar bacterias y virus antes de que el agua toque su ropa.',
      'ss.tiles.attended.title':  'Familiar y totalmente atendido',
      'ss.tiles.attended.text':   'Personal en sitio en cada turno para ayudar con máquinas, suministros y preguntas. Cámaras de seguridad. Limpio, tranquilo, supervisado — no es una lavandería abandonada.',
      'ss.tiles.wifi.title':      'WiFi gratis y vending',
      'ss.tiles.wifi.text':       'Suficientemente rápido para videollamadas. Asientos cómodos, máquinas de snacks y bebidas, y vending de detergente/hojas si olvidó los suministros.',
      'ss.tiles.cards.title':     'Solo tarjetas, sin monedas',
      'ss.tiles.cards.text':      'Crédito, débito o tarjetas de lavandería. Olvídese del cambiador de billetes. Compre detergente y hojas al frente con el mismo pago.',
      'ss.who.apartment.title':   'Apartamentos y dormitorios',
      'ss.who.apartment.text':    'Sin máquina en su unidad, o un cuarto de lavandería de 50 centavos que toma toda la noche? 42 máquinas rápidas disponibles al instante.',
      'ss.who.bigload.title':     'Cargas grandes de fin de semana',
      'ss.who.bigload.text':      'Edredones, ropa de cama king, camas para perros, sacos de dormir — todo lo que su lavadora de casa no puede. Una máquina de 80 lb y un viaje.',
      'ss.who.travelers.title':   'Viajeros y visitantes',
      'ss.who.travelers.text':    'En Austin unos días y necesita ropa fresca para el resto del viaje? Entre, dos ciclos, vuelve a empacar y a salir.',
      'ss.who.specialty.title':   'Telas especiales',
      'ss.who.specialty.text':    'Ropa deportiva, telas técnicas, ropa de bebé, cargas hipoalergénicas — elija su máquina, elija sus configuraciones, hágalo a su manera.',
      'ss.who.fast.title':        'Noches con poco tiempo',
      'ss.who.fast.text':         '20 minutos lavado, 20 minutos secado. Entre, salga, todavía gánele a la hora de la cena. Abierto hasta las 10pm, último lavado a las 9pm.',
      'ss.who.occasional.title':  'Usuarios ocasionales',
      'ss.who.occasional.text':   'Lavadora rota? Atrás después de unas vacaciones? Entre una vez y olvide la rutina de membresía. Sin suscripción, sin contrato.',
      'ss.lux.eyebrow':           'SANITIZACIÓN · OMNI LUX',
      'ss.lux.title':             'Limpieza de grado hospitalario antes de iniciar el lavado',
      'ss.lux.lede':              'Cada lavadora WaveMAX Austin recibe agua sanitizada por el sistema UV Omni LUX en el punto de carga — la misma longitud de onda UV-C que los hospitales usan para agua y aire de quirófanos. Nueve beneficios compuestos aparecen en cada carga.',
      'ss.lux.stat1':             'bacterias causantes de olor eliminadas por UV en la entrada',
      'ss.lux.stat2':             'extensión promedio de la vida útil de la ropa según Omni Solutions',
      'ss.lux.stat3':             'reducción en tiempo de secado vs lavanderías típicas',
      'ss.lux.point1':            'El más alto nivel de desinfección disponible — 99.9% de eliminación de bacterias y virus en la entrada del agua, antes del llenado.',
      'ss.lux.point2':            'Menos detergente necesario — el UV hace el paso de desinfección, así ahorra dinero y reduce la exposición química para piel sensible.',
      'ss.lux.point3':            'La ropa dura ~20% más — proceso de limpieza más suave, menos ciclos agresivos necesarios.',
      'ss.lux.point4':            'Mayor suavidad de tela — el agua tratada con UV es más suave para los tejidos, la ropa se siente mejor.',
      'ss.lux.point5':            'Blancos más brillantes, colores más reales — agua sanitizada en el punto de llenado produce resultados visiblemente más limpios.',
      'ss.lux.point6':            'Elimina el olor en la fuente — las bacterias causantes de olor son eliminadas antes de que se impriman en las telas.',
      'ss.lux.point7':            'Eliminación de manchas más efectiva — el ambiente de lavado tratado con UV afloja manchas que sobreviven un ciclo estándar.',
      'ss.lux.point8':            'Menos retención de agua al pasar a la secadora — combinado con extracción 450G, los tiempos de secado bajan ~50% vs lavanderías típicas.',
      'ss.lux.point9':            'Seguro para cada tela — el UV trata el agua, no la ropa. Funciona en ciclos fríos, tibios y calientes, sin cambio químico requerido.',
      'ss.faq.q1.q':              '¿Cómo elijo el tamaño correcto de lavadora?',
      'ss.faq.q1.a':              'Cargue el tambor sin apretar y deje un espacio del tamaño de una mano arriba — ese es el punto óptimo. El personal del frente también puede ayudarle. Las máquinas más pequeñas son más baratas por ciclo, así que use la más pequeña que cabe.',
      'ss.faq.q2.q':              '¿Qué pasa con monedas o efectivo?',
      'ss.faq.q2.a':              'Solo tarjetas — crédito, débito o nuestras tarjetas de lavandería. Sin ranuras de monedas, sin fila para cambiar billetes. Cargue una tarjeta de lavandería en el frente si prefiere no pasar la tarjeta por máquina.',
      'ss.faq.q3.q':              '¿Necesito traer detergente?',
      'ss.faq.q3.a':              'Puede — siéntase libre de traer el suyo. También vendemos cápsulas de detergente, hojas para secadora y blanqueador en el frente si lo olvidó o quiere la conveniencia.',
      'ss.faq.q4.q':              '¿Cuánto dura todo el viaje?',
      'ss.faq.q4.a':              'El lavado es ~20 minutos; el secado es ~20 minutos. Contando transferencia y doblado, planee 50–70 minutos total. La extracción 450G significa que el secado es ~50% más corto que en máquinas de casa o lavanderías típicas.',
      'ss.faq.q5.q':              '¿La instalación es segura y limpia?',
      'ss.faq.q5.a':              'Todas las máquinas usan agua sanitizada con UV en la entrada — bacterias y virus son eliminados antes de que el agua entre al tambor. El piso es totalmente atendido en cada turno, cámaras de seguridad por todos lados, y el espacio es familiar y manejado con ese nivel de cuidado.',
      'ss.faq.q6.q':              '¿Cuándo están abiertos?',
      'ss.faq.q6.a':              '7am–10pm, todos los días, 365 días al año. El último lavado inicia a las 9pm para que cada ciclo termine antes del cierre. Estamos totalmente atendidos cada minuto que estamos abiertos — sin horario sin personal.',
      'ss.cta.text':              'Visítenos cualquier día, cualquier hora de 7am a 10pm.',
      'ss.cta.callBtn':           'Llámenos',
      'ss.cta.directionsBtn':     'Cómo llegar'
    },

    pt: {
      'ss.title':                 'Lave no seu tempo, no nosso espaço',
      'ss.tagline':               'MAIS LIMPO · MAIS RÁPIDO · MAIS SEGURO',
      'ss.subtitle.premium':              'A lavanderia self-service mais limpa de {{contact.city}} — 42 máquinas Electrolux 450G, 42 secadoras rápidas, água sanitizada com UV de nível hospitalar, totalmente atendida em todos os turnos. Família, sem moedas, sem mensalidade. Lavar 20 min, secar 20 min, sair em menos de uma hora.',
      'ss.subtitle.default':              'A lavanderia self-service familiar de {{contact.city}} — máquinas Electrolux de 18 a 80 libras, totalmente atendida em todos os turnos. Sem moedas, sem mensalidade. Escolha o tamanho que se ajusta à sua carga e poupe uma viagem.',
      'ss.callBtn':               'Ligar',
      'ss.directionsBtn':         'Como chegar',
      'ss.stats.washers':         'Lavadoras',
      'ss.stats.dryers':          'Secadoras',
      'ss.stats.capacity':        'Carga Máxima',
      'ss.stats.faster':          'Secagem Mais Rápida',
      'ss.stats.uv':              'Sanitização UV',
      'ss.pricing.eyebrow':       'PREÇOS',
      'ss.pricing.cyclePrefix':   'Por ciclo de lavagem',
      'ss.pricing.cycleSuffix':   '-min lavagem + 20-min secagem',
      'ss.pricing.blurb':         'Pagamento somente com cartão, sem moedas. Preço depende do tamanho da máquina — escolha a menor que cabe sua carga. A maior lavadora aceita 80 libras, ideal para edredons e cama king.',
      'ss.pricing.callBtn':       'Ligar com perguntas',
      'ss.includes.eyebrow':      'INCLUÍDO',
      'ss.includes.title':        'O que você ganha em cada lavagem',
      'ss.includes.uv':           'Água sanitizada com UV de nível hospitalar (Omni LUX)',
      'ss.includes.fast':         'Lavadoras 450G de alta extração',
      'ss.includes.bigload':      'Capacidade até 80 libras para edredons e roupas de cama',
      'ss.includes.wifi':         'WiFi rápido grátis — traga laptop ou relaxe',
      'ss.includes.parking':      'Estacionamento grátis no local e acesso para cadeirantes',
      'ss.includes.attended':     'Família, totalmente atendido em todos os turnos',
      'ss.tabs.how':              'Como funciona',
      'ss.tabs.why':              'Por que WaveMAX',
      'ss.tabs.who':              'Para quem é',
      'ss.tabs.lux':              'Sanitização',
      'ss.tabs.faq':              'Perguntas',
      'ss.how.step1.title':       'Escolha a lavadora certa',
      'ss.how.step1.text':        'As máquinas vão de 20 lb até 80 lb. Escolha a menor onde sua carga cabe — você economiza e o ciclo termina em 20 minutos. A equipe da frente pode ajudar a dimensionar sua carga.',
      'ss.how.step1.hoursLabel':  'Aberto',
      'ss.how.step2.title':       'Carregue, passe o cartão, vá embora',
      'ss.how.step2.text':        'Só cartões — nada de contar moedas. Detergente e folhas de secadora vendidos na frente, ou traga o seu. WiFi grátis, assentos confortáveis, totalmente atendido enquanto você espera.',
      'ss.how.step3.title':       'Seque e vá embora',
      'ss.how.step3.text':        'Mova a carga para uma secadora ao lado. A lavagem 450G de alta extração deixa as roupas mais secas, então os ciclos terminam ~50% mais rápido que numa lavanderia típica. Tudo cabe em menos de uma hora.',
      'ss.tiles.fast.title':      'Velocidade 450G',
      'ss.tiles.fast.text':       'Lavadoras Electrolux de alta extração esprimem a água mais rápido, cortando o tempo de secagem ~50% comparado com lavanderias típicas. 20 min lavagem, 20 min secagem.',
      'ss.tiles.bigload.title':   'Máquinas de 80 libras',
      'ss.tiles.bigload.text':    'Edredons, cama king, camas de cachorro, sacos de dormir — cabem em um ciclo em vez de três. Economize a viagem e o tempo.',
      'ss.tiles.uv.title':        'Água sanitizada com UV',
      'ss.tiles.uv.text':         'Toda lavagem usa água tratada com UV Omni LUX — a mesma tecnologia UV que hospitais usam para eliminar bactérias e vírus antes da água tocar suas roupas.',
      'ss.tiles.attended.title':  'Familiar, totalmente atendido',
      'ss.tiles.attended.text':   'Equipe no local em todos os turnos para ajudar com máquinas, suprimentos e perguntas. Câmeras de segurança. Limpo, calmo, supervisionado — não é uma lavanderia abandonada.',
      'ss.tiles.wifi.title':      'WiFi grátis e vending',
      'ss.tiles.wifi.text':       'Rápido o suficiente para videochamadas. Assentos confortáveis, máquinas de lanches e bebidas, e vending de detergente/folhas se você esqueceu suprimentos.',
      'ss.tiles.cards.title':     'Só cartões, sem moedas',
      'ss.tiles.cards.text':      'Crédito, débito ou cartões de lavanderia. Pule a fila do trocador. Compre detergente e folhas na frente no mesmo pagamento.',
      'ss.who.apartment.title':   'Apartamentos e dormitórios',
      'ss.who.apartment.text':    'Sem máquina na sua unidade, ou uma lavanderia de 50 centavos por moeda que demora a noite toda? 42 máquinas rápidas disponíveis na hora.',
      'ss.who.bigload.title':     'Cargas grandes de fim de semana',
      'ss.who.bigload.text':      'Edredons, cama king, camas de cachorro, sacos de dormir — tudo que sua máquina de casa não aguenta. Uma máquina de 80 lb e uma viagem.',
      'ss.who.travelers.title':   'Viajantes e visitantes',
      'ss.who.travelers.text':    'Em Austin por alguns dias e precisa de roupa limpa para o resto da viagem? Entre, dois ciclos, está pronto pra seguir.',
      'ss.who.specialty.title':   'Tecidos especiais',
      'ss.who.specialty.text':    'Roupa esportiva, tecidos técnicos, roupa de bebê, cargas hipoalergênicas — escolha sua máquina, escolha suas configurações, do seu jeito.',
      'ss.who.fast.title':        'Noites com pouco tempo',
      'ss.who.fast.text':         '20 min lavagem, 20 min secagem. Entre, saia, ainda chega antes da hora do jantar. Aberto até 22h, última lavagem 21h.',
      'ss.who.occasional.title':  'Usuários ocasionais',
      'ss.who.occasional.text':   'Máquina de casa quebrada? Atrasado depois de férias? Visite uma vez e pule a rotina de membership. Sem assinatura, sem contrato.',
      'ss.lux.eyebrow':           'SANITIZAÇÃO · OMNI LUX',
      'ss.lux.title':             'Limpeza de nível hospitalar antes da lavagem começar',
      'ss.lux.lede':              'Cada lavadora WaveMAX Austin recebe água sanitizada pelo sistema UV Omni LUX no ponto de enchimento — o mesmo comprimento de onda UV-C que hospitais usam para água e ar de salas cirúrgicas. Nove benefícios compostos aparecem em cada carga.',
      'ss.lux.stat1':             'bactérias causadoras de odor eliminadas pelo UV na entrada',
      'ss.lux.stat2':             'extensão média da vida útil da roupa relatada pela Omni Solutions',
      'ss.lux.stat3':             'redução no tempo de secagem vs lavanderias típicas',
      'ss.lux.point1':            'O nível mais alto de desinfecção disponível — 99,9% de eliminação de bactérias e vírus na entrada da água, antes do enchimento.',
      'ss.lux.point2':            'Menos detergente necessário — o UV faz a etapa de desinfecção, então você economiza dinheiro e reduz exposição química para pele sensível.',
      'ss.lux.point3':            'Roupas duram ~20% mais — processo de limpeza mais suave, menos ciclos agressivos necessários.',
      'ss.lux.point4':            'Maior maciez do tecido — água tratada com UV é mais suave nas fibras, roupas saem mais macias.',
      'ss.lux.point5':            'Brancos mais brilhantes, cores mais verdadeiras — água sanitizada no enchimento produz resultados visivelmente mais limpos.',
      'ss.lux.point6':            'Elimina o odor na fonte — bactérias causadoras de odor são eliminadas antes de impregnarem nos tecidos.',
      'ss.lux.point7':            'Remoção de manchas mais eficaz — o ambiente de lavagem tratado com UV solta manchas que sobrevivem a um ciclo padrão.',
      'ss.lux.point8':            'Menos retenção de água ao passar para a secadora — combinado com extração 450G, tempos de secagem caem ~50% vs lavanderias típicas.',
      'ss.lux.point9':            'Seguro para todo tecido — o UV trata a água, não as roupas. Funciona em ciclos frios, mornos e quentes, sem mudança química necessária.',
      'ss.faq.q1.q':              'Como escolho o tamanho certo da lavadora?',
      'ss.faq.q1.a':              'Carregue o tambor sem apertar e deixe um espaço do tamanho de uma mão em cima — esse é o ponto certo. A equipe da frente também pode ajudar. Máquinas menores são mais baratas por ciclo, então use a menor que cabe.',
      'ss.faq.q2.q':              'E moedas ou dinheiro?',
      'ss.faq.q2.a':              'Só cartões — crédito, débito ou nossos cartões de lavanderia. Sem ranhuras de moedas, sem fila pra trocar dinheiro. Adicione valor ao cartão de lavanderia na frente se preferir não passar o cartão por máquina.',
      'ss.faq.q3.q':              'Preciso trazer detergente?',
      'ss.faq.q3.a':              'Pode — fique à vontade. Também vendemos cápsulas de detergente, folhas de secadora e alvejante na frente se você esqueceu ou quer a praticidade.',
      'ss.faq.q4.q':              'Quanto tempo dura toda a visita?',
      'ss.faq.q4.a':              'Lavagem ~20 minutos; secagem ~20 minutos. Contando transferência e dobragem, planeje 50–70 minutos total. A extração 450G significa que a secagem é ~50% mais curta que em máquinas de casa ou lavanderias típicas.',
      'ss.faq.q5.q':              'A instalação é segura e limpa?',
      'ss.faq.q5.a':              'Todas as máquinas usam água sanitizada com UV na entrada — bactérias e vírus são eliminados antes da água entrar no tambor. O piso é totalmente atendido em todos os turnos, câmeras de segurança em todo lugar, e o espaço é familiar e gerenciado com esse nível de cuidado.',
      'ss.faq.q6.q':              'Quando estão abertos?',
      'ss.faq.q6.a':              '7h–22h, todos os dias, 365 dias por ano. A última lavagem começa às 21h para que cada ciclo termine antes do fechamento. Estamos totalmente atendidos cada minuto que estamos abertos — sem horário sem equipe.',
      'ss.cta.text':              'Visite qualquer dia, qualquer hora das 7h às 22h.',
      'ss.cta.callBtn':           'Ligue para nós',
      'ss.cta.directionsBtn':     'Como chegar'
    },

    de: {
      'ss.title':                 'Waschen wann Sie wollen, in unserem Raum',
      'ss.tagline':               'SAUBERER · SCHNELLER · SICHERER',
      'ss.subtitle.premium':              '{{contact.city}}s sauberster Selbstbedienungs-Waschsalon — 42 Electrolux 450G Waschmaschinen, 42 schnelle Trockner, UV-sanitisiertes Wasser in Krankenhausqualität, in jeder Schicht voll betreut. Familienbetrieb, kein Kleingeld, keine Mitgliedschaft. 20 Minuten waschen, 20 Minuten trocknen, in unter einer Stunde fertig.',
      'ss.subtitle.default':              '{{contact.city}}s familiengeführter Selbstbedienungs-Waschsalon — Electrolux Waschmaschinen und Trockner von 18 bis 80 Pfund, in jeder Schicht voll betreut. Kein Kleingeld, keine Mitgliedschaft. Wählen Sie die Größe, die zu Ihrer Wäsche passt, und sparen Sie eine Fahrt.',
      'ss.callBtn':               'Anrufen',
      'ss.directionsBtn':         'Wegbeschreibung',
      'ss.stats.washers':         'Waschmaschinen',
      'ss.stats.dryers':          'Trockner',
      'ss.stats.capacity':        'Größte Ladung',
      'ss.stats.faster':          'Schnelleres Trocknen',
      'ss.stats.uv':              'UV-Sanitisierung',
      'ss.pricing.eyebrow':       'PREISE',
      'ss.pricing.cyclePrefix':   'Pro Waschgang',
      'ss.pricing.cycleSuffix':   '-Min Waschen + 20-Min Trocknen',
      'ss.pricing.blurb':         'Nur Karten, kein Bargeld. Preis hängt von der Maschinengröße ab — wählen Sie die kleinste, in die Ihre Ladung passt. Die größte Maschine fasst 80 Pfund, ideal für Bettdecken und King-Bettwäsche.',
      'ss.pricing.callBtn':       'Anrufen mit Fragen',
      'ss.includes.eyebrow':      'INKLUSIVE',
      'ss.includes.title':        'Was Sie bei jeder Wäsche bekommen',
      'ss.includes.uv':           'UV-sanitisiertes Wasser in Krankenhausqualität (Omni LUX)',
      'ss.includes.fast':         'Schnelle 450G Hochextraktions-Waschmaschinen',
      'ss.includes.bigload':      'Bis zu 80 Pfund Kapazität für Bettdecken und Bettwäsche',
      'ss.includes.wifi':         'Kostenloses schnelles WLAN — Laptop mitbringen oder entspannen',
      'ss.includes.parking':      'Kostenlose Parkplätze und barrierefreier Zugang',
      'ss.includes.attended':     'Familienbetrieb, in jeder Schicht voll betreut',
      'ss.tabs.how':              'So funktioniert es',
      'ss.tabs.why':              'Warum WaveMAX',
      'ss.tabs.who':              'Für wen es ist',
      'ss.tabs.lux':              'Sanitisierung',
      'ss.tabs.faq':              'FAQ',
      'ss.how.step1.title':       'Wählen Sie die richtige Waschmaschine',
      'ss.how.step1.text':        'Maschinen sind von 20 lb bis 80 lb. Wählen Sie die kleinste, in die Ihre Ladung passt — Sie sparen Geld und der Waschgang ist trotzdem in 20 Minuten fertig. Das Personal vorne hilft beim Bemessen.',
      'ss.how.step1.hoursLabel':  'Geöffnet',
      'ss.how.step2.title':       'Beladen, Karte einlesen, gehen',
      'ss.how.step2.text':        'Nur Karten — kein Münzzählen. Waschmittel und Trocknertücher vorne erhältlich, oder eigenes mitbringen. Kostenloses WLAN, bequeme Sitze, voll betreut während Sie warten.',
      'ss.how.step3.title':       'Trocknen und Sie sind fertig',
      'ss.how.step3.text':        'Bringen Sie die Ladung zu einem Trockner nebenan. Die 450G-Hochextraktion lässt die Wäsche trockener in den Trockner gehen, sodass Trocknerzyklen ~50% schneller fertig sind als in einem typischen Waschsalon. Alles passt in unter eine Stunde.',
      'ss.tiles.fast.title':      '450G-Geschwindigkeit',
      'ss.tiles.fast.text':       'Hochextraktions-Electrolux-Waschmaschinen schleudern Wasser schneller heraus und kürzen die Trockenzeit um ~50% gegenüber typischen Waschsalons. 20 Min Waschen, 20 Min Trocknen.',
      'ss.tiles.bigload.title':   '80-Pfund-Maschinen',
      'ss.tiles.bigload.text':    'Bettdecken, King-Bettwäsche, Hundebetten, Schlafsäcke — passt in einen Zyklus statt in drei. Spart die Fahrt und die Zeit.',
      'ss.tiles.uv.title':        'UV-sanitisiertes Wasser',
      'ss.tiles.uv.text':         'Jede Wäsche nutzt mit UV behandeltes Omni-LUX-Wasser — dieselbe UV-Technologie, die Krankenhäuser nutzen, um Bakterien und Viren abzutöten, bevor das Wasser Ihre Kleidung berührt.',
      'ss.tiles.attended.title':  'Familienbetrieb, voll betreut',
      'ss.tiles.attended.text':   'Personal in jeder Schicht vor Ort, hilft mit Maschinen, Verbrauchsgütern und Fragen. Sicherheitskameras überall. Sauber, ruhig, beaufsichtigt — kein verlassener Münzwaschsalon.',
      'ss.tiles.wifi.title':      'Kostenloses WLAN & Vending',
      'ss.tiles.wifi.text':       'Schnell genug für Videoanrufe. Bequeme Sitze, Snack- und Getränkeautomaten und Waschmittel-/Trocknertuch-Automaten falls Sie etwas vergessen haben.',
      'ss.tiles.cards.title':     'Nur Karten, kein Bargeld',
      'ss.tiles.cards.text':      'Kredit-, Debit- oder Wäschekarten. Überspringen Sie die Wechselautomat-Schlange. Kaufen Sie Waschmittel + Trocknertücher vorne mit derselben Zahlung.',
      'ss.who.apartment.title':   'Wohnungs- und Wohnheimbewohner',
      'ss.who.apartment.text':    'Keine Maschine in der Wohnung, oder ein 50-Cent-pro-Münze-Waschraum, der den ganzen Abend dauert? 42 schnelle Maschinen sofort verfügbar.',
      'ss.who.bigload.title':     'Große Wochenend-Ladungen',
      'ss.who.bigload.text':      'Bettdecken, King-Bettwäsche, Hundebetten, Schlafsäcke — alles, was Ihre Heimwaschmaschine nicht schafft. Eine 80-lb-Maschine und eine Fahrt.',
      'ss.who.travelers.title':   'Reisende & Besucher',
      'ss.who.travelers.text':    'Ein paar Tage in Austin und brauchen frische Kleidung für den Rest der Reise? Reinkommen, zwei Zyklen, gepackt und weiter.',
      'ss.who.specialty.title':   'Spezialgewebe',
      'ss.who.specialty.text':    'Sportbekleidung, technische Stoffe, Babykleidung, hypoallergene Ladungen — wählen Sie Ihre Maschine, Ihre Einstellungen, machen Sie es nach Ihrer Art.',
      'ss.who.fast.title':        'Knappe Abendzeit',
      'ss.who.fast.text':         '20 Min Waschen, 20 Min Trocknen. Rein, raus, noch vor dem Abendessen-Stoßverkehr. Geöffnet bis 22 Uhr, letzte Wäsche 21 Uhr.',
      'ss.who.occasional.title':  'Gelegentliche Nutzer',
      'ss.who.occasional.text':   'Heimmaschine in Reparatur? Nach dem Urlaub im Rückstand? Einmal vorbeikommen und das Mitgliedschaft-Geschwätz überspringen. Kein Abo, kein Vertrag.',
      'ss.lux.eyebrow':           'SANITISIERUNG · OMNI LUX',
      'ss.lux.title':             'Krankenhausreinheit, bevor die Wäsche überhaupt beginnt',
      'ss.lux.lede':              'Jede WaveMAX-Austin-Waschmaschine wird mit Wasser versorgt, das vom Omni-LUX-UV-System am Einfüllpunkt sanitisiert wurde — dieselbe UV-C-Wellenlänge, die Krankenhäuser für Wasser und Luft im OP verwenden. Neun zusammenwirkende Vorteile in jeder Ladung.',
      'ss.lux.stat1':             'geruchsbildende Bakterien werden vom UV am Einlass eliminiert',
      'ss.lux.stat2':             'durchschnittliche Verlängerung der Kleidungslebensdauer laut Omni Solutions',
      'ss.lux.stat3':             'Reduktion der Trockenzeit gegenüber typischen Waschsalons',
      'ss.lux.point1':            'Höchste verfügbare Desinfektionsstufe — 99,9% Bakterien- und Viren-Eliminierung am Wassereinlass, vor dem Befüllen.',
      'ss.lux.point2':            'Weniger Waschmittel nötig — UV übernimmt die Desinfektion, also sparen Sie Geld und reduzieren chemische Belastung für empfindliche Haut.',
      'ss.lux.point3':            'Kleidung hält ~20% länger — sanfterer Reinigungsprozess, weniger aggressive Zyklen nötig.',
      'ss.lux.point4':            'Erhöhte Stoffweichheit — UV-behandeltes Wasser ist sanfter zu Stoffen, Kleidung fühlt sich besser an.',
      'ss.lux.point5':            'Hellere Weißtöne, naturgetreuere Farben — am Einlass sanitisiertes Wasser produziert sichtbar saubere Ergebnisse.',
      'ss.lux.point6':            'Eliminiert Geruch an der Quelle — geruchsbildende Bakterien werden abgetötet, bevor sie sich auf Stoffen festsetzen.',
      'ss.lux.point7':            'Effektivere Fleckenentfernung — die UV-behandelte Waschumgebung löst Flecken, die einen Standardzyklus überleben.',
      'ss.lux.point8':            'Weniger Wasserretention beim Übergang zum Trockner — kombiniert mit 450G-Extraktion, Trockenzeiten fallen ~50% gegenüber typischen Waschsalons.',
      'ss.lux.point9':            'Sicher für jeden Stoff — UV behandelt das Wasser, nicht die Kleidung. Funktioniert auf kalten, warmen und heißen Zyklen ohne chemische Änderung.',
      'ss.faq.q1.q':              'Wie wähle ich die richtige Maschinengröße?',
      'ss.faq.q1.a':              'Beladen Sie die Trommel locker und lassen Sie eine Handbreit oben frei — das ist optimal. Das Personal vorne hilft beim Bemessen. Kleinere Maschinen sind pro Zyklus günstiger, also nutzen Sie die kleinste, in die alles passt.',
      'ss.faq.q2.q':              'Was ist mit Münzen oder Bargeld?',
      'ss.faq.q2.a':              'Nur Karten — Kredit-, Debit- oder unsere Wäschekarten. Keine Münzschlitze, keine Wechselautomat-Schlange. Wäschekarte vorne aufladen, falls Sie nicht pro Maschine bezahlen wollen.',
      'ss.faq.q3.q':              'Muss ich Waschmittel mitbringen?',
      'ss.faq.q3.a':              'Können Sie — gerne mitbringen. Wir verkaufen auch Einweg-Waschmittelkapseln, Trocknertücher und Bleichmittel vorne, falls Sie etwas vergessen haben.',
      'ss.faq.q4.q':              'Wie lange dauert die ganze Sache?',
      'ss.faq.q4.a':              'Waschen ~20 Minuten; Trocknen ~20 Minuten. Mit Umladen und Falten planen Sie 50–70 Minuten gesamt. Die 450G-Hochextraktion bedeutet, dass Trocknerzeiten ~50% kürzer sind als zu Hause oder in typischen Waschsalons.',
      'ss.faq.q5.q':              'Ist die Einrichtung sauber und sicher?',
      'ss.faq.q5.a':              'Alle Maschinen nutzen UV-sanitisiertes Wasser am Einlass — Bakterien und Viren werden eliminiert, bevor das Wasser die Trommel erreicht. Der Boden ist in jeder Schicht voll betreut, Sicherheitskameras überall, und der Raum ist familiengeführt mit dieser Sorgfaltsstufe.',
      'ss.faq.q6.q':              'Wann haben Sie geöffnet?',
      'ss.faq.q6.a':              '7–22 Uhr, jeden Tag, 365 Tage im Jahr. Die letzte Wäsche startet um 21 Uhr, damit jeder Zyklus vor Schluss fertig ist. Wir sind jede Minute, in der wir geöffnet sind, voll betreut — kein unbetreutes Zeitfenster.',
      'ss.cta.text':              'Kommen Sie täglich, von 7 bis 22 Uhr.',
      'ss.cta.callBtn':           'Rufen Sie uns an',
      'ss.cta.directionsBtn':     'Wegbeschreibung'
    }
  };

  /* ---------- SEO ---------- */
  const PAGE_URL    = 'https://rundberglaundry.com/dev/austin-host-mock.html?route=/self-serve-laundry';
  const HOST_URL    = 'https://rundberglaundry.com/austin-tx/';
  const HERO_IMG    = window.wmLocationImage('austin-tx/hero-3.jpg');
  const BUSINESS_ID = 'https://www.wavemaxlaundry.com/austin-tx/#localbusiness';

  const SEO = {
    meta: {
      title:        "Self-Serve Laundromat · WaveMAX Austin · 42 Electrolux 450G Washers",
      description:  "Austin's cleanest self-serve laundromat. 42 Electrolux 450G washers, 42 fast dryers, 80-lb capacity, hospital-grade UV-sanitized water, free WiFi, fully attended. 825 E Rundberg Ln F1, North Austin.",
      canonicalUrl: PAGE_URL,
      author:       'WaveMAX Laundry Austin',
      keywords:     'self serve laundry austin, self service laundromat austin tx, 24 hour laundromat austin, 80 lb washer austin, electrolux laundromat, uv sanitized laundry austin, family-owned laundromat austin, north austin laundromat'
    },
    openGraph: {
      title:       "WaveMAX Austin Self-Serve Laundromat · 42 fast 450G washers",
      description: 'Cards-only · UV-sanitized · 80-lb capacity · 50% faster drying · open every day 7am-10pm.',
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
      title:       'Self-Serve Laundromat · WaveMAX Austin',
      description: '42 Electrolux 450G washers, UV-sanitized water, fully attended. 825 E Rundberg Ln F1.',
      image:       HERO_IMG,
      imageAlt:    'WaveMAX Laundry Austin self-serve floor'
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
        email:       'no-reply@rundberglaundry.com',
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
      service: {
        '@context':  'https://schema.org',
        '@type':     'Service',
        '@id':       PAGE_URL + '#service',
        name:        'Self-Serve Laundry',
        alternateName: 'Self-Service Laundromat',
        serviceType: 'Self-service laundromat',
        category:    'Laundry service',
        url:         PAGE_URL,
        description: 'Self-serve laundry with 42 Electrolux 450G washers and 42 fast dryers. UV-sanitized water, 80-lb capacity, fully attended, family-owned.',
        provider:    { '@id': BUSINESS_ID },
        offers: {
          '@type':         'AggregateOffer',
          priceCurrency:   'USD',
          lowPrice:        '2.75',
          highPrice:       '10.50',
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
      faqPage: {
        '@context':  'https://schema.org',
        '@type':     'FAQPage',
        '@id':       PAGE_URL + '#faq',
        mainEntity: [
          { '@type': 'Question', name: 'How do I pick the right washer size?',         acceptedAnswer: { '@type': 'Answer', text: "Pack the drum loosely and leave a hand's width at the top — that's the sweet spot. Staff at the front desk can also help size your load. Smaller machines are cheaper per cycle, so use the smallest one that fits." } },
          { '@type': 'Question', name: 'What about coins or cash?',                     acceptedAnswer: { '@type': 'Answer', text: "Cards only — credit, debit, or our laundry cards. No coin slots, no bill changer queue. Add value to a laundry card at the front desk if you'd rather not swipe per machine." } },
          { '@type': 'Question', name: 'Do I need to bring detergent?',                 acceptedAnswer: { '@type': 'Answer', text: 'You can — feel free to bring your own. We also sell single-use detergent pods, dryer sheets, and bleach at the front desk if you forgot or just want the convenience.' } },
          { '@type': 'Question', name: 'How long is the whole trip?',                   acceptedAnswer: { '@type': 'Answer', text: 'Wash is about 20 minutes; dry is about 20 minutes. Counting transfer + folding, plan for 50–70 minutes total. The 450G high-extraction wash means dry times are ~50% shorter than home machines or typical laundromats.' } },
          { '@type': 'Question', name: 'Is the facility safe and clean?',               acceptedAnswer: { '@type': 'Answer', text: 'All machines run on UV-sanitized water at the inlet — bacteria and viruses are killed before the water enters the drum. The floor is fully attended every shift, security cameras throughout, and the space is family-owned and run with that level of care.' } },
          { '@type': 'Question', name: 'When are you open?',                            acceptedAnswer: { '@type': 'Answer', text: "7am–10pm, every day, 365 days a year. Last wash starts at 9pm so every cycle finishes before close. We're fully attended every minute we're open — no after-hours unstaffed slot." } }
        ]
      },
      breadcrumb: {
        '@context': 'https://schema.org',
        '@type':    'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'WaveMAX Laundry',  item: 'https://www.wavemaxlaundry.com/' },
          { '@type': 'ListItem', position: 2, name: 'Austin, TX',       item: HOST_URL },
          { '@type': 'ListItem', position: 3, name: 'Self-Serve Laundry'                                       }
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

  /* ---------- Tabs (delegated, survives DOM swaps) ---------- */
  function initTabs() {
    if (document.__austinSsTabsWired) return;
    document.__austinSsTabsWired = true;
    document.addEventListener('click', (e) => {
      const tab = e.target.closest && e.target.closest('[data-ss-tab]');
      if (!tab) return;
      const target = tab.getAttribute('data-ss-tab');
      document.querySelectorAll('[data-ss-tab]').forEach((t) =>
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
      document.querySelectorAll('[data-ss-panel]').forEach((p) =>
        p.setAttribute('aria-hidden', p.getAttribute('data-ss-panel') === target ? 'false' : 'true'));
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
      console.error('[austin-self-serve] IframeBridge missing — bridge script must load first');
      return;
    }
    window.IframeBridge.loadTranslations(TRANSLATIONS);
    window.IframeBridge.init({ pageIdentifier: 'austin-self-serve', enableTranslation: true, enableAutoResize: true });
    // SEO is built from LOCATION_DATA inside onLocationData below.

    let _locationData = null;
    window.IframeBridge.onLocationData((data) => {
      _locationData = data;
      applyBindings(data);
      setHeroWatermark(data);
      if (window.FranchisePage) {
        window.FranchisePage.applyEquipment(data);
        window.FranchisePage.applyTextPlaceholders(data);
        window.FranchisePage.applyDocumentTitle(data, 'self-serve');
        const seo = window.FranchisePage.buildSeo(data, 'self-serve');
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
