// Cola de validación admin v3.2 — Lote O (May 2026).
//
// Lista los partidos con análisis pendiente para `/admin/picks`. La cola
// fusiona los dos entregables del v3.2 por partido:
//   - Análisis Free (AnalisisPartido del Lote L) — 1X2 + análisis básico.
//   - Análisis Socios (PickPremium del Lote E) — combinada óptima + EV+.
//
// Cada fila representa UN PARTIDO; si Free está aprobado pero Socios sigue
// pendiente, el partido sigue en la cola "Pendientes" (por el lado Socios).
// El detalle del partido muestra ambos en tabs.

import { prisma } from "@habla/db";

export type FiltroEstadoCola = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "TODOS";

export interface ColaPartidoFila {
  partidoId: string;
  liga: string;
  fechaInicio: Date;
  equipoLocal: string;
  equipoVisita: string;
  estadoFree: "APROBADO" | "PENDIENTE" | "RECHAZADO" | "ARCHIVADO" | "SIN_GENERAR";
  estadoSocios: "APROBADO" | "EDITADO_Y_APROBADO" | "PENDIENTE" | "RECHAZADO" | "SIN_GENERAR";
  algoPendiente: boolean;
}

export interface ContadoresColaV32 {
  pendientes: number;
  aprobados: number;
  rechazados: number;
  todos: number;
}

interface AnalisisRow {
  partidoId: string;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "ARCHIVADO";
}

interface PickRow {
  partidoId: string;
  estado: string;
}

export async function listarColaPartidosV32(input: {
  estado: FiltroEstadoCola;
  limit?: number;
}): Promise<ColaPartidoFila[]> {
  const limit = Math.min(200, Math.max(10, input.limit ?? 100));

  // Universo: partidos con Filtro 1 ON y kickoff en próximos 14 días.
  const ahora = new Date();
  const en14d = new Date(ahora.getTime() + 14 * 24 * 60 * 60 * 1000);

  const partidos = await prisma.partido.findMany({
    where: {
      mostrarAlPublico: true,
      fechaInicio: { gte: ahora, lte: en14d },
    },
    include: {
      analisisPartido: { select: { partidoId: true, estado: true } },
      picksPremium: { select: { partidoId: true, estado: true }, take: 1 },
    },
    orderBy: { fechaInicio: "asc" },
    take: 200,
  });

  const filas: ColaPartidoFila[] = partidos.map((p) => {
    const a: AnalisisRow | null = p.analisisPartido ?? null;
    const pp: PickRow | null = p.picksPremium[0] ?? null;
    const estadoFree: ColaPartidoFila["estadoFree"] = a
      ? a.estado === "PENDIENTE"
        ? "PENDIENTE"
        : a.estado === "APROBADO"
          ? "APROBADO"
          : a.estado === "RECHAZADO"
            ? "RECHAZADO"
            : "ARCHIVADO"
      : "SIN_GENERAR";
    const estadoSocios: ColaPartidoFila["estadoSocios"] = pp
      ? pp.estado === "APROBADO"
        ? "APROBADO"
        : pp.estado === "EDITADO_Y_APROBADO"
          ? "EDITADO_Y_APROBADO"
          : pp.estado === "RECHAZADO"
            ? "RECHAZADO"
            : "PENDIENTE"
      : "SIN_GENERAR";
    const algoPendiente =
      estadoFree === "PENDIENTE" || estadoFree === "SIN_GENERAR" || estadoSocios === "PENDIENTE" || estadoSocios === "SIN_GENERAR";

    return {
      partidoId: p.id,
      liga: p.liga,
      fechaInicio: p.fechaInicio,
      equipoLocal: p.equipoLocal,
      equipoVisita: p.equipoVisita,
      estadoFree,
      estadoSocios,
      algoPendiente,
    };
  });

  // Aplicar filtro
  let resultado = filas;
  if (input.estado === "PENDIENTE") resultado = filas.filter((f) => f.algoPendiente);
  else if (input.estado === "APROBADO")
    resultado = filas.filter(
      (f) => (f.estadoFree === "APROBADO" || f.estadoFree === "ARCHIVADO" || f.estadoFree === "RECHAZADO" || f.estadoFree === "SIN_GENERAR") &&
        (f.estadoSocios === "APROBADO" || f.estadoSocios === "EDITADO_Y_APROBADO"),
    );
  else if (input.estado === "RECHAZADO")
    resultado = filas.filter((f) => f.estadoFree === "RECHAZADO" || f.estadoSocios === "RECHAZADO");

  return resultado.slice(0, limit);
}

