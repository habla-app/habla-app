// WhatsApp Business API — catálogo central de templates HSM (Lote H).
//
// Las templates HSM son mensajes pre-aprobados por Meta que se pueden
// enviar fuera de la ventana de 24h del usuario. Cada uno DEBE estar
// previamente registrado en Meta Business Manager con el mismo `name`,
// `category` y body literal (con `{{1}}`, `{{2}}` etc).
//
// Categorías:
//   - UTILITY:        notificaciones transaccionales (cobros, status).
//   - MARKETING:      promociones, recordatorios de venta.
//   - AUTHENTICATION: OTP / códigos.
//
// MARKETING solo puede enviarse entre 9 AM y 8 PM hora Lima — `enviarTemplate`
// lo enforce automáticamente cuando recibe una key MARKETING.
//
// Variables: cada template declara un tuple `variables` ORDENADO según los
// `{{N}}` del body. `enviarTemplate(key, to, vars)` recibe un objeto con
// las mismas keys y las ordena para Meta.

import { logger } from "@/lib/services/logger";
import { WhatsAppBusinessClient, isWhatsAppConfigured } from "./wa-business-client";

export type WhatsAppCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";

interface TemplateDef<Vars extends readonly string[]> {
  /** Debe coincidir EXACTO con el `name` registrado en Meta Business Manager. */
  name: string;
  category: WhatsAppCategory;
  language: string;
  variables: Vars;
  /**
   * Texto exacto del body como se registró en Meta. Útil para tests, preview
   * en admin y verificación cruzada con la dashboard de Meta. NO se envía
   * por API — Meta lo resuelve desde el `name`.
   */
  bodyTemplate: string;
}

export const WHATSAPP_TEMPLATES = {
  factura_premium: {
    name: "factura_premium",
    category: "UTILITY" as const,
    language: "es",
    variables: ["nombre", "monto", "plan", "proximoCobro", "operacion"] as const,
    bodyTemplate: `Hola {{1}} 👋

Confirmamos tu pago de S/{{2}} por Habla! Premium 💎

Detalles:
• Plan: {{3}}
• Próximo cobro: {{4}}
• Operación: {{5}}

Tu acceso al Channel sigue activo. Cualquier duda, responde este mensaje.`,
  },
  fallo_pago_premium: {
    name: "fallo_pago_premium",
    category: "UTILITY" as const,
    language: "es",
    variables: ["nombre", "monto", "linkActualizar"] as const,
    bodyTemplate: `Hola {{1}},

No pudimos procesar tu pago de S/{{2}} de Habla! Premium tras 3 intentos.

Tu acceso al Channel se pausó temporalmente.

Para reactivar:
1. Verifica que tu tarjeta tenga fondos
2. Actualízala aquí: {{3}}

Si necesitas ayuda, responde este mensaje.`,
  },
  renovacion_recordatorio: {
    name: "renovacion_recordatorio",
    category: "MARKETING" as const,
    language: "es",
    variables: ["nombre", "monto", "linkGestionar"] as const,
    bodyTemplate: `Hola {{1}},

Tu Habla! Premium se renueva en 7 días por S/{{2}} 💎

Si quieres seguir recibiendo picks: no necesitas hacer nada.

Si quieres cancelar: {{3}}

Sigues acertando con nosotros 🎯`,
  },
  cancelacion_efectiva: {
    name: "cancelacion_efectiva",
    category: "UTILITY" as const,
    language: "es",
    variables: ["nombre", "linkVolver"] as const,
    bodyTemplate: `Hola {{1}},

Tu suscripción Habla! Premium finalizó hoy. Te removeremos del Channel pronto.

Gracias por haber sido parte 👋

Si quieres volver: {{2}}`,
  },
  reembolso_confirmado: {
    name: "reembolso_confirmado",
    category: "UTILITY" as const,
    language: "es",
    variables: ["nombre", "monto", "operacion"] as const,
    bodyTemplate: `Hola {{1}},

Procesamos tu reembolso de S/{{2}} de Habla! Premium ✅

Operación: {{3}}
El monto llegará a tu tarjeta en 5-10 días hábiles.

Cualquier duda, responde este mensaje.`,
  },
  premio_mensual_listo: {
    name: "premio_mensual_listo",
    category: "UTILITY" as const,
    language: "es",
    variables: [
      "nombre",
      "monto",
      "posicion",
      "mes",
      "bancoDestino",
      "operacion",
      "fecha",
    ] as const,
    bodyTemplate: `🏆 Felicidades {{1}}!

Te transferimos S/{{2}} por la posición #{{3}} de Liga Habla! en {{4}}.

Detalles:
• Banco destino: {{5}}
• Operación: {{6}}
• Fecha: {{7}}

¡Sigue compitiendo! 🎯`,
  },
  welcome_bot_inicial: {
    name: "welcome_bot_inicial",
    category: "UTILITY" as const,
    language: "es",
    variables: ["nombre"] as const,
    bodyTemplate: `Hola {{1}}! 👋

Soy el bot de Habla!. Respondo dudas sobre:
• Cómo funciona Premium
• Liga Habla! y premios
• Casas autorizadas en Perú
• EV+, stake, apuesta responsable

Pregúntame lo que necesites. Para temas urgentes derivamos a un humano.

(Solo respondo a suscriptores Premium activos.)`,
  },
} as const satisfies Record<string, TemplateDef<readonly string[]>>;

