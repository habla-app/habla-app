// Scraper Inkabet — Lote V.10.1 (May 2026).
//
// Implementación mínima post-limpieza. Inkabet en HTTP devolvía 400 con
// "Internal Error" a todos los endpoints probados. Playwright navega el
// SPA hash-based real (`/pe/apuestas-deportivas#sport/...`) y resuelve.

import { capturarPartidoPorCasa } from "./playwright-scrape";
import { PLAYWRIGHT_CONFIGS } from "./playwright-config";
import type { Scraper } from "./types";

const inkabetScraper: Scraper = {
  nombre: "inkabet",

  async capturarConPlaywright(partido, urlPartidoEnCasa) {
    return capturarPartidoPorCasa(
      "inkabet",
      partido,
      urlPartidoEnCasa,
      PLAYWRIGHT_CONFIGS,
    );
  },
};

export default inkabetScraper;
