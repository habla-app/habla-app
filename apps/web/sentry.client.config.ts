// Sentry config — browser side. Se carga automáticamente por el wrapper
// `withSentryConfig` de `next.config.js` (ver webpack plugin).
//
// Se inicializa solo si `SENTRY_DSN` (o `NEXT_PUBLIC_SENTRY_DSN`) está
// presente — en dev local sin DSN no hacemos nada.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Capturar 0% de sesiones normales, 100% de las que tuvieron error.
    // Session replay requiere otra librería; desactivado por defecto.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event, hint) {
      const err = hint?.originalException as
        | { name?: string; message?: string; stack?: string }
        | undefined;
      const message = err?.message ?? event.message ?? "";
      const stack = err?.stack ?? "";
      const name = err?.name ?? "";

      // Ruido conocido: red inestable, abortos de fetch por navegación.
      if (name === "AbortError") return null;
      if (/ERR_NETWORK|Failed to fetch|Load failed/i.test(message)) return null;

      // Extensiones de navegador inyectando scripts.
      if (/chrome-extension:\/\/|moz-extension:\/\/|safari-extension:\/\//i.test(stack)) {
        return null;
      }

      return event;
    },
  });
}
