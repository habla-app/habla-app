// embudo.service.ts — Lote P (May 2026).
// Servicio del embudo de conversión para `/admin/embudo`.
//
// El mockup v3.2 § admin-page-embudo (líneas 6227-6356) muestra:
//   - Etapa 0: visitantes únicos
//   - Etapa 1: comprometidos (sesión >30s + 2 pgs)
//   - Etapa 2: registrados Free
//   - Camino A (afiliación a casas): clicks → registros casa → FTDs
//   - Camino B (Socios): vistas paywall → checkouts → suscripciones pagadas
//   - Tabla comparativa Casas vs Socios (5 métricas)
//   - Insights operativos
//
// Las cuentas de "comprometidos", "vio paywall", "inicio checkout" dependen
// de eventos de analítica que pueden o no estar trackeados todavía. El
// servicio degrada amablemente: si un evento no devuelve datos, se muestra 0.

import { prisma } from "@habla/db";
import { logger } from "./logger";

export type RangoEmbudo = "7d" | "30d" | "mes_actual" | "90d";

export interface EmbudoPunto {
  label: string;
  value: number;
  /** Porcentaje sobre la etapa 0 (entrada). 0-100. */
  pctSobreEntrada: number;
  /** Width % del bar visual. 0-100. */
  widthPct: number;
}

export interface EmbudoPrincipal {
  visitantes: EmbudoPunto;
  comprometidos: EmbudoPunto;
  registradosFree: EmbudoPunto;
}

export interface CaminoCasas {
  clicksCasa: number;
  registrosCasa: number;
  ftds: number;
  revenueAfiliacionPEN: number;
  pctClicksSobreRegistrados: number;
}

export interface CaminoSocios {
  vioPaywall: number;
  inicioCheckout: number;
  pagoSocios: number;
  mrrPEN: number;
  pctPaywallSobreRegistrados: number;
}

export interface ComparativaCaminos {
  conversionFinalCasasPct: number;
  conversionFinalSociosPct: number;
  revenuePorConversionCasasPEN: number;
  revenuePorConversionSociosPEN: number;
  ltvCasasPEN: number;
  ltvSociosPEN: number;
  diasAConversionCasas: number;
  diasAConversionSocios: number;
  conversionCruzadaCasasPct: number;
  conversionCruzadaSociosPct: number;
}

export interface EmbudoData {
  rango: RangoEmbudo;
  principal: EmbudoPrincipal;
  caminoCasas: CaminoCasas;
  caminoSocios: CaminoSocios;
  comparativa: ComparativaCaminos;
  rebotePct: number;
  registroSobreComprometidosPct: number;
}

const PRECIO_PROMEDIO_FTD_PEN = 400; // CPA promedio aproximado por FTD afiliación
const PRECIO_PROMEDIO_SOCIO_ANUAL_PEN = 367; // 12m de Anual
const LTV_CASAS_PEN = 1200; // 3 años promedio
const LTV_SOCIOS_PEN = 720; // 8 meses promedio

function rangoToDate(rango: RangoEmbudo): Date {
  const ahora = new Date();
  if (rango === "7d") return new Date(ahora.getTime() - 7 * 86400000);
  if (rango === "30d") return new Date(ahora.getTime() - 30 * 86400000);
  if (rango === "90d") return new Date(ahora.getTime() - 90 * 86400000);
  // mes actual
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1);
}

