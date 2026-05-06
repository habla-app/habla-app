/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Agente local del motor de cuotas (Lote V.13 — May 2026).
 *
 * Corre en la PC del admin con Chrome real + perfil persistente. Pollea
 * el backend cada N segundos pidiendo jobs pendientes; por cada job
 * ejecuta el scraper Playwright correspondiente y reporta el resultado.
 *
 * Por qué local:
 *   Las casas Betano/Inkabet bloquean IPs datacenter (Railway US 403
 *   instantáneo desde WAFs Akamai/Imperva). Las APIs B2B "directas" no
 *   exponen todos los mercados que la UI muestra. La única forma
 *   confiable de capturar las 5 casas (apuesta_total/doradobet/betano/
 *   inkabet/te_apuesto) es desde una IP residencial peruana con Chrome
 *   real. Por eso el agente vive en la PC del admin.
 *
 * Cómo correrlo (Windows PowerShell):
 *   1. Cerrá todas las ventanas de Chrome (taskkill /F /IM chrome.exe).
 *   2. Setear env vars (.env.local en apps/web/ o variables de sesión):
 *        HABLA_API_BASE = "https://hablaplay.com"
 *        HABLA_AGENTE_TOKEN = "<el mismo CRON_SECRET de Railway>"
 *   3. pnpm --filter @habla/web run agente-cuotas
 *
 * El agente abre Chrome, queda corriendo polleando, y cierra browser
 * idle a los 15min sin trabajo (libera RAM, próximo job lo re-abre).
 *
 * Para detener: Ctrl+C. Maneja SIGINT cerrando el browser limpio.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import {
  detectarLigaCanonica,
  type LigaCanonica,
} from "../lib/services/scrapers/ligas-id-map";
import type { CasaCuotas, ResultadoScraper } from "../lib/services/scrapers/types";
import { CapturaSinDatosError } from "../lib/services/scrapers/types";

import doradobetScraper from "../lib/services/scrapers/doradobet.scraper";
import apuestaTotalScraper from "../lib/services/scrapers/apuesta-total.scraper";
import betanoScraper from "../lib/services/scrapers/betano.scraper";
import inkabetScraper from "../lib/services/scrapers/inkabet.scraper";
import teApuestoScraper from "../lib/services/scrapers/te-apuesto.scraper";

chromium.use(StealthPlugin());

// ─── Config ───────────────────────────────────────────────────────────

const API_BASE = (process.env.HABLA_API_BASE ?? "").replace(/\/+$/, "");
const TOKEN = process.env.HABLA_AGENTE_TOKEN ?? "";
const POLL_INTERVAL_MS = 15_000;
const POLL_INTERVAL_VACIO_MS = 60_000;
const LIMIT_JOBS_POR_POLL = 5;

if (!API_BASE) {
  console.error("✗ HABLA_API_BASE no configurada");
  process.exit(1);
}
if (!TOKEN) {
  console.error("✗ HABLA_AGENTE_TOKEN no configurada (usar el CRON_SECRET de Railway)");
  process.exit(1);
}

const SCRAPERS: Record<CasaCuotas, (typeof doradobetScraper)> = {
  doradobet: doradobetScraper,
  apuesta_total: apuestaTotalScraper,
  betano: betanoScraper,
  inkabet: inkabetScraper,
  te_apuesto: teApuestoScraper,
};

// ─── Tipos del wire format ────────────────────────────────────────────

interface JobAgente {
  jobId: string;
  partidoId: string;
  casa: CasaCuotas;
  ligaCanonica: LigaCanonica;
  esRefresh: boolean;
  partido: {
    equipoLocal: string;
    equipoVisita: string;
    liga: string;
    fechaInicio: string;
  };
}

// ─── Helpers Chrome local ─────────────────────────────────────────────

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

// El agente reusa el browser singleton de `lib/services/scrapers/browser.ts`
// indirectamente: cada scraper invoca `obtenerPagina()` que lo gestiona.
// Antes de cualquier scraper, "calentamos" un browser persistente con el
// perfil real de Chrome via globalThis (mismo trick que probar-scrapers-local).

