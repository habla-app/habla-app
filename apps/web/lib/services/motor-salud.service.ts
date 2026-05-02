// Servicio de salud del motor — Lote L v3.2 (May 2026).
// Spec: docs/plan-trabajo-claude-code-v3.2.md § Lote L #5 + decisión §4.3 +
// §4.5 (vista /admin/motor en Lote P).
//
// Computa KPIs operativos del motor de análisis enriquecido:
//   - % aprobados sin edición (vs editados antes de aprobar).
//   - % acierto por mercado (1X2, BTTS, ±2.5, marcador exacto, tarjeta).
//   - EV+ realizado de combinadas óptimas en el rango.
//   - Latencia media de Claude API.
//   - Costo Claude API estimado (modelo simple basado en tokens y precios
//     publicados de Opus).
//   - Tendencia de los últimos 90d.
//   - Causas de rechazo agrupadas (desde AnalisisPartido.rechazadoMotivo).
//
// Fuentes de datos:
//   - Para % aprobados / latencia / tokens / causas rechazo: prisma queries
//     directas sobre AnalisisPartido (tablas pequeñas, ~docenas de filas/día).
//   - Para % acierto por mercado y EV+: snapshot in-memory del evaluador
//     (`evaluacionesRecientes` de `analisis-partido-evaluador.service.ts`).
//     El snapshot se purga a 90d, lo que cubre el rango más amplio que la
//     vista admin necesita en el lanzamiento.
//
// Cache: TTL 5 min in-memory por proceso (mismo patrón que
// `kpi-detalle.service.ts` del Lote G). Si la vista /admin/motor empieza a
// pegarle muy seguido, cumple con el SLA sin pegarle a Postgres por cada
// recarga.

import { prisma } from "@habla/db";
import { logger } from "./logger";
import {
  obtenerEvaluacionesRecientes,
  type EvaluacionAnalisis,
  type ResultadoMercado,
} from "./analisis-partido-evaluador.service";
import { PROMPT_VERSION } from "./analisis-partido-prompts";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type RangoMotor = "7d" | "30d" | "90d";

export interface MotorKPIs {
  rango: RangoMotor;
  promptVersionActual: string;
  /** Total de análisis generados en el rango (cualquier estado). */
  totalGenerados: number;
  /** Análisis aprobados en el rango. */
  totalAprobados: number;
  /** Análisis aprobados SIN edición (no se modificaron antes de aprobar). */
  aprobadosSinEdicion: number;
  /** Análisis rechazados. */
  totalRechazados: number;
  /** Análisis archivados. */
  totalArchivados: number;
  /** % aprobados sin edición sobre el total aprobados (0-1). */
  pctAprobadosSinEdicion: number;
  /** Latencia media en ms de las llamadas a Claude API. */
  latenciaMediaMs: number;
  /** Tokens input medios. */
  tokensInputMedio: number;
  /** Tokens output medios. */
  tokensOutputMedio: number;
  /** Costo total estimado en USD para el rango. */
  costoEstimadoUSD: number;
  /** Costo medio por análisis en USD. */
  costoPorAnalisisUSD: number;
  /** % acierto por mercado (entre análisis evaluados con outcome conocido). */
  acierto: {
    "1X2": MercadoAciertoStats;
    combinada: MercadoAciertoStats;
    tarjetaRoja: MercadoAciertoStats;
    goles: MercadoAciertoStats;
    secundarios: MercadoAciertoStats;
  };
  /** EV+ realizado total de combinadas en el rango (suma de stake-fracciones). */
  evPlusRealizadoCombinada: number;
}

export interface MercadoAciertoStats {
  evaluados: number;
  ganados: number;
  perdidos: number;
  nulos: number;
  pctAcierto: number;
}

export interface PuntoTendenciaMotor {
  fecha: string; // YYYY-MM-DD
  generados: number;
  aprobados: number;
  costoUSD: number;
}

