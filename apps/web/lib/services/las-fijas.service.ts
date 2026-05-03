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

/** Snapshot de cuotas referenciales para la fila de la tabla densa.
 *  Si el análisis aprobado lo trae en `inputsJSON.cuotasReferenciales`, se
 *  lee y se expone aquí. Cualquier campo puede ser null cuando el motor
 *  todavía no expone esa cuota. La columna "best" es la mejor cuota del
 *  pronóstico Habla! (Local/Empate/Visita) — coincide con `mejorCuota`. */
export interface CuotasSnapshot {
  local: number | null;
  empate: number | null;
  visita: number | null;
  over25: number | null;
  under25: number | null;
  bttsSi: number | null;
  bttsNo: number | null;
  bestCasa: string | null;
  bestSigla: string | null;
  bestColor: string | null;
}

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
  /** Cuotas referenciales para la fila de la tabla densa. Null si el
   *  análisis aprobado no las trae todavía (en producción real, el motor
   *  las inyecta como parte de inputsJSON al generar). */
  cuotasSnapshot: CuotasSnapshot | null;
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
          mejorCuota: true,
          inputsJSON: true,
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
    const cuotasSnapshot = derivarCuotasSnapshot(
      analisisAprobado?.inputsJSON,
      analisisAprobado?.mejorCuota,
      pron,
    );
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
      cuotasSnapshot,
    };
  });
}

// ---------------------------------------------------------------------------
// Lectura best-effort de cuotas referenciales.
// El motor v3.2 inyecta `inputsJSON.cuotasReferenciales` con un snapshot del
// comparador al momento de la generación. Si no está disponible, la fila
// muestra al menos la mejor cuota del pronóstico Habla! (resto en "—").
// ---------------------------------------------------------------------------

function derivarCuotasSnapshot(
  inputsJSON: unknown,
  mejorCuota: unknown,
  pron: "LOCAL" | "EMPATE" | "VISITA" | null,
): CuotasSnapshot | null {
  const ref =
    inputsJSON && typeof inputsJSON === "object" && inputsJSON !== null
      ? (inputsJSON as Record<string, unknown>).cuotasReferenciales
      : undefined;
  const refObj =
    ref && typeof ref === "object" && ref !== null
      ? (ref as Record<string, unknown>)
      : null;

  const numero = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const cadena = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

  const mc =
    mejorCuota && typeof mejorCuota === "object" && mejorCuota !== null
      ? (mejorCuota as { mercado?: unknown; cuota?: unknown; casa?: unknown })
      : null;
  const mcCasa = mc ? cadena(mc.casa) : null;
  const mcCuota = mc ? numero(mc.cuota) : null;
  const mcMercado = mc
    ? (cadena(mc.mercado)?.toUpperCase() ?? null)
    : null;

  // Si no hay nada (ni inputsJSON.cuotasReferenciales ni mejorCuota), no
  // entregamos snapshot — el componente mostrará "—" en todas las celdas.
  if (!refObj && !mc) return null;

  // Construimos el snapshot priorizando inputsJSON.cuotasReferenciales,
  // y si falta, completamos con la mejor cuota del pronóstico para que
  // al menos esa columna tenga valor.
  const snap: CuotasSnapshot = {
    local: refObj ? numero(refObj.local) : null,
    empate: refObj ? numero(refObj.empate) : null,
    visita: refObj ? numero(refObj.visita) : null,
    over25: refObj ? numero(refObj.over25) : null,
    under25: refObj ? numero(refObj.under25) : null,
    bttsSi: refObj ? numero(refObj.bttsSi) : null,
    bttsNo: refObj ? numero(refObj.bttsNo) : null,
    bestCasa: refObj ? cadena(refObj.bestCasa) : null,
    bestSigla: refObj ? cadena(refObj.bestSigla) : null,
    bestColor: refObj ? cadena(refObj.bestColor) : null,
  };

  // Backfill con mejorCuota si la columna sigue null.
  if (mcCuota !== null && mcMercado) {
    if (mcMercado === "LOCAL" && snap.local === null) snap.local = mcCuota;
    else if (mcMercado === "EMPATE" && snap.empate === null) snap.empate = mcCuota;
    else if (mcMercado === "VISITA" && snap.visita === null) snap.visita = mcCuota;
  }
  if (snap.bestCasa === null && mcCasa !== null) {
    snap.bestCasa = mcCasa;
    snap.bestSigla = snap.bestSigla ?? siglaCasa(mcCasa);
    snap.bestColor = snap.bestColor ?? colorCasa(mcCasa);
  }
  // Si pron coincide con un mercado y ya tenemos la cuota best del
  // pronóstico (mcCuota), reflejarla ahí.
  if (pron === "LOCAL" && snap.local === null && mcCuota !== null) snap.local = mcCuota;
  else if (pron === "EMPATE" && snap.empate === null && mcCuota !== null)
    snap.empate = mcCuota;
  else if (pron === "VISITA" && snap.visita === null && mcCuota !== null)
    snap.visita = mcCuota;

  return snap;
}

function siglaCasa(casa: string): string {
  const c = casa.toLowerCase();
  if (c.includes("betano")) return "BT";
  if (c.includes("betsson")) return "BS";
  if (c.includes("coolbet")) return "CB";
  if (c.includes("doradobet")) return "DR";
  if (c.includes("1xbet")) return "1X";
  if (c.includes("te apuesto")) return "TA";
  return casa.slice(0, 2).toUpperCase();
}

function colorCasa(casa: string): string {
  const c = casa.toLowerCase();
  if (c.includes("betano")) return "#DC2626";
  if (c.includes("betsson")) return "#0EA5E9";
  if (c.includes("coolbet")) return "#059669";
  if (c.includes("doradobet")) return "#0A2080";
  if (c.includes("1xbet")) return "#FF7A00";
  if (c.includes("te apuesto")) return "#DC2626";
  return "#0A2080";
}

function ventanaTemporal(
  ahora: Date,
  dia?: "hoy" | "manana" | "semana",
): { gte: Date; lte: Date } {
  // 3h atrás cubre EN_VIVO (90 min de juego + entretiempo + alguna alargue)
  // y partidos recién finalizados — el filtro principal de visibilidad
  // está en `mostrarAlPublico` + `estado`.
  const desdeBase = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
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
  /** Snapshot de cuotas referenciales (1X2 + ±2.5 + BTTS) leído de
   *  `analisisPartido.inputsJSON.cuotasReferenciales`. Alimenta el
   *  ResumenEjecutivo (3 cuotas) y el ComparadorTabla (cuotas base) en
   *  /las-fijas/[slug]. Null si el análisis no las trae. */
  cuotasReferenciales?: CuotasSnapshot | null;
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
          inputsJSON: true,
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

  // Cuotas referenciales para el ResumenEjecutivo y el ComparadorTabla.
  // Solo las exponemos si el análisis está APROBADO (mismo gating que el
  // resto del bloque). Reusa el helper compartido con `listarFijas()`.
  const pronosticoForCuotas =
    analisisAprobado?.pronostico1x2 ?? null;
  const cuotasReferenciales =
    a && a.estado === "APROBADO"
      ? derivarCuotasSnapshot(
          a.inputsJSON,
          a.mejorCuota,
          pronosticoForCuotas,
        )
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
    cuotasReferenciales,
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
