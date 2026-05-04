// Flow Playwright iterativo para los 7 scrapers — Lote V.10.5 (May 2026).
//
// Reemplaza la heurística genérica del Lote V.9 que recorría el DOM completo
// una sola vez. La nueva arquitectura emula el approach de Claude Cowork:
// navegar la página, esperar hidratación SPA, scroll para lazy-load, click
// en tabs si hace falta, validar que el click navegó al detalle, y extraer
// cuotas por bloque de mercado.
//
// Etapas del flow:
//
//   1. NAVEGAR a la URL del listado de la liga.
//   2. ESPERAR hidratación SPA (combinación de selectores + delay).
//   3. BUSCAR PARTIDO con hasta 4 intentos:
//      - Intento 1: heurística DOM directa (mejorada).
//      - Intento 2: scroll down → retry (cubre lazy-load).
//      - Intento 3: click en tab "Próximos"/"Upcoming"/"Todos" → retry.
//      - Intento 4: más scroll → retry.
//   4. CLICK en candidato y VALIDAR navegación (URL cambió o detail-view
//      selector apareció).
//   5. ESPERAR cuotas visibles en detalle.
//   6. EXTRAER por bloque de mercado: encuentra el header del mercado
//      ("Resultado"/"1X2", "Doble Oportunidad", "Goles Total", "Ambos
//      Anotan") y dentro del bloque busca las cuotas etiquetadas.
//   7. Si bloques no funcionan, fallback a heurística genérica vieja.
//
// Cada paso loggea con detalle para que en producción se vea exactamente
// dónde falla cuando una casa no rinde.

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
  urlListado(liga: string): string | null;
  selectorListadoListo?: string;
  timeoutListadoMs?: number;
  timeoutTotalMs?: number;
  buscarPartidoEnListado?(
    page: PlaywrightPage,
    equipoLocal: string,
    equipoVisita: string,
  ): Promise<{ clicked: boolean; href?: string } | null>;
  extraerCuotas?(page: PlaywrightPage): Promise<CuotasCapturadas>;
}

const TIMEOUT_LISTADO_DEFAULT_MS = 30_000;
const TIMEOUT_TOTAL_DEFAULT_MS = 90_000;

// ─── Heurística iterativa de búsqueda de partido ───────────────────────

interface CandidatoEnDOM {
  texto: string;
  href: string | null;
  bbox: number;
  index: number;
  textoLocal: string;
  textoVisita: string;
}

/**
 * Busca candidatos en el DOM. Estrategia mejorada vs V.9:
 *   - Primero busca elementos pequeños que contengan AMBOS equipos (caso
 *     fácil — link/card del partido entero).
 *   - Si no encuentra, busca elementos con el equipo LOCAL y verifica que
 *     un elemento sibling/descendiente cercano tenga el visita (caso
 *     SPAs con spans separados).
 *   - Re-rank por similitud Jaro-Winkler.
 */
