// vitals.service.ts — Mobile Vitals + Lighthouse. Lote G.
//
// Dos fuentes de datos:
//   - metricas_vitales  Core Web Vitals (LCP/INP/CLS) reales medidos en
//                       browser de usuarios. Sample 10% en cliente.
//   - lighthouse_runs   Corridas Lighthouse (cron semanal con PageSpeed
//                       Insights API + manual desde admin).
//
// Fail-soft: si PAGESPEED_API_KEY no está configurada, `correrLighthouseManual`
// loggea warn + retorna error gracioso. El cron también no falla.

import { prisma } from "@habla/db";
import { logger } from "./logger";

export type NombreVital = "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
export type DeviceType = "mobile" | "desktop" | "tablet";

export interface VitalSample {
  nombre: NombreVital;
  valor: number;
  ruta: string;
  deviceType?: DeviceType | null;
  connectionType?: string | null;
  userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// Inserción de samples (endpoint /api/v1/vitals)
// ---------------------------------------------------------------------------

const NOMBRES_VALIDOS: ReadonlyArray<NombreVital> = [
  "LCP",
  "INP",
  "CLS",
  "FCP",
  "TTFB",
];

function rutaCanonica(ruta: string): string {
  // Normaliza variables del path: /partidos/manchester-vs-liverpool → /partidos/[slug]
  // Heurística: patterns conocidos. Mantenemos la URL real pero capeada a 200 chars.
  let r = ruta.split("?")[0]?.split("#")[0] ?? "/";
  if (r.length > 200) r = r.slice(0, 200);
  return r;
}

export async function insertarVitalSample(input: VitalSample): Promise<void> {
  if (!NOMBRES_VALIDOS.includes(input.nombre)) {
    logger.warn(
      { nombre: input.nombre, source: "vitals:insert" },
      "Vital sample con nombre desconocido, descartado",
    );
    return;
  }
  if (!Number.isFinite(input.valor) || input.valor < 0) return;

  try {
    await prisma.metricaVital.create({
      data: {
        nombre: input.nombre,
        valor: input.valor,
        ruta: rutaCanonica(input.ruta),
        deviceType: input.deviceType ?? null,
        connectionType: input.connectionType ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    logger.warn(
      { err, source: "vitals:insert" },
      "Vital sample falló al persistir (descartado)",
    );
  }
}

// ---------------------------------------------------------------------------
// Lectura — agregadas P75
// ---------------------------------------------------------------------------

export type Rango = "7d" | "30d" | "90d";

export interface VitalsAgregadas {
  rango: Rango;
  samples: number;
  // P75 por métrica
  lcpP75: number | null;
  inpP75: number | null;
  clsP75: number | null;
  // Lighthouse promedio (last 30d)
  lighthousePerformance: number | null;
}

function rangoEnDias(rango: Rango): number {
  return rango === "7d" ? 7 : rango === "30d" ? 30 : 90;
}

async function calcP75(
  nombre: NombreVital,
  desde: Date,
  hasta: Date,
): Promise<number | null> {
  // Postgres tiene percentile_cont built-in
  const rows = await prisma.$queryRawUnsafe<Array<{ p75: number | null }>>(
    `SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY valor) AS p75
     FROM metricas_vitales
     WHERE nombre = $1 AND fecha >= $2 AND fecha <= $3`,
    nombre,
    desde,
    hasta,
  );
  const v = rows[0]?.p75;
  return v === null || v === undefined ? null : Number(v);
}

export async function obtenerVitalsAgregadas(
  rango: Rango = "30d",
): Promise<VitalsAgregadas> {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - rangoEnDias(rango) * 24 * 60 * 60 * 1000);

  const [samples, lcp, inp, cls, lighthouseAvg] = await Promise.all([
    prisma.metricaVital.count({ where: { fecha: { gte: desde, lte: hasta } } }),
    calcP75("LCP", desde, hasta),
    calcP75("INP", desde, hasta),
    calcP75("CLS", desde, hasta),
    prisma.lighthouseRun.aggregate({
      where: { fecha: { gte: desde, lte: hasta }, device: "mobile" },
      _avg: { performance: true },
    }),
  ]);

  return {
    rango,
    samples,
    lcpP75: lcp,
    inpP75: inp,
    clsP75: cls,
    lighthousePerformance:
      lighthouseAvg._avg.performance !== null
        ? Math.round(lighthouseAvg._avg.performance)
        : null,
  };
}

// ---------------------------------------------------------------------------
// Charts: serie temporal P75 últimos 30 días
// ---------------------------------------------------------------------------

export interface VitalsChartPunto {
  dia: string;
  lcpP75: number | null;
  inpP75: number | null;
  clsP75: number | null;
}

export async function obtenerVitalsCharts(
  rango: Rango = "30d",
): Promise<VitalsChartPunto[]> {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - rangoEnDias(rango) * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      dia: Date;
      lcp: number | null;
      inp: number | null;
      cls: number | null;
    }>
  >(
    `SELECT
       date_trunc('day', fecha) AS dia,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY valor) FILTER (WHERE nombre = 'LCP') AS lcp,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY valor) FILTER (WHERE nombre = 'INP') AS inp,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY valor) FILTER (WHERE nombre = 'CLS') AS cls
     FROM metricas_vitales
     WHERE fecha >= $1 AND fecha <= $2
     GROUP BY dia
     ORDER BY dia ASC`,
    desde,
    hasta,
  );

  return rows.map((r) => ({
    dia: r.dia.toISOString().slice(0, 10),
    lcpP75: r.lcp === null ? null : Number(r.lcp),
    inpP75: r.inp === null ? null : Number(r.inp),
    clsP75: r.cls === null ? null : Number(r.cls),
  }));
}

// ---------------------------------------------------------------------------
// Rutas con peor performance
// ---------------------------------------------------------------------------

export interface RutaPerformance {
  ruta: string;
  visitas: number;
  lcpP75: number | null;
  inpP75: number | null;
  clsP75: number | null;
}

export async function obtenerRutasPeorPerformance(
  rango: Rango = "30d",
  take = 20,
): Promise<RutaPerformance[]> {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - rangoEnDias(rango) * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      ruta: string;
      visitas: bigint;
      lcp: number | null;
      inp: number | null;
      cls: number | null;
    }>
  >(
    `SELECT
       ruta,
       COUNT(*)::bigint AS visitas,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY valor) FILTER (WHERE nombre = 'LCP') AS lcp,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY valor) FILTER (WHERE nombre = 'INP') AS inp,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY valor) FILTER (WHERE nombre = 'CLS') AS cls
     FROM metricas_vitales
     WHERE fecha >= $1 AND fecha <= $2
     GROUP BY ruta
     HAVING COUNT(*) >= 5
     ORDER BY lcp DESC NULLS LAST
     LIMIT $3`,
    desde,
    hasta,
    take,
  );

  return rows.map((r) => ({
    ruta: r.ruta,
    visitas: Number(r.visitas),
    lcpP75: r.lcp === null ? null : Number(r.lcp),
    inpP75: r.inp === null ? null : Number(r.inp),
    clsP75: r.cls === null ? null : Number(r.cls),
  }));
}

// ---------------------------------------------------------------------------
// Histórico Lighthouse
// ---------------------------------------------------------------------------

export interface LighthouseFila {
  id: string;
  ruta: string;
  device: string;
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  origen: string;
  disparadoPor: string | null;
  fecha: Date;
}

export async function obtenerLighthouseHistorico(
  take = 50,
): Promise<LighthouseFila[]> {
  const rows = await prisma.lighthouseRun.findMany({
    orderBy: { fecha: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    ruta: r.ruta,
    device: r.device,
    performance: r.performance,
    accessibility: r.accessibility,
    bestPractices: r.bestPractices,
    seo: r.seo,
    lcpMs: r.lcpMs,
    inpMs: r.inpMs,
    cls: r.cls,
    origen: r.origen,
    disparadoPor: r.disparadoPor,
    fecha: r.fecha,
  }));
}

// ---------------------------------------------------------------------------
// Lighthouse via PageSpeed Insights API
// ---------------------------------------------------------------------------

export interface LighthouseResult {
  ok: boolean;
  performance?: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
  lcpMs?: number;
  inpMs?: number;
  cls?: number;
  error?: string;
}

const PSI_BASE_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface PsiCategory {
  score?: number;
}
interface PsiAuditWithNumeric {
  numericValue?: number;
}
interface PsiResponse {
  lighthouseResult?: {
    categories?: {
      performance?: PsiCategory;
      accessibility?: PsiCategory;
      "best-practices"?: PsiCategory;
      seo?: PsiCategory;
    };
    audits?: {
      "largest-contentful-paint"?: PsiAuditWithNumeric;
      "interactive"?: PsiAuditWithNumeric;
      "cumulative-layout-shift"?: PsiAuditWithNumeric;
    };
  };
}

export async function correrLighthouseManual(
  url: string,
  device: "mobile" | "desktop" = "mobile",
  disparadoPor?: string,
): Promise<LighthouseResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    logger.warn(
      { source: "vitals:lighthouse" },
      "PAGESPEED_API_KEY no configurada, skip lighthouse",
    );
    return { ok: false, error: "PAGESPEED_API_KEY no configurada" };
  }

  const psiUrl = new URL(PSI_BASE_URL);
  psiUrl.searchParams.set("url", url);
  psiUrl.searchParams.set("strategy", device);
  psiUrl.searchParams.set("key", apiKey);
  for (const cat of ["performance", "accessibility", "best-practices", "seo"]) {
    psiUrl.searchParams.append("category", cat);
  }

  try {
    const res = await fetch(psiUrl.toString(), {
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `PSI ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = (await res.json()) as PsiResponse;
    const lh = data.lighthouseResult;
    if (!lh) return { ok: false, error: "Respuesta PSI sin lighthouseResult" };
    const cats = lh.categories ?? {};
    const audits = lh.audits ?? {};
    const performance = cats.performance?.score
      ? Math.round(cats.performance.score * 100)
      : 0;
    const accessibility = cats.accessibility?.score
      ? Math.round(cats.accessibility.score * 100)
      : 0;
    const bestPractices = cats["best-practices"]?.score
      ? Math.round(cats["best-practices"].score * 100)
      : 0;
    const seo = cats.seo?.score ? Math.round(cats.seo.score * 100) : 0;

    const result: LighthouseResult = {
      ok: true,
      performance,
      accessibility,
      bestPractices,
      seo,
      lcpMs: audits["largest-contentful-paint"]?.numericValue
        ? Math.round(audits["largest-contentful-paint"].numericValue)
        : undefined,
      inpMs: audits["interactive"]?.numericValue
        ? Math.round(audits["interactive"].numericValue)
        : undefined,
      cls: audits["cumulative-layout-shift"]?.numericValue
        ? Number(audits["cumulative-layout-shift"].numericValue.toFixed(4))
        : undefined,
    };

    // Persistir
    const ruta = new URL(url).pathname || "/";
    await prisma.lighthouseRun.create({
      data: {
        ruta,
        device,
        performance: result.performance ?? 0,
        accessibility: result.accessibility ?? 0,
        bestPractices: result.bestPractices ?? 0,
        seo: result.seo ?? 0,
        lcpMs: result.lcpMs ?? null,
        inpMs: result.inpMs ?? null,
        cls: result.cls ?? null,
        origen: disparadoPor ? "manual" : "cron",
        disparadoPor: disparadoPor ?? null,
      },
    });

    return result;
  } catch (err) {
    logger.error(
      { err, url, source: "vitals:lighthouse" },
      "Lighthouse PSI falló",
    );
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Cron semanal: corre Lighthouse contra las 5 rutas críticas.
 * Spec: docs/ux-spec/06-pista-admin-analisis/mobile-vitals.spec.md.
 */
export async function correrLighthouseSemanal(): Promise<{
  rutas: number;
  ok: number;
  fallidos: number;
}> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const rutasCriticas = [
    "/",
    "/comunidad",
    "/premium",
    "/cuotas",
    "/blog",
  ];

  let ok = 0;
  let fallidos = 0;

  for (const ruta of rutasCriticas) {
    const url = `${baseUrl.replace(/\/$/, "")}${ruta}`;
    try {
      // mobile primero
      const r = await correrLighthouseManual(url, "mobile");
      if (r.ok) ok++;
      else fallidos++;
      // throttle 5s entre runs para no saturar PSI
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (err) {
      logger.error(
        { err, ruta, source: "vitals:lighthouse-weekly" },
        "Lighthouse semanal falló para ruta",
      );
      fallidos++;
    }
  }

  return { rutas: rutasCriticas.length, ok, fallidos };
}
