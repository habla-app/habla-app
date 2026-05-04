// Validación geo-test + reconocimiento estructural + extracción real de Stake.
//
// Versión 2 del script — pensada para ser la ÚLTIMA validación antes de
// construir el agente residente que va a correr el scraping desde la PC del
// admin con IP peruana.
//
// Para CADA una de las 7 casas hace:
//   FASE A — listado:
//     1. Navega al listado de Liga 1 Perú.
//     2. Intenta aceptar cookies (lista expandida de strings de botón).
//     3. Espera hidratación (configurable por casa, Apuesta Total más).
//     4. Captura screenshot, HTML del body, análisis estructural.
//
//   FASE B — búsqueda del partido objetivo (UTC Cajamarca vs FC Cajamarca):
//     - Si casa === "stake": usa selectores específicos ya validados.
//     - Else: heurística genérica de "<a> con texto que contenga ambos
//       equipos".
//
//   FASE C — detalle (si encontró partido):
//     1. Navega al href del detalle.
//     2. Espera hidratación.
//     3. Captura screenshot, HTML, análisis estructural.
//
//   FASE D — extracción real (solo Stake):
//     - Aplica los selectores `.wol-odd[data-odd-id]` que ya descubrimos.
//     - Devuelve las 4 cuotas (1X2, Doble Op, Más/Menos 2.5, BTTS).
//     - El resumen final imprime VALIDADO o FAIL por mercado.
//
// Salida en disco:
//   ./screenshots/{casa}-{listado|detalle}.png
//   ./html/{casa}-{listado|detalle}.html       (truncado a 500 KB)
//   ./analisis-estructural/{casa}-{listado|detalle}.json
//   ./resumen.json                             (consolidado de todo)
//
// Uso:
//   cd scripts/validacion-geo
//   git pull origin main         (si ya está clonado)
//   npm install                  (solo primera vez)
//   node validar-geo-test.mjs

import { chromium } from "playwright-chromium";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ─── Config ────────────────────────────────────────────────────────────
//
// Cada casa tiene su perfil específico. Después de la corrida v3 quedó
// claro que una sola heurística genérica para 7 sportsbooks es frágil —
// cada uno tiene su propia arquitectura. Aquí cada casa declara
// explícitamente qué necesita.
//
// Campos por casa:
//   - url:                     URL del listado de Liga 1 Perú
//   - waitExtraMs:             timeout de hidratación adicional (default 5s)
//   - cerrarModales:           bool, default true. Stake=false porque su
//                              cookie banner es suficiente y los intentos
//                              de cierre risk-clickear links externos.
//   - waitAntesDeCerrarMs:     ms a esperar ANTES del cerrarModales
//                              (Doradobet necesita ~4s para que el modal
//                              de "Iniciar Sesión" aparezca).
//   - iframeRegex:             si presente, busca un frame que matchee el
//                              regex y trabaja DENTRO de él. Apuesta Total
//                              e Inkabet embeben el sportsbook real en
//                              iframes externos.
//   - waitIframeMs:            ms a esperar para que el iframe cargue
//                              antes de buscar partidos adentro.

const URLS = [
  {
    casa: "stake",
    url: "https://stake.pe/deportes/football/peru/primera-division",
    // CRÍTICO: NO cerrar modales. El cookie banner ya cubre el caso.
    // En la v3, cerrarModales agarró el link "X" del footer (Twitter)
    // y navegó a x.com/PeruStake.
    cerrarModales: false,
  },
  {
    casa: "apuesta_total",
    url: "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=170&league=203110137349808128",
    // El sportsbook real está embebido en kmianko.com (Kambi B2B).
    iframeRegex: /kmianko\.com/i,
    waitExtraMs: 8000,
    waitIframeMs: 6000,
  },
  {
    casa: "coolbet",
    url: "https://www.coolbet.pe/pe/deportes/futbol/per%C3%BA/primera-division-peruana",
    // Las cuotas están en el listado mismo — no hace falta navegar al
    // detalle. El click en match-layout-container no cambia URL.
    extraerEnListado: true,
  },
  {
    casa: "doradobet",
    url: "https://doradobet.com/deportes/liga/4042",
    // El modal de "Iniciar Sesión" tarda en aparecer. Esperar antes
    // de intentar cerrarlo.
    cerrarModales: true,
    waitAntesDeCerrarMs: 4000,
  },
  {
    casa: "betano",
    url: "https://www.betano.pe/sport/futbol/peru/liga-1/17079/",
    // En la v3 funcionó OK con cerrarModales default.
  },
  {
    casa: "inkabet",
    url: "https://inkabet.pe/pe/apuestas-deportivas/futbol/peru/peru-liga-1?tab=liveAndUpcoming",
    // El iframe se llama literalmente sportsBookIframe.
    iframeRegex: /inkabetplayground\.net/i,
    waitIframeMs: 5000,
  },
  {
    casa: "te_apuesto",
    url: "https://www.teapuesto.pe/sport/detail/futbol/peru/liga-1-te-apuesto?id=1,476,1899",
    // Click en oct-elmt-sport-event-container no cambia URL — el
    // listado tiene cuotas, extraemos ahí.
    extraerEnListado: true,
  },
];

const PARTIDO_OBJETIVO = {
  equipoLocal: "UTC Cajamarca",
  equipoVisita: "FC Cajamarca",
};

