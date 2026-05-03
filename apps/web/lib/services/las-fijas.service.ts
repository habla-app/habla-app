// las-fijas.service.ts — Lote M v3.2 (May 2026).
// Spec: docs/plan-trabajo-claude-code-v3.2.md § Lote M, decisiones §4.1+§4.2.
//
// Servicio público para las vistas /las-fijas (lista) y /las-fijas/[slug]
// (detalle). Solo expone partidos con `mostrarAlPublico = true` (Filtro 1
// del admin). El detalle ata el partido con su `AnalisisPartido` aprobado
// — si está ARCHIVADO, el page handler responde 410 Gone.
//
// La query base de la lista filtra por:
//   - mostrarAlPublico = true (Filtro 1 ON)
//   - estado != CANCELADO
//   - fechaInicio en ventana operativa (pasados ≤ 1h o futuros ≤ 14 días)

import { prisma, type Prisma } from "@habla/db";
import {
  buildPartidoSlug,
  diaLimaFromFecha,
  fechaFromSlug,
} from "@/lib/utils/partido-slug";

export interface FijaListItem {
  id: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
  estado: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO";
  golesLocal: number | null;
  golesVisita: number | null;
  liveElapsed: number | null;
  liveStatusShort: string | null;
  /** Slug derivado para la URL del detalle. */
  slug: string;
  /** True si el partido tiene un AnalisisPartido APROBADO listo. */
  tieneAnalisis: boolean;
  /** Pronóstico 1X2 del análisis aprobado (si existe). */
  pronostico1x2: "LOCAL" | "EMPATE" | "VISITA" | null;
  /** Probabilidad del pronóstico 1X2 (si existe), 0..1. */
  probabilidadPronostico: number | null;
}

export interface ListarFijasInput {
  /** Slug de liga (api-football canonical). Ej. "premier-league". */
  liga?: string;
  /** "hoy" | "manana" | "semana". */
  dia?: "hoy" | "manana" | "semana";
  /** Búsqueda libre por nombre de equipo. */
  q?: string;
  limit?: number;
}

const VENTANA_DEFAULT_DIAS = 14;

export async function listarFijas(
  input: ListarFijasInput = {},
): Promise<FijaListItem[]> {
  const ahora = new Date();
  const { gte, lte } = ventanaTemporal(ahora, input.dia);

  const where: Prisma.PartidoWhereInput = {
    mostrarAlPublico: true,
    estado: { in: ["PROGRAMADO", "EN_VIVO", "FINALIZADO"] },
    fechaInicio: { gte, lte },
  };

  if (input.liga) {
    // El campo `Partido.liga` es nombre canónico (no slug). Resolución
    // mediante helper si fuera necesario; por ahora aceptamos string libre.
    where.liga = { contains: input.liga, mode: "insensitive" };
  }
  if (input.q) {
    where.OR = [
      { equipoLocal: { contains: input.q, mode: "insensitive" } },
      { equipoVisita: { contains: input.q, mode: "insensitive" } },
    ];
  }

  const partidos = await prisma.partido.findMany({
    where,
    select: {
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
      analisisPartido: {
        select: {
          estado: true,
          pronostico1x2: true,
          probabilidades: true,
        },
      },
    },
    orderBy: { fechaInicio: "asc" },
    take: Math.min(60, Math.max(1, input.limit ?? 30)),
  });

  return partidos.map((p) => {
    const analisisAprobado =
      p.analisisPartido?.estado === "APROBADO" ? p.analisisPartido : null;
    const probMap = analisisAprobado?.probabilidades as
      | { local?: number; empate?: number; visita?: number }
      | undefined;
    const pron = (analisisAprobado?.pronostico1x2 ?? null) as
      | "LOCAL"
      | "EMPATE"
      | "VISITA"
      | null;
    let probability: number | null = null;
    if (pron && probMap) {
      const key =
        pron === "LOCAL" ? "local" : pron === "EMPATE" ? "empate" : "visita";
      probability = typeof probMap[key] === "number" ? probMap[key]! : null;
    }
    return {
      id: p.id,
      liga: p.liga,
      equipoLocal: p.equipoLocal,
      equipoVisita: p.equipoVisita,
      fechaInicio: p.fechaInicio,
      estado: p.estado as "PROGRAMADO" | "EN_VIVO" | "FINALIZADO",
      golesLocal: p.golesLocal,
      golesVisita: p.golesVisita,
      liveElapsed: p.liveElapsed,
      liveStatusShort: p.liveStatusShort,
      slug: buildPartidoSlug(p.equipoLocal, p.equipoVisita, p.fechaInicio),
      tieneAnalisis: analisisAprobado !== null,
      pronostico1x2: pron,
      probabilidadPronostico: probability,
    };
  });
}

function ventanaTemporal(
  ahora: Date,
  dia?: "hoy" | "manana" | "semana",
): { gte: Date; lte: Date } {
  const desdeBase = new Date(ahora.getTime() - 60 * 60 * 1000); // 1h atrás (live)
  if (!dia) {
    const lte = new Date(
      ahora.getTime() + VENTANA_DEFAULT_DIAS * 24 * 60 * 60 * 1000,
    );
    return { gte: desdeBase, lte };
  }
  const fechaLima = ahora.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  if (dia === "hoy") return diaLimaFromFecha(fechaLima);
  if (dia === "manana") {
    const t = new Date(`${fechaLima}T05:00:00.000Z`); // 00:00 PET
    const manana = new Date(t.getTime() + 24 * 60 * 60 * 1000);
    const fechaManana = manana.toISOString().slice(0, 10);
    return diaLimaFromFecha(fechaManana);
  }
  // "semana": de hoy a +7d
  const inicio = new Date(`${fechaLima}T05:00:00.000Z`);
  const fin = new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return { gte: inicio, lte: fin };
}

