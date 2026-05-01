// OpenPay BBVA adapter — Lote E (May 2026).
//
// Wrapper directo sobre la REST API de OpenPay (sin SDK npm) por consistencia
// con `email.service.ts` (que usa la REST API de Resend con `fetch`). Razones:
//   - El SDK oficial de OpenPay (`openpay`) está desactualizado y arrastra
//     dependencias inestables.
//   - REST + fetch nos da control total sobre headers, timeouts y errores.
//   - El contrato de OpenPay es estable; los endpoints que usamos son simples.
//
// Endpoints docs: https://www.openpay.pe/docs/api/
//
// Auth: Basic Auth con `OPENPAY_PRIVATE_KEY` como user (sin password). El
// header se construye con `Buffer.from('priv_key:').toString('base64')`.
//
// Ambientes:
//   - sandbox.openpay.pe (cuando OPENPAY_PRODUCTION !== 'true')
//   - api.openpay.pe   (cuando OPENPAY_PRODUCTION === 'true')
//
// Cero datos de tarjeta: tokenizamos en client-side con OpenPay.js, y aquí
// solo recibimos `tokenTarjeta` + `deviceSessionId`. Nunca PAN/CVV.
//
// Verificación de firma de webhook: HMAC-SHA256 del raw body con
// `OPENPAY_WEBHOOK_SECRET`. Comparación constant-time.

import { logger } from "@/lib/services/logger";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/utils/hmac";

import {
  OPENPAY_PLAN_IDS,
  type CrearCobroUnicoInput,
  type CrearCobroUnicoResult,
  type CrearSuscripcionInput,
  type CrearSuscripcionResult,
  type PasarelaPagos,
} from "./types";

const SANDBOX_URL = "https://sandbox-api.openpay.pe/v1";
const PRODUCTION_URL = "https://api.openpay.pe/v1";
const FETCH_TIMEOUT_MS = 30_000;

interface OpenPayConfig {
  merchantId: string;
  privateKey: string;
  production: boolean;
  webhookSecret: string | null;
}

function readConfig(): OpenPayConfig | null {
  const merchantId = process.env.OPENPAY_MERCHANT_ID;
  const privateKey = process.env.OPENPAY_PRIVATE_KEY;
  if (!merchantId || !privateKey) return null;
  return {
    merchantId,
    privateKey,
    production: process.env.OPENPAY_PRODUCTION === "true",
    webhookSecret: process.env.OPENPAY_WEBHOOK_SECRET ?? null,
  };
}

export class OpenPayNoConfigurado extends Error {
  constructor() {
    super(
      "OpenPay no está configurado. Setear OPENPAY_MERCHANT_ID y OPENPAY_PRIVATE_KEY en Railway.",
    );
    this.name = "OpenPayNoConfigurado";
  }
}

export class OpenPayAdapter implements PasarelaPagos {
  private cfg: OpenPayConfig;
  private baseUrl: string;
  private authHeader: string;

  constructor() {
    const cfg = readConfig();
    if (!cfg) {
      throw new OpenPayNoConfigurado();
    }
    this.cfg = cfg;
    this.baseUrl = cfg.production ? PRODUCTION_URL : SANDBOX_URL;
    // OpenPay auth: Basic con privateKey:'' (password vacío). Usamos `btoa`
    // (Web API) en vez de `Buffer.from` para no arrastrar imports node:* al
    // edge bundle si algún caller transitivo termina ahí.
    this.authHeader =
      "Basic " + globalThis.btoa(`${cfg.privateKey}:`);
  }

  // -------------------------------------------------------------------------
  // HTTP helper
  // -------------------------------------------------------------------------

