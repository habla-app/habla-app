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
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckState = "ok" | "error" | "configured" | "missing";

interface HealthResponse {
  status: "ok" | "error";
  checks: {
    db: CheckState;
    redis: CheckState;
    resend: CheckState;
    apiFootball: CheckState;
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

async function checkDb(): Promise<CheckState> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 1500, "db");
    return "ok";
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "health: db check falló");
    return "error";
  }
}

async function checkRedis(): Promise<CheckState> {
  const client = getRedis();
  if (!client) return "error";
  try {
    const res = await withTimeout(client.ping(), 1000, "redis");
    return res === "PONG" ? "ok" : "error";
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "health: redis check falló");
    return "error";
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

  let db: CheckState = "error";
  let redis: CheckState = "error";
  try {
    [db, redis] = await overall;
  } catch (err) {
    logger.error({ err: (err as Error).message }, "health: timeout global");
  }

  const body: HealthResponse = {
    status: db === "ok" && redis === "ok" ? "ok" : "error",
    checks: {
      db,
      redis,
      resend: checkEnv("RESEND_API_KEY"),
      apiFootball: checkEnv("API_FOOTBALL_KEY"),
    },
    timestamp: new Date().toISOString(),
  };

  const status = body.status === "ok" ? 200 : 503;
  const elapsedMs = Date.now() - started;

  if (body.status !== "ok") {
    logger.warn({ checks: body.checks, elapsedMs }, "health: degraded");
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: NO_STORE_HEADERS,
  });
}
