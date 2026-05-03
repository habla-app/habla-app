// Servicio admin de la Liga Habla! — Lote O (May 2026).
//
// Datos para la vista /admin/liga-admin del Lote O. Refleja el torneo del
// mes en curso: KPIs del torneo, partidos elegibles con su visibilidad,
// avisos automáticos (sin análisis aprobado, kickoff > 7d sin forzar visible),
// reparto de premios, Top 10 actual.

import { prisma } from "@habla/db";

export interface KpisTorneoMes {
  tipstersCompitiendo: number;
  combinadasFinales: number;
  visiblesAhora: number;
  totalElegibles: number;
  diasAlCierre: number;
}

export interface PartidoElegible {
  id: string;
  liga: string;
  fechaInicio: Date;
  equipoLocal: string;
  equipoVisita: string;
  visibleAlPublico: boolean; // mostrarAlPublico AND (kickoff < 7d OR override=forzar_visible)
  visibilidadOverride: "forzar_visible" | "forzar_oculto" | null;
  combinadas: number;
  estadoMatch: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO";
}

export interface AvisoSistema {
  id: string;
  partidoId: string;
  liga: string;
  equipos: string;
  fechaInicio: Date;
  tipo: "analisis_pendiente" | "kickoff_lejos";
  mensaje: string;
}

export interface KpiReferidoLiga {
  label: string;
  valor: string;
  meta: string;
  estado: "good" | "amber" | "red";
}

export interface Top10Liga {
  posicion: number;
  username: string;
  puntos: number;
}

export interface VistaAdminLiga {
  mesEtiqueta: string; // "Mayo 2026"
  cierreFechaIso: string; // "1 jun 00:01 PET"
  kpis: KpisTorneoMes;
  partidosElegibles: PartidoElegible[];
  avisos: AvisoSistema[];
  referidos: KpiReferidoLiga[];
  top10: Top10Liga[];
}

const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export async function obtenerVistaAdminLiga(): Promise<VistaAdminLiga> {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesSiguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  const en7d = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [partidosElegiblesMes, ticketsMes, partidos, top10Filas] = await Promise.all([
    prisma.partido.findMany({
      where: {
        elegibleLiga: true,
        fechaInicio: { gte: inicioMes, lt: inicioMesSiguiente },
      },
      include: {
        analisisPartido: { select: { estado: true } },
        torneos: { select: { totalInscritos: true }, take: 1 },
      },
      orderBy: { fechaInicio: "asc" },
    }),
    prisma.ticket.findMany({
      where: {
        torneo: {
          partido: { fechaInicio: { gte: inicioMes, lt: inicioMesSiguiente }, elegibleLiga: true },
        },
      },
      select: { usuarioId: true },
    }),
    // Partidos elegibles próximos 7d (visibles ahora con regla 7d)
    prisma.partido.count({
      where: {
        elegibleLiga: true,
        fechaInicio: { gte: ahora, lte: en7d },
      },
    }),
    obtenerTop10MesActual(),
  ]);

  const tipstersUnicos = new Set(ticketsMes.map((t) => t.usuarioId)).size;
  const totalCombinadas = ticketsMes.length;

  const diasAlCierre = Math.max(0, Math.ceil((inicioMesSiguiente.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)));

  const partidosElegibles: PartidoElegible[] = partidosElegiblesMes.map((p) => {
    const cumpleRegla7d = p.fechaInicio.getTime() <= en7d.getTime();
    const visible = (cumpleRegla7d || p.visibilidadOverride === "forzar_visible") && p.visibilidadOverride !== "forzar_oculto";
    return {
      id: p.id,
      liga: p.liga,
      fechaInicio: p.fechaInicio,
      equipoLocal: p.equipoLocal,
      equipoVisita: p.equipoVisita,
      visibleAlPublico: visible,
      visibilidadOverride: p.visibilidadOverride,
      combinadas: p.torneos[0]?.totalInscritos ?? 0,
      estadoMatch: p.estado as "PROGRAMADO" | "EN_VIVO" | "FINALIZADO",
    };
  });

  const avisos: AvisoSistema[] = [];
  for (const p of partidosElegiblesMes) {
    if (p.elegibleLiga && (!p.analisisPartido || p.analisisPartido.estado !== "APROBADO")) {
      avisos.push({
        id: `analisis-${p.id}`,
        partidoId: p.id,
        liga: p.liga,
        equipos: `${p.equipoLocal} vs ${p.equipoVisita}`,
        fechaInicio: p.fechaInicio,
        tipo: "analisis_pendiente",
        mensaje: "⚠️ Elegible Liga pero análisis Socios sin aprobar. Validar o sacar de Liga.",
      });
    }
    const dias = Math.ceil((p.fechaInicio.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
    if (dias > 7 && p.visibilidadOverride !== "forzar_visible") {
      avisos.push({
        id: `lejos-${p.id}`,
        partidoId: p.id,
        liga: p.liga,
        equipos: `${p.equipoLocal} vs ${p.equipoVisita}`,
        fechaInicio: p.fechaInicio,
        tipo: "kickoff_lejos",
        mensaje: `📅 Falta ${dias} días, hoy no visible. Mañana automáticamente entra a la lista visible.`,
      });
    }
  }

  // Tracking referidos: placeholders fijos hasta que el funnel del Lote P
  // alimente datos reales (decisión §4.4 — KPIs cualitativos del mockup).
  const referidos: KpiReferidoLiga[] = [
    { label: "Liga → Las Fijas", valor: "—", meta: "Antes de armar combinada", estado: "good" },
    { label: "Liga → Casa afiliada", valor: "—", meta: "Click a casa post-combinada", estado: "good" },
    { label: "Liga → Socios", valor: "—", meta: "Conversión a Socio desde Liga", estado: "amber" },
    { label: "Liga → Perfil otro jugador", valor: "—", meta: "Click ranking → perfil", estado: "good" },
  ];

  return {
    mesEtiqueta: `${capitalize(MES_LARGO[ahora.getMonth()])} ${ahora.getFullYear()}`,
    cierreFechaIso: `1 ${MES_CORTO[inicioMesSiguiente.getMonth()]} 00:01 PET`,
    kpis: {
      tipstersCompitiendo: tipstersUnicos,
      combinadasFinales: totalCombinadas,
      visiblesAhora: partidos,
      totalElegibles: partidosElegiblesMes.length,
      diasAlCierre,
    },
    partidosElegibles,
    avisos: avisos.slice(0, 5),
    referidos,
    top10: top10Filas.slice(0, 10),
  };
}

async function obtenerTop10MesActual(): Promise<Top10Liga[]> {
  try {
    const { obtenerLeaderboardMesActual } = await import("./leaderboard.service");
    const lb = await obtenerLeaderboardMesActual({});
    return lb.filas.slice(0, 10).map((f) => ({
      posicion: f.posicion,
      username: f.username,
      puntos: f.puntos,
    }));
  } catch {
    return [];
  }
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
