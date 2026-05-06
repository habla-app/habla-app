// Registro central de scrapers del motor de captura de cuotas (Lote V.12).
//
// Lote V.12 (May 2026): motor con Playwright headless + interceptación XHR.
//   - 6 scrapers que cargan la página de la liga en cada casa con
//     Chromium headless y capturan los JSONs que el frontend pide.
//   - Doradobet incluido en el flow universal (uniformidad).
//   - Stake removido (queda como referencia en scripts/validacion-geo/).

import { logger } from "../logger";
import { registrarScraper } from "../cuotas-worker";

import doradobetScraper from "./doradobet.scraper";
import apuestaTotalScraper from "./apuesta-total.scraper";
import coolbetScraper from "./coolbet.scraper";
import betanoScraper from "./betano.scraper";
import inkabetScraper from "./inkabet.scraper";
import teApuestoScraper from "./te-apuesto.scraper";

let yaRegistrados = false;

/**
 * Registra los 6 scrapers del Lote V.12 (Playwright + XHR intercept).
 * Idempotente: segunda llamada no-op (con log debug). Llamado desde
 * `instrumentation.ts` después de `iniciarMotorCuotas()`.
 */
export function registrarScrapersV2(): void {
  if (yaRegistrados) {
    logger.debug({ source: "scrapers:registry" }, "scrapers ya registrados, skip");
    return;
  }
  yaRegistrados = true;

  registrarScraper(doradobetScraper);
  registrarScraper(apuestaTotalScraper);
  registrarScraper(coolbetScraper);
  registrarScraper(betanoScraper);
  registrarScraper(inkabetScraper);
  registrarScraper(teApuestoScraper);

  logger.info(
    {
      casas: [
        doradobetScraper.nombre,
        apuestaTotalScraper.nombre,
        coolbetScraper.nombre,
        betanoScraper.nombre,
        inkabetScraper.nombre,
        teApuestoScraper.nombre,
      ],
      source: "scrapers:registry",
    },
    "scrapers V.12 (Playwright + XHR intercept) registrados (6 casas)",
  );
}

// Re-export para conveniencia (tests, scripts).
export {
  doradobetScraper,
  apuestaTotalScraper,
  coolbetScraper,
  betanoScraper,
  inkabetScraper,
  teApuestoScraper,
};
