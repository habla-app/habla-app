// Evaluador de AnalisisPartido post-partido — Lote L v3.2 (May 2026).
// Spec: docs/plan-trabajo-claude-code-v3.2.md § Lote L #4 + decisión §4.3 +
// §4.9.4 del análisis-repo-vs-mockup-v3.2.md.
//
// Cron in-process corre cada hora. Para cada AnalisisPartido APROBADO cuyo
// partido pasó a FINALIZADO en las últimas 48h, calcula GANADO/PERDIDO/NULO
// para todos los bloques medibles (1X2, BTTS, ±2.5, marcador exacto,
// tarjeta roja, mercados secundarios, combinada óptima) y agrega los
// resultados a una tabla in-memory de KPIs que `motor-salud.service.ts`
// consume.
//
// El cálculo es determinístico — basado en `Partido.golesLocal`,
// `golesVisita`, `btts`, `mas25Goles`, `huboTarjetaRoja`. Esos campos los
// popula el poller del Sub-Sprint 5 + el evaluador de tickets de la Liga.
//
// Manejo de CANCELLED (decisión §4.9.4): si Partido.estado === "CANCELADO",
// el evaluador NO cuenta el partido, marca el registro de KPIs como NULO y
// el evaluador del módulo Liga (puntuacion.service) ya salta los tickets
// asociados (cero puntos para todos). Email de aviso lo manda el cron de
// importación al detectar la transición a CANCELADO (ver
// partidos-import.service.ts del Lote L).
//
// El evaluador NO escribe directamente sobre PickPremium — eso lo sigue
// haciendo `picks-premium-evaluador.service.ts` del Lote E para el canal
// WhatsApp. Acá sólo computamos KPIs del motor enriquecido.

import { prisma, type AnalisisPartido, type Partido } from "@habla/db";

import { logger } from "./logger";
import { track } from "./analytics.service";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ResultadoMercado = "GANADO" | "PERDIDO" | "NULO" | "INDETERMINADO";

export interface EvaluacionAnalisis {
  analisisId: string;
  partidoId: string;
  /** Resultado del bloque 1X2 (siempre evaluable cuando hay goles). */
  resultado1X2: ResultadoMercado;
  /** Resultado de la combinada óptima (NULO si no hubo combinada). */
  resultadoCombinada: ResultadoMercado;
  /** EV+ realizado de la combinada (si aplicable). */
  evCombinada: number | null;
  /** Resultado por mercado secundario (en orden de mercadosSecundarios). */
  resultadosSecundarios: ResultadoMercado[];
  /** Resultado del análisis profundo de tarjetas (riesgo roja vs realidad). */
  resultadoTarjetaRoja: ResultadoMercado;
  /** Resultado del análisis de goles (acertó si banda ±0.5 incluye goles
   *  reales total). */
  resultadoGoles: ResultadoMercado;
}

export interface EvaluarReporte {
  candidatos: number;
  evaluados: number;
  cancelados: number;
  sinResolver: number;
  ganados1X2: number;
  perdidos1X2: number;
  ganadosCombinada: number;
  perdidosCombinada: number;
}

// ---------------------------------------------------------------------------
// Cálculo determinístico por mercado
// ---------------------------------------------------------------------------

interface ProbablilidadesShape {
  local?: number;
  empate?: number;
  visita?: number;
}

interface CombinadaShape {
  mercados?: Array<{
    mercado?: string;
    outcome?: string;
    cuota?: number;
    casa?: string;
  }>;
  cuotaTotal?: number;
  stake?: number;
  evPlus?: number;
}

interface MercadoSecundarioShape {
  mercado?: string;
  outcome?: string;
  cuota?: number;
  value?: number;
  casa?: string;
}

interface AnalisisGolesShape {
  golesEsperadosLocal?: number;
  golesEsperadosVisita?: number;
}

interface AnalisisTarjetasShape {
  riesgoRoja?: "BAJO" | "MEDIO" | "ALTO";
  tarjetasEsperadasTotal?: number;
}

function evaluar1X2(
  pron: string,
  partido: Partido,
): ResultadoMercado {
  const gl = partido.golesLocal;
  const gv = partido.golesVisita;
  if (gl === null || gv === null) return "INDETERMINADO";
  const reales = gl > gv ? "LOCAL" : gl < gv ? "VISITA" : "EMPATE";
  return pron === reales ? "GANADO" : "PERDIDO";
}

