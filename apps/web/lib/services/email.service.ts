// Wrapper de envío de emails con Resend — Sub-Sprint 6.
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
