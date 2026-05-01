// cohortes.service.ts — Análisis de cohortes mensuales. Lote G.
//
// Una cohorte = grupo de usuarios registrados en el mismo mes calendario.
// El análisis mide cuántos llegaron a cada etapa del funnel a Day 0/1/7/14/30/60/90.
//
// Funnel canónico v3.1:
//   Registro → Predicción 1ra → FTD reportado → Premium
//
// Métricas seleccionables:
//   - prediccion: 1ra predicción (Ticket.creadoEn) por usuario
//   - ftd: 1er FTD reportado por casa (ConversionAfiliado tipo='FTD')
//   - premium: 1ra suscripción Premium activa (Suscripcion.activa=true)
//   - activo: cualquier evento $pageview en la ventana
//
// Cache TTL 30 min (queries pesadas). In-memory por proceso.
//
// Performance: las cohortes se calculan con queries SQL agregadas. Para
// 12 meses × 7 buckets × 4 métricas son 12 queries por métrica → fast con
// índices apropiados. Si crece más, mover a vista materializada.

import { prisma, Prisma } from "@habla/db";

export type MetricaCohorte = "prediccion" | "ftd" | "premium" | "activo";

const DAYS_BUCKETS = [0, 1, 7, 14, 30, 60, 90] as const;
type DayBucket = (typeof DAYS_BUCKETS)[number];

export interface ConversionesCohorte {
  /** Total registrados en la cohorte. */
  total: number;
  /** Usuarios que llegaron a la métrica al Day N. Cumulativo. */
  buckets: Record<DayBucket, number | null>;
}

export interface CohorteFila {
  /** YYYY-MM */
  mes: string;
  /** Total de registrados en la cohorte. */
  totalUsuarios: number;
  conversiones: ConversionesCohorte;
  /** Si true: la cohorte está incompleta (no todos los buckets cubrieron
   *  el rango de días desde el registro). */
  enCurso: boolean;
}

export interface SegmentoFila {
  segmento: string;
  totalUsuarios: number;
  conversionDay30: number;
}