async function calentarBrowserConPerfilReal(): Promise<void> {
  const chromePath = detectarChromePath();
  const perfilReal = detectarPerfilRealChrome();
  const perfilUsado =
    perfilReal ?? path.join(os.homedir(), ".habla-agente-data");

  console.log("─── Agente cuotas — boot ─────────────────────────────────");
  console.log(` Chrome: ${chromePath ?? "(bundled)"}`);
  console.log(` Profile: ${perfilUsado}`);
  if (perfilReal) {
    console.log(`   ⚠ Usando tu perfil real de Chrome.`);
    console.log(`   ⚠ Si tenés Chrome abierto, el agente va a fallar.`);
    console.log(`     Cerrá Chrome o ejecutá: taskkill /F /IM chrome.exe`);
  }
  console.log(` API: ${API_BASE}`);
  console.log("");

  // Lanzar persistent context y guardarlo en globalThis para que el
  // singleton de `browser.ts` lo reuse en lugar de lanzar uno nuevo.
  const context = await chromium.launchPersistentContext(perfilUsado, {
    headless: false,
    executablePath: chromePath,
    viewport: { width: 1366, height: 800 },
    locale: "es-PE",
    timezoneId: "America/Lima",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const browser = (context as any).browser?.();
  if (!browser) {
    throw new Error("launchPersistentContext no retornó browser ascendiente");
  }
  const g = globalThis as any;
  g.__pwBrowser = browser;
  g.__pwContext = context;
  g.__pwPagesEnVuelo = 0;
  g.__pwUltimoUsoMs = Date.now();
}

// ─── Cliente HTTP ─────────────────────────────────────────────────────

async function fetchProximosJobs(): Promise<JobAgente[]> {
  const url = `${API_BASE}/api/v1/admin/agente/jobs/proximos?limit=${LIMIT_JOBS_POR_POLL}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`GET proximos status=${res.status}`);
  }
  const json = (await res.json()) as { jobs: JobAgente[] };
  return json.jobs;
}

async function reportarResultado(args: {
  job: JobAgente;
  kind: "ok" | "sin_datos" | "error";
  resultado?: ResultadoScraper;
  mensaje?: string;
}): Promise<void> {
  const { job, kind, resultado, mensaje } = args;
  const url = `${API_BASE}/api/v1/admin/agente/jobs/resultado`;
  const body: any = {
    jobId: job.jobId,
    partidoId: job.partidoId,
    casa: job.casa,
    ligaCanonica: job.ligaCanonica,
    kind,
  };
  if (kind === "ok" && resultado) {
    body.resultado = {
      cuotas: resultado.cuotas,
      fuente: {
        url: resultado.fuente.url,
        capturadoEn: resultado.fuente.capturadoEn.toISOString(),
      },
      eventIdCasa: resultado.eventIdCasa,
      equipos: resultado.equipos,
    };
  }
  if (mensaje) body.mensaje = mensaje;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`POST resultado status=${res.status} body=${txt.slice(0, 200)}`);
  }
}

// ─── Loop principal ────────────────────────────────────────────────────

async function procesarJob(job: JobAgente): Promise<void> {
  const t0 = Date.now();
  const scraper = SCRAPERS[job.casa];
  if (!scraper) {
    await reportarResultado({
      job,
      kind: "error",
      mensaje: `scraper "${job.casa}" no implementado en agente`,
    });
    return;
  }

  // Sanity check: la liga del partido debe matchear la canónica del job.
  const ligaPartido = detectarLigaCanonica(job.partido.liga);
  if (ligaPartido && ligaPartido !== job.ligaCanonica) {
    console.log(
      `  [${job.casa}] ⚠ liga del partido (${ligaPartido}) ≠ liga del job (${job.ligaCanonica}), uso la del job`,
    );
  }

  const partidoEntidad = {
    id: job.partidoId,
    equipoLocal: job.partido.equipoLocal,
    equipoVisita: job.partido.equipoVisita,
    liga: job.partido.liga,
    fechaInicio: new Date(job.partido.fechaInicio),
  } as any;

  console.log(
    `▶ ${job.casa.toUpperCase()} · ${job.partido.equipoLocal} vs ${job.partido.equipoVisita} (${job.ligaCanonica})`,
  );

  try {
    const r = await scraper.capturarConPlaywright(
      partidoEntidad,
      job.ligaCanonica,
    );
    if (r === null) {
      console.log(`  ✗ ${job.casa}: partido no encontrado`);
      await reportarResultado({
        job,
        kind: "sin_datos",
        mensaje: "partido no encontrado tras navegar listing",
      });
      return;
    }
    const ms = Date.now() - t0;
    console.log(`  ✓ ${job.casa} OK (${ms}ms) · cuotas=${JSON.stringify(r.cuotas)}`);
    await reportarResultado({ job, kind: "ok", resultado: r });
  } catch (err) {
    const mensaje = (err as Error)?.message ?? "error desconocido";
    if (err instanceof CapturaSinDatosError) {
      console.log(`  ⚠ ${job.casa} SIN_DATOS — ${mensaje}`);
      await reportarResultado({ job, kind: "sin_datos", mensaje });
      return;
    }
    console.log(`  ✗ ${job.casa} ERROR — ${mensaje}`);
    await reportarResultado({ job, kind: "error", mensaje });
  }
}

let detenido = false;

async function loop(): Promise<void> {
  while (!detenido) {
    let jobs: JobAgente[] = [];
    try {
      jobs = await fetchProximosJobs();
    } catch (err) {
      console.log(`  [poll] falló: ${(err as Error).message}. Reintento en 30s...`);
      await sleep(30_000);
      continue;
    }
    if (jobs.length === 0) {
      await sleep(POLL_INTERVAL_VACIO_MS);
      continue;
    }
    console.log(`\n[poll] ${jobs.length} jobs recibidos`);
    // Procesar serialmente: cada scraper abre su page, mejor no saturar el browser
    for (const job of jobs) {
      if (detenido) break;
      try {
        await procesarJob(job);
      } catch (err) {
        console.log(`  procesarJob crash: ${(err as Error).message}`);
        // Tratar de reportar como error para liberar el job en BullMQ
        try {
          await reportarResultado({
            job,
            kind: "error",
            mensaje: `procesarJob crash: ${(err as Error).message}`,
          });
        } catch {
          /* ignore */
        }
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  process.on("SIGINT", () => {
    console.log("\nSIGINT recibido — cerrando agente...");
    detenido = true;
  });
  process.on("SIGTERM", () => {
    detenido = true;
  });

  await calentarBrowserConPerfilReal();
  await loop();
  console.log("Agente detenido.");

  const g = globalThis as any;
  if (g.__pwContext?.close) {
    try {
      await g.__pwContext.close();
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