const DIR_SCREENSHOTS = "./screenshots";
const DIR_HTML = "./html";
const DIR_ANALISIS = "./analisis-estructural";
const SLEEP_HIDRATACION_DEFAULT_MS = 5_000;
const HTML_MAX_BYTES = 500_000;

// ─── Helpers ───────────────────────────────────────────────────────────

async function intentarAceptarCookies(page) {
  try {
    return await page.evaluate(() => {
      const norm = (s) =>
        s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim();
      const targets = [
        "aceptar",
        "aceptar todo",
        "aceptar todas",
        "aceptar cookies",
        "acepto",
        "acepto todo",
        "acepto todas",
        "accept",
        "accept all",
        "accept cookies",
        "ok",
        "got it",
        "i accept",
        "entendido",
        "de acuerdo",
        "permitir todo",
        "allow all",
        "continuar",
      ];
      const els = document.querySelectorAll(
        "button, a, [role='button'], [role='link']",
      );
      for (const el of els) {
        if (!(el instanceof HTMLElement)) continue;
        const t = norm(el.innerText ?? el.textContent ?? "");
        if (t.length === 0 || t.length > 50) continue;
        if (
          targets.includes(t) ||
          targets.some((target) => t === target || t.startsWith(target + " "))
        ) {
          try {
            el.click();
            return true;
          } catch {
            continue;
          }
        }
      }
      return false;
    });
  } catch {
    return false;
  }
}

/**
 * Cierra modales/popups overlay que pueden bloquear el contenido del
 * listado (Doradobet muestra un modal de "Iniciar Sesión" al entrar
 * fresh, por ejemplo). Estrategia en cascada:
 *
 *   1. Buscar botones con aria-label="Close"/"Cerrar".
 *   2. Buscar elementos con clase que contenga "close" / "modal-close" /
 *      "dialog-close".
 *   3. Buscar botones cuyo texto sea "X", "×", "✕", "✗".
 *   4. Si nada funciona, presionar tecla Escape.
 *
 * Repite hasta 3 veces porque puede haber modales en cadena (cookie banner
 * + login modal + promo modal). Devuelve la cantidad cerrados.
 */
async function cerrarModalesOverlay(page) {
  let cerrados = 0;
  for (let i = 0; i < 3; i++) {
    const cerrado = await page
      .evaluate(() => {
        // 1. aria-label
        const SELECTORES_ARIA = [
          '[aria-label="Close"]',
          '[aria-label="close"]',
          '[aria-label="Cerrar"]',
          '[aria-label="cerrar"]',
          '[aria-label="Cerrar modal"]',
          '[aria-label="Close dialog"]',
        ];
        for (const sel of SELECTORES_ARIA) {
          try {
            const el = document.querySelector(sel);
            if (el instanceof HTMLElement) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.width < 100) {
                el.click();
                return "aria-label";
              }
            }
          } catch {
            /* sigue */
          }
        }

        // 2. Clase con "close" o "modal-close"
        const SELECTORES_CLASE = [
          '[class*="modal-close" i]',
          '[class*="dialog-close" i]',
          '[class*="popup-close" i]',
          'button[class*="close" i]',
        ];
        for (const sel of SELECTORES_CLASE) {
          try {
            const el = document.querySelector(sel);
            if (el instanceof HTMLElement) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.width < 100) {
                el.click();
                return "class-close";
              }
            }
          } catch {
            /* sigue */
          }
        }

        // 3. Botón con texto Unicode close (×, ✕, ✗).
        // CRÍTICO: NO incluir "X" mayúscula porque colisiona con links
        // al perfil Twitter/X (ej. footer de Stake tiene <a> con texto
        // "X" hacia x.com/PeruStake). Bug detectado en la v3.
        // También excluimos <a> con href fuera del dominio actual.
        const botones = document.querySelectorAll(
          "button, [role='button'], span, div",
        );
        for (const el of Array.from(botones)) {
          if (!(el instanceof HTMLElement)) continue;
          const txt = (el.innerText ?? el.textContent ?? "").trim();
          if (txt === "×" || txt === "✕" || txt === "✗") {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.width < 60) {
              el.click();
              return "x-button";
            }
          }
        }

        return null;
      })
      .catch(() => null);

    if (cerrado) {
      cerrados++;
      await page.waitForTimeout(800);
    } else {
      // Fallback: presionar Escape.
      try {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      } catch {
        /* ignore */
      }
      break;
    }
  }
  return cerrados;
}

/**
 * Detecta todos los iframes del documento y devuelve metadata útil para
 * diagnosticar dónde vive realmente el contenido del sportsbook (algunos
 * SPAs como Apuesta Total embeben el sportsbook en un iframe externo).
 */
async function detectarIframes(page) {
  return page.evaluate(() => {
    const out = [];
    for (const f of Array.from(document.querySelectorAll("iframe"))) {
      if (!(f instanceof HTMLIFrameElement)) continue;
      const rect = f.getBoundingClientRect();
      let sameOrigin = false;
      let originSrc = "";
      try {
        originSrc = new URL(f.src, window.location.href).origin;
        sameOrigin = originSrc === window.location.origin;
      } catch {
        sameOrigin = false;
      }
      out.push({
        src: f.src || "",
        srcOrigin: originSrc,
        sameOrigin,
        ancho: Math.round(rect.width),
        alto: Math.round(rect.height),
        visible: rect.width > 100 && rect.height > 100,
        id: f.id || "",
        name: f.name || "",
      });
    }
    return out;
  });
}

