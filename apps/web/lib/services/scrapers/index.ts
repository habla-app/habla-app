// Registro central de scrapers del motor de captura de cuotas (Lote V).
//
// Los scrapers concretos viven cada uno en su archivo (`te-apuesto.scraper.ts`,
// `stake.scraper.ts`, `altenar.scraper.ts`). Acá los importamos y los
// registramos en el dispatcher del worker (`cuotas-worker.ts`).
//
// Patrón: el cron en `instrumentation.ts` llama a `registrarScrapersV2()`
// justo después de `iniciarMotorCuotas()`. La fase actual habilita 4 casas
// (Te Apuesto + Stake + Apuesta Total + Doradobet, los dos últimos vía
// el módulo Altenar dual). V.3 agrega Coolbet + Inkabet, V.4 agrega
// Betano. Cada lote sólo TOCA este archivo para sumar su `registrarScraper`.

import { logger } from "../logger";
import { registrarScraper } from "../cuotas-worker";

import teApuestoScraper from "./te-apuesto.scraper";
import stakeScraper from "./stake.scraper";
import { apuestaTotalScraper, doradobetScraper } from "./altenar.scraper";

let yaRegistrados = false;

/**
 * Registra todos los scrapers disponibles en la fase actual del Lote V.
 * Idempotente: segunda llamada no-op (con log debug).
 *
 * Llamado desde `instrumentation.ts` después de `iniciarMotorCuotas()`.
 */
export function registrarScrapersV2(): void {
  if (yaRegistrados) {
    logger.debug({ source: "scrapers:registry" }, "scrapers ya registrados, skip");
    return;
  }
  yaRegistrados = true;

  registrarScraper(teApuestoScraper);
  registrarScraper(stakeScraper);
  registrarScraper(apuestaTotalScraper);
  registrarScraper(doradobetScraper);

  logger.info(
    {
      casas: [
        teApuestoScraper.nombre,
        stakeScraper.nombre,
        apuestaTotalScraper.nombre,
        doradobetScraper.nombre,
      ],
      source: "scrapers:registry",
    },
    "scrapers V.2 registrados",
  );
}

// Re-export para conveniencia (tests, scripts).
export { teApuestoScraper, stakeScraper, apuestaTotalScraper, doradobetScraper };
