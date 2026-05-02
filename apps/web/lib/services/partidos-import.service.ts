// Auto-import de partidos y torneos desde api-football.
//
// Este service es el corazón del job periódico que corre en el cron
// in-process (apps/web/instrumentation.ts) cada 6h. Hace 2 cosas
// idempotentes:
//
//   1. UPSERT de partidos por externalId (unique constraint). Si el
//      partido ya existe, refresca fecha/estado/marcador. Si no, lo
//      crea.
//   2. CREA el torneo asociado a cada partido importado cuando no
//      existe. Si ya existe, no lo toca. Esto es regla dura del
//      negocio: todo partido de una liga whitelisteada debe tener
//      exactamente un torneo.
//
// Ventana: hoy hasta hoy+DIAS_VENTANA_IMPORT (14 días rodantes).
// Ligas: las definidas en lib/config/ligas.ts.
//
// Si api-football devuelve error para una liga, se loguea y seguimos
// con las demás (una liga caída no tumba la corrida completa).
//
// Lote L v3.2 (May 2026): detecta transiciones críticas para enviar
// notificaciones por email a los usuarios con tickets activos:
//   - Cambio de `fechaInicio` (decisión §4.9.3): partido pospuesto.
//     Email PartidoPospuesto + reset de Torneo.cierreAt.
//   - Transición de estado a CANCELADO (decisión §4.9.4): cero puntos
//     para todos. Email PartidoCancelado.

import { prisma, type EstadoPartido } from "@habla/db";
import {
  LIGAS_ACTIVAS,
  DIAS_VENTANA_IMPORT,
  type LigaConfig,
} from "../config/ligas";
import {
  fetchFixturesByLeague,
  type ApiFootballFixture,
} from "./api-football.client";
import { fixtureToPartidoInput } from "./partidos.mapper";
import { getSeasonForLeague } from "./seasons.cache";
import { CIERRE_MIN_BEFORE } from "./torneos.service";
import { logger } from "./logger";
import { sendEmail } from "@/lib/email/send";
import {
  PartidoCancelado,
  PartidoPospuesto,
} from "@/lib/email/templates";

export interface ImportLigaResult {
  liga: string;
  season: number | null;
  partidosCreados: number;
  partidosActualizados: number;
  torneosCreados: number;
  errores: number;
}

function formatDateYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Corre el auto-import para todas las ligas whitelisteadas. Devuelve un
 * resultado por liga, aun si alguna falló (para que el admin vea qué
 * pasó).
 */
export async function importarPartidosTodasLasLigas(): Promise<
  ImportLigaResult[]
> {
  const hoy = new Date();
  const hasta = new Date(hoy.getTime() + DIAS_VENTANA_IMPORT * 86_400_000);
  const from = formatDateYMD(hoy);
  const to = formatDateYMD(hasta);

  const resultados: ImportLigaResult[] = [];

  for (const liga of LIGAS_ACTIVAS) {
    try {
      const season = await getSeasonForLeague(liga.apiFootballId);
      const fixtures = await fetchFixturesByLeague(
        liga.apiFootballId,
        season,
        from,
        to,
      );
      const counters = await procesarFixtures(fixtures, liga);
      resultados.push({
        liga: liga.nombre,
        season,
        ...counters,
        errores: 0,
      });
      logger.info(
        {
          liga: liga.nombre,
          season,
          from,
          to,
          ...counters,
        },
        "[import partidos] liga procesada",
      );
    } catch (err) {
      logger.error(
        { err, liga: liga.nombre, leagueId: liga.apiFootballId },
        "[import partidos] error importando liga",
      );
      resultados.push({
        liga: liga.nombre,
        season: null,
        partidosCreados: 0,
        partidosActualizados: 0,
        torneosCreados: 0,
        errores: 1,
      });
    }
  }

  return resultados;
}

/**
 * Para un array de fixtures de una liga: upsertea partidos y garantiza
 * que cada uno tenga torneo. Es idempotente — correrlo N veces deja el
 * mismo estado.
 */