export interface CausaRechazo {
  motivo: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Costos estimados (modelo Opus 4 — actualizar si cambia el pricing oficial)
// ---------------------------------------------------------------------------
//
// Pricing público de Anthropic Claude Opus (May 2026):
//   - Input: $15 por millón de tokens
//   - Output: $75 por millón de tokens
//
// Sirve para estimar; el costo real lo refleja la factura mensual de
// Anthropic. El Lote P va a comparar este estimado vs el costo real
// registrado en `costos_operativos` (categoría 'anthropic_api').

const PRICING_OPUS_INPUT_USD_POR_MTOK = 15;
const PRICING_OPUS_OUTPUT_USD_POR_MTOK = 75;

function costoTokens(input: number, output: number): number {
  return (
    (input / 1_000_000) * PRICING_OPUS_INPUT_USD_POR_MTOK +
    (output / 1_000_000) * PRICING_OPUS_OUTPUT_USD_POR_MTOK
  );
}

// ---------------------------------------------------------------------------
// Cache simple in-memory
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function getCached<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return e.data as T;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function rangoToDate(rango: RangoMotor): Date {
  const dias = rango === "7d" ? 7 : rango === "30d" ? 30 : 90;
  return new Date(Date.now() - dias * 24 * 3600 * 1000);
}

// ---------------------------------------------------------------------------
// KPIs principales
// ---------------------------------------------------------------------------

export async function obtenerKPIsMotor(rango: RangoMotor = "30d"): Promise<MotorKPIs> {
  const cached = getCached<MotorKPIs>(`kpis:${rango}`);
  if (cached) return cached;

  const desde = rangoToDate(rango);

  // Counts y averages directos de prisma sobre AnalisisPartido.
  const [allRows, aprobados, aprobadosSinEdicionRows, rechazados, archivados] =
    await Promise.all([
      prisma.analisisPartido.findMany({
        where: { generadoEn: { gte: desde } },
        select: {
          id: true,
          latenciaMs: true,
          tokensInput: true,
          tokensOutput: true,
        },
      }),
      prisma.analisisPartido.count({
        where: { generadoEn: { gte: desde }, estado: "APROBADO" },
      }),
      prisma.analisisPartido.findMany({
        where: { generadoEn: { gte: desde }, estado: "APROBADO" },
        select: { id: true, generadoEn: true, actualizadoEn: true },
      }),
      prisma.analisisPartido.count({
        where: { generadoEn: { gte: desde }, estado: "RECHAZADO" },
      }),
      prisma.analisisPartido.count({
        where: { generadoEn: { gte: desde }, estado: "ARCHIVADO" },
      }),
    ]);

  const totalGenerados = allRows.length;
  const totalAprobados = aprobados;

  // "Aprobado sin edición" = el delta entre creadoEn y actualizadoEn es < 5s.
  // Si el editor solo apretó "Aprobar" sin editar, Prisma updatedAt =
  // generadoEn + tiempo de aprobación, que en práctica son segundos. Si el
  // editor edita campos antes de aprobar, el actualizadoEn salta varios
  // minutos respecto a generadoEn.
  const TOLERANCIA_MS = 5_000;
  const aprobadosSinEdicion = aprobadosSinEdicionRows.filter(
    (r) =>
      r.actualizadoEn.getTime() - r.generadoEn.getTime() < TOLERANCIA_MS,
  ).length;
  const pctAprobadosSinEdicion =
    totalAprobados > 0 ? aprobadosSinEdicion / totalAprobados : 0;

  // Latencia y tokens medios.
  const conTel = allRows.filter(
    (r) =>
      r.latenciaMs !== null &&
      r.tokensInput !== null &&
      r.tokensOutput !== null,
  );
  const sumLat = conTel.reduce((acc, r) => acc + (r.latenciaMs ?? 0), 0);
  const sumIn = conTel.reduce((acc, r) => acc + (r.tokensInput ?? 0), 0);
  const sumOut = conTel.reduce((acc, r) => acc + (r.tokensOutput ?? 0), 0);
  const latenciaMediaMs = conTel.length > 0 ? Math.round(sumLat / conTel.length) : 0;
  const tokensInputMedio =
    conTel.length > 0 ? Math.round(sumIn / conTel.length) : 0;
  const tokensOutputMedio =
    conTel.length > 0 ? Math.round(sumOut / conTel.length) : 0;
  const costoEstimadoUSD = costoTokens(sumIn, sumOut);
  const costoPorAnalisisUSD =
    conTel.length > 0 ? costoEstimadoUSD / conTel.length : 0;

  // Acierto por mercado: lo computamos del snapshot in-memory del evaluador.
  // El snapshot ya está limitado a 90d, así que para "30d" / "7d" filtramos
  // por fecha del partido.
  const evaluaciones = obtenerEvaluacionesRecientes()
    .filter((e) => e.partidoFechaInicio >= desde)
    .map((e) => e.evaluacion);

  const acierto = {
    "1X2": acumular(evaluaciones, (e) => [e.resultado1X2]),
    combinada: acumular(evaluaciones, (e) => [e.resultadoCombinada]),
    tarjetaRoja: acumular(evaluaciones, (e) => [e.resultadoTarjetaRoja]),
    goles: acumular(evaluaciones, (e) => [e.resultadoGoles]),
    secundarios: acumular(evaluaciones, (e) => e.resultadosSecundarios),
  };
  const evPlusRealizadoCombinada = evaluaciones.reduce(
    (acc, e) => acc + (e.evCombinada ?? 0),
    0,
  );

  const data: MotorKPIs = {
    rango,
    promptVersionActual: PROMPT_VERSION,
    totalGenerados,
    totalAprobados,
    aprobadosSinEdicion,
    totalRechazados: rechazados,
    totalArchivados: archivados,
    pctAprobadosSinEdicion,
    latenciaMediaMs,
    tokensInputMedio,
    tokensOutputMedio,
    costoEstimadoUSD,
    costoPorAnalisisUSD,
    acierto,
    evPlusRealizadoCombinada,
  };

  setCached(`kpis:${rango}`, data);
  return data;
}

function acumular(
  evals: EvaluacionAnalisis[],
  selector: (e: EvaluacionAnalisis) => ResultadoMercado[],
): MercadoAciertoStats {
  let evaluados = 0;
  let ganados = 0;
  let perdidos = 0;
  let nulos = 0;
  for (const e of evals) {
    for (const r of selector(e)) {
      if (r === "INDETERMINADO") continue;
      evaluados += 1;
      if (r === "GANADO") ganados += 1;
      else if (r === "PERDIDO") perdidos += 1;
      else nulos += 1;
    }
  }
  const decisivos = ganados + perdidos;
  const pctAcierto = decisivos > 0 ? ganados / decisivos : 0;
  return { evaluados, ganados, perdidos, nulos, pctAcierto };
}

// ---------------------------------------------------------------------------
// Tendencia 90d (datos del chart)
// ---------------------------------------------------------------------------

export async function obtenerTendenciaMotor(): Promise<PuntoTendenciaMotor[]> {
  const cached = getCached<PuntoTendenciaMotor[]>("tendencia:90d");
  if (cached) return cached;

  const desde = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const rows = await prisma.analisisPartido.findMany({
    where: { generadoEn: { gte: desde } },
    select: {
      generadoEn: true,
      estado: true,
      tokensInput: true,
      tokensOutput: true,
    },
  });

  const buckets = new Map<
    string,
    { generados: number; aprobados: number; tokensIn: number; tokensOut: number }
  >();

  for (const r of rows) {
    const key = r.generadoEn.toISOString().slice(0, 10);
    const b = buckets.get(key) ?? {
      generados: 0,
      aprobados: 0,
      tokensIn: 0,
      tokensOut: 0,
    };
    b.generados += 1;
    if (r.estado === "APROBADO") b.aprobados += 1;
    b.tokensIn += r.tokensInput ?? 0;
    b.tokensOut += r.tokensOutput ?? 0;
    buckets.set(key, b);
  }

  const out: PuntoTendenciaMotor[] = Array.from(buckets.entries())
    .map(([fecha, b]) => ({
      fecha,
      generados: b.generados,
      aprobados: b.aprobados,
      costoUSD: costoTokens(b.tokensIn, b.tokensOut),
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  setCached("tendencia:90d", out);
  return out;
}

// ---------------------------------------------------------------------------
// Causas de rechazo agrupadas
// ---------------------------------------------------------------------------

export async function obtenerCausasRechazo(
  rango: RangoMotor = "30d",
): Promise<CausaRechazo[]> {
  const cached = getCached<CausaRechazo[]>(`causas:${rango}`);
  if (cached) return cached;

  const desde = rangoToDate(rango);
  const rows = await prisma.analisisPartido.findMany({
    where: {
      estado: "RECHAZADO",
      rechazadoMotivo: { not: null },
      generadoEn: { gte: desde },
    },
    select: { rechazadoMotivo: true },
  });

  const conteo = new Map<string, number>();
  for (const r of rows) {
    const motivo = (r.rechazadoMotivo ?? "Sin motivo").trim().slice(0, 120);
    conteo.set(motivo, (conteo.get(motivo) ?? 0) + 1);
  }

  const out: CausaRechazo[] = Array.from(conteo.entries())
    .map(([motivo, count]) => ({ motivo, count }))
    .sort((a, b) => b.count - a.count);

  setCached(`causas:${rango}`, out);
  return out;
}

// ---------------------------------------------------------------------------
// Helpers expuestos para test/diagnóstico
// ---------------------------------------------------------------------------

/** Bypass del cache (debug / endpoint admin con `?refresh=1`). */
export function invalidarCacheMotorSalud(): void {
  cache.clear();
  logger.info(
    { source: "motor-salud:cache" },
    "invalidarCacheMotorSalud: cache limpio",
  );
}
