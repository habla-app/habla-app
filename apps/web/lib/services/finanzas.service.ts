// finanzas.service.ts — Análisis financiero. Lote G.
//
// Tres bloques:
//   1. Revenue: Premium (auto desde pagoSuscripcion) + afiliación (manual,
//      cargado en `comisiones_afiliacion`).
//   2. Costos: editables manualmente desde /admin/finanzas, persistidos en
//      `costos_operativos`.
//   3. CAC / LTV: derivados — CAC necesita gasto en marketing categorizado,
//      LTV necesita cohortes históricas.
//
// Cache TTL 30 min — queries pesadas pero no críticamente actuales (la
// vista se mira como mucho 1-2 veces por día).

import { prisma } from "@habla/db";

export interface RevenueMes {
  mes: string;
  premium: number;          // soles enteros
  afiliacion: number;       // soles enteros
  total: number;
}

export interface MRRPunto {
  mes: string;
  mensual: number;
  trimestral: number;
  anual: number;
  total: number;
}

export interface CostoFila {
  id: string;
  mes: string;
  categoria: string;
  monto: number;            // soles enteros
  notas: string | null;
  registradoPor: string | null;
  registradoEn: Date;
  editadoEn: Date;
}

export interface ComisionFila {
  id: string;
  mes: string;
  afiliadoId: string;
  afiliadoNombre: string;
  monto: number;
  ftdsContados: number;
  notas: string | null;
  registradoEn: Date;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidarCacheFinanzas(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rangoMes(mes: string): { desde: Date; hasta: Date } {
  const [y, m] = mes.split("-").map(Number);
  const desde = new Date(y!, (m ?? 1) - 1, 1);
  const hasta = new Date(y!, m ?? 1, 0, 23, 59, 59, 999);
  return { desde, hasta };
}

// ---------------------------------------------------------------------------
// Revenue del mes (Premium + afiliación)
// ---------------------------------------------------------------------------

export async function obtenerRevenueMes(mes: string): Promise<RevenueMes> {
  const { desde, hasta } = rangoMes(mes);

  const [pagosPremium, comisiones] = await Promise.all([
    prisma.pagoSuscripcion.findMany({
      where: {
        estado: "PAGADO",
        acreditadoEn: { gte: desde, lte: hasta },
      },
      select: { monto: true },
    }),
    prisma.comisionAfiliacion.findMany({
      where: { mes },
      select: { monto: true },
    }),
  ]);

  const premium = Math.round(
    pagosPremium.reduce((acc, p) => acc + p.monto, 0) / 100,
  );
  const afiliacion = Math.round(
    comisiones.reduce((acc, c) => acc + c.monto, 0) / 100,
  );
  return {
    mes,
    premium,
    afiliacion,
    total: premium + afiliacion,
  };
}

/**
 * Revenue desagregado de los últimos N meses (para bar chart stacked).
 */
export async function obtenerRevenueUltimosMeses(n = 12): Promise<RevenueMes[]> {
  const k = `revenue_ult_${n}`;
  const cached = cacheGet<RevenueMes[]>(k);
  if (cached) return cached;

  const ahora = new Date();
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    meses.push(formatYearMonth(d));
  }

  const data: RevenueMes[] = [];
  for (const mes of meses) {
    data.push(await obtenerRevenueMes(mes));
  }
  cacheSet(k, data);
  return data;
}

// ---------------------------------------------------------------------------
// MRR mensual con breakdown por plan
// ---------------------------------------------------------------------------

export async function obtenerMRRMensual(n = 12): Promise<MRRPunto[]> {
  const k = `mrr_${n}`;
  const cached = cacheGet<MRRPunto[]>(k);
  if (cached) return cached;

  const ahora = new Date();
  const out: MRRPunto[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const finMes = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    // Suscripciones activas a fin de ese mes (iniciada <= finMes y vencimiento >= finMes o activa)
    const susActivas = await prisma.suscripcion.findMany({
      where: {
        iniciada: { lte: finMes },
        OR: [{ vencimiento: { gte: finMes } }, { activa: true }],
      },
      select: { plan: true, precio: true },
    });
    let mensual = 0;
    let trimestral = 0;
    let anual = 0;
    for (const s of susActivas) {
      const aporte = Math.round(s.precio / (s.plan === "ANUAL" ? 12 : s.plan === "TRIMESTRAL" ? 3 : 1) / 100);
      if (s.plan === "MENSUAL") mensual += aporte;
      else if (s.plan === "TRIMESTRAL") trimestral += aporte;
      else if (s.plan === "ANUAL") anual += aporte;
    }
    out.push({
      mes: formatYearMonth(d),
      mensual,
      trimestral,
      anual,
      total: mensual + trimestral + anual,
    });
  }
  cacheSet(k, out);
  return out;
}

// ---------------------------------------------------------------------------
// Costos operativos
// ---------------------------------------------------------------------------

export async function obtenerCostosMes(mes: string): Promise<CostoFila[]> {
  const rows = await prisma.costoOperativo.findMany({
    where: { mes },
    orderBy: { categoria: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    mes: r.mes,
    categoria: r.categoria,
    monto: Math.round(r.monto / 100),
    notas: r.notas,
    registradoPor: r.registradoPor,
    registradoEn: r.registradoEn,
    editadoEn: r.editadoEn,
  }));
}

export interface UpsertCostoInput {
  mes: string;
  categoria: string;
  /** Monto en soles enteros (UI lo recibe del admin). */
  montoSoles: number;
  notas?: string | null;
  registradoPor?: string;
}

export async function upsertarCosto(
  input: UpsertCostoInput,
): Promise<CostoFila> {
  const monto = Math.round(input.montoSoles * 100);
  const row = await prisma.costoOperativo.upsert({
    where: { mes_categoria: { mes: input.mes, categoria: input.categoria } },
    create: {
      mes: input.mes,
      categoria: input.categoria,
      monto,
      notas: input.notas ?? null,
      registradoPor: input.registradoPor ?? null,
    },
    update: {
      monto,
      notas: input.notas ?? null,
      registradoPor: input.registradoPor ?? null,
    },
  });
  invalidarCacheFinanzas();
  return {
    id: row.id,
    mes: row.mes,
    categoria: row.categoria,
    monto: Math.round(row.monto / 100),
    notas: row.notas,
    registradoPor: row.registradoPor,
    registradoEn: row.registradoEn,
    editadoEn: row.editadoEn,
  };
}

export async function eliminarCosto(id: string): Promise<void> {
  await prisma.costoOperativo.delete({ where: { id } });
  invalidarCacheFinanzas();
}

// ---------------------------------------------------------------------------
// Comisiones afiliación
// ---------------------------------------------------------------------------

export async function obtenerComisionesMes(mes: string): Promise<ComisionFila[]> {
  const rows = await prisma.comisionAfiliacion.findMany({
    where: { mes },
    include: { afiliado: { select: { nombre: true } } },
    orderBy: { monto: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    mes: r.mes,
    afiliadoId: r.afiliadoId,
    afiliadoNombre: r.afiliado.nombre,
    monto: Math.round(r.monto / 100),
    ftdsContados: r.ftdsContados,
    notas: r.notas,
    registradoEn: r.registradoEn,
  }));
}

export interface UpsertComisionInput {
  mes: string;
  afiliadoId: string;
  montoSoles: number;
  ftdsContados?: number;
  notas?: string | null;
  registradoPor?: string;
}

export async function upsertarComision(
  input: UpsertComisionInput,
): Promise<ComisionFila> {
  const monto = Math.round(input.montoSoles * 100);
  const row = await prisma.comisionAfiliacion.upsert({
    where: { mes_afiliadoId: { mes: input.mes, afiliadoId: input.afiliadoId } },
    create: {
      mes: input.mes,
      afiliadoId: input.afiliadoId,
      monto,
      ftdsContados: input.ftdsContados ?? 0,
      notas: input.notas ?? null,
      registradoPor: input.registradoPor ?? null,
    },
    update: {
      monto,
      ftdsContados: input.ftdsContados ?? 0,
      notas: input.notas ?? null,
      registradoPor: input.registradoPor ?? null,
    },
    include: { afiliado: { select: { nombre: true } } },
  });
  invalidarCacheFinanzas();
  return {
    id: row.id,
    mes: row.mes,
    afiliadoId: row.afiliadoId,
    afiliadoNombre: row.afiliado.nombre,
    monto: Math.round(row.monto / 100),
    ftdsContados: row.ftdsContados,
    notas: row.notas,
    registradoEn: row.registradoEn,
  };
}

// ---------------------------------------------------------------------------
// Margen, CAC, LTV
// ---------------------------------------------------------------------------

export interface MargenOperativo {
  mes: string;
  revenue: number;
  costos: number;
  margenSoles: number;
  margenPct: number | null;
}

export async function calcularMargenOperativo(mes: string): Promise<MargenOperativo> {
  const [revenue, costos] = await Promise.all([
    obtenerRevenueMes(mes),
    obtenerCostosMes(mes),
  ]);
  const totalCostos = costos.reduce((acc, c) => acc + c.monto, 0);
  const margen = revenue.total - totalCostos;
  const pct = revenue.total > 0
    ? Math.round((margen / revenue.total) * 1000) / 10
    : null;
  return {
    mes,
    revenue: revenue.total,
    costos: totalCostos,
    margenSoles: margen,
    margenPct: pct,
  };
}

/**
 * CAC: spend de marketing del mes / nuevos suscriptores Premium del mes.
 * Devuelve null si no hay categoría 'marketing_paid' para ese mes.
 */
export async function obtenerCACPromedio(mes: string): Promise<{
  cac: number | null;
  spend: number;
  nuevosSuscriptores: number;
}> {
  const { desde, hasta } = rangoMes(mes);

  const marketing = await prisma.costoOperativo.findFirst({
    where: { mes, categoria: "marketing_paid" },
  });
  const nuevosSuscriptores = await prisma.suscripcion.count({
    where: {
      activa: true,
      iniciada: { gte: desde, lte: hasta },
    },
  });
  if (!marketing || nuevosSuscriptores === 0) {
    return {
      cac: null,
      spend: marketing ? Math.round(marketing.monto / 100) : 0,
      nuevosSuscriptores,
    };
  }
  return {
    cac: Math.round(marketing.monto / 100 / nuevosSuscriptores),
    spend: Math.round(marketing.monto / 100),
    nuevosSuscriptores,
  };
}

/**
 * LTV aproximado: precio promedio mensualizado × duración promedio en meses.
 * Si churn es muy alto, LTV bajo. Si no hay datos suficientes, null.
 */
export async function obtenerLTVPromedio(): Promise<{
  ltv: number | null;
  duracionMesesProm: number | null;
  precioMensualProm: number | null;
}> {
  const susHistoricas = await prisma.suscripcion.findMany({
    where: {
      OR: [{ cancelada: true }, { vencimiento: { lte: new Date() } }],
    },
    select: { plan: true, precio: true, iniciada: true, canceladaEn: true, vencimiento: true },
    take: 500,
  });
  if (susHistoricas.length === 0) {
    return { ltv: null, duracionMesesProm: null, precioMensualProm: null };
  }
  let sumDuracion = 0;
  let sumPrecio = 0;
  for (const s of susHistoricas) {
    const fin = s.canceladaEn ?? s.vencimiento ?? new Date();
    const meses = Math.max(
      1,
      (fin.getTime() - s.iniciada.getTime()) / (1000 * 60 * 60 * 24 * 30),
    );
    sumDuracion += meses;
    const aporte = s.precio / (s.plan === "ANUAL" ? 12 : s.plan === "TRIMESTRAL" ? 3 : 1) / 100;
    sumPrecio += aporte;
  }
  const dur = sumDuracion / susHistoricas.length;
  const precio = sumPrecio / susHistoricas.length;
  return {
    ltv: Math.round(precio * dur),
    duracionMesesProm: Math.round(dur * 10) / 10,
    precioMensualProm: Math.round(precio),
  };
}

// ---------------------------------------------------------------------------
// Proyección 12 meses
// ---------------------------------------------------------------------------

export interface ProyeccionFila {
  mes: string;
  estimadoRevenue: number;
  estimadoCostos: number;
  estimadoMargen: number;
}

/**
 * Proyección lineal con growth rate manual. Si el admin no especifica,
 * usamos el growth rate compuesto del último trimestre.
 */
export async function obtenerProyeccion(
  growthRatePctPropuesto?: number,
  meses = 12,
): Promise<{ growthRate: number; proyeccion: ProyeccionFila[] }> {
  const ultimos = await obtenerRevenueUltimosMeses(4);
  // Growth rate compuesto: (mes 4 / mes 1) ^ (1/3) - 1
  let growthRate = growthRatePctPropuesto ?? 0;
  if (growthRatePctPropuesto === undefined && ultimos.length >= 4) {
    const r0 = ultimos[0]?.total ?? 0;
    const r3 = ultimos[3]?.total ?? 0;
    if (r0 > 0 && r3 > 0) {
      growthRate = (Math.pow(r3 / r0, 1 / 3) - 1) * 100;
    }
  }

  const baseRevenue = ultimos[ultimos.length - 1]?.total ?? 0;
  // Costos: promedio del último mes con datos
  const costoMesActual = await obtenerCostosMes(formatYearMonth(new Date()));
  const baseCostos = costoMesActual.reduce((acc, c) => acc + c.monto, 0);

  const proyeccion: ProyeccionFila[] = [];
  const ahora = new Date();
  for (let i = 1; i <= meses; i++) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() + i, 1);
    const estimadoRevenue = Math.round(
      baseRevenue * Math.pow(1 + growthRate / 100, i),
    );
    // Costos crecen 50% del growth (heurística simple)
    const estimadoCostos = Math.round(
      baseCostos * Math.pow(1 + growthRate / 200, i),
    );
    proyeccion.push({
      mes: formatYearMonth(d),
      estimadoRevenue,
      estimadoCostos,
      estimadoMargen: estimadoRevenue - estimadoCostos,
    });
  }
  return { growthRate: Math.round(growthRate * 10) / 10, proyeccion };
}

// ---------------------------------------------------------------------------
// Catálogo de categorías de costo (para selector en form)
// ---------------------------------------------------------------------------

export const CATEGORIAS_COSTO_PREDEFINIDAS = [
  "anthropic_api",
  "openpay_pasarela",
  "whatsapp_api",
  "resend",
  "railway",
  "cloudflare",
  "salarios",
  "premios_liga",
  "marketing_paid",
  "legal_compliance",
  "otros",
] as const;

export const LABEL_CATEGORIA: Record<string, string> = {
  anthropic_api: "Anthropic API (Claude)",
  openpay_pasarela: "OpenPay (pasarela)",
  whatsapp_api: "WhatsApp Business",
  resend: "Resend (email)",
  railway: "Railway (hosting)",
  cloudflare: "Cloudflare",
  salarios: "Salarios",
  premios_liga: "Premios Liga Habla!",
  marketing_paid: "Marketing pagado",
  legal_compliance: "Legal / Compliance",
  otros: "Otros",
};

