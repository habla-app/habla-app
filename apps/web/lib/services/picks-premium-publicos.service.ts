// picks-premium-publicos.service.ts — adaptador read-only de PickPremium
// para vistas públicas / autenticadas no Premium (Lote D).
//
// Convierte el modelo Prisma `PickPremium` (Lote E) al shape
// `PickWrapperData` que consume `<PickWrapper>`. Centraliza el formateo
// del label de mercado y el "recomendacion" textual para no repetir lógica
// en home, partido y torneo.
//
// Si Lote E aún no creó el modelo (caso edge: BD sin tablas Premium), la
// query falla y devolvemos null — el wrapper muestra fallback "Próximamente".

import { prisma } from "@habla/db";
import { logger } from "./logger";
import type { PickWrapperData } from "@/components/ui/premium/types";

interface PartidoMeta {
  local: string;
  visitante: string;
}

function formatMercado(mercado: string, outcome: string): string {
  switch (mercado) {
    case "RESULTADO_1X2":
      if (outcome === "home") return "Resultado: gana local";
      if (outcome === "draw") return "Resultado: empate";
      if (outcome === "away") return "Resultado: gana visita";
      return `Resultado 1X2`;
    case "BTTS":
      return outcome === "btts_si" ? "Ambos anotan: SÍ" : "Ambos anotan: NO";
    case "OVER_UNDER_25":
      return outcome === "over"
        ? "Más de 2.5 goles"
        : "Menos de 2.5 goles";
    case "TARJETA_ROJA":
      return outcome === "roja_si"
        ? "Tarjeta roja en el partido"
        : "Sin tarjeta roja";
    case "MARCADOR_EXACTO":
      return `Marcador exacto: ${outcome}`;
    default:
      return mercado;
  }
}

interface AdaptInput {
  id: string;
  mercado: string;
  outcome: string;
  cuotaSugerida: number;
  stakeSugerido: number;
  evPctSugerido: number | null;
  razonamiento: string;
  casaRecomendada: { nombre: string; slug: string } | null;
  partidoMeta: PartidoMeta;
}

function adaptar(input: AdaptInput): PickWrapperData {
  const recomendacion = formatMercado(input.mercado, input.outcome);
  return {
    id: input.id,
    partido: input.partidoMeta,
    mercadoLabel: recomendacion,
    recomendacion,
    cuotaSugerida: input.cuotaSugerida,
    stakeSugerido: input.stakeSugerido,
    evPctSugerido: input.evPctSugerido,
    razonamiento: input.razonamiento,
    casa: input.casaRecomendada,
  };
}

/**
 * Pick más reciente aprobado, sin filtrar por partido. Para home /
 * placements genéricos. Si no hay → null.
 */
export async function obtenerPickAprobadoUltimo(): Promise<PickWrapperData | null> {
  try {
    const row = await prisma.pickPremium.findFirst({
      where: { aprobado: true },
      orderBy: { aprobadoEn: "desc" },
      include: {
        partido: { select: { equipoLocal: true, equipoVisita: true } },
        casaRecomendada: { select: { nombre: true, slug: true } },
      },
    });
    if (!row || !row.partido) return null;
    return adaptar({
      id: row.id,
      mercado: row.mercado,
      outcome: row.outcome,
      cuotaSugerida: row.cuotaSugerida,
      stakeSugerido: row.stakeSugerido,
      evPctSugerido: row.evPctSugerido,
      razonamiento: row.razonamiento,
      casaRecomendada: row.casaRecomendada
        ? { nombre: row.casaRecomendada.nombre, slug: row.casaRecomendada.slug }
        : null,
      partidoMeta: {
        local: row.partido.equipoLocal,
        visitante: row.partido.equipoVisita,
      },
    });
  } catch (err) {
    logger.warn(
      { err, source: "picks-premium-publicos" },
      "obtenerPickAprobadoUltimo: query falló (Lote E pendiente?)",
    );
    return null;
  }
}

/**
 * Pick aprobado para un partido específico. Si no hay → null. Caller maneja
 * fallback. Usado por /partidos/[slug] y /comunidad/torneo/[slug].
 */
export async function obtenerPickAprobadoDePartido(
  partidoId: string,
): Promise<PickWrapperData | null> {
  try {
    const row = await prisma.pickPremium.findFirst({
      where: { partidoId, aprobado: true },
      orderBy: { aprobadoEn: "desc" },
      include: {
        partido: { select: { equipoLocal: true, equipoVisita: true } },
        casaRecomendada: { select: { nombre: true, slug: true } },
      },
    });
    if (!row || !row.partido) return null;
    return adaptar({
      id: row.id,
      mercado: row.mercado,
      outcome: row.outcome,
      cuotaSugerida: row.cuotaSugerida,
      stakeSugerido: row.stakeSugerido,
      evPctSugerido: row.evPctSugerido,
      razonamiento: row.razonamiento,
      casaRecomendada: row.casaRecomendada
        ? { nombre: row.casaRecomendada.nombre, slug: row.casaRecomendada.slug }
        : null,
      partidoMeta: {
        local: row.partido.equipoLocal,
        visitante: row.partido.equipoVisita,
      },
    });
  } catch (err) {
    logger.warn(
      { err, partidoId, source: "picks-premium-publicos" },
      "obtenerPickAprobadoDePartido: query falló",
    );
    return null;
  }
}
