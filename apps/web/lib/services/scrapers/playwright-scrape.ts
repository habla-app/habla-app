// Flow genérico de scraping con Playwright para los 7 scrapers
// (Lote V.9 — May 2026).
//
// La premisa: en lugar de hablar con la API JSON de cada casa (que cambia,
// se bloquea por WAF, o requiere parámetros que descubrir), navegamos la
// página real como un browser y extraemos las cuotas del DOM. Replica el
// approach que validamos manualmente con Claude Cowork — cada casa tiene
// un sportsbook accesible para humanos, y desde adentro las cuotas son
// visibles.
//
// Flujo común a las 7 casas:
//   1. Navegar a la URL del listado de la liga (ej. liga 1 de Stake).
//   2. Esperar render del SPA (networkidle o selector).
//   3. Buscar el partido por texto: encontrar el elemento que contenga
//      AMBOS nombres de equipo (con normalización + fuzzy si falta).
//   4. Click en el elemento → la casa carga la página de mercados.
//   5. Esperar render.
//   6. Leer cuotas por heurística de proximidad a labels (1, X, 2, +2.5,
//      Sí, etc.) extrayendo números decimales del DOM.
//   7. Retornar resultado uniforme para que el worker lo persista.
//
// Lo que NO hace este módulo:
//   - Selectores DOM específicos por casa. Cada casa tiene su propio HTML.
//     Si la heurística genérica no alcanza, la `CasaPlaywrightConfig` por
//     casa puede sobreescribir las funciones de `buscar` o `extraer`.
//
// Memoria/CPU:
//   - Asset blocking (image/font/media/css) ya aplicado por
//     `crearPagePlaywright` → bandwidth ~70% menor.
//   - Reusamos `page` para listado + detalle: un partido se navega en una
//     sola page (open → goto listado → click partido → leer → close).
//   - Concurrencia limitada a 3 capturas simultáneas (config en cuotas).

import { logger } from "../logger";
import {
  crearPagePlaywright,
  liberarPagePlaywright,
  type PlaywrightPage,
} from "./playwright-browser";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type {
  CasaCuotas,
  CuotasCapturadas,
  ResultadoScraper,
} from "./types";
import { CapturaSinDatosError } from "./types";

// ─── Configuración por casa ────────────────────────────────────────────

export interface CasaPlaywrightConfig {
  /**
   * URL del listado de partidos para la liga dada. Devuelve null si la
   * combinación casa+liga no está mapeada todavía (la casa NO la cubre o
   * no descubrimos su URL aún) — en ese caso skipeamos la captura para
   * esa casa silenciosamente.
   *
   * El admin puede ampliar esta función agregando ramas para más ligas
   * (Premier, La Liga, etc.) sin tocar el resto del scraper.
   */
  urlListado(liga: string): string | null;

  /**
   * Si la casa requiere un selector específico para esperar a que el
   * listado de partidos esté renderizado (ej. SPA que tarda en hidratar),
   * declararlo acá. Si null, usamos networkidle como heurística general.
   */
  selectorListadoListo?: string;

  /**
   * Tiempo máximo que esperamos a que el listado cargue, en ms.
   * Default 25s (incluye SPA + WAF interstitials de Cloudflare/Imperva).
   */
  timeoutListadoMs?: number;

  /**
   * Tiempo máximo total para capturar un partido (listado + click +
   * detalle + lectura). Default 60s.
   */
  timeoutTotalMs?: number;

  /**
   * Override de la búsqueda de partido por texto. Si una casa publica los
   * partidos con un wrapper específico, esto puede ser más eficiente que
   * la heurística genérica.
   */
  buscarPartidoEnListado?(
    page: PlaywrightPage,
    equipoLocal: string,
    equipoVisita: string,
  ): Promise<{ clicked: boolean; href?: string } | null>;

  /**
   * Override de extracción de cuotas. Por defecto usamos la heurística
   * genérica `extraerCuotasGenerico`.
   */
  extraerCuotas?(page: PlaywrightPage): Promise<CuotasCapturadas>;
}

const TIMEOUT_LISTADO_DEFAULT_MS = 25_000;
const TIMEOUT_TOTAL_DEFAULT_MS = 60_000;

// ─── Heurística genérica de búsqueda de partido ────────────────────────