async function buscarCandidatosEnDOM(
  page: PlaywrightPage,
  equipoLocal: string,
  equipoVisita: string,
): Promise<CandidatoEnDOM[]> {
  const candidatos: CandidatoEnDOM[] = await page.evaluate(
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
      function tokensRelevantes(s: string): string[] {
        return normalizar(s)
          .split(" ")
          .filter((t) => t.length >= 4); // tokens cortos (de, fc, cd) se ignoran
      }
      function tieneAlguno(tokens: string[], texto: string): boolean {
        for (const t of tokens) {
          if (texto.includes(t)) return true;
        }
        return false;
      }

      const tokensLocal = tokensRelevantes(local);
      const tokensVisita = tokensRelevantes(visita);
      if (tokensLocal.length === 0 || tokensVisita.length === 0) return [];

      const out: CandidatoEnDOM[] = [];
      // Selector amplio que cubre la mayoría de patrones de partidos en
      // sportsbook SPAs.
      const SELECTORES =
        "a, [role='link'], [role='button'], button, [data-event-id], " +
        "[data-match-id], [data-fixture-id], [class*='event' i], " +
        "[class*='match' i], [class*='fixture' i], [class*='game' i], " +
        "li, article";
      const elementos = document.querySelectorAll(SELECTORES);
      let idx = 0;
      const seenTextos = new Set<string>();

      // ── Estrategia 1: elementos que contienen AMBOS equipos ─────────
      for (const el of Array.from(elementos)) {
        if (!(el instanceof HTMLElement)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 20) continue;
        if (rect.width > 1500 || rect.height > 800) continue; // demasiado grande
        const texto = normalizar(el.innerText ?? el.textContent ?? "");
        if (texto.length < 6 || texto.length > 400) continue;
        if (!tieneAlguno(tokensLocal, texto)) continue;
        if (!tieneAlguno(tokensVisita, texto)) continue;

        // Dedup por texto exacto (varios elementos pueden contener lo mismo).
        if (seenTextos.has(texto)) continue;
        seenTextos.add(texto);

        const href =
          el instanceof HTMLAnchorElement
            ? el.href
            : (el.querySelector("a") as HTMLAnchorElement | null)?.href ?? null;
        out.push({
          texto: texto.slice(0, 200),
          href,
          bbox: rect.width * rect.height,
          index: idx,
          textoLocal: local,
          textoVisita: visita,
        });
        idx++;
        if (idx >= 200) break;
      }

      // Si no encontramos en la estrategia 1, fallback estrategia 2:
      // elementos pequeños con SOLO local, verificando que el visita
      // esté en un elemento sibling/parent dentro de un container común.
      if (out.length === 0) {
        for (const elLocal of Array.from(elementos)) {
          if (!(elLocal instanceof HTMLElement)) continue;
          const rect = elLocal.getBoundingClientRect();
          if (rect.width < 20 || rect.height < 15) continue;
          const texto = normalizar(elLocal.innerText ?? elLocal.textContent ?? "");
          if (texto.length < 3 || texto.length > 60) continue;
          if (!tieneAlguno(tokensLocal, texto)) continue;
          if (tieneAlguno(tokensVisita, texto)) continue; // ya cubierto en estrategia 1

          // Subir al ancestro hasta encontrar uno que también contenga al
          // visita. Limitar profundidad a 5 niveles.
          let actual: HTMLElement | null = elLocal;
          for (let depth = 0; depth < 5 && actual; depth++) {
            actual = actual.parentElement;
            if (!actual) break;
            const textoAncestro = normalizar(
              actual.innerText ?? actual.textContent ?? "",
            );
            if (textoAncestro.length > 600) break; // ancestro demasiado grande
            if (tieneAlguno(tokensVisita, textoAncestro)) {
              const ancestroRect = actual.getBoundingClientRect();
              if (ancestroRect.width < 30 || ancestroRect.height < 20) continue;
              const dedupKey = textoAncestro.slice(0, 100);
              if (seenTextos.has(dedupKey)) break;
              seenTextos.add(dedupKey);

              const href =
                actual instanceof HTMLAnchorElement
                  ? actual.href
                  : (actual.querySelector("a") as HTMLAnchorElement | null)
                      ?.href ?? null;
              out.push({
                texto: textoAncestro.slice(0, 200),
                href,
                bbox: ancestroRect.width * ancestroRect.height,
                index: idx,
                textoLocal: local,
                textoVisita: visita,
              });
              idx++;
              break;
            }
          }
          if (idx >= 100) break;
        }
      }

      return out;
    },
    { local: equipoLocal, visita: equipoVisita },
  );

  // Ordenar por bbox ascendente (más específico primero).
  candidatos.sort((a, b) => a.bbox - b.bbox);
  return candidatos;
}

/**
 * Re-rankea candidatos por similitud Jaro-Winkler server-side y elige el mejor.
 */
function elegirMejorCandidato(
  candidatos: CandidatoEnDOM[],
  equipoLocal: string,
  equipoVisita: string,
): CandidatoEnDOM | null {
  if (candidatos.length === 0) return null;
  let mejorIdx = 0;
  let mejorScore = 0;
  for (let i = 0; i < Math.min(candidatos.length, 30); i++) {
    const c = candidatos[i]!;
    const sLocal = similitudEquipos(c.texto, equipoLocal);
    const sVisita = similitudEquipos(c.texto, equipoVisita);
    const score = Math.min(sLocal, sVisita);
    if (score > mejorScore) {
      mejorScore = score;
      mejorIdx = i;
    }
  }
  // Solo aceptamos si score es razonable (>= umbral fuzzy).
  if (mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) {
    // Score muy bajo — probablemente match falso positivo.
    return null;
  }
  return candidatos[mejorIdx] ?? null;
}

