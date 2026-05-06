/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Prueba LOCAL completa de scrapers (Lote V.12.5 fase 0 — V3).
 *
 * V3:
 *  - Usa el perfil REAL de Chrome del usuario (cookies de sesión válidas
 *    para pasar WAFs como Imperva en Coolbet).
 *  - Captura todos los JSONs (sin filtro de keywords).
 *  - Para cada casa, llama al parser específico que extrae los 4 mercados
 *    (1X2, Doble Op, Más/Menos 2.5, BTTS) del JSON real capturado.
 *  - Valida que los 4 mercados estén presentes (`mercadosFaltantes`).
 *  - Reporta status final con cuotas extraídas.
 *
 * REQUISITO: Cerrar Google Chrome antes de correr este script. Chrome no
 * permite 2 instancias del mismo perfil simultáneamente.
 *
 * Cómo correrlo:
 *   1. Cerrá todas las ventanas de Chrome (o ejecutá `taskkill /F /IM chrome.exe` en cmd).
 *   2. pnpm --filter @habla/web run probar-scrapers
 *
 * NO toca Railway, NO toca Postgres.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import { similitudEquipos } from "../lib/services/scrapers/fuzzy-match";
import { mercadosFaltantes } from "../lib/services/scrapers/types";
import {
  detectarLigaCanonica,
  type LigaCanonica,
} from "../lib/services/scrapers/ligas-id-map";

chromium.use(StealthPlugin());

// ─── Config: 13 ligas × 6 casas activas (Coolbet excluido por WAF, Stake reincluído) ───
//
// URLs validadas en el Lote V.10.2/V.10.3 (legacy `playwright-config.ts`).
// Ahora usadas para el motor V.12 (Playwright + XHR intercept + click).

type Casa = "doradobet" | "apuesta_total" | "betano" | "inkabet" | "te_apuesto" | "stake";

const URLS_LISTING_POR_LIGA: Record<LigaCanonica, Partial<Record<Casa, string>>> = {
  "Liga 1 Perú": {
    doradobet: "https://doradobet.com/deportes/liga/4042",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=170&league=203110137349808128",
    betano: "https://www.betano.pe/sport/futbol/peru/liga-1/17079/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/peru/peru-liga-1?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/peru/liga-1-te-apuesto?id=1,476,1899",
    stake: "https://stake.pe/deportes/football/peru/primera-division",
  },
  "Premier League": {
    doradobet: "https://doradobet.com/deportes/liga/2936",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=260&league=24",
    betano: "https://www.betano.pe/sport/futbol/inglaterra/premier-league/1/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/inglaterra/inglaterra-premier-league?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/inglaterra/premier-league?id=1,139,1105",
    stake: "https://stake.pe/deportes/football/england/premier-league",
  },
  "La Liga": {
    doradobet: "https://doradobet.com/deportes/liga/2941",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=65&league=38",
    betano: "https://www.betano.pe/sport/futbol/espana/laliga/5/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/espana/espana-la-liga?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/espana/laliga?id=1,25,1141",
    stake: "https://stake.pe/deportes/football/spain/la-liga",
  },
  "UEFA Champions League": {
    doradobet: "https://doradobet.com/deportes/liga/16808",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=256&league=125",
    betano:
      "https://www.betano.pe/sport/futbol/campeonatos/champions-league/188566/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/champions-league/uefa-champions-league?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/uefa-champions-league?id=1,143,1417",
    stake: "https://stake.pe/deportes/football/europe/uefa-champions-league",
  },
  "Copa Libertadores": {
    doradobet: "https://doradobet.com/deportes/liga/3709",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=277&league=133",
    betano:
      "https://www.betano.pe/sport/futbol/campeonatos/copa-libertadores/189817/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/copa-libertadores/copa-libertadores?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/conmebol-libertadores?id=1,143,10009",
    stake: "https://stake.pe/deportes/football/south-america/copa-libertadores",
  },
  "Serie A": {
    doradobet: "https://doradobet.com/deportes/liga/2942",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=107&league=74",
    betano: "https://www.betano.pe/sport/futbol/italia/serie-a/1635/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/italia/italia-serie-a?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/italia/serie-a?id=1,379,1109",
    stake: "https://stake.pe/deportes/football/italy/serie-a",
  },
  Bundesliga: {
    doradobet: "https://doradobet.com/deportes/liga/2950",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=54&league=110",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/alemania/24/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/alemania/alemania-bundesliga?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/alemania/bundesliga?id=1,89,1139",
    stake: "https://stake.pe/deportes/football/germany/bundesliga",
  },
  "Ligue 1": {
    doradobet: "https://doradobet.com/deportes/liga/2943",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=72&league=25",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/francia/23/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/francia/francia-ligue-1?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/francia/liga-1?id=1,684,1510",
    stake: "https://stake.pe/deportes/football/france/ligue-1",
  },
  Brasileirão: {
    doradobet: "https://doradobet.com/deportes/liga/11318",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=29&league=530",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/brasil/10004/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/brasil/brasil-serie-a?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/brasil/brasileiro,-serie-a?id=1,129,130",
    stake: "https://stake.pe/deportes/football/brazil/serie-a",
  },
  "Liga Profesional Argentina": {
    doradobet: "https://doradobet.com/deportes/liga/3075",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=11&league=150",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/argentina/11319/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/argentina/argentina-liga-profesional?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/argentina/primera-lpf?id=1,56,9892",
    stake: "https://stake.pe/deportes/football/argentina/primera-division",
  },
  "UEFA Europa League": {
    doradobet: "https://doradobet.com/deportes/liga/16809",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=256&league=2719",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/europa-league/188567/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/europa-league/uefa-europa-league?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/uefa-europa-league?id=1,143,1952",
    stake: "https://stake.pe/deportes/football/europe/uefa-europa-league",
  },
  "Copa Sudamericana": {
    doradobet: "https://doradobet.com/deportes/liga/3108",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=277&league=1699",
    betano:
      "https://www.betano.pe/sport/futbol/campeonatos/copa-sudamericana/189818/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/copa-sudamericana/copa-sudamericana?tab=liveAndUpcoming",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional-clubes/conmebol-sudamericana?id=1,143,10531",
    stake: "https://stake.pe/deportes/football/south-america/copa-sudamericana",
  },
  "Mundial 2026": {
    doradobet: "https://doradobet.com/deportes/liga/3146",
    apuesta_total:
      "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=245&league=453456007969169408",
    betano: "https://www.betano.pe/sport/futbol/campeonatos/mundial/189813/",
    inkabet:
      "https://inkabet.pe/pe/apuestas-deportivas/futbol/mundial/copa-del-mundo?tab=home",
    te_apuesto:
      "https://www.teapuesto.pe/sport/detail/futbol/internacional/copa-mundial?id=1,1,1197",
    stake: "https://stake.pe/deportes/football/world/fifa-world-cup",
  },
};

const CASAS_ACTIVAS: Casa[] = [
  "doradobet",
  "apuesta_total",
  "betano",
  "inkabet",
  "te_apuesto",
  // "stake" — desactivado: Stake usa nombres cortos/abreviaturas (PSG,
  // Man United, Atlético) que no fuzzy-matchean con la canónica de
  // api-football. Necesita mini-mapa de aliases o resolverse vía
  // AliasEquipo del motor V.11. Reactivar cuando se decida cómo cubrir
  // ese caso.
];

// Filtro opcional: si tiene casos, solo prueba esas casas. Vacío = todas.
const CASAS_A_PROBAR: string[] = [];

const UMBRAL_FUZZY = 0.7;
const TIEMPO_ESPERA_MS = 15000;
const MIN_BYTES = 500;

// ─── Helpers de detección de partido en texto/JSON ──────────────────
//
// Reemplazan el viejo `TOKEN_DISCRIMINADOR` hardcodeado ("cajamarca").
// Ahora derivamos los tokens distintivos del partido buscado (cada
// palabra ≥ 3 chars del nombre local + visita).

interface PartidoTest {
  equipoLocal: string;
  equipoVisita: string;
  liga: string;
}

function tokensDistintivos(equipo: string): string[] {
  return equipo
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\wáéíóúüñ]/g, "")) // quitar puntuación
    .filter((w) => w.length >= 3);
}

function textoContienePartido(
  txt: string,
  partido: PartidoTest,
): { local: boolean; visita: boolean } {
  const lower = txt.toLowerCase();
  const wordsL = tokensDistintivos(partido.equipoLocal);
  const wordsV = tokensDistintivos(partido.equipoVisita);
  return {
    local: wordsL.some((w) => lower.includes(w)),
    visita: wordsV.some((w) => lower.includes(w)),
  };
}

function jsonContieneRastroPartido(jsonStr: string, partido: PartidoTest): boolean {
  const r = textoContienePartido(jsonStr, partido);
  return r.local || r.visita;
}

function jsonContieneAmbosLados(jsonStr: string, partido: PartidoTest): boolean {
  const r = textoContienePartido(jsonStr, partido);
  return r.local && r.visita;
}

// ─── Tipos ──────────────────────────────────────────────────────────

type Cuotas = {
  "1x2"?: { local: number; empate: number; visita: number };
  doble_op?: { x1: number; x12: number; xx2: number };
  mas_menos_25?: { over: number; under: number };
  btts?: { si: number; no: number };
};

interface JsonCapturado {
  url: string;
  bytes: number;
  body: any;
  fase: "listing" | "detalle";
}

interface ResultadoParser {
  cuotas: Cuotas;
  eventoNombre?: string;
  eventoId?: string | number;
  jsonUrl?: string;
  // Datos opcionales para que el orquestador (probarCasa) decida pasos
  // post-match (ej. construir URL detalle dinámica).
  fixtureRaw?: any;
}

// ─── Helpers ────────────────────────────────────────────────────────

