// Tests adicionales de convenciones SS6+SS7. Asegura patrones de §14.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

describe("§14 — authedFetch en nuevos hooks/components", () => {
  const files = [
    "components/tienda/CanjearModal.tsx",
    "components/perfil/VerificacionPanel.tsx",
    "components/perfil/DatosPersonalesPanel.tsx",
    "components/perfil/PreferenciasPanel.tsx",
    "components/perfil/LimitesPanel.tsx",
    "components/perfil/DatosYPrivacidadPanel.tsx",
    "components/admin/AdminCanjesPanel.tsx",
  ];

  for (const f of files) {
    it(`${f}: usa authedFetch para /api/v1/*`, () => {
      const src = read(f);
      expect(src).toMatch(/authedFetch/);
      // No debe tener fetch directo al backend (excepto confirmar-eliminar
      // que es pre-sesión)
      expect(src).not.toMatch(/await\s+fetch\(["']\/api\/v1\//);
    });
  }

  it("ConfirmarEliminarContent usa fetch directo porque actúa sin sesión (token en body)", () => {
    const src = read("components/perfil/ConfirmarEliminarContent.tsx");
    // Es legítimo aquí: el token en el body autentica por sí mismo.
    expect(src).toMatch(/fetch\(["']\/api\/v1\//);
  });
});

describe("§14 — nuevos RSC exportan force-dynamic cuando dependen de sesión", () => {
  const files = [
    "app/(main)/tienda/page.tsx",
    "app/(main)/perfil/page.tsx",
    "app/(main)/perfil/eliminar/confirmar/page.tsx",
    "app/admin/canjes/page.tsx",
    "app/api/v1/premios/route.ts",
    "app/api/v1/canjes/mis-canjes/route.ts",
    "app/api/v1/admin/canjes/route.ts",
    "app/api/v1/usuarios/me/route.ts",
    "app/api/v1/usuarios/limites/route.ts",
    "app/api/v1/usuarios/notificaciones/route.ts",
    "app/api/v1/usuarios/verificacion/dni/route.ts",
    "app/api/v1/usuarios/me/datos-download/file/route.ts",
  ];

  for (const f of files) {
    it(`${f}: exporta force-dynamic`, () => {
      const src = read(f);
      expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
    });
  }
});

describe("§14 — endpoints con NoAutorizado + rol ADMIN", () => {
  it("admin/canjes GET verifica rol ADMIN", () => {
    const src = read("app/api/v1/admin/canjes/route.ts");
    expect(src).toMatch(/rol !== ["']ADMIN["']/);
    expect(src).toMatch(/NoAutorizado/);
  });

  it("admin/canjes/:id PATCH verifica rol ADMIN", () => {
    const src = read("app/api/v1/admin/canjes/[id]/route.ts");
    expect(src).toMatch(/rol !== ["']ADMIN["']/);
    expect(src).toMatch(/NoAutorizado/);
  });
});

describe("§14 — Zod validation en entrada de datos", () => {
  const endpoints = [
    "app/api/v1/premios/[id]/canjear/route.ts",
    "app/api/v1/admin/canjes/[id]/route.ts",
    "app/api/v1/usuarios/me/route.ts",
    "app/api/v1/usuarios/verificacion/telefono/route.ts",
    "app/api/v1/usuarios/verificacion/telefono/confirmar/route.ts",
    "app/api/v1/usuarios/verificacion/dni/route.ts",
    "app/api/v1/usuarios/limites/route.ts",
    "app/api/v1/usuarios/limites/autoexclusion/route.ts",
    "app/api/v1/usuarios/notificaciones/route.ts",
    "app/api/v1/usuarios/me/eliminar/confirmar/route.ts",
  ];

  for (const f of endpoints) {
    it(`${f}: valida body con Zod`, () => {
      const src = read(f);
      expect(src).toMatch(/import.*\{[^}]*z[^}]*\}.*["']zod["']/);
      expect(src).toMatch(/safeParse/);
    });
  }
});

describe("emails — dominio verificado hablaplay.com en defaults", () => {
  it("email.service default FROM es equipo@hablaplay.com", () => {
    const src = read("lib/services/email.service.ts");
    expect(src).toMatch(/equipo@hablaplay\.com/);
  });
});

describe("Sub-Sprint 6 — integración en ranking.service.finalizarTorneo", () => {
  const src = readFileSync(
    resolve(ROOT, "lib/services/ranking.service.ts"),
    "utf-8",
  );

  it("lee nombre del torneo + equipos para el template del email", () => {
    expect(src).toMatch(/torneo\.findUnique/);
    expect(src).toMatch(/equipoLocal/);
    expect(src).toMatch(/equipoVisita/);
  });

  it("fire-and-forget: usa `void notifyPremioGanado`", () => {
    expect(src).toMatch(/void\s+notifyPremioGanado/);
  });

  it("try/catch alrededor del email prep (no rompe finalización si falla)", () => {
    expect(src).toMatch(/catch\s*\(\s*err\s*\)\s*\{[\s\S]*?error.*preparando emails/);
  });
});

describe("Sub-Sprint 7 — PerfilRefreshOnUpdate pattern", () => {
  it("existe como client component que escucha perfil:refresh", () => {
    const src = read("components/perfil/PerfilRefreshOnUpdate.tsx");
    expect(src).toMatch(/perfil:refresh/);
    expect(src).toMatch(/useRouter/);
    expect(src).toMatch(/router\.refresh/);
  });

  it("VerificacionPanel y DatosPersonalesPanel disparan el evento", () => {
    const verif = read("components/perfil/VerificacionPanel.tsx");
    const datos = read("components/perfil/DatosPersonalesPanel.tsx");
    expect(verif).toMatch(/new Event\(["']perfil:refresh["']\)/);
    expect(datos).toMatch(/new Event\(["']perfil:refresh["']\)/);
  });
});
