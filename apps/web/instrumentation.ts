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
  // Job H — Backup diario de Postgres a R2 (Lote 7). Tick cada hora;
  // dispara el backup si (a) hoy no hay backup exitoso aún y (b) la
  // hora local Lima cae en la ventana objetivo (04:00 PET = 09:00 UTC).
  //
  // Auto-monitoreo: cada intento (éxito o fallo) inserta un row en
  // `BackupLog`. Si los últimos 2 fallaron consecutivos, el service
  // dispara email al `ADMIN_ALERT_EMAIL` vía notifyBackupFallo.
  // -------------------------------------------------------------------
  const { ejecutarBackupDiario, isR2Configured, ultimoExitoso } = await import(
    "./lib/services/backup-r2.service"
  );

  const BACKUP_TICK_INTERVAL_MS = 60 * 60 * 1000; // 1h
  const BACKUP_TARGET_LIMA_HOUR = 4; // 04:00 PET (= 09:00 UTC)

  // Hora actual en zona Lima usando Intl (Lima es UTC-5 sin DST).
  function horaLima(d: Date): number {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Lima",
      hour: "numeric",
      hour12: false,
    });
    return Number(fmt.format(d));
  }

  async function tickBackupDiario() {
    try {
      if (!isR2Configured()) return; // nada que hacer si no hay R2 configurado
      const now = new Date();

      // Skip si ya backupeamos exitosamente hoy (UTC). Esto evita doble
      // ejecución por hora dentro de la misma jornada.
      const todayStartMs = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      );
      const last = await ultimoExitoso();
      if (last && last.fechaIntento.getTime() >= todayStartMs) {
        return;
      }

      // Ventana objetivo: hora Lima >= 4. Si el container arrancó tarde
      // (digamos 06:00 Lima), el primer tick lo dispara igual porque
      // hora >= 4.
      if (horaLima(now) < BACKUP_TARGET_LIMA_HOUR) return;

      logger.info("[cron in-process] disparando backup-diario");
      const result = await ejecutarBackupDiario();
      if (result.ok) {
        logger.info(
          {
            archivo: result.archivo,
            archivoMensual: result.archivoMensual,
            bytes: result.bytes,
            durationMs: result.durationMs,
          },
          "[cron in-process] backup-diario exitoso",
        );
      } else {
        logger.warn(
          { error: result.error },
          "[cron in-process] backup-diario falló (ver BackupLog)",
        );
      }
    } catch (err) {
      logger.error({ err }, "[cron in-process] tick de backup-diario falló");
    }
  }

  // Primera corrida 60s tras boot (deja al sistema estabilizarse), luego
  // cada hora. Si ya backupeamos hoy o no es la ventana, el tick es no-op.
  setTimeout(() => {
    void tickBackupDiario();
    setInterval(() => {
      void tickBackupDiario();
    }, BACKUP_TICK_INTERVAL_MS);
  }, 60_000);

  // -------------------------------------------------------------------
  // Job F (vencimiento Lukas) y Job G (auditoría de balances) se
  // removieron en Lote 2 (Abr 2026) cuando se demolió el sistema de
  // Lukas. La auditoría contable (Job I) se queda — mismo timing que
  // antes (primera corrida 120s, tick 1h, skip si <23h).
  // -------------------------------------------------------------------

  const AUDIT_TICK_INTERVAL_MS = 60 * 60 * 1000; // 1h

  // -------------------------------------------------------------------
  // Job I — Auditoría contable (Lote 8). Persiste resultado en
  // AuditoriaContableLog. Si los últimos 2 rows muestran hallazgos
  // `error` consecutivos, dispara email al ADMIN_ALERT_EMAIL.
  // -------------------------------------------------------------------
  const { ejecutarAuditoria } = await import(
    "./lib/services/auditoria-contable.service"
  );
  const { notifyAuditoriaContable } = await import(
    "./lib/services/notificaciones.service"
  );

  let lastAuditContableAt: Date | null = null;
  const AUDIT_CONTABLE_MIN_BETWEEN_RUNS_MS = 23 * 60 * 60 * 1000;

  async function tickAuditoriaContable() {
    try {
      const now = new Date();
      if (
        lastAuditContableAt &&
        now.getTime() - lastAuditContableAt.getTime() <
          AUDIT_CONTABLE_MIN_BETWEEN_RUNS_MS
      ) {
        return;
      }
      const reporte = await ejecutarAuditoria();
      lastAuditContableAt = now;

      // Persistir en BD para historial.
      const { prisma } = await import("@habla/db");
      await prisma.auditoriaContableLog.create({
        data: {
          ok: reporte.ok,
          totalHallazgos: reporte.totalHallazgos,
          errores: reporte.errores,
          warns: reporte.warns,
          resumen: {
            scaneadoEn: reporte.scaneadoEn,
            durationMs: reporte.durationMs,
            hallazgos: reporte.hallazgos.slice(0, 50),
            totales: reporte.totales,
          } as unknown as object,
        },
      });

      if (reporte.ok && reporte.warns === 0) {
        logger.info(
          { durationMs: reporte.durationMs, totales: reporte.totales },
          "[cron in-process] auditoría contable: ✅ todo OK",
        );
        return;
      }

      logger.warn(
        {
          errores: reporte.errores,
          warns: reporte.warns,
          totalHallazgos: reporte.totalHallazgos,
        },
        "[cron in-process] auditoría contable: hallazgos",
      );

      // Si hay errors, decidir si emitimos email (regla "2 fallos consecutivos").
      if (reporte.errores > 0) {
        const ultimos = await prisma.auditoriaContableLog.findMany({
          orderBy: { fechaIntento: "desc" },
          take: 2,
        });
        const dosSeguidos = ultimos.length === 2 && ultimos.every((r) => r.errores > 0);
        if (dosSeguidos) {
          await notifyAuditoriaContable({
            scaneadoEn: reporte.scaneadoEn,
            totalHallazgos: reporte.totalHallazgos,
            errores: reporte.errores,
            warns: reporte.warns,
            hallazgos: reporte.hallazgos.map((h) => ({
              codigo: h.codigo,
              severidad: h.severidad,
              mensaje: h.mensaje,
            })),
          });
        }
      }
    } catch (err) {
      logger.error(
        { err },
        "[cron in-process] tick auditoría-contable falló",
      );
    }
  }

  // Mismo timing exacto que Job G — primera corrida 120s tras boot.
  setTimeout(() => {
    void tickAuditoriaContable();
    setInterval(() => {
      void tickAuditoriaContable();
    }, AUDIT_TICK_INTERVAL_MS);
  }, 120_000);

  logger.info(
    {
      cerrarTorneos: `${CERRAR_INTERVAL_MS / 1000}s`,
      importPartidos: `${INTERVALO_IMPORT_MS / 1000 / 60}min`,
      refreshSeasons: `${INTERVALO_REFRESH_SEASONS_MS / 1000 / 3600}h`,
      pollerPartidos: `${POLLER_INTERVAL_MS / 1000}s`,
      backupDiario: `${BACKUP_TICK_INTERVAL_MS / 1000 / 60}min (target ${BACKUP_TARGET_LIMA_HOUR}:00 PET, email a ADMIN_ALERT_EMAIL si 2 fallos)`,
      auditoriaContable: `${AUDIT_TICK_INTERVAL_MS / 1000 / 60}min (skip si <23h)`,
    },
    "cron in-process registrado",
  );
}