function detectarChromePath(): string | undefined {
  if (process.env.LOCAL_CHROME_PATH) return process.env.LOCAL_CHROME_PATH;
  const candidatos =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          path.join(
            os.homedir(),
            "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
          ),
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium-browser"];
  for (const ruta of candidatos) {
    try {
      if (fs.existsSync(ruta)) return ruta;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function detectarPerfilRealChrome(): string | undefined {
  if (process.platform === "win32") {
    const ruta = path.join(
      os.homedir(),
      "AppData",
      "Local",
      "Google",
      "Chrome",
      "User Data",
      "Default",
    );
    return fs.existsSync(ruta) ? ruta : undefined;
  }
  return undefined;
}

function priceOk(v: any): number | null {
  return typeof v === "number" && v > 1 && v < 100 ? v : null;
}

function norm(s: string | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// ─── Helpers para doble navegación específica por casa ─────────────

/**
 * Busca el slug del partido en cualquier JSON capturado de Inkabet.
 * Inkabet expone slugs como "futbol/peru/peru-liga-1/utc-fc-cajamarca"
 * en `data.events[*].slug`, `slug` directo, o anidado en widgets.
 */
function encontrarSlugInkabet(
  jsons: JsonCapturado[],
  partido: PartidoTest,
): string | null {
  for (const j of jsons) {
    const slug = walkBuscarSlug(j.body, partido);
    if (slug) return slug;
  }
  return null;
}

function walkBuscarSlug(
  obj: any,
  partido: PartidoTest,
  depth = 0,
): string | null {
  if (depth > 25 || obj === null || obj === undefined) return null;
  if (typeof obj === "string") {
    // Slug típico: contiene "/" + tokens del partido (al menos un lado)
    if (obj.includes("/") && jsonContieneRastroPartido(obj, partido)) {
      // Filtrar slugs que sean de competición (no del partido) — el del
      // partido suele tener formato "{liga}/{equipo-vs-equipo}".
      // Heurística: el slug del partido tiene >= 4 segmentos Y debería
      // contener AMBOS lados del partido (no solo uno).
      const partes = obj.split("/").filter(Boolean);
      if (partes.length >= 4 && jsonContieneAmbosLados(obj, partido)) return obj;
    }
    return null;
  }
  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = walkBuscarSlug(item, partido, depth + 1);
        if (found) return found;
      }
    } else {
      // Preferir el field "slug" o "neutralPath" si existe.
      for (const k of ["slug", "neutralPath", "url", "path"]) {
        if (typeof obj[k] === "string") {
          const found = walkBuscarSlug(obj[k], partido, depth + 1);
          if (found) return found;
        }
      }
      for (const k of Object.keys(obj)) {
        const found = walkBuscarSlug(obj[k], partido, depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * Para Apuesta Total: fetch directo al endpoint markets/all con
 * marketTypes específicos para Doble Op (DC, ML9). El fetch se ejecuta
 * desde el contexto del browser (con cookies + sesión) — pasa el WAF
 * porque luce como una request natural de la SPA.
 */
async function fetchDobleOpApuestaTotal(
  page: any,
  eventId: string,
): Promise<any[] | null> {
  const url = `https://prod20392.kmianko.com/api/eventlist/eu/markets/all?markets=${eventId}:DC|ML9`;
  try {
    return await page.evaluate(async (urlFetch: string) => {
      try {
        const res = await fetch(urlFetch, { credentials: "include" });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    }, url);
  } catch {
    return null;
  }
}

// ─── Cerrar overlays + scroll (helpers de páginas) ──────────────────

async function cerrarOverlays(page: any): Promise<string[]> {
  try {
    return await page.evaluate(() => {
      const acciones: string[] = [];
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
            acciones.push(`sel:${sel.slice(0, 40)}`);
            return acciones;
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
            acciones.push(`txt:${texto.slice(0, 30)}`);
            return acciones;
          } catch {
            /* ignore */
          }
        }
      }
      return acciones;
    });
  } catch {
    return [];
  }
}

// Stake-específico: usa getBoundingClientRect en lugar de offsetParent
// para detectar elementos visibles. offsetParent === null para
// elementos con position:fixed (caso del banner cookies de Stake), así
// que la check anterior los descartaba erróneamente.
async function cerrarOverlaysStake(page: any): Promise<string[]> {
  try {
    return await page.evaluate(() => {
      const acciones: string[] = [];
      const norm = (s: string): string =>
        s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .trim();
      // Función que detecta si un elemento está realmente visible.
      // NO usa offsetParent porque falla con position:fixed.
      const esVisible = (el: HTMLElement): boolean => {
        try {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") return false;
          if (parseFloat(style.opacity || "1") === 0) return false;
          return true;
        } catch {
          return false;
        }
      };
      // 1. Selectores específicos comunes
      const SELS = [
        '[data-testid*="cookie" i] button',
        '[class*="cookie-banner" i] button',
        '[class*="cookieBanner" i] button',
        '[class*="cookie-notice" i] button',
        '[class*="CookieBanner" i] button',
        '[class*="CookieConsent" i] button',
        '[class*="cookieConsent" i] button',
        '[id*="cookie" i] button',
        'button[class*="accept" i]',
        'button[class*="acept" i]',
        'button[class*="acepto" i]',
      ];
      for (const sel of SELS) {
        const els = document.querySelectorAll<HTMLElement>(sel);
        for (const el of els) {
          if (!esVisible(el)) continue;
          try {
            el.click();
            acciones.push(`sel:${sel.slice(0, 40)}`);
          } catch {
            /* ignore */
          }
        }
      }
      // 2. Buscar botones por texto (más permisivo que el genérico)
      const botones = Array.from(
        document.querySelectorAll<HTMLElement>('button, [role="button"]'),
      );
      const TEXTOS = [
        "acepto",
        "aceptar",
        "aceptar todas",
        "aceptar cookies",
        "accept",
        "ok",
        "entendido",
        "got it",
        "i accept",
        "permitir todas",
        "allow all",
        "tengo +18",
        "soy mayor de edad",
        "+18",
      ];
      for (const b of botones) {
        if (!esVisible(b)) continue;
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
        if (!texto || texto.length < 2 || texto.length > 30) continue;
        if (TEXTOS.some((t) => texto === t || texto.startsWith(t))) {
          try {
            b.click();
            acciones.push(`txt:${texto.slice(0, 30)}`);
          } catch {
            /* ignore */
          }
        }
      }
      return acciones;
    });
  } catch {
    return [];
  }
}

// Scroll MUY agresivo para forzar lazy load completo
async function scrollAgresivo(page: any): Promise<void> {
  try {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let pos = 0;
        const step = 400;
        const id = setInterval(() => {
          window.scrollBy(0, step);
          pos += step;
          // Llegar hasta el final (no la mitad). Cap a 12000px o end.
          const target = Math.min(12000, document.body.scrollHeight);
          if (pos >= target) {
            clearInterval(id);
            // Volver al top
            window.scrollTo(0, 0);
            setTimeout(resolve, 500);
          }
        }, 250);
        setTimeout(() => {
          clearInterval(id);
          resolve();
        }, 8000);
      });
    });
  } catch {
    /* ignore */
  }
}

