// Tests del Hotfix #9 + registro formal (Abr 2026) — acceso a /perfil
// desde la navegación principal.
//
// Reglas fijadas:
//   1. BottomNav (mobile) 5° item es "Perfil" (Wallet accesible via BalanceBadge).
//   2. UserMenu (desktop, dropdown del avatar) tiene "Mi perfil".
//   3. /perfil protegido por middleware.
//   4. /perfil/page.tsx exporta force-dynamic + redirige a /auth/signin.
//
// Si un futuro PR quita cualquier entrada, el suite reventa antes del merge.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

const BOTTOMNAV_SRC = readFileSync(
  resolve(ROOT, "components/layout/BottomNav.tsx"),
  "utf-8",
);
const USERMENU_SRC = readFileSync(
  resolve(ROOT, "components/layout/UserMenu.tsx"),
  "utf-8",
);
const MIDDLEWARE_SRC = readFileSync(
  resolve(ROOT, "middleware.ts"),
  "utf-8",
);
const PERFIL_PAGE_SRC = readFileSync(
  resolve(ROOT, "app/(main)/perfil/page.tsx"),
  "utf-8",
);
const BALANCE_BADGE_SRC = readFileSync(
  resolve(ROOT, "components/layout/BalanceBadge.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// BottomNav mobile — entrada visible a /perfil
// ---------------------------------------------------------------------------

describe("BottomNav (mobile) — /perfil accesible en ≤1 tap", () => {
  it('incluye un item con href="/perfil"', () => {
    expect(BOTTOMNAV_SRC).toMatch(/href:\s*["']\/perfil["']/);
  });

  it('lo etiqueta como "Perfil"', () => {
    expect(BOTTOMNAV_SRC).toMatch(/label:\s*["']Perfil["']/);
  });

  it('matchea rutas que empiezan con /perfil (active state correcto)', () => {
    expect(BOTTOMNAV_SRC).toMatch(
      /match:\s*\(p\)\s*=>\s*p\.startsWith\(["']\/perfil["']\)/,
    );
  });

  it("BUG REPRO: /perfil NO puede estar ausente del array ITEMS", () => {
    expect(BOTTOMNAV_SRC).toContain('href: "/perfil"');
  });

  it("Hotfix #9: Wallet NO está en BottomNav (accesible via BalanceBadge del header)", () => {
    expect(BOTTOMNAV_SRC).not.toMatch(/href:\s*["']\/wallet["']/);
    expect(BOTTOMNAV_SRC).not.toMatch(/label:\s*["']Wallet["']/);
  });

  it("exactamente 5 items en el array ITEMS (UX mobile estándar)", () => {
    const matches = BOTTOMNAV_SRC.match(/href:\s*["']\//g);
    expect(matches?.length ?? 0).toBe(5);
  });

  it("preserva el BalanceBadge como alternativa a Wallet", () => {
    expect(BALANCE_BADGE_SRC).toMatch(/href=["']\/wallet["']/);
  });
});

// ---------------------------------------------------------------------------
// UserMenu — /perfil en el dropdown del avatar
// ---------------------------------------------------------------------------

describe("UserMenu (header avatar) — /perfil en el dropdown", () => {
  it('tiene un <Link href="/perfil"> como menuitem', () => {
    expect(USERMENU_SRC).toMatch(/href=["']\/perfil["']/);
    expect(USERMENU_SRC).toMatch(/role=["']menuitem["']/);
  });

  it('la etiqueta visible es "Mi perfil"', () => {
    expect(USERMENU_SRC).toMatch(/Mi perfil/);
  });

  it("cierra el dropdown tras click (UX correcto)", () => {
    const blockMatch = USERMENU_SRC.match(
      /<Link\s+href=["']\/perfil["'][^>]*onClick=\{[^}]*setAbierto\(false\)/,
    );
    expect(blockMatch).not.toBeNull();
  });

  it("muestra @username (registro formal Abr 2026) en vez de nombre", () => {
    // Si usernameLocked=true renderiza @username; si =false renderiza CTA
    // "Elegí tu @handle →" linkeando a /auth/completar-perfil.
    expect(USERMENU_SRC).toMatch(/@\{username\}/);
    expect(USERMENU_SRC).toMatch(/\/auth\/completar-perfil/);
  });
});

// ---------------------------------------------------------------------------
// Middleware — /perfil protegido
// ---------------------------------------------------------------------------

describe("middleware — /perfil exige sesión", () => {
  it("/perfil/:path* en PROTECTED_MATCHERS", () => {
    expect(MIDDLEWARE_SRC).toMatch(/"\/perfil\/:path\*"/);
  });

  it("config.matcher duplica /perfil/:path* (sin drift con PROTECTED_MATCHERS)", () => {
    const configMatch = MIDDLEWARE_SRC.match(
      /export\s+const\s+config\s*=\s*\{[\s\S]+?matcher:\s*\[([\s\S]+?)\]/,
    );
    expect(configMatch).not.toBeNull();
    expect(configMatch![1]!).toContain('"/perfil/:path*"');
  });

  it("redirige a /auth/completar-perfil si usernameLocked=false", () => {
    // Registro formal: el middleware añadió el chequeo de usernameLocked.
    expect(MIDDLEWARE_SRC).toMatch(/usernameLocked/);
    expect(MIDDLEWARE_SRC).toMatch(/\/auth\/completar-perfil/);
  });
});

// ---------------------------------------------------------------------------
// /perfil/page.tsx — RSC requisitos
// ---------------------------------------------------------------------------

describe("/perfil/page.tsx — contrato RSC", () => {
  it("exporta dynamic = 'force-dynamic'", () => {
    expect(PERFIL_PAGE_SRC).toMatch(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
    );
  });

  it("llama auth() y redirige a /auth/signin si no hay sesión", () => {
    expect(PERFIL_PAGE_SRC).toMatch(/auth\s*\(\s*\)/);
    expect(PERFIL_PAGE_SRC).toMatch(/redirect\s*\(\s*["']\/auth\/signin/);
  });
});