export async function obtenerContadoresColaV32(): Promise<ContadoresColaV32> {
  const todos = await listarColaPartidosV32({ estado: "TODOS", limit: 200 });
  const pendientes = todos.filter((f) => f.algoPendiente).length;
  const aprobados = todos.filter(
    (f) => !f.algoPendiente && (f.estadoFree === "APROBADO" || f.estadoSocios === "APROBADO" || f.estadoSocios === "EDITADO_Y_APROBADO"),
  ).length;
  const rechazados = todos.filter(
    (f) => f.estadoFree === "RECHAZADO" || f.estadoSocios === "RECHAZADO",
  ).length;
  return { pendientes, aprobados, rechazados, todos: todos.length };
}

// ---------------------------------------------------------------------------
// Detalle del partido en la cola: análisis Free + análisis Socios + meta
// ---------------------------------------------------------------------------

export interface ColaDetallePartido {
  partidoId: string;
  liga: string;
  fechaInicio: Date;
  equipoLocal: string;
  equipoVisita: string;
  filtro1: boolean;
  filtro2: boolean;
  free: ColaDetalleFree | null;
  socios: ColaDetalleSocios | null;
}

export interface ColaDetalleFree {
  analisisId: string;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "ARCHIVADO";
  pronostico1x2: "LOCAL" | "EMPATE" | "VISITA";
  probabilidades: { local: number; empate: number; visita: number };
  mejorCuota: { mercado: "LOCAL" | "EMPATE" | "VISITA"; cuota: number; casa: string };
  analisisBasico: string;
  promptVersion: string;
  generadoEn: Date;
}

export interface ColaDetalleSocios {
  pickId: string;
  estado: string;
  mercado: string;
  outcome: string;
  cuotaSugerida: number;
  stakeSugerido: number;
  evPctSugerido: number | null;
  casaRecomendada: { nombre: string } | null;
  razonamiento: string;
  generadoEn: Date;
}

export async function obtenerDetallePartidoCola(partidoId: string): Promise<ColaDetallePartido | null> {
  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
    include: {
      analisisPartido: true,
      picksPremium: {
        orderBy: { generadoEn: "desc" },
        take: 1,
        include: { casaRecomendada: { select: { nombre: true } } },
      },
    },
  });
  if (!partido) return null;

  const a = partido.analisisPartido;
  const pp = partido.picksPremium[0] ?? null;

  const free: ColaDetalleFree | null = a
    ? {
        analisisId: a.id,
        estado: a.estado,
        pronostico1x2: a.pronostico1x2 as "LOCAL" | "EMPATE" | "VISITA",
        probabilidades: a.probabilidades as unknown as { local: number; empate: number; visita: number },
        mejorCuota: a.mejorCuota as unknown as {
          mercado: "LOCAL" | "EMPATE" | "VISITA";
          cuota: number;
          casa: string;
        },
        analisisBasico: a.analisisBasico,
        promptVersion: a.promptVersion,
        generadoEn: a.generadoEn,
      }
    : null;

  const socios: ColaDetalleSocios | null = pp
    ? {
        pickId: pp.id,
        estado: pp.estado,
        mercado: pp.mercado,
        outcome: pp.outcome,
        cuotaSugerida: pp.cuotaSugerida,
        stakeSugerido: pp.stakeSugerido,
        evPctSugerido: pp.evPctSugerido,
        casaRecomendada: pp.casaRecomendada ? { nombre: pp.casaRecomendada.nombre } : null,
        razonamiento: pp.razonamiento,
        generadoEn: pp.generadoEn,
      }
    : null;

  return {
    partidoId: partido.id,
    liga: partido.liga,
    fechaInicio: partido.fechaInicio,
    equipoLocal: partido.equipoLocal,
    equipoVisita: partido.equipoVisita,
    filtro1: partido.mostrarAlPublico,
    filtro2: partido.elegibleLiga,
    free,
    socios,
  };
}
