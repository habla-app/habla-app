// Scrapers Altenar (Apuesta Total + Doradobet) — Lote V.10.1 (May 2026).
//
// Apuesta Total y Doradobet usan el mismo backend Altenar. En HTTP eso
// se reflejaba en un único módulo dual con configuración por operador.
// En Playwright cada uno navega su propio sportsbook (apuestatotal.com
// y doradobet.com) — la URL del listado por liga vive en
// `playwright-config.ts` y el flow es idéntico al de las otras casas.

import { capturarPartidoPorCasa } from "./playwright-scrape";
import { PLAYWRIGHT_CONFIGS } from "./playwright-config";
import type { Scraper } from "./types";

export const apuestaTotalScraper: Scraper = {
  nombre: "apuesta_total",

  async capturarConPlaywright(partido, urlPartidoEnCasa) {
    return capturarPartidoPorCasa(
      "apuesta_total",
      partido,
      urlPartidoEnCasa,
      PLAYWRIGHT_CONFIGS,
    );
  },
};

export const doradobetScraper: Scraper = {
  nombre: "doradobet",

  async capturarConPlaywright(partido, urlPartidoEnCasa) {
    return capturarPartidoPorCasa(
      "doradobet",
      partido,
      urlPartidoEnCasa,
      PLAYWRIGHT_CONFIGS,
    );
  },
};
