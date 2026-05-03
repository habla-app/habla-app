// liga.service.ts — Lote M v3.2 (May 2026).
// Spec: docs/plan-trabajo-claude-code-v3.2.md § Lote M, decisiones §4.2, §4.9.
//
// Servicio público para las vistas /liga (lista) y /liga/[slug] (detalle).
//
// Filtra partidos con `elegibleLiga = true` (Filtro 2 del admin) cuya
// visibilidad respeta la regla de 7 días + override manual:
//   query base = (fechaInicio < NOW() + 7d OR visibilidadOverride='forzar_visible')
//                AND visibilidadOverride != 'forzar_oculto'
//
// Tres secciones para la vista lista:
//   - próximos elegibles (PROGRAMADO con kickoff > now)
//   - en vivo (EN_VIVO)
//   - terminados recientes (FINALIZADO últimas 7d)

import { prisma, type Prisma } from "@habla/db";
import { buildPartidoSlug, fechaFromSlug, diaLimaFromFecha } from "@/lib/utils/partido-slug";

export interface PartidoLigaItem {
  id: string;
  /** Torneo asociado al partido (uno por partido en v3.2). Null si no hay
   *  Torneo creado todavía — el listing no lo muestra en ese caso. */
  torneoId: string | null;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
  estado: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO";
  golesLocal: number | null;
  golesVisita: number | null;
  liveElapsed: number | null;
  liveStatusShort: string | null;
  totalInscritos: number;
  /** Slug derivado para la URL del detalle. */
  slug: string;
  /** Estado de la combinada del usuario actual: predicha o no. Null si visitor. */
  miEstadoCombinada: "predicha" | "sin_predecir" | null;
  miPosicion: number | null;
  miPuntos: number | null;
}

export interface ListaLigaResult {
  proximos: PartidoLigaItem[];
  enVivo: PartidoLigaItem[];
  terminados: PartidoLigaItem[];
}

const VENTANA_PROXIMOS_DIAS = 7;
const VENTANA_FINALIZADOS_HORAS = 7 * 24;

function visibilidadWhere(): Prisma.PartidoWhereInput {
  // Regla 7d + override (decisión §4.2):
  //   (fechaInicio < NOW() + 7d OR visibilidadOverride = 'forzar_visible')
  //   AND visibilidadOverride != 'forzar_oculto'
  const limite = new Date(Date.now() + VENTANA_PROXIMOS_DIAS * 24 * 60 * 60 * 1000);
  return {
    AND: [
      {
        OR: [
          { fechaInicio: { lt: limite } },
          { visibilidadOverride: "forzar_visible" },
        ],
      },
      { visibilidadOverride: { not: "forzar_oculto" } },
    ],
  };
}

