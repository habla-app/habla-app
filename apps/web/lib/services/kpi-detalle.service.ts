// kpi-detalle.service.ts — Drill-down de un KPI individual. Lote G.
//
// Alimenta /admin/kpis?metric=<id>: histórico de N días + breakdown por
// dimensión + comparación contra el periodo anterior + status semáforo.
//
// Implementación:
//   - histórico: serie temporal granular del KPI (cliente lo grafica con SVG).
//   - breakdown: por dimensión principal del KPI (liga / casa / plan / source).
//   - comparación: dual-line chart contra el mismo rango previo.
//
// Datos faltantes (KPI marcado pendienteCableado) → arrays vacíos +
// status="neutral". La vista renderea fallback ("Pendiente de cableado")
// sin romper.
//
// Cache: TTL 5-15 min (regla del spec). Implementación in-memory por
// proceso (Map global). Si en el futuro hace falta multi-réplica, mover a
// Redis. Para 1 réplica + TTL corto, in-memory es lo más simple.

import { prisma, Prisma } from "@habla/db";
import {
  obtenerKPIPorId,
  type KPIMeta,
  type FormatoKPI,
} from "./kpis-metadata";

export type RangoDetalle = "7d" | "30d" | "90d" | "365d";

export type StatusKPI = "good" | "amber" | "red" | "neutral";

export interface KPIDetalleHeader {
  id: string;
  label: string;
  formato: FormatoKPI;
  target: number | null;
  targetLabel?: string;
  status: StatusKPI;
  valorActual: number | null;
  valorAnterior: number | null;
  /** Diferencia porcentual vs periodo anterior. null si no hay anterior. */
  cambioPct: number | null;
  /** Texto descriptivo del KPI. */
  descripcion: string;
  pendienteCableado: boolean;
}

export interface PuntoTemporal {
  fecha: string;     // YYYY-MM-DD
  valor: number;
}

export interface FilaBreakdown {
  dimension: string;       // "Premier League" | "Betano" | etc.
  valor: number;
  /** % de contribución al total del periodo (0-100). */
  contribucionPct: number;
  /** Tendencia vs periodo anterior. null si no hay anterior. */
  cambioPct: number | null;
}

export interface KPIDetalle {
  meta: KPIMeta;
  header: KPIDetalleHeader;
  rango: RangoDetalle;
  /** Serie temporal del periodo actual. */
  historico: PuntoTemporal[];
  /** Serie temporal del periodo anterior alineada por offset. */
  historicoAnterior: PuntoTemporal[];
  /** Breakdown por dimensión principal del KPI. Vacío si no aplica. */
  breakdown: FilaBreakdown[];
}

// ---------------------------------------------------------------------------
// Cache simple en memoria por proceso
// ---------------------------------------------------------------------------

interface CacheEntry {
  expiresAt: number;
  data: KPIDetalle;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function cacheKey(metricId: string, rango: RangoDetalle): string {
  return `${metricId}::${rango}`;
}

function getCached(key: string): KPIDetalle | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: KPIDetalle): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rangoEnDias(rango: RangoDetalle): number {
  if (rango === "7d") return 7;
  if (rango === "30d") return 30;
  if (rango === "90d") return 90;
  return 365;
}

function granularidad(rango: RangoDetalle): "day" | "week" | "month" {
  if (rango === "7d" || rango === "30d") return "day";
  if (rango === "90d") return "week";
  return "month";
}

function statusVsTarget(
  valor: number | null,
  meta: KPIMeta,
): StatusKPI {
  if (valor === null) return "neutral";
  if (meta.target === null) {
    return "good";
  }
  if (meta.modo === "mayor_es_mejor") {
    if (valor >= meta.target) return "good";
    if (valor >= meta.target * 0.8) return "amber";
    return "red";
  }
  if (valor <= meta.target) return "good";
  if (valor <= meta.target * 1.2) return "amber";
  return "red";
}

