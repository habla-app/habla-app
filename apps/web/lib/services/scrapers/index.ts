// Registro central de scrapers del motor de captura de cuotas (Lote V).
//
// Los scrapers concretos viven cada uno en su archivo. Acá los importamos
// y los registramos en el dispatcher del worker (`cuotas-worker.ts`).
//
// Patrón: el cron en `instrumentation.ts` llama a `registrarScrapersV2()`
// justo después de `iniciarMotorCuotas()`. Cada fase del Lote V suma sus
// scrapers a este registry sin tocar el worker:
//   - V.2 ✅ Te Apuesto + Stake + Apuesta Total + Doradobet (Altenar dual)
//   - V.3 ✅ Coolbet + Inkabet
//   - V.4    Betano (dual API + Playwright)
//
// El nombre de la función se mantiene `registrarScrapersV2` por
// compatibilidad con `instrumentation.ts` — al cerrar V.4 se renombra
// a `registrarScrapers` o se mantiene como alias.

import { logger } from "../logger";
import { registrarScraper } from "../cuotas-worker";

import teApuestoScraper from "./te-apuesto.scraper";
import stakeScraper from "./stake.scraper";
import { apuestaTotalScraper, doradobetScraper } from "./altenar.scraper";
import coolbetScraper from "./coolbet.scraper";
import inkabetScraper from "./inkabet.scraper";

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
  registrarScraper(coolbetScraper);
  registrarScraper(inkabetScraper);

  logger.info(
    {
      casas: [
        teApuestoScraper.nombre,
        stakeScraper.nombre,
        apuestaTotalScraper.nombre,
        doradobetScraper.nombre,
        coolbetScraper.nombre,
        inkabetScraper.nombre,
      ],
      source: "scrapers:registry",
    },
    "scrapers V.2 + V.3 registrados",
  );
}

// Re-export para conveniencia (tests, scripts).
export {
  teApuestoScraper,
  stakeScraper,
  apuestaTotalScraper,
  doradobetScraper,
  coolbetScraper,
  inkabetScraper,
};
