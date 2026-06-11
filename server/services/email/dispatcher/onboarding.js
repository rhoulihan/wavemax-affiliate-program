// Onboarding email dispatchers — affiliate invites (spec §6.2).
//
// LOAD-BEARING CONSTRAINT: the mail transport blocks attachments (upstream
// policy — see transport.js). The invite is therefore a LINK, never a file.
// Never log the invite URL or raw token — only the inviteId/email.

const { loadTemplate, fillTemplate } = require('../template-manager');
const { sendEmail } = require('../transport');
const logger = require('../../../utils/logger');

const SUBJECTS = {
  en: 'Your WaveMAX Affiliate Invitation',
  es: 'Su invitación de afiliado de WaveMAX',
  pt: 'Seu convite de afiliado WaveMAX',
  de: 'Ihre WaveMAX-Partner-Einladung'
};

const DATE_LOCALES = { en: 'en-US', es: 'es-ES', pt: 'pt-BR', de: 'de-DE' };

/**
 * Send the single-use affiliate invite email.
 *
 * @param {Object} params
 * @param {string} params.email      Recipient — the invite's locked email
 * @param {string} [params.firstName] Prefill first name ('' tolerated)
 * @param {string} params.inviteUrl  Full registration URL carrying the raw token
 * @param {Date|string} params.expiresAt Invite expiry timestamp
 * @param {string} [params.language='en'] en|es|pt|de (anything else → en)
 * @returns {Promise<boolean>} true once handed to the transport
 * @throws transport errors are propagated — the caller decides whether the
 *         failure is fatal (inviteService treats mint-time failure as
 *         non-fatal: the row stays resendable).
 */
exports.sendAffiliateInviteEmail = async function sendAffiliateInviteEmail({
  email, firstName, inviteUrl, expiresAt, language = 'en'
}) {
  const lang = SUBJECTS[language] ? language : 'en';
  const template = await loadTemplate('affiliate-invite', lang);
  const html = fillTemplate(template, {
    first_name: firstName || '',
    invite_url: inviteUrl,
    expires_at: new Date(expiresAt).toLocaleString(DATE_LOCALES[lang], {
      dateStyle: 'long',
      timeStyle: 'short'
    })
  });
  await sendEmail(email, SUBJECTS[lang], html);
  logger.info('Affiliate invite email sent', { email });
  return true;
};

// ---------------------------------------------------------------------------
// W-9 status notifications (redesign PR 10 — spec §10 'affiliate-w9-status')
// ---------------------------------------------------------------------------

const escapeHtml = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));

