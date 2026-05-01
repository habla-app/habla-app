// Servicio de KPIs admin — Lote F (May 2026).
//
// Calcula los KPIs estratégicos del negocio que alimentan
// `/admin/dashboard`. 5 categorías canónicas del v3.1:
//
//   1. Captación: visitantes, registros, tasa rebote, conv visita→registro.
//   2. Productos B y C: vistas de partido, predicciones, cross-link, tipsters.
//   3. Conversión: CTR afiliados, click→registro, registro→FTD, free→Premium.
//   4. Retención: MRR Premium, churn, DAU/MAU, engagement Channel.
//   5. Económicos: revenue mes, margen operativo, CAC, LTV/CAC.
//
// Cada KPI viene con un target y un status ('good'|'amber'|'red') calculado
// server-side comparando vs target. Tendencia opcional vs periodo anterior.
//
// Implementación: queries existentes de analytics.service + counts directos
// de tablas. Datos faltantes (margen operativo, CAC) devuelven `null` en
// `valor` con `status: 'neutral'` — no rompemos la vista, solo señalamos
// que falta data manual o de futuras integraciones.
//
// Performance: las queries ejecutan en paralelo con Promise.all en cada
// función. El page padre vuelve a paralelizar las 5 categorías. Si algo
// se pone lento, agregar cache Redis con TTL 5 min (sigue regla del spec).

import { prisma } from "@habla/db";
import {
  obtenerVisitasPorDia,
  obtenerRegistrosPorDia,
  obtenerEventosTopPeriodo,
} from "./analytics.service";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type Rango = "7d" | "30d" | "mes_actual" | "mes_anterior";

export type KPIStatus = "good" | "amber" | "red" | "neutral";

export type KPIFormato = "number" | "percent" | "currency_pen" | "multiplier";

export interface KPI {
  id: string;
  label: string;
  valor: number | null;
  formato: KPIFormato;
  target: number | null;
  targetLabel?: string;
  status: KPIStatus;
  tendenciaPct?: number;
  tendenciaDir?: "up" | "down" | "flat";
  helpText?: string;
}

export interface KpisGrupo {
  titulo: string;
  emoji: string;
  kpis: KPI[];
}

// ---------------------------------------------------------------------------
// Helpers de rango
// ---------------------------------------------------------------------------

function resolverRango(rango: Rango): {
  desde: Date;
  hasta: Date;
  desdeAnterior: Date;
  hastaAnterior: Date;
} {
  const hasta = new Date();
  let desde: Date;
  let desdeAnterior: Date;
  let hastaAnterior: Date;

  if (rango === "7d") {
    desde = new Date(hasta.getTime() - 7 * 24 * 60 * 60 * 1000);
    desdeAnterior = new Date(desde.getTime() - 7 * 24 * 60 * 60 * 1000);
    hastaAnterior = desde;
  } else if (rango === "mes_actual") {
    desde = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
    const mesAnterior = new Date(hasta.getFullYear(), hasta.getMonth() - 1, 1);
    desdeAnterior = mesAnterior;
    hastaAnterior = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  } else if (rango === "mes_anterior") {
    desde = new Date(hasta.getFullYear(), hasta.getMonth() - 1, 1);
    const finMesAnterior = new Date(
      hasta.getFullYear(),
      hasta.getMonth(),
      0,
      23,
      59,
      59,
    );
    return {
      desde,
      hasta: finMesAnterior,
      desdeAnterior: new Date(hasta.getFullYear(), hasta.getMonth() - 2, 1),
      hastaAnterior: new Date(hasta.getFullYear(), hasta.getMonth() - 1, 0, 23, 59, 59),
    };
  } else {
    // 30d default
    desde = new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000);
    desdeAnterior = new Date(desde.getTime() - 30 * 24 * 60 * 60 * 1000);
    hastaAnterior = desde;
  }

  return { desde, hasta, desdeAnterior, hastaAnterior };
}