  private async request<T>(
    method: "GET" | "POST" | "DELETE" | "PUT",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}/${this.cfg.merchantId}${path}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });
      const textOrJson = await res.text();
      if (!res.ok) {
        let errBody: unknown = textOrJson;
        try {
          errBody = JSON.parse(textOrJson);
        } catch {
          /* keep raw text */
        }
        logger.error(
          { url, status: res.status, errBody, source: "openpay" },
          "OpenPay HTTP error",
        );
        throw new OpenPayApiError(
          `OpenPay ${method} ${path} falló: ${res.status}`,
          res.status,
          errBody,
        );
      }
      // 204 No Content (ej: cancelar suscripción)
      if (res.status === 204 || textOrJson.length === 0) {
        return undefined as T;
      }
      return JSON.parse(textOrJson) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // -------------------------------------------------------------------------
  // PasarelaPagos: cobro único
  // -------------------------------------------------------------------------

  async crearCobroUnico(
    _input: CrearCobroUnicoInput,
  ): Promise<CrearCobroUnicoResult> {
    // No usamos cobro único en Premium v3.1. Stub que falla explícito para
    // que cualquier caller futuro lo descubra rápido.
    throw new Error(
      "crearCobroUnico no implementado en OpenPayAdapter (Lote E solo cubre suscripciones)",
    );
  }

  // -------------------------------------------------------------------------
  // PasarelaPagos: suscripción recurrente
  // -------------------------------------------------------------------------

  async crearSuscripcion(
    input: CrearSuscripcionInput,
  ): Promise<CrearSuscripcionResult> {
    // 1) Reusar customer existente si existe (lookup por external_id) o crear.
    const customerId = await this.obtenerOCrearCustomer({
      usuarioId: input.usuarioId,
      nombre: input.nombre,
      email: input.email,
    });

    // 2) Asociar tarjeta tokenizada al customer.
    const card = await this.request<{ id: string }>(
      "POST",
      `/customers/${customerId}/cards`,
      {
        token_id: input.tokenTarjeta,
        device_session_id: input.deviceSessionId,
      },
    );

    // 3) Crear suscripción.
    const planId = OPENPAY_PLAN_IDS[input.plan];
    const sub = await this.request<{ id: string; status?: string }>(
      "POST",
      `/customers/${customerId}/subscriptions`,
      {
        plan_id: planId,
        source_id: card.id,
        // trial_end_date: null → primer cobro inmediato.
        trial_end_date: null,
      },
    );

    return {
      suscripcionId: sub.id,
      customerId,
      estado: sub.status === "active" ? "activa" : "pendiente",
    };
  }

  private async obtenerOCrearCustomer(input: {
    usuarioId: string;
    nombre: string;
    email: string;
  }): Promise<string> {
    // OpenPay permite filtrar customers por external_id en GET /customers.
    type CustomerListItem = { id: string; external_id?: string };
    const lookup = await this.request<CustomerListItem[]>(
      "GET",
      `/customers?external_id=${encodeURIComponent(input.usuarioId)}&limit=1`,
    );
    if (Array.isArray(lookup) && lookup.length > 0 && lookup[0]?.id) {
      return lookup[0].id;
    }
    const created = await this.request<{ id: string }>(
      "POST",
      `/customers`,
      {
        name: input.nombre,
        email: input.email,
        external_id: input.usuarioId,
        requires_account: false,
      },
    );
    return created.id;
  }

  async cancelarSuscripcion(suscripcionPasarelaId: string): Promise<void> {
    // OpenPay: DELETE /customers/{customer_id}/subscriptions/{id}. Pero el
    // customer_id se necesita explícitamente; lo obtenemos del subscription.
    const sub = await this.request<{ customer_id: string }>(
      "GET",
      `/subscriptions/${suscripcionPasarelaId}`,
    ).catch(() => null);
    if (!sub) {
      // Algunos planes solo aceptan DELETE con customer_id explícito; si el
      // GET falla, fallback al endpoint sin customer.
      await this.request("DELETE", `/subscriptions/${suscripcionPasarelaId}`);
      return;
    }
    await this.request(
      "DELETE",
      `/customers/${sub.customer_id}/subscriptions/${suscripcionPasarelaId}`,
    );
  }

  async reembolsar(cobroPasarelaId: string): Promise<void> {
    // Reembolso completo del charge (sin monto parcial — Premium garantía
    // 7 días reembolsa todo).
    await this.request("POST", `/charges/${cobroPasarelaId}/refund`, {});
  }

  // -------------------------------------------------------------------------
  // Verificación de firma del webhook
  // -------------------------------------------------------------------------

  async verificarFirmaWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<boolean> {
    if (!signature) return false;
    if (!this.cfg.webhookSecret) {
      logger.warn(
        { source: "openpay" },
        "verificarFirmaWebhook: OPENPAY_WEBHOOK_SECRET no configurado — firma no verificable",
      );
      return false;
    }
    const expected = await hmacSha256Hex(this.cfg.webhookSecret, rawBody);
    return timingSafeEqualHex(expected, signature);
  }
}

export class OpenPayApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "OpenPayApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Verificación independiente para el endpoint del webhook — no requiere
 * instanciar el adapter (útil cuando el webhook llega antes de que cualquier
 * suscripción exista). Lee `OPENPAY_WEBHOOK_SECRET` del env.
 */
export async function verificarFirmaOpenPay(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const secret = process.env.OPENPAY_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn(
      { source: "openpay" },
      "verificarFirmaOpenPay: OPENPAY_WEBHOOK_SECRET no configurado",
    );
    return false;
  }
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqualHex(expected, signature);
}

/**
 * `true` si las credenciales de OpenPay están seteadas. Usado por el endpoint
 * de checkout para fallback gracioso si el admin todavía no configuró las
 * vars en Railway.
 */
export function isOpenPayConfigured(): boolean {
  return readConfig() !== null;
}