/**
 * Click + esperar navegación. Si el candidato tiene href, navega
 * directo. Si no, clickea el elemento por texto y espera URL change
 * o aparición de selectores específicos del detalle.
 */
async function clickYEsperarNavegacion(page, candidato) {
  if (candidato.href && candidato.href.startsWith("http")) {
    try {
      await page.goto(candidato.href, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      return { navegado: true, urlNueva: page.url(), via: "href" };
    } catch (err) {
      return { navegado: false, error: err.message, via: "href" };
    }
  }

  const urlAntes = page.url();
  try {
    const clicked = await page.evaluate((textoBuscado) => {
      const norm = (s) =>
        s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase();
      const inicio = norm(textoBuscado).slice(0, 30);
      const SEL = "div, a, button, [role='button'], li, article";
      for (const el of Array.from(document.querySelectorAll(SEL))) {
        if (!(el instanceof HTMLElement)) continue;
        const txt = norm(el.innerText ?? el.textContent ?? "");
        if (txt.startsWith(inicio)) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 25) {
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
    }, candidato.textoMuestra);

    if (!clicked) {
      return { navegado: false, error: "no se pudo clickear", via: "click" };
    }

    try {
      await page.waitForURL((url) => String(url) !== urlAntes, {
        timeout: 8_000,
      });
      return { navegado: true, urlNueva: page.url(), via: "click" };
    } catch {
      // No cambió URL — esperar 3s por si es modal in-page.
      await page.waitForTimeout(3000);
      return {
        navegado: false,
        error: "URL no cambió tras click (¿modal in-page?)",
        urlActual: page.url(),
        via: "click",
      };
    }
  } catch (err) {
    return { navegado: false, error: err.message, via: "click" };
  }
}

/**
 * Genera un análisis estructural del DOM actual:
 *   - conteo de tags
 *   - top 30 clases más frecuentes
 *   - todos los atributos data-* únicos vistos
 *   - top 15 prefijos de clase (ej. "wpt-", "wol-")
 *   - muestra de 50 links visibles (texto + href)
 *   - elementos que probablemente sean tarjetas de partido
 *     (heurística: contienen "-", "vs", o un decimal tipo cuota)
 *
 * Esto es el insumo principal para escribir extractores específicos
 * sin necesidad de pegar el HTML entero al asistente.
 */
async function generarAnalisisEstructural(page) {
  return page.evaluate(() => {
    const norm = (s) =>
      s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();

    const all = document.querySelectorAll("*");
    const totalElementos = all.length;

    // Conteo de tags.
    const tagsMap = {};
    for (const el of Array.from(all)) {
      const tag = el.tagName.toLowerCase();
      tagsMap[tag] = (tagsMap[tag] || 0) + 1;
    }
    const tags = Object.entries(tagsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([tag, count]) => ({ tag, count }));

    // Top clases.
    const claseCount = {};
    for (const el of Array.from(document.querySelectorAll("[class]"))) {
      const raw = el.className?.toString() ?? "";
      const classes = raw.split(/\s+/);
      for (const c of classes) {
        if (c && c.length > 0 && c.length < 60) {
          claseCount[c] = (claseCount[c] || 0) + 1;
        }
      }
    }
    const topClases = Object.entries(claseCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([clase, count]) => ({ clase, count }));

    // Atributos data-*
    const dataAttrs = new Set();
    for (const el of Array.from(all)) {
      for (const attr of Array.from(el.attributes ?? [])) {
        if (attr.name.startsWith("data-")) {
          dataAttrs.add(attr.name);
        }
      }
    }

    // Prefijos de clase comunes.
    const prefijos = {};
    for (const cls of Object.keys(claseCount)) {
      const idx = cls.indexOf("-");
      if (idx > 1 && idx < 9) {
        const p = cls.slice(0, idx);
        prefijos[p] = (prefijos[p] || 0) + claseCount[cls];
      }
    }
    const topPrefijos = Object.entries(prefijos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([prefijo, count]) => ({ prefijo, count }));

    // Muestra de links.
    const allLinks = Array.from(document.querySelectorAll("a[href]"));
    const muestraLinks = [];
    for (const a of allLinks) {
      if (!(a instanceof HTMLAnchorElement)) continue;
      const txt = (a.innerText ?? a.textContent ?? "").trim();
      if (txt.length === 0) continue;
      muestraLinks.push({
        text: txt.slice(0, 100),
        href: a.href,
      });
      if (muestraLinks.length >= 80) break;
    }

    // Elementos que parecen "tarjeta de partido": contiene "vs"/"-" + un
    // decimal (cuota) en su texto + bbox razonable. Útil para entender
    // dónde están los partidos en cada sportsbook.
    const probablesPartidos = [];
    const SEL_PARTIDO =
      "a, [role='link'], [role='button'], button, li, article, " +
      "[data-event-id], [data-match-id], [data-fixture-id]";
    for (const el of Array.from(document.querySelectorAll(SEL_PARTIDO))) {
      if (!(el instanceof HTMLElement)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 30) continue;
      if (rect.width > 1500) continue;
      const txt = (el.innerText ?? el.textContent ?? "").trim();
      if (txt.length < 15 || txt.length > 500) continue;
      const tieneSeparador = / vs\.? /i.test(txt) || / - /.test(txt);
      const tieneDecimal = /\b\d+\.\d{2}\b/.test(txt);
      if (!tieneSeparador && !tieneDecimal) continue;
      probablesPartidos.push({
        textoMuestra: txt.slice(0, 200),
        tagName: el.tagName,
        clases: el.className?.toString()?.slice(0, 100) ?? "",
        dataAttrs: Object.keys(el.dataset ?? {}),
        bbox: Math.round(rect.width * rect.height),
      });
      if (probablesPartidos.length >= 20) break;
    }

    return {
      totalElementos,
      tags,
      topClases,
      dataAttributos: Array.from(dataAttrs).sort(),
      topPrefijosClase: topPrefijos,
      muestraLinks,
      probablesPartidos,
    };
  });
}

/**
 * Captura el HTML del body actual, truncado a HTML_MAX_BYTES para no
 * inflar archivos. Devuelve el contenido como string.
 */
async function capturarHtmlBody(page) {
  try {
    const html = await page.evaluate(
      () => document.body?.outerHTML ?? "",
    );
    if (html.length > HTML_MAX_BYTES) {
      return (
        html.slice(0, HTML_MAX_BYTES) +
        `\n\n<!-- TRUNCADO en ${HTML_MAX_BYTES} bytes (HTML original ${html.length} bytes) -->`
      );
    }
    return html;
  } catch (err) {
    return `<!-- error capturando HTML: ${err.message} -->`;
  }
}

/**
 * Búsqueda específica para Stake (selectores ya validados).
 */
async function buscarPartidoStake(page, equipoLocal, equipoVisita) {
  return page.evaluate(
    ({ local, visita }) => {
      function norm(s) {
        return s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim();
      }
      const tokensLocal = norm(local)
        .split(" ")
        .filter((t) => t.length >= 4);
      const tokensVisita = norm(visita)
        .split(" ")
        .filter((t) => t.length >= 4);

      const rows = document.querySelectorAll(".wpt-table__row");
      for (const row of Array.from(rows)) {
        if (!(row instanceof HTMLElement)) continue;
        const teamLinks = row.querySelectorAll(".wpt-teams__team a");
        if (teamLinks.length < 2) continue;
        const tL = norm(teamLinks[0].textContent ?? "");
        const tV = norm(teamLinks[1].textContent ?? "");
        const matchLocal = tokensLocal.some((t) => tL.includes(t));
        const matchVisita = tokensVisita.some((t) => tV.includes(t));
        if (matchLocal && matchVisita) {
          const href = teamLinks[0].getAttribute("href") ?? null;
          return {
            equipoLocal: teamLinks[0].textContent?.trim() ?? "",
            equipoVisita: teamLinks[1].textContent?.trim() ?? "",
            href:
              href && href.startsWith("/")
                ? `${window.location.origin}${href}`
                : href,
          };
        }
      }
      return null;
    },
    { local: equipoLocal, visita: equipoVisita },
  );
}

/**
 * Búsqueda genérica para casas SIN selectores conocidos — usada en las
 * 6 casas que NO son Stake. Devuelve hasta 5 candidatos cuyo texto
 * contiene ambos equipos.
 */
async function buscarPartidoGenerico(page, equipoLocal, equipoVisita) {
  return page.evaluate(
    ({ local, visita }) => {
      function norm(s) {
        return s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim();
      }
      const tokensL = norm(local)
        .split(" ")
        .filter((t) => t.length >= 4);
      const tokensV = norm(visita)
        .split(" ")
        .filter((t) => t.length >= 4);
      const candidatos = [];
      const SEL =
        "a, [role='link'], button, [role='button'], li, article, " +
        "[data-event-id], [data-match-id], [data-fixture-id], " +
        "[class*='event' i], [class*='match' i], [class*='fixture' i], " +
        "[class*='game' i]";
      for (const el of Array.from(document.querySelectorAll(SEL))) {
        if (!(el instanceof HTMLElement)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 25) continue;
        if (rect.width > 1500 || rect.height > 600) continue;
        const txt = norm(el.innerText ?? el.textContent ?? "");
        if (txt.length < 8 || txt.length > 400) continue;
        const hL = tokensL.some((t) => txt.includes(t));
        const hV = tokensV.some((t) => txt.includes(t));
        if (hL && hV) {
          const href =
            el instanceof HTMLAnchorElement
              ? el.href
              : el.querySelector("a")?.href ?? null;
          candidatos.push({
            textoMuestra: txt.slice(0, 200),
            href,
            tagName: el.tagName,
            clases: el.className?.toString()?.slice(0, 100) ?? "",
            dataAttrs: Object.keys(el.dataset ?? {}),
          });
          if (candidatos.length >= 5) break;
        }
      }
      return candidatos;
    },
    { local: equipoLocal, visita: equipoVisita },
  );
}

/**
 * Extracción real de cuotas para Stake. Selectores validados desde el
 * HTML que pegó el admin en el chat el 2026-05-04.
 */
async function extraerCuotasStake(page) {
  return page.evaluate(() => {
    function parseOdd(value) {
      if (!value) return null;
      const v = parseFloat(value);
      if (!Number.isFinite(v) || v <= 1 || v > 100) return null;
      return v;
    }
    function norm(s) {
      return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
    }

    const allOdds = [];
    const els = document.querySelectorAll(".wol-odd");
    for (const el of Array.from(els)) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.classList.contains("locked")) continue;
      const infoEl = el.querySelector(".wol-odd__info");
      const infoText = infoEl?.textContent?.trim() ?? "";
      allOdds.push({
        oddValue: parseOdd(el.dataset.oddValue ?? null),
        oddId: el.dataset.oddId ?? null,
        teamSide: el.dataset.oddTeamSide ?? null,
        additionalValue: el.dataset.additionalValue ?? null,
        ttl: el.dataset.oddTtl ?? null,
        info: infoText,
        infoNorm: norm(infoText),
      });
    }

    // Lote V.2: el atributo data-odd-team_side solo aparece en el listado,
    // NO en la página de detalle. Identificamos 1X2 solo por oddId estable.
    const local1x2 = allOdds.find((o) => o.oddId === "3");
    const empate1x2 = allOdds.find((o) => o.oddId === "4");
    const visita1x2 = allOdds.find((o) => o.oddId === "5");
    const m1x2 =
      local1x2?.oddValue && empate1x2?.oddValue && visita1x2?.oddValue
        ? {
            local: local1x2.oddValue,
            empate: empate1x2.oddValue,
            visita: visita1x2.oddValue,
          }
        : null;

    const x1 = allOdds.find((o) => o.oddId === "6");
    const x12 = allOdds.find((o) => o.oddId === "7");
    const xx2 = allOdds.find((o) => o.oddId === "8");
    const mDoble =
      x1?.oddValue && x12?.oddValue && xx2?.oddValue
        ? { x1: x1.oddValue, x12: x12.oddValue, xx2: xx2.oddValue }
        : null;

    const over25 = allOdds.find(
      (o) => o.additionalValue === "2.5" && o.ttl === "_OVR",
    );
    const under25 = allOdds.find(
      (o) => o.additionalValue === "2.5" && o.ttl === "_UND",
    );
    const m25 =
      over25?.oddValue && under25?.oddValue
        ? { over: over25.oddValue, under: under25.oddValue }
        : null;

    let bttsSi = allOdds.find((o) => o.oddId === "216");
    let bttsNo = allOdds.find((o) => o.oddId === "217");
    if (!bttsSi || !bttsNo) {
      bttsSi =
        bttsSi ??
        allOdds.find(
          (o) =>
            o.infoNorm.includes("ambos") &&
            (o.infoNorm.endsWith(" si") || o.infoNorm.includes("- si")),
        );
      bttsNo =
        bttsNo ??
        allOdds.find(
          (o) =>
            o.infoNorm.includes("ambos") &&
            (o.infoNorm.endsWith(" no") || o.infoNorm.includes("- no")),
        );
    }
    const mBtts =
      bttsSi?.oddValue && bttsNo?.oddValue
        ? { si: bttsSi.oddValue, no: bttsNo.oddValue }
        : null;

    return {
      mercados: { m1x2, mDoble, mMasMenos25: m25, mBtts },
      totalOdds: allOdds.length,
      muestraOdds: allOdds.slice(0, 30),
    };
  });
}

