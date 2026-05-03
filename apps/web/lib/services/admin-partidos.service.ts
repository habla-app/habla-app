// Servicio admin de partidos — Lote O (May 2026).
//
// Lista partidos para la vista /admin/partidos del Lote O. La vista refleja
// el pipeline completo del mockup v3.2 (Fuente API → Filtro 1 → Filtro 2)
// con KPIs visuales arriba, filtros laterales y tabla de gestión.
//
// Cada fila incluye:
//   - liga + hora del partido (TZ Lima)
//   - equipos
//   - mostrarAlPublico (Filtro 1) — toggle controlado por el admin
//   - estado del análisis Free / Socios (PENDIENTE / APROBADO / RECHAZADO /
//     ARCHIVADO o "—" si no se generó)
//   - elegibleLiga (Filtro 2) — toggle bloqueado si Filtro 1 está apagado
//   - métricas accesorias (tipsters / vistas) cuando estén disponibles
//
// Cero auto-publicación de análisis: el toggle de Filtro 1 dispara generación
// pero el análisis queda PENDIENTE — la aprobación se hace desde /admin/picks.

import { prisma } from "@habla/db";
import type { EstadoAnalisis } from "@habla/db";

export interface AdminPartidoFila {
  id: string;
  liga: string;
  fechaInicio: Date;
  equipoLocal: string;
  equipoVisita: string;
  mostrarAlPublico: boolean;
  elegibleLiga: boolean;
  visibilidadOverride: "forzar_visible" | "forzar_oculto" | null;
  estadoAnalisis: EstadoAnalisis | null;
  // Tipsters compitiendo + vistas (placeholder hasta tener tracking real)
  tipsters: number;
  vistas: number;
}

export interface AdminPartidosVista {
  resumen: {
    fuente: number; // partidos importados próximos 7d (todas ligas)
    filtro1: number; // mostrarAlPublico=true en próximos 7d
    filtro2: number; // elegibleLiga=true en próximos 7d (subconjunto de filtro1)
  };
  filas: AdminPartidoFila[];
}

interface ListarOpciones {
  ligaSlug?: string | null;
  rangoDias?: 7 | 14 | 2; // 7d (default), 14d, hoy+mañana
  estadoFiltro1?: "todos" | "apagados" | "visibles";
  estadoFiltro2?: "todos" | "elegibles" | "no_elegibles";
  searchEquipo?: string | null;
}

/**
 * Lista partidos para la vista /admin/partidos.
 */
export async function listarPartidosAdmin(opciones: ListarOpciones = {}): Promise<AdminPartidosVista> {
  const ahora = new Date();
  const dias = opciones.rangoDias ?? 7;
  const hasta = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);

  // Resumen del pipeline (siempre ventana fija de próximos 7 días).
  const ahora7d = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [fuente, filtro1, filtro2] = await Promise.all([
    prisma.partido.count({ where: { fechaInicio: { gte: ahora, lte: ahora7d } } }),
    prisma.partido.count({
      where: { fechaInicio: { gte: ahora, lte: ahora7d }, mostrarAlPublico: true },
    }),
    prisma.partido.count({
      where: { fechaInicio: { gte: ahora, lte: ahora7d }, elegibleLiga: true },
    }),
  ]);

  // Where de la tabla
  const where: Record<string, unknown> = {
    fechaInicio: { gte: ahora, lte: hasta },
  };
  if (opciones.ligaSlug) where.liga = opciones.ligaSlug;
  if (opciones.estadoFiltro1 === "apagados") where.mostrarAlPublico = false;
  if (opciones.estadoFiltro1 === "visibles") where.mostrarAlPublico = true;
  if (opciones.estadoFiltro2 === "elegibles") where.elegibleLiga = true;
  if (opciones.estadoFiltro2 === "no_elegibles") where.elegibleLiga = false;
  if (opciones.searchEquipo && opciones.searchEquipo.trim().length > 0) {
    const q = opciones.searchEquipo.trim();
    where.OR = [
      { equipoLocal: { contains: q, mode: "insensitive" } },
      { equipoVisita: { contains: q, mode: "insensitive" } },
      { liga: { contains: q, mode: "insensitive" } },
    ];
  }

  const partidos = await prisma.partido.findMany({
    where,
    include: { analisisPartido: { select: { estado: true } } },
    orderBy: { fechaInicio: "asc" },
    take: 80,
  });

  // Counts por partido (tipsters compitiendo = tickets distintos creados)
  const ids = partidos.map((p) => p.id);
  let ticketsByPartido: Map<string, number> = new Map();
  if (ids.length > 0) {
    const torneos = await prisma.torneo.findMany({
      where: { partidoId: { in: ids } },
      select: { id: true, partidoId: true, totalInscritos: true },
    });
    ticketsByPartido = new Map(torneos.map((t) => [t.partidoId, t.totalInscritos]));
  }

  const filas: AdminPartidoFila[] = partidos.map((p) => ({
    id: p.id,
    liga: p.liga,
    fechaInicio: p.fechaInicio,
    equipoLocal: p.equipoLocal,
    equipoVisita: p.equipoVisita,
    mostrarAlPublico: p.mostrarAlPublico,
    elegibleLiga: p.elegibleLiga,
    visibilidadOverride: p.visibilidadOverride,
    estadoAnalisis: p.analisisPartido?.estado ?? null,
    tipsters: ticketsByPartido.get(p.id) ?? 0,
    vistas: 0,
  }));

  return {
    resumen: { fuente, filtro1, filtro2 },
    filas,
  };
}

export async function obtenerLigasPresentesAdmin(): Promise<string[]> {
  const ahora = new Date();
  const en14d = new Date(ahora.getTime() + 14 * 24 * 60 * 60 * 1000);
  const filas = await prisma.partido.findMany({
    where: { fechaInicio: { gte: ahora, lte: en14d } },
    distinct: ["liga"],
    select: { liga: true },
    orderBy: { liga: "asc" },
  });
  return filas.map((f) => f.liga);
}
