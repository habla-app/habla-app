// Tests del Hotfix #5 Bug #14: todos los consumers UI del balance de
// Lukas deben leer del `useLukasStore`, nunca de `session.user.balanceLukas`
// directo en client-side. Los casos del Hotfix #4 cubrían
// BalanceBadge + BalancePill; aquí agregamos:
//
//   - SidebarBalanceWidget (nuevo): widget "🪙 Tu balance" de /matches
//     que antes servía desde SSR y quedaba stale tras inscribirse.
//   - WalletBalanceHero (nuevo): hero de /wallet con el monto gigante,
//     mismo problema que antes.
//   - Regresión estructural: ningún Client Component bajo
//     apps/web/components/ o apps/web/app/ debe contener
//     `session.user.balanceLukas` / `session?.user?.balanceLukas`.
//     Whitelist explícita para los puntos de hidratación legítimos
//     (hydrator, layout, y páginas RSC que sirven `initialBalance`).
//
// También confirmamos que el footer del ComboModal consume el balance
// del store en vivo (no un valor stale capturado en un useMemo sin
// deps).

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { computeComboFooterState } from "@/components/combo/combo-info.mapper";

const ROOT = resolve(__dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// computeComboFooterState — Bug #14(a): el ComboModal debe mostrar
// `balance - costoLukas`, no el balance crudo.
// ---------------------------------------------------------------------------

describe("computeComboFooterState — balance post-pago correcto (Bug #14a)", () => {
  it("BUG REPRO: balance=495 del store, costo=5 → displayBalanceDespues=490 (NO 495)", () => {
    const f = computeComboFooterState({
      balance: 495,
      entradaLukas: 5,
      tienePlaceholder: false,
    });
    expect(f.displayBalanceDespues).toBe(490);
    expect(f.displayBalanceDespues).not.toBe(495);
  });

  it("con placeholder costoLukas=0 y displayBalanceDespues==balance (Ya cobrada)", () => {
    // Caso legítimo donde "Balance después" == balance actual: ya se
    // cobró la entrada al inscribirse. Esto NO es bug.
    const f = computeComboFooterState({
      balance: 495,
      entradaLukas: 5,
      tienePlaceholder: true,
    });
    expect(f.costoLukas).toBe(0);
    expect(f.displayBalanceDespues).toBe(495);
  });
});

describe("ComboModal — balance del store pasa al footer state (Bug #14a)", () => {
  const SRC = readSrc("components/combo/ComboModal.tsx");

  it("lee balance del store con useLukasStore((s) => s.balance)", () => {
    expect(SRC).toMatch(/useLukasStore\s*\(\s*\(\s*s\s*\)\s*=>\s*s\.balance\s*\)/);
  });

  it("el useMemo del footer incluye `balance` en las deps (no stale)", () => {
    // `computeComboFooterState({balance, entradaLukas, tienePlaceholder})`
    // debe re-evaluarse cuando cambia `balance` del store.
    expect(SRC).toMatch(/useMemo\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?computeComboFooterState[\s\S]*?balance,[\s\S]*?\}\s*,\s*\[\s*balance\s*,\s*torneo\s*\]\s*\)/);
  });

  it("renderiza `displayBalanceDespues` del footer, no `balance` crudo", () => {
    // `Balance después` debe mostrar el valor post-pago.
    expect(SRC).toMatch(
      /label=["']Balance después["'][\s\S]*?displayBalanceDespues/,
    );
  });
});

// ---------------------------------------------------------------------------
// SidebarBalanceWidget — nuevo client component (Bug #14b)
// ---------------------------------------------------------------------------