// ─── Procesamiento por casa ────────────────────────────────────────────

async function probarCasa(casaConfig) {
  const {
    casa,
    url,
    waitExtraMs,
    cerrarModales = true,
    waitAntesDeCerrarMs = 0,
    iframeRegex,
    waitIframeMs = 4000,
    extraerEnListado = false,
  } = casaConfig;
  const tInicio = Date.now();
  console.log(`\n${"━".repeat(72)}`);
  console.log(`[${casa}]`);
  console.log("━".repeat(72));

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "es-PE",
    timezoneId: "America/Lima",
    viewport: { width: 1366, height: 800 },
  });
  const page = await context.newPage();

  const resultado = {
    casa,
    url,
    listado: {
      ok: false,
      httpStatus: null,
      titulo: "",
      urlFinal: "",
      bodyTextLength: 0,
      cookiesAceptadas: false,
      modalesCerrados: 0,
      iframes: [],
      ms: 0,
      error: null,
    },
    busqueda: {
      ok: false,
      candidatos: [],
      candidatoElegido: null,
    },
    detalle: {
      ok: false,
      url: null,
      titulo: "",
      bodyTextLength: 0,
      ms: 0,
      error: null,
    },
    extraccionStake: null,
    msTotal: 0,
  };

  // workTarget puede ser la page principal o un frame (cuando hay
  // iframeRegex configurado). Declarado fuera del try para que la fase
  // B pueda usarlo.
  let workTarget = page;
  let inFrame = false;

  // ── FASE A: navegación al listado ──
  try {
    console.log(`  [A] navegando: ${url}`);
    const tA = Date.now();
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    resultado.listado.httpStatus = response?.status() ?? null;

    await page.waitForTimeout(2000);
    resultado.listado.cookiesAceptadas = await intentarAceptarCookies(page);
    if (resultado.listado.cookiesAceptadas) {
      console.log(`  [A] cookies aceptadas`);
      await page.waitForTimeout(2000);
    } else {
      console.log(`  [A] cookies: sin banner detectado o no se pudo clickear`);
    }

    // Cerrar modales overlay solo si la config lo pide (Stake=false porque
    // tiene un link "X" hacia Twitter que el matcher confunde con un
    // botón close — bug detectado en v3).
    if (cerrarModales) {
      if (waitAntesDeCerrarMs > 0) {
        console.log(
          `  [A] esperando ${waitAntesDeCerrarMs}ms antes de cerrar modales (modal puede tardar en aparecer)`,
        );
        await page.waitForTimeout(waitAntesDeCerrarMs);
      }
      resultado.listado.modalesCerrados = await cerrarModalesOverlay(page);
      if (resultado.listado.modalesCerrados > 0) {
        console.log(
          `  [A] ${resultado.listado.modalesCerrados} modal(es) overlay cerrado(s)`,
        );
        await page.waitForTimeout(1500);
      }
    } else {
      console.log(`  [A] cerrarModales=false (config de la casa)`);
    }

    const sleepMs = waitExtraMs ?? SLEEP_HIDRATACION_DEFAULT_MS;
    await page.waitForTimeout(sleepMs);

    // Detectar iframes (puede ser que el sportsbook real esté embebido).
    resultado.listado.iframes = await detectarIframes(page);
    if (resultado.listado.iframes.some((f) => f.visible && f.ancho > 500)) {
      const grandes = resultado.listado.iframes.filter(
        (f) => f.visible && f.ancho > 500,
      );
      console.log(
        `  [A] ${grandes.length} iframe(s) grande(s) detectado(s)`,
      );
      for (const f of grandes) {
        console.log(
          `      iframe: ${f.ancho}x${f.alto} sameOrigin=${f.sameOrigin} src=${(f.src || "").slice(0, 100)}`,
        );
      }
    }

    // Si la config tiene iframeRegex, switchear al frame correcto para
    // hacer el resto del flujo (búsqueda + análisis estructural). El
    // screenshot y goto siguen sobre la page principal — solo evaluate /
    // querySelector / waitForSelector pasan al frame.
    if (iframeRegex) {
      console.log(
        `  [A] esperando ${waitIframeMs}ms para que cargue el iframe del sportsbook embebido`,
      );
      await page.waitForTimeout(waitIframeMs);
      const allFrames = page.frames();
      const sbFrame = allFrames.find(
        (f) => f.url() && iframeRegex.test(f.url()),
      );
      if (sbFrame) {
        try {
          await sbFrame.waitForLoadState("domcontentloaded", {
            timeout: 10_000,
          });
          await page.waitForTimeout(3000);
        } catch {
          /* el frame puede estar listo igual */
        }
        workTarget = sbFrame;
        inFrame = true;
        console.log(
          `  [A] OK · trabajando dentro del iframe: ${sbFrame.url().slice(0, 100)}`,
        );
      } else {
        console.log(
          `  [A] iframe esperado NO encontrado · ${allFrames.length} frames totales · pattern=${iframeRegex}`,
        );
      }
    }
    resultado.listado.inFrame = inFrame;

    const diag = await workTarget.evaluate(() => {
      const titulo = document.title?.slice(0, 200) ?? "";
      const urlFinal = window.location.href;
      const bodyText = document.body?.innerText ?? "";
      return {
        titulo,
        urlFinal,
        bodyTextLength: bodyText.length,
      };
    });
    Object.assign(resultado.listado, diag);

    const sospechas = [
      "acceso denegado",
      "blocked",
      "forbidden",
      "403",
      "404",
      "no disponible",
      "geo",
      "restringido",
      "checking your browser",
      "just a moment",
    ];
    const tituloSospechoso = sospechas.some((s) =>
      diag.titulo.toLowerCase().includes(s),
    );
    resultado.listado.ok = diag.bodyTextLength > 1500 && !tituloSospechoso;

    // Capturar artefactos. Screenshot SIEMPRE de la page principal
    // (no del frame). HTML y análisis desde workTarget (frame si aplica).
    await mkdir(DIR_SCREENSHOTS, { recursive: true });
    await mkdir(DIR_HTML, { recursive: true });
    await mkdir(DIR_ANALISIS, { recursive: true });
    await page.screenshot({
      path: join(DIR_SCREENSHOTS, `${casa}-listado.png`),
      fullPage: false,
    });
    const htmlListado = await capturarHtmlBody(workTarget);
    await writeFile(
      join(DIR_HTML, `${casa}-listado.html`),
      htmlListado,
      "utf-8",
    );
    const analisisListado = await generarAnalisisEstructural(workTarget);
    await writeFile(
      join(DIR_ANALISIS, `${casa}-listado.json`),
      JSON.stringify(analisisListado, null, 2),
      "utf-8",
    );

    resultado.listado.ms = Date.now() - tA;
    console.log(
      `  [A] ${resultado.listado.ok ? "OK  " : "FAIL"} status=${diag.httpStatus ?? "?"} body=${diag.bodyTextLength} (${resultado.listado.ms}ms)`,
    );
    console.log(`      titulo: "${diag.titulo.slice(0, 80)}"`);
  } catch (err) {
    resultado.listado.error = err.message;
    console.log(`  [A] FAIL ERROR: ${err.message}`);
  }

  // ── FASE B: búsqueda del partido ──
  // Búsqueda dentro de workTarget (page principal o iframe del sportsbook).
  if (resultado.listado.ok) {
    try {
      console.log(
        `  [B] buscando partido objetivo${inFrame ? " (dentro del iframe)" : ""}`,
      );
      if (casa === "stake") {
        const match = await buscarPartidoStake(
          workTarget,
          PARTIDO_OBJETIVO.equipoLocal,
          PARTIDO_OBJETIVO.equipoVisita,
        );
        if (match) {
          resultado.busqueda.ok = true;
          resultado.busqueda.candidatoElegido = match;
          resultado.busqueda.candidatos = [match];
          console.log(`  [B] OK · selectores específicos · href=${match.href}`);
        } else {
          console.log(`  [B] NO match con selectores Stake`);
        }
      } else {
        const candidatos = await buscarPartidoGenerico(
          workTarget,
          PARTIDO_OBJETIVO.equipoLocal,
          PARTIDO_OBJETIVO.equipoVisita,
        );
        resultado.busqueda.candidatos = candidatos;
        if (candidatos.length > 0) {
          resultado.busqueda.ok = true;
          resultado.busqueda.candidatoElegido = candidatos[0];
          console.log(
            `  [B] OK · ${candidatos.length} candidatos · primero: "${candidatos[0].textoMuestra.slice(0, 60)}" href=${candidatos[0].href ?? "(sin href)"}`,
          );
        } else {
          console.log(
            `  [B] NO se encontraron candidatos con heurística genérica`,
          );
        }
      }
    } catch (err) {
      console.log(`  [B] error: ${err.message}`);
    }
  }

  // ── FASE C: navegación al detalle ──
  // Skip si la casa tiene extraerEnListado=true (Coolbet, Te Apuesto):
  // las cuotas están en el listado mismo, no hace falta ir al detalle.
  if (extraerEnListado) {
    console.log(
      `  [C] skip navegación · extraerEnListado=true (cuotas viven en el listado)`,
    );
    resultado.detalle = {
      ...resultado.detalle,
      ok: true,
      url: page.url(),
      via: "extraerEnListado",
      bodyTextLength: resultado.listado.bodyTextLength,
    };
  } else if (resultado.busqueda.candidatoElegido) {
    try {
      console.log(`  [C] intentando navegar al detalle`);
      const tC = Date.now();
      const navResult = await clickYEsperarNavegacion(
        page,
        resultado.busqueda.candidatoElegido,
      );
      console.log(
        `  [C] ${navResult.navegado ? "OK" : "FAIL"} via=${navResult.via}${navResult.urlNueva ? ` urlNueva=${navResult.urlNueva}` : ""}${navResult.error ? ` error="${navResult.error}"` : ""}`,
      );
      resultado.detalle.via = navResult.via;
      resultado.detalle.error = navResult.error ?? null;

      if (!navResult.navegado) {
        // Si no logramos navegar, capturamos screenshot+HTML del estado
        // actual igual (por si hay modal in-page con cuotas).
        await page.screenshot({
          path: join(DIR_SCREENSHOTS, `${casa}-detalle.png`),
          fullPage: false,
        });
        const htmlPostClick = await capturarHtmlBody(page);
        await writeFile(
          join(DIR_HTML, `${casa}-detalle.html`),
          htmlPostClick,
          "utf-8",
        );
        const analisisPostClick = await generarAnalisisEstructural(page);
        await writeFile(
          join(DIR_ANALISIS, `${casa}-detalle.json`),
          JSON.stringify(analisisPostClick, null, 2),
          "utf-8",
        );
        resultado.detalle.url = page.url();
        resultado.detalle.ms = Date.now() - tC;
      } else {
        // Navegación exitosa — esperar hidratación.
        const sleepMs = waitExtraMs ?? SLEEP_HIDRATACION_DEFAULT_MS;
        await page.waitForTimeout(sleepMs);

      const diagDetalle = await page.evaluate(() => ({
        url: window.location.href,
        titulo: document.title?.slice(0, 200) ?? "",
        bodyTextLength: (document.body?.innerText ?? "").length,
      }));
      Object.assign(resultado.detalle, diagDetalle);
      resultado.detalle.ok = diagDetalle.bodyTextLength > 1500;

      await page.screenshot({
        path: join(DIR_SCREENSHOTS, `${casa}-detalle.png`),
        fullPage: false,
      });
      const htmlDetalle = await capturarHtmlBody(page);
      await writeFile(
        join(DIR_HTML, `${casa}-detalle.html`),
        htmlDetalle,
        "utf-8",
      );
      const analisisDetalle = await generarAnalisisEstructural(page);
      await writeFile(
        join(DIR_ANALISIS, `${casa}-detalle.json`),
        JSON.stringify(analisisDetalle, null, 2),
        "utf-8",
      );

      resultado.detalle.ms = Date.now() - tC;
      console.log(
        `      ${resultado.detalle.ok ? "OK  " : "FAIL"} body=${diagDetalle.bodyTextLength} (${resultado.detalle.ms}ms)`,
      );
      console.log(`      url: ${diagDetalle.url}`);
      } // cierra else navResult.navegado
    } catch (err) {
      resultado.detalle.error = err.message;
      console.log(`  [C] FAIL ERROR: ${err.message}`);
    }
  }

  // ── FASE D: extracción real de cuotas (solo Stake) ──
  if (casa === "stake" && resultado.detalle.ok) {
    try {
      console.log(`  [D] extrayendo cuotas con selectores Stake`);
      const extraccion = await extraerCuotasStake(page);
      resultado.extraccionStake = extraccion;
      const m = extraccion.mercados;
      console.log(
        `  [D] mercados: 1X2=${m.m1x2 ? "OK" : "FAIL"} DobleOp=${m.mDoble ? "OK" : "FAIL"} Más/Menos=${m.mMasMenos25 ? "OK" : "FAIL"} BTTS=${m.mBtts ? "OK" : "FAIL"} (totalOdds=${extraccion.totalOdds})`,
      );
      if (m.m1x2)
        console.log(
          `      1X2: ${m.m1x2.local} / ${m.m1x2.empate} / ${m.m1x2.visita}`,
        );
      if (m.mDoble)
        console.log(
          `      Doble Op: ${m.mDoble.x1} / ${m.mDoble.x12} / ${m.mDoble.xx2}`,
        );
      if (m.mMasMenos25)
        console.log(
          `      Más/Menos 2.5: ${m.mMasMenos25.over} / ${m.mMasMenos25.under}`,
        );
      if (m.mBtts)
        console.log(`      BTTS: ${m.mBtts.si} / ${m.mBtts.no}`);
    } catch (err) {
      console.log(`  [D] FAIL ERROR: ${err.message}`);
    }
  }

  resultado.msTotal = Date.now() - tInicio;

  try {
    await context.close();
  } catch {
    /* ignore */
  }
  try {
    await browser.close();
  } catch {
    /* ignore */
  }

  return resultado;
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  const sep = "═".repeat(72);
  console.log(sep);
  console.log(
    "Validación geo-test + reconocimiento estructural + extracción Stake",
  );
  console.log(sep);
  console.log(`Partido objetivo: ${PARTIDO_OBJETIVO.equipoLocal} vs ${PARTIDO_OBJETIVO.equipoVisita}`);
  console.log("Vas a ver ventanas de Chromium abrirse una por una.");
  console.log("Cada casa tarda ~25-40s. Total: ~4-6 minutos.");
  console.log(sep);

  const resultados = [];
  for (const item of URLS) {
    const r = await probarCasa(item);
    resultados.push(r);
  }

  // Resumen final.
  console.log("\n" + sep);
  console.log("RESUMEN GLOBAL");
  console.log(sep);
  console.log(
    "casa             listado  partido  detalle  ms total".padEnd(72),
  );
  console.log("─".repeat(72));
  for (const r of resultados) {
    const flagListado = r.listado.ok ? "OK  " : "FAIL";
    const flagPartido = r.busqueda.ok ? "OK  " : "FAIL";
    const flagDetalle = r.detalle.ok ? "OK  " : "—   ";
    console.log(
      `${r.casa.padEnd(15)}  ${flagListado}     ${flagPartido}     ${flagDetalle}     ${String(r.msTotal).padStart(6)}ms`,
    );
  }

  // Resumen específico de Stake.
  const rStake = resultados.find((r) => r.casa === "stake");
  console.log("\n" + sep);
  console.log("VALIDACIÓN END-TO-END DE STAKE");
  console.log(sep);
  if (!rStake?.extraccionStake) {
    console.log("⚠ No se llegó a extraer cuotas (algo falló antes).");
  } else {
    const m = rStake.extraccionStake.mercados;
    const flag1x2 = m.m1x2 ? "✓" : "✗";
    const flagDoble = m.mDoble ? "✓" : "✗";
    const flagMm = m.mMasMenos25 ? "✓" : "✗";
    const flagBtts = m.mBtts ? "✓" : "✗";
    const todosOk = m.m1x2 && m.mDoble && m.mMasMenos25 && m.mBtts;
    console.log(`${flag1x2} 1X2:           ${m.m1x2 ? `${m.m1x2.local} / ${m.m1x2.empate} / ${m.m1x2.visita}` : "no extraído"}`);
    console.log(`${flagDoble} Doble Op:      ${m.mDoble ? `${m.mDoble.x1} / ${m.mDoble.x12} / ${m.mDoble.xx2}` : "no extraído"}`);
    console.log(`${flagMm} Más/Menos 2.5: ${m.mMasMenos25 ? `${m.mMasMenos25.over} / ${m.mMasMenos25.under}` : "no extraído"}`);
    console.log(`${flagBtts} BTTS:          ${m.mBtts ? `${m.mBtts.si} / ${m.mBtts.no}` : "no extraído"}`);
    console.log("");
    console.log(
      todosOk
        ? "🎯 VALIDADO: extractor Stake funciona end-to-end desde tu PC con IP peruana."
        : "⚠ FAIL parcial: algunos mercados no se extrajeron — revisar selectores.",
    );
  }
  console.log(sep);

  // Guardar resumen consolidado.
  await writeFile(
    "resumen.json",
    JSON.stringify(resultados, null, 2),
    "utf-8",
  );
  console.log("\nArchivos generados:");
  console.log("  resumen.json                — consolidado de todo");
  console.log("  screenshots/                — capturas visuales");
  console.log("  html/                       — HTML completo (truncado 500KB)");
  console.log("  analisis-estructural/       — clases, atributos data-*, candidatos");
  console.log("");
  console.log("Mandale al asistente:");
  console.log("  1. resumen.json");
  console.log("  2. La carpeta entera analisis-estructural/ (zip-eala desde");
  console.log("     el Explorador de Windows: click derecho → Enviar a →");
  console.log("     Carpeta comprimida)");
  console.log("");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
