// Tests del fix Bug #4 / Hotfix #3 post-Sub-Sprint 5: el Modal quedaba
// atrapado en el stacking context de algún ancestor con `transform`
// (hover translate del MatchCard, animate-scale-in, etc.), causando que
// `position: fixed` del overlay se anclara al ancestor en vez del
// viewport. El modal aparecía "difuminado" entre las cards y la página
// parecía congelarse.
//
// Fix: `createPortal(overlay, document.body)` renderiza el modal como
// child directo del body, fuera de cualquier stacking context.
//
// Vitest corre en environment node sin jsdom — no podemos render-testear.
// Hacemos assertion estructural sobre el archivo fuente.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const MODAL_PATH = resolve(ROOT, "components", "ui", "Modal.tsx");
const MODAL_SRC = readFileSync(MODAL_PATH, "utf-8");

describe("Modal.tsx — renderiza via createPortal", () => {
  it("importa createPortal de react-dom", () => {
    expect(MODAL_SRC).toMatch(
      /import\s+\{\s*createPortal\s*\}\s+from\s+["']react-dom["']/,
    );
  });

  it("BUG REPRO: usa createPortal(overlay, document.body) para escapar del stacking context", () => {
    // Sin este portal, el hover `-translate-y-px` del MatchCard (que
    // crea un nuevo containing block via `transform`) atrapaba al
    // overlay fixed — se renderizaba dentro del <article> y quedaba
    // superpuesto al contenido visible de la lista.
    expect(MODAL_SRC).toMatch(/createPortal\s*\(\s*overlay\s*,\s*document\.body\s*\)/);
  });

  it("guarda contra SSR: `mounted` gate con useEffect antes de tocar document", () => {
    // document no existe server-side; el primer render pasa null, y el
    // effect post-mount setea `mounted=true` para evitar hydration
    // mismatch.
    expect(MODAL_SRC).toMatch(/useState\s*\(\s*false\s*\)/);
    expect(MODAL_SRC).toMatch(/!mounted/);
  });

  it("bloquea scroll de fondo mientras el modal está abierto", () => {
    expect(MODAL_SRC).toMatch(/document\.body\.style\.overflow\s*=\s*["']hidden["']/);
  });

  it("el overlay tiene role=dialog + aria-modal para accesibilidad", () => {
    expect(MODAL_SRC).toMatch(/role=["']dialog["']/);
    expect(MODAL_SRC).toMatch(/aria-modal=["']true["']/);
  });

  it("stopPropagation del panel interno evita cierre al clickear contenido", () => {
    expect(MODAL_SRC).toMatch(/stopPropagation/);
  });
});