async function scrollSuave(page: any): Promise<void> {
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

// ─── PARSERS POR CASA ───────────────────────────────────────────────

// Doradobet (Altenar)
function parsearDoradobet(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ResultadoParser | null {
  const j = jsons.find((x) =>
    x.url.includes("/widget/GetEvents") &&
    x.body?.events && Array.isArray(x.body.events),
  );
  if (!j) return null;

  const body = j.body;
  const competitorsById = new Map<number, any>();
  for (const c of body.competitors ?? []) competitorsById.set(c.id, c);

  let mejorEv: any = null;
  let mejorScore = 0;
  for (const ev of body.events ?? []) {
    const local = competitorsById.get(ev.competitorIds?.[0])?.name;
    const visita = competitorsById.get(ev.competitorIds?.[1])?.name;
    if (!local || !visita) continue;
    const score = Math.min(
      similitudEquipos(local, equipoLocal),
      similitudEquipos(visita, equipoVisita),
    );
    if (score > mejorScore) {
      mejorScore = score;
      mejorEv = ev;
    }
  }
  if (!mejorEv || mejorScore < UMBRAL_FUZZY) return null;

  // Combinar markets + odds de TODOS los JSONs Altenar capturados
  // (listing + detalle). El listing trae los 6 markets más populares;
  // el detalle trae todas las líneas de Total, etc.
  // IMPORTANTE: el LISTING gana en caso de colisión de id.
  const marketsById = new Map<number, any>();
  const oddsById = new Map<number, any>();
  // Pasada 1: solo listing (`body.events && body.markets`)
  for (const x of jsons) {
    const b = x.body;
    if (
      !b ||
      typeof b !== "object" ||
      !Array.isArray(b.events) ||
      !Array.isArray(b.markets)
    ) {
      continue;
    }
    for (const m of b.markets) {
      if (m && typeof m.id === "number") marketsById.set(m.id, m);
    }
    if (Array.isArray(b.odds)) {
      for (const o of b.odds) {
        if (o && typeof o.id === "number") oddsById.set(o.id, o);
      }
    }
  }
  // Pasada 2: detalle u otros JSONs Altenar — solo agregar si NO existe.
  // El detalle puede traer markets/odds en `markets`+`odds` arrays
  // top-level, O en `childMarkets`+`odds` (Altenar separa "principales"
  // de "alternativos"). Procesamos ambos.
  for (const x of jsons) {
    const b = x.body;
    if (!b || typeof b !== "object") continue;
    if (Array.isArray(b.events) && Array.isArray(b.markets)) continue;
    // Markets en top-level array
    if (Array.isArray(b.markets)) {
      for (const m of b.markets) {
        if (m && typeof m.id === "number" && !marketsById.has(m.id)) {
          marketsById.set(m.id, m);
        }
      }
    }
    // ChildMarkets (alternativos / líneas extras)
    if (Array.isArray(b.childMarkets)) {
      for (const m of b.childMarkets) {
        if (m && typeof m.id === "number" && !marketsById.has(m.id)) {
          marketsById.set(m.id, m);
        }
      }
    }
    if (Array.isArray(b.odds)) {
      for (const o of b.odds) {
        if (o && typeof o.id === "number" && !oddsById.has(o.id)) {
          oddsById.set(o.id, o);
        }
      }
    }
  }
  // marketIds del evento: combinar
  // a) marketIds de mejorEv (listing)
  // b) markets cuya `eventId` apunte a mejorEv.id (detalle con eventId)
  // c) markets de un body GetEventDetails cuyo body.id/feedEventId
  //    matchee mejorEv.id (cada market en ese body NO tiene eventId
  //    explícito porque el body entero es del evento).
  const marketIdsDelEvento = new Set<number>(
    Array.isArray(mejorEv.marketIds) ? mejorEv.marketIds : [],
  );
  for (const m of marketsById.values()) {
    if (m.eventId === mejorEv.id) marketIdsDelEvento.add(m.id);
  }
  for (const x of jsons) {
    const b = x.body;
    if (!b || typeof b !== "object" || Array.isArray(b)) continue;
    const bodyEvtId = b.id ?? b.feedEventId;
    if (bodyEvtId !== mejorEv.id) continue;
    for (const arr of [b.markets, b.childMarkets]) {
      if (!Array.isArray(arr)) continue;
      for (const m of arr) {
        if (m && typeof m.id === "number") marketIdsDelEvento.add(m.id);
      }
    }
  }
  // Índice inverso oddsByMarketId: market.oddIds suele venir vacío en
  // GetEventDetails — las odds tienen `marketId` que apunta al market.
  const oddsByMarketId = new Map<number, any[]>();
  for (const o of oddsById.values()) {
    if (typeof o.marketId === "number") {
      const arr = oddsByMarketId.get(o.marketId) ?? [];
      arr.push(o);
      oddsByMarketId.set(o.marketId, arr);
    }
  }

  // Debug compacto: cuántos markets del evento, cuántas líneas de Total
  const tot18 = Array.from(marketIdsDelEvento)
    .map((mid) => marketsById.get(mid))
    .filter((m): m is any => Boolean(m) && m.typeId === 18);
  const svDeTotales = tot18.map((m) => m.sv).filter(Boolean);
  console.log(
    `  [doradobet/debug] ${marketIdsDelEvento.size} markets del evento · líneas Total: [${svDeTotales.join(", ") || "(ninguna)"}]`,
  );

  const cuotas: Cuotas = {};
  for (const mid of marketIdsDelEvento) {
    const m = marketsById.get(mid);
    if (!m) continue;
    // Resolver odds del market: primero via m.oddIds (listing),
    // fallback via índice inverso (detalle GetEventDetails).
    let odds = (m.oddIds ?? [])
      .map((id: number) => oddsById.get(id))
      .filter(Boolean);
    if (odds.length === 0) {
      odds = oddsByMarketId.get(m.id) ?? [];
    }

    if (m.typeId === 1) {
      const l = priceOk(odds.find((o: any) => o.typeId === 1)?.price);
      const e = priceOk(odds.find((o: any) => o.typeId === 2)?.price);
      const v = priceOk(odds.find((o: any) => o.typeId === 3)?.price);
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    } else if (m.typeId === 10) {
      const x1 = priceOk(odds.find((o: any) => o.typeId === 9)?.price);
      const x12 = priceOk(odds.find((o: any) => o.typeId === 10)?.price);
      const xx2 = priceOk(odds.find((o: any) => o.typeId === 11)?.price);
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    } else if (m.typeId === 18 && m.sv === "2.5") {
      const over = priceOk(odds.find((o: any) => o.typeId === 12)?.price);
      const under = priceOk(odds.find((o: any) => o.typeId === 13)?.price);
      if (over && under) cuotas.mas_menos_25 = { over, under };
    } else if (m.typeId === 29) {
      const si = priceOk(odds.find((o: any) => o.typeId === 74)?.price);
      const no = priceOk(odds.find((o: any) => o.typeId === 76)?.price);
      if (si && no) cuotas.btts = { si, no };
    }
  }

  const local = competitorsById.get(mejorEv.competitorIds?.[0])?.name;
  const visita = competitorsById.get(mejorEv.competitorIds?.[1])?.name;
  return {
    cuotas,
    eventoNombre: `${local} vs ${visita}`,
    eventoId: mejorEv.id,
    jsonUrl: j.url,
  };
}

// Apuesta Total (Kambi)
function parsearApuestaTotal(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ResultadoParser | null {
  // Paso 1: encontrar fixture (snapshot tiene Participants/_id/Type)
  const snapshot = jsons.find((j) => Array.isArray(j.body) && j.body.length > 0 && j.body[0]?.Participants);
  if (!snapshot) return null;
  const fixtures = snapshot.body as any[];
  let mejorFix: any = null;
  let mejorScore = 0;
  for (const f of fixtures) {
    const home = f.Participants?.find((p: any) => p.VenueRole === "Home")?.Name;
    const away = f.Participants?.find((p: any) => p.VenueRole === "Away")?.Name;
    if (!home || !away) continue;
    const score = Math.min(
      similitudEquipos(home, equipoLocal),
      similitudEquipos(away, equipoVisita),
    );
    if (score > mejorScore) {
      mejorScore = score;
      mejorFix = f;
    }
  }
  if (!mejorFix || mejorScore < UMBRAL_FUZZY) return null;

  // Paso 2: recolectar markets de TODOS los JSONs.
  // Walk MUY permisivo: cualquier objeto que parezca un market Kambi
  // (tiene MarketType + Selections), SIN filtrar por EventId. Confiamos
  // en que estamos navegando solo el partido buscado (listing+detalle),
  // así que cualquier market que aparezca pertenece a este partido.
  const eventId = mejorFix._id;
  const markets: any[] = [];
  const seenMarketIds = new Set<string>();
  function walkMarketsKambi(node: any, depth = 0): void {
    if (depth > 30 || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) walkMarketsKambi(item, depth + 1);
      return;
    }
    if (typeof node === "object") {
      // Market Kambi: MarketType (objeto) + Selections (array de objetos
      // con price-like fields). Mucho más permisivo que antes.
      const isMarket =
        node?.MarketType &&
        typeof node.MarketType === "object" &&
        Array.isArray(node?.Selections) &&
        node.Selections.length > 0;
      if (isMarket) {
        // Filtrar por EventId solo si está presente y no matchea — si no
        // tiene EventId (caso eventpage), aceptamos.
        if (
          node.EventId === undefined ||
          node.EventId === null ||
          node.EventId === eventId
        ) {
          const mid = node?._id ?? `${node.MarketType?._id}-${node.Name ?? ""}-${node.Selections.length}`;
          if (!seenMarketIds.has(mid)) {
            seenMarketIds.add(mid);
            markets.push(node);
          }
        }
        return;
      }
      for (const k of Object.keys(node)) walkMarketsKambi(node[k], depth + 1);
    }
  }
  for (const j of jsons) {
    walkMarketsKambi(j.body);
  }
  // Debug compacto: tipos de markets capturados
  const tipos = new Set(
    markets.map((m: any) => m?.MarketType?._id).filter(Boolean),
  );
  console.log(
    `  [apuesta_total/debug] ${markets.length} markets · types=${JSON.stringify(Array.from(tipos))}`,
  );

  const cuotas: Cuotas = {};
  for (const m of markets) {
    if (m.IsSuspended || m.IsRemoved) continue;
    const tipoId = m.MarketType?._id;
    const sels = (m.Selections ?? []).filter((s: any) => !s.IsDisabled && !s.IsRemoved);
    const sP = (s: any) => priceOk(s?.TrueOdds ?? Number(s?.DisplayOdds?.Decimal));

    if (tipoId === "ML0" && !cuotas["1x2"]) {
      const l = sP(sels.find((s: any) => s.OutcomeType === "Local" || s.Side === 1));
      const e = sP(sels.find((s: any) => s.OutcomeType === "Empate" || s.Side === 2));
      const v = sP(sels.find((s: any) => s.OutcomeType === "Visita" || s.Side === 3));
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    } else if (
      (tipoId === "DC" ||
        tipoId === "ML9" ||
        // Match por NOMBRE del mercado (más robusto que _id):
        // Apuesta Total a veces usa _id distinto pero el Name es estable.
        (typeof m.MarketType?.Name === "string" &&
          m.MarketType.Name.toLowerCase().includes("doble")) ||
        (typeof m.Name === "string" &&
          m.Name.toLowerCase().includes("doble"))) &&
      !cuotas.doble_op
    ) {
      const findByText = (target: string): any =>
        sels.find((s: any) => {
          const txt = `${norm(s.BetslipLine)} ${norm(s.Name)}`;
          return txt.includes(target);
        });
      // 1X = "1 o X" / "Local o Empate"
      const x1 =
        sP(sels.find((s: any) => norm(s.BetslipLine) === "1x")) ??
        sP(sels.find((s: any) => norm(s.OutcomeType) === "1x")) ??
        sP(findByText("local o empate")) ??
        sP(
          sels.find(
            (s: any) =>
              s.Side === 1 ||
              (typeof s.Name === "string" &&
                /local.*empate|1.*x/i.test(s.Name)),
          ),
        );
      // 12 = "1 o 2" / "Local o Visita"
      const x12 =
        sP(sels.find((s: any) => norm(s.BetslipLine) === "12")) ??
        sP(sels.find((s: any) => norm(s.OutcomeType) === "12")) ??
        sP(findByText("local o visita")) ??
        sP(findByText("local o ")) ?? // fallback: "Local o {Visita}"
        sP(
          sels.find(
            (s: any) =>
              (typeof s.Name === "string" && /1.*2/.test(s.Name)) ||
              s.Side === 4,
          ),
        );
      // X2 = "X o 2" / "Empate o Visita"
      const xx2 =
        sP(sels.find((s: any) => norm(s.BetslipLine) === "x2")) ??
        sP(sels.find((s: any) => norm(s.OutcomeType) === "x2")) ??
        sP(findByText("empate o ")) ??
        sP(
          sels.find(
            (s: any) =>
              (typeof s.Name === "string" &&
                /empate.*|x.*2/i.test(s.Name)) ||
              s.Side === 5,
          ),
        );
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    } else if (tipoId === "OU0" && !cuotas.mas_menos_25) {
      const over = sP(
        sels.find((s: any) => {
          const line = String(s.QAParam1 ?? "");
          return (
            (s.OutcomeType === "Más" || norm(s.BetslipLine).startsWith("mas")) &&
            (line === "2.5" || norm(s.BetslipLine).includes("2.5"))
          );
        }),
      );
      const under = sP(
        sels.find((s: any) => {
          const line = String(s.QAParam1 ?? "");
          return (
            (s.OutcomeType === "Menos" || norm(s.BetslipLine).startsWith("menos")) &&
            (line === "2.5" || norm(s.BetslipLine).includes("2.5"))
          );
        }),
      );
      if (over && under) cuotas.mas_menos_25 = { over, under };
    } else if (tipoId === "QA158" && !cuotas.btts) {
      const si = sP(sels.find((s: any) => s.OutcomeType === "Sí" || norm(s.BetslipLine) === "si" || norm(s.BetslipLine) === "sí"));
      const no = sP(sels.find((s: any) => s.OutcomeType === "No" || norm(s.BetslipLine) === "no"));
      if (si && no) cuotas.btts = { si, no };
    }
  }

  // Fallback Doble Op: Apuesta Total /eventpage usa formato minificado
  // posicional (arrays anidados con campos por índice). DC viene como
  // _id="QA61" — no DC ni ML9. Buscar en cualquier JSON capturado.
  if (!cuotas.doble_op) {
    const dc = extraerDobleOpKambiMinificado(jsons);
    if (dc) {
      console.log(`  [apuesta_total/debug] Doble Op extraído del formato minificado: ${JSON.stringify(dc)}`);
      cuotas.doble_op = dc;
    }
  }
  // Fallback 1X2: el listing solo trae UNA selection del ML0 (la Visita).
  // El detalle (eventpage) lo tiene completo pero en formato minificado.
  if (!cuotas["1x2"]) {
    const r1x2 = extraer1X2KambiMinificado(jsons, equipoLocal, equipoVisita);
    if (r1x2) {
      console.log(`  [apuesta_total/debug] 1X2 extraído del formato minificado: ${JSON.stringify(r1x2)}`);
      cuotas["1x2"] = r1x2;
    }
  }

  const home = mejorFix.Participants?.find((p: any) => p.VenueRole === "Home")?.Name;
  const away = mejorFix.Participants?.find((p: any) => p.VenueRole === "Away")?.Name;
  return {
    cuotas,
    eventoNombre: `${home} vs ${away}`,
    eventoId: eventId,
    jsonUrl: snapshot.url,
    fixtureRaw: mejorFix,
  };
}

// Apuesta Total — extracción de Doble Op del formato minificado posicional
// que usa /eventpage/events/{id}.
//
// Estructura observada (arrays anidados):
//   [
//     "marketId",                           // [0]
//     "Doble Oportunidad",                  // [1] ← Name
//     null, "Doble Oportunidad", null,
//     ["QA61", "Doble Oportunidad", null, 0, "Double Chance", ...],  // [5]
//     "{eventId}",                          // [6]
//     ...,
//     [                                     // array de selections
//       ["selectionId",
//        {"ES-PE":"UTC Cajamarca o Empate"},  // [1] label local
//        {"ES-PE":"..."},                     // [2] label
//        "Double Chance",                     // [3]
//        null, false,
//        1.29,                                // [6] ← TrueOdds
//        ...]
//     ]
//   ]
function extraerDobleOpKambiMinificado(
  jsons: JsonCapturado[],
): { x1: number; x12: number; xx2: number } | null {
  // Walk recursivo buscando arrays donde [1] sea "Doble Oportunidad" y
  // donde [5] sea un array que contenga "Double Chance".
  for (const j of jsons) {
    const found = walkBuscarMarketMinificado(j.body, "Doble Oportunidad", "Double Chance");
    if (!found) continue;
    // El market posicional encontrado: las selections están en algún
    // sub-array que contenga arrays con label + price.
    for (const item of found) {
      if (!Array.isArray(item) || item.length === 0) continue;
      // Heurística: array de arrays donde cada sub-array tiene label + price
      if (Array.isArray(item[0]) && item[0].length > 6) {
        const cuotas = parsearSelectionsMinificadas(item);
        if (cuotas) return cuotas;
      }
    }
  }
  return null;
}

function walkBuscarMarketMinificado(
  node: any,
  nameMarket: string,
  lineTypeName: string,
  depth = 0,
): any[] | null {
  if (depth > 50 || node === null || node === undefined) return null;
  if (!Array.isArray(node)) {
    if (typeof node === "object") {
      for (const k of Object.keys(node)) {
        const r = walkBuscarMarketMinificado(node[k], nameMarket, lineTypeName, depth + 1);
        if (r) return r;
      }
    }
    return null;
  }
  // ¿Este array es un market posicional?
  // Heurística: tiene >= 7 items, [1] === nameMarket Y [5] es array que
  // contiene lineTypeName.
  if (
    node.length >= 7 &&
    node[1] === nameMarket &&
    Array.isArray(node[5]) &&
    node[5].some((x: any) => x === lineTypeName)
  ) {
    return node;
  }
  // Recurse en cada item
  for (const item of node) {
    const r = walkBuscarMarketMinificado(item, nameMarket, lineTypeName, depth + 1);
    if (r) return r;
  }
  return null;
}

function parsearSelectionsMinificadas(
  selectionsArr: any[],
): { x1: number; x12: number; xx2: number } | null {
  // Cada selection: [id, {ES-PE: label}, {ES-PE: label}, "Double Chance", ..., price, ...]
  // Buscamos las 3 selections (1X / 12 / X2) por su label.
  let x1: number | undefined;
  let x12: number | undefined;
  let xx2: number | undefined;
  for (const sel of selectionsArr) {
    if (!Array.isArray(sel) || sel.length < 7) continue;
    // Label: posición [1] o [2], puede ser un objeto {ES-PE: "..."}
    const labelObj = sel[1];
    let label = "";
    if (labelObj && typeof labelObj === "object") {
      label = String(labelObj["ES-PE"] ?? labelObj["es-pe"] ?? Object.values(labelObj)[0] ?? "");
    } else if (typeof labelObj === "string") {
      label = labelObj;
    }
    if (!label) continue;
    const labelLower = label.toLowerCase();
    // Price: el primer numérico válido de la posición [5] en adelante
    let price: number | undefined;
    for (let i = 5; i < Math.min(sel.length, 12); i++) {
      const v = sel[i];
      if (typeof v === "number" && v > 1 && v < 100) {
        price = v;
        break;
      }
    }
    if (!price) continue;
    // Clasificar por label:
    // 1X = "{Local} o Empate" (contiene " o empate")
    // X2 = "Empate o {Visita}" (empieza con "empate o ")
    // 12 = "{Local} o {Visita}" (no contiene "empate")
    if (labelLower.includes(" o empate")) {
      x1 = price;
    } else if (labelLower.startsWith("empate o ")) {
      xx2 = price;
    } else if (labelLower.includes(" o ") && !labelLower.includes("empate")) {
      x12 = price;
    }
  }
  if (x1 && x12 && xx2) return { x1, x12, xx2 };
  return null;
}

// Apuesta Total — extracción de 1X2 (Resultado del partido) del formato
// minificado posicional. Estructura es similar a Doble Op pero el market
// type es "ML0" (Match Result) y las selections tienen labels:
// {Local}, "Empate", {Visita}.
function walkBuscarMarketMinificadoPorId(
  node: any,
  marketTypeId: string,
  depth = 0,
): any[] | null {
  if (depth > 50 || node === null || node === undefined) return null;
  if (!Array.isArray(node)) {
    if (typeof node === "object") {
      for (const k of Object.keys(node)) {
        const r = walkBuscarMarketMinificadoPorId(
          node[k],
          marketTypeId,
          depth + 1,
        );
        if (r) return r;
      }
    }
    return null;
  }
  // ¿Este array es un market posicional con marketTypeId en [5][0]?
  if (
    node.length >= 7 &&
    Array.isArray(node[5]) &&
    node[5][0] === marketTypeId
  ) {
    return node;
  }
  // Recurse
  for (const item of node) {
    const r = walkBuscarMarketMinificadoPorId(
      item,
      marketTypeId,
      depth + 1,
    );
    if (r) return r;
  }
  return null;
}

function extraer1X2KambiMinificado(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): { local: number; empate: number; visita: number } | null {
  for (const j of jsons) {
    const found = walkBuscarMarketMinificadoPorId(j.body, "ML0");
    if (!found) continue;
    // Buscar las selections (sub-array con arrays de label + price)
    for (const item of found) {
      if (!Array.isArray(item) || item.length === 0) continue;
      if (Array.isArray(item[0]) && item[0].length > 6) {
        const cuotas = parsear1X2SelectionsMinificadas(
          item,
          equipoLocal,
          equipoVisita,
        );
        if (cuotas) return cuotas;
      }
    }
  }
  return null;
}

function parsear1X2SelectionsMinificadas(
  selectionsArr: any[],
  equipoLocal: string,
  equipoVisita: string,
): { local: number; empate: number; visita: number } | null {
  let local: number | undefined;
  let empate: number | undefined;
  let visita: number | undefined;
  for (const sel of selectionsArr) {
    if (!Array.isArray(sel) || sel.length < 7) continue;
    const labelObj = sel[1];
    let label = "";
    if (labelObj && typeof labelObj === "object") {
      label = String(
        labelObj["ES-PE"] ??
          labelObj["es-pe"] ??
          Object.values(labelObj)[0] ??
          "",
      );
    } else if (typeof labelObj === "string") {
      label = labelObj;
    }
    if (!label) continue;
    const labelNorm = norm(label);
    let price: number | undefined;
    for (let i = 5; i < Math.min(sel.length, 12); i++) {
      const v = sel[i];
      if (typeof v === "number" && v > 1 && v < 100) {
        price = v;
        break;
      }
    }
    if (!price) continue;
    if (
      labelNorm === "empate" ||
      labelNorm === "draw" ||
      labelNorm === "x"
    ) {
      empate = price;
    } else if (similitudEquipos(label, equipoLocal) >= UMBRAL_FUZZY) {
      local = price;
    } else if (similitudEquipos(label, equipoVisita) >= UMBRAL_FUZZY) {
      visita = price;
    }
  }
  if (local && empate && visita) return { local, empate, visita };
  return null;
}

// Coolbet
function parsearCoolbet(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ResultadoParser | null {
  // Coolbet returna array de categorías con matches[]
  const candidatos = jsons.filter((j) => Array.isArray(j.body));
  for (const j of candidatos) {
    const matches: any[] = [];
    for (const cat of j.body) {
      if (cat?.matches && Array.isArray(cat.matches)) matches.push(...cat.matches);
    }
    if (matches.length === 0) continue;

    let mejor: any = null;
    let mejorScore = 0;
    for (const m of matches) {
      const home = m.homeName ?? m.homeTeam ?? extractHomeFromName(m.name);
      const away = m.awayName ?? m.awayTeam ?? extractAwayFromName(m.name);
      if (!home || !away) continue;
      const score = Math.min(
        similitudEquipos(home, equipoLocal),
        similitudEquipos(away, equipoVisita),
      );
      if (score > mejorScore) {
        mejorScore = score;
        mejor = m;
      }
    }
    if (!mejor || mejorScore < UMBRAL_FUZZY) continue;

    const cuotas = mapearCuotasCoolbet(mejor);
    if (Object.keys(cuotas).length > 0) {
      const home = mejor.homeName ?? mejor.homeTeam ?? extractHomeFromName(mejor.name);
      const away = mejor.awayName ?? mejor.awayTeam ?? extractAwayFromName(mejor.name);
      return {
        cuotas,
        eventoNombre: `${home} vs ${away}`,
        eventoId: mejor.id,
        jsonUrl: j.url,
      };
    }
  }
  return null;
}

function extractHomeFromName(name?: string): string | null {
  if (!name) return null;
  const parts = name.split(/\s+vs\.?\s+|\s+-\s+/i);
  return parts[0]?.trim() ?? null;
}
function extractAwayFromName(name?: string): string | null {
  if (!name) return null;
  const parts = name.split(/\s+vs\.?\s+|\s+-\s+/i);
  return parts[1]?.trim() ?? null;
}
function mapearCuotasCoolbet(match: any): Cuotas {
  const cuotas: Cuotas = {};
  const flat: any[] = [];
  for (const m of match.markets ?? []) {
    for (const o of m.outcomes ?? []) {
      flat.push({ ...o, marketName: m.name, marketLine: m.line ?? m.raw_line });
    }
  }
  const sP = (o: any) => priceOk(o?.odds ?? o?.price ?? o?.value ?? o?.decimal_odds);

  const local = sP(
    flat.find(
      (o) => o.result_key === "[Home]" || norm(o.name) === "1" || norm(o.name) === "local",
    ),
  );
  const empate = sP(flat.find((o) => o.result_key === "Draw" || norm(o.name) === "x"));
  const visita = sP(flat.find((o) => o.result_key === "[Away]" || norm(o.name) === "2"));
  if (local && empate && visita) cuotas["1x2"] = { local, empate, visita };

  const x1 = sP(flat.find((o) => o.result_key === "[Home]/Draw" || norm(o.name) === "1x"));
  const x12 = sP(flat.find((o) => o.result_key === "[Home]/[Away]" || norm(o.name) === "12"));
  const xx2 = sP(flat.find((o) => o.result_key === "Draw/[Away]" || norm(o.name) === "x2"));
  if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };

  const over25 = sP(
    flat.find((o) => o.result_key === "Over" && String(o.marketLine ?? "") === "2.5"),
  );
  const under25 = sP(
    flat.find((o) => o.result_key === "Under" && String(o.marketLine ?? "") === "2.5"),
  );
  if (over25 && under25) cuotas.mas_menos_25 = { over: over25, under: under25 };

  const bttsSi = sP(
    flat.find((o) => {
      const m = norm(o.marketName);
      const rk = (o.result_key ?? "").toLowerCase();
      return (m.includes("ambos") || m.includes("btts")) && (rk === "yes" || norm(o.name) === "si" || norm(o.name) === "sí");
    }),
  );
  const bttsNo = sP(
    flat.find((o) => {
      const m = norm(o.marketName);
      const rk = (o.result_key ?? "").toLowerCase();
      return (m.includes("ambos") || m.includes("btts")) && (rk === "no" || norm(o.name) === "no");
    }),
  );
  if (bttsSi && bttsNo) cuotas.btts = { si: bttsSi, no: bttsNo };

  return cuotas;
}

// Betano (Danae - per-event)
function parsearBetano(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ResultadoParser | null {
  // Buscar JSONs con shape data.markets + data.selections
  const candidatos = jsons.filter(
    (j) => j.body?.data?.markets && j.body?.data?.selections,
  );
  for (const j of candidatos) {
    const data = j.body.data;
    // Si es per-event (betbuilderplus), no hay events array. El "evento"
    // es implícito — necesitamos validar por nombre buscando en selections
    // o roster (si existe).
    const roster = data.roster;
    let homeName = "";
    let awayName = "";
    if (roster && Array.isArray(roster)) {
      const home = roster.find((r: any) => r.type === "home");
      const away = roster.find((r: any) => r.type === "away");
      homeName = home?.name ?? "";
      awayName = away?.name ?? "";
    } else {
      // Buscar en marketIdList o markets nombres de equipos.
      // Heurística: tomar 2 nombres distintos que aparezcan en selections.
      const markets = data.markets;
      for (const k of Object.keys(markets)) {
        const m = markets[k];
        if (m.type === "MRES" || m.typeId === 1) {
          // Mercado 1X2 — sus selections pueden tener nombres de equipos
          // pero muchas veces son "1"/"X"/"2".
          break;
        }
      }
    }
    // Si tenemos nombres, validar match
    if (homeName && awayName) {
      const score = Math.min(
        similitudEquipos(homeName, equipoLocal),
        similitudEquipos(awayName, equipoVisita),
      );
      if (score < UMBRAL_FUZZY) continue;
    } else {
      // Fallback: confiar en que el JSON contiene rastros del partido
      // buscado (al menos un token del local Y al menos uno del visita).
      const partidoFallback: PartidoTest = {
        equipoLocal,
        equipoVisita,
        liga: "",
      };
      if (!jsonContieneAmbosLados(JSON.stringify(j.body), partidoFallback)) continue;
    }

    // Extraer 4 mercados
    const markets = data.markets;
    const selections = data.selections;
    const cuotas: Cuotas = {};
    const sP = (s: any) => priceOk(s?.price);

    for (const k of Object.keys(markets)) {
      const m = markets[k];
      const sels = (m.selectionIdList ?? [])
        .map((id: any) => selections[String(id)])
        .filter(Boolean);

      if ((m.type === "MRES" || m.typeId === 1) && !cuotas["1x2"]) {
        const l = sP(sels.find((s: any) => s.typeId === 1 || s.shortName === "1"));
        const e = sP(sels.find((s: any) => s.typeId === 2 || s.shortName === "X"));
        const v = sP(sels.find((s: any) => s.typeId === 3 || s.shortName === "2"));
        if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
      } else if ((m.type === "DBLC" || m.typeId === 9) && !cuotas.doble_op) {
        const x1 = sP(sels.find((s: any) => s.typeId === 28 || s.shortName === "1X" || s.shortName === "1 ó X"));
        const x12 = sP(sels.find((s: any) => s.typeId === 30 || s.shortName === "12" || s.shortName === "1 ó 2"));
        const xx2 = sP(sels.find((s: any) => s.typeId === 29 || s.shortName === "X2" || s.shortName === "X ó 2"));
        if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
      } else if ((m.type === "BTSC" || m.typeId === 15) && !cuotas.btts) {
        const si = sP(sels.find((s: any) => {
          const sn = (s.shortName ?? "").toLowerCase();
          return s.typeId === 43 || sn === "sí" || sn === "si" || sn === "yes";
        }));
        const no = sP(sels.find((s: any) => {
          const sn = (s.shortName ?? "").toLowerCase();
          return s.typeId === 44 || sn === "no";
        }));
        if (si && no) cuotas.btts = { si, no };
      } else if ((m.type === "HCTG" || m.typeId === 13) && !cuotas.mas_menos_25) {
        const over = sP(sels.find((s: any) =>
          (s.typeId === 39 || (s.shortName ?? "").toLowerCase().startsWith("más") || (s.shortName ?? "").toLowerCase().startsWith("over"))
          && s.handicap === 2.5
        ));
        const under = sP(sels.find((s: any) =>
          (s.typeId === 40 || (s.shortName ?? "").toLowerCase().startsWith("menos") || (s.shortName ?? "").toLowerCase().startsWith("under"))
          && s.handicap === 2.5
        ));
        if (over && under) cuotas.mas_menos_25 = { over, under };
      }
    }

    if (Object.keys(cuotas).length > 0) {
      return {
        cuotas,
        eventoNombre: homeName && awayName ? `${homeName} vs ${awayName}` : "(detectado por token)",
        jsonUrl: j.url,
      };
    }
  }
  return null;
}

// Inkabet (Octonovus / OBG) — busca events/markets/selections en CUALQUIER path
function extraerEventsMarketsSelections(body: any): {
  events: any[];
  markets: any[];
  selections: any[];
} {
  // Buscar recursivamente arrays con structure {globalId, participants}
  // (events), {marketTemplateId, eventId} (markets), {marketId, odds, selectionTemplateId} (selections)
  const events: any[] = [];
  const markets: any[] = [];
  const selections: any[] = [];

  function walk(obj: any, depth = 0): void {
    if (depth > 20 || obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      // Detectar tipo del array por el primer elemento
      const first = obj[0];
      if (first && typeof first === "object") {
        if ("globalId" in first && "participants" in first) {
          events.push(...obj);
        } else if ("marketTemplateId" in first || ("eventId" in first && "id" in first && Array.isArray(obj) && obj[0]?.marketTemplateId === undefined && "lineValue" in first)) {
          markets.push(...obj);
        } else if ("marketId" in first && "odds" in first) {
          selections.push(...obj);
        } else {
          // Recurse
          for (const item of obj) walk(item, depth + 1);
        }
      } else {
        for (const item of obj) walk(item, depth + 1);
      }
    } else if (typeof obj === "object") {
      // Caso especial: data.events/markets/selections directo
      if (obj.events && Array.isArray(obj.events) && obj.events[0]?.globalId) {
        events.push(...obj.events);
      }
      if (obj.markets && Array.isArray(obj.markets) && obj.markets[0]?.marketTemplateId) {
        markets.push(...obj.markets);
      }
      if (obj.selections && Array.isArray(obj.selections) && obj.selections[0]?.marketId) {
        selections.push(...obj.selections);
      }
      for (const k of Object.keys(obj)) walk(obj[k], depth + 1);
    }
  }

  walk(body);
  return { events, markets, selections };
}

function parsearInkabet(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ResultadoParser | null {
  // Buscar JSONs que tengan events/markets/selections (en cualquier path).
  type Candidato = { url: string; events: any[]; markets: any[]; selections: any[] };
  const candidatos: Candidato[] = [];
  for (const j of jsons) {
    const { events, markets, selections } = extraerEventsMarketsSelections(j.body);
    if (events.length > 0 || markets.length > 0) {
      candidatos.push({ url: j.url, events, markets, selections });
    }
  }

  // Debug compacto: cuántos JSONs con rastros del partido
  const partidoCtx: PartidoTest = { equipoLocal, equipoVisita, liga: "" };
  const jsonsConToken = jsons.filter((j) => {
    try {
      return jsonContieneRastroPartido(JSON.stringify(j.body), partidoCtx);
    } catch {
      return false;
    }
  });
  // Combinar events/markets/selections
  const allEvents = candidatos.flatMap((c) => c.events);
  const allMarkets = candidatos.flatMap((c) => c.markets);
  const allSelections = candidatos.flatMap((c) => c.selections);
  console.log(
    `  [inkabet/debug] ${jsonsConToken.length} JSONs con partido · events=${allEvents.length} markets=${allMarkets.length} selections=${allSelections.length}`,
  );

  // Permitimos que allEvents esté vacío si tenemos markets directos —
  // caso de la página detalle donde solo hay UN evento (el partido buscado).
  if (allEvents.length === 0 && allMarkets.length === 0) return null;
  const TEMPLATES_1X2 = new Set(["MW3W", "ESFMWINNER3W", "E1X2M"]);
  const TEMPLATES_DOBLE_OP = new Set(["DC", "ESFMDCHANCE"]);
  const TEMPLATES_TOTAL = new Set([
    "MTG2W25",
    "MTG2W",
    "ESFMTOTAL",
    "ESFMATOTAL",
    "EOU25M",
  ]);
  const TEMPLATES_BTTS = new Set(["BTTS", "ESFMBTS"]);

  // Buscar mejor evento entre todos los descubiertos
  let mejor: any = null;
  let mejorScore = 0;
  let mejorHome = "";
  let mejorAway = "";
  for (const ev of allEvents) {
    const home = ev.participants?.find((p: any) => p.side === 1)?.label;
    const away = ev.participants?.find((p: any) => p.side === 2)?.label;
    if (!home || !away) continue;
    const score = Math.min(
      similitudEquipos(home, equipoLocal),
      similitudEquipos(away, equipoVisita),
    );
    if (score > mejorScore) {
      mejorScore = score;
      mejor = ev;
      mejorHome = home;
      mejorAway = away;
    }
  }
  // Determinar qué markets considerar:
  // - Caso A: hay event matched (con participants) → filtramos markets
  //   por su globalId.
  // - Caso B: no hay event matched pero los URLs de JSONs con token tienen
  //   `?eventId={id}` → ese es el eventId del partido en la página detalle.
  //   Filtramos markets por ese ID.
  // - Caso C: ni event ni eventId en URL → usar todos los markets SOLO si
  //   hay un único eventId distinto en allMarkets (significa que solo hay
  //   un evento capturado, así que no hay ambigüedad).
  let eventMarkets: any[];
  let eventId = "";
  if (mejor && mejorScore >= UMBRAL_FUZZY) {
    // Inkabet: globalId puede venir con formato "event.{cat}.{reg}.{comp}.{shortId}"
    // pero los markets internos usan solo el shortId. Quedarse con la
    // última parte después del último punto.
    let id: string = mejor.globalId ?? "";
    if (id.includes(".")) {
      const partes = id.split(".");
      id = partes[partes.length - 1];
    }
    eventId = id;
    console.log(`  [inkabet/debug] match por participants · eventId raw=${mejor.globalId} · short=${eventId}`);
    eventMarkets = allMarkets.filter((m: any) => m.eventId === eventId);
  } else if (allMarkets.length > 0) {
    // Buscar eventId en URLs de JSONs con token (ej. ?eventId=f-Pcf...).
    // Inkabet a veces usa formato "event.{cat}.{reg}.{comp}.{shortId}" en
    // URLs pero los markets internos usan solo el shortId. Tomamos la
    // última parte después del último punto.
    let eventIdEnUrl = "";
    for (const j of jsonsConToken) {
      const m = j.url.match(/[?&]eventId=([^&]+)/);
      if (m && m[1]) {
        const raw = decodeURIComponent(m[1]);
        let id = raw;
        if (id.includes(".")) {
          const partes = id.split(".");
          id = partes[partes.length - 1];
        }
        console.log(`  [inkabet/debug] match URL: ${j.url.slice(0, 100)} · raw="${raw}" · short="${id}"`);
        eventIdEnUrl = id;
        break;
      }
    }
    if (eventIdEnUrl) {
      eventId = eventIdEnUrl;
      eventMarkets = allMarkets.filter((m: any) => m.eventId === eventIdEnUrl);
      mejorHome = equipoLocal;
      mejorAway = equipoVisita;
    } else {
      // Sin eventId en URL — fallback estricto: solo si todos los markets
      // tienen el mismo eventId (un único evento capturado).
      const idsUnicos = new Set(allMarkets.map((m: any) => m.eventId).filter(Boolean));
      if (idsUnicos.size !== 1) return null;
      eventId = Array.from(idsUnicos)[0] as string;
      eventMarkets = allMarkets;
      mejorHome = equipoLocal;
      mejorAway = equipoVisita;
    }
  } else {
    return null;
  }
  console.log(`  [inkabet/debug] eventMarkets → ${eventMarkets.length} de ${allMarkets.length}`);
  if (eventMarkets.length === 0) return null;

  const selsParaMarket = (mid: string) =>
    allSelections.filter((s: any) => s.marketId === mid);

  const cuotas: Cuotas = {};
  const sP = (v: number | undefined) => priceOk(v);
  const normSel = (s: any): string =>
    norm(s.alternateLabel ?? s.participantLabel ?? "");

  for (const m of eventMarkets) {
    if (!cuotas["1x2"] && TEMPLATES_1X2.has(m.marketTemplateId)) {
      const sels = selsParaMarket(m.id);
      // Inkabet / Octonovus: a veces solo la selection HOME viene con
      // `selectionTemplateId="HOME"` + `isHomeTeam=true` poblados. Las
      // selections DRAW y AWAY vienen con `selectionTemplateId=""` vacíos
      // pero conservan el `sortOrder` (1=local, 2=empate, 3=visita).
      // Usamos sortOrder como fallback.
      const l = sP(
        sels.find(
          (s: any) =>
            s.selectionTemplateId === "HOME" ||
            s.isHomeTeam === true ||
            s.sortOrder === 1,
        )?.odds,
      );
      const e = sP(
        sels.find(
          (s: any) =>
            s.selectionTemplateId === "DRAW" || s.sortOrder === 2,
        )?.odds,
      );
      const v = sP(
        sels.find(
          (s: any) =>
            s.selectionTemplateId === "AWAY" ||
            s.isAwayTeam === true ||
            s.sortOrder === 3,
        )?.odds,
      );
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    }
    if (!cuotas.doble_op && TEMPLATES_DOBLE_OP.has(m.marketTemplateId)) {
      const sels = selsParaMarket(m.id);
      // Inkabet usa templates con dos formatos: con guion bajo
      // (HOME_OR_DRAW) y sin él (HOMEORDRAW). Aceptamos ambos.
      const matchTpl = (s: any, ...opts: string[]) =>
        opts.includes((s.selectionTemplateId ?? "").toUpperCase());
      const x1 = sP(
        sels.find(
          (s: any) =>
            matchTpl(s, "HOME_OR_DRAW", "HOMEORDRAW", "1X") ||
            normSel(s) === "1x" ||
            normSel(s) === "1 o x",
        )?.odds,
      );
      const x12 = sP(
        sels.find(
          (s: any) =>
            matchTpl(s, "HOME_OR_AWAY", "HOMEORAWAY", "12") ||
            normSel(s) === "12" ||
            normSel(s) === "1 o 2",
        )?.odds,
      );
      const xx2 = sP(
        sels.find(
          (s: any) =>
            matchTpl(s, "DRAW_OR_AWAY", "DRAWORAWAY", "X2") ||
            normSel(s) === "x2" ||
            normSel(s) === "x o 2",
        )?.odds,
      );
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    }
    if (!cuotas.mas_menos_25 && TEMPLATES_TOTAL.has(m.marketTemplateId)) {
      const lineOk = m.marketTemplateId === "MTG2W25" || m.marketTemplateId === "EOU25M" || m.lineValue === "2.5" || m.lineValueRaw === 2.5;
      if (lineOk) {
        const sels = selsParaMarket(m.id);
        const over = sP(
          sels.find((s: any) => {
            const t = (s.selectionTemplateId ?? "").toUpperCase();
            return t.includes("OVER") || normSel(s).includes("mas") || normSel(s).includes("over");
          })?.odds,
        );
        const under = sP(
          sels.find((s: any) => {
            const t = (s.selectionTemplateId ?? "").toUpperCase();
            return t.includes("UNDER") || normSel(s).includes("menos") || normSel(s).includes("under");
          })?.odds,
        );
        if (over && under) cuotas.mas_menos_25 = { over, under };
      }
    }
    if (!cuotas.btts && TEMPLATES_BTTS.has(m.marketTemplateId)) {
      const sels = selsParaMarket(m.id);
      const si = sP(sels.find((s: any) => {
        const t = (s.selectionTemplateId ?? "").toUpperCase();
        return t === "YES" || normSel(s) === "si" || normSel(s) === "sí";
      })?.odds);
      const no = sP(sels.find((s: any) => {
        const t = (s.selectionTemplateId ?? "").toUpperCase();
        return t === "NO" || normSel(s) === "no";
      })?.odds);
      if (si && no) cuotas.btts = { si, no };
    }
  }

  if (Object.keys(cuotas).length === 0) return null;
  return {
    cuotas,
    eventoNombre: `${mejorHome} vs ${mejorAway}`,
    eventoId: eventId,
    jsonUrl: candidatos[0]?.url ?? "",
  };
}

// Te Apuesto (Coreix)
function parsearTeApuesto(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ResultadoParser | null {
  const candidatos = jsons.filter(
    (j) => j.body?.data?.tournaments && typeof j.body.data.tournaments === "object",
  );
  for (const j of candidatos) {
    const tournaments = j.body.data.tournaments;
    const events: any[] = [];
    for (const t of Object.values(tournaments)) {
      const tt = t as any;
      if (tt.events) events.push(...tt.events);
    }
    if (events.length === 0) continue;

    let mejor: any = null;
    let mejorScore = 0;
    let mejorHome = "";
    let mejorAway = "";
    for (const ev of events) {
      if (!ev.competitors) continue;
      const competitors = Object.values(ev.competitors) as any[];
      const home = competitors.find((c: any) => c.type === "home")?.name;
      const away = competitors.find((c: any) => c.type === "away")?.name;
      if (!home || !away) continue;
      const score = Math.min(
        similitudEquipos(home, equipoLocal),
        similitudEquipos(away, equipoVisita),
      );
      if (score > mejorScore) {
        mejorScore = score;
        mejor = ev;
        mejorHome = home;
        mejorAway = away;
      }
    }
    if (!mejor || mejorScore < UMBRAL_FUZZY) continue;

    type FlatOdd = {
      provider_odd_id?: string;
      value?: number;
      special_value?: string;
      marketName: string;
      providerMarketId: string;
    };
    const allOdds: FlatOdd[] = [];
    for (const m of mejor.markets ?? []) {
      const marketName = norm(m.name);
      const providerMarketId = String(m.provider_market_id ?? "");
      for (const mo of m.market_odds ?? []) {
        for (const o of mo.odds ?? []) {
          allOdds.push({ ...o, marketName, providerMarketId });
        }
      }
    }
    const sP = (v: any) => priceOk(v);

    const cuotas: Cuotas = {};
    const o1x2 = allOdds.filter((o) => o.marketName === "1x2" || o.providerMarketId === "1");
    if (o1x2.length > 0) {
      const l = sP(o1x2.find((o) => o.provider_odd_id === "1")?.value);
      const e = sP(o1x2.find((o) => o.provider_odd_id === "2")?.value);
      const v = sP(o1x2.find((o) => o.provider_odd_id === "3")?.value);
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    }
    const oDoble = allOdds.filter((o) => o.marketName.includes("doble") || o.providerMarketId === "10");
    if (oDoble.length > 0) {
      const x1 = sP(oDoble.find((o) => o.provider_odd_id === "9")?.value);
      const x12 = sP(oDoble.find((o) => o.provider_odd_id === "10")?.value);
      const xx2 = sP(oDoble.find((o) => o.provider_odd_id === "11")?.value);
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    }
    const oBtts = allOdds.filter(
      (o) => o.marketName.includes("ambos") || o.marketName.includes("btts") || o.providerMarketId === "29",
    );
    if (oBtts.length > 0) {
      const si = sP(oBtts.find((o) => o.provider_odd_id === "74")?.value);
      const no = sP(oBtts.find((o) => o.provider_odd_id === "76")?.value);
      if (si && no) cuotas.btts = { si, no };
    }
    const oTotal = allOdds.filter(
      (o) => (o.marketName === "total" || o.providerMarketId === "18") && o.special_value === "2.5",
    );
    if (oTotal.length > 0) {
      const over = sP(oTotal.find((o) => o.provider_odd_id === "12")?.value);
      const under = sP(oTotal.find((o) => o.provider_odd_id === "13")?.value);
      if (over && under) cuotas.mas_menos_25 = { over, under };
    }

    if (Object.keys(cuotas).length > 0) {
      return {
        cuotas,
        eventoNombre: `${mejorHome} vs ${mejorAway}`,
        eventoId: mejor.id,
        jsonUrl: j.url,
      };
    }
  }
  return null;
}

// Stake — parser para 1X2 desde el listing
// Estructura conocida: {events: [{id, country_name, date_start,
//   main_odds: { main: { oddId: { odd_code, odd_value, team_name,
//   team_side, name } } } }]}
// odd_code: ODD_S1 (local), ODD_SX (empate), ODD_S2 (visita)
// El listing solo trae main_odds (1X2). Para Doble Op/Total/BTTS se
// necesita doble navegación al detalle del partido — pendiente.
function parsearStake(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ResultadoParser | null {
  // Buscar JSONs con events array
  const candidatos = jsons.filter((j) => {
    try {
      return Array.isArray(j.body?.events) && j.body.events.length > 0 && j.body.events[0]?.main_odds;
    } catch {
      return false;
    }
  });
  if (candidatos.length === 0) return null;

  // Combinar todos los events de los candidatos
  const todosEvents: any[] = [];
  for (const j of candidatos) {
    for (const ev of j.body.events) {
      todosEvents.push({ event: ev, jsonUrl: j.url });
    }
  }

  // Match por nombre de equipo. Cada event tiene main_odds.main con odds
  // ODD_S1 (team_name = local) y ODD_S2 (team_name = visita).
  let mejor: any = null;
  let mejorScore = 0;
  let mejorJsonUrl = "";
  for (const { event, jsonUrl } of todosEvents) {
    const odds = event.main_odds?.main ?? {};
    const oddsArr = Object.values(odds) as any[];
    const oddLocal = oddsArr.find((o) => o.odd_code === "ODD_S1");
    const oddVisita = oddsArr.find((o) => o.odd_code === "ODD_S2");
    if (!oddLocal?.team_name || !oddVisita?.team_name) continue;
    const score = Math.min(
      similitudEquipos(oddLocal.team_name, equipoLocal),
      similitudEquipos(oddVisita.team_name, equipoVisita),
    );
    if (score > mejorScore) {
      mejorScore = score;
      mejor = event;
      mejorJsonUrl = jsonUrl;
    }
  }
  if (!mejor || mejorScore < UMBRAL_FUZZY) return null;

  // Extraer 1X2 del main_odds.main
  const cuotas: Cuotas = {};
  const odds = mejor.main_odds?.main ?? {};
  const oddsArr = Object.values(odds) as any[];
  const oddLocal = oddsArr.find((o) => o.odd_code === "ODD_S1");
  const oddEmpate = oddsArr.find((o) => o.odd_code === "ODD_SX");
  const oddVisita = oddsArr.find((o) => o.odd_code === "ODD_S2");
  const l = priceOk(oddLocal?.odd_value);
  const e = priceOk(oddEmpate?.odd_value);
  const v = priceOk(oddVisita?.odd_value);
  if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };

  // Debug: imprimir odd_codes únicos en TODOS los JSONs con rastros del
  // partido + URL de origen. Esto revela qué markets adicionales (DC,
  // BTTS, Total) hay disponibles después de la doble nav.
  const partidoCtx: PartidoTest = { equipoLocal, equipoVisita, liga: "" };
  const oddCodesPorUrl = new Map<string, Set<string>>();
  for (const j of jsons) {
    try {
      const txt = JSON.stringify(j.body);
      if (!jsonContieneRastroPartido(txt, partidoCtx)) continue;
      // Buscar todos los odd_code: regex
      const matches = txt.match(/"odd_code":"([^"]+)"/g) ?? [];
      const codes = new Set<string>();
      for (const m of matches) {
        const code = m.match(/"odd_code":"([^"]+)"/)?.[1];
        if (code) codes.add(code);
      }
      if (codes.size > 0) oddCodesPorUrl.set(j.url, codes);
    } catch {
      /* ignore */
    }
  }
  console.log(`  [stake/debug] odd_codes en ${oddCodesPorUrl.size} JSONs:`);
  for (const [url, codes] of oddCodesPorUrl) {
    console.log(`    · ${url.slice(0, 100)}`);
    console.log(`      codes: ${JSON.stringify(Array.from(codes).slice(0, 30))}`);
  }

  // Buscar TODAS las odds del partido en cualquier JSON (event_id match)
  const eventIdNum = mejor.id;
  type StakeOdd = {
    odd_code: string;
    odd_value: number;
    team_name?: string;
    team_side?: number;
    name?: string;
    event_id?: number;
  };
  const allOdds: StakeOdd[] = [];
  function walkOdds(node: any, depth = 0): void {
    if (depth > 25 || !node) return;
    if (Array.isArray(node)) {
      for (const item of node) walkOdds(item, depth + 1);
      return;
    }
    if (typeof node === "object") {
      if (
        typeof node.odd_code === "string" &&
        typeof node.odd_value === "number" &&
        node.event_id === eventIdNum
      ) {
        allOdds.push(node);
      }
      for (const k of Object.keys(node)) walkOdds(node[k], depth + 1);
    }
  }
  for (const j of jsons) walkOdds(j.body);
  console.log(`  [stake/debug] allOdds del eventId=${eventIdNum}: ${allOdds.length}`);
  const codesUnicos = new Set(allOdds.map((o) => o.odd_code));
  console.log(`  [stake/debug] odd_codes del partido: ${JSON.stringify(Array.from(codesUnicos))}`);
  // Sample completo de un Total para ver cómo indica la línea
  const sampleTotal = allOdds.find((o: any) => o.odd_code === "ODD_TTL_1_OVR");
  if (sampleTotal) {
    console.log(`  [stake/debug] sample Total OVR: ${JSON.stringify(sampleTotal).slice(0, 400)}`);
  }
  const sampleBtts = allOdds.find((o: any) => o.odd_code?.includes("BOTHTEAMSSCORE"));
  if (sampleBtts) {
    console.log(`  [stake/debug] sample BTTS: ${JSON.stringify(sampleBtts).slice(0, 400)}`);
  }

  // Doble Op: Stake usa ODD_D1X / ODD_D12 / ODD_DX2 (con prefix D, no S).
  // Solo aparecen tras hacer CLICK en el partido desde el listing — la
  // SPA dispara XHRs adicionales con estos códigos al montar el detalle.
  const oddD1X = allOdds.find((o: any) => o.odd_code === "ODD_D1X");
  const oddD12 = allOdds.find((o: any) => o.odd_code === "ODD_D12");
  const oddDX2 = allOdds.find((o: any) => o.odd_code === "ODD_DX2");
  const x1P = priceOk(oddD1X?.odd_value);
  const x12P = priceOk(oddD12?.odd_value);
  const xx2P = priceOk(oddDX2?.odd_value);
  if (x1P && x12P && xx2P) cuotas.doble_op = { x1: x1P, x12: x12P, xx2: xx2P };

  // BTTS — codes reales: ODD_FTB_BOTHTEAMSSCORE_YES / _NO
  const oddBttsSi = allOdds.find((o: any) => o.odd_code === "ODD_FTB_BOTHTEAMSSCORE_YES");
  const oddBttsNo = allOdds.find((o: any) => o.odd_code === "ODD_FTB_BOTHTEAMSSCORE_NO");
  const siP = priceOk(oddBttsSi?.odd_value);
  const noP = priceOk(oddBttsNo?.odd_value);
  if (siP && noP) cuotas.btts = { si: siP, no: noP };

  // Total 2.5 — code real: ODD_TTL_1_OVR / ODD_TTL_1_UND.
  // Hay múltiples líneas (0.5, 1.5, 2.5, 3.5, etc.). Filtramos por
  // line === 2.5 — el campo se ve en debug arriba.
  const totalsOver = allOdds.filter((o: any) => o.odd_code === "ODD_TTL_1_OVR");
  const totalsUnder = allOdds.filter((o: any) => o.odd_code === "ODD_TTL_1_UND");
  // Heurística: la línea está en `numerator/denominator` (fracción) o en
  // un campo separado. Para 2.5 buscamos el odd cuyo handicap/line === 2.5.
  const findLine25 = (arr: any[]): any => {
    for (const o of arr) {
      // Stake usa `additional_value_raw` (number) y `additional_value`
      // (string con espacio: " 2.5") para indicar la línea.
      if (o.additional_value_raw === 2.5) return o;
      if (
        typeof o.additional_value === "string" &&
        o.additional_value.trim() === "2.5"
      ) {
        return o;
      }
      // Fallback: campos genéricos.
      const candidates: any[] = [o.spread, o.line, o.handicap, o.parameter];
      for (const c of candidates) {
        if (c === 2.5 || c === "2.5") return o;
      }
    }
    return undefined;
  };
  const oOver25 = findLine25(totalsOver);
  const oUnder25 = findLine25(totalsUnder);
  const overP = priceOk(oOver25?.odd_value);
  const underP = priceOk(oUnder25?.odd_value);
  if (overP && underP) cuotas.mas_menos_25 = { over: overP, under: underP };

  if (Object.keys(cuotas).length === 0) return null;

  return {
    cuotas,
    eventoNombre: `${oddLocal?.team_name ?? equipoLocal} vs ${oddVisita?.team_name ?? equipoVisita}`,
    eventoId: mejor.id,
    jsonUrl: mejorJsonUrl,
  };
}

const PARSERS: Record<
  string,
  (jsons: JsonCapturado[], local: string, visita: string) => ResultadoParser | null
> = {
  doradobet: parsearDoradobet,
  apuesta_total: parsearApuestaTotal,
  coolbet: parsearCoolbet,
  betano: parsearBetano,
  inkabet: parsearInkabet,
  te_apuesto: parsearTeApuesto,
  stake: parsearStake,
};

// ─── Main loop por casa ─────────────────────────────────────────────

interface ResultadoCasa {
  casa: string;
  status: "complete" | "partial" | "no-match" | "error" | "blocked";
  cuotas?: Cuotas;
  faltan?: string[];
  jsonUrl?: string;
  eventoNombre?: string;
  totalJsons: number;
  jsonsConToken: number;
  err?: string;
  ms: number;
}

async function probarCasa(
  context: any,
  casa: string,
  url: string,
  partido: PartidoTest,
): Promise<ResultadoCasa> {
  const t0 = Date.now();
  const result: ResultadoCasa = {
    casa,
    status: "no-match",
    totalJsons: 0,
    jsonsConToken: 0,
    ms: 0,
  };

  const page = await context.newPage();
  const todosJsons: JsonCapturado[] = [];

  page.on("response", (response: any) => {
    const ct = (response.headers()["content-type"] ?? "").toLowerCase();
    if (!ct.includes("json")) return;
    if (response.status() !== 200) return;
    void (async () => {
      try {
        const text = await response.text();
        if (text.length < MIN_BYTES) return;
        if (todosJsons.length >= 100) return;
        let body: any;
        try {
          body = JSON.parse(text);
        } catch {
          return;
        }
        todosJsons.push({ url: response.url(), bytes: text.length, body, fase: "listing" });
      } catch {
        /* ignore */
      }
    })();
  });

  try {
    // ─── Pre-navegación específica por casa ───
    if (casa === "stake") {
      // Stake cookie banner está en Shadow DOM. document.querySelectorAll
      // NO penetra Shadow DOM, pero page.locator() de Playwright SÍ lo
      // hace por default. Usamos eso para encontrar y clickear "Aceptar".
      console.log(`  [stake] pre-nav: home stake.pe`);
      try {
        await page.goto("https://stake.pe/", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForTimeout(4000);
        // Intento 1: Playwright locator (penetra Shadow DOM)
        let banner_clickeado = false;
        try {
          const btn = (page as any).locator(
            'button:has-text("Aceptar"), button:has-text("Accept")',
          );
          if (await btn.first().isVisible({ timeout: 2500 })) {
            await btn.first().click({ timeout: 3000 });
            banner_clickeado = true;
            console.log(`  [stake] ✓ cookie banner ACEPTADO via locator`);
            await page.waitForTimeout(1500);
          }
        } catch {
          /* ignore — cae al fallback */
        }
        // Fallback: el viejo cerrarOverlaysStake (sin Shadow DOM)
        if (!banner_clickeado) {
          const acciones1 = await cerrarOverlaysStake(page);
          if (acciones1.length > 0) {
            banner_clickeado = true;
            console.log(`  [stake] overlays cerrados en home (fallback): ${acciones1.join(", ")}`);
          } else {
            console.log(`  [stake] sin overlays detectables en home`);
          }
        }
        await page.waitForTimeout(2500);
      } catch (err) {
        console.log(`  [stake] pre-nav falló: ${(err as Error).message}`);
      }
    }

    if (casa === "coolbet") {
      // Coolbet WAF Imperva. Pre-navegación corta para no saturar el
      // browser: home → listing. Si Imperva sigue bloqueando, queda
      // como caso aparte (necesita Browserless o similar).
      console.log(`  [coolbet] pre-nav: home coolbet.pe`);
      try {
        await page.goto("https://www.coolbet.pe/", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForTimeout(4000);
      } catch (err) {
        console.log(`  [coolbet] pre-nav falló (no crítico): ${(err as Error).message}`);
      }
    }

    console.log(`  [${casa}] navegando listing: ${url}`);
    let navResp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    let status = navResp?.status() ?? 0;
    let title = await page.title().catch(() => "");
    console.log(`  [${casa}] goto status=${status} · title="${title.slice(0, 60)}"`);

    // Coolbet: si el primer goto da 403, intentar UN reload tras espera.
    // Imperva a veces deja pasar cuando ve actividad real (cookies de
    // challenge resueltas en primer intento).
    if (casa === "coolbet" && (status === 403 || status === 451)) {
      console.log(`  [coolbet] primer goto 403 · esperando 5s y reload`);
      await page.waitForTimeout(5000);
      try {
        navResp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
        status = navResp?.status() ?? 0;
        title = await page.title().catch(() => "");
        console.log(`  [coolbet] reload goto status=${status} · title="${title.slice(0, 60)}"`);
      } catch (err) {
        console.log(`  [coolbet] reload falló: ${(err as Error).message}`);
      }
    }

    if (status === 403 || status === 451) {
      result.status = "blocked";
      result.err = `goto status ${status}`;
      return result;
    }

    await page.waitForTimeout(1500);
    const overlays = await cerrarOverlays(page);
    if (overlays.length > 0) console.log(`  [${casa}] overlays: ${overlays.join(", ")}`);
    await page.waitForTimeout(2000);
    await scrollSuave(page);
    await page.waitForTimeout(TIEMPO_ESPERA_MS);

    // ─── Doble navegación: Doradobet al detalle del partido ───
    // El listing solo trae 6 markets con la línea "principal" de Total.
    // El detalle del partido expone TODAS las líneas (incluyendo 2.5).
    //
    // Doradobet usa el widget Altenar in-page con Shadow DOM (no iframe).
    // `document.querySelectorAll` NO penetra Shadow DOM, pero el
    // `page.locator()` de Playwright SÍ. Approach: usar getByText() que
    // matchea cualquier elemento clickeable (anchor, div, button, span)
    // visible con el texto del equipo, click → la SPA navega + dispara
    // XHRs detalle Altenar naturales (igual que un usuario humano).
    //
    // Si el click no funciona, fallback: probar varios patrones URL.
    if (casa === "doradobet") {
      try {
        // Pre-parse del eventId — útil para selectors fallback
        let doradobetEventId: number | string | null = null;
        for (const j of todosJsons) {
          const b: any = j.body;
          if (
            !b ||
            !Array.isArray(b.events) ||
            !Array.isArray(b.competitors)
          ) {
            continue;
          }
          const competitorsById = new Map<number, any>();
          for (const c of b.competitors) competitorsById.set(c.id, c);
          for (const ev of b.events) {
            const cL = competitorsById.get(ev.competitorIds?.[0])?.name;
            const cV = competitorsById.get(ev.competitorIds?.[1])?.name;
            if (!cL || !cV) continue;
            if (
              similitudEquipos(cL, partido.equipoLocal) >= UMBRAL_FUZZY &&
              similitudEquipos(cV, partido.equipoVisita) >= UMBRAL_FUZZY
            ) {
              doradobetEventId = ev.id;
              break;
            }
          }
          if (doradobetEventId !== null) break;
        }
        console.log(
          `  [doradobet] pre-parse eventId del partido: ${doradobetEventId ?? "(no encontrado)"}`,
        );

        // 1) Click en cualquier elemento visible con el texto del equipo
        //    (penetra Shadow DOM via Playwright locator).
        const cantPreClick = todosJsons.length;
        let clickeado = false;
        try {
          const pageAny = page as any;
          // page.getByText devuelve un Locator que penetra Shadow DOM
          const candidatosLocator: any[] = [];
          if (typeof pageAny.getByText === "function") {
            candidatosLocator.push(
              pageAny.getByText(partido.equipoLocal, { exact: false }),
            );
            candidatosLocator.push(
              pageAny.getByText(partido.equipoVisita, { exact: false }),
            );
          }
          // Fallback: locators con `text=` (también penetran Shadow DOM)
          candidatosLocator.push(
            pageAny.locator(`text=${partido.equipoLocal}`),
            pageAny.locator(`text=${partido.equipoVisita}`),
          );
          for (const loc of candidatosLocator) {
            try {
              const first = loc.first();
              if (await first.isVisible({ timeout: 2500 })) {
                await first.click({ timeout: 5000 });
                clickeado = true;
                console.log(
                  `  [doradobet] ✓ click en partido via locator (Shadow DOM)`,
                );
                break;
              }
            } catch {
              /* probar siguiente */
            }
          }
        } catch (err) {
          console.log(
            `  [doradobet] error en click locator: ${(err as Error).message}`,
          );
        }

        if (clickeado) {
          await page.waitForTimeout(3000);
          await scrollSuave(page);
          await page.waitForTimeout(TIEMPO_ESPERA_MS);
          const nuevos = todosJsons.length - cantPreClick;
          const finalUrl =
            typeof page.url === "function" ? page.url() : "";
          console.log(
            `  [doradobet] post-click: ${nuevos} JSONs nuevos · finalUrl=${finalUrl.slice(0, 120)}`,
          );
          // Nota: la línea ±2.5 de Total goles para partidos con favorito
          // claro (ej. Bayern @1.58 vs PSG) NO se publica via XHR HTTP en
          // Doradobet. La UI la muestra (probablemente via WebSocket del
          // endpoint sb2integration-altenar2), pero no se captura aquí.
          // Para partidos parejos (típico Liga 1 Perú) sí debería estar
          // en typeId=18 con sv=2.5 en GetEventDetails.
        } else {
          console.log(`  [doradobet] click locator no encontró partido`);
          // 2) Fallback: probar URLs detalle directas
          if (doradobetEventId !== null) {
            const candidatosUrl = [
              `https://doradobet.com/deportes/partido/${doradobetEventId}`,
              `https://doradobet.com/deportes/match/${doradobetEventId}`,
              `https://doradobet.com/deportes/event/${doradobetEventId}`,
              `https://doradobet.com/deportes/evento/${doradobetEventId}`,
            ];
            for (const urlDetalle of candidatosUrl) {
              try {
                const cantPreNav = todosJsons.length;
                console.log(`  [doradobet] fallback URL: ${urlDetalle}`);
                const navResp2 = await page.goto(urlDetalle, {
                  waitUntil: "domcontentloaded",
                  timeout: 30000,
                });
                const status2 = navResp2?.status() ?? 0;
                if (
                  status2 === 404 ||
                  status2 >= 400
                ) {
                  console.log(`  [doradobet] descartar status=${status2}`);
                  continue;
                }
                await page.waitForTimeout(2500);
                await scrollSuave(page);
                await page.waitForTimeout(TIEMPO_ESPERA_MS);
                const nuevos = todosJsons.length - cantPreNav;
                console.log(`  [doradobet] post-URL: ${nuevos} JSONs nuevos`);
                if (nuevos > 0) break;
              } catch (err) {
                console.log(
                  `  [doradobet] URL fallback falló: ${(err as Error).message}`,
                );
              }
            }
          }
        }
      } catch (err) {
        console.log(`  [doradobet] doble nav falló: ${(err as Error).message}`);
      }
    }

    // ─── Doble navegación: Stake al detalle del partido ───
    if (casa === "stake") {
      // Stake usa URL detalle tipo:
      // {listing_url}/{slug-vs-slug}/{eventId}
      // donde {listing_url} es la URL del listing de la liga (la del param `url`).
      // Construimos el slug del partido a partir de los nombres + el id
      // capturado en el listing (busqueda por team_name).
      let stakeEventId = "";
      let stakeSlug = "";
      // Buscar el event matched en JSONs ya capturados
      for (const j of todosJsons) {
        try {
          const events = j.body?.events;
          if (!Array.isArray(events)) continue;
          for (const ev of events) {
            const odds = Object.values(ev.main_odds?.main ?? {}) as any[];
            const oL = odds.find((o) => o.odd_code === "ODD_S1");
            const oV = odds.find((o) => o.odd_code === "ODD_S2");
            if (
              oL?.team_name &&
              oV?.team_name &&
              similitudEquipos(oL.team_name, partido.equipoLocal) >= UMBRAL_FUZZY &&
              similitudEquipos(oV.team_name, partido.equipoVisita) >= UMBRAL_FUZZY
            ) {
              stakeEventId = String(ev.id ?? "");
              const slugLocal = String(oL.team_name).toLowerCase().replace(/\s+/g, "-");
              const slugVisita = String(oV.team_name).toLowerCase().replace(/\s+/g, "-");
              stakeSlug = `${slugLocal}-vs-${slugVisita}`;
              break;
            }
          }
          if (stakeEventId) break;
        } catch {
          /* ignore */
        }
      }
      if (stakeEventId && stakeSlug) {
        // Stake: la SPA NO monta el detalle al navegar directo por URL.
        // Hay que hacer CLICK en el partido desde el listing para que la
        // SPA lo renderice y dispare los XHRs adicionales de markets.
        console.log(`  [stake] buscando link del partido en listing para click`);
        try {
          // Probamos varios selectores para encontrar el link/elemento
          // clickeable del partido específico — los nombres de equipos
          // vienen del partido buscado.
          const selectoresTexto = [partido.equipoLocal, partido.equipoVisita];
          const selectores = [
            `a[href*="${stakeEventId}"]`,
            `a[href*="${stakeSlug}"]`,
            ...selectoresTexto.flatMap((t) => [
              `a:has-text("${t}")`,
              `[role="link"]:has-text("${t}")`,
            ]),
          ];
          let clickeado = false;
          for (const sel of selectores) {
            try {
              const link = (page as any).locator(sel).first();
              if (await link.isVisible({ timeout: 2500 })) {
                await link.click({ timeout: 5000 });
                clickeado = true;
                console.log(`  [stake] ✓ click en partido via selector: ${sel.slice(0, 60)}`);
                break;
              }
            } catch {
              /* probar siguiente selector */
            }
          }
          if (!clickeado) {
            // Fallback: navegación directa.
            // La URL detalle se deriva del listing URL ya recibido (param `url`).
            // Patrón: {listing}/{slug-local-vs-visita}/{eventId}
            const listingBase = url.replace(/\/$/, "");
            const urlDetalle = `${listingBase}/${stakeSlug}/${stakeEventId}`;
            console.log(`  [stake] click no funcionó · fallback goto: ${urlDetalle}`);
            await page.goto(urlDetalle, { waitUntil: "domcontentloaded", timeout: 35000 });
          }
          await page.waitForTimeout(4000);
          // Cerrar banner si reaparece tras click (también via locator
          // para penetrar Shadow DOM)
          try {
            const btn = (page as any).locator(
              'button:has-text("Aceptar"), button:has-text("Accept")',
            );
            if (await btn.first().isVisible({ timeout: 1500 })) {
              await btn.first().click({ timeout: 3000 });
              console.log(`  [stake] banner re-aceptado en detalle`);
              await page.waitForTimeout(2000);
            }
          } catch {
            /* ignore */
          }
          // Scroll agresivo para forzar lazy load de markets adicionales
          console.log(`  [stake] scroll agresivo para lazy load`);
          await scrollAgresivo(page);
          await page.waitForTimeout(TIEMPO_ESPERA_MS);
          console.log(`  [stake] detalle: ${todosJsons.length} JSONs totales · URL final=${page.url()}`);
        } catch (err) {
          console.log(`  [stake] detalle falló: ${(err as Error).message}`);
        }
      } else {
        console.log(`  [stake] sin slug/eventId del partido — sin doble nav`);
      }
    }

    // ─── Doble navegación: Inkabet al detalle del partido ───
    if (casa === "inkabet") {
      const slug = encontrarSlugInkabet(todosJsons, partido);
      if (slug) {
        const urlDetalle = `https://inkabet.pe/pe/apuestas-deportivas/${slug}`;
        console.log(`  [inkabet] doble navegación al detalle: ${urlDetalle}`);
        try {
          await page.goto(urlDetalle, {
            waitUntil: "domcontentloaded",
            timeout: 35000,
          });
          await page.waitForTimeout(2000);
          await scrollSuave(page);
          await page.waitForTimeout(TIEMPO_ESPERA_MS);
        } catch (err) {
          console.log(`  [inkabet] doble nav falló: ${(err as Error).message}`);
        }
      } else {
        console.log(`  [inkabet] slug del partido no encontrado en listing — sin doble nav`);
      }
    }

    result.totalJsons = todosJsons.length;
    result.jsonsConToken = todosJsons.filter((j) => {
      try {
        return jsonContieneRastroPartido(JSON.stringify(j.body), partido);
      } catch {
        return false;
      }
    }).length;

    console.log(`  [${casa}] capturados ${todosJsons.length} JSONs (${result.jsonsConToken} con token)`);

    // Parser
    const parser = PARSERS[casa];
    if (!parser) {
      result.status = "error";
      result.err = "parser no implementado";
      return result;
    }

    const r = parser(todosJsons, partido.equipoLocal, partido.equipoVisita);

    // ─── Doble navegación post-match: Apuesta Total → detalle ───
    if (casa === "apuesta_total" && r && r.eventoId) {
      // Apuesta Total (Kambi SPA): la URL detalle es del tipo
      // /apuestas-deportivas/?fpath=/es-pe/spbkv3/{Sport}/{Region}/{League}/{slug}/{eventId}
      //
      // Para Liga 1 funciona con `Fútbol/Perú/Liga-1`. Para otras ligas
      // intentamos derivar el path desde `mejorFix` (snapshot Kambi
      // suele exponer SportName/RegionName/LeagueName o un Path).
      // Si no se logra derivar, fallback a click en DOM, después no-op.
      const cantPreDetalle = todosJsons.length;
      let detalleNavegado = false;
      // Debug: top-level keys del fixture matched + valores tipo path
      try {
        const fx = r.fixtureRaw ?? {};
        const keys = Object.keys(fx).slice(0, 30);
        console.log(`  [apuesta_total/debug] fixtureRaw keys: ${JSON.stringify(keys)}`);
        const candidatosPath: Record<string, any> = {};
        for (const k of [
          "Path",
          "NeutralPath",
          "PathSlug",
          "SportName",
          "RegionName",
          "LeagueName",
          "League",
          "Region",
          "Sport",
          "URL",
          "Url",
        ]) {
          if (k in fx) candidatosPath[k] = fx[k];
        }
        if (Object.keys(candidatosPath).length > 0) {
          console.log(
            `  [apuesta_total/debug] fixture path-like fields: ${JSON.stringify(candidatosPath).slice(0, 400)}`,
          );
        }
      } catch {
        /* ignore */
      }
      // 1) URL navigation con path derivado del fixture
      try {
        const fx = r.fixtureRaw ?? {};
        const sportName: string | undefined =
          (typeof fx.SportName === "string" && fx.SportName) ||
          (typeof fx.Sport === "string" && fx.Sport) ||
          fx.Sport?.Name;
        const regionName: string | undefined =
          (typeof fx.RegionName === "string" && fx.RegionName) ||
          (typeof fx.Region === "string" && fx.Region) ||
          fx.Region?.Name;
        const leagueName: string | undefined =
          (typeof fx.LeagueName === "string" && fx.LeagueName) ||
          (typeof fx.League === "string" && fx.League) ||
          fx.League?.Name;
        // Slug del partido: de los nombres de equipo del PARTIDO buscado
        const slugLocal = partido.equipoLocal.replace(/\s+/g, "-");
        const slugVisita = partido.equipoVisita.replace(/\s+/g, "-");
        const slugPartido = `${slugLocal}-vs-${slugVisita}`;
        if (sportName && regionName && leagueName) {
          const sport = sportName.replace(/\s+/g, "-");
          const region = regionName.replace(/\s+/g, "-");
          const league = leagueName.replace(/\s+/g, "-");
          const urlDetalle = `https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/${sport}/${region}/${league}/${slugPartido}/${r.eventoId}`;
          console.log(`  [apuesta_total] navegando detalle (URL derivada): ${urlDetalle}`);
          await page.goto(urlDetalle, {
            waitUntil: "domcontentloaded",
            timeout: 35000,
          });
          await page.waitForTimeout(2000);
          await scrollSuave(page);
          await page.waitForTimeout(TIEMPO_ESPERA_MS);
          detalleNavegado = true;
          console.log(`  [apuesta_total] detalle: ${todosJsons.length} JSONs totales (listing+detalle)`);
        } else {
          console.log(
            `  [apuesta_total] fixture no expuso Sport/Region/League — saltando URL derivada`,
          );
        }
      } catch (err) {
        console.log(`  [apuesta_total] navegación URL derivada falló: ${(err as Error).message}`);
      }
      // 2) Fallback: click en DOM
      if (!detalleNavegado) {
        try {
          console.log(`  [apuesta_total] fallback click DOM`);
          const selectoresTexto = [partido.equipoLocal, partido.equipoVisita];
          const selectores = [
            `a[href*="${r.eventoId}"]`,
            ...selectoresTexto.flatMap((t) => [
              `a:has-text("${t}")`,
              `[role="link"]:has-text("${t}")`,
              `[role="button"]:has-text("${t}")`,
            ]),
          ];
          for (const sel of selectores) {
            try {
              const link = (page as any).locator(sel).first();
              if (await link.isVisible({ timeout: 2500 })) {
                await link.click({ timeout: 5000 });
                detalleNavegado = true;
                console.log(`  [apuesta_total] ✓ click en partido via selector: ${sel.slice(0, 60)}`);
                break;
              }
            } catch {
              /* probar siguiente */
            }
          }
          if (detalleNavegado) {
            await page.waitForTimeout(2000);
            await scrollSuave(page);
            await page.waitForTimeout(TIEMPO_ESPERA_MS);
            console.log(`  [apuesta_total] detalle: ${todosJsons.length} JSONs totales (listing+detalle)`);
          } else {
            console.log(`  [apuesta_total] no se encontró link del partido en listing — sin doble nav`);
          }
        } catch (err) {
          console.log(`  [apuesta_total] fallback click falló: ${(err as Error).message}`);
        }
      }
      const nuevosDetalle = todosJsons.slice(cantPreDetalle);
      console.log(`  [apuesta_total/debug] ${nuevosDetalle.length} JSONs nuevos del detalle`);
      // Re-parsear con TODOS los JSONs (listing + detalle).
      const r2 = parser(todosJsons, partido.equipoLocal, partido.equipoVisita);
      if (r2 && r2.cuotas) {
        Object.assign(r, r2);
      }
    }

    if (!r) {
      result.status = "no-match";
      console.log(`  [${casa}] parser no encontró el partido`);
      return result;
    }

    result.cuotas = r.cuotas;
    result.eventoNombre = r.eventoNombre;
    result.jsonUrl = r.jsonUrl;
    const faltan = mercadosFaltantes(r.cuotas as any);
    result.faltan = faltan;
    result.status = faltan.length === 0 ? "complete" : "partial";

    if (faltan.length === 0) {
      console.log(`  [${casa}] ✓ COMPLETO 4/4 mercados · "${r.eventoNombre}"`);
    } else {
      console.log(
        `  [${casa}] ⚠ PARCIAL ${4 - faltan.length}/4 · faltan=[${faltan.join(",")}] · "${r.eventoNombre}"`,
      );
    }
    console.log(`    cuotas: ${JSON.stringify(r.cuotas)}`);
  } catch (err) {
    result.status = "error";
    result.err = (err as Error).message;
    console.log(`  [${casa}] ERROR: ${result.err}`);
  } finally {
    await page.close().catch(() => {});
    result.ms = Date.now() - t0;
  }

  return result;
}

// ─── Main ────────────────────────────────────────────────────────────

// Partido de prueba: editá acá para cambiar el partido testeado.
// `liga` debe ser uno de los nombres canónicos detectables por
// `detectarLigaCanonica()` (ver `lib/services/scrapers/ligas-id-map.ts`).
const PARTIDO_TEST: PartidoTest = {
  equipoLocal: "Bayern München",
  equipoVisita: "Paris Saint Germain",
  liga: "UEFA Champions League",
};

async function procesarPartido(partido: PartidoTest): Promise<void> {
  const chromePath = detectarChromePath();
  const perfilReal = detectarPerfilRealChrome();
  const perfilUsado = perfilReal ?? path.join(os.homedir(), ".habla-playwright-data");

  console.log("─── Probar scrapers LOCAL V3 (perfil real Chrome) ───────────");
  console.log(` Chrome: ${chromePath ?? "(bundled)"}`);
  console.log(` Profile: ${perfilUsado}`);
  if (perfilReal) {
    console.log(`   ⚠ ESTÁS USANDO TU PERFIL REAL DE CHROME.`);
    console.log(`   ⚠ Si Chrome está abierto, el script va a fallar.`);
    console.log(`   ⚠ Si querés volver al perfil aislado, borrá la carpeta`);
    console.log(`     ${perfilReal} (no — eso borra tu Chrome real).`);
    console.log(`     En vez de eso, edita el script y comentá detectarPerfilRealChrome().`);
  }
  console.log(` Partido: ${partido.equipoLocal} vs ${partido.equipoVisita}`);
  console.log(` Liga: ${partido.liga}`);

  // Detectar liga canónica + resolver URLs de listing por casa.
  const ligaCanonica = detectarLigaCanonica(partido.liga);
  if (!ligaCanonica) {
    console.error(
      `\n✗ La liga "${partido.liga}" no se pudo mapear a una liga canónica.`,
    );
    console.error(
      `  Editá lib/services/scrapers/ligas-id-map.ts si querés agregarla.`,
    );
    process.exit(1);
  }
  const urlsPorCasa = URLS_LISTING_POR_LIGA[ligaCanonica] ?? {};
  console.log(` Liga canónica: ${ligaCanonica}`);
  console.log(
    ` Casas con URL: ${Object.keys(urlsPorCasa).join(", ") || "(ninguna)"}`,
  );
  console.log("");

  let context: any;
  try {
    context = await chromium.launchPersistentContext(perfilUsado, {
      headless: false,
      executablePath: chromePath,
      viewport: { width: 1366, height: 800 },
      locale: "es-PE",
      timezoneId: "America/Lima",
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`\n✗ No se pudo lanzar Chrome con el perfil real.`);
    if (msg.includes("ProcessSingleton") || msg.includes("in use") || msg.includes("locked")) {
      console.error(`  Causa: Google Chrome está abierto.`);
      console.error(`  Solución: cerrá todas las ventanas de Chrome y reintentá.`);
      console.error(`  Si aún así no anda, ejecutá en cmd: taskkill /F /IM chrome.exe`);
    } else {
      console.error(`  Error: ${msg}`);
    }
    process.exit(1);
  }

  const resultados: ResultadoCasa[] = [];

  for (const casa of CASAS_ACTIVAS) {
    if (CASAS_A_PROBAR.length > 0 && !CASAS_A_PROBAR.includes(casa)) {
      continue;
    }
    const url = urlsPorCasa[casa];
    if (!url) {
      console.log(`\n▶ ${casa.toUpperCase()}  (skip — sin URL para "${ligaCanonica}")`);
      resultados.push({
        casa,
        status: "no-match",
        totalJsons: 0,
        jsonsConToken: 0,
        ms: 0,
        err: `sin URL configurada para liga "${ligaCanonica}"`,
      });
      continue;
    }
    console.log(`\n▶ ${casa.toUpperCase()}`);
    const r = await probarCasa(context, casa, url, partido);
    resultados.push(r);
  }

  console.log("\n─── RESUMEN ─────────────────────────────────────────────────");
  let completos = 0;
  let parciales = 0;
  let fallidos = 0;
  let bloqueados = 0;
  for (const r of resultados) {
    let tag: string;
    switch (r.status) {
      case "complete":
        tag = "✓ COMPLETO 4/4";
        completos++;
        break;
      case "partial":
        tag = `⚠ PARCIAL · faltan=[${r.faltan?.join(",")}]`;
        parciales++;
        break;
      case "no-match":
        tag = "✗ partido no encontrado";
        fallidos++;
        break;
      case "blocked":
        tag = `✗ BLOQUEADO (${r.err})`;
        bloqueados++;
        break;
      case "error":
        tag = `✗ ERROR: ${r.err?.slice(0, 60)}`;
        fallidos++;
        break;
    }
    console.log(
      `  ${r.casa.padEnd(15)} ${tag.padEnd(50)} ${r.ms}ms · ${r.totalJsons}j · ${r.jsonsConToken}t`,
    );
  }
  console.log("");
  console.log(`  → completos: ${completos}/${resultados.length}`);
  console.log(`  → parciales: ${parciales}/${resultados.length}`);
  console.log(`  → fallidos:  ${fallidos}/${resultados.length}`);
  console.log(`  → bloqueados: ${bloqueados}/${resultados.length}`);
  console.log("");

  console.log("─── DETALLE DE CUOTAS ───────────────────────────────────────");
  for (const r of resultados) {
    if (!r.cuotas) continue;
    console.log(`  [${r.casa}] "${r.eventoNombre}"`);
    console.log(`    JSON: ${r.jsonUrl?.slice(0, 100)}`);
    if (r.cuotas["1x2"])
      console.log(
        `    1X2:    ${r.cuotas["1x2"].local} / ${r.cuotas["1x2"].empate} / ${r.cuotas["1x2"].visita}`,
      );
    if (r.cuotas.doble_op)
      console.log(
        `    DobleOp: 1X=${r.cuotas.doble_op.x1} / 12=${r.cuotas.doble_op.x12} / X2=${r.cuotas.doble_op.xx2}`,
      );
    if (r.cuotas.mas_menos_25)
      console.log(
        `    ±2.5:   Más=${r.cuotas.mas_menos_25.over} / Menos=${r.cuotas.mas_menos_25.under}`,
      );
    if (r.cuotas.btts)
      console.log(`    BTTS:   Sí=${r.cuotas.btts.si} / No=${r.cuotas.btts.no}`);
  }
  console.log("");

  console.log("Cerrando browser...");
  await context.close();
  console.log("Listo.");
}

procesarPartido(PARTIDO_TEST)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error fatal:", err);
    process.exit(1);
  });