/**
 * Intenta hacer click en un tab/filtro común para que aparezcan más
 * partidos (Próximos/Upcoming/Todos/Hoy/Mañana). No falla si no encuentra.
 */
async function intentarClickearTabComun(
  page: PlaywrightPage,
  casa: CasaCuotas,
): Promise<boolean> {
  try {
    const ok = await page.evaluate(() => {
      function n(s: string): string {
        return s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim();
      }
      const targets = [
        "proximos",
        "próximos",
        "upcoming",
        "todos",
        "all",
        "hoy",
        "today",
        "manana",
        "mañana",
        "tomorrow",
        "pre-match",
        "prepartido",
      ];
      const candidatos = document.querySelectorAll(
        "button, [role='tab'], [role='button'], a, label, span",
      );
      for (const el of Array.from(candidatos)) {
        if (!(el instanceof HTMLElement)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 15) continue;
        if (rect.width > 250 || rect.height > 80) continue; // tabs son chicos
        const texto = n(el.innerText ?? el.textContent ?? "");
        if (texto.length === 0 || texto.length > 25) continue;
        for (const t of targets) {
          if (texto === t || texto.startsWith(t + " ") || texto.endsWith(" " + t)) {
            try {
              el.click();
              return true;
            } catch {
              return false;
            }
          }
        }
      }
      return false;
    });
    if (ok) {
      logger.info(
        { casa, source: `scrapers:${casa}:playwright:tab` },
        `${casa}: click en tab "Próximos/Upcoming/Todos" exitoso`,
      );
    }
    return ok;
  } catch {
    return false;
  }
}

/**
 * Búsqueda iterativa del partido: hasta 4 intentos con scroll/tabs entre
 * ellos. Si encuentra candidato sólido, hace click y valida que la
 * navegación al detalle ocurrió.
 */
