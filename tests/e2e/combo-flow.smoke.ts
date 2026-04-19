// Playwright smoke test — flujo crítico del Sub-Sprint 4:
//   login → /matches → abrir ComboModal → crear ticket → verlo en
//   /mis-combinadas → check que los chips pintan en pending.
//
// Este archivo es un SCRIPT (no un test runner) porque el proyecto
// todavía no tiene Playwright instalado — se suma en el Sprint 8 (QA)
// con la config completa. Se ejecuta como:
//
//   npx playwright test tests/e2e/combo-flow.smoke.ts
//
// Pre-requisitos antes de correrlo:
//   - npm i -D @playwright/test
//   - crear playwright.config.ts con webServer que arranque `pnpm dev`
//   - un usuario de test sembrado con balance suficiente

/* eslint-disable */
// @ts-nocheck — este archivo se tipará cuando Playwright se agregue.
import { test, expect } from "@playwright/test";

test.describe("Combo flow — smoke", () => {
  test.beforeEach(async ({ page }) => {
    // TODO(Sprint 8): resolver el magic-link programáticamente via
    // la tabla auth_verification_tokens + el Resend test mode.
    await page.goto("/auth/login?callbackUrl=/matches");
  });

  test("abre modal y crea ticket", async ({ page }) => {
    await page.goto("/matches");
    // Click en el primer CTA "Crear combinada" (botón "Crear" en el sidebar
    // de la MatchCard; se selecciona por rol + texto).
    await page.getByRole("button", { name: /crear combinada/i }).first().click();

    // El modal debe aparecer — aria-label "Crear combinada"
    const modal = page.getByRole("dialog", { name: /crear combinada/i });
    await expect(modal).toBeVisible();

    // Llenar las 5 predicciones
    await modal.getByRole("button", { name: /local|alianza/i }).first().click();
    await modal.getByRole("button", { name: /^sí$/i }).first().click(); /* BTTS Sí */
    await modal.getByRole("button", { name: /^no$/i }).first().click(); /* +2.5 No */
    await modal.getByRole("button", { name: /^no$/i }).nth(1).click(); /* Roja No */
    // Marcador default 1-1; cambio a 2-1 con el +
    await modal.getByRole("button", { name: /sumar gol a/i }).first().click();

    // Submit
    const submit = modal.getByRole("button", { name: /inscribir por/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(modal).toBeHidden({ timeout: 5000 });

    // Al volver al ver /mis-combinadas, el ticket recién creado debe
    // aparecer en la tab "Activas" con los chips en pending (gris).
    await page.goto("/mis-combinadas");
    await expect(page.getByText(/ticket 1 de/i).first()).toBeVisible();
  });

  test("modal bloquea submit si faltan predicciones", async ({ page }) => {
    await page.goto("/matches");
    await page.getByRole("button", { name: /crear combinada/i }).first().click();
    const modal = page.getByRole("dialog", { name: /crear combinada/i });
    await expect(modal).toBeVisible();

    const submit = modal.getByRole("button", { name: /inscribir por/i });
    // Sin elegir ninguna predicción debe estar deshabilitado
    await expect(submit).toBeDisabled();
  });
});
