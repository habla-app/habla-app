// Tests del Bug #3 (hotfix post-Sub-Sprint 5): la sesión "se perdía" al
// navegar de NavBar a /mis-combinadas (el RSC podía evaluar antes de
// que el cookie estuviera disponible y redirigir a /auth/login).
//
// Defensas adoptadas:
//   1. `/mis-combinadas/:path*` agregado al matcher del middleware. El
//      wrapper `auth()` de NextAuth corre antes del Server Component y
//      evalúa la sesión consistentemente.
//   2. `force-dynamic` en /mis-combinadas y /wallet evita que Next.js
//      cachee el RSC entre requests con sesión distinta.
//   3. `authedFetch` (lib/api-client) centraliza `credentials: "include"`
//      para todos los fetches client-side; los hooks ahora lo usan en
//      vez de `fetch()` directo.
//
// Estos tests son de regresión: si alguien quita uno de los 3 puntos
// arriba, deben reventar.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AUTHED_FETCH_INIT, authedFetch } from "@/lib/api-client";

// `import { PROTECTED_MATCHERS } from "@/middleware"` arrastra
// next-auth/lib/env que requiere `next/server`, no resoluble en
// environment node de vitest. Asertamos sobre el código fuente.
const MIDDLEWARE_SRC = readFileSync(
  resolve(__dirname, "..", "middleware.ts"),
  "utf-8",
);

describe("middleware matcher — protected routes", () => {
  it("incluye /perfil, /mis-combinadas y /admin en PROTECTED_MATCHERS", () => {
    // Lote 3 (Abr 2026): /wallet salió del matcher junto con la
    // demolición del sistema de billetera (la ruta no existe más).
    expect(MIDDLEWARE_SRC).toMatch(/"\/perfil\/:path\*"/);
    expect(MIDDLEWARE_SRC).toMatch(/"\/mis-combinadas\/:path\*"/);
    expect(MIDDLEWARE_SRC).toMatch(/"\/admin"/);
    expect(MIDDLEWARE_SRC).toMatch(/"\/admin\/:path\*"/);
  });

  it("BUG REPRO: /mis-combinadas debe estar listada como matcher", () => {
    // Antes del hotfix Bug #3, /mis-combinadas no estaba acá. La página
    // hacía `auth()` directo y redirigía si la sesión llegaba null en el
    // primer render — lo que pasaba intermitentemente y forzaba al
    // usuario a refrescar la pestaña para "recuperar" la sesión.
    expect(MIDDLEWARE_SRC).toContain('"/mis-combinadas/:path*"');
  });

  it("`config.matcher` contiene los mismos paths que PROTECTED_MATCHERS (sin drift)", () => {
    // Next.js no soporta spread en config.matcher (parser estático), así
    // que la lista se duplica como literal. Acá verificamos que los
    // paths críticos aparezcan en ambos lugares — si alguien agrega un
    // matcher arriba pero olvida abajo, este test reventa.
    const criticosEnConfig = [
      "/perfil/:path*",
      "/mis-combinadas/:path*",
      "/admin/:path*",
    ];
    // Buscamos el bloque `config = { ... matcher: [ ... ] ... }`
    const configMatch = MIDDLEWARE_SRC.match(
      /export\s+const\s+config\s*=\s*\{[\s\S]+?matcher:\s*\[([\s\S]+?)\]/,
    );
    expect(configMatch).not.toBeNull();
    const matcherBlock = configMatch![1]!;
    for (const path of criticosEnConfig) {
      expect(matcherBlock).toContain(`"${path}"`);
    }
  });
});

describe("authedFetch — credentials always include", () => {
  it("AUTHED_FETCH_INIT setea credentials a 'include'", () => {
    expect(AUTHED_FETCH_INIT.credentials).toBe("include");
  });

  it("authedFetch pasa credentials: 'include' por defecto", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;
    try {
      await authedFetch("/api/v1/torneos/x");
      expect(calls).toHaveLength(1);
      expect(calls[0]!.init?.credentials).toBe("include");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("authedFetch respeta credentials override del caller", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;
    try {
      await authedFetch("/api/v1/anon", { credentials: "omit" });
      expect(calls[0]!.init?.credentials).toBe("omit");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("authedFetch preserva method, headers y body del caller", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;
    try {
      await authedFetch("/api/v1/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"x":1}',
      });
      expect(calls[0]!.init?.method).toBe("POST");
      expect(calls[0]!.init?.body).toBe('{"x":1}');
    } finally {
      globalThis.fetch = original;
    }
  });
});

// ---------------------------------------------------------------------------
// Regression: páginas autenticadas exportan `dynamic = "force-dynamic"` para
// que Next.js no cachee el RSC entre sesiones distintas. Si alguien quita
// el export, el cache estancado vuelve a redirigir a login.
// ---------------------------------------------------------------------------

describe("force-dynamic — páginas autenticadas", () => {
  const ROOT = resolve(__dirname, "..");

  it("/mis-combinadas/page.tsx exporta dynamic = 'force-dynamic'", () => {
    const file = readFileSync(
      resolve(ROOT, "app", "(main)", "mis-combinadas", "page.tsx"),
      "utf-8",
    );
    expect(file).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });
});

// ---------------------------------------------------------------------------
// Regression: ningún componente cliente debe llamar `fetch("/api/v1/...")`
// directo. Todo debe pasar por `authedFetch`.
// ---------------------------------------------------------------------------

describe("convención: client-side fetches a /api/v1/* usan authedFetch", () => {
  // Lista de archivos cliente que históricamente hicieron fetch a /api/v1.
  // Si aparece alguno nuevo con `await fetch("/api/v1/...")` directo, el
  // test reventa y obliga a migrar.
  const ROOT = resolve(__dirname, "..");
  const ARCHIVOS_VIGILADOS = [
    "components/combo/ComboModal.tsx",
    "components/admin/AdminTorneosPanel.tsx",
    "components/torneo/InscribirButton.tsx",
    "components/live/StatsView.tsx",
    "hooks/useComboOpener.ts",
    "hooks/useEventosPartido.ts",
    "hooks/useRankingEnVivo.ts",
    "lib/realtime/socket-client.ts",
  ];

  for (const rel of ARCHIVOS_VIGILADOS) {
    it(`${rel} no contiene 'fetch("/api/v1' ni 'fetch(\`/api/v1' directos`, () => {
      const file = readFileSync(resolve(ROOT, rel), "utf-8");
      // Lookbehind `(?<![a-zA-Z])fetch` excluye `authedFetch` (precedido
      // por la "d" final) pero permite atrapar `fetch("/api/v1` puro.
      expect(file).not.toMatch(/(?<![a-zA-Z])fetch\(["'`]\/api\/v1/);
    });
  }
});