/**
 * Recorre todos los elementos del DOM y busca el más pequeño que contenga
 * AMBOS nombres de equipo. Usa similitud Jaro-Winkler para tolerar variantes.
 *
 * Estrategia:
 *   1. Normalizar texto del DOM (lowercase + sin acentos).
 *   2. Iterar elementos visibles (filtra `display: none`).
 *   3. Para cada uno, ver si contiene ambos equipos (exacto o fuzzy).
 *   4. Quedarse con el de menor texto (más específico, menos noise).
 *   5. Click en él (o el ancestro clickeable más cercano).
 *
 * Ejecutado vía `page.evaluate` para correr en el contexto del browser.
 * Devuelve `{ clicked: boolean, href?: string }`:
 *   - `clicked = true` si pudo hacer click y se navegó.
 *   - `href` si encontró un anchor con URL del partido (para metadata).
 */
async function buscarPartidoGenerico(
  page: PlaywrightPage,
  equipoLocal: string,
  equipoVisita: string,
): Promise<{ clicked: boolean; href?: string } | null> {
  // El page.evaluate corre en el browser context, sin acceso a las funciones
  // del módulo. Pasamos los strings como argumentos y reimplementamos un
  // matching simple inline. La similitud completa se hace en server side
  // post-evaluate si encontramos varios candidatos.
  const candidatos: { texto: string; href: string | null; bbox: number; index: number }[] =
    await page.evaluate(
      ({ local, visita }: { local: string; visita: string }) => {
        function normalizar(s: string): string {
          return s
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
        const tokensLocal = normalizar(local).split(" ").filter((t) => t.length >= 3);
        const tokensVisita = normalizar(visita).split(" ").filter((t) => t.length >= 3);
        if (tokensLocal.length === 0 || tokensVisita.length === 0) return [];

        function tieneAlmenosUno(tokens: string[], texto: string): boolean {
          for (const t of tokens) {
            if (texto.includes(t)) return true;
          }
          return false;
        }

        const out: {
          texto: string;
          href: string | null;
          bbox: number;
          index: number;
        }[] = [];
        const elementos = document.querySelectorAll("a, [role='link'], [data-event-id], [data-match-id], li, article, div");
        let idx = 0;
        for (const el of Array.from(elementos)) {
          if (!(el instanceof HTMLElement)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 20 || rect.height < 20) continue;
          const texto = normalizar(el.innerText ?? el.textContent ?? "");
          if (texto.length < 6 || texto.length > 600) continue;
          if (!tieneAlmenosUno(tokensLocal, texto)) continue;
          if (!tieneAlmenosUno(tokensVisita, texto)) continue;
          // Tomamos el más pequeño = más específico.
          const href =
            el instanceof HTMLAnchorElement
              ? el.href
              : (el.querySelector("a") as HTMLAnchorElement | null)?.href ?? null;
          out.push({
            texto: texto.slice(0, 200),
            href,
            bbox: rect.width * rect.height,
            index: idx,
          });
          idx++;
          if (idx >= 200) break;
        }
        return out;
      },
      { local: equipoLocal, visita: equipoVisita },
    );

  if (candidatos.length === 0) {
    return null;
  }

  // Ordenar por bbox ascendente (más específico primero).
  candidatos.sort((a, b) => a.bbox - b.bbox);
  // Re-ranking server-side por similitud: el primero que tenga score
  // alto en ambos lados gana.
  const tokensLocalNorm = normalizar(equipoLocal);
  const tokensVisitaNorm = normalizar(equipoVisita);
  let mejorIdx = 0;
  let mejorScore = 0;
  for (let i = 0; i < Math.min(candidatos.length, 30); i++) {
    const c = candidatos[i]!;
    const sLocal = similitudEquipos(c.texto, tokensLocalNorm);
    const sVisita = similitudEquipos(c.texto, tokensVisitaNorm);
    const score = Math.min(sLocal, sVisita);
    if (score > mejorScore) {
      mejorScore = score;
      mejorIdx = i;
    }
  }

  const elegido = candidatos[mejorIdx]!;
  const href = elegido.href ?? undefined;

  // Click en el elemento elegido. Si tiene href, podemos navegar directo
  // — más confiable que click (evita pop-ups, ad layers, etc.).
  if (href) {
    try {
      await page.goto(href, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      });
      return { clicked: true, href };
    } catch (err) {
      logger.warn(
        { href, err: (err as Error).message, source: "scrapers:playwright:buscar" },
        "navegación directa por href falló — fallback a click",
      );
    }
  }

  // Fallback: click via evaluate.
  try {
    const ok = await page.evaluate((idx: number) => {
      const elementos = document.querySelectorAll(
        "a, [role='link'], [data-event-id], [data-match-id], li, article, div",
      );
      let i = 0;
      for (const el of Array.from(elementos)) {
        if (!(el instanceof HTMLElement)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 20) continue;
        if (i === idx) {
          el.click();
          return true;
        }
        i++;
      }
      return false;
    }, elegido.index);
    if (!ok) return null;
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
    return { clicked: true, href: undefined };
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, source: "scrapers:playwright:buscar" },
      "click fallback falló",
    );
    return null;
  }
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Heurística genérica de extracción de cuotas ───────────────────────

