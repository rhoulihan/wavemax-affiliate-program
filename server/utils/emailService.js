// Email Service for WaveMAX Laundry Affiliate Program
// Handles all email notifications to affiliates and customers

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
// Removed SES and Brevo dependencies - using SMTP only

// Create email transport for Mailcow SMTP or console for testing
const createTransport = () => {
  // Use console transport for testing
  if (process.env.EMAIL_PROVIDER === 'console') {
    return {
      sendMail: async (mailOptions) => {
        console.log('=== EMAIL CONSOLE LOG ===');
        console.log('From:', mailOptions.from);
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('HTML:', mailOptions.html);
        console.log('=========================');
        return { messageId: 'console-message-id' };
      }
    };
  }
  
  // Use SMTP transport for Mailcow
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'localhost',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // Mailcow specific settings
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });
};

// Load email template
const loadTemplate = async (templateName, language = 'en') => {
  try {
    // First try to load language-specific template
    const langTemplatePath = path.join(__dirname, '../templates/emails', language, `${templateName}.html`);

    try {
      const template = await readFile(langTemplatePath, 'utf8');
      return template;
    } catch (langError) {
      // If language-specific template doesn't exist, fall back to default English template
      console.log(`Language-specific template not found for ${language}/${templateName}, using default`);
      const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
      const template = await readFile(templatePath, 'utf8');
      return template;
    }
  } catch (error) {
    console.error(`Error loading email template ${templateName}:`, error);
    // Return a basic template as fallback
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e3a8a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>WaveMAX Laundry</h1>
          </div>
          <div class="content">
            [EMAIL_CONTENT]
          </div>
          <div class="footer">
            &copy; 2025 CRHS Enterprises, LLC. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
  }
};

// Logo is now served via URL instead of attachment
// Logo URL: https://www.wavemaxlaundry.com/assets/WaveMax/images/logo-wavemax.png

// Fill template with data
const fillTemplate = (template, data) => {
  // Add BASE_URL to all template data
  const baseUrl = process.env.BASE_URL || 'https://wavemax.promo';
  data.BASE_URL = baseUrl;

  // Use a regex to find all placeholders and replace them in one operation
  return template.replace(/\[([A-Za-z0-9_]+)\]/g, (match, placeholder) => {
    // First try the exact placeholder as-is, then try lowercase, then uppercase
    const exactKey = placeholder;
    const lowerKey = placeholder.toLowerCase();
    const upperKey = placeholder.toUpperCase();

    if (data[exactKey] !== undefined) {
      return data[exactKey];
    } else if (data[lowerKey] !== undefined) {
      return data[lowerKey];
    } else if (data[upperKey] !== undefined) {
      return data[upperKey];
    } else {
      // If not found, return empty string for cleaner emails
      console.warn(`Email template placeholder [${placeholder}] not found in data`);
      return '';
    }
  });
};

