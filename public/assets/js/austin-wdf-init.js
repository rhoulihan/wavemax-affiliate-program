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
      'wdf.cta.text':             'Bereit, Ihr Wochenende zurückzubekommen?',
      'wdf.cta.callBtn':          'Rufen Sie uns an',
      'wdf.cta.directionsBtn':    'Wegbeschreibung'
    }
  };

  /* ---------- SEO ---------- */
  const SEO = {
    title:       'Wash-Dry-Fold Service · WaveMAX Austin',
    description: "Drop-off laundry service in North Austin. $1.20/lb, 10lb minimum, hospital-grade UV-sanitized water, 24-hour turnaround at 825 E Rundberg Ln F1.",
    canonical:   'https://wavemax.promo/dev/austin-host-mock.html?route=/wash-dry-fold'
  };

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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
