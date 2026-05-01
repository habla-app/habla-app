// perfil.ts — copy de `/perfil/*`.
//
// Glosario: "@username" (inmutable), "preferencias notif", "datos
// personales", "eliminar cuenta" (separado en auth.ts), "Premium".

export const PERFIL_COPY = {
  index: {
    h: "Mi perfil",
    cta_editar: "Editar",
    section_username_h: "Tu @username",
    section_username_helper: "No se puede cambiar.",
    section_premium_h_no_suscriptor: "💎 Premium",
    section_premium_sub_no_suscriptor:
      "Picks de valor en tu WhatsApp, todos los días.",
    section_premium_cta_no_suscriptor: "Ver planes",
    section_premium_h_activo: "💎 Premium activo",
    section_premium_sub_activo_template:
      "Plan {plan} · próxima renovación {fecha}",
    section_premium_cta_activo: "Mi suscripción",
    section_premium_h_cancelando: "⚠ Cancelando",
    section_premium_sub_cancelando_template: "Acceso hasta {fecha}",
    section_quick_h: "Accesos rápidos",
    quick_predicciones: "Mis predicciones",
    quick_referidos: "Invita a tu brother",
    quick_casas: "Mis casas conectadas",
    quick_preferencias: "Preferencias de notificaciones",
    quick_datos: "Mis datos personales",
    section_legal_h: "Legal",
    legal_terminos: "Términos y condiciones",
    legal_privacidad: "Privacidad",
    legal_juego: "Apuesta responsable",
  },
  preferencias_notif: {
    h: "Preferencias de notificaciones",
    sub: "Decide qué emails y mensajes recibes.",
    section_email_h: "Email",
    label_resumen: "Resumen semanal (lunes)",
    label_torneo: "Avisos de cierre de torneo",
    label_premio: "Si ganas premio mensual",
    label_premium_picks: "Nuevos picks Premium (vía WhatsApp)",
    label_premium_alertas: "Alertas en vivo Premium (vía WhatsApp)",
    section_marketing_h: "Marketing",
    label_promos: "Promos y descuentos ocasionales",
    cta_guardar: "Guardar cambios",
    success: "Preferencias actualizadas.",
  },
  datos_personales: {
    h: "Mis datos personales",
    sub: "Información que tenemos guardada.",
    label_nombre: "Nombre",
    label_email: "Email",
    label_telefono: "Teléfono",
    label_creado: "Cuenta creada",
    label_ultimo_login: "Último login",
    cta_descargar: "📥 Descargar mis datos (JSON)",
    descargar_helper:
      "Te enviaremos un email cuando el archivo esté listo (24h).",
    cta_eliminar: "🗑 Eliminar mi cuenta",
  },
  referidos: {
    modal_h: "Invita a tu brother",
    sub: "Comparte tu link y crece la Liga Habla!",
    label_link: "Tu link de referido",
    cta_copiar: "Copiar link",
    cta_whatsapp: "Compartir en WhatsApp",
    cta_twitter: "Compartir en X",
    success_copiado: "Link copiado al portapapeles.",
  },
  casas_conectadas: {
    h: "Mis casas conectadas",
    sub: "Casas donde ya hiciste tu primer depósito.",
    empty_h: "Sin casas conectadas",
    empty_sub:
      "Cuando hagas tu primer depósito en una casa, aparecerá acá.",
  },
} as const;
