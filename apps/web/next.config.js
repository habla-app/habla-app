/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@habla/db", "@habla/shared", "@habla/ui"],
  // Nota: removido `output: "standalone"` — corremos un custom server
  // (apps/web/server.ts) que monta Socket.io sobre el mismo HTTP server
  // que Next (Sub-Sprint 5, CLAUDE.md §15). El standalone output está
  // cableado al default server.js de Next y no es compatible con el
  // custom server.
  experimental: {
    // Habilita apps/web/instrumentation.ts — corre 1 vez al arrancar el
    // servidor. Lo usamos para registrar el cron in-process que cierra
    // torneos vencidos (Sub-Sprint 3) + poller de partidos (Sub-Sprint 5).
    // En Next.js 15+ es on-by-default.
    instrumentationHook: true,
    // Lote V (May 2026) — playwright-chromium y playwright-core NO deben
    // bundlearse: son librerías Node con dependencias opcionales (electron,
    // chromium-bidi) y assets binarios (ttf, html del recorder) que webpack
    // no puede procesar y revientan el build con `Module not found`. En
    // server runtime los cargamos vía `require("playwright-chromium")` lazy
    // desde `lib/services/scrapers/playwright-browser.ts`. Esta lista hace
    // que Next emita el require como literal y lo resuelva contra
    // `node_modules` en runtime, sin pasar por webpack.
    //
    // Lote V.12.4 — playwright-extra y puppeteer-extra-plugin-stealth
    // arrastran clone-deep + merge-deep + puppeteer-extra-plugin que usan
    // `require()` dinámico que webpack no puede analizar estáticamente
    // ("Cannot statically analyse require(…, …)"). Excluirlos del bundle
    // hace que Next los emita como require runtime contra node_modules.
    serverComponentsExternalPackages: [
      "playwright-chromium",
      "playwright-core",
      "playwright-extra",
      "puppeteer-extra-plugin-stealth",
    ],
  },
  webpack: (config, { isServer, nextRuntime }) => {
    if (isServer) {
      // ioredis usa módulos Node nativos (net/dns/tls/stream/crypto) que
      // webpack intenta bundlear incluso cuando es código server-only.
      // Lo marcamos como external para que el bundler lo deje como
      // `require("ioredis")` en runtime — el custom server (Node) lo
      // resuelve directo de node_modules.
      const externals = Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean);
      const serverExternals = ["ioredis"];
      // @aws-sdk/client-s3 (Lote 7 — backup a R2) solo se usa en Node
      // runtime (no edge, no client). Lo dejamos external solo allí —
      // pesa ~2MB y no tiene sentido bundlearlo en chunks de Next.
      if (nextRuntime !== "edge") {
        serverExternals.push("@aws-sdk/client-s3");
        // Lote V — playwright-chromium / playwright-core también son Node
        // server-only (los scrapers los cargan con require() lazy en
        // `playwright-browser.ts`). Marcarlos como externals evita que
        // webpack intente bundlear sus dependencias opcionales (electron,
        // chromium-bidi, recorder assets), las cuales rompen el build con
        // Module not found / Module parse failed.
        //
        // Lote V.12.4 — playwright-extra + puppeteer-extra-plugin-stealth
        // mismo problema: clone-deep/merge-deep usan require() dinámico que
        // webpack no analiza. External => runtime require contra
        // node_modules.
        serverExternals.push(
          "playwright-chromium",
          "playwright-core",
          "playwright-extra",
          "puppeteer-extra-plugin-stealth",
        );
      }
      config.externals = [...externals, ...serverExternals];
    }

    // Edge runtime + client bundle: los builtins de Node que solo
    // usamos server-only (Lote 7 — child_process/fs/etc para pg_dump,
    // Lote 8 — fs/path para el loader de MDX, Lote V — net/crypto/
    // worker_threads/tls/dns vía bullmq + playwright-core importados
    // transitivamente desde instrumentation.ts) deben quedar como módulos
    // vacíos. El código que los importa está guardado por
    // `runtime = "nodejs"` en los handlers y por
    // `if (NEXT_RUNTIME !== "nodejs") return` en instrumentation.ts —
    // la fallback es solo para que webpack no falle al hacer bundle.
    //
    // Lote 10 — agregamos también las versiones con prefijo `node:` por
    // si algún transitive import lo usa: `resolve.fallback` matchea por
    // string exacto, así que `fs` y `node:fs` se tratan como módulos
    // distintos. Sin esta entrada, webpack falla con UnhandledSchemeError
    // al bundlear cualquier archivo que importe `node:fs`/`node:path`
    // hacia targets que no soportan el scheme.
    //
    // Lote V (May 2026) — playwright-core es un caso especial. Su árbol
    // de imports incluye:
    //   1. Node builtins exóticos (net/crypto/worker_threads/readline/
    //      http/https/tls/dns) — agregables a fallback uno por uno pero
    //      con riesgo de seguir descubriendo más.
    //   2. Peer-deps OPCIONALES no instaladas (chromium-bidi, electron) —
    //      NO son builtins, no resuelven con fallback. Sólo se instalan
    //      si activamente usás modo BiDi o Electron, que no es el caso.
    //   3. Assets binarios (.ttf, .html del recorder de Playwright) —
    //      webpack no sabe procesarlos, requiere loader específico.
    //
    // En Edge runtime el código de scrapers nunca se ejecuta (el guard
    // `NEXT_RUNTIME !== "nodejs"` retorna antes de tocar playwright). La
    // solución correcta es **aliasear playwright-chromium y playwright-core
    // a `false`** para que webpack reemplace TODO ese subárbol por módulo
    // vacío en Edge + client. Esto cierra de un solo cambio:
    //   - chromium-bidi (peer no instalada)
    //   - electron (peer no instalada)
    //   - readline / http / https / cualquier builtin futuro
    //   - assets binarios .ttf / .html del recorder
    //   - todo el resto del árbol interno de playwright-core
    //
    // Para Node server, playwright SIGUE siendo external (ver bloque
    // arriba) — ahí se carga con require() en runtime contra
    // node_modules. Sólo cambiamos el comportamiento en Edge + client.
    //
    // bullmq también vive en este bloque vía sus builtins (net/crypto/
    // worker_threads cubiertos en hotfix #3).
    if (nextRuntime === "edge" || !isServer) {
      config.resolve = config.resolve || {};

      // Aliasing de paquetes server-only a módulo vacío en Edge/client.
      // playwright-chromium/playwright-core arrastran chromium-bidi (peer
      // opcional no instalada), electron (peer opcional no instalada) y
      // assets binarios del recorder — alias false corta el subárbol.
      // Lote V.12.4 — playwright-extra + puppeteer-extra-plugin-stealth
      // tampoco se ejecutan en Edge/client; alias false corta sus deps
      // (clone-deep, merge-deep) que usan require() dinámico.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        "playwright-chromium": false,
        "playwright-core": false,
        "playwright-extra": false,
        "puppeteer-extra-plugin-stealth": false,
      };

      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        child_process: false,
        fs: false,
        "fs/promises": false,
        os: false,
        path: false,
        "stream/promises": false,
        zlib: false,
        net: false,
        crypto: false,
        worker_threads: false,
        tls: false,
        dns: false,
        readline: false,
        http: false,
        https: false,
        "node:child_process": false,
        "node:fs": false,
        "node:fs/promises": false,
        "node:os": false,
        "node:path": false,
        "node:stream/promises": false,
        "node:zlib": false,
        "node:net": false,
        "node:crypto": false,
        "node:worker_threads": false,
        "node:tls": false,
        "node:dns": false,
        "node:readline": false,
        "node:http": false,
        "node:https": false,
      };
    }

    return config;
  },

  // -------------------------------------------------------------------
  // Redirects 301 — Lote K v3.2 (May 2026) + legados Lote B/C.
  //
  // El rebrand v3.2 cambia URLs de pista usuario:
  //   /cuotas               → /las-fijas
  //   /partidos/[slug]      → /las-fijas/[slug]
  //   /casas, /casas/[slug] → /reviews-y-guias/casas/...
  //   /guias, /guias/[slug] → /reviews-y-guias/guias/...
  //   /comunidad            → /liga
  //   /comunidad/torneo/:s  → /liga/:s
  //   /comunidad/[username] → /jugador/[username]
  //   /comunidad/mes/:m     → /liga/mes/:m
  //   /premium              → /socios
  //   /premium/checkout     → /socios/checkout
  //   /premium/exito        → /socios/exito
  //   /premium/mi-suscrip…  → /socios-hub
  //
  // Eliminadas en Lote K (redirect 301 a destino razonable):
  //   /suscribir            → /socios
  //   /perfil/eliminar      → /perfil (eliminación inline en Lote N)
  //
  // Decisión §4.4: redirect 301 inmediato desde el día 1 del rebrand.
  // La autoridad SEO se transfiere a las URLs nuevas. El navegador
  // entiende "esto se mudó permanentemente" y cero contenido duplicado.
  //
  // ORDEN: las rutas más específicas van primero (Next.js evalúa primer
  // match). Por ejemplo `/comunidad/torneo/:slug` debe ir antes que
  // `/comunidad/:username` porque "torneo" matchearía como username.
  //
  // /torneo/:id legacy se resuelve en `app/(main)/torneo/[id]/page.tsx`
  // (Server Component) porque requiere lookup BD para mapear torneoId →
  // partidoId — los redirects sincrónicos de Next no soportan async.
  // Auto-redirect Socio → /socios-hub también vive en page.tsx
  // (Server Component) porque el middleware edge no puede leer Prisma.
  // -------------------------------------------------------------------
  async redirects() {
    return [
      // === Lote K v3.2 — Las Fijas ===
      { source: "/cuotas", destination: "/las-fijas", permanent: true },
      { source: "/cuotas/:path*", destination: "/las-fijas/:path*", permanent: true },
      { source: "/partidos", destination: "/las-fijas", permanent: true },
      { source: "/partidos/:slug", destination: "/las-fijas/:slug", permanent: true },

      // === Lote K v3.2 — Reviews y Guías ===
      { source: "/casas", destination: "/reviews-y-guias/casas", permanent: true },
      { source: "/casas/:path*", destination: "/reviews-y-guias/casas/:path*", permanent: true },
      { source: "/guias", destination: "/reviews-y-guias/guias", permanent: true },
      { source: "/guias/:path*", destination: "/reviews-y-guias/guias/:path*", permanent: true },

      // === Lote K v3.2 — Liga + Jugador (orden estricto) ===
      // Específicas primero — `torneo` y `mes` matchearían como username.
      { source: "/comunidad/torneo/:slug", destination: "/liga/:slug", permanent: true },
      { source: "/comunidad/torneo", destination: "/liga", permanent: true },
      { source: "/comunidad/mes/:path*", destination: "/liga/mes/:path*", permanent: true },
      { source: "/comunidad/mes", destination: "/liga/mes", permanent: true },
      { source: "/comunidad/:username", destination: "/jugador/:username", permanent: true },
      { source: "/comunidad", destination: "/liga", permanent: true },

      // === Lote K v3.2 — Socios ===
      { source: "/premium/mi-suscripcion", destination: "/socios-hub", permanent: true },
      { source: "/premium/mi-suscripcion/:path*", destination: "/socios-hub", permanent: true },
      { source: "/premium/checkout", destination: "/socios/checkout", permanent: true },
      { source: "/premium/checkout/:path*", destination: "/socios/checkout/:path*", permanent: true },
      { source: "/premium/exito", destination: "/socios/exito", permanent: true },
      { source: "/premium/exito/:path*", destination: "/socios/exito/:path*", permanent: true },
      { source: "/premium", destination: "/socios", permanent: true },

      // === Lote K v3.2 — Eliminadas ===
      { source: "/suscribir", destination: "/socios", permanent: true },
      { source: "/perfil/eliminar/:path*", destination: "/perfil", permanent: true },
      { source: "/perfil/eliminar", destination: "/perfil", permanent: true },

      // === Lote O v3.2 — Admin operación renombrado ===
      { source: "/admin/picks-premium", destination: "/admin/picks", permanent: true },
      { source: "/admin/picks-premium/:path*", destination: "/admin/picks/:path*", permanent: true },

      // === Lote B/C legados — actualizados a destinos v3.2 ===
      { source: "/matches", destination: "/las-fijas", permanent: true },
      { source: "/matches/:path*", destination: "/las-fijas", permanent: true },
      { source: "/mis-combinadas", destination: "/mis-predicciones", permanent: true },
      { source: "/mis-combinadas/:path*", destination: "/mis-predicciones", permanent: true },
      { source: "/torneos", destination: "/liga", permanent: true },
      { source: "/torneos/:path*", destination: "/liga", permanent: true },
    ];
  },

  // -------------------------------------------------------------------
  // Headers de seguridad globales.
  //
  // CSP en modo Report-Only — cualquier violación solo se reporta, no
  // bloquea recursos. `'unsafe-inline'` en script-src y style-src es
  // necesario porque Next.js inyecta scripts/estilos inline para
  // hidratación.
  // -------------------------------------------------------------------
  async headers() {
    // Cloudflare Insights (beacon de Web Analytics que inyecta Cloudflare
    // automáticamente con el proxy activo) carga desde
    // `static.cloudflareinsights.com` y postea a `cloudflareinsights.com`.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://static.cloudflareinsights.com",
      "connect-src 'self' https://*.api-sports.io https://api.resend.com https://static.cloudflareinsights.com https://cloudflareinsights.com wss://hablaplay.com wss://www.hablaplay.com",
      "worker-src 'self' blob:",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "frame-src 'self' https://accounts.google.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
