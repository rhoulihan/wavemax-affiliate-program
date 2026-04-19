// Affiliate-facing email dispatchers.
// Extracted from utils/emailService.js in Phase 2.

const { loadTemplate, fillTemplate } = require('../template-manager');
const { sendEmail } = require('../transport');
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
        W9_STEP_1: 'Once your annual earnings cross $600, commission payouts are placed on hold',
        W9_STEP_2: 'Submit a completed W-9 form to our admin team by email or secure upload',
        W9_STEP_3: 'An administrator will verify your W-9 and re-enable commission payouts',
        W9_STEP_4: 'Responding promptly keeps your commissions flowing without interruption',
        W9_IRS_NOTE: 'Note: Commission payouts pause automatically at the $600 annual earnings threshold until your W-9 is on file.',
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
        W9_STEP_1: 'Cuando sus ganancias anuales superen los $600, los pagos de comisiones se pausarán',
        W9_STEP_2: 'Envíe un formulario W-9 completo a nuestro equipo de administración por correo electrónico o carga segura',
        W9_STEP_3: 'Un administrador verificará su W-9 y reactivará los pagos de comisiones',
        W9_STEP_4: 'Responder rápidamente mantiene sus comisiones fluyendo sin interrupciones',
        W9_IRS_NOTE: 'Nota: Los pagos de comisiones se pausan automáticamente al alcanzar el umbral de ganancias anuales de $600 hasta que su W-9 esté archivado.',
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
        W9_STEP_1: 'Quando seus ganhos anuais ultrapassarem $600, os pagamentos de comissão são pausados',
        W9_STEP_2: 'Envie um formulário W-9 completo à nossa equipe de administração por e-mail ou upload seguro',
        W9_STEP_3: 'Um administrador verificará seu W-9 e reativará os pagamentos de comissão',
        W9_STEP_4: 'Responder rapidamente mantém suas comissões fluindo sem interrupções',
        W9_IRS_NOTE: 'Nota: Os pagamentos de comissão são pausados automaticamente ao atingir o limite de ganhos anuais de $600 até que seu W-9 esteja arquivado.',
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
        W9_STEP_1: 'Sobald Ihre jährlichen Einnahmen $600 überschreiten, werden Provisionszahlungen pausiert',
        W9_STEP_2: 'Senden Sie ein ausgefülltes W-9-Formular per E-Mail oder sicherem Upload an unser Administrationsteam',
        W9_STEP_3: 'Ein Administrator prüft Ihr W-9 und aktiviert die Provisionszahlungen wieder',
        W9_STEP_4: 'Eine prompte Antwort hält Ihre Provisionen ohne Unterbrechung in Bewegung',
        W9_IRS_NOTE: 'Hinweis: Provisionszahlungen werden automatisch pausiert, sobald die jährliche Einnahmenschwelle von $600 erreicht wird, bis Ihr W-9 vorliegt.',
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
 * Send urgent pickup notification to affiliate for immediate pickup orders
 */