// Send email (attachments removed due to mail server policy)
const sendEmail = async (to, subject, html) => {
  try {
    // Debug logging
    console.log('[sendEmail] Sending email to:', to);
    
    // Validate recipient
    if (!to) {
      throw new Error('No recipient email address provided');
    }
    
    const transporter = createTransport();

    // Simplified from address for Mailcow SMTP
    const from = `"WaveMAX Laundry" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@wavemax.promo'}>`;

    const mailOptions = {
      from,
      to,
      subject,
      html
    };

    // Note: Attachments removed - mail server policy blocks them
    // All images now use direct URLs instead

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// =============================================================================
// Affiliate Emails
// =============================================================================

/**
 * Send welcome email to a new affiliate
 */
exports.sendAffiliateWelcomeEmail = async (affiliate) => {
  try {
    const language = affiliate.languagePreference || 'en';
    const template = await loadTemplate('affiliate-welcome', language);
    const registrationUrl = `https://wavemax.promo/embed-app-v2.html?route=/customer-login&affid=${affiliate.affiliateId}`;
    const landingPageUrl = `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?route=/affiliate-landing&code=${affiliate.affiliateId}`;

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Welcome to WaveMAX Laundry Affiliate Program',
        EMAIL_HEADER: 'Welcome to the Affiliate Program!',
        GREETING: `Hi ${affiliate.firstName},`,
        WELCOME_MESSAGE: 'Congratulations and welcome to the WaveMAX Laundry Affiliate Program! We\'re excited to have you join our network of affiliate partners.',
        READY_MESSAGE: 'You\'re now ready to start offering premium wash, dry, fold laundry services to your customers, with pickup and delivery handled by you.',
        YOUR_INFO_TITLE: 'Your Affiliate Information',
        AFFILIATE_ID_LABEL: 'Affiliate ID',
        LANDING_PAGE_LABEL: 'Customer Landing Page',
        LANDING_PAGE_DESC: 'Share this professional landing page with potential customers to showcase your services and pricing.',
        REGISTRATION_URL_LABEL: 'Direct Registration URL',
        REGISTRATION_URL_DESC: 'Customers can also use this direct link to register. Each customer registered through your links will be associated with your account.',
        GETTING_STARTED_TITLE: 'Getting Started',
        STEP_1: 'Share your registration link with potential customers',
        STEP_2: 'Receive laundry bags with unique barcodes for your customers',
        STEP_3: 'Coordinate pickups and deliveries based on customer schedules',
        STEP_4: 'Bring the laundry to our WaveMAX location for washing, drying, and folding',
        STEP_5: 'Deliver clean laundry back to your customers',
        STEP_6: 'Earn commissions on every order!',
        COMMISSION_LABEL: 'COMMISSION ON WDF',
        DELIVERY_FEES_LABEL: 'OF DELIVERY FEES',
        STARTUP_COST_LABEL: 'STARTUP COST',
        DASHBOARD_MESSAGE: 'Login to your dashboard to manage your affiliate account, track orders, and view your earnings.',
        DASHBOARD_BUTTON: 'Go to Dashboard',
        W9_NOTICE_TITLE: '⚠️ IMPORTANT: W-9 Form Information',
        W9_NOTICE_SUBTITLE: 'Tax Documentation Process',
        W9_NOTICE_MESSAGE: 'To comply with IRS regulations:',
        W9_STEP_1: 'When your annual earnings exceed $600, you will receive a W-9 form via DocuSign',
        W9_STEP_2: 'Complete and sign the form electronically through DocuSign',
        W9_STEP_3: 'Please watch for the DocuSign email to avoid interruption in commission payouts',
        W9_STEP_4: 'Your prompt response ensures uninterrupted commission payments',
        W9_IRS_NOTE: 'Note: The W-9 form will be automatically sent via DocuSign when you reach the $600 annual earnings threshold.',
        W9_SUPPORT_MESSAGE: 'For questions about the W-9 process, contact support@wavemax.com'
      },
      es: {
        EMAIL_TITLE: 'Bienvenido al Programa de Afiliados de WaveMAX Laundry',
        EMAIL_HEADER: '¡Bienvenido al Programa de Afiliados!',
        GREETING: `Hola ${affiliate.firstName},`,
        WELCOME_MESSAGE: '¡Felicitaciones y bienvenido al Programa de Afiliados de WaveMAX Laundry! Estamos emocionados de que se una a nuestra red de socios afiliados.',
        READY_MESSAGE: 'Ahora está listo para comenzar a ofrecer servicios premium de lavado, secado y doblado de ropa, con recogida y entrega manejados por usted.',
        YOUR_INFO_TITLE: 'Su Información de Afiliado',
        AFFILIATE_ID_LABEL: 'ID de Afiliado',
        LANDING_PAGE_LABEL: 'Página de Destino para Clientes',
        LANDING_PAGE_DESC: 'Comparta esta página profesional con clientes potenciales para mostrar sus servicios y precios.',
        REGISTRATION_URL_LABEL: 'URL de Registro Directo',
        REGISTRATION_URL_DESC: 'Los clientes también pueden usar este enlace directo para registrarse. Cada cliente registrado a través de sus enlaces estará asociado con su cuenta.',
        GETTING_STARTED_TITLE: 'Primeros Pasos',
        STEP_1: 'Comparta su enlace de registro con clientes potenciales',
        STEP_2: 'Reciba bolsas de lavandería con códigos de barras únicos para sus clientes',
        STEP_3: 'Coordine recogidas y entregas según los horarios de los clientes',
        STEP_4: 'Lleve la ropa a nuestra ubicación WaveMAX para lavar, secar y doblar',
        STEP_5: 'Entregue la ropa limpia a sus clientes',
        STEP_6: '¡Gane comisiones en cada pedido!',
        COMMISSION_LABEL: 'COMISIÓN EN WDF',
        DELIVERY_FEES_LABEL: 'DE TARIFAS DE ENTREGA',
        STARTUP_COST_LABEL: 'COSTO INICIAL',
        DASHBOARD_MESSAGE: 'Inicie sesión en su panel para administrar su cuenta de afiliado, rastrear pedidos y ver sus ganancias.',
        DASHBOARD_BUTTON: 'Ir al Panel',
        W9_NOTICE_TITLE: '⚠️ IMPORTANTE: Información del Formulario W-9',
        W9_NOTICE_SUBTITLE: 'Proceso de Documentación Fiscal',
        W9_NOTICE_MESSAGE: 'Para cumplir con las regulaciones del IRS:',
        W9_STEP_1: 'Cuando sus ganancias anuales superen los $600, recibirá un formulario W-9 a través de DocuSign',
        W9_STEP_2: 'Complete y firme el formulario electrónicamente a través de DocuSign',
        W9_STEP_3: 'Por favor, esté atento al correo electrónico de DocuSign para evitar interrupciones en los pagos de comisiones',
        W9_STEP_4: 'Su respuesta rápida garantiza pagos de comisiones ininterrumpidos',
        W9_IRS_NOTE: 'Nota: El formulario W-9 se enviará automáticamente a través de DocuSign cuando alcance el umbral de ganancias anuales de $600.',
        W9_SUPPORT_MESSAGE: 'Para preguntas sobre el proceso W-9, contacte a support@wavemax.com'
      },
      pt: {
        EMAIL_TITLE: 'Bem-vindo ao Programa de Afiliados WaveMAX Laundry',
        EMAIL_HEADER: 'Bem-vindo ao Programa de Afiliados!',
        GREETING: `Olá ${affiliate.firstName},`,
        WELCOME_MESSAGE: 'Parabéns e bem-vindo ao Programa de Afiliados WaveMAX Laundry! Estamos animados em tê-lo em nossa rede de parceiros afiliados.',
        READY_MESSAGE: 'Você está pronto para começar a oferecer serviços premium de lavar, secar e dobrar roupas, com coleta e entrega gerenciadas por você.',
        YOUR_INFO_TITLE: 'Suas Informações de Afiliado',
        AFFILIATE_ID_LABEL: 'ID de Afiliado',
        LANDING_PAGE_LABEL: 'Página de Destino para Clientes',
        LANDING_PAGE_DESC: 'Compartilhe esta página profissional com clientes em potencial para mostrar seus serviços e preços.',
        REGISTRATION_URL_LABEL: 'URL de Registro Direto',
        REGISTRATION_URL_DESC: 'Os clientes também podem usar este link direto para se registrar. Cada cliente registrado através de seus links será associado à sua conta.',
        GETTING_STARTED_TITLE: 'Primeiros Passos',
        STEP_1: 'Compartilhe seu link de registro com clientes em potencial',
        STEP_2: 'Receba sacolas de lavanderia com códigos de barras exclusivos para seus clientes',
        STEP_3: 'Coordene coletas e entregas com base nos horários dos clientes',
        STEP_4: 'Leve a roupa para nossa localização WaveMAX para lavar, secar e dobrar',
        STEP_5: 'Entregue roupas limpas de volta aos seus clientes',
        STEP_6: 'Ganhe comissões em cada pedido!',
        COMMISSION_LABEL: 'COMISSÃO EM WDF',
        DELIVERY_FEES_LABEL: 'DAS TAXAS DE ENTREGA',
        STARTUP_COST_LABEL: 'CUSTO INICIAL',
        DASHBOARD_MESSAGE: 'Faça login em seu painel para gerenciar sua conta de afiliado, rastrear pedidos e visualizar seus ganhos.',
        DASHBOARD_BUTTON: 'Ir para o Painel',
        W9_NOTICE_TITLE: '⚠️ IMPORTANTE: Informações do Formulário W-9',
        W9_NOTICE_SUBTITLE: 'Processo de Documentação Fiscal',
        W9_NOTICE_MESSAGE: 'Para cumprir com os regulamentos do IRS:',
        W9_STEP_1: 'Quando seus ganhos anuais excederem $600, você receberá um formulário W-9 via DocuSign',
        W9_STEP_2: 'Complete e assine o formulário eletronicamente através do DocuSign',
        W9_STEP_3: 'Por favor, fique atento ao e-mail do DocuSign para evitar interrupções nos pagamentos de comissões',
        W9_STEP_4: 'Sua resposta rápida garante pagamentos de comissões ininterruptos',
        W9_IRS_NOTE: 'Nota: O formulário W-9 será enviado automaticamente via DocuSign quando você atingir o limite de ganhos anuais de $600.',
        W9_SUPPORT_MESSAGE: 'Para perguntas sobre o processo W-9, entre em contato com support@wavemax.com'
      },
      de: {
        EMAIL_TITLE: 'Willkommen beim WaveMAX Laundry Affiliate-Programm',
        EMAIL_HEADER: 'Willkommen beim Affiliate-Programm!',
        GREETING: `Hallo ${affiliate.firstName},`,
        WELCOME_MESSAGE: 'Herzlichen Glückwunsch und willkommen beim WaveMAX Laundry Affiliate-Programm! Wir freuen uns, Sie in unserem Netzwerk von Affiliate-Partnern begrüßen zu dürfen.',
        READY_MESSAGE: 'Sie sind jetzt bereit, Premium-Wasch-, Trocken- und Faltservice anzubieten, wobei Abholung und Lieferung von Ihnen übernommen werden.',
        YOUR_INFO_TITLE: 'Ihre Affiliate-Informationen',
        AFFILIATE_ID_LABEL: 'Affiliate-ID',
        LANDING_PAGE_LABEL: 'Kunden-Landingpage',
        LANDING_PAGE_DESC: 'Teilen Sie diese professionelle Landingpage mit potenziellen Kunden, um Ihre Dienstleistungen und Preise zu präsentieren.',
        REGISTRATION_URL_LABEL: 'Direkte Registrierungs-URL',
        REGISTRATION_URL_DESC: 'Kunden können auch diesen direkten Link zur Registrierung verwenden. Jeder über Ihre Links registrierte Kunde wird Ihrem Konto zugeordnet.',
        GETTING_STARTED_TITLE: 'Erste Schritte',
        STEP_1: 'Teilen Sie Ihren Registrierungslink mit potenziellen Kunden',
        STEP_2: 'Erhalten Sie Wäschesäcke mit einzigartigen Barcodes für Ihre Kunden',
        STEP_3: 'Koordinieren Sie Abholungen und Lieferungen basierend auf Kundenterminen',
        STEP_4: 'Bringen Sie die Wäsche zu unserem WaveMAX-Standort zum Waschen, Trocknen und Falten',
        STEP_5: 'Liefern Sie saubere Wäsche an Ihre Kunden zurück',
        STEP_6: 'Verdienen Sie Provisionen bei jeder Bestellung!',
        COMMISSION_LABEL: 'PROVISION AUF WDF',
        DELIVERY_FEES_LABEL: 'DER LIEFERGEBÜHREN',
        STARTUP_COST_LABEL: 'STARTKOSTEN',
        DASHBOARD_MESSAGE: 'Melden Sie sich in Ihrem Dashboard an, um Ihr Affiliate-Konto zu verwalten, Bestellungen zu verfolgen und Ihre Einnahmen anzuzeigen.',
        DASHBOARD_BUTTON: 'Zum Dashboard',
        W9_NOTICE_TITLE: '⚠️ WICHTIG: W-9 Formular Informationen',
        W9_NOTICE_SUBTITLE: 'Steuerdokumentationsprozess',
        W9_NOTICE_MESSAGE: 'Um die IRS-Vorschriften einzuhalten:',
        W9_STEP_1: 'Wenn Ihre jährlichen Einnahmen $600 überschreiten, erhalten Sie ein W-9-Formular über DocuSign',
        W9_STEP_2: 'Füllen Sie das Formular aus und unterschreiben Sie es elektronisch über DocuSign',
        W9_STEP_3: 'Bitte achten Sie auf die DocuSign-E-Mail, um Unterbrechungen bei Provisionszahlungen zu vermeiden',
        W9_STEP_4: 'Ihre prompte Antwort gewährleistet ununterbrochene Provisionszahlungen',
        W9_IRS_NOTE: 'Hinweis: Das W-9-Formular wird automatisch über DocuSign gesendet, wenn Sie die jährliche Einnahmeschwelle von $600 erreichen.',
        W9_SUPPORT_MESSAGE: 'Bei Fragen zum W-9-Prozess wenden Sie sich an support@wavemax.com'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      first_name: affiliate.firstName,
      last_name: affiliate.lastName,
      affiliate_id: affiliate.affiliateId,
      AFFILIATE_ID: affiliate.affiliateId,
      registration_url: registrationUrl,
      REGISTRATION_URL: registrationUrl,
      landing_page_url: landingPageUrl,
      LANDING_PAGE_URL: landingPageUrl,
      login_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
      LOGIN_URL: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
      DASHBOARD_URL: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
      current_year: new Date().getFullYear(),
      CURRENT_YEAR: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Welcome to WaveMAX Laundry Affiliate Program',
      es: 'Bienvenido al Programa de Afiliados de WaveMAX Laundry',
      pt: 'Bem-vindo ao Programa de Afiliados WaveMAX Laundry',
      de: 'Willkommen beim WaveMAX Laundry Affiliate-Programm'
    };
    const subject = subjects[language] || subjects.en;

    // No attachments - using linked logo in HTML
    await sendEmail(
      affiliate.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending affiliate welcome email:', error);
  }
};

/**
 * Send new customer notification to affiliate
 */
exports.sendAffiliateNewCustomerEmail = async (affiliate, customer, bagInfo = {}) => {
  try {
    // Debug logging
    console.log('[sendAffiliateNewCustomerEmail] Affiliate:', affiliate ? { 
      email: affiliate.email, 
      affiliateId: affiliate.affiliateId, 
      businessName: affiliate.businessName 
    } : 'undefined');
    console.log('[sendAffiliateNewCustomerEmail] Customer:', customer ? { 
      email: customer.email, 
      firstName: customer.firstName, 
      customerId: customer.customerId 
    } : 'undefined');
    
    // Validate inputs
    if (!affiliate || !customer) {
      console.error('Missing affiliate or customer data for new customer notification');
      return;
    }
    
    if (!affiliate.email) {
      console.error('Affiliate email is missing or undefined');
      return;
    }
    const language = affiliate.languagePreference || 'en';
    const template = await loadTemplate('affiliate-new-customer', language);

    const numberOfBags = bagInfo.numberOfBags || 1;
    const totalCredit = bagInfo.totalCredit || 0;
    const isFreeRegistration = numberOfBags === 1 && totalCredit === 0;

    // Build the greeting with the actual business name
    const businessName = affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`;
    
    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'New Customer Registration',
        EMAIL_HEADER: 'New Customer Registration!',
        GREETING: `Congratulations, ${businessName}!`,
        NEW_CUSTOMER_MESSAGE: 'Great news! A new customer has just registered through your affiliate link.',
        ACTION_REQUIRED_LABEL: 'Action Required',
        ACTION_REQUIRED_MESSAGE: `Please deliver ${numberOfBags} laundry bag(s) to your new customer within 48 hours.`,
        BAG_FEE_NOTE: isFreeRegistration ? 
          'Note: This customer received their first bag FREE as part of our promotional offer.' :
          'Note: The customer has been charged for their bags. This fee will be credited on their first order.',
        CUSTOMER_INFO_TITLE: 'Customer Information',
        CUSTOMER_ID_LABEL: 'Customer ID',
        NAME_LABEL: 'Name',
        EMAIL_LABEL: 'Email',
        PHONE_LABEL: 'Phone',
        ADDRESS_LABEL: 'Address',
        SERVICE_FREQUENCY_LABEL: 'Service Frequency',
        NEXT_STEPS_TITLE: 'Next Steps:',
        NEXT_STEPS_LIST: `<ol><li>Contact the customer to arrange bag delivery</li><li>Deliver <strong>${numberOfBags}</strong> laundry bag(s) they purchased during registration</li><li>Explain the pickup and delivery process</li><li>Schedule their first pickup if requested</li><li>Remind them that bag fees will be credited on their first order</li></ol>`,
        VIEW_CUSTOMER_BUTTON: 'View Customer in Dashboard',
        REMINDER_MESSAGE: 'Remember: Providing excellent service from the start helps ensure customer retention and positive reviews!',
        FOOTER_SENT_BY: 'This email was sent by WaveMAX Laundry Affiliate Program',
        FOOTER_QUESTIONS: 'Questions? Contact us at',
        FOOTER_RIGHTS: 'All rights reserved.'
      },
      es: {
        EMAIL_TITLE: 'Nuevo Registro de Cliente',
        EMAIL_HEADER: '¡Nuevo Registro de Cliente!',
        GREETING: `¡Felicitaciones, ${businessName}!`,
        NEW_CUSTOMER_MESSAGE: '¡Excelentes noticias! Un nuevo cliente acaba de registrarse a través de su enlace de afiliado.',
        ACTION_REQUIRED_LABEL: 'Acción Requerida',
        ACTION_REQUIRED_MESSAGE: `Por favor entregue ${numberOfBags} bolsa(s) de lavandería a su nuevo cliente dentro de 48 horas.`,
        BAG_FEE_NOTE: isFreeRegistration ?
          'Nota: Este cliente recibió su primera bolsa GRATIS como parte de nuestra oferta promocional.' :
          'Nota: Al cliente se le ha cobrado por sus bolsas. Esta tarifa se acreditará en su primer pedido.',
        CUSTOMER_INFO_TITLE: 'Información del Cliente',
        CUSTOMER_ID_LABEL: 'ID del Cliente',
        NAME_LABEL: 'Nombre',
        EMAIL_LABEL: 'Correo Electrónico',
        PHONE_LABEL: 'Teléfono',
        ADDRESS_LABEL: 'Dirección',
        SERVICE_FREQUENCY_LABEL: 'Frecuencia de Servicio',
        NEXT_STEPS_TITLE: 'Próximos Pasos:',
        NEXT_STEPS_LIST: `<ol><li>Contacte al cliente para coordinar la entrega de bolsas</li><li>Entregue <strong>${numberOfBags}</strong> bolsa(s) de lavandería que compraron durante el registro</li><li>Explique el proceso de recogida y entrega</li><li>Programe su primera recogida si lo solicitan</li><li>Recuérdeles que las tarifas de bolsas se acreditarán en su primer pedido</li></ol>`,
        VIEW_CUSTOMER_BUTTON: 'Ver Cliente en el Panel',
        REMINDER_MESSAGE: 'Recuerde: ¡Brindar un excelente servicio desde el principio ayuda a garantizar la retención de clientes y reseñas positivas!',
        FOOTER_SENT_BY: 'Este correo fue enviado por el Programa de Afiliados WaveMAX Laundry',
        FOOTER_QUESTIONS: '¿Preguntas? Contáctenos en',
        FOOTER_RIGHTS: 'Todos los derechos reservados.'
      },
      pt: {
        EMAIL_TITLE: 'Novo Registro de Cliente',
        EMAIL_HEADER: 'Novo Registro de Cliente!',
        GREETING: 'Parabéns, [BUSINESS_NAME]!',
        NEW_CUSTOMER_MESSAGE: 'Ótimas notícias! Um novo cliente acabou de se registrar através do seu link de afiliado.',
        ACTION_REQUIRED_LABEL: 'Ação Necessária',
        ACTION_REQUIRED_MESSAGE: `Por favor, entregue ${numberOfBags} sacola(s) de lavanderia ao seu novo cliente dentro de 48 horas.`,
        BAG_FEE_NOTE: isFreeRegistration ?
          'Nota: Este cliente recebeu sua primeira sacola GRÁTIS como parte de nossa oferta promocional.' :
          'Nota: O cliente foi cobrado pelas sacolas. Esta taxa será creditada no primeiro pedido.',
        CUSTOMER_INFO_TITLE: 'Informações do Cliente',
        CUSTOMER_ID_LABEL: 'ID do Cliente',
        NAME_LABEL: 'Nome',
        EMAIL_LABEL: 'E-mail',
        PHONE_LABEL: 'Telefone',
        ADDRESS_LABEL: 'Endereço',
        SERVICE_FREQUENCY_LABEL: 'Frequência de Serviço',
        NEXT_STEPS_TITLE: 'Próximos Passos:',
        NEXT_STEPS_LIST: `<ol><li>Entre em contato com o cliente para organizar a entrega das sacolas</li><li>Entregue <strong>${numberOfBags}</strong> sacola(s) de lavanderia que compraram durante o registro</li><li>Explique o processo de coleta e entrega</li><li>Agende a primeira coleta se solicitado</li><li>Lembre-os de que as taxas das sacolas serão creditadas no primeiro pedido</li></ol>`,
        VIEW_CUSTOMER_BUTTON: 'Ver Cliente no Painel',
        REMINDER_MESSAGE: 'Lembre-se: Fornecer um excelente serviço desde o início ajuda a garantir a retenção de clientes e avaliações positivas!',
        FOOTER_SENT_BY: 'Este e-mail foi enviado pelo Programa de Afiliados WaveMAX Laundry',
        FOOTER_QUESTIONS: 'Dúvidas? Entre em contato conosco em',
        FOOTER_RIGHTS: 'Todos os direitos reservados.'
      },
      de: {
        EMAIL_TITLE: 'Neue Kundenregistrierung',
        EMAIL_HEADER: 'Neue Kundenregistrierung!',
        GREETING: 'Herzlichen Glückwunsch, [BUSINESS_NAME]!',
        NEW_CUSTOMER_MESSAGE: 'Großartige Neuigkeiten! Ein neuer Kunde hat sich gerade über Ihren Affiliate-Link registriert.',
        ACTION_REQUIRED_LABEL: 'Aktion erforderlich',
        ACTION_REQUIRED_MESSAGE: `Bitte liefern Sie ${numberOfBags} Wäschesack/-säcke innerhalb von 48 Stunden an Ihren neuen Kunden.`,
        BAG_FEE_NOTE: isFreeRegistration ?
          'Hinweis: Dieser Kunde hat seinen ersten Sack KOSTENLOS als Teil unseres Werbeangebots erhalten.' :
          'Hinweis: Dem Kunden wurden die Säcke berechnet. Diese Gebühr wird bei der ersten Bestellung gutgeschrieben.',
        CUSTOMER_INFO_TITLE: 'Kundeninformationen',
        CUSTOMER_ID_LABEL: 'Kunden-ID',
        NAME_LABEL: 'Name',
        EMAIL_LABEL: 'E-Mail',
        PHONE_LABEL: 'Telefon',
        ADDRESS_LABEL: 'Adresse',
        SERVICE_FREQUENCY_LABEL: 'Service-Häufigkeit',
        NEXT_STEPS_TITLE: 'Nächste Schritte:',
        NEXT_STEPS_LIST: `<ol><li>Kontaktieren Sie den Kunden, um die Sacklieferung zu arrangieren</li><li>Liefern Sie <strong>${numberOfBags}</strong> Wäschesack/-säcke, die während der Registrierung gekauft wurden</li><li>Erklären Sie den Abhol- und Lieferprozess</li><li>Planen Sie die erste Abholung auf Anfrage</li><li>Erinnern Sie sie daran, dass die Sackgebühren bei der ersten Bestellung gutgeschrieben werden</li></ol>`,
        VIEW_CUSTOMER_BUTTON: 'Kunde im Dashboard anzeigen',
        REMINDER_MESSAGE: 'Denken Sie daran: Exzellenter Service von Anfang an hilft, Kundenbindung und positive Bewertungen zu gewährleisten!',
        FOOTER_SENT_BY: 'Diese E-Mail wurde vom WaveMAX Laundry Affiliate-Programm gesendet',
        FOOTER_QUESTIONS: 'Fragen? Kontaktieren Sie uns unter',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      business_name: affiliate.businessName || affiliate.firstName || 'Affiliate',
      BUSINESS_NAME: affiliate.businessName || affiliate.firstName || 'Affiliate',
      affiliate_first_name: affiliate.firstName,
      affiliate_name: affiliate.businessName || `${affiliate.firstName} ${affiliate.lastName}`,
      customer_first_name: customer.firstName,
      customer_last_name: customer.lastName,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      customer_id: customer.customerId,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`,
      service_frequency: customer.serviceFrequency,
      number_of_bags: numberOfBags,
      dashboard_url: `https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate&customer=${customer.customerId}`,
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'New Customer Registration',
      es: 'Nuevo Registro de Cliente',
      pt: 'Novo Registro de Cliente',
      de: 'Neue Kundenregistrierung'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      affiliate.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending new customer notification email:', error);
  }
};

/**
 * Send new order notification to affiliate
 */
exports.sendAffiliateNewOrderEmail = async (affiliate, customer, order) => {
  try {
    const language = affiliate.languagePreference || 'en';
    const template = await loadTemplate('affiliate-new-order', language);

    // Build the greeting with fallback
    const affiliateName = affiliate.firstName || affiliate.businessName || 'Partner';

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'New Laundry Pickup Order',
        EMAIL_HEADER: 'New Laundry Pickup Order',
        GREETING: `Hello ${affiliateName},`,
        NEW_ORDER_MESSAGE: 'You have a new laundry pickup order to process!',
        ORDER_DETAILS_TITLE: 'Order Details',
        ORDER_ID_LABEL: 'Order ID',
        CUSTOMER_LABEL: 'Customer',
        PHONE_LABEL: 'Phone',
        ADDRESS_LABEL: 'Address',
        PICKUP_DATE_LABEL: 'Pickup Date',
        PICKUP_TIME_LABEL: 'Pickup Time',
        ESTIMATED_WEIGHT_LABEL: 'Estimated Weight',
        NUMBER_OF_BAGS_LABEL: 'Number of Bags',
        SPECIAL_INSTRUCTIONS_LABEL: 'Special Instructions',
        VIEW_ORDER_BUTTON: 'View in Dashboard',
        PICKUP_REMINDER: 'Please ensure you pick up the laundry during the specified time window. The customer will be expecting you.',
        CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.'
      },
      es: {
        EMAIL_TITLE: 'Nuevo Pedido de Recogida de Lavandería',
        EMAIL_HEADER: 'Nuevo Pedido de Recogida de Lavandería',
        GREETING: `Hola ${affiliateName},`,
        NEW_ORDER_MESSAGE: '¡Tiene un nuevo pedido de recogida de lavandería para procesar!',
        ORDER_DETAILS_TITLE: 'Detalles del Pedido',
        ORDER_ID_LABEL: 'ID del Pedido',
        CUSTOMER_LABEL: 'Cliente',
        PHONE_LABEL: 'Teléfono',
        ADDRESS_LABEL: 'Dirección',
        PICKUP_DATE_LABEL: 'Fecha de Recogida',
        PICKUP_TIME_LABEL: 'Hora de Recogida',
        ESTIMATED_WEIGHT_LABEL: 'Peso Estimado',
        NUMBER_OF_BAGS_LABEL: 'Número de Bolsas',
        SPECIAL_INSTRUCTIONS_LABEL: 'Instrucciones Especiales',
        VIEW_ORDER_BUTTON: 'Ver en el Panel',
        PICKUP_REMINDER: 'Por favor asegúrese de recoger la ropa durante la ventana de tiempo especificada. El cliente lo estará esperando.',
        CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.'
      },
      pt: {
        EMAIL_TITLE: 'Novo Pedido de Coleta de Lavanderia',
        EMAIL_HEADER: 'Novo Pedido de Coleta de Lavanderia',
        GREETING: `Olá ${affiliateName},`,
        NEW_ORDER_MESSAGE: 'Você tem um novo pedido de coleta de lavanderia para processar!',
        ORDER_DETAILS_TITLE: 'Detalhes do Pedido',
        ORDER_ID_LABEL: 'ID do Pedido',
        CUSTOMER_LABEL: 'Cliente',
        PHONE_LABEL: 'Telefone',
        ADDRESS_LABEL: 'Endereço',
        PICKUP_DATE_LABEL: 'Data de Coleta',
        PICKUP_TIME_LABEL: 'Hora de Coleta',
        ESTIMATED_WEIGHT_LABEL: 'Peso Estimado',
        NUMBER_OF_BAGS_LABEL: 'Número de Sacolas',
        SPECIAL_INSTRUCTIONS_LABEL: 'Instruções Especiais',
        VIEW_ORDER_BUTTON: 'Ver no Painel',
        PICKUP_REMINDER: 'Por favor, certifique-se de coletar a roupa durante a janela de tempo especificada. O cliente estará esperando por você.',
        CLOSING_MESSAGE: 'Atenciosamente,<br>A Equipe WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automatizada. Por favor, não responda a este e-mail.'
      },
      de: {
        EMAIL_TITLE: 'Neue Wäscheabhol-Bestellung',
        EMAIL_HEADER: 'Neue Wäscheabhol-Bestellung',
        GREETING: `Hallo ${affiliateName},`,
        NEW_ORDER_MESSAGE: 'Sie haben eine neue Wäscheabhol-Bestellung zu bearbeiten!',
        ORDER_DETAILS_TITLE: 'Bestelldetails',
        ORDER_ID_LABEL: 'Bestell-ID',
        CUSTOMER_LABEL: 'Kunde',
        PHONE_LABEL: 'Telefon',
        ADDRESS_LABEL: 'Adresse',
        PICKUP_DATE_LABEL: 'Abholdatum',
        PICKUP_TIME_LABEL: 'Abholzeit',
        ESTIMATED_WEIGHT_LABEL: 'Geschätztes Gewicht',
        NUMBER_OF_BAGS_LABEL: 'Anzahl der Säcke',
        SPECIAL_INSTRUCTIONS_LABEL: 'Besondere Anweisungen',
        VIEW_ORDER_BUTTON: 'Im Dashboard anzeigen',
        PICKUP_REMINDER: 'Bitte stellen Sie sicher, dass Sie die Wäsche während des angegebenen Zeitfensters abholen. Der Kunde erwartet Sie.',
        CLOSING_MESSAGE: 'Mit freundlichen Grüßen,<br>Das WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      affiliate_first_name: affiliate.firstName,
      order_id: order.orderId,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      customer_phone: customer.phone,
      customer_address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`,
      pickup_date: new Date(order.pickupDate).toLocaleDateString(),
      pickup_time: formatTimeSlot(order.pickupTime),
      estimated_weight: order.estimatedWeight ? `${order.estimatedWeight} lbs` : emailTranslations.TO_BE_DETERMINED || 'To be determined',
      number_of_bags: order.numberOfBags || 1,
      special_instructions: order.specialPickupInstructions || emailTranslations.NONE || 'None',
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'New Laundry Pickup Order',
      es: 'Nuevo Pedido de Recogida de Lavandería',
      pt: 'Novo Pedido de Coleta de Lavanderia',
      de: 'Neue Wäscheabhol-Bestellung'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      affiliate.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending new order notification email:', error);
  }
};

/**
 * Send commission notification to affiliate
 */
exports.sendAffiliateCommissionEmail = async (affiliate, order, customer) => {
  try {
    const language = affiliate.languagePreference || 'en';
    const template = await loadTemplate('affiliate-commission', language);

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Commission Earned: Order Delivered',
        EMAIL_HEADER: 'Commission Earned!',
        GREETING: `Hello ${affiliate.firstName},`,
        COMMISSION_MESSAGE: 'Great news! You\'ve earned a commission for a completed order.',
        COMMISSION_DETAILS_TITLE: 'Commission Details',
        ORDER_ID_LABEL: 'Order ID',
        CUSTOMER_LABEL: 'Customer',
        ORDER_TOTAL_LABEL: 'Order Total',
        YOUR_COMMISSION_LABEL: 'Your Commission',
        VIEW_DASHBOARD_BUTTON: 'View Dashboard',
        PAYOUT_MESSAGE: 'This commission will be included in your next payout. Keep up the great work!',
        CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.'
      },
      es: {
        EMAIL_TITLE: 'Comisión Ganada: Pedido Entregado',
        EMAIL_HEADER: '¡Comisión Ganada!',
        GREETING: `Hola ${affiliate.firstName},`,
        COMMISSION_MESSAGE: '¡Excelentes noticias! Ha ganado una comisión por un pedido completado.',
        COMMISSION_DETAILS_TITLE: 'Detalles de la Comisión',
        ORDER_ID_LABEL: 'ID del Pedido',
        CUSTOMER_LABEL: 'Cliente',
        ORDER_TOTAL_LABEL: 'Total del Pedido',
        YOUR_COMMISSION_LABEL: 'Su Comisión',
        VIEW_DASHBOARD_BUTTON: 'Ver Panel',
        PAYOUT_MESSAGE: 'Esta comisión se incluirá en su próximo pago. ¡Siga con el excelente trabajo!',
        CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.'
      },
      pt: {
        EMAIL_TITLE: 'Comissão Ganha: Pedido Entregue',
        EMAIL_HEADER: 'Comissão Ganha!',
        GREETING: `Olá ${affiliate.firstName},`,
        COMMISSION_MESSAGE: 'Ótimas notícias! Você ganhou uma comissão por um pedido concluído.',
        COMMISSION_DETAILS_TITLE: 'Detalhes da Comissão',
        ORDER_ID_LABEL: 'ID do Pedido',
        CUSTOMER_LABEL: 'Cliente',
        ORDER_TOTAL_LABEL: 'Total do Pedido',
        YOUR_COMMISSION_LABEL: 'Sua Comissão',
        VIEW_DASHBOARD_BUTTON: 'Ver Painel',
        PAYOUT_MESSAGE: 'Esta comissão será incluída em seu próximo pagamento. Continue com o ótimo trabalho!',
        CLOSING_MESSAGE: 'Atenciosamente,<br>A Equipe WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automatizada. Por favor, não responda a este e-mail.'
      },
      de: {
        EMAIL_TITLE: 'Provision verdient: Bestellung geliefert',
        EMAIL_HEADER: 'Provision verdient!',
        GREETING: `Hallo ${affiliate.firstName},`,
        COMMISSION_MESSAGE: 'Großartige Neuigkeiten! Sie haben eine Provision für eine abgeschlossene Bestellung verdient.',
        COMMISSION_DETAILS_TITLE: 'Provisionsdetails',
        ORDER_ID_LABEL: 'Bestell-ID',
        CUSTOMER_LABEL: 'Kunde',
        ORDER_TOTAL_LABEL: 'Bestellsumme',
        YOUR_COMMISSION_LABEL: 'Ihre Provision',
        VIEW_DASHBOARD_BUTTON: 'Dashboard anzeigen',
        PAYOUT_MESSAGE: 'Diese Provision wird in Ihre nächste Auszahlung aufgenommen. Machen Sie weiter so!',
        CLOSING_MESSAGE: 'Mit freundlichen Grüßen,<br>Das WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      affiliate_first_name: affiliate.firstName,
      order_id: order.orderId,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      order_total: order.actualTotal ? `$${order.actualTotal.toFixed(2)}` : 'N/A',
      commission_amount: order.affiliateCommission ? `$${order.affiliateCommission.toFixed(2)}` : 'N/A',
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Commission Earned: Order Delivered',
      es: 'Comisión Ganada: Pedido Entregado',
      pt: 'Comissão Ganha: Pedido Entregue',
      de: 'Provision verdient: Bestellung geliefert'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      affiliate.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending commission notification email:', error);
  }
};


/**
 * Send order cancellation notification to affiliate
 */
exports.sendAffiliateOrderCancellationEmail = async (affiliate, order, customer) => {
  try {
    const language = affiliate.languagePreference || 'en';
    const template = await loadTemplate('affiliate-order-cancelled', language);

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Order Cancelled',
        EMAIL_HEADER: 'Order Cancelled',
        GREETING: `Hello ${affiliate.firstName},`,
        CANCELLATION_MESSAGE: 'We wanted to inform you that an order has been cancelled.',
        CANCELLATION_DETAILS_TITLE: 'Cancellation Details',
        ORDER_ID_LABEL: 'Order ID',
        CUSTOMER_LABEL: 'Customer',
        ORIGINAL_PICKUP_DATE_LABEL: 'Original Pickup Date',
        PICKUP_TIME_LABEL: 'Pickup Time',
        CANCELLED_AT_LABEL: 'Cancelled At',
        VIEW_DASHBOARD_BUTTON: 'View Dashboard',
        DO_NOT_PROCEED_MESSAGE: 'Please do not proceed with this pickup. The customer may reschedule at a later time.',
        CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.'
      },
      es: {
        EMAIL_TITLE: 'Pedido Cancelado',
        EMAIL_HEADER: 'Pedido Cancelado',
        GREETING: `Hola ${affiliate.firstName},`,
        CANCELLATION_MESSAGE: 'Queremos informarle que un pedido ha sido cancelado.',
        CANCELLATION_DETAILS_TITLE: 'Detalles de Cancelación',
        ORDER_ID_LABEL: 'ID del Pedido',
        CUSTOMER_LABEL: 'Cliente',
        ORIGINAL_PICKUP_DATE_LABEL: 'Fecha Original de Recogida',
        PICKUP_TIME_LABEL: 'Hora de Recogida',
        CANCELLED_AT_LABEL: 'Cancelado a las',
        VIEW_DASHBOARD_BUTTON: 'Ver Panel',
        DO_NOT_PROCEED_MESSAGE: 'Por favor no proceda con esta recogida. El cliente puede reprogramar en otro momento.',
        CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.'
      },
      pt: {
        EMAIL_TITLE: 'Pedido Cancelado',
        EMAIL_HEADER: 'Pedido Cancelado',
        GREETING: `Olá ${affiliate.firstName},`,
        CANCELLATION_MESSAGE: 'Gostaríamos de informar que um pedido foi cancelado.',
        CANCELLATION_DETAILS_TITLE: 'Detalhes do Cancelamento',
        ORDER_ID_LABEL: 'ID do Pedido',
        CUSTOMER_LABEL: 'Cliente',
        ORIGINAL_PICKUP_DATE_LABEL: 'Data Original de Coleta',
        PICKUP_TIME_LABEL: 'Hora de Coleta',
        CANCELLED_AT_LABEL: 'Cancelado às',
        VIEW_DASHBOARD_BUTTON: 'Ver Painel',
        DO_NOT_PROCEED_MESSAGE: 'Por favor, não prossiga com esta coleta. O cliente pode reagendar posteriormente.',
        CLOSING_MESSAGE: 'Atenciosamente,<br>A Equipe WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automatizada. Por favor, não responda a este e-mail.'
      },
      de: {
        EMAIL_TITLE: 'Bestellung storniert',
        EMAIL_HEADER: 'Bestellung storniert',
        GREETING: `Hallo ${affiliate.firstName},`,
        CANCELLATION_MESSAGE: 'Wir möchten Sie darüber informieren, dass eine Bestellung storniert wurde.',
        CANCELLATION_DETAILS_TITLE: 'Stornierungsdetails',
        ORDER_ID_LABEL: 'Bestell-ID',
        CUSTOMER_LABEL: 'Kunde',
        ORIGINAL_PICKUP_DATE_LABEL: 'Ursprüngliches Abholdatum',
        PICKUP_TIME_LABEL: 'Abholzeit',
        CANCELLED_AT_LABEL: 'Storniert um',
        VIEW_DASHBOARD_BUTTON: 'Dashboard anzeigen',
        DO_NOT_PROCEED_MESSAGE: 'Bitte fahren Sie nicht mit dieser Abholung fort. Der Kunde kann zu einem späteren Zeitpunkt neu planen.',
        CLOSING_MESSAGE: 'Mit freundlichen Grüßen,<br>Das WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      affiliate_first_name: affiliate.firstName,
      order_id: order.orderId,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      pickup_date: new Date(order.pickupDate).toLocaleDateString(),
      pickup_time: formatTimeSlot(order.pickupTime),
      cancellation_time: new Date().toLocaleTimeString(),
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Order Cancelled',
      es: 'Pedido Cancelado',
      pt: 'Pedido Cancelado',
      de: 'Bestellung storniert'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      affiliate.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending order cancellation email:', error);
  }
};

/**
 * Send password reset email to affiliate
 */
exports.sendAffiliatePasswordResetEmail = async (affiliate, resetUrl) => {
  try {
    const template = await loadTemplate('affiliate-password-reset');

    const data = {
      first_name: affiliate.firstName,
      affiliate_id: affiliate.affiliateId,
      reset_url: resetUrl,
      expire_time: '1 hour',
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      affiliate.email,
      'Password Reset Request - WaveMAX Affiliate Portal',
      html
    );
  } catch (error) {
    console.error('Error sending affiliate password reset email:', error);
  }
};

// =============================================================================
// Customer Emails
// =============================================================================

/**
 * Send welcome email to a new customer
 */
exports.sendCustomerWelcomeEmail = async (customer, affiliate, bagInfo = {}) => {
  try {
    // Debug logging
    console.log('[sendCustomerWelcomeEmail] Customer:', customer ? { 
      email: customer.email, 
      firstName: customer.firstName, 
      customerId: customer.customerId 
    } : 'undefined');
    console.log('[sendCustomerWelcomeEmail] Affiliate:', affiliate ? { 
      affiliateId: affiliate.affiliateId, 
      businessName: affiliate.businessName 
    } : 'undefined');
    
    // Validate inputs
    if (!customer || !affiliate) {
      console.error('Missing customer or affiliate data for welcome email');
      return;
    }
    
    if (!customer.email) {
      console.error('Customer email is missing or undefined');
      return;
    }

    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('customer-welcome', language);

    // Build affiliate name with fallback
    const affiliateName = affiliate.businessName ||
      `${affiliate.firstName || ''} ${affiliate.lastName || ''}`.trim() ||
      'Your WaveMAX Partner';

    // Extract bag information with defaults
    const numberOfBags = bagInfo.numberOfBags || 0;
    const bagFee = bagInfo.bagFee || 0;
    const totalCredit = bagInfo.totalCredit || 0;
    
    // V2 registrations don't have bag credits
    const isV2Registration = totalCredit === 0;
    const isFreeRegistration = false; // V2 doesn't have free bags

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Welcome to WaveMAX Laundry Service',
        EMAIL_HEADER: 'Welcome to WaveMAX Laundry!',
        GREETING: `Hi ${customer.firstName},`,
        WELCOME_MESSAGE: 'Welcome to WaveMAX Laundry Service! Your account has been successfully created and you\'re ready to enjoy premium wash, dry, fold laundry services.',
        YOUR_INFO_TITLE: 'Your Account Information',
        CUSTOMER_ID_LABEL: 'Customer ID',
        SERVICE_PROVIDER_LABEL: 'Your Service Provider',
        BAG_INFO_TITLE: isV2Registration ? 'How Our Service Works' : (isFreeRegistration ? 'Your FREE Laundry Bag' : 'Your Laundry Bag Credit'),
        BAG_INFO_MESSAGE: isV2Registration ? 
          'Schedule your laundry pickup online. After we pick up and weigh your laundry, you\'ll receive an invoice. Pay conveniently via Venmo, PayPal, or CashApp.' :
          (isFreeRegistration ? 
            'Great news! Your first laundry bag is FREE! It will be delivered to you by your service provider.' :
            'We\'ve credited your account with prepaid laundry bags. These bags will be delivered to you by your service provider.'),
        BAG_CREDIT_TITLE: 'Account Credit Details',
        BAGS_PURCHASED_LABEL: isFreeRegistration ? 'Bags Received' : 'Bags Purchased',
        COST_PER_BAG_LABEL: 'Cost per Bag',
        TOTAL_CREDIT_LABEL: 'Total Account Credit',
        NOTE_LABEL: 'Note',
        CREDIT_NOTE_MESSAGE: isV2Registration ?
          'No upfront payment required. You\'ll pay after your laundry is picked up and weighed.' :
          (isFreeRegistration ? 
            'Your first bag was FREE! Each bag holds approximately 20-25 lbs of laundry.' :
            'This credit will be automatically applied to your first orders. Each bag holds approximately 20-25 lbs of laundry.'),
        HOW_IT_WORKS_TITLE: 'How It Works',
        STEP_1_TITLE: 'Schedule a Pickup',
        STEP_1_DESC: 'Login to your dashboard and schedule a convenient pickup time.',
        STEP_2_TITLE: 'Prepare Your Laundry',
        STEP_2_DESC: 'Place your laundry in the provided bags. Your service provider will pick them up.',
        STEP_3_TITLE: 'We Do the Rest',
        STEP_3_DESC: 'Your laundry is professionally washed, dried, and folded at our facility.',
        STEP_4_TITLE: 'Delivery to Your Door',
        STEP_4_DESC: 'Your clean, fresh laundry is delivered back to you, usually within 24-48 hours.',
        READY_TO_SCHEDULE_TITLE: 'Ready to Schedule Your First Pickup?',
        READY_TO_SCHEDULE_MESSAGE: 'Click the button below to access your dashboard and schedule your first pickup.',
        SCHEDULE_BUTTON: 'Schedule Pickup',
        CREDIT_REMINDER: 'Remember: Your account has been credited for your prepaid bags!',
        QUESTIONS_TITLE: 'Questions?',
        QUESTIONS_MESSAGE: 'Your service provider is here to help! Feel free to reach out:',
        NAME_LABEL: 'Name',
        PHONE_LABEL: 'Phone',
        EMAIL_LABEL: 'Email',
        DASHBOARD_MESSAGE: 'Access your customer dashboard anytime to manage orders and track deliveries.',
        DASHBOARD_BUTTON: 'Go to Dashboard',
        FOOTER_SUPPORT: 'If you have any questions, please contact our support team.',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_ADDRESS: '123 Main Street, Austin, TX 78701'
      },
      es: {
        EMAIL_TITLE: 'Bienvenido al Servicio de Lavandería WaveMAX',
        EMAIL_HEADER: '¡Bienvenido a WaveMAX Laundry!',
        GREETING: `Hola ${affiliate.firstName},`,
        WELCOME_MESSAGE: '¡Bienvenido al Servicio de Lavandería WaveMAX! Su cuenta ha sido creada exitosamente y está listo para disfrutar de servicios premium de lavado, secado y doblado.',
        YOUR_INFO_TITLE: 'Información de Su Cuenta',
        CUSTOMER_ID_LABEL: 'ID de Cliente',
        SERVICE_PROVIDER_LABEL: 'Su Proveedor de Servicio',
        BAG_INFO_TITLE: isFreeRegistration ? 'Su Bolsa de Lavandería GRATIS' : 'Su Crédito de Bolsas de Lavandería',
        BAG_INFO_MESSAGE: isFreeRegistration ?
          '¡Excelentes noticias! ¡Su primera bolsa de lavandería es GRATIS! Será entregada por su proveedor de servicio.' :
          'Hemos acreditado su cuenta con bolsas de lavandería prepagadas. Estas bolsas serán entregadas por su proveedor de servicio.',
        BAG_CREDIT_TITLE: 'Detalles del Crédito de Cuenta',
        BAGS_PURCHASED_LABEL: isFreeRegistration ? 'Bolsas Recibidas' : 'Bolsas Compradas',
        COST_PER_BAG_LABEL: 'Costo por Bolsa',
        TOTAL_CREDIT_LABEL: 'Crédito Total de Cuenta',
        NOTE_LABEL: 'Nota',
        CREDIT_NOTE_MESSAGE: isFreeRegistration ?
          '¡Su primera bolsa fue GRATIS! Cada bolsa contiene aproximadamente 20-25 libras de ropa.' :
          'Este crédito se aplicará automáticamente a sus primeros pedidos. Cada bolsa contiene aproximadamente 20-25 libras de ropa.',
        HOW_IT_WORKS_TITLE: 'Cómo Funciona',
        STEP_1_TITLE: 'Programe una Recogida',
        STEP_1_DESC: 'Inicie sesión en su panel y programe un horario conveniente de recogida.',
        STEP_2_TITLE: 'Prepare Su Ropa',
        STEP_2_DESC: 'Coloque su ropa en las bolsas proporcionadas. Su proveedor de servicio las recogerá.',
        STEP_3_TITLE: 'Nosotros Hacemos el Resto',
        STEP_3_DESC: 'Su ropa es lavada, secada y doblada profesionalmente en nuestras instalaciones.',
        STEP_4_TITLE: 'Entrega a Su Puerta',
        STEP_4_DESC: 'Su ropa limpia y fresca es entregada, generalmente dentro de 24-48 horas.',
        READY_TO_SCHEDULE_TITLE: '¿Listo para Programar Su Primera Recogida?',
        READY_TO_SCHEDULE_MESSAGE: 'Haga clic en el botón a continuación para acceder a su panel y programar su primera recogida.',
        SCHEDULE_BUTTON: 'Programar Recogida',
        CREDIT_REMINDER: '¡Recuerde: Su cuenta ha sido acreditada por sus bolsas prepagadas!',
        QUESTIONS_TITLE: '¿Preguntas?',
        QUESTIONS_MESSAGE: '¡Su proveedor de servicio está aquí para ayudar! No dude en contactar:',
        NAME_LABEL: 'Nombre',
        PHONE_LABEL: 'Teléfono',
        EMAIL_LABEL: 'Correo',
        DASHBOARD_MESSAGE: 'Acceda a su panel de cliente en cualquier momento para gestionar pedidos y rastrear entregas.',
        DASHBOARD_BUTTON: 'Ir al Panel',
        FOOTER_SUPPORT: 'Si tiene alguna pregunta, contacte a nuestro equipo de soporte.',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_ADDRESS: '123 Main Street, Austin, TX 78701'
      },
      pt: {
        EMAIL_TITLE: 'Bem-vindo ao Serviço de Lavanderia WaveMAX',
        EMAIL_HEADER: 'Bem-vindo ao WaveMAX Laundry!',
        GREETING: `Olá ${customer.firstName},`,
        WELCOME_MESSAGE: 'Bem-vindo ao Serviço de Lavanderia WaveMAX! Sua conta foi criada com sucesso e você está pronto para desfrutar de serviços premium de lavar, secar e dobrar roupas.',
        YOUR_INFO_TITLE: 'Informações da Sua Conta',
        CUSTOMER_ID_LABEL: 'ID do Cliente',
        SERVICE_PROVIDER_LABEL: 'Seu Provedor de Serviço',
        BAG_INFO_TITLE: isFreeRegistration ? 'Sua Sacola de Lavanderia GRÁTIS' : 'Seu Crédito de Sacolas de Lavanderia',
        BAG_INFO_MESSAGE: isFreeRegistration ?
          'Ótimas notícias! Sua primeira sacola de lavanderia é GRÁTIS! Ela será entregue pelo seu provedor de serviço.' :
          'Creditamos sua conta com sacolas de lavanderia pré-pagas. Estas sacolas serão entregues pelo seu provedor de serviço.',
        BAG_CREDIT_TITLE: 'Detalhes do Crédito da Conta',
        BAGS_PURCHASED_LABEL: isFreeRegistration ? 'Sacolas Recebidas' : 'Sacolas Compradas',
        COST_PER_BAG_LABEL: 'Custo por Sacola',
        TOTAL_CREDIT_LABEL: 'Crédito Total da Conta',
        NOTE_LABEL: 'Nota',
        CREDIT_NOTE_MESSAGE: isFreeRegistration ?
          'Sua primeira sacola foi GRÁTIS! Cada sacola comporta aproximadamente 20-25 libras de roupa.' :
          'Este crédito será aplicado automaticamente aos seus primeiros pedidos. Cada sacola comporta aproximadamente 20-25 libras de roupa.',
        HOW_IT_WORKS_TITLE: 'Como Funciona',
        STEP_1_TITLE: 'Agende uma Coleta',
        STEP_1_DESC: 'Faça login no seu painel e agende um horário conveniente para coleta.',
        STEP_2_TITLE: 'Prepare Sua Roupa',
        STEP_2_DESC: 'Coloque sua roupa nas sacolas fornecidas. Seu provedor de serviço as coletará.',
        STEP_3_TITLE: 'Nós Fazemos o Resto',
        STEP_3_DESC: 'Sua roupa é lavada, seca e dobrada profissionalmente em nossas instalações.',
        STEP_4_TITLE: 'Entrega em Sua Porta',
        STEP_4_DESC: 'Sua roupa limpa e fresca é entregue, geralmente dentro de 24-48 horas.',
        READY_TO_SCHEDULE_TITLE: 'Pronto para Agendar Sua Primeira Coleta?',
        READY_TO_SCHEDULE_MESSAGE: 'Clique no botão abaixo para acessar seu painel e agendar sua primeira coleta.',
        SCHEDULE_BUTTON: 'Agendar Coleta',
        CREDIT_REMINDER: 'Lembre-se: Sua conta foi creditada pelas suas sacolas pré-pagas!',
        QUESTIONS_TITLE: 'Dúvidas?',
        QUESTIONS_MESSAGE: 'Seu provedor de serviço está aqui para ajudar! Sinta-se à vontade para entrar em contato:',
        NAME_LABEL: 'Nome',
        PHONE_LABEL: 'Telefone',
        EMAIL_LABEL: 'E-mail',
        DASHBOARD_MESSAGE: 'Acesse seu painel de cliente a qualquer momento para gerenciar pedidos e rastrear entregas.',
        DASHBOARD_BUTTON: 'Ir para o Painel',
        FOOTER_SUPPORT: 'Se você tiver alguma dúvida, entre em contato com nossa equipe de suporte.',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_ADDRESS: '123 Main Street, Austin, TX 78701'
      },
      de: {
        EMAIL_TITLE: 'Willkommen beim WaveMAX Wäscheservice',
        EMAIL_HEADER: 'Willkommen bei WaveMAX Laundry!',
        GREETING: `Hallo ${customer.firstName},`,
        WELCOME_MESSAGE: 'Willkommen beim WaveMAX Wäscheservice! Ihr Konto wurde erfolgreich erstellt und Sie können nun Premium-Wasch-, Trocken- und Faltservice genießen.',
        YOUR_INFO_TITLE: 'Ihre Kontoinformationen',
        CUSTOMER_ID_LABEL: 'Kunden-ID',
        SERVICE_PROVIDER_LABEL: 'Ihr Dienstleister',
        BAG_INFO_TITLE: isFreeRegistration ? 'Ihr KOSTENLOSER Wäschesack' : 'Ihr Wäschesack-Guthaben',
        BAG_INFO_MESSAGE: isFreeRegistration ?
          'Großartige Neuigkeiten! Ihr erster Wäschesack ist KOSTENLOS! Er wird von Ihrem Dienstleister geliefert.' :
          'Wir haben Ihrem Konto vorausbezahlte Wäschesäcke gutgeschrieben. Diese Säcke werden von Ihrem Dienstleister geliefert.',
        BAG_CREDIT_TITLE: 'Kontoguthaben Details',
        BAGS_PURCHASED_LABEL: isFreeRegistration ? 'Erhaltene Säcke' : 'Gekaufte Säcke',
        COST_PER_BAG_LABEL: 'Kosten pro Sack',
        TOTAL_CREDIT_LABEL: 'Gesamtguthaben',
        NOTE_LABEL: 'Hinweis',
        CREDIT_NOTE_MESSAGE: isFreeRegistration ?
          'Ihr erster Sack war KOSTENLOS! Jeder Sack fasst etwa 20-25 Pfund Wäsche.' :
          'Dieses Guthaben wird automatisch auf Ihre ersten Bestellungen angewendet. Jeder Sack fasst etwa 20-25 Pfund Wäsche.',
        HOW_IT_WORKS_TITLE: 'So funktioniert es',
        STEP_1_TITLE: 'Abholung planen',
        STEP_1_DESC: 'Melden Sie sich in Ihrem Dashboard an und planen Sie eine passende Abholzeit.',
        STEP_2_TITLE: 'Wäsche vorbereiten',
        STEP_2_DESC: 'Legen Sie Ihre Wäsche in die bereitgestellten Säcke. Ihr Dienstleister holt sie ab.',
        STEP_3_TITLE: 'Wir erledigen den Rest',
        STEP_3_DESC: 'Ihre Wäsche wird professionell in unserer Einrichtung gewaschen, getrocknet und gefaltet.',
        STEP_4_TITLE: 'Lieferung an Ihre Tür',
        STEP_4_DESC: 'Ihre saubere, frische Wäsche wird geliefert, normalerweise innerhalb von 24-48 Stunden.',
        READY_TO_SCHEDULE_TITLE: 'Bereit, Ihre erste Abholung zu planen?',
        READY_TO_SCHEDULE_MESSAGE: 'Klicken Sie auf den Button unten, um auf Ihr Dashboard zuzugreifen und Ihre erste Abholung zu planen.',
        SCHEDULE_BUTTON: 'Abholung planen',
        CREDIT_REMINDER: 'Denken Sie daran: Ihrem Konto wurden Ihre vorausbezahlten Säcke gutgeschrieben!',
        QUESTIONS_TITLE: 'Fragen?',
        QUESTIONS_MESSAGE: 'Ihr Dienstleister ist hier, um zu helfen! Zögern Sie nicht, Kontakt aufzunehmen:',
        NAME_LABEL: 'Name',
        PHONE_LABEL: 'Telefon',
        EMAIL_LABEL: 'E-Mail',
        DASHBOARD_MESSAGE: 'Greifen Sie jederzeit auf Ihr Kunden-Dashboard zu, um Bestellungen zu verwalten und Lieferungen zu verfolgen.',
        DASHBOARD_BUTTON: 'Zum Dashboard',
        FOOTER_SUPPORT: 'Bei Fragen wenden Sie sich bitte an unser Support-Team.',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_ADDRESS: '123 Main Street, Austin, TX 78701'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      first_name: customer.firstName || '',
      last_name: customer.lastName || '',
      customer_id: customer.customerId || '',
      affiliate_name: affiliateName,
      affiliate_phone: affiliate.phone || 'Contact for details',
      affiliate_email: affiliate.email || 'support@wavemax.promo',
      number_of_bags: numberOfBags,
      bag_fee: bagFee.toFixed(2),
      total_credit: totalCredit.toFixed(2),
      login_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer',
      schedule_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer&pickup=true',
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Welcome to WaveMAX Laundry Service',
      es: 'Bienvenido al Servicio de Lavandería WaveMAX',
      pt: 'Bem-vindo ao Serviço de Lavanderia WaveMAX',
      de: 'Willkommen beim WaveMAX Wäscheservice'
    };
    const subject = subjects[language] || subjects.en;

    // No attachments - using linked logo in HTML
    await sendEmail(
      customer.email,
      subject,
      html
    );

    console.log('Customer welcome email sent successfully to:', customer.email);
  } catch (error) {
    console.error('Error sending customer welcome email:', error);
    throw error; // Re-throw to let the controller handle it
  }
};

/**
 * Send order confirmation email to customer
 */
exports.sendCustomerOrderConfirmationEmail = async (customer, order, affiliate) => {
  try {
    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('customer-order-confirmation', language);

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Your Laundry Pickup Confirmation',
        EMAIL_HEADER: 'Your Laundry Pickup is Confirmed!',
        GREETING: `Hello ${customer.firstName},`,
        CONFIRMATION_MESSAGE: 'Thank you for scheduling your laundry pickup with WaveMAX Laundry. Your order has been confirmed and your affiliate partner has been notified.',
        ORDER_SUMMARY_TITLE: 'Order Summary',
        ORDER_ID_LABEL: 'Order ID',
        PICKUP_DATE_LABEL: 'Pickup Date',
        PICKUP_TIME_LABEL: 'Pickup Time',
        DELIVERY_DATE_LABEL: 'Delivery Date',
        DELIVERY_TIME_LABEL: 'Delivery Time',
        ESTIMATED_TOTAL_LABEL: 'Estimated Total',
        AFFILIATE_INFO_TITLE: 'Your Affiliate Partner',
        NAME_LABEL: 'Name',
        PHONE_LABEL: 'Phone',
        EMAIL_LABEL: 'Email',
        VIEW_ORDER_BUTTON: 'Login to View Your Order',
        WHAT_HAPPENS_NEXT_TITLE: 'What happens next?',
        WHAT_HAPPENS_NEXT_LIST: '<ul><li>Your affiliate partner will arrive during your selected pickup window</li><li>Please have your laundry ready in bags</li><li>You\'ll receive updates as your order progresses</li><li>Final pricing will be based on the actual weight of your laundry</li></ul>',
        CHANGE_ORDER_MESSAGE: 'If you need to make any changes to your order, please contact your affiliate partner directly.',
        CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.'
      },
      es: {
        EMAIL_TITLE: 'Confirmación de Recogida de Lavandería',
        EMAIL_HEADER: '¡Su Recogida de Lavandería está Confirmada!',
        GREETING: `Hola ${customer.firstName},`,
        CONFIRMATION_MESSAGE: 'Gracias por programar su recogida de lavandería con WaveMAX Laundry. Su pedido ha sido confirmado y su socio afiliado ha sido notificado.',
        ORDER_SUMMARY_TITLE: 'Resumen del Pedido',
        ORDER_ID_LABEL: 'ID del Pedido',
        PICKUP_DATE_LABEL: 'Fecha de Recogida',
        PICKUP_TIME_LABEL: 'Hora de Recogida',
        DELIVERY_DATE_LABEL: 'Fecha de Entrega',
        DELIVERY_TIME_LABEL: 'Hora de Entrega',
        ESTIMATED_TOTAL_LABEL: 'Total Estimado',
        AFFILIATE_INFO_TITLE: 'Su Socio Afiliado',
        NAME_LABEL: 'Nombre',
        PHONE_LABEL: 'Teléfono',
        EMAIL_LABEL: 'Correo Electrónico',
        VIEW_ORDER_BUTTON: 'Iniciar Sesión para Ver Su Pedido',
        WHAT_HAPPENS_NEXT_TITLE: '¿Qué sucede a continuación?',
        WHAT_HAPPENS_NEXT_LIST: '<ul><li>Su socio afiliado llegará durante su ventana de recogida seleccionada</li><li>Por favor tenga su ropa lista en bolsas</li><li>Recibirá actualizaciones mientras su pedido progresa</li><li>El precio final se basará en el peso real de su ropa</li></ul>',
        CHANGE_ORDER_MESSAGE: 'Si necesita hacer cambios a su pedido, contacte directamente a su socio afiliado.',
        CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.'
      },
      pt: {
        EMAIL_TITLE: 'Confirmação de Coleta de Lavanderia',
        EMAIL_HEADER: 'Sua Coleta de Lavanderia está Confirmada!',
        GREETING: `Olá ${customer.firstName},`,
        CONFIRMATION_MESSAGE: 'Obrigado por agendar sua coleta de lavanderia com WaveMAX Laundry. Seu pedido foi confirmado e seu parceiro afiliado foi notificado.',
        ORDER_SUMMARY_TITLE: 'Resumo do Pedido',
        ORDER_ID_LABEL: 'ID do Pedido',
        PICKUP_DATE_LABEL: 'Data de Coleta',
        PICKUP_TIME_LABEL: 'Hora de Coleta',
        DELIVERY_DATE_LABEL: 'Data de Entrega',
        DELIVERY_TIME_LABEL: 'Hora de Entrega',
        ESTIMATED_TOTAL_LABEL: 'Total Estimado',
        AFFILIATE_INFO_TITLE: 'Seu Parceiro Afiliado',
        NAME_LABEL: 'Nome',
        PHONE_LABEL: 'Telefone',
        EMAIL_LABEL: 'E-mail',
        VIEW_ORDER_BUTTON: 'Faça Login para Ver Seu Pedido',
        WHAT_HAPPENS_NEXT_TITLE: 'O que acontece a seguir?',
        WHAT_HAPPENS_NEXT_LIST: '<ul><li>Seu parceiro afiliado chegará durante sua janela de coleta selecionada</li><li>Por favor, tenha sua roupa pronta em sacolas</li><li>Você receberá atualizações conforme seu pedido progride</li><li>O preço final será baseado no peso real de sua roupa</li></ul>',
        CHANGE_ORDER_MESSAGE: 'Se precisar fazer alterações em seu pedido, entre em contato diretamente com seu parceiro afiliado.',
        CLOSING_MESSAGE: 'Atenciosamente,<br>A Equipe WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automatizada. Por favor, não responda a este e-mail.'
      },
      de: {
        EMAIL_TITLE: 'Ihre Wäscheabholung Bestätigung',
        EMAIL_HEADER: 'Ihre Wäscheabholung ist bestätigt!',
        GREETING: `Hallo ${customer.firstName},`,
        CONFIRMATION_MESSAGE: 'Vielen Dank für die Terminbuchung Ihrer Wäscheabholung bei WaveMAX Laundry. Ihre Bestellung wurde bestätigt und Ihr Affiliate-Partner wurde benachrichtigt.',
        ORDER_SUMMARY_TITLE: 'Bestellübersicht',
        ORDER_ID_LABEL: 'Bestell-ID',
        PICKUP_DATE_LABEL: 'Abholdatum',
        PICKUP_TIME_LABEL: 'Abholzeit',
        DELIVERY_DATE_LABEL: 'Lieferdatum',
        DELIVERY_TIME_LABEL: 'Lieferzeit',
        ESTIMATED_TOTAL_LABEL: 'Geschätzter Gesamtbetrag',
        AFFILIATE_INFO_TITLE: 'Ihr Affiliate-Partner',
        NAME_LABEL: 'Name',
        PHONE_LABEL: 'Telefon',
        EMAIL_LABEL: 'E-Mail',
        VIEW_ORDER_BUTTON: 'Anmelden um Ihre Bestellung anzusehen',
        WHAT_HAPPENS_NEXT_TITLE: 'Was passiert als nächstes?',
        WHAT_HAPPENS_NEXT_LIST: '<ul><li>Ihr Affiliate-Partner kommt während Ihres gewählten Abholzeitfensters</li><li>Bitte haben Sie Ihre Wäsche in Säcken bereit</li><li>Sie erhalten Updates während Ihre Bestellung bearbeitet wird</li><li>Die endgültige Preisgestaltung basiert auf dem tatsächlichen Gewicht Ihrer Wäsche</li></ul>',
        CHANGE_ORDER_MESSAGE: 'Wenn Sie Änderungen an Ihrer Bestellung vornehmen müssen, kontaktieren Sie bitte direkt Ihren Affiliate-Partner.',
        CLOSING_MESSAGE: 'Mit freundlichen Grüßen,<br>Das WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      first_name: customer.firstName,
      order_id: order.orderId,
      pickup_date: new Date(order.pickupDate).toLocaleDateString(),
      pickup_time: formatTimeSlot(order.pickupTime),
      estimated_total: `$${order.estimatedTotal.toFixed(2)}`,
      affiliate_name: `${affiliate.firstName} ${affiliate.lastName}`,
      affiliate_phone: affiliate.phone,
      affiliate_email: affiliate.email,
      login_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer',
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Your Laundry Pickup Confirmation',
      es: 'Confirmación de Recogida de Lavandería',
      pt: 'Confirmação de Coleta de Lavanderia',
      de: 'Ihre Wäscheabholung Bestätigung'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      customer.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
};

/**
 * Send order status update email to customer
 */
exports.sendOrderStatusUpdateEmail = async (customer, order, status) => {
  try {
    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('customer-order-status', language);

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Order Status Update',
        EMAIL_HEADER: 'Order Status Update',
        GREETING: `Hello ${customer.firstName},`,
        UPDATE_MESSAGE: 'We have an update on your laundry order!',
        STATUS_UPDATE_TITLE: 'Status Update',
        ORDER_ID_LABEL: 'Order ID',
        STATUS_LABEL: 'Status',
        VIEW_ORDER_BUTTON: 'View Order Details',
        THANK_YOU_MESSAGE: 'Thank you for choosing WaveMAX Laundry!',
        CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.',
        STATUS_MESSAGES: {
          pending: 'Your order has been created and is awaiting acceptance',
          scheduled: 'Your order has been accepted by the affiliate',
          processing: 'Your laundry has been received and is being processed',
          processed: 'Your laundry is ready for pickup by the affiliate',
          complete: 'Your laundry has been delivered',
          ready: 'Your laundry is ready and will be delivered soon'
        },
        STATUS_TITLES: {
          pending: 'Order Pending',
          scheduled: 'Order Scheduled',
          processing: 'Laundry Processing',
          processed: 'Ready for Pickup',
          complete: 'Order Complete',
          ready: 'Ready for Delivery'
        }
      },
      es: {
        EMAIL_TITLE: 'Actualización del Estado del Pedido',
        EMAIL_HEADER: 'Actualización del Estado del Pedido',
        GREETING: `Hola ${customer.firstName},`,
        UPDATE_MESSAGE: '¡Tenemos una actualización sobre su pedido de lavandería!',
        STATUS_UPDATE_TITLE: 'Actualización de Estado',
        ORDER_ID_LABEL: 'ID del Pedido',
        STATUS_LABEL: 'Estado',
        VIEW_ORDER_BUTTON: 'Ver Detalles del Pedido',
        THANK_YOU_MESSAGE: '¡Gracias por elegir WaveMAX Laundry!',
        CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.',
        STATUS_MESSAGES: {
          pending: 'Su pedido ha sido creado y está esperando aceptación',
          scheduled: 'Su pedido ha sido aceptado por el afiliado',
          processing: 'Su ropa ha sido recibida y está siendo procesada',
          processed: 'Su ropa está lista para ser recogida por el afiliado',
          complete: 'Su ropa ha sido entregada'
        },
        STATUS_TITLES: {
          pending: 'Pedido Pendiente',
          scheduled: 'Pedido Programado',
          processing: 'Procesando Ropa',
          processed: 'Lista para Recoger',
          complete: 'Pedido Completo'
        }
      },
      pt: {
        EMAIL_TITLE: 'Atualização do Status do Pedido',
        EMAIL_HEADER: 'Atualização do Status do Pedido',
        GREETING: `Olá ${customer.firstName},`,
        UPDATE_MESSAGE: 'Temos uma atualização sobre seu pedido de lavanderia!',
        STATUS_UPDATE_TITLE: 'Atualização de Status',
        ORDER_ID_LABEL: 'ID do Pedido',
        STATUS_LABEL: 'Status',
        VIEW_ORDER_BUTTON: 'Ver Detalhes do Pedido',
        THANK_YOU_MESSAGE: 'Obrigado por escolher WaveMAX Laundry!',
        CLOSING_MESSAGE: 'Atenciosamente,<br>A Equipe WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automatizada. Por favor, não responda a este e-mail.',
        STATUS_MESSAGES: {
          pending: 'Seu pedido foi criado e está aguardando aceitação',
          scheduled: 'Seu pedido foi aceito pelo afiliado',
          processing: 'Sua roupa foi recebida e está sendo processada',
          processed: 'Sua roupa está pronta para ser recolhida pelo afiliado',
          complete: 'Sua roupa foi entregue'
        },
        STATUS_TITLES: {
          pending: 'Pedido Pendente',
          scheduled: 'Pedido Agendado',
          processing: 'Processando Roupa',
          processed: 'Pronta para Recolher',
          complete: 'Pedido Completo'
        }
      },
      de: {
        EMAIL_TITLE: 'Bestellstatus-Update',
        EMAIL_HEADER: 'Bestellstatus-Update',
        GREETING: `Hallo ${customer.firstName},`,
        UPDATE_MESSAGE: 'Wir haben ein Update zu Ihrer Wäschebestellung!',
        STATUS_UPDATE_TITLE: 'Status-Update',
        ORDER_ID_LABEL: 'Bestell-ID',
        STATUS_LABEL: 'Status',
        VIEW_ORDER_BUTTON: 'Bestelldetails anzeigen',
        THANK_YOU_MESSAGE: 'Vielen Dank, dass Sie sich für WaveMAX Laundry entschieden haben!',
        CLOSING_MESSAGE: 'Mit freundlichen Grüßen,<br>Das WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.',
        STATUS_MESSAGES: {
          pending: 'Ihre Bestellung wurde erstellt und wartet auf Annahme',
          scheduled: 'Ihre Bestellung wurde vom Partner angenommen',
          processing: 'Ihre Wäsche wurde empfangen und wird bearbeitet',
          processed: 'Ihre Wäsche ist bereit zur Abholung durch den Partner',
          complete: 'Ihre Wäsche wurde geliefert'
        },
        STATUS_TITLES: {
          pending: 'Bestellung ausstehend',
          scheduled: 'Bestellung geplant',
          processing: 'Wäsche in Bearbeitung',
          processed: 'Bereit zur Abholung',
          complete: 'Bestellung abgeschlossen'
        }
      }
    };

    const emailTranslations = translations[language] || translations.en;
    const statusMessages = emailTranslations.STATUS_MESSAGES;
    const statusTitles = emailTranslations.STATUS_TITLES;

    const data = {
      first_name: customer.firstName,
      order_id: order.orderId,
      status_message: statusMessages[status],
      weight_info: order.actualWeight ? `<div class="detail-row"><span class="detail-label">${language === 'es' ? 'Peso' : language === 'pt' ? 'Peso' : language === 'de' ? 'Gewicht' : 'Weight'}:</span> ${order.actualWeight} lbs</div>` : '',
      total_info: order.actualTotal ? `<div class="detail-row"><span class="detail-label">${language === 'es' ? 'Total Final' : language === 'pt' ? 'Total Final' : language === 'de' ? 'Endgültiger Betrag' : 'Final Total'}:</span> $${order.actualTotal.toFixed(2)}</div>` : '',
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer',
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjectPrefix = {
      en: 'Order Update',
      es: 'Actualización del Pedido',
      pt: 'Atualização do Pedido',
      de: 'Bestellaktualisierung'
    };
    const subject = `${subjectPrefix[language] || subjectPrefix.en}: ${statusTitles[status] || status.charAt(0).toUpperCase() + status.slice(1)}`;

    await sendEmail(
      customer.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending order status update email:', error);
  }
};

/**
 * Send order cancellation email to customer
 */
exports.sendOrderCancellationEmail = async (customer, order) => {
  try {
    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('customer-order-cancelled', language);

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Your Order Has Been Cancelled',
        EMAIL_HEADER: 'Order Cancelled',
        GREETING: `Hello ${customer.firstName},`,
        CANCELLATION_MESSAGE: 'Your laundry pickup order has been cancelled.',
        CANCELLATION_DETAILS_TITLE: 'Cancellation Details',
        ORDER_ID_LABEL: 'Order ID',
        ORIGINAL_PICKUP_DATE_LABEL: 'Original Pickup Date',
        CANCELLED_AT_LABEL: 'Cancelled At',
        RESCHEDULE_MESSAGE: 'If you\'d like to schedule a new pickup, you can do so at any time:',
        SCHEDULE_BUTTON: 'Schedule New Pickup',
        VIEW_DASHBOARD_LINK: 'View Your Dashboard',
        APOLOGY_MESSAGE: 'We\'re sorry for any inconvenience. If you have any questions, please contact your affiliate partner.',
        CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.'
      },
      es: {
        EMAIL_TITLE: 'Su Pedido Ha Sido Cancelado',
        EMAIL_HEADER: 'Pedido Cancelado',
        GREETING: `Hola ${customer.firstName},`,
        CANCELLATION_MESSAGE: 'Su pedido de recogida de lavandería ha sido cancelado.',
        CANCELLATION_DETAILS_TITLE: 'Detalles de Cancelación',
        ORDER_ID_LABEL: 'ID del Pedido',
        ORIGINAL_PICKUP_DATE_LABEL: 'Fecha Original de Recogida',
        CANCELLED_AT_LABEL: 'Cancelado a las',
        RESCHEDULE_MESSAGE: 'Si desea programar una nueva recogida, puede hacerlo en cualquier momento:',
        SCHEDULE_BUTTON: 'Programar Nueva Recogida',
        VIEW_DASHBOARD_LINK: 'Ver Su Panel',
        APOLOGY_MESSAGE: 'Lamentamos cualquier inconveniente. Si tiene preguntas, contacte a su socio afiliado.',
        CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.'
      },
      pt: {
        EMAIL_TITLE: 'Seu Pedido Foi Cancelado',
        EMAIL_HEADER: 'Pedido Cancelado',
        GREETING: `Olá ${customer.firstName},`,
        CANCELLATION_MESSAGE: 'Seu pedido de coleta de lavanderia foi cancelado.',
        CANCELLATION_DETAILS_TITLE: 'Detalhes do Cancelamento',
        ORDER_ID_LABEL: 'ID do Pedido',
        ORIGINAL_PICKUP_DATE_LABEL: 'Data Original de Coleta',
        CANCELLED_AT_LABEL: 'Cancelado às',
        RESCHEDULE_MESSAGE: 'Se você gostaria de agendar uma nova coleta, pode fazê-lo a qualquer momento:',
        SCHEDULE_BUTTON: 'Agendar Nova Coleta',
        VIEW_DASHBOARD_LINK: 'Ver Seu Painel',
        APOLOGY_MESSAGE: 'Pedimos desculpas por qualquer inconveniente. Se tiver dúvidas, entre em contato com seu parceiro afiliado.',
        CLOSING_MESSAGE: 'Atenciosamente,<br>A Equipe WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automatizada. Por favor, não responda a este e-mail.'
      },
      de: {
        EMAIL_TITLE: 'Ihre Bestellung wurde storniert',
        EMAIL_HEADER: 'Bestellung storniert',
        GREETING: `Hallo ${customer.firstName},`,
        CANCELLATION_MESSAGE: 'Ihre Wäscheabholung wurde storniert.',
        CANCELLATION_DETAILS_TITLE: 'Stornierungsdetails',
        ORDER_ID_LABEL: 'Bestell-ID',
        ORIGINAL_PICKUP_DATE_LABEL: 'Ursprüngliches Abholdatum',
        CANCELLED_AT_LABEL: 'Storniert um',
        RESCHEDULE_MESSAGE: 'Wenn Sie eine neue Abholung planen möchten, können Sie dies jederzeit tun:',
        SCHEDULE_BUTTON: 'Neue Abholung planen',
        VIEW_DASHBOARD_LINK: 'Ihr Dashboard anzeigen',
        APOLOGY_MESSAGE: 'Wir entschuldigen uns für etwaige Unannehmlichkeiten. Bei Fragen kontaktieren Sie bitte Ihren Affiliate-Partner.',
        CLOSING_MESSAGE: 'Mit freundlichen Grüßen,<br>Das WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      first_name: customer.firstName,
      order_id: order.orderId,
      pickup_date: new Date(order.pickupDate).toLocaleDateString(),
      cancellation_time: new Date().toLocaleTimeString(),
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer',
      schedule_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer&pickup=true',
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Your Order Has Been Cancelled',
      es: 'Su Pedido Ha Sido Cancelado',
      pt: 'Seu Pedido Foi Cancelado',
      de: 'Ihre Bestellung wurde storniert'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      customer.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending order cancellation email:', error);
  }
};

/**
 * Send password reset email to customer
 */
exports.sendCustomerPasswordResetEmail = async (customer, resetUrl) => {
  try {
    const template = await loadTemplate('customer-password-reset');

    const data = {
      first_name: customer.firstName,
      customer_id: customer.customerId,
      reset_url: resetUrl,
      expire_time: '1 hour',
      current_year: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      customer.email,
      'Password Reset Request - WaveMAX Customer Portal',
      html
    );
  } catch (error) {
    console.error('Error sending customer password reset email:', error);
  }
};

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

// =============================================================================
// Operator Emails
// =============================================================================

/**
 * Send welcome email to a new operator
 */
exports.sendOperatorWelcomeEmail = async (operator, temporaryPin) => {
  try {
    const language = operator.languagePreference || 'en';
    const template = await loadTemplate('operator-welcome', language);

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Welcome to WaveMAX Operations Team',
        EMAIL_HEADER: 'Welcome to WaveMAX Operations',
        EMAIL_SUBHEADER: 'Your Operator Account is Ready',
        GREETING: `Welcome aboard, ${operator.firstName}!`,
        WELCOME_MESSAGE: 'We\'re excited to have you join the WaveMAX operations team. Your operator account has been created and you\'re ready to start processing orders.',
        CREDENTIALS_TITLE: 'Your Login Credentials',
        EMPLOYEE_ID_LABEL: 'Employee ID',
        TEMPORARY_PIN_LABEL: 'Temporary PIN',
        EMAIL_LABEL: 'Email',
        SHIFT_HOURS_LABEL: 'Shift Hours',
        LOGIN_BUTTON: 'Login to Operator Portal',
        IMPORTANT_INFO_TITLE: 'Important Information',
        IMPORTANT_INFO_LIST: '<ul><li>Change your PIN on first login</li><li>You can only login during your assigned shift hours</li><li>Keep your PIN confidential - never share it with anyone</li><li>Clock in at the start of your shift and clock out when finished</li><li>Contact your supervisor if you have any questions</li></ul>',
        SUPPORT_MESSAGE: 'If you need assistance or have questions about your account, please contact your supervisor or the administrator.',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_SECURITY_NOTE: 'This email contains confidential login information. Please keep it secure.'
      },
      es: {
        EMAIL_TITLE: 'Bienvenido al Equipo de Operaciones WaveMAX',
        EMAIL_HEADER: 'Bienvenido a Operaciones WaveMAX',
        EMAIL_SUBHEADER: 'Su Cuenta de Operador está Lista',
        GREETING: `¡Bienvenido a bordo, ${operator.firstName}!`,
        WELCOME_MESSAGE: 'Estamos emocionados de que se una al equipo de operaciones WaveMAX. Su cuenta de operador ha sido creada y está listo para comenzar a procesar pedidos.',
        CREDENTIALS_TITLE: 'Sus Credenciales de Acceso',
        EMPLOYEE_ID_LABEL: 'ID de Empleado',
        TEMPORARY_PIN_LABEL: 'PIN Temporal',
        EMAIL_LABEL: 'Correo Electrónico',
        SHIFT_HOURS_LABEL: 'Horario de Turno',
        LOGIN_BUTTON: 'Ingresar al Portal de Operador',
        IMPORTANT_INFO_TITLE: 'Información Importante',
        IMPORTANT_INFO_LIST: '<ul><li>Cambie su PIN en el primer inicio de sesión</li><li>Solo puede iniciar sesión durante sus horas de turno asignadas</li><li>Mantenga su PIN confidencial - nunca lo comparta con nadie</li><li>Registre su entrada al inicio de su turno y su salida al finalizar</li><li>Contacte a su supervisor si tiene alguna pregunta</li></ul>',
        SUPPORT_MESSAGE: 'Si necesita asistencia o tiene preguntas sobre su cuenta, contacte a su supervisor o al administrador.',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_SECURITY_NOTE: 'Este correo contiene información de acceso confidencial. Por favor manténgala segura.'
      },
      pt: {
        EMAIL_TITLE: 'Bem-vindo à Equipe de Operações WaveMAX',
        EMAIL_HEADER: 'Bem-vindo às Operações WaveMAX',
        EMAIL_SUBHEADER: 'Sua Conta de Operador está Pronta',
        GREETING: `Bem-vindo a bordo, ${operator.firstName}!`,
        WELCOME_MESSAGE: 'Estamos animados em tê-lo na equipe de operações WaveMAX. Sua conta de operador foi criada e você está pronto para começar a processar pedidos.',
        CREDENTIALS_TITLE: 'Suas Credenciais de Login',
        EMPLOYEE_ID_LABEL: 'ID do Funcionário',
        TEMPORARY_PIN_LABEL: 'PIN Temporário',
        EMAIL_LABEL: 'E-mail',
        SHIFT_HOURS_LABEL: 'Horário do Turno',
        LOGIN_BUTTON: 'Entrar no Portal do Operador',
        IMPORTANT_INFO_TITLE: 'Informações Importantes',
        IMPORTANT_INFO_LIST: '<ul><li>Mude seu PIN no primeiro login</li><li>Você só pode fazer login durante seus horários de turno atribuídos</li><li>Mantenha seu PIN confidencial - nunca o compartilhe com ninguém</li><li>Registre entrada no início do seu turno e saída quando terminar</li><li>Entre em contato com seu supervisor se tiver alguma dúvida</li></ul>',
        SUPPORT_MESSAGE: 'Se precisar de assistência ou tiver dúvidas sobre sua conta, entre em contato com seu supervisor ou o administrador.',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_SECURITY_NOTE: 'Este e-mail contém informações de login confidenciais. Por favor, mantenha-o seguro.'
      },
      de: {
        EMAIL_TITLE: 'Willkommen beim WaveMAX Operations Team',
        EMAIL_HEADER: 'Willkommen bei WaveMAX Operations',
        EMAIL_SUBHEADER: 'Ihr Betreiberkonto ist bereit',
        GREETING: `Willkommen an Bord, ${operator.firstName}!`,
        WELCOME_MESSAGE: 'Wir freuen uns, Sie im WaveMAX Operations Team begrüßen zu dürfen. Ihr Betreiberkonto wurde erstellt und Sie können mit der Bearbeitung von Aufträgen beginnen.',
        CREDENTIALS_TITLE: 'Ihre Anmeldedaten',
        EMPLOYEE_ID_LABEL: 'Mitarbeiter-ID',
        TEMPORARY_PIN_LABEL: 'Temporäre PIN',
        EMAIL_LABEL: 'E-Mail',
        SHIFT_HOURS_LABEL: 'Schichtzeiten',
        LOGIN_BUTTON: 'Zum Betreiberportal anmelden',
        IMPORTANT_INFO_TITLE: 'Wichtige Informationen',
        IMPORTANT_INFO_LIST: '<ul><li>Ändern Sie Ihre PIN bei der ersten Anmeldung</li><li>Sie können sich nur während Ihrer zugewiesenen Schichtzeiten anmelden</li><li>Halten Sie Ihre PIN vertraulich - teilen Sie sie niemals mit anderen</li><li>Stempeln Sie zu Beginn Ihrer Schicht ein und am Ende aus</li><li>Kontaktieren Sie Ihren Vorgesetzten bei Fragen</li></ul>',
        SUPPORT_MESSAGE: 'Wenn Sie Hilfe benötigen oder Fragen zu Ihrem Konto haben, wenden Sie sich bitte an Ihren Vorgesetzten oder den Administrator.',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_SECURITY_NOTE: 'Diese E-Mail enthält vertrauliche Anmeldeinformationen. Bitte bewahren Sie sie sicher auf.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      first_name: operator.firstName,
      last_name: operator.lastName,
      employee_id: operator.operatorId || operator.employeeId,
      email: operator.email,
      temporary_pin: temporaryPin,
      shift_hours: operator.shiftStart && operator.shiftEnd ? `${operator.shiftStart} - ${operator.shiftEnd}` : 'Not specified',
      login_url: `${process.env.BASE_URL || 'https://wavemax.promo'}/embed-app-v2.html?login=operator`,
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Welcome to WaveMAX Operations Team',
      es: 'Bienvenido al Equipo de Operaciones WaveMAX',
      pt: 'Bem-vindo à Equipe de Operações WaveMAX',
      de: 'Willkommen beim WaveMAX Operations Team'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      operator.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending operator welcome email:', error);
  }
};

/**
 * Send PIN reset email to operator
 */
exports.sendOperatorPinResetEmail = async (operator, newPin) => {
  try {
    const language = operator.languagePreference || 'en';
    const template = await loadTemplate('operator-pin-reset', language);

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Your PIN Has Been Reset',
        EMAIL_HEADER: 'PIN Reset Notification',
        GREETING: `Hello ${operator.firstName},`,
        RESET_MESSAGE: 'Your PIN has been reset by an administrator. Please use the new PIN below to access your account.',
        SECURITY_ALERT_LABEL: 'Security Alert',
        SECURITY_ALERT_MESSAGE: 'If you did not request this PIN reset, please contact your supervisor immediately.',
        NEW_PIN_LABEL: 'Your New PIN',
        EMPLOYEE_ID_LABEL: 'Employee ID',
        RESET_TIME_LABEL: 'Reset Time',
        RESET_TIME: 'Just now',
        NEXT_STEPS_TITLE: 'Next Steps',
        NEXT_STEPS_LIST: '<ol><li>Login using your Employee ID and the new PIN above</li><li>You will be prompted to change your PIN on first login</li><li>Choose a PIN that is easy for you to remember but hard for others to guess</li><li>Never share your PIN with anyone</li></ol>',
        LOGIN_BUTTON: 'Login to Operator Portal',
        SUPPORT_MESSAGE: 'If you have any issues logging in or questions about this reset, please contact your supervisor.',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_SECURITY_NOTE: 'This email contains confidential login information. Please delete after use.'
      },
      es: {
        EMAIL_TITLE: 'Su PIN Ha Sido Restablecido',
        EMAIL_HEADER: 'Notificación de Restablecimiento de PIN',
        GREETING: `Hola ${operator.firstName},`,
        RESET_MESSAGE: 'Su PIN ha sido restablecido por un administrador. Por favor use el nuevo PIN a continuación para acceder a su cuenta.',
        SECURITY_ALERT_LABEL: 'Alerta de Seguridad',
        SECURITY_ALERT_MESSAGE: 'Si no solicitó este restablecimiento de PIN, contacte a su supervisor inmediatamente.',
        NEW_PIN_LABEL: 'Su Nuevo PIN',
        EMPLOYEE_ID_LABEL: 'ID de Empleado',
        RESET_TIME_LABEL: 'Hora de Restablecimiento',
        RESET_TIME: 'Ahora mismo',
        NEXT_STEPS_TITLE: 'Próximos Pasos',
        NEXT_STEPS_LIST: '<ol><li>Inicie sesión usando su ID de Empleado y el nuevo PIN anterior</li><li>Se le pedirá que cambie su PIN en el primer inicio de sesión</li><li>Elija un PIN que sea fácil de recordar pero difícil de adivinar para otros</li><li>Nunca comparta su PIN con nadie</li></ol>',
        LOGIN_BUTTON: 'Ingresar al Portal de Operador',
        SUPPORT_MESSAGE: 'Si tiene problemas para iniciar sesión o preguntas sobre este restablecimiento, contacte a su supervisor.',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_SECURITY_NOTE: 'Este correo contiene información de acceso confidencial. Por favor elimínelo después de usarlo.'
      },
      pt: {
        EMAIL_TITLE: 'Seu PIN Foi Redefinido',
        EMAIL_HEADER: 'Notificação de Redefinição de PIN',
        GREETING: `Olá ${operator.firstName},`,
        RESET_MESSAGE: 'Seu PIN foi redefinido por um administrador. Por favor, use o novo PIN abaixo para acessar sua conta.',
        SECURITY_ALERT_LABEL: 'Alerta de Segurança',
        SECURITY_ALERT_MESSAGE: 'Se você não solicitou esta redefinição de PIN, entre em contato com seu supervisor imediatamente.',
        NEW_PIN_LABEL: 'Seu Novo PIN',
        EMPLOYEE_ID_LABEL: 'ID do Funcionário',
        RESET_TIME_LABEL: 'Hora da Redefinição',
        RESET_TIME: 'Agora mesmo',
        NEXT_STEPS_TITLE: 'Próximos Passos',
        NEXT_STEPS_LIST: '<ol><li>Faça login usando seu ID de Funcionário e o novo PIN acima</li><li>Você será solicitado a alterar seu PIN no primeiro login</li><li>Escolha um PIN que seja fácil de lembrar mas difícil para outros adivinharem</li><li>Nunca compartilhe seu PIN com ninguém</li></ol>',
        LOGIN_BUTTON: 'Entrar no Portal do Operador',
        SUPPORT_MESSAGE: 'Se tiver problemas para fazer login ou dúvidas sobre esta redefinição, entre em contato com seu supervisor.',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_SECURITY_NOTE: 'Este e-mail contém informações de login confidenciais. Por favor, exclua após o uso.'
      },
      de: {
        EMAIL_TITLE: 'Ihre PIN wurde zurückgesetzt',
        EMAIL_HEADER: 'PIN-Zurücksetzung Benachrichtigung',
        GREETING: `Hallo ${operator.firstName},`,
        RESET_MESSAGE: 'Ihre PIN wurde von einem Administrator zurückgesetzt. Bitte verwenden Sie die unten stehende neue PIN, um auf Ihr Konto zuzugreifen.',
        SECURITY_ALERT_LABEL: 'Sicherheitswarnung',
        SECURITY_ALERT_MESSAGE: 'Wenn Sie diese PIN-Zurücksetzung nicht angefordert haben, kontaktieren Sie bitte sofort Ihren Vorgesetzten.',
        NEW_PIN_LABEL: 'Ihre neue PIN',
        EMPLOYEE_ID_LABEL: 'Mitarbeiter-ID',
        RESET_TIME_LABEL: 'Zurücksetzungszeit',
        RESET_TIME: 'Gerade eben',
        NEXT_STEPS_TITLE: 'Nächste Schritte',
        NEXT_STEPS_LIST: '<ol><li>Melden Sie sich mit Ihrer Mitarbeiter-ID und der neuen PIN oben an</li><li>Sie werden beim ersten Login aufgefordert, Ihre PIN zu ändern</li><li>Wählen Sie eine PIN, die für Sie leicht zu merken, aber für andere schwer zu erraten ist</li><li>Teilen Sie Ihre PIN niemals mit anderen</li></ol>',
        LOGIN_BUTTON: 'Zum Betreiberportal anmelden',
        SUPPORT_MESSAGE: 'Wenn Sie Probleme beim Anmelden haben oder Fragen zu dieser Zurücksetzung haben, kontaktieren Sie bitte Ihren Vorgesetzten.',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_SECURITY_NOTE: 'Diese E-Mail enthält vertrauliche Anmeldeinformationen. Bitte nach Gebrauch löschen.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      first_name: operator.firstName,
      employee_id: operator.employeeId,
      new_pin: newPin,
      login_url: `${process.env.BASE_URL || 'https://wavemax.promo'}/embed-app-v2.html?login=operator`,
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Your PIN Has Been Reset',
      es: 'Su PIN Ha Sido Restablecido',
      pt: 'Seu PIN Foi Redefinido',
      de: 'Ihre PIN wurde zurückgesetzt'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      operator.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending operator PIN reset email:', error);
  }
};

/**
 * Send shift reminder email to operator
 */
exports.sendOperatorShiftReminderEmail = async (operator) => {
  try {
    const language = operator.languagePreference || 'en';
    const template = await loadTemplate('operator-shift-reminder', language);

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Shift Reminder - Starting Soon',
        EMAIL_HEADER: 'Shift Reminder',
        GREETING: `Hi ${operator.firstName},`,
        REMINDER_MESSAGE: 'This is a friendly reminder that your shift is starting soon!',
        SHIFT_STARTS_LABEL: 'Your shift starts at',
        SHIFT_ENDS_LABEL: 'and ends at',
        EMPLOYEE_ID_LABEL: 'Employee ID',
        DATE_LABEL: 'Date',
        TODAY: 'Today',
        EXPECTED_DURATION_LABEL: 'Expected Duration',
        EXPECTED_DURATION: '8 hours',
        REMEMBER_TO_TITLE: 'Remember to',
        REMEMBER_TO_LIST: '<ul><li>Arrive a few minutes early to prepare</li><li>Clock in when you arrive</li><li>Check the order queue for priority items</li><li>Follow all safety protocols</li><li>Clock out at the end of your shift</li></ul>',
        LOGIN_BUTTON: 'Login to Operator Portal',
        CLOSING_MESSAGE: 'Have a great shift! If you cannot make your shift, please contact your supervisor as soon as possible.',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated shift reminder.'
      },
      es: {
        EMAIL_TITLE: 'Recordatorio de Turno - Comienza Pronto',
        EMAIL_HEADER: 'Recordatorio de Turno',
        GREETING: `Hola ${operator.firstName},`,
        REMINDER_MESSAGE: '¡Este es un recordatorio amistoso de que su turno comienza pronto!',
        SHIFT_STARTS_LABEL: 'Su turno comienza a las',
        SHIFT_ENDS_LABEL: 'y termina a las',
        EMPLOYEE_ID_LABEL: 'ID de Empleado',
        DATE_LABEL: 'Fecha',
        TODAY: 'Hoy',
        EXPECTED_DURATION_LABEL: 'Duración Esperada',
        EXPECTED_DURATION: '8 horas',
        REMEMBER_TO_TITLE: 'Recuerde',
        REMEMBER_TO_LIST: '<ul><li>Llegue unos minutos antes para prepararse</li><li>Registre su entrada cuando llegue</li><li>Revise la cola de pedidos para artículos prioritarios</li><li>Siga todos los protocolos de seguridad</li><li>Registre su salida al final de su turno</li></ul>',
        LOGIN_BUTTON: 'Ingresar al Portal de Operador',
        CLOSING_MESSAGE: '¡Que tenga un excelente turno! Si no puede asistir a su turno, contacte a su supervisor lo antes posible.',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un recordatorio de turno automatizado.'
      },
      pt: {
        EMAIL_TITLE: 'Lembrete de Turno - Começando em Breve',
        EMAIL_HEADER: 'Lembrete de Turno',
        GREETING: `Oi ${operator.firstName},`,
        REMINDER_MESSAGE: 'Este é um lembrete amigável de que seu turno está começando em breve!',
        SHIFT_STARTS_LABEL: 'Seu turno começa às',
        SHIFT_ENDS_LABEL: 'e termina às',
        EMPLOYEE_ID_LABEL: 'ID do Funcionário',
        DATE_LABEL: 'Data',
        TODAY: 'Hoje',
        EXPECTED_DURATION_LABEL: 'Duração Esperada',
        EXPECTED_DURATION: '8 horas',
        REMEMBER_TO_TITLE: 'Lembre-se de',
        REMEMBER_TO_LIST: '<ul><li>Chegar alguns minutos antes para se preparar</li><li>Registrar entrada quando chegar</li><li>Verificar a fila de pedidos para itens prioritários</li><li>Seguir todos os protocolos de segurança</li><li>Registrar saída no final do turno</li></ul>',
        LOGIN_BUTTON: 'Entrar no Portal do Operador',
        CLOSING_MESSAGE: 'Tenha um ótimo turno! Se não puder comparecer ao seu turno, entre em contato com seu supervisor o mais rápido possível.',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este é um lembrete de turno automatizado.'
      },
      de: {
        EMAIL_TITLE: 'Schichterinnerung - Beginnt bald',
        EMAIL_HEADER: 'Schichterinnerung',
        GREETING: `Hallo ${operator.firstName},`,
        REMINDER_MESSAGE: 'Dies ist eine freundliche Erinnerung, dass Ihre Schicht bald beginnt!',
        SHIFT_STARTS_LABEL: 'Ihre Schicht beginnt um',
        SHIFT_ENDS_LABEL: 'und endet um',
        EMPLOYEE_ID_LABEL: 'Mitarbeiter-ID',
        DATE_LABEL: 'Datum',
        TODAY: 'Heute',
        EXPECTED_DURATION_LABEL: 'Erwartete Dauer',
        EXPECTED_DURATION: '8 Stunden',
        REMEMBER_TO_TITLE: 'Denken Sie daran',
        REMEMBER_TO_LIST: '<ul><li>Kommen Sie ein paar Minuten früher zur Vorbereitung</li><li>Stempeln Sie ein, wenn Sie ankommen</li><li>Überprüfen Sie die Auftragswarteschlange auf Prioritätsartikel</li><li>Befolgen Sie alle Sicherheitsprotokolle</li><li>Stempeln Sie am Ende Ihrer Schicht aus</li></ul>',
        LOGIN_BUTTON: 'Zum Betreiberportal anmelden',
        CLOSING_MESSAGE: 'Haben Sie eine großartige Schicht! Wenn Sie Ihre Schicht nicht antreten können, kontaktieren Sie bitte so schnell wie möglich Ihren Vorgesetzten.',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatisierte Schichterinnerung.'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    const data = {
      first_name: operator.firstName,
      employee_id: operator.employeeId,
      shift_start: operator.shiftStart,
      shift_end: operator.shiftEnd,
      login_url: `${process.env.BASE_URL || 'https://wavemax.promo'}/embed-app-v2.html?login=operator`,
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: 'Shift Reminder - Starting Soon',
      es: 'Recordatorio de Turno - Comienza Pronto',
      pt: 'Lembrete de Turno - Começando em Breve',
      de: 'Schichterinnerung - Beginnt bald'
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      operator.email,
      subject,
      html
    );
  } catch (error) {
    console.error('Error sending operator shift reminder email:', error);
  }
};

/**
 * Note: sendOperatorPasswordResetEmail is not needed since operators use PINs
 */
exports.sendOperatorPasswordResetEmail = async (operator, resetUrl) => {
  // Operators don't have passwords, they use PINs
  // This method is here for interface compatibility but should not be called
  console.error('Operators use PINs, not passwords. Use sendOperatorPinResetEmail instead.');
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format time slot for display in emails
 */
const formatTimeSlot = (timeSlot) => {
  switch (timeSlot) {
  case 'morning':
    return 'Morning (8am - 12pm)';
  case 'afternoon':
    return 'Afternoon (12pm - 5pm)';
  case 'evening':
    return 'Evening (5pm - 8pm)';
  default:
    return timeSlot;
  }
};

/**
 * Format size for display in emails
 */
const formatSize = (size) => {
  // Return non-string values as-is
  if (typeof size !== 'string') {
    return size;
  }
  
  switch (size) {
  case 'small':
    return 'Small (10-15 lbs)';
  case 'medium':
    return 'Medium (16-30 lbs)';
  case 'large':
    return 'Large (31+ lbs)';
  default:
    return size;
  }
};

/**
 * Send service down alert email
 */
exports.sendServiceDownAlert = async function({ serviceName, error, timestamp, serviceData }) {
  const mailOptions = {
    from: `"WaveMAX Monitoring" <${process.env.EMAIL_FROM || 'no-reply@wavemax.promo'}>`,
    to: process.env.ALERT_EMAIL || process.env.DEFAULT_ADMIN_EMAIL || 'admin@wavemax.com',
    subject: `⚠️ CRITICAL: ${serviceName} Service Down - ${new Date().toISOString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Service Down Alert</h2>
        </div>
        <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 0 0 8px 8px; padding: 20px;">
          <h3 style="color: #dc3545;">Critical Service Failure Detected</h3>
          
          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Service:</strong> ${serviceName}</p>
            <p style="margin: 5px 0 0;"><strong>Status:</strong> DOWN</p>
            <p style="margin: 5px 0 0;"><strong>Error:</strong> ${error || 'Connection timeout'}</p>
            <p style="margin: 5px 0 0;"><strong>Time:</strong> ${timestamp.toLocaleString()}</p>
          </div>
          
          <h4>Service Statistics:</h4>
          <ul style="list-style: none; padding: 0;">
            <li>• <strong>Last Success:</strong> ${serviceData.lastSuccess ? new Date(serviceData.lastSuccess).toLocaleString() : 'Never'}</li>
            <li>• <strong>Total Checks:</strong> ${serviceData.totalChecks}</li>
            <li>• <strong>Failed Checks:</strong> ${serviceData.failedChecks}</li>
            <li>• <strong>Availability:</strong> ${((serviceData.uptime / serviceData.totalChecks) * 100).toFixed(2)}%</li>
          </ul>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Action Required:</strong></p>
            <p style="margin: 5px 0 0;">This critical service requires immediate attention. Please investigate and resolve the issue as soon as possible.</p>
          </div>
          
          <p style="margin-top: 20px;">
            <a href="https://wavemax.promo/monitoring-dashboard.html" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Monitoring Dashboard</a>
          </p>
        </div>
      </div>
    `,
    text: `
CRITICAL SERVICE DOWN ALERT

Service: ${serviceName}
Status: DOWN
Error: ${error || 'Connection timeout'}
Time: ${timestamp.toLocaleString()}

Service Statistics:
- Last Success: ${serviceData.lastSuccess ? new Date(serviceData.lastSuccess).toLocaleString() : 'Never'}
- Total Checks: ${serviceData.totalChecks}
- Failed Checks: ${serviceData.failedChecks}
- Availability: ${((serviceData.uptime / serviceData.totalChecks) * 100).toFixed(2)}%

ACTION REQUIRED: This critical service requires immediate attention.

View monitoring dashboard: https://wavemax.promo/monitoring-dashboard.html
    `
  };

  // Use the internal sendEmail function
  return sendEmail(mailOptions.to, mailOptions.subject, mailOptions.html);
};

// Send order ready for pickup notification to affiliate
exports.sendOrderReadyNotification = async (affiliateEmail, data) => {
  const subject = `Order ${data.orderId} Ready for Pickup`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2ecc71; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Order Ready for Pickup!</h2>
      </div>
      
      <div style="padding: 20px; background-color: #f8f9fa;">
        <p>Hello ${data.affiliateName},</p>
        
        <p>Great news! The following order has been processed and is ready for pickup:</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Order Details</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Customer:</strong> ${data.customerName}</p>
          <p><strong>Number of Bags:</strong> ${data.numberOfBags}</p>
          <p><strong>Total Weight:</strong> ${data.totalWeight} lbs</p>
        </div>
        
        <div style="background-color: #e8f8f5; border-left: 4px solid #2ecc71; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Please pick up this order at your earliest convenience.</strong></p>
        </div>
        
        <p>Thank you for your prompt service!</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px; text-align: center;">
          This is an automated notification from WaveMAX Laundry Services.<br>
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  `;

  return sendEmail(affiliateEmail, subject, html);
};

// Send order picked up notification to customer
exports.sendOrderPickedUpNotification = async (customerEmail, data) => {
  const subject = `Your Fresh Laundry is On Its Way - Order ${data.orderId}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #3498db; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Your Fresh Laundry is On Its Way! 🚚</h2>
      </div>
      
      <div style="padding: 20px; background-color: #f8f9fa;">
        <p>Hello ${data.customerName},</p>
        
        <p><strong>Great news!</strong> Your freshly cleaned laundry has been picked up from our facility and is now on its way to you.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Delivery Details</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Number of Bags:</strong> ${data.numberOfBags}</p>
          ${data.totalWeight ? `<p><strong>Total Weight:</strong> ${data.totalWeight} lbs</p>` : ''}
          <p><strong>Delivery Provider:</strong> ${data.affiliateName}</p>
          ${data.businessName ? `<p><strong>Business:</strong> ${data.businessName}</p>` : ''}
        </div>
        
        <div style="background-color: #e8f5ff; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>${data.affiliateName}</strong> is on the way with your freshly cleaned laundry! Please be available to receive your order.</p>
        </div>
        
        <p>Thank you for choosing WaveMAX Laundry Services!</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="color: #666; font-size: 12px; text-align: center;">
          This is an automated notification from WaveMAX Laundry Services.<br>
          If you have any questions, please contact your laundry service provider.
        </p>
      </div>
    </div>
  `;

  return sendEmail(customerEmail, subject, html);
};

// ============================================
// V2 Payment System Email Methods
// ============================================

/**
 * Send V2 payment request email after laundry is weighed
 */
exports.sendV2PaymentRequest = async ({ customer, order, paymentAmount, paymentLinks, qrCodes }) => {
  try {
    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('v2/payment-request', language);
    
    // If template doesn't exist, load from v2 folder
    let finalTemplate = template;
    if (template.includes('[EMAIL_CONTENT]')) {
      const v2TemplatePath = path.join(__dirname, '../templates/v2/payment-request.html');
      finalTemplate = await readFile(v2TemplatePath, 'utf8');
    }
    
    // Calculate breakdown amounts
    const wdfAmount = order.actualWeight * (order.baseRate || 1.25);
    const addOnsAmount = order.addOnTotal || 0;
    const deliveryFee = order.feeBreakdown?.totalFee || 0;
    const totalAmount = paymentAmount || order.v2PaymentAmount || (wdfAmount + addOnsAmount + deliveryFee);
    
    // Replace template variables (using {{}} syntax for V2 templates)
    const emailData = {
      customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
      orderId: order.orderId,
      shortOrderId: order.orderId.replace('ORD', ''),
      amount: totalAmount.toFixed(2),
      actualWeight: order.actualWeight,
      numberOfBags: order.numberOfBags,
      pickupDate: new Date(order.pickupDate).toLocaleDateString(),
      // Breakdown amounts
      wdfAmount: wdfAmount.toFixed(2),
      wdfRate: (order.baseRate || 1.25).toFixed(2),
      addOnsAmount: addOnsAmount.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      hasAddOns: addOnsAmount > 0,
      hasDeliveryFee: deliveryFee > 0,
      // Payment links and QR codes
      dashboardLink: `https://wavemax.promo/embed-app-v2.html?route=/customer-dashboard&affid=${order.affiliateId}`,
      customerLoginLink: `https://wavemax.promo/embed-app-v2.html?route=/customer-login&affid=${order.affiliateId}`,
      venmoLink: paymentLinks.venmo,
      paypalLink: paymentLinks.paypal,
      cashappLink: paymentLinks.cashapp,
      venmoQR: qrCodes.venmo,
      paypalQR: qrCodes.paypal,
      cashappQR: qrCodes.cashapp
    };
    
    // Handle conditional sections first
    let html = finalTemplate;
    
    // Remove or keep add-ons section based on hasAddOns
    if (!emailData.hasAddOns) {
      html = html.replace(/{{#if hasAddOns}}[\s\S]*?{{\/if}}/g, '');
    } else {
      html = html.replace(/{{#if hasAddOns}}/g, '').replace(/{{\/if}}/g, '');
    }
    
    // Remove or keep delivery fee section based on hasDeliveryFee
    if (!emailData.hasDeliveryFee) {
      html = html.replace(/{{#if hasDeliveryFee}}[\s\S]*?{{\/if}}/g, '');
    } else {
      html = html.replace(/{{#if hasDeliveryFee}}/g, '').replace(/{{\/if}}/g, '');
    }
    
    // Replace both {{}} and [] style placeholders
    Object.keys(emailData).forEach(key => {
      const regex = new RegExp(`{{${key}}}|\\[${key}\\]`, 'g');
      html = html.replace(regex, emailData[key]);
    });
    
    const subject = `Payment Request - Order #${emailData.shortOrderId} - $${emailData.amount}`;
    
    await sendEmail(customer.email, subject, html);
    console.log(`V2 payment request sent to ${customer.email} for order ${order.orderId}`);
    return true;
  } catch (error) {
    console.error('Error sending V2 payment request email:', error);
    throw error;
  }
};

/**
 * Send V2 payment reminder email
 */
exports.sendV2PaymentReminder = async ({ customer, order, reminderNumber, paymentAmount, paymentLinks, qrCodes }) => {
  try {
    const language = customer.languagePreference || 'en';
    
    // Load V2 reminder template
    const v2TemplatePath = path.join(__dirname, '../templates/v2/payment-reminder.html');
    let template = await readFile(v2TemplatePath, 'utf8');
    
    // Calculate breakdown amounts (same as payment request)
    const wdfAmount = order.actualWeight * (order.baseRate || 1.25);
    const addOnsAmount = order.addOnTotal || 0;
    const deliveryFee = order.feeBreakdown?.totalFee || 0;
    const totalAmount = paymentAmount || order.v2PaymentAmount || order.actualTotal || (wdfAmount + addOnsAmount + deliveryFee);
    
    const emailData = {
      customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
      orderId: order.orderId,
      shortOrderId: order.orderId.replace('ORD', ''),
      amount: totalAmount.toFixed(2),
      actualWeight: order.actualWeight,
      // Breakdown amounts
      wdfAmount: wdfAmount.toFixed(2),
      wdfRate: (order.baseRate || 1.25).toFixed(2),
      addOnsAmount: addOnsAmount.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      hasAddOns: addOnsAmount > 0,
      hasDeliveryFee: deliveryFee > 0,
      // Reminder specific
      reminderNumber: reminderNumber || 1,
      paymentRequestedTime: new Date(order.v2PaymentRequestedAt).toLocaleString(),
      dashboardLink: `https://wavemax.promo/embed-app-v2.html?route=/customer-dashboard&affid=${order.affiliateId}`,
      customerLoginLink: `https://wavemax.promo/embed-app-v2.html?route=/customer-login&affid=${order.affiliateId}`,
      venmoLink: paymentLinks?.venmo || order.v2PaymentLinks?.venmo || '#',
      paypalLink: paymentLinks?.paypal || order.v2PaymentLinks?.paypal || '#',
      cashappLink: paymentLinks?.cashapp || order.v2PaymentLinks?.cashapp || '#',
      venmoQR: qrCodes?.venmo || order.v2PaymentQRCodes?.venmo || '',
      paypalQR: qrCodes?.paypal || order.v2PaymentQRCodes?.paypal || '',
      cashappQR: qrCodes?.cashapp || order.v2PaymentQRCodes?.cashapp || '',
      isUrgent: reminderNumber >= 2,
      maxReminders: 3
    };
    
    // Handle conditional sections for urgency
    if (emailData.isUrgent) {
      template = template.replace(/{{#if isUrgent}}(.*?){{\/if}}/gs, '$1');
      template = template.replace(/{{#if isUrgent}}(.*?){{else}}(.*?){{\/if}}/gs, '$1');
    } else {
      template = template.replace(/{{#if isUrgent}}(.*?){{\/if}}/gs, '');
      template = template.replace(/{{#if isUrgent}}(.*?){{else}}(.*?){{\/if}}/gs, '$2');
    }
    
    // Handle conditional sections for add-ons and delivery fee (same as payment request)
    let html = template;
    
    // Remove or keep add-ons section based on hasAddOns
    if (!emailData.hasAddOns) {
      html = html.replace(/{{#if hasAddOns}}[\s\S]*?{{\/if}}/g, '');
    } else {
      html = html.replace(/{{#if hasAddOns}}/g, '').replace(/{{\/if}}/g, '');
    }
    
    // Remove or keep delivery fee section based on hasDeliveryFee
    if (!emailData.hasDeliveryFee) {
      html = html.replace(/{{#if hasDeliveryFee}}[\s\S]*?{{\/if}}/g, '');
    } else {
      html = html.replace(/{{#if hasDeliveryFee}}/g, '').replace(/{{\/if}}/g, '');
    }
    
    // Replace template variables
    Object.keys(emailData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, emailData[key]);
    });
    
    const urgencyPrefix = emailData.isUrgent ? 'URGENT: ' : '';
    const subject = `${urgencyPrefix}Payment Reminder - Order #${emailData.shortOrderId} - $${emailData.amount}`;
    
    await sendEmail(customer.email, subject, html);
    console.log(`V2 payment reminder sent to ${customer.email} for order ${order.orderId}`);
    return true;
  } catch (error) {
    console.error('Error sending V2 payment reminder email:', error);
    throw error;
  }
};

/**
 * Send V2 payment verified email
 */
exports.sendV2PaymentVerified = async (order, customer, paymentData) => {
  try {
    const language = customer.languagePreference || 'en';
    
    // Load V2 verified template
    const v2TemplatePath = path.join(__dirname, '../templates/v2/payment-verified.html');
    let template = await readFile(v2TemplatePath, 'utf8');
    
    const emailData = {
      customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
      orderId: order.orderId,
      shortOrderId: order._id.toString().slice(-8).toUpperCase(),
      amount: (order.v2PaymentAmount || order.actualTotal).toFixed(2),
      actualWeight: order.actualWeight,
      numberOfBags: order.numberOfBags,
      paymentMethod: order.v2PaymentMethod,
      transactionId: order.v2PaymentTransactionId || 'N/A',
      verifiedTime: new Date(order.v2PaymentVerifiedAt).toLocaleString(),
      isProcessing: order.status === 'processing',
      subtotal: ((order.actualWeight || order.estimatedWeight) * (order.baseRate || 1.25)).toFixed(2),
      addOnsTotal: order.addOnTotal ? order.addOnTotal.toFixed(2) : null
    };
    
    // Handle conditional sections
    template = template.replace(/{{#if isProcessing}}(.*?){{else}}(.*?){{\/if}}/gs, 
      emailData.isProcessing ? '$1' : '$2');
    template = template.replace(/{{#if isProcessing}}(.*?){{\/if}}/gs, 
      emailData.isProcessing ? '$1' : '');
    template = template.replace(/{{#if addOnsTotal}}(.*?){{\/if}}/gs, 
      emailData.addOnsTotal ? '$1' : '');
    
    // Replace template variables
    let html = template;
    Object.keys(emailData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, emailData[key] || '');
    });
    
    const subject = `Payment Verified - Order #${emailData.shortOrderId}`;
    
    await sendEmail(customer.email, subject, html);
    console.log(`V2 payment verification sent to ${customer.email} for order ${order.orderId}`);
    return true;
  } catch (error) {
    console.error('Error sending V2 payment verified email:', error);
    throw error;
  }
};

/**
 * Send V2 payment timeout escalation to admin
 */
exports.sendV2PaymentTimeoutEscalation = async (order, adminEmail, escalationDetails) => {
  try {
    const subject = `ESCALATION: Payment Timeout - Order #${escalationDetails.orderMongoId}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); color: white; padding: 20px; text-align: center;">
          <h1>Payment Timeout Escalation</h1>
          <p>Immediate attention required</p>
        </div>
        <div style="padding: 20px; background: white;">
          <div style="background: #fee2e2; border: 2px solid #fca5a5; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
            <strong>⚠️ URGENT: Payment has not been received after ${escalationDetails.hoursSinceRequest} hours</strong>
          </div>
          
          <h3>Order Details:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Order ID:</strong></td><td>${escalationDetails.orderId}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Customer:</strong></td><td>${escalationDetails.customerName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td>${escalationDetails.customerEmail}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td>${escalationDetails.customerPhone}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount Due:</strong></td><td>$${escalationDetails.paymentAmount}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Payment Requested:</strong></td><td>${new Date(escalationDetails.paymentRequestedAt).toLocaleString()}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Check Attempts:</strong></td><td>${escalationDetails.attemptsMade}</td></tr>
          </table>
          
          <h3>Affiliate Details:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Name:</strong></td><td>${escalationDetails.affiliateName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td>${escalationDetails.affiliateEmail}</td></tr>
          </table>
          
          <div style="background: #fef2e8; padding: 15px; margin-top: 20px; border-radius: 8px;">
            <strong>Recommended Actions:</strong>
            <ul>
              <li>Contact customer directly at ${escalationDetails.customerPhone}</li>
              <li>Check payment provider accounts for pending transactions</li>
              <li>Consider manual payment verification if customer confirms payment</li>
              <li>Coordinate with affiliate regarding order status</li>
            </ul>
          </div>
        </div>
      </div>
    `;
    
    await sendEmail(adminEmail, subject, html);
    console.log(`Payment timeout escalation sent to ${adminEmail} for order ${escalationDetails.orderId}`);
    return true;
  } catch (error) {
    console.error('Error sending payment timeout escalation:', error);
    throw error;
  }
};

/**
 * Send V2 pickup ready notification (only after payment verified)
 */
exports.sendV2PickupReadyNotification = async (order, customer, affiliate) => {
  try {
    const subject = `Your Clean Laundry is Ready! - Order #${order.orderId}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 20px; text-align: center;">
          <h1>Your Laundry is Ready!</h1>
          <p>Payment verified - Ready for delivery</p>
        </div>
        <div style="padding: 20px; background: white;">
          <p>Hi ${customer.name || customer.firstName},</p>
          
          <p>Great news! Your clean laundry is ready and will be delivered to you soon.</p>
          
          <div style="background: #f0fdf4; border: 2px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 8px;">
            <strong>✅ Payment Verified</strong><br>
            <strong>✅ Laundry Processed</strong><br>
            <strong>✅ Ready for Delivery</strong>
          </div>
          
          <h3>Order Details:</h3>
          <ul>
            <li>Order ID: #${order.orderId}</li>
            <li>Number of Bags: ${order.numberOfBags}</li>
            <li>Total Weight: ${order.actualWeight} lbs</li>
            <li>Amount Paid: $${(order.v2PaymentAmount || order.actualTotal).toFixed(2)}</li>
          </ul>
          
          <p>Your affiliate ${affiliate.firstName} ${affiliate.lastName} will deliver your clean laundry to your address soon.</p>
          
          <p>Thank you for using WaveMAX Laundry!</p>
        </div>
      </div>
    `;
    
    await sendEmail(customer.email, subject, html);
    console.log(`V2 pickup ready notification sent to ${customer.email} for order ${order.orderId}`);
    
    // Also notify the affiliate
    const affiliateSubject = `Order Ready for Delivery - #${order.orderId}`;
    const affiliateHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
          <h1>Order Ready for Delivery</h1>
        </div>
        <div style="padding: 20px; background: white;">
          <p>Hi ${affiliate.firstName},</p>
          
          <p>Order #${order.orderId} has been processed and payment has been verified. It's ready for delivery to the customer.</p>
          
          <h3>Delivery Details:</h3>
          <ul>
            <li>Customer: ${customer.name || `${customer.firstName} ${customer.lastName}`}</li>
            <li>Phone: ${customer.phone}</li>
            <li>Address: ${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}</li>
            <li>Number of Bags: ${order.numberOfBags}</li>
          </ul>
          
          <p>Please deliver the clean laundry at your earliest convenience.</p>
        </div>
      </div>
    `;
    
    await sendEmail(affiliate.email, affiliateSubject, affiliateHtml);
    
    return true;
  } catch (error) {
    console.error('Error sending V2 pickup ready notification:', error);
    throw error;
  }
};

/**
 * Send notification to admin
 * @param {Object} options - Email options
 * @param {String} options.subject - Email subject
 * @param {String} options.html - HTML content
 * @param {String} options.priority - Email priority (high, normal, low)
 * @returns {Promise<Boolean>}
 */
exports.sendAdminNotification = async function(options) {
  try {
    const { subject, html, priority = 'normal' } = options;
    
    // Get admin email from SystemConfig or use default
    const SystemConfig = require('../models/SystemConfig');
    let adminEmail = await SystemConfig.getValue('admin_notification_email', null);
    
    if (!adminEmail) {
      // Fallback to environment variable or default
      adminEmail = process.env.ADMIN_EMAIL || 'admin@wavemaxlaundry.com';
    }
    
    // Add priority header if high priority
    const headers = priority === 'high' ? {
      'X-Priority': '1',
      'Importance': 'high'
    } : {};
    
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            h3 { color: #34495e; margin-top: 20px; }
            ul { background: #f4f4f4; padding: 15px; border-radius: 5px; }
            li { margin: 5px 0; }
            .alert { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .error { background: #f8d7da; border: 1px solid #dc3545; }
            hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;
    
    await sendEmail(adminEmail, subject, fullHtml, headers);
    
    console.log(`Admin notification sent: ${subject}`);
    return true;
  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw error;
  }
};

/**
 * Send beta request notification to admin
 */
exports.sendBetaRequestNotification = async (betaRequest) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@wavemax.com';
    
    const subject = 'New Affiliate Beta Request Received';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px; }
          .info-box { background: #f8f9fa; padding: 15px; border-left: 4px solid #1e3a8a; margin: 20px 0; }
          .field { margin: 10px 0; }
          .label { font-weight: bold; color: #666; }
          .value { color: #333; margin-left: 10px; }
          .message-box { background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .button { display: inline-block; background: #1e3a8a; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Beta Request</h1>
          </div>
          <div class="content">
            <p>A new affiliate has requested to join the beta program:</p>
            
            <div class="info-box">
              <h3>Contact Information</h3>
              <div class="field">
                <span class="label">Name:</span>
                <span class="value">${betaRequest.firstName} ${betaRequest.lastName}</span>
              </div>
              <div class="field">
                <span class="label">Email:</span>
                <span class="value">${betaRequest.email}</span>
              </div>
              <div class="field">
                <span class="label">Phone:</span>
                <span class="value">${betaRequest.phone}</span>
              </div>
              ${betaRequest.businessName ? `
              <div class="field">
                <span class="label">Business Name:</span>
                <span class="value">${betaRequest.businessName}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="info-box">
              <h3>Address</h3>
              <div class="field">
                <span class="value">${betaRequest.address}<br>
                ${betaRequest.city}, ${betaRequest.state} ${betaRequest.zipCode}</span>
              </div>
            </div>
            
            ${betaRequest.message ? `
            <div class="message-box">
              <h3>Their Message</h3>
              <p>${betaRequest.message}</p>
            </div>
            ` : ''}
            
            <p>Submitted on: ${new Date(betaRequest.createdAt).toLocaleString()}</p>
            
            <center>
              <a href="https://wavemax.promo/embed-app-v2.html?route=/administrator-dashboard&section=beta-requests" class="button">
                View in Admin Dashboard
              </a>
            </center>
          </div>
          <div class="footer">
            <p>This is an automated notification from the WaveMAX Affiliate Program</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(adminEmail, subject, html);
    console.log('Beta request notification sent to admin:', adminEmail);
  } catch (error) {
    console.error('Error sending beta request notification:', error);
    // Don't throw - we don't want to fail the request if email fails
  }
};

/**
 * Send beta invitation email
 */
exports.sendBetaInvitationEmail = async (betaRequest, registrationUrl) => {
  try {
    const subject = 'Welcome to WaveMAX Affiliate Beta Program!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #1e3a8a; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 16px; }
          .highlight { background: #f0f7ff; padding: 20px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 You're Approved for Beta!</h1>
          </div>
          <div class="content">
            <p>Dear ${betaRequest.firstName},</p>
            
            <p>Congratulations! You've been selected to join the WaveMAX Affiliate Beta Program. We're excited to have you as one of our founding partners.</p>
            
            <div class="highlight">
              <h3>What's Next?</h3>
              <p>Click the button below to complete your affiliate registration. This exclusive link is just for you and will expire in 7 days.</p>
              
              <center>
                <a href="${registrationUrl}" class="button">Complete Your Registration</a>
              </center>
            </div>
            
            <h3>Beta Program Benefits:</h3>
            <ul>
              <li>Be among the first affiliates in your area</li>
              <li>10% commission on all customer orders</li>
              <li>Set your own delivery fees</li>
              <li>Full dashboard access to track earnings</li>
              <li>Direct support from our team</li>
            </ul>
            
            <p>If you have any questions, feel free to reply to this email. We're here to help you succeed!</p>
            
            <p>Welcome to the team!</p>
            
            <p>Best regards,<br>
            The WaveMAX Team</p>
          </div>
          <div class="footer">
            <p>This invitation link is unique to you. Please do not share it with others.</p>
            <p>&copy; ${new Date().getFullYear()} WaveMAX Laundry. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(betaRequest.email, subject, html);
    console.log('Beta invitation sent to:', betaRequest.email);
  } catch (error) {
    console.error('Error sending beta invitation:', error);
    throw error;
  }
};

/**
 * Send welcome email to beta request
 */
exports.sendBetaWelcomeEmail = async (betaRequest) => {
  try {
    const registrationUrl = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?route=/affiliate-register';
    const subject = 'Welcome to WaveMAX Affiliate Program Beta!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; text-align: center; padding: 30px 20px; border-radius: 10px 10px 0 0; }
          .logo { max-width: 200px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .highlight { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://www.wavemaxlaundry.com/assets/WaveMax/images/logo-wavemax.png" alt="WaveMAX Laundry" class="logo">
            <h1>Welcome to Our Beta Program!</h1>
          </div>
          <div class="content">
            <p>Dear ${betaRequest.firstName},</p>
            
            <p>Thank you for your interest in becoming a WaveMAX affiliate! We're excited to welcome you to our exclusive beta program.</p>
            
            <div class="highlight">
              <h3>Ready to Get Started?</h3>
              <p>Click the button below to complete your affiliate registration and start earning:</p>
              
              <center>
                <a href="${registrationUrl}" class="button">Complete Registration</a>
              </center>
            </div>
            
            <h3>What You Can Expect:</h3>
            <ul>
              <li><strong>10% Commission</strong> on all customer orders</li>
              <li><strong>Set Your Own Delivery Fees</strong> to maximize earnings</li>
              <li><strong>Real-time Dashboard</strong> to track your performance</li>
              <li><strong>Direct Support</strong> from our team</li>
              <li><strong>No Hidden Fees</strong> - keep what you earn</li>
            </ul>
            
            <p>If you have any questions during registration or need assistance, please don't hesitate to reach out to us.</p>
            
            <p>We look forward to having you as part of the WaveMAX family!</p>
            
            <p>Best regards,<br>
            The WaveMAX Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} WaveMAX Laundry. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Don't use attachments as they're blocked by the mail server policy
    await sendEmail(betaRequest.email, subject, html);
    console.log('Beta welcome email sent to:', betaRequest.email);
  } catch (error) {
    console.error('Error sending beta welcome email:', error);
    throw error;
  }
};

/**
 * Send reminder email to beta request user who hasn't registered
 */
exports.sendBetaReminderEmail = async (betaRequest) => {
  try {
    const registrationUrl = 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?route=/affiliate-register';
    const subject = 'Don\'t Miss Out - Your WaveMAX Affiliate Opportunity Awaits!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; text-align: center; padding: 30px 20px; border-radius: 10px 10px 0 0; }
          .logo { max-width: 200px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 14px 35px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .highlight { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
          .benefit-box { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .check-mark { color: #10b981; font-weight: bold; }
          .calc-box { background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://www.wavemaxlaundry.com/assets/WaveMax/images/logo-wavemax.png" alt="WaveMAX Laundry" class="logo">
            <h1>Your Business Opportunity Awaits!</h1>
          </div>
          <div class="content">
            <p>Hi ${betaRequest.firstName},</p>
            
            <p>Don't let this incredible opportunity pass you by!</p>
            
            <div class="benefit-box">
              <strong>🚀 Start Your Business Today - Zero Barriers!</strong><br>
              ✓ NO upfront costs | ✓ NO subscription fees | ✓ NO premium charges
            </div>
            
            <p><strong>Build YOUR Business:</strong> Unlike gig economy apps, the fees go directly to YOU!</p>
            
            <div class="highlight" style="padding: 10px;">
              <strong>Your Markets:</strong> Hotels • Apartments • Senior Centers • Individuals
            </div>
            
            <div class="calc-box">
              <strong style="color: #2e7d32;">📊 Your Path to $5,000/Month:</strong><br><br>
              <strong>Per Customer Weekly:</strong><br>
              • 30 lbs @ $1.25/lb = $37.50<br>
              • Your commission (10%) = $3.75<br>
              • Your delivery fee = $20.00<br>
              <strong style="color: #2e7d32;">= $23.75 weekly per customer</strong><br><br>
              <strong style="color: #e65100;">Just 49 weekly customers = $5,000/month!</strong><br>
              <span style="font-size: 0.9em;">• One apartment complex: 20+ customers<br>
              • One senior center: 15+ customers</span>
            </div>
            
            <strong>WaveMAX Provides:</strong>
            • Professional laundry processing<br>
            • Real-time tracking tools<br>
            • 10% commission + 100% of delivery fees<br>
            • Full training and support<br><br>
            
            <center>
              <a href="${registrationUrl}" class="button">Complete Registration Now →</a>
            </center>
            
            <p style="text-align: center; color: #6b7280;">
              <em>Don't let someone else claim your territory!</em>
            </p>
            
            <p>Best regards,<br>
            The WaveMAX Team</p>
            
            <p style="font-size: 13px; color: #6b7280;">
              P.S. - No financial risk. WaveMAX provides everything you need to be successful.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} WaveMAX Laundry. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(betaRequest.email, subject, html);
    console.log('Beta reminder email sent to:', betaRequest.email);
  } catch (error) {
    console.error('Error sending beta reminder email:', error);
    throw error;
  }
};

// Export the sendEmail function for direct use
exports.sendEmail = sendEmail;

// Export helper functions
exports.formatSize = formatSize;

module.exports = exports;