// Servicio orquestador del discovery automático de eventIds externos
// para el motor de captura de cuotas — Lote V fase V.6 (May 2026).
//
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 5.1 (discovery automático)
// + el comentario en captura-cuotas.service.ts líneas 9-12 que reconoce que
// el discovery "llega en V.5". V.5 lo dejó cableado a nivel de scraper
// individual (cada scraper tiene `buscarEventIdExterno`) pero ninguna capa
// orquestadora invoca a las 7 casas para un partido dado. Este servicio
// cierra ese hueco.
//
// API pública:
//   - `ejecutarDiscoveryParaPartido(partidoId, opciones?)`: itera las 7
//     casas en paralelo, persiste los eventIds resueltos en
//     `EventIdExterno` con `metodoDiscovery="AUTOMATICO"`, respetando
//     siempre las filas existentes con `metodoDiscovery="MANUAL"`.
//
// Reglas de coexistencia:
//   1. MANUAL gana siempre. Si una fila ya existe con MANUAL, este servicio
//      NUNCA la pisa (ni en el filtro inicial ni en el upsert final).
//   2. AUTOMATICO previo se respeta por default (skipea la casa). Con la
//      opción `forzarRedescubrimiento=true` se re-ejecuta el scraper y se
//      pisa el AUTOMATICO viejo con el nuevo (útil si la tabla AliasEquipo
//      se enriqueció o si el partido fue pospuesto y la casa republicó).
//   3. El scraper retorna `null` cuando no encuentra match único — la casa
//      queda "sin resolver" y debe vincularse manualmente desde admin.
//   4. El scraper puede lanzar Error (red caída, endpoint cambiado, etc.).
//      Atrapamos con `Promise.allSettled` para que un fallo aislado no
//      contamine las otras 6 casas.
//
// Sin imports cíclicos: este servicio importa de scrapers + prisma + logger.
// `captura-cuotas.service.ts` importa de éste pero no al revés.

import { prisma } from "@habla/db";
import { logger } from "./logger";
import { CUOTAS_CONFIG } from "../config/cuotas";
import type { CasaCuotas, Scraper } from "./scrapers/types";
import {
  teApuestoScraper,
  stakeScraper,
  apuestaTotalScraper,
  doradobetScraper,
  coolbetScraper,
  inkabetScraper,
  betanoScraper,
} from "./scrapers";

const SCRAPERS_POR_CASA: Record<CasaCuotas, Scraper> = {
  stake: stakeScraper,
  apuesta_total: apuestaTotalScraper,
  coolbet: coolbetScraper,
  doradobet: doradobetScraper,
  betano: betanoScraper,
  inkabet: inkabetScraper,
  te_apuesto: teApuestoScraper,
};

/**
 * Timeout máximo por scraper. Cada scraper internamente tiene su propio
 * timeout HTTP (~8s) y puede probar varios endpoints. 20s cubre el caso
 * de 2-3 endpoints encadenados antes de rendirse.
 */
const TIMEOUT_DISCOVERY_POR_CASA_MS = 20_000;

export interface ResumenDiscoveryCasaResuelta {
  casa: CasaCuotas;
  eventIdExterno: string;
}

export interface ResumenDiscoveryCasaFallida {
  casa: CasaCuotas;
  error: string;
}

export interface ResumenDiscovery {
  partidoId: string;
  resueltas: ResumenDiscoveryCasaResuelta[];
  sinResolver: CasaCuotas[];
  fallidas: ResumenDiscoveryCasaFallida[];
  /** Casas que ya tenían MANUAL (no se ejecutó el scraper). */
  skipeadasPorManual: CasaCuotas[];
  /** Casas que ya tenían AUTOMATICO y se skipearon por default. */
  skipeadasPorAutomaticoPrevio: CasaCuotas[];
}

export interface OpcionesDiscovery {
  /**
   * Si true, re-ejecuta el scraper incluso para casas que ya tienen un
   * eventId AUTOMATICO previo. MANUAL se respeta siempre, sin importar
   * este flag.
   */
  forzarRedescubrimiento?: boolean;
}

/**
 * Promesa con timeout. Si la promesa original cumple antes, devuelve su
 * valor. Si no, rechaza con `Error` que indica timeout.
 */
function conTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: timeout tras ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Ejecuta el discovery automático para un partido sobre las 7 casas.
 *
 * Flujo:
 *   1. Lee el partido y los EventIdExterno ya guardados.
 *   2. Filtra las casas a procesar respetando MANUAL (siempre) y
 *      AUTOMATICO previo (a menos que `forzarRedescubrimiento=true`).
 *   3. Llama a `scraper.buscarEventIdExterno(partido)` en paralelo con
 *      `Promise.allSettled` y timeout por casa.
 *   4. Para cada eventId no-null, hace upsert en `EventIdExterno` con
 *      `metodoDiscovery="AUTOMATICO"`, dentro de transacción que verifica
 *      que la fila no haya sido marcada MANUAL entre el filtro y el upsert
 *      (race condition mínima entre admin manual + discovery en flight).
 *   5. Loggea el resumen y lo retorna.
 */
export async function ejecutarDiscoveryParaPartido(
  partidoId: string,
  opciones: OpcionesDiscovery = {},
): Promise<ResumenDiscovery> {
  // Lectura completa del Partido: el contrato `Scraper.buscarEventIdExterno`
  // exige el tipo Prisma `Partido`. No usamos `select` parcial.
  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
  });
  if (!partido) {
    logger.warn(
      { partidoId, source: "discovery-cuotas" },
      "ejecutarDiscoveryParaPartido — partido no existe, skip",
    );
    return {
      partidoId,
      resueltas: [],
      sinResolver: [],
      fallidas: [],
      skipeadasPorManual: [],
      skipeadasPorAutomaticoPrevio: [],
    };
  }

  const eventIdsExistentes = await prisma.eventIdExterno.findMany({
    where: { partidoId },
    select: { casa: true, metodoDiscovery: true },
  });
  const metodoPorCasa = new Map<string, string>(
    eventIdsExistentes.map((row) => [row.casa, row.metodoDiscovery]),
  );

  const skipeadasPorManual: CasaCuotas[] = [];
  const skipeadasPorAutomaticoPrevio: CasaCuotas[] = [];
  const casasParaDescubrir: CasaCuotas[] = [];

  for (const casa of CUOTAS_CONFIG.CASAS) {
    const metodo = metodoPorCasa.get(casa);
    if (metodo === "MANUAL") {
      skipeadasPorManual.push(casa);
      continue;
    }
    if (metodo === "AUTOMATICO" && !opciones.forzarRedescubrimiento) {
      skipeadasPorAutomaticoPrevio.push(casa);
      continue;
    }
    casasParaDescubrir.push(casa);
  }

  // Lote V.7.1: log de inicio con contexto del partido. Permite ver de un
  // vistazo qué partido + qué casas quedaron para descubrir.
  logger.info(
    {
      partidoId,
      liga: partido.liga,
      equipoLocal: partido.equipoLocal,
      equipoVisita: partido.equipoVisita,
      fechaInicio: partido.fechaInicio,
      casasParaDescubrir,
      skipeadasPorManual,
      skipeadasPorAutomaticoPrevio,
      source: "discovery-cuotas",
    },
    `discovery iniciando · ${partido.equipoLocal} vs ${partido.equipoVisita} (${partido.liga}) · ${casasParaDescubrir.length} casas a probar`,
  );

  // Lote V.7.1: instrumentamos cada scraper individualmente con tiempo +
  // resultado. Permite diagnosticar en producción si un scraper termina
  // instantáneo (catch interno silencioso, sin HTTP) vs tardó N segundos
  // (hizo HTTP pero el matcher no encontró match único). El log se emite
  // a INFO para que sea visible sin cambiar nivel global de logger.
  const resultados = await Promise.allSettled(
    casasParaDescubrir.map(async (casa) => {
      const scraper = SCRAPERS_POR_CASA[casa];
      const tInicio = Date.now();
      let eventId: string | null = null;
      let errorRecogido: string | null = null;
      try {
        eventId = await conTimeout(
          scraper.buscarEventIdExterno(partido),
          TIMEOUT_DISCOVERY_POR_CASA_MS,
          `discovery:${casa}`,
        );
        return { casa, eventId };
      } catch (err) {
        errorRecogido =
          err instanceof Error
            ? err.message
            : String(err ?? "error desconocido");
        throw err;
      } finally {
        const ms = Date.now() - tInicio;
        const resumen =
          errorRecogido !== null
            ? `error tras ${ms}ms: ${errorRecogido.slice(0, 120)}`
            : eventId === null || eventId === ""
              ? `sin match (${ms}ms)`
              : `match ${eventId} (${ms}ms)`;
        logger.info(
          {
            casa,
            partidoId: partido.id,
            ms,
            resultado:
              errorRecogido !== null
                ? "error"
                : eventId === null || eventId === ""
                  ? "null"
                  : "found",
            eventId: eventId ?? null,
            errorRecogido,
            source: "discovery-cuotas:scraper",
          },
          `discovery scraper ${casa}: ${resumen}`,
        );
      }
    }),
  );

  const resueltas: ResumenDiscoveryCasaResuelta[] = [];
  const sinResolver: CasaCuotas[] = [];
  const fallidas: ResumenDiscoveryCasaFallida[] = [];

  resultados.forEach((res, idx) => {
    const casa = casasParaDescubrir[idx];
    if (!casa) return;
    if (res.status === "fulfilled") {
      const { eventId } = res.value;
      if (eventId === null || eventId === undefined || eventId === "") {
        sinResolver.push(casa);
      } else {
        resueltas.push({ casa, eventIdExterno: String(eventId) });
      }
    } else {
      const errMsg =
        res.reason instanceof Error
          ? res.reason.message
          : String(res.reason ?? "error desconocido");
      fallidas.push({ casa, error: errMsg.slice(0, 300) });
      logger.warn(
        {
          partidoId,
          casa,
          err: errMsg,
          source: "discovery-cuotas",
        },
        "discovery — scraper falló para casa",
      );
    }
  });

  for (const { casa, eventIdExterno } of resueltas) {
    try {
      await prisma.$transaction(async (tx) => {
        const existente = await tx.eventIdExterno.findUnique({
          where: { partidoId_casa: { partidoId, casa } },
        });
        if (existente?.metodoDiscovery === "MANUAL") {
          // Race condition rara: alguien marcó MANUAL entre el filtro y
          // este punto. Respetamos.
          return;
        }
        await tx.eventIdExterno.upsert({
          where: { partidoId_casa: { partidoId, casa } },
          create: {
            partidoId,
            casa,
            eventIdExterno,
            metodoDiscovery: "AUTOMATICO",
          },
          update: {
            eventIdExterno,
            metodoDiscovery: "AUTOMATICO",
            resueltoEn: new Date(),
          },
        });
      });
    } catch (err) {
      // Si el upsert falla, lo movemos al bucket de fallidas para que el
      // resumen lo refleje. No abortamos el resto.
      const errMsg =
        err instanceof Error ? err.message : String(err ?? "upsert falló");
      logger.error(
        { partidoId, casa, err: errMsg, source: "discovery-cuotas" },
        "discovery — upsert de EventIdExterno falló",
      );
      // Quitar de resueltas y mover a fallidas.
      const idx = resueltas.findIndex((r) => r.casa === casa);
      if (idx >= 0) resueltas.splice(idx, 1);
      fallidas.push({ casa, error: `upsert: ${errMsg.slice(0, 250)}` });
    }
  }

  // Lote V.7.1: incluimos el resumen humano-legible en el `msg` para que
  // sea visible en Railway sin drill-down a structured fields.
  const resumenMsg = `discovery completado · ${resueltas.length} resueltas · ${sinResolver.length} sin resolver · ${fallidas.length} fallidas · ${skipeadasPorManual.length} manual · ${skipeadasPorAutomaticoPrevio.length} auto-previo`;
  logger.info(
    {
      partidoId,
      resueltas: resueltas.map((r) => r.casa),
      sinResolver,
      fallidas: fallidas.map((f) => f.casa),
      fallidasErrores: fallidas.map((f) => ({ casa: f.casa, error: f.error })),
      skipeadasPorManual,
      skipeadasPorAutomaticoPrevio,
      forzado: opciones.forzarRedescubrimiento === true,
      source: "discovery-cuotas",
    },
    resumenMsg,
  );

  return {
    partidoId,
    resueltas,
    sinResolver,
    fallidas,
    skipeadasPorManual,
    skipeadasPorAutomaticoPrevio,
  };
}
