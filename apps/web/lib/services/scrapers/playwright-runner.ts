// Runner Playwright común para los 5 scrapers (Lote V.12 — May 2026).
//
// Encapsula el flow shared:
//   1) Abrir page del browser singleton
//   2) Navegar a URL listing de la liga
//   3) Cerrar overlays/cookies + scroll para forzar lazy-load
//   4) Hook por casa para doble nav al detalle (Doradobet click Shadow DOM,
//      Apuesta Total URL detalle derivada de fixture, Inkabet slug-based)
//   5) Capturar todas las XHRs JSON > 500B
//   6) Cerrar la page (browser persiste warm)
//
// Cada scraper invoca `recolectarJsons(...)` con su `dobleNavHook` y
// después corre su parser específico sobre el array de JSONs.

import { logger } from "../logger";
import { obtenerPagina, liberarPagina, type PWPage } from "./browser";
import { obtenerUrlListado } from "./urls-listing";
import type { CasaCuotas } from "./types";
import type { LigaCanonica } from "./ligas-id-map";

export interface JsonCapturado {
  url: string;
  bytes: number;
  body: unknown;
  fase: "listing" | "detalle";
}

export interface DobleNavCtx {
  page: PWPage;
  partido: { equipoLocal: string; equipoVisita: string };
  todosJsons: JsonCapturado[];
  listingUrl: string;
}

export type DobleNavHook = (ctx: DobleNavCtx) => Promise<void>;

const TIMEOUT_GOTO_MS = 35_000;
const ESPERA_POST_LOAD_MS = 8_000;
const MIN_BYTES = 500;
const MAX_JSONS_CAPTURADOS = 100;

/**
 * Recolecta todos los JSONs candidatos navegando la URL listing de la liga
 * + ejecutando opcionalmente un hook de doble nav al detalle.
 *
 * Retorna null si la liga × casa no tiene URL configurada.
 * Lanza Error si la navegación falla por geo-block / timeout / etc.
 */
export async function recolectarJsons(args: {
  casa: CasaCuotas;
  ligaCanonica: LigaCanonica;
  partido: { equipoLocal: string; equipoVisita: string };
  dobleNav?: DobleNavHook;
}): Promise<{ jsons: JsonCapturado[]; listingUrl: string } | null> {
  const { casa, ligaCanonica, partido, dobleNav } = args;
  const listingUrl = obtenerUrlListado(ligaCanonica, casa);
  if (!listingUrl) {
    logger.info(
      { casa, ligaCanonica, source: "scrapers:runner" },
      `${casa}: liga "${ligaCanonica}" sin URL listing — skipea`,
    );
    return null;
  }

  const page = await obtenerPagina();
  const todosJsons: JsonCapturado[] = [];

  const responseListener = (response: any) => {
    try {
      const ct = (response.headers()["content-type"] ?? "").toLowerCase();
      if (!ct.includes("json")) return;
      if (response.status() !== 200) return;
      void (async () => {
        try {
          const text = await response.text();
          if (text.length < MIN_BYTES) return;
          if (todosJsons.length >= MAX_JSONS_CAPTURADOS) return;
          let body: unknown;
          try {
            body = JSON.parse(text);
          } catch {
            return;
          }
          todosJsons.push({
            url: response.url(),
            bytes: text.length,
            body,
            fase: "listing",
          });
        } catch {
          /* ignore */
        }
      })();
    } catch {
      /* ignore */
    }
  };

  page.on("response", responseListener);

  try {
    const t0 = Date.now();
    let navResp: any;
    try {
      navResp = await page.goto(listingUrl, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUT_GOTO_MS,
      });
    } catch (err) {
      throw new Error(`goto falló: ${(err as Error).message}`);
    }
    const status = navResp?.status?.() ?? 0;
    if (status === 403 || status === 451 || status === 0) {
      throw new Error(`goto status ${status}`);
    }

    await page.waitForTimeout(1500);
    await cerrarOverlays(page);
    await page.waitForTimeout(2000);
    await scrollSuave(page);
    await page.waitForTimeout(ESPERA_POST_LOAD_MS);

    if (dobleNav) {
      try {
        await dobleNav({
          page,
          partido,
          todosJsons,
          listingUrl,
        });
      } catch (err) {
        logger.warn(
          { casa, err: (err as Error).message, source: "scrapers:runner" },
          `${casa}: dobleNav falló (no crítico) — sigue con datos del listing`,
        );
      }
    }

    logger.debug(
      {
        casa,
        ligaCanonica,
        ms: Date.now() - t0,
        jsonsCapturados: todosJsons.length,
        source: "scrapers:runner",
      },
      `${casa}: ${todosJsons.length} JSONs capturados en ${Date.now() - t0}ms`,
    );

    return { jsons: todosJsons, listingUrl };
  } finally {
    try {
      page.off("response", responseListener);
    } catch {
      /* ignore */
    }
    await liberarPagina(page);
  }
}

/**
 * Cierra cookie banners + modales de bienvenida defensivamente. Cero
 * dependencia del DOM específico de la casa — usa heurísticas comunes.
 */
async function cerrarOverlays(page: PWPage): Promise<void> {
  try {
    await (page as any).evaluate(() => {
      const norm = (s: string): string =>
        s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim();
      const SELS = [
        "#onetrust-accept-btn-handler",
        'button[id*="accept-cookies" i]',
        'button[id*="aceptar-cookies" i]',
        'button[data-testid*="cookie-accept" i]',
        ".cookie-banner button",
        "#cookies-accept",
        'button[aria-label*="accept all" i]',
        'button[aria-label*="aceptar todas" i]',
      ];
      const TXT = [
        "aceptar todas",
        "aceptar todo",
        "aceptar y continuar",
        "aceptar",
        "accept all",
        "accept",
        "got it",
        "i agree",
        "estoy de acuerdo",
        "entendido",
        "tengo +18",
        "soy mayor de edad",
      ];
      for (const sel of SELS) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetParent !== null) {
          try {
            el.click();
            return;
          } catch {
            /* ignore */
          }
        }
      }
      const botones = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, [role="button"], a.btn, .btn',
        ),
      );
      for (const b of botones) {
        if (b.offsetParent === null) continue;
        if (b.tagName === "A") {
          const href = (b as HTMLAnchorElement).href;
          try {
            const h = new URL(href).host;
            if (h && h !== window.location.host) continue;
          } catch {
            /* relativo */
          }
        }
        const texto = norm(b.textContent ?? "");
        if (!texto || texto.length < 2) continue;
        if (TXT.includes(texto)) {
          try {
            b.click();
            return;
          } catch {
            /* ignore */
          }
        }
      }
    });
  } catch {
    /* ignore */
  }
}

async function scrollSuave(page: PWPage): Promise<void> {
  try {
    await (page as any).evaluate(() => {
      return new Promise<void>((resolve) => {
        let pos = 0;
        const step = 250;
        const id = setInterval(() => {
          window.scrollBy(0, step);
          pos += step;
          const target = Math.max(800, document.body.scrollHeight / 2);
          if (pos >= target) {
            clearInterval(id);
            resolve();
          }
        }, 200);
        setTimeout(() => {
          clearInterval(id);
          resolve();
        }, 2500);
      });
    });
  } catch {
    /* ignore */
  }
}

// ─── Helpers compartidos para parsers ────────────────────────────────

export function priceOk(v: unknown): number | null {
  return typeof v === "number" && v > 1 && v < 100 ? v : null;
}

export function norm(s: string | undefined | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
