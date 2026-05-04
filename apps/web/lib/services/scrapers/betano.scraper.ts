// Scraper Betano — Lote V.10.1 (May 2026).
//
// Implementación mínima post-limpieza. Betano en HTTP devolvía 403 por
// Cloudflare Bot Management. Playwright pasa el desafío JS de Cloudflare
// como un browser real y navega el sportsbook normalmente.

import { capturarPartidoPorCasa } from "./playwright-scrape";
import { PLAYWRIGHT_CONFIGS } from "./playwright-config";
import type { Scraper } from "./types";

const betanoScraper: Scraper = {
  nombre: "betano",

  async capturarConPlaywright(partido, urlPartidoEnCasa) {
    return capturarPartidoPorCasa(
      "betano",
      partido,
      urlPartidoEnCasa,
      PLAYWRIGHT_CONFIGS,
    );
  },
};

export default betanoScraper;
