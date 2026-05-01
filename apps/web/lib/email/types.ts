// Tipos compartidos del módulo email (Lote H).

export type PlanPremium = "MENSUAL" | "TRIMESTRAL" | "ANUAL";

export const PLAN_LABELS: Record<PlanPremium, string> = {
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  ANUAL: "Anual",
};

/** Categoría del email — afecta el `from` y eventual segmentación. */
export type EmailCategoria =
  | "auth"
  | "onboarding"
  | "newsletter"
  | "premium"
  | "compliance";

/**
 * Direcciones `from` por categoría. Distintas direcciones permiten:
 *   - Whitelisting más fácil por parte del usuario.
 *   - Segmentación natural en filtros del cliente de email.
 *   - Desviar reply-to a buzones específicos (en Resend dashboard).
 */
export const FROM_ADDRESSES: Record<EmailCategoria, string> = {
  auth: "Habla! <auth@hablaplay.com>",
  onboarding: "Habla! <hola@hablaplay.com>",
  newsletter: "Habla! Newsletter <newsletter@hablaplay.com>",
  premium: "Habla! Premium <premium@hablaplay.com>",
  compliance: "Habla! <legal@hablaplay.com>",
};
