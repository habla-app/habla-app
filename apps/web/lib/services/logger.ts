// Logger Pino para la capa de servicios. REGLA (CLAUDE.md §14): nunca
// `console.log` en el código — usar este logger.
//
// En dev: output pretty-printed (si pino-pretty está disponible); en prod:
// JSON estructurado para Railway / Sentry.
//
// Uso:
//   import { logger } from "@/lib/services/logger";
//   logger.info({ torneoId, usuarioId }, "inscripcion creada");
//   logger.warn({ err }, "import api-football fallo");

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: isDev ? "debug" : "info",
  base: {
    app: "habla-web",
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});
