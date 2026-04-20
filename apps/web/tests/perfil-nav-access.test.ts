// Tests del Hotfix #9 — acceso a /perfil desde la navegación principal.
//
// Problema reportado en prod (21 Abr): el usuario logueado no tenía una
// entrada visible en el nav para llegar a /perfil. Desktop: el UserMenu
// ya tenía "Mi perfil" en el dropdown del avatar (2 clicks). Mobile: el
// BottomNav NO exponía ningún link a /perfil — el Sub-Sprint 7 completo
// quedaba invisible en la UI mobile.
//
// Fix:
//   1. BottomNav (mobile) reemplaza "Wallet" por "Perfil" como 5° item.
//      Wallet sigue accesible en 1 tap via BalanceBadge del header.
//   2. UserMenu ya tenía "Mi perfil" — este test lo fija como regla.
//   3. /perfil protegido en middleware (ya estaba desde Sub-Sprint 7).
//
// Objetivo de regresión: si alguien en un PR futuro quita la entrada de
// /perfil de cualquiera de esos 3 lugares, el suite reventa antes del merge.

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
// BottomNav mobile — entrada visible a /perfil (Hotfix #9)
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
    // Antes del Hotfix #9 el BottomNav tenía: Partidos, En vivo, Tickets,
    // Tienda, Wallet — ningún link a /perfil. El usuario mobile tenía que
    // adivinar que el avatar del header (UserMenu) tenía el acceso. Este
    // test fija la regla de que /perfil SIEMPRE debe estar en el
    // BottomNav mobile.
    expect(BOTTOMNAV_SRC).toContain('href: "/perfil"');
  });

  it("Hotfix #9: Wallet NO está en BottomNav (accesible via BalanceBadge del header)", () => {
    // El BalanceBadge es un <Link href="/wallet"> siempre visible en el
    // NavBar (tanto desktop como mobile). Mantener Wallet en el BottomNav
    // era redundante y consumía un slot mejor aprovechable por Perfil.
    expect(BOTTOMNAV_SRC).not.toMatch(/href:\s*["']\/wallet["']/);
    expect(BOTTOMNAV_SRC).not.toMatch(/label:\s*["']Wallet["']/);
  });

  it("exactamente 5 items en el array ITEMS (UX mobile estándar)", () => {
    const matches = BOTTOMNAV_SRC.match(/href:\s*["']\//g);
    expect(matches?.length ?? 0).toBe(5);
  });

  it("preserva el BalanceBadge como alternativa a Wallet", () => {
    // Este test no valida el BottomNav directamente — fija la regla de
    // que el BalanceBadge SIGUE siendo un link a /wallet. Si alguien
    // futuro cambia el link, tiene que también revisar la decisión del
    // Hotfix #9 de mover Wallet fuera del BottomNav.
    expect(BALANCE_BADGE_SRC).toMatch(/href=["']\/wallet["']/);
  });
});

// ---------------------------------------------------------------------------
// UserMenu — /perfil en el dropdown del avatar (ya existía, fijar invariante)
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
    // onClick={() => setAbierto(false)} asegura que al navegar a /perfil
    // el dropdown no queda abierto sobre la nueva página.
    const blockMatch = USERMENU_SRC.match(
      /<Link\s+href=["']\/perfil["'][^>]*onClick=\{[^}]*setAbierto\(false\)/,
    );
    expect(blockMatch).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Middleware — /perfil protegido (ya estaba, fijar invariante)
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

  it("llama auth() y redirige a /auth/login si no hay sesión", () => {
    expect(PERFIL_PAGE_SRC).toMatch(/auth\s*\(\s*\)/);
    expect(PERFIL_PAGE_SRC).toMatch(/redirect\s*\(\s*["']\/auth\/login/);
  });
});