function evaluarMercadoIndividual(
  mercado: string,
  outcome: string,
  partido: Partido,
): ResultadoMercado {
  const gl = partido.golesLocal;
  const gv = partido.golesVisita;
  if (gl === null || gv === null) return "INDETERMINADO";

  switch (mercado) {
    case "RESULTADO_1X2": {
      if (outcome === "home") return gl > gv ? "GANADO" : "PERDIDO";
      if (outcome === "away") return gv > gl ? "GANADO" : "PERDIDO";
      if (outcome === "draw") return gl === gv ? "GANADO" : "PERDIDO";
      return "PERDIDO";
    }
    case "BTTS": {
      const btts = partido.btts ?? (gl > 0 && gv > 0);
      if (outcome === "btts_si") return btts ? "GANADO" : "PERDIDO";
      if (outcome === "btts_no") return btts ? "PERDIDO" : "GANADO";
      return "PERDIDO";
    }
    case "OVER_UNDER_25": {
      const total = gl + gv;
      const over = partido.mas25Goles ?? total > 2;
      if (outcome === "over") return over ? "GANADO" : "PERDIDO";
      if (outcome === "under") return over ? "PERDIDO" : "GANADO";
      return "PERDIDO";
    }
    case "TARJETA_ROJA": {
      const huboRoja = partido.huboTarjetaRoja;
      if (huboRoja === null || huboRoja === undefined) return "INDETERMINADO";
      if (outcome === "roja_si") return huboRoja ? "GANADO" : "PERDIDO";
      if (outcome === "roja_no") return huboRoja ? "PERDIDO" : "GANADO";
      return "PERDIDO";
    }
    case "MARCADOR_EXACTO": {
      const m = /^(\d+)-(\d+)$/.exec(outcome.trim());
      if (!m) return "PERDIDO";
      return Number(m[1]) === gl && Number(m[2]) === gv ? "GANADO" : "PERDIDO";
    }
    default:
      return "INDETERMINADO";
  }
}

function evaluarCombinada(
  combinada: unknown,
  partido: Partido,
): { resultado: ResultadoMercado; evRealizado: number | null } {
  if (!combinada || typeof combinada !== "object") {
    return { resultado: "NULO", evRealizado: null };
  }
  const c = combinada as CombinadaShape;
  if (!Array.isArray(c.mercados) || c.mercados.length < 2) {
    return { resultado: "NULO", evRealizado: null };
  }

  // La combinada gana si TODOS los mercados ganan.
  let huboIndeterminado = false;
  for (const m of c.mercados) {
    if (typeof m.mercado !== "string" || typeof m.outcome !== "string") {
      return { resultado: "NULO", evRealizado: null };
    }
    const r = evaluarMercadoIndividual(m.mercado, m.outcome, partido);
    if (r === "INDETERMINADO") {
      huboIndeterminado = true;
      continue;
    }
    if (r === "PERDIDO") {
      // EV realizado de combinada perdida es -stake.
      const stakeNum = typeof c.stake === "number" ? c.stake : 0;
      return { resultado: "PERDIDO", evRealizado: -stakeNum };
    }
  }
  if (huboIndeterminado) return { resultado: "INDETERMINADO", evRealizado: null };

  // Todos ganaron: EV realizado = stake * (cuotaTotal - 1).
  const stake = typeof c.stake === "number" ? c.stake : 0;
  const cuotaTotal = typeof c.cuotaTotal === "number" ? c.cuotaTotal : 0;
  const ev = stake * (cuotaTotal - 1);
  return { resultado: "GANADO", evRealizado: ev };
}

function evaluarTarjetaRojaAnalisis(
  tarjetas: unknown,
  partido: Partido,
): ResultadoMercado {
  if (!tarjetas || typeof tarjetas !== "object") return "INDETERMINADO";
  const t = tarjetas as AnalisisTarjetasShape;
  const huboRoja = partido.huboTarjetaRoja;
  if (huboRoja === null || huboRoja === undefined) return "INDETERMINADO";
  if (t.riesgoRoja === "ALTO") return huboRoja ? "GANADO" : "PERDIDO";
  if (t.riesgoRoja === "BAJO") return huboRoja ? "PERDIDO" : "GANADO";
  // MEDIO se considera NULO (no apostable).
  return "NULO";
}

function evaluarGolesAnalisis(
  goles: unknown,
  partido: Partido,
): ResultadoMercado {
  if (!goles || typeof goles !== "object") return "INDETERMINADO";
  const g = goles as AnalisisGolesShape;
  const gl = partido.golesLocal;
  const gv = partido.golesVisita;
  if (
    gl === null ||
    gv === null ||
    typeof g.golesEsperadosLocal !== "number" ||
    typeof g.golesEsperadosVisita !== "number"
  ) {
    return "INDETERMINADO";
  }
  // Acertó si la banda ±0.5 alrededor del esperado total cubre el real.
  const totalReal = gl + gv;
  const totalEsperado = g.golesEsperadosLocal + g.golesEsperadosVisita;
  return Math.abs(totalReal - totalEsperado) <= 0.5 ? "GANADO" : "PERDIDO";
}

// ---------------------------------------------------------------------------
// Función pública — evaluar un análisis individual
// ---------------------------------------------------------------------------

