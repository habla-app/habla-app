// Logger Pino para la capa de servicios. REGLA (CLAUDE.md §14): nunca
// `console.log` en el código — usar este logger.
//
// En dev: output pretty-printed (si pino-pretty está disponible); en prod:
// JSON estructurado para stdout de Railway.
//
// Lote 6 (May 2026): además de stdout, los niveles `error` (50) y `fatal`
// (60) se persisten async en `log_errores` (Postgres) vía
// `logsService.registrarError()`. Esto reemplaza a Sentry. La inserción
// es fire-and-forget — si la BD se cae, el log SE PIERDE pero el request
// del usuario nunca se rompe. Anti-recursión: si el `source` del meta
// contiene "analytics" o "logs", se SKIPPEA la persistencia (eso evita
// loops si la persistencia misma falla).
//
// Mapeo de niveles Pino → log_errores.level:
//   error (50) → "error"
//   fatal (60) → "critical"     ← cron M busca este nivel para alertar
//
// `warn` (40) NO se persiste por defecto — si querés que un warn
// específico sí se guarde, llamá `registrarError({ level: "warn", ... })`
// directo desde el service. La regla es: el logger no decide qué warns
// son importantes, vos sí.
//
// Uso (sin cambios respecto a antes del Lote 6):
//   import { logger } from "@/lib/services/logger";
//   logger.info({ torneoId, usuarioId }, "inscripcion creada");
//   logger.warn({ err }, "import api-football fallo");
//   logger.error({ err, source: "api:tickets" }, "POST /tickets falló");
//   logger.fatal({ err, source: "cron:backup" }, "backup falló por 3er día");

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

// Persistencia async fire-and-forget. Importación lazy para evitar ciclos
// (logs.service → @habla/db → ... → logger → logs.service). El primer
// llamado paga la resolución; los siguientes vienen del module cache.
let registrarErrorRef:
  | ((input: {
      level: "warn" | "error" | "critical";
      source: string;
      message: string;
      error?: unknown;
      metadata?: Record<string, unknown>;
      userId?: string;
    }) => Promise<void>)
  | null = null;

async function getRegistrarError() {
  if (registrarErrorRef) return registrarErrorRef;
  const mod = await import("./logs.service");
  registrarErrorRef = mod.registrarError;
  return registrarErrorRef;
}

function persistAsync(
  level: "error" | "critical",
  args: ReadonlyArray<unknown>,
): void {
  // Estructura de args en Pino: ({obj}, "msg") o ("msg") o ({obj, msg: "msg"}).
  const first = args[0];
  const second = args[1];

  let metadata: Record<string, unknown> = {};
  let message = "";

  if (typeof first === "object" && first !== null) {
    metadata = { ...(first as Record<string, unknown>) };
    if (typeof second === "string") {
      message = second;
    } else if (typeof metadata.msg === "string") {
      message = metadata.msg;
      delete metadata.msg;
    }
  } else if (typeof first === "string") {
    message = first;
  }

  // Anti-recursión: si el source del log es la propia maquinaria de
  // logs/analytics, NO persistir. Evita loops si Postgres se cae justo
  // mientras analytics intenta loggear el fallo.
  const source =
    typeof metadata.source === "string" ? (metadata.source as string) : "logger";
  if (source.startsWith("analytics") || source.startsWith("logs")) return;

  const error = (metadata as { err?: unknown; error?: unknown }).err
    ?? (metadata as { err?: unknown; error?: unknown }).error;

  const userId =
    typeof metadata.userId === "string" ? (metadata.userId as string) : undefined;

  // Limpiamos metadata para no duplicar (err se serializa como `stack`).
  delete (metadata as { err?: unknown }).err;
  delete (metadata as { error?: unknown }).error;
  delete (metadata as { userId?: unknown }).userId;
  delete (metadata as { source?: unknown }).source;

  void getRegistrarError().then((fn) =>
    fn({
      level,
      source,
      message: message || "(sin mensaje)",
      error,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      userId,
    }).catch(() => {
      // logs.service ya hace su propio console.error — no duplicamos.
    }),
  );
}

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
  hooks: {
    // logMethod corre ANTES del write a stdout. Llamamos al método
    // original primero (preserva el formato JSON nativo) y, después,
    // disparamos la persistencia async para los niveles relevantes.
    logMethod(args, method, levelNum) {
      // Cast vía unknown a `Parameters<typeof method>` — Pino tipa `args`
      // como tuple variádica que TS no acepta directo en .apply.
      method.apply(this, args as unknown as Parameters<typeof method>);
      // Pino levels: trace=10, debug=20, info=30, warn=40, error=50, fatal=60.
      if (levelNum >= 60) {
        persistAsync("critical", args);
      } else if (levelNum >= 50) {
        persistAsync("error", args);
      }
    },
  },
});
