/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Agente local del motor de cuotas (Lote V.14 — May 2026).
 *
 * Corre en la PC del admin con Chrome real + perfil "Habla" copiado
 * (clonado durante setup desde el perfil real del user con email
 * hablaplay@gmail.com). Pollea el backend pidiendo jobs pendientes;
 * por cada job ejecuta el scraper Playwright correspondiente y reporta
 * el resultado.
 *
 * Lote V.14: el agente NO usa el perfil Default real porque Chrome solo
 * permite UN bloqueo por User Data dir. Si el admin está viendo /admin/
 * partidos cuando el agente arranca, su Chrome tiene el lock y el agente
 * no podría abrir. Por eso el setup copia el perfil "Habla" a una carpeta
 * aparte (~/.habla-agente-data/Default/) que no conflicta con el Chrome
 * personal del user.
 *
 * Modos de ejecución:
 *
 *   Modo SESIÓN (V.14, lanzado on-demand desde la UI admin):
 *     pnpm agente-cuotas -- --token=<uuid>
 *     - Pollea SOLO los jobs asociados a esa sesión.
 *     - Auto-exit cuando 3 polls consecutivos devuelven 0 jobs.
 *     - Cierra Chrome al terminar.
 *
 *   Modo POLLING (legacy del V.13, sin token):
 *     pnpm agente-cuotas
 *     - Loop infinito polleando todos los jobs waiting.
 *     - Detener con Ctrl+C.
 *
 * Por qué local: las casas Betano/Inkabet bloquean IPs datacenter
 * (Railway US 403). La única forma confiable de capturar las 5 casas
 * es desde IP residencial peruana con Chrome real.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs";

// ─── Cargar .env.local manualmente ANTES de leer process.env ─────────
function cargarEnvLocal(): void {
  const candidatos = [
    path.join(process.cwd(), ".env.local"),
    path.join(__dirname, "..", ".env.local"),
    path.join(__dirname, "..", "..", ".env.local"),
  ];
  for (const ruta of candidatos) {
    if (!fs.existsSync(ruta)) continue;
    const contenido = fs.readFileSync(ruta, "utf8");
    for (const linea of contenido.split(/\r?\n/)) {
      const t = linea.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let value = t.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    console.log(`  · .env.local cargado desde ${ruta}`);
    return;
  }
  console.log("  · .env.local no encontrado (variables deben estar en la sesión)");
}
cargarEnvLocal();

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import {
  detectarLigaCanonica,
  type LigaCanonica,
} from "../lib/services/scrapers/ligas-id-map";
import type { CasaCuotas, ResultadoScraper } from "../lib/services/scrapers/types";

import doradobetScraper from "../lib/services/scrapers/doradobet.scraper";
import apuestaTotalScraper from "../lib/services/scrapers/apuesta-total.scraper";
import betanoScraper from "../lib/services/scrapers/betano.scraper";
import inkabetScraper from "../lib/services/scrapers/inkabet.scraper";
import teApuestoScraper from "../lib/services/scrapers/te-apuesto.scraper";

chromium.use(StealthPlugin());

// ─── Config ───────────────────────────────────────────────────────────

const API_BASE = (process.env.HABLA_API_BASE ?? "").replace(/\/+$/, "");
const TOKEN = process.env.HABLA_AGENTE_TOKEN ?? "";
const POLL_INTERVAL_MS = 5_000;
const POLL_INTERVAL_VACIO_MS = 15_000;
const LIMIT_JOBS_POR_POLL = 5;
// Auto-exit en modo sesión: tras 3 polls consecutivos sin jobs, cerrar.
const POLLS_VACIOS_PARA_EXIT = 3;

// Parsear --token=xxx del argv (modo sesión V.14)
function parseSesionToken(): string | null {
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--token=(.+)$/);
    if (m && m[1]) return m[1];
  }
  return null;
}
const SESION_TOKEN = parseSesionToken();
const MODO = SESION_TOKEN ? "sesion" : "polling";

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

