// Browser singleton de Playwright para los scrapers (Lote V.12 — May 2026).
//
// Versión LEAN del helper. Mantiene UNA instancia de Chromium warm
// durante el lifetime del proceso Next.js. Cada captura abre/cierra una
// page (cheap, ~50ms) pero reusa browser + context.
//
// Auto-shutdown: si pasan ≥15min sin uso y no hay pages activas, cierra
// el browser (~150MB liberados). La próxima captura reinicia warm en ~3s.
//
// Por qué `playwright-chromium` y no `playwright`:
//   `playwright` instala Chromium + Firefox + WebKit (~600MB cada uno).
//   Sólo necesitamos Chromium → `playwright-chromium` baja un único bundle.
//
// Chromium en Alpine (Railway):
//   El bundled de Playwright se compila contra glibc; Alpine usa musl.
//   El Dockerfile instala chromium del sistema y le apuntamos vía
//   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium.

import { logger } from "../logger";

// ─── Tipos estructurales mínimos (para que tsc no requiera la dep) ────

interface PWResponse {
  url(): string;
  status(): number;
  headers(): Record<string, string>;
  text(): Promise<string>;
  ok(): boolean;
}

export interface PWPage {
  goto(
    url: string,
    opts?: {
      waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
      timeout?: number;
    },
  ): Promise<unknown>;
  on(event: "response", listener: (response: PWResponse) => void): void;
  off(event: "response", listener: (response: PWResponse) => void): void;
  waitForTimeout(ms: number): Promise<void>;
  url(): string;
  close(): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
}

interface PWContext {
  newPage(): Promise<PWPage>;
  close(): Promise<void>;
}

interface PWBrowser {
  newContext(opts?: {
    userAgent?: string;
    locale?: string;
    timezoneId?: string;
    viewport?: { width: number; height: number };
  }): Promise<PWContext>;
  close(): Promise<void>;
  isConnected(): boolean;
}

interface PWLauncher {
  launch(opts?: {
    headless?: boolean;
    executablePath?: string;
    args?: string[];
  }): Promise<PWBrowser>;
}

interface PWModule {
  chromium: PWLauncher;
}

// ─── Singleton state via globalThis (Lote V.10.8 pattern) ─────────────

const globalForBrowser = globalThis as unknown as {
  __pwBrowser?: PWBrowser | null;
  __pwContext?: PWContext | null;
  __pwPagesEnVuelo?: number;
  __pwUltimoUsoMs?: number;
  __pwIdleTimer?: ReturnType<typeof setInterval> | null;
};

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_CHECK_MS = 5 * 60 * 1000;
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";

const UA_DEFAULT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

async function lanzarBrowser(): Promise<PWBrowser> {
  const mod = require("playwright-chromium") as PWModule;
  const browser = await mod.chromium.launch({
    headless: HEADLESS,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-gpu",
    ],
  });
  logger.info(
    {
      headless: HEADLESS,
      execPath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "(default)",
      source: "scrapers:browser",
    },
    "playwright browser warm iniciado",
  );
  return browser;
}

async function obtenerBrowser(): Promise<PWBrowser> {
  const cached = globalForBrowser.__pwBrowser;
  if (cached && cached.isConnected()) return cached;

  const browser = await lanzarBrowser();
  const context = await browser.newContext({
    userAgent: UA_DEFAULT,
    locale: "es-PE",
    timezoneId: "America/Lima",
    viewport: { width: 1366, height: 768 },
  });

  globalForBrowser.__pwBrowser = browser;
  globalForBrowser.__pwContext = context;

  iniciarIdleTimer();
  return browser;
}

/**
 * Crea una page nueva del context warm. El caller DEBE llamar
 * `liberarPagina(page)` en `finally` para que el contador no leakee.
 */
export async function obtenerPagina(): Promise<PWPage> {
  await obtenerBrowser();
  const ctx = globalForBrowser.__pwContext;
  if (!ctx) throw new Error("scrapers:browser context no inicializado");
  globalForBrowser.__pwPagesEnVuelo = (globalForBrowser.__pwPagesEnVuelo ?? 0) + 1;
  globalForBrowser.__pwUltimoUsoMs = Date.now();
  return ctx.newPage();
}

export async function liberarPagina(page: PWPage): Promise<void> {
  try {
    await page.close();
  } catch (err) {
    logger.debug(
      { err: (err as Error).message, source: "scrapers:browser" },
      "page.close() falló (no crítico)",
    );
  }
  globalForBrowser.__pwPagesEnVuelo = Math.max(
    0,
    (globalForBrowser.__pwPagesEnVuelo ?? 1) - 1,
  );
  globalForBrowser.__pwUltimoUsoMs = Date.now();
}

function iniciarIdleTimer(): void {
  if (globalForBrowser.__pwIdleTimer) return;
  const t = setInterval(() => {
    void (async () => {
      const ahora = Date.now();
      const ultimoUso = globalForBrowser.__pwUltimoUsoMs ?? ahora;
      const pagesEnVuelo = globalForBrowser.__pwPagesEnVuelo ?? 0;
      const idle = ahora - ultimoUso > IDLE_TIMEOUT_MS;
      if (idle && pagesEnVuelo === 0 && globalForBrowser.__pwBrowser) {
        logger.info(
          { idleMs: ahora - ultimoUso, source: "scrapers:browser" },
          "playwright browser idle — cerrando para liberar RAM",
        );
        await cerrarBrowser();
      }
    })();
  }, IDLE_CHECK_MS);
  if (typeof (t as { unref?: () => void }).unref === "function") {
    (t as { unref: () => void }).unref();
  }
  globalForBrowser.__pwIdleTimer = t;
}

export async function cerrarBrowser(): Promise<void> {
  const ctx = globalForBrowser.__pwContext;
  const browser = globalForBrowser.__pwBrowser;
  globalForBrowser.__pwContext = null;
  globalForBrowser.__pwBrowser = null;
  globalForBrowser.__pwPagesEnVuelo = 0;
  if (ctx) {
    try {
      await ctx.close();
    } catch {
      /* ignore */
    }
  }
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
  }
}

// Cleanup al terminar el proceso (Railway envía SIGTERM con 30s gracia).
let cleanupRegistrado = false;
function registrarCleanup(): void {
  if (cleanupRegistrado) return;
  cleanupRegistrado = true;
  const handler = () => {
    void cerrarBrowser();
  };
  process.on("beforeExit", handler);
  process.on("SIGTERM", handler);
  process.on("SIGINT", handler);
}
registrarCleanup();