// ---------------------------------------------------------------------------
// Resolución del slug → partido
// ---------------------------------------------------------------------------

export type FijaDetalleEstado = "found" | "archived" | "not_found";

export interface FijaDetalleResolved {
  estado: FijaDetalleEstado;
  partido?: {
    id: string;
    liga: string;
    equipoLocal: string;
    equipoVisita: string;
    fechaInicio: Date;
    estado: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO";
    golesLocal: number | null;
    golesVisita: number | null;
    venue: string | null;
    round: string | null;
    liveElapsed: number | null;
    liveStatusShort: string | null;
  };
  /** AnalisisPartido APROBADO si existe. Null si está PENDIENTE/RECHAZADO. */
  analisisAprobado?: {
    pronostico1x2: "LOCAL" | "EMPATE" | "VISITA";
    probabilidades: Record<string, number>;
    mejorCuota: { mercado: string; cuota: number; casa: string };
    analisisBasico: string;
    combinadaOptima: unknown | null;
    razonamiento: string | null;
    analisisGoles: unknown | null;
    analisisTarjetas: unknown | null;
    mercadosSecundarios: unknown | null;
  } | null;
  /** Slug canónico del partido — útil para 301 si el visitante usó alias. */
  slugCanonico?: string;
}

/**
 * Resuelve el slug a un partido visible públicamente.
 *
 * Estados posibles:
 *   - "not_found": el slug no matchea ningún partido o el partido no tiene
 *     Filtro 1 ON.
 *   - "archived": el partido tenía análisis APROBADO pero ahora está
 *     ARCHIVADO (Filtro 1 desactivado). El page handler responde 410 Gone.
 *   - "found": el partido es visible. `analisisAprobado` puede ser null si
 *     el análisis aún está PENDIENTE o RECHAZADO — la vista renderiza solo
 *     hero + skeleton de análisis.
 */
export async function resolverFijaPorSlug(
  slug: string,
): Promise<FijaDetalleResolved> {
  const fecha = fechaFromSlug(slug);
  if (!fecha) return { estado: "not_found" };

  const { gte, lte } = diaLimaFromFecha(fecha);

  // Buscamos partidos del día Lima y matcheamos el slug exacto vs el slug
  // construido de cada uno. Esto evita persistir un campo `slug` en BD
  // (decisión arquitectónica del Lote C v3.1) y es robusto a renames de
  // equipos (siempre que el día no cambie).
  const candidatos = await prisma.partido.findMany({
    where: {
      fechaInicio: { gte, lte },
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
      mostrarAlPublico: true,
      analisisPartido: {
        select: {
          estado: true,
          pronostico1x2: true,
          probabilidades: true,
          mejorCuota: true,
          analisisBasico: true,
          combinadaOptima: true,
          razonamiento: true,
          analisisGoles: true,
          analisisTarjetas: true,
          mercadosSecundarios: true,
          archivadoEn: true,
        },
      },
    },
  });

  const match = candidatos.find(
    (p) => buildPartidoSlug(p.equipoLocal, p.equipoVisita, p.fechaInicio) === slug,
  );
  if (!match) return { estado: "not_found" };

  // Filtro 1 OFF + análisis archivado → 410 Gone (decisión §4.1).
  if (!match.mostrarAlPublico) {
    if (match.analisisPartido?.estado === "ARCHIVADO") {
      return { estado: "archived" };
    }
    return { estado: "not_found" };
  }

  const a = match.analisisPartido;
  const analisisAprobado =
    a && a.estado === "APROBADO"
      ? {
          pronostico1x2: a.pronostico1x2 as "LOCAL" | "EMPATE" | "VISITA",
          probabilidades: a.probabilidades as Record<string, number>,
          mejorCuota: a.mejorCuota as {
            mercado: string;
            cuota: number;
            casa: string;
          },
          analisisBasico: a.analisisBasico,
          combinadaOptima: a.combinadaOptima,
          razonamiento: a.razonamiento,
          analisisGoles: a.analisisGoles,
          analisisTarjetas: a.analisisTarjetas,
          mercadosSecundarios: a.mercadosSecundarios,
        }
      : null;

  return {
    estado: "found",
    partido: {
      id: match.id,
      liga: match.liga,
      equipoLocal: match.equipoLocal,
      equipoVisita: match.equipoVisita,
      fechaInicio: match.fechaInicio,
      estado: match.estado as "PROGRAMADO" | "EN_VIVO" | "FINALIZADO",
      golesLocal: match.golesLocal,
      golesVisita: match.golesVisita,
      venue: match.venue,
      round: match.round,
      liveElapsed: match.liveElapsed,
      liveStatusShort: match.liveStatusShort,
    },
    analisisAprobado,
    slugCanonico: slug,
  };
}

/**
 * Devuelve las ligas presentes en la ventana de listado, para alimentar
 * los chips de filtros sin pre-renderizar todas las ligas del catálogo.
 */
export async function obtenerLigasPresentes(): Promise<string[]> {
  const ahora = new Date();
  const lte = new Date(
    ahora.getTime() + VENTANA_DEFAULT_DIAS * 24 * 60 * 60 * 1000,
  );
  const filas = await prisma.partido.findMany({
    where: {
      mostrarAlPublico: true,
      fechaInicio: { gte: ahora, lte },
    },
    select: { liga: true },
    distinct: ["liga"],
    orderBy: { liga: "asc" },
  });
  return filas.map((f) => f.liga);
}
