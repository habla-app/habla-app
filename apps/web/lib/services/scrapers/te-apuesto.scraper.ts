// Scraper Te Apuesto — Lote V.10.1 (May 2026).
//
// Implementación mínima post-limpieza. Te Apuesto en HTTP requería
// `tournament_id` por liga + `language_id` (V.8.3) y aun así devolvía
// 422 / cambiaba el endpoint. Playwright navega el sportsbook real.

import { capturarPartidoPorCasa } from "./playwright-scrape";
import { PLAYWRIGHT_CONFIGS } from "./playwright-config";
import type { Scraper } from "./types";

const teApuestoScraper: Scraper = {
  nombre: "te_apuesto",

  async capturarConPlaywright(partido, urlPartidoEnCasa) {
    return capturarPartidoPorCasa(
      "te_apuesto",
      partido,
      urlPartidoEnCasa,
      PLAYWRIGHT_CONFIGS,
    );
  },
};

export default teApuestoScraper;
