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
  emitirPartidoEventoInvalidado,
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
  eventosInvalidados: number;
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
      eventosInvalidados: 0,
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
    eventosInvalidados: 0,
    torneosRecalculados: 0,
    torneosFinalizados: 0,
    errores: 0,
  };

  for (const partido of partidos) {
    try {
      const resultado = await pollearPartido(partido);
      if (resultado.actualizado) stats.partidosActualizados += 1;
      stats.eventosNuevos += resultado.eventosNuevos;
      stats.eventosInvalidados += resultado.eventosInvalidados;
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
  eventosInvalidados: number;
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
    eventosInvalidados: 0,
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
  await setLiveStatus(
    partido.id,
    fixture.fixture.status.short,
    fixture.fixture.status.elapsed,
    fixture.fixture.status.extra ?? null,
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

  // 2. Eventos — sincronización completa (Hotfix #6 Ítem 2):
  //    - Inserta eventos nuevos (presentes en API, no en BD).
  //    - Elimina eventos invalidados (presentes en BD, no en API).
  //    Si el fetch falla, el throw ya saltó antes y no tocamos BD.
  const eventosApi = await fetchFixtureEvents(partido.externalId);
  const { nuevos: eventosNuevos, invalidados: eventosInvalidados } =
    await sincronizarEventos(partido.id, fixture, eventosApi);
  result.eventosNuevos = eventosNuevos.length;
  result.eventosInvalidados = eventosInvalidados.length;

  // Si hubo tarjeta roja o la API reportó una en eventos, actualizar flag.
  // Si el API YA NO reporta roja (se anuló), revertimos a false.
  const hayRoja = eventosApi.some((e) => {
    const t = (e.type || "").toLowerCase();
    const d = (e.detail || "").toLowerCase();
    return t === "card" && (d.includes("red") || d.includes("second yellow"));
  });
  if (hayRoja && !partido.huboTarjetaRoja) cambios.huboTarjetaRoja = true;
  if (!hayRoja && partido.huboTarjetaRoja) cambios.huboTarjetaRoja = false;

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

    // Emitir invalidaciones (Hotfix #6 Ítem 2) — el cliente remueve el
    // evento de su timeline sin esperar refresh.
    for (const key of eventosInvalidados) {
      for (const torneoId of torneoIds) {
        emitirPartidoEventoInvalidado({
          torneoId,
          partidoId: partido.id,
          naturalKey: key,
        });
      }
    }

    // Recalcular ranking si hubo cambios relevantes
    const huboCambioRelevante =
      cambios.golesLocal !== undefined ||
      cambios.golesVisita !== undefined ||
      cambios.huboTarjetaRoja !== undefined ||
      cambios.estado !== undefined ||
      eventosNuevos.length > 0 ||
      eventosInvalidados.length > 0;
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
        await setLiveStatus(
          partido.id,
          fixture.fixture.status.short,
          fixture.fixture.status.elapsed,
          fixture.fixture.status.extra ?? null,
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
// sincronizarEventos — Hotfix #6 Ítem 2.
//
// Sincroniza el set de eventos de BD con lo que reporta la API:
//   - Inserta los que están en API pero no en BD (eventos nuevos).
//   - Elimina los que están en BD pero no en API (eventos invalidados,
//     ej. goles anulados por VAR, rojas revocadas).
//
// Preserva el evento sintético FIN_PARTIDO que creamos localmente cuando
// el status pasa a FINALIZADO (no viene del API, no queremos borrarlo
// al sincronizar).
//
// El caller garantiza que `eventosApi` viene de un fetch exitoso; si el
// API falla, el error se propaga antes de llegar acá y no se tocan
// datos.
// ---------------------------------------------------------------------------

interface EventoSalvado {
  tipo: import("../realtime/eventos").TipoEventoPartido;
  minuto: number;
  equipo: import("../realtime/eventos").EquipoEvento;
  jugador: string | null;
  detalle: string | null;
}

interface SincronizacionResult {
  nuevos: EventoSalvado[];
  /** Natural keys de los eventos que fueron eliminados (para emitir WS). */
  invalidados: string[];
}

function naturalKey(e: {
  tipo: string;
  minuto: number;
  equipo: string;
  jugador: string | null;
}): string {
  return `${e.tipo}|${e.minuto}|${e.equipo}|${e.jugador ?? ""}`;
}

async function sincronizarEventos(
  partidoId: string,
  fixture: ApiFootballFixture,
  eventosApi: ApiFootballEvent[],
): Promise<SincronizacionResult> {
  const parsed: EventoSalvado[] = [];
  for (const ev of eventosApi) {
    const m = mapEvento(ev, fixture);
    if (!m) continue;
    parsed.push(m);
  }

  // Set de keys que el API ve actualmente.
  const apiKeys = new Set(parsed.map((e) => naturalKey(e)));

  // Trae los eventos que ya están en BD (incluye el id para poder borrar
  // después).
  const existentes = await prisma.eventoPartido.findMany({
    where: { partidoId },
    select: {
      id: true,
      tipo: true,
      minuto: true,
      equipo: true,
      jugador: true,
    },
  });

  const existKeyMap = new Map<string, string>(); // key → id
  for (const e of existentes) {
    existKeyMap.set(naturalKey(e), e.id);
  }

  // Nuevos: API tiene, BD no.
  const nuevos: EventoSalvado[] = parsed.filter(
    (e) => !existKeyMap.has(naturalKey(e)),
  );

  // Invalidados: BD tiene, API NO tiene.
  // Excepción: el evento sintético FIN_PARTIDO lo creamos nosotros al
  // detectar status FT — no viene del API, no debe borrarse cuando el
  // API sigue sin reportarlo.
  const invalidados: Array<{ id: string; key: string }> = [];
  for (const [key, id] of existKeyMap.entries()) {
    if (apiKeys.has(key)) continue;
    if (key.startsWith(`${TIPO_EVENTO.FIN_PARTIDO}|`)) continue;
    invalidados.push({ id, key });
  }

  // Insertar nuevos — si dos pollers corren simultáneo y hay colisión,
  // el índice único atrapa el duplicado (P2002 tolerable).
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
      logger.debug(
        { err, partidoId, ev },
        "[poller] evento ya existente al insertar, skip",
      );
    }
  }

  // Eliminar invalidados — ej. goles anulados por VAR. Si el poller
  // corrió con respuesta vacía el array invalidados puede ser grande;
  // aceptable, el API nos dijo que esos eventos no están.
  if (invalidados.length > 0) {
    try {
      await prisma.eventoPartido.deleteMany({
        where: {
          id: { in: invalidados.map((i) => i.id) },
        },
      });
      logger.info(
        { partidoId, count: invalidados.length },
        "[poller] eventos invalidados eliminados",
      );
    } catch (err) {
      logger.error(
        { err, partidoId, invalidados },
        "[poller] delete de eventos invalidados falló",
      );
    }
  }

  // Si status.short es FT, agregar evento sintético FIN_PARTIDO si no
  // existe. NO llega del API — lo creamos localmente.
  if (mapEstadoPartido(fixture.fixture.status.short) === "FINALIZADO") {
    const finMinuto = fixture.fixture.status.elapsed ?? 90;
    const finKey = `${TIPO_EVENTO.FIN_PARTIDO}|${finMinuto}|NEUTRAL|`;
    if (!existKeyMap.has(finKey)) {
      try {
        await prisma.eventoPartido.create({
          data: {
            partidoId,
            tipo: TIPO_EVENTO.FIN_PARTIDO,
            minuto: finMinuto,
            equipo: "NEUTRAL",
            jugador: null,
            detalle: null,
          },
        });
      } catch {
        // dup tolerable
      }
    }
  }

  return {
    nuevos,
    invalidados: invalidados.map((i) => i.key),
  };
}
