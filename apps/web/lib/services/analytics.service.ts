// Servicio de analytics in-house — Lote 6 (May 2026).
//
// Reemplaza a PostHog (eliminado en Lote 1). Inserts fire-and-forget en
// `eventos_analitica` desde:
//   - el endpoint POST /api/v1/analytics/track (camino cliente);
//   - llamadas server-side directas (camino server, ej: signup_completed
//     desde el handler de POST /auth/signup ok).
//
// Privacidad — distinguir CLIENTE vs SERVIDOR:
//   - Camino cliente: `lib/analytics.ts:track()` consulta el toggle
//     "Analíticas" del cookie banner antes de hacer el POST. Si el
//     usuario lo desactivó, NO sale ni siquiera el request al endpoint.
//     El consent es la fuente de verdad.
//   - Camino servidor: cuando un handler invoca `track()` desde acá
//     (ej: signup_completed tras un POST exitoso), el toggle del cliente
//     se IGNORA. Razón: estos eventos son operativos y de producto,
//     decididos por nosotros, no por el usuario. Documentado para que
//     no se "filtre" un check en el handler por confusión.
//
// IP cruda nunca se persiste. Si por algún motivo se necesita (rate-limit
// avanzado o deduplicación), se puede hashear con `hashIpForRateLimit`,
// pero la tabla `eventos_analitica` no tiene columna para guardarla.

import { createHash } from "node:crypto";
import { prisma, Prisma } from "@habla/db";
import { logger } from "./logger";

export interface TrackInput {
  evento: string;
  /** Props arbitrarias del evento. Se serializan a JSONB. */
  props?: Record<string, unknown>;
  userId?: string;
  /** Opcional: NextRequest (o el shape mínimo que tenga `headers`). Si se
   *  pasa, extraemos pais/userAgent/referrer del header. */
  request?: { headers: Headers } | { headers: { get(name: string): string | null } };
  sessionId?: string;
  /** URL de la page o pathname. El cliente lo manda explícito. Server-side
   *  generalmente lo deja undefined. */
  pagina?: string;
}

/**
 * Inserta el evento en BD. Nunca tira: cualquier error se loggea con Pino
 * (que NO re-trigerea persistencia en log_errores: ese hook se ignora si
 * el source contiene "analytics" — ver logger.ts) y se descarta.
 *
 * Uso esperado: SIEMPRE como `void track(...)` o sin await — el caller no
 * debe bloquearse esperando la inserción.
 */