async function buscarPartidoIterativo(
  page: PlaywrightPage,
  casa: CasaCuotas,
  equipoLocal: string,
  equipoVisita: string,
): Promise<{ clicked: boolean; href?: string } | null> {
  // Espera adicional de hidratación inicial (post networkidle del flow).
  // Algunos SPAs (Coolbet/Betano con WAFs) tardan más en renderear.
  await page.waitForTimeout(2500);

  const maxIntentos = 4;
  let candidato: CandidatoEnDOM | null = null;
  for (let intento = 0; intento < maxIntentos; intento++) {
    const candidatos = await buscarCandidatosEnDOM(
      page,
      equipoLocal,
      equipoVisita,
    );
    candidato = elegirMejorCandidato(candidatos, equipoLocal, equipoVisita);
    logger.info(
      {
        casa,
        intento: intento + 1,
        candidatosEncontrados: candidatos.length,
        elegidoTexto: candidato?.texto?.slice(0, 80) ?? null,
        source: `scrapers:${casa}:playwright:buscar`,
      },
      `${casa} intento ${intento + 1}: ${candidatos.length} candidatos · elegido=${candidato ? candidato.texto.slice(0, 60) + "..." : "ninguno"}`,
    );
    if (candidato) break;

    // No encontrado. Acción según el intento.
    if (intento === 0) {
      // Scroll down medio para forzar lazy-load.
      try {
        await page.evaluate(() => window.scrollBy(0, 600));
      } catch {
        /* ignore */
      }
      await page.waitForTimeout(2000);
    } else if (intento === 1) {
      // Click en tab común.
      const tabClicked = await intentarClickearTabComun(page, casa);
      if (tabClicked) {
        await page.waitForTimeout(2500);
      } else {
        // Scroll más como fallback.
        try {
          await page.evaluate(() => window.scrollBy(0, 800));
        } catch {
          /* ignore */
        }
        await page.waitForTimeout(2000);
      }
    } else if (intento === 2) {
      // Scroll grande.
      try {
        await page.evaluate(() => window.scrollBy(0, 1500));
      } catch {
        /* ignore */
      }
      await page.waitForTimeout(2500);
    }
  }

  if (!candidato) return null;

  // Click + validar navegación.
  const urlAntes = page.url();
  const href = candidato.href ?? undefined;

  if (href && href !== urlAntes && href.startsWith("http")) {
    // Preferir navegación directa por href (más confiable).
    try {
      await page.goto(href, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      logger.info(
        { casa, href, source: `scrapers:${casa}:playwright:click` },
        `${casa}: navegación por href exitosa`,
      );
      return { clicked: true, href };
    } catch (err) {
      logger.warn(
        {
          casa,
          href,
          err: (err as Error).message,
          source: `scrapers:${casa}:playwright:click`,
        },
        `${casa}: navegación por href falló — fallback a click DOM`,
      );
    }
  }

  // Fallback: click via evaluate + esperar URL change o selector de detalle.
  try {
    const ok = await page.evaluate((idx: number) => {
      const SELECTORES =
        "a, [role='link'], [role='button'], button, [data-event-id], " +
        "[data-match-id], [data-fixture-id], [class*='event' i], " +
        "[class*='match' i], [class*='fixture' i], [class*='game' i], " +
        "li, article";
      const elementos = document.querySelectorAll(SELECTORES);
      let i = 0;
      for (const el of Array.from(elementos)) {
        if (!(el instanceof HTMLElement)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 20) continue;
        if (rect.width > 1500 || rect.height > 800) continue;
        if (i === idx) {
          el.click();
          return true;
        }
        i++;
      }
      return false;
    }, candidato.index);
    if (!ok) {
      logger.info(
        { casa, source: `scrapers:${casa}:playwright:click` },
        `${casa}: click via evaluate no encontró elemento (DOM cambió?)`,
      );
      return null;
    }

    // Esperar navegación: URL cambia o aparece selector de detalle.
    const urlCambio = await page
      .waitForURL((url) => String(url) !== urlAntes, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (urlCambio) {
      logger.info(
        { casa, urlAntes, urlDespues: page.url(), source: `scrapers:${casa}:playwright:click` },
        `${casa}: URL cambió tras click`,
      );
      try {
        await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
      } catch {
        /* ok */
      }
      return { clicked: true };
    }

    // URL no cambió. Puede ser modal in-page o el click no funcionó.
    // Esperar igual unos segundos y verificar si aparecieron cuotas (señal
    // de que el detalle se cargó como modal).
    await page.waitForTimeout(2500);
    logger.info(
      { casa, urlAntes, urlActual: page.url(), source: `scrapers:${casa}:playwright:click` },
      `${casa}: click no produjo cambio de URL — asumiendo modal in-page`,
    );
    return { clicked: true };
  } catch (err) {
    logger.warn(
      {
        casa,
        err: (err as Error).message,
        source: `scrapers:${casa}:playwright:click`,
      },
      `${casa}: click fallback falló`,
    );
    return null;
  }
}

// ─── Extracción de cuotas mejorada ─────────────────────────────────────

/**
 * Extracción mejorada que primero intenta encontrar el bloque de cada
 * mercado por su header (texto "Resultado", "Doble Oportunidad", etc.) y
 * después busca las cuotas dentro del bloque. Si el bloque-aware approach
 * falla, fallback a la heurística de labels global del Lote V.9.
 */
async function extraerCuotasIterativo(
  page: PlaywrightPage,
): Promise<CuotasCapturadas> {
  // Esperar a que aparezca al menos una cuota visible (decimal en botón
  // o elemento con clase odd/price/value).
  try {
    await page.waitForFunction(
      () => {
        const els = document.querySelectorAll(
          "button, [class*='odd' i], [class*='price' i], [class*='value' i], span, div",
        );
        for (const el of Array.from(els)) {
          if (!(el instanceof HTMLElement)) continue;
          const txt = (el.innerText ?? el.textContent ?? "").trim();
          if (/^\s*\d+[.,]\d{1,3}\s*$/.test(txt)) {
            const v = parseFloat(txt.replace(",", "."));
            if (Number.isFinite(v) && v > 1 && v < 100) return true;
          }
        }
        return false;
      },
      { timeout: 8_000 },
    );
  } catch {
    // No apareció ninguna cuota — la página puede no haber cargado. Igual
    // intentamos extraer (puede estar en un nodo más profundo).
  }

  const cuotas = await page.evaluate(() => {
    function n(s: string): string {
      return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    }
    function texto(el: Element): string {
      if (!(el instanceof HTMLElement)) return "";
      return n(el.innerText ?? el.textContent ?? "");
    }
    function num(s: string | null | undefined): number | null {
      if (!s) return null;
      const m = /(\d+[.,]\d{1,3})/.exec(s);
      if (!m) return null;
      const v = parseFloat(m[1]!.replace(",", "."));
      if (!Number.isFinite(v) || v <= 1 || v > 100) return null;
      return v;
    }

    /**
     * Encuentra el bloque (section/div) que contiene un mercado dado por
     * keywords en su header. Retorna el bloque o null.
     */
    function encontrarBloqueMercado(keywords: string[]): HTMLElement | null {
      const candidatos = document.querySelectorAll(
        "section, article, [class*='market' i], [class*='odds' i], div",
      );
      for (const el of Array.from(candidatos)) {
        if (!(el instanceof HTMLElement)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 30) continue;
        if (rect.width > 1400 || rect.height > 600) continue;
        const txt = texto(el);
        if (txt.length === 0 || txt.length > 800) continue;
        // El bloque contiene al menos una keyword del mercado en el primer
        // tercio de su texto (probable header).
        const primerTercio = txt.slice(0, Math.max(60, Math.floor(txt.length / 3)));
        for (const kw of keywords) {
          if (primerTercio.includes(kw)) {
            // Validar que el bloque también contiene al menos un decimal
            // (sino es solo header sin cuotas).
            const tieneCuota = /\d+[.,]\d{1,3}/.test(txt);
            if (tieneCuota) return el;
          }
        }
      }
      return null;
    }

    /**
     * Dentro de un bloque, busca cuotas por label exacto.
     */
    function cuotaEnBloque(bloque: HTMLElement, labels: string[]): number | null {
      const elementos = bloque.querySelectorAll(
        "button, [role='button'], span, div, label",
      );
      for (const el of Array.from(elementos)) {
        if (!(el instanceof HTMLElement)) continue;
        const txt = texto(el);
        if (txt.length === 0 || txt.length > 80) continue;
        for (const label of labels) {
          if (
            txt === label ||
            txt.startsWith(label + " ") ||
            txt.endsWith(" " + label) ||
            txt === label + " " ||
            txt === " " + label
          ) {
            // Match label. Extraer cuota.
            const propio = num(txt);
            if (propio !== null) return propio;
            const desc = el.querySelector(
              "[class*='odd' i], [class*='value' i], [class*='price' i], span, b, strong",
            );
            if (desc) {
              const v = num(texto(desc));
              if (v !== null) return v;
            }
            // Sibling next.
            const sib = el.nextElementSibling;
            if (sib) {
              const v = num(texto(sib));
              if (v !== null) return v;
            }
            // Parent: a veces la cuota está en otra parte del padre.
            const padre = el.parentElement;
            if (padre) {
              const v = num(texto(padre));
              if (v !== null && txt !== texto(padre)) return v;
            }
          }
        }
      }
      return null;
    }

    /**
     * Fallback: heurística genérica del Lote V.9 — busca labels en todo
     * el documento, filtrando por contexto opcional.
     */
    function buscarCuotaGlobal(
      labels: string[],
      contextHint?: string,
    ): number | null {
      const candidatos = document.querySelectorAll(
        "button, [role='button'], [class*='odd' i], [class*='selection' i], span, label",
      );
      const ctx = contextHint ? n(contextHint) : null;
      for (const el of Array.from(candidatos)) {
        if (!(el instanceof HTMLElement)) continue;
        const txt = texto(el);
        if (txt.length === 0 || txt.length > 100) continue;
        if (ctx) {
          const ancestro = el.closest("section, article, div, li");
          const ancestroTxt = ancestro ? texto(ancestro) : txt;
          if (!ancestroTxt.includes(ctx)) continue;
        }
        for (const label of labels) {
          if (
            txt === label ||
            txt.startsWith(label + " ") ||
            txt.endsWith(" " + label)
          ) {
            const propio = num(txt);
            if (propio !== null) return propio;
            const desc = el.querySelector(
              "[class*='odd' i], [class*='value' i], [class*='price' i], span",
            );
            if (desc) {
              const v = num(texto(desc));
              if (v !== null) return v;
            }
            const sib = el.nextElementSibling;
            if (sib) {
              const v = num(texto(sib));
              if (v !== null) return v;
            }
          }
        }
      }
      return null;
    }

    // ── 1X2 ────────────────────────────────────────────────────────
    let local: number | null = null;
    let empate: number | null = null;
    let visita: number | null = null;
    const bloque1X2 = encontrarBloqueMercado([
      "resultado",
      "1x2",
      "match result",
      "match winner",
      "ganador del partido",
      "ganador",
    ]);
    if (bloque1X2) {
      local = cuotaEnBloque(bloque1X2, ["1", "local", "home", "casa"]);
      empate = cuotaEnBloque(bloque1X2, ["x", "empate", "draw"]);
      visita = cuotaEnBloque(bloque1X2, ["2", "visitante", "visita", "away"]);
    }
    if (local === null) local = buscarCuotaGlobal(["1", "local", "home"]);
    if (empate === null) empate = buscarCuotaGlobal(["x", "empate", "draw"]);
    if (visita === null)
      visita = buscarCuotaGlobal(["2", "visitante", "visita", "away"]);

    // ── Doble oportunidad ─────────────────────────────────────────
    let x1: number | null = null;
    let x12: number | null = null;
    let xx2: number | null = null;
    const bloqueDoble = encontrarBloqueMercado([
      "doble oportunidad",
      "doble op",
      "double chance",
      "doblechance",
    ]);
    if (bloqueDoble) {
      x1 = cuotaEnBloque(bloqueDoble, ["1x", "1 o x", "1 x"]);
      x12 = cuotaEnBloque(bloqueDoble, ["12", "1 o 2", "1 2"]);
      xx2 = cuotaEnBloque(bloqueDoble, ["x2", "x o 2", "x 2"]);
    }
    if (x1 === null) x1 = buscarCuotaGlobal(["1x"], "doble");
    if (x12 === null) x12 = buscarCuotaGlobal(["12"], "doble");
    if (xx2 === null) xx2 = buscarCuotaGlobal(["x2"], "doble");

    // ── Más/Menos 2.5 ────────────────────────────────────────────
    let over: number | null = null;
    let under: number | null = null;
    const bloqueTotal = encontrarBloqueMercado([
      "goles",
      "total",
      "totales",
      "over/under",
      "mas/menos",
      "mas menos",
      "over under",
    ]);
    if (bloqueTotal) {
      over = cuotaEnBloque(bloqueTotal, [
        "mas 2.5",
        "mas 2,5",
        "+2.5",
        "+2,5",
        "over 2.5",
        "over 2,5",
        "over",
      ]);
      under = cuotaEnBloque(bloqueTotal, [
        "menos 2.5",
        "menos 2,5",
        "-2.5",
        "-2,5",
        "under 2.5",
        "under 2,5",
        "under",
      ]);
    }
    if (over === null)
      over = buscarCuotaGlobal([
        "mas 2.5",
        "mas 2,5",
        "+2.5",
        "+2,5",
        "over 2.5",
        "over 2,5",
      ]);
    if (under === null)
      under = buscarCuotaGlobal([
        "menos 2.5",
        "menos 2,5",
        "-2.5",
        "-2,5",
        "under 2.5",
        "under 2,5",
      ]);

    // ── BTTS ──────────────────────────────────────────────────────
    let bttsSi: number | null = null;
    let bttsNo: number | null = null;
    const bloqueBtts = encontrarBloqueMercado([
      "ambos anotan",
      "ambos equipos anotan",
      "ambos marcan",
      "btts",
      "both teams to score",
      "gg/ng",
      "gg ng",
    ]);
    if (bloqueBtts) {
      bttsSi = cuotaEnBloque(bloqueBtts, ["si", "yes", "gg"]);
      bttsNo = cuotaEnBloque(bloqueBtts, ["no", "ng"]);
    }
    if (bttsSi === null) bttsSi = buscarCuotaGlobal(["si", "yes"], "ambos");
    if (bttsNo === null) bttsNo = buscarCuotaGlobal(["no"], "ambos");

    return {
      local,
      empate,
      visita,
      x1,
      x12,
      xx2,
      over,
      under,
      bttsSi,
      bttsNo,
    };
  });

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
  if (cuotas.x1 !== null && cuotas.x12 !== null && cuotas.xx2 !== null) {
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
  urlPartidoEnCasa?: string | null;
}

export async function capturarPartidoConPlaywright(
  casa: CasaCuotas,
  partido: PartidoParaScraping,
  config: CasaPlaywrightConfig,
): Promise<ResultadoScraper | null> {
  const tInicio = Date.now();
  const timeoutTotalMs = config.timeoutTotalMs ?? TIMEOUT_TOTAL_DEFAULT_MS;
  const timeoutListadoMs = config.timeoutListadoMs ?? TIMEOUT_LISTADO_DEFAULT_MS;

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
      `${casa}: Playwright no disponible (browser no se pudo lanzar).`,
    );
  }

  try {
    // ── Paso 1: navegar a URL inicial ──
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

    // ── Paso 2: esperar hidratación ──
    if (config.selectorListadoListo) {
      try {
        await page.waitForSelector(config.selectorListadoListo, {
          timeout: 10_000,
        });
      } catch {
        /* ok */
      }
    } else {
      try {
        await page.waitForLoadState("networkidle", { timeout: 8_000 });
      } catch {
        /* networkidle puede no llegar */
      }
    }

    // ── Paso 3-4: buscar partido + click + validar navegación ──
    if (viaListado) {
      const buscar = config.buscarPartidoEnListado ?? null;
      const resultado = buscar
        ? await buscar(page, partido.equipoLocal, partido.equipoVisita)
        : await buscarPartidoIterativo(
            page,
            casa,
            partido.equipoLocal,
            partido.equipoVisita,
          );
      if (!resultado || !resultado.clicked) {
        const ms = Date.now() - tInicio;
        logger.info(
          {
            casa,
            liga: partido.liga,
            equipoLocal: partido.equipoLocal,
            equipoVisita: partido.equipoVisita,
            urlListado: urlInicial,
            ms,
            source: `scrapers:${casa}:playwright`,
          },
          `${casa}: partido no encontrado en listado tras 4 intentos (${ms}ms)`,
        );
        return null;
      }

      // Espera a que cargue detalle.
      try {
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
      } catch {
        /* ok */
      }
      await page.waitForTimeout(2000);
    }

    // ── Paso 5-6: extraer cuotas ──
    const extraer = config.extraerCuotas ?? extraerCuotasIterativo;
    const cuotas = await extraer(page);

    if (Object.keys(cuotas).length === 0) {
      const ms = Date.now() - tInicio;
      throw new Error(
        `${casa}: cargó la página pero no se extrajo ningún mercado (${ms}ms, url=${page.url()})`,
      );
    }

    const fuente = { url: page.url(), capturadoEn: new Date() };
    const ms = Date.now() - tInicio;

    if (ms > timeoutTotalMs) {
      logger.warn(
        { casa, ms, timeoutTotalMs, source: `scrapers:${casa}:playwright` },
        `${casa}: captura completada pero excedió timeoutTotalMs`,
      );
    }

    logger.info(
      {
        casa,
        liga: partido.liga,
        ms,
        mercadosCapturados: Object.keys(cuotas),
        url: fuente.url,
        source: `scrapers:${casa}:playwright`,
      },
      `${casa} playwright OK (${ms}ms · ${Object.keys(cuotas).length} mercados)`,
    );

    return {
      cuotas,
      fuente,
    };
  } finally {
    void liberarPagePlaywright(page);
  }
}

/**
 * Helper de conveniencia para los 7 scrapers.
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

// CapturaSinDatosError re-export.
export { CapturaSinDatosError };
