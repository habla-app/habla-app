// Contrato neutral de pasarela de pagos. Lote E (May 2026) extiende este
// contrato con los métodos que necesita el flujo de Premium WhatsApp:
//
//   crearSuscripcion       → tokeniza tarjeta + crea customer + crea
//                             suscripción recurrente. Retorna IDs OpenPay.
//   cancelarSuscripcion    → cancela en pasarela; el acceso al Channel se
//                             mantiene hasta `vencimiento` (lo gestiona el
//                             cron sync, no la pasarela).
//   reembolsar             → emite reembolso de un cobro específico.
//   verificarFirmaWebhook  → valida HMAC-SHA256 de un webhook entrante.
//
// El esqueleto neutral se mantiene compatible con el contrato pre-Lote E
// (`crearCobroUnico` + el `crearSuscripcion` minimalista anterior). El
// adapter real (OpenPayAdapter) implementa los métodos extendidos; el mock
// (MockPasarelaPagos) solo el contrato base.
//
// Cero datos de tarjeta tocan el servidor: `tokenTarjeta` y
// `deviceSessionId` se generan con OpenPay.js client-side, antes del POST.

export interface CrearCobroUnicoInput {
  /** Monto en céntimos de soles. */
  monto: number;
  descripcion: string;
  metadata: Record<string, string>;
}

export interface CrearCobroUnicoResult {
  cobroId: string;
  estado: "pending" | "captured" | "failed";
}

// ---------------------------------------------------------------------------
// Lote E — flujo de suscripción recurrente
// ---------------------------------------------------------------------------

export type PlanCode = "MENSUAL" | "TRIMESTRAL" | "ANUAL";

export interface CrearSuscripcionInput {
  /** ID interno del usuario (se pasa como `external_id` al customer). */
  usuarioId: string;
  /** Plan elegido. El adapter mapea a planId de la pasarela. */
  plan: PlanCode;
  /** Token de la tarjeta tokenizada en client-side con OpenPay.js. */
  tokenTarjeta: string;
  /** ID de sesión del dispositivo (anti-fraude OpenPay). */
  deviceSessionId: string;
  /** Datos del titular para el customer en OpenPay. */
  nombre: string;
  email: string;
}

export interface CrearSuscripcionResult {
  /** ID de la suscripción en la pasarela (`subc_xxx` en OpenPay). */
  suscripcionId: string;
  /** ID del customer en la pasarela (reutilizable en futuros cobros). */
  customerId: string;
  /** Estado simbólico del primer cobro. La acreditación final llega por webhook. */
  estado: "activa" | "pendiente" | "fallida";
}

export interface PasarelaPagos {
  crearCobroUnico(input: CrearCobroUnicoInput): Promise<CrearCobroUnicoResult>;
  crearSuscripcion(input: CrearSuscripcionInput): Promise<CrearSuscripcionResult>;
  /** Cancela suscripción en la pasarela (no más cobros). El acceso al Channel
   *  se gestiona del lado de Habla! (cron sync), no de la pasarela. */
  cancelarSuscripcion(suscripcionPasarelaId: string): Promise<void>;
  /** Emite reembolso de un cobro. Usado para garantía 7 días. */
  reembolsar(cobroPasarelaId: string): Promise<void>;
  /** Verifica firma HMAC-SHA256 de un webhook entrante. Async por usar
   *  Web Crypto (`globalThis.crypto.subtle`) — Lote E refactor para
   *  evitar `node:crypto` que rompe el bundle de Next. */
  verificarFirmaWebhook(rawBody: string, signature: string | null): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Mapping de planes internos → IDs en la pasarela
// ---------------------------------------------------------------------------

/**
 * Mapping plan interno → planId en OpenPay. Gustavo crea estos planes
 * manualmente en el dashboard de OpenPay (ver pasos en
 * `docs/ux-spec/04-pista-usuario-premium/suscripciones-backend.spec.md`).
 *
 * Nombre canónico en BD: la enum `PlanPremium`. Aquí solo los slugs OpenPay.
 */
export const OPENPAY_PLAN_IDS: Record<PlanCode, string> = {
  MENSUAL: "plan_premium_mensual",
  TRIMESTRAL: "plan_premium_trimestral",
  ANUAL: "plan_premium_anual",
};

/**
 * Precio de cada plan en céntimos de soles. Sirve para crear la fila
 * `Suscripcion.precio` en BD y para auditar que el cobro de OpenPay matchee.
 */
export const PLANES_PRECIO_CENTIMOS: Record<PlanCode, number> = {
  MENSUAL: 4900, /* S/ 49 */
  TRIMESTRAL: 11900, /* S/ 119 */
  ANUAL: 39900, /* S/ 399 */
};

/**
 * Duración de cada plan en días. Para calcular `proximoCobro` y `vencimiento`
 * al crear la suscripción.
 */
export const PLANES_DURACION_DIAS: Record<PlanCode, number> = {
  MENSUAL: 30,
  TRIMESTRAL: 90,
  ANUAL: 365,
};
