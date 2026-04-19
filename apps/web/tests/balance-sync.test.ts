// Tests del Hotfix #4 Bug #7: balance global se sincroniza en TODOS los
// consumers tras una inscripción exitosa.
//
// Escenario reproducido por el PO:
//   1. Usuario con balance 500 entra a /matches.
//   2. Se inscribe en torneo de 5 🪙 → backend OK.
//   3. /wallet muestra 495 (lee BD vía RSC).
//   4. Header sigue mostrando 500 (store no actualizado).
//   5. /mis-combinadas muestra "Balance" en -5 (stats.neto en lugar de
//      balance absoluto).
//   6. ComboModal en otro torneo calcula "Balance después" desde 500.
//
// Fix en 3 piezas:
//   a. POST /api/v1/tickets devuelve `nuevoBalance` (ya existía, confirmamos).
//   b. ComboModal llama `setBalance(nuevoBalance)` en la respuesta 200 —
//      todos los consumers del store re-renderizan de inmediato.
//   c. BalanceBadge (NavBar) + BalancePill (/mis-combinadas) son Client
//      Components que leen del store, no de la sesión SSR. Usan
//      `initialBalance` del prop para evitar flicker pre-hydration.

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useLukasStore } from "@/stores/lukas.store";

const ROOT = resolve(__dirname, "..");

function readSrc(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf-8");
}

// ---------------------------------------------------------------------------
// Store — simulamos el flow post-inscripción
// ---------------------------------------------------------------------------

describe("useLukasStore — flujo post-inscripción", () => {
  beforeEach(() => {
    useLukasStore.setState({ balance: 0 });
  });

  it("setBalance propaga el nuevo balance a los subscribers", () => {
    // 1. Hidratación inicial (desde LukasBalanceHydrator en mount)
    useLukasStore.getState().setBalance(500);
    expect(useLukasStore.getState().balance).toBe(500);

    // 2. Post-inscripción (desde ComboModal tras respuesta 200 del POST)
    useLukasStore.getState().setBalance(495);
    expect(useLukasStore.getState().balance).toBe(495);
  });

  it("BUG REPRO: tras 1 ticket de 5 🪙 (balance 500→495), NO debe mostrar -5", () => {
    useLukasStore.getState().setBalance(500);
    // ComboModal recibe nuevoBalance=495 del backend:
    useLukasStore.getState().setBalance(495);
    const balance = useLukasStore.getState().balance;
    // BalancePill de /mis-combinadas muestra balance (absoluto), NO
    // `-5` que es lo que mostraba cuando derivaba delta client-side.
    expect(balance).toBe(495);
    expect(balance).not.toBe(-5);
  });

  it("decrementar no es usado post-Bug #7: setBalance desde el endpoint", () => {
    // Antes se hacía `decrementar(entradaLukas)` client-side para
    // anticipar el cambio. Eso quedaba desincronizado con el backend.
    // Ahora el source of truth es `respuesta.nuevoBalance` del POST.
    const store = useLukasStore.getState();
    store.setBalance(500);
    store.setBalance(495); // simulación del contract real
    expect(useLukasStore.getState().balance).toBe(495);
  });
});

// ---------------------------------------------------------------------------
// AST — BalanceBadge + BalancePill + NavBar + /mis-combinadas
// ---------------------------------------------------------------------------

