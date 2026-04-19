// Poller de partidos en vivo — Sub-Sprint 5.
//
// Corre cada 30s. Para cada partido que esté EN_VIVO o PROGRAMADO con
// kickoff <=15min:
//   1. Llama api-football /fixtures?id=X (1 request por partido — trae
//      status, marcador, elapsed, team info).
//   2. Llama /fixtures/events?fixture=X (eventos de goles/tarjetas).
//   3. Upsertea el partido (status, marcador, flags derivados cuando
//      FINALIZADO) y los eventos nuevos (unique natural key evita
//      duplicados).
//   4. Para cada torneo ligado al partido:
//        - recalcularTorneo() → re-puntúa todos los tickets
//        - emitirRankingUpdate() → push a Socket.io
//        - si hay evento nuevo, emitirPartidoEvento()
//        - si el partido FT, finalizarTorneo() + emitirTorneoFinalizado()
//
// Idempotencia: re-correrlo con los mismos datos NO duplica eventos ni
// altera puntos (el motor es pura función de inputs). La unique natural
// key (partidoId+tipo+minuto+equipo+jugador) asegura el upsert idempotente
// de eventos.
//
// Rate limiting: backoff exponencial con cap 5 min si api-football
// devuelve 429 (free plan tiene 100 req/día — esto lo monitorea Sentry
// en prod).

import { prisma } from "@habla/db";
import {
  fetchFixtureById,
  fetchFixtureEvents,
  type ApiFootballEvent,
  type ApiFootballFixture,
} from "./api-football.client";
import { fixtureToPartidoInput, mapEstadoPartido } from "./partidos.mapper";
import { mapEvento } from "./eventos.mapper";
import { ApiFootballError } from "./errors";
import { logger } from "./logger";
import { recalcularTorneo } from "./puntuacion.service";
import { finalizarTorneo } from "./ranking.service";
import {
  clearLiveStatus,
  setLiveStatus,
} from "./live-partido-status.cache";
import {
  emitirPartidoEvento,
  emitirRankingUpdate,
  emitirTorneoFinalizado,
} from "../realtime/emitters";
import { TIPO_EVENTO } from "../realtime/eventos";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Corre cada 30s. Tunable — el API free tier acepta ~100 req/día. */
export const POLLER_INTERVAL_MS = 30_000;
/** Ventana de lookahead: partidos a <15min del kickoff ya se polean. */
export const VENTANA_PROGRAMADO_MIN = 15;

// ---------------------------------------------------------------------------
// Estado de rate-limit (in-memory, se resetea al restart — suficiente)
// ---------------------------------------------------------------------------

interface BackoffState {
  until: number;
  attempts: number;
}

const backoff: BackoffState = { until: 0, attempts: 0 };

function enBackoff(): boolean {
  return Date.now() < backoff.until;
}

function registrarFallo429(): void {
  backoff.attempts += 1;
  const delayMs = Math.min(
    300_000 /* 5 min cap */,
    2_000 * Math.pow(2, backoff.attempts),
  );
  backoff.until = Date.now() + delayMs;
  logger.warn(
    { delayMs, attempts: backoff.attempts },
    "[poller] rate limited por api-football, backoff activo",
  );
}

function resetBackoff(): void {
  if (backoff.attempts > 0) {
    logger.info("[poller] backoff reseteado");
  }
  backoff.attempts = 0;
  backoff.until = 0;
}

// ---------------------------------------------------------------------------
// Main tick
// ---------------------------------------------------------------------------

export interface PollerTickResult {
  partidosPoleados: number;
  partidosActualizados: number;
  eventosNuevos: number;
  torneosRecalculados: number;
  torneosFinalizados: number;
  errores: number;
}

