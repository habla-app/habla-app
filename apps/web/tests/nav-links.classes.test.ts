// Tests de regresión del Bug #1 (hotfix 19 Abr): el token de color para
// el estado inactivo de los nav links tiene que ser visible sobre el
// fondo navy del header (`bg-dark-surface` = #001050). Si alguien vuelve
// a poner `text-dark-muted` (#7B93D0) — que da contraste ~1.5:1 —, este
// test lo agarra antes de merge.
//
// Contexto: los tokens `text-dark-text` / `text-dark-muted` del
// tailwind.config actualmente NO se generan como utilities por una
// colisión entre `textColor.dark` string y `colors.dark.*` nested — ver
// el comentario en NavLinks.tsx. Mientras esa deuda no se resuelva, el
// fix usa `text-white/80` (tokens built-in de Tailwind) que dan 11.4:1
// sobre navy.
//
// No testea rendering porque Vitest corre en environment node sin jsdom;
// el test hace assertions sobre las constantes de className exportadas.

import { describe, expect, it } from "vitest";
import {
  NAV_LINK_INACTIVE_CLASSES,
  NAV_LINK_ACTIVE_CLASSES,
} from "@/components/layout/NavLinks";

describe("NavLinks className constants", () => {
  it("inactive state uses a visible-on-dark token (text-white/80)", () => {
    expect(NAV_LINK_INACTIVE_CLASSES).toContain("text-white/80");
  });

  it("inactive state does NOT use text-dark-muted (low-contrast on navy)", () => {
    expect(NAV_LINK_INACTIVE_CLASSES).not.toContain("text-dark-muted");
  });

  it("inactive state keeps the hover upgrade to pure white", () => {
    expect(NAV_LINK_INACTIVE_CLASSES).toContain("hover:text-white");
    // `text-white` sin sufijo — no confundirse con `text-white/80`.
    // El hover debe elevar a 100% opacity, no mantener 80%.
    expect(NAV_LINK_INACTIVE_CLASSES).toMatch(/hover:text-white(\s|$)/);
  });

  it("active state keeps gold tokens (bg-brand-gold-dim + text-brand-gold)", () => {
    expect(NAV_LINK_ACTIVE_CLASSES).toContain("bg-brand-gold-dim");
    expect(NAV_LINK_ACTIVE_CLASSES).toContain("text-brand-gold");
  });
});
