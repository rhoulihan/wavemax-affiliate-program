/* Austin contact page initializer.
 *
 * Wires the iframe to the bridge protocol, applies data-bind / data-i18n
 * translations, and handles the contact form submit (CSRF-bearing POST
 * to /api/v1/contact/austin-tx, success / error UI surface).
 */
(function () {
  'use strict';

  /* ---------- Translations ---------- */
  const TRANSLATIONS = {
    en: {
      'contact.title':              'Get in touch with WaveMAX Austin',
      'contact.intro':              "Call us, swing by during open hours, or drop a note below — we reply within a few hours during business hours.",
      'contact.card.heading':       'Visit, call, or get directions',
      'contact.card.addressLabel':  'Address',
      'contact.card.hoursLabel':    'Hours',
      'contact.card.phoneLabel':    'Phone',
      'contact.card.emailLabel':    'Email',
      'contact.card.callBtn':       'Call',
      'contact.card.directionsBtn': 'Get directions',
      'contact.form.heading':       'Send us a message',
      'contact.form.intro':         "We'll reply within a few hours during business hours.",
      'contact.form.firstName':     'First name',
      'contact.form.lastName':      'Last name',
      'contact.form.email':         'Email',
      'contact.form.phone':         'Phone',
      'contact.form.optional':      '(optional)',
      'contact.form.message':       'How can we help?',
      'contact.form.submit':        'Send message',
      'contact.form.sending':       'Sending…',
      'contact.form.successDefault':"Your message has been sent — we'll be in touch shortly.",
      'contact.form.errorDefault':  'There was a problem sending your message. Please try again, or call us directly.',
      'contact.modal.successTitle': 'Message sent',
      'contact.modal.errorTitle':   "Couldn't send message",
      'contact.modal.loadingTitle': 'Sending message…',
      'contact.modal.loadingBody':  "We're delivering your message — this usually takes a few seconds.",
      'contact.modal.ok':           'OK',
      'contact.tiles.hours.title':       'Open every day',
      'contact.tiles.hours.text':        'Self-service floor open 7am–10pm, 365 days a year. Last wash starts 9pm so every cycle finishes before close.',
      'contact.tiles.machines.title':    'Electrolux Commercial Washers',
      'contact.tiles.machines.text':     '42 CompassPro 450G washers and 42 high-velocity dryers. Largest washer takes an 80-pound load — perfect for comforters and blankets.',
      'contact.tiles.uv.title':          'Hospital-grade UV water',
      'contact.tiles.uv.text':           'Every washer runs on Omni LUX UV-sanitized water. The same UV technology hospitals use to kill bacteria and viruses before water touches your clothes.',
      'contact.tiles.wdf.title':         'Drop-off wash-dry-fold',
      'contact.tiles.wdf.text':          '$1.20/lb, 10-pound minimum. 24-hour turnaround (same-day for orders before 11am). Eco-friendly hypoallergenic detergent included.',
      'contact.tiles.amenities.title':   'Free WiFi & parking',
      'contact.tiles.amenities.text':    'Free fast WiFi throughout the store, free on-site parking, comfortable seating, fully attended floor. Get work done while your wash runs.',
      'contact.tiles.payment.title':     'Cards-only, no cash',
      'contact.tiles.payment.text':      "All major credit, debit, and laundry cards. No cash needed for any service. Calibrated weigh on every WDF order so you always know what you're paying."
    },
    es: {
      'contact.title':              'Contacto · WaveMAX Austin',
      'contact.intro':              'Llámanos, visítanos durante el horario de atención, o envíanos un mensaje abajo — respondemos en pocas horas durante el horario laboral.',
      'contact.card.heading':       'Visítenos, llámenos o pida indicaciones',
      'contact.card.addressLabel':  'Dirección',
      'contact.card.hoursLabel':    'Horario',
      'contact.card.phoneLabel':    'Teléfono',
      'contact.card.emailLabel':    'Correo',
      'contact.card.callBtn':       'Llamar',
      'contact.card.directionsBtn': 'Cómo llegar',
      'contact.form.heading':       'Envíenos un mensaje',
      'contact.form.intro':         'Respondemos en pocas horas durante el horario laboral.',
      'contact.form.firstName':     'Nombre',
      'contact.form.lastName':      'Apellido',
      'contact.form.email':         'Correo electrónico',
      'contact.form.phone':         'Teléfono',
      'contact.form.optional':      '(opcional)',
      'contact.form.message':       '¿En qué podemos ayudarle?',
      'contact.form.submit':        'Enviar mensaje',
      'contact.form.sending':       'Enviando…',
      'contact.form.successDefault':'Su mensaje ha sido enviado — nos pondremos en contacto pronto.',
      'contact.form.errorDefault':  'Hubo un problema al enviar su mensaje. Inténtelo de nuevo o llámenos directamente.',
      'contact.modal.successTitle': 'Mensaje enviado',
      'contact.modal.errorTitle':   'No se pudo enviar',
      'contact.modal.loadingTitle': 'Enviando mensaje…',
      'contact.modal.loadingBody':  'Estamos entregando su mensaje — esto suele tardar unos segundos.',
      'contact.modal.ok':           'Aceptar',
      'contact.tiles.hours.title':       'Abierto todos los días',
      'contact.tiles.hours.text':        'Servicio de autoservicio abierto de 7am a 10pm, 365 días al año. El último lavado inicia a las 9pm para que todo termine antes del cierre.',
      'contact.tiles.machines.title':    'Lavadoras Comerciales Electrolux',
      'contact.tiles.machines.text':     '42 lavadoras CompassPro 450G y 42 secadoras de alta velocidad. La lavadora más grande acepta carga de 80 libras — ideal para edredones y cobijas.',
      'contact.tiles.uv.title':          'Agua UV grado hospitalario',
      'contact.tiles.uv.text':           'Cada lavadora usa agua sanitizada con UV Omni LUX. La misma tecnología UV que usan los hospitales para eliminar bacterias y virus antes de que el agua toque su ropa.',
      'contact.tiles.wdf.title':         'Lavado-secado-doblado',
      'contact.tiles.wdf.text':          '$1.20/lb, mínimo 10 libras. Entrega en 24 horas (mismo día si llega antes de las 11am). Detergente hipoalergénico ecológico incluido.',
      'contact.tiles.amenities.title':   'WiFi y estacionamiento gratis',
      'contact.tiles.amenities.text':    'WiFi rápido gratuito en toda la tienda, estacionamiento gratis en sitio, asientos cómodos, piso totalmente atendido. Trabaje mientras su ropa se lava.',
      'contact.tiles.payment.title':     'Solo tarjeta, sin efectivo',
      'contact.tiles.payment.text':      'Todas las tarjetas mayores de crédito, débito y de lavandería. Sin efectivo necesario. Pesaje calibrado en cada pedido de lavado-secado-doblado para que siempre sepa lo que paga.'
    },
    pt: {
      'contact.title':              'Fale com a WaveMAX Austin',
      'contact.intro':              'Ligue, visite durante o horário de atendimento ou envie uma mensagem abaixo — respondemos em poucas horas durante o expediente.',
      'contact.card.heading':       'Visite, ligue ou peça direções',
      'contact.card.addressLabel':  'Endereço',
      'contact.card.hoursLabel':    'Horário',
      'contact.card.phoneLabel':    'Telefone',
      'contact.card.emailLabel':    'E-mail',
      'contact.card.callBtn':       'Ligar',
      'contact.card.directionsBtn': 'Como chegar',
      'contact.form.heading':       'Envie-nos uma mensagem',
      'contact.form.intro':         'Respondemos em poucas horas durante o expediente.',
      'contact.form.firstName':     'Nome',
      'contact.form.lastName':      'Sobrenome',
      'contact.form.email':         'E-mail',
      'contact.form.phone':         'Telefone',
      'contact.form.optional':      '(opcional)',
      'contact.form.message':       'Como podemos ajudar?',
      'contact.form.submit':        'Enviar mensagem',
      'contact.form.sending':       'Enviando…',
      'contact.form.successDefault':'Sua mensagem foi enviada — entraremos em contato em breve.',
      'contact.form.errorDefault':  'Houve um problema ao enviar sua mensagem. Tente novamente ou ligue diretamente.',
      'contact.modal.successTitle': 'Mensagem enviada',
      'contact.modal.errorTitle':   'Não foi possível enviar',
      'contact.modal.loadingTitle': 'Enviando mensagem…',
      'contact.modal.loadingBody':  'Estamos entregando sua mensagem — geralmente leva alguns segundos.',
      'contact.modal.ok':           'OK',
      'contact.tiles.hours.title':       'Aberto todos os dias',
      'contact.tiles.hours.text':        'Autoatendimento aberto das 7h às 22h, 365 dias por ano. Última lavagem começa às 21h para que todos os ciclos terminem antes de fechar.',
      'contact.tiles.machines.title':    'Lavadoras Comerciais Electrolux',
      'contact.tiles.machines.text':     '42 lavadoras CompassPro 450G e 42 secadoras de alta velocidade. A maior lavadora suporta carga de 80 libras — ideal para edredons e cobertores.',
      'contact.tiles.uv.title':          'Água UV nível hospitalar',
      'contact.tiles.uv.text':           'Cada lavadora usa água sanitizada com UV Omni LUX. A mesma tecnologia UV que hospitais usam para eliminar bactérias e vírus antes que a água toque sua roupa.',
      'contact.tiles.wdf.title':         'Entrega lavar-secar-dobrar',
      'contact.tiles.wdf.text':          '$1.20/lb, mínimo 10 libras. Entrega em 24 horas (mesmo dia para pedidos antes das 11h). Detergente hipoalergênico ecológico incluído.',
      'contact.tiles.amenities.title':   'WiFi e estacionamento grátis',
      'contact.tiles.amenities.text':    'WiFi rápido gratuito em toda a loja, estacionamento grátis no local, assentos confortáveis, piso totalmente atendido. Trabalhe enquanto sua roupa lava.',
      'contact.tiles.payment.title':     'Só cartão, sem dinheiro',
      'contact.tiles.payment.text':      'Todos os cartões maiores de crédito, débito e cartões de lavanderia. Não precisa de dinheiro. Pesagem calibrada em cada pedido para que você sempre saiba o quanto está pagando.'
    },
    de: {
      'contact.title':              'Kontakt zu WaveMAX Austin',
      'contact.intro':              'Rufen Sie uns an, kommen Sie zu unseren Öffnungszeiten vorbei oder senden Sie uns eine Nachricht — wir antworten innerhalb weniger Stunden während der Geschäftszeiten.',
      'contact.card.heading':       'Besuchen Sie uns, rufen Sie an oder holen Sie sich eine Wegbeschreibung',
      'contact.card.addressLabel':  'Adresse',
      'contact.card.hoursLabel':    'Öffnungszeiten',
      'contact.card.phoneLabel':    'Telefon',
      'contact.card.emailLabel':    'E-Mail',
      'contact.card.callBtn':       'Anrufen',
      'contact.card.directionsBtn': 'Wegbeschreibung',
      'contact.form.heading':       'Senden Sie uns eine Nachricht',
      'contact.form.intro':         'Wir antworten innerhalb weniger Stunden während der Geschäftszeiten.',
      'contact.form.firstName':     'Vorname',
      'contact.form.lastName':      'Nachname',
      'contact.form.email':         'E-Mail',
      'contact.form.phone':         'Telefon',
      'contact.form.optional':      '(optional)',
      'contact.form.message':       'Wie können wir helfen?',
      'contact.form.submit':        'Nachricht senden',
      'contact.form.sending':       'Senden…',
      'contact.form.successDefault':'Ihre Nachricht wurde gesendet — wir melden uns in Kürze.',
      'contact.form.errorDefault':  'Beim Senden Ihrer Nachricht ist ein Problem aufgetreten. Bitte versuchen Sie es erneut oder rufen Sie uns direkt an.',
      'contact.modal.successTitle': 'Nachricht gesendet',
      'contact.modal.errorTitle':   'Senden fehlgeschlagen',
      'contact.modal.loadingTitle': 'Nachricht wird gesendet…',
      'contact.modal.loadingBody':  'Wir stellen Ihre Nachricht zu — dauert in der Regel ein paar Sekunden.',
      'contact.modal.ok':           'OK',
      'contact.tiles.hours.title':       'Täglich geöffnet',
      'contact.tiles.hours.text':        'Selbstbedienung 7–22 Uhr, 365 Tage im Jahr. Letzter Waschgang um 21 Uhr, damit alle Programme vor Schluss enden.',
      'contact.tiles.machines.title':    'Electrolux Profi-Waschmaschinen',
      'contact.tiles.machines.text':     '42 CompassPro 450G Waschmaschinen und 42 Schnelltrockner. Größte Waschmaschine fasst 80 Pfund — ideal für Decken und Bettdecken.',
      'contact.tiles.uv.title':          'UV-Wasser in Krankenhausqualität',
      'contact.tiles.uv.text':           'Jede Waschmaschine nutzt mit UV sanitisiertes Omni-LUX-Wasser. Dieselbe UV-Technologie, die Krankenhäuser verwenden, um Bakterien und Viren abzutöten, bevor das Wasser Ihre Kleidung berührt.',
      'contact.tiles.wdf.title':         'Bring-Service Waschen-Trocknen-Falten',
      'contact.tiles.wdf.text':          '$1.20/lb, Mindestmenge 10 Pfund. 24-Stunden-Lieferung (am selben Tag bei Aufträgen vor 11 Uhr). Umweltfreundliches hypoallergenes Waschmittel inklusive.',
      'contact.tiles.amenities.title':   'Kostenloses WLAN & Parken',
      'contact.tiles.amenities.text':    'Kostenloses schnelles WLAN im ganzen Geschäft, kostenlose Parkplätze vor Ort, komfortable Sitzgelegenheiten, vollständig betreutes Personal. Erledigen Sie Arbeit, während Ihre Wäsche läuft.',
      'contact.tiles.payment.title':     'Nur Karte, kein Bargeld',
      'contact.tiles.payment.text':      'Alle gängigen Kredit-, Debit- und Wäschekarten. Kein Bargeld nötig. Kalibrierte Wägung bei jedem Wasch-Trocken-Falt-Auftrag — Sie wissen immer, was Sie zahlen.'
    }
  };

  /* ---------- SEO ---------- */
  const SEO = {
    title:       'Contact WaveMAX Austin · Laundromat in North Austin',
    description: 'Contact WaveMAX Laundry Austin — call (512) 553-1674, drop in at 825 E Rundberg Ln F1, or send us a message. Open daily 7am–10pm.',
    canonical:   'https://wavemax.promo/dev/austin-host-mock.html?route=/contact'
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

  /* ---------- Form ---------- */
  const SLUG = 'austin-tx';

  async function fetchCsrfToken() {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.csrfToken || null;
    } catch (_) {
      return null;
    }
  }

  function showStatus(form, kind, text) {
    // Inline status surfaces — kept hidden but in DOM for accessibility / no-JS.
    const success = form.querySelector('[data-contact-status="success"]');
    const error   = form.querySelector('[data-contact-status="error"]');
    if (success) {
      success.hidden = (kind !== 'success');
      if (kind === 'success' && text) success.textContent = text;
    }
    if (error) {
      error.hidden = (kind !== 'error');
      if (kind === 'error' && text) error.textContent = text;
    }
  }

  function sendModalToParent(kind, body) {
    if (!window.IframeBridge || !window.IframeBridge.sendToParent) return;
    const dict = getLangDict();
    const titleKey = kind === 'success' ? 'contact.modal.successTitle'
                   : kind === 'error'   ? 'contact.modal.errorTitle'
                   : 'contact.modal.loadingTitle';
    const fallbackTitle = kind === 'success' ? 'Message sent'
                        : kind === 'error'   ? "Couldn't send message"
                        : 'Sending message…';
    window.IframeBridge.sendToParent({
      type: 'show-modal',
      data: {
        kind:  kind,
        title: dict[titleKey] || fallbackTitle,
        body:  body || '',
        ok:    dict['contact.modal.ok'] || 'OK'
      }
    });
  }

  function hideModalOnParent() {
    if (window.IframeBridge && window.IframeBridge.sendToParent) {
      window.IframeBridge.sendToParent({ type: 'hide-modal' });
    }
  }

  function getLangDict() {
    const lang = (window.IframeBridge && window.IframeBridge.getCurrentLanguage
      && window.IframeBridge.getCurrentLanguage()) || 'en';
    return TRANSLATIONS[lang] || TRANSLATIONS.en;
  }

  function setSubmittingState(form, on) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = on;
    if (on) {
      btn.dataset.origText = btn.textContent;
      btn.textContent = getLangDict()['contact.form.sending'] || 'Sending…';
    } else if (btn.dataset.origText) {
      btn.textContent = btn.dataset.origText;
      delete btn.dataset.origText;
    }
  }

  function summariseErrors(payload) {
    if (payload && Array.isArray(payload.errors) && payload.errors.length) {
      return payload.errors.map((e) => e.msg || e.message || '').filter(Boolean).join(' · ');
    }
    return (payload && payload.message) || '';
  }

  function initContactForm() {
    // Delegate to document — translatePage() / data-bind passes can replace
    // child nodes, which would orphan a listener attached to the form. A
    // delegated listener on document survives any in-tree DOM swap as long
    // as the form keeps the data-contact-form attribute.
    if (document.__austinContactSubmitDelegated) return;
    document.__austinContactSubmitDelegated = true;

    document.addEventListener('submit', async (e) => {
      const form = e.target && e.target.closest && e.target.closest('[data-contact-form]');
      if (!form) return;
      e.preventDefault();
      showStatus(form, 'none', '');
      setSubmittingState(form, true);
      // Open the parent-side modal in loading state — covers the host viewport
      // and shows the swirl spinner while we round-trip to the API.
      sendModalToParent('loading', getLangDict()['contact.modal.loadingBody'] || "We're delivering your message — this usually takes a few seconds.");

      const data = {
        firstName: form.firstName.value.trim(),
        lastName:  form.lastName.value.trim(),
        email:     form.email.value.trim(),
        phone:     form.phone.value.trim(),
        message:   form.message.value.trim()
      };

      try {
        const csrf = await fetchCsrfToken();
        const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (csrf) headers['x-csrf-token'] = csrf;

        const res = await fetch(`/api/v1/contact/${SLUG}`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(data)
        });

        let payload = null;
        try { payload = await res.json(); } catch (_) { /* tolerate empty body */ }

        if (res.ok && payload && payload.success !== false) {
          const dict = getLangDict();
          const successText = (payload && payload.message) || dict['contact.form.successDefault'];
          showStatus(form, 'success', successText);
          sendModalToParent('success', successText);
          form.reset();
        } else {
          const dict = getLangDict();
          const errText = summariseErrors(payload) || dict['contact.form.errorDefault'];
          showStatus(form, 'error', errText);
          sendModalToParent('error', errText);
        }
      } catch (_) {
        const dict = getLangDict();
        const errText = dict['contact.form.errorDefault'];
        showStatus(form, 'error', errText);
        sendModalToParent('error', errText);
      } finally {
        setSubmittingState(form, false);
      }
    });
  }

  /* ---------- Init ---------- */
  function init() {
    if (!window.IframeBridge) {
      console.error('[austin-contact] IframeBridge missing — bridge script must load first');
      return;
    }
    window.IframeBridge.loadTranslations(TRANSLATIONS);
    window.IframeBridge.init({ pageIdentifier: 'austin-contact', enableTranslation: true, enableAutoResize: true });
    window.IframeBridge.loadSEOConfig(SEO);

    // Bind data-bind attributes whenever location-data arrives
    window.IframeBridge.onLocationData((data) => {
      applyBindings(data);
      if (window.IframeBridge.updateHeight) window.IframeBridge.updateHeight();
    });

    initContactForm();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