async function procesarFixtures(
  fixtures: ApiFootballFixture[],
  liga: LigaConfig,
): Promise<{
  partidosCreados: number;
  partidosActualizados: number;
  torneosCreados: number;
}> {
  let partidosCreados = 0;
  let partidosActualizados = 0;
  let torneosCreados = 0;

  for (const fixture of fixtures) {
    const input = fixtureToPartidoInput(fixture);
    // El nombre de la liga del fixture es el que devuelve api-football;
    // preferimos el nombre canónico de nuestra config para evitar drift.
    input.liga = liga.nombre;

    // ── 1. UPSERT partido (detectando transiciones críticas) ──
    // Lote L v3.2: leemos el row previo con campos suficientes para detectar
    // pospuesto (fechaInicio cambió) y cancelado (estado pasó a CANCELADO).
    const previo = await prisma.partido.findUnique({
      where: { externalId: input.externalId },
      select: {
        id: true,
        fechaInicio: true,
        estado: true,
      },
    });

    const partido = await prisma.partido.upsert({
      where: { externalId: input.externalId },
      create: input,
      update: {
        liga: input.liga,
        equipoLocal: input.equipoLocal,
        equipoVisita: input.equipoVisita,
        fechaInicio: input.fechaInicio,
        estado: input.estado,
        golesLocal: input.golesLocal,
        golesVisita: input.golesVisita,
        btts: input.btts,
        mas25Goles: input.mas25Goles,
        round: input.round,
        venue: input.venue,
      },
    });

    if (previo) {
      partidosActualizados += 1;
      // Lote L v3.2: detección de transiciones — fire-and-forget, no
      // bloquea el batch ni rompe la corrida si los emails fallan.
      void detectarYNotificarTransiciones({
        partidoId: partido.id,
        ligaNombre: liga.nombre,
        equipoLocal: input.equipoLocal,
        equipoVisita: input.equipoVisita,
        fechaInicioPrevia: previo.fechaInicio,
        fechaInicioNueva: input.fechaInicio,
        estadoPrevio: previo.estado,
        estadoNuevo: input.estado,
      }).catch((err) => {
        logger.error(
          { err, partidoId: partido.id, source: "partidos-import:transiciones" },
          "detectarYNotificarTransiciones falló",
        );
      });
    } else {
      partidosCreados += 1;
    }

    // ── 2. CREAR torneo si no existe (regla dura) ──
    // Solo creamos torneo para partidos que todavía pueden jugarse. Si
    // el partido ya empezó o terminó y no tenía torneo, no tiene sentido
    // crear uno ahora — quedaría con cierreAt en el pasado y sin
    // inscritos posibles.
    const cierreAt = new Date(
      partido.fechaInicio.getTime() - CIERRE_MIN_BEFORE * 60 * 1000,
    );
    const yaCerrado = cierreAt.getTime() <= Date.now();
    if (yaCerrado) continue;

    const torneoExistente = await prisma.torneo.findFirst({
      where: { partidoId: partido.id },
      select: { id: true },
    });
    if (torneoExistente) continue;

    await prisma.torneo.create({
      data: {
        nombre: `${partido.equipoLocal} vs ${partido.equipoVisita}`,
        // Lote 2: `liga.tipoTorneo` se conserva sólo como badge visual.
        tipo: liga.tipoTorneo,
        partidoId: partido.id,
        cierreAt,
      },
    });
    torneosCreados += 1;
  }

  return { partidosCreados, partidosActualizados, torneosCreados };
}

// ---------------------------------------------------------------------------
// Lote L v3.2: detección y notificación de transiciones críticas
// ---------------------------------------------------------------------------

/** Tolerancia para considerar que `fechaInicio` "cambió" — evita falsos
 *  positivos por jitter de api-football (segundos de diferencia entre runs). */
const FECHA_INICIO_TOLERANCIA_MS = 60_000; // 1 minuto

interface TransicionInput {
  partidoId: string;
  ligaNombre: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicioPrevia: Date;
  fechaInicioNueva: Date;
  estadoPrevio: EstadoPartido;
  estadoNuevo: EstadoPartido;
}

/**
 * Detecta dos transiciones críticas y notifica por email a los usuarios con
 * tickets activos en torneos del partido:
 *
 *   1. Cambio de `fechaInicio` (decisión §4.9.3): partido pospuesto. Email
 *      `PartidoPospuesto`. Adicionalmente actualiza `Torneo.cierreAt` para
 *      que el cron de cierre respete el nuevo kickoff y el ticket siga
 *      editable hasta el nuevo horario.
 *   2. Transición de estado a CANCELADO (decisión §4.9.4): cero puntos
 *      para todos. Email `PartidoCancelado`. Los puntos no se mutan acá —
 *      el evaluador `puntuacion.service` ya respeta el estado CANCELADO.
 *
 * Ambos casos se ejecutan independiente; un partido cancelado además puede
 * haber cambiado de fecha (raro, pero pasa) — mandamos los dos emails
 * separados si así fuera, son notificaciones distintas.
 */
