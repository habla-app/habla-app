// auth.ts — copy de autenticación.
//
// Cubre: signin (magic link + Google), signup, completar perfil (elegir
// @username), eliminar cuenta. Tono: tutoreo, informal-friendly. Glosario
// canónico: "cuenta", "magic link", "OAuth Google", "@username".

export const AUTH_COPY = {
  signin: {
    title: "Entra a Habla!",
    subtitle: "Continúa con Google o tu email",
    cta_google: "Continuar con Google",
    cta_magic_link: "Enviar link al email",
    placeholder_email: "tu@email.com",
    error_email_invalido: "Ese email no parece correcto",
    success_link_enviado:
      "Te enviamos un link al email. Revisa tu inbox (y la carpeta de spam).",
    error_link_expirado: "El link expiró. Pide uno nuevo.",
    sin_cuenta: "¿Sin cuenta?",
    crear_cuenta_link: "Crear una",
  },
  signup: {
    title: "Crea tu cuenta gratis",
    subtitle: "Predice partidos. Compite por S/ 1,250 al mes.",
    cta_google: "Continuar con Google",
    cta_email: "Continuar con email",
    placeholder_email: "tu@email.com",
    label_terminos: "Acepto los términos y privacidad",
    label_mayor_edad: "Confirmo que tengo 18 años o más",
    error_terminos_requerido: "Acepta los términos para continuar",
    error_mayor_edad_requerido: "Habla! es solo para mayores de 18 años",
    ya_tengo_cuenta: "¿Ya tienes cuenta?",
    entrar_link: "Entra",
  },
  completar_perfil: {
    title: "¡Casi listo!",
    subtitle: "Elige tu @username para competir en Liga Habla!",
    label_username: "Tu @username",
    placeholder_username: "JuanM",
    helper_username: "3-20 caracteres. Solo letras, números y guion bajo.",
    error_disponibilidad: "Ese @username ya está tomado",
    error_formato: "Solo letras, números y _",
    error_longitud: "Mínimo 3 caracteres",
    cta_continuar: "Empezar",
    aviso_inmutable: "⚠ Este @username no se puede cambiar después.",
  },
  cerrar_sesion: "Cerrar sesión",
  eliminar_cuenta: {
    title: "Eliminar mi cuenta",
    paso_1_subtitle: "Esto es permanente. Te explicamos qué pasa.",
    consecuencias_h: "Al eliminar tu cuenta:",
    consecuencias: [
      "Pierdes acceso a Habla! inmediatamente",
      "Tus predicciones se conservan anonimizadas (compliance)",
      "Premios pendientes de Liga Habla! se pierden",
      "Si eres Premium, la suscripción se cancela inmediatamente sin reembolso (a menos que estés en garantía 7 días)",
    ],
    cta_continuar: "Entendido, continuar",
    cta_cancelar: "Mejor no",
    paso_2_subtitle: "Confirma escribiendo tu email.",
    placeholder_email_confirm: "Tu email registrado",
    error_email_no_coincide: "El email no coincide",
    cta_eliminar_definitivo: "Eliminar mi cuenta",
    success: "Tu cuenta fue eliminada. Te extrañaremos.",
  },
} as const;