export type WhatsAppTemplateKey = keyof typeof WHATSAPP_TEMPLATES;

type VarsObject<K extends WhatsAppTemplateKey> = Record<
  (typeof WHATSAPP_TEMPLATES)[K]["variables"][number],
  string
>;

/** Resultado de enviarTemplate. */
export type EnviarTemplateResult =
  | { ok: true; messageId: string }
  | {
      ok: false;
      reason:
        | "unconfigured"
        | "marketing-fuera-de-horario"
        | "api-error"
        | "rate-limit"
        | "fetch-error";
      details?: unknown;
    };

const HORARIO_MARKETING_INICIO = 9; // 9 AM Lima
const HORARIO_MARKETING_FIN = 20; // 8 PM Lima

/** Devuelve la hora actual en Lima (0-23). */
function horaLima(): number {
  const fmt = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === "hour");
  const h = hourPart ? Number.parseInt(hourPart.value, 10) : 12;
  return Number.isFinite(h) ? h : 12;
}

/** True si la hora actual en Lima permite enviar templates MARKETING. */
export function puedeEnviarMarketingAhora(): boolean {
  const h = horaLima();
  return h >= HORARIO_MARKETING_INICIO && h < HORARIO_MARKETING_FIN;
}

/**
 * Envía un template Meta a un teléfono (E.164 con o sin `+`).
 *
 * Idempotencia: el caller debe garantizar que no llama dos veces para el
 * mismo trigger (ej: usar `whatsappMsgId` o un lock en BD). Esta función
 * NO desduplica por sí misma.
 *
 * Reglas:
 *   - MARKETING fuera de 9 AM – 8 PM Lima → `{ ok: false, reason: 'marketing-fuera-de-horario' }`.
 *   - WhatsApp no configurado → `{ ok: false, reason: 'unconfigured' }`.
 *   - 429 Meta → `{ ok: false, reason: 'rate-limit' }`.
 */
export async function enviarTemplate<K extends WhatsAppTemplateKey>(
  templateKey: K,
  to: string,
  vars: VarsObject<K>,
): Promise<EnviarTemplateResult> {
  const tmpl = WHATSAPP_TEMPLATES[templateKey];

  if (tmpl.category === "MARKETING" && !puedeEnviarMarketingAhora()) {
    logger.warn(
      { template: tmpl.name, to: redactPhone(to), source: "whatsapp:templates" },
      "enviarTemplate: MARKETING fuera de horario, skip",
    );
    return { ok: false, reason: "marketing-fuera-de-horario" };
  }

  if (!isWhatsAppConfigured()) {
    logger.warn(
      { template: tmpl.name, source: "whatsapp:templates" },
      "enviarTemplate: WhatsApp no configurado, skip",
    );
    return { ok: false, reason: "unconfigured" };
  }

  const orderedVars = (tmpl.variables as readonly string[]).map(
    (k) => (vars as Record<string, string>)[k] ?? "",
  );

  const client = new WhatsAppBusinessClient();
  const res = await client.enviarTemplate({
    to,
    templateName: tmpl.name,
    languageCode: tmpl.language,
    variables: orderedVars,
  });

  if (res.ok) {
    logger.info(
      {
        template: tmpl.name,
        category: tmpl.category,
        to: redactPhone(to),
        messageId: res.messageId,
        source: "whatsapp:templates",
      },
      "wa_template_enviado",
    );
    return { ok: true, messageId: res.messageId };
  }

  logger.error(
    {
      template: tmpl.name,
      reason: res.reason,
      status: "status" in res ? res.status : undefined,
      to: redactPhone(to),
      source: "whatsapp:templates",
    },
    "wa_template_falla_envio",
  );
  return {
    ok: false,
    reason:
      res.reason === "rate-limit"
        ? "rate-limit"
        : res.reason === "fetch-error"
          ? "fetch-error"
          : "api-error",
    details: "body" in res ? res.body : undefined,
  };
}

/**
 * Renderiza el body del template sustituyendo `{{N}}` con los valores —
 * útil para preview en admin y para tests. NO afecta el envío real (Meta
 * resuelve el body desde el `name` registrado).
 */
export function previsualizarTemplate<K extends WhatsAppTemplateKey>(
  templateKey: K,
  vars: VarsObject<K>,
): string {
  const tmpl = WHATSAPP_TEMPLATES[templateKey];
  const ordered = (tmpl.variables as readonly string[]).map(
    (k) => (vars as Record<string, string>)[k] ?? "",
  );
  return tmpl.bodyTemplate.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const idx = Number.parseInt(n, 10) - 1;
    return ordered[idx] ?? "";
  });
}

/** Redacta un teléfono para logs: `+51999999999` → `+5199****999`. */
function redactPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 7) return "***";
  return `+${digits.slice(0, 4)}****${digits.slice(-3)}`;
}