/**
 * Lote V.14: el agente usa una copia aislada del perfil "Habla". El setup
 * (`setup-agente-windows.bat`) copia `User Data/Profile X/` (donde X es
 * el perfil Habla del Chrome real del admin) → `~/.habla-agente-data/Default/`.
 * Esto permite usar las cookies/sesiones reales SIN bloquear el Chrome
 * personal del admin (Chrome solo permite 1 lock por User Data dir).
 */
function obtenerPerfilAgente(): string {
  return path.join(os.homedir(), ".habla-agente-data");
}

async function calentarBrowser(): Promise<void> {
  const chromePath = detectarChromePath();
  const perfilUsado = obtenerPerfilAgente();
  const perfilExisteConDatos =
    fs.existsSync(path.join(perfilUsado, "Default")) ||
    fs.existsSync(path.join(perfilUsado, "Cookies"));

  console.log("─── Agente cuotas — boot ─────────────────────────────────");
  console.log(` Modo: ${MODO}${SESION_TOKEN ? ` · token=${SESION_TOKEN.slice(0, 8)}...` : ""}`);
  console.log(` Chrome: ${chromePath ?? "(bundled)"}`);
  console.log(` Profile: ${perfilUsado}`);
  if (!perfilExisteConDatos) {
    console.log(`   ⚠ Perfil aislado vacío (sin cookies del perfil "Habla").`);
    console.log(`     Ejecutá apps/web/scripts/setup-agente-windows.bat para`);
    console.log(`     copiar tu perfil Habla con cookies persistidas.`);
  }
  console.log(` API: ${API_BASE}`);
  console.log("");

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

async function cerrarBrowserAgente(): Promise<void> {
  const g = globalThis as any;
  if (g.__pwContext?.close) {
    try {
      await g.__pwContext.close();
    } catch {
      /* ignore */
    }
  }
  if (g.__pwBrowser?.close) {
    try {
      await g.__pwBrowser.close();
    } catch {
      /* ignore */
    }
  }
}

// ─── Cliente HTTP ─────────────────────────────────────────────────────

async function fetchProximosJobs(): Promise<JobAgente[]> {
  const params = new URLSearchParams({ limit: String(LIMIT_JOBS_POR_POLL) });
  if (SESION_TOKEN) params.set("token", SESION_TOKEN);
  const url = `${API_BASE}/api/v1/admin/agente/jobs/proximos?${params.toString()}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    if (res.status === 401 && SESION_TOKEN) {
      throw new Error("token de sesión inválido o expirado (5min TTL)");
    }
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
    console.log(`  ✗ ${job.casa} ERROR — ${mensaje}`);
    await reportarResultado({ job, kind: "error", mensaje });
  }
}

let detenido = false;

async function loop(): Promise<void> {
  let pollsVaciosConsecutivos = 0;
  while (!detenido) {
    let jobs: JobAgente[] = [];
    try {
      jobs = await fetchProximosJobs();
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`  [poll] falló: ${msg}`);
      if (SESION_TOKEN && msg.includes("token de sesión inválido")) {
        console.log("  [poll] token expirado — saliendo en modo sesión");
        return;
      }
      await sleep(30_000);
      continue;
    }
    if (jobs.length === 0) {
      pollsVaciosConsecutivos++;
      if (
        SESION_TOKEN &&
        pollsVaciosConsecutivos >= POLLS_VACIOS_PARA_EXIT
      ) {
        console.log(
          `  [poll] ${pollsVaciosConsecutivos} polls vacíos consecutivos · sesión completa, cerrando`,
        );
        return;
      }
      await sleep(POLL_INTERVAL_VACIO_MS);
      continue;
    }
    pollsVaciosConsecutivos = 0;
    console.log(`\n[poll] ${jobs.length} jobs recibidos`);
    for (const job of jobs) {
      if (detenido) break;
      try {
        await procesarJob(job);
      } catch (err) {
        console.log(`  procesarJob crash: ${(err as Error).message}`);
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

  await calentarBrowser();
  await loop();
  console.log("Agente detenido. Cerrando browser...");
  await cerrarBrowserAgente();
  console.log("Listo.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ Fatal:", err);
    process.exit(1);
  });
