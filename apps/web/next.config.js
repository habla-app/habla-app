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
      }
      config.externals = [...externals, ...serverExternals];
    }

    // Edge runtime + client bundle: los builtins de Node que solo
    // usamos server-only (Lote 7 — child_process/fs/etc para pg_dump)
    // deben quedar como módulos vacíos. El código que los importa
    // está guardado por `runtime = "nodejs"` en los handlers y por
    // `if (NEXT_RUNTIME !== "nodejs") return` en instrumentation.ts —
    // la fallback es solo para que webpack no falle al hacer bundle.
    if (nextRuntime === "edge" || !isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        child_process: false,
        fs: false,
        "fs/promises": false,
        os: false,
        path: false,
        "stream/promises": false,
        zlib: false,
      };
    }

    return config;
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