describe("SidebarBalanceWidget.tsx — widget del sidebar migrado al store", () => {
  const SRC = readSrc("components/matches/SidebarBalanceWidget.tsx");

  it('declara "use client"', () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("lee del store con selector `s => s.balance`", () => {
    expect(SRC).toMatch(/useLukasStore\s*\(\s*\(\s*s\s*\)\s*=>\s*s\.balance\s*\)/);
  });

  it("acepta initialBalance (number | null) para el primer paint", () => {
    expect(SRC).toMatch(/initialBalance:\s*number\s*\|\s*null/);
  });

  it("usa el guard mounted ? storeBalance : initialBalance", () => {
    expect(SRC).toMatch(/useState\s*\(\s*false\s*\)/);
    expect(SRC).toMatch(/mounted\s*\?\s*storeBalance\s*:\s*initialBalance/);
  });

  it("initialBalance null renderiza el card 'inicia sesión' (sin leer store)", () => {
    expect(SRC).toMatch(/initialBalance\s*===\s*null/);
  });

  it("tiene data-testid='sidebar-balance-widget' y 'sidebar-balance-amount'", () => {
    expect(SRC).toMatch(/data-testid=["']sidebar-balance-widget["']/);
    expect(SRC).toMatch(/data-testid=["']sidebar-balance-amount["']/);
  });
});

describe("MatchesSidebar.tsx — delega el widget al componente client", () => {
  const SRC = readSrc("components/matches/MatchesSidebar.tsx");

  it("importa SidebarBalanceWidget", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*SidebarBalanceWidget\s*\}\s*from\s*["']@\/components\/matches\/SidebarBalanceWidget["']/,
    );
  });

  it("renderiza <SidebarBalanceWidget initialBalance={balance} />", () => {
    expect(SRC).toMatch(/<SidebarBalanceWidget\s+initialBalance=\{balance\}/);
  });

  it("YA NO tiene las funciones inline BalanceWidget / LoggedBalance inline", () => {
    // Eliminadas al migrar al client component. Si alguien las re-agrega
    // por "simplicidad", el widget deja de escuchar el store.
    expect(SRC).not.toMatch(/function\s+BalanceWidget\s*\(/);
    expect(SRC).not.toMatch(/function\s+LoggedBalance\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// WalletBalanceHero — nuevo client component (Bug #14b extendido)
// ---------------------------------------------------------------------------

describe("WalletBalanceHero.tsx — hero de /wallet migrado al store", () => {
  const SRC = readSrc("components/wallet/WalletBalanceHero.tsx");

  it('declara "use client"', () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("lee del store con selector `s => s.balance`", () => {
    expect(SRC).toMatch(/useLukasStore\s*\(\s*\(\s*s\s*\)\s*=>\s*s\.balance\s*\)/);
  });

  it("usa el guard mounted ? storeBalance : initialBalance", () => {
    expect(SRC).toMatch(/mounted\s*\?\s*storeBalance\s*:\s*initialBalance/);
  });

  it("tiene data-testid='wallet-balance-hero' y 'wallet-balance-amount'", () => {
    expect(SRC).toMatch(/data-testid=["']wallet-balance-hero["']/);
    expect(SRC).toMatch(/data-testid=["']wallet-balance-amount["']/);
  });
});

describe("/wallet/page.tsx — delega la UI al orquestador client", () => {
  const SRC = readSrc("app/(main)/wallet/page.tsx");

  it("importa WalletView (que internamente usa WalletBalanceHero)", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*WalletView\s*\}\s*from\s*["']@\/components\/wallet\/WalletView["']/,
    );
  });

  it("pasa initialBalance={vista.balance} al orquestador", () => {
    expect(SRC).toMatch(/initialBalance=\{vista\.balance\}/);
  });

  it("YA NO renderiza el monto inline en JSX", () => {
    expect(SRC).not.toMatch(/text-\[64px\][\s\S]*?balance\.toLocaleString/);
    expect(SRC).not.toMatch(/text-\[80px\][\s\S]*?balance\.toLocaleString/);
  });
});

describe("WalletView.tsx — cadena balance: page → WalletView → WalletBalanceHero", () => {
  const SRC = readSrc("components/wallet/WalletView.tsx");

  it('declara "use client"', () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("importa WalletBalanceHero", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*WalletBalanceHero\s*\}\s*from\s*["']\.\/WalletBalanceHero["']/,
    );
  });

  it("reenvía initialBalance al hero (se hidrata via store en el hero)", () => {
    expect(SRC).toMatch(/initialBalance=\{initialBalance\}/);
  });
});

// ---------------------------------------------------------------------------
// Regresión estructural: ningún "use client" bajo components/ o app/
// debe leer `session.user.balanceLukas` directo
// ---------------------------------------------------------------------------

/**
 * Archivos permitidos a leer `session.user.balanceLukas` / `session?.user?.balanceLukas`
 * en JSX/TSX porque son puntos legítimos de hidratación:
 *   - Layout del grupo (main) — pasa `initialBalance` al hydrator + NavBar.
 *   - Páginas RSC (server) que leen la sesión y pasan el balance como
 *     prop al client component correspondiente.
 *
 * Cualquier archivo NO listado que contenga este pattern cae al test y
 * debe migrarse a recibir `initialBalance` como prop y delegar el
 * render al componente client que se suscribe al store.
 */
const WHITELIST: ReadonlyArray<string> = [
  "app/(main)/layout.tsx",
  "app/(main)/wallet/page.tsx",
  // Sub-Sprint 6: /tienda es RSC que lee la sesión una vez y pasa
  // `initialBalance` a TiendaContent (client) que se suscribe al store.
  "app/(main)/tienda/page.tsx",
  // Sidebar es Server Component que lee la sesión una sola vez y pasa
  // `initialBalance` al Client Component `SidebarBalanceWidget` (que sí
  // se suscribe al store). Mismo patrón que (main)/layout.
  "components/matches/MatchesSidebar.tsx",
];

function listTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".turbo")
        continue;
      listTsx(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Quita comentarios línea y bloque para que el regex no matchee los
 * `// Hotfix #... leía `session.user.balanceLukas`` que hay en varios
 * archivos como documentación del bug que se arregló.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("Regresión Bug #14: ningún client component lee session.user.balanceLukas directo", () => {
  const scan = [resolve(ROOT, "components"), resolve(ROOT, "app")];
  const allFiles: string[] = [];
  for (const d of scan) {
    listTsx(d, allFiles);
  }

  it("scan cubre al menos 40 archivos (sanity)", () => {
    expect(allFiles.length).toBeGreaterThan(40);
  });

  it("todo archivo que lea `session.user.balanceLukas` debe estar en WHITELIST", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      const src = stripComments(readFileSync(file, "utf-8"));
      const mentions = /session\??\.user\??\.balanceLukas/.test(src);
      if (!mentions) continue;
      if (WHITELIST.includes(rel)) continue;
      offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("los archivos del WHITELIST existen y sí leen el balance (sanity)", () => {
    for (const rel of WHITELIST) {
      const src = stripComments(readFileSync(resolve(ROOT, rel), "utf-8"));
      expect(src).toMatch(/session\??\.user\??\.balanceLukas/);
    }
  });
});
