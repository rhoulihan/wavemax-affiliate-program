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
      'contact.eyebrow':            'CONTACT',
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
      'contact.form.errorDefault':  'There was a problem sending your message. Please try again, or call us directly.'
    },
    es: {
      'contact.eyebrow':            'CONTACTO',
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
      'contact.form.errorDefault':  'Hubo un problema al enviar su mensaje. Inténtelo de nuevo o llámenos directamente.'
    },
    pt: {
      'contact.eyebrow':            'CONTATO',
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
      'contact.form.errorDefault':  'Houve um problema ao enviar sua mensagem. Tente novamente ou ligue diretamente.'
    },
    de: {
      'contact.eyebrow':            'KONTAKT',
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
      'contact.form.errorDefault':  'Beim Senden Ihrer Nachricht ist ein Problem aufgetreten. Bitte versuchen Sie es erneut oder rufen Sie uns direkt an.'
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
    const form = document.querySelector('[data-contact-form]');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Hide both surfaces while we send
      showStatus(form, 'none', '');
      setSubmittingState(form, true);

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
          form.reset();
        } else {
          const dict = getLangDict();
          const errText = summariseErrors(payload) || dict['contact.form.errorDefault'];
          showStatus(form, 'error', errText);
        }
      } catch (_) {
        const dict = getLangDict();
        showStatus(form, 'error', dict['contact.form.errorDefault']);
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
