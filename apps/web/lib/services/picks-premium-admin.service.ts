// Picks Premium — service helpers para `/admin/picks-premium`. Lote F (May 2026).
//
// Lectura para la cola del admin (PENDIENTE / APROBADO / RECHAZADO) +
// detalle individual + stats del editor. Las mutaciones (aprobar /
// rechazar / editar) viven en los endpoints `/api/v1/admin/picks-premium/[id]/*`
// del Lote E.

import { prisma } from "@habla/db";

export type FiltroEstadoPick =
  | "PENDIENTE"
  | "APROBADO"
  | "EDITADO_Y_APROBADO"
  | "RECHAZADO"
  | "TODOS";

export interface PickColaFila {
  id: string;
  partidoId: string;
  equipoLocal: string;
  equipoVisita: string;
  liga: string;
  fechaInicio: Date;
  mercado: string;
  outcome: string;
  cuotaSugerida: number;
  estado: string;
  generadoEn: Date;
  fechaPublicacion: Date;
  resultadoFinal: string | null;
  enviadoAlChannel: boolean;
  enviadoEn: Date | null;
  rechazadoMotivo: string | null;
}

export async function listarColaPicks(input: {
  estado: FiltroEstadoPick;
  limit?: number;
}): Promise<PickColaFila[]> {
  const where: Record<string, unknown> = {};
  if (input.estado === "PENDIENTE") where.estado = "PENDIENTE";
  else if (input.estado === "APROBADO") {
    where.aprobado = true;
  } else if (input.estado === "RECHAZADO") {
    where.estado = "RECHAZADO";
  } else if (input.estado === "EDITADO_Y_APROBADO") {
    where.estado = "EDITADO_Y_APROBADO";
  }

  const limit = Math.min(200, Math.max(10, input.limit ?? 100));

  const rows = await prisma.pickPremium.findMany({
    where,
    include: { partido: true },
    orderBy:
      input.estado === "PENDIENTE"
        ? { partido: { fechaInicio: "asc" } }
        : { generadoEn: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    partidoId: r.partidoId,
    equipoLocal: r.partido.equipoLocal,
    equipoVisita: r.partido.equipoVisita,
    liga: r.partido.liga,
    fechaInicio: r.partido.fechaInicio,
    mercado: r.mercado,
    outcome: r.outcome,
    cuotaSugerida: r.cuotaSugerida,
    estado: r.estado,
    generadoEn: r.generadoEn,
    fechaPublicacion: r.fechaPublicacion,
    resultadoFinal: r.resultadoFinal,
    enviadoAlChannel: r.enviadoAlChannel,
    enviadoEn: r.enviadoEn,
    rechazadoMotivo: r.rechazadoMotivo,
  }));
}

export interface PickDetalleAdmin {
  id: string;
  partidoId: string;
  equipoLocal: string;
  equipoVisita: string;
  liga: string;
  fechaInicio: Date;
  mercado: string;
  outcome: string;
  cuotaSugerida: number;
  stakeSugerido: number;
  evPctSugerido: number | null;
  razonamiento: string;
  estadisticas: { h2h?: string; formaReciente?: string; factorClave?: string } | null;
  estado: string;
  aprobado: boolean;
  aprobadoPor: string | null;
  aprobadoEn: Date | null;
  rechazadoMotivo: string | null;
  enviadoAlChannel: boolean;
  enviadoEn: Date | null;
  channelMessageId: string | null;
  generadoPor: string;
  generadoEn: Date;
  fechaPublicacion: Date;
  resultadoFinal: string | null;
  evaluadoEn: Date | null;
  casaRecomendada: { id: string; nombre: string; slug: string; urlBase: string } | null;
}

export async function obtenerDetallePickAdmin(
  id: string,
): Promise<PickDetalleAdmin | null> {
  const p = await prisma.pickPremium.findUnique({
    where: { id },
    include: {
      partido: true,
      casaRecomendada: { select: { id: true, nombre: true, slug: true, urlBase: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    partidoId: p.partidoId,
    equipoLocal: p.partido.equipoLocal,
    equipoVisita: p.partido.equipoVisita,
    liga: p.partido.liga,
    fechaInicio: p.partido.fechaInicio,
    mercado: p.mercado,
    outcome: p.outcome,
    cuotaSugerida: p.cuotaSugerida,
    stakeSugerido: p.stakeSugerido,
    evPctSugerido: p.evPctSugerido,
    razonamiento: p.razonamiento,
    estadisticas: (p.estadisticas as PickDetalleAdmin["estadisticas"]) ?? null,
    estado: p.estado,
    aprobado: p.aprobado,
    aprobadoPor: p.aprobadoPor,
    aprobadoEn: p.aprobadoEn,
    rechazadoMotivo: p.rechazadoMotivo,
    enviadoAlChannel: p.enviadoAlChannel,
    enviadoEn: p.enviadoEn,
    channelMessageId: p.channelMessageId,
    generadoPor: p.generadoPor,
    generadoEn: p.generadoEn,
    fechaPublicacion: p.fechaPublicacion,
    resultadoFinal: p.resultadoFinal,
    evaluadoEn: p.evaluadoEn,
    casaRecomendada: p.casaRecomendada,
  };
}

export interface ContadoresColaPicks {
  pendientes: number;
  aprobados: number;
  rechazados: number;
}

export async function obtenerContadoresColaPicks(): Promise<ContadoresColaPicks> {
  const [pendientes, aprobados, rechazados] = await Promise.all([
    prisma.pickPremium.count({ where: { estado: "PENDIENTE" } }),
    prisma.pickPremium.count({ where: { aprobado: true } }),
    prisma.pickPremium.count({ where: { estado: "RECHAZADO" } }),
  ]);
  return { pendientes, aprobados, rechazados };
}

export interface StatsEditor {
  picksAprobados30d: number;
  picksRechazados30d: number;
  picksGanados: number;
  picksPerdidos: number;
  picksEvaluados: number;
  porcentajeAcierto: number | null;
}

export async function obtenerStatsEditor(_userId: string): Promise<StatsEditor> {
  const hace30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [aprobados30d, rechazados30d, ganados, perdidos, evaluados] =
    await Promise.all([
      prisma.pickPremium.count({
        where: { aprobado: true, aprobadoEn: { gte: hace30d } },
      }),
      prisma.pickPremium.count({
        where: { estado: "RECHAZADO", actualizadoEn: { gte: hace30d } },
      }),
      prisma.pickPremium.count({ where: { resultadoFinal: "GANADO" } }),
      prisma.pickPremium.count({ where: { resultadoFinal: "PERDIDO" } }),
      prisma.pickPremium.count({
        where: { resultadoFinal: { not: null } },
      }),
    ]);

  const decididos = ganados + perdidos;
  const porcentajeAcierto =
    decididos > 0 ? Math.round((ganados / decididos) * 1000) / 10 : null;

  return {
    picksAprobados30d: aprobados30d,
    picksRechazados30d: rechazados30d,
    picksGanados: ganados,
    picksPerdidos: perdidos,
    picksEvaluados: evaluados,
    porcentajeAcierto,
  };
}
