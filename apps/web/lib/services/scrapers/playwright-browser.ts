// Browser singleton de Playwright para los scrapers del motor de captura
// (Lote V — fase V.4).
//
// Por qué un singleton:
//   Playwright Chromium consume ~150 MB de RAM por instancia. Si cada
//   captura del scraper levanta un browser, lo usa 5s y lo cierra, los
//   ciclos de allocate/free saturan al GC y, peor, el cold-start agrega
//   ~2-3s a cada captura. Mantenemos UNA instancia warm durante el
//   lifetime del proceso Next.js + cleanup explícito en `beforeExit`.
//
//   Cada captura abre/cierra una `page` (cheap: <50ms), pero reusa el
//   `browser` y el `context`. Esto es el patrón estándar recomendado por
//   Playwright para procesos long-lived.
//
// Por qué `playwright-chromium` (no `playwright` completo):
//   El paquete `playwright` instala Chromium + Firefox + WebKit (~600 MB
//   cada uno). Sólo necesitamos Chromium → `playwright-chromium` baja un
//   único bundle (~150 MB). Ahorra disco en el container Railway.
//
// Por qué `dynamic require`:
//   Algunos paths del runtime (Edge runtime, builds de Next en CI) no
//   soportan native modules. Cargamos `playwright-chromium` con `require()`
//   lazy SÓLO cuando un scraper lo pide. Además exportamos tipos
//   estructurales propios (no `import type` de `playwright-chromium`) para
//   que `tsc --noEmit` no falle si el paquete todavía no está instalado
//   (caso típico de validar el repo en una máquina sin pnpm install).
//
// CHROMIUM EN ALPINE (Railway):
//   El bundle pre-built de Playwright se compila contra glibc; Alpine
//   usa musl. Por eso el Dockerfile instala `chromium` + sus deps via
//   `apk` y le apuntamos con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=
//   /usr/bin/chromium`. Sin esa env Playwright intenta el bundled default
//   y revienta en runtime. En distros con glibc (devs locales en
//   Debian/Ubuntu) la env puede dejarse vacía y Playwright resuelve.
//
// HEADLESS:
//   Default `true` (controlado por `PLAYWRIGHT_HEADLESS`). En el container
//   Railway no hay display, así que headless es la única opción.
//
// LIFECYCLE:
//   `obtenerBrowserPlaywright()` es idempotente: la primera llamada lanza
//   el browser y registra el cleanup; las siguientes devuelven la
//   instancia warm. `cerrarBrowser()` la cierra. Los handlers `beforeExit`
//   y `SIGTERM`/`SIGINT` se registran UNA sola vez para que Node libere
//   el browser cuando el proceso termine (Railway envía SIGTERM con 30s
//   de gracia antes de SIGKILL — suficiente para cerrar limpio).
//
// FALLAS DURANTE LAUNCH:
//   Si el `chromium.launch()` rompe (ej. ejecutable no encontrado en
//   Alpine), atrapamos el error, devolvemos `null` y logueamos. El caller
//   (scraper Betano) decide cómo escalar — típicamente: lanzar Error con
//   mensaje claro para que el admin vea en `cuotas_casa.errorMensaje`
//   que Playwright no está operativo en ese deploy.

import { logger } from "../logger";

// ─── Tipos estructurales mínimos (no dependen de playwright-chromium) ───
//
// Definimos exactamente la subset del API que nuestros scrapers usan.
// Esto permite que `tsc --noEmit` compile aunque `playwright-chromium`
// no esté en `node_modules`. En runtime, las llamadas se delegan al
// módulo real cargado vía `require()` lazy — el shape coincide con el
// API público de Playwright.
//
// Si en el futuro algún scraper necesita más métodos (ej. `frame()`,
// `evaluateHandle()`), agregarlos acá. Mantenemos sólo lo necesario para
// que la superficie pública sea pequeña.

export interface PlaywrightLocator {
  click(opts?: { timeout?: number; force?: boolean }): Promise<void>;
  isVisible(opts?: { timeout?: number }): Promise<boolean>;
  first(): PlaywrightLocator;
}

