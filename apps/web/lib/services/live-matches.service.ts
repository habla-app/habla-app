// Live matches — devuelve partidos en vivo (o recién finalizados) con sus
// torneos asociados, para alimentar `/live-match` y los widgets de la
// sidebar de `/matches`.
//
// Hotfix post-Sub-Sprint 5 (Bug #2): la página `/live-match` antes hacía
// `where: { torneos: { some: { estado: { in: [...] } } } }`, un filtro
// existencial que descartaba partidos cuyos torneos no estaban en
// EN_JUEGO/CERRADO/FINALIZADO — el caso típico era el cron de cierre
// llegando un minuto tarde y dejando los torneos en ABIERTO mientras el
// partido ya había arrancado. Resultado: la sidebar mostraba 2 partidos
// en vivo y `/live-match` decía "no hay partidos". Ahora filtramos solo
// por `partido.estado` y excluimos torneos CANCELADO via `include`.
//
// `partido.estado` es el filtro autoritativo del partido. Los estados de
// los torneos asociados pueden quedar atrás temporalmente (cron in-process
// + jitter de hasta 1 min); no es razón para esconder el partido.

import { prisma, type EstadoTorneo, type Partido, type Torneo } from "@habla/db";

export type PartidoLive = Partido & {
  torneos: Torneo[];
};

export const ESTADOS_TORNEO_NO_CANCELADO: EstadoTorneo[] = [
  "ABIERTO",
  "CERRADO",
  "EN_JUEGO",
  "FINALIZADO",
];

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
        // Excluir solo CANCELADO. Los torneos en ABIERTO se incluyen para
        // no perder partidos cuyo cron de cierre aún no transicionó. El
        // consumer puede priorizar EN_JUEGO/CERRADO/FINALIZADO al elegir
        // el "torneo principal" del partido.
        where: { estado: { in: ESTADOS_TORNEO_NO_CANCELADO } },
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