async function detectarYNotificarTransiciones(
  input: TransicionInput,
): Promise<void> {
  const fechaCambio =
    Math.abs(
      input.fechaInicioNueva.getTime() - input.fechaInicioPrevia.getTime(),
    ) > FECHA_INICIO_TOLERANCIA_MS;
  const transicionACancelado =
    input.estadoNuevo === "CANCELADO" && input.estadoPrevio !== "CANCELADO";

  if (!fechaCambio && !transicionACancelado) return;

  // Cargar usuarios con tickets activos en torneos de este partido. Filtramos
  // a usuarios no eliminados y con email.
  const tickets = await prisma.ticket.findMany({
    where: {
      torneo: {
        partidoId: input.partidoId,
        estado: { in: ["ABIERTO", "CERRADO", "EN_JUEGO"] },
      },
      usuario: { deletedAt: null, email: { not: "" } },
    },
    select: {
      id: true,
      usuario: { select: { id: true, email: true, username: true } },
    },
  });

  const partidoNombre = `${input.equipoLocal} vs ${input.equipoVisita}`;
  // Slug del partido: el mapeo formal partido↔slug vive en Lote M (vista
  // /liga/[slug]). Hasta entonces, dejamos null y el email apunta a /liga.
  const partidoSlug: string | null = null;

  // 1. Pospuesto — actualizar cierreAt y mandar email
  if (fechaCambio && !transicionACancelado) {
    const nuevoCierre = new Date(
      input.fechaInicioNueva.getTime() - CIERRE_MIN_BEFORE * 60 * 1000,
    );
    await prisma.torneo.updateMany({
      where: {
        partidoId: input.partidoId,
        estado: { in: ["ABIERTO", "CERRADO"] },
      },
      data: { cierreAt: nuevoCierre, estado: "ABIERTO" },
    });

    logger.info(
      {
        partidoId: input.partidoId,
        antes: input.fechaInicioPrevia.toISOString(),
        ahora: input.fechaInicioNueva.toISOString(),
        ticketsActivos: tickets.length,
        source: "partidos-import:transiciones",
      },
      "transicion: partido pospuesto, cierreAt actualizado",
    );

    for (const t of tickets) {
      try {
        await sendEmail({
          to: t.usuario.email,
          subject: PartidoPospuesto.subject,
          react: PartidoPospuesto({
            username: t.usuario.username,
            partidoNombre,
            ligaNombre: input.ligaNombre,
            fechaAnterior: input.fechaInicioPrevia,
            fechaNueva: input.fechaInicioNueva,
            partidoSlug,
          }),
          categoria: "onboarding",
          tags: [
            { name: "trigger", value: "partido_pospuesto" },
            { name: "partidoId", value: input.partidoId.slice(0, 60) },
          ],
        });
      } catch (err) {
        logger.warn(
          {
            err,
            usuarioId: t.usuario.id,
            partidoId: input.partidoId,
            source: "partidos-import:transiciones",
          },
          "PartidoPospuesto: envío falló (no bloqueante)",
        );
      }
    }
  }

  // 2. Cancelado — mandar email (puntos los maneja puntuacion.service)
  if (transicionACancelado) {
    logger.info(
      {
        partidoId: input.partidoId,
        ticketsActivos: tickets.length,
        source: "partidos-import:transiciones",
      },
      "transicion: partido cancelado",
    );

    for (const t of tickets) {
      try {
        await sendEmail({
          to: t.usuario.email,
          subject: PartidoCancelado.subject,
          react: PartidoCancelado({
            username: t.usuario.username,
            partidoNombre,
            ligaNombre: input.ligaNombre,
          }),
          categoria: "onboarding",
          tags: [
            { name: "trigger", value: "partido_cancelado" },
            { name: "partidoId", value: input.partidoId.slice(0, 60) },
          ],
        });
      } catch (err) {
        logger.warn(
          {
            err,
            usuarioId: t.usuario.id,
            partidoId: input.partidoId,
            source: "partidos-import:transiciones",
          },
          "PartidoCancelado: envío falló (no bloqueante)",
        );
      }
    }
  }
}

