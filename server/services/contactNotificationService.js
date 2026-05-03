const emailService = require('../utils/emailService');

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function nl2br(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

function buildSubject(slug, firstName, lastName) {
  return `New contact-form message from ${firstName} ${lastName} (${slug})`;
}

function buildHtmlBody({ firstName, lastName, email, phone, message, slug }) {
  const phoneRow = phone
    ? `<tr><td><strong>Phone:</strong></td><td>${escapeHtml(phone)}</td></tr>`
    : '';

  return `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #143852;">
    <h2>New contact-form message — ${escapeHtml(slug)}</h2>
    <table cellpadding="6" cellspacing="0" border="0">
      <tr><td><strong>Name:</strong></td><td>${escapeHtml(firstName)} ${escapeHtml(lastName)}</td></tr>
      <tr><td><strong>Email:</strong></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      ${phoneRow}
    </table>
    <h3>Message</h3>
    <p style="white-space: pre-wrap;">${nl2br(message)}</p>
    <hr>
    <p style="font-size: 12px; color: #6c757d;">
      Reply directly to this email to respond to ${escapeHtml(firstName)}.
    </p>
  </body>
</html>`;
}

async function sendContactNotification({ recipient, slug, firstName, lastName, email, phone, message }) {
  if (!recipient) {
    throw new Error('Contact notification requires a recipient');
  }

  const subject = buildSubject(slug, firstName, lastName);
  const html = buildHtmlBody({ firstName, lastName, email, phone, message, slug });

  await emailService.sendEmail(recipient, subject, html);
}

module.exports = {
  sendContactNotification
};
