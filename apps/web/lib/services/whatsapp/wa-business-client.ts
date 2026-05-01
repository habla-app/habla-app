// Cliente HTTP de WhatsApp Business API (Cloud API).
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
//
// Lote E (May 2026). Wrapper minimalista — solo exponemos los métodos que
// usamos en producción:
//   - enviarMensajeTexto(to, body)            → texto plano (bot 1:1, picks)
//   - marcarLeido(messageId)                  → mejora retention en bot
//   - verifyToken(query)                      → handshake del webhook
//   - verificarFirmaWebhook(rawBody, sig)     → HMAC-SHA256 de webhooks
//
// Auth: Bearer token (System User Token permanente del Business). Se setea
// en `WHATSAPP_ACCESS_TOKEN`. Si el token o el phone number ID no están
// configurados, los métodos retornan { ok: false, reason: 'unconfigured' }
// SIN tirar — graceful degradation, igual que `email.service.ts`.

import { logger } from "@/lib/services/logger";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/utils/hmac";

const API_VERSION = "v22.0";
const FETCH_TIMEOUT_MS = 30_000;

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string | null;
  verifyToken: string | null;
}

function readConfig(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return {
    phoneNumberId,
    accessToken,
    appSecret: process.env.WHATSAPP_APP_SECRET ?? null,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? null,
  };
}

export interface EnviarMensajeOk {
  ok: true;
  messageId: string;
}
export interface EnviarMensajeError {
  ok: false;
  reason: "unconfigured" | "rate-limit" | "api-error" | "fetch-error";
  status?: number;
  body?: unknown;
}
export type EnviarMensajeResult = EnviarMensajeOk | EnviarMensajeError;

export class WhatsAppBusinessClient {
  private cfg: WhatsAppConfig | null;

  constructor() {
    this.cfg = readConfig();
  }

  isConfigured(): boolean {
    return this.cfg !== null;
  }

