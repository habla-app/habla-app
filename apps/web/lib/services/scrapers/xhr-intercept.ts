// Interceptor de XHR genérico (Lote V.12.2 — May 2026, observabilidad rica).
//
// Idea: cargar una URL en Chromium headless y escuchar TODAS las
// responses HTTP. El browser hace solo el descubrimiento de endpoints
// (cuando el JS de la SPA pide cuotas via fetch/XHR, lo capturamos).
//
// V.12.2 agrega manejo defensivo de:
//   - Status HTTP del goto + URL final (detectar redirects de geo-block)
//   - Title de la página (detectar Cloudflare/Imperva/Akamai challenges)
//   - Cookie banners + modales de bienvenida (cerrar safe — sin clickear
//     enlaces tipo Twitter X que rompieron el scraper en el pasado).
//   - Scroll suave para disparar lazy-load.
//   - Espera extendida para SPAs lentas.
//   - Cuando 0 candidatos, log con muestra de las primeras URLs (xhr/fetch)
//     para entender qué pidió la página realmente.
//
// Filtros de candidato a "JSON con cuotas":
//   - status 200 + Content-Type contiene `json`
//   - body parseable como JSON
//   - body string > 800 bytes
//   - body contiene al menos uno de los keywords de cuotas

import { logger } from "../logger";
import { obtenerPagina, liberarPagina, type PWPage } from "./browser";

const KEYWORDS_CUOTAS_DEFAULT = [
  "TrueOdds",
  "decimalOdds",
  "DisplayOdds",
  '"odds"',
  '"price"',
  '"value"',
  "selections",
  "market_odds",
  "outcomes",
  "Selections",
  "Markets",
  "competitors",
  "marketIds",
  "events",
];

const TIMEOUT_DEFAULT_MS = 35_000;
const ESPERA_POST_LOAD_MS = 8_000;
const ESPERA_TRAS_OVERLAYS_MS = 2_000;
const MIN_BODY_BYTES = 800;

// Patrones en el title que indican bloqueo / challenge.
const TITLE_BLOQUEOS = [
  /just a moment/i,
  /checking your browser/i,
  /access denied/i,
  /forbidden/i,
  /403/,
  /attention required/i,
  /security check/i,
  /cloudflare/i,
  /sorry, you have been blocked/i,
  /no disponible en tu pa/i, // "no disponible en tu país"
  /not available in your region/i,
];

export interface JsonCapturado {
  url: string;
  status: number;
  body: unknown;
  bodyText: string;
  bytes: number;
  keywordsMatched: string[];
  ms: number;
}

export interface InterceptOpts {
  /** Timeout total del navegación + intercepción. Default 35s. */
  timeoutMs?: number;
  /** Espera adicional tras `domcontentloaded` para que JS dispare XHRs. Default 8s. */
  esperaPostLoadMs?: number;
  /** Keywords case-sensitive en el body para considerarlo candidato. */
  keywords?: string[];
  /** Filtro adicional opcional sobre URL. */
  predicateUrl?: (url: string) => boolean;
  /** `source` para logs Pino. */
  source?: string;
}

/**
 * Carga `url` en Chromium headless con manejo defensivo de overlays,
 * scroll para lazy-load, y detección de bloqueos. Devuelve los JSONs
 * candidatos a "respuesta de cuotas".
 */
