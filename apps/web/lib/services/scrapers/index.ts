// Registro central de scrapers del motor de captura de cuotas (Lote V.12).
//
// 5 scrapers Playwright + XHR intercept:
//   - doradobet (Altenar — click Shadow DOM al detalle)
//   - apuesta_total (Kambi — URL detalle derivada del fixture)
//   - betano (Danae — listing per-event)
//   - inkabet (Octonovus — slug-based double nav)
//   - te_apuesto (Coreix — listing único)
//
// Coolbet removido (WAF Imperva), Stake removido (aliases cortos).

import { logger } from "../logger";
import { registrarScraper } from "../cuotas-worker";

import doradobetScraper from "./doradobet.scraper";
import apuestaTotalScraper from "./apuesta-total.scraper";
import betanoScraper from "./betano.scraper";
import inkabetScraper from "./inkabet.scraper";
import teApuestoScraper from "./te-apuesto.scraper";

let yaRegistrados = false;

/**
 * Registra los 5 scrapers del Lote V.12 (Playwright + XHR intercept).
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
  registrarScraper(betanoScraper);
  registrarScraper(inkabetScraper);
  registrarScraper(teApuestoScraper);

  logger.info(
    {
      casas: [
        doradobetScraper.nombre,
        apuestaTotalScraper.nombre,
        betanoScraper.nombre,
        inkabetScraper.nombre,
        teApuestoScraper.nombre,
      ],
      source: "scrapers:registry",
    },
    "scrapers V.12 (Playwright + XHR intercept) registrados (5 casas)",
  );
}

// Re-export para conveniencia (tests, scripts).
export {
  doradobetScraper,
  apuestaTotalScraper,
  betanoScraper,
  inkabetScraper,
  teApuestoScraper,
};
