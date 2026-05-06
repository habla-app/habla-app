/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Prueba LOCAL de los 6 scrapers desde tu PC con Chrome real.
 * (Lote V.12.5 — May 2026, fase 0: feasibility test)
 *
 * Por qué local:
 *   Las casas Coolbet/Betano/Inkabet bloquean al headless desde Railway US
 *   (datacenter IP + TLS fingerprint distinto al de Chrome real). Desde
 *   tu PC con IP residencial peruana + Chrome del sistema, esperamos que
 *   pase sin problemas de WAF.
 *
 * Cómo correrlo (Windows PowerShell):
 *
 *   1. Asegurate que tenés Google Chrome instalado en la ruta default,
 *      o seteá la env var:
 *          $env:LOCAL_CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
 *
 *   2. Desde la raíz del repo:
 *          pnpm --filter @habla/web run probar-scrapers
 *
 *   3. Se abrirá una ventana de Chrome (headful). El script va a:
 *      - Para cada una de las 6 casas:
 *        - Navegar a la URL del listing de Liga 1 Perú
 *        - Cerrar overlays/cookies (defensivo)
 *        - Esperar 8s + scroll para forzar lazy-load
 *        - Capturar las XHRs JSON con estructura de cuotas
 *        - Probar el parser correspondiente para extraer cuotas
 *      - Mostrar resumen: por casa, qué mercados se obtuvieron.
 *
 *   4. NO toca Railway, NO toca Postgres, NO persiste nada.
 *      Es 100% un test de feasibility (¿pasamos los WAFs desde tu PC?).
 *
 * Output esperado por casa:
 *   ✓ {casa}: COMPLETO (4/4 mercados) · {ms}
 *   ⚠ {casa}: PARCIAL (3/4) · faltan=[doble_op] · {ms}
 *   ✗ {casa}: null · {ms}
 *   ✗ {casa}: error: ... · {ms}
 *
 * Si las 3 casas que fallaban en Railway (Coolbet/Betano/Inkabet) ahora
 * dan COMPLETO o PARCIAL desde tu PC, confirmamos que el problema era
 * IP/TLS, no nuestro código. Después conectamos al backend con un agente
 * polling-based.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Aplicamos stealth al chromium ANTES del launch (mismo singleton que
// browser.ts usaría, pero acá tomamos el control directo).
chromium.use(StealthPlugin());

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

async function main() {
  const chromePath = detectarChromePath();
  const userDataDir = path.join(os.homedir(), ".habla-playwright-data");

  console.log("─── Probar scrapers LOCAL ─────────────────────────────────");
  console.log(` Chrome path: ${chromePath ?? "(bundled de Playwright)"}`);
  console.log(` Profile dir: ${userDataDir}`);
  console.log(`   → cookies y sesión persisten entre corridas (no toca`);
  console.log(`     tu Chrome principal, es un perfil aislado).`);
  console.log("");

  if (!chromePath) {
    console.log("⚠ Chrome no detectado en rutas default.");
    console.log("  Instalá Chrome o seteá $env:LOCAL_CHROME_PATH = \"...\"");
    console.log("  Si seguís sin path, intentaré con el bundled de Playwright");
    console.log("  (requiere `npx playwright install chromium` previo).");
    console.log("");
  }

  console.log("Lanzando Chrome (headful)...");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: chromePath,
    viewport: { width: 1366, height: 800 },
    locale: "es-PE",
    timezoneId: "America/Lima",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  // Truco: settear el singleton de browser.ts en globalThis ANTES de
  // importar los scrapers. Como browser.ts hace lazy-init revisando
  // `globalThis.__pwBrowser`, si ya está seteado, lo reusa sin crear
  // browser nuevo. Esto nos permite reutilizar 100% de los scrapers sin
  // tocar su código.
  const g = globalThis as any;
  g.__pwBrowser = context.browser();
  g.__pwContext = context;
  g.__pwPagesEnVuelo = 0;
  g.__pwUltimoUsoMs = Date.now();

  // Importes lazy POST-setup de globalThis.
  const { default: doradobetScraper } = await import(
    "../lib/services/scrapers/doradobet.scraper"
  );
  const { default: apuestaTotalScraper } = await import(
    "../lib/services/scrapers/apuesta-total.scraper"
  );
  const { default: coolbetScraper } = await import(
    "../lib/services/scrapers/coolbet.scraper"
  );
  const { default: betanoScraper } = await import(
    "../lib/services/scrapers/betano.scraper"
  );
  const { default: inkabetScraper } = await import(
    "../lib/services/scrapers/inkabet.scraper"
  );
  const { default: teApuestoScraper } = await import(
    "../lib/services/scrapers/te-apuesto.scraper"
  );
  const { obtenerLigaIdParaPartido } = await import(
    "../lib/services/scrapers/ligas-id-map"
  );
  const { mercadosFaltantes } = await import(
    "../lib/services/scrapers/types"
  );

  const scrapers = [
    doradobetScraper,
    apuestaTotalScraper,
    coolbetScraper,
    betanoScraper,
    inkabetScraper,
    teApuestoScraper,
  ];

  // Mock partido — UTC Cajamarca vs FC Cajamarca, Liga 1 Perú.
  // (Hardcoded; cambiar si querés probar otro partido.)
  const partido = {
    id: "test-partido-local",
    equipoLocal: "UTC Cajamarca",
    equipoVisita: "FC Cajamarca",
    liga: "Liga 1 Perú",
    fechaInicio: new Date("2026-05-08T20:00:00Z"),
  } as any;

  console.log("");
  console.log(
    `─── Probando ${scrapers.length} scrapers contra: ${partido.equipoLocal} vs ${partido.equipoVisita} (${partido.liga})`,
  );
  console.log("");

  type ResultadoTest =
    | { casa: string; status: "complete"; presentes: string[]; ms: number }
    | { casa: string; status: "partial"; presentes: string[]; faltan: string[]; ms: number }
    | { casa: string; status: "no-match"; ms: number }
    | { casa: string; status: "error"; err: string; ms: number }
    | { casa: string; status: "no-mapeo"; ms: number };

  const resultados: ResultadoTest[] = [];

  for (const scraper of scrapers) {
    console.log(`▶ Procesando ${scraper.nombre}...`);
    const liga = obtenerLigaIdParaPartido(partido.liga, scraper.nombre);
    if (!liga) {
      console.log(`  liga no mapeada — skip`);
      resultados.push({ casa: scraper.nombre, status: "no-mapeo", ms: 0 });
      continue;
    }

    const t0 = Date.now();
    try {
      const resultado = await scraper.capturarPorApi(partido, liga.ligaIdCasa);
      const ms = Date.now() - t0;

      if (resultado === null) {
        console.log(`  ✗ null (${ms}ms)`);
        resultados.push({ casa: scraper.nombre, status: "no-match", ms });
      } else {
        const faltan = mercadosFaltantes(resultado.cuotas);
        const presentes = Object.keys(resultado.cuotas);

        if (faltan.length === 0) {
          console.log(`  ✓ COMPLETO (4/4) (${ms}ms)`);
          console.log(`    cuotas: ${JSON.stringify(resultado.cuotas)}`);
          resultados.push({
            casa: scraper.nombre,
            status: "complete",
            presentes,
            ms,
          });
        } else {
          console.log(
            `  ⚠ PARCIAL (${presentes.length}/4) — faltan=[${faltan.join(",")}] (${ms}ms)`,
          );
          console.log(`    presentes: ${JSON.stringify(resultado.cuotas)}`);
          resultados.push({
            casa: scraper.nombre,
            status: "partial",
            presentes,
            faltan,
            ms,
          });
        }
        console.log(`    eventIdCasa: ${resultado.eventIdCasa}`);
        if (resultado.equipos) {
          console.log(
            `    equipos: ${resultado.equipos.local} vs ${resultado.equipos.visita}`,
          );
        }
      }
    } catch (err) {
      const ms = Date.now() - t0;
      const msg = (err as Error).message;
      console.log(`  ✗ error: ${msg} (${ms}ms)`);
      resultados.push({ casa: scraper.nombre, status: "error", err: msg, ms });
    }
    console.log("");
  }

  // ─── Resumen final ─────────────────────────────────────────────
  console.log("─── RESUMEN ──────────────────────────────────────────────");
  let completos = 0;
  let parciales = 0;
  let fallidos = 0;
  for (const r of resultados) {
    let tag: string;
    switch (r.status) {
      case "complete":
        tag = "✓ COMPLETO";
        completos++;
        break;
      case "partial":
        tag = `⚠ PARCIAL (faltan: ${r.faltan.join(",")})`;
        parciales++;
        break;
      case "no-match":
        tag = "✗ NO MATCH";
        fallidos++;
        break;
      case "error":
        tag = `✗ ERROR: ${r.err.slice(0, 80)}`;
        fallidos++;
        break;
      case "no-mapeo":
        tag = "  no mapeada";
        break;
    }
    console.log(
      `  ${r.casa.padEnd(15)} ${tag} (${"ms" in r ? `${r.ms}ms` : "-"})`,
    );
  }
  console.log("");
  console.log(`  → completos: ${completos}/${scrapers.length}`);
  console.log(`  → parciales: ${parciales}/${scrapers.length}`);
  console.log(`  → fallidos:  ${fallidos}/${scrapers.length}`);
  console.log("");

  console.log("Cerrando Chrome...");
  await context.close();
  console.log("Listo.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error fatal:", err);
    process.exit(1);
  });