export async function capturarJsonsConCuotas(
  url: string,
  opts: InterceptOpts = {},
): Promise<JsonCapturado[]> {
  const {
    timeoutMs = TIMEOUT_DEFAULT_MS,
    esperaPostLoadMs = ESPERA_POST_LOAD_MS,
    keywords = KEYWORDS_CUOTAS_DEFAULT,
    predicateUrl,
    source = "scrapers:xhr-intercept",
  } = opts;

  const tInicio = Date.now();
  const candidatos: JsonCapturado[] = [];
  const todasUrls: string[] = []; // sample para diagnóstico
  let totalResponses = 0;

  const page: PWPage = await obtenerPagina();

  const listener = (response: {
    url(): string;
    status(): number;
    headers(): Record<string, string>;
    text(): Promise<string>;
    ok(): boolean;
  }) => {
    totalResponses += 1;
    const respUrl = response.url();
    if (todasUrls.length < 20) todasUrls.push(respUrl);
    if (predicateUrl && !predicateUrl(respUrl)) return;
    if (!response.ok() || response.status() !== 200) return;
    const ct = (response.headers()["content-type"] ?? "").toLowerCase();
    if (!ct.includes("json")) return;

    void (async () => {
      try {
        const text = await response.text();
        if (text.length < MIN_BODY_BYTES) return;
        const matched = keywords.filter((k) => text.includes(k));
        if (matched.length === 0) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return;
        }
        candidatos.push({
          url: respUrl,
          status: response.status(),
          body: parsed,
          bodyText: text,
          bytes: text.length,
          keywordsMatched: matched,
          ms: Date.now() - tInicio,
        });
      } catch {
        // Body unavailable.
      }
    })();
  };

  page.on("response", listener);

  // ─── Navegación + diagnóstico ──────────────────────────────────────
  let gotoStatus: number | null = null;
  let gotoMs = 0;
  let finalUrl = url;
  let title = "";
  let blockedSignals: string[] = [];
  let overlaysAcciones: string[] = [];
  let scrollOk = false;

  try {
    const tGoto = Date.now();
    const navResp = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    gotoMs = Date.now() - tGoto;
    if (navResp && typeof (navResp as { status?: () => number }).status === "function") {
      gotoStatus = (navResp as { status: () => number }).status();
    }
    finalUrl = page.url();
    try {
      title = (await page.evaluate<string>(() => document.title ?? "")) ?? "";
    } catch {
      title = "";
    }
    blockedSignals = detectarBloqueos(title, url, finalUrl);

    logger.info(
      {
        url,
        finalUrl,
        gotoStatus,
        gotoMs,
        title: title.slice(0, 120),
        redirected: finalUrl !== url,
        blockedSignals,
        source,
      },
      `xhr-intercept goto · status=${gotoStatus ?? "?"} · ${gotoMs}ms · title="${title.slice(0, 60)}"${blockedSignals.length > 0 ? ` · BLOQUEADO=[${blockedSignals.join(",")}]` : ""}${finalUrl !== url ? ` · REDIRECT=${finalUrl}` : ""}`,
    );

    // ─── Cerrar overlays (cookies + modales) ─────────────────────────
    // Espera mínima para que el banner aparezca (suele entrar en <1s tras DOM).
    await page.waitForTimeout(1_500);
    overlaysAcciones = await cerrarOverlays(page);
    if (overlaysAcciones.length > 0) {
      logger.info(
        {
          acciones: overlaysAcciones,
          source,
        },
        `xhr-intercept overlays · ${overlaysAcciones.length} cerrados: ${overlaysAcciones.slice(0, 4).join(" | ")}`,
      );
    }
    await page.waitForTimeout(ESPERA_TRAS_OVERLAYS_MS);

    // ─── Scroll suave para disparar lazy-load ────────────────────────
    try {
      await page.evaluate(() => {
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
          // Hard cap por si la página crece infinitamente.
          setTimeout(() => {
            clearInterval(id);
            resolve();
          }, 2_500);
        });
      });
      scrollOk = true;
    } catch {
      scrollOk = false;
    }

    // ─── Espera final para que llegue todo el lazy-load ──────────────
    await page.waitForTimeout(esperaPostLoadMs);
  } catch (err) {
    logger.warn(
      {
        url,
        finalUrl,
        gotoStatus,
        title: title.slice(0, 120),
        err: (err as Error).message,
        ms: Date.now() - tInicio,
        candidatosHasta: candidatos.length,
        totalResponsesHasta: totalResponses,
        source,
      },
      `xhr-intercept: navegación falló — devolviendo candidatos parciales`,
    );
  } finally {
    page.off("response", listener);
    await liberarPagina(page);
  }

  const ms = Date.now() - tInicio;

  // ─── Log final con diagnóstico defensivo ────────────────────────────
  const candidatosDetalle = candidatos.map((c) => ({
    url: c.url,
    bytes: c.bytes,
    keywords: c.keywordsMatched,
  }));

  if (candidatos.length === 0) {
    // Cuando no hay candidatos, exponemos las primeras 10 URLs de
    // responses para entender qué pidió la página (útil para detectar si
    // la SPA cargó pero no disparó los XHRs de cuotas).
    logger.warn(
      {
        url,
        finalUrl,
        gotoStatus,
        title: title.slice(0, 120),
        blockedSignals,
        overlaysCerrados: overlaysAcciones.length,
        scrollOk,
        ms,
        totalResponses,
        sampleUrls: todasUrls.slice(0, 10),
        source,
      },
      `xhr-intercept · 0 candidatos en ${ms}ms (${totalResponses} responses totales)${blockedSignals.length > 0 ? ` · BLOQUEADO=[${blockedSignals.join(",")}]` : ""}`,
    );
  } else {
    logger.info(
      {
        url,
        finalUrl,
        gotoStatus,
        title: title.slice(0, 120),
        blockedSignals,
        overlaysCerrados: overlaysAcciones.length,
        scrollOk,
        ms,
        totalResponses,
        candidatos: candidatos.length,
        candidatosDetalle: candidatosDetalle.slice(0, 8),
        source,
      },
      `xhr-intercept · ${candidatos.length} candidatos en ${ms}ms (${totalResponses} responses)${overlaysAcciones.length > 0 ? ` · overlays=${overlaysAcciones.length}` : ""}`,
    );
  }

  return candidatos;
}

