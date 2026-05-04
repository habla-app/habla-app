// Validación geo-test desde la PC del admin con IP peruana.
//
// Abre Chromium (visible, no headless) una vez por casa, navega al listado
// de Liga 1, intenta aceptar cookies, espera hidratación y captura
// screenshot + diagnóstico (título, URL final, tamaño del body, snippet
// del texto visible).
//
// Salida:
//   - Tabla resumen en consola con OK/FAIL por casa.
//   - `./screenshots/{casa}.png` con captura visual de cada casa.
//   - `./resumen.json` con todo el diagnóstico estructurado.
//
// Uso:
//   1. Asegurate de tener Node.js 18+ instalado.
//      Verificá con:  node --version
//   2. Desde Git Bash, parado en esta carpeta:
//        npm install
//        node validar-geo-test.mjs
//   3. Vas a ver browsers abrirse uno por uno. NO los cierres a mano.
//      Esperá ~3-4 minutos a que termine.

import { chromium } from "playwright-chromium";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const URLS = [
  {
    casa: "stake",
    url: "https://stake.pe/deportes/football/peru/primera-division",
  },
  {
    casa: "apuesta_total",
    url: "https://www.apuestatotal.com/apuestas-deportivas/?fpath=/es-pe/spbkv3/sports/1/category?region=170&league=203110137349808128",
  },
  {
    casa: "coolbet",
    url: "https://www.coolbet.pe/pe/deportes/futbol/per%C3%BA/primera-division-peruana",
  },
  {
    casa: "doradobet",
    url: "https://doradobet.com/deportes/liga/4042",
  },
  {
    casa: "betano",
    url: "https://www.betano.pe/sport/futbol/peru/liga-1/17079/",
  },
  {
    casa: "inkabet",
    url: "https://inkabet.pe/pe/apuestas-deportivas/futbol/peru/peru-liga-1?tab=liveAndUpcoming",
  },
  {
    casa: "te_apuesto",
    url: "https://www.teapuesto.pe/sport/detail/futbol/peru/liga-1-te-apuesto?id=1,476,1899",
  },
];

const SCREENSHOTS_DIR = "./screenshots";
const SLEEP_HIDRATACION_MS = 5_000;

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
        "accept",
        "ok",
        "aceptar todo",
        "accept all",
        "got it",
        "i accept",
        "entendido",
        "de acuerdo",
        "permitir todo",
        "allow all",
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

async function probarCasa({ casa, url }) {
  console.log(`\n[${casa}] navegando...`);
  console.log(`        ${url}`);

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
    ok: false,
    httpStatus: null,
    titulo: "",
    urlFinal: "",
    bodyTextLength: 0,
    bodyTextSnippet: "",
    cookiesAceptadas: false,
    error: null,
    msTotal: 0,
  };

  const tInicio = Date.now();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    resultado.httpStatus = response?.status() ?? null;

    await page.waitForTimeout(2000);
    resultado.cookiesAceptadas = await intentarAceptarCookies(page);
    if (resultado.cookiesAceptadas) {
      await page.waitForTimeout(2000);
    }

    await page.waitForTimeout(SLEEP_HIDRATACION_MS);

    const diag = await page.evaluate(() => {
      const titulo = document.title?.slice(0, 200) ?? "";
      const urlFinal = window.location.href;
      const bodyText = document.body?.innerText ?? "";
      return {
        titulo,
        urlFinal,
        bodyTextLength: bodyText.length,
        bodyTextSnippet: bodyText.slice(0, 1500),
      };
    });
    Object.assign(resultado, diag);

    // Heurística de "ok": título no parece error + body razonable + URL no
    // saltó a otro dominio sospechoso.
    const tituloLower = diag.titulo.toLowerCase();
    const sospechas = [
      "acceso denegado",
      "blocked",
      "forbidden",
      "403",
      "404",
      "not available",
      "no disponible",
      "geo",
      "restringido",
      "restricted",
      "checking your browser",
      "just a moment",
    ];
    const tituloSospechoso = sospechas.some((s) => tituloLower.includes(s));
    resultado.ok = diag.bodyTextLength > 1500 && !tituloSospechoso;

    await mkdir(SCREENSHOTS_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, `${casa}.png`),
      fullPage: false,
    });

    resultado.msTotal = Date.now() - tInicio;
    console.log(
      `[${casa}] ${resultado.ok ? "OK  " : "FAIL"} status=${resultado.httpStatus} body=${diag.bodyTextLength} cookies=${resultado.cookiesAceptadas} (${resultado.msTotal}ms)`,
    );
    console.log(`        titulo: "${diag.titulo.slice(0, 80)}"`);
  } catch (err) {
    resultado.error = err.message;
    resultado.msTotal = Date.now() - tInicio;
    console.log(`[${casa}] FAIL ERROR: ${err.message}`);
  } finally {
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
  }

  return resultado;
}

async function main() {
  const sep = "=".repeat(72);
  console.log(sep);
  console.log("Validación geo-test desde IP peruana — 7 sportsbooks");
  console.log(sep);
  console.log("Vas a ver ventanas de Chromium abrirse una por una.");
  console.log("NO las cierres manualmente. Esperá ~3-4 minutos.");
  console.log("Resultados en ./resumen.json y ./screenshots/");
  console.log(sep);

  const resultados = [];
  for (const item of URLS) {
    const r = await probarCasa(item);
    resultados.push(r);
  }

  console.log("\n" + sep);
  console.log("RESUMEN");
  console.log(sep);
  console.log(
    "casa             status  body chars  cookies  resultado".padEnd(72),
  );
  console.log("-".repeat(72));
  for (const r of resultados) {
    const flag = r.ok ? "OK  " : "FAIL";
    console.log(
      `${r.casa.padEnd(15)}  ${String(r.httpStatus ?? "-").padEnd(6)}  ${String(r.bodyTextLength).padStart(10)}  ${String(r.cookiesAceptadas).padEnd(7)}  ${flag}`,
    );
  }
  const oks = resultados.filter((r) => r.ok).length;
  console.log("-".repeat(72));
  console.log(`${oks} de ${URLS.length} casas accesibles desde tu IP peruana`);
  console.log(sep);

  await writeFile(
    "resumen.json",
    JSON.stringify(resultados, null, 2),
    "utf-8",
  );
  console.log("\nResultado completo en: resumen.json");
  console.log(`Screenshots de cada casa en: ${SCREENSHOTS_DIR}/`);
  console.log("\nMandale al asistente:");
  console.log("  1. El contenido completo de resumen.json");
  console.log("  2. Los screenshots de las casas que aparezcan FAIL");
  console.log("     (no hace falta los OK).\n");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
