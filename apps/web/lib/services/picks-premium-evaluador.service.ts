// Evaluador de picks Premium post-partido — Lote E.
//
// Cron P (instrumentation.ts) corre cada hora. Para cada pick:
//   - aprobado=true (incluye APROBADO + EDITADO_Y_APROBADO),
//   - resultadoFinal=null (no evaluado todavía),
//   - partido.estado='FINALIZADO' (con goles/btts/etc poblados),
// calcula GANADO/PERDIDO/NULO/PUSH y persiste.
//
// El cálculo es determinístico — basado en `Partido.golesLocal`, `golesVisita`,
// `btts`, `mas25Goles`, `huboTarjetaRoja`. Esos campos los popula el poller
// del Sub-Sprint 5 + el evaluador de tickets de la Liga.

import {
  prisma,
  type Partido,
  type PickPremium,
  type ResultadoPick,
} from "@habla/db";

import { logger } from "./logger";
import { track } from "./analytics.service";

// ---------------------------------------------------------------------------
// Cálculo del resultado
// ---------------------------------------------------------------------------

export function calcularResultadoPick(
  pick: PickPremium,
  partido: Partido,
): ResultadoPick | null {
  if (partido.estado === "CANCELADO") return "NULO";
  if (partido.estado !== "FINALIZADO") return null;

  const gl = partido.golesLocal;
  const gv = partido.golesVisita;
  if (gl === null || gv === null || gl === undefined || gv === undefined) {
    return null;
  }

  switch (pick.mercado) {
    case "RESULTADO_1X2": {
      if (pick.outcome === "home") return gl > gv ? "GANADO" : "PERDIDO";
      if (pick.outcome === "away") return gv > gl ? "GANADO" : "PERDIDO";
      if (pick.outcome === "draw") return gl === gv ? "GANADO" : "PERDIDO";
      return "PERDIDO";
    }
    case "BTTS": {
      // Si Partido.btts está disponible (poblado por evaluador de tickets),
      // úsalo. Si no, derivamos.
      const btts = partido.btts ?? (gl > 0 && gv > 0);
      if (pick.outcome === "btts_si") return btts ? "GANADO" : "PERDIDO";
      if (pick.outcome === "btts_no") return btts ? "PERDIDO" : "GANADO";
      return "PERDIDO";
    }
    case "OVER_UNDER_25": {
      const total = gl + gv;
      const over = partido.mas25Goles ?? total > 2;
      if (pick.outcome === "over") return over ? "GANADO" : "PERDIDO";
      if (pick.outcome === "under") return over ? "PERDIDO" : "GANADO";
      return "PERDIDO";
    }
    case "TARJETA_ROJA": {
      // Si null/undefined, no podemos resolver — devolvemos null para que
      // el cron lo reintente cuando los eventos se hayan sincronizado.
      const huboRoja = partido.huboTarjetaRoja;
      if (huboRoja === null || huboRoja === undefined) return null;
      if (pick.outcome === "roja_si") return huboRoja ? "GANADO" : "PERDIDO";
      if (pick.outcome === "roja_no") return huboRoja ? "PERDIDO" : "GANADO";
      return "PERDIDO";
    }
    case "MARCADOR_EXACTO": {
      // Outcome esperado: "1-0", "2-1", etc.
      const m = /^(\d+)-(\d+)$/.exec(pick.outcome.trim());
      if (!m) return "PERDIDO";
      const ml = Number(m[1]);
      const mv = Number(m[2]);
      return ml === gl && mv === gv ? "GANADO" : "PERDIDO";
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

export interface EvaluarReporte {
  candidatos: number;
  evaluados: number;
  ganados: number;
  perdidos: number;
  nulos: number;
  pushes: number;
  sinResolver: number;
}

export async function evaluarPicksFinalizados(): Promise<EvaluarReporte> {
  const reporte: EvaluarReporte = {
    candidatos: 0,
    evaluados: 0,
    ganados: 0,
    perdidos: 0,
    nulos: 0,
    pushes: 0,
    sinResolver: 0,
  };

  // Ventana: últimas 48h finalizados, no evaluados aún.
  const desde = new Date(Date.now() - 48 * 3600 * 1000);
  const candidatos = await prisma.pickPremium.findMany({
    where: {
      aprobado: true,
      resultadoFinal: null,
      partido: {
        estado: { in: ["FINALIZADO", "CANCELADO"] },
        fechaInicio: { gte: desde },
      },
    },
    include: { partido: true },
  });

  reporte.candidatos = candidatos.length;

  for (const pick of candidatos) {
    const resultado = calcularResultadoPick(pick, pick.partido);
    if (resultado === null) {
      reporte.sinResolver++;
      continue;
    }
    try {
      await prisma.pickPremium.update({
        where: { id: pick.id },
        data: { resultadoFinal: resultado, evaluadoEn: new Date() },
      });
      reporte.evaluados++;
      if (resultado === "GANADO") reporte.ganados++;
      else if (resultado === "PERDIDO") reporte.perdidos++;
      else if (resultado === "NULO") reporte.nulos++;
      else if (resultado === "PUSH") reporte.pushes++;
    } catch (err) {
      logger.error(
        { err, pickId: pick.id, source: "picks-premium:eval" },
        "evaluarPicksFinalizados: update falló",
      );
    }
  }

  if (reporte.evaluados > 0) {
    logger.info(
      { ...reporte, source: "picks-premium:eval" },
      "evaluarPicksFinalizados: ciclo completado",
    );
    void track({
      evento: "pick_premium_evaluado_batch",
      props: { ...reporte },
    });
  }

  return reporte;
}