// ─── Detección de bloqueos ──────────────────────────────────────────

function detectarBloqueos(
  title: string,
  urlOriginal: string,
  finalUrl: string,
): string[] {
  const signals: string[] = [];
  for (const pat of TITLE_BLOQUEOS) {
    if (pat.test(title)) {
      signals.push(`title:${pat.source.slice(0, 30)}`);
      break;
    }
  }
  // Cambio de dominio en redirect = posible geo-block o login wall.
  try {
    const o = new URL(urlOriginal).host;
    const f = new URL(finalUrl).host;
    if (o !== f) signals.push(`redirect:${f}`);
  } catch {
    // URL malformada, ignoramos
  }
  // URLs con keywords de challenge.
  if (/\/challenge\/|\/captcha|\/cdn-cgi\/challenge/.test(finalUrl)) {
    signals.push("url:challenge");
  }
  return signals;
}

// ─── Cerrar overlays (cookies + modales) ─────────────────────────────
//
// El user reportó previamente que el scraper de Stake clickeó un link
// "X" del footer que abrió Twitter (x.com/PeruStake) → bug. Este helper
// es defensivo:
//   - Acepta cookies sólo por selectores conocidos + textos largos
//     ("Aceptar todas", "Got it", etc.) — NUNCA texto corto como "X".
//   - Cierra modales sólo via aria-label="close|cerrar" y SÓLO si el
//     elemento NO es un <a> a otro dominio + es visible.
//   - Símbolos × ✕ ✗ se permiten (Unicode, no ambiguos con Twitter).

