// Tests del Bug #1 (hotfix post-Sub-Sprint 5): el store de Lukas se
// inicializa en `0` y antes nunca se hidrataba desde la sesión NextAuth.
// El ComboModal mostraba "Balance después: -<entrada>" para usuarios sin
// tickets previos en ese torneo porque calculaba `0 - entradaLukas`.
//
// Ahora `(main)/layout.tsx` llama `auth()` y pasa el balance al cliente
// vía `LukasBalanceHydrator` que hace `setBalance(initialBalance)` en su
// primer effect. Estos tests verifican el contrato del store + que el
// hydrator existe y consume `useLukasStore`.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useLukasStore } from "@/stores/lukas.store";

describe("useLukasStore — contrato", () => {
  it("default initial balance es 0 (esto es el origen del bug si no se hidrata)", () => {
    // Reset por si tests previos lo mutaron
    useLukasStore.setState({ balance: 0 });
    expect(useLukasStore.getState().balance).toBe(0);
  });

  it("setBalance reemplaza el balance entero (no suma)", () => {
    useLukasStore.setState({ balance: 0 });
    useLukasStore.getState().setBalance(500);
    expect(useLukasStore.getState().balance).toBe(500);
    useLukasStore.getState().setBalance(495);
    expect(useLukasStore.getState().balance).toBe(495);
  });

  it("decrementar nunca deja balance negativo (Math.max(0, ...))", () => {
    useLukasStore.setState({ balance: 5 });
    useLukasStore.getState().decrementar(10);
    expect(useLukasStore.getState().balance).toBe(0);
  });

  it("incrementar suma al balance actual", () => {
    useLukasStore.setState({ balance: 100 });
    useLukasStore.getState().incrementar(50);
    expect(useLukasStore.getState().balance).toBe(150);
  });
});

describe("LukasBalanceHydrator — estructura del archivo", () => {
  // No podemos render-testear porque vitest corre en environment node sin
  // jsdom. Verificamos que el componente exista, sea client component, y
  // consuma `setBalance` del store.
  const ROOT = resolve(__dirname, "..");
  const HYDRATOR_PATH = resolve(
    ROOT,
    "components",
    "auth",
    "LukasBalanceHydrator.tsx",
  );

  it("declara 'use client' (es Client Component)", () => {
    const content = readFileSync(HYDRATOR_PATH, "utf-8");
    expect(content).toMatch(/^"use client";/);
  });

  it("recibe initialBalance prop y llama setBalance del store", () => {
    const content = readFileSync(HYDRATOR_PATH, "utf-8");
    expect(content).toMatch(/initialBalance/);
    expect(content).toMatch(/setBalance/);
    expect(content).toMatch(/useLukasStore/);
  });

  it("usa useEffect para sincronizar (corre post-mount, no en render)", () => {
    const content = readFileSync(HYDRATOR_PATH, "utf-8");
    expect(content).toMatch(/useEffect/);
  });

  it("ignora null (sin sesión) sin tocar el store", () => {
    const content = readFileSync(HYDRATOR_PATH, "utf-8");
    expect(content).toMatch(/initialBalance === null/);
  });
});

describe("(main)/layout.tsx — monta el hydrator con balance de la sesión", () => {
  const ROOT = resolve(__dirname, "..");
  const LAYOUT_PATH = resolve(
    ROOT,
    "app",
    "(main)",
    "layout.tsx",
  );

  it("importa LukasBalanceHydrator y lo monta con auth()", () => {
    const content = readFileSync(LAYOUT_PATH, "utf-8");
    expect(content).toMatch(/LukasBalanceHydrator/);
    expect(content).toMatch(/await\s+auth\(\)/);
    expect(content).toMatch(/balanceLukas/);
  });

  it("es async (necesario para await auth())", () => {
    const content = readFileSync(LAYOUT_PATH, "utf-8");
    expect(content).toMatch(/export\s+default\s+async\s+function\s+MainLayout/);
  });
});
