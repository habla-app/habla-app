// sendEmail — helper de envío de emails React Email con retry (Lote H).
//
// Renderiza un componente React (template) a HTML inline-style y lo envía
// vía Resend con retry 3x backoff (1s/2s/4s). Reusa el cliente existente
// `enviarEmail` de `lib/services/email.service.ts` para la llamada
// HTTP al API de Resend (ya tiene fail-soft sin RESEND_API_KEY).
//
// Uso:
//   import { sendEmail } from "@/lib/email/send";
//   import { BienvenidaPremium } from "@/lib/email/templates";
//
//   await sendEmail({
//     to: "user@example.com",
//     subject: BienvenidaPremium.subject,
//     react: <BienvenidaPremium nombre="Juan" plan="MENSUAL" ... />,
//     categoria: "premium",
//     tags: [{ name: "trigger", value: "premium_activado" }],
//   });

import { render } from "@react-email/components";
import type { ReactElement } from "react";

import { logger } from "@/lib/services/logger";
import { enviarEmail, type EmailResult } from "@/lib/services/email.service";
import { retryConBackoff } from "@/lib/utils/retry";
import { FROM_ADDRESSES, type EmailCategoria } from "./types";

export interface SendEmailOpts {
  to: string;
  subject: string;
  react: ReactElement;
  /** Categoría del email — selecciona el `from`. Default: "onboarding". */
  categoria?: EmailCategoria;
  /** Override manual del `from`. Si se setea, ignora `categoria`. */
  from?: string;
  /** Tags para tracking en Resend (opcional). */
  tags?: { name: string; value: string }[];
  /** Habilita retry. Default true. Útil deshabilitarlo en tests. */
  retry?: boolean;
}

/**
 * Renderiza el template React a HTML y envía vía Resend con retry.
 *
 * Retorna `EmailResult` (`{ ok, id?, skipped?, reason? }`) — los callers
 * deben tratar `skipped: true` (sin RESEND_API_KEY o NODE_ENV=test) como
 * éxito silencioso, no como error.
 */
export async function sendEmail(opts: SendEmailOpts): Promise<EmailResult> {
  const categoria = opts.categoria ?? "onboarding";
  const from = opts.from ?? FROM_ADDRESSES[categoria];
  const html = await render(opts.react);
  // text fallback: render plain-text variant para clients que prefieren
  // texto (ej: notificaciones push de algunos clientes mobile).
  const text = await render(opts.react, { plainText: true });

  const tags = opts.tags;

  const exec = (): Promise<EmailResult> =>
    enviarEmail({
      to: opts.to,
      subject: opts.subject,
      from,
      html,
      text,
    }).then((res) => {
      if (!res.ok) {
        // Reintentar si falló sin haber sido skipped (skipped no es error).
        throw Object.assign(
          new Error(`enviarEmail: ${res.reason ?? "unknown"}`),
          {
            __emailResult: res,
            __tags: tags,
          },
        );
      }
      return res;
    });

  if (opts.retry === false) {
    try {
      return await exec();
    } catch (err) {
      const r = (err as { __emailResult?: EmailResult }).__emailResult;
      if (r) return r;
      logger.error({ err, source: "email:send" }, "sendEmail: throw");
      return { ok: false, reason: "fetch-error" };
    }
  }

  try {
    return await retryConBackoff(exec, {
      intentos: 3,
      delayBaseMs: 1000,
      label: `sendEmail:${categoria}`,
    });
  } catch (err) {
    const r = (err as { __emailResult?: EmailResult }).__emailResult;
    if (r) return r;
    logger.error(
      { err, to: opts.to, subject: opts.subject, source: "email:send" },
      "sendEmail: agotó retries",
    );
    return { ok: false, reason: "fetch-error" };
  }
}
