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
  // Cada intento (éxito o fallo) inserta un row en `BackupLog`, que
  // alimenta el check de `/api/health` y la página `/admin/backup/historial`.
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
  // Job J — Cierre del leaderboard mensual (Lote 5). Tick cada 1h. Sólo
  // corre cuando es día 1 del mes en hora Lima y la hora local es ≥01:00.
  // La idempotencia real está en el service (`cerrarLeaderboard` chequea
  // `cerradoEn` antes de tocar nada) — el guard de hora/día sólo evita
  // queries innecesarias.
  //
  // Después del cierre, manda email a cada ganador del top 10 vía
  // `notifyPremioMensualGanado` (sin throttle — son ≤10 envíos).
  // -------------------------------------------------------------------
  const { cerrarLeaderboard } = await import(
    "./lib/services/leaderboard.service"
  );
  const { notifyPremioMensualGanado } = await import(
    "./lib/services/notificaciones.service"
  );
  const { diaDelMesEnTimezone, horaEnTimezone, getMesAnteriorKey } = await import(
    "./lib/utils/datetime"
  );

  const LEADERBOARD_TICK_INTERVAL_MS = 60 * 60 * 1000; // 1h

  async function tickCierreLeaderboardMensual() {
    try {
      const now = new Date();
      const dia = diaDelMesEnTimezone(now);
      const hora = horaEnTimezone(now);

      // Sólo correr el día 1 después de 01:00 hora Lima. El resto del mes
      // este tick es no-op puro.
      if (dia !== 1 || hora < 1) return;

      const mesAnterior = getMesAnteriorKey(now);
      const result = await cerrarLeaderboard({ mes: mesAnterior });

      if (result.alreadyClosed) return;

      logger.info(
        {
          mes: mesAnterior,
          totalUsuarios: result.totalUsuarios,
          premios: result.premiosCreados.length,
        },
        "[cron in-process] leaderboard mensual cerrado",
      );

      for (const premio of result.premiosCreados) {
        await notifyPremioMensualGanado(premio);
      }
    } catch (err) {
      logger.error(
        { err },
        "[cron in-process] tick de cierre-leaderboard-mensual falló",
      );
    }
  }

  // Primera corrida 90s tras boot — deja al sistema estabilizarse y a los
  // jobs A/D/H tomar su primer tick. Si el día 1 cae con el container ya
  // arriba, este 90s es trivial. Si arranca el día 1 a las 00:30 Lima,
  // la primera corrida cae fuera de la ventana (hora<1) y no hace nada;
  // el segundo tick (90s + 1h ≈ 01:31) ya entra.
  setTimeout(() => {
    void tickCierreLeaderboardMensual();
    setInterval(() => {
      void tickCierreLeaderboardMensual();
    }, LEADERBOARD_TICK_INTERVAL_MS);
  }, 90_000);

  // -------------------------------------------------------------------
  // Job M — Alertas de errores críticos (Lote 6). Tick cada 1h. Si en
  // la última hora hubo > 0 rows en `log_errores` con level='critical',
  // manda un email a ADMIN_ALERT_EMAIL con resumen (top 5 mensajes +
  // counts por source).
  //
  // Anti-spam: variable en memoria del proceso. Si el proceso reinicia
  // (deploy), el contador se resetea — peor caso es 1 alerta extra al
  // restart si justo había críticos. Aceptable para mantener el código
  // simple (el alternativo era persistir un row "estado-alerta" en BD,
  // overkill).
  // -------------------------------------------------------------------
  const { obtenerResumenCriticosUltimaHora } = await import(
    "./lib/services/logs.service"
  );
  const { notifyCriticosResumen } = await import(
    "./lib/services/notificaciones.service"
  );

  const CRITICOS_TICK_INTERVAL_MS = 60 * 60 * 1000; // 1h
  const CRITICOS_ANTISPAM_MS = 60 * 60 * 1000; // 1h entre alertas
  const cronStateGlobal = globalThis as unknown as {
    __hablaUltimaAlertaCriticosAt?: number;
  };

  async function tickCriticosUltimaHora() {
    try {
      if (!process.env.ADMIN_ALERT_EMAIL) return; // sin destinatario, skip

      const ahora = Date.now();
      const ultima = cronStateGlobal.__hablaUltimaAlertaCriticosAt ?? 0;
      if (ahora - ultima < CRITICOS_ANTISPAM_MS) return;

      const resumen = await obtenerResumenCriticosUltimaHora();
      if (resumen.total === 0) return;

      const ventana = `${resumen.desde.toISOString().slice(11, 16)}–${resumen.hasta
        .toISOString()
        .slice(11, 16)} UTC`;
      await notifyCriticosResumen({
        ventana,
        total: resumen.total,
        topMensajes: resumen.topMensajes,
        porSource: resumen.porSource,
      });
      cronStateGlobal.__hablaUltimaAlertaCriticosAt = ahora;

      logger.info(
        {
          total: resumen.total,
          topCount: resumen.topMensajes.length,
          source: "cron:criticos",
        },
        "[cron in-process] alerta de críticos enviada",
      );
    } catch (err) {
      // SOURCE clave: "cron:criticos" — el hook del logger lo persiste
      // como error en log_errores. NO inicia loop porque sólo sería
      // crítico si fuera fatal(60); error(50) no entra al funnel.
      logger.error(
        { err, source: "cron:criticos" },
        "[cron in-process] tick de alerta-críticos falló",
      );
    }
  }

  // Primera corrida 120s tras boot — deja al sistema estabilizarse y a
  // que cualquier crítico que dispare el primer minuto del deploy ya
  // esté indexado.
  setTimeout(() => {
    void tickCriticosUltimaHora();
    setInterval(() => {
      void tickCriticosUltimaHora();
    }, CRITICOS_TICK_INTERVAL_MS);
  }, 120_000);

  // -------------------------------------------------------------------
  // Jobs F (vencimiento Lukas) y G (auditoría de balances) se removieron
  // en Lote 2 cuando se demolió el sistema de Lukas. Job I (auditoría
  // contable) se removió en Lote 4 cuando se demolió el aparato contable.
  // -------------------------------------------------------------------

  logger.info(
    {
      cerrarTorneos: `${CERRAR_INTERVAL_MS / 1000}s`,
      importPartidos: `${INTERVALO_IMPORT_MS / 1000 / 60}min`,
      refreshSeasons: `${INTERVALO_REFRESH_SEASONS_MS / 1000 / 3600}h`,
      pollerPartidos: `${POLLER_INTERVAL_MS / 1000}s`,
      backupDiario: `${BACKUP_TICK_INTERVAL_MS / 1000 / 60}min (target ${BACKUP_TARGET_LIMA_HOUR}:00 PET)`,
      cierreLeaderboardMensual: `${LEADERBOARD_TICK_INTERVAL_MS / 1000 / 60}min (día 1 ≥01:00 PET)`,
      alertaCriticos: `${CRITICOS_TICK_INTERVAL_MS / 1000 / 60}min (anti-spam ${CRITICOS_ANTISPAM_MS / 1000 / 60}min)`,
    },
    "cron in-process registrado",
  );
}