export interface CohortesData {
  metric: MetricaCohorte;
  cohortes: CohorteFila[];
  segmentos: SegmentoFila[];
  resumen: {
    mejorMes: { mes: string; pct: number } | null;
    peorMes: { mes: string; pct: number } | null;
    tendencia3m: { dir: "up" | "down" | "flat"; pct: number } | null;
  };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache = new Map<string, { data: CohortesData; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function key(metric: MetricaCohorte, ultimosN: number): string {
  return `${metric}::${ultimosN}`;
}

// ---------------------------------------------------------------------------
// Helpers de fecha
// ---------------------------------------------------------------------------

function inicioDeMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function finDeMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function offsetMeses(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function formatYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function diasEntre(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Query principal
// ---------------------------------------------------------------------------

interface UsuarioCohorte {
  id: string;
  registradoEn: Date;
}

async function obtenerUsuariosDeMes(mes: Date): Promise<UsuarioCohorte[]> {
  const desde = inicioDeMes(mes);
  const hasta = finDeMes(mes);
  const usuarios = await prisma.usuario.findMany({
    where: { creadoEn: { gte: desde, lte: hasta } },
    select: { id: true, creadoEn: true },
  });
  return usuarios.map((u) => ({ id: u.id, registradoEn: u.creadoEn }));
}

/**
 * Para una cohorte (lista de userIds + fecha de registro), encuentra el
 * primer evento de la métrica para cada usuario. Devuelve mapa userId →
 * fecha del primer evento.
 */
async function primerEventoMetrica(
  metric: MetricaCohorte,
  userIds: string[],
  ventanaDesde: Date,
  ventanaHasta: Date,
): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map();

  if (metric === "prediccion") {
    const rows = await prisma.$queryRaw<
      Array<{ usuarioId: string; primero: Date }>
    >(
      Prisma.sql`
        SELECT "usuarioId", MIN("creadoEn") AS primero
        FROM tickets
        WHERE "usuarioId" IN (${Prisma.join(userIds)})
          AND "creadoEn" >= ${ventanaDesde}
          AND "creadoEn" <= ${ventanaHasta}
        GROUP BY "usuarioId"
      `,
    );
    return new Map(rows.map((r) => [r.usuarioId, r.primero]));
  }

  if (metric === "ftd") {
    const rows = await prisma.$queryRaw<
      Array<{ userId: string; primero: Date }>
    >(
      Prisma.sql`
        SELECT "userId", MIN("reportadoEn") AS primero
        FROM conversiones_afiliados
        WHERE tipo = 'FTD'
          AND "userId" IN (${Prisma.join(userIds)})
          AND "reportadoEn" >= ${ventanaDesde}
          AND "reportadoEn" <= ${ventanaHasta}
        GROUP BY "userId"
      `,
    );
    return new Map(rows.map((r) => [r.userId, r.primero]));
  }

  if (metric === "premium") {
    const rows = await prisma.$queryRaw<
      Array<{ usuarioId: string; primero: Date }>
    >(
      Prisma.sql`
        SELECT "usuarioId", MIN("iniciada") AS primero
        FROM suscripciones
        WHERE "usuarioId" IN (${Prisma.join(userIds)})
          AND "activa" = true
          AND "iniciada" >= ${ventanaDesde}
          AND "iniciada" <= ${ventanaHasta}
        GROUP BY "usuarioId"
      `,
    );
    return new Map(rows.map((r) => [r.usuarioId, r.primero]));
  }

  // activo: cualquier $pageview
  const rows = await prisma.$queryRaw<
    Array<{ userId: string; primero: Date }>
  >(
    Prisma.sql`
      SELECT "userId", MIN("creadoEn") AS primero
      FROM eventos_analitica
      WHERE evento = '$pageview'
        AND "userId" IN (${Prisma.join(userIds)})
        AND "creadoEn" >= ${ventanaDesde}
        AND "creadoEn" <= ${ventanaHasta}
      GROUP BY "userId"
    `,
  );
  return new Map(rows.map((r) => [r.userId, r.primero]));
}

// ---------------------------------------------------------------------------
// Cálculo de buckets day 0/1/7/14/30/60/90
// ---------------------------------------------------------------------------

function calcularBuckets(
  usuarios: UsuarioCohorte[],
  primerEvento: Map<string, Date>,
  hoy: Date,
): { total: number; buckets: Record<DayBucket, number | null>; enCurso: boolean } {
  const total = usuarios.length;
  const buckets: Record<DayBucket, number | null> = {
    0: 0,
    1: 0,
    7: 0,
    14: 0,
    30: 0,
    60: 0,
    90: 0,
  };

  // Para cada usuario, calcular días desde registro al primer evento.
  for (const u of usuarios) {
    const primero = primerEvento.get(u.id);
    if (!primero) continue;
    const dias = diasEntre(primero, u.registradoEn);
    for (const bucket of DAYS_BUCKETS) {
      if (dias <= bucket) {
        const cur = buckets[bucket];
        if (cur !== null) buckets[bucket] = cur + 1;
      }
    }
  }

  // Marcar buckets futuros como null cuando la cohorte aún no cubrió esos días.
  // El bucket más viejo (90d) debe estar cubierto si todos los usuarios tienen
  // ≥90d desde su registro. Lo aproximamos chequeando el usuario más reciente
  // de la cohorte.
  let enCurso = false;
  if (usuarios.length > 0) {
    const masReciente = usuarios.reduce((max, u) =>
      u.registradoEn > max.registradoEn ? u : max,
    );
    const diasDesdeMasReciente = diasEntre(hoy, masReciente.registradoEn);
    for (const bucket of DAYS_BUCKETS) {
      if (diasDesdeMasReciente < bucket) {
        buckets[bucket] = null;
        enCurso = true;
      }
    }
  }

  return { total, buckets, enCurso };
}

// ---------------------------------------------------------------------------
// Función pública
// ---------------------------------------------------------------------------

export async function obtenerCohortesMensuales(
  metric: MetricaCohorte = "ftd",
  ultimosN = 12,
): Promise<CohortesData> {
  const k = key(metric, ultimosN);
  const cached = cache.get(k);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const hoy = new Date();
  const inicioMesActual = inicioDeMes(hoy);

  const cohortes: CohorteFila[] = [];

  // Iteramos del mes más antiguo (oldest) al actual (newest); luego revertimos
  // para mostrar más reciente arriba en la UI.
  for (let i = ultimosN - 1; i >= 0; i--) {
    const mesInicio = offsetMeses(inicioMesActual, -i);
    const mesFin = finDeMes(mesInicio);
    const usuarios = await obtenerUsuariosDeMes(mesInicio);
    if (usuarios.length === 0) {
      cohortes.push({
        mes: formatYearMonth(mesInicio),
        totalUsuarios: 0,
        conversiones: { total: 0, buckets: { 0: 0, 1: 0, 7: 0, 14: 0, 30: 0, 60: 0, 90: 0 } },
        enCurso: mesInicio.getTime() === inicioMesActual.getTime(),
      });
      continue;
    }
    // Ventana: desde inicio del mes de la cohorte hasta hoy + 90d cap
    const ventanaHasta = new Date(
      Math.min(
        hoy.getTime(),
        mesFin.getTime() + 91 * 24 * 60 * 60 * 1000,
      ),
    );
    const primerEvento = await primerEventoMetrica(
      metric,
      usuarios.map((u) => u.id),
      mesInicio,
      ventanaHasta,
    );

    const result = calcularBuckets(usuarios, primerEvento, hoy);
    cohortes.push({
      mes: formatYearMonth(mesInicio),
      totalUsuarios: result.total,
      conversiones: { total: result.total, buckets: result.buckets },
      enCurso: result.enCurso || mesInicio.getTime() === inicioMesActual.getTime(),
    });
  }

  cohortes.reverse(); // más reciente primero

  // Resumen: mejor / peor mes / tendencia 3m del bucket day 30
  const cohortesCompletas = cohortes.filter((c) => !c.enCurso && c.totalUsuarios > 0);
  let mejorMes: { mes: string; pct: number } | null = null;
  let peorMes: { mes: string; pct: number } | null = null;
  for (const c of cohortesCompletas) {
    const day30 = c.conversiones.buckets[30];
    if (day30 === null) continue;
    const pct = c.totalUsuarios > 0 ? Math.round((day30 / c.totalUsuarios) * 1000) / 10 : 0;
    if (!mejorMes || pct > mejorMes.pct) mejorMes = { mes: c.mes, pct };
    if (!peorMes || pct < peorMes.pct) peorMes = { mes: c.mes, pct };
  }

  let tendencia3m: { dir: "up" | "down" | "flat"; pct: number } | null = null;
  if (cohortesCompletas.length >= 3) {
    // Más recientes están al inicio del array (después de reverse)
    const ultimas3 = cohortesCompletas.slice(0, 3);
    const ant3 = cohortesCompletas.slice(3, 6);
    if (ant3.length > 0) {
      const promU = avgConv(ultimas3, 30);
      const promA = avgConv(ant3, 30);
      const diff = promU - promA;
      tendencia3m = {
        dir: diff > 0.5 ? "up" : diff < -0.5 ? "down" : "flat",
        pct: Math.round(Math.abs(diff) * 10) / 10,
      };
    }
  }

  // Segmentos por source de tráfico (organic/social/paid/direct)
  const segmentos = await obtenerCohortesPorSegmento();

  const data: CohortesData = {
    metric,
    cohortes,
    segmentos,
    resumen: { mejorMes, peorMes, tendencia3m },
  };
  cache.set(k, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function avgConv(rows: CohorteFila[], bucket: DayBucket): number {
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const v = r.conversiones.buckets[bucket];
    if (v === null || r.totalUsuarios === 0) continue;
    sum += (v / r.totalUsuarios) * 100;
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

// ---------------------------------------------------------------------------
// Segmentos por source
// ---------------------------------------------------------------------------

async function obtenerCohortesPorSegmento(): Promise<SegmentoFila[]> {
  // Aproximación: para cada usuario registrado en los últimos 6 meses
  // (cohorte completa), inferir source del primer $pageview en su sesión.
  const hace6m = offsetMeses(new Date(), -6);
  const rows = await prisma.$queryRaw<
    Array<{ source: string; total: bigint; converted: bigint }>
  >(
    Prisma.sql`
      WITH first_pageview AS (
        SELECT DISTINCT ON ("userId")
          "userId",
          COALESCE(props->>'utm_source', referrer, 'direct') AS source
        FROM eventos_analitica
        WHERE evento = '$pageview'
          AND "userId" IS NOT NULL
          AND "creadoEn" >= ${hace6m}
        ORDER BY "userId", "creadoEn" ASC
      ),
      tickets_user AS (
        SELECT DISTINCT "usuarioId" FROM tickets
      )
      SELECT
        fp.source AS source,
        COUNT(*)::bigint AS total,
        COUNT(t."usuarioId")::bigint AS converted
      FROM first_pageview fp
      LEFT JOIN tickets_user t ON t."usuarioId" = fp."userId"
      GROUP BY fp.source
      ORDER BY total DESC
      LIMIT 10
    `,
  );

  return rows.map((r) => {
    const total = Number(r.total);
    const conv = Number(r.converted);
    return {
      segmento: r.source,
      totalUsuarios: total,
      conversionDay30: total > 0 ? Math.round((conv / total) * 1000) / 10 : 0,
    };
  });
}

/**
 * Detalle de una cohorte específica (top usuarios + source). Para modal en /admin/cohortes.
 */
export async function obtenerDetalleCohorte(
  mes: string,
): Promise<{
  totalUsuarios: number;
  topUsuarios: Array<{
    id: string;
    nombre: string;
    username: string;
    emailEnmascarado: string;
    tickets: number;
    creadoEn: Date;
  }>;
  porSource: Array<{ source: string; count: number }>;
} | null> {
  const [year, month] = mes.split("-");
  if (!year || !month) return null;
  const desde = new Date(Number(year), Number(month) - 1, 1);
  const hasta = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

  const usuarios = await prisma.usuario.findMany({
    where: { creadoEn: { gte: desde, lte: hasta } },
    select: { id: true, nombre: true, username: true, email: true, creadoEn: true },
  });

  // Top 10 más activos por # tickets
  const ticketCounts = await prisma.ticket.groupBy({
    by: ["usuarioId"],
    where: {
      usuarioId: { in: usuarios.map((u) => u.id) },
    },
    _count: { _all: true },
  });
  const ticketsPorUsuario = new Map(
    ticketCounts.map((r) => [r.usuarioId, r._count._all]),
  );

  const topUsuarios = usuarios
    .map((u) => ({
      id: u.id,
      nombre: u.nombre,
      username: u.username,
      emailEnmascarado: enmascararEmail(u.email),
      tickets: ticketsPorUsuario.get(u.id) ?? 0,
      creadoEn: u.creadoEn,
    }))
    .sort((a, b) => b.tickets - a.tickets)
    .slice(0, 10);

  const sourceRows = await prisma.$queryRaw<
    Array<{ source: string; count: bigint }>
  >(
    Prisma.sql`
      SELECT
        COALESCE(props->>'utm_source', referrer, 'direct') AS source,
        COUNT(DISTINCT "userId")::bigint AS count
      FROM eventos_analitica
      WHERE evento = '$pageview'
        AND "userId" IN (${Prisma.join(usuarios.map((u) => u.id))})
      GROUP BY source
      ORDER BY count DESC
      LIMIT 5
    `,
  );

  return {
    totalUsuarios: usuarios.length,
    topUsuarios,
    porSource: sourceRows.map((r) => ({ source: r.source, count: Number(r.count) })),
  };
}

function enmascararEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}