async function cerrarOverlays(page: PWPage): Promise<string[]> {
  try {
    return await page.evaluate(() => {
      const acciones: string[] = [];

      // Texto a normalizar.
      const norm = (s: string): string =>
        s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim();

      // Selectores específicos de cookie banners conocidos.
      const SELECTORES_COOKIES = [
        "#onetrust-accept-btn-handler",
        'button[id*="accept-cookies" i]',
        'button[id*="aceptar-cookies" i]',
        'button[data-testid*="cookie-accept" i]',
        '[data-cy="cookie-accept"]',
        ".cookie-banner button",
        "#cookies-accept",
        'button[aria-label*="accept all" i]',
        'button[aria-label*="aceptar todas" i]',
        'button[aria-label*="aceptar todo" i]',
      ];

      // Textos completos (>=4 chars) que indican aceptación de
      // cookies/modales/edad. Largos para evitar matches ambiguos.
      const TEXTOS_ACEPTAR = [
        "aceptar todas",
        "aceptar todas las cookies",
        "aceptar todo",
        "aceptar y continuar",
        "aceptar",
        "accept all",
        "accept all cookies",
        "accept",
        "got it",
        "i agree",
        "estoy de acuerdo",
        "entendido",
        "continuar",
        "tengo +18",
        "soy mayor de edad",
        "mayor de edad",
        "yes, i am 18+",
        "permitir todas",
      ];

      // Símbolos de cierre de modal (Unicode, NO la letra X latina).
      const SIMBOLOS_CIERRE = ["×", "✕", "✗", "✖"];

      // 1) Probar selectores conocidos primero.
      for (const sel of SELECTORES_COOKIES) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetParent !== null) {
          try {
            el.click();
            acciones.push(`sel:${sel.slice(0, 40)}`);
            return acciones; // un solo accept es suficiente
          } catch {
            /* ignore */
          }
        }
      }

      // 2) Probar botones por texto.
      const botones = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, [role="button"], a.btn, .btn',
        ),
      );
      for (const b of botones) {
        if (b.offsetParent === null) continue; // invisible
        // Defensivo: si es <a> con href cross-origin, NO clickear.
        if (b.tagName === "A") {
          const href = (b as HTMLAnchorElement).href;
          try {
            const h = new URL(href).host;
            if (h && h !== window.location.host) continue;
          } catch {
            /* href relativo, OK */
          }
        }
        const texto = norm(b.textContent ?? "");
        if (!texto || texto.length < 2) continue;
        if (TEXTOS_ACEPTAR.includes(texto)) {
          try {
            b.click();
            acciones.push(`txt:${texto.slice(0, 30)}`);
            return acciones;
          } catch {
            /* ignore */
          }
        }
      }

      // 3) Cerrar modales via aria-label (close/cerrar) o símbolos
      //    Unicode. NUNCA por texto "X" (puede ser Twitter / link).
      const cerrables = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[aria-label*="close" i], [aria-label*="cerrar" i], [aria-label*="dismiss" i], [data-dismiss="modal"]',
        ),
      );
      for (const el of cerrables) {
        if (el.offsetParent === null) continue;
        if (el.tagName === "A") {
          const href = (el as HTMLAnchorElement).href;
          try {
            const h = new URL(href).host;
            if (h && h !== window.location.host) continue;
          } catch {
            /* relativo, OK */
          }
        }
        try {
          el.click();
          const lbl =
            el.getAttribute("aria-label") ??
            el.getAttribute("data-dismiss") ??
            "";
          acciones.push(`close:${lbl.slice(0, 30)}`);
          // Cerrar sólo el primero — múltiples clicks pueden romper layout.
          break;
        } catch {
          /* ignore */
        }
      }

      // 4) Si el primer hijo de un [role=dialog] es un botón con símbolo
      //    de cierre Unicode, clickearlo.
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="dialog"], dialog, .modal',
        ),
      );
      for (const d of dialogs) {
        if (d.offsetParent === null) continue;
        const candidatos = Array.from(
          d.querySelectorAll<HTMLElement>('button, [role="button"]'),
        );
        for (const c of candidatos) {
          if (c.offsetParent === null) continue;
          const t = (c.textContent ?? "").trim();
          if (SIMBOLOS_CIERRE.includes(t)) {
            try {
              c.click();
              acciones.push(`unicode:${t}`);
              break;
            } catch {
              /* ignore */
            }
          }
        }
      }

      return acciones;
    });
  } catch {
    return [];
  }
}
