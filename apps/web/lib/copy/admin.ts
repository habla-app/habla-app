// admin.ts — copy del panel `/admin/*`.
//
// Glosario admin: "validar pick" (no "moderar"), "aprobar/rechazar/editar",
// "Channel" (WhatsApp Channel), "alarma" (estado: activa/desactivada),
// "auditoría" (registro de acciones destructivas), "MRR/CAC/LTV/ROI" (en
// admin OK; user-facing usa "ingresos / costo de adquisición / etc").

export const ADMIN_COPY = {
  layout: {
    mobile_guard_h: "Panel admin requiere pantalla ≥ 1280px",
    mobile_guard_sub: "Usa laptop o tablet horizontal.",
    cerrar_sesion: "Cerrar sesión",
  },
  shortcuts: {
    aprobar: "Aprobar",
    rechazar: "Rechazar",
    editar: "Editar",
    navegar: "Navegar",
    cerrar: "Cerrar",
  },
  picks_premium: {
    h: "Validar Picks Premium",
    sub_template:
      "{n} picks pendientes · Próxima distribución a las {hora}",
    cola_h: "Cola",
    sin_pendientes: "✓ Todo al día. Sin picks pendientes.",
    sin_pick_seleccionado: "Selecciona un pick de la cola izquierda.",
    cta_aprobar: "Aprobar y enviar al Channel",
    cta_editar: "Editar",
    cta_rechazar: "Rechazar",
    rechazar_modal_h: "Rechazar pick",
    rechazar_label_motivo: "Motivo (visible solo para el equipo)",
    rechazar_confirmar: "Confirmar rechazo",
    success_aprobado_template: "✓ Pick enviado a {n} suscriptores",
    success_rechazado: "✓ Pick rechazado. Motivo guardado.",
    success_editado: "✓ Pick actualizado y enviado.",
    error_aprobar: "No pudimos enviar el pick. Reintenta.",
  },
  suscripciones: {
    h: "Suscripciones",
    sub_template:
      "{activas} activas · {mrr} MRR · {cancelando} cancelando este mes",
    label_estado: "Estado",
    label_plan: "Plan",
    label_email: "Email",
    cta_ver: "Ver",
    detalle_h: "Detalle suscripción",
    detalle_cancelar_inmediato: "Cancelar inmediato (override)",
    detalle_reembolsar: "Reembolsar",
    detalle_cancelar_modal_h: "¿Cancelar inmediatamente?",
    detalle_cancelar_modal_sub:
      "Revoca acceso al Channel ahora. El usuario NO recibe más picks.",
    detalle_cancelar_confirmar: "Confirmar cancelación inmediata",
    detalle_reembolsar_modal_h: "Reembolso fuera de garantía",
    detalle_reembolsar_modal_sub:
      "Procede solo con justificación clara. Llega a la tarjeta en 3-7 días hábiles.",
    detalle_reembolsar_label_motivo: "Motivo (obligatorio)",
    detalle_reembolsar_label_confirm:
      "Confirmo que este reembolso es justificado y se realiza fuera de la garantía",
    detalle_reembolsar_confirmar: "Procesar reembolso",
    success_cancelado: "✓ Suscripción cancelada inmediatamente.",
    success_reembolsado: "✓ Reembolso procesado en OpenPay.",
  },
  channel_whatsapp: {
    h: "Channel WhatsApp",
    sub: "Estado del Channel privado de Habla! Picks",
    label_activos: "Activos",
    label_unidos: "Unidos al Channel",
    label_alertas_leak: "Alertas de leak",
    cta_forzar_sync: "Forzar sync",
    success_sync: "Sync de membresía iniciado en background.",
    rotacion_info_template:
      "Próxima rotación del invite link: {fecha} (cada 6 meses).",
  },
  newsletter: {
    h: "Newsletter",
    cta_test: "Enviar test a mi email",
    success_test: "✓ Test enviado a tu email.",
    cta_aprobar_envio: "Aprobar y enviar a suscriptores",
    success_envio_template: "✓ Campaña enviada a {n} suscriptores.",
  },
  premios_mensuales: {
    h: "Premios mensuales",
    cta_solicitar_datos: "Solicitar datos al ganador",
    cta_marcar_pagado: "Marcar pagado",
    success_email_solicitud: "✓ Email enviado al ganador solicitando datos.",
    success_marcado_pagado:
      "✓ Premio marcado pagado. Email enviado al ganador.",
  },
  alarmas: {
    h: "Alarmas",
    sub: "Estado de las alarmas operativas",
    cta_desactivar: "Desactivar",
    desactivar_modal_h: "Desactivar alarma",
    desactivar_label_motivo: "Motivo (obligatorio)",
    desactivar_confirmar: "Confirmar",
    success_desactivada: "✓ Alarma desactivada.",
    success_creada_manual: "✓ Alarma creada manualmente.",
  },
  auditoria: {
    h: "Auditoría",
    sub: "Registro de acciones destructivas. Retención 100%.",
    label_actor: "Actor",
    label_accion: "Acción",
    label_entidad: "Entidad",
    label_metadata: "Metadata",
  },
  usuarios: {
    h: "Usuarios",
    sub: "Listado de cuentas registradas",
    cta_ban: "Banear",
    cta_eliminar: "Eliminar",
    cta_cambiar_rol: "Cambiar rol",
    ban_modal_h: "Banear usuario",
    ban_label_motivo: "Motivo (obligatorio)",
    ban_confirmar: "BANEAR",
    eliminar_modal_h: "Soft-delete usuario",
    eliminar_label_motivo: "Motivo (obligatorio)",
    eliminar_confirmar: "ELIMINAR",
    success_baneado: "✓ Usuario baneado. Acción registrada en auditoría.",
    success_eliminado:
      "✓ Usuario soft-deleted. Acción registrada en auditoría.",
    success_rol_cambiado: "✓ Rol cambiado.",
  },
} as const;
