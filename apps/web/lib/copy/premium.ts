// premium.ts — copy del producto Premium (Lote D + checkout).
//
// Glosario: "suscripción", "plan" (Mensual/Trimestral/Anual), "garantía 7
// días", "renovación", "cancelar", "cancelando" (estado intermedio),
// "vencimiento", "Channel" (WhatsApp Channel privado), "watermark".
// Reglas: cero promesas legales (no "ganarás", "garantizamos rentabilidad");
// apuesta responsable mencionada en cualquier comunicación.

export const PREMIUM_COPY = {
  landing: {
    hero_h: "Picks de valor en tu WhatsApp",
    hero_sub:
      "Recibe 2-4 picks/día con razonamiento estadístico, validados por nuestro editor. Directo en tu canal privado.",
    inclusiones_h: "Lo que recibes",
    inclusiones: [
      "**2-4 picks/día** con razonamiento estadístico (datos H2H, forma reciente, EV+)",
      "**Casa con mejor cuota** en cada pick — link directo",
      "**Alertas en vivo** durante partidos top (cambios de cuotas, oportunidades)",
      "**Bot FAQ 24/7** en WhatsApp para resolver dudas al instante",
      "**Resumen semanal** los lunes con performance de los picks",
    ],
    plan_mensual_label: "Mensual",
    plan_mensual_precio: "S/ 49/mes",
    plan_mensual_helper: "Cancela cuando quieras",
    plan_trimestral_label: "Trimestral",
    plan_trimestral_precio: "S/ 119/3 meses",
    plan_trimestral_helper: "Ahorra 19% · S/ 39.6/mes",
    plan_anual_label: "Anual",
    plan_anual_precio: "S/ 399/año",
    plan_anual_helper: "Ahorra 32% · S/ 33.2/mes",
    plan_anual_badge: "Más popular",
    garantia: "✓ Garantía de 7 días · sin compromiso",
    sticky_cta: "⚡ Suscribirme con OpenPay",
    sticky_cta_anonimo: "⚡ Crear cuenta y suscribirme",
    sticky_cta_no_disponible: "⚡ Próximamente · Avísame",
  },
  checkout: {
    h: "Activa tu Premium",
    progress_label: "Falta 1 paso",
    plan_resumen_cambiar: "Cambiar plan",
    section_datos: "Tus datos",
    section_tarjeta: "💳 Tarjeta",
    label_nombre: "Nombre completo",
    label_email: "Email",
    label_doc_tipo: "Tipo de documento",
    label_doc_num: "Número",
    label_tarjeta_num: "Número de tarjeta",
    label_vencimiento: "Vencimiento (MM/AA)",
    label_cvv: "CVV",
    label_nombre_tarjeta: "Nombre como aparece en la tarjeta",
    seguridad_1: "Pago procesado por OpenPay BBVA",
    seguridad_2: "Tarjeta encriptada con TLS",
    seguridad_3: "No guardamos datos de tarjeta",
    aviso_terminos:
      "Al continuar aceptas términos y privacidad. Renovación automática. Cancela cuando quieras desde tu perfil.",
    cta_pagar_template: "💎 Pagar S/ {monto} · Activar",
    procesando: "Procesando tu suscripción...",
    procesando_sub:
      "Esto puede tomar unos segundos. No cierres esta ventana.",
    error_tarjeta: "Tu tarjeta fue rechazada por el banco. Intenta con otra.",
    error_duplicado:
      "Detectamos un pago reciente. Verificando tu suscripción...",
    error_timeout:
      "El proceso está tardando. Recarga esta página en 1 minuto. Si tu tarjeta fue cobrada, recibirás un email.",
    fallback_no_configurado:
      "⚠ Pagos aún no disponibles. Te avisamos cuando esté listo.",
  },
  post_pago: {
    hero_h: "¡Bienvenido a Premium!",
    hero_sub_template: "Plan {plan} activo hasta el {fecha}",
    cta_h: "Únete al Channel",
    cta_sub:
      "Solo 1 click para empezar a recibir los picks. El link se abrirá en WhatsApp.",
    cta_btn: "📱 Unirme a Habla! Picks",
    cta_btn_sub: "Canal privado · Solo suscriptores Premium",
    pasos_h: "📋 Qué pasa ahora",
    pasos: [
      "**Únete al Channel** con el botón verde de arriba.",
      "**Recibirás 2-4 picks/día** con razonamiento estadístico completo.",
      "**El primer pick llega en menos de 24h** (excepto domingos cuando hay menos partidos).",
      "**Para FAQ 24/7** envía cualquier mensaje al WhatsApp del bot.",
    ],
    email_info_template:
      "Te enviamos un email a {email} con tu factura y el link al Channel por si lo necesitas después.",
    verificando_h: "Verificando tu pago...",
    verificando_sub: "Esto puede tomar 1-2 minutos.",
    verificando_timeout:
      "Tu pago se está procesando. Te enviaremos un email cuando esté listo.",
  },
  mi_suscripcion: {
    h: "Mi suscripción",
    sub: "Gestiona tu plan, pagos y acceso al Channel",
    estado_activa: "✓ Activa",
    estado_cancelando: "⚠ Cancelando",
    estado_vencida: "Vencida",
    label_proximo_cobro: "Próximo cobro",
    label_dias_restantes: "Días restantes",
    label_acceso_hasta_template: "Acceso hasta {fecha}",
    section_cambiar_plan_h: "🔄 Cambiar plan",
    cambiar_plan_helper: "El cambio aplica desde la siguiente renovación",
    section_historial_h: "💳 Historial de pagos",
    historial_descargar_todo: "Descargar todo",
    section_critica_h: "⚠ Zona crítica",
    cta_cancelar: "Cancelar suscripción",
    cancelar_modal_h: "¿Cancelar tu suscripción?",
    cancelar_modal_template:
      "Mantienes acceso hasta el {fecha}. No te cobramos más después.",
    cancelar_survey_label: "¿Por qué cancelas?",
    cancelar_survey_opts: [
      "Caro",
      "No me sirvió",
      "Solo lo probaba",
      "Otro motivo",
    ],
    cancelar_confirmar: "Confirmar cancelación",
    cancelar_volver: "Mantener suscripción",
    reactivar_cta: "Reactivar",
  },
} as const;