function cambioPct(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null) return null;
  if (anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

function rangoFechas(rango: RangoDetalle, hasta: Date = new Date()): {
  desde: Date;
  hasta: Date;
  desdeAnterior: Date;
  hastaAnterior: Date;
} {
  const dias = rangoEnDias(rango);
  const desde = new Date(hasta.getTime() - dias * 24 * 60 * 60 * 1000);
  const desdeAnterior = new Date(desde.getTime() - dias * 24 * 60 * 60 * 1000);
  return { desde, hasta, desdeAnterior, hastaAnterior: desde };
}

// ---------------------------------------------------------------------------
// Histórico — serie temporal por evento del KPI
// ---------------------------------------------------------------------------

async function serieTemporalEventos(
  evento: string,
  desde: Date,
  hasta: Date,
  gran: "day" | "week" | "month",
): Promise<PuntoTemporal[]> {
  const truncFn = gran;
  const rows = await prisma.$queryRaw<Array<{ bucket: Date; valor: bigint }>>(
    Prisma.sql`
      SELECT date_trunc(${truncFn}, "creadoEn") AS bucket,
             COUNT(*)::bigint AS valor
      FROM eventos_analitica
      WHERE evento = ${evento}
        AND "creadoEn" >= ${desde}
        AND "creadoEn" <= ${hasta}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
  );
  return rows.map((r) => ({
    fecha: r.bucket.toISOString().slice(0, 10),
    valor: Number(r.valor),
  }));
}

async function serieVisitasUnicas(
  desde: Date,
  hasta: Date,
  gran: "day" | "week" | "month",
): Promise<PuntoTemporal[]> {
  const rows = await prisma.$queryRaw<Array<{ bucket: Date; valor: bigint }>>(
    Prisma.sql`
      SELECT date_trunc(${gran}, "creadoEn") AS bucket,
             COUNT(DISTINCT COALESCE("sessionId", "userId", id)) AS valor
      FROM eventos_analitica
      WHERE evento = '$pageview'
        AND "creadoEn" >= ${desde}
        AND "creadoEn" <= ${hasta}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
  );
  return rows.map((r) => ({
    fecha: r.bucket.toISOString().slice(0, 10),
    valor: Number(r.valor),
  }));
}

// ---------------------------------------------------------------------------
// Cálculo del KPI por id
// ---------------------------------------------------------------------------

async function calcularValorKPI(
  metricId: string,
  desde: Date,
  hasta: Date,
): Promise<number | null> {
  if (metricId === "visitantes_unicos") {
    const rows = await prisma.$queryRaw<Array<{ valor: bigint }>>(
      Prisma.sql`
        SELECT COUNT(DISTINCT COALESCE("sessionId", "userId", id)) AS valor
        FROM eventos_analitica
        WHERE evento = '$pageview' AND "creadoEn" >= ${desde} AND "creadoEn" <= ${hasta}
      `,
    );
    return Number(rows[0]?.valor ?? 0);
  }

  if (metricId === "registros_nuevos") {
    return prisma.eventoAnalitica.count({
      where: { evento: "signup_completed", creadoEn: { gte: desde, lte: hasta } },
    });
  }

  if (metricId === "conv_visita_registro") {
    const [visitas, registros] = await Promise.all([
      calcularValorKPI("visitantes_unicos", desde, hasta),
      calcularValorKPI("registros_nuevos", desde, hasta),
    ]);
    if (visitas === null || !visitas) return 0;
    if (registros === null) return 0;
    return Math.round((registros / visitas) * 1000) / 10;
  }

  if (metricId === "vistas_partido_dia") {
    const total = await prisma.eventoAnalitica.count({
      where: { evento: "partido_visto", creadoEn: { gte: desde, lte: hasta } },
    });
    const dias = Math.max(
      1,
      Math.round((hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24)),
    );
    return Math.round(total / dias);
  }

  if (metricId === "predicciones_partido") {
    const [tickets, partidos] = await Promise.all([
      prisma.ticket.count({ where: { creadoEn: { gte: desde, lte: hasta } } }),
      prisma.partido.count({ where: { fechaInicio: { gte: desde, lte: hasta } } }),
    ]);
    if (!partidos) return 0;
    return Math.round(tickets / partidos);
  }

  if (metricId === "tipsters_activos") {
    const [usuariosConTickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where: { creadoEn: { gte: desde, lte: hasta } },
        select: { usuarioId: true },
        distinct: ["usuarioId"],
      }),
      prisma.usuario.count({ where: { creadoEn: { lte: hasta } } }),
    ]);
    if (!total) return 0;
    return Math.round((usuariosConTickets.length / total) * 1000) / 10;
  }

  if (metricId === "ctr_afiliados") {
    const [clicks, visitas] = await Promise.all([
      prisma.clickAfiliado.count({
        where: { creadoEn: { gte: desde, lte: hasta } },
      }),
      calcularValorKPI("visitantes_unicos", desde, hasta),
    ]);
    if (!visitas) return 0;
    return Math.round((clicks / visitas) * 1000) / 10;
  }

  if (metricId === "click_a_registro_casa") {
    const [clicks, registros] = await Promise.all([
      prisma.clickAfiliado.count({
        where: { creadoEn: { gte: desde, lte: hasta } },
      }),
      prisma.conversionAfiliado.count({
        where: {
          tipo: "REGISTRO",
          reportadoEn: { gte: desde, lte: hasta },
        },
      }),
    ]);
    if (!clicks) return 0;
    return Math.round((registros / clicks) * 1000) / 10;
  }

  if (metricId === "free_a_premium") {
    const [activas, total] = await Promise.all([
      prisma.suscripcion.count({ where: { activa: true } }),
      prisma.usuario.count({ where: { creadoEn: { lte: hasta } } }),
    ]);
    if (!total) return 0;
    return Math.round((activas / total) * 1000) / 10;
  }

  if (metricId === "mrr_premium") {
    const susActivas = await prisma.suscripcion.findMany({
      where: { activa: true },
      select: { plan: true, precio: true },
    });
    const mrrCentimos = susActivas.reduce((acc, s) => {
      const meses = s.plan === "ANUAL" ? 12 : s.plan === "TRIMESTRAL" ? 3 : 1;
      return acc + Math.round(s.precio / meses);
    }, 0);
    return Math.round(mrrCentimos / 100);
  }

  if (metricId === "churn_mensual") {
    const [activas, canceladas] = await Promise.all([
      prisma.suscripcion.count({ where: { activa: true } }),
      prisma.suscripcion.count({
        where: { cancelada: true, canceladaEn: { gte: desde, lte: hasta } },
      }),
    ]);
    if (!(activas + canceladas)) return 0;
    return Math.round((canceladas / (activas + canceladas)) * 1000) / 10;
  }

  if (metricId === "revenue_periodo") {
    const pagos = await prisma.pagoSuscripcion.findMany({
      where: {
        estado: "PAGADO",
        acreditadoEn: { gte: desde, lte: hasta },
      },
      select: { monto: true },
    });
    return Math.round(pagos.reduce((acc, p) => acc + p.monto, 0) / 100);
  }

  // Engagement Channel: % unidos / activas
  if (metricId === "engagement_channel") {
    const [unidos, activas] = await Promise.all([
      prisma.miembroChannel.count({ where: { estado: "UNIDO" } }),
      prisma.suscripcion.count({ where: { activa: true } }),
    ]);
    if (!activas) return 0;
    return Math.round((unidos / activas) * 1000) / 10;
  }

  // KPIs pendientes de cableado: null
  return null;
}

