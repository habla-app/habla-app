// Live matches — devuelve partidos en vivo (o recién finalizados) con sus
// torneos asociados, para alimentar `/live-match` y los widgets de la
// sidebar de `/matches`.
//
// Historia de fixes de este helper:
//
// Hotfix #1 post-Sub-Sprint 5 (Bug #2): la página `/live-match` antes
// hacía `where: { torneos: { some: { estado: { in: [EN_JUEGO, CERRADO,
// FINALIZADO] } } } }`, un filtro existencial que descartaba partidos
// cuyos torneos no estaban en esos estados — el caso típico era el
// cron de cierre llegando un minuto tarde y dejando los torneos en
// ABIERTO mientras el partido ya había arrancado. Para corregirlo se
// filtró SOLO por `partido.estado` (EN_VIVO/FINALIZADO) y se delegó al
// `elegirTorneoPrincipal` decidir el principal entre los torneos.
//
// Hotfix #3 post-Sub-Sprint 5: el `include.torneos.where` excluía
// CANCELADO pero el filtro del `where` top-level no chequeaba nada
// sobre torneos, así que partidos EN_VIVO con TODOS sus torneos
// CANCELADO aparecían con `torneos: []`. La página los mostraba con
// un cartel "sin torneo activo" — se consideró "mostrar el partido
// aunque no haya donde competir".
//
// Hotfix #4 (Bug #8, revert del Hotfix #3): el PO revisó la decisión
// en uso real y la consideró equivocada — el usuario ve un partido en
// vivo pero no puede competir en él. Mejor esconderlo. Ahora el
// filtro exige `torneos.some(estado != CANCELADO)`: partidos con
// todos los torneos cancelados NO aparecen ni en /live-match ni en
// la sidebar. La tolerancia al jitter del cron (Hotfix #1) se
// preserva: no filtramos por estados específicos del torneo, solo
// excluimos CANCELADO.

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
      // Bug #8: exigir al menos un torneo no cancelado — los partidos
      // cuyos torneos están todos en CANCELADO no deben aparecer.
      torneos: {
        some: {
          estado: { not: "CANCELADO" },
        },
      },
    },
    include: {
      torneos: {
        // El caller recibe solo los no-cancelados — `elegirTorneoPrincipal`
        // ya los ignoraba, pero excluirlos del include evita exponer
        // torneos que no son navegables.
        where: { estado: { not: "CANCELADO" } },
        orderBy: { pozoBruto: "desc" },
      },
    },
    orderBy: { fechaInicio: "desc" },
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// Partidos finalizados recientes (Bug #10)
// ---------------------------------------------------------------------------

export interface ObtenerFinalizedMatchesInput {
  /** Ventana hacia atrás en horas. Default 24. */
  sinceHours?: number;
  /** Límite de filas. Default 10. */
  limit?: number;
}

/**
 * Partidos FINALIZADOS dentro de la ventana reciente. Bug #10: la
 * página `/live-match` los muestra en una sección separada
 * ("Partidos finalizados de hoy") abajo del switcher en vivo. Mismo
 * filtro de `torneos.some(estado != CANCELADO)` que `obtenerLiveMatches`
 * — si todos los torneos del partido se cancelaron, no aparece.
 */
export async function obtenerFinalizedMatches(
  input: ObtenerFinalizedMatchesInput = {},
): Promise<PartidoLive[]> {
  const limit = Math.min(30, Math.max(1, input.limit ?? 10));
  const sinceHours = Math.max(1, input.sinceHours ?? 24);
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  return prisma.partido.findMany({
    where: {
      estado: "FINALIZADO",
      fechaInicio: { gte: since },
      torneos: {
        some: { estado: { not: "CANCELADO" } },
      },
    },
    include: {
      torneos: {
        where: { estado: { not: "CANCELADO" } },
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
 * Tras Bug #8, `obtenerLiveMatches` garantiza que la lista de torneos
 * del partido ya excluye CANCELADO. Este filtro defensivo sigue aquí
 * por si otro caller pasa un array crudo (ej. tests). Devuelve null
 * solo si el array llega vacío.
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
