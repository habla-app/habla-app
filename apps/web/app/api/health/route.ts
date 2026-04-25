// GET /api/health — health check público para Uptime Robot + Railway.
//
// Chequea en paralelo servicios críticos (Postgres, Redis) con timeout
// individual corto + timeout total de 3s. Resend y api-football solo
// verifican presencia de env var (sin llamadas externas para evitar
// rate limits y añadir latencia).
//
// Contrato con Uptime Robot: respuesta 200 contiene literalmente
// `"status":"ok"`. No cambiar el shape sin actualizar el monitor.
//
// Excluido del rate limit del middleware (ver middleware.ts).

import { prisma } from "@habla/db";
import { getRedis } from "@/lib/redis";
import { getBackupHealth } from "@/lib/services/backup.service";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckState =
  | "ok"
  | "error"
  | "configured"
  | "missing"
  | "stale"
  | "unconfigured";

interface HealthResponse {
  status: "ok" | "error";
  checks: {
    db: CheckState;
    redis: CheckState;
    resend: CheckState;
    apiFootball: CheckState;
    backup: CheckState;
  };
  // Diagnóstico — solo aparece cuando algo falla, para ayudar a
  // identificar la causa raíz desde la response sin tener que ir a
  // Railway logs.
  details?: {
    db?: string;
    redis?: string;
    backup?: string;
  };
  timestamp: string;
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json",
};

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), ms),
    ),
  ]);
}

interface CheckOutcome {
  state: CheckState;
  detail?: string;
}

async function checkDb(): Promise<CheckOutcome> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 1500, "db");
    return { state: "ok" };
  } catch (err) {
    const detail = (err as Error).message ?? "unknown";
    logger.warn({ err: detail }, "health: db check falló");
    return { state: "error", detail };
  }
}

async function checkRedis(): Promise<CheckOutcome> {
  const client = getRedis();
  if (!client) {
    const detail = process.env.REDIS_URL
      ? "getRedis() retornó null (init falló al boot)"
      : "REDIS_URL no configurada";
    return { state: "error", detail };
  }
  try {
    const res = await withTimeout(client.ping(), 2500, "redis");
    if (res === "PONG") return { state: "ok" };
    return { state: "error", detail: `PING devolvió '${res}' (esperado 'PONG')` };
  } catch (err) {
    const detail = (err as Error).message ?? "unknown";
    logger.warn({ err: detail }, "health: redis check falló");
    return { state: "error", detail };
  }
}

function checkEnv(key: string): CheckState {
  return process.env[key] ? "configured" : "missing";
}

export async function GET(): Promise<Response> {
  const started = Date.now();

  const overall = withTimeout(
    Promise.all([checkDb(), checkRedis()]),
    3000,
    "health",
  );

  let dbOutcome: CheckOutcome = { state: "error", detail: "not run" };
  let redisOutcome: CheckOutcome = { state: "error", detail: "not run" };
  try {
    [dbOutcome, redisOutcome] = await overall;
  } catch (err) {
    logger.error({ err: (err as Error).message }, "health: timeout global");
  }

  // Backup: lectura no-bloqueante del state in-memory. No hacemos llamada
  // a R2 acá — ya se hidrata al boot y se actualiza tras cada backup.
  // - 'ok'           → último backup ≤ 26h atrás
  // - 'stale'        → más de 26h sin backup exitoso (NO degrada el status
  //                    global porque DB/Redis siguen sirviendo tráfico)
  // - 'missing'      → R2 configurado pero nunca corrió (post-deploy
  //                    fresco, antes de la primera ventana 03:00 UTC)
  // - 'unconfigured' → R2 vars ausentes (dev local típicamente)
  const backup = getBackupHealth();

  const isOk = dbOutcome.state === "ok" && redisOutcome.state === "ok";
  const details: HealthResponse["details"] = {};
  if (dbOutcome.detail) details.db = dbOutcome.detail;
  if (redisOutcome.detail) details.redis = redisOutcome.detail;
  if (backup.state === "stale" && backup.lastSuccessAt) {
    details.backup = `último éxito hace ${backup.ageHours}h (${backup.lastSuccessAt})`;
  } else if (backup.state === "missing") {
    details.backup = "configurado pero sin backup exitoso aún";
  }

  const body: HealthResponse = {
    status: isOk ? "ok" : "error",
    checks: {
      db: dbOutcome.state,
      redis: redisOutcome.state,
      resend: checkEnv("RESEND_API_KEY"),
      apiFootball: checkEnv("API_FOOTBALL_KEY"),
      backup: backup.state,
    },
    ...(Object.keys(details).length > 0 ? { details } : {}),
    timestamp: new Date().toISOString(),
  };

  const status = isOk ? 200 : 503;
  const elapsedMs = Date.now() - started;

  if (!isOk) {
    logger.warn({ checks: body.checks, details, elapsedMs }, "health: degraded");
  } else if (backup.state === "stale") {
    // Backup stale es una alerta operacional aparte (ya disparamos a
    // Sentry desde el job), pero también lo logueamos a Railway para que
    // sea visible en los logs sin hacer cross-service.
    logger.warn(
      { backup, elapsedMs },
      "health: ok pero backup stale (>26h sin éxito)",
    );
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: NO_STORE_HEADERS,
  });
}