// ---------------------------------------------------------------------------
// Histórico por KPI
// ---------------------------------------------------------------------------

async function serieTemporalKPI(
  metricId: string,
  desde: Date,
  hasta: Date,
  gran: "day" | "week" | "month",
): Promise<PuntoTemporal[]> {
  if (metricId === "visitantes_unicos") {
    return serieVisitasUnicas(desde, hasta, gran);
  }
  if (metricId === "registros_nuevos") {
    return serieTemporalEventos("signup_completed", desde, hasta, gran);
  }
  if (metricId === "vistas_partido_dia") {
    return serieTemporalEventos("partido_visto", desde, hasta, gran);
  }
  if (metricId === "ctr_afiliados") {
    // Serie de clicks afiliados por bucket
    const truncFn = gran;
    const rows = await prisma.$queryRaw<Array<{ bucket: Date; valor: bigint }>>(
      Prisma.sql`
        SELECT date_trunc(${truncFn}, "creadoEn") AS bucket,
               COUNT(*)::bigint AS valor
        FROM clicks_afiliados
        WHERE "creadoEn" >= ${desde} AND "creadoEn" <= ${hasta}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );
    return rows.map((r) => ({
      fecha: r.bucket.toISOString().slice(0, 10),
      valor: Number(r.valor),
    }));
  }
  if (metricId === "predicciones_partido") {
    const truncFn = gran;
    const rows = await prisma.$queryRaw<Array<{ bucket: Date; valor: bigint }>>(
      Prisma.sql`
        SELECT date_trunc(${truncFn}, "creadoEn") AS bucket,
               COUNT(*)::bigint AS valor
        FROM tickets
        WHERE "creadoEn" >= ${desde} AND "creadoEn" <= ${hasta}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );
    return rows.map((r) => ({
      fecha: r.bucket.toISOString().slice(0, 10),
      valor: Number(r.valor),
    }));
  }
  if (metricId === "revenue_periodo") {
    const truncFn = gran;
    const rows = await prisma.$queryRaw<
      Array<{ bucket: Date; valor: bigint }>
    >(
      Prisma.sql`
        SELECT date_trunc(${truncFn}, "acreditadoEn") AS bucket,
               COALESCE(SUM("monto"), 0)::bigint AS valor
        FROM pagos_suscripcion
        WHERE estado = 'PAGADO' AND "acreditadoEn" >= ${desde} AND "acreditadoEn" <= ${hasta}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );
    return rows.map((r) => ({
      fecha: r.bucket.toISOString().slice(0, 10),
      valor: Math.round(Number(r.valor) / 100),
    }));
  }

  // Para tipsters_activos, churn, mrr, conv_visita_registro: agregaciones
  // que requieren consultas más costosas por bucket. Por ahora devolvemos
  // un solo punto con el valor del periodo entero.
  const valor = await calcularValorKPI(metricId, desde, hasta);
  if (valor === null) return [];
  return [{ fecha: hasta.toISOString().slice(0, 10), valor }];
}

// ---------------------------------------------------------------------------
// Breakdown por dimensión
// ---------------------------------------------------------------------------

async function breakdownKPI(
  metricId: string,
  meta: KPIMeta,
  desde: Date,
  hasta: Date,
  desdeAnt: Date,
  hastaAnt: Date,
): Promise<FilaBreakdown[]> {
  if (!meta.dimensionPrincipal) return [];

  // Helper para construir filas con cambio vs periodo anterior
  function buildFilas(
    rowsActual: Array<{ key: string; valor: number }>,
    rowsAnt: Map<string, number>,
  ): FilaBreakdown[] {
    const totalActual = rowsActual.reduce((acc, r) => acc + r.valor, 0);
    return rowsActual
      .map((r) => ({
        dimension: r.key,
        valor: r.valor,
        contribucionPct:
          totalActual > 0 ? Math.round((r.valor / totalActual) * 1000) / 10 : 0,
        cambioPct: cambioPct(r.valor, rowsAnt.get(r.key) ?? null),
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 15);
  }

  if (meta.dimensionPrincipal === "casa") {
    if (metricId === "ctr_afiliados") {
      const [actual, anterior] = await Promise.all([
        prisma.clickAfiliado.groupBy({
          by: ["afiliadoId"],
          where: { creadoEn: { gte: desde, lte: hasta } },
          _count: { _all: true },
        }),
        prisma.clickAfiliado.groupBy({
          by: ["afiliadoId"],
          where: { creadoEn: { gte: desdeAnt, lte: hastaAnt } },
          _count: { _all: true },
        }),
      ]);
      const ids = Array.from(
        new Set([
          ...actual.map((r) => r.afiliadoId),
          ...anterior.map((r) => r.afiliadoId),
        ]),
      );
      const afiliados = await prisma.afiliado.findMany({
        where: { id: { in: ids } },
        select: { id: true, nombre: true },
      });
      const nombrePorId = new Map(afiliados.map((a) => [a.id, a.nombre]));
      const rowsAct = actual.map((r) => ({
        key: nombrePorId.get(r.afiliadoId) ?? "Sin nombre",
        valor: r._count._all,
      }));
      const mapAnt = new Map(
        anterior.map((r) => [
          nombrePorId.get(r.afiliadoId) ?? "Sin nombre",
          r._count._all,
        ]),
      );
      return buildFilas(rowsAct, mapAnt);
    }
    if (metricId === "click_a_registro_casa" || metricId === "registro_a_ftd") {
      const tipo = metricId === "click_a_registro_casa" ? "REGISTRO" : "FTD";
      const [actual, anterior] = await Promise.all([
        prisma.conversionAfiliado.groupBy({
          by: ["afiliadoId"],
          where: { tipo, reportadoEn: { gte: desde, lte: hasta } },
          _count: { _all: true },
        }),
        prisma.conversionAfiliado.groupBy({
          by: ["afiliadoId"],
          where: { tipo, reportadoEn: { gte: desdeAnt, lte: hastaAnt } },
          _count: { _all: true },
        }),
      ]);
      const ids = Array.from(
        new Set([
          ...actual.map((r) => r.afiliadoId),
          ...anterior.map((r) => r.afiliadoId),
        ]),
      );
      const afiliados = await prisma.afiliado.findMany({
        where: { id: { in: ids } },
        select: { id: true, nombre: true },
      });
      const nombrePorId = new Map(afiliados.map((a) => [a.id, a.nombre]));
      const rowsAct = actual.map((r) => ({
        key: nombrePorId.get(r.afiliadoId) ?? "Sin nombre",
        valor: r._count._all,
      }));
      const mapAnt = new Map(
        anterior.map((r) => [
          nombrePorId.get(r.afiliadoId) ?? "Sin nombre",
          r._count._all,
        ]),
      );
      return buildFilas(rowsAct, mapAnt);
    }
  }

  if (meta.dimensionPrincipal === "liga") {
    if (metricId === "predicciones_partido") {
      const [actual, anterior] = await Promise.all([
        prisma.$queryRaw<Array<{ liga: string; valor: bigint }>>(
          Prisma.sql`
            SELECT p.liga AS liga, COUNT(t.id)::bigint AS valor
            FROM tickets t
            INNER JOIN torneos tr ON t."torneoId" = tr.id
            INNER JOIN partidos p ON tr."partidoId" = p.id
            WHERE t."creadoEn" >= ${desde} AND t."creadoEn" <= ${hasta}
            GROUP BY p.liga
            ORDER BY valor DESC
            LIMIT 15
          `,
        ),
        prisma.$queryRaw<Array<{ liga: string; valor: bigint }>>(
          Prisma.sql`
            SELECT p.liga AS liga, COUNT(t.id)::bigint AS valor
            FROM tickets t
            INNER JOIN torneos tr ON t."torneoId" = tr.id
            INNER JOIN partidos p ON tr."partidoId" = p.id
            WHERE t."creadoEn" >= ${desdeAnt} AND t."creadoEn" <= ${hastaAnt}
            GROUP BY p.liga
          `,
        ),
      ]);
      const rowsAct = actual.map((r) => ({
        key: r.liga,
        valor: Number(r.valor),
      }));
      const mapAnt = new Map(anterior.map((r) => [r.liga, Number(r.valor)]));
      return buildFilas(rowsAct, mapAnt);
    }
    if (metricId === "vistas_partido_dia") {
      const [actual, anterior] = await Promise.all([
        prisma.$queryRaw<Array<{ liga: string; valor: bigint }>>(
          Prisma.sql`
            SELECT p.liga AS liga, COUNT(*)::bigint AS valor
            FROM eventos_analitica e
            LEFT JOIN partidos p ON p.id = (e.props->>'partidoId')
            WHERE e.evento = 'partido_visto'
              AND e."creadoEn" >= ${desde} AND e."creadoEn" <= ${hasta}
              AND p.liga IS NOT NULL
            GROUP BY p.liga
            ORDER BY valor DESC
            LIMIT 15
          `,
        ),
        prisma.$queryRaw<Array<{ liga: string; valor: bigint }>>(
          Prisma.sql`
            SELECT p.liga AS liga, COUNT(*)::bigint AS valor
            FROM eventos_analitica e
            LEFT JOIN partidos p ON p.id = (e.props->>'partidoId')
            WHERE e.evento = 'partido_visto'
              AND e."creadoEn" >= ${desdeAnt} AND e."creadoEn" <= ${hastaAnt}
              AND p.liga IS NOT NULL
            GROUP BY p.liga
          `,
        ),
      ]);
      const rowsAct = actual.map((r) => ({
        key: r.liga,
        valor: Number(r.valor),
      }));
      const mapAnt = new Map(anterior.map((r) => [r.liga, Number(r.valor)]));
      return buildFilas(rowsAct, mapAnt);
    }
  }

  if (meta.dimensionPrincipal === "plan") {
    if (metricId === "mrr_premium" || metricId === "revenue_periodo") {
      // MRR / Revenue por plan
      const susActivas = await prisma.suscripcion.findMany({
        where: { activa: true },
        select: { plan: true, precio: true },
      });
      const porPlan = new Map<string, number>();
      for (const s of susActivas) {
        const meses =
          s.plan === "ANUAL" ? 12 : s.plan === "TRIMESTRAL" ? 3 : 1;
        const aporte = Math.round(s.precio / meses / 100);
        porPlan.set(s.plan, (porPlan.get(s.plan) ?? 0) + aporte);
      }
      const rowsAct = Array.from(porPlan.entries()).map(([key, valor]) => ({
        key,
        valor,
      }));
      return buildFilas(rowsAct, new Map());
    }
    if (metricId === "churn_mensual") {
      const [actual, anterior] = await Promise.all([
        prisma.suscripcion.groupBy({
          by: ["plan"],
          where: {
            cancelada: true,
            canceladaEn: { gte: desde, lte: hasta },
          },
          _count: { _all: true },
        }),
        prisma.suscripcion.groupBy({
          by: ["plan"],
          where: {
            cancelada: true,
            canceladaEn: { gte: desdeAnt, lte: hastaAnt },
          },
          _count: { _all: true },
        }),
      ]);
      const rowsAct = actual.map((r) => ({
        key: r.plan,
        valor: r._count._all,
      }));
      const mapAnt = new Map(
        anterior.map((r) => [r.plan, r._count._all] as const),
      );
      return buildFilas(rowsAct, mapAnt);
    }
  }

  if (meta.dimensionPrincipal === "source") {
    // Source de tráfico (cf-ipcountry como proxy + UTM en props si existe)
    const rowsActual = await prisma.$queryRaw<
      Array<{ source: string; valor: bigint }>
    >(
      Prisma.sql`
        SELECT COALESCE(props->>'utm_source', referrer, 'direct') AS source,
               COUNT(*)::bigint AS valor
        FROM eventos_analitica
        WHERE evento = '$pageview'
          AND "creadoEn" >= ${desde} AND "creadoEn" <= ${hasta}
        GROUP BY source
        ORDER BY valor DESC
        LIMIT 15
      `,
    );
    const rowsAnt = await prisma.$queryRaw<
      Array<{ source: string; valor: bigint }>
    >(
      Prisma.sql`
        SELECT COALESCE(props->>'utm_source', referrer, 'direct') AS source,
               COUNT(*)::bigint AS valor
        FROM eventos_analitica
        WHERE evento = '$pageview'
          AND "creadoEn" >= ${desdeAnt} AND "creadoEn" <= ${hastaAnt}
        GROUP BY source
      `,
    );
    const rowsA = rowsActual.map((r) => ({
      key: r.source,
      valor: Number(r.valor),
    }));
    const mapB = new Map(rowsAnt.map((r) => [r.source, Number(r.valor)]));
    return buildFilas(rowsA, mapB);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Función pública
// ---------------------------------------------------------------------------

export async function obtenerKPIDetalle(
  metricId: string,
  rango: RangoDetalle = "90d",
): Promise<KPIDetalle | null> {
  const meta = obtenerKPIPorId(metricId);
  if (!meta) return null;

  const key = cacheKey(metricId, rango);
  const cached = getCached(key);
  if (cached) return cached;

  const fechas = rangoFechas(rango);
  const gran = granularidad(rango);

  if (meta.pendienteCableado) {
    const detalle: KPIDetalle = {
      meta,
      header: {
        id: meta.id,
        label: meta.label,
        formato: meta.formato,
        target: meta.target,
        targetLabel: meta.targetLabel,
        status: "neutral",
        valorActual: null,
        valorAnterior: null,
        cambioPct: null,
        descripcion: meta.descripcion,
        pendienteCableado: true,
      },
      rango,
      historico: [],
      historicoAnterior: [],
      breakdown: [],
    };
    setCached(key, detalle);
    return detalle;
  }

  const [valorActual, valorAnterior, historico, historicoAnterior, breakdown] =
    await Promise.all([
      calcularValorKPI(metricId, fechas.desde, fechas.hasta),
      calcularValorKPI(metricId, fechas.desdeAnterior, fechas.hastaAnterior),
      serieTemporalKPI(metricId, fechas.desde, fechas.hasta, gran),
      serieTemporalKPI(
        metricId,
        fechas.desdeAnterior,
        fechas.hastaAnterior,
        gran,
      ),
      breakdownKPI(
        metricId,
        meta,
        fechas.desde,
        fechas.hasta,
        fechas.desdeAnterior,
        fechas.hastaAnterior,
      ),
    ]);

  const detalle: KPIDetalle = {
    meta,
    header: {
      id: meta.id,
      label: meta.label,
      formato: meta.formato,
      target: meta.target,
      targetLabel: meta.targetLabel,
      status: statusVsTarget(valorActual, meta),
      valorActual,
      valorAnterior,
      cambioPct: cambioPct(valorActual, valorAnterior),
      descripcion: meta.descripcion,
      pendienteCableado: false,
    },
    rango,
    historico,
    historicoAnterior,
    breakdown,
  };

  setCached(key, detalle);
  return detalle;
}

/**
 * Helper público — devuelve solo el valor actual del KPI. Lo usa
 * `alarmas.service.ts` para evaluar thresholds. Bypass del cache por
 * idempotencia del cron evaluador.
 */
export async function obtenerValorKPIActual(
  metricId: string,
  ventanaHoras = 1,
): Promise<number | null> {
  const meta = obtenerKPIPorId(metricId);
  if (!meta || meta.pendienteCableado) return null;

  const hasta = new Date();
  const desde = new Date(hasta.getTime() - ventanaHoras * 60 * 60 * 1000);
  return calcularValorKPI(metricId, desde, hasta);
}
