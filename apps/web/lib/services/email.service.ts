// Wrapper de envío de emails con Resend — Sub-Sprint 6.
//
// Lote E (May 2026): se exponen helpers tipados para los emails de Premium
// (bienvenida, renovación, fallo de pago, reembolso). Cada helper renderiza
// un template (templates.ts) y delega al `enviarEmail` genérico.
//
//
// Diseño:
//  - Usa la REST API de Resend directamente con `fetch` (NextAuth ya incluye
//    `next-auth/providers/resend` pero no expone su cliente). Así evitamos
//    agregar la dep `resend@*` al `package.json`.
//  - Dominio verificado: `hablaplay.com`. `from` default: "Habla! <equipo@hablaplay.com>".
//  - Modo dev: si `RESEND_API_KEY` no está seteada, NO revienta; loggea el email
//    "enviado" y retorna `{ skipped: true }`. El smoke local no requiere email real.
//  - Modo test: en vitest (NODE_ENV=test) siempre skippea — asertamos el call
//    via `lastEmailEnviado()` en tests unitarios.
//  - Respeto de preferencias: NO se chequean acá; es responsabilidad del caller
//    leer `PreferenciasNotif` antes de llamar `enviarEmail`. Patrón en §14.

import { logger } from "./logger";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Habla! <equipo@hablaplay.com>";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailResult {
  ok: boolean;
  id?: string;
  skipped?: true;
  reason?: string;
}

// Test doubles: en tests capturamos el email sin hacer network.
type EmailSink = EmailPayload[];
const testSink: EmailSink = [];

/** Devuelve los emails capturados en tests (solo para vitest). */
export function __peekTestEmails(): ReadonlyArray<EmailPayload> {
  return testSink;
}
/** Limpia el sink de tests (solo para vitest). */
export function __resetTestEmails(): void {
  testSink.length = 0;
}

export async function enviarEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const isTest = process.env.NODE_ENV === "test";

  if (isTest) {
    testSink.push(payload);
    return { ok: true, skipped: true, reason: "test-env" };
  }

  if (!apiKey) {
    logger.warn(
      { to: payload.to, subject: payload.subject },
      "email skipped: RESEND_API_KEY no configurada (modo dev)",
    );
    return { ok: true, skipped: true, reason: "no-api-key" };
  }

  try {
    const resp = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: payload.from ?? DEFAULT_FROM,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      logger.error(
        { status: resp.status, errBody, to: payload.to, subject: payload.subject },
        "enviarEmail: Resend respondió error",
      );
      return { ok: false, reason: `resend-error-${resp.status}` };
    }

    const data = (await resp.json()) as { id?: string };
    logger.info(
      { id: data.id, to: payload.to, subject: payload.subject },
      "email enviado",
    );
    return { ok: true, id: data.id };
  } catch (err) {
    logger.error({ err, to: payload.to, subject: payload.subject }, "enviarEmail: throw");
    return { ok: false, reason: "fetch-error" };
  }
}

// ---------------------------------------------------------------------------
// Lote E (May 2026) — Helpers tipados para emails de Premium
// ---------------------------------------------------------------------------

import {
  bienvenidaPremiumTemplate,
  falloPagoPremiumTemplate,
  reembolsoPremiumTemplate,
  renovacionPremiumTemplate,
  type BienvenidaPremiumInput,
  type FalloPagoPremiumInput,
  type ReembolsoPremiumInput,
  type RenovacionPremiumInput,
} from "@/lib/emails/templates";

const PREMIUM_FROM = "Habla! Premium <premium@hablaplay.com>";

/** Email de bienvenida tras la primera activación de la suscripción. */
export async function enviarEmailBienvenidaPremium(input: {
  email: string;
  nombre: string;
  plan: "MENSUAL" | "TRIMESTRAL" | "ANUAL";
  proximoCobro: Date;
}): Promise<EmailResult> {
  const channelLink = process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK ?? null;
  const tpl = bienvenidaPremiumTemplate({
    nombre: input.nombre,
    plan: input.plan,
    proximoCobro: input.proximoCobro,
    channelLink,
  } satisfies BienvenidaPremiumInput);
  return enviarEmail({
    to: input.email,
    from: PREMIUM_FROM,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

/** Email de cobro recurrente acreditado. */
export async function enviarEmailRenovacion(input: {
  email: string;
  nombre: string;
  plan: "MENSUAL" | "TRIMESTRAL" | "ANUAL";
  proximoCobro: Date;
  monto: number; // céntimos de soles
}): Promise<EmailResult> {
  const tpl = renovacionPremiumTemplate({
    nombre: input.nombre,
    plan: input.plan,
    proximoCobro: input.proximoCobro,
    monto: input.monto,
  } satisfies RenovacionPremiumInput);
  return enviarEmail({
    to: input.email,
    from: PREMIUM_FROM,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

/** Email de reembolso procesado tras pedido en garantía 7 días. */
export async function enviarEmailReembolso(input: {
  email: string;
  nombre: string;
  monto: number;
}): Promise<EmailResult> {
  const tpl = reembolsoPremiumTemplate({
    nombre: input.nombre,
    monto: input.monto,
  } satisfies ReembolsoPremiumInput);
  return enviarEmail({
    to: input.email,
    from: PREMIUM_FROM,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

/** Email cuando el pago (primer cobro o renovación) falla definitivamente. */
export async function enviarEmailFalloPago(input: {
  email: string;
  nombre: string;
  motivo: string;
}): Promise<EmailResult> {
  const tpl = falloPagoPremiumTemplate({
    nombre: input.nombre,
    motivo: input.motivo,
  } satisfies FalloPagoPremiumInput);
  return enviarEmail({
    to: input.email,
    from: PREMIUM_FROM,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}