exports.sendAffiliateUrgentPickupEmail = async (affiliate, customer, order) => {
  try {
    const language = affiliate.languagePreference || 'en';
    const template = await loadTemplate('affiliate-urgent-pickup', language);

    // Build the greeting with fallback
    const affiliateName = affiliate.firstName || affiliate.businessName || 'Partner';

    // Format the pickup deadline nicely
    const deadline = new Date(order.pickupDeadline);
    const deadlineFormatted = deadline.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Check if this is customer's first order
    const isFirstOrder = !customer.totalOrders || customer.totalOrders === 0;

    // Build Google Maps URL
    const address = `${customer.address}, ${customer.city}, ${customer.state} ${customer.zipCode}`;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'URGENT: Immediate Pickup Request',
        EMAIL_HEADER: 'Immediate Pickup Request',
        URGENT_BANNER_TEXT: 'URGENT - SAME-DAY PICKUP REQUIRED',
        PICKUP_BY_LABEL: 'Pick up by:',
        GREETING: `Hello ${affiliateName},`,
        URGENT_MESSAGE: 'A customer has requested an immediate pickup. Please pick up this order as soon as possible!',
        ORDER_DETAILS_TITLE: 'Pickup Details',
        ORDER_ID_LABEL: 'Order ID',
        CUSTOMER_LABEL: 'Customer',
        PHONE_LABEL: 'Phone',
        ADDRESS_LABEL: 'Pickup Address',
        PICKUP_DATE_LABEL: 'Pickup Date',
        PICKUP_TIME_LABEL: 'Time Window',
        ESTIMATED_WEIGHT_LABEL: 'Estimated Weight',
        NUMBER_OF_BAGS_LABEL: 'Number of Bags',
        SPECIAL_INSTRUCTIONS_LABEL: 'Special Instructions',
        VIEW_ORDER_BUTTON: 'View in Dashboard',
        OPEN_MAPS_BUTTON: 'Open in Google Maps',
        URGENT_REMINDER: 'This is a time-sensitive pickup request. Please ensure you arrive before the deadline shown above.',
        FIRST_ORDER_NOTE: 'First Order Note: Customer will have laundry in tall kitchen bags. Please deliver WaveMAX laundry bags with the clean laundry.',
        CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.',
        NONE: 'None'
      },
      es: {
        EMAIL_TITLE: 'URGENTE: Solicitud de Recogida Inmediata',
        EMAIL_HEADER: 'Solicitud de Recogida Inmediata',
        URGENT_BANNER_TEXT: 'URGENTE - RECOGIDA EL MISMO DIA REQUERIDA',
        PICKUP_BY_LABEL: 'Recoger antes de:',
        GREETING: `Hola ${affiliateName},`,
        URGENT_MESSAGE: 'Un cliente ha solicitado una recogida inmediata. Por favor recoja este pedido lo antes posible!',
        ORDER_DETAILS_TITLE: 'Detalles de Recogida',
        ORDER_ID_LABEL: 'ID del Pedido',
        CUSTOMER_LABEL: 'Cliente',
        PHONE_LABEL: 'Telefono',
        ADDRESS_LABEL: 'Direccion de Recogida',
        PICKUP_DATE_LABEL: 'Fecha de Recogida',
        PICKUP_TIME_LABEL: 'Ventana de Tiempo',
        ESTIMATED_WEIGHT_LABEL: 'Peso Estimado',
        NUMBER_OF_BAGS_LABEL: 'Numero de Bolsas',
        SPECIAL_INSTRUCTIONS_LABEL: 'Instrucciones Especiales',
        VIEW_ORDER_BUTTON: 'Ver en el Panel',
        OPEN_MAPS_BUTTON: 'Abrir en Google Maps',
        URGENT_REMINDER: 'Esta es una solicitud de recogida urgente. Por favor asegurese de llegar antes de la fecha limite mostrada arriba.',
        FIRST_ORDER_NOTE: 'Nota de Primer Pedido: El cliente tendra la ropa en bolsas de cocina. Por favor entregue bolsas de lavanderia WaveMAX con la ropa limpia.',
        CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.',
        NONE: 'Ninguna'
      },
      pt: {
        EMAIL_TITLE: 'URGENTE: Solicitacao de Coleta Imediata',
        EMAIL_HEADER: 'Solicitacao de Coleta Imediata',
        URGENT_BANNER_TEXT: 'URGENTE - COLETA NO MESMO DIA NECESSARIA',
        PICKUP_BY_LABEL: 'Coletar ate:',
        GREETING: `Ola ${affiliateName},`,
        URGENT_MESSAGE: 'Um cliente solicitou uma coleta imediata. Por favor colete este pedido o mais rapido possivel!',
        ORDER_DETAILS_TITLE: 'Detalhes da Coleta',
        ORDER_ID_LABEL: 'ID do Pedido',
        CUSTOMER_LABEL: 'Cliente',
        PHONE_LABEL: 'Telefone',
        ADDRESS_LABEL: 'Endereco de Coleta',
        PICKUP_DATE_LABEL: 'Data de Coleta',
        PICKUP_TIME_LABEL: 'Janela de Tempo',
        ESTIMATED_WEIGHT_LABEL: 'Peso Estimado',
        NUMBER_OF_BAGS_LABEL: 'Numero de Sacolas',
        SPECIAL_INSTRUCTIONS_LABEL: 'Instrucoes Especiais',
        VIEW_ORDER_BUTTON: 'Ver no Painel',
        OPEN_MAPS_BUTTON: 'Abrir no Google Maps',
        URGENT_REMINDER: 'Esta e uma solicitacao de coleta urgente. Por favor, certifique-se de chegar antes do prazo mostrado acima.',
        FIRST_ORDER_NOTE: 'Nota de Primeiro Pedido: O cliente tera a roupa em sacos de cozinha. Por favor entregue sacolas de lavanderia WaveMAX com a roupa limpa.',
        CLOSING_MESSAGE: 'Atenciosamente,<br>A Equipe WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta e uma mensagem automatizada. Por favor, nao responda a este e-mail.',
        NONE: 'Nenhuma'
      },
      de: {
        EMAIL_TITLE: 'DRINGEND: Sofortige Abholanfrage',
        EMAIL_HEADER: 'Sofortige Abholanfrage',
        URGENT_BANNER_TEXT: 'DRINGEND - ABHOLUNG AM SELBEN TAG ERFORDERLICH',
        PICKUP_BY_LABEL: 'Abholen bis:',
        GREETING: `Hallo ${affiliateName},`,
        URGENT_MESSAGE: 'Ein Kunde hat eine sofortige Abholung angefordert. Bitte holen Sie diese Bestellung so schnell wie moglich ab!',
        ORDER_DETAILS_TITLE: 'Abholdetails',
        ORDER_ID_LABEL: 'Bestell-ID',
        CUSTOMER_LABEL: 'Kunde',
        PHONE_LABEL: 'Telefon',
        ADDRESS_LABEL: 'Abholadresse',
        PICKUP_DATE_LABEL: 'Abholdatum',
        PICKUP_TIME_LABEL: 'Zeitfenster',
        ESTIMATED_WEIGHT_LABEL: 'Geschatztes Gewicht',
        NUMBER_OF_BAGS_LABEL: 'Anzahl der Sacke',
        SPECIAL_INSTRUCTIONS_LABEL: 'Besondere Anweisungen',
        VIEW_ORDER_BUTTON: 'Im Dashboard anzeigen',
        OPEN_MAPS_BUTTON: 'In Google Maps offnen',
        URGENT_REMINDER: 'Dies ist eine zeitkritische Abholanfrage. Bitte stellen Sie sicher, dass Sie vor der oben angezeigten Frist ankommen.',
        FIRST_ORDER_NOTE: 'Erstbestellungs-Hinweis: Der Kunde hat die Wasche in Kuchenbeuteln. Bitte liefern Sie WaveMAX Waschesacke mit der sauberen Wasche.',
        CLOSING_MESSAGE: 'Mit freundlichen Grussen,<br>Das WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.',
        NONE: 'Keine'
      }
    };

    const emailTranslations = translations[language] || translations.en;

    // Build first order note HTML if applicable
    const firstOrderNoteHtml = isFirstOrder
      ? `<div class="first-order-note"><strong>${emailTranslations.FIRST_ORDER_NOTE}</strong></div>`
      : '';

    const data = {
      affiliate_first_name: affiliate.firstName,
      order_id: order.orderId,
      customer_name: `${customer.firstName} ${customer.lastName}`,
      customer_phone: customer.phone,
      customer_phone_raw: customer.phone.replace(/[^0-9+]/g, ''),
      customer_address: address,
      maps_url: mapsUrl,
      pickup_date: new Date(order.pickupDate).toLocaleDateString(),
      pickup_time: formatTimeSlot(order.pickupTime),
      pickup_deadline: deadlineFormatted,
      estimated_weight: order.estimatedWeight ? `${order.estimatedWeight} lbs` : emailTranslations.NONE,
      number_of_bags: order.numberOfBags || 1,
      special_instructions: order.specialPickupInstructions || emailTranslations.NONE,
      first_order_note_html: firstOrderNoteHtml,
      dashboard_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=affiliate',
      current_year: new Date().getFullYear(),
      ...emailTranslations
    };

    const html = fillTemplate(template, data);

    // Translate subject based on language
    const subjects = {
      en: `URGENT: Immediate Pickup Request - ${customer.firstName} ${customer.lastName}`,
      es: `URGENTE: Solicitud de Recogida Inmediata - ${customer.firstName} ${customer.lastName}`,
      pt: `URGENTE: Solicitacao de Coleta Imediata - ${customer.firstName} ${customer.lastName}`,
      de: `DRINGEND: Sofortige Abholanfrage - ${customer.firstName} ${customer.lastName}`
    };
    const subject = subjects[language] || subjects.en;

    await sendEmail(
      affiliate.email,
      subject,
      html
    );

    console.log(`Urgent pickup email sent to affiliate ${affiliate.affiliateId} for order ${order.orderId}`);
  } catch (error) {
    console.error('Error sending urgent pickup notification email:', error);
    throw error; // Re-throw to let caller handle
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

module.exports = exports;
