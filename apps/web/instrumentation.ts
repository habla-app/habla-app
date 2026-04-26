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

  // -------------------------------------------------------------------
  // Job E — Backup diario de Postgres a R2 (Lote 7). Tick cada hora;
  // dispara el backup si (a) hoy no hay backup exitoso aún y (b) la
  // hora UTC actual es >= 03:00 (= 22:00 PET, ventana de bajo tráfico).
  // -------------------------------------------------------------------
  const {
    runBackup,
    isR2Configured,
    getBackupState,
    hydrateBackupStateFromR2,
  } = await import("./lib/services/backup.service");

  // Hidratar el state al boot para que un container restart no aparezca
  // como "missing" en /api/health si ayer hubo backup ok.
  if (isR2Configured()) {
    hydrateBackupStateFromR2().catch((err) =>
      logger.warn({ err }, "[cron in-process] hydrate backup state falló"),
    );
  }

  const BACKUP_TICK_INTERVAL_MS = 60 * 60 * 1000; // 1h
  const BACKUP_TARGET_UTC_HOUR = 3; // 03:00 UTC = 22:00 PET

  async function tickBackupDb() {
    try {
      if (!isR2Configured()) return; // nada que hacer si no hay R2
      const s = getBackupState();
      const now = new Date();
      // Bucket "hoy UTC".
      const todayStartMs = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      );
      if (s.lastSuccessAt && s.lastSuccessAt.getTime() >= todayStartMs) {
        return; // ya backupeamos hoy
      }
      // Ventana objetivo: 03:00 UTC en adelante. Si el container arranca
      // a las 05:00 UTC, el primer tick (≤1h) lo dispara igual.
      if (now.getUTCHours() < BACKUP_TARGET_UTC_HOUR) return;

      logger.info("[cron in-process] disparando backup-db");
      const result = await runBackup();
      if (result.ok) {
        logger.info(
          { key: result.key, sizeBytes: result.sizeBytes, durationMs: result.durationMs },
          "[cron in-process] backup-db exitoso",
        );
      } else {
        logger.warn(
          { reason: result.reason },
          "[cron in-process] backup-db falló",
        );
      }
    } catch (err) {
      logger.error({ err }, "[cron in-process] tick de backup-db falló");
    }
  }

  // Primera corrida 60s tras boot (deja al sistema estabilizarse), luego
  // cada hora. Si ya backupeamos hoy o no es la ventana, el tick es no-op.
  setTimeout(() => {
    void tickBackupDb();
    setInterval(() => {
      void tickBackupDb();
    }, BACKUP_TICK_INTERVAL_MS);
  }, 60_000);

  // -------------------------------------------------------------------
  // Job F — Vencimiento de Lukas (Lote 6A). Tick cada hora; skip si
  // ya corrió en las últimas 23h (lógica interna del job).
  // -------------------------------------------------------------------
  const { vencimientoLukasJob } = await import(
    "./lib/services/vencimiento-lukas.job"
  );

  const VENCIMIENTO_TICK_INTERVAL_MS = 60 * 60 * 1000; // 1h

  async function tickVencimientoLukas() {
    try {
      await vencimientoLukasJob();
    } catch (err) {
      logger.error({ err }, "[cron in-process] tick vencimiento-lukas falló");
    }
  }

  // Primera corrida 90s tras boot para no solapar con otros jobs del boot.
  setTimeout(() => {
    void tickVencimientoLukas();
    setInterval(() => {
      void tickVencimientoLukas();
    }, VENCIMIENTO_TICK_INTERVAL_MS);
  }, 90_000);

  // -------------------------------------------------------------------
  // Job G — Auditoría diaria de balances (Lote 6C-fix3). Tick cada hora;
  // skip si ya corrió en las últimas 23h. Si encuentra hallazgos error,
  // envía email al admin (ADMIN_ALERT_EMAIL).
  // -------------------------------------------------------------------
  const { auditarTodos } = await import(
    "./lib/services/auditoria-balances.service"
  );
  const { enviarAlertaAuditoria } = await import(
    "./lib/services/notificaciones.service"
  );

  const AUDIT_TICK_INTERVAL_MS = 60 * 60 * 1000; // 1h
  const AUDIT_MIN_BETWEEN_RUNS_MS = 23 * 60 * 60 * 1000; // 23h
  let lastAuditAt: Date | null = null;

  async function tickAuditoriaBalances() {
    try {
      const now = new Date();
      if (
        lastAuditAt &&
        now.getTime() - lastAuditAt.getTime() < AUDIT_MIN_BETWEEN_RUNS_MS
      ) {
        return; // ya corrió en las últimas 23h
      }
      const reporte = await auditarTodos();
      lastAuditAt = now;

      const errors = reporte.hallazgos.filter((h) => h.severidad === "error");
      const warns = reporte.hallazgos.filter((h) => h.severidad === "warn");

      if (errors.length === 0 && warns.length === 0) {
        logger.info(
          {
            usuariosAuditados: reporte.totales.usuariosAuditados,
            torneosAuditados: reporte.totales.torneosAuditados,
            durationMs: reporte.durationMs,
          },
          "[cron in-process] auditoría diaria: ✅ todo OK",
        );
        return;
      }

      // Hay hallazgos — log + email solo si hay errors (warns no satura).
      logger.warn(
        {
          totalHallazgos: reporte.totalHallazgos,
          errors: errors.length,
          warns: warns.length,
          usuariosConProblemas: reporte.usuariosConProblemas,
          torneosConProblemas: reporte.torneosConProblemas,
        },
        "[cron in-process] auditoría diaria: hallazgos detectados",
      );

      if (errors.length > 0) {
        await enviarAlertaAuditoria({
          scaneadoEn: reporte.scaneadoEn,
          totalHallazgos: reporte.totalHallazgos,
          hallazgosError: errors.length,
          hallazgosWarn: warns.length,
          usuariosConProblemas: reporte.usuariosConProblemas,
          torneosConProblemas: reporte.torneosConProblemas,
          topHallazgos: reporte.hallazgos.map((h) => ({
            invariante: h.invariante,
            severidad: h.severidad,
            username: h.username,
            torneoId: h.torneoId,
            mensaje: h.mensaje,
          })),
          invariantes: reporte.invariantes.map((i) => ({
            codigo: i.codigo,
            nombre: i.nombre,
            ok: i.ok,
            fallidos: i.fallidos,
          })),
        });
      }
    } catch (err) {
      logger.error({ err }, "[cron in-process] tick auditoría-balances falló");
    }
  }

  // Primera corrida 120s tras boot. Después corre cada hora pero la lógica
  // interna skipea si ya corrió en las últimas 23h.
  setTimeout(() => {
    void tickAuditoriaBalances();
    setInterval(() => {
      void tickAuditoriaBalances();
    }, AUDIT_TICK_INTERVAL_MS);
  }, 120_000);

  logger.info(
    {
      cerrarTorneos: `${CERRAR_INTERVAL_MS / 1000}s`,
      importPartidos: `${INTERVALO_IMPORT_MS / 1000 / 60}min`,
      refreshSeasons: `${INTERVALO_REFRESH_SEASONS_MS / 1000 / 3600}h`,
      pollerPartidos: `${POLLER_INTERVAL_MS / 1000}s`,
      backupDb: `${BACKUP_TICK_INTERVAL_MS / 1000 / 60}min (target ${BACKUP_TARGET_UTC_HOUR}:00 UTC)`,
      vencimientoLukas: `${VENCIMIENTO_TICK_INTERVAL_MS / 1000 / 60}min (skip si <23h)`,
      auditoriaBalances: `${AUDIT_TICK_INTERVAL_MS / 1000 / 60}min (skip si <23h, email a ADMIN_ALERT_EMAIL)`,
    },
    "cron in-process registrado",
  );
}
