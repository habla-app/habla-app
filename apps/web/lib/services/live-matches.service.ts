// Live matches — devuelve partidos en vivo (o recién finalizados) con sus
// torneos asociados, para alimentar `/live-match` y los widgets de la
// sidebar de `/matches`.
//
// Hotfix post-Sub-Sprint 5 (Bug #2): la página `/live-match` antes hacía
// `where: { torneos: { some: { estado: { in: [...] } } } }`, un filtro
// existencial que descartaba partidos cuyos torneos no estaban en
// EN_JUEGO/CERRADO/FINALIZADO — el caso típico era el cron de cierre
// llegando un minuto tarde y dejando los torneos en ABIERTO mientras el
// partido ya había arrancado. Ahora filtramos solo por `partido.estado`.
//
// Hotfix #3 post-Sub-Sprint 5 (re-fix Bug #2): el `include.torneos.where`
// excluía CANCELADO, lo que dejaba partidos EN_VIVO con `torneos: []` si
// todos sus torneos se habían cancelado por <2 inscritos. La página
// /live-match filtraba esos partidos como "no hay torneo principal" y
// caía al empty state global. Ahora el helper INCLUYE TODOS los torneos
// (incluso CANCELADO) para que el caller decida qué hacer; la sidebar
// y la página manejan torneo principal `null` mostrando el partido con
// un cartel "sin torneo activo" en lugar de esconderlo.

import { prisma, type EstadoTorneo, type Partido, type Torneo } from "@habla/db";

export type PartidoLive = Partido & {
  torneos: Torneo[];
};

export interface ObtenerLiveMatchesInput {
  /** Cuántos partidos máximo. Default 6 (tabs del switcher de /live-match). */
  limit?: number;
  /** Si true, incluir también partidos FINALIZADOS recientes. Default true. */
  incluirFinalizados?: boolean;
}

export async function obtenerLiveMatches(
  input: ObtenerLiveMatchesInput = {},
): Promise<PartidoLive[]> {
  const limit = Math.min(20, Math.max(1, input.limit ?? 6));
  const incluirFinalizados = input.incluirFinalizados !== false;
  const estados: Array<"EN_VIVO" | "FINALIZADO"> = incluirFinalizados
    ? ["EN_VIVO", "FINALIZADO"]
    : ["EN_VIVO"];

  return prisma.partido.findMany({
    where: {
      estado: { in: estados },
    },
    include: {
      torneos: {
        // Incluimos TODOS los estados (incluido CANCELADO). El caller
        // filtra con `elegirTorneoPrincipal` que excluye CANCELADO al
        // elegir el principal — pero el partido aparece igual aunque
        // todos sus torneos estén CANCELADO, y el frontend muestra un
        // cartel específico en ese caso.
        orderBy: { pozoBruto: "desc" },
      },
    },
    orderBy: { fechaInicio: "desc" },
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// Selección de torneo principal para mostrar en /live-match
// ---------------------------------------------------------------------------

const ORDEN_PRIORIDAD: Record<EstadoTorneo, number> = {
  EN_JUEGO: 0,
  CERRADO: 1,
  FINALIZADO: 2,
  ABIERTO: 3,
  CANCELADO: 99,
};

/**
 * Elige el torneo "principal" de un partido para mostrar en /live-match.
 * Prioridad por estado (EN_JUEGO > CERRADO > FINALIZADO > ABIERTO) y dentro
 * del mismo estado por mayor pozoBruto. CANCELADO nunca se elige.
 *
 * Devuelve null si el partido no tiene torneos no-cancelados (caso raro
 * pero defensive — no debería pasar si el partido pasó por el flow normal).
 */
export function elegirTorneoPrincipal(torneos: Torneo[]): Torneo | null {
  const candidatos = torneos.filter((t) => t.estado !== "CANCELADO");
  if (candidatos.length === 0) return null;
  const ordenados = [...candidatos].sort((a, b) => {
    const pa = ORDEN_PRIORIDAD[a.estado];
    const pb = ORDEN_PRIORIDAD[b.estado];
    if (pa !== pb) return pa - pb;
    return b.pozoBruto - a.pozoBruto;
  });
  return ordenados[0] ?? null;
}