  /**
   * Envía un mensaje de texto plano 1:1 a un número (E.164: `+51XXXXXXXXX`).
   * Si el cliente no está configurado, retorna { ok: false, reason: 'unconfigured' }
   * sin tirar. Logguea warn — el caller decide si reintentar o registrar.
   */
  async enviarMensajeTexto(input: {
    to: string;
    body: string;
  }): Promise<EnviarMensajeResult> {
    if (!this.cfg) {
      logger.warn(
        { source: "whatsapp:client" },
        "enviarMensajeTexto: cliente no configurado, skip",
      );
      return { ok: false, reason: "unconfigured" };
    }
    const url = `https://graph.facebook.com/${API_VERSION}/${this.cfg.phoneNumberId}/messages`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizeTo(input.to),
          type: "text",
          // preview_url false: nuestro mensaje incluye un link a /go/[casa]
          // pero queremos que el preview lo controlemos desde la web (OG).
          text: { body: input.body, preview_url: false },
        }),
        signal: ac.signal,
      });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* keep raw */
      }
      if (!res.ok) {
        // 429 → rate-limit (caller debe reintentar más tarde, no retry inmediato).
        if (res.status === 429) {
          return { ok: false, reason: "rate-limit", status: 429, body };
        }
        logger.error(
          { url, status: res.status, body, source: "whatsapp:client" },
          "enviarMensajeTexto: API error",
        );
        return { ok: false, reason: "api-error", status: res.status, body };
      }
      const data = body as { messages?: Array<{ id: string }> };
      const messageId = data.messages?.[0]?.id;
      if (!messageId) {
        return { ok: false, reason: "api-error", status: res.status, body };
      }
      return { ok: true, messageId };
    } catch (err) {
      logger.error(
        { err, source: "whatsapp:client" },
        "enviarMensajeTexto: fetch falló",
      );
      return { ok: false, reason: "fetch-error" };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Envía una template HSM (pre-aprobada por Meta) a un número. Las
   * templates se usan FUERA de la ventana de 24h (notificaciones
   * proactivas: factura, fallo de pago, recordatorio de renovación).
   *
   * Requisitos:
   *   - El `templateName` debe estar previamente aprobado en Meta
   *     Business Manager con el mismo `language` y `variables`.
   *   - `variables` se mandan en orden (Meta las matchea por posición:
   *     index 0 → `{{1}}`, etc).
   *
   * Lote H — coordinador del envío vive en `templates.ts` (catálogo
   * central tipado). Este método es un transporte HTTP minimalista.
   */
  async enviarTemplate(input: {
    to: string;
    templateName: string;
    languageCode?: string;
    variables: string[];
  }): Promise<EnviarMensajeResult> {
    if (!this.cfg) {
      logger.warn(
        { source: "whatsapp:client" },
        "enviarTemplate: cliente no configurado, skip",
      );
      return { ok: false, reason: "unconfigured" };
    }
    const url = `https://graph.facebook.com/${API_VERSION}/${this.cfg.phoneNumberId}/messages`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizeTo(input.to),
          type: "template",
          template: {
            name: input.templateName,
            language: { code: input.languageCode ?? "es" },
            components:
              input.variables.length > 0
                ? [
                    {
                      type: "body",
                      parameters: input.variables.map((v) => ({
                        type: "text",
                        text: v,
                      })),
                    },
                  ]
                : [],
          },
        }),
        signal: ac.signal,
      });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* keep raw */
      }
      if (!res.ok) {
        if (res.status === 429) {
          return { ok: false, reason: "rate-limit", status: 429, body };
        }
        logger.error(
          {
            url,
            status: res.status,
            body,
            templateName: input.templateName,
            source: "whatsapp:client",
          },
          "enviarTemplate: API error",
        );
        return { ok: false, reason: "api-error", status: res.status, body };
      }
      const data = body as { messages?: Array<{ id: string }> };
      const messageId = data.messages?.[0]?.id;
      if (!messageId) {
        return { ok: false, reason: "api-error", status: res.status, body };
      }
      return { ok: true, messageId };
    } catch (err) {
      logger.error(
        { err, templateName: input.templateName, source: "whatsapp:client" },
        "enviarTemplate: fetch falló",
      );
      return { ok: false, reason: "fetch-error" };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Marca un mensaje recibido del usuario como "leído". No-op si el cliente
   * no está configurado.
   */
  async marcarLeido(messageId: string): Promise<void> {
    if (!this.cfg) return;
    const url = `https://graph.facebook.com/${API_VERSION}/${this.cfg.phoneNumberId}/messages`;
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      });
    } catch (err) {
      logger.warn(
        { err, source: "whatsapp:client" },
        "marcarLeido: fetch falló (descartado)",
      );
    }
  }

  /**
   * Handshake inicial del webhook (GET con `hub.verify_token`). Devuelve el
   * `hub.challenge` si todo coincide, null en caso contrario.
   */
  verifyToken(query: {
    mode: string | null;
    token: string | null;
    challenge: string | null;
  }): string | null {
    if (!this.cfg?.verifyToken) return null;
    if (
      query.mode === "subscribe" &&
      query.token === this.cfg.verifyToken &&
      typeof query.challenge === "string"
    ) {
      return query.challenge;
    }
    return null;
  }

  /**
   * Verifica la firma X-Hub-Signature-256 de un webhook entrante. La firma
   * es `sha256=<hex>`. Si no está configurado el app secret, retorna false
   * (la regla 15 del CLAUDE.md exige firma válida o 401).
   */
  async verificarFirmaWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<boolean> {
    if (!signature || !this.cfg?.appSecret) return false;
    const sigBody = signature.replace(/^sha256=/, "");
    const expected = await hmacSha256Hex(this.cfg.appSecret, rawBody);
    return timingSafeEqualHex(expected, sigBody);
  }
}

/**
 * Normaliza un teléfono E.164 al formato esperado por WhatsApp Cloud API:
 * dígitos sin `+`. `+51999999999` → `51999999999`.
 */
function normalizeTo(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/**
 * Verificación independiente de firma — útil en el route handler antes de
 * instanciar el cliente. Lee `WHATSAPP_APP_SECRET` del env.
 */
export async function verificarFirmaWhatsApp(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!signature || !secret) return false;
  const sigBody = signature.replace(/^sha256=/, "");
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqualHex(expected, sigBody);
}

/** True si las credenciales mínimas están configuradas. */
export function isWhatsAppConfigured(): boolean {
  return readConfig() !== null;
}
