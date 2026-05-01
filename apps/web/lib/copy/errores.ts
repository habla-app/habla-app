// errores.ts — copy de errores comunes en toda la app.
//
// Reglas: tono honesto, sin culpar al usuario, con next step claro. Máximo
// 25 palabras por mensaje. Cero "intente nuevamente más tarde" — siempre
// next step concreto.

export const ERRORES_COPY = {
  network: "Sin conexión. Verifica tu internet.",
  generico: "Algo salió mal. Intenta de nuevo en un momento.",
  no_autorizado: "No tienes permiso para hacer esto.",
  no_encontrado: "No encontramos lo que buscas.",
  rate_limit: "Demasiadas solicitudes. Espera un momento.",
  validacion_form: "Revisa los campos marcados.",
  pago_fallido:
    "No pudimos procesar tu pago. Intenta con otra tarjeta.",
  prediccion_cerrada:
    "Las predicciones para este partido ya cerraron.",
  suscripcion_inactiva: "Tu suscripción no está activa.",
  email_ya_existe: "Ya hay una cuenta con ese email. Inicia sesión.",
  username_no_disponible: "Ese @username ya está tomado.",
  email_no_valido: "Ese email no parece correcto.",
  sesion_expirada: "Tu sesión expiró. Vuelve a loguearte.",
  contacto_soporte:
    "Si el problema sigue, escríbenos: soporte@hablaplay.com",
} as const;
