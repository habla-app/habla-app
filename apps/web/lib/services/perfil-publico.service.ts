// perfil-publico.service.ts — Lote 11 (May 2026).
//
// Datos del perfil público de un tipster en `/comunidad/[username]`.
// Combina:
//   - lookup de Usuario por username (case-insensitive) — sólo no
//     borrados. Un username con `deleted_<hex>` no aparece (queda 404).
//   - stats globales (Predicciones · Aciertos · % Acierto · Mejor puesto)
//     vía `calcularStats()` del servicio de tickets.
//   - stats mensuales (posición del mes en curso · mejor mes histórico)
//     vía `obtenerMisStatsMensuales()` del Lote 5.
//   - últimas 10 predicciones FINALIZADAS (`puntosFinales != null`) para
//     el tab de historial. Predicciones ACTIVAS no se exponen — eso
//     daría ventaja informativa a quienes leen el perfil ajeno.
//
// Si el usuario tiene `perfilPublico: false`, devolvemos `{
// privacidad: 'privado' }` y la page renderiza un estado mínimo. La
// existencia del usuario sigue siendo verificable (404 vs privado), pero
// no se filtra nada de la actividad.

import { prisma } from "@habla/db";
import { calcularNivel, type Nivel } from "../utils/nivel";
import { calcularStats, type TicketsStats } from "./tickets.service";
import {
  obtenerMisStatsMensuales,
  type MisStatsMensuales,
} from "./leaderboard.service";

export interface PerfilPublicoTicket {
  id: string;
  torneoId: string;
  partidoEquipoLocal: string;
  partidoEquipoVisita: string;
  partidoLiga: string;
  partidoFechaInicio: Date;
  /** Resultado real del partido (LOCAL/EMPATE/VISITA) si finalizó.
   *  Si no se conoce, queda null. */
  resultadoReal: string | null;
  predResultado: string;
  puntosFinales: number;
  posicionFinal: number | null;
}

export interface PerfilPublicoVista {
  username: string;
  /** Si el perfil es privado, el caller no debe mostrar las stats ni los
   *  tickets. La existencia del username está confirmada (no es 404). */
  privacidad: "publico" | "privado";
  nombre: string;
  desde: Date;
  nivel: Nivel;
  torneosJugados: number;
  stats: TicketsStats;
  mensual: MisStatsMensuales;
  ultimasFinalizadas: PerfilPublicoTicket[];
}

/**
 * Obtiene el perfil público por username. Devuelve null si el usuario
 * no existe o está soft-deleted (caller responde 404). Si el usuario
 * existe pero `perfilPublico=false`, devuelve un payload mínimo con
 * `privacidad: 'privado'` — la caller renderiza el estado bloqueado
 * sin filtrar stats ni tickets.
 */
export async function obtenerPerfilPublico(
  username: string,
): Promise<PerfilPublicoVista | null> {
  // Lookup case-insensitive del username. Prisma no expone `mode:
  // 'insensitive'` en `findUnique`, así que usamos `findFirst` con la
  // condición. Excluye soft-deleted (deletedAt: not null).
  const usuario = await prisma.usuario.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      deletedAt: null,
    },
    select: {
      id: true,
      nombre: true,
      username: true,
      creadoEn: true,
      perfilPublico: true,
    },
  });
  if (!usuario) return null;

  // Si el perfil es privado, devolvemos sólo lo mínimo necesario para
  // que la page muestre el estado bloqueado. No leemos tickets ni
  // ranking — protege la performance de la page contra usernames con
  // mucha actividad.
  if (!usuario.perfilPublico) {
    return {
      username: usuario.username,
      privacidad: "privado",
      nombre: usuario.nombre,
      desde: usuario.creadoEn,
      nivel: calcularNivel(0),
      torneosJugados: 0,
      stats: { jugadas: 0, ganadas: 0, aciertoPct: 0, mejorPuesto: null },
      mensual: {
        mes: "",
        nombreMes: "",
        posicionDelMes: null,
        totalUsuariosMes: 0,
        mejorMes: null,
      },
      ultimasFinalizadas: [],
    };
  }

  // Carga concurrente — todas las queries son independientes.
  const [torneosDistintos, stats, mensual, ultimas] = await Promise.all([
    prisma.ticket.findMany({
      where: { usuarioId: usuario.id },
      select: { torneoId: true },
      distinct: ["torneoId"],
    }),
    calcularStats(usuario.id),
    obtenerMisStatsMensuales(usuario.id),
    prisma.ticket.findMany({
      where: {
        usuarioId: usuario.id,
        puntosFinales: { not: null },
      },
      include: {
        torneo: { include: { partido: true } },
      },
      orderBy: { creadoEn: "desc" },
      take: 10,
    }),
  ]);

  const ultimasFinalizadas: PerfilPublicoTicket[] = ultimas.map((t) => ({
    id: t.id,
    torneoId: t.torneoId,
    partidoEquipoLocal: t.torneo.partido.equipoLocal,
    partidoEquipoVisita: t.torneo.partido.equipoVisita,
    partidoLiga: t.torneo.partido.liga,
    partidoFechaInicio: t.torneo.partido.fechaInicio,
    resultadoReal: deriveResultadoReal(t.torneo.partido),
    predResultado: t.predResultado,
    puntosFinales: t.puntosFinales ?? 0,
    posicionFinal: t.posicionFinal,
  }));

  return {
    username: usuario.username,
    privacidad: "publico",
    nombre: usuario.nombre,
    desde: usuario.creadoEn,
    nivel: calcularNivel(torneosDistintos.length),
    torneosJugados: torneosDistintos.length,
    stats,
    mensual,
    ultimasFinalizadas,
  };
}

function deriveResultadoReal(partido: {
  golesLocal: number | null;
  golesVisita: number | null;
}): string | null {
  if (partido.golesLocal == null || partido.golesVisita == null) {
    return null;
  }
  if (partido.golesLocal > partido.golesVisita) return "LOCAL";
  if (partido.golesLocal < partido.golesVisita) return "VISITA";
  return "EMPATE";
}
