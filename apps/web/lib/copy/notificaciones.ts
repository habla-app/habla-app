// notificaciones.ts — copy canónico de toasts y banners (Lote H).
//
// Reglas:
//   - Toast: max 60 chars en línea principal, max 100 chars total.
//   - Auto-dismiss según severidad: success 3s, info 4s, warning 5s, error 6s.
//   - Persistente solo si requiere acción manual.
//   - Tono según `tono-de-voz.spec.md`: persona "tú", informal-friendly.
//
// Templates con `{n}`, `{fecha}`, `{casa}` se resuelven via `tpl()` del
// helper `lib/copy/template.ts`.

export const TOAST_COPY = {
  // Auth
  auth_magic_link_enviado: "Te enviamos un email con tu enlace de acceso.",
  auth_magic_link_expirado: "Tu enlace expiró. Pide uno nuevo.",
  auth_login_exitoso: "¡Bienvenido de vuelta!",
  auth_logout: "Sesión cerrada.",
  auth_email_duplicado:
    "Este email ya tiene cuenta. ¿Quieres loguearte?",

  // Predicciones (Producto B + C)
  prediccion_guardada: "Predicción guardada. ¡Suerte! 🍀",
  prediccion_actualizada: "Predicción actualizada.",
  prediccion_cerrada:
    "El partido empezó. Ya no puedes modificar tu predicción.",
  click_casa_template: "Te llevamos a {casa}. Buena suerte.",

  // Comunidad (Producto C)
  torneo_inscrito: "¡Estás dentro! Tu predicción cuenta para el ranking.",
  perfil_propio: "Este es tu perfil público. Otros usuarios lo ven así.",

  // Premium
  premium_activado: "¡Premium activo! Únete al Channel para empezar.",
  premium_tarjeta_rechazada:
    "Tu tarjeta fue rechazada por el banco. Intenta con otra.",
  premium_pago_timeout:
    "El proceso está tardando. Recarga en 1 minuto. Si tu tarjeta fue cobrada, recibirás un email.",
  premium_plan_cambiado:
    "Plan cambiado. Aplicará desde la próxima renovación.",
  premium_cancelado_template:
    "Suscripción cancelada. Mantienes acceso hasta {fecha}.",
  premium_reactivado: "¡Bienvenido de vuelta! Tu Premium está activo.",
  premium_reembolso_solicitado:
    "Reembolso en proceso. Llegará a tu tarjeta en 5-10 días.",

  // Perfil
  username_actualizado: "Username actualizado.",
  username_no_disponible: "Ese username ya está en uso. Prueba otro.",
  username_invalido:
    "El username solo puede tener letras, números y _ (3-20 chars).",
  username_locked:
    "Tu username no se puede cambiar después de completado.",
  preferencias_guardadas: "Preferencias actualizadas.",

  // Eliminación de cuenta
  eliminar_solicitud:
    "Tu solicitud está en proceso. Te enviamos un email.",
  eliminar_confirmado: "Cuenta eliminada. Hasta pronto.",

  // Errores genéricos
  generico_500: "Algo salió mal. Intenta de nuevo en unos segundos.",
  generico_network:
    "Sin conexión. Revisa tu internet e intenta de nuevo.",
  generico_timeout:
    "El proceso está tardando. Recarga la página si no responde.",
  generico_rate_limit: "Demasiadas solicitudes. Espera 1 minuto.",
  generico_sesion_expirada: "Tu sesión expiró. Vuelve a loguearte.",

  // Admin
  admin_pick_aprobado_template: "Pick enviado a {n} suscriptores.",
  admin_pick_rechazado: "Pick rechazado. Motivo guardado.",
  admin_pick_editado: "Pick actualizado y enviado.",
  admin_reembolso_procesado: "Reembolso procesado en OpenPay.",
  admin_newsletter_enviada_template:
    "Campaña enviada a {n} suscriptores.",
  admin_premio_marcado_pagado:
    "Premio marcado pagado. Email enviado al ganador.",
  admin_sync_ok_template:
    "Sync completado. {n} items procesados.",
  admin_sync_iniciado: "Sync de membresía iniciado en background.",
  admin_lighthouse_disparado:
    "Lighthouse corriendo. Resultados en 1-2 minutos.",
  admin_usuario_baneado:
    "Usuario baneado. Acción registrada en auditoría.",
  admin_usuario_eliminado:
    "Usuario soft-deleted. Acción registrada en auditoría.",
} as const;

export const BANNER_COPY = {
  // Pista usuario
  usuario_premium_sin_telefono: {
    mensaje: "Falta tu número de WhatsApp para recibir picks 1:1",
    accion: "Agregar teléfono",
    href: "/perfil",
  },
  usuario_premium_expira_template: {
    mensaje: "Tu Premium expira en {n} días. Renueva ahora.",
    accion: "Mantener Premium",
    href: "/premium/mi-suscripcion",
  },
  usuario_premium_pago_fallido: {
    mensaje: "No pudimos procesar tu pago. Tu acceso está pausado.",
    accion: "Actualizar tarjeta",
    href: "/premium/mi-suscripcion",
  },
  usuario_perfil_incompleto: {
    mensaje: "Completa tu perfil para participar en Liga Habla!",
    accion: "Completar perfil",
    href: "/auth/completar-perfil",
  },
  usuario_casa_sin_licencia: {
    mensaje:
      "Esta casa perdió su licencia MINCETUR temporalmente.",
    accion: "Ver casas verificadas",
    href: "/casas",
  },

  // Admin
  admin_alarma_critica_template: {
    mensaje:
      "{titulo}. Posible: {causa}.",
    accion: "Ver detalle",
    href: "/admin/alarmas",
  },
  admin_sync_pendientes_template: {
    mensaje:
      "{n} usuarios deben ser removidos del Channel manualmente.",
    accion: "Ver lista",
    href: "/admin/channel-whatsapp",
  },
  admin_picks_pendientes_template: {
    mensaje: "{n} picks pendientes desde hace más de 24h.",
    accion: "Validar ahora",
    href: "/admin/picks-premium",
  },
  admin_premios_sin_datos_template: {
    mensaje:
      "{n} ganadores sin datos bancarios este mes.",
    accion: "Solicitar datos",
    href: "/admin/premios-mensuales",
  },
} as const;