const W9_STATUS_TRANSLATIONS = {
  en: {
    greeting: 'Hi', reasonLabel: 'Reason:', footerRights: 'All rights reserved.',
    received: {
      subject: 'W-9 received — pending review',
      heading: 'We received your W-9',
      body: 'Thanks — your W-9 has been uploaded and is stored encrypted. Our team will review it shortly.',
      nextSteps: 'No action is needed right now. We will email you once the review is complete.'
    },
    verified: {
      subject: 'W-9 verified — you are all set',
      heading: 'Your W-9 is on file',
      body: 'Your W-9 has been reviewed and verified. It is now on file with WaveMAX.',
      nextSteps: 'If commission payouts were on hold for the W-9 requirement, they are now re-enabled.'
    },
    rejected: {
      subject: 'W-9 rejected — action required',
      heading: 'Your W-9 needs another look',
      body: 'Unfortunately we could not accept the W-9 you submitted.',
      nextSteps: 'Please upload a corrected W-9 from your affiliate dashboard. PDF, JPG, or PNG are accepted.'
    }
  },
  es: {
    greeting: 'Hola', reasonLabel: 'Motivo:', footerRights: 'Todos los derechos reservados.',
    received: {
      subject: 'W-9 recibido — pendiente de revisión',
      heading: 'Recibimos su W-9',
      body: 'Gracias — su W-9 fue cargado y se almacena cifrado. Nuestro equipo lo revisará en breve.',
      nextSteps: 'No necesita hacer nada por ahora. Le enviaremos un correo cuando la revisión termine.'
    },
    verified: {
      subject: 'W-9 verificado — todo listo',
      heading: 'Su W-9 está archivado',
      body: 'Su W-9 fue revisado y verificado. Ya está archivado en WaveMAX.',
      nextSteps: 'Si los pagos de comisiones estaban en pausa por el requisito del W-9, ya están reactivados.'
    },
    rejected: {
      subject: 'W-9 rechazado — acción requerida',
      heading: 'Su W-9 necesita corrección',
      body: 'Lamentablemente no pudimos aceptar el W-9 que envió.',
      nextSteps: 'Por favor cargue un W-9 corregido desde su panel de afiliado. Se aceptan PDF, JPG o PNG.'
    }
  },
  pt: {
    greeting: 'Olá', reasonLabel: 'Motivo:', footerRights: 'Todos os direitos reservados.',
    received: {
      subject: 'W-9 recebido — aguardando revisão',
      heading: 'Recebemos seu W-9',
      body: 'Obrigado — seu W-9 foi enviado e está armazenado criptografado. Nossa equipe o revisará em breve.',
      nextSteps: 'Nenhuma ação é necessária agora. Enviaremos um e-mail quando a revisão for concluída.'
    },
    verified: {
      subject: 'W-9 verificado — tudo certo',
      heading: 'Seu W-9 está arquivado',
      body: 'Seu W-9 foi revisado e verificado. Agora está arquivado na WaveMAX.',
      nextSteps: 'Se os pagamentos de comissão estavam suspensos pela exigência do W-9, eles foram reativados.'
    },
    rejected: {
      subject: 'W-9 rejeitado — ação necessária',
      heading: 'Seu W-9 precisa de correção',
      body: 'Infelizmente não pudemos aceitar o W-9 que você enviou.',
      nextSteps: 'Envie um W-9 corrigido pelo seu painel de afiliado. PDF, JPG ou PNG são aceitos.'
    }
  },
  de: {
    greeting: 'Hallo', reasonLabel: 'Grund:', footerRights: 'Alle Rechte vorbehalten.',
    received: {
      subject: 'W-9 erhalten — Prüfung ausstehend',
      heading: 'Wir haben Ihr W-9 erhalten',
      body: 'Danke — Ihr W-9 wurde hochgeladen und verschlüsselt gespeichert. Unser Team prüft es in Kürze.',
      nextSteps: 'Derzeit ist nichts zu tun. Wir benachrichtigen Sie per E-Mail, sobald die Prüfung abgeschlossen ist.'
    },
    verified: {
      subject: 'W-9 verifiziert — alles erledigt',
      heading: 'Ihr W-9 ist hinterlegt',
      body: 'Ihr W-9 wurde geprüft und verifiziert. Es ist jetzt bei WaveMAX hinterlegt.',
      nextSteps: 'Falls Provisionsauszahlungen wegen der W-9-Anforderung pausiert waren, sind sie jetzt wieder aktiviert.'
    },
    rejected: {
      subject: 'W-9 abgelehnt — Handlung erforderlich',
      heading: 'Ihr W-9 muss korrigiert werden',
      body: 'Leider konnten wir das eingereichte W-9 nicht akzeptieren.',
      nextSteps: 'Bitte laden Sie ein korrigiertes W-9 über Ihr Affiliate-Dashboard hoch. PDF, JPG oder PNG werden akzeptiert.'
    }
  }
};

/**
 * Send a W-9 lifecycle notification to an affiliate.
 * @param {Object} affiliate - needs firstName, email, languagePreference
 * @param {'received'|'verified'|'rejected'} status
 * @param {{reason?: string}} [opts] - rejection reason (rejected only)
 * Side effects: one outbound email; errors are logged, never thrown
 * (email failure must not fail the upload/review mutation).
 */
exports.sendAffiliateW9StatusEmail = async (affiliate, status, { reason } = {}) => {
  try {
    const language = affiliate.languagePreference || 'en';
    const template = await loadTemplate('affiliate-w9-status', language);
    const t = W9_STATUS_TRANSLATIONS[language] || W9_STATUS_TRANSLATIONS.en;
    const s = t[status] || t.received;

    const reasonBlock = (status === 'rejected' && reason)
      ? '<p style="background:#fef2f2;border-left:4px solid #C74634;padding:12px;">'
        + `<strong>${t.reasonLabel}</strong> ${escapeHtml(reason)}</p>`
      : '';

    const html = fillTemplate(template, {
      EMAIL_TITLE: s.subject,
      EMAIL_HEADER: s.heading,
      GREETING: `${t.greeting} ${affiliate.firstName},`,
      BODY_MESSAGE: s.body,
      REASON_BLOCK: reasonBlock,
      NEXT_STEPS: s.nextSteps,
      FOOTER_RIGHTS: t.footerRights,
      CURRENT_YEAR: new Date().getFullYear()
    });

    await sendEmail(affiliate.email, s.subject, html);
  } catch (error) {
    logger.error('Error sending W-9 status email:', error);
  }
};

module.exports = exports;