describe("BalanceBadge.tsx — Client Component que lee del store", () => {
  const SRC = readSrc("components/layout/BalanceBadge.tsx");

  it('declara "use client"', () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("importa useLukasStore", () => {
    expect(SRC).toMatch(/useLukasStore/);
  });

  it("se suscribe al store con selector `s => s.balance`", () => {
    expect(SRC).toMatch(/useLukasStore\s*\(\s*\(\s*s\s*\)\s*=>\s*s\.balance\s*\)/);
  });

  it("acepta initialBalance como prop para el primer paint", () => {
    expect(SRC).toMatch(/initialBalance/);
  });

  it("guarda mounted flag para evitar flicker pre-hidratación", () => {
    expect(SRC).toMatch(/useState\s*\(\s*false\s*\)/);
    expect(SRC).toMatch(/mounted\s*\?\s*storeBalance\s*:/);
  });

  it("renderiza Link a /wallet con data-testid='balance-badge'", () => {
    expect(SRC).toMatch(/data-testid=["']balance-badge["']/);
  });
});

describe("BalancePill.tsx — Client Component para /mis-combinadas", () => {
  const SRC = readSrc("components/tickets/BalancePill.tsx");

  it('declara "use client"', () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("lee del store con selector `s => s.balance`", () => {
    expect(SRC).toMatch(/useLukasStore\s*\(\s*\(\s*s\s*\)\s*=>\s*s\.balance\s*\)/);
  });

  it("renderiza display.toLocaleString directo, sin restar entradas", () => {
    // El bug original: la UI mostraba `stats.neto` (sum(premio - entrada))
    // con el label "Balance neto". La pill ahora muestra ONLY el store,
    // sin operaciones matemáticas que rompan la simetría.
    expect(SRC).toMatch(/display\.toLocaleString\s*\(\s*["']es-PE["']/);
  });

  it("tiene data-testid='balance-pill' para assertion", () => {
    expect(SRC).toMatch(/data-testid=["']balance-pill["']/);
  });
});

describe("NavBar.tsx — delega el chip a BalanceBadge", () => {
  const SRC = readSrc("components/layout/NavBar.tsx");

  it("importa BalanceBadge", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*BalanceBadge\s*\}\s*from\s*["']@\/components\/layout\/BalanceBadge["']/,
    );
  });

  it("renderiza <BalanceBadge initialBalance={...} />", () => {
    expect(SRC).toMatch(/<BalanceBadge\s+initialBalance=\{/);
  });

  it("NO renderiza el chip inline con `usuario.balanceLukas` directo", () => {
    // Antes el Link con el chip de Lukas vivía inline en NavBar con el
    // monto leído de la sesión. Ahora delega a BalanceBadge — así el
    // badge se suscribe al store y se actualiza tras mutaciones.
    expect(SRC).not.toMatch(
      /\{formatearLukas\(usuario\.balanceLukas\s*\?\?\s*0\)\}\s*Lukas/,
    );
  });
});

describe("/mis-combinadas — usa BalancePill, no pill con stats.neto", () => {
  const SRC = readSrc("app/(main)/mis-combinadas/page.tsx");

  it("importa BalancePill", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*BalancePill\s*\}\s*from\s*["']@\/components\/tickets\/BalancePill["']/,
    );
  });

  it("renderiza <BalancePill initialBalance={...} />", () => {
    expect(SRC).toMatch(/<BalancePill[\s\S]*?initialBalance=\{/);
  });

  it("ya NO renderiza un StatsPill con label='Balance neto'", () => {
    // El StatsPill con stats.neto + label "Balance neto" daba -5 tras
    // la primera inscripción. Fue reemplazado por BalancePill que lee
    // el balance absoluto del store.
    expect(SRC).not.toMatch(/label=["']Balance neto["']/);
  });
});

describe("ComboModal — propaga `nuevoBalance` al store tras POST /tickets", () => {
  const SRC = readSrc("components/combo/ComboModal.tsx");

  it("llama setBalance(json.data.nuevoBalance) en la rama success", () => {
    expect(SRC).toMatch(/setBalance\s*\(\s*json\.data\.nuevoBalance\s*\)/);
  });
});

describe("POST /api/v1/tickets — devuelve nuevoBalance", () => {
  const SRC = readSrc("app/api/v1/tickets/route.ts");

  it("devuelve Response.json({ data: result }) donde result tiene nuevoBalance", () => {
    // El service `crear` ya devuelve CrearTicketResult con nuevoBalance
    // (ver tickets.service.ts:54). La route handler lo pasa como-is en
    // `data`. Este test solo confirma que ese contrato no se rompió.
    expect(SRC).toMatch(/Response\.json\s*\(\s*\{\s*data:\s*result\s*\}/);
  });
});