/**
 * Lee las cuotas del DOM via heurística por proximidad a labels conocidos.
 *
 * Para cada mercado (1X2, doble_op, ±2.5, BTTS), busca el bloque que
 * contenga las labels esperadas y extrae los 2-3 números decimales más
 * cercanos. Es defensivo: si no encuentra un mercado, lo deja undefined
 * en lugar de romper.
 */
async function extraerCuotasGenerico(
  page: PlaywrightPage,
): Promise<CuotasCapturadas> {
  const html = await page.content();
  const cuotas = await page.evaluate(() => {
    function n(s: string): string {
      return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    }
    /**
     * Lee texto de un elemento intentando filtrar children invisibles.
     * Muchos sportsbook ponen "1.85" en un `<span class="odd-value">`
     * dentro del botón con label "1".
     */
    function texto(el: Element): string {
      if (!(el instanceof HTMLElement)) return "";
      return n(el.innerText ?? el.textContent ?? "");
    }
    /** Convierte string a número decimal positivo o null. */
    function num(s: string | null | undefined): number | null {
      if (!s) return null;
      const m = /(\d+[.,]\d{1,3})/.exec(s);
      if (!m) return null;
      const v = parseFloat(m[1]!.replace(",", "."));
      if (!Number.isFinite(v) || v <= 1) return null;
      return v;
    }
    /**
     * Encuentra el botón/span con texto que matchea el label exacto y
     * devuelve su cuota (busca número decimal en el mismo elemento o en
     * su sibling/descendant más cercano).
     */
    function buscarCuotaPorLabel(
      labels: string[],
      hint?: string,
    ): number | null {
      const candidatos = document.querySelectorAll(
        "button, [role='button'], .odd, [class*='odd' i], [class*='selection' i], [class*='market' i], div, span, label",
      );
      const buscarEnHint = hint ? n(hint) : null;
      for (const el of Array.from(candidatos)) {
        if (!(el instanceof HTMLElement)) continue;
        const txt = texto(el);
        if (txt.length === 0 || txt.length > 100) continue;
        if (buscarEnHint) {
          // Si tenemos un hint de mercado (ej. "doble oportunidad"), el
          // ancestro debe contenerlo.
          const ancestroTxt = texto(el.closest("section, div, li, article") ?? el);
          if (!ancestroTxt.includes(buscarEnHint)) continue;
        }
        for (const label of labels) {
          const labelN = n(label);
          if (txt === labelN || txt.startsWith(labelN + " ") || txt.endsWith(" " + labelN)) {
            // Buscar cuota: en el propio texto, o en sibling, o en descendant.
            const propio = num(txt);
            if (propio !== null) return propio;
            const desc = el.querySelector("[class*='odd' i], [class*='value' i], [class*='price' i], span");
            if (desc) {
              const v = num(texto(desc));
              if (v !== null) return v;
            }
            const sibling = el.nextElementSibling;
            if (sibling) {
              const v = num(texto(sibling));
              if (v !== null) return v;
            }
          }
        }
      }
      return null;
    }

    // 1X2
    const local = buscarCuotaPorLabel(["1", "local", "home"]);
    const empate = buscarCuotaPorLabel(["x", "empate", "draw"]);
    const visita = buscarCuotaPorLabel(["2", "visitante", "away"]);

    // Doble oportunidad (label "doble oportunidad", "double chance")
    const x1 = buscarCuotaPorLabel(["1x"], "doble");
    const x12 = buscarCuotaPorLabel(["12"], "doble");
    const xx2 = buscarCuotaPorLabel(["x2"], "doble");

    // Más/Menos 2.5
    const over = buscarCuotaPorLabel([
      "mas 2.5", "mas 2,5", "+2.5", "+2,5", "over 2.5", "over 2,5",
    ]);
    const under = buscarCuotaPorLabel([
      "menos 2.5", "menos 2,5", "-2.5", "-2,5", "under 2.5", "under 2,5",
    ]);

    // BTTS
    const bttsSi = buscarCuotaPorLabel(["si", "yes"], "ambos");
    const bttsNo = buscarCuotaPorLabel(["no"], "ambos");

    return { local, empate, visita, x1, x12, xx2, over, under, bttsSi, bttsNo };
  });

  void html; // por si necesitamos debug downstream

  const out: CuotasCapturadas = {};
  if (
    cuotas.local !== null &&
    cuotas.empate !== null &&
    cuotas.visita !== null
  ) {
    out["1x2"] = {
      local: cuotas.local,
      empate: cuotas.empate,
      visita: cuotas.visita,
    };
  }
  if (
    cuotas.x1 !== null &&
    cuotas.x12 !== null &&
    cuotas.xx2 !== null
  ) {
    out.doble_op = { x1: cuotas.x1, x12: cuotas.x12, xx2: cuotas.xx2 };
  }
  if (cuotas.over !== null && cuotas.under !== null) {
    out.mas_menos_25 = { over: cuotas.over, under: cuotas.under };
  }
  if (cuotas.bttsSi !== null && cuotas.bttsNo !== null) {
    out.btts = { si: cuotas.bttsSi, no: cuotas.bttsNo };
  }
  return out;
}