export function evaluarAnalisis(
  analisis: AnalisisPartido,
  partido: Partido,
): EvaluacionAnalisis {
  // CANCELADO → todos NULO (no contamos el partido).
  if (partido.estado === "CANCELADO") {
    return {
      analisisId: analisis.id,
      partidoId: partido.id,
      resultado1X2: "NULO",
      resultadoCombinada: "NULO",
      evCombinada: null,
      resultadosSecundarios: [],
      resultadoTarjetaRoja: "NULO",
      resultadoGoles: "NULO",
    };
  }

  const resultado1X2 = evaluar1X2(analisis.pronostico1x2, partido);
  const { resultado: resultadoCombinada, evRealizado: evCombinada } =
    evaluarCombinada(analisis.combinadaOptima, partido);

  const secundarios: ResultadoMercado[] = [];
  if (Array.isArray(analisis.mercadosSecundarios)) {
    for (const m of analisis.mercadosSecundarios as MercadoSecundarioShape[]) {
      if (typeof m.mercado === "string" && typeof m.outcome === "string") {
        secundarios.push(evaluarMercadoIndividual(m.mercado, m.outcome, partido));
      }
    }
  }

  return {
    analisisId: analisis.id,
    partidoId: partido.id,
    resultado1X2,
    resultadoCombinada,
    evCombinada,
    resultadosSecundarios: secundarios,
    resultadoTarjetaRoja: evaluarTarjetaRojaAnalisis(
      analisis.analisisTarjetas,
      partido,
    ),
    resultadoGoles: evaluarGolesAnalisis(analisis.analisisGoles, partido),
  };
}

// ---------------------------------------------------------------------------
// Estado in-memory de evaluaciones recientes (alimenta motor-salud.service)
// ---------------------------------------------------------------------------

interface EvaluacionPersistida {
  evaluacion: EvaluacionAnalisis;
  partidoFechaInicio: Date;
  evaluadoEn: Date;
}

const ULTIMOS_DIAS_KPIS = 90;
const evaluacionesRecientes = new Map<string, EvaluacionPersistida>();

function purgarViejas(): void {
  const corte = Date.now() - ULTIMOS_DIAS_KPIS * 24 * 3600 * 1000;
  for (const [id, v] of evaluacionesRecientes) {
    if (v.evaluadoEn.getTime() < corte) evaluacionesRecientes.delete(id);
  }
}

/**
 * Snapshot ordenado por fecha desc del partido — lo consume motor-salud.
 */
export function obtenerEvaluacionesRecientes(): EvaluacionPersistida[] {
  purgarViejas();
  return Array.from(evaluacionesRecientes.values()).sort(
    (a, b) => b.partidoFechaInicio.getTime() - a.partidoFechaInicio.getTime(),
  );
}

// ---------------------------------------------------------------------------
// Cron — evaluar AnalisisPartido APROBADOS de partidos finalizados
// ---------------------------------------------------------------------------

export async function evaluarAnalisisFinalizados(): Promise<EvaluarReporte> {
  const reporte: EvaluarReporte = {
    candidatos: 0,
    evaluados: 0,
    cancelados: 0,
    sinResolver: 0,
    ganados1X2: 0,
    perdidos1X2: 0,
    ganadosCombinada: 0,
    perdidosCombinada: 0,
  };

  // Ventana: últimas 48h finalizados/cancelados, no evaluados aún en
  // memoria. La memoria se purga a 90d, así que un partido que ya fue
  // evaluado y luego se reentra al cron (raro, pero pasa) se reconoce y
  // skippea.
  const desde = new Date(Date.now() - 48 * 3600 * 1000);
  const candidatos = await prisma.analisisPartido.findMany({
    where: {
      estado: "APROBADO",
      partido: {
        estado: { in: ["FINALIZADO", "CANCELADO"] },
        fechaInicio: { gte: desde },
      },
    },
    include: { partido: true },
  });

  reporte.candidatos = candidatos.length;

  for (const a of candidatos) {
    if (evaluacionesRecientes.has(a.id)) {
      // Ya evaluado en este ciclo del proceso — skip.
      continue;
    }

    try {
      const evaluacion = evaluarAnalisis(a, a.partido);

      if (a.partido.estado === "CANCELADO") {
        reporte.cancelados += 1;
      } else if (evaluacion.resultado1X2 === "INDETERMINADO") {
        reporte.sinResolver += 1;
        continue; // no persistimos parciales
      } else {
        reporte.evaluados += 1;
        if (evaluacion.resultado1X2 === "GANADO") reporte.ganados1X2 += 1;
        else if (evaluacion.resultado1X2 === "PERDIDO") reporte.perdidos1X2 += 1;
        if (evaluacion.resultadoCombinada === "GANADO")
          reporte.ganadosCombinada += 1;
        else if (evaluacion.resultadoCombinada === "PERDIDO")
          reporte.perdidosCombinada += 1;
      }

      evaluacionesRecientes.set(a.id, {
        evaluacion,
        partidoFechaInicio: a.partido.fechaInicio,
        evaluadoEn: new Date(),
      });
    } catch (err) {
      logger.error(
        { err, analisisId: a.id, source: "analisis-partido:eval" },
        "evaluarAnalisisFinalizados: cálculo falló",
      );
    }
  }

  if (reporte.evaluados > 0 || reporte.cancelados > 0) {
    logger.info(
      { ...reporte, source: "analisis-partido:eval" },
      "evaluarAnalisisFinalizados: ciclo completado",
    );
    void track({
      evento: "analisis_partido_evaluado_batch",
      props: { ...reporte },
    });
  }

  return reporte;
}
