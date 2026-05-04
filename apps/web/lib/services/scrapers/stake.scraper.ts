// Scraper Stake — Lote V.10.1 (May 2026).
//
// Implementación mínima post-limpieza: el método `capturarConPlaywright`
// delega al flow genérico `capturarPartidoPorCasa` que navega el
// sportsbook real, busca el partido por texto, extrae cuotas del DOM.
//
// Toda la lógica HTTP-only de los lotes V.1-V.8 (endpoints upcoming,
// parsers de payloads, extractores de eventos) se eliminó porque las
// APIs JSON públicas están todas rotas/bloqueadas y nunca se invocan
// desde el worker (que prefiere Playwright). El flow Playwright es
// agnóstico de liga: la URL del listado por liga vive en
// `playwright-config.ts`.

import { capturarPartidoPorCasa } from "./playwright-scrape";
import { PLAYWRIGHT_CONFIGS } from "./playwright-config";
import type { Scraper } from "./types";

const stakeScraper: Scraper = {
  nombre: "stake",

  async capturarConPlaywright(partido, urlPartidoEnCasa) {
    return capturarPartidoPorCasa(
      "stake",
      partido,
      urlPartidoEnCasa,
      PLAYWRIGHT_CONFIGS,
    );
  },
};

export default stakeScraper;