// ─── API pública ────────────────────────────────────────────────────────

export interface PartidoParaScraping {
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  /**
   * URL directa del partido en la casa, si la conocemos via vinculación
   * manual (admin pegó URL desde EventIdExterno). Si presente, skipeamos
   * el listado y vamos directo. Default null.
   */
  urlPartidoEnCasa?: string | null;
}

/**
 * Captura las cuotas de UN partido en UNA casa via Playwright. Maneja
 * todo el flow: open page → listado → buscar → click → detalle → leer.
 *
 * Retorna `null` si no encontró el partido (no es una falla, es "esta
 * casa no tiene este partido" — ej. liga no cubierta). Lanza Error en
 * caso de falla técnica (browser no disponible, page crashed, timeout).
 */
export async function capturarPartidoConPlaywright(
  casa: CasaCuotas,
  partido: PartidoParaScraping,
  config: CasaPlaywrightConfig,
): Promise<ResultadoScraper | null> {
  const tInicio = Date.now();
  const timeoutTotalMs = config.timeoutTotalMs ?? TIMEOUT_TOTAL_DEFAULT_MS;
  const timeoutListadoMs = config.timeoutListadoMs ?? TIMEOUT_LISTADO_DEFAULT_MS;

  // Decidir URL inicial: directa (si vinculación manual) o listado de liga.
  let urlInicial: string;
  let viaListado: boolean;
  if (partido.urlPartidoEnCasa) {
    urlInicial = partido.urlPartidoEnCasa;
    viaListado = false;
  } else {
    const url = config.urlListado(partido.liga);
    if (!url) {
      logger.info(
        {
          casa,
          liga: partido.liga,
          source: `scrapers:${casa}:playwright`,
        },
        `${casa}: liga "${partido.liga}" no tiene URL de listado mapeada — skip`,
      );
      return null;
    }
    urlInicial = url;
    viaListado = true;
  }

  const page = await crearPagePlaywright();
  if (!page) {
    throw new Error(
      `${casa}: Playwright no disponible (browser no se pudo lanzar). Revisar PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH y que playwright-chromium esté instalado.`,
    );
  }

  try {
    // ── Paso 1: navegar a la URL inicial ──
    try {
      await page.goto(urlInicial, {
        waitUntil: "domcontentloaded",
        timeout: timeoutListadoMs,
      });
    } catch (err) {
      throw new Error(
        `${casa}: navegación a ${urlInicial} falló — ${(err as Error).message}`,
      );
    }

    // Ventana de hidratación SPA. Si la casa declara `selectorListadoListo`,
    // esperamos eso. Si no, networkidle con timeout corto.
    if (config.selectorListadoListo) {
      try {
        await page.waitForSelector(config.selectorListadoListo, {
          timeout: 10_000,
        });
      } catch {
        // No es fatal — la heurística de búsqueda igual va a funcionar
        // si el listado terminó de cargar antes del selector.
      }
    } else {
      try {
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
      } catch {
        // OK, networkidle puede no llegar nunca en sitios con polling.
      }
    }

    // ── Paso 2: si fuimos al listado, buscar partido y click ──
    if (viaListado) {
      const buscar = config.buscarPartidoEnListado ?? buscarPartidoGenerico;
      const resultado = await buscar(
        page,
        partido.equipoLocal,
        partido.equipoVisita,
      );
      if (!resultado || !resultado.clicked) {
        const msEjecutado = Date.now() - tInicio;
        logger.info(
          {
            casa,
            liga: partido.liga,
            equipoLocal: partido.equipoLocal,
            equipoVisita: partido.equipoVisita,
            urlListado: urlInicial,
            ms: msEjecutado,
            source: `scrapers:${casa}:playwright`,
          },
          `${casa}: partido no encontrado en listado (${msEjecutado}ms) — pendiente vinculación manual`,
        );
        return null;
      }

      // Espera a que el detalle del partido cargue.
      try {
        await page.waitForLoadState("networkidle", { timeout: 15_000 });
      } catch {
        // Continuamos igual.
      }
      // Pequeña espera para que las cuotas terminen de hidratar.
      await page.waitForTimeout(1500);
    }

    // ── Paso 3: extraer cuotas ──
    const extraer = config.extraerCuotas ?? extraerCuotasGenerico;
    const cuotas = await extraer(page);

    if (Object.keys(cuotas).length === 0) {
      // No es CapturaSinDatosError — probablemente la página cargó pero
      // el extractor no reconoció ningún mercado. Lanzamos para que el
      // worker lo refleje como ERROR + admin lo vea.
      const msEjecutado = Date.now() - tInicio;
      throw new Error(
        `${casa}: cargó la página pero no se extrajo ningún mercado (${msEjecutado}ms, url=${page.url()})`,
      );
    }

    const fuente = { url: page.url(), capturadoEn: new Date() };

    // Verificar que no excedimos el timeout total.
    const msEjecutado = Date.now() - tInicio;
    if (msEjecutado > timeoutTotalMs) {
      logger.warn(
        {
          casa,
          ms: msEjecutado,
          timeoutTotalMs,
          source: `scrapers:${casa}:playwright`,
        },
        `${casa}: captura completada pero excedió timeoutTotalMs`,
      );
    }

    logger.info(
      {
        casa,
        liga: partido.liga,
        ms: msEjecutado,
        mercadosCapturados: Object.keys(cuotas),
        url: fuente.url,
        source: `scrapers:${casa}:playwright`,
      },
      `${casa} playwright OK (${msEjecutado}ms · ${Object.keys(cuotas).length} mercados)`,
    );

    return {
      cuotas,
      fuente,
      // Equipos que vimos en el sitio: no los extraemos del DOM por ahora
      // (heurística genérica no lo soporta sin ruido). Si una casa quiere
      // alimentar AliasEquipo vía V.7, sobrescribe `extraerCuotas` y
      // adjunta `equipos` al return.
    };
  } finally {
    void liberarPagePlaywright(page);
  }
}

