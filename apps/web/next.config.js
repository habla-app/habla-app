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
  },
  webpack: (config, { isServer }) => {
    // ioredis usa módulos Node nativos (net/dns/tls/stream/crypto) que
    // webpack intenta bundlear incluso cuando es código server-only.
    // Lo marcamos como external para que el bundler lo deje como
    // `require("ioredis")` en runtime — el custom server (Node) lo
    // resuelve directo de node_modules.
    if (isServer) {
      const externals = Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean);
      config.externals = [...externals, "ioredis"];
    }
    return config;
  },

  // -------------------------------------------------------------------
  // Headers de seguridad globales (Lote 1 — Observabilidad y seguridad).
  //
  // CSP va en modo Report-Only primero — cualquier violación solo se
  // reporta, no bloquea recursos. Una vez verificado en prod que nada
  // se rompe (revisar consola unos días), migrar a enforcing en un
  // lote futuro.
  //
  // `'unsafe-inline'` en script-src y style-src es necesario porque
  // Next.js inyecta scripts/estilos inline para hidratación. Migrar a
  // nonces es un lift no trivial y queda para después.
  // -------------------------------------------------------------------
  async headers() {
    // Nota sobre dominios PostHog (hotfix post-Lote 2): el SDK sirve los
    // assets desde `us-assets.i.posthog.com` y hace ingesta contra
    // `us.i.posthog.com` — NO contra subdominios de `posthog.com`. El
    // wildcard `*.i.posthog.com` cubre tanto región US como EU
    // (`eu.i.posthog.com`). Se deja también `*.posthog.com` por si el
    // SDK referencia algún recurso ahí en el futuro.
    //
    // Cloudflare Insights (beacon de Web Analytics que inyecta Cloudflare
    // automáticamente con el proxy activo) carga desde
    // `static.cloudflareinsights.com` y postea a `cloudflareinsights.com`.
    //
    // `worker-src 'self' blob:` — PostHog usa web workers servidos via
    // blob URLs; sin esta directiva el browser cae a `child-src` y luego
    // a `default-src 'self'`, bloqueando el worker.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://*.i.posthog.com https://us-assets.i.posthog.com https://*.sentry.io https://*.sentry-cdn.com https://accounts.google.com https://apis.google.com https://*.culqi.com https://static.cloudflareinsights.com",
      "connect-src 'self' https://*.posthog.com https://*.i.posthog.com https://us.i.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://*.api-sports.io https://api.resend.com https://*.culqi.com https://static.cloudflareinsights.com https://cloudflareinsights.com wss://hablaplay.com wss://www.hablaplay.com",
      "worker-src 'self' blob:",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "frame-src 'self' https://*.culqi.com https://accounts.google.com",
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

// Envoltura Sentry (Lote 1 — observabilidad). Se aplica solo en
// producción para no ralentizar el build local. El SDK en tiempo de
// ejecución es un no-op si `SENTRY_DSN` no está presente (ver
// `sentry.*.config.ts`).
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(nextConfig, {
  // Silencia logs del plugin en build.
  silent: true,
  // No subimos source maps todavía (requiere SENTRY_AUTH_TOKEN). Se
  // habilita en un lote futuro cuando tengamos el token provisionado.
  sourcemaps: { disable: true },
  // No generamos el bundle-analyzer de Sentry ni tunneling por defecto.
  tunnelRoute: undefined,
});
