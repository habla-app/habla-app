// Registro central de scrapers del motor de captura de cuotas (Lote V.11).
//
// Lote V.11 (May 2026): reescritura del motor a API-only.
//   - 6 scrapers HTTP directos contra APIs B2B de los proveedores.
//   - Stake removido (queda como referencia en scripts/validacion-geo/).
//   - Cero Playwright. Cero browser headless.

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
 * Registra los 6 scrapers API del Lote V.11. Idempotente: segunda
 * llamada no-op (con log debug). Llamado desde `instrumentation.ts`
 * después de `iniciarMotorCuotas()`.
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
    "scrapers V.11 API-only registrados (6 casas)",
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
