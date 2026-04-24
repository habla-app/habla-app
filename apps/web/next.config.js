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
