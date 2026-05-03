// kpis-free-premium.service.ts — Lote P (May 2026).
// Servicio del KPI "Free → Premium · Conversión mensual" para
// `/admin/kpis` (mockup `docs/habla-mockup-v3.2.html` § admin-page-kpis,
// líneas 7286-7396).
//
// La vista del mockup es UN solo KPI con drill-down completo:
//   - Valor actual (% de MAU que se convierte en Socios)
//   - Targets (1.0% inicial, 2.0% maduro)
//   - Suscripciones nuevas del rango
//   - Evolución (12 buckets ~= semanal) para chart
//   - Origen de la conversión (% por fuente: pick bloqueado, trial, banner, newsletter)
//   - Plan elegido (% Anual / Mensual / Trimestral)
//   - Acciones sugeridas según valor vs target

import { prisma } from "@habla/db";
import { logger } from "./logger";

export type RangoKpi = "7d" | "30d" | "90d" | "12m";

export interface KpiFreeAPremiumData {
  rango: RangoKpi;
  valorActual: number;
  targetInicial: number;
  targetMaduro: number;
  nuevasSuscripciones: number;
  evolucion: Array<{ pct: number; esTarget: boolean }>;
  origen: Array<{ etiqueta: string; pct: number }>;
  plan: Array<{ etiqueta: string; pct: number }>;
}

const TARGET_INICIAL = 1.0;
const TARGET_MADURO = 2.0;

function diasDelRango(rango: RangoKpi): number {
  if (rango === "7d") return 7;
  if (rango === "30d") return 30;
  if (rango === "90d") return 90;
  return 365;
}

export async function obtenerKpiFreeAPremium(rango: RangoKpi = "90d"): Promise<KpiFreeAPremiumData> {
  const dias = diasDelRango(rango);
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  try {
    const [nuevasSubs, mauProxy] = await Promise.all([
      prisma.suscripcion.count({
        where: { iniciada: { gte: desde }, activa: true },
      }),
      // MAU proxy: distinct userId con $pageview en últimos 30 días
      prisma.eventoAnalitica
        .findMany({
          where: { evento: "$pageview", creadoEn: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, userId: { not: null } },
          select: { userId: true },
          distinct: ["userId"],
        })
        .then((rows) => rows.length),
    ]);

    const valorActual = mauProxy > 0 ? (nuevasSubs / mauProxy) * 100 : 0;

    // Evolución: 12 buckets repartidos en el rango. Para cada bucket
    // calculamos % semanal aproximado. Si no hay datos suficientes, el
    // bucket queda en 0.
    const buckets = 12;
    const ventanaBucketDias = Math.max(1, Math.round(dias / buckets));
    const evolucion: Array<{ pct: number; esTarget: boolean }> = [];
    for (let i = buckets - 1; i >= 0; i--) {
      const bDesde = new Date(Date.now() - (i + 1) * ventanaBucketDias * 24 * 60 * 60 * 1000);
      const bHasta = new Date(Date.now() - i * ventanaBucketDias * 24 * 60 * 60 * 1000);
      const subsBucket = await prisma.suscripcion
        .count({
          where: { iniciada: { gte: bDesde, lt: bHasta }, activa: true },
        })
        .catch(() => 0);
      const denom = mauProxy > 0 ? Math.max(1, Math.round(mauProxy / buckets)) : 1;
      const pct = (subsBucket / denom) * 100;
      evolucion.push({ pct, esTarget: pct >= TARGET_INICIAL });
    }

    // Origen de la conversión: leer evento `socios_suscripcion_nueva` con
    // prop `origen` (set en el flujo de checkout). Si no hay datos, vacío.
    const origenRows = await prisma.eventoAnalitica
      .findMany({
        where: {
          evento: "socios_suscripcion_nueva",
          creadoEn: { gte: desde },
        },
        select: { props: true },
      })
      .catch(() => []);
    const origenConteo = new Map<string, number>();
    for (const r of origenRows) {
      const props = (r.props ?? {}) as Record<string, unknown>;
      const origen = typeof props.origen === "string" ? props.origen : "otro";
      origenConteo.set(origen, (origenConteo.get(origen) ?? 0) + 1);
    }
    const totalOrigen = Array.from(origenConteo.values()).reduce((a, b) => a + b, 0);
    const origen: Array<{ etiqueta: string; pct: number }> = totalOrigen > 0
      ? Array.from(origenConteo.entries())
          .map(([k, v]) => ({ etiqueta: etiquetarOrigen(k), pct: Math.round((v / totalOrigen) * 100) }))
          .sort((a, b) => b.pct - a.pct)
      : [
          { etiqueta: "Pick bloqueado", pct: 0 },
          { etiqueta: "Trial Top 50 leaderboard", pct: 0 },
          { etiqueta: "Banner persistente", pct: 0 },
          { etiqueta: "Newsletter", pct: 0 },
        ];

    // Plan elegido: agregar por plan en suscripciones del rango
    const planRows = await prisma.suscripcion.groupBy({
      by: ["plan"],
      where: { iniciada: { gte: desde }, activa: true },
      _count: { _all: true },
    });
    const totalPlan = planRows.reduce((a, b) => a + b._count._all, 0);
    const planLabels: Record<string, string> = {
      ANUAL: "Anual S/399",
      MENSUAL: "Mensual S/49",
      TRIMESTRAL: "Trimestral S/119",
    };
    const plan: Array<{ etiqueta: string; pct: number }> = totalPlan > 0
      ? planRows
          .map((r) => ({
            etiqueta: planLabels[r.plan] ?? r.plan,
            pct: Math.round((r._count._all / totalPlan) * 100),
          }))
          .sort((a, b) => b.pct - a.pct)
      : [
          { etiqueta: "Anual S/399", pct: 0 },
          { etiqueta: "Mensual S/49", pct: 0 },
          { etiqueta: "Trimestral S/119", pct: 0 },
        ];

    return {
      rango,
      valorActual: Math.round(valorActual * 10) / 10,
      targetInicial: TARGET_INICIAL,
      targetMaduro: TARGET_MADURO,
      nuevasSuscripciones: nuevasSubs,
      evolucion,
      origen,
      plan,
    };
  } catch (err) {
    logger.error({ err, source: "kpis-free-premium" }, "Falla al calcular KPI Free→Premium");
    return {
      rango,
      valorActual: 0,
      targetInicial: TARGET_INICIAL,
      targetMaduro: TARGET_MADURO,
      nuevasSuscripciones: 0,
      evolucion: Array.from({ length: 12 }, () => ({ pct: 0, esTarget: false })),
      origen: [],
      plan: [],
    };
  }
}

function etiquetarOrigen(slug: string): string {
  const map: Record<string, string> = {
    pick_bloqueado: "Pick bloqueado",
    trial_top50: "Trial Top 50 leaderboard",
    banner: "Banner persistente",
    newsletter: "Newsletter",
  };
  return map[slug] ?? slug;
}