export interface PlaywrightPage {
  goto(
    url: string,
    opts?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number },
  ): Promise<unknown>;
  waitForSelector(selector: string, opts?: { timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  locator(selector: string): PlaywrightLocator;
  evaluate<T>(fn: () => T): Promise<T>;
  content(): Promise<string>;
  close(): Promise<void>;
}

interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightBrowser {
  newContext(opts?: {
    userAgent?: string;
    locale?: string;
    timezoneId?: string;
    viewport?: { width: number; height: number };
    extraHTTPHeaders?: Record<string, string>;
  }): Promise<PlaywrightContext>;
  close(): Promise<void>;
}

interface ChromiumLauncher {
  launch(opts?: {
    headless?: boolean;
    executablePath?: string;
    args?: string[];
  }): Promise<PlaywrightBrowser>;
}

interface PlaywrightChromiumModule {
  chromium: ChromiumLauncher;
}

interface BrowserHandle {
  browser: PlaywrightBrowser;
  context: PlaywrightContext;
}

let browserHandle: BrowserHandle | null = null;
let pendingLaunch: Promise<BrowserHandle | null> | null = null;
let cleanupRegistrado = false;

/**
 * Lanza el browser warm. Idempotente. Devuelve null si no se pudo lanzar
 * (ej. Chromium no instalado en el container — esto deja que el caller
 * fallback a "captura via API only" o lance error claro).
 */
async function lanzarBrowser(): Promise<BrowserHandle | null> {
  // Carga lazy del módulo. Si el require revienta (no instalado), null.
  let chromiumLauncher: ChromiumLauncher;
  try {
    // require() runtime — Next no lo bundlea; en el container Railway
    // resuelve contra apps/web/node_modules (workspace hoisted).
    const mod = require("playwright-chromium") as PlaywrightChromiumModule;
    chromiumLauncher = mod.chromium;
  } catch (err) {
    logger.error(
      { err: (err as Error).message, source: "scrapers:playwright" },
      "playwright-chromium no se pudo cargar — ¿paquete instalado?",
    );
    return null;
  }

  const headless = (process.env.PLAYWRIGHT_HEADLESS ?? "true").toLowerCase() !== "false";
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

  let browser: PlaywrightBrowser;
  try {
    browser = await chromiumLauncher.launch({
      headless,
      // Si la env apunta al binario del sistema (Alpine: /usr/bin/chromium),
      // usalo. Si está vacío, Playwright cae al bundled default. En Alpine
      // SIEMPRE hace falta que esta env esté seteada porque el bundled
      // está compilado contra glibc.
      executablePath,
      args: [
        // Args estándar para entornos containerizados (sin sandbox SUID,
        // sin /dev/shm, gpu ausente). Sin esto el launch revienta en
        // Docker/Alpine con cryptic errors.
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  } catch (err) {
    logger.error(
      {
        err: (err as Error).message,
        executablePath: executablePath ?? "(default)",
        source: "scrapers:playwright",
      },
      "chromium.launch() falló",
    );
    return null;
  }

  // BrowserContext con UA realista + locale es-PE para no diferenciarnos
  // del POC. Cookies viven en este context durante toda la corrida.
  let context: PlaywrightContext;
  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      locale: "es-PE",
      timezoneId: "America/Lima",
      viewport: { width: 1366, height: 800 },
      extraHTTPHeaders: {
        "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
      },
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, source: "scrapers:playwright" },
      "browser.newContext() falló",
    );
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
    return null;
  }

  logger.info(
    {
      headless,
      executablePath: executablePath ?? "(playwright default)",
      source: "scrapers:playwright",
    },
    "playwright browser warm iniciado",
  );

  // Registrar cleanup UNA sola vez. Node llama `beforeExit` cuando el
  // event loop está vacío y el proceso va a terminar limpio. En Railway
  // SIGTERM → 30s antes de SIGKILL; suficiente para cerrar el browser
  // ordenadamente. SIGKILL no permite cleanup — el browser queda como
  // orphan process al kernel del container, pero el container muere
  // igual así que no leakea.
  if (!cleanupRegistrado) {
    cleanupRegistrado = true;
    process.on("beforeExit", () => {
      // Sin await — `beforeExit` es síncrono pero close() devuelve promise;
      // disparamos y dejamos que termine (Node esperará a que la promise
      // se resuelva antes de exit final).
      void cerrarBrowser();
    });
    // SIGTERM/SIGINT: Railway envía SIGTERM al rolling deploy. `beforeExit`
    // sólo se dispara si el event loop se vacía naturalmente — no siempre
    // ocurre con SIGTERM. Por eso enganchamos también las signals.
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.once(signal, () => {
        void cerrarBrowser();
      });
    }
  }

  return { browser, context };
}

/**
 * Devuelve el browser+context warm. Si no existe, lo lanza. Promise-safe
 * contra concurrencia (segundas/terceras llamadas reusan el mismo launch
 * en curso, no disparan launches paralelos).
 *
 * Devuelve `null` si Playwright no está instalado o el launch falló —
 * el caller debe manejarlo (lanzar Error con mensaje claro).
 */
export async function obtenerBrowserPlaywright(): Promise<BrowserHandle | null> {
  if (browserHandle) return browserHandle;
  if (pendingLaunch) return pendingLaunch;

  pendingLaunch = (async () => {
    try {
      const handle = await lanzarBrowser();
      if (handle) {
        browserHandle = handle;
      }
      return handle;
    } finally {
      pendingLaunch = null;
    }
  })();

  return pendingLaunch;
}

/**
 * Crea una `Page` nueva sobre el context warm. Cada captura debe llamar
 * `page.close()` al terminar (try/finally) — el context queda vivo.
 *
 * Si el browser no está disponible devuelve null.
 */
export async function crearPagePlaywright(): Promise<PlaywrightPage | null> {
  const handle = await obtenerBrowserPlaywright();
  if (!handle) return null;
  try {
    return await handle.context.newPage();
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, source: "scrapers:playwright" },
      "context.newPage() falló — intentando recuperar",
    );
    // Posible: el context murió (browser crash). Reseteamos el singleton
    // para que la próxima llamada relance.
    browserHandle = null;
    return null;
  }
}

/**
 * Cierra el browser warm. Idempotente. Llamado automáticamente por el
 * handler `beforeExit` registrado en `lanzarBrowser`.
 *
 * Exportado también para tests/scripts que quieran liberar recursos
 * explícitamente sin esperar al exit del proceso.
 */
export async function cerrarBrowser(): Promise<void> {
  if (!browserHandle) return;
  const { browser, context } = browserHandle;
  browserHandle = null;
  try {
    await context.close();
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, source: "scrapers:playwright" },
      "context.close() falló — siguiendo con browser.close()",
    );
  }
  try {
    await browser.close();
    logger.info({ source: "scrapers:playwright" }, "playwright browser cerrado");
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, source: "scrapers:playwright" },
      "browser.close() falló",
    );
  }
}

/** Para tests: indica si hay browser vivo. No expone el handle. */
export function browserPlaywrightInicializado(): boolean {
  return browserHandle !== null;
}
