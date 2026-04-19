const logger = require('../../../utils/logger');
// Customer-facing email dispatchers.
// Extracted from utils/emailService.js in Phase 2.

const { loadTemplate, fillTemplate } = require('../template-manager');
const { sendEmail } = require('../transport');
// =============================================================================
// Customer Emails
// =============================================================================

/**
 * Send welcome email to a new customer
 */
exports.sendCustomerWelcomeEmail = async (customer, affiliate, bagInfo = {}) => {
  try {
    // Debug logging
    logger.info('[sendCustomerWelcomeEmail] Customer:', customer ? { 
      email: customer.email, 
      firstName: customer.firstName, 
      customerId: customer.customerId 
    } : 'undefined');
    logger.info('[sendCustomerWelcomeEmail] Affiliate:', affiliate ? { 
      affiliateId: affiliate.affiliateId, 
      businessName: affiliate.businessName 
    } : 'undefined');
    
    // Validate inputs
    if (!customer || !affiliate) {
      logger.error('Missing customer or affiliate data for welcome email');
      return;
    }
    
    if (!customer.email) {
      logger.error('Customer email is missing or undefined');
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

    // Post-weigh workflow: always true. V1-era "upfront bag credit" and "free first bag"
    // code paths below are dead and will be collapsed when emailService.js is split in
    // Phase 2 step 4. Left readable for now so the diff stays reviewable.
    const isV2Registration = true;
    const isFreeRegistration = false;

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
        BAG_INFO_TITLE: isV2Registration ? 'How Our Service Works' : (isFreeRegistration ? 'Your FREE Laundry Bag' : 'Your Laundry Bags'),
        BAG_INFO_MESSAGE: isV2Registration ?
          'Schedule your laundry pickup online. After we pick up and weigh your laundry, you\'ll receive an invoice. Pay conveniently via credit card, Venmo, PayPal, or CashApp.' :
          (isFreeRegistration ?
            'Great news! Your first laundry bag is FREE! It will be delivered to you by your service provider.' :
            'Your laundry bags are ready! Your service provider will bring them when you place your first order.'),
        BAG_CREDIT_TITLE: 'Account Credit Details',
        BAGS_PURCHASED_LABEL: isFreeRegistration ? 'Bags Received' : 'Bags Purchased',
        COST_PER_BAG_LABEL: 'Cost per Bag',
        TOTAL_CREDIT_LABEL: 'Total Account Credit',
        NOTE_LABEL: 'Note',
        CREDIT_NOTE_MESSAGE: isV2Registration ?
          'No upfront payment required. You\'ll pay after your laundry is picked up and weighed.' :
          (isFreeRegistration ?
            'Your first bag was FREE! Each bag holds approximately 20-25 lbs of laundry.' :
            'Your service provider will deliver your bags when you schedule your first pickup. Each bag holds approximately 20-25 lbs of laundry.'),
        HOW_IT_WORKS_TITLE: 'How It Works',
        STEP_1_TITLE: 'Schedule a Pickup',
        STEP_1_DESC: 'Login to your dashboard and schedule a convenient pickup time.',
        STEP_2_TITLE: 'Prepare Your Laundry',
        STEP_2_DESC: 'Your requested laundry bags will be provided with your first order.',
        STEP_3_TITLE: 'We Do the Rest',
        STEP_3_DESC: 'Your laundry is professionally washed, dried, and folded at our facility.',
        STEP_4_TITLE: 'Delivery to Your Door',
        STEP_4_DESC: 'Your clean, fresh laundry is delivered back to you, usually within 24-48 hours.',
        READY_TO_SCHEDULE_TITLE: 'Ready to Schedule Your First Pickup?',
        READY_TO_SCHEDULE_MESSAGE: 'Click the button below to access your dashboard and schedule your first pickup.',
        SCHEDULE_BUTTON: 'Schedule Pickup',
        CREDIT_REMINDER: 'Remember: Your bags will be delivered with your first pickup!',
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
        BAG_INFO_TITLE: isV2Registration ? 'Cómo Funciona Nuestro Servicio' : (isFreeRegistration ? 'Su Bolsa de Lavandería GRATIS' : 'Sus Bolsas de Lavandería'),
        BAG_INFO_MESSAGE: isV2Registration ?
          'Programe la recogida de su ropa en línea. Después de recoger y pesar su ropa, recibirá una factura. Pague cómodamente con tarjeta de crédito, Venmo, PayPal o CashApp.' :
          (isFreeRegistration ?
            '¡Excelentes noticias! ¡Su primera bolsa de lavandería es GRATIS! Será entregada por su proveedor de servicio.' :
            '¡Sus bolsas de lavandería están listas! Su proveedor de servicio las traerá cuando haga su primer pedido.'),
        BAG_CREDIT_TITLE: 'Detalles del Crédito de Cuenta',
        BAGS_PURCHASED_LABEL: isFreeRegistration ? 'Bolsas Recibidas' : 'Bolsas Compradas',
        COST_PER_BAG_LABEL: 'Costo por Bolsa',
        TOTAL_CREDIT_LABEL: 'Crédito Total de Cuenta',
        NOTE_LABEL: 'Nota',
        CREDIT_NOTE_MESSAGE: isV2Registration ?
          'No se requiere pago por adelantado. Pagará después de que su ropa sea recogida y pesada.' :
          (isFreeRegistration ?
            '¡Su primera bolsa fue GRATIS! Cada bolsa contiene aproximadamente 20-25 libras de ropa.' :
            'Su proveedor de servicio entregará sus bolsas cuando programe su primera recogida. Cada bolsa contiene aproximadamente 20-25 libras de ropa.'),
        HOW_IT_WORKS_TITLE: 'Cómo Funciona',
        STEP_1_TITLE: 'Programe una Recogida',
        STEP_1_DESC: 'Inicie sesión en su panel y programe un horario conveniente de recogida.',
        STEP_2_TITLE: 'Prepare Su Ropa',
        STEP_2_DESC: 'Sus bolsas de lavandería solicitadas se proporcionarán con su primer pedido.',
        STEP_3_TITLE: 'Nosotros Hacemos el Resto',
        STEP_3_DESC: 'Su ropa es lavada, secada y doblada profesionalmente en nuestras instalaciones.',
        STEP_4_TITLE: 'Entrega a Su Puerta',
        STEP_4_DESC: 'Su ropa limpia y fresca es entregada, generalmente dentro de 24-48 horas.',
        READY_TO_SCHEDULE_TITLE: '¿Listo para Programar Su Primera Recogida?',
        READY_TO_SCHEDULE_MESSAGE: 'Haga clic en el botón a continuación para acceder a su panel y programar su primera recogida.',
        SCHEDULE_BUTTON: 'Programar Recogida',
        CREDIT_REMINDER: '¡Recuerde: Sus bolsas serán entregadas con su primera recogida!',
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
        BAG_INFO_TITLE: isV2Registration ? 'Como Funciona Nosso Serviço' : (isFreeRegistration ? 'Sua Sacola de Lavanderia GRÁTIS' : 'Suas Sacolas de Lavanderia'),
        BAG_INFO_MESSAGE: isV2Registration ?
          'Agende a coleta de suas roupas online. Depois de coletarmos e pesarmos suas roupas, você receberá uma fatura. Pague convenientemente via cartão de crédito, Venmo, PayPal ou CashApp.' :
          (isFreeRegistration ?
            'Ótimas notícias! Sua primeira sacola de lavanderia é GRÁTIS! Ela será entregue pelo seu provedor de serviço.' :
            'Suas sacolas de lavanderia estão prontas! Seu provedor de serviço as trará quando você fizer seu primeiro pedido.'),
        BAG_CREDIT_TITLE: 'Detalhes do Crédito da Conta',
        BAGS_PURCHASED_LABEL: isFreeRegistration ? 'Sacolas Recebidas' : 'Sacolas Compradas',
        COST_PER_BAG_LABEL: 'Custo por Sacola',
        TOTAL_CREDIT_LABEL: 'Crédito Total da Conta',
        NOTE_LABEL: 'Nota',
        CREDIT_NOTE_MESSAGE: isV2Registration ?
          'Não é necessário pagamento antecipado. Você pagará depois que suas roupas forem coletadas e pesadas.' :
          (isFreeRegistration ?
            'Sua primeira sacola foi GRÁTIS! Cada sacola comporta aproximadamente 20-25 libras de roupa.' :
            'Seu provedor de serviço entregará suas sacolas quando você agendar sua primeira coleta. Cada sacola comporta aproximadamente 20-25 libras de roupa.'),
        HOW_IT_WORKS_TITLE: 'Como Funciona',
        STEP_1_TITLE: 'Agende uma Coleta',
        STEP_1_DESC: 'Faça login no seu painel e agende um horário conveniente para coleta.',
        STEP_2_TITLE: 'Prepare Sua Roupa',
        STEP_2_DESC: 'Suas sacolas de lavanderia solicitadas serão fornecidas com seu primeiro pedido.',
        STEP_3_TITLE: 'Nós Fazemos o Resto',
        STEP_3_DESC: 'Sua roupa é lavada, seca e dobrada profissionalmente em nossas instalações.',
        STEP_4_TITLE: 'Entrega em Sua Porta',
        STEP_4_DESC: 'Sua roupa limpa e fresca é entregue, geralmente dentro de 24-48 horas.',
        READY_TO_SCHEDULE_TITLE: 'Pronto para Agendar Sua Primeira Coleta?',
        READY_TO_SCHEDULE_MESSAGE: 'Clique no botão abaixo para acessar seu painel e agendar sua primeira coleta.',
        SCHEDULE_BUTTON: 'Agendar Coleta',
        CREDIT_REMINDER: 'Lembre-se: Suas sacolas serão entregues com sua primeira coleta!',
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
        BAG_INFO_TITLE: isV2Registration ? 'So Funktioniert Unser Service' : (isFreeRegistration ? 'Ihr KOSTENLOSER Wäschesack' : 'Ihre Wäschesäcke'),
        BAG_INFO_MESSAGE: isV2Registration ?
          'Planen Sie Ihre Wäscheabholung online. Nachdem wir Ihre Wäsche abgeholt und gewogen haben, erhalten Sie eine Rechnung. Bezahlen Sie bequem per Kreditkarte, Venmo, PayPal oder CashApp.' :
          (isFreeRegistration ?
            'Großartige Neuigkeiten! Ihr erster Wäschesack ist KOSTENLOS! Er wird von Ihrem Dienstleister geliefert.' :
            'Ihre Wäschesäcke sind bereit! Ihr Dienstleister wird sie bei Ihrer ersten Bestellung mitbringen.'),
        BAG_CREDIT_TITLE: 'Kontoguthaben Details',
        BAGS_PURCHASED_LABEL: isFreeRegistration ? 'Erhaltene Säcke' : 'Gekaufte Säcke',
        COST_PER_BAG_LABEL: 'Kosten pro Sack',
        TOTAL_CREDIT_LABEL: 'Gesamtguthaben',
        NOTE_LABEL: 'Hinweis',
        CREDIT_NOTE_MESSAGE: isV2Registration ?
          'Keine Vorauszahlung erforderlich. Sie bezahlen, nachdem Ihre Wäsche abgeholt und gewogen wurde.' :
          (isFreeRegistration ?
            'Ihr erster Sack war KOSTENLOS! Jeder Sack fasst etwa 20-25 Pfund Wäsche.' :
            'Ihr Dienstleister wird Ihre Säcke liefern, wenn Sie Ihre erste Abholung planen. Jeder Sack fasst etwa 20-25 Pfund Wäsche.'),
        HOW_IT_WORKS_TITLE: 'So funktioniert es',
        STEP_1_TITLE: 'Abholung planen',
        STEP_1_DESC: 'Melden Sie sich in Ihrem Dashboard an und planen Sie eine passende Abholzeit.',
        STEP_2_TITLE: 'Wäsche vorbereiten',
        STEP_2_DESC: 'Ihre angeforderten Wäschesäcke werden mit Ihrer ersten Bestellung geliefert.',
        STEP_3_TITLE: 'Wir erledigen den Rest',
        STEP_3_DESC: 'Ihre Wäsche wird professionell in unserer Einrichtung gewaschen, getrocknet und gefaltet.',
        STEP_4_TITLE: 'Lieferung an Ihre Tür',
        STEP_4_DESC: 'Ihre saubere, frische Wäsche wird geliefert, normalerweise innerhalb von 24-48 Stunden.',
        READY_TO_SCHEDULE_TITLE: 'Bereit, Ihre erste Abholung zu planen?',
        READY_TO_SCHEDULE_MESSAGE: 'Klicken Sie auf den Button unten, um auf Ihr Dashboard zuzugreifen und Ihre erste Abholung zu planen.',
        SCHEDULE_BUTTON: 'Abholung planen',
        CREDIT_REMINDER: 'Denken Sie daran: Ihre Säcke werden mit Ihrer ersten Abholung geliefert!',
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
      schedule_url: 'https://www.wavemaxlaundry.com/austin-tx/wavemax-austin-affiliate-program?login=customer',
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

    logger.info('Customer welcome email sent successfully to:', customer.email);
  } catch (error) {
    logger.error('Error sending customer welcome email:', error);
    throw error; // Re-throw to let the controller handle it
  }
};

/**
 * Send bags ready notification email to customer
 */
exports.sendCustomerBagsReadyEmail = async (customer, affiliate, bagInfo = {}) => {
  try {
    // Validate inputs
    if (!customer || !affiliate) {
      logger.error('Missing customer or affiliate data for bags ready email');
      return;
    }

    if (!customer.email) {
      logger.error('Customer email is missing or undefined');
      return;
    }

    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('customer-bags-ready', language);

    // Build affiliate name with fallback
    const affiliateName = affiliate.businessName ||
      `${affiliate.firstName || ''} ${affiliate.lastName || ''}`.trim() ||
      'Your WaveMAX Partner';

    // Extract bag information with defaults
    const numberOfBags = bagInfo.numberOfBags || 0;

    // Get translations for the email content
    const translations = {
      en: {
        EMAIL_TITLE: 'Your Laundry Bags Are Ready!',
        EMAIL_HEADER: 'Your Bags Are Ready!',
        GREETING: `Hi ${customer.firstName},`,
        MAIN_MESSAGE: 'Great news! Your laundry bags have been prepared and are ready for you.',
        BAGS_READY_TITLE: 'Your Bags Are Ready!',
        BAGS_READY_MESSAGE: `Your service provider will deliver your ${numberOfBags > 0 ? numberOfBags + ' ' : ''}laundry bag${numberOfBags !== 1 ? 's' : ''} when you place your first order.`,
        NEXT_STEPS_TITLE: 'What Happens Next?',
        STEP_1: 'Schedule your first pickup using the button below',
        STEP_2: 'Your service provider will bring your bags with your first pickup',
        STEP_3: 'Start enjoying hassle-free laundry service!',
        YOUR_PROVIDER_TITLE: 'Your Service Provider',
        NAME_LABEL: 'Name',
        PHONE_LABEL: 'Phone',
        EMAIL_LABEL: 'Email',
        PROVIDER_MESSAGE: 'Feel free to reach out if you have any questions about your bags or service!',
        READY_TO_START_TITLE: 'Ready to Schedule Your First Pickup?',
        READY_TO_START_MESSAGE: 'Click the button below to access your dashboard and schedule your first laundry pickup.',
        SCHEDULE_BUTTON: 'Schedule Your First Pickup',
        DASHBOARD_MESSAGE: 'Access your customer dashboard anytime to manage orders and track deliveries.',
        DASHBOARD_BUTTON: 'Go to Dashboard',
        FOOTER_SUPPORT: 'If you have any questions, please contact our support team.',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_ADDRESS: '123 Main Street, Austin, TX 78701'
      },
      es: {
        EMAIL_TITLE: '¡Sus Bolsas de Lavandería Están Listas!',
        EMAIL_HEADER: '¡Sus Bolsas Están Listas!',
        GREETING: `Hola ${customer.firstName},`,
        MAIN_MESSAGE: '¡Excelentes noticias! Sus bolsas de lavandería han sido preparadas y están listas para usted.',
        BAGS_READY_TITLE: '¡Sus Bolsas Están Listas!',
        BAGS_READY_MESSAGE: `Su proveedor de servicio entregará su${numberOfBags > 0 ? 's ' + numberOfBags : 's'} bolsa${numberOfBags !== 1 ? 's' : ''} de lavandería cuando haga su primer pedido.`,
        NEXT_STEPS_TITLE: '¿Qué Sucede Ahora?',
        STEP_1: 'Programe su primera recogida usando el botón a continuación',
        STEP_2: 'Su proveedor de servicio traerá sus bolsas con su primera recogida',
        STEP_3: '¡Comience a disfrutar del servicio de lavandería sin complicaciones!',
        YOUR_PROVIDER_TITLE: 'Su Proveedor de Servicio',
        NAME_LABEL: 'Nombre',
        PHONE_LABEL: 'Teléfono',
        EMAIL_LABEL: 'Correo',
        PROVIDER_MESSAGE: '¡No dude en contactar si tiene preguntas sobre sus bolsas o el servicio!',
        READY_TO_START_TITLE: '¿Listo para Programar Su Primera Recogida?',
        READY_TO_START_MESSAGE: 'Haga clic en el botón a continuación para acceder a su panel y programar su primera recogida de lavandería.',
        SCHEDULE_BUTTON: 'Programe Su Primera Recogida',
        DASHBOARD_MESSAGE: 'Acceda a su panel de cliente en cualquier momento para gestionar pedidos y rastrear entregas.',
        DASHBOARD_BUTTON: 'Ir al Panel',
        FOOTER_SUPPORT: 'Si tiene alguna pregunta, contacte a nuestro equipo de soporte.',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_ADDRESS: '123 Main Street, Austin, TX 78701'
      },
      pt: {
        EMAIL_TITLE: 'Suas Sacolas de Lavanderia Estão Prontas!',
        EMAIL_HEADER: 'Suas Sacolas Estão Prontas!',
        GREETING: `Olá ${customer.firstName},`,
        MAIN_MESSAGE: 'Ótimas notícias! Suas sacolas de lavanderia foram preparadas e estão prontas para você.',
        BAGS_READY_TITLE: 'Suas Sacolas Estão Prontas!',
        BAGS_READY_MESSAGE: `Seu provedor de serviço entregará sua${numberOfBags > 0 ? 's ' + numberOfBags : 's'} sacola${numberOfBags !== 1 ? 's' : ''} de lavanderia quando você fizer seu primeiro pedido.`,
        NEXT_STEPS_TITLE: 'O Que Acontece Agora?',
        STEP_1: 'Agende sua primeira coleta usando o botão abaixo',
        STEP_2: 'Seu provedor de serviço trará suas sacolas com sua primeira coleta',
        STEP_3: 'Comece a desfrutar do serviço de lavanderia sem complicações!',
        YOUR_PROVIDER_TITLE: 'Seu Provedor de Serviço',
        NAME_LABEL: 'Nome',
        PHONE_LABEL: 'Telefone',
        EMAIL_LABEL: 'E-mail',
        PROVIDER_MESSAGE: 'Sinta-se à vontade para entrar em contato se tiver dúvidas sobre suas sacolas ou serviço!',
        READY_TO_START_TITLE: 'Pronto para Agendar Sua Primeira Coleta?',
        READY_TO_START_MESSAGE: 'Clique no botão abaixo para acessar seu painel e agendar sua primeira coleta de lavanderia.',
        SCHEDULE_BUTTON: 'Agende Sua Primeira Coleta',
        DASHBOARD_MESSAGE: 'Acesse seu painel de cliente a qualquer momento para gerenciar pedidos e rastrear entregas.',
        DASHBOARD_BUTTON: 'Ir para o Painel',
        FOOTER_SUPPORT: 'Se você tiver alguma dúvida, entre em contato com nossa equipe de suporte.',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_ADDRESS: '123 Main Street, Austin, TX 78701'
      },
      de: {
        EMAIL_TITLE: 'Ihre Wäschesäcke Sind Bereit!',
        EMAIL_HEADER: 'Ihre Säcke Sind Bereit!',
        GREETING: `Hallo ${customer.firstName},`,
        MAIN_MESSAGE: 'Großartige Neuigkeiten! Ihre Wäschesäcke wurden vorbereitet und sind für Sie bereit.',
        BAGS_READY_TITLE: 'Ihre Säcke Sind Bereit!',
        BAGS_READY_MESSAGE: `Ihr Dienstleister wird Ihre ${numberOfBags > 0 ? numberOfBags + ' ' : ''}Wäschesack${numberOfBags !== 1 ? 'säcke' : ''} bei Ihrer ersten Bestellung mitbringen.`,
        NEXT_STEPS_TITLE: 'Was Passiert Als Nächstes?',
        STEP_1: 'Planen Sie Ihre erste Abholung mit dem Button unten',
        STEP_2: 'Ihr Dienstleister bringt Ihre Säcke bei Ihrer ersten Abholung mit',
        STEP_3: 'Beginnen Sie, den problemlosen Wäscheservice zu genießen!',
        YOUR_PROVIDER_TITLE: 'Ihr Dienstleister',
        NAME_LABEL: 'Name',
        PHONE_LABEL: 'Telefon',
        EMAIL_LABEL: 'E-Mail',
        PROVIDER_MESSAGE: 'Zögern Sie nicht, Kontakt aufzunehmen, wenn Sie Fragen zu Ihren Säcken oder dem Service haben!',
        READY_TO_START_TITLE: 'Bereit, Ihre Erste Abholung zu Planen?',
        READY_TO_START_MESSAGE: 'Klicken Sie auf den Button unten, um auf Ihr Dashboard zuzugreifen und Ihre erste Wäscheabholung zu planen.',
        SCHEDULE_BUTTON: 'Planen Sie Ihre Erste Abholung',
        DASHBOARD_MESSAGE: 'Greifen Sie jederzeit auf Ihr Kunden-Dashboard zu, um Bestellungen zu verwalten und Lieferungen zu verfolgen.',
        DASHBOARD_BUTTON: 'Zum Dashboard',
        FOOTER_SUPPORT: 'Bei Fragen wenden Sie sich bitte an unser Support-Team.',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_ADDRESS: '123 Main Street, Austin, TX 78701'
      }
    };

    const scheduleUrl = `${process.env.APP_BASE_URL || 'https://wavemax.promo'}/customer/schedule-pickup`;
    const loginUrl = `${process.env.APP_BASE_URL || 'https://wavemax.promo'}/customer/login`;

    const data = {
      ...translations[language],
      CUSTOMER_ID: customer.customerId,
      AFFILIATE_NAME: affiliateName,
      AFFILIATE_PHONE: affiliate.phone || 'Not provided',
      AFFILIATE_EMAIL: affiliate.email || 'Not provided',
      SCHEDULE_URL: scheduleUrl,
      LOGIN_URL: loginUrl,
      CURRENT_YEAR: new Date().getFullYear()
    };

    const html = fillTemplate(template, data);

    await sendEmail(
      customer.email,
      `${translations[language].EMAIL_TITLE}`,
      html
    );

    logger.info('Customer bags ready email sent successfully to:', customer.email);
  } catch (error) {
    logger.error('Error sending customer bags ready email:', error);
    throw error;
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
    logger.error('Error sending order confirmation email:', error);
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
    logger.error('Error sending order status update email:', error);
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
    logger.error('Error sending order cancellation email:', error);
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
    logger.error('Error sending customer password reset email:', error);
  }
};

module.exports = exports;
