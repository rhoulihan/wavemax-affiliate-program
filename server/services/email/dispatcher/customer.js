const logger = require('../../../utils/logger');
// Customer-facing email dispatchers.
// Extracted from utils/emailService.js in Phase 2.

const { loadTemplate, fillTemplate, formatTimeSlot } = require('../template-manager');
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
          'After we pick up and weigh your laundry, you\'ll receive an invoice. Pay conveniently via credit card, Venmo, PayPal, or CashApp.' :
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
        QUESTIONS_TITLE: 'Questions?',
        QUESTIONS_MESSAGE: 'Your service provider is here to help! Feel free to reach out:',
        NAME_LABEL: 'Name',
        PHONE_LABEL: 'Phone',
        EMAIL_LABEL: 'Email',
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
          'Después de recoger y pesar su ropa, recibirá una factura. Pague cómodamente con tarjeta de crédito, Venmo, PayPal o CashApp.' :
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
        QUESTIONS_TITLE: '¿Preguntas?',
        QUESTIONS_MESSAGE: '¡Su proveedor de servicio está aquí para ayudar! No dude en contactar:',
        NAME_LABEL: 'Nombre',
        PHONE_LABEL: 'Teléfono',
        EMAIL_LABEL: 'Correo',
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
          'Depois de coletarmos e pesarmos suas roupas, você receberá uma fatura. Pague convenientemente via cartão de crédito, Venmo, PayPal ou CashApp.' :
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
        QUESTIONS_TITLE: 'Dúvidas?',
        QUESTIONS_MESSAGE: 'Seu provedor de serviço está aqui para ajudar! Sinta-se à vontade para entrar em contato:',
        NAME_LABEL: 'Nome',
        PHONE_LABEL: 'Telefone',
        EMAIL_LABEL: 'E-mail',
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
          'Nachdem wir Ihre Wäsche abgeholt und gewogen haben, erhalten Sie eine Rechnung. Bezahlen Sie bequem per Kreditkarte, Venmo, PayPal oder CashApp.' :
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
        QUESTIONS_TITLE: 'Fragen?',
        QUESTIONS_MESSAGE: 'Ihr Dienstleister ist hier, um zu helfen! Zögern Sie nicht, Kontakt aufzunehmen:',
        NAME_LABEL: 'Name',
        PHONE_LABEL: 'Telefon',
        EMAIL_LABEL: 'E-Mail',
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
      affiliate_email: affiliate.email || 'support@rundberglaundry.com',
      number_of_bags: numberOfBags,
      bag_fee: bagFee.toFixed(2),
      total_credit: totalCredit.toFixed(2),
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
        THANK_YOU_MESSAGE: 'Thank you for choosing WaveMAX Laundry!',
        CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.',
        STATUS_MESSAGES: {
          pending: 'Your order has been created',
          in_progress: 'Your laundry has been received and is being processed',
          out_for_delivery: 'Your laundry is on its way back to you',
          complete: 'Your laundry has been delivered'
        },
        STATUS_TITLES: {
          pending: 'Order Created',
          in_progress: 'Laundry Processing',
          out_for_delivery: 'Out for Delivery',
          complete: 'Order Complete'
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
        THANK_YOU_MESSAGE: '¡Gracias por elegir WaveMAX Laundry!',
        CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.',
        STATUS_MESSAGES: {
          pending: 'Su pedido ha sido creado',
          in_progress: 'Su ropa ha sido recibida y está siendo procesada',
          out_for_delivery: 'Su ropa está en camino de regreso a usted',
          complete: 'Su ropa ha sido entregada'
        },
        STATUS_TITLES: {
          pending: 'Pedido Creado',
          in_progress: 'Procesando Ropa',
          out_for_delivery: 'En Camino',
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
        THANK_YOU_MESSAGE: 'Obrigado por escolher WaveMAX Laundry!',
        CLOSING_MESSAGE: 'Atenciosamente,<br>A Equipe WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automatizada. Por favor, não responda a este e-mail.',
        STATUS_MESSAGES: {
          pending: 'Seu pedido foi criado',
          in_progress: 'Sua roupa foi recebida e está sendo processada',
          out_for_delivery: 'Sua roupa está a caminho de volta para você',
          complete: 'Sua roupa foi entregue'
        },
        STATUS_TITLES: {
          pending: 'Pedido Criado',
          in_progress: 'Processando Roupa',
          out_for_delivery: 'A Caminho',
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
        THANK_YOU_MESSAGE: 'Vielen Dank, dass Sie sich für WaveMAX Laundry entschieden haben!',
        CLOSING_MESSAGE: 'Mit freundlichen Grüßen,<br>Das WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.',
        STATUS_MESSAGES: {
          pending: 'Ihre Bestellung wurde erstellt',
          in_progress: 'Ihre Wäsche wurde empfangen und wird bearbeitet',
          out_for_delivery: 'Ihre Wäsche ist auf dem Rückweg zu Ihnen',
          complete: 'Ihre Wäsche wurde geliefert'
        },
        STATUS_TITLES: {
          pending: 'Bestellung erstellt',
          in_progress: 'Wäsche in Bearbeitung',
          out_for_delivery: 'Unterwegs',
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
      status_message: statusMessages[status] || '',
      weight_info: '',
      total_info: '',
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
        CANCELLED_AT_LABEL: 'Cancelled At',
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
        CANCELLED_AT_LABEL: 'Cancelado a las',
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
        CANCELLED_AT_LABEL: 'Cancelado às',
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
        CANCELLED_AT_LABEL: 'Storniert um',
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
      cancellation_time: new Date().toLocaleTimeString(),
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

/**
 * Notification B (spec §6.6) — customer "your laundry was delivered".
 * Sent at order `delivered`: affiliate door confirm, customer PIN
 * confirm, or the re-intake auto-deliver (method 'reintake').
 * Best-effort: returns false on failure, never throws.
 */
exports.sendCustomerDeliveredEmail = async (customer, order, { affiliateName } = {}) => {
  try {
    const language = customer.languagePreference || 'en';
    const template = await loadTemplate('customer-order-delivered', language);

    const translations = {
      en: {
        EMAIL_TITLE: 'Your Laundry Was Delivered',
        EMAIL_HEADER: 'Laundry Delivered!',
        GREETING: `Hello ${customer.firstName},`,
        DELIVERED_MESSAGE: 'Your clean laundry has been delivered. The bag is back with you and ready for next time.',
        ORDER_ID_LABEL: 'Order ID',
        DELIVERED_AT_LABEL: 'Delivered',
        DELIVERED_BY_LABEL: 'Delivered by',
        AFFILIATE_NAME_FALLBACK: 'Your delivery provider',
        THANKS_MESSAGE: 'Thank you for choosing WaveMAX Laundry!',
        CLOSING_MESSAGE: 'Best regards,<br>The WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.'
      },
      es: {
        EMAIL_TITLE: 'Su ropa fue entregada',
        EMAIL_HEADER: '¡Ropa entregada!',
        GREETING: `Hola ${customer.firstName},`,
        DELIVERED_MESSAGE: 'Su ropa limpia ha sido entregada. La bolsa está de vuelta con usted y lista para la próxima vez.',
        ORDER_ID_LABEL: 'ID del Pedido',
        DELIVERED_AT_LABEL: 'Entregado',
        DELIVERED_BY_LABEL: 'Entregado por',
        AFFILIATE_NAME_FALLBACK: 'Su proveedor de entrega',
        THANKS_MESSAGE: '¡Gracias por elegir WaveMAX Laundry!',
        CLOSING_MESSAGE: 'Saludos cordiales,<br>El Equipo de WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.'
      },
      pt: {
        EMAIL_TITLE: 'Sua roupa foi entregue',
        EMAIL_HEADER: 'Roupa entregue!',
        GREETING: `Olá ${customer.firstName},`,
        DELIVERED_MESSAGE: 'Sua roupa limpa foi entregue. A sacola está de volta com você e pronta para a próxima vez.',
        ORDER_ID_LABEL: 'ID do Pedido',
        DELIVERED_AT_LABEL: 'Entregue',
        DELIVERED_BY_LABEL: 'Entregue por',
        AFFILIATE_NAME_FALLBACK: 'Seu provedor de entrega',
        THANKS_MESSAGE: 'Obrigado por escolher a WaveMAX Laundry!',
        CLOSING_MESSAGE: 'Atenciosamente,<br>Equipe WaveMAX Laundry',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automática. Por favor, não responda a este e-mail.'
      },
      de: {
        EMAIL_TITLE: 'Ihre Wäsche wurde geliefert',
        EMAIL_HEADER: 'Wäsche geliefert!',
        GREETING: `Hallo ${customer.firstName},`,
        DELIVERED_MESSAGE: 'Ihre saubere Wäsche wurde geliefert. Der Beutel ist wieder bei Ihnen und bereit für das nächste Mal.',
        ORDER_ID_LABEL: 'Auftragsnummer',
        DELIVERED_AT_LABEL: 'Geliefert',
        DELIVERED_BY_LABEL: 'Geliefert von',
        AFFILIATE_NAME_FALLBACK: 'Ihr Lieferpartner',
        THANKS_MESSAGE: 'Vielen Dank, dass Sie WaveMAX Laundry gewählt haben!',
        CLOSING_MESSAGE: 'Mit freundlichen Grüßen,<br>Ihr WaveMAX Laundry Team',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatische Nachricht. Bitte antworten Sie nicht auf diese E-Mail.'
      }
    };
    const t = translations[language] || translations.en;

    const deliveredAt = order.completedAt
      ? new Date(order.completedAt)
      : (order.delivery && order.delivery.at ? new Date(order.delivery.at) : new Date());
    const html = fillTemplate(template, {
      ...t,
      ORDER_ID: order.orderId,
      DELIVERED_AT: deliveredAt.toLocaleString(),
      AFFILIATE_NAME: affiliateName || t.AFFILIATE_NAME_FALLBACK,
      CURRENT_YEAR: String(new Date().getFullYear())
    });

    await sendEmail(customer.email, t.EMAIL_TITLE, html);
    logger.info(`Customer delivered email sent to ${customer.email} for order ${order.orderId}`);
    return true;
  } catch (error) {
    logger.error('Error sending customer delivered email:', error);
    return false;
  }
};

/**
 * Send the 6-digit email-verification OTP at bag-claim registration (PR 7).
 * Best-effort: logs and returns false on failure, never throws.
 * @param {{email:string, code:string, languagePreference?:string}} opts
 */
exports.sendCustomerEmailOtp = async ({ email, code, languagePreference } = {}) => {
  try {
    if (!email || !code) {
      logger.error('sendCustomerEmailOtp: missing email or code');
      return false;
    }
    const language = languagePreference || 'en';
    const template = await loadTemplate('customer-email-otp', language);

    const translations = {
      en: {
        EMAIL_TITLE: 'Your WaveMAX verification code',
        EMAIL_HEADER: 'Verify your email',
        GREETING: 'Hello,',
        INTRO: 'Enter this code to verify your email and finish claiming your laundry bag:',
        EXPIRY_NOTE: 'This code expires in 10 minutes. If you didn\'t request it, you can ignore this email.',
        FOOTER_RIGHTS: 'All rights reserved.',
        FOOTER_AUTOMATED_MESSAGE: 'This is an automated message. Please do not reply to this email.'
      },
      es: {
        EMAIL_TITLE: 'Su código de verificación de WaveMAX',
        EMAIL_HEADER: 'Verifique su correo electrónico',
        GREETING: 'Hola,',
        INTRO: 'Ingrese este código para verificar su correo electrónico y terminar de reclamar su bolsa de ropa:',
        EXPIRY_NOTE: 'Este código caduca en 10 minutos. Si no lo solicitó, puede ignorar este correo.',
        FOOTER_RIGHTS: 'Todos los derechos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Este es un mensaje automatizado. Por favor no responda a este correo.'
      },
      pt: {
        EMAIL_TITLE: 'Seu código de verificação WaveMAX',
        EMAIL_HEADER: 'Verifique seu e-mail',
        GREETING: 'Olá,',
        INTRO: 'Digite este código para verificar seu e-mail e concluir o registro da sua sacola de roupa:',
        EXPIRY_NOTE: 'Este código expira em 10 minutos. Se você não o solicitou, pode ignorar este e-mail.',
        FOOTER_RIGHTS: 'Todos os direitos reservados.',
        FOOTER_AUTOMATED_MESSAGE: 'Esta é uma mensagem automática. Por favor, não responda a este e-mail.'
      },
      de: {
        EMAIL_TITLE: 'Ihr WaveMAX-Bestätigungscode',
        EMAIL_HEADER: 'Bestätigen Sie Ihre E-Mail',
        GREETING: 'Hallo,',
        INTRO: 'Geben Sie diesen Code ein, um Ihre E-Mail zu bestätigen und die Registrierung Ihres Wäschebeutels abzuschließen:',
        EXPIRY_NOTE: 'Dieser Code läuft in 10 Minuten ab. Wenn Sie ihn nicht angefordert haben, können Sie diese E-Mail ignorieren.',
        FOOTER_RIGHTS: 'Alle Rechte vorbehalten.',
        FOOTER_AUTOMATED_MESSAGE: 'Dies ist eine automatische Nachricht. Bitte antworten Sie nicht auf diese E-Mail.'
      }
    };
    const t = translations[language] || translations.en;

    const html = fillTemplate(template, {
      ...t,
      OTP_CODE: code,
      CURRENT_YEAR: String(new Date().getFullYear())
    });

    await sendEmail(email, t.EMAIL_TITLE, html);
    logger.info('Customer email OTP sent', { email });
    return true;
  } catch (error) {
    logger.error('Error sending customer email OTP:', error);
    return false;
  }
};

module.exports = exports;