export async function obtenerListaLiga(
  usuarioId?: string,
): Promise<ListaLigaResult> {
  const ahora = new Date();
  const desdeFinalizados = new Date(
    ahora.getTime() - VENTANA_FINALIZADOS_HORAS * 60 * 60 * 1000,
  );

  // Próximos elegibles: PROGRAMADO + Filtro 2 + visibilidad regla 7d.
  const proximosRaw = await prisma.partido.findMany({
    where: {
      elegibleLiga: true,
      estado: "PROGRAMADO",
      fechaInicio: { gt: ahora },
      ...visibilidadWhere(),
    },
    select: BASE_SELECT,
    orderBy: { fechaInicio: "asc" },
    take: 30,
  });

  // En vivo: el filtro de visibilidad 7d ya pasa porque están "ahora".
  // No filtramos por elegibleLiga acá: cualquier partido en vivo con
  // Filtro 2 ON cuenta. La validación es en BD.
  const enVivoRaw = await prisma.partido.findMany({
    where: {
      elegibleLiga: true,
      estado: "EN_VIVO",
      visibilidadOverride: { not: "forzar_oculto" },
    },
    select: BASE_SELECT,
    orderBy: { fechaInicio: "desc" },
    take: 10,
  });

  // Terminados últimas 7d.
  const terminadosRaw = await prisma.partido.findMany({
    where: {
      elegibleLiga: true,
      estado: "FINALIZADO",
      fechaInicio: { gte: desdeFinalizados },
      visibilidadOverride: { not: "forzar_oculto" },
    },
    select: BASE_SELECT,
    orderBy: { fechaInicio: "desc" },
    take: 20,
  });

  const todos = [...proximosRaw, ...enVivoRaw, ...terminadosRaw];
  const torneoIds = todos
    .flatMap((p) => p.torneos.map((t) => t.id))
    .filter((id): id is string => Boolean(id));

  // Tickets del usuario actual sobre esos torneos.
  const misTickets = usuarioId && torneoIds.length > 0
    ? await prisma.ticket.findMany({
        where: { usuarioId, torneoId: { in: torneoIds } },
        select: {
          torneoId: true,
          puntosTotal: true,
          predResultado: true,
          predBtts: true,
          predMas25: true,
          predTarjetaRoja: true,
          predMarcadorLocal: true,
          predMarcadorVisita: true,
        },
      })
    : [];

  const miTicketByTorneo = new Map(
    misTickets.map((t) => [t.torneoId, t]),
  );

  function toItem(p: (typeof proximosRaw)[number]): PartidoLigaItem {
    const torneoActivo = elegirTorneoPrincipal(p.torneos);
    const miTicket = torneoActivo ? miTicketByTorneo.get(torneoActivo.id) : undefined;
    const isPlaceholder = miTicket && esPlaceholder(miTicket);
    return {
      id: p.id,
      torneoId: torneoActivo?.id ?? null,
      liga: p.liga,
      equipoLocal: p.equipoLocal,
      equipoVisita: p.equipoVisita,
      fechaInicio: p.fechaInicio,
      estado: p.estado as "PROGRAMADO" | "EN_VIVO" | "FINALIZADO",
      golesLocal: p.golesLocal,
      golesVisita: p.golesVisita,
      liveElapsed: p.liveElapsed,
      liveStatusShort: p.liveStatusShort,
      totalInscritos: torneoActivo?.totalInscritos ?? 0,
      slug: buildPartidoSlug(p.equipoLocal, p.equipoVisita, p.fechaInicio),
      miEstadoCombinada: usuarioId
        ? miTicket && !isPlaceholder
          ? "predicha"
          : "sin_predecir"
        : null,
      miPosicion: null, // calculado on-demand en detalle
      miPuntos: miTicket?.puntosTotal ?? null,
    };
  }

  return {
    proximos: proximosRaw.map(toItem),
    enVivo: enVivoRaw.map(toItem),
    terminados: terminadosRaw.map(toItem),
  };
}

const BASE_SELECT = {
  id: true,
  liga: true,
  equipoLocal: true,
  equipoVisita: true,
  fechaInicio: true,
  estado: true,
  golesLocal: true,
  golesVisita: true,
  liveElapsed: true,
  liveStatusShort: true,
  torneos: {
    select: {
      id: true,
      estado: true,
      totalInscritos: true,
      cierreAt: true,
      creadoEn: true,
    },
  },
} satisfies Prisma.PartidoSelect;

const ESTADO_PRIORIDAD: Record<string, number> = {
  ABIERTO: 0,
  EN_JUEGO: 1,
  CERRADO: 2,
  FINALIZADO: 3,
  CANCELADO: 99,
};

function elegirTorneoPrincipal<
  T extends { id: string; estado: string; totalInscritos: number },
>(torneos: T[]): T | null {
  const noCancelados = torneos.filter((t) => t.estado !== "CANCELADO");
  if (noCancelados.length === 0) return null;
  const ordenados = [...noCancelados].sort((a, b) => {
    const da = ESTADO_PRIORIDAD[a.estado] ?? 99;
    const db = ESTADO_PRIORIDAD[b.estado] ?? 99;
    return da - db;
  });
  return ordenados[0] ?? null;
}

function esPlaceholder(t: {
  predResultado: string;
  predBtts: boolean;
  predMas25: boolean;
  predTarjetaRoja: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
}): boolean {
  return (
    t.predResultado === "LOCAL" &&
    t.predBtts === false &&
    t.predMas25 === false &&
    t.predTarjetaRoja === false &&
    t.predMarcadorLocal === 0 &&
    t.predMarcadorVisita === 0
  );
}

// ---------------------------------------------------------------------------
// Resolución del slug → torneo (para /liga/[slug])
// ---------------------------------------------------------------------------

