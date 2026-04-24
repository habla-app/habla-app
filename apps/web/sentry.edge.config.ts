// Sentry config — Edge runtime (middleware).
//
// El Edge runtime es un subset restringido — Sentry usa su SDK específico
// con fetch-based transport. Se inicializa solo si `SENTRY_DSN` está
// presente.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend(event, hint) {
      const err = hint?.originalException as
        | { name?: string; message?: string }
        | undefined;
      const message = err?.message ?? event.message ?? "";
      const name = err?.name ?? "";

      if (name === "AbortError") return null;
      if (/ERR_NETWORK|Failed to fetch/i.test(message)) return null;

      return event;
    },
  });
}