export async function pollerTick(): Promise<PollerTickResult> {
  if (enBackoff()) {
    logger.debug("[poller] skip por backoff activo");
    return {
      partidosPoleados: 0,
      partidosActualizados: 0,
      eventosNuevos: 0,
      torneosRecalculados: 0,
      torneosFinalizados: 0,
      errores: 0,
    };
  }

  const ventanaFin = new Date(
    Date.now() + VENTANA_PROGRAMADO_MIN * 60 * 1000,
  );

  const partidos = await prisma.partido.findMany({
    where: {
      OR: [
        { estado: "EN_VIVO" },
        { estado: "PROGRAMADO", fechaInicio: { lte: ventanaFin } },
      ],
    },
    include: { torneos: { select: { id: true, estado: true } } },
  });

  const stats: PollerTickResult = {
    partidosPoleados: partidos.length,
    partidosActualizados: 0,
    eventosNuevos: 0,
    torneosRecalculados: 0,
    torneosFinalizados: 0,
    errores: 0,
  };

  for (const partido of partidos) {
    try {
      const resultado = await pollearPartido(partido);
      if (resultado.actualizado) stats.partidosActualizados += 1;
      stats.eventosNuevos += resultado.eventosNuevos;
      stats.torneosRecalculados += resultado.torneosRecalculados;
      stats.torneosFinalizados += resultado.torneosFinalizados;
    } catch (err) {
      stats.errores += 1;
      if (err instanceof ApiFootballError && err.meta?.status === 429) {
        registrarFallo429();
        break; // abortar el tick, seguir en el próximo
      }
      logger.error(
        { err, partidoId: partido.id, externalId: partido.externalId },
        "[poller] error polleando partido",
      );
    }
  }

  if (stats.errores === 0) resetBackoff();

  if (
    stats.partidosActualizados > 0 ||
    stats.eventosNuevos > 0 ||
    stats.torneosFinalizados > 0
  ) {
    logger.info({ stats }, "[poller] tick completado");
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Un sólo partido
// ---------------------------------------------------------------------------

interface PartidoPollResult {
  actualizado: boolean;
  eventosNuevos: number;
  torneosRecalculados: number;
  torneosFinalizados: number;
}

async function pollearPartido(partido: {
  id: string;
  externalId: string;
  estado: string;
  golesLocal: number | null;
  golesVisita: number | null;
  huboTarjetaRoja: boolean | null;
  torneos: Array<{ id: string; estado: string }>;
}): Promise<PartidoPollResult> {
  const result: PartidoPollResult = {
    actualizado: false,
    eventosNuevos: 0,
    torneosRecalculados: 0,
    torneosFinalizados: 0,
  };

  const fixture = await fetchFixtureById(partido.externalId);
  if (!fixture) {
    logger.warn(
      { externalId: partido.externalId },
      "[poller] fixture no existe en api-football",
    );
    return result;
  }

  // Bug #9: snapshot del minuto + status para que el hero de
  // /live-match pueda mostrar el label inmediatamente (sin esperar al
  // primer WS). `emitirRankingUpdate` lee de este cache al construir
  // el payload.
  setLiveStatus(
    partido.id,
    fixture.fixture.status.short,
    fixture.fixture.status.elapsed,
  );

  // 1. Upsertear datos básicos del partido
  const partidoInput = fixtureToPartidoInput(fixture);
  const cambios: Partial<typeof partidoInput> & {
    huboTarjetaRoja?: boolean;
  } = {};
  if (partidoInput.estado !== partido.estado) cambios.estado = partidoInput.estado;
  if (partidoInput.golesLocal !== partido.golesLocal)
    cambios.golesLocal = partidoInput.golesLocal;
  if (partidoInput.golesVisita !== partido.golesVisita)
    cambios.golesVisita = partidoInput.golesVisita;
  if (partidoInput.btts !== null) cambios.btts = partidoInput.btts;
  if (partidoInput.mas25Goles !== null) cambios.mas25Goles = partidoInput.mas25Goles;

  // 2. Eventos — upsert idempotente por (partidoId+tipo+minuto+equipo+jugador)
  const eventosApi = await fetchFixtureEvents(partido.externalId);
  const eventosNuevos = await procesarEventos(
    partido.id,
    fixture,
    eventosApi,
    partido.huboTarjetaRoja,
  );
  result.eventosNuevos = eventosNuevos.length;

  // Si hubo tarjeta roja o la API reportó una en eventos, actualizar flag
  const hayRoja = eventosApi.some((e) => {
    const t = (e.type || "").toLowerCase();
    const d = (e.detail || "").toLowerCase();
    return t === "card" && (d.includes("red") || d.includes("second yellow"));
  });
  if (hayRoja && !partido.huboTarjetaRoja) cambios.huboTarjetaRoja = true;

  // Persistir cambios del partido
  if (Object.keys(cambios).length > 0) {
    await prisma.partido.update({
      where: { id: partido.id },
      data: cambios,
    });
    result.actualizado = true;
  }

  // 3. Emitir eventos nuevos + recalcular torneos + (si FT) finalizar
  const torneoIds = partido.torneos
    .filter((t) => t.estado === "EN_JUEGO" || t.estado === "CERRADO")
    .map((t) => t.id);

  // Mark torneos CERRADOS -> EN_JUEGO si el partido arrancó
  if (
    partidoInput.estado === "EN_VIVO" &&
    partido.torneos.some((t) => t.estado === "CERRADO")
  ) {
    await prisma.torneo.updateMany({
      where: {
        partidoId: partido.id,
        estado: "CERRADO",
      },
      data: { estado: "EN_JUEGO" },
    });
  }

  if (torneoIds.length > 0) {
    // Emitir eventos nuevos a cada torneo
    for (const ev of eventosNuevos) {
      for (const torneoId of torneoIds) {
        emitirPartidoEvento({
          torneoId,
          partidoId: partido.id,
          tipo: ev.tipo,
          equipo: ev.equipo,
          minuto: ev.minuto,
          jugador: ev.jugador,
          detalle: ev.detalle,
          marcadorLocal: partidoInput.golesLocal ?? 0,
          marcadorVisita: partidoInput.golesVisita ?? 0,
        });
      }
    }

    // Recalcular ranking si hubo cambios relevantes
    const huboCambioRelevante =
      cambios.golesLocal !== undefined ||
      cambios.golesVisita !== undefined ||
      cambios.huboTarjetaRoja !== undefined ||
      cambios.estado !== undefined ||
      eventosNuevos.length > 0;
    if (huboCambioRelevante) {
      for (const torneoId of torneoIds) {
        try {
          await recalcularTorneo(torneoId);
          // Bug #9: emitirRankingUpdate lee el label desde el cache
          // que acabamos de actualizar con setLiveStatus arriba.
          await emitirRankingUpdate(torneoId, { partidoId: partido.id });
          result.torneosRecalculados += 1;
        } catch (err) {
          logger.error({ err, torneoId }, "[poller] recalc torneo falló");
        }
      }
    }

    // Partido FINALIZADO → finalizar torneos
    if (
      partidoInput.estado === "FINALIZADO" &&
      partido.estado !== "FINALIZADO"
    ) {
      for (const torneoId of torneoIds) {
        try {
          const r = await finalizarTorneo(torneoId);
          emitirTorneoFinalizado({ torneoId, ganadores: r.ganadores });
          result.torneosFinalizados += 1;
        } catch (err) {
          logger.error({ err, torneoId }, "[poller] finalizar torneo falló");
        }
      }
      // Tras FT definitivo, limpiamos el snapshot: el label "FIN" ya
      // quedó capturado pero no necesitamos seguir leyéndolo en vivo.
      if (partidoInput.estado === "FINALIZADO") {
        setLiveStatus(
          partido.id,
          fixture.fixture.status.short,
          fixture.fixture.status.elapsed,
        );
      }
    }
  }

  return result;
}

// Re-export para que otros módulos (tests) puedan limpiar el cache sin
// importar la ruta interna.
export { clearLiveStatus };

// ---------------------------------------------------------------------------
// procesarEventos — upsert idempotente + devuelve sólo los nuevos
// ---------------------------------------------------------------------------

interface EventoSalvado {
  tipo: import("../realtime/eventos").TipoEventoPartido;
  minuto: number;
  equipo: import("../realtime/eventos").EquipoEvento;
  jugador: string | null;
  detalle: string | null;
}

async function procesarEventos(
  partidoId: string,
  fixture: ApiFootballFixture,
  eventosApi: ApiFootballEvent[],
  _huboTarjetaRoja: boolean | null,
): Promise<EventoSalvado[]> {
  void _huboTarjetaRoja;
  const parsed: EventoSalvado[] = [];
  for (const ev of eventosApi) {
    const m = mapEvento(ev, fixture);
    if (!m) continue;
    parsed.push(m);
  }

  if (parsed.length === 0) return [];

  // Existentes → detectar nuevos
  const existentes = await prisma.eventoPartido.findMany({
    where: { partidoId },
    select: {
      tipo: true,
      minuto: true,
      equipo: true,
      jugador: true,
    },
  });
  const existKey = new Set(
    existentes.map(
      (e) => `${e.tipo}|${e.minuto}|${e.equipo}|${e.jugador ?? ""}`,
    ),
  );

  const nuevos: EventoSalvado[] = [];
  for (const ev of parsed) {
    const key = `${ev.tipo}|${ev.minuto}|${ev.equipo}|${ev.jugador ?? ""}`;
    if (!existKey.has(key)) nuevos.push(ev);
  }

  if (nuevos.length === 0) return [];

  // Insertar nuevos — si dos pollers corren simultáneo y hay colisión,
  // el índice único atrapa el duplicado. Hacemos inserción una a una
  // con try/catch porque `createMany` con skipDuplicates no respeta
  // índices expression-based.
  for (const ev of nuevos) {
    try {
      await prisma.eventoPartido.create({
        data: {
          partidoId,
          tipo: ev.tipo,
          minuto: ev.minuto,
          equipo: ev.equipo,
          jugador: ev.jugador,
          detalle: ev.detalle,
        },
      });
    } catch (err) {
      // Ignoramos colisiones de unique (P2002) — alguien más ya lo creó
      logger.debug(
        { err, partidoId, ev },
        "[poller] evento ya existente, skip",
      );
    }
  }

  // Si status.short es FT, agregar evento sintético FIN_PARTIDO si no existe
  if (mapEstadoPartido(fixture.fixture.status.short) === "FINALIZADO") {
    const finKey = `${TIPO_EVENTO.FIN_PARTIDO}|${fixture.fixture.status.elapsed ?? 90}|NEUTRAL|`;
    if (!existKey.has(finKey)) {
      try {
        await prisma.eventoPartido.create({
          data: {
            partidoId,
            tipo: TIPO_EVENTO.FIN_PARTIDO,
            minuto: fixture.fixture.status.elapsed ?? 90,
            equipo: "NEUTRAL",
            jugador: null,
            detalle: null,
          },
        });
      } catch {
        // idem — dup tolerable
      }
    }
  }

  return nuevos;
}