/**
 * Helper de conveniencia para los 7 scrapers: dado un Partido del modelo
 * Prisma, lo adapta al shape `PartidoParaScraping` y dispara la captura
 * con la config registrada para la casa. Cada scraper concreto implementa
 * `capturarConPlaywright` con una sola línea: `capturarPartidoPorCasa(...)`.
 */
export async function capturarPartidoPorCasa(
  casa: CasaCuotas,
  partido: { liga: string; equipoLocal: string; equipoVisita: string },
  urlPartidoEnCasa: string | null | undefined,
  configsPorCasa: Record<CasaCuotas, CasaPlaywrightConfig>,
): Promise<ResultadoScraper | null> {
  const config = configsPorCasa[casa];
  return capturarPartidoConPlaywright(
    casa,
    {
      liga: partido.liga,
      equipoLocal: partido.equipoLocal,
      equipoVisita: partido.equipoVisita,
      urlPartidoEnCasa: urlPartidoEnCasa ?? null,
    },
    config,
  );
}

// Re-exports de utilities para que scrapers que sobrescriban funciones
// puedan reusar la heurística base.
export { buscarPartidoGenerico, extraerCuotasGenerico };

// CapturaSinDatosError re-export para que scrapers concretos puedan
// lanzarlo cuando la casa no tiene el partido publicado todavía (sin
// penalizar salud).
export { CapturaSinDatosError };