export interface LigaDetalleResolved {
  estado: "found" | "not_found";
  torneo?: {
    id: string;
    estado: "ABIERTO" | "EN_JUEGO" | "CERRADO" | "FINALIZADO" | "CANCELADO";
    totalInscritos: number;
    cierreAt: Date;
  };
  partido?: {
    id: string;
    liga: string;
    equipoLocal: string;
    equipoVisita: string;
    fechaInicio: Date;
    estado: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO" | "CANCELADO";
    golesLocal: number | null;
    golesVisita: number | null;
    venue: string | null;
    round: string | null;
    liveElapsed: number | null;
    liveStatusShort: string | null;
  };
  miTicket?: {
    id: string;
    predResultado: "LOCAL" | "EMPATE" | "VISITA";
    predBtts: boolean;
    predMas25: boolean;
    predTarjetaRoja: boolean;
    predMarcadorLocal: number;
    predMarcadorVisita: number;
    puntosTotal: number;
    puntosResultado: number;
    puntosBtts: number;
    puntosMas25: number;
    puntosTarjeta: number;
    puntosMarcador: number;
    numEdiciones: number;
    esPlaceholder: boolean;
  } | null;
}

export async function resolverLigaPorSlug(
  slug: string,
  usuarioId?: string,
): Promise<LigaDetalleResolved> {
  const fecha = fechaFromSlug(slug);
  if (!fecha) return { estado: "not_found" };
  const { gte, lte } = diaLimaFromFecha(fecha);

  const candidatos = await prisma.partido.findMany({
    where: {
      elegibleLiga: true,
      fechaInicio: { gte, lte },
      visibilidadOverride: { not: "forzar_oculto" },
    },
    select: {
      id: true,
      liga: true,
      equipoLocal: true,
      equipoVisita: true,
      fechaInicio: true,
      estado: true,
      golesLocal: true,
      golesVisita: true,
      venue: true,
      round: true,
      liveElapsed: true,
      liveStatusShort: true,
      torneos: {
        select: {
          id: true,
          estado: true,
          totalInscritos: true,
          cierreAt: true,
          creadoEn: true,
        },
      },
    },
  });

  const match = candidatos.find(
    (p) => buildPartidoSlug(p.equipoLocal, p.equipoVisita, p.fechaInicio) === slug,
  );
  if (!match) return { estado: "not_found" };

  const torneo = elegirTorneoPrincipal(match.torneos);
  if (!torneo) return { estado: "not_found" };

  let miTicket: LigaDetalleResolved["miTicket"] = null;
  if (usuarioId) {
    const t = await prisma.ticket.findFirst({
      where: { usuarioId, torneoId: torneo.id },
      orderBy: { creadoEn: "desc" },
    });
    if (t) {
      const isPlaceholder = esPlaceholder(t);
      miTicket = {
        id: t.id,
        predResultado: t.predResultado,
        predBtts: t.predBtts,
        predMas25: t.predMas25,
        predTarjetaRoja: t.predTarjetaRoja,
        predMarcadorLocal: t.predMarcadorLocal,
        predMarcadorVisita: t.predMarcadorVisita,
        puntosTotal: t.puntosTotal,
        puntosResultado: t.puntosResultado,
        puntosBtts: t.puntosBtts,
        puntosMas25: t.puntosMas25,
        puntosTarjeta: t.puntosTarjeta,
        puntosMarcador: t.puntosMarcador,
        numEdiciones: t.numEdiciones,
        esPlaceholder: isPlaceholder,
      };
    }
  }

  return {
    estado: "found",
    torneo: {
      id: torneo.id,
      estado: torneo.estado as
        | "ABIERTO"
        | "EN_JUEGO"
        | "CERRADO"
        | "FINALIZADO"
        | "CANCELADO",
      totalInscritos: torneo.totalInscritos,
      cierreAt: torneo.cierreAt,
    },
    partido: {
      id: match.id,
      liga: match.liga,
      equipoLocal: match.equipoLocal,
      equipoVisita: match.equipoVisita,
      fechaInicio: match.fechaInicio,
      estado: match.estado as
        | "PROGRAMADO"
        | "EN_VIVO"
        | "FINALIZADO"
        | "CANCELADO",
      golesLocal: match.golesLocal,
      golesVisita: match.golesVisita,
      venue: match.venue,
      round: match.round,
      liveElapsed: match.liveElapsed,
      liveStatusShort: match.liveStatusShort,
    },
    miTicket,
  };
}