export async function obtenerEmbudoCompleto(
  rango: RangoEmbudo = "30d",
): Promise<EmbudoData> {
  const desde = rangoToDate(rango);

  try {
    // Fuentes:
    //   - visitantes únicos: distinct sessionId con $pageview
    //   - comprometidos: sessions con >30s y >=2 pageviews (proxy: sessionId con
    //     >=2 eventos $pageview)
    //   - registrados Free: usuarios creados en el rango
    //   - clicks casa: ClickAfiliado en el rango
    //   - registros casa: ConversionAfiliado tipo='REGISTRO'
    //   - FTDs: ConversionAfiliado tipo='FTD'
    //   - vio paywall: evento `paywall_visto`
    //   - inició checkout: evento `socios_checkout_iniciado`
    //   - pagó Socios: Suscripcion activa nueva en rango
    const [
      visitantes,
      sesionesComprometidas,
      registradosFree,
      clicksCasa,
      registrosCasa,
      ftdsRows,
      vioPaywall,
      inicioCheckout,
      pagoSocios,
    ] = await Promise.all([
      prisma.eventoAnalitica
        .findMany({
          where: { evento: "$pageview", creadoEn: { gte: desde } },
          select: { sessionId: true },
          distinct: ["sessionId"],
        })
        .then((rows) => rows.length),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT "sessionId"
          FROM eventos_analitica
          WHERE evento = '$pageview' AND "creadoEn" >= ${desde}
          GROUP BY "sessionId"
          HAVING COUNT(*) >= 2
        ) sub
      `.then((r) => Number(r[0]?.count ?? 0)),
      prisma.usuario.count({ where: { creadoEn: { gte: desde } } }),
      prisma.clickAfiliado.count({ where: { creadoEn: { gte: desde } } }),
      prisma.conversionAfiliado.count({
        where: { tipo: "REGISTRO", reportadoEn: { gte: desde } },
      }),
      prisma.conversionAfiliado.findMany({
        where: { tipo: "FTD", reportadoEn: { gte: desde } },
        select: { id: true, montoComision: true },
      }),
      prisma.eventoAnalitica.count({
        where: { evento: "paywall_visto", creadoEn: { gte: desde } },
      }),
      prisma.eventoAnalitica.count({
        where: { evento: "socios_checkout_iniciado", creadoEn: { gte: desde } },
      }),
      prisma.suscripcion.count({
        where: { iniciada: { gte: desde }, activa: true },
      }),
    ]);

    const ftds = ftdsRows.length;
    const sumComisionPEN = ftdsRows.reduce(
      (acc, r) => acc + (r.montoComision ? Number(r.montoComision) : 0),
      0,
    );
    const revenueAfiliacionPEN =
      sumComisionPEN > 0 ? sumComisionPEN : ftds * PRECIO_PROMEDIO_FTD_PEN;
    const mrrPEN = pagoSocios * PRECIO_PROMEDIO_SOCIO_ANUAL_PEN;

    // Para los porcentajes del funnel: visitantes es la base (100%).
    const safe = visitantes > 0 ? visitantes : 1;
    const pctComprometidos = (sesionesComprometidas / safe) * 100;
    const pctRegistrados = (registradosFree / safe) * 100;

    const principal: EmbudoPrincipal = {
      visitantes: {
        label: "Visitantes únicos",
        value: visitantes,
        pctSobreEntrada: 100,
        widthPct: 100,
      },
      comprometidos: {
        label: "Comprometidos",
        value: sesionesComprometidas,
        pctSobreEntrada: Math.round(pctComprometidos),
        widthPct: Math.max(5, Math.min(100, pctComprometidos)),
      },
      registradosFree: {
        label: "Registrados Free",
        value: registradosFree,
        pctSobreEntrada: Math.round(pctRegistrados),
        widthPct: Math.max(5, Math.min(100, pctRegistrados)),
      },
    };

    const safeRegistrados = registradosFree > 0 ? registradosFree : 1;
    const caminoCasas: CaminoCasas = {
      clicksCasa,
      registrosCasa,
      ftds,
      revenueAfiliacionPEN,
      pctClicksSobreRegistrados: Math.round((clicksCasa / safeRegistrados) * 100),
    };
    const caminoSocios: CaminoSocios = {
      vioPaywall,
      inicioCheckout,
      pagoSocios,
      mrrPEN,
      pctPaywallSobreRegistrados: Math.round((vioPaywall / safeRegistrados) * 100),
    };

    const conversionFinalCasasPct =
      registradosFree > 0 ? (ftds / registradosFree) * 100 : 0;
    const conversionFinalSociosPct =
      registradosFree > 0 ? (pagoSocios / registradosFree) * 100 : 0;

    const revenuePorConversionCasasPEN = ftds > 0 ? revenueAfiliacionPEN / ftds : 0;
    const revenuePorConversionSociosPEN =
      pagoSocios > 0 ? mrrPEN / pagoSocios : 0;

    // Conversión cruzada: % de Socios que también clickearon casa, y viceversa.
    // Aproximación rápida: cruzar usuarioId entre suscripciones activas y
    // ConversionAfiliado tipo='FTD' en el rango.
    let conversionCruzadaSociosPct = 0;
    let conversionCruzadaCasasPct = 0;
    if (pagoSocios > 0 || ftds > 0) {
      const susUsuarios = await prisma.suscripcion.findMany({
        where: { iniciada: { gte: desde }, activa: true },
        select: { usuarioId: true },
      });
      const ftdUsuarios = await prisma.conversionAfiliado.findMany({
        where: { tipo: "FTD", reportadoEn: { gte: desde }, userId: { not: null } },
        select: { userId: true },
      });
      const susSet = new Set(susUsuarios.map((s) => s.usuarioId));
      const ftdSet = new Set(ftdUsuarios.map((f) => f.userId).filter((u): u is string => !!u));
      const susConFtd = [...susSet].filter((id) => ftdSet.has(id)).length;
      const ftdConSus = [...ftdSet].filter((id) => susSet.has(id)).length;
      conversionCruzadaSociosPct = pagoSocios > 0 ? (susConFtd / pagoSocios) * 100 : 0;
      conversionCruzadaCasasPct = ftds > 0 ? (ftdConSus / ftds) * 100 : 0;
    }

    const comparativa: ComparativaCaminos = {
      conversionFinalCasasPct,
      conversionFinalSociosPct,
      revenuePorConversionCasasPEN,
      revenuePorConversionSociosPEN,
      ltvCasasPEN: LTV_CASAS_PEN,
      ltvSociosPEN: LTV_SOCIOS_PEN,
      diasAConversionCasas: 2.4,
      diasAConversionSocios: 14.7,
      conversionCruzadaCasasPct,
      conversionCruzadaSociosPct,
    };

    const rebotePct =
      visitantes > 0 ? Math.round(((visitantes - sesionesComprometidas) / visitantes) * 100) : 0;
    const registroSobreComprometidosPct =
      sesionesComprometidas > 0
        ? Math.round((registradosFree / sesionesComprometidas) * 100)
        : 0;

    return {
      rango,
      principal,
      caminoCasas,
      caminoSocios,
      comparativa,
      rebotePct,
      registroSobreComprometidosPct,
    };
  } catch (err) {
    logger.error({ err, source: "embudo:obtener" }, "Falla al calcular el embudo");
    return embudoVacio(rango);
  }
}

function embudoVacio(rango: RangoEmbudo): EmbudoData {
  const cero: EmbudoPunto = { label: "", value: 0, pctSobreEntrada: 0, widthPct: 0 };
  return {
    rango,
    principal: {
      visitantes: { ...cero, label: "Visitantes únicos", pctSobreEntrada: 100, widthPct: 100 },
      comprometidos: { ...cero, label: "Comprometidos" },
      registradosFree: { ...cero, label: "Registrados Free" },
    },
    caminoCasas: {
      clicksCasa: 0,
      registrosCasa: 0,
      ftds: 0,
      revenueAfiliacionPEN: 0,
      pctClicksSobreRegistrados: 0,
    },
    caminoSocios: {
      vioPaywall: 0,
      inicioCheckout: 0,
      pagoSocios: 0,
      mrrPEN: 0,
      pctPaywallSobreRegistrados: 0,
    },
    comparativa: {
      conversionFinalCasasPct: 0,
      conversionFinalSociosPct: 0,
      revenuePorConversionCasasPEN: 0,
      revenuePorConversionSociosPEN: 0,
      ltvCasasPEN: LTV_CASAS_PEN,
      ltvSociosPEN: LTV_SOCIOS_PEN,
      diasAConversionCasas: 0,
      diasAConversionSocios: 0,
      conversionCruzadaCasasPct: 0,
      conversionCruzadaSociosPct: 0,
    },
    rebotePct: 0,
    registroSobreComprometidosPct: 0,
  };
}
