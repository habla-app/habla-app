// Scraper Coolbet — Lote V.10.1 (May 2026).
//
// Implementación mínima post-limpieza. Coolbet en su versión HTTP tenía
// WAF Imperva activo + warmup obligatorio + endpoint complejo. Todo eso
// se eliminó porque Playwright pasa el WAF como cualquier browser real.
// El flow genérico `capturarPartidoPorCasa` resuelve discovery + captura.

import { capturarPartidoPorCasa } from "./playwright-scrape";
import { PLAYWRIGHT_CONFIGS } from "./playwright-config";
import type { Scraper } from "./types";

const coolbetScraper: Scraper = {
  nombre: "coolbet",

  async capturarConPlaywright(partido, urlPartidoEnCasa) {
    return capturarPartidoPorCasa(
      "coolbet",
      partido,
      urlPartidoEnCasa,
      PLAYWRIGHT_CONFIGS,
    );
  },
};

export default coolbetScraper;
