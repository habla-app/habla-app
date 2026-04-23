// Tests AST del registro formal (Abr 2026).
// Valida el contrato de los endpoints, middleware y configuración de
// NextAuth sin levantar el servidor completo. Complementa los tests
// funcionales que correrán en el suite E2E post-deploy.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

// ---------------------------------------------------------------------------
// Middleware — bloquea (main) si usernameLocked=false
// ---------------------------------------------------------------------------

describe("middleware — redirect a /auth/completar-perfil si username no locked", () => {
  const SRC = read("middleware.ts");

  it("lee usernameLocked del session.user", () => {
    expect(SRC).toMatch(/usernameLocked/);
  });

  it("redirige a /auth/completar-perfil si logueado pero sin username locked", () => {
    expect(SRC).toMatch(/\/auth\/completar-perfil/);
  });

  it("redirige a /auth/signin (no /auth/login) cuando no hay sesión", () => {
    expect(SRC).toMatch(/\/auth\/signin/);
    expect(SRC).not.toMatch(/["']\/auth\/login["']/);
  });
});

// ---------------------------------------------------------------------------
// NextAuth — Google provider + newUser page
// ---------------------------------------------------------------------------

describe("auth.ts — Google OAuth + pages", () => {
  const SRC = read("lib/auth.ts");

  it("registra el provider Google con clientId y clientSecret", () => {
    expect(SRC).toMatch(/import\s+Google\s+from\s+["']next-auth\/providers\/google["']/);
    expect(SRC).toMatch(/clientId:\s*process\.env\.GOOGLE_CLIENT_ID/);
    expect(SRC).toMatch(/clientSecret:\s*process\.env\.GOOGLE_CLIENT_SECRET/);
  });

  it("pages.signIn apunta a /auth/signin (nuevo nombre)", () => {
    expect(SRC).toMatch(/signIn:\s*["']\/auth\/signin["']/);
  });

  it("pages.newUser apunta a /auth/completar-perfil", () => {
    expect(SRC).toMatch(/newUser:\s*["']\/auth\/completar-perfil["']/);
  });

  it("session callback expone username + usernameLocked", () => {
    expect(SRC).toMatch(/session\.user\.username/);
    expect(SRC).toMatch(/session\.user\.usernameLocked/);
  });

  it("allowDangerousEmailAccountLinking habilitado para Google (magic-link → Google)", () => {
    expect(SRC).toMatch(/allowDangerousEmailAccountLinking:\s*true/);
  });
});

// ---------------------------------------------------------------------------
// Adapter — crea usuarios OAuth con username temporal `new_*` + bonus 500
// ---------------------------------------------------------------------------

describe("auth-adapter.ts — createUser con username temporal", () => {
  const SRC = read("lib/auth-adapter.ts");

  it("genera un handle temporal con prefijo 'new_'", () => {
    expect(SRC).toMatch(/new_\$\{[^}]+\}/);
    expect(SRC).toMatch(/generarUsernameTemporal/);
  });

  it("marca usernameLocked=false al crear vía OAuth", () => {
    expect(SRC).toMatch(/usernameLocked:\s*false/);
  });

  it("preserva el bonus 500 Lukas en la transacción atómica", () => {
    expect(SRC).toMatch(/BONUS_BIENVENIDA_LUKAS\s*=\s*500/);
    expect(SRC).toMatch(/tipo:\s*["']BONUS["']/);
    expect(SRC).toMatch(/\$transaction/);
  });
});

// ---------------------------------------------------------------------------
// Endpoints /api/v1/auth/*
// ---------------------------------------------------------------------------

describe("POST /api/v1/auth/signup — contrato del endpoint", () => {
  const SRC = read("app/api/v1/auth/signup/route.ts");

  it("valida email + username + aceptaTyc (Zod)", () => {
    expect(SRC).toMatch(/z\.object/);
    // Multiline-friendly: `z\n  .string()\n  .email(...)`.
    expect(SRC).toMatch(/email:\s*z[\s\S]{0,80}?\.email/);
    expect(SRC).toMatch(/username:\s*z[\s\S]{0,80}?\.string/);
    expect(SRC).toMatch(/aceptaTyc:\s*z\.boolean/);
  });

  it("valida formato [a-zA-Z0-9_]{3,20} (case-sensitive, Abr 2026)", () => {
    expect(SRC).toMatch(/\^\[a-zA-Z0-9_\]\{3,20\}\$/);
  });

  it("rechaza usernames reservados (USERNAME_RESERVADO 409)", () => {
    expect(SRC).toMatch(/esReservado/);
    expect(SRC).toMatch(/USERNAME_RESERVADO/);
  });

  it("rechaza usernames ofensivos (USERNAME_OFENSIVO 409)", () => {
    expect(SRC).toMatch(/esUsernameOfensivo/);
    expect(SRC).toMatch(/USERNAME_OFENSIVO/);
  });

  it("crea usuario con usernameLocked=true + tycAceptadosAt=now + bonus 500", () => {
    expect(SRC).toMatch(/usernameLocked:\s*true/);
    expect(SRC).toMatch(/tycAceptadosAt:\s*new\s+Date\(\)/);
    expect(SRC).toMatch(/BONUS_BIENVENIDA_LUKAS\s*=\s*500/);
    expect(SRC).toMatch(/tipo:\s*["']BONUS["']/);
  });

  it("detecta email_en_uso y username_en_uso antes de crear", () => {
    expect(SRC).toMatch(/EMAIL_EN_USO/);
    expect(SRC).toMatch(/USERNAME_EN_USO/);
  });
});

describe("POST /api/v1/auth/completar-perfil — contrato del endpoint", () => {
  const SRC = read("app/api/v1/auth/completar-perfil/route.ts");

  it("requiere sesión (NoAutenticado si no hay)", () => {
    expect(SRC).toMatch(/NoAutenticado/);
  });

  it("rechaza si el usuario ya completó (YA_COMPLETADO 409)", () => {
    expect(SRC).toMatch(/YA_COMPLETADO/);
  });

  it("actualiza username + usernameLocked=true + tycAceptadosAt=now", () => {
    expect(SRC).toMatch(/usernameLocked:\s*true/);
    expect(SRC).toMatch(/tycAceptadosAt:\s*new\s+Date\(\)/);
  });

  it("valida que username no esté en la lista reservada", () => {
    expect(SRC).toMatch(/esReservado/);
  });
});

describe("GET /api/v1/auth/username-disponible — contrato del endpoint", () => {
  const SRC = read("app/api/v1/auth/username-disponible/route.ts");

  it("devuelve razones tipadas: FORMATO_INVALIDO | RESERVADO | TOMADO", () => {
    expect(SRC).toMatch(/FORMATO_INVALIDO/);
    expect(SRC).toMatch(/RESERVADO/);
    expect(SRC).toMatch(/TOMADO/);
  });

  it("es force-dynamic (no cachea)", () => {
    expect(SRC).toMatch(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
    );
  });
});

// ---------------------------------------------------------------------------
// Páginas /auth/*
// ---------------------------------------------------------------------------

describe("/auth/signin — página", () => {
  const SRC = read("app/auth/signin/page.tsx");

  it("usa el GoogleButton para OAuth", () => {
    expect(SRC).toMatch(/GoogleButton/);
  });

  it("redirige a /auth/signup cuando el email no existe (hint=no-account)", () => {
    expect(SRC).toMatch(/hint=no-account/);
    expect(SRC).toMatch(/\/auth\/signup/);
  });
});

describe("/auth/signup — página", () => {
  const SRC = read("app/auth/signup/page.tsx");

  it("usa GoogleButton + SignupForm", () => {
    expect(SRC).toMatch(/GoogleButton/);
    expect(SRC).toMatch(/SignupForm/);
  });

  it("menciona el bonus de 500 Lukas", () => {
    expect(SRC).toMatch(/500 Lukas/);
  });
});

describe("/auth/completar-perfil — página", () => {
  const SRC = read("app/auth/completar-perfil/page.tsx");

  it("redirige a /auth/signin si no hay sesión", () => {
    expect(SRC).toMatch(/\/auth\/signin/);
    expect(SRC).toMatch(/redirect/);
  });

  it("redirige al callbackUrl si usernameLocked ya es true", () => {
    expect(SRC).toMatch(/usernameLocked/);
  });

  it("usa CompletarPerfilForm", () => {
    expect(SRC).toMatch(/CompletarPerfilForm/);
  });
});

// ---------------------------------------------------------------------------
// Types — session.user.username + usernameLocked
// ---------------------------------------------------------------------------

describe("types/next-auth.d.ts — extensiones de registro formal", () => {
  const SRC = read("types/next-auth.d.ts");

  it("declara username y usernameLocked en Session", () => {
    expect(SRC).toMatch(/username:\s*string/);
    expect(SRC).toMatch(/usernameLocked:\s*boolean/);
  });

  it("declara los mismos campos en JWT", () => {
    expect(SRC).toMatch(/username\?:\s*string/);
    expect(SRC).toMatch(/usernameLocked\?:\s*boolean/);
  });
});
