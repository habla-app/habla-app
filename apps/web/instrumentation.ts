// Next.js instrumentation hook — corre una sola vez cuando arranca el
// servidor (https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
//
// Lo usamos para registrar jobs scheduled INSIDE el server process en
// lugar de depender de un cron externo (cron-job.org, GitHub Actions,
// Railway Cron). Railway corre el contenedor Next.js 24/7, así que un
// setInterval dentro del proceso funciona perfecto y nos deja granularidad
// hasta milisegundos si hiciera falta (ej. Sub-Sprint 5 poller cada 30s).
//
// CAVEAT: si en el futuro escalamos el servicio web a más de 1 réplica en
// Railway (horizontal scaling), cada réplica ejecutaría su propio
// interval → doble trabajo + race conditions. Dos soluciones cuando
// llegue ese punto:
//   (a) Mover estos jobs a un servicio Railway dedicado con replicas=1.
//   (b) Agregar un "cron leader lock" en Redis (SET NX con TTL 50s).
// Para MVP con 1 réplica basta con lo de abajo.

export async function register() {
  // `register()` corre en Node y en Edge. Los servicios que tocan Prisma
  // y DB sólo tienen sentido en Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { procesarCierreAutomatico } = await import(
    "./lib/services/torneos.service"
  );
  const { importarPartidosTodasLasLigas } = await import(
    "./lib/services/partidos-import.service"
  );
  const { refreshAllSeasons } = await import(
    "./lib/services/seasons.cache"
  );
  const { INTERVALO_IMPORT_MS, INTERVALO_REFRESH_SEASONS_MS } = await import(
    "./lib/config/ligas"
  );
  const { logger } = await import("./lib/services/logger");

  // Guard para evitar registrar los intervals más de una vez (en dev HMR
  // puede reevaluar este módulo; en prod sólo corre una vez, pero el
  // guard no duele).
  const g = globalThis as unknown as { __hablaCronRegistered?: boolean };
  if (g.__hablaCronRegistered) {
    logger.debug("cron in-process ya registrado, skip");
    return;
  }
  g.__hablaCronRegistered = true;

  // -------------------------------------------------------------------
  // Job A — Cerrar torneos (cada 1 min). El más crítico: cierreAt
  // exacto es regla de negocio.
  // -------------------------------------------------------------------
  const CERRAR_INTERVAL_MS = 60_000;

  async function tickCerrarTorneos() {
    try {
      const result = await procesarCierreAutomatico();
      if (result.cerrados.length > 0 || result.cancelados.length > 0) {
        logger.info(
          {
            cerrados: result.cerrados.length,
            cancelados: result.cancelados.length,
          },
          "[cron in-process] ciclo cerrar-torneos",
        );
      }
    } catch (err) {
      logger.error({ err }, "[cron in-process] fallo al cerrar torneos");
    }
  }

  setTimeout(() => {
    void tickCerrarTorneos();
    setInterval(() => {
      void tickCerrarTorneos();
    }, CERRAR_INTERVAL_MS);
  }, 10_000);

  // -------------------------------------------------------------------
  // Job B — Refresh de temporadas activas (al arrancar + cada 24h).
  // Llena el cache de seasons.cache.ts para que el import no tenga que
  // resolver la season en cada corrida.
  // -------------------------------------------------------------------
  refreshAllSeasons().catch((err) =>
    logger.error({ err }, "[cron in-process] refresh inicial de seasons falló"),
  );
  setInterval(() => {
    refreshAllSeasons().catch((err) =>
      logger.error(
        { err },
        "[cron in-process] refresh periódico de seasons falló",
      ),
    );
  }, INTERVALO_REFRESH_SEASONS_MS);

  // -------------------------------------------------------------------
  // Job C — Import de partidos + torneos (30s después del boot, luego
  // cada 6h). Trae ventana de hoy+14d para cada liga whitelisteada y
  // crea torneos idempotentes.
  // -------------------------------------------------------------------
  async function tickImportPartidos() {
    try {
      const resultados = await importarPartidosTodasLasLigas();
      const totales = resultados.reduce(
        (acc, r) => ({
          partidosCreados: acc.partidosCreados + r.partidosCreados,
          partidosActualizados:
            acc.partidosActualizados + r.partidosActualizados,
          torneosCreados: acc.torneosCreados + r.torneosCreados,
          errores: acc.errores + r.errores,
        }),
        {
          partidosCreados: 0,
          partidosActualizados: 0,
          torneosCreados: 0,
          errores: 0,
        },
      );
      logger.info(
        { ligas: resultados.length, ...totales },
        "[cron in-process] ciclo import-partidos",
      );
    } catch (err) {
      logger.error(
        { err },
        "[cron in-process] fallo catastrófico import-partidos",
      );
    }
  }

  setTimeout(() => {
    void tickImportPartidos();
    setInterval(() => {
      void tickImportPartidos();
    }, INTERVALO_IMPORT_MS);
  }, 30_000);

  // -------------------------------------------------------------------
  // Job D — Poller de partidos en vivo (Sub-Sprint 5). Corre cada 30s.
  // Llama api-football para partidos EN_VIVO o PROGRAMADO <15min,
  // upsertea eventos, recalcula tickets y emite por Socket.io.
  // -------------------------------------------------------------------
  const { pollerTick, POLLER_INTERVAL_MS } = await import(
    "./lib/services/poller-partidos.job"
  );

  async function tickPollerPartidos() {
    try {
      await pollerTick();
    } catch (err) {
      logger.error({ err }, "[cron in-process] tick del poller falló");
    }
  }

  // Primera corrida 15s tras boot (para que el server esté listo y la
  // instancia de Socket.io ya registrada por server.ts).
  setTimeout(() => {
    void tickPollerPartidos();
    setInterval(() => {
      void tickPollerPartidos();
    }, POLLER_INTERVAL_MS);
  }, 15_000);

  logger.info(
    {
      cerrarTorneos: `${CERRAR_INTERVAL_MS / 1000}s`,
      importPartidos: `${INTERVALO_IMPORT_MS / 1000 / 60}min`,
      refreshSeasons: `${INTERVALO_REFRESH_SEASONS_MS / 1000 / 3600}h`,
      pollerPartidos: `${POLLER_INTERVAL_MS / 1000}s`,
    },
    "cron in-process registrado",
  );
}