export async function track(input: TrackInput): Promise<void> {
  try {
    const headers = input.request ? toHeadersAdapter(input.request.headers) : null;
    const pais = headers ? extractCountry(headers) : null;
    const userAgent = headers ? headers.get("user-agent")?.slice(0, 500) ?? null : null;
    const referrer = headers ? headers.get("referer")?.slice(0, 500) ?? null : null;

    await prisma.eventoAnalitica.create({
      data: {
        evento: input.evento.slice(0, 100),
        userId: input.userId ?? null,
        sessionId: input.sessionId?.slice(0, 100) ?? null,
        props: input.props
          ? (input.props as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        pais,
        userAgent,
        pagina: input.pagina?.slice(0, 500) ?? null,
        referrer,
      },
    });
  } catch (err) {
    // Source `analytics:track` para que el hook del logger NO lo persista
    // (evita ciclos si la BD se cae justo cuando trackeamos).
    logger.warn(
      { err, evento: input.evento, source: "analytics:track" },
      "track: persistencia falló (descartado)",
    );
  }
}

// ---------------------------------------------------------------------------
// Headers helpers (Cloudflare proxy + fallbacks)
// ---------------------------------------------------------------------------

interface HeadersLike {
  get(name: string): string | null;
}

function toHeadersAdapter(h: Headers | { get(name: string): string | null }): HeadersLike {
  return h as HeadersLike;
}

/**
 * ISO 3166-1 alpha-2 del país de origen. Detecta:
 *   - cf-ipcountry (Cloudflare proxy — caso prod de habla)
 *   - x-vercel-ip-country (por compatibilidad si en algún momento se usa Vercel)
 *   - x-country (header genérico que algunos proxies setean)
 * Si nada matchea, devuelve null.
 */
function extractCountry(headers: HeadersLike): string | null {
  const cf = headers.get("cf-ipcountry");
  if (cf && cf !== "XX") return cf.toUpperCase().slice(0, 2);
  const vercel = headers.get("x-vercel-ip-country");
  if (vercel) return vercel.toUpperCase().slice(0, 2);
  const generic = headers.get("x-country");
  if (generic) return generic.toUpperCase().slice(0, 2);
  return null;
}

/**
 * Extrae la IP del cliente respetando el proxy de Cloudflare. Devuelve
 * "unknown" si no hay nada útil — el caller debe poder convivir con eso
 * (ej: rate-limit aún funciona, todos los anónimos comparten una key).
 *
 * Exportada porque el endpoint /api/v1/analytics/track la usa para la key
 * del rate-limit (60/min por IP).
 */
export function extractClientIp(headers: HeadersLike): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * SHA-256 hex de una IP. No se persiste en `eventos_analitica`, pero está
 * disponible si en el futuro queremos deduplicar bursts del mismo origen
 * sin retener IP cruda.
 */
export function hashIpForRateLimit(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Lectura — alimentan /admin/dashboard
// ---------------------------------------------------------------------------

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

/**
 * Visitas únicas por sessionId/usuario por día (hash + agrupado en SQL).
 * Devuelve serie temporal apta para gráfico simple del dashboard.
 */
export async function obtenerVisitasPorDia(
  rango: RangoFechas,
): Promise<Array<{ dia: string; visitas: number }>> {
  // Postgres date_trunc + count distinct — Prisma no tiene helper nativo
  // para esto, vamos con $queryRaw. La columna es `creadoEn` (camelCase
  // mapeado tal cual desde el schema, no `creado_en`).
  const rows = await prisma.$queryRaw<Array<{ dia: Date; visitas: bigint }>>(
    Prisma.sql`
      SELECT date_trunc('day', "creadoEn") AS dia,
             COUNT(DISTINCT COALESCE("sessionId", "userId", id)) AS visitas
      FROM eventos_analitica
      WHERE evento = '$pageview'
        AND "creadoEn" >= ${rango.desde}
        AND "creadoEn" <= ${rango.hasta}
      GROUP BY date_trunc('day', "creadoEn")
      ORDER BY dia ASC
    `,
  );
  return rows.map((r) => ({
    dia: r.dia.toISOString().slice(0, 10),
    visitas: Number(r.visitas),
  }));
}

/**
 * Top 20 eventos por count en el rango dado.
 */
export async function obtenerEventosTopPeriodo(
  rango: RangoFechas,
): Promise<Array<{ evento: string; count: number }>> {
  const grupos = await prisma.eventoAnalitica.groupBy({
    by: ["evento"],
    where: { creadoEn: { gte: rango.desde, lte: rango.hasta } },
    _count: { _all: true },
    orderBy: { _count: { evento: "desc" } },
    take: 20,
  });
  return grupos.map((g) => ({ evento: g.evento, count: g._count._all }));
}

/**
 * Conteo de usuarios únicos que dispararon CADA evento del array, en el
 * rango dado. Para construir el funnel del dashboard:
 *   $pageview → signup_completed → prediccion_enviada → casa_click_afiliado
 *
 * Cada paso cuenta usuarios únicos por sessionId (preferido) o userId
 * (cuando hay sesión). NO valida orden cronológico estricto: si en el
 * rango el usuario hizo los 4 pasos, cuenta en los 4. Es una "pirámide
 * de exposición", no un funnel temporal estricto. Para algo más fino
 * habría que persistir la secuencia, fuera de scope del Lote 6.
 */
export async function obtenerFunnelConversion(
  rango: RangoFechas,
  eventos: string[],
): Promise<Array<{ evento: string; usuarios: number }>> {
  if (eventos.length === 0) return [];

  const filas: Array<{ evento: string; usuarios: number }> = [];
  for (const evento of eventos) {
    const rows = await prisma.$queryRaw<Array<{ usuarios: bigint }>>(
      Prisma.sql`
        SELECT COUNT(DISTINCT COALESCE("sessionId", "userId", id)) AS usuarios
        FROM eventos_analitica
        WHERE evento = ${evento}
          AND "creadoEn" >= ${rango.desde}
          AND "creadoEn" <= ${rango.hasta}
      `,
    );
    filas.push({ evento, usuarios: Number(rows[0]?.usuarios ?? 0) });
  }
  return filas;
}

/**
 * Registros nuevos por día (basado en `signup_completed`). Útil para la
 * card "Registros / día" del dashboard.
 */
export async function obtenerRegistrosPorDia(
  rango: RangoFechas,
): Promise<Array<{ dia: string; registros: number }>> {
  const rows = await prisma.$queryRaw<Array<{ dia: Date; registros: bigint }>>(
    Prisma.sql`
      SELECT date_trunc('day', "creadoEn") AS dia,
             COUNT(*) AS registros
      FROM eventos_analitica
      WHERE evento = 'signup_completed'
        AND "creadoEn" >= ${rango.desde}
        AND "creadoEn" <= ${rango.hasta}
      GROUP BY date_trunc('day', "creadoEn")
      ORDER BY dia ASC
    `,
  );
  return rows.map((r) => ({
    dia: r.dia.toISOString().slice(0, 10),
    registros: Number(r.registros),
  }));
}