function calcularTendencia(
  actual: number,
  anterior: number,
): { dir: "up" | "down" | "flat"; pct: number } {
  if (anterior === 0) {
    return { dir: actual > 0 ? "up" : "flat", pct: 0 };
  }
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  return {
    dir: pct > 1 ? "up" : pct < -1 ? "down" : "flat",
    pct: Math.abs(pct),
  };
}

function statusVsTarget(
  valor: number | null,
  target: number,
  modo: "mayor_es_mejor" | "menor_es_mejor",
  umbralAmbar = 0.8,
): KPIStatus {
  if (valor === null) return "neutral";
  if (modo === "mayor_es_mejor") {
    if (valor >= target) return "good";
    if (valor >= target * umbralAmbar) return "amber";
    return "red";
  }
  // menor_es_mejor (ej. churn, tasa rebote, CAC)
  if (valor <= target) return "good";
  if (valor <= target * (2 - umbralAmbar)) return "amber";
  return "red";
}

// ---------------------------------------------------------------------------
// 1. Captación
// ---------------------------------------------------------------------------

export async function obtenerKpisCaptacion(rango: Rango): Promise<KpisGrupo> {
  const { desde, hasta, desdeAnterior, hastaAnterior } = resolverRango(rango);

  const [
    visitasActual,
    visitasAnterior,
    registrosActual,
    registrosAnterior,
  ] = await Promise.all([
    obtenerVisitasPorDia({ desde, hasta }),
    obtenerVisitasPorDia({ desde: desdeAnterior, hasta: hastaAnterior }),
    obtenerRegistrosPorDia({ desde, hasta }),
    obtenerRegistrosPorDia({ desde: desdeAnterior, hasta: hastaAnterior }),
  ]);

  const visitasTotales = visitasActual.reduce((acc, v) => acc + v.visitas, 0);
  const visitasTotalesAnt = visitasAnterior.reduce(
    (acc, v) => acc + v.visitas,
    0,
  );
  const registrosTotales = registrosActual.reduce(
    (acc, r) => acc + r.registros,
    0,
  );
  const registrosTotalesAnt = registrosAnterior.reduce(
    (acc, r) => acc + r.registros,
    0,
  );

  const tendVisitas = calcularTendencia(visitasTotales, visitasTotalesAnt);
  const tendRegistros = calcularTendencia(
    registrosTotales,
    registrosTotalesAnt,
  );

  const conversionVisitaRegistro =
    visitasTotales > 0
      ? Math.round((registrosTotales / visitasTotales) * 1000) / 10
      : 0;

  return {
    titulo: "Captación",
    emoji: "📥",
    kpis: [
      {
        id: "visitantes_unicos",
        label: "Visitantes únicos",
        valor: visitasTotales,
        formato: "number",
        target: rango === "30d" ? 30000 : null,
        targetLabel: rango === "30d" ? "30k+ post-launch" : undefined,
        status:
          rango === "30d"
            ? statusVsTarget(visitasTotales, 30000, "mayor_es_mejor", 0.5)
            : tendVisitas.dir === "down"
              ? "amber"
              : "good",
        tendenciaPct: tendVisitas.pct,
        tendenciaDir: tendVisitas.dir,
      },
      {
        id: "registros_nuevos",
        label: "Registros nuevos",
        valor: registrosTotales,
        formato: "number",
        target: rango === "30d" ? 1500 : null,
        targetLabel: rango === "30d" ? "1.5k+ / mes" : undefined,
        status:
          rango === "30d"
            ? statusVsTarget(registrosTotales, 1500, "mayor_es_mejor", 0.5)
            : tendRegistros.dir === "down"
              ? "amber"
              : "good",
        tendenciaPct: tendRegistros.pct,
        tendenciaDir: tendRegistros.dir,
      },
      {
        id: "conv_visita_registro",
        label: "Conv. visita → registro",
        valor: conversionVisitaRegistro,
        formato: "percent",
        target: 4,
        targetLabel: "4%+",
        status: statusVsTarget(
          conversionVisitaRegistro,
          4,
          "mayor_es_mejor",
          0.5,
        ),
      },
      {
        id: "tasa_rebote",
        label: "Tasa rebote",
        valor: null,
        formato: "percent",
        target: 60,
        targetLabel: "<60%",
        status: "neutral",
        helpText:
          "Calculada con eventos `$pageview` con sessionDuration<10s. Pendiente de cableado.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 2. Productos B y C
// ---------------------------------------------------------------------------

export async function obtenerKpisProductos(rango: Rango): Promise<KpisGrupo> {
  const { desde, hasta } = resolverRango(rango);

  const [topEventos, partidosCount, ticketsCount] = await Promise.all([
    obtenerEventosTopPeriodo({ desde, hasta }),
    prisma.partido.count({
      where: { fechaInicio: { gte: desde, lte: hasta } },
    }),
    prisma.ticket.count({
      where: { creadoEn: { gte: desde, lte: hasta } },
    }),
  ]);

  const vistasPartido =
    topEventos.find((e) => e.evento === "partido_visto")?.count ?? 0;
  const prediccionesEnviadas =
    topEventos.find((e) => e.evento === "prediccion_enviada")?.count ?? 0;
  const dias = Math.max(
    1,
    Math.round(
      (hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
  const vistasPartidoPorDia = Math.round(vistasPartido / dias);
  const prediccionesPorPartido =
    partidosCount > 0 ? Math.round(ticketsCount / partidosCount) : 0;

  // Tipsters activos: usuarios únicos con tickets en el rango / total registrados
  const usuariosConTickets = await prisma.ticket.findMany({
    where: { creadoEn: { gte: desde, lte: hasta } },
    select: { usuarioId: true },
    distinct: ["usuarioId"],
  });
  const totalUsuarios = await prisma.usuario.count({
    where: { creadoEn: { lte: hasta } },
  });
  const tipstersActivosPct =
    totalUsuarios > 0
      ? Math.round((usuariosConTickets.length / totalUsuarios) * 1000) / 10
      : 0;

  return {
    titulo: "Productos B y C",
    emoji: "⚽",
    kpis: [
      {
        id: "vistas_partido_dia",
        label: "Vistas de partido / día",
        valor: vistasPartidoPorDia,
        formato: "number",
        target: 1000,
        targetLabel: "1k+",
        status: statusVsTarget(vistasPartidoPorDia, 1000, "mayor_es_mejor"),
      },
      {
        id: "predicciones_partido",
        label: "Predicciones / partido",
        valor: prediccionesPorPartido,
        formato: "number",
        target: 100,
        targetLabel: "100+",
        status: statusVsTarget(prediccionesPorPartido, 100, "mayor_es_mejor"),
      },
      {
        id: "tipsters_activos",
        label: "Tipsters activos / mes",
        valor: tipstersActivosPct,
        formato: "percent",
        target: 30,
        targetLabel: "30%+",
        status: statusVsTarget(tipstersActivosPct, 30, "mayor_es_mejor"),
      },
      {
        id: "cross_link_b_c",
        label: "Cross-link B↔C",
        valor: null,
        formato: "percent",
        target: 25,
        targetLabel: "25%+",
        status: "neutral",
        helpText:
          "Eventos `cross_link_partido_torneo` clickeados / vistas de partido. Pendiente de cableado.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 3. Conversión
// ---------------------------------------------------------------------------

export async function obtenerKpisConversion(rango: Rango): Promise<KpisGrupo> {
  const { desde, hasta } = resolverRango(rango);

  const [clicksAfiliados, conversionesAfiliados, suscripcionesActivas, totalUsuarios] =
    await Promise.all([
      prisma.clickAfiliado.count({
        where: { creadoEn: { gte: desde, lte: hasta } },
      }),
      prisma.conversionAfiliado.count({
        where: {
          tipo: "FTD",
          reportadoEn: { gte: desde, lte: hasta },
        },
      }),
      prisma.suscripcion.count({ where: { activa: true } }),
      prisma.usuario.count({ where: { creadoEn: { lte: hasta } } }),
    ]);

  // CTR site-wide afiliados: clicks/visitas. Visitas son del topEventos.
  const visitasResult = await obtenerVisitasPorDia({ desde, hasta });
  const visitasTotales = visitasResult.reduce((acc, v) => acc + v.visitas, 0);
  const ctrAfiliados =
    visitasTotales > 0
      ? Math.round((clicksAfiliados / visitasTotales) * 1000) / 10
      : 0;

  const clickARegistro =
    clicksAfiliados > 0
      ? Math.round(
          (conversionesAfiliados / clicksAfiliados) * 1000,
        ) / 10
      : 0;

  const freeAPremium =
    totalUsuarios > 0
      ? Math.round((suscripcionesActivas / totalUsuarios) * 1000) / 10
      : 0;

  return {
    titulo: "Conversión",
    emoji: "💰",
    kpis: [
      {
        id: "ctr_afiliados",
        label: "CTR site-wide afiliados",
        valor: ctrAfiliados,
        formato: "percent",
        target: 5,
        targetLabel: "5%+",
        status: statusVsTarget(ctrAfiliados, 5, "mayor_es_mejor"),
      },
      {
        id: "click_a_registro_casa",
        label: "Click → registro casa",
        valor: clickARegistro,
        formato: "percent",
        target: 25,
        targetLabel: "25%+",
        status: statusVsTarget(clickARegistro, 25, "mayor_es_mejor"),
      },
      {
        id: "registro_a_ftd",
        label: "Registro → FTD",
        valor: null,
        formato: "percent",
        target: 25,
        targetLabel: "25%+",
        status: "neutral",
        helpText:
          "Reportado por las casas (manual). Pendiente de cableado de webhooks de partner.",
      },
      {
        id: "free_a_premium",
        label: "Free → Premium",
        valor: freeAPremium,
        formato: "percent",
        target: 1,
        targetLabel: "1%+",
        status: statusVsTarget(freeAPremium, 1, "mayor_es_mejor"),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 4. Retención
// ---------------------------------------------------------------------------

export async function obtenerKpisRetencion(_rango: Rango): Promise<KpisGrupo> {
  const [activas, canceladas30d] = await Promise.all([
    prisma.suscripcion.count({ where: { activa: true } }),
    prisma.suscripcion.count({
      where: {
        cancelada: true,
        canceladaEn: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  // MRR aproximado: suma de precios mensualizados
  const susActivas = await prisma.suscripcion.findMany({
    where: { activa: true },
    select: { plan: true, precio: true },
  });
  const mrrCentimos = susActivas.reduce((acc, s) => {
    const meses = s.plan === "ANUAL" ? 12 : s.plan === "TRIMESTRAL" ? 3 : 1;
    return acc + Math.round(s.precio / meses);
  }, 0);
  const mrrSoles = Math.round(mrrCentimos / 100);

  const churn = activas + canceladas30d > 0
    ? Math.round((canceladas30d / (activas + canceladas30d)) * 1000) / 10
    : 0;

  return {
    titulo: "Retención",
    emoji: "🔁",
    kpis: [
      {
        id: "mrr_premium",
        label: "MRR Premium",
        valor: mrrSoles,
        formato: "currency_pen",
        target: null,
        status: mrrSoles > 0 ? "good" : "neutral",
        helpText:
          "Suma de precios mensualizados de suscripciones activas. Mensual = precio, trimestral = precio/3, anual = precio/12.",
      },
      {
        id: "churn_mensual",
        label: "Churn mensual",
        valor: churn,
        formato: "percent",
        target: 20,
        targetLabel: "<20%",
        status: statusVsTarget(churn, 20, "menor_es_mejor"),
      },
      {
        id: "dau_mau",
        label: "DAU/MAU ratio",
        valor: null,
        formato: "percent",
        target: 15,
        targetLabel: "15%+",
        status: "neutral",
        helpText:
          "Calculado con eventos `$pageview` únicos por día / únicos por mes. Pendiente de cableado.",
      },
      {
        id: "engagement_channel",
        label: "Engagement Channel",
        valor: null,
        formato: "percent",
        target: 80,
        targetLabel: "80%+",
        status: "neutral",
        helpText:
          "% lecturas/envíos del WhatsApp Channel. Calculado en `/admin/channel-whatsapp`.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 5. Económicos
// ---------------------------------------------------------------------------

export async function obtenerKpisEconomicos(rango: Rango): Promise<KpisGrupo> {
  const { desde, hasta, desdeAnterior, hastaAnterior } = resolverRango(rango);

  const [pagosActual, pagosAnterior] = await Promise.all([
    prisma.pagoSuscripcion.findMany({
      where: { estado: "PAGADO", acreditadoEn: { gte: desde, lte: hasta } },
      select: { monto: true },
    }),
    prisma.pagoSuscripcion.findMany({
      where: {
        estado: "PAGADO",
        acreditadoEn: { gte: desdeAnterior, lte: hastaAnterior },
      },
      select: { monto: true },
    }),
  ]);

  const revenueActual = pagosActual.reduce((acc, p) => acc + p.monto, 0) / 100;
  const revenueAnterior =
    pagosAnterior.reduce((acc, p) => acc + p.monto, 0) / 100;
  const tendRevenue = calcularTendencia(revenueActual, revenueAnterior);

  return {
    titulo: "Económicos",
    emoji: "📈",
    kpis: [
      {
        id: "revenue_periodo",
        label: "Revenue Premium",
        valor: Math.round(revenueActual),
        formato: "currency_pen",
        target: null,
        status: tendRevenue.dir === "down" ? "amber" : "good",
        tendenciaPct: tendRevenue.pct,
        tendenciaDir: tendRevenue.dir,
      },
      {
        id: "margen_operativo",
        label: "Margen operativo",
        valor: null,
        formato: "percent",
        target: 60,
        targetLabel: "60%+",
        status: "neutral",
        helpText:
          "Revenue - costos operativos. Pendiente de carga manual de costos.",
      },
      {
        id: "cac",
        label: "CAC",
        valor: null,
        formato: "currency_pen",
        target: 50,
        targetLabel: "<S/50",
        status: "neutral",
        helpText:
          "Costo de adquisición de cliente (gasto marketing / nuevos suscriptores). Pendiente de tracking de gasto.",
      },
      {
        id: "ltv_cac",
        label: "LTV/CAC",
        valor: null,
        formato: "multiplier",
        target: 3,
        targetLabel: "3x+",
        status: "neutral",
        helpText:
          "Lifetime Value / CAC. Requiere métricas históricas de retención + CAC.",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Alarmas — Lote G: lee del modelo `Alarma` real
// ---------------------------------------------------------------------------

import { obtenerAlarmasActivas as obtenerAlarmasActivasReal } from "./alarmas.service";

export interface Alarma {
  id: string;
  kpi: string;
  valorActual: string;
  umbral: string;
  accionSugerida: string;
  href: string;
  severidad: "info" | "warning" | "critical";
}

/**
 * Adapter que convierte `AlarmaFila` (de alarmas.service) al shape esperado
 * por `<AlarmaBanner>` del dashboard del Lote F. Mantenemos la interfaz
 * estable para que el banner no se rompa cuando llegue Lote G.
 */
export async function obtenerAlarmasActivas(): Promise<Alarma[]> {
  const filas = await obtenerAlarmasActivasReal();
  return filas.map((a) => {
    const ctx = (a.contexto ?? {}) as {
      valorActual?: number;
      thresholdMin?: number | null;
      thresholdMax?: number | null;
    };
    const umbral =
      ctx.thresholdMin !== undefined && ctx.thresholdMin !== null
        ? `> ${ctx.thresholdMin}`
        : ctx.thresholdMax !== undefined && ctx.thresholdMax !== null
          ? `< ${ctx.thresholdMax}`
          : "—";
    return {
      id: a.id,
      kpi: a.titulo,
      valorActual: ctx.valorActual !== undefined ? String(ctx.valorActual) : "—",
      umbral,
      accionSugerida: a.descripcion.slice(0, 200),
      href: a.metricId
        ? `/admin/kpis?metric=${a.metricId}`
        : "/admin/alarmas",
      severidad:
        a.severidad === "CRITICAL"
          ? "critical"
          : a.severidad === "WARNING"
            ? "warning"
            : "info",
    };
  });
}
