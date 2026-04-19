// Administrator email dispatchers.
// Extracted from utils/emailService.js in Phase 2.

const { loadTemplate, fillTemplate } = require('../template-manager');
const { sendEmail } = require('../transport');
// =============================================================================
// Administrator Emails
// =============================================================================

/**
 * Send welcome email to a new administrator
 */
exports.sendAdministratorWelcomeEmail = async (administrator) => {
  try {
    const language = administrator.languagePreference || 'en';
    const template = await loadTemplate('administrator-welcome', language);

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Welcome to WaveMAX Administrator Portal',
        EMAIL_HEADER: 'WaveMAX Administrator Portal',
        EMAIL_SUBHEADER: 'Welcome to the Management Team',
        GREETING: `Welcome, ${administrator.firstName}!`,
        WELCOME_MESSAGE: 'Your administrator account has been successfully created. You now have access to the WaveMAX Administrator Portal where you can manage operators, view analytics, and configure system settings.',
        ADMIN_ID_LABEL: 'Administrator ID',
        EMAIL_LABEL: 'Email',
        ACCOUNT_STATUS_LABEL: 'Account Status',
        ACCOUNT_STATUS: 'Active',
        PERMISSIONS_TITLE: 'Your Permissions',
        ACCESS_BUTTON: 'Access Admin Portal',
        SECURITY_REMINDER_TITLE: 'Security Reminder',
        SECURITY_REMINDER_TEXT: '• Use a strong password and change it regularly<br>• Never share your login credentials<br>• Always log out when finished<br>• Report any suspicious activity immediately',
        SUPPORT_MESSAGE: 'If you have any questions or need assistance, please contact the system administrator.',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_SECURITY_NOTE: 'This is a secure administrator account notification.'
      },
      es: {
        EMAIL_TITLE: 'Bienvenido al Portal de Administrador WaveMAX',
        EMAIL_HEADER: 'Portal de Administrador WaveMAX',
        EMAIL_SUBHEADER: 'Bienvenido al Equipo de Gestión',
        GREETING: `¡Bienvenido, ${administrator.firstName}!`,
        WELCOME_MESSAGE: 'Su cuenta de administrador ha sido creada exitosamente. Ahora tiene acceso al Portal de Administrador WaveMAX donde puede gestionar operadores, ver análisis y configurar ajustes del sistema.',
        ADMIN_ID_LABEL: 'ID de Administrador',
        EMAIL_LABEL: 'Correo Electrónico',
        ACCOUNT_STATUS_LABEL: 'Estado de Cuenta',
        ACCOUNT_STATUS: 'Activa',
        PERMISSIONS_TITLE: 'Sus Permisos',
        ACCESS_BUTTON: 'Acceder al Portal Admin',
        SECURITY_REMINDER_TITLE: 'Recordatorio de Seguridad',
        SECURITY_REMINDER_TEXT: '• Use una contraseña fuerte y cámbiela regularmente<br>• Nunca comparta sus credenciales de acceso<br>• Siempre cierre sesión cuando termine<br>• Reporte cualquier actividad sospechosa inmediatamente',
        SUPPORT_MESSAGE: 'Si tiene alguna pregunta o necesita asistencia, contacte al administrador del sistema.',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_SECURITY_NOTE: 'Esta es una notificación segura de cuenta de administrador.'
      },
      pt: {
        EMAIL_TITLE: 'Bem-vindo ao Portal de Administrador WaveMAX',
        EMAIL_HEADER: 'Portal de Administrador WaveMAX',
        EMAIL_SUBHEADER: 'Bem-vindo à Equipe de Gestão',
        GREETING: `Bem-vindo, ${administrator.firstName}!`,
        WELCOME_MESSAGE: 'Sua conta de administrador foi criada com sucesso. Agora você tem acesso ao Portal de Administrador WaveMAX onde pode gerenciar operadores, visualizar análises e configurar configurações do sistema.',
        ADMIN_ID_LABEL: 'ID de Administrador',
        EMAIL_LABEL: 'E-mail',
        ACCOUNT_STATUS_LABEL: 'Status da Conta',
        ACCOUNT_STATUS: 'Ativa',
        PERMISSIONS_TITLE: 'Suas Permissões',
        ACCESS_BUTTON: 'Acessar Portal Admin',
        SECURITY_REMINDER_TITLE: 'Lembrete de Segurança',
        SECURITY_REMINDER_TEXT: '• Use uma senha forte e mude-a regularmente<br>• Nunca compartilhe suas credenciais de login<br>• Sempre faça logout quando terminar<br>• Relate qualquer atividade suspeita imediatamente',
        SUPPORT_MESSAGE: 'Se você tiver alguma dúvida ou precisar de assistência, entre em contato com o administrador do sistema.',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_SECURITY_NOTE: 'Esta é uma notificação segura de conta de administrador.'
      },
      de: {
        EMAIL_TITLE: 'Willkommen beim WaveMAX Administrator-Portal',
        EMAIL_HEADER: 'WaveMAX Administrator-Portal',
        EMAIL_SUBHEADER: 'Willkommen im Verwaltungsteam',
        GREETING: `Willkommen, ${administrator.firstName}!`,
        WELCOME_MESSAGE: 'Ihr Administratorkonto wurde erfolgreich erstellt. Sie haben jetzt Zugriff auf das WaveMAX Administrator-Portal, wo Sie Betreiber verwalten, Analysen anzeigen und Systemeinstellungen konfigurieren können.',
        ADMIN_ID_LABEL: 'Administrator-ID',
        EMAIL_LABEL: 'E-Mail',
        ACCOUNT_STATUS_LABEL: 'Kontostatus',
        ACCOUNT_STATUS: 'Aktiv',
        PERMISSIONS_TITLE: 'Ihre Berechtigungen',
        ACCESS_BUTTON: 'Admin-Portal aufrufen',
        SECURITY_REMINDER_TITLE: 'Sicherheitserinnerung',
        SECURITY_REMINDER_TEXT: '• Verwenden Sie ein starkes Passwort und ändern Sie es regelmäßig<br>• Teilen Sie niemals Ihre Anmeldedaten<br>• Melden Sie sich immer ab, wenn Sie fertig sind<br>• Melden Sie verdächtige Aktivitäten sofort',
        SUPPORT_MESSAGE: 'Bei Fragen oder wenn Sie Hilfe benötigen, wenden Sie sich bitte an den Systemadministrator.',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_SECURITY_NOTE: 'Dies ist eine sichere Administratorkonto-Benachrichtigung.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      FIRST_NAME: administrator.firstName,
      LAST_NAME: administrator.lastName,
      ADMIN_ID: administrator.adminId,
      EMAIL: administrator.email,
      LOGIN_URL: `${process.env.BASE_URL || 'https://wavemax.promo'}/embed-app-v2.html?login=admin`,
      PERMISSIONS: administrator.permissions.join(', '),
      CURRENT_YEAR: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Welcome to WaveMAX Administrator Portal',
      es: 'Bienvenido al Portal de Administrador WaveMAX',
      pt: 'Bem-vindo ao Portal de Administrador WaveMAX',
      de: 'Willkommen beim WaveMAX Administrator-Portal'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      administrator.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending administrator welcome email:', error);
  }
};

/**
 * Send password reset email to administrator
 */
exports.sendAdministratorPasswordResetEmail = async (administrator, resetUrl) => {
  try {
    const template = await loadTemplate('administrator-password-reset');

    const data = {
      first_name: administrator.firstName,
      admin_id: administrator.adminId,
      reset_url: resetUrl,
      expire_time: '1 hour',
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      administrator.email,
      'Password Reset Request - WaveMAX Administrator Portal',
      html
    );
  } catch (error) {
    console.error('Error sending administrator password reset email:', error);
  }
};

module.exports = exports;
